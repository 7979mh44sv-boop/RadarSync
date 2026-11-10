"""Adapter between the HTTP layer and the radarsync_sim physics package.

This module only converts validated request models into the package's dataclasses and
calls existing, tested functions. It contains no physics of its own.
"""

from functools import lru_cache
from math import ceil

import annotated_types
import numpy as np

from app import schemas as S
from radarsync_sim import parameters as P
from radarsync_sim.consistency import check_against_sa65_phase_noise
from radarsync_sim.network import RadarNetworkConfig, simulate_network
from radarsync_sim.provenance import Provenance, Quantity
from radarsync_sim.radar import compare_scenarios, pair_relative, run_seeds
from radarsync_sim.scenarios import ClockScenario, all_scenarios, sa65
from radarsync_sim.stability import overlapping_adev
from radarsync_sim.timing_errors import ErrorCategory, NonClockTerm, SyncConfig, SyncMode, TermKind

USER_VALUE = "User-configured system parameter (API request); an assumption, not a sourced value."


@lru_cache(maxsize=1)
def scenario_registry() -> dict[str, ClockScenario]:
    return {s.key: s for s in all_scenarios()}


def get_scenario(key: str) -> ClockScenario:
    try:
        return scenario_registry()[key]
    except KeyError:
        raise KeyError(f"unknown scenario '{key}'; available: {sorted(scenario_registry())}") from None


def q_out(q: Quantity) -> S.QuantityOut:
    return S.QuantityOut(value=float(q.value), unit=q.unit, provenance=q.provenance.value, source=q.source)


def simulated(value: float, unit: str, source: str) -> S.QuantityOut:
    return S.QuantityOut(value=float(value), unit=unit, provenance="simulated", source=source)


# ---------------------------------------------------------------------------
# Scenarios
# ---------------------------------------------------------------------------
def list_scenarios() -> S.ScenarioListOut:
    out = []
    for s in scenario_registry().values():
        out.append(S.ScenarioOut(
            key=s.key, label=s.label, category=s.category.value,
            parameters={k: q_out(v) for k, v in s.parameters.items()},
            valid_tau_range_s=s.valid_tau_range,
            adev_at_1s=S.QuantityOut(
                value=float(s.model.adev(1.0)), unit="-", provenance="assumption",
                source="Analytic ADEV at tau = 1 s of the scenario's assumed power-law model.",
            ),
            notes=s.notes,
        ))
    return S.ScenarioListOut(
        scenarios=out,
        sa65_datasheet_adev=[
            S.SourcedPointOut(tau_s=t, adev=q.value, provenance=q.provenance.value, source=q.source)
            for t, q in sorted(P.SA65_ADEV_INDUSTRIAL.items())
        ],
        nextgen_target=S.SourcedPointOut(
            tau_s=1.0, adev=P.NEXTGEN_ADEV_1S_TARGET.value,
            provenance=P.NEXTGEN_ADEV_1S_TARGET.provenance.value, source=P.NEXTGEN_ADEV_1S_TARGET.source,
        ),
    )


# ---------------------------------------------------------------------------
# Allan deviation
# ---------------------------------------------------------------------------
def tau_grid(tau_min: float, tau_max: float, per_decade: int) -> np.ndarray:
    """Log-spaced grid that contains exact decade values (e.g. 1 s) when in range."""
    k = np.arange(ceil(np.log10(tau_min) * per_decade - 1e-9), np.floor(np.log10(tau_max) * per_decade + 1e-9) + 1)
    return 10.0 ** (k / per_decade)


