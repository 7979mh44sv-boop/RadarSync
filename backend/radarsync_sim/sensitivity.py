"""Phase 3: sensitivity analysis and modelled minimum clock-stability requirements.

Built only on validated Phase 1/2 functions (simulate_network, temporal_gains,
spatial_gains, scale_clock). No new physics is introduced.

Clock-noise scaling
-------------------
A clock is characterised by its whole ADEV curve, not by one number. Requirements are
therefore stated relative to a *base noise shape*: the base model with every ADEV term
(white/flicker/random-walk FM and drift) multiplied by a scale s,

    sigma_y(tau) -> s * sigma_y,base(tau)          (radar.scale_clock)

and reported as the equivalent sigma_y(1 s) together with the scaled ADEV at the averaging
times the system uses. A different base shape can give a different requirement.

Common random numbers and exact linearity
-----------------------------------------
With fixed seeds every clock-noise generator is linear in its coefficient and drift is
deterministic, so the clock contribution of a scaled model is exactly s times the base
contribution while non-clock terms are unchanged (verified in tests):

    r(s) = s * r_clock(1) + r_non_clock

`RealizationSet` simulates each Monte Carlo run once and evaluates any scale (and any
carrier frequency, since time errors do not depend on it) from the stored residuals. All
scales share the same random numbers, so curves are smooth and fully deterministic.

Uncertainty
-----------
For each quantity the Monte Carlo runs give independent per-run mean gains G_r. We report
mean G, its standard error SE_G = std(G_r, ddof=1) / sqrt(R) and the delta-method loss
standard error SE_dB = (10 / ln 10) SE_G / mean G. The +/- k SE band (default k = 2) is an
*approximate* Monte Carlo band, not a validated confidence interval; it does not cover
model or parameter uncertainty.
"""

from dataclasses import dataclass, field, replace
from enum import StrEnum

import numpy as np

from radarsync_sim.clock import ClockNoiseModel
from radarsync_sim.coherence import DB_PER_NEPER_POWER, gain_to_loss_db
from radarsync_sim.network import RadarNetworkConfig, simulate_network
from radarsync_sim.provenance import Provenance
from radarsync_sim.radar import pair_relative, run_seeds, scale_clock, spatial_gains, temporal_gains
from radarsync_sim.timing_errors import SyncMode

PARTS = ("total", "clock", "non_clock")
METRICS = ("temporal", "spatial")
_TINY = 1e-300


@dataclass(frozen=True)
class LossEstimate:
    """Monte Carlo estimate of coherent gain/loss. SIMULATED."""

    mean_gain: float
    se_gain: float | None
    n_runs: int

    @property
    def loss_db(self) -> float:
        return float(gain_to_loss_db(max(self.mean_gain, _TINY)))

    @property
    def se_db(self) -> float | None:
        if self.se_gain is None:
            return None
        return float(DB_PER_NEPER_POWER * self.se_gain / max(self.mean_gain, _TINY))

    def band_db(self, k: float = 2.0) -> tuple[float, float]:
        """Approximate (low, high) loss band from mean gain +/- k SE (not a validated CI)."""
        if self.se_gain is None:
            return self.loss_db, self.loss_db
        hi_gain = min(1.0, self.mean_gain + k * self.se_gain)
        lo_gain = max(self.mean_gain - k * self.se_gain, _TINY)
        return float(gain_to_loss_db(hi_gain)), float(gain_to_loss_db(lo_gain))

    @staticmethod
    def from_runs(gains: np.ndarray) -> "LossEstimate":
        g = np.asarray(gains, dtype=float)
        se = float(np.std(g, ddof=1) / np.sqrt(g.size)) if g.size > 1 else None
        return LossEstimate(float(np.mean(g)), se, int(g.size))


@dataclass(frozen=True)
class LossBreakdown:
    """Losses for one configuration and clock scale. All values SIMULATED."""

    temporal: dict[str, LossEstimate]
    spatial: dict[str, LossEstimate]
    clock_variance_fraction: float
    rms_relative_time_error_s: dict[str, float]
    provenance: Provenance = Provenance.SIMULATED

    def metric(self, name: str) -> dict[str, LossEstimate]:
        if name not in METRICS:
            raise ValueError(f"metric must be one of {METRICS}")
        return self.temporal if name == "temporal" else self.spatial


