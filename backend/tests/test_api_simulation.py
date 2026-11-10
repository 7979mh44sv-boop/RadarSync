"""API tests: contract, provenance, determinism, reuse of the validated package, and input validation."""

import numpy as np
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.schemas import MAX_WORK_UNITS
from radarsync_sim.consistency import check_against_sa65_phase_noise
from radarsync_sim.network import simulate_network
from radarsync_sim.radar import compare_scenarios, run_seeds
from radarsync_sim.scenarios import all_scenarios, sa65

client = TestClient(app)
SCENARIOS = {s.key: s for s in all_scenarios()}
SMALL = {"observation_s": 2.0, "sample_interval_s": 1e-2, "cpi_s": 0.1, "sync_interval_s": 1.0, "n_monte_carlo": 4}


def post(path, body):
    return client.post(f"/api/v1/{path}", json=body)


# --- scenarios / parameters / limitations ---------------------------------

def test_scenarios_carry_provenance():
    body = client.get("/api/v1/scenarios").json()
    by_key = {s["key"]: s for s in body["scenarios"]}
    assert set(by_key) == set(SCENARIOS)
    assert by_key["ocxo"]["category"] == "assumption"
    assert by_key["sa65_industrial"]["category"] == "sourced"
    assert by_key["sa65_industrial"]["valid_tau_range_s"] == [1.0, 1000.0]
    for key in ("nextgen_white_fm", "nextgen_flicker_floor"):
        assert by_key[key]["category"] == "hypothetical_target"
        assert by_key[key]["adev_at_1s"]["value"] <= 1e-15
    assert all(p["provenance"] == "assumption" for p in by_key["ocxo"]["parameters"].values())
    assert all(pt["provenance"] == "sourced" and "DS00003478F" in pt["source"] for pt in body["sa65_datasheet_adev"])
    assert body["nextgen_target"]["provenance"] == "hypothetical_target"


def test_parameters_expose_ranges_and_limits():
    body = client.get("/api/v1/parameters").json()
    specs = {p["name"]: p for p in body["parameters"]}
    assert specs["n_nodes"]["minimum"] == 2 and specs["n_nodes"]["maximum"] == 16
    assert specs["carrier_frequency_hz"]["default"] == 10e9
    assert specs["sync_mode"]["options"] == ["none", "time", "time_frequency"]
    assert all(p["provenance"] == "assumption" for p in body["parameters"])
    assert body["limits"]["max_work_units"] == MAX_WORK_UNITS


def test_limitations_report_phase_noise_mismatch_without_claiming_a_bound():
    body = client.get("/api/v1/limitations").json()
    expected = max(-c.margin_db for c in check_against_sa65_phase_noise(sa65().model))
    assert body["max_model_excess_db"] == pytest.approx(expected)
    assert round(body["max_model_excess_db"], 1) == 19.7
    text = " ".join(body["statements"])
    assert "does not establish an upper (or lower) bound" in text
    assert "100 Hz to 10 kHz" in text and "1 Hz to 10 Hz" in text
    assert "not a sourced" in text or "does not represent a sourced" in text


# --- Allan deviation --------------------------------------------------------

def test_adev_model_curve_reuses_package_and_flags_constrained_range():
    body = post("clock/adev", {"scenario_keys": ["sa65_industrial", "nextgen_white_fm"], "include_simulated": False}).json()
    sa, ng = body["curves"]
    tau = np.array(sa["tau_s"])
    np.testing.assert_allclose(sa["model_adev"], SCENARIOS["sa65_industrial"].model.adev(tau), rtol=1e-12)
    constrained = tau[np.array(sa["constrained"])]
    assert constrained.min() == pytest.approx(1.0) and constrained.max() == pytest.approx(1000.0)
    assert np.array(ng["tau_s"])[np.array(ng["constrained"])].tolist() == [1.0]
    assert sa["model_provenance"] == "assumption" and sa["simulated_adev"] is None


def test_adev_simulated_estimate_is_deterministic_and_labelled():
    req = {"scenario_keys": ["ocxo"], "simulated_samples": 4096, "seed": 7}
    a, b = post("clock/adev", req).json(), post("clock/adev", req).json()
    assert a == b
    assert a["curves"][0]["simulated_provenance"] == "simulated"
    assert len(a["curves"][0]["simulated_adev"]) == len(a["curves"][0]["simulated_tau_s"]) > 5


# --- timing series ------------------------------------------------------------

def test_timing_series_matches_direct_simulation():
    body = post("network/timing", {"scenario_key": "ocxo", "config": SMALL, "node_pair": [0, 2], "max_points": 50}).json()
    from app.schemas import NetworkConfigIn
    from app.services.simulation import build_config

    cfg = build_config(NetworkConfigIn(**SMALL))
    real = simulate_network(SCENARIOS["ocxo"].model, cfg, run_seeds(cfg)[0])
    step = body["decimation"]
    assert step == 4 and len(body["t_s"]) <= 50
    np.testing.assert_allclose(body["total_s"], (real.total[0] - real.total[2])[::step], rtol=1e-12, atol=1e-30)
    np.testing.assert_allclose(body["clock_s"], (real.clock[0] - real.clock[2])[::step], rtol=1e-12, atol=1e-30)
    full_rms = np.sqrt(np.mean((real.total[0] - real.total[2]) ** 2))
    assert body["rms_s"]["total"]["value"] == pytest.approx(full_rms)
    assert body["provenance"] == "simulated" and body["rms_s"]["total"]["provenance"] == "simulated"
    assert body["sync_epochs_s"] == [0.0, 1.0]


