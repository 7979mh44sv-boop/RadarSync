/** Pure formatting and scale helpers (unit-tested in tests/format.test.ts). */

const SUPERSCRIPT: Record<string, string> = {
  "-": "⁻", "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹",
};

export function superscript(n: number): string {
  return String(n).split("").map((c) => SUPERSCRIPT[c] ?? c).join("");
}

/** 3.05e-10 -> "3.05 × 10⁻¹⁰"; exact powers of ten -> "10⁻¹⁰". */
export function formatSci(x: number, digits = 3): string {
  if (x === 0) return "0";
  if (!Number.isFinite(x)) return String(x);
  const exp = Math.floor(Math.log10(Math.abs(x)));
  const mant = x / 10 ** exp;
  const m = Number(mant.toPrecision(digits));
  if (Math.abs(m) === 10) return formatSci(Math.sign(x) * 10 ** (exp + 1), digits);
  if (exp >= -2 && exp <= 3) return String(Number(x.toPrecision(digits)));
  return m === 1 ? `10${superscript(exp)}` : m === -1 ? `−10${superscript(exp)}` : `${m} × 10${superscript(exp)}`;
}

export interface TimeUnit {
  unit: "fs" | "ps" | "ns" | "µs" | "ms" | "s";
  factor: number; // multiply seconds by factor
}

const TIME_UNITS: TimeUnit[] = [
  { unit: "fs", factor: 1e15 },
  { unit: "ps", factor: 1e12 },
  { unit: "ns", factor: 1e9 },
  { unit: "µs", factor: 1e6 },
  { unit: "ms", factor: 1e3 },
  { unit: "s", factor: 1 },
];

/** Largest unit in which `maxAbsSeconds` is >= 1 (falls back to fs). */
export function chooseTimeUnit(maxAbsSeconds: number): TimeUnit {
  if (!(maxAbsSeconds > 0)) return TIME_UNITS[1];
  for (let i = TIME_UNITS.length - 1; i >= 0; i--) {
    if (maxAbsSeconds * TIME_UNITS[i].factor >= 1) return TIME_UNITS[i];
  }
  return TIME_UNITS[0];
}

export function formatSeconds(s: number, digits = 3): string {
  if (s === 0) return "0 s";
  const u = chooseTimeUnit(Math.abs(s));
  return `${Number((s * u.factor).toPrecision(digits))} ${u.unit}`;
}

export function formatDb(db: number): string {
  if (!Number.isFinite(db)) return "—";
  if (Math.abs(db) < 1e-3) return "< 0.001 dB";
  return `${Number(db.toPrecision(3))} dB`;
}

export function formatHz(hz: number): string {
  if (hz >= 1e9) return `${Number((hz / 1e9).toPrecision(4))} GHz`;
  if (hz >= 1e6) return `${Number((hz / 1e6).toPrecision(4))} MHz`;
  if (hz >= 1e3) return `${Number((hz / 1e3).toPrecision(4))} kHz`;
  return `${Number(hz.toPrecision(4))} Hz`;
}

export function formatQuantity(value: number, unit: string): string {
  if (unit === "s") return formatSeconds(value);
  if (unit === "Hz") return formatHz(value);
  if (unit === "dB") return formatDb(value);
  if (unit === "-") return formatSci(value);
  return `${formatSci(value)} ${unit}`;
}

/** Decade ticks covering [min, max] (both > 0). */
export function logTicks(min: number, max: number): number[] {
  const lo = Math.floor(Math.log10(min) + 1e-9);
  const hi = Math.ceil(Math.log10(max) - 1e-9);
  const out: number[] = [];
  for (let e = lo; e <= hi; e++) out.push(10 ** e);
  return out;
}

/** "Nice" linear ticks (1, 2, 5 x 10^n steps) covering [min, max]. */
export function linearTicks(min: number, max: number, target = 5): number[] {
  if (min === max) return [min];
  const raw = (max - min) / target;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((k) => k * mag).find((s) => raw <= s) ?? 10 * mag;
  const start = Math.ceil(min / step - 1e-9) * step;
  const out: number[] = [];
  for (let v = start; v <= max + step * 1e-9; v += step) out.push(Math.abs(v) < step * 1e-9 ? 0 : Number(v.toPrecision(12)));
  return out;
}

export type ScaleKind = "log" | "linear";

export function makeScale(kind: ScaleKind, domain: [number, number], range: [number, number]) {
  const [d0, d1] = kind === "log" ? [Math.log10(domain[0]), Math.log10(domain[1])] : domain;
  const [r0, r1] = range;
  const k = d1 === d0 ? 0 : (r1 - r0) / (d1 - d0);
  return (v: number) => r0 + ((kind === "log" ? Math.log10(v) : v) - d0) * k;
}

/** Index of the element in sorted `xs` closest to `x` (linear or log distance). */
export function nearestIndex(xs: number[], x: number, kind: ScaleKind = "linear"): number {
  if (xs.length === 0) return -1;
  const f = kind === "log" ? Math.log10 : (v: number) => v;
  let lo = 0;
  let hi = xs.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (xs[mid] < x) lo = mid;
    else hi = mid;
  }
  return Math.abs(f(xs[lo]) - f(x)) <= Math.abs(f(xs[hi]) - f(x)) ? lo : hi;
}

/** Sync intervals (s) the backend accepts: >= CPI, multiple of CPI, dividing the observation. */
export function validSyncIntervals(observationS: number, cpiS: number, candidates: number[]): number[] {
  const isInt = (v: number) => Math.abs(v - Math.round(v)) < 1e-9 && Math.round(v) >= 1;
  return candidates.filter((c) => c <= observationS + 1e-12 && isInt(c / cpiS) && isInt(observationS / c));
}

/** Mirror of the backend work-unit estimate (scenarios x runs x samples x (nodes + pairs)). */
export function workUnits(nScenarios: number, runs: number, samples: number, nodes: number): number {
  return nScenarios * runs * samples * (nodes + (nodes * (nodes - 1)) / 2);
}