def adev_curves(req: S.AdevRequest) -> S.AdevOut:
    taus = tau_grid(req.tau_min_s, req.tau_max_s, req.points_per_decade)
    curves = []
    for key in req.scenario_keys:
        s = get_scenario(key)
        lo, hi = s.valid_tau_range if s.valid_tau_range else (np.inf, -np.inf)
        curve = S.AdevCurveOut(
            scenario_key=key, label=s.label, tau_s=taus.tolist(),
            model_adev=np.asarray(s.model.adev(taus)).tolist(),
            constrained=[bool(lo * (1 - 1e-9) <= t <= hi * (1 + 1e-9)) for t in taus],
            model_provenance="assumption",
        )
        if req.include_simulated:
            real = s.model.simulate(req.simulated_samples, req.simulated_sample_interval_s, req.seed)
            est = overlapping_adev(real.x, req.simulated_sample_interval_s)
            curve.simulated_tau_s = est.taus.tolist()
            curve.simulated_adev = est.adev.tolist()
            curve.simulated_provenance = "simulated"
        curves.append(curve)
    return S.AdevOut(curves=curves, seed=req.seed, notes=[
        "Model curves are the analytic ADEV of each scenario's assumed power-law noise model (including drift).",
        "Simulated points are the overlapping ADEV estimated from one seeded realisation; scatter at long tau "
        "reflects the small number of averages.",
        "Only the tau range flagged 'constrained' is backed by sourced data (SA65: datasheet table, 1-1000 s) "
        "or by the hypothetical target (NextGen: tau = 1 s only). Elsewhere curves are extrapolations.",
    ])


# ---------------------------------------------------------------------------
# Network configuration
# ---------------------------------------------------------------------------
def _assumed(value: float, unit: str) -> Quantity:
    return Quantity(value, unit, Provenance.ASSUMPTION, USER_VALUE)


def build_config(c: S.NetworkConfigIn) -> RadarNetworkConfig:
    """Translate request parameters into a RadarNetworkConfig (raises ValueError if invalid)."""
    n = c.non_clock
    terms = (
        NonClockTerm("residual hardware-delay calibration", ErrorCategory.CALIBRATION, TermKind.STATIC,
                     _assumed(n.calibration_rms_s, "s"), False),
        NonClockTerm("LO / clock distribution jitter", ErrorCategory.DISTRIBUTION, TermKind.WHITE,
                     _assumed(n.distribution_jitter_rms_s, "s"), False),
        NonClockTerm("propagation path wander", ErrorCategory.PROPAGATION, TermKind.RANDOM_WALK,
                     _assumed(n.propagation_random_walk_s_per_sqrt_s, "s/s^0.5"), False),
        NonClockTerm("temperature-induced frequency ramp", ErrorCategory.ENVIRONMENTAL, TermKind.FREQUENCY_RAMP,
                     _assumed(n.environmental_ramp_rms_per_s, "1/s"), True),
    )
    return RadarNetworkConfig(
        carrier_frequency_hz=c.carrier_frequency_hz, n_nodes=c.n_nodes, observation_s=c.observation_s,
        sample_interval_s=c.sample_interval_s, cpi_s=c.cpi_s,
        sync=SyncConfig(SyncMode(c.sync_mode), c.sync_interval_s, _assumed(c.sync_error_rms_s, "s")),
        clock_correlation=c.clock_correlation, non_clock_terms=terms,
        n_monte_carlo=c.n_monte_carlo, seed=c.seed,
    )


# ---------------------------------------------------------------------------
# Timing series
# ---------------------------------------------------------------------------
def timing_series(req: S.TimingRequest) -> S.TimingSeriesOut:
    s = get_scenario(req.scenario_key)
    cfg = build_config(req.config)
    seed = run_seeds(cfg)[0]  # first Monte Carlo run of the coherence evaluation
    real = simulate_network(s.model, cfg, seed)
    i, j = req.node_pair
    parts = {"clock": real.clock, "non_clock": real.non_clock, "total": real.total}
    rel = {k: v[i] - v[j] for k, v in parts.items()}
    step = max(1, ceil(cfg.n_samples / req.max_points))
    src = f"Single seeded realisation (run seed {seed}) of node pair ({i}, {j})."
    if cfg.sync.mode is SyncMode.NONE:
        epochs = [0.0]
    else:
        epochs = (np.arange(0, cfg.n_samples, cfg.samples_per_sync) * cfg.sample_interval_s)[:500].tolist()
    return S.TimingSeriesOut(
        scenario_key=s.key, label=s.label, node_pair=(i, j),
        t_s=real.t[::step].tolist(),
        clock_s=rel["clock"][::step].tolist(), non_clock_s=rel["non_clock"][::step].tolist(),
        total_s=rel["total"][::step].tolist(),
        decimation=step, sync_epochs_s=epochs,
        rms_s={k: simulated(np.sqrt(np.mean(v**2)), "s", src) for k, v in rel.items()},
        contribution_rms_s={
            k: simulated(np.sqrt(np.mean((np.broadcast_to(v, real.clock.shape)[i] - np.broadcast_to(v, real.clock.shape)[j]) ** 2)), "s", src)
            for k, v in real.contributions.items()
        },
        run_seed=seed,
    )


