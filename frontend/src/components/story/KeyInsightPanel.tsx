"use client";

import ProvenanceBadge from "@/components/ProvenanceBadge";
import { StatusBlock } from "@/components/Panel";
import type { NetworkConfig, RequirementsResponse } from "@/lib/api";
import { formatDb, formatHz, formatSci } from "@/lib/format";
import { deriveKeyInsight } from "@/lib/insight";
import type { ApiState } from "@/lib/useApiRequest";

function Tile({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-xl border border-border bg-background/40 p-4">
      <div className="text-[11px] uppercase tracking-wider text-muted">{label}</div>
      <div className="mt-1 font-mono text-xl text-foreground">{value}</div>
      <div className="mt-1 text-xs leading-relaxed text-muted">{hint}</div>
    </div>
  );
}

export function KeyInsightContent({ data, config }: { data: RequirementsResponse; config: NetworkConfig }) {
  const ins = deriveKeyInsight(data);
  const metric = ins.metric === "spatial" ? "spatial (across satellites)" : "temporal (within one CPI)";
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
        <ProvenanceBadge kind="simulated" />
        <span>Computed live by the Phase 3 requirement solver ({data.n_monte_carlo} Monte Carlo runs, seed {data.seed}); approximate Monte Carlo bands, no validated confidence intervals.</span>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <Tile
          label={`Clock stability for ≤ ${formatDb(ins.targetDb)} ${ins.metric} loss`}
          value={ins.requirementRange ? `σy(1 s) ≤ ${formatSci(ins.requirementRange[0])}${ins.requirementRange[0] !== ins.requirementRange[1] ? ` … ${formatSci(ins.requirementRange[1])}` : ""}` : "not determined"}
          hint={ins.requirementRange
            ? `Modelled requirement across ${ins.determinedCount} of ${ins.totalShapes} clock noise shapes; the spread shows that one ADEV number is not a complete specification. Not a verified device capability.`
            : "No requirement could be determined in the evaluated range (see panel F for each status)."}
        />
        <Tile
          label="Where the clock stops mattering"
          value={ins.floorDominatedBelow ? `σy(1 s) < ${formatSci(ins.floorDominatedBelow)}` : "not reached"}
          hint={`Below this, the clock causes less than ${Math.round(ins.shareThreshold * 100)} % of the relative timing-error variance: non-clock errors (sync, calibration, distribution, propagation) dominate and the loss sits on the ${formatDb(ins.floorDb)} non-clock floor.`}
        />
        <Tile
          label="Today vs. hypothetical"
          value={ins.sa65AtSpecDb !== null ? `SA65: ${formatDb(ins.sa65AtSpecDb)}` : "—"}
          hint={`Simulated ${ins.metric} loss of the SA65 model at its datasheet stability (sourced ADEV, assumed noise mix)${ins.nextgenAtSpecDb.length ? `; the hypothetical NextGen CSAC models reach ${ins.nextgenAtSpecDb.map(formatDb).join(" / ")}, i.e. the non-clock floor, so extra stability beyond the requirement adds no benefit in this configuration` : ""}.`}
        />
      </div>
      <p className="text-sm leading-relaxed text-foreground/90">
        <span className="font-semibold text-accent">Insight: </span>
        under these assumptions, clock stability limits {metric} coherence when σy(1 s) is worse than roughly
        {" "}{ins.requirementRange ? formatSci(ins.requirementRange[1]) : "the evaluated range"}; once it is below about
        {" "}{ins.floorDominatedBelow ? formatSci(ins.floorDominatedBelow) : "the evaluated range"}, the non-clock error budget dominates, and improving it — not the clock — is what lowers the loss.
        {ins.infeasible ? " For this target, non-clock errors alone exceed it." : ""}
      </p>
      <details className="rounded-lg border border-border/70 px-3 py-2 text-xs text-muted">
        <summary className="cursor-pointer text-foreground/85">Assumptions behind these numbers</summary>
        <ul className="mt-2 list-disc space-y-1 pl-4">
          <li>Default configuration (all <ProvenanceBadge kind="assumption" />): {formatHz(config.carrier_frequency_hz)} carrier, {config.n_nodes} satellite radar nodes, {config.observation_s} s observation, {config.cpi_s * 1000} ms CPI, {config.sync_mode.replace("_", " + ")} sync every {config.sync_interval_s} s.</li>
          <li>Non-clock budget: {config.sync_error_rms_s * 1e12} ps sync error, {config.non_clock.calibration_rms_s * 1e12} ps calibration, {config.non_clock.distribution_jitter_rms_s * 1e12} ps jitter, {config.non_clock.propagation_random_walk_s_per_sqrt_s * 1e12} ps/√s propagation — illustrative values.</li>
          <li>Each clock model is scaled uniformly in σy(τ); SA65 is datasheet-constrained only at 1–1000 s; the OCXO is illustrative; NextGen is hypothetical.</li>
          <li>Orbital dynamics, the inter-satellite link and SAR imaging are not simulated; only timing and phase errors are.</li>
        </ul>
      </details>
    </div>
  );
}

export default function KeyInsightPanel({ state, config }: { state: ApiState<RequirementsResponse>; config: NetworkConfig | null }) {
  if (state.state === "ready" && state.data && config) return <KeyInsightContent data={state.data} config={config} />;
  return <StatusBlock state={state.state === "idle" ? "loading" : state.state} error={state.error} height={160} />;
}
