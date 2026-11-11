"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Panel, StatusBlock, type LoadState } from "@/components/Panel";
import ClockStabilityPanel from "@/components/panels/ClockStabilityPanel";
import CoherencePanel from "@/components/panels/CoherencePanel";
import ControlsPanel, { specOf } from "@/components/panels/ControlsPanel";
import ProvenancePanel from "@/components/panels/ProvenancePanel";
import Phase3Section from "@/components/Phase3Section";
import GuidedDemo, { type DemoPreset } from "@/components/story/GuidedDemo";
import KeyInsightPanel from "@/components/story/KeyInsightPanel";
import { useDefaultInsight } from "@/lib/defaultInsight";
import TimingErrorPanel from "@/components/panels/TimingErrorPanel";
import {
  api,
  type AdevResponse,
  type CoherenceResponse,
  type LimitationsResponse,
  type NetworkConfig,
  type ParametersResponse,
  type ScenarioList,
  type TimingSeries,
} from "@/lib/api";
import { formatHz } from "@/lib/format";
import { styleFor } from "@/lib/scenarios";

interface Async<T> {
  state: LoadState;
  data: T | null;
  error: string | null;
}

const idle = <T,>(): Async<T> => ({ state: "idle", data: null, error: null });
const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));

function defaultConfig(p: ParametersResponse): NetworkConfig {
  const d = (name: string) => specOf(p, name)?.default as number;
  return {
    carrier_frequency_hz: d("carrier_frequency_hz"),
    n_nodes: d("n_nodes"),
    observation_s: d("observation_s"),
    sample_interval_s: d("sample_interval_s"),
    cpi_s: d("cpi_s"),
    sync_mode: specOf(p, "sync_mode")?.default as NetworkConfig["sync_mode"],
    sync_interval_s: d("sync_interval_s"),
    sync_error_rms_s: d("sync_error_rms_s"),
    clock_correlation: d("clock_correlation"),
    non_clock: {
      calibration_rms_s: d("calibration_rms_s"),
      distribution_jitter_rms_s: d("distribution_jitter_rms_s"),
      propagation_random_walk_s_per_sqrt_s: d("propagation_random_walk_s_per_sqrt_s"),
      environmental_ramp_rms_per_s: d("environmental_ramp_rms_per_s"),
    },
    n_monte_carlo: d("n_monte_carlo"),
    seed: d("seed"),
  };
}

