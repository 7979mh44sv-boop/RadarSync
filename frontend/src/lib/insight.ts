/**
 * Derive the jury-facing "Key Insight" from a real Phase 3 requirement response.
 * Pure function (unit-tested); every number it returns comes from the API response.
 */
import type { RequirementsResponse } from "./api";

export interface KeyInsight {
  targetDb: number;
  metric: "temporal" | "spatial";
  /** Range of modelled sigma_y(1 s) requirements across base shapes with status "determined". */
  requirementRange: [number, number] | null;
  determinedCount: number;
  totalShapes: number;
  /** Simulated non-clock floor (max over shapes; identical by construction under common random numbers). */
  floorDb: number;
  /** sigma_y(1 s) below which the clock causes less than `shareThreshold` of the timing-error variance
   *  (conservative: the largest such value across shapes). */
  floorDominatedBelow: number | null;
  shareThreshold: number;
  /** Simulated loss of the SA65 base model as specified (scale 1), if present. */
  sa65AtSpecDb: number | null;
  /** Simulated loss of the hypothetical NextGen base models as specified, if present. */
  nextgenAtSpecDb: number[];
  infeasible: boolean;
}

/** Log-interpolated x where y first rises through `level` (x ascending). */
export function firstCrossingLog(x: number[], y: number[], level: number): number | null {
  for (let i = 1; i < x.length; i++) {
    if (y[i - 1] < level && y[i] >= level) {
      const f = (level - y[i - 1]) / (y[i] - y[i - 1]);
      return 10 ** (Math.log10(x[i - 1]) + f * (Math.log10(x[i]) - Math.log10(x[i - 1])));
    }
  }
  return null;
}

export function deriveKeyInsight(data: RequirementsResponse, shareThreshold = 0.1): KeyInsight {
  const det = data.results.filter((r) => r.status === "determined" && r.required_adev_1s !== null);
  const req = det.map((r) => r.required_adev_1s as number);
  const crossings = data.results
    .map((r) => firstCrossingLog(r.curve.map((p) => p.adev_1s), r.curve.map((p) => p.clock_variance_fraction), shareThreshold))
    .filter((v): v is number => v !== null);
  const metric = data.metric;
  const sa65 = data.results.find((r) => r.base_scenario_key.startsWith("sa65"));
  return {
    targetDb: data.target_loss_db,
    metric,
    requirementRange: req.length ? [Math.min(...req), Math.max(...req)] : null,
    determinedCount: det.length,
    totalShapes: data.results.length,
    floorDb: Math.max(...data.results.map((r) => r.floor.loss_db)),
    floorDominatedBelow: crossings.length ? Math.min(...crossings) : null,
    shareThreshold,
    sa65AtSpecDb: sa65 ? sa65.base_clock_at_scale_1[metric].total.loss_db : null,
    nextgenAtSpecDb: data.results
      .filter((r) => r.base_scenario_key.startsWith("nextgen"))
      .map((r) => r.base_clock_at_scale_1[metric].total.loss_db),
    infeasible: data.results.every((r) => r.status === "infeasible_non_clock_floor"),
  };
}

/** Panel anchors used by the guided demo (must match ids rendered by the dashboard). */
export const DEMO_TARGETS = {
  controls: "controls",
  timing: "timing",
  coherence: "coherence",
  requirement: "requirement",
  provenance: "provenance",
} as const;