class RealizationSet:
    """Per-run clock and non-clock residuals for one base clock and configuration.

    Simulated once with `simulate_network`; any clock scale and carrier frequency is then
    evaluated exactly from the stored residuals (see module docstring).
    """

    def __init__(self, base_clock: ClockNoiseModel, cfg: RadarNetworkConfig):
        self.base_clock = base_clock
        self.cfg = cfg
        self.clock: list[np.ndarray] = []
        self.non_clock: list[np.ndarray] = []
        for seed in run_seeds(cfg):
            real = simulate_network(base_clock, cfg, seed)
            self.clock.append(real.clock)
            self.non_clock.append(np.broadcast_to(real.non_clock, real.clock.shape))
        self._nc_cache: dict[float, tuple[np.ndarray, np.ndarray]] = {}

    def _gains(self, residual: np.ndarray, cfg: RadarNetworkConfig) -> tuple[float, float]:
        return float(temporal_gains(residual, cfg).mean()), float(spatial_gains(residual, cfg).mean())

    def losses(self, clock_scale: float = 1.0, carrier_frequency_hz: float | None = None) -> LossBreakdown:
        if clock_scale < 0:
            raise ValueError("clock_scale must be >= 0")
        cfg = self.cfg if carrier_frequency_hz is None else replace(self.cfg, carrier_frequency_hz=carrier_frequency_hz)
        n = len(self.clock)
        g = {(m, p): np.empty(n) for m in METRICS for p in PARTS}
        dt2 = {p: np.empty(n) for p in PARTS}
        key = cfg.carrier_frequency_hz
        if key not in self._nc_cache:
            self._nc_cache[key] = (
                np.array([self._gains(r, cfg) for r in self.non_clock]),
                np.array([np.mean(pair_relative(r) ** 2) for r in self.non_clock]),
            )
        nc_gains, nc_dt2 = self._nc_cache[key]
        for i, (c, nc) in enumerate(zip(self.clock, self.non_clock)):
            scaled = clock_scale * c
            total = scaled + nc
            for part, res in (("total", total), ("clock", scaled)):
                g[("temporal", part)][i], g[("spatial", part)][i] = self._gains(res, cfg)
                dt2[part][i] = np.mean(pair_relative(res) ** 2)
            g[("temporal", "non_clock")][i], g[("spatial", "non_clock")][i] = nc_gains[i]
            dt2["non_clock"][i] = nc_dt2[i]
        v_c, v_n = float(np.mean(dt2["clock"])), float(np.mean(dt2["non_clock"]))
        return LossBreakdown(
            temporal={p: LossEstimate.from_runs(g[("temporal", p)]) for p in PARTS},
            spatial={p: LossEstimate.from_runs(g[("spatial", p)]) for p in PARTS},
            clock_variance_fraction=v_c / (v_c + v_n) if v_c + v_n > 0 else 0.0,
            rms_relative_time_error_s={p: float(np.sqrt(np.mean(dt2[p]))) for p in PARTS},
        )


# ---------------------------------------------------------------------------
# Monotonicity
# ---------------------------------------------------------------------------
def monotonic_violations(values: np.ndarray, se: np.ndarray | None = None, increasing: bool = True,
                         k: float = 2.0, atol: float = 1e-9) -> list[int]:
    """Indices i where values[i+1] moves against the expected direction by more than
    atol + k * sqrt(se_i^2 + se_{i+1}^2). Differences within Monte Carlo noise are tolerated."""
    v = np.asarray(values, dtype=float)
    s = np.zeros_like(v) if se is None else np.nan_to_num(np.asarray(se, dtype=float), nan=0.0)
    d = np.diff(v) if increasing else -np.diff(v)
    tol = atol + k * np.sqrt(s[:-1] ** 2 + s[1:] ** 2)
    return [int(i) for i in np.nonzero(d < -tol)[0]]


# ---------------------------------------------------------------------------
# Parameter sweeps
# ---------------------------------------------------------------------------
SWEEPABLE = ("clock_scale", "carrier_frequency_hz", "n_nodes", "observation_s", "sync_interval_s",
             "sync_mode", "clock_correlation")


@dataclass(frozen=True)
class SweepPoint:
    value: float | str
    losses: LossBreakdown


def config_with(cfg: RadarNetworkConfig, parameter: str, value: float | str) -> RadarNetworkConfig:
    """Return cfg with one system parameter changed (validated by RadarNetworkConfig)."""
    if parameter == "sync_mode":
        return replace(cfg, sync=replace(cfg.sync, mode=SyncMode(value)))
    if parameter == "sync_interval_s":
        return replace(cfg, sync=replace(cfg.sync, interval_s=float(value)))
    if parameter == "n_nodes":
        return replace(cfg, n_nodes=int(value))
    if parameter in ("carrier_frequency_hz", "observation_s", "clock_correlation"):
        return replace(cfg, **{parameter: float(value)})
    raise ValueError(f"parameter must be one of {SWEEPABLE}")


