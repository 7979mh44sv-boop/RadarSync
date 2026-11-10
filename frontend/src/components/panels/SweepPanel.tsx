"use client";

import LineChart, { type LineSeries } from "@/components/charts/LineChart";
import Legend from "@/components/charts/Legend";
import type { CoherenceMetric, SweepResponse } from "@/lib/api";
import { formatDb, formatHz, formatSci } from "@/lib/format";
import { NEUTRAL_SERIES, styleFor } from "@/lib/scenarios";
import { clampForLog, sweepAxisKind } from "@/lib/sensitivity";

const Y_FLOOR = 1e-3;
const LABELS: Record<string, string> = {
  clock_scale: "Clock-noise scale s (σy → s·σy) [dimensionless]",
  carrier_frequency_hz: "Carrier frequency [GHz]",
  n_nodes: "Number of radar nodes",
  observation_s: "Observation duration [s]",
  sync_interval_s: "Synchronisation interval [s]",
  clock_correlation: "Clock correlation ρ [dimensionless]",
  sync_mode: "Synchronisation mode",
};

function fmtValue(param: string, v: number | string) {
  if (typeof v === "string") return v.replace("_", " + ");
  if (param === "carrier_frequency_hz") return formatHz(v);
  if (param === "clock_scale") return formatSci(v);
  return `${v}${param.endsWith("_s") ? " s" : ""}`;
}

export default function SweepPanel({ data, metric, width }: { data: SweepResponse; metric: CoherenceMetric; width?: number }) {
  const param = data.parameter;
  const numeric = data.series[0]?.values.every((v) => typeof v === "number");
  const xScale = sweepAxisKind(param);
  const xOf = (v: number | string) => (param === "carrier_frequency_hz" ? Number(v) / 1e9 : Number(v));
  const lines: LineSeries[] = data.series.map((s) => ({
    id: s.scenario_key, label: styleFor(s.scenario_key).short,
    color: styleFor(s.scenario_key).color, dash: styleFor(s.scenario_key).dash,
    x: s.values.map(xOf),
    y: clampForLog(s.points.map((p) => p[metric].total.loss_db), Y_FLOOR),
    band: {
      lo: clampForLog(s.points.map((p) => p[metric].total.band_db[0]), Y_FLOOR),
      hi: clampForLog(s.points.map((p) => p[metric].total.band_db[1]), Y_FLOOR),
    },
  }));
  if (data.series[0]) {
    const s = data.series[0];
    lines.push({
      id: "non_clock", label: "Non-clock only (same for all clocks)", color: NEUTRAL_SERIES, dash: "2 3", width: 1.5,
      x: s.values.map(xOf), y: clampForLog(s.points.map((p) => p[metric].non_clock.loss_db), Y_FLOOR),
    });
  }
  const ceilings = metric === "spatial" ? data.loss_ceiling_spatial_db : data.loss_ceiling_temporal_db;
  const yMax = 10 ** Math.ceil(Math.log10(Math.max(...ceilings) * 1.2));
  return (
    <div className="space-y-4">
      {numeric ? (
        <>
          <Legend items={lines.map((l) => ({ id: l.id, label: l.label, color: l.color, dash: l.dash }))} />
          <LineChart
            width={width}
            ariaLabel={`${metric} coherent integration loss versus ${LABELS[param]}`}
            lines={lines}
            xScale={xScale}
            yScale="log"
            yDomain={[Y_FLOOR, yMax]}
            hLines={new Set(ceilings).size === 1 ? [{ value: ceilings[0], label: `Random-phase ceiling ${formatDb(ceilings[0])}`, color: "#4a5d7a", dash: "1 4" }] : []}
            xLabel={LABELS[param]}
            yLabel={`${metric === "spatial" ? "Spatial" : "Temporal"} loss, total [dB]`}
            xTickFormat={xScale === "log" ? undefined : (v) => String(v)}
            tooltipX={(v) => (param === "carrier_frequency_hz" ? formatHz(v * 1e9) : fmtValue(param, v))}
            tooltipY={(v) => (v <= Y_FLOOR ? `≤ ${formatDb(Y_FLOOR)}` : formatDb(v))}
            height={320}
          />
          <p className="text-[11px] text-muted">Shaded: mean ± 2 SE (approximate Monte Carlo band). Losses below {formatDb(Y_FLOOR)} are drawn at the axis floor.</p>
        </>
      ) : null}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-xs">
          <caption className="mb-2 text-left text-[11px] uppercase tracking-wider text-muted">
            {metric === "spatial" ? "Spatial" : "Temporal"} loss by {LABELS[param].replace(/ \[.*\]$/, "").toLowerCase()} (total / clock-only / non-clock-only; simulated)
          </caption>
          <thead className="text-muted">
            <tr>
              <th className="py-1 pr-3 font-normal">Value</th>
              {data.series.map((s) => <th key={s.scenario_key} className="py-1 pr-3 font-normal">{styleFor(s.scenario_key).short}</th>)}
            </tr>
          </thead>
          <tbody className="font-mono">
            {data.series[0]?.values.map((v, i) => (
              <tr key={String(v)} className="border-t border-border/60">
                <td className="py-1 pr-3 font-sans text-foreground/90">{fmtValue(param, v)}</td>
                {data.series.map((s) => {
                  const m = s.points[i][metric];
                  return (
                    <td key={s.scenario_key} className="py-1 pr-3">
                      {formatDb(m.total.loss_db)}{m.total.se_db !== null ? ` ±${Number((2 * m.total.se_db).toPrecision(2))}` : ""} / {formatDb(m.clock.loss_db)} / {formatDb(m.non_clock.loss_db)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data.series.some((s) => s.monotonic_check) && (
        <p className="text-[11px] text-muted">Monotonicity check: {data.series.map((s) => `${styleFor(s.scenario_key).short} — ${s.monotonic_check}`).join(" · ")}</p>
      )}
      <ul className="list-disc space-y-1 pl-5 text-xs text-muted">
        {data.notes.map((n) => <li key={n}>{n}</li>)}
      </ul>
    </div>
  );
}
