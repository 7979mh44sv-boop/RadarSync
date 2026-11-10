/**
 * Integration check: fetch REAL results from the running FastAPI backend and render the
 * dashboard's chart/panel components with them (server-side, no browser). Verifies that
 * the components consume backend output (not hardcoded curves) and render scientific
 * labels, units and provenance. Skipped, with a message, when the backend is not running.
 */
import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import ClockStabilityPanel, { buildAdevChart } from "../src/components/panels/ClockStabilityPanel";
import CoherencePanel from "../src/components/panels/CoherencePanel";
import ProvenancePanel from "../src/components/panels/ProvenancePanel";
import TimingErrorPanel from "../src/components/panels/TimingErrorPanel";
import { api, API_BASE_URL, type AdevResponse, type CoherenceResponse, type LimitationsResponse, type NetworkConfig, type ParametersResponse, type ScenarioList, type TimingSeries } from "../src/lib/api";
import { formatDb, formatSeconds } from "../src/lib/format";

let reachable = false;
const SKIP_MSG = `backend not reachable at ${API_BASE_URL}; start it to run this integration check`;

const W = 900;
let scenarios: ScenarioList, params: ParametersResponse, limitations: LimitationsResponse;
let adev: AdevResponse, timing: TimingSeries, coherence: CoherenceResponse;

describe("dashboard renders live backend results", () => {
  before(async () => {
    try {
      reachable = (await fetch(`${API_BASE_URL}/health`)).ok;
    } catch {
      reachable = false;
    }
    if (!reachable) return;
    [scenarios, params, limitations] = await Promise.all([api.scenarios(), api.parameters(), api.limitations()]);
    const keys = scenarios.scenarios.map((s) => s.key);
    const d = (n: string) => params.parameters.find((p) => p.name === n)!.default as number;
    const config: NetworkConfig = {
      carrier_frequency_hz: d("carrier_frequency_hz"), n_nodes: d("n_nodes"), observation_s: d("observation_s"),
      sample_interval_s: d("sample_interval_s"), cpi_s: d("cpi_s"), sync_mode: "time", sync_interval_s: d("sync_interval_s"),
      sync_error_rms_s: d("sync_error_rms_s"), clock_correlation: 0,
      non_clock: {
        calibration_rms_s: d("calibration_rms_s"), distribution_jitter_rms_s: d("distribution_jitter_rms_s"),
        propagation_random_walk_s_per_sqrt_s: d("propagation_random_walk_s_per_sqrt_s"), environmental_ramp_rms_per_s: 0,
      },
      n_monte_carlo: 4, seed: d("seed"),
    };
    [adev, timing, coherence] = await Promise.all([
      api.adev({ scenario_keys: keys }),
      api.timing({ scenario_key: "sa65_industrial", config, node_pair: [0, 1], max_points: 500 }),
      api.coherence({ scenario_keys: keys, config }),
    ]);
  });

  it("ADEV chart is built from API curves, datasheet points and target", (t) => {
    if (!reachable) return t.skip(SKIP_MSG);
    const { lines, points } = buildAdevChart(adev, scenarios);
    assert.equal(lines.length, adev.curves.length);
    assert.deepEqual(lines[0].y, adev.curves[0].model_adev);
    assert.ok(points.some((p) => p.id === "sa65-datasheet" && p.y.length === scenarios.sa65_datasheet_adev.length));
    assert.ok(points.some((p) => p.id === "nextgen-target" && p.y[0] === scenarios.nextgen_target.adev));
    const html = renderToStaticMarkup(<ClockStabilityPanel adev={adev} scenarios={scenarios} width={W} />);
    assert.match(html, /<svg[^>]*role="img"/);
    assert.match(html, /Averaging time τ \[s\]/);
    assert.match(html, /Allan deviation σy\(τ\) \[dimensionless\]/);
    assert.match(html, /HYPOTHETICAL TARGET/);
    assert.match(html, /not a sourced commercial product/);
    const segments = (html.match(/<line /g) ?? []).length;
    assert.ok(segments > 100, `expected many curve segments, got ${segments}`);
    assert.doesNotMatch(html, /NaN/);
  });

  it("timing panel shows API rms values with time units", (t) => {
    if (!reachable) return t.skip(SKIP_MSG);
    const html = renderToStaticMarkup(<TimingErrorPanel data={timing} width={W} />);
    assert.ok(html.includes(formatSeconds(timing.rms_s.total.value)));
    assert.ok(html.includes(formatSeconds(timing.rms_s.clock.value)));
    assert.match(html, /node 0 − node 1 \[(fs|ps|ns|µs)\]/);
    assert.match(html, /Clock-induced/);
    assert.match(html, /Non-clock/);
    assert.doesNotMatch(html, /NaN/);
  });

  it("coherence panel renders simulated losses and states that CIs are not computed", (t) => {
    if (!reachable) return t.skip(SKIP_MSG);
    const html = renderToStaticMarkup(<CoherencePanel data={coherence} width={W} />);
    for (const r of coherence.results) {
      assert.ok(html.includes(formatDb(r.metrics.total_spatial_loss.value)), `missing ${r.scenario_key} spatial loss`);
    }
    assert.match(html, /Confidence intervals are not computed/);
    assert.match(html, /Coherent integration loss \[dB\]/);
    assert.match(html, /SIMULATED/);
    assert.doesNotMatch(html, /NaN/);
  });

  it("provenance panel shows all four labels and the API phase-noise mismatch without a bound claim", (t) => {
    if (!reachable) return t.skip(SKIP_MSG);
    const html = renderToStaticMarkup(<ProvenancePanel scenarios={scenarios} limitations={limitations} />);
    for (const label of ["SOURCED", "ASSUMPTION", "HYPOTHETICAL TARGET", "SIMULATED"]) assert.ok(html.includes(label), label);
    assert.ok(html.includes(`Maximum excess: ${limitations.max_model_excess_db.toFixed(1)} dB`));
    assert.match(html, /does not bound actual radar coherence loss/);
    assert.doesNotMatch(html, /upper bound on (actual )?radar/i);
  });
});
