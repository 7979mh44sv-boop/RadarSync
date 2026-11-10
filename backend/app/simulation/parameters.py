"""Model inputs with explicit provenance.

The challenge requires that sourced inputs, engineering assumptions and
simulated outputs are clearly separated. Every numeric input to the model
must be declared here as a `Parameter` with a `Provenance` and a source note.
"""

from enum import StrEnum

from pydantic import BaseModel, Field


class Provenance(StrEnum):
    SOURCED = "sourced"          # Taken from a datasheet, standard, paper or the challenge brief.
    ASSUMPTION = "assumption"    # Engineering assumption made by the team; must be justified.
    SIMULATED = "simulated"      # Produced by the model; never used as an input.


class Parameter(BaseModel):
    name: str
    value: float
    unit: str
    provenance: Provenance
    source: str = Field(description="Citation or justification for the value.")


# --- Sourced inputs -------------------------------------------------------

CHALLENGE_CLOCK_ADEV_1S = Parameter(
    name="Breakthrough CSAC Allan deviation at tau = 1 s (upper bound)",
    value=1e-15,
    unit="dimensionless",
    provenance=Provenance.SOURCED,
    source="NextSemi Hackathon / imec.xpand challenge brief, Section 2 (ADEV < 1e-15 at 1 s).",
)

# Further SA65 reference specifications (size, power, warm-up, competing
# oscillator ADEV figures, etc.) are to be added here with datasheet citations.
