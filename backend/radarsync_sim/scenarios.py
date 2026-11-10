"""Clock scenarios: existing CSAC (SA65), illustrative OCXO, hypothetical NextGen CSAC.

Every coefficient carries a provenance label. Key rules:
  * SA65: the ADEV table is SOURCED; splitting it into WFM/FFM/RWFM terms is an
    ASSUMPTION (least-squares fit) valid only over the tabulated tau range.
  * OCXO: entirely ASSUMPTION (illustrative, configurable). No product is implied.
  * NextGen: only ADEV(1 s) <= 1e-15 is posited, as a HYPOTHETICAL_TARGET. One
    ADEV point does not determine the noise-type mix or behaviour at other tau,
    so several explicitly assumed variants are provided. Per the challenge brief,
    all other SA65 specifications (including aging) are kept unless disabled.
"""

from dataclasses import dataclass

import numpy as np
from scipy.optimize import nnls

from radarsync_sim import parameters as P
from radarsync_sim.clock import ClockNoiseModel
from radarsync_sim.provenance import Provenance, Quantity

A = Provenance.ASSUMPTION


@dataclass(frozen=True)
class ClockScenario:
    key: str
    label: str
    category: Provenance
    """Overall nature of the scenario: SOURCED-derived, ASSUMPTION or HYPOTHETICAL_TARGET."""
    model: ClockNoiseModel
    parameters: dict[str, Quantity]
    """Provenance of each model coefficient, keyed by ClockNoiseModel field name."""
    valid_tau_range: tuple[float, float] | None
    """tau range [s] over which the ADEV is constrained by data/targets; None = unconstrained."""
    notes: str


def fit_power_law_adev(taus: np.ndarray, adevs: np.ndarray) -> tuple[float, float, float]:
    """Non-negative fit of sigma^2 = a^2/tau + b^2 + c^2 tau to ADEV points.

    Residuals are relative (each row divided by sigma_i^2) so every decade is weighted
    equally. Returns (a, b, c). The decomposition is an assumption, not a measurement.
    """
    taus, adevs = np.asarray(taus, float), np.asarray(adevs, float)
    design = np.column_stack([1.0 / taus, np.ones_like(taus), taus]) / adevs[:, None] ** 2
    coeffs, _ = nnls(design, np.ones_like(taus))
    return tuple(float(np.sqrt(c)) for c in coeffs)  # type: ignore[return-value]


def _drift_from_monthly_aging(include: bool) -> tuple[float, Quantity]:
    value = P.SA65_AGING_MONTHLY.value / P.SECONDS_PER_MONTH if include else 0.0
    return value, Quantity(
        value, "1/s", A,
        f"Constant linear drift equal to {P.SA65_AGING_MONTHLY.source}, converted with a "
        "30-day month. Treating a typical monthly aging spec as a constant drift rate at "
        "short time scales is an assumption." if include else "Drift disabled by configuration.",
    )


def sa65(grade: str = "industrial", include_aging: bool = True) -> ClockScenario:
    table = {"industrial": P.SA65_ADEV_INDUSTRIAL, "commercial": P.SA65_ADEV_COMMERCIAL}[grade]
    taus = np.array(sorted(table))
    a, b, c = fit_power_law_adev(taus, np.array([table[t].value for t in taus]))
    drift, drift_q = _drift_from_monthly_aging(include_aging)
    fitted = ClockNoiseModel(a, b, c).adev(taus)
    rel_err = fitted / np.array([table[t].value for t in taus]) - 1.0
    worst = int(np.argmax(np.abs(rel_err)))
    fit_note = (
        f"Non-negative least-squares fit to the {grade} ADEV table of {P.SA65_DATASHEET} "
        f"(tau = {taus.min():g}..{taus.max():g} s). The noise-type decomposition is an assumption."
    )
    return ClockScenario(
        key=f"sa65_{grade}",
        label=f"Existing CSAC (Microchip SA65, {grade})",
        category=Provenance.SOURCED,
        model=ClockNoiseModel(a, b, c, drift),
        parameters={
            "white_fm_a": Quantity(a, "s^0.5", A, fit_note),
            "flicker_fm_b": Quantity(b, "-", A, fit_note),
            "random_walk_fm_c": Quantity(c, "s^-0.5", A, fit_note),
            "drift_per_s": drift_q,
        },
        valid_tau_range=(float(taus.min()), float(taus.max())),
        notes="ADEV table values are datasheet limits, so the fitted model represents spec-limit, "
        "not typical, performance. Largest fit deviation from the table: "
        f"{rel_err[worst]:+.1%} at tau = {taus[worst]:g} s (a white/flicker/random-walk FM sum cannot "
        "follow every tabulated point). Temperature, voltage, magnetic and retrace effects are not modelled.",
    )


