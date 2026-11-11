"use client";

import ProvenanceBadge from "@/components/ProvenanceBadge";
import type { NetworkConfig, ParametersResponse, ScenarioOut, SyncMode } from "@/lib/api";
import { formatSeconds, validSyncIntervals, workUnits } from "@/lib/format";
import { styleFor } from "@/lib/scenarios";

export const OBSERVATION_OPTIONS = [1, 2, 5, 10, 20, 50, 100];
export const SYNC_CANDIDATES = [0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100];
const CARRIER_PRESETS = [
  { band: "L", ghz: 1.3 }, { band: "S", ghz: 3 }, { band: "C", ghz: 5.5 }, { band: "X", ghz: 10 }, { band: "Ka", ghz: 35 },
];
const SYNC_MODES: { value: SyncMode; label: string }[] = [
  { value: "none", label: "None (holdover)" },
  { value: "time", label: "Time" },
  { value: "time_frequency", label: "Time + frequency" },
];

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-foreground/90">{label}</span>
      {hint && <span className="ml-1 text-[11px] text-muted">{hint}</span>}
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

const inputCls = "w-full rounded-lg border border-border bg-background/60 px-3 py-2 font-mono text-sm text-foreground outline-none focus:border-accent/70";

export function specOf(params: ParametersResponse, name: string) {
  return params.parameters.find((p) => p.name === name);
}

