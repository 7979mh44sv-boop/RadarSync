"""Network timing model: correlation, synchronisation, decomposition and term generators."""

from dataclasses import replace

import numpy as np
import pytest

from radarsync_sim.clock import ClockNoiseModel
from radarsync_sim.network import CLOCK, RadarNetworkConfig, simulate_network
from radarsync_sim.provenance import Provenance, Quantity
from radarsync_sim.radar import pair_relative
from radarsync_sim.timing_errors import (
    ErrorCategory,
    NonClockTerm,
    SyncConfig,
    SyncMode,
    TermKind,
    default_non_clock_terms,
    sa65_temperature_ramp_rms,
)

A = Provenance.ASSUMPTION
WFM = ClockNoiseModel(white_fm_a=1e-11)


def q(v, unit="s"):
    return Quantity(v, unit, A, "test value")


def cfg(**kw):
    base = dict(n_nodes=3, observation_s=4.0, sample_interval_s=1e-2, cpi_s=0.1,
                sync=SyncConfig(SyncMode.TIME, 1.0, q(0.0)), non_clock_terms=())
    base.update(kw)
    return RadarNetworkConfig(**base)


def test_contributions_sum_to_total_and_are_deterministic():
    c = cfg(non_clock_terms=default_non_clock_terms(), sync=SyncConfig(SyncMode.TIME, 1.0, q(1e-12)))
    a, b = simulate_network(WFM, c, 5), simulate_network(WFM, c, 5)
    np.testing.assert_array_equal(a.total, b.total)
    np.testing.assert_allclose(a.total, a.clock + a.non_clock, rtol=1e-12, atol=1e-27)  # summation order
    assert {CLOCK, "synchronization", "calibration", "distribution", "propagation", "environmental"} <= set(a.contributions)
    assert a.provenance is Provenance.SIMULATED


def test_full_correlation_cancels_relative_clock_error():
    r = simulate_network(WFM, cfg(clock_correlation=1.0), 1)
    np.testing.assert_allclose(pair_relative(r.clock), 0.0, atol=1e-30)


def test_partial_correlation_scales_relative_error_exactly():
    # Common random numbers: the independent part is the same draw scaled by sqrt(1 - rho).
    c = cfg(sync=SyncConfig(SyncMode.NONE, 1.0, q(0.0)))
    r0 = pair_relative(simulate_network(WFM, c, 2).clock)
    r75 = pair_relative(simulate_network(WFM, replace(c, clock_correlation=0.75), 2).clock)
    np.testing.assert_allclose(r75, 0.5 * r0, rtol=1e-9, atol=1e-30)


def test_time_sync_resets_clock_error_at_every_epoch():
    c = cfg()
    r = simulate_network(WFM, c, 3)
    epochs = np.arange(0, c.n_samples, c.samples_per_sync)
    np.testing.assert_array_equal(r.clock[:, epochs], 0.0)
    assert np.all(r.clock[:, epochs + 5] != 0.0)


def test_sync_error_is_constant_within_interval_with_correct_rms():
    sigma = 2e-12
    c = cfg(n_nodes=200, sync=SyncConfig(SyncMode.TIME, 1.0, q(sigma)))
    s = simulate_network(ClockNoiseModel(), c, 4).contributions["synchronization"]
    per_interval = s.reshape(200, -1, c.samples_per_sync)
    np.testing.assert_array_equal(per_interval, per_interval[:, :, :1].repeat(c.samples_per_sync, axis=2))
    assert per_interval[:, :, 0].std() == pytest.approx(sigma, rel=0.06)


def test_time_sync_wfm_error_grows_linearly_within_interval():
    # Single-node residual after a perfect time reset: Var[r(t_k + u)] = a^2 u.
    a = 1e-11
    c = cfg(n_nodes=400, observation_s=1.0)
    r = simulate_network(ClockNoiseModel(white_fm_a=a), c, 6).clock
    u = np.array([10, 50, 99]) * c.sample_interval_s
    np.testing.assert_allclose(r[:, [10, 50, 99]].var(axis=0), a**2 * u, rtol=0.15)


