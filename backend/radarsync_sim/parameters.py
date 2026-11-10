"""Sourced reference data. Values here are transcribed from cited documents only.

Do not add values to this module unless they are copied from a citable source.
Assumptions belong in `scenarios.py`, labelled `Provenance.ASSUMPTION`.
"""

from radarsync_sim.provenance import Provenance, Quantity

SA65_DATASHEET = "Microchip CSAC SA65 datasheet DS00003478F (09/2025)"
CHALLENGE_BRIEF = (
    "NextSemi Hackathon / imec.xpand 'Chip-Scale Atomic Clock Venture Challenge', Section 2"
)

SECONDS_PER_MONTH = 30.0 * 86400.0
"""Convention used to convert '/month' aging specs (30-day month; an assumption)."""

# --- Microchip CSAC SA65 --------------------------------------------------

SA65_ADEV_INDUSTRIAL: dict[float, Quantity] = {
    tau: Quantity(v, "-", Provenance.SOURCED, f"{SA65_DATASHEET}, Stability table (Industrial)")
    for tau, v in {1.0: 3e-10, 10.0: 1e-10, 100.0: 3e-11, 1000.0: 1e-11}.items()
}
"""Allan deviation vs. averaging time tau [s], CSAC-Industrial (090-02789-002)."""

SA65_ADEV_COMMERCIAL: dict[float, Quantity] = {
    tau: Quantity(v, "-", Provenance.SOURCED, f"{SA65_DATASHEET}, Ordering Information (<= values)")
    for tau, v in {1.0: 4e-10, 10.0: 1.5e-10, 100.0: 4e-11}.items()
}
"""Allan deviation upper bounds vs. tau [s], CSAC-Commercial (090-02789-001)."""

SA65_AGING_MONTHLY = Quantity(
    9e-10, "1/month", Provenance.SOURCED,
    f"{SA65_DATASHEET}, Aging: monthly < 9e-10, typical after 30 days of continuous operation",
)
SA65_TEMPERATURE_SENSITIVITY = Quantity(
    3e-10, "-", Provenance.SOURCED,
    f"{SA65_DATASHEET}, total frequency change over -40..+80 degC (+/-)",
)
SA65_OFFSET_AT_SHIPMENT = Quantity(5e-11, "-", Provenance.SOURCED, f"{SA65_DATASHEET} (+/-, max)")
SA65_OUTPUT_FREQUENCY = Quantity(10e6, "Hz", Provenance.SOURCED, SA65_DATASHEET)

SA65_SSB_PHASE_NOISE_DBC_HZ: dict[float, Quantity] = {
    f: Quantity(v, "dBc/Hz", Provenance.SOURCED, f"{SA65_DATASHEET}, Offset Phase Noise (SSB), upper bounds at 10 MHz")
    for f, v in {1.0: -44.0, 10.0: -64.0, 100.0: -110.0, 1e3: -128.0, 1e4: -135.0, 1e5: -140.0}.items()
}
"""Stored for later use. Not used to derive spectra for other clocks."""

# --- Challenge target -----------------------------------------------------

NEXTGEN_ADEV_1S_TARGET = Quantity(
    1e-15, "-", Provenance.HYPOTHETICAL_TARGET,
    f"{CHALLENGE_BRIEF}: 'ADEV < 1 x 10^-15 at 1 second' (assumed, not measured; upper bound)",
)
