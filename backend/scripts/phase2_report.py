"""Reproducible Phase 2 report: radar timing comparison of clock scenarios.

Usage (from backend/):  .venv/bin/python scripts/phase2_report.py
Prints Markdown tables. Every number printed is a SIMULATED output of the stated
ASSUMED configuration; none is a measurement or a radar performance claim.
"""

import sys
from dataclasses import replace
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from radarsync_sim.consistency import check_against_sa65_phase_noise  # noqa: E402
from radarsync_sim.network import RadarNetworkConfig  # noqa: E402
from radarsync_sim.radar import compare_scenarios, sweep_clock_scale  # noqa: E402
from radarsync_sim.scenarios import all_scenarios, sa65  # noqa: E402
from radarsync_sim.timing_errors import SyncConfig  # noqa: E402


def fmt_s(x: float) -> str:
    return f"{x * 1e12:.3g} ps" if x >= 1e-15 else f"{x * 1e15:.3g} fs"


def main() -> None:
    cfg = RadarNetworkConfig()
    print("## Configuration (all ASSUMPTIONS)\n")
    print("| Parameter | Value | Unit |\n|---|---|---|")
    for k, v in cfg.parameter_table().items():
        print(f"| {k} | {v.value:g} | {v.unit} |")
    print(f"| sync mode | {cfg.sync.mode} | - |\n| Monte Carlo runs / seed | {cfg.n_monte_carlo} / {cfg.seed} | - |")

    print("\n## A. Scenario comparison (SIMULATED)\n")
    print("| Scenario | rms rel. time error: total / clock / non-clock | rms rel. phase (total) | "
          "temporal loss total / clock-only [dB] | spatial loss total / clock-only [dB] | clock share of variance |")
    print("|---|---|---|---|---|---|")
    for r in compare_scenarios(all_scenarios(), cfg):
        m = {k: v.value for k, v in r.metrics.items()}
        print(f"| {r.label} | {fmt_s(m['total_rms_relative_time_error'])} / {fmt_s(m['clock_rms_relative_time_error'])} / "
              f"{fmt_s(m['non_clock_rms_relative_time_error'])} | {m['total_rms_relative_phase_error']:.3g} rad | "
              f"{m['total_temporal_loss']:.3g} / {m['clock_temporal_loss']:.3g} | "
              f"{m['total_spatial_loss']:.3g} / {m['clock_spatial_loss']:.3g} | {m['clock_variance_fraction']:.3f} |")

    print("\n## B. Clock-quality sweep at fixed non-clock floor (SIMULATED)\n")
    print("SA65 model with every ADEV term scaled by s.\n")
    print("| s | ADEV(1 s) | spatial loss total [dB] | non-clock floor [dB] | clock share |\n|---|---|---|---|---|")
    base = sa65().model
    for s, r in zip(f := np.logspace(0, -5, 11), sweep_clock_scale(base, cfg, f)):
        m = {k: v.value for k, v in r.metrics.items()}
        print(f"| {s:.3g} | {s * float(base.adev(1.0)):.2e} | {m['total_spatial_loss']:.4f} | "
              f"{m['non_clock_spatial_loss']:.4f} | {m['clock_variance_fraction']:.3f} |")

    print("\n## C. Sync-interval sweep, time-only sync (SIMULATED)\n")
    print("| Sync interval | Scenario | clock rms rel. time error | spatial loss total [dB] | clock share |\n|---|---|---|---|---|")
    for interval in (1.0, 10.0, 100.0):
        c = replace(cfg, observation_s=interval, sync=SyncConfig(cfg.sync.mode, interval, cfg.sync.error_rms))
        for r in compare_scenarios(all_scenarios(), c):
            m = {k: v.value for k, v in r.metrics.items()}
            print(f"| {interval:g} s | {r.label} | {fmt_s(m['clock_rms_relative_time_error'])} | "
                  f"{m['total_spatial_loss']:.3g} | {m['clock_variance_fraction']:.3f} |")

    print("\n## D. SA65 model vs. sourced phase-noise limits (10 MHz output)\n")
    print("| Offset | Model-implied L(f) | Datasheet limit | Margin |\n|---|---|---|---|")
    for c in check_against_sa65_phase_noise(sa65().model):
        print(f"| {c.offset_hz:g} Hz | {c.model_dbc_hz:.1f} dBc/Hz | {c.datasheet_limit_dbc_hz:.0f} dBc/Hz | {c.margin_db:+.1f} dB |")


if __name__ == "__main__":
    main()