# ---------------------------------------------------------------------------
# Coherence metrics
# ---------------------------------------------------------------------------
def coherence(req: S.CoherenceRequest) -> S.CoherenceOut:
    scenarios = [get_scenario(k) for k in req.scenario_keys]
    cfg = build_config(req.config)
    results = compare_scenarios(scenarios, cfg)
    src = f"Monte Carlo mean of {cfg.n_monte_carlo} runs, seed {cfg.seed}; confidence intervals not computed."
    return S.CoherenceOut(
        results=[
            S.CoherenceResultOut(
                scenario_key=s.key, label=s.label,
                metrics={k: q_out(v) for k, v in r.metrics.items()},
                contribution_rms_s={k: simulated(v, "s", src) for k, v in r.contribution_rms_s.items()},
            )
            for s, r in zip(scenarios, results)
        ],
        config_parameters={k: q_out(v) for k, v in cfg.parameter_table().items()},
        n_monte_carlo=cfg.n_monte_carlo, seed=cfg.seed,
        loss_ceiling_temporal_db=float(10 * np.log10(cfg.samples_per_cpi)),
        loss_ceiling_spatial_db=float(10 * np.log10(cfg.n_nodes)),
        notes=[
            "Temporal loss: coherent integration of each bistatic node pair within one CPI; a constant phase offset cancels.",
            "Spatial loss: coherent combination across all nodes at one instant; absolute node-to-node offsets matter.",
            "Loss = -10 log10(mean coherent gain). Fully random phases give the ceiling 10 log10(M) or 10 log10(K).",
            "All system parameters are assumptions; all metrics are simulated. No detection range, RCS or "
            "operational performance is implied.",
        ],
    )


# ---------------------------------------------------------------------------
# Parameter specifications
# ---------------------------------------------------------------------------
_LABELS = {
    "carrier_frequency_hz": ("Carrier frequency", "Hz", "Radar carrier; phase error scales linearly with it."),
    "n_nodes": ("Radar nodes", "-", "Number of synchronised radar nodes."),
    "observation_s": ("Observation duration", "s", "Simulated time span."),
    "sample_interval_s": ("Sample interval", "s", "Simulation time step (tau0)."),
    "cpi_s": ("Coherent processing interval", "s", "Window for temporal coherent integration."),
    "sync_mode": ("Synchronisation mode", "-", "none: align once; time: reset offset; time_frequency: also remove estimated frequency offset."),
    "sync_interval_s": ("Synchronisation interval", "s", "Time between sync/calibration epochs."),
    "sync_error_rms_s": ("Sync measurement error", "s", "rms time-transfer error per node and epoch (non-clock)."),
    "clock_correlation": ("Clock correlation", "-", "Common-mode fraction of clock noise between nodes."),
    "n_monte_carlo": ("Monte Carlo runs", "-", "Independent realisations averaged per result."),
    "seed": ("Random seed", "-", "Master seed; identical seeds give identical results."),
    "calibration_rms_s": ("Calibration residual", "s", "Static per-node hardware-delay error (non-clock)."),
    "distribution_jitter_rms_s": ("Distribution jitter", "s", "White per-sample jitter (non-clock)."),
    "propagation_random_walk_s_per_sqrt_s": ("Propagation wander", "s/s^0.5", "Random-walk path delay (non-clock)."),
    "environmental_ramp_rms_per_s": ("Environmental frequency ramp", "1/s", "Temperature-induced drift rate rms (removed by sync)."),
}