# --- coherence ------------------------------------------------------------

def test_coherence_matches_package_and_reports_ceilings():
    keys = ["sa65_industrial", "nextgen_white_fm"]
    body = post("radar/coherence", {"scenario_keys": keys, "config": SMALL}).json()
    from app.schemas import NetworkConfigIn
    from app.services.simulation import build_config

    direct = compare_scenarios([SCENARIOS[k] for k in keys], build_config(NetworkConfigIn(**SMALL)))
    for out, ref in zip(body["results"], direct):
        for name, q in ref.metrics.items():
            assert out["metrics"][name]["value"] == pytest.approx(q.value, rel=1e-12, abs=1e-15)
            assert out["metrics"][name]["provenance"] == "simulated"
    assert body["loss_ceiling_temporal_db"] == pytest.approx(10.0)  # 10 log10(10 samples per CPI)
    assert body["loss_ceiling_spatial_db"] == pytest.approx(10 * np.log10(4))
    assert body["confidence_intervals"] == "not computed"
    assert all(q["provenance"] == "assumption" for q in body["config_parameters"].values())


def test_coherence_is_deterministic():
    req = {"scenario_keys": ["ocxo"], "config": SMALL}
    assert post("radar/coherence", req).json() == post("radar/coherence", req).json()


# --- validation ---------------------------------------------------------------

@pytest.mark.parametrize(("path", "body"), [
    ("radar/coherence", {"scenario_keys": ["ocxo"], "config": {"n_nodes": 1}}),
    ("radar/coherence", {"scenario_keys": ["ocxo"], "config": {"n_nodes": 17}}),
    ("radar/coherence", {"scenario_keys": ["ocxo"], "config": {"carrier_frequency_hz": 5e11}}),
    ("radar/coherence", {"scenario_keys": ["ocxo"], "config": {"cpi_s": 0.15}}),
    ("radar/coherence", {"scenario_keys": ["ocxo"], "config": {"sync_interval_s": 0.35}}),
    ("radar/coherence", {"scenario_keys": ["ocxo"], "config": {"observation_s": 100.0, "sample_interval_s": 1e-4}}),
    ("radar/coherence", {"scenario_keys": ["ocxo"], "config": {"seed": -1}}),
    ("radar/coherence", {"scenario_keys": ["ocxo"], "config": {"n_monte_carlo": 33}}),
    ("radar/coherence", {"scenario_keys": ["ocxo", "ocxo"]}),
    ("radar/coherence", {"scenario_keys": []}),
    ("radar/coherence", {"scenario_keys": ["ocxo"], "unexpected": 1}),
    ("network/timing", {"scenario_key": "ocxo", "node_pair": [0, 4]}),
    ("network/timing", {"scenario_key": "ocxo", "node_pair": [1, 1]}),
    ("network/timing", {"scenario_key": "ocxo", "max_points": 10**6}),
    ("clock/adev", {"scenario_keys": ["ocxo"], "tau_min_s": 10.0, "tau_max_s": 1.0}),
    ("clock/adev", {"scenario_keys": ["ocxo"], "simulated_samples": 2**20}),
])
def test_invalid_requests_are_rejected_with_422(path, body):
    r = post(path, body)
    assert r.status_code == 422, r.text
    assert r.json()["detail"]


def test_computation_budget_is_enforced_with_clear_message():
    big = {"n_nodes": 16, "observation_s": 100.0, "sample_interval_s": 1e-3, "sync_interval_s": 10.0, "n_monte_carlo": 32}
    r = post("radar/coherence", {"scenario_keys": list(SCENARIOS), "config": big})
    assert r.status_code == 422 and "exceeds the limit" in r.text


def test_config_rule_errors_are_readable():
    r = post("radar/coherence", {"scenario_keys": ["ocxo"], "config": {"cpi_s": 0.15}})
    assert "observation must be an integer number of CPIs" in r.json()["detail"][0]["msg"]


@pytest.mark.parametrize("path", ["radar/coherence", "clock/adev"])
def test_unknown_scenario_is_404(path):
    r = post(path, {"scenario_keys": ["does_not_exist"]})
    assert r.status_code == 404 and "available" in r.json()["detail"]


def test_unknown_scenario_timing_is_404():
    assert post("network/timing", {"scenario_key": "nope", "config": SMALL}).status_code == 404


def test_health_reports_simulation_version():
    from radarsync_sim import __version__

    assert client.get("/health").json()["simulation_version"] == __version__