export default function Dashboard() {
  const [meta, setMeta] = useState<Async<{ scenarios: ScenarioList; params: ParametersResponse; limitations: LimitationsResponse }>>({ ...idle(), state: "loading" });
  const [selected, setSelected] = useState<string[]>([]);
  const [config, setConfig] = useState<NetworkConfig | null>(null);
  const [adevResult, setAdevResult] = useState<{ key: string; data: AdevResponse | null; error: string | null } | null>(null);
  const [coh, setCoh] = useState<Async<CoherenceResponse>>(idle());
  const [timing, setTiming] = useState<Async<TimingSeries>>(idle());
  const [timingKey, setTimingKey] = useState<string>("");
  const [pair, setPair] = useState<[number, number]>([0, 1]);
  const [ranConfig, setRanConfig] = useState<NetworkConfig | null>(null);
  const runAbort = useRef<AbortController | null>(null);
  const [activePreset, setActivePreset] = useState<string | null>(null);

  // Metadata: scenarios, parameter ranges, limitations. (Loading state is set by callers.)
  const fetchMeta = useCallback(() => {
    Promise.all([api.scenarios(), api.parameters(), api.limitations()])
      .then(([scenarios, params, limitations]) => {
        setMeta({ state: "ready", data: { scenarios, params, limitations }, error: null });
        const keys = scenarios.scenarios.map((s) => s.key);
        setSelected(keys);
        setTimingKey(keys.includes("sa65_industrial") ? "sa65_industrial" : keys[0]);
        setConfig(defaultConfig(params));
      })
      .catch((e) => setMeta({ state: "error", data: null, error: errMsg(e) }));
  }, []);
  useEffect(fetchMeta, [fetchMeta]);
  const retryMeta = () => {
    setMeta({ ...idle(), state: "loading" });
    fetchMeta();
  };

  // Allan deviation depends only on the scenario selection. Loading is derived (result key != request key).
  const adevKey = selected.join(",");
  useEffect(() => {
    if (meta.state !== "ready" || !adevKey) return;
    const ctrl = new AbortController();
    api.adev({ scenario_keys: adevKey.split(",") }, ctrl.signal)
      .then((data) => setAdevResult({ key: adevKey, data, error: null }))
      .catch((e) => !ctrl.signal.aborted && setAdevResult({ key: adevKey, data: null, error: errMsg(e) }));
    return () => ctrl.abort();
  }, [meta.state, adevKey]);
  const adev: Async<AdevResponse> =
    !adevKey ? idle()
      : adevResult?.key !== adevKey ? { state: "loading", data: null, error: null }
        : adevResult.error ? { state: "error", data: null, error: adevResult.error }
          : { state: "ready", data: adevResult.data, error: null };

  const runTiming = useCallback((cfg: NetworkConfig, key: string, p: [number, number], signal?: AbortSignal) => {
    setTiming((t) => ({ ...t, state: "loading", error: null }));
    return api.timing({ scenario_key: key, config: cfg, node_pair: p, max_points: 1200 }, signal)
      .then((data) => setTiming({ state: "ready", data, error: null }))
      .catch((e) => !signal?.aborted && setTiming({ state: "error", data: null, error: errMsg(e) }));
  }, []);

  const run = useCallback((cfg: NetworkConfig, keys: string[], tKey: string, p: [number, number]) => {
    runAbort.current?.abort();
    const ctrl = new AbortController();
    runAbort.current = ctrl;
    setRanConfig(cfg);
    setCoh((c) => ({ ...c, state: "loading", error: null }));
    api.coherence({ scenario_keys: keys, config: cfg }, ctrl.signal)
      .then((data) => setCoh({ state: "ready", data, error: null }))
      .catch((e) => !ctrl.signal.aborted && setCoh({ state: "error", data: null, error: errMsg(e) }));
    runTiming(cfg, tKey, p, ctrl.signal);
  }, [runTiming]);

  // Key insight: Phase 3 requirement at the default (assumed) configuration, shared with the value chain.
  const insightConfig = meta.data ? defaultConfig(meta.data.params) : null;
  const insight = useDefaultInsight();

  // First run with defaults once metadata is available.
  const firstRun = useRef(false);
  useEffect(() => {
    if (!firstRun.current && config && selected.length && timingKey) {
      firstRun.current = true;
      run(config, selected, timingKey, pair);
    }
  }, [config, selected, timingKey, pair, run]);

  if (meta.state !== "ready" || !meta.data || !config) {
    return (
      <div className="mx-auto w-full max-w-7xl px-6 py-10">
        <StatusBlock state={meta.state === "error" ? "error" : "loading"} height={260}
          error={meta.error ? `${meta.error}. Is the backend running on port 8000? Start it with: cd backend && .venv/bin/uvicorn app.main:app --reload --port 8000` : null} />
        {meta.state === "error" && (
          <button type="button" onClick={retryMeta} className="mx-auto mt-4 block rounded-lg border border-border px-4 py-2 text-sm hover:border-accent/60">
            Retry
          </button>
        )}
      </div>
    );
  }

  const { scenarios, params, limitations } = meta.data;
  const toggle = (key: string) => setSelected((s) => (s.includes(key) ? s.filter((k) => k !== key) : scenarios.scenarios.map((x) => x.key).filter((k) => k === key || s.includes(k))));
  const patch = (p: Partial<NetworkConfig>) => {
    setActivePreset(null);
    setConfig((c) => (c ? { ...c, ...p } : c));
  };
  const applyPreset = (preset: DemoPreset) => {
    const next = { ...config, ...preset.patch };
    const p: [number, number] = pair[0] < next.n_nodes && pair[1] < next.n_nodes ? pair : [0, 1];
    const key = selected.includes(timingKey) ? timingKey : selected[0];
    setActivePreset(preset.id);
    setConfig(next);
    setPair(p);
    setTimingKey(key);
    if (selected.length) run(next, selected, key, p);
  };
  const shown = ranConfig ?? config;
  const nodesForPair = ranConfig?.n_nodes ?? config.n_nodes;

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 px-4 py-8 sm:px-6">
      <Panel id="insight" eyebrow="Key insight" title="When does the clock matter?"
        subtitle="Live result for a 1 dB coherence-loss target, using default assumptions.">
        <KeyInsightPanel state={insight} config={insightConfig} />
      </Panel>
      <Panel id="demo" eyebrow="Guided demo" title="Run the demo"
        subtitle="Pick a preset or follow the five steps.">
        <GuidedDemo onPreset={applyPreset} activePreset={activePreset} running={coh.state === "loading"} />
      </Panel>
    <div className="grid w-full gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
      <aside className="lg:sticky lg:top-6 lg:self-start">
        <Panel id="controls" eyebrow="D · Controls" title="Simulation setup">
          <ControlsPanel
            params={params} scenarios={scenarios.scenarios} selected={selected} onToggle={toggle}
            config={config} onChange={patch} running={coh.state === "loading"}
            onRun={() => {
              const p: [number, number] = pair[0] < config.n_nodes && pair[1] < config.n_nodes ? pair : [0, 1];
              setPair(p);
              const key = selected.includes(timingKey) ? timingKey : selected[0];
              setTimingKey(key);
              run(config, selected, key, p);
            }}
          />
        </Panel>
      </aside>

      <div className="min-w-0 space-y-6">
        <Panel id="clock" eyebrow="A · Clock stability" title="Allan deviation by clock scenario"
          subtitle="Analytic ADEV of each scenario's assumed noise model, with simulated estimates, sourced SA65 datasheet points and the hypothetical NextGen target.">
          {adev.state === "ready" && adev.data ? (
            <ClockStabilityPanel adev={adev.data} scenarios={scenarios} />
          ) : (
            <StatusBlock state={adev.state} error={adev.error} empty="Select at least one clock scenario." height={380} />
          )}
        </Panel>

        <Panel id="timing" eyebrow="B · Timing error" title="Relative timing error between two satellite radar nodes"
          subtitle={`After synchronisation (${shown.sync_mode === "none" ? "single alignment at t = 0" : `${shown.sync_mode.replace("_", " + ")} sync every ${shown.sync_interval_s} s`}), split into clock-induced and non-clock contributions.`}
          actions={
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <select aria-label="Scenario for timing error" className="rounded-md border border-border bg-background/60 px-2 py-1"
                value={timingKey}
                onChange={(e) => { setTimingKey(e.target.value); if (ranConfig) runTiming(ranConfig, e.target.value, pair); }}>
                {selected.map((k) => <option key={k} value={k}>{styleFor(k).short}</option>)}
              </select>
              {[0, 1].map((side) => (
                <select key={side} aria-label={side === 0 ? "First satellite" : "Second satellite"} className="rounded-md border border-border bg-background/60 px-2 py-1"
                  value={pair[side]}
                  onChange={(e) => {
                    const p: [number, number] = side === 0 ? [Number(e.target.value), pair[1]] : [pair[0], Number(e.target.value)];
                    setPair(p);
                    if (ranConfig && p[0] !== p[1]) runTiming(ranConfig, timingKey, p);
                  }}>
                  {Array.from({ length: nodesForPair }, (_, i) => <option key={i} value={i}>Satellite {i}</option>)}
                </select>
              ))}
            </div>
          }>
          {timing.state === "ready" && timing.data ? (
            <TimingErrorPanel data={timing.data} />
          ) : (
            <StatusBlock state={timing.state} error={timing.error} empty="Run a simulation to see timing errors." height={320} />
          )}
        </Panel>

        <Panel id="coherence" eyebrow="C · Radar coherence" title="Coherent integration loss"
          subtitle={`Same configuration and random numbers for every scenario: ${formatHz(shown.carrier_frequency_hz)} carrier, ${shown.n_nodes} satellite radar nodes, ${shown.observation_s} s observation. Loss = −10·log₁₀(mean coherent gain); clock-only and non-clock-only losses separate the error sources.`}>
          {coh.state === "ready" && coh.data ? (
            <CoherencePanel data={coh.data} />
          ) : (
            <StatusBlock state={coh.state} error={coh.error} empty="Run a simulation to compute coherence metrics." height={300} />
          )}
        </Panel>

        <Phase3Section config={ranConfig} scenarios={scenarios.scenarios} selected={selected}
          maxSamples={params.limits.max_samples_per_node} />

        <Panel id="provenance" eyebrow="E · Provenance & limitations" title="What is sourced, assumed, hypothetical and simulated"
          subtitle="Every number in this dashboard carries one of four labels. Hover a badge for its definition.">
          <ProvenancePanel scenarios={scenarios} limitations={limitations} />
        </Panel>
      </div>
    </div>
    </div>
  );
}
