"""Consistency check: phase noise *implied by the assumed power-law clock model*
versus sourced SA65 phase-noise limits.

This does not infer a spectrum from ADEV data. It evaluates what the model already
assumes (S_y(f) = h0 + h_-1/f + h_-2/f^2) and compares it with a sourced table,
to show over which Fourier frequencies the model is consistent with the datasheet.

    h0 = 2 a^2,  h_-1 = b^2 / (2 ln 2),  h_-2 = 3 c^2 / (2 pi^2)
    L(f) = 10 log10( nu0^2 S_y(f) / (2 f^2) )   [dBc/Hz]  (small-angle, IEEE 1139)
"""

from dataclasses import dataclass

import numpy as np

from radarsync_sim.clock import ClockNoiseModel
from radarsync_sim.parameters import SA65_OUTPUT_FREQUENCY, SA65_SSB_PHASE_NOISE_DBC_HZ


def implied_ssb_phase_noise_dbc(model: ClockNoiseModel, nu0_hz: float, f_hz: np.ndarray) -> np.ndarray:
    f = np.asarray(f_hz, dtype=float)
    s_y = (2.0 * model.white_fm_a**2
           + model.flicker_fm_b**2 / (2.0 * np.log(2.0)) / f
           + 3.0 * model.random_walk_fm_c**2 / (2.0 * np.pi**2) / f**2)
    return 10.0 * np.log10(nu0_hz**2 * s_y / (2.0 * f**2))


@dataclass(frozen=True)
class PhaseNoiseCheck:
    offset_hz: float
    model_dbc_hz: float
    datasheet_limit_dbc_hz: float

    @property
    def margin_db(self) -> float:
        """Positive: model below the datasheet limit (consistent). Negative: model exceeds it."""
        return self.datasheet_limit_dbc_hz - self.model_dbc_hz


def check_against_sa65_phase_noise(model: ClockNoiseModel) -> list[PhaseNoiseCheck]:
    offsets = np.array(sorted(SA65_SSB_PHASE_NOISE_DBC_HZ))
    implied = implied_ssb_phase_noise_dbc(model, SA65_OUTPUT_FREQUENCY.value, offsets)
    return [PhaseNoiseCheck(float(f), float(m), SA65_SSB_PHASE_NOISE_DBC_HZ[f].value)
            for f, m in zip(offsets, implied)]
