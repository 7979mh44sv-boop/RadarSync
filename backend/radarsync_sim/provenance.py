"""Provenance labelling for every model input and output.

The NextSemi challenge requires that sourced inputs, engineering assumptions
and simulated outputs are clearly separated. Every numeric parameter of a
scenario is wrapped in a `Quantity` carrying one of these labels.
"""

from dataclasses import dataclass
from enum import StrEnum


class Provenance(StrEnum):
    SOURCED = "sourced"
    """Published value (datasheet, standard, paper). Must cite the document."""

    ASSUMPTION = "assumption"
    """Illustrative engineering assumption chosen by the team; not a measurement."""

    HYPOTHETICAL_TARGET = "hypothetical_target"
    """A target specification posited by the challenge; not a measured value."""

    SIMULATED = "simulated"
    """Produced by this model. Never an input and never a measurement."""


@dataclass(frozen=True)
class Quantity:
    value: float
    unit: str
    provenance: Provenance
    source: str
    """Citation (SOURCED / HYPOTHETICAL_TARGET) or justification (ASSUMPTION)."""

    def __post_init__(self) -> None:
        if not self.source.strip():
            raise ValueError("Every Quantity needs a source or justification.")
