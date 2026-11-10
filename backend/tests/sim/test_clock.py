"""Time error, phase error, drift and determinism of ClockNoiseModel."""

import numpy as np
import pytest

from radarsync_sim.clock import ClockNoiseModel, ClockRealization
from radarsync_sim.provenance import Provenance
from radarsync_sim.stability import overlapping_adev

MODEL = ClockNoiseModel(white_fm_a=1e-11, flicker_fm_b=1e-12, random_walk_fm_c=1e-14, drift_per_s=1e-15)


def test_same_seed_is_bitwise_reproducible():
    a, b = MODEL.simulate(1024, 0.1, seed=42), MODEL.simulate(1024, 0.1, seed=42)
    np.testing.assert_array_equal(a.y, b.y)
    assert not np.array_equal(a.y, MODEL.simulate(1024, 0.1, seed=43).y)


def test_components_use_independent_streams():
    # Disabling flicker FM must not change the white-FM realisation for the same seed.
    full = MODEL.simulate(256, 1.0, seed=7)
    no_flicker = ClockNoiseModel(white_fm_a=1e-11).simulate(256, 1.0, seed=7)
    np.testing.assert_array_equal(full.components["white_fm"], no_flicker.components["white_fm"])


def test_constant_offset_time_and_phase_error_exact():
    # y = 1e-9 for 1 s at 10 GHz: x(1 s) = 1 ns and phi(1 s) = 2 pi * 10 rad (10 cycles).
    r = ClockRealization(tau0=1e-3, seed=0, components={"offset": np.full(1000, 1e-9)})
    np.testing.assert_allclose(r.x, 1e-9 * r.t, rtol=1e-12, atol=1e-24)
    assert r.phase_error(10e9)[-1] == pytest.approx(2 * np.pi * 10.0, rel=1e-12)


def test_phase_error_is_2pi_f_times_time_error():
    r = MODEL.simulate(512, 0.01, seed=3)
    np.testing.assert_allclose(r.phase_error(9.6e9), 2 * np.pi * 9.6e9 * r.x)
    with pytest.raises(ValueError):
        r.phase_error(0.0)


def test_drift_integrates_exactly_to_quadratic_time_error():
    d, tau0 = 3e-16, 2.0
    r = ClockNoiseModel(drift_per_s=d).simulate(1000, tau0, seed=0)
    np.testing.assert_allclose(r.x, 0.5 * d * r.t**2, rtol=1e-12, atol=1e-30)
    adev = overlapping_adev(r.x, tau0)
    np.testing.assert_allclose(adev.adev, ClockNoiseModel(drift_per_s=d).adev(adev.taus), rtol=1e-9)


def test_output_shapes_and_provenance():
    r = MODEL.simulate(100, 1.0, seed=0)
    assert r.y.shape == (100,) and r.x.shape == (101,) and r.t.shape == (101,)
    assert r.x[0] == 0.0
    assert r.provenance is Provenance.SIMULATED
