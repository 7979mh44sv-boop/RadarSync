"use client";

import type { NetworkConfig } from "@/lib/api";
import { DEMO_TARGETS } from "@/lib/insight";

export interface DemoPreset {
  id: string;
  label: string;
  description: string;
  patch: Partial<NetworkConfig>;
}

/** Presets only set existing controls (all assumptions); they run the unchanged simulation. */
export const DEMO_PRESETS: DemoPreset[] = [
  { id: "baseline", label: "Baseline: X-band, 1 s sync", description: "10 GHz carrier, time sync every 1 s, 10 s observation.",
    patch: { carrier_frequency_hz: 10e9, sync_mode: "time", sync_interval_s: 1, observation_s: 10 } },
  { id: "holdover", label: "Long holdover: 10 s sync", description: "Same, but satellites re-synchronise only every 10 s.",
    patch: { carrier_frequency_hz: 10e9, sync_mode: "time", sync_interval_s: 10, observation_s: 10 } },
  { id: "cband", label: "Lower carrier: C-band 5.4 GHz", description: "Phase error scales with carrier frequency (illustrative carrier).",
    patch: { carrier_frequency_hz: 5.4e9, sync_mode: "time", sync_interval_s: 1, observation_s: 10 } },
];

export const DEMO_STEPS: { title: string; body: string; target: string }[] = [
  { title: "Choose clock scenarios", body: "Tick SA65 (sourced), the illustrative OCXO and the hypothetical NextGen CSAC in the controls.", target: DEMO_TARGETS.controls },
  { title: "Set sync interval or carrier", body: "Use a preset below, or change the synchronisation interval or carrier frequency yourself.", target: DEMO_TARGETS.controls },
  { title: "Run the model", body: "Press “Run simulation”: clock and non-clock timing errors are simulated for every satellite radar node.", target: DEMO_TARGETS.timing },
  { title: "Inspect coherence", body: "Compare temporal and spatial coherence loss, split into clock-induced and non-clock parts.", target: DEMO_TARGETS.coherence },
  { title: "Read the requirement", body: "See which clock stability meets a loss target — or why the target is infeasible.", target: DEMO_TARGETS.requirement },
];

function goTo(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
  el.focus({ preventScroll: true });
}

export default function GuidedDemo({ onPreset, activePreset, running }: {
  onPreset: (p: DemoPreset) => void;
  activePreset: string | null;
  running: boolean;
}) {
  return (
    <div className="space-y-4">
      <ol className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5" aria-label="Guided demo steps">
        {DEMO_STEPS.map((s, i) => (
          <li key={s.title}>
            <button type="button" onClick={() => goTo(s.target)} aria-label={`Step ${i + 1}: ${s.title}. Jump to the relevant panel.`}
              className="h-full w-full rounded-xl border border-border bg-background/40 p-3 text-left transition hover:border-accent/60 focus-visible:border-accent focus-visible:outline-none">
              <span className="font-mono text-[11px] text-accent">Step {i + 1}</span>
              <span className="mt-0.5 block text-sm font-medium">{s.title}</span>
              <span className="mt-1 block text-xs leading-relaxed text-muted">{s.body}</span>
            </button>
          </li>
        ))}
      </ol>
      <div role="group" aria-label="Demo presets" className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted">One-click presets (assumptions; they set the controls and run the simulation):</span>
        {DEMO_PRESETS.map((p) => (
          <button key={p.id} type="button" disabled={running} onClick={() => onPreset(p)} aria-pressed={activePreset === p.id} title={p.description}
            className={`rounded-lg border px-3 py-1.5 text-xs transition disabled:opacity-50 ${activePreset === p.id ? "border-accent/70 bg-accent/10 text-accent" : "border-border text-foreground/85 hover:border-accent/50"}`}>
            {p.label}
          </button>
        ))}
      </div>
    </div>
  );
}
