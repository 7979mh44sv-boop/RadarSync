"""Phase 3 API: options, sweeps, clock requirements, validation and limits."""

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.schemas import SENSITIVITY_MAX_WORK_UNITS

client = TestClient(app)
SMALL = {"observation_s": 2.0, "sample_interval_s": 1e-2, "cpi_s": 0.1, "sync_interval_s": 1.0, "n_monte_carlo": 4}


def post(path, body):
    return client.post(f"/api/v1/sensitivity/{path}", json=body)


def test_options():
    body = client.get("/api/v1/sensitivity/options").json()
    names = {p["name"] for p in body["parameters"]}
    assert {"carrier_frequency_hz", "n_nodes", "sync_interval_s", "sync_mode", "clock_scale"} <= names
    assert body["limits"]["max_work_units"] == SENSITIVITY_MAX_WORK_UNITS
    assert "not a validated confidence interval" in body["uncertainty_note"]


def test_sweep_returns_simulated_losses_with_uncertainty_and_ceilings():
    r = post("sweep", {"scenario_keys": ["ocxo"], "config": SMALL, "parameter": "carrier_frequency_hz",
                       "values": [1e9, 10e9, 35e9]})
    assert r.status_code == 200, r.text
    body = r.json()
    pts = body["series"][0]["points"]
    losses = [p["spatial"]["total"]["loss_db"] for p in pts]
    assert losses == sorted(losses)  # phase error grows with carrier frequency
    assert all(p["spatial"]["total"]["provenance"] == "simulated" for p in pts)
    lo, hi = pts[1]["spatial"]["total"]["band_db"]
    assert lo <= pts[1]["spatial"]["total"]["loss_db"] <= hi
    assert len(body["loss_ceiling_spatial_db"]) == 3
    assert post("sweep", {"scenario_keys": ["ocxo"], "config": SMALL, "parameter": "carrier_frequency_hz",
                          "values": [1e9, 10e9, 35e9]}).json() == body  # deterministic


def test_clock_scale_sweep_reports_monotonic_check():
    body = post("sweep", {"scenario_keys": ["sa65_industrial"], "config": SMALL, "parameter": "clock_scale",
                          "values": [1e-4, 1e-2, 1.0]}).json()
    assert "non-decreasing" in body["series"][0]["monotonic_check"]


def test_sync_mode_sweep():
    body = post("sweep", {"scenario_keys": ["ocxo"], "config": SMALL, "parameter": "sync_mode",
                          "values": ["none", "time", "time_frequency"]}).json()
    assert body["series"][0]["values"] == ["none", "time", "time_frequency"]


def test_requirement_endpoint_statuses_and_metadata():
    body = post("clock-requirement", {"base_scenario_keys": ["sa65_industrial", "ocxo"], "config": SMALL,
                                      "metric": "spatial", "target_loss_db": 1.0}).json()
    by = {r["base_scenario_key"]: r for r in body["results"]}
    sa = by["sa65_industrial"]
    assert sa["status"] == "determined"
    assert 1e-12 < sa["required_adev_1s"] < 1e-10
    assert any("tau = 1 s" in k for k in sa["required_adev_at_tau"])
    assert any("not a verified device capability" in w for w in sa["warnings"])
    assert any("19.7 dB" in w and "does not bound" in w for w in sa["warnings"])
    assert any("illustrative" in w for w in by["ocxo"]["warnings"])
    refs = {r["provenance"] for r in body["references"]}
    assert refs == {"sourced", "hypothetical_target"}
    assert "not a validated confidence interval" in body["uncertainty_note"]
    # The base SA65 clock itself (scale 1) is reported for context, simulated.
    assert sa["base_clock_at_scale_1"]["spatial"]["total"]["loss_db"] > 1.0


def test_requirement_infeasible_floor_is_reported_not_fabricated():
    body = post("clock-requirement", {"base_scenario_keys": ["nextgen_white_fm"], "config": SMALL,
                                      "metric": "spatial", "target_loss_db": 0.001}).json()
    r = body["results"][0]
    assert r["status"] == "infeasible_non_clock_floor"
    assert r["required_adev_1s"] is None and r["required_adev_at_tau"] is None
    assert any("hypothetical" in w for w in r["warnings"])


@pytest.mark.parametrize(("path", "body"), [
    ("sweep", {"scenario_keys": ["ocxo"], "parameter": "n_nodes", "values": [2]}),
    ("sweep", {"scenario_keys": ["ocxo"], "parameter": "n_nodes", "values": [2, 2]}),
    ("sweep", {"scenario_keys": ["ocxo"], "parameter": "n_nodes", "values": [2, 40]}),
    ("sweep", {"scenario_keys": ["ocxo"], "parameter": "n_nodes", "values": [2, 2.5]}),
    ("sweep", {"scenario_keys": ["ocxo"], "parameter": "carrier_frequency_hz", "values": [1e9, 1e13]}),
    ("sweep", {"scenario_keys": ["ocxo"], "parameter": "sync_interval_s", "values": [1.0, 0.35]}),
    ("sweep", {"scenario_keys": ["ocxo"], "parameter": "sync_mode", "values": ["time", "gps"]}),
    ("sweep", {"scenario_keys": ["ocxo"], "parameter": "volume", "values": [1, 2]}),
    ("sweep", {"scenario_keys": ["ocxo"], "parameter": "n_nodes", "values": list(range(2, 16))}),
    ("clock-requirement", {"base_scenario_keys": ["ocxo"], "target_loss_db": 0}),
    ("clock-requirement", {"base_scenario_keys": ["ocxo"], "target_loss_db": 6.5}),  # >= spatial ceiling (4 nodes)
    ("clock-requirement", {"base_scenario_keys": ["ocxo"], "adev_1s_min": 1e-9, "adev_1s_max": 1e-10}),
    ("clock-requirement", {"base_scenario_keys": ["ocxo", "ocxo"]}),
    ("clock-requirement", {"base_scenario_keys": ["ocxo"], "n_grid": 100}),
    ("clock-requirement", {"base_scenario_keys": ["ocxo"], "metric": "volume"}),
])
def test_invalid_requests_return_422(path, body):
    r = post(path, body)
    assert r.status_code == 422, r.text
    assert r.json()["detail"]


def test_computation_budget_enforced():
    big = {"n_nodes": 16, "observation_s": 100.0, "sample_interval_s": 1e-3, "sync_interval_s": 10.0, "n_monte_carlo": 2}
    r = post("clock-requirement", {"base_scenario_keys": ["ocxo", "sa65_industrial"], "config": big})
    assert r.status_code == 422 and "exceeds the limit" in r.text
    r = post("sweep", {"scenario_keys": ["ocxo"], "config": {"n_monte_carlo": 32, "n_nodes": 16, "observation_s": 100.0,
                                                             "sync_interval_s": 10.0},
                       "parameter": "carrier_frequency_hz", "values": [1e9, 2e9]})
    assert r.status_code == 422 and ("exceeds the limit" in r.text or "memory limit" in r.text)


def test_unknown_scenario_is_404():
    assert post("clock-requirement", {"base_scenario_keys": ["nope"], "config": SMALL}).status_code == 404
    assert post("sweep", {"scenario_keys": ["nope"], "config": SMALL, "parameter": "n_nodes", "values": [2, 3]}).status_code == 404
