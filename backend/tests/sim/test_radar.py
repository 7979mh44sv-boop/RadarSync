"""Monte Carlo validation of radar coherence metrics against analytical expectations."""

import numpy as np
import pytest

from radarsync_sim.clock import ClockNoiseModel
from radarsync_sim.coherence import (
    expected_gain_from_structure_function,
    expected_gain_iid_gaussian,
    gain_to_loss_db,
)
from radarsync_sim.consistency import check_against_sa65_phase_noise, implied_ssb_phase_noise_dbc
from radarsync_sim.network import RadarNetworkConfig
from radarsync_sim.provenance import Provenance, Quantity
from radarsync_sim.radar import compare_scenarios, evaluate, scale_clock, sweep_clock_scale
from radarsync_sim.scenarios import all_scenarios, sa65
from radarsync_sim.timing_errors import ErrorCategory, NonClockTerm, SyncConfig, SyncMode, TermKind

A = Provenance.ASSUMPTION


def q(v, unit="s"):
    return Quantity(v, unit, A, "test value")


NO_SYNC = SyncConfig(SyncMode.NONE, 1.0, q(0.0))


def test_temporal_loss_wfm_matches_structure_function_prediction():
    # Two nodes, white FM, no sync: relative phase is Brownian with D(tau) = (2 pi f)^2 2 a^2 tau.
    f, a = 1e9, 7e-10
    cfg = RadarNetworkConfig(carrier_frequency_hz=f, n_nodes=2, observation_s=5.0, sample_interval_s=1e-3,
                             cpi_s=0.05, sync=NO_SYNC, non_clock_terms=(), n_monte_carlo=40, seed=1)
    k = (2 * np.pi * f) ** 2 * 2 * a**2
    t = np.arange(cfg.samples_per_cpi) * cfg.sample_interval_s
    expected = gain_to_loss_db(expected_gain_from_structure_function(t, lambda lag: k * lag))
    got = evaluate(ClockNoiseModel(white_fm_a=a), cfg).metrics["clock_temporal_loss"].value
    assert 1.0 < expected < 4.0  # meaningful, unsaturated regime
    assert got == pytest.approx(float(expected), abs=0.1)


def test_white_jitter_temporal_and_spatial_loss_match_iid_formulas():
    f, sigma, k_nodes = 10e9, 5e-12, 4
    term = NonClockTerm("jitter", ErrorCategory.DISTRIBUTION, TermKind.WHITE, q(sigma), False)
    cfg = RadarNetworkConfig(carrier_frequency_hz=f, n_nodes=k_nodes, observation_s=2.0, sample_interval_s=1e-3,
                             cpi_s=0.02, sync=NO_SYNC, non_clock_terms=(term,), n_monte_carlo=8, seed=2)
    var_node = (2 * np.pi * f * sigma) ** 2
    m = evaluate(ClockNoiseModel(), cfg).metrics
    assert m["non_clock_temporal_loss"].value == pytest.approx(
        float(gain_to_loss_db(expected_gain_iid_gaussian(2 * var_node, cfg.samples_per_cpi))), abs=0.03)
    assert m["non_clock_spatial_loss"].value == pytest.approx(
        float(gain_to_loss_db(expected_gain_iid_gaussian(var_node, k_nodes))), abs=0.03)
    assert m["clock_temporal_loss"].value == pytest.approx(0.0, abs=1e-12)


def test_static_calibration_error_affects_spatial_not_temporal_loss():
    f, sigma, k_nodes = 10e9, 8e-12, 4
    term = NonClockTerm("cal", ErrorCategory.CALIBRATION, TermKind.STATIC, q(sigma), False)
    cfg = RadarNetworkConfig(carrier_frequency_hz=f, n_nodes=k_nodes, observation_s=0.1, sample_interval_s=1e-2,
                             cpi_s=0.1, sync=NO_SYNC, non_clock_terms=(term,), n_monte_carlo=3000, seed=3)
    m = evaluate(ClockNoiseModel(), cfg).metrics
    var_node = (2 * np.pi * f * sigma) ** 2
    assert m["total_temporal_loss"].value == pytest.approx(0.0, abs=1e-9)
    assert m["total_spatial_loss"].value == pytest.approx(
        float(gain_to_loss_db(expected_gain_iid_gaussian(var_node, k_nodes))), abs=0.05)


def test_clock_improvement_plateaus_at_non_clock_floor():
    cfg = RadarNetworkConfig(n_monte_carlo=6)
    results = sweep_clock_scale(sa65().model, cfg, np.array([1.0, 1e-2, 1e-4, 1e-6]))
    floor_t = [r.metrics["non_clock_temporal_loss"].value for r in results]
    floor_s = [r.metrics["non_clock_spatial_loss"].value for r in results]
    assert np.ptp(floor_t) == 0.0 and np.ptp(floor_s) == 0.0  # common random numbers
    total_s = [r.metrics["total_spatial_loss"].value for r in results]
    # A better clock never hurts in expectation; allow Monte Carlo fluctuation of 1 % of the floor.
    assert all(b <= a + 0.01 * floor_s[0] for a, b in zip(total_s, total_s[1:]))
    assert total_s[-1] == pytest.approx(floor_s[-1], rel=0.01)  # clock no longer matters
    assert total_s[0] > 10 * floor_s[0]  # SA65 at this configuration is clock-limited


def test_scale_clock_scales_adev():
    m = sa65().model
    np.testing.assert_allclose(scale_clock(m, 1e-3).adev([1.0, 100.0]), 1e-3 * m.adev([1.0, 100.0]))


def test_scenario_comparison_uses_shared_config_and_is_labelled_simulated():
    cfg = RadarNetworkConfig(n_monte_carlo=4)
    results = compare_scenarios(all_scenarios(), cfg)
    assert len(results) == 4 and all(r.config is cfg for r in results)
    for r in results:
        assert all(v.provenance is Provenance.SIMULATED for v in r.metrics.values())
    floors = {round(r.metrics["non_clock_spatial_loss"].value, 12) for r in results}
    assert len(floors) == 1  # identical non-clock draws across scenarios
    again = compare_scenarios(all_scenarios(), cfg)
    assert [r.metrics for r in again] == [r.metrics for r in results]


def test_implied_phase_noise_formula_for_pure_white_fm():
    a, nu0 = 3e-10, 10e6
    got = implied_ssb_phase_noise_dbc(ClockNoiseModel(white_fm_a=a), nu0, np.array([1.0, 10.0]))
    np.testing.assert_allclose(got, 10 * np.log10(a**2 * nu0**2 / np.array([1.0, 100.0])))


def test_sa65_model_vs_sourced_phase_noise_limits():
    # Documents a property of the assumed model: consistent with the datasheet limits at
    # 1 and 10 Hz offsets, but above them from 100 Hz to 10 kHz. This is a model property, not a loss bound.
    margins = {c.offset_hz: c.margin_db for c in check_against_sa65_phase_noise(sa65().model)}
    assert margins[1.0] > 0 and margins[10.0] > 0
    assert margins[100.0] < 0 and margins[1e3] < 0 and margins[1e4] < 0
