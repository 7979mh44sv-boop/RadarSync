"""Overlapping Allan deviation estimator (NIST SP 1065, Riley 2008, eq. 11-12)."""

from dataclasses import dataclass

import numpy as np

from radarsync_sim.provenance import Provenance


@dataclass(frozen=True)
class AdevResult:
    taus: np.ndarray       # averaging times [s]
    adev: np.ndarray       # overlapping Allan deviation [-]
    n_terms: np.ndarray    # number of second differences used at each tau
    provenance: Provenance = Provenance.SIMULATED


def octave_factors(n_phase: int) -> np.ndarray:
    """Averaging factors m = 1, 2, 4, ... up to (n_phase - 1) // 4."""
    max_m = (n_phase - 1) // 4
    if max_m < 1:
        raise ValueError("need at least 5 phase samples")
    return 2 ** np.arange(int(np.floor(np.log2(max_m))) + 1)


def overlapping_adev(x: np.ndarray, tau0: float, m: np.ndarray | None = None) -> AdevResult:
    """Overlapping ADEV from phase (time-error) data x [s] sampled every tau0 [s].

    sigma_y^2(m tau0) = sum_{i=0}^{N-2m-1} (x[i+2m] - 2 x[i+m] + x[i])^2 / (2 (N-2m) m^2 tau0^2)
    """
    x = np.asarray(x, dtype=float)
    if x.ndim != 1:
        raise ValueError("x must be one-dimensional")
    if tau0 <= 0:
        raise ValueError("tau0 must be > 0")
    n = x.size
    m = octave_factors(n) if m is None else np.atleast_1d(np.asarray(m, dtype=int))
    if np.any(m < 1) or np.any(2 * m >= n):
        raise ValueError("averaging factors must satisfy 1 <= m < N/2")

    adev = np.empty(m.size)
    n_terms = np.empty(m.size, dtype=int)
    for j, mj in enumerate(m):
        d = x[2 * mj:] - 2.0 * x[mj:n - mj] + x[: n - 2 * mj]
        adev[j] = np.sqrt(np.mean(d * d) / (2.0 * (mj * tau0) ** 2))
        n_terms[j] = d.size
    return AdevResult(taus=m * tau0, adev=adev, n_terms=n_terms)


def frequency_to_phase(y: np.ndarray, tau0: float) -> np.ndarray:
    """Integrate interval-averaged fractional frequency into time error x [s], x[0] = 0."""
    return np.concatenate(([0.0], np.cumsum(np.asarray(y, dtype=float)) * tau0))


def overlapping_adev_from_frequency(y: np.ndarray, tau0: float, m: np.ndarray | None = None) -> AdevResult:
    return overlapping_adev(frequency_to_phase(y, tau0), tau0, m)
