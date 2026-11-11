"use client";

import { useState } from "react";
import { Panel, StatusBlock } from "@/components/Panel";
import RequirementPanel from "@/components/panels/RequirementPanel";
import SweepPanel from "@/components/panels/SweepPanel";
import {
  sensitivityApi,
  type CoherenceMetric,
  type NetworkConfig,
  type RequirementRequest,
  type ScenarioOut,
  type SweepParameter,
  type SweepRequest,
} from "@/lib/api";
import { formatDb, formatHz } from "@/lib/format";
import { styleFor } from "@/lib/scenarios";
import { validSweepValues } from "@/lib/sensitivity";
import { useApiRequest } from "@/lib/useApiRequest";

const fetchOptions = (_: Record<string, never>, signal: AbortSignal) => sensitivityApi.options(signal);
const fetchRequirement = (b: RequirementRequest, signal: AbortSignal) => sensitivityApi.requirement(b, signal);
const fetchSweep = (b: SweepRequest, signal: AbortSignal) => sensitivityApi.sweep(b, signal);
const EMPTY = {} as Record<string, never>;

function Segmented<T extends string>({ value, options, onChange, label }: {
  value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string;
}) {
  return (
    <div role="group" aria-label={label} className="inline-grid grid-flow-col gap-1 rounded-lg border border-border p-1">
      {options.map((o) => (
        <button key={o.value} type="button" onClick={() => onChange(o.value)} aria-pressed={value === o.value}
          className={`rounded-md px-3 py-1 text-xs ${value === o.value ? "bg-accent/15 text-accent" : "text-muted hover:text-foreground"}`}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export default function Phase3Section({ config, scenarios, selected, maxSamples }: {
  config: NetworkConfig | null;
  scenarios: ScenarioOut[];
  selected: string[];
  maxSamples: number;
}) {
  const allKeys = scenarios.map((s) => s.key);
  const ceiling = (m: CoherenceMetric) =>
    config ? 10 * Math.log10(m === "spatial" ? config.n_nodes : Math.round(config.cpi_s / config.sample_interval_s)) : Infinity;

  // Requirement: draft controls, applied on "Compute".
  const [metric, setMetric] = useState<CoherenceMetric>("spatial");
  const [targetDraft, setTargetDraft] = useState("1");
  const [bases, setBases] = useState<string[]>(allKeys);
  const [applied, setApplied] = useState<{ metric: CoherenceMetric; target: number; bases: string[] }>({ metric: "spatial", target: 1, bases: allKeys });
  const target = Number(targetDraft);
  const targetValid = Number.isFinite(target) && target > 0 && target < ceiling(metric);
  const reqBody: RequirementRequest | null = config && applied.bases.length
    ? { base_scenario_keys: applied.bases, config, metric: applied.metric, target_loss_db: applied.target }
    : null;
  const req = useApiRequest(reqBody, fetchRequirement);

  // Sweep.
  const options = useApiRequest(EMPTY, fetchOptions);
  const [param, setParam] = useState<SweepParameter>("sync_interval_s");
  const [sweepMetric, setSweepMetric] = useState<CoherenceMetric>("spatial");
  const opt = options.data?.parameters.find((p) => p.name === param);
  const values = opt && config ? validSweepValues(opt, config, maxSamples) : [];
  const sweepKeys = selected.length ? selected : allKeys;
  const sweepBody: SweepRequest | null = config && opt && values.length >= 2
    ? { scenario_keys: sweepKeys, config, parameter: param, values }
    : null;
  const sweep = useApiRequest(sweepBody, fetchSweep);

  const configLine = config
    ? `${formatHz(config.carrier_frequency_hz)}, ${config.n_nodes} nodes, ${config.observation_s} s, ${config.sync_mode === "none" ? "no sync" : `${config.sync_mode.replace("_", " + ")} sync every ${config.sync_interval_s} s`}, ${config.n_monte_carlo} runs`
    : "";

  return (
    <>
      <Panel id="requirement" eyebrow="F · Clock-stability requirement" title="What clock stability would meet a coherence-loss target?"
        subtitle={<>Each base clock model is scaled uniformly (σy(τ) → s·σy(τ)) and its total loss simulated across a range of σy(1 s), using the configuration of the last run ({configLine}). The answer depends on the noise shape, so it is computed per shape.</>}>
        <div className="mb-5 flex flex-wrap items-end gap-4 rounded-xl border border-border/70 bg-background/30 p-3">
          <div>
            <div className="mb-1 text-[11px] text-muted">Coherence metric</div>
            <Segmented label="Coherence metric" value={metric} onChange={setMetric}
              options={[{ value: "spatial", label: "Spatial (across nodes)" }, { value: "temporal", label: "Temporal (within CPI)" }]} />
          </div>
          <label className="block">
            <span className="text-[11px] text-muted">Loss target [dB] (below {formatDb(ceiling(metric))})</span>
            <input type="number" min={0.001} step={0.1} value={targetDraft} onChange={(e) => setTargetDraft(e.target.value)} aria-invalid={!targetValid}
              className="mt-1 block w-28 rounded-lg border border-border bg-background/60 px-3 py-1.5 font-mono text-sm outline-none focus:border-accent/70" />
          </label>
          <fieldset>
            <legend className="mb-1 text-[11px] text-muted">Base noise shapes</legend>
            <div className="flex flex-wrap gap-2">
              {allKeys.map((k) => (
                <label key={k} className="flex items-center gap-1.5 rounded-md border border-border/70 px-2 py-1 text-xs">
                  <input type="checkbox" className="accent-[#2679b8]" checked={bases.includes(k)}
                    onChange={() => setBases((b) => (b.includes(k) ? b.filter((x) => x !== k) : allKeys.filter((x) => x === k || b.includes(x))))} />
                  <span className="inline-block h-2 w-2 rounded-full" style={{ background: styleFor(k).color }} />
                  {styleFor(k).short}
                </label>
              ))}
            </div>
          </fieldset>
          <button type="button" disabled={!targetValid || bases.length === 0 || req.state === "loading"}
            onClick={() => setApplied({ metric, target, bases })}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-background hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-40">
            {req.state === "loading" ? "Computing…" : "Compute requirement"}
          </button>
          {!targetValid && <p className="w-full text-[11px] text-danger">Enter a target above 0 dB and below the random-phase ceiling.</p>}
        </div>
        {req.state === "ready" && req.data ? (
          <RequirementPanel data={req.data} />
        ) : (
          <StatusBlock state={req.state} error={req.error} height={380}
            empty={config ? "Select at least one base noise shape and compute." : "Run a simulation first; the requirement uses the same configuration."} />
        )}
      </Panel>

      <Panel id="sensitivity" eyebrow="G · Sensitivity" title="How coherence loss depends on system parameters"
        subtitle="One parameter varied at a time with all others held at the last-run configuration, using the same random numbers for every value."
        actions={
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <select aria-label="Parameter to sweep" value={param} onChange={(e) => setParam(e.target.value as SweepParameter)}
              className="rounded-md border border-border bg-background/60 px-2 py-1">
              {(options.data?.parameters ?? []).map((p) => <option key={p.name} value={p.name}>{p.label}</option>)}
            </select>
            <Segmented label="Sweep metric" value={sweepMetric} onChange={setSweepMetric}
              options={[{ value: "spatial", label: "Spatial" }, { value: "temporal", label: "Temporal" }]} />
          </div>
        }>
        {opt && <p className="mb-3 text-xs text-muted">{opt.note}</p>}
        {sweep.state === "ready" && sweep.data ? (
          <SweepPanel data={sweep.data} metric={sweepMetric} />
        ) : (
          <StatusBlock state={options.state === "error" ? "error" : sweep.state} error={options.error ?? sweep.error} height={320}
            empty={!config ? "Run a simulation first." : "Fewer than two valid values for this parameter with the current configuration (e.g. sync intervals must divide the observation)."} />
        )}
      </Panel>
    </>
  );
}