def _bounds(field) -> tuple[float | None, float | None]:
    lo = hi = None
    for m in field.metadata:
        if isinstance(m, (annotated_types.Ge, annotated_types.Gt)):
            lo = float(getattr(m, "ge", getattr(m, "gt", None)))
        if isinstance(m, (annotated_types.Le, annotated_types.Lt)):
            hi = float(getattr(m, "le", getattr(m, "lt", None)))
    return lo, hi


def parameter_specs() -> S.ParametersOut:
    specs = []
    for model in (S.NetworkConfigIn, S.NonClockTermsIn):
        for name, field in model.model_fields.items():
            if name not in _LABELS:
                continue
            label, unit, desc = _LABELS[name]
            lo, hi = _bounds(field)
            options = ["none", "time", "time_frequency"] if name == "sync_mode" else None
            specs.append(S.ParameterSpecOut(
                name=name, label=label, unit=unit, default=field.get_default(call_default_factory=True),
                minimum=lo, maximum=hi, options=options, description=desc,
            ))
    return S.ParametersOut(
        parameters=specs,
        limits={
            "max_nodes": S.MAX_NODES, "max_samples_per_node": S.MAX_SAMPLES_PER_NODE,
            "max_monte_carlo": S.MAX_MONTE_CARLO, "max_work_units": S.MAX_WORK_UNITS,
            "max_plot_points": S.MAX_PLOT_POINTS,
        },
        rules=[
            "observation_s / sample_interval_s must be an integer and at most max_samples_per_node.",
            "cpi_s must be an integer multiple of sample_interval_s and divide observation_s.",
            "Unless sync_mode is 'none', sync_interval_s must be a multiple of cpi_s and divide observation_s.",
            "work units = scenarios x Monte Carlo runs x samples x (nodes + node pairs) must not exceed max_work_units.",
        ],
    )


# ---------------------------------------------------------------------------
# Limitations
# ---------------------------------------------------------------------------
def _hz(f: float) -> str:
    return f"{f / 1e3:g} kHz" if f >= 1e3 else f"{f:g} Hz"


def limitations() -> S.LimitationsOut:
    checks = check_against_sa65_phase_noise(sa65().model)
    excess = max(0.0, -min(c.margin_db for c in checks))
    above = [c.offset_hz for c in checks if c.margin_db < 0]
    below = [c for c in checks if c.margin_db > 0 and c.offset_hz < min(above, default=np.inf)]
    return S.LimitationsOut(
        sa65_phase_noise_check=[
            S.PhaseNoiseCheckOut(offset_hz=c.offset_hz, model_dbc_hz=c.model_dbc_hz,
                                 datasheet_limit_dbc_hz=c.datasheet_limit_dbc_hz, margin_db=c.margin_db)
            for c in checks
        ],
        max_model_excess_db=excess,
        statements=[
            "The SA65 clock model is a fit to the datasheet ADEV table and is constrained only for averaging "
            "times of 1-1000 s; sub-second behaviour is an extrapolation and is uncertain.",
            f"The phase noise implied by the fitted SA65 model exceeds the sourced datasheet limits by up to "
            f"{excess:.1f} dB at offsets of {_hz(min(above))} to {_hz(max(above))}, and lies "
            f"{min(c.margin_db for c in below):.1f} dB below them at {_hz(below[0].offset_hz)} to "
            f"{_hz(below[-1].offset_hz)}. This is a model-consistency finding; "
            "it does not establish an upper (or lower) bound on actual radar coherence loss.",
            "The OCXO scenario uses illustrative coefficients chosen by the team; it does not represent a sourced "
            "commercial product.",
            "The NextGen CSAC ADEV < 1e-15 at 1 s is a hypothetical target from the challenge brief, not a "
            "measured or published performance. Its behaviour at other averaging times is assumed.",
            "All radar system parameters and non-clock error magnitudes are assumptions. All metrics are "
            "simulated Monte Carlo means; confidence intervals are not computed.",
            "No detection range, radar cross-section, measured radar performance or operational capability "
            "is claimed or implied.",
        ],
    )
