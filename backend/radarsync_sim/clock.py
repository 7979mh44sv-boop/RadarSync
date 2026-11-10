"""Stochastic clock noise model.

    y(t)   = y_WFM(t) + y_FFM(t) + y_RWFM(t) + D t       fractional frequency [-]
    x(t)   = integral_0^t y(t') dt'                       time error [s]
    phi(t) = 2 pi f_carrier x(t)                          phase error [rad]

Assumptions (see docs/clock_noise_model.md):
  * Noise components are independent, zero-mean, Gaussian power-law processes.
  * The power-law form is assumed to hold over the simulated span; it is only
    *constrained* where the scenario has data (see ClockScenario.valid_tau_range).
  * Phase noise outside the WFM/FFM/RWFM model (e.g. white/flicker PM, spurs,
    environmental effects such as temperature and vibration) is not modelled.
  * A clock multiplied up to f_carrier is assumed to preserve fractional
    frequency, i.e. phase error scales linearly with f_carrier (ideal synthesis).
"""

from dataclasses import dataclass, field

import numpy as np

from radarsync_sim import noise
from radarsync_sim.provenance import Provenance
from radarsync_sim.stability import frequency_to_phase

COMPONENTS = ("white_fm", "flicker_fm", "random_walk_fm", "drift")


@dataclass(frozen=True)
class ClockNoiseModel:
    white_fm_a: float = 0.0
    """ADEV coefficient of white FM: sigma_y = a / sqrt(tau). Units s^(1/2)."""
    flicker_fm_b: float = 0.0
    """Flicker FM floor: sigma_y = b. Dimensionless."""
    random_walk_fm_c: float = 0.0
    """Random-walk FM: sigma_y = c sqrt(tau). Units s^(-1/2)."""
    drift_per_s: float = 0.0
    """Deterministic linear fractional-frequency drift D [1/s]; sigma_y = |D| tau / sqrt(2)."""

    def __post_init__(self) -> None:
        if min(self.white_fm_a, self.flicker_fm_b, self.random_walk_fm_c) < 0:
            raise ValueError("noise coefficients must be >= 0")

    def adev(self, tau: np.ndarray | float) -> np.ndarray:
        """Analytic Allan deviation implied by the model (independent components add in variance)."""
        tau = np.asarray(tau, dtype=float)
        var = (
            self.white_fm_a**2 / tau
            + self.flicker_fm_b**2
            + self.random_walk_fm_c**2 * tau
            + 0.5 * (self.drift_per_s * tau) ** 2
        )
        return np.sqrt(var)

    def simulate(self, n: int, tau0: float, seed: int) -> "ClockRealization":
        """Simulate n interval-averaged frequency samples of length tau0 [s].

        Each component draws from its own child stream of SeedSequence(seed), so a
        given seed is reproducible and toggling one component leaves others unchanged.
        """
        rng_w, rng_f, rng_r = (np.random.default_rng(s) for s in np.random.SeedSequence(seed).spawn(3))
        t_mid = (np.arange(n) + 0.5) * tau0
        components = {
            "white_fm": noise.white_fm(n, tau0, self.white_fm_a, rng_w),
            "flicker_fm": noise.flicker_fm(n, tau0, self.flicker_fm_b, rng_f),
            "random_walk_fm": noise.random_walk_fm(n, tau0, self.random_walk_fm_c, rng_r),
            # Interval average of D t over [k tau0, (k+1) tau0] is D t_mid (exact).
            "drift": self.drift_per_s * t_mid,
        }
        return ClockRealization(tau0=tau0, seed=seed, components=components)


@dataclass(frozen=True)
class ClockRealization:
    """One simulated realisation. All arrays are SIMULATED outputs."""

    tau0: float
    seed: int
    components: dict[str, np.ndarray]
    provenance: Provenance = field(default=Provenance.SIMULATED)

    @property
    def y(self) -> np.ndarray:
        """Total interval-averaged fractional frequency, length n [-]."""
        return sum(self.components.values())

    @property
    def t(self) -> np.ndarray:
        """Time grid of x and phi, length n + 1 [s]."""
        return np.arange(self.y.size + 1) * self.tau0

    @property
    def x(self) -> np.ndarray:
        """Time error x(t) = integral of y, length n + 1, x(0) = 0 [s]."""
        return frequency_to_phase(self.y, self.tau0)

    def phase_error(self, f_carrier: float) -> np.ndarray:
        """Phase error phi(t) = 2 pi f_carrier x(t) [rad] at carrier frequency f_carrier [Hz]."""
        if f_carrier <= 0:
            raise ValueError("f_carrier must be > 0")
        return 2.0 * np.pi * f_carrier * self.x
