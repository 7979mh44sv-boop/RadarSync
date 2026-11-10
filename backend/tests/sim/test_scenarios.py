"""Scenario definitions: sourced data fidelity, hypothetical target and provenance labelling."""

import numpy as np
import pytest

from radarsync_sim import parameters as P
from radarsync_sim.provenance import Provenance, Quantity
from radarsync_sim.scenarios import (
    NEXTGEN_VARIANTS,
    all_scenarios,
    fit_power_law_adev,
    nextgen_csac,
    ocxo,
    sa65,
)

from .conftest import ensemble_adev


def test_fit_recovers_known_coefficients():
    taus = np.array([1.0, 10.0, 100.0, 1000.0, 1e4])
    a, b, c = 2e-11, 3e-13, 1e-15
    adev = np.sqrt(a**2 / taus + b**2 + c**2 * taus)
    np.testing.assert_allclose(fit_power_law_adev(taus, adev), (a, b, c), rtol=1e-6)


# Documented fit quality: the commercial table has a bump at 10 s that a power-law sum
# cannot follow (best non-negative fit is 12 % below the limit there).
@pytest.mark.parametrize(("grade", "rtol"), [("industrial", 0.05), ("commercial", 0.13)])
def test_sa65_fit_reproduces_datasheet_table(grade, rtol):
    table = {"industrial": P.SA65_ADEV_INDUSTRIAL, "commercial": P.SA65_ADEV_COMMERCIAL}[grade]
    s = sa65(grade, include_aging=False)
    taus = np.array(sorted(table))
    np.testing.assert_allclose(s.model.adev(taus), [table[t].value for t in taus], rtol=rtol)
    assert s.valid_tau_range == (taus.min(), taus.max())


def test_sa65_aging_conversion():
    s = sa65()
    assert s.model.drift_per_s == pytest.approx(9e-10 / (30 * 86400))
    assert s.parameters["drift_per_s"].provenance is Provenance.ASSUMPTION


@pytest.mark.parametrize("variant", list(NEXTGEN_VARIANTS))
@pytest.mark.parametrize("aging", [True, False])
def test_nextgen_meets_hypothetical_target_at_1s(variant, aging):
    s = nextgen_csac(variant, include_sa65_aging=aging)
    assert s.model.adev(1.0) <= P.NEXTGEN_ADEV_1S_TARGET.value
    assert s.category is Provenance.HYPOTHETICAL_TARGET
    assert P.NEXTGEN_ADEV_1S_TARGET.provenance is Provenance.HYPOTHETICAL_TARGET
    assert s.valid_tau_range == (1.0, 1.0)  # only tau = 1 s is constrained


def test_nextgen_simulated_adev_at_1s_respects_target():
    # Simulated check at tau = 1 s (tau0 = 0.125 s, m = 8) for each variant.
    for variant in NEXTGEN_VARIANTS:
        model = nextgen_csac(variant).model
        sim = ensemble_adev(model, np.array([8]), tau0=0.125, n=2**14)[0]
        assert sim == pytest.approx(float(model.adev(1.0)), rel=0.05)


def test_ocxo_is_fully_labelled_as_assumption():
    s = ocxo()
    assert s.category is Provenance.ASSUMPTION
    assert all(q.provenance is Provenance.ASSUMPTION for q in s.parameters.values())


def test_every_scenario_parameter_has_provenance_and_source():
    for s in all_scenarios():
        assert set(s.parameters) == {"white_fm_a", "flicker_fm_b", "random_walk_fm_c", "drift_per_s"}
        for name, q in s.parameters.items():
            assert isinstance(q, Quantity)
            assert q.provenance is not Provenance.SIMULATED
            assert q.value == pytest.approx(getattr(s.model, name))


def test_sourced_parameters_cite_a_document():
    sourced = [
        *P.SA65_ADEV_INDUSTRIAL.values(), *P.SA65_ADEV_COMMERCIAL.values(),
        *P.SA65_SSB_PHASE_NOISE_DBC_HZ.values(), P.SA65_AGING_MONTHLY,
    ]
    assert all(q.provenance is Provenance.SOURCED and "DS00003478F" in q.source for q in sourced)


def test_quantity_requires_source():
    with pytest.raises(ValueError):
        Quantity(1.0, "-", Provenance.ASSUMPTION, " ")
