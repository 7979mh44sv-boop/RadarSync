/**
 * Visual identity of each clock scenario. Colors are fixed per entity (never by rank).
 * Three hues validated all-pairs (dark surface #0a111c, CVD ΔE >= 9.4, normal ΔE >= 20.9).
 * The two hypothetical NextGen variants share one hue and differ by line dash.
 */
import type { Provenance } from "./api";

export interface ScenarioStyle {
  color: string;
  dash?: string;
  short: string;
}

export const SCENARIO_STYLE: Record<string, ScenarioStyle> = {
  ocxo: { color: "#3987e5", short: "OCXO (illustrative)" },
  sa65_industrial: { color: "#d95926", short: "SA65 (existing CSAC)" },
  nextgen_white_fm: { color: "#199e70", short: "NextGen · white FM" },
  nextgen_flicker_floor: { color: "#199e70", dash: "7 5", short: "NextGen · flicker floor" },
};

export const FALLBACK_STYLE: ScenarioStyle = { color: "#8b96a8", short: "Scenario" };

export function styleFor(key: string): ScenarioStyle {
  return SCENARIO_STYLE[key] ?? FALLBACK_STYLE;
}

export const NEUTRAL_SERIES = "#8b96a8";
export const TOTAL_SERIES = "#e6edf7";

export const PROVENANCE_INFO: Record<Provenance, { label: string; glyph: string; description: string; className: string }> = {
  sourced: {
    label: "SOURCED",
    glyph: "◆",
    description: "Transcribed from a cited document (Microchip SA65 datasheet DS00003478F, challenge brief).",
    className: "border-slate-300/60 text-slate-100",
  },
  assumption: {
    label: "ASSUMPTION",
    glyph: "◇",
    description: "Illustrative engineering assumption or fitted decomposition chosen by the team. Not a measurement.",
    className: "border-dashed border-slate-500 text-slate-300",
  },
  hypothetical_target: {
    label: "HYPOTHETICAL TARGET",
    glyph: "△",
    description: "Specification posited by the challenge (ADEV < 1e-15 at 1 s). Not measured or published performance.",
    className: "border-dotted border-violet-300/70 text-violet-200",
  },
  simulated: {
    label: "SIMULATED",
    glyph: "∿",
    description: "Output of the RadarSync model for the stated assumptions. Not a measurement.",
    className: "border-accent/60 text-accent",
  },
};
