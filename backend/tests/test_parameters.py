from app.simulation.parameters import CHALLENGE_CLOCK_ADEV_1S, Provenance


def test_challenge_adev_is_sourced_and_correct():
    assert CHALLENGE_CLOCK_ADEV_1S.provenance is Provenance.SOURCED
    assert CHALLENGE_CLOCK_ADEV_1S.value == 1e-15
