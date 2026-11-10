import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { SweepOption } from "../src/lib/api";
import { STATUS_INFO, clampForLog, sweepAxisKind, validSweepValues } from "../src/lib/sensitivity";

const CFG = { observation_s: 10, cpi_s: 0.1, sync_interval_s: 1, sync_mode: "time", sample_interval_s: 1e-3 };
const opt = (name: SweepOption["name"], values: (number | string)[], min: number | null = null, max: number | null = null): SweepOption =>
  ({ name, label: name, unit: "-", kind: "numeric", minimum: min, maximum: max, default_values: values, note: "" });

describe("sensitivity helpers", () => {
  it("covers every requirement status with an English label and explanation", () => {
    for (const k of ["determined", "infeasible_non_clock_floor", "not_reached_in_range", "not_binding_in_range", "ambiguous_non_monotonic"] as const) {
      assert.ok(STATUS_INFO[k].label.length > 5 && STATUS_INFO[k].explain.length > 20, k);
    }
    assert.match(STATUS_INFO.infeasible_non_clock_floor.explain, /No clock improvement/);
  });

  it("clamps non-positive and tiny values for log axes", () => {
    assert.deepEqual(clampForLog([0, 1e-6, 0.5, Number.NaN], 1e-3), [1e-3, 1e-3, 0.5, 1e-3]);
  });

  it("offers only sweep values the backend accepts", () => {
    assert.deepEqual(validSweepValues(opt("sync_interval_s", [0.1, 0.3, 1, 3, 10, 20]), CFG, 100_000), [0.1, 1, 10]);
    // observation must stay a multiple of the 1 s sync interval and within the sample limit
    assert.deepEqual(validSweepValues(opt("observation_s", [0.5, 1, 2, 5, 200]), CFG, 100_000), [1, 2, 5]);
    assert.deepEqual(validSweepValues(opt("n_nodes", [1, 2, 4, 32], 2, 16), CFG, 100_000), [2, 4]);
  });

  it("uses log axes for parameters spanning decades", () => {
    assert.equal(sweepAxisKind("carrier_frequency_hz"), "log");
    assert.equal(sweepAxisKind("n_nodes"), "linear");
  });
});
