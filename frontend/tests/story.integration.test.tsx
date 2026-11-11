/**
 * Satellite MVP presentation layer: product concept labelling, satellite-only framing, buyer-value
 * chain built from live Phase 3 results, guardrails against invented commercial claims.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { before, describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import Home from "../src/app/page";
import MarketPage from "../src/app/market/page";
import ProductPage from "../src/app/product/page";
import RoadmapPage from "../src/app/roadmap/page";
import SciencePage from "../src/app/science/page";
import WhyUsPage from "../src/app/why-us/page";
import SiteNav from "../src/components/site/SiteNav";
import { NAV_ITEMS, isActive } from "../src/components/site/navItems";
import { BMC_BLOCKS, BMC_LABEL, ENTRY_STAGES, REVENUE_STEPS } from "../src/components/product/BusinessModel";
import { RENDER_LABEL } from "../src/components/product/TimingBoxRender";
import TimingBoxInfographic, { ALSO_REQUIRED, FLOW, LAYERS, STATUS_LABELS } from "../src/components/infographic/TimingBoxInfographic";
import { COMPONENTS, CustomerSection, JURY_POINTS, ProductSection, RoadmapSection, ValidationSection, VisionSection, WhyUsSection } from "../src/components/product/ProductSections";
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

const ALL_PAGES = () => [<Home key="h" />, <WhyUsPage key="w" />, <ProductPage key="p" />, <SciencePage key="s" />, <MarketPage key="m" />, <RoadmapPage key="r" />].map((el) => renderToStaticMarkup(el));

describe("multi-page satellite MVP", () => {
  it("homepage: headline, subheadline, two route buttons, short jury summary", () => {
    const html = renderToStaticMarkup(<Home />);
    assert.match(html, /One Constellation\./);
    assert.match(html, /One Radar\./);
    assert.match(html, /Precision timing for satellites working together\./);
    assert.match(html, /href="\/product"[^>]*>Explore Product</);
    assert.match(html, /href="\/science"[^>]*>Run Demo</);
    for (const p of JURY_POINTS) assert.ok(html.includes(p.v), p.k);
    assert.match(html, /Hardware in development/);
    assert.ok(html.includes(RENDER_LABEL), "render label on home");
    // The homepage stays short: no full subpage content.
    for (const heavy of ["Who we serve.", "Next milestones", "Engineering risks", "Related research"]) assert.ok(!html.includes(heavy), heavy);
  });

  it("navigation: logo to /, five real routes in order, active-route logic", () => {
    assert.deepEqual(NAV_ITEMS.map((n) => [n.label, n.href]), [["Why", "/why-us"], ["Product", "/product"], ["Science", "/science"], ["Market", "/market"], ["Roadmap", "/roadmap"]]);
    const html = renderToStaticMarkup(<SiteNav />);
    const logo = html.match(/<a[^>]*aria-label="RadarSync home"[^>]*>[\s\S]*?<\/a>/)?.[0] ?? "";
    assert.match(logo, /href="\/"/);
    assert.match(logo, /RADARSYNC/);
    for (const n of NAV_ITEMS) assert.ok(html.includes(`href="${n.href}"`), n.href);
    assert.doesNotMatch(html, /href="#/);
    assert.match(html, /aria-expanded="false"/); // mobile menu toggle
    assert.ok(isActive("/science", "/science") && isActive("/science/", "/science"));
    assert.ok(!isActive("/science", "/") && isActive("/", "/") && !isActive(null, "/"));
    assert.ok(!isActive("/product", "/science"));
  });

  it("each subpage carries its required content", () => {
    const why = renderToStaticMarkup(<WhyUsPage />);
    for (const k of ["The problem", "Why this approach matters", "Long-term vision", "Why us", "Our vision extends beyond satellite radar"]) assert.ok(why.includes(k), `why: ${k}`);
    const product = renderToStaticMarkup(<ProductPage />);
    for (const k of ["The Timing Box", RENDER_LABEL, "On every satellite", "Atomic clock core"]) assert.ok(product.includes(k), `product: ${k}`);
    const science = renderToStaticMarkup(<SciencePage />);
    for (const k of ["See the science.", "What we&#x27;ve built. What&#x27;s next.", "Next milestones", "Limits and sources.", "Related research"]) assert.ok(science.includes(k), `science: ${k}`);
    const market = renderToStaticMarkup(<MarketPage />);
    for (const k of ["Who we serve.", "From research to buyer value.", "Our business model.", "Three revenue streams.", "Hardware. Integration. Software. One scalable business model.", "Start narrow. Then grow."]) assert.ok(market.includes(k), `market: ${k}`);
    for (const k of ["The problem", "Our mission", "Why this approach matters"]) assert.ok(why.includes(k), `why: ${k}`);
    for (const k of ["Architecture", "Why customers need it", "Where we are", "Engineering the next generation of precision timing hardware."]) assert.ok(product.includes(k), `product: ${k}`);
    const roadmap = renderToStaticMarkup(<RoadmapPage />);
    for (const k of ["The future", "is a network.", "Precision timing for the next generation of satellite radar.",
      "The path to real hardware.", "Three stages from prototype to product.", "Prove", "Deploy", "Scale",
      "Simulated today", "Next", "Long-term vision", "Engineering risks",
      "Why RadarSync can scale.", "Our investment thesis — to be proven with customers.",
      "RadarSync.", "Timing the next era of space radar.", "Explore the science", "aviation"]) assert.ok(roadmap.includes(k), `roadmap: ${k}`);
    assert.match(roadmap, /href="\/science"[^>]*>Explore the science</);
    for (const w of ["NEXT", "THEN", "LATER"]) assert.equal((roadmap.match(new RegExp(`>${w}<`, "g")) ?? []).length, 1, w);
  });

  it("concept render is labelled on home and product and never presented as a photo", () => {
    assert.equal(RENDER_LABEL, "CONCEPT RENDER — HARDWARE NOT YET BUILT");
    for (const html of [renderToStaticMarkup(<Home />), renderToStaticMarkup(<ProductPage />)]) {
      assert.ok(html.includes(RENDER_LABEL), "render label");
      assert.match(html, /illustration, not a photograph/);
      assert.doesNotMatch(html, /<img|\.png|\.jpe?g/);
    }
  });

  it("infographic on /product: five parts, exploded layers, flow, extra requirements and status labels", () => {
    assert.deepEqual(STATUS_LABELS, ["CONCEPT HARDWARE — NOT YET BUILT", "SIMULATION-BASED — HARDWARE VALIDATION PENDING"]);
    assert.deepEqual(LAYERS.map((l) => l.t), ["Calibration & synchronisation software", "Atomic clock core", "Reference signal conditioning",
      "Environmental stabilisation", "Timing signal outputs"]);
    assert.match(LAYERS[1].s, /hypothetical/);
    assert.deepEqual(FLOW, ["Clock stability", "Timing reference", "Radar payload", "System-level synchronisation & calibration", "Potential distributed radar operation"]);
    assert.deepEqual(ALSO_REQUIRED, ["Precise positioning (orbit knowledge)", "Doppler compensation", "Initial synchronisation", "Phase calibration"]);
    const product = renderToStaticMarkup(<ProductPage />);
    assert.ok(product.includes('id="infographic"'), "infographic placed on /product");
    for (const k of ["The challenge", "Inside the RadarSync Timing Box", "How it works", "The value", "Status", ...STATUS_LABELS,
      "More stable relative timing between synchronisation events", "SCHEMATIC — NOT DATA", "Also required — not provided by the clock alone"])
      assert.ok(product.includes(k), `infographic: ${k}`);
    const html = renderToStaticMarkup(<TimingBoxInfographic />);
    assert.equal((html.match(/role="img"/g) ?? []).length, 4);
    assert.match(html, /Together with synchronisation and calibration, that can give a distributed radar more timing margin/);
    for (const l of STATUS_LABELS) assert.equal(html.split(l).length - 1, 1, `status label shown once: ${l}`);
    assert.doesNotMatch(html, /<img|\.png|\.jpe?g/);
  });

  it("business model canvas has the nine standard blocks and is labelled unvalidated", () => {
    assert.deepEqual(BMC_BLOCKS.map((b) => b.t), ["Key Partners", "Key Activities", "Key Resources", "Value Proposition",
      "Customer Relationships", "Channels", "Customer Segments", "Cost Structure", "Revenue Streams"]);
    assert.equal(BMC_LABEL, "Proposed model · to be validated with customers");
    const market = renderToStaticMarkup(<MarketPage />);
    assert.ok(market.includes(BMC_LABEL));
    for (const b of BMC_BLOCKS) assert.ok(b.items.length > 0, b.t);
    assert.equal(REVENUE_STEPS.length, 3);
    assert.equal(ENTRY_STAGES[ENTRY_STAGES.length - 1].t, "Adjacent");
    assert.match(market, /long-term vision/);
    assert.equal((market.match(/to be validated with customers/g) ?? []).length, 1); // stated once, not on every card
  });

  it("market page has no numeric market, revenue or customer claims", () => {
    const text = renderToStaticMarkup(<MarketPage />).replace(/<[^>]+>/g, " ");
    assert.doesNotMatch(text, /[$€£]\s?\d|\d+\s?%|\b\d+\s?(k|bn|billion|million|units|customers)\b|forecast|margin of|market share|letter of intent|\bsigned\b|our customers/i);
    assert.doesNotMatch(text, /\b(TAM|SAM|SOM|LOI|CAGR)\b/);
  });

  it("copy never implies one shared clock or guaranteed coherence", () => {
    const pages = ALL_PAGES().map((h) => h.replace(/<[^>]+>/g, " "));
    const all = pages.join(" ");
    assert.match(renderToStaticMarkup(<WhyUsPage />), /Precision timing across the constellation\./);
    for (const bad of [/one clock for the whole formation/i, /one stable reference on every/i, /one characterised time reference for every/i, /keep payloads on different satellites in phase/i])
      assert.doesNotMatch(all, bad);
    for (const m of all.matchAll(/guarantee/gi)) {
      const ctx = all.slice(Math.max(0, m.index! - 40), m.index! + 20);
      assert.match(ctx, /(not|never|no)\b[^.]*guarantee/i, `unqualified guarantee: ${ctx}`);
    }
    assert.match(renderToStaticMarkup(<ProductPage />), /Precise timing works together with synchronisation and calibration to make a radar coherent/);
  });

  it("is satellite-only (drones appear only as labelled adjacent research)", () => {
    for (const html of ALL_PAGES()) {
      const withoutResearch = html.replace(/<section id="research"[\s\S]*?<\/section>/, "");
      assert.doesNotMatch(withoutResearch, /\bUAV|drone/i);
    }
    assert.match(renderToStaticMarkup(<ResearchContext />), /adjacent platform/);
  });

  it("labels the product and integration graphics as conceptual and unbuilt", () => {
    for (const html of [renderToStaticMarkup(<TimingBoxVisual />), renderToStaticMarkup(<SatelliteIntegration />)]) {
      assert.match(html, /role="img"/);
      assert.match(html, /Conceptual|conceptual/);
    }
    assert.match(renderToStaticMarkup(<SatelliteIntegration />), /Not an orbit simulation, not measured data and not a radar image/);
    const prod = renderToStaticMarkup(<ProductSection />);
    assert.ok(prod.includes(RENDER_LABEL));
    assert.match(prod, /Concept architecture/);
    assert.deepEqual(COMPONENTS.map((c) => c.t), ["Atomic clock core", "Reference signals", "Stable environment", "Calibration software"]);
    assert.ok(COMPONENTS.some((c) => c.d.includes("hypothetical technology")));
    assert.ok(COMPONENTS.every((c) => c.tag === "proposed"));
  });

  it("never claims customers, purchase intent, partnerships, market sizes, revenues or savings", () => {
    const html = commercial();
    // Development-stage and commercial status stay visible, concisely.
    assert.match(html, /Our target segments for the first customer conversations/);
    assert.match(html, /Customer discovery interviews/);
    assert.match(renderToStaticMarkup(<MarketPage />), /Proposed model · to be validated with customers/);
    assert.match(renderToStaticMarkup(<RoadmapPage />), /to be proven with customers/);
    assert.doesNotMatch(html, /[$€£]\s?\d|\b\d+\s?(bn|billion|million)\b|letter of intent|\bsigned\b|pilot customer|our customers|saves? \d|% (cost|savings)/i);
    assert.doesNotMatch(html, /\b(TAM|SAM|SOM|LOI)\b/); // market-size / intent acronyms (case-sensitive, whole words)
  });

  it("keeps essential development-stage facts and never promises indefinite link-free coherence", () => {
    const html = commercial() + renderToStaticMarkup(<ModelScope />);
    for (const k of ["Build the Timing Box prototype", "not rated for space", "Orbital dynamics", "hypothetical target", "Customer discovery interviews"]) assert.ok(html.includes(k), k);
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
