import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { RequirementResult, RequirementsResponse } from "../src/lib/api";
import { deriveKeyInsight, firstCrossingLog } from "../src/lib/insight";

const est = (loss: number) => ({ loss_db: loss, se_db: 0.001, band_db: [loss, loss] as [number, number], provenance: "simulated" as const });
const breakdown = (loss: number) => ({
  temporal: { total: est(loss), clock: est(loss), non_clock: est(0.01) },
  spatial: { total: est(loss), clock: est(loss), non_clock: est(0.03) },
  clock_variance_fraction: 0.5, rms_relative_time_error_s: {},
});
function result(key: string, status: RequirementResult["status"], req: number | null, shares: number[], atSpec: number): RequirementResult {
  const xs = [1e-14, 1e-13, 1e-12, 1e-11, 1e-10];
  return {
    base_scenario_key: key, label: key, base_category: "assumption", base_adev_1s: 1e-12, status,
    required_adev_1s: req, crossing_adev_1s: req, approximate_bracket_adev_1s: null, required_adev_at_tau: null,
    floor: est(0.03), base_clock_at_scale_1: breakdown(atSpec),
    curve: xs.map((x, i) => ({ adev_1s: x, scale: x / 1e-12, total: est(0.03), clock_only: est(0), non_clock_only: est(0.03), clock_variance_fraction: shares[i] })),
    monotonic_violations: [], messages: [], warnings: [], provenance: "simulated",
  };
}
const response = (results: RequirementResult[]): RequirementsResponse => ({
  metric: "spatial", target_loss_db: 1, loss_ceiling_db: 6.02, results, references: [], config_parameters: {},
  n_monte_carlo: 16, seed: 1, uncertainty_note: "", notes: [],
});

describe("key insight derivation", () => {
  it("interpolates the first upward crossing on a log axis", () => {
    assert.equal(firstCrossingLog([1, 100], [0, 1], 0.5), 10);
    assert.equal(firstCrossingLog([1, 10, 100], [0.2, 0.3, 0.4], 0.5), null);
  });

  it("summarises requirement range, floor-dominated region and spec-level losses", () => {
    const ins = deriveKeyInsight(response([
      result("sa65_industrial", "determined", 1.3e-11, [0, 0.02, 0.2, 0.9, 1], 6.0),
      result("ocxo", "determined", 1.0e-11, [0, 0.05, 0.5, 0.95, 1], 0.04),
      result("nextgen_white_fm", "not_binding_in_range", 1e-10, [0, 0.01, 0.3, 0.9, 1], 0.03),
    ]));
    assert.deepEqual(ins.requirementRange, [1.0e-11, 1.3e-11]); // only "determined" shapes count
    assert.equal(ins.determinedCount, 2);
    assert.equal(ins.totalShapes, 3);
    assert.equal(ins.sa65AtSpecDb, 6.0);
    assert.deepEqual(ins.nextgenAtSpecDb, [0.03]);
    assert.ok(ins.floorDominatedBelow! > 1e-13 && ins.floorDominatedBelow! < 1e-12);
    assert.equal(ins.infeasible, false);
  });

  it("reports infeasible targets without inventing a requirement", () => {
    const ins = deriveKeyInsight(response([result("ocxo", "infeasible_non_clock_floor", null, [0, 0, 0, 0, 0], 0.04)]));
    assert.equal(ins.requirementRange, null);
    assert.equal(ins.floorDominatedBelow, null);
    assert.equal(ins.infeasible, true);
  });
});
