import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { describeApiError } from "../src/lib/api";
import {
  chooseTimeUnit, formatDb, formatHz, formatSci, formatSeconds, linearTicks, logTicks,
  makeScale, nearestIndex, superscript, validSyncIntervals, workUnits,
} from "../src/lib/format";

describe("formatting", () => {
  it("formats scientific notation with superscripts", () => {
    assert.equal(superscript(-15), "⁻¹⁵");
    assert.equal(formatSci(3.047e-10), "3.05 × 10⁻¹⁰");
    assert.equal(formatSci(1e-15), "10⁻¹⁵");
    assert.equal(formatSci(9.999e-12), "10⁻¹¹");
    assert.equal(formatSci(0.25), "0.25");
    assert.equal(formatSci(0), "0");
  });

  it("chooses readable time units", () => {
    assert.deepEqual(chooseTimeUnit(2.97e-10), { unit: "ps", factor: 1e12 });
    assert.equal(chooseTimeUnit(1.2e-9).unit, "ns");
    assert.equal(chooseTimeUnit(8.6e-16).unit, "fs");
    assert.equal(formatSeconds(2.97e-10), "297 ps");
    assert.equal(formatSeconds(1.01e-9), "1.01 ns");
    assert.equal(formatSeconds(0.1), "100 ms");
  });

  it("formats dB without implying false precision", () => {
    assert.equal(formatDb(12.6649), "12.7 dB");
    assert.equal(formatDb(5.5e-10), "< 0.001 dB");
    assert.equal(formatDb(Number.NaN), "—");
    assert.equal(formatHz(10e9), "10 GHz");
    assert.equal(formatHz(100), "100 Hz");
  });
});

describe("scales and ticks", () => {
  it("produces decade ticks and nice linear ticks", () => {
    assert.deepEqual(logTicks(1e-3, 1e4), [1e-3, 1e-2, 1e-1, 1, 10, 100, 1000, 1e4]);
    assert.deepEqual(linearTicks(0, 10, 5), [0, 2, 4, 6, 8, 10]);
    assert.deepEqual(linearTicks(-3, 3, 6), [-3, -2, -1, 0, 1, 2, 3]);
  });

  it("maps log and linear domains", () => {
    const log = makeScale("log", [1e-3, 1e3], [0, 600]);
    assert.equal(log(1), 300);
    const lin = makeScale("linear", [0, 10], [100, 0]);
    assert.equal(lin(5), 50);
  });

  it("finds the nearest sample", () => {
    assert.equal(nearestIndex([1, 2, 4, 8], 5), 2);
    assert.equal(nearestIndex([1, 10, 100], 40, "log"), 2);
    assert.equal(nearestIndex([], 1), -1);
  });
});

describe("backend rule mirrors", () => {
  it("offers only sync intervals the backend accepts", () => {
    const c = [0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100];
    assert.deepEqual(validSyncIntervals(10, 0.1, c), [0.1, 0.2, 0.5, 1, 2, 5, 10]);
    assert.deepEqual(validSyncIntervals(1, 0.1, c), [0.1, 0.2, 0.5, 1]);
    assert.ok(!validSyncIntervals(5, 0.1, c).includes(2)); // 5 / 2 is not an integer
  });

  it("estimates work units like the server", () => {
    assert.equal(workUnits(4, 16, 10_000, 4), 4 * 16 * 10_000 * (4 + 6));
  });

  it("turns FastAPI 422 payloads into readable messages", () => {
    const msg = describeApiError(422, {
      detail: [{ loc: ["body", "config"], msg: "Value error, observation must be an integer number of CPIs" }],
    });
    assert.equal(msg, "config: observation must be an integer number of CPIs");
    assert.equal(describeApiError(404, { detail: "unknown scenario 'x'" }), "unknown scenario 'x'");
    assert.equal(describeApiError(500, null), "Backend responded with HTTP 500");
  });
});
