"use client";

import Legend from "@/components/charts/Legend";
import LossBars, { type LossRow } from "@/components/charts/LossBars";
import ProvenanceBadge from "@/components/ProvenanceBadge";
import type { CoherenceResponse } from "@/lib/api";
import { formatDb, formatSeconds } from "@/lib/format";
import { NEUTRAL_SERIES, styleFor } from "@/lib/scenarios";

function rows(data: CoherenceResponse, kind: "temporal" | "spatial"): LossRow[] {
  return data.results.map((r) => ({
    key: r.scenario_key,
    label: styleFor(r.scenario_key).short,
    color: styleFor(r.scenario_key).color,
    total: r.metrics[`total_${kind}_loss`].value,
    clock: r.metrics[`clock_${kind}_loss`].value,
    nonClock: r.metrics[`non_clock_${kind}_loss`].value,
  }));
}

export default function CoherencePanel({ data, width }: { data: CoherenceResponse; width?: number }) {
  const p = data.config_parameters;
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
        <ProvenanceBadge kind="simulated" />
        <span>
          Monte Carlo mean of {data.n_monte_carlo} runs (seed {data.seed}). Confidence intervals are not computed, so small
          differences between scenarios should not be read as significant.
        </span>
      </div>
      <Legend items={[
        { id: "t", label: "Total", color: "#e6edf7", marker: "square" },
        { id: "c", label: "Clock-induced only", color: "#e6edf7", marker: "hatch" },
        { id: "n", label: "Non-clock only", color: NEUTRAL_SERIES, marker: "square" },
      ]} />
      <div className="grid gap-6 xl:grid-cols-2">
        <div>
          <h3 className="text-sm font-medium">Temporal: within one CPI, per bistatic node pair</h3>
          <p className="mb-2 text-xs text-muted">
            Phase variation of each node pair inside a {formatSeconds(p.cpi_s.value)} coherent processing interval. A constant offset cancels.
            Ceiling for fully random phase: {formatDb(data.loss_ceiling_temporal_db)}.
          </p>
          <LossBars width={width} rows={rows(data, "temporal")} ceilingDb={data.loss_ceiling_temporal_db} ariaLabel="Temporal coherent integration loss by scenario in dB" />
        </div>
        <div>
          <h3 className="text-sm font-medium">Spatial: across all {p.n_nodes.value} nodes at one instant</h3>
          <p className="mb-2 text-xs text-muted">
            Coherent combination of all node phases; absolute node-to-node offsets (sync, calibration) matter.
            Ceiling for fully random phase: {formatDb(data.loss_ceiling_spatial_db)}.
          </p>
          <LossBars width={width} rows={rows(data, "spatial")} ceilingDb={data.loss_ceiling_spatial_db} ariaLabel="Spatial coherent combination loss by scenario in dB" />
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-xs">
          <caption className="mb-2 text-left text-[11px] uppercase tracking-wider text-muted">Table view (all values simulated)</caption>
          <thead className="text-muted">
            <tr>
              <th className="py-1 pr-3 font-normal">Scenario</th>
              <th className="py-1 pr-3 font-normal">rms rel. time error (total / clock / non-clock)</th>
              <th className="py-1 pr-3 font-normal">rms rel. phase</th>
              <th className="py-1 pr-3 font-normal">Temporal loss (total / clock / non-clock)</th>
              <th className="py-1 pr-3 font-normal">Spatial loss (total / clock / non-clock)</th>
              <th className="py-1 font-normal">Clock share of variance</th>
            </tr>
          </thead>
          <tbody className="font-mono">
            {data.results.map((r) => {
              const m = r.metrics;
              return (
                <tr key={r.scenario_key} className="border-t border-border/60 align-top">
                  <td className="py-1.5 pr-3 font-sans text-foreground/90">
                    <span className="mr-1.5 inline-block h-2 w-2 rounded-full" style={{ background: styleFor(r.scenario_key).color }} />
                    {styleFor(r.scenario_key).short}
                  </td>
                  <td className="py-1.5 pr-3">{formatSeconds(m.total_rms_relative_time_error.value)} / {formatSeconds(m.clock_rms_relative_time_error.value)} / {formatSeconds(m.non_clock_rms_relative_time_error.value)}</td>
                  <td className="py-1.5 pr-3">{Number(m.total_rms_relative_phase_error.value.toPrecision(3))} rad</td>
                  <td className="py-1.5 pr-3">{formatDb(m.total_temporal_loss.value)} / {formatDb(m.clock_temporal_loss.value)} / {formatDb(m.non_clock_temporal_loss.value)}</td>
                  <td className="py-1.5 pr-3">{formatDb(m.total_spatial_loss.value)} / {formatDb(m.clock_spatial_loss.value)} / {formatDb(m.non_clock_spatial_loss.value)}</td>
                  <td className="py-1.5">{(100 * m.clock_variance_fraction.value).toFixed(1)} %</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <ul className="list-disc space-y-1 pl-5 text-xs text-muted">
        {data.notes.map((n) => <li key={n}>{n}</li>)}
        <li>Sub-second CPIs extrapolate the SA65 model below its datasheet-constrained range; its temporal loss is therefore uncertain (see Provenance &amp; limitations).</li>
      </ul>
    </div>
  );
}
