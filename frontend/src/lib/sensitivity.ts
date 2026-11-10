/** Pure helpers for the Phase 3 panels (unit-tested). */
import type { RequirementStatus, SweepOption } from "./api";
import { validSyncIntervals } from "./format";

export const STATUS_INFO: Record<RequirementStatus, { label: string; icon: string; tone: "good" | "warn" | "bad" | "info"; explain: string }> = {
  determined: {
    label: "Requirement determined",
    icon: "✓",
    tone: "good",
    explain: "The simulated loss crosses the target inside the evaluated range; the value is the largest evaluated σy(1 s) that still meets it.",
  },
  infeasible_non_clock_floor: {
    label: "Infeasible: non-clock floor",
    icon: "✕",
    tone: "bad",
    explain: "Non-clock errors alone already reach the target. No clock improvement can meet it under these assumptions.",
  },
  not_reached_in_range: {
    label: "Not reached in range",
    icon: "↓",
    tone: "warn",
    explain: "Even the most stable clock evaluated misses the target. Any requirement lies below the evaluated range.",
  },
  not_binding_in_range: {
    label: "Not binding in range",
    icon: "↑",
    tone: "info",
    explain: "Every evaluated clock meets the target. The requirement, if any, lies above the evaluated range.",
  },
  ambiguous_non_monotonic: {
    label: "Ambiguous (non-monotonic)",
    icon: "?",
    tone: "warn",
    explain: "The loss curve is not monotonic beyond Monte Carlo noise. A conservative value is shown; treat it as indicative.",
  },
};

/** Clamp positive values for a log axis; values below `floor` are drawn at the floor. */
export function clampForLog(values: number[], floor: number): number[] {
  return values.map((v) => (Number.isFinite(v) && v > floor ? v : floor));
}

/** Sweep values the backend will accept for this parameter, given the current configuration. */
export function validSweepValues(
  opt: SweepOption,
  cfg: { observation_s: number; cpi_s: number; sync_interval_s: number; sync_mode: string; sample_interval_s: number },
  maxSamples: number,
): (number | string)[] {
  const vals = opt.default_values;
  if (opt.name === "sync_interval_s") {
    return validSyncIntervals(cfg.observation_s, cfg.cpi_s, vals.map(Number));
  }
  if (opt.name === "observation_s") {
    return vals.map(Number).filter((o) => {
      const n = Math.round(o / cfg.sample_interval_s);
      if (n > maxSamples) return false;
      if (cfg.sync_mode === "none") return Math.abs(o / cfg.cpi_s - Math.round(o / cfg.cpi_s)) < 1e-9;
      return validSyncIntervals(o, cfg.cpi_s, [cfg.sync_interval_s]).length === 1;
    });
  }
  return vals.filter((v) => typeof v === "string" || ((opt.minimum === null || v >= opt.minimum) && (opt.maximum === null || v <= opt.maximum)));
}

/** Log axis for parameters spanning decades. */
export function sweepAxisKind(name: string): "log" | "linear" {
  return name === "carrier_frequency_hz" || name === "sync_interval_s" || name === "clock_scale" || name === "observation_s" ? "log" : "linear";
}