def ocxo(white_fm_a: float = 3e-13, flicker_fm_b: float = 1e-12,
         random_walk_fm_c: float = 1e-14, drift_per_s: float = 0.0) -> ClockScenario:
    why = ("Illustrative OCXO-class value chosen by the RadarSync team for comparison; "
           "not taken from any product datasheet. Override for a specific part.")
    return ClockScenario(
        key="ocxo",
        label="OCXO (illustrative)",
        category=A,
        model=ClockNoiseModel(white_fm_a, flicker_fm_b, random_walk_fm_c, drift_per_s),
        parameters={
            "white_fm_a": Quantity(white_fm_a, "s^0.5", A, why),
            "flicker_fm_b": Quantity(flicker_fm_b, "-", A, why),
            "random_walk_fm_c": Quantity(random_walk_fm_c, "s^-0.5", A, why),
            "drift_per_s": Quantity(drift_per_s, "1/s", A, why),
        },
        valid_tau_range=None,
        notes="Fully assumed. Replace with sourced datasheet values before drawing conclusions.",
    )


NEXTGEN_VARIANTS: dict[str, tuple[float, float, float]] = {
    # (white_fm_a, flicker_fm_b, random_walk_fm_c): all ASSUMPTIONS.
    "white_fm": (9.5e-16, 0.0, 0.0),
    "flicker_floor": (7.0e-16, 6.5e-16, 0.0),
}


def nextgen_csac(variant: str = "white_fm", include_sa65_aging: bool = True) -> ClockScenario:
    a, b, c = NEXTGEN_VARIANTS[variant]
    drift, drift_q = _drift_from_monthly_aging(include_sa65_aging)
    model = ClockNoiseModel(a, b, c, drift)
    target = P.NEXTGEN_ADEV_1S_TARGET
    adev_1s = float(model.adev(1.0))
    if adev_1s > target.value:
        raise ValueError(f"variant {variant!r} violates the 1 s target: ADEV(1 s) = {adev_1s:.3g}")
    why = (f"Assumed noise-type mix for variant '{variant}', chosen so the model ADEV at 1 s "
           f"(including drift) stays below the hypothetical target ({target.value:g}). "
           "Behaviour at tau != 1 s is not constrained by the challenge.")
    return ClockScenario(
        key=f"nextgen_{variant}",
        label=f"NextGen CSAC (hypothetical, {variant.replace('_', ' ')})",
        category=Provenance.HYPOTHETICAL_TARGET,
        model=model,
        parameters={
            "white_fm_a": Quantity(a, "s^0.5", A, why),
            "flicker_fm_b": Quantity(b, "-", A, why),
            "random_walk_fm_c": Quantity(c, "s^-0.5", A, why),
            "drift_per_s": drift_q,
        },
        valid_tau_range=(1.0, 1.0),
        notes=f"Hypothetical: {target.source}. Not a measured or published performance.",
    )


def all_scenarios() -> list[ClockScenario]:
    return [ocxo(), sa65(), *(nextgen_csac(v) for v in NEXTGEN_VARIANTS)]
