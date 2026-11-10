"""Validation of the power-law noise generators against analytic Allan-deviation laws."""

import numpy as np
import pytest

from radarsync_sim.clock import ClockNoiseModel
from radarsync_sim.noise import kasdin_walter_coefficients

from .conftest import N, ensemble_adev, loglog_slope

# m >= 8 avoids discretisation effects. Level tolerances were set from the measured spread of
# the 8-seed ensemble estimator over 30 independent seed sets: 99th-percentile relative error
# <= 3.3 % for m <= 128 (= N/256), rising to ~7 % at m = 512, so levels are checked up to m = 128
# with a 5 % tolerance and the log-log slope over the full range m = 8..512.
M_FIT = 2 ** np.arange(3, 10)
M_LEVEL = 2 ** np.arange(3, 8)


def test_kasdin_walter_coefficients():
    np.testing.assert_allclose(kasdin_walter_coefficients(1.0, 5), [1, 0.5, 0.375, 0.3125, 0.2734375])
    np.testing.assert_allclose(kasdin_walter_coefficients(2.0, 5), np.ones(5))  # random walk
    np.testing.assert_allclose(kasdin_walter_coefficients(0.0, 5), [1, 0, 0, 0, 0])  # white


@pytest.mark.parametrize(
    ("model", "expected_slope"),
    [
        (ClockNoiseModel(white_fm_a=1.0), -0.5),
        (ClockNoiseModel(flicker_fm_b=1.0), 0.0),
        (ClockNoiseModel(random_walk_fm_c=1.0), 0.5),
    ],
    ids=["white_fm", "flicker_fm", "random_walk_fm"],
)
def test_adev_slope_and_level_match_theory(model, expected_slope):
    tau0 = 1.0
    adev = ensemble_adev(model, M_FIT, tau0)
    taus = M_FIT * tau0
    assert loglog_slope(taus, adev) == pytest.approx(expected_slope, abs=0.03)
    level = np.isin(M_FIT, M_LEVEL)
    np.testing.assert_allclose(adev[level], model.adev(taus[level]), rtol=0.05)


@pytest.mark.parametrize("tau0", [1e-3, 1.0, 10.0])
def test_white_fm_scales_correctly_with_sample_interval(tau0):
    model = ClockNoiseModel(white_fm_a=3e-10)
    m = np.array([1, 4, 16])
    np.testing.assert_allclose(ensemble_adev(model, m, tau0), model.adev(m * tau0), rtol=0.03)


def test_random_walk_fm_discretisation_bias_matches_prediction():
    # Discrete RWFM: sigma^2(m) = c^2 tau (1 + 1/(2 m^2)); at m = 1 this is a factor sqrt(1.5).
    model = ClockNoiseModel(random_walk_fm_c=1.0)
    m = np.array([1, 2])
    expected = model.adev(m) * np.sqrt(1 + 1 / (2 * m**2))
    np.testing.assert_allclose(ensemble_adev(model, m), expected, rtol=0.03)


def test_white_fm_time_error_variance_grows_linearly():
    # White FM => x(t) is a random walk with Var[x(t)] = a^2 t.
    a, tau0, n = 2e-11, 0.5, 400
    model = ClockNoiseModel(white_fm_a=a)
    xs = np.array([model.simulate(n, tau0, seed).x for seed in range(500)])
    t = np.arange(n + 1) * tau0
    idx = [50, 200, 400]
    np.testing.assert_allclose(np.mean(xs[:, idx] ** 2, axis=0), a**2 * t[idx], rtol=0.15)
    assert np.all(np.abs(xs[:, idx].mean(axis=0)) < 4 * a * np.sqrt(t[idx] / 500))


def test_combined_noise_adds_in_variance():
    model = ClockNoiseModel(white_fm_a=1e-12, flicker_fm_b=1e-13, random_walk_fm_c=1e-15)
    np.testing.assert_allclose(ensemble_adev(model, M_LEVEL), model.adev(M_LEVEL.astype(float)), rtol=0.05)


def test_zero_coefficients_give_zero_noise():
    r = ClockNoiseModel().simulate(64, 1.0, seed=0)
    assert np.all(r.y == 0) and np.all(r.x == 0)


def test_negative_coefficient_rejected():
    with pytest.raises(ValueError):
        ClockNoiseModel(white_fm_a=-1.0)


def test_n_is_reasonable():
    assert N >= 2**15  # guards the statistical tolerances above