def test_time_frequency_sync_residual_for_pure_drift_is_exact():
    # x = D u_i t^2 / 2. Interval 0 (no frequency estimate): r = D u_i tau^2 / 2.
    # Interval k >= 1: r = D u_i tau (tau + T) / 2, with tau the time since the epoch.
    d, c = 1e-12, cfg(sync=SyncConfig(SyncMode.TIME_FREQUENCY, 1.0, q(0.0)))
    r = simulate_network(ClockNoiseModel(drift_per_s=d), c, 7).clock
    s, tau0, period = c.samples_per_sync, c.sample_interval_s, c.sync.interval_s
    tau = np.arange(s) * tau0
    du = 2 * r[:, 1] / tau[1] ** 2  # recover D u_i from interval 0
    np.testing.assert_allclose(r[:, :s], 0.5 * du[:, None] * tau**2, rtol=1e-9)
    for k in range(1, c.n_samples // s):
        np.testing.assert_allclose(r[:, k * s:(k + 1) * s], 0.5 * du[:, None] * tau * (tau + period), rtol=1e-6, atol=1e-28)


@pytest.mark.parametrize(("in_loop", "removed"), [(True, True), (False, False)])
def test_in_loop_terms_are_removed_by_sync_and_out_of_loop_terms_are_not(in_loop, removed):
    term = NonClockTerm("static", ErrorCategory.CALIBRATION, TermKind.STATIC, q(5e-12), in_loop)
    r = simulate_network(ClockNoiseModel(), cfg(non_clock_terms=(term,)), 8).contributions["calibration"]
    assert np.all(r == 0.0) == removed


def test_term_generators_statistics():
    rng, tau0 = np.random.default_rng(0), 1e-2
    def gen(kind, value, unit, n=4000, nodes=1):
        return NonClockTerm("t", ErrorCategory.PROPAGATION, kind, q(value, unit), False).generate(nodes, 101, tau0, rng)[:, :] if n else None
    static = NonClockTerm("t", ErrorCategory.CALIBRATION, TermKind.STATIC, q(3e-12), False).generate(5000, 50, tau0, rng)
    assert np.all(static == static[:, :1]) and static[:, 0].std() == pytest.approx(3e-12, rel=0.05)
    white = NonClockTerm("t", ErrorCategory.DISTRIBUTION, TermKind.WHITE, q(2e-12), False).generate(50, 1000, tau0, rng)
    assert white.std() == pytest.approx(2e-12, rel=0.02)
    rw = NonClockTerm("t", ErrorCategory.PROPAGATION, TermKind.RANDOM_WALK, q(1e-12, "s/s^0.5"), False).generate(4000, 101, tau0, rng)
    assert rw[:, 0].max() == 0.0 and rw[:, 100].var() == pytest.approx(1e-24 * 1.0, rel=0.08)
    ramp = NonClockTerm("t", ErrorCategory.ENVIRONMENTAL, TermKind.FREQUENCY_RAMP, q(1e-13, "1/s"), True).generate(3, 101, tau0, rng)
    t = np.arange(101) * tau0
    np.testing.assert_allclose(ramp, ramp[:, [-1]] * (t / t[-1]) ** 2, rtol=1e-12)


def test_term_validation():
    with pytest.raises(ValueError):
        NonClockTerm("t", ErrorCategory.PROPAGATION, TermKind.RANDOM_WALK, q(1e-12, "s"), False)
    with pytest.raises(ValueError):
        NonClockTerm("t", ErrorCategory.SYNCHRONIZATION, TermKind.STATIC, q(1e-12), False)


@pytest.mark.parametrize("bad", [
    dict(n_nodes=1), dict(clock_correlation=1.5), dict(cpi_s=0.15),
    dict(sync=SyncConfig(SyncMode.TIME, 0.35, q(0.0))), dict(observation_s=4.05),
])
def test_config_validation(bad):
    with pytest.raises(ValueError):
        cfg(**bad)


def test_parameter_provenance_labels():
    c = RadarNetworkConfig()
    assert all(v.provenance is A for v in c.parameter_table().values())
    rate = sa65_temperature_ramp_rms(0.5)
    assert rate.value == pytest.approx(3e-10 / 120 * 0.5 / 60)
    assert rate.provenance is A and "DS00003478F" in rate.source
