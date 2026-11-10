"""Radar-level timing metrics: relative time/phase error and coherent integration loss.

Metrics (all SIMULATED, averaged over Monte Carlo runs, node pairs and samples):
  * rms relative time error between node pairs [s]
  * rms relative carrier phase error [rad]
  * temporal coherent integration loss within a CPI for each bistatic node pair [dB]
  * spatial coherent combination loss across all nodes at each instant [dB]
Each is computed for the clock-only, non-clock-only and total residual.

No detection range, radar cross-section or operational performance is derived here.
"""

from dataclasses import dataclass, replace

import numpy as np

from radarsync_sim.clock import ClockNoiseModel
from radarsync_sim.coherence import coherent_gain, gain_to_loss_db
from radarsync_sim.network import RadarNetworkConfig, simulate_network
from radarsync_sim.provenance import Provenance, Quantity
from radarsync_sim.scenarios import ClockScenario

PARTS = ("total", "clock", "non_clock")


def pair_relative(residual: np.ndarray) -> np.ndarray:
    i, j = np.triu_indices(residual.shape[0], k=1)
    return residual[i] - residual[j]


def temporal_gains(residual: np.ndarray, cfg: RadarNetworkConfig) -> np.ndarray:
    """Coherent gain of each CPI block for each node pair (flattened)."""
    phi = 2.0 * np.pi * cfg.carrier_frequency_hz * pair_relative(residual)
    blocks = phi.reshape(phi.shape[0], -1, cfg.samples_per_cpi)
    return coherent_gain(blocks, axis=-1).ravel()


def spatial_gains(residual: np.ndarray, cfg: RadarNetworkConfig) -> np.ndarray:
    """Coherent gain across nodes at each sample time."""
    return coherent_gain(2.0 * np.pi * cfg.carrier_frequency_hz * residual, axis=0)


def run_seeds(cfg: RadarNetworkConfig) -> list[int]:
    return [int(c.generate_state(1, dtype=np.uint64)[0])
            for c in np.random.SeedSequence(cfg.seed).spawn(cfg.n_monte_carlo)]


@dataclass(frozen=True)
class TimingResult:
    label: str
    metrics: dict[str, Quantity]
    contribution_rms_s: dict[str, float]
    """rms relative time error per source category [s] (SIMULATED)."""
    config: RadarNetworkConfig


def evaluate(clock: ClockNoiseModel, cfg: RadarNetworkConfig, label: str = "") -> TimingResult:
    acc = {p: {"t_gain": [], "s_gain": [], "dt2": []} for p in PARTS}
    contrib_sq: dict[str, list[float]] = {}
    for seed in run_seeds(cfg):
        real = simulate_network(clock, cfg, seed)
        for part, res in (("total", real.total), ("clock", real.clock), ("non_clock", real.non_clock)):
            res = np.broadcast_to(res, real.clock.shape)
            acc[part]["t_gain"].append(temporal_gains(res, cfg).mean())
            acc[part]["s_gain"].append(spatial_gains(res, cfg).mean())
            acc[part]["dt2"].append(np.mean(pair_relative(res) ** 2))
        for k, v in real.contributions.items():
            contrib_sq.setdefault(k, []).append(np.mean(pair_relative(np.broadcast_to(v, real.clock.shape)) ** 2))

    sim, w = Provenance.SIMULATED, f"Monte Carlo, {cfg.n_monte_carlo} runs, seed {cfg.seed}"
    omega = 2.0 * np.pi * cfg.carrier_frequency_hz
    metrics: dict[str, Quantity] = {}
    for part in PARTS:
        rms_dt = float(np.sqrt(np.mean(acc[part]["dt2"])))
        metrics[f"{part}_rms_relative_time_error"] = Quantity(rms_dt, "s", sim, w)
        metrics[f"{part}_rms_relative_phase_error"] = Quantity(omega * rms_dt, "rad", sim, w)
        metrics[f"{part}_temporal_loss"] = Quantity(float(gain_to_loss_db(np.mean(acc[part]["t_gain"]))), "dB", sim, w)
        metrics[f"{part}_spatial_loss"] = Quantity(float(gain_to_loss_db(np.mean(acc[part]["s_gain"]))), "dB", sim, w)
    v_c, v_n = np.mean(acc["clock"]["dt2"]), np.mean(acc["non_clock"]["dt2"])
    metrics["clock_variance_fraction"] = Quantity(float(v_c / (v_c + v_n)) if v_c + v_n > 0 else 0.0, "-", sim, w)
    return TimingResult(
        label=label, metrics=metrics, config=cfg,
        contribution_rms_s={k: float(np.sqrt(np.mean(v))) for k, v in contrib_sq.items()},
    )


def compare_scenarios(scenarios: list[ClockScenario], cfg: RadarNetworkConfig) -> list[TimingResult]:
    """Evaluate every scenario with the same configuration and the same random numbers."""
    return [evaluate(s.model, cfg, s.label) for s in scenarios]


def scale_clock(clock: ClockNoiseModel, factor: float) -> ClockNoiseModel:
    """Scale every ADEV term (and drift) by `factor`: sigma_y(tau) -> factor * sigma_y(tau)."""
    return replace(
        clock,
        white_fm_a=clock.white_fm_a * factor,
        flicker_fm_b=clock.flicker_fm_b * factor,
        random_walk_fm_c=clock.random_walk_fm_c * factor,
        drift_per_s=clock.drift_per_s * factor,
    )


def sweep_clock_scale(clock: ClockNoiseModel, cfg: RadarNetworkConfig, factors: np.ndarray) -> list[TimingResult]:
    """Loss vs. clock quality at a fixed non-clock floor (common random numbers across factors)."""
    return [evaluate(scale_clock(clock, float(f)), cfg, f"scale {f:g}") for f in factors]
