"""Analytical coherent-gain results and Monte Carlo checks of the Gaussian formulas."""

import numpy as np
import pytest

from radarsync_sim.coherence import (
    brownian_phase_gain_continuous,
    coherent_gain,
    expected_gain_from_structure_function,
    expected_gain_iid_gaussian,
    gain_to_loss_db,
    linear_ramp_gain,
    small_angle_loss_db,
)


def test_gain_identities():
    assert coherent_gain(np.zeros(8)) == pytest.approx(1.0)
    assert coherent_gain(np.array([0.0, np.pi])) == pytest.approx(0.0, abs=1e-30)
    phi = np.random.default_rng(0).normal(0, 0.3, 64)
    assert coherent_gain(phi + 1.234) == pytest.approx(coherent_gain(phi))  # common offset cancels
    assert gain_to_loss_db(0.5) == pytest.approx(3.0103, abs=1e-4)


@pytest.mark.parametrize("df", [0.0, 0.3, 1.7, 10.0])
def test_linear_ramp_matches_dirichlet_kernel_exactly(df):
    tau0, m = 1e-3, 100
    phases = 2 * np.pi * df * np.arange(m) * tau0
    assert coherent_gain(phases) == pytest.approx(linear_ramp_gain(df, tau0, m), rel=1e-12, abs=1e-15)


def test_full_cycle_ramp_gives_zero_gain():
    assert linear_ramp_gain(10.0, 1e-3, 100) == pytest.approx(0.0, abs=1e-25)  # df * T = 1


@pytest.mark.parametrize(("var", "m"), [(0.1, 16), (0.5, 16), (2.0, 4)])
def test_iid_gaussian_monte_carlo(var, m):
    rng = np.random.default_rng(11)
    g = coherent_gain(rng.normal(0.0, np.sqrt(var), (40_000, m)), axis=-1).mean()
    assert g == pytest.approx(expected_gain_iid_gaussian(var, m), rel=0.01)


def test_structure_function_reduces_to_iid_case():
    var, t = 0.4, np.arange(20) * 1e-3
    d = lambda lag: np.where(lag > 0, 2 * var, 0.0)  # noqa: E731
    assert expected_gain_from_structure_function(t, d) == pytest.approx(expected_gain_iid_gaussian(var, 20))


def test_discrete_brownian_converges_to_continuous_formula():
    k, window = 40.0, 0.1
    t = np.linspace(0, window, 2001)
    discrete = expected_gain_from_structure_function(t, lambda lag: k * lag)
    assert discrete == pytest.approx(brownian_phase_gain_continuous(k, window), rel=1e-3)
    assert brownian_phase_gain_continuous(1e-12, 1.0) == pytest.approx(1.0)


def test_small_angle_loss():
    assert small_angle_loss_db(0.01) == pytest.approx(gain_to_loss_db(np.exp(-0.01)))
    assert gain_to_loss_db(expected_gain_iid_gaussian(0.01, 10**9)) == pytest.approx(small_angle_loss_db(0.01), rel=1e-6)
