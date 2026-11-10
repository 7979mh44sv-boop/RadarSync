"""Adapter for Phase 3 sensitivity endpoints. Calls radarsync_sim.sensitivity only; no physics."""

import numpy as np

from app import schemas as S
from app.services.simulation import build_config, get_scenario, q_out
from radarsync_sim import parameters as P
from radarsync_sim.network import RadarNetworkConfig
from radarsync_sim.sensitivity import (
    LossBreakdown,
    LossEstimate,
    RequirementStatus,
    clock_requirement,
    config_with,
    monotonic_violations,
    scaled_adev,
    sweep_parameter,
)
from radarsync_sim.timing_errors import SyncMode

UNCERTAINTY_NOTE = (
    "Uncertainty: standard error of the Monte Carlo mean across independent runs (delta method in dB); "
    "bands are mean +/- 2 SE. This is an approximate Monte Carlo band, not a validated confidence interval, "
    "and it does not include model or parameter uncertainty."
)
UNITS = {"clock_scale": "-", "carrier_frequency_hz": "Hz", "n_nodes": "-", "observation_s": "s",
         "sync_interval_s": "s", "sync_mode": "-", "clock_correlation": "-"}


def _units_per_eval(cfg: RadarNetworkConfig) -> int:
    """Cost model: gain evaluations scale with runs x samples x (nodes + node pairs)."""
    k = cfg.n_nodes
    return cfg.n_monte_carlo * cfg.n_samples * (k + k * (k - 1) // 2)


def _check_memory(cfg: RadarNetworkConfig) -> None:
    held = cfg.n_monte_carlo * cfg.n_nodes * cfg.n_samples
    if held > S.REALIZATION_MAX_VALUES:
        raise ValueError(f"runs x nodes x samples = {held:.3g} exceeds the memory limit of {S.REALIZATION_MAX_VALUES:.3g}")


# ---------------------------------------------------------------------------
# Options
# ---------------------------------------------------------------------------
def options() -> S.SensitivityOptionsOut:
    f = S.NetworkConfigIn.model_fields
    from app.services.simulation import _bounds  # same bound extraction as /parameters

    def b(name):
        return _bounds(f[name])

    return S.SensitivityOptionsOut(
        parameters=[
            S.SweepOptionOut(name="carrier_frequency_hz", label="Carrier frequency", unit="Hz", kind="numeric",
                             minimum=b("carrier_frequency_hz")[0], maximum=b("carrier_frequency_hz")[1],
                             default_values=[1e9, 3e9, 5.5e9, 10e9, 17e9, 35e9],
                             note="Phase error scales linearly with carrier frequency; time errors are unchanged."),
            S.SweepOptionOut(name="n_nodes", label="Radar nodes", unit="-", kind="numeric",
                             minimum=b("n_nodes")[0], maximum=b("n_nodes")[1], default_values=[2, 3, 4, 6, 8, 12, 16],
                             note="More nodes raise the spatial ceiling 10 log10(K) and the number of node pairs."),
            S.SweepOptionOut(name="sync_interval_s", label="Synchronisation interval", unit="s", kind="numeric",
                             minimum=None, maximum=b("sync_interval_s")[1], default_values=[0.1, 0.2, 0.5, 1, 2, 5, 10],
                             note="Must be a multiple of the CPI and divide the observation duration."),
            S.SweepOptionOut(name="observation_s", label="Observation duration", unit="s", kind="numeric",
                             minimum=None, maximum=b("observation_s")[1], default_values=[1, 2, 5, 10, 20],
                             note="Must remain a multiple of the sync interval."),
            S.SweepOptionOut(name="sync_mode", label="Synchronisation mode", unit="-", kind="categorical",
                             default_values=["none", "time", "time_frequency"],
                             note="none: single alignment; time: offset reset; time_frequency: also removes estimated frequency offset."),
            S.SweepOptionOut(name="clock_correlation", label="Clock correlation", unit="-", kind="numeric",
                             minimum=0.0, maximum=1.0, default_values=[0.0, 0.25, 0.5, 0.75, 0.9],
                             note="Common-mode fraction of clock noise; cancels in relative errors."),
            S.SweepOptionOut(name="clock_scale", label="Clock-noise scale", unit="-", kind="numeric",
                             minimum=1e-8, maximum=1e4, default_values=[1e-4, 1e-3, 1e-2, 1e-1, 1, 10],
                             note="Multiplies every ADEV term of the scenario's own noise model."),
        ],
        limits={"max_sweep_values": S.SWEEP_MAX_VALUES, "max_work_units": S.SENSITIVITY_MAX_WORK_UNITS,
                "max_values_in_memory": S.REALIZATION_MAX_VALUES},
        requirement_defaults={"metric": "spatial", "target_loss_db": 1.0, "adev_1s_min": 1e-17, "adev_1s_max": 1e-8,
                              "n_grid": 13, "refine_steps": 8},
        uncertainty_note=UNCERTAINTY_NOTE,
    )


# ---------------------------------------------------------------------------
# Sweeps
# ---------------------------------------------------------------------------
def _sweep_configs(req: S.SweepRequest) -> list[RadarNetworkConfig]:
    base = build_config(req.config)
    if req.parameter in ("clock_scale", "carrier_frequency_hz"):
        return [base] * len(req.values)
    return [config_with(base, req.parameter, v) for v in req.values]


def validate_sweep(req: S.SweepRequest) -> None:
    p, vals = req.parameter, req.values
    if p == "sync_mode":
        bad = [v for v in vals if v not in ("none", "time", "time_frequency")]
        if bad:
            raise ValueError(f"sync_mode values must be 'none', 'time' or 'time_frequency' (got {bad})")
    else:
        if any(isinstance(v, str) for v in vals):
            raise ValueError(f"values for {p} must be numeric")
        f = S.NetworkConfigIn.model_fields
        from app.services.simulation import _bounds

        lo, hi = {"clock_scale": (1e-8, 1e4), "n_nodes": _bounds(f["n_nodes"])}.get(p, _bounds(f[p]) if p in f else (None, None))
        for v in vals:
            if (lo is not None and v < lo) or (hi is not None and v > hi) or (p in ("clock_scale", "carrier_frequency_hz") and v <= 0):
                raise ValueError(f"{p} value {v:g} is outside the allowed range [{lo}, {hi}]")
            if p == "n_nodes" and float(v) != int(v):
                raise ValueError("n_nodes values must be integers")
    if len(set(map(str, vals))) != len(vals):
        raise ValueError("sweep values must be unique")
    configs = []
    for v in vals:
        try:
            configs.append(_sweep_configs_one(req, v))
        except ValueError as e:
            raise ValueError(f"{p} = {v}: {e}") from None
    for c in configs:
        if c.n_samples > S.MAX_SAMPLES_PER_NODE:
            raise ValueError(f"{p}: a value gives {c.n_samples} samples per node (limit {S.MAX_SAMPLES_PER_NODE})")
        _check_memory(c)
    work = len(req.scenario_keys) * sum(_units_per_eval(c) for c in configs)
    if work > S.SENSITIVITY_MAX_WORK_UNITS:
        raise ValueError(f"sweep ({work:.3g} work units) exceeds the limit of {S.SENSITIVITY_MAX_WORK_UNITS:.3g}; "
                         "reduce values, scenarios, nodes, Monte Carlo runs or samples")


def _sweep_configs_one(req: S.SweepRequest, v) -> RadarNetworkConfig:
    base = build_config(req.config)
    if req.parameter == "clock_scale":
        return base
    if req.parameter == "carrier_frequency_hz":
        return config_with(base, "carrier_frequency_hz", v)
    return config_with(base, req.parameter, v)


def est_out(e: LossEstimate) -> S.LossEstimateOut:
    return S.LossEstimateOut(loss_db=e.loss_db, se_db=e.se_db, band_db=e.band_db(2.0))


def breakdown_out(b: LossBreakdown) -> S.LossBreakdownOut:
    return S.LossBreakdownOut(
        temporal={k: est_out(v) for k, v in b.temporal.items()},
        spatial={k: est_out(v) for k, v in b.spatial.items()},
        clock_variance_fraction=b.clock_variance_fraction,
        rms_relative_time_error_s=b.rms_relative_time_error_s,
    )


def sweep(req: S.SweepRequest) -> S.SweepOut:
    base_cfg = build_config(req.config)
    configs = [_sweep_configs_one(req, v) for v in req.values]
    series = []
    for key in req.scenario_keys:
        sc = get_scenario(key)
        pts = sweep_parameter(sc.model, base_cfg, req.parameter, list(req.values))
        check = None
        if req.parameter == "clock_scale":
            order = np.argsort(np.asarray(req.values, dtype=float))
            msgs = []
            for metric in ("temporal", "spatial"):
                tot = [pts[i].losses.metric(metric)["total"] for i in order]
                v = monotonic_violations(np.array([t.loss_db for t in tot]),
                                         np.array([t.se_db or 0.0 for t in tot]), increasing=True)
                msgs.append(f"{metric}: {'non-decreasing within Monte Carlo noise' if not v else f'violations at sorted indices {v}'}")
            check = "; ".join(msgs)
        series.append(S.SweepSeriesOut(scenario_key=key, label=sc.label, values=list(req.values),
                                       points=[breakdown_out(p.losses) for p in pts], monotonic_check=check))
    return S.SweepOut(
        parameter=req.parameter, unit=UNITS[req.parameter], series=series,
        config_parameters={k: q_out(v) for k, v in base_cfg.parameter_table().items()},
        n_monte_carlo=base_cfg.n_monte_carlo, seed=base_cfg.seed,
        loss_ceiling_temporal_db=[float(10 * np.log10(c.samples_per_cpi)) for c in configs],
        loss_ceiling_spatial_db=[float(10 * np.log10(c.n_nodes)) for c in configs],
        notes=[
            "One parameter is varied; all others are held at the configuration shown. The same master seed is used "
            "for every value (common random numbers), so differences reflect the parameter rather than resampling.",
            "clock_scale and carrier frequency reuse identical realisations (exact rescaling); other parameters are "
            "re-simulated with the same seeds.",
            UNCERTAINTY_NOTE,
            "Near the random-phase ceiling, Monte Carlo means scatter around it and can exceed it slightly.",
            "All values are simulated outputs of assumed parameters; no measured radar performance is implied.",
        ],
    )


# ---------------------------------------------------------------------------
# Clock-stability requirement
# ---------------------------------------------------------------------------
def _ceiling(cfg: RadarNetworkConfig, metric: str) -> float:
    return float(10 * np.log10(cfg.samples_per_cpi if metric == "temporal" else cfg.n_nodes))


def validate_requirement(req: S.RequirementRequest) -> None:
    cfg = build_config(req.config)
    ceiling = _ceiling(cfg, req.metric)
    if req.target_loss_db >= ceiling:
        raise ValueError(f"target_loss_db must be below the {req.metric} random-phase ceiling of {ceiling:.3g} dB "
                         "(any clock meets a target at or above it)")
    _check_memory(cfg)
    work = len(req.base_scenario_keys) * (req.n_grid + req.refine_steps + 1) * _units_per_eval(cfg)
    if work > S.SENSITIVITY_MAX_WORK_UNITS:
        raise ValueError(f"requirement analysis ({work:.3g} work units) exceeds the limit of "
                         f"{S.SENSITIVITY_MAX_WORK_UNITS:.3g}; reduce base scenarios, grid size, refinement, "
                         "nodes, Monte Carlo runs or samples")


def _warnings(sc, cfg: RadarNetworkConfig, req: S.RequirementRequest) -> list[str]:
    w = [f"Requirement assumes the noise shape of '{sc.label}' scaled uniformly; a clock with a different "
         "noise-type mix can need a different sigma_y(1 s).",
         "This is a modelled requirement under stated assumptions, not a verified device capability."]
    lo_hi = sc.valid_tau_range
    taus = [cfg.cpi_s] + ([cfg.sync.interval_s] if cfg.sync.mode is not SyncMode.NONE else [cfg.observation_s])
    if lo_hi is None:
        w.append("The base noise shape is entirely assumed (illustrative); it is not a sourced device model.")
    elif any(t < lo_hi[0] or t > lo_hi[1] for t in taus):
        w.append(f"System averaging times ({', '.join(f'{t:g} s' for t in taus)}) extend outside the constrained "
                 f"tau range of this base shape ({lo_hi[0]:g}-{lo_hi[1]:g} s); the shape there is extrapolated.")
    if sc.key.startswith("sa65"):
        w.append("SA65 sub-second behaviour is extrapolated; the fitted model's implied phase noise differs from the "
                 "datasheet limits by up to 19.7 dB, which does not bound actual coherence loss in either direction.")
    if sc.key.startswith("nextgen"):
        w.append("The NextGen base shape is hypothetical (only ADEV < 1e-15 at 1 s is posited by the challenge).")
    if cfg.n_monte_carlo < 8:
        w.append(f"Only {cfg.n_monte_carlo} Monte Carlo runs: standard errors are themselves uncertain.")
    return w


def requirement(req: S.RequirementRequest) -> S.RequirementsOut:
    cfg = build_config(req.config)
    results = []
    for key in req.base_scenario_keys:
        sc = get_scenario(key)
        a1 = float(sc.model.adev(1.0))
        r = clock_requirement(sc.model, cfg, req.metric, req.target_loss_db,
                              scale_min=req.adev_1s_min / a1, scale_max=req.adev_1s_max / a1,
                              n_grid=req.n_grid, refine_steps=req.refine_steps, reference_scales=(1.0,))
        taus = {f"tau = {cfg.cpi_s:g} s (CPI)": cfg.cpi_s, "tau = 1 s (reference)": 1.0}
        if cfg.sync.mode is not SyncMode.NONE:
            taus[f"tau = {cfg.sync.interval_s:g} s (sync interval)"] = cfg.sync.interval_s
        else:
            taus[f"tau = {cfg.observation_s:g} s (observation, no sync)"] = cfg.observation_s
        req_tau = None
        if r.max_scale is not None:
            vals = scaled_adev(sc.model, r.max_scale, np.array(list(taus.values())))
            req_tau = {k: float(v) for k, v in zip(taus, vals)}
        curve = [
            S.RequirementPointOut(
                adev_1s=float(s * a1), scale=float(s),
                total=est_out(b.metric(req.metric)["total"]), clock_only=est_out(b.metric(req.metric)["clock"]),
                non_clock_only=est_out(b.metric(req.metric)["non_clock"]),
                clock_variance_fraction=b.clock_variance_fraction,
            )
            for s, b in zip(r.scales, r.breakdowns)
        ]
        results.append(S.RequirementOut(
            base_scenario_key=key, label=sc.label, base_category=sc.category.value, base_adev_1s=a1,
            status=r.status.value,
            required_adev_1s=None if r.max_scale is None else r.max_scale * a1,
            crossing_adev_1s=None if r.crossing_scale is None else r.crossing_scale * a1,
            approximate_bracket_adev_1s=None if r.bracket is None else tuple(None if v is None else v * a1 for v in r.bracket),
            required_adev_at_tau=req_tau,
            floor=est_out(r.floor), base_clock_at_scale_1=breakdown_out(r.reference[1.0]),
            curve=curve, monotonic_violations=r.violations, messages=r.messages, warnings=_warnings(sc, cfg, req),
        ))
    return S.RequirementsOut(
        metric=req.metric, target_loss_db=req.target_loss_db, loss_ceiling_db=_ceiling(cfg, req.metric),
        results=results,
        references=[
            S.SourcedPointOut(tau_s=1.0, adev=P.SA65_ADEV_INDUSTRIAL[1.0].value,
                              provenance=P.SA65_ADEV_INDUSTRIAL[1.0].provenance.value, source=P.SA65_ADEV_INDUSTRIAL[1.0].source),
            S.SourcedPointOut(tau_s=1.0, adev=P.NEXTGEN_ADEV_1S_TARGET.value,
                              provenance=P.NEXTGEN_ADEV_1S_TARGET.provenance.value, source=P.NEXTGEN_ADEV_1S_TARGET.source),
        ],
        config_parameters={k: q_out(v) for k, v in cfg.parameter_table().items()},
        n_monte_carlo=cfg.n_monte_carlo, seed=cfg.seed, uncertainty_note=UNCERTAINTY_NOTE,
        notes=[
            "Each base clock model is scaled uniformly (sigma_y(tau) -> s * sigma_y,base(tau)); the x-axis is the "
            "scaled clock's sigma_y(1 s). The requirement is the largest evaluated sigma_y(1 s) whose simulated "
            f"total {req.metric} loss is at or below the target.",
            "Statuses: determined; infeasible_non_clock_floor (non-clock errors alone exceed the target); "
            "not_reached_in_range; not_binding_in_range; ambiguous_non_monotonic.",
            "Reference values are context only: the SA65 datasheet value is sourced, the NextGen value is a "
            "hypothetical target. Neither is a measured radar result.",
        ],
    )
