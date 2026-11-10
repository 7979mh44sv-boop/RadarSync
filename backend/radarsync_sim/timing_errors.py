"""Non-clock timing-error terms and the synchronisation model.

All terms are expressed as time errors [s] added to a node's timing, so they are
carrier-independent; phase follows from phi = 2 pi f_c x. Terms are independent
across nodes (an assumption). Every magnitude is a `Quantity` with provenance.
"""

from dataclasses import dataclass
from enum import StrEnum

import numpy as np

from radarsync_sim.provenance import Provenance, Quantity


class ErrorCategory(StrEnum):
    CALIBRATION = "calibration"
    DISTRIBUTION = "distribution"
    PROPAGATION = "propagation"
    ENVIRONMENTAL = "environmental"
    SYNCHRONIZATION = "synchronization"


class TermKind(StrEnum):
    STATIC = "static"                  # constant per node over the observation; rms in s
    WHITE = "white"                    # i.i.d. per sample and node; rms in s
    RANDOM_WALK = "random_walk"        # Var[x(t)] = rms^2 t; rms in s / s^0.5
    FREQUENCY_RAMP = "frequency_ramp"  # x = d t^2 / 2 with d ~ N(0, rms^2); rms in 1/s


_UNITS = {
    TermKind.STATIC: "s",
    TermKind.WHITE: "s",
    TermKind.RANDOM_WALK: "s/s^0.5",
    TermKind.FREQUENCY_RAMP: "1/s",
}


@dataclass(frozen=True)
class NonClockTerm:
    name: str
    category: ErrorCategory
    kind: TermKind
    rms: Quantity
    corrected_by_sync: bool
    """True if the term acts inside the synchronisation loop (e.g. on the oscillator)
    and is therefore removed by sync corrections like clock error; False for errors
    outside the loop (e.g. uncalibrated hardware delay, distribution jitter)."""

    def __post_init__(self) -> None:
        if self.rms.unit != _UNITS[self.kind]:
            raise ValueError(f"{self.name}: unit for {self.kind} must be {_UNITS[self.kind]!r}")
        if self.rms.value < 0:
            raise ValueError(f"{self.name}: rms must be >= 0")
        if self.category is ErrorCategory.SYNCHRONIZATION:
            raise ValueError("synchronisation error is configured in SyncConfig")

    def generate(self, n_nodes: int, n_samples: int, tau0: float, rng: np.random.Generator) -> np.ndarray:
        """Time error [s], shape (n_nodes, n_samples), at t_n = n tau0."""
        s = self.rms.value
        t = np.arange(n_samples) * tau0
        match self.kind:
            case TermKind.STATIC:
                return np.repeat(rng.normal(0.0, s, (n_nodes, 1)), n_samples, axis=1)
            case TermKind.WHITE:
                return rng.normal(0.0, s, (n_nodes, n_samples))
            case TermKind.RANDOM_WALK:
                steps = rng.normal(0.0, s * np.sqrt(tau0), (n_nodes, n_samples))
                steps[:, 0] = 0.0
                return np.cumsum(steps, axis=1)
            case TermKind.FREQUENCY_RAMP:
                return 0.5 * rng.normal(0.0, s, (n_nodes, 1)) * t[None, :] ** 2
        raise AssertionError(self.kind)


class SyncMode(StrEnum):
    NONE = "none"                      # aligned once at t = 0, then free-running
    TIME = "time"                      # time offset re-measured and removed at each epoch
    TIME_FREQUENCY = "time_frequency"  # also removes frequency offset estimated over the previous interval


@dataclass(frozen=True)
class SyncConfig:
    mode: SyncMode
    interval_s: float
    error_rms: Quantity
    """Time-offset measurement error per node and epoch [s] (category: synchronization)."""

    def __post_init__(self) -> None:
        if self.error_rms.unit != "s" or self.error_rms.value < 0:
            raise ValueError("sync error must be a non-negative time in s")
        if self.interval_s <= 0:
            raise ValueError("sync interval must be > 0")


def _assumed(value: float, unit: str, why: str) -> Quantity:
    return Quantity(value, unit, Provenance.ASSUMPTION, why)


def default_non_clock_terms() -> tuple[NonClockTerm, ...]:
    """Illustrative non-clock error budget. All values are ASSUMPTIONS, not sourced."""
    return (
        NonClockTerm(
            "residual hardware-delay calibration", ErrorCategory.CALIBRATION, TermKind.STATIC,
            _assumed(1e-12, "s", "Illustrative 1 ps rms residual after delay calibration."), False,
        ),
        NonClockTerm(
            "LO / clock distribution jitter", ErrorCategory.DISTRIBUTION, TermKind.WHITE,
            _assumed(0.5e-12, "s", "Illustrative 0.5 ps rms white jitter per sample."), False,
        ),
        NonClockTerm(
            "propagation path wander", ErrorCategory.PROPAGATION, TermKind.RANDOM_WALK,
            _assumed(0.1e-12, "s/s^0.5", "Illustrative 0.1 ps/sqrt(s) random-walk path delay."), False,
        ),
        NonClockTerm(
            "temperature-induced frequency ramp", ErrorCategory.ENVIRONMENTAL, TermKind.FREQUENCY_RAMP,
            _assumed(0.0, "1/s", "Disabled by default; see sa65_temperature_ramp_rms()."), True,
        ),
    )


def sa65_temperature_ramp_rms(temperature_rate_c_per_min: float) -> Quantity:
    """Frequency-ramp rms from the SA65 temperature sensitivity and an assumed temperature rate.

    Uses the sourced total sensitivity (+/-3e-10 over -40..+80 degC) under the ASSUMPTION
    of a linear frequency-temperature dependence: 3e-10 / 120 degC = 2.5e-12 / degC.
    """
    from radarsync_sim.parameters import SA65_TEMPERATURE_SENSITIVITY

    per_c = SA65_TEMPERATURE_SENSITIVITY.value / 120.0
    return _assumed(
        per_c * temperature_rate_c_per_min / 60.0, "1/s",
        f"{SA65_TEMPERATURE_SENSITIVITY.source}, assumed linear in temperature, at an "
        f"assumed rate of {temperature_rate_c_per_min:g} degC/min.",
    )
