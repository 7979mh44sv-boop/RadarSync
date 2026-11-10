"""Phase 3 sensitivity engine: exact rescaling, consistency with Phase 2, sweeps, monotonicity
checks and requirement-solver edge cases."""

from dataclasses import replace

import numpy as np
import pytest

from radarsync_sim import sensitivity as sens
from radarsync_sim.network import RadarNetworkConfig, simulate_network
from radarsync_sim.radar import evaluate, run_seeds, scale_clock
from radarsync_sim.scenarios import all_scenarios
from radarsync_sim.sensitivity import (
    LossBreakdown,
    LossEstimate,
    RealizationSet,
    RequirementStatus,
    clock_requirement,
    monotonic_violations,
    scaled_adev,
    sweep_parameter,
)

SC = {s.key: s for s in all_scenarios()}
CFG = RadarNetworkConfig(observation_s=2.0, sample_interval_s=1e-2, cpi_s=0.1, n_monte_carlo=8)


@pytest.mark.parametrize("key", list(SC))
def test_clock_contribution_is_exactly_linear_in_scale(key):
    seed = run_seeds(CFG)[0]
    a = simulate_network(SC[key].model, CFG, seed)
    b = simulate_network(scale_clock(SC[key].model, 0.37), CFG, seed)
    np.testing.assert_allclose(b.clock, 0.37 * a.clock, rtol=1e-12, atol=1e-30)
    np.testing.assert_array_equal(np.broadcast_to(b.non_clock, a.clock.shape), np.broadcast_to(a.non_clock, a.clock.shape))


@pytest.mark.parametrize("key", ["sa65_industrial", "ocxo"])
def test_realization_set_reproduces_phase2_evaluate(key):
    ref = evaluate(SC[key].model, CFG).metrics
    b = RealizationSet(SC[key].model, CFG).losses(1.0)
    for metric in ("temporal", "spatial"):
        for part in ("total", "clock", "non_clock"):
            assert b.metric(metric)[part].loss_db == pytest.approx(ref[f"{part}_{metric}_loss"].value, rel=1e-12, abs=1e-12)
    assert b.clock_variance_fraction == pytest.approx(ref["clock_variance_fraction"].value, rel=1e-12)


def test_scaled_and_carrier_evaluation_match_direct_simulation():
    rs = RealizationSet(SC["ocxo"].model, CFG)
    direct = evaluate(scale_clock(SC["ocxo"].model, 30.0), replace(CFG, carrier_frequency_hz=3e9)).metrics
    got = rs.losses(clock_scale=30.0, carrier_frequency_hz=3e9)
    assert got.spatial["total"].loss_db == pytest.approx(direct["total_spatial_loss"].value, rel=1e-10)
    assert got.temporal["clock"].loss_db == pytest.approx(direct["clock_temporal_loss"].value, rel=1e-10, abs=1e-12)


def test_zero_scale_leaves_only_non_clock_error():
    b = RealizationSet(SC["sa65_industrial"].model, CFG).losses(0.0)
    assert b.spatial["clock"].loss_db == pytest.approx(0.0, abs=1e-12)
    assert b.spatial["total"].loss_db == pytest.approx(b.spatial["non_clock"].loss_db, rel=1e-12)
    assert b.clock_variance_fraction == 0.0


def test_loss_estimate_uncertainty():
    single = LossEstimate.from_runs(np.array([0.5]))
    assert single.se_db is None and single.band_db() == (single.loss_db, single.loss_db)
    e = LossEstimate.from_runs(np.array([0.80, 0.82, 0.78, 0.81]))
    se_g = np.std([0.80, 0.82, 0.78, 0.81], ddof=1) / 2
    assert e.se_db == pytest.approx(10 / np.log(10) * se_g / 0.8025)
    lo, hi = e.band_db(2.0)
    assert lo < e.loss_db < hi


def test_monotonic_violations():
    assert monotonic_violations(np.array([0.1, 0.2, 0.5, 2.0])) == []
    assert monotonic_violations(np.array([0.1, 0.3, 0.29, 2.0]), se=np.array([0.0, 0.01, 0.01, 0.0])) == []
    assert monotonic_violations(np.array([0.1, 0.3, 0.1, 2.0]), se=np.array([0.0, 0.01, 0.01, 0.0])) == [1]
    assert monotonic_violations(np.array([3.0, 2.0, 1.0]), increasing=False) == []


def test_clock_scale_sweep_is_monotonic_and_deterministic():
    vals = [1e-4, 1e-3, 1e-2, 1e-1, 1.0, 10.0]
    a = sweep_parameter(SC["ocxo"].model, CFG, "clock_scale", vals)
    b = sweep_parameter(SC["ocxo"].model, CFG, "clock_scale", vals)
    for m in ("temporal", "spatial"):
        la = np.array([p.losses.metric(m)["total"].loss_db for p in a])
        assert la.tolist() == [p.losses.metric(m)["total"].loss_db for p in b]
        se = np.array([p.losses.metric(m)["total"].se_db for p in a])
        assert monotonic_violations(la, se) == []


