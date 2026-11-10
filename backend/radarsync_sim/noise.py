"""Power-law fractional-frequency noise generators.

Conventions (IEEE Std 1139, NIST SP 1065):
  * y is dimensionless fractional frequency deviation, (nu - nu0) / nu0.
  * One-sided PSD S_y(f) = h_alpha * f**alpha.
  * Samples y[k] represent the average of y(t) over the k-th interval of length tau0 [s].

Each generator is parameterised by its Allan-deviation coefficient rather than h_alpha,
because ADEV is what datasheets publish:

  white FM       (alpha =  0):  sigma_y^2(tau) = a^2 / tau,   a^2 = h0 / 2
  flicker FM     (alpha = -1):  sigma_y^2(tau) = b^2,         b^2 = 2 ln2 h_-1
  random-walk FM (alpha = -2):  sigma_y^2(tau) = c^2 * tau,   c^2 = (2 pi^2 / 3) h_-2
"""

import numpy as np
from scipy.signal import fftconvolve


def kasdin_walter_coefficients(beta: float, n: int) -> np.ndarray:
    """Impulse response of the fractional-difference filter (1 - z^-1)^(-beta/2).

    Filtering unit white noise with it yields discrete noise with PSD proportional
    to |2 sin(pi f tau0)|^(-beta), i.e. ~ 1/f^beta at low frequency.
    Reference: N. J. Kasdin and T. Walter, "Discrete simulation of power law
    noise", Proc. IEEE Frequency Control Symposium, 1992.
    """
    h = np.empty(n)
    h[0] = 1.0
    for k in range(1, n):
        h[k] = h[k - 1] * (beta / 2.0 + k - 1.0) / k
    return h


def _check(n: int, tau0: float, coeff: float) -> None:
    if n < 1:
        raise ValueError("n must be >= 1")
    if tau0 <= 0:
        raise ValueError("tau0 must be > 0")
    if coeff < 0:
        raise ValueError("noise coefficient must be >= 0")


def white_fm(n: int, tau0: float, a: float, rng: np.random.Generator) -> np.ndarray:
    """White FM with sigma_y(tau) = a / sqrt(tau). Units of a: s^(1/2).

    Interval averages of white FM are i.i.d. with variance h0/(2 tau0) = a^2/tau0.
    """
    _check(n, tau0, a)
    return rng.standard_normal(n) * (a / np.sqrt(tau0))


def flicker_fm(n: int, tau0: float, b: float, rng: np.random.Generator) -> np.ndarray:
    """Flicker FM with flat Allan deviation sigma_y(tau) = b (dimensionless).

    Kasdin-Walter filter with beta = 1. The output PSD is S_y(f) ~ Q/(pi f) for
    f << 1/tau0 where Q is the white-input variance, so h_-1 = Q/pi and
    Q = pi b^2 / (2 ln 2). The discrete PSD |2 sin(pi f tau0)|^-1 exceeds 1/f near
    the Nyquist frequency, so the ADEV exceeds b at the shortest averaging times
    (about +20 % at m = 1, +3 % at m = 4, < 1 % for m >= 8). The filter starts from
    rest (zero memory), as in Kasdin and Walter (1992).
    """
    _check(n, tau0, b)
    if b == 0:
        return np.zeros(n)
    q = np.pi * b**2 / (2.0 * np.log(2.0))
    w = rng.standard_normal(n) * np.sqrt(q)
    return fftconvolve(w, kasdin_walter_coefficients(1.0, n))[:n]


def random_walk_fm(n: int, tau0: float, c: float, rng: np.random.Generator) -> np.ndarray:
    """Random-walk FM with sigma_y(tau) = c * sqrt(tau). Units of c: s^(-1/2).

    y is a Wiener process with diffusion coefficient D_w = 3 c^2 (Var[y(t)] = D_w t),
    since S_y = D_w / (2 pi^2 f^2) and sigma_y^2 = D_w tau / 3. Sampled at tau0,
    the discrete ADEV is inflated by a factor (1 + 1/(2 m^2)) in variance.
    """
    _check(n, tau0, c)
    return np.cumsum(rng.standard_normal(n) * np.sqrt(3.0 * c**2 * tau0))