export default function ControlsPanel({ params, scenarios, selected, onToggle, config, onChange, onRun, running }: {
  params: ParametersResponse;
  scenarios: ScenarioOut[];
  selected: string[];
  onToggle: (key: string) => void;
  config: NetworkConfig;
  onChange: (patch: Partial<NetworkConfig>) => void;
  onRun: () => void;
  running: boolean;
}) {
  const carrier = specOf(params, "carrier_frequency_hz");
  const nodes = specOf(params, "n_nodes");
  const ghzMin = (carrier?.minimum ?? 1e8) / 1e9;
  const ghzMax = (carrier?.maximum ?? 1e11) / 1e9;
  const nMin = nodes?.minimum ?? 2;
  const nMax = nodes?.maximum ?? 16;
  const maxObs = Math.min(specOf(params, "observation_s")?.maximum ?? 100, params.limits.max_samples_per_node * config.sample_interval_s);
  const obsOptions = OBSERVATION_OPTIONS.filter((o) => o <= maxObs);
  const syncOptions = validSyncIntervals(config.observation_s, config.cpi_s, SYNC_CANDIDATES);
  const samples = Math.round(config.observation_s / config.sample_interval_s);
  const work = workUnits(selected.length, config.n_monte_carlo, samples, config.n_nodes);
  const overBudget = work > params.limits.max_work_units;
  const carrierGhz = config.carrier_frequency_hz / 1e9;
  const carrierValid = carrierGhz >= ghzMin && carrierGhz <= ghzMax;

  return (
    <div className="space-y-5">
      <div>
        <div className="text-xs font-medium text-foreground/90">Clock scenarios</div>
        <div className="mt-2 space-y-2">
          {scenarios.map((s) => (
            <label key={s.key} className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-border/70 px-3 py-2 hover:border-border">
              <input type="checkbox" className="mt-1 accent-[#2679b8]" checked={selected.includes(s.key)} onChange={() => onToggle(s.key)} />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2 text-sm">
                  <svg width="18" height="8" aria-hidden><line x1="1" y1="4" x2="17" y2="4" stroke={styleFor(s.key).color} strokeWidth="3" strokeDasharray={styleFor(s.key).dash ? "4 3" : undefined} /></svg>
                  {styleFor(s.key).short}
                </span>
                <span className="mt-1 block"><ProvenanceBadge kind={s.category} /></span>
              </span>
            </label>
          ))}
        </div>
      </div>

      <Field label="Carrier frequency" hint={`${ghzMin}–${ghzMax} GHz`}>
        <div className="flex gap-2">
          <input type="number" className={inputCls} min={ghzMin} max={ghzMax} step={0.1} value={carrierGhz}
            aria-invalid={!carrierValid}
            onChange={(e) => onChange({ carrier_frequency_hz: Number(e.target.value) * 1e9 })} />
          <span className="self-center text-sm text-muted">GHz</span>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {CARRIER_PRESETS.map((p) => (
            <button key={p.band} type="button" onClick={() => onChange({ carrier_frequency_hz: p.ghz * 1e9 })}
              className={`rounded-md border px-2 py-0.5 font-mono text-[11px] ${Math.abs(carrierGhz - p.ghz) < 1e-9 ? "border-accent/70 text-accent" : "border-border text-muted hover:text-foreground"}`}>
              {p.band} {p.ghz}
            </button>
          ))}
        </div>
        {!carrierValid && <p className="mt-1 text-[11px] text-danger">Enter a value between {ghzMin} and {ghzMax} GHz.</p>}
      </Field>

      <Field label={`Satellite radar nodes: ${config.n_nodes}`} hint={`${nMin}–${nMax}`}>
        <input type="range" min={nMin} max={nMax} step={1} value={config.n_nodes} className="w-full accent-[#2679b8]"
          onChange={(e) => onChange({ n_nodes: Number(e.target.value) })} />
      </Field>

      <Field label="Observation duration">
        <select className={inputCls} value={config.observation_s}
          onChange={(e) => {
            const obs = Number(e.target.value);
            const valid = validSyncIntervals(obs, config.cpi_s, SYNC_CANDIDATES);
            onChange({ observation_s: obs, sync_interval_s: valid.includes(config.sync_interval_s) ? config.sync_interval_s : valid.filter((v) => v <= 1).at(-1) ?? valid[0] });
          }}>
          {obsOptions.map((o) => <option key={o} value={o}>{o} s</option>)}
        </select>
      </Field>

      <Field label="Synchronisation mode">
        <div className="grid grid-cols-3 gap-1 rounded-lg border border-border p-1">
          {SYNC_MODES.map((m) => (
            <button key={m.value} type="button" onClick={() => onChange({ sync_mode: m.value })}
              className={`rounded-md px-2 py-1.5 text-[11px] ${config.sync_mode === m.value ? "bg-accent/15 text-accent" : "text-muted hover:text-foreground"}`}>
              {m.label}
            </button>
          ))}
        </div>
      </Field>

      <Field label="Synchronisation interval" hint="must divide the observation">
        <select className={inputCls} value={config.sync_interval_s} disabled={config.sync_mode === "none"}
          onChange={(e) => onChange({ sync_interval_s: Number(e.target.value) })}>
          {syncOptions.map((o) => <option key={o} value={o}>{o} s</option>)}
        </select>
      </Field>

      <details className="rounded-lg border border-border/70 px-3 py-2 text-sm">
        <summary className="cursor-pointer text-xs font-medium text-foreground/90">Advanced: non-clock floor &amp; Monte Carlo</summary>
        <div className="mt-3 space-y-3">
          {([
            ["sync_error_rms_s", "Sync measurement error", "ps"],
            ["calibration_rms_s", "Calibration residual", "ps"],
            ["distribution_jitter_rms_s", "Distribution jitter", "ps"],
            ["propagation_random_walk_s_per_sqrt_s", "Propagation wander", "ps/√s"],
          ] as const).map(([name, label, unit]) => {
            const value = name === "sync_error_rms_s" ? config.sync_error_rms_s : config.non_clock[name];
            const max = (specOf(params, name)?.maximum ?? 1e-9) * 1e12;
            return (
              <Field key={name} label={label} hint={`0–${max} ${unit}`}>
                <input type="number" className={inputCls} min={0} max={max} step={0.1} value={Number((value * 1e12).toPrecision(6))}
                  onChange={(e) => {
                    const v = Math.max(0, Number(e.target.value)) * 1e-12;
                    onChange(name === "sync_error_rms_s" ? { sync_error_rms_s: v } : { non_clock: { ...config.non_clock, [name]: v } });
                  }} />
              </Field>
            );
          })}
          <Field label={`Clock correlation ρ: ${config.clock_correlation.toFixed(2)}`} hint="common-mode fraction">
            <input type="range" min={0} max={1} step={0.05} value={config.clock_correlation} className="w-full accent-[#2679b8]"
              onChange={(e) => onChange({ clock_correlation: Number(e.target.value) })} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Monte Carlo runs">
              <input type="number" className={inputCls} min={1} max={params.limits.max_monte_carlo} value={config.n_monte_carlo}
                onChange={(e) => onChange({ n_monte_carlo: Math.round(Number(e.target.value)) })} />
            </Field>
            <Field label="Seed">
              <input type="number" className={inputCls} min={0} value={config.seed}
                onChange={(e) => onChange({ seed: Math.round(Number(e.target.value)) })} />
            </Field>
          </div>
        </div>
      </details>

      <div className="rounded-lg bg-background/50 px-3 py-2 font-mono text-[11px] text-muted">
        Fixed: sample interval {formatSeconds(config.sample_interval_s)}, CPI {formatSeconds(config.cpi_s)}.
        <br />Work: {(work / 1e6).toFixed(2)} M of {(params.limits.max_work_units / 1e6).toFixed(0)} M units.
      </div>
      {overBudget && <p className="text-[11px] text-danger">This configuration exceeds the server computation limit. Reduce nodes, runs, scenarios or duration.</p>}
      <div className="flex items-center gap-2">
        <ProvenanceBadge kind="assumption" />
        <span className="text-[11px] text-muted">All system parameters are assumptions.</span>
      </div>
      <button type="button" onClick={onRun} disabled={running || overBudget || selected.length === 0 || !carrierValid}
        className="w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-background transition hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-40">
        {running ? "Running…" : "Run simulation"}
      </button>
    </div>
  );
}