def test_system_parameter_sweeps_use_validated_configs():
    pts = sweep_parameter(SC["ocxo"].model, CFG, "n_nodes", [2, 4, 8])
    direct = evaluate(SC["ocxo"].model, replace(CFG, n_nodes=8)).metrics
    assert pts[2].losses.spatial["total"].loss_db == pytest.approx(direct["total_spatial_loss"].value, rel=1e-12)
    modes = sweep_parameter(SC["ocxo"].model, CFG, "sync_mode", ["none", "time", "time_frequency"])
    assert len(modes) == 3
    with pytest.raises(ValueError):
        sweep_parameter(SC["ocxo"].model, CFG, "sync_interval_s", [0.3])  # not a multiple of the CPI
    with pytest.raises(ValueError):
        sweep_parameter(SC["ocxo"].model, CFG, "unknown", [1])


def _req(key, metric, target, lo, hi, **kw):
    a1 = float(SC[key].model.adev(1.0))
    return clock_requirement(SC[key].model, CFG, metric, target, lo / a1, hi / a1, **kw), a1


def test_requirement_determined_brackets_the_target():
    r, a1 = _req("sa65_industrial", "spatial", 1.0, 1e-16, 1e-8)
    assert r.status is RequirementStatus.DETERMINED
    s, loss, _ = r.curve()
    i = int(np.searchsorted(s, r.max_scale))
    assert loss[i] <= 1.0 < loss[i + 1]
    assert r.crossing_scale is not None and r.max_scale <= r.crossing_scale * (1 + 1e-9)
    lo, hi = r.bracket
    assert lo is not None and hi is not None and lo <= r.crossing_scale <= hi
    again, _ = _req("sa65_industrial", "spatial", 1.0, 1e-16, 1e-8)
    assert again.max_scale == r.max_scale and again.bracket == r.bracket


def test_requirement_infeasible_when_non_clock_floor_exceeds_target():
    r, _ = _req("ocxo", "spatial", 0.001, 1e-16, 1e-8)
    assert r.status is RequirementStatus.INFEASIBLE_NON_CLOCK_FLOOR
    assert r.max_scale is None and r.floor.loss_db >= 0.001
    ref = evaluate(SC["ocxo"].model, CFG).metrics["non_clock_spatial_loss"].value
    assert r.floor.loss_db == pytest.approx(ref, rel=1e-12)


def test_requirement_not_reached_and_not_binding():
    r, _ = _req("sa65_industrial", "spatial", 0.5, 1e-10, 1e-8)
    assert r.status is RequirementStatus.NOT_REACHED_IN_RANGE and r.max_scale is None
    r, a1 = _req("sa65_industrial", "spatial", 1.0, 1e-17, 1e-14)
    assert r.status is RequirementStatus.NOT_BINDING_IN_RANGE
    assert r.max_scale * a1 == pytest.approx(1e-14)


def test_requirement_reports_non_monotonic_curves_as_ambiguous(monkeypatch):
    # Inject a synthetic non-monotonic loss curve to exercise the ambiguity path.
    def fake_losses(self, clock_scale=1.0, carrier_frequency_hz=None):
        loss = {0: 0.1, 1: 0.2, 2: 2.0, 3: 0.3, 4: 3.0}[int(round(np.log10(clock_scale) + 2))] if clock_scale > 0 else 0.05
        e = LossEstimate(mean_gain=10 ** (-loss / 10), se_gain=1e-6, n_runs=8)
        floor = LossEstimate(mean_gain=10 ** (-0.05 / 10), se_gain=1e-6, n_runs=8)
        parts = {"total": e, "clock": e, "non_clock": floor}
        return LossBreakdown(temporal=parts, spatial=parts, clock_variance_fraction=0.5, rms_relative_time_error_s={})

    monkeypatch.setattr(sens.RealizationSet, "__init__", lambda self, c, cfg: None)
    monkeypatch.setattr(sens.RealizationSet, "losses", fake_losses)
    r = clock_requirement(SC["ocxo"].model, CFG, "spatial", 1.0, 1e-2, 1e2, n_grid=5)
    assert r.status is RequirementStatus.AMBIGUOUS_NON_MONOTONIC
    assert r.violations == [2]
    assert r.max_scale == pytest.approx(1e-1)  # conservative: last scale before the first failure


@pytest.mark.parametrize("kw", [
    dict(metric="volume", target_loss_db=1.0), dict(metric="spatial", target_loss_db=0.0),
    dict(metric="spatial", target_loss_db=1.0, scale_min=1.0, scale_max=0.5),
    dict(metric="spatial", target_loss_db=1.0, n_grid=2),
])
def test_requirement_input_validation(kw):
    args = dict(scale_min=1e-3, scale_max=1.0) | kw
    with pytest.raises(ValueError):
        clock_requirement(SC["ocxo"].model, CFG, **args)


def test_scaled_adev_is_linear():
    m = SC["nextgen_flicker_floor"].model
    np.testing.assert_allclose(scaled_adev(m, 1e3, np.array([0.1, 1.0, 10.0])), 1e3 * m.adev(np.array([0.1, 1.0, 10.0])))
