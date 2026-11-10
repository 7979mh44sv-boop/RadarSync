/**
 * Phase 3 integration check: fetch REAL requirement and sweep results from the running backend
 * and render the panels server-side (no browser). Skipped with a message if the backend is down.
 */
import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import RequirementPanel, { buildRequirementChart } from "../src/components/panels/RequirementPanel";
import SweepPanel from "../src/components/panels/SweepPanel";
import { API_BASE_URL, sensitivityApi, type NetworkConfig, type RequirementsResponse, type SweepResponse } from "../src/lib/api";
import { formatSci } from "../src/lib/format";

let reachable = false;
const SKIP_MSG = `backend not reachable at ${API_BASE_URL}; start it to run this integration check`;
const CONFIG: NetworkConfig = {
  carrier_frequency_hz: 10e9, n_nodes: 4, observation_s: 2, sample_interval_s: 1e-2, cpi_s: 0.1, sync_mode: "time",
  sync_interval_s: 1, sync_error_rms_s: 1e-12, clock_correlation: 0,
  non_clock: { calibration_rms_s: 1e-12, distribution_jitter_rms_s: 0.5e-12, propagation_random_walk_s_per_sqrt_s: 0.1e-12, environmental_ramp_rms_per_s: 0 },
  n_monte_carlo: 6, seed: 20261110,
};
let req: RequirementsResponse, infeasible: RequirementsResponse, sweep: SweepResponse, sweepAgain: SweepResponse;

describe("Phase 3 panels render live backend results", () => {
  before(async () => {
    try {
      reachable = (await fetch(`${API_BASE_URL}/health`)).ok;
    } catch {
      reachable = false;
    }
    if (!reachable) return;
    const keys = ["sa65_industrial", "ocxo", "nextgen_white_fm", "nextgen_flicker_floor"];
    [req, infeasible, sweep, sweepAgain] = await Promise.all([
      sensitivityApi.requirement({ base_scenario_keys: keys, config: CONFIG, metric: "spatial", target_loss_db: 1 }),
      sensitivityApi.requirement({ base_scenario_keys: ["ocxo"], config: CONFIG, metric: "spatial", target_loss_db: 0.001 }),
      sensitivityApi.sweep({ scenario_keys: keys, config: CONFIG, parameter: "carrier_frequency_hz", values: [1e9, 10e9, 35e9] }),
      sensitivityApi.sweep({ scenario_keys: keys, config: CONFIG, parameter: "carrier_frequency_hz", values: [1e9, 10e9, 35e9] }),
    ]);
  });

  it("requirement chart is built from API curves with sourced and hypothetical references kept apart", (t) => {
    if (!reachable) return t.skip(SKIP_MSG);
    const chart = buildRequirementChart(req);
    assert.equal(chart.lines.length, req.results.length);
    assert.deepEqual(chart.lines[0].x, req.results[0].curve.map((p) => p.adev_1s));
    assert.ok(chart.xRefs.some((r) => r.label.includes("SOURCED")));
    assert.ok(chart.xRefs.some((r) => r.label.includes("HYPOTHETICAL")));
    assert.ok(chart.hLines.some((h) => h.label.startsWith("Target")));
    assert.ok(chart.hLines.some((h) => h.label.includes("Non-clock floor")));
  });

  it("requirement panel shows statuses, modelled values and integrity statements", (t) => {
    if (!reachable) return t.skip(SKIP_MSG);
    const html = renderToStaticMarkup(<RequirementPanel data={req} width={900} />);
    const sa = req.results.find((r) => r.base_scenario_key === "sa65_industrial")!;
    assert.equal(sa.status, "determined");
    assert.ok(html.includes(`σy(1 s) ≤ ${formatSci(sa.required_adev_1s!)}`));
    assert.match(html, /Requirement determined/);
    assert.match(html, /not a validated confidence interval/);
    assert.match(html, /not a verified device capability/);
    assert.match(html, /σy\(1 s\) of the scaled clock model \[dimensionless\]/);
    assert.match(html, /Clock share of variance \[%\]/);
    assert.doesNotMatch(html, /NaN/);
  });

  it("infeasible targets are reported, not fabricated", (t) => {
    if (!reachable) return t.skip(SKIP_MSG);
    assert.equal(infeasible.results[0].status, "infeasible_non_clock_floor");
    assert.equal(infeasible.results[0].required_adev_1s, null);
    const html = renderToStaticMarkup(<RequirementPanel data={infeasible} width={900} />);
    assert.match(html, /Infeasible: non-clock floor/);
    assert.match(html, /No requirement can be stated/);
    assert.doesNotMatch(html, /Modelled requirement<\/div>/);
  });

  it("sweep panel renders deterministic simulated losses with units", (t) => {
    if (!reachable) return t.skip(SKIP_MSG);
    assert.deepEqual(sweep, sweepAgain);
    const html = renderToStaticMarkup(<SweepPanel data={sweep} metric="spatial" width={900} />);
    assert.match(html, /Carrier frequency \[GHz\]/);
    assert.match(html, /Spatial loss, total \[dB\]/);
    assert.match(html, /Non-clock only/);
    assert.match(html, /approximate Monte Carlo band/);
    assert.ok(html.includes("35 GHz"));
    assert.doesNotMatch(html, /NaN/);
  });
});
