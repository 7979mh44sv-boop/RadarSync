"""Validation of the overlapping ADEV estimator against closed forms and a naive reference."""

import numpy as np
import pytest

from radarsync_sim.stability import (
    frequency_to_phase,
    octave_factors,
    overlapping_adev,
    overlapping_adev_from_frequency,
)


def naive_oadev(x, tau0, m):
    n = len(x)
    s = sum((x[i + 2 * m] - 2 * x[i + m] + x[i]) ** 2 for i in range(n - 2 * m))
    return np.sqrt(s / (2 * (n - 2 * m) * (m * tau0) ** 2))


def test_matches_naive_loop_implementation():
    x = np.random.default_rng(1).standard_normal(500).cumsum() * 1e-9
    m = np.array([1, 3, 7, 50, 120])
    result = overlapping_adev(x, 0.25, m)
    expected = [naive_oadev(x, 0.25, mi) for mi in m]
    np.testing.assert_allclose(result.adev, expected, rtol=1e-12)
    np.testing.assert_array_equal(result.n_terms, 500 - 2 * m)
    np.testing.assert_allclose(result.taus, m * 0.25)


def test_constant_frequency_offset_gives_zero_adev():
    x = 1e-9 * np.arange(1000) * 0.1  # x = y0 t
    np.testing.assert_allclose(overlapping_adev(x, 0.1).adev, 0.0, atol=1e-22)


def test_linear_frequency_drift_closed_form():
    # y = D t  =>  x = D t^2 / 2  =>  sigma_y(tau) = D tau / sqrt(2)  (exact)
    drift, tau0 = 2e-13, 1.0
    t = np.arange(4001) * tau0
    r = overlapping_adev(0.5 * drift * t**2, tau0)
    np.testing.assert_allclose(r.adev, drift * r.taus / np.sqrt(2), rtol=1e-9)


def test_frequency_to_phase_integration():
    np.testing.assert_allclose(frequency_to_phase(np.array([1.0, 2.0, -1.0]), 0.5), [0, 0.5, 1.5, 1.0])
    y = np.random.default_rng(2).standard_normal(64)
    np.testing.assert_allclose(
        overlapping_adev_from_frequency(y, 1.0).adev,
        overlapping_adev(frequency_to_phase(y, 1.0), 1.0).adev,
    )


def test_octave_factors():
    np.testing.assert_array_equal(octave_factors(33), [1, 2, 4, 8])


@pytest.mark.parametrize("m", [0, 5])
def test_rejects_invalid_averaging_factors(m):
    with pytest.raises(ValueError):
        overlapping_adev(np.zeros(10), 1.0, [m])


def test_rejects_bad_inputs():
    with pytest.raises(ValueError):
        overlapping_adev(np.zeros(4), 1.0)
    with pytest.raises(ValueError):
        overlapping_adev(np.zeros(10), 0.0, [1])