def sweep_parameter(base_clock: ClockNoiseModel, cfg: RadarNetworkConfig, parameter: str,
                    values: list[float | str]) -> list[SweepPoint]:
    """Losses versus one parameter, all else fixed, same master seed (common random numbers).

    clock_scale and carrier_frequency_hz reuse one RealizationSet (exact); other parameters
    change the simulation and are re-simulated with the same seeds.
    """
    if parameter not in SWEEPABLE:
        raise ValueError(f"parameter must be one of {SWEEPABLE}")
    if parameter in ("clock_scale", "carrier_frequency_hz"):
        rs = RealizationSet(base_clock, cfg)
        if parameter == "clock_scale":
            return [SweepPoint(v, rs.losses(clock_scale=float(v))) for v in values]
        return [SweepPoint(v, rs.losses(carrier_frequency_hz=float(v))) for v in values]
    return [SweepPoint(v, RealizationSet(base_clock, config_with(cfg, parameter, v)).losses()) for v in values]


# ---------------------------------------------------------------------------
# Minimum clock-stability requirement
# ---------------------------------------------------------------------------
class RequirementStatus(StrEnum):
    DETERMINED = "determined"
    INFEASIBLE_NON_CLOCK_FLOOR = "infeasible_non_clock_floor"
    NOT_REACHED_IN_RANGE = "not_reached_in_range"
    NOT_BINDING_IN_RANGE = "not_binding_in_range"
    AMBIGUOUS_NON_MONOTONIC = "ambiguous_non_monotonic"


@dataclass(frozen=True)
class RequirementResult:
    status: RequirementStatus
    metric: str
    target_loss_db: float
    scales: np.ndarray
    """All evaluated scales, ascending (grid plus refinement points)."""
    breakdowns: list[LossBreakdown]
    grid_size: int
    floor: LossEstimate
    """Non-clock-only loss estimate (clock-independent)."""
    max_scale: float | None
    """Largest evaluated scale meeting the target with every smaller evaluated scale also
    meeting it (conservative). None if no evaluated scale meets the target."""
    crossing_scale: float | None
    """Log-interpolated scale at which the mean loss crosses the target (determined status only)."""
    bracket: tuple[float | None, float | None] | None
    """Approximate Monte Carlo bracket: crossings of the mean +/- k SE loss curves. A None
    end means that curve does not cross the target inside the evaluated range."""
    violations: list[int]
    messages: list[str] = field(default_factory=list)
    reference: dict[float, LossBreakdown] = field(default_factory=dict)
    """Breakdowns at caller-requested reference scales (e.g. s = 1, the base clock itself);
    reported only, never used for the status, crossing or bracket."""
    provenance: Provenance = Provenance.SIMULATED

    def curve(self, part: str = "total") -> tuple[np.ndarray, np.ndarray, np.ndarray]:
        est = [b.metric(self.metric)[part] for b in self.breakdowns]
        se = np.array([e.se_db if e.se_db is not None else np.nan for e in est])
        return self.scales, np.array([e.loss_db for e in est]), se


def _first_crossing(x: np.ndarray, y: np.ndarray, target: float) -> float | None:
    """First upward crossing of `target` by y(x), log-linear interpolation in x. None if none."""
    above = y > target
    if not above.any():
        return None
    i = int(np.argmax(above))
    if i == 0:
        return None  # already above at the first point: crossing lies below the range
    lx0, lx1 = np.log10(x[i - 1]), np.log10(x[i])
    f = (target - y[i - 1]) / (y[i] - y[i - 1]) if y[i] != y[i - 1] else 0.0
    return float(10 ** (lx0 + f * (lx1 - lx0)))


