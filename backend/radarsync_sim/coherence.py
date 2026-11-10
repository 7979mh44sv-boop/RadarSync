"""Coherent-integration gain and its analytical expectations.

Definitions
-----------
For M complex samples with phase errors phi_m [rad] and equal amplitudes, the
coherent gain relative to perfect phase alignment is

    G = | (1/M) sum_m exp(j phi_m) |^2,        0 <= G <= 1,
    coherent integration loss L = -10 log10(E[G])  [dB].

G is invariant to a common phase offset. Random phases give E[G] = 1/M, so the
loss saturates at 10 log10(M) dB.

Analytical results (assumption: phase errors are jointly Gaussian)
------------------------------------------------------------------
* i.i.d. phases with variance s2:          E[G] = exp(-s2) + (1 - exp(-s2)) / M
* stationary Gaussian increments with structure function
  D(tau) = E[(phi(t + tau) - phi(t))^2]:   E[G] = (1/M^2) sum_{m,n} exp(-D(|t_m - t_n|) / 2)
* Brownian phase (D = k tau) over a continuous window T:
                                           E[G] = 2 (x - 1 + exp(-x)) / x^2,  x = k T / 2
* deterministic linear ramp, theta = 2 pi df tau0 per sample:
                                           G = (sin(M theta / 2) / (M sin(theta / 2)))^2
* small angles:                            L ~= (10 / ln 10) s2  [dB]
"""

from collections.abc import Callable

import numpy as np

DB_PER_NEPER_POWER = 10.0 / np.log(10.0)


def coherent_gain(phases: np.ndarray, axis: int = -1) -> np.ndarray:
    """|mean(exp(j phi))|^2 along `axis`."""
    return np.abs(np.mean(np.exp(1j * np.asarray(phases, dtype=float)), axis=axis)) ** 2


def gain_to_loss_db(gain: np.ndarray | float) -> np.ndarray:
    return -10.0 * np.log10(np.asarray(gain, dtype=float))


def expected_gain_iid_gaussian(variance: float, m: int) -> float:
    p = np.exp(-variance)
    return float(p + (1.0 - p) / m)


def expected_gain_from_structure_function(
    times: np.ndarray, structure_fn: Callable[[np.ndarray], np.ndarray]
) -> float:
    """Exact E[G] for Gaussian phase with stationary increments; structure_fn(0) must be 0."""
    t = np.asarray(times, dtype=float)
    return float(np.mean(np.exp(-0.5 * structure_fn(np.abs(t[:, None] - t[None, :])))))


def brownian_phase_gain_continuous(k: float, window_s: float) -> float:
    x = 0.5 * k * window_s
    if x < 1e-8:
        return 1.0 - x / 3.0
    return float(2.0 * (x - 1.0 + np.exp(-x)) / x**2)


def linear_ramp_gain(freq_offset_hz: float, tau0: float, m: int) -> float:
    theta = 2.0 * np.pi * freq_offset_hz * tau0
    if abs(np.sin(theta / 2.0)) < 1e-15:
        return 1.0
    return float((np.sin(m * theta / 2.0) / (m * np.sin(theta / 2.0))) ** 2)


def small_angle_loss_db(variance: float) -> float:
    return float(DB_PER_NEPER_POWER * variance)
