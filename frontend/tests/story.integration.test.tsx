/**
 * Satellite MVP presentation layer: product concept labelling, satellite-only framing, buyer-value
 * chain built from live Phase 3 results, guardrails against invented commercial claims.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { before, describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import Home from "../src/app/page";
import { COMPONENTS, CustomerSection, ProductSection, RoadmapSection, ValidationSection, VisionSection, WhyUsSection } from "../src/components/product/ProductSections";
import SatelliteIntegration from "../src/components/product/SatelliteIntegration";
import TimingBoxVisual from "../src/components/product/TimingBoxVisual";
import { CHAIN_STEPS, ValueChainContent, buildValueChain } from "../src/components/product/ValueChain";
import GuidedDemo, { DEMO_PRESETS, DEMO_STEPS } from "../src/components/story/GuidedDemo";
import { KeyInsightContent } from "../src/components/story/KeyInsightPanel";
import ModelScope from "../src/components/story/ModelScope";
import ResearchContext, { RESEARCH_SOURCES } from "../src/components/story/ResearchContext";
import { api, API_BASE_URL, sensitivityApi, type NetworkConfig, type RequirementsResponse } from "../src/lib/api";
import { defaultConfigFrom } from "../src/lib/defaultInsight";
import { formatDb, formatSci, validSyncIntervals } from "../src/lib/format";
import { DEMO_TARGETS, deriveKeyInsight } from "../src/lib/insight";

const commercial = () => renderToStaticMarkup(<><WhyUsSection /><ProductSection /><CustomerSection /><ValidationSection /><RoadmapSection /><VisionSection /></>);

describe("satellite MVP landing page", () => {
  it("shows the headline, subheadline and presentation order (Why us → How → What)", () => {
    const html = renderToStaticMarkup(<Home />);
    assert.match(html, /One Constellation\./);
    assert.match(html, /One Coherent Radar\./);
    assert.match(html, /The Precision Timing Backbone for Distributed Satellite Radar\./);
    const order = ["Part 1 · Why us", "Part 2 · How", "Part 3 · What"].map((s) => html.indexOf(s));
    assert.ok(order.every((i) => i > 0) && order[0] < order[1] && order[1] < order[2], `order ${order}`);
    assert.match(html, /Hardware not yet built/);
    assert.match(html, /The RadarSync Timing Box is a proposed product concept; the hardware has not been built/);
  });

  it("is satellite-only (drones appear only as labelled adjacent research)", () => {
    const html = renderToStaticMarkup(<Home />);
    const withoutResearch = html.replace(/<section id="research"[\s\S]*?<\/section>/, "");
    assert.doesNotMatch(withoutResearch, /\bUAV|drone/i);
    assert.match(html, /adjacent platform/);
  });

  it("labels the product and integration graphics as conceptual and unbuilt", () => {
    for (const html of [renderToStaticMarkup(<TimingBoxVisual />), renderToStaticMarkup(<SatelliteIntegration />)]) {
      assert.match(html, /role="img"/);
      assert.match(html, /Conceptual|conceptual/);
    }
    assert.match(renderToStaticMarkup(<SatelliteIntegration />), /Not an orbit simulation, not measured data and not a radar image/);
    assert.match(renderToStaticMarkup(<ProductSection />), /The hardware has not been built;/);
    assert.deepEqual(COMPONENTS.map((c) => c.t), ["Atomic clock core", "Reference signal generation", "Environmental stabilisation", "Calibration &amp; sync software".replace("&amp;", "&")]);
    assert.ok(COMPONENTS.every((c) => c.tag === "proposed"));
  });

  it("never claims customers, purchase intent, partnerships, market sizes, revenues or savings", () => {
    const html = commercial();
    assert.match(html, /hypotheses to investigate/);
    assert.match(html, /no interviews, purchase intent, partnerships or market sizes are claimed/);
    assert.match(html, /growth hypothesis, not a proven market size/);
    assert.doesNotMatch(html, /[$€£]\s?\d|\b\d+\s?(bn|billion|million)\b|letter of intent|\bsigned\b|pilot customer|our customers|saves? \d|% (cost|savings)/i);
    assert.doesNotMatch(html, /\b(TAM|SAM|SOM|LOI)\b/); // market-size / intent acronyms (case-sensitive, whole words)
  });

  it("states what is unproven and never promises indefinite link-free coherence", () => {
    const html = commercial() + renderToStaticMarkup(<ModelScope />);
    for (const k of ["not built", "not rated for space", "Orbital dynamics", "hypothetical challenge technology", "interviews still to be done"]) assert.ok(html.includes(k), k);
    assert.match(html, /Indefinite, link-free phase coherence \(never claimed\)/);
  });

  it("guided demo steps target rendered panels; presets satisfy backend rules", () => {
    const dashboard = readFileSync(new URL("../src/components/Dashboard.tsx", import.meta.url), "utf8")
      + readFileSync(new URL("../src/components/Phase3Section.tsx", import.meta.url), "utf8");
    for (const id of Object.values(DEMO_TARGETS)) assert.ok(dashboard.includes(`id="${id}"`), `missing anchor ${id}`);
    assert.equal(DEMO_STEPS.length, 5);
    for (const p of DEMO_PRESETS) assert.deepEqual(validSyncIntervals(p.patch.observation_s!, 0.1, [p.patch.sync_interval_s!]), [p.patch.sync_interval_s]);
    const html = renderToStaticMarkup(<GuidedDemo onPreset={() => {}} activePreset="holdover" running={false} />);
    assert.equal((html.match(/aria-pressed="true"/g) ?? []).length, 1);
  });

  it("adjacent research keeps the four cited sources and the independence disclaimer", () => {
    assert.equal(RESEARCH_SOURCES.length, 4);
    const html = renderToStaticMarkup(<ResearchContext />);
    assert.match(html, /not affiliated/);
    assert.match(html, /only one approach/);
  });
});

let reachable = false;
let insight: RequirementsResponse;
let config: NetworkConfig;

describe("value chain and key insight use live Phase 3 results", () => {
  before(async () => {
    try {
      reachable = (await fetch(`${API_BASE_URL}/health`)).ok;
    } catch {
      reachable = false;
    }
    if (!reachable) return;
    const [params, scenarios] = await Promise.all([api.parameters(), api.scenarios()]);
    config = defaultConfigFrom(params);
    insight = await sensitivityApi.requirement({ base_scenario_keys: scenarios.scenarios.map((s) => s.key), config, metric: "spatial", target_loss_db: 1 });
  });

  it("every value-chain row has six labelled steps with simulated numbers from the API", (t) => {
    if (!reachable) return t.skip(`backend not reachable at ${API_BASE_URL}`);
    const rows = buildValueChain(insight);
    const ins = deriveKeyInsight(insight);
    assert.ok(rows.length >= 3);
    for (const r of rows) {
      assert.equal(r.cells.length, CHAIN_STEPS.length);
      assert.equal(r.cells[CHAIN_STEPS.length - 1].kind, "gap", `${r.title}: last step must be a validation gap`);
      assert.ok(r.cells.some((c) => c.kind === "simulated"));
    }
    const html = renderToStaticMarkup(<ValueChainContent data={insight} />);
    assert.ok(html.includes(formatSci(ins.requirementRange![0])));
    assert.ok(html.includes(formatDb(ins.sa65AtSpecDb!)));
    assert.ok(html.includes(formatDb(ins.floorDb)));
    assert.match(html, /never indefinite, link-free coherence/);
    assert.doesNotMatch(html, /NaN|undefined/);
  });

  it("key insight shows the same live numbers, labelled simulated, with satellite assumptions", (t) => {
    if (!reachable) return t.skip(`backend not reachable at ${API_BASE_URL}`);
    const ins = deriveKeyInsight(insight);
    const html = renderToStaticMarkup(<KeyInsightContent data={insight} config={config} />);
    assert.ok(html.includes(`σy(1 s) ≤ ${formatSci(ins.requirementRange![0])}`));
    assert.match(html, /SIMULATED/);
    assert.match(html, /satellite radar nodes/);
    assert.match(html, /Orbital dynamics, the inter-satellite link and SAR imaging are not simulated/);
  });
});
