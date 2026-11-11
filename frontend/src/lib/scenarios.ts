/**
 * Visual identity of each clock scenario. Colors are fixed per entity (never by rank).
 * Three hues validated all-pairs on light surfaces #FFFFFF/#F5F8FC (CVD ΔE >= 9.2, normal ΔE >= 24.0);
 * aqua is below 3:1 contrast, relieved by legends, direct labels and table views.
 * The two hypothetical NextGen variants share one hue and differ by line dash.
 */
import type { Provenance } from "./api";

export interface ScenarioStyle {
  color: string;
  dash?: string;
  short: string;
}

export const SCENARIO_STYLE: Record<string, ScenarioStyle> = {
  ocxo: { color: "#2a78d6", short: "OCXO (illustrative)" },
  sa65_industrial: { color: "#eb6834", short: "SA65 (existing CSAC)" },
  nextgen_white_fm: { color: "#1baf7a", short: "NextGen · white FM" },
  nextgen_flicker_floor: { color: "#1baf7a", dash: "7 5", short: "NextGen · flicker floor" },
};

export const FALLBACK_STYLE: ScenarioStyle = { color: "#8b96a8", short: "Scenario" };

export function styleFor(key: string): ScenarioStyle {
  return SCENARIO_STYLE[key] ?? FALLBACK_STYLE;
}

export const NEUTRAL_SERIES = "#6b7c93";
export const TOTAL_SERIES = "#163a63";

export const PROVENANCE_INFO: Record<Provenance, { label: string; glyph: string; description: string; className: string }> = {
  sourced: {
    label: "SOURCED",
    glyph: "◆",
    description: "Transcribed from a cited document (Microchip SA65 datasheet DS00003478F, challenge brief).",
    className: "border-slate-500 text-slate-800",
  },
  assumption: {
    label: "ASSUMPTION",
    glyph: "◇",
    description: "Illustrative engineering assumption or fitted decomposition chosen by the team. Not a measurement.",
    className: "border-dashed border-slate-500 text-slate-700",
  },
  hypothetical_target: {
    label: "HYPOTHETICAL TARGET",
    glyph: "△",
    description: "Specification posited by the challenge (ADEV < 1e-15 at 1 s). Not measured or published performance.",
    className: "border-dotted border-violet-500 text-violet-700",
  },
  simulated: {
    label: "SIMULATED",
    glyph: "∿",
    description: "Output of the RadarSync model for the stated assumptions. Not a measurement.",
    className: "border-accent/60 text-accent",
  },
};