def clock_requirement(base_clock: ClockNoiseModel, cfg: RadarNetworkConfig, metric: str, target_loss_db: float,
                      scale_min: float, scale_max: float, n_grid: int = 13, refine_steps: int = 8,
                      k_se: float = 2.0, reference_scales: tuple[float, ...] = ()) -> RequirementResult:
    """Largest clock-noise scale s (relative to `base_clock`) whose simulated total `metric`
    loss stays at or below `target_loss_db`, with explicit feasibility status."""
    if metric not in METRICS:
        raise ValueError(f"metric must be one of {METRICS}")
    if not (0 < scale_min < scale_max):
        raise ValueError("require 0 < scale_min < scale_max")
    if target_loss_db <= 0:
        raise ValueError("target_loss_db must be > 0")
    if n_grid < 3 or refine_steps < 0:
        raise ValueError("n_grid must be >= 3 and refine_steps >= 0")

    rs = RealizationSet(base_clock, cfg)
    evaluated: dict[float, LossBreakdown] = {}

    def total_loss(s: float) -> float:
        if s not in evaluated:
            evaluated[s] = rs.losses(clock_scale=s)
        return evaluated[s].metric(metric)["total"].loss_db

    grid = np.logspace(np.log10(scale_min), np.log10(scale_max), n_grid)
    losses = np.array([total_loss(float(s)) for s in grid])
    floor = evaluated[float(grid[0])].metric(metric)["non_clock"]
    se_grid = np.array([evaluated[float(s)].metric(metric)["total"].se_db or 0.0 for s in grid])
    meets = losses <= target_loss_db
    violations = monotonic_violations(losses, se_grid, increasing=True, k=k_se)
    messages: list[str] = []

    reference = {float(r): rs.losses(clock_scale=float(r)) for r in reference_scales}

    def result(status, max_scale=None, crossing=None, bracket=None):
        scales = np.array(sorted(evaluated))
        return RequirementResult(
            status=status, metric=metric, target_loss_db=target_loss_db, scales=scales,
            breakdowns=[evaluated[s] for s in scales], grid_size=n_grid, floor=floor,
            max_scale=max_scale, crossing_scale=crossing, bracket=bracket, violations=violations,
            messages=messages, reference=reference,
        )

    if floor.se_db is not None and abs(floor.loss_db - target_loss_db) <= k_se * floor.se_db:
        messages.append("The non-clock floor is within the Monte Carlo uncertainty of the target; "
                        "the feasibility verdict is marginal.")
    if floor.loss_db >= target_loss_db:
        messages.append(f"Non-clock errors alone give {floor.loss_db:.3g} dB, at or above the "
                        f"{target_loss_db:g} dB target: no clock improvement can meet it under these assumptions.")
        return result(RequirementStatus.INFEASIBLE_NON_CLOCK_FLOOR)
    if not meets[0]:
        messages.append("The target is not met even at the smallest evaluated clock-noise scale; "
                        "the requirement (if any) lies below the evaluated range.")
        return result(RequirementStatus.NOT_REACHED_IN_RANGE)
    if meets.all():
        messages.append("The target is met across the whole evaluated range; the requirement is not "
                        "binding here and lies above the largest evaluated scale.")
        return result(RequirementStatus.NOT_BINDING_IN_RANGE, max_scale=float(grid[-1]))

    first_fail = int(np.argmin(meets))
    changes = int(np.count_nonzero(np.diff(meets.astype(int)) != 0))
    if violations or changes > 1:
        messages.append("The loss curve is not monotonic in clock-noise scale beyond Monte Carlo noise "
                        f"(violations at grid indices {violations}, {changes} target crossings). The reported "
                        "value is the conservative largest scale below the first failure; treat it as indicative.")
        return result(RequirementStatus.AMBIGUOUS_NON_MONOTONIC, max_scale=float(grid[first_fail - 1]))

    lo, hi = float(grid[first_fail - 1]), float(grid[first_fail])
    for _ in range(refine_steps):  # bisection in log scale on the same realisations
        mid = float(10 ** (0.5 * (np.log10(lo) + np.log10(hi))))
        if total_loss(mid) <= target_loss_db:
            lo = mid
        else:
            hi = mid
    scales = np.array(sorted(evaluated))
    est = [evaluated[s].metric(metric)["total"] for s in scales]
    mean = np.array([e.loss_db for e in est])
    band_lo = np.array([e.band_db(k_se)[0] for e in est])
    band_hi = np.array([e.band_db(k_se)[1] for e in est])
    crossing = _first_crossing(scales, mean, target_loss_db)
    bracket = (_first_crossing(scales, band_hi, target_loss_db), _first_crossing(scales, band_lo, target_loss_db))
    messages.append(f"Requirement determined by bisection between evaluated scales {lo:.4g} and {hi:.4g}.")
    return result(RequirementStatus.DETERMINED, max_scale=lo, crossing=crossing, bracket=bracket)


def scaled_adev(base_clock: ClockNoiseModel, scale: float, taus: np.ndarray) -> np.ndarray:
    """ADEV of the base noise shape scaled by `scale` (exact: sigma_y scales linearly)."""
    return np.asarray(scale_clock(base_clock, scale).adev(np.asarray(taus, dtype=float)))
