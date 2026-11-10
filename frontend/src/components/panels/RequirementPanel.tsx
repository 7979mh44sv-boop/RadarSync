"use client";

import LineChart, { type LineSeries, type PointSeries, type RefLine } from "@/components/charts/LineChart";
import Legend from "@/components/charts/Legend";
import ProvenanceBadge from "@/components/ProvenanceBadge";
import { Stat } from "@/components/Panel";
import type { RequirementsResponse, RequirementResult } from "@/lib/api";
import { formatDb, formatSci } from "@/lib/format";
import { NEUTRAL_SERIES, styleFor } from "@/lib/scenarios";
import { STATUS_INFO, clampForLog } from "@/lib/sensitivity";

const SOURCED_REF = "#c3c9d4";
const HYPOTHETICAL_REF = "#b4a7f5";
const Y_FLOOR = 1e-3;

const TONE: Record<string, string> = {
  good: "border-accent/50 text-accent",
  warn: "border-warning/60 text-warning",
  bad: "border-danger/60 text-danger",
  info: "border-accent-2/60 text-accent-2",
};

export function buildRequirementChart(data: RequirementsResponse) {
  const lines: LineSeries[] = data.results.map((r) => ({
    id: r.base_scenario_key,
    label: `${styleFor(r.base_scenario_key).short} shape`,
    color: styleFor(r.base_scenario_key).color,
    dash: styleFor(r.base_scenario_key).dash,
    x: r.curve.map((p) => p.adev_1s),
    y: clampForLog(r.curve.map((p) => p.total.loss_db), Y_FLOOR),
    band: {
      lo: clampForLog(r.curve.map((p) => p.total.band_db[0]), Y_FLOOR),
      hi: clampForLog(r.curve.map((p) => p.total.band_db[1]), Y_FLOOR),
    },
  }));
  const markers: PointSeries[] = data.results
    .filter((r) => r.required_adev_1s !== null && (r.status === "determined" || r.status === "ambiguous_non_monotonic"))
    .map((r) => ({
      id: `${r.base_scenario_key}-req`,
      label: `${styleFor(r.base_scenario_key).short}: modelled requirement`,
      color: styleFor(r.base_scenario_key).color,
      x: [r.required_adev_1s!],
      y: [data.target_loss_db],
      shape: "circle" as const,
      hollow: true,
      size: 6,
      titles: [`Modelled requirement (${STATUS_INFO[r.status].label}): σy(1 s) ≤ ${formatSci(r.required_adev_1s!)} for the ${styleFor(r.base_scenario_key).short} noise shape`],
    }));
  const floor = Math.max(...data.results.map((r) => r.floor.loss_db));
  const hLines: RefLine[] = [
    { value: data.target_loss_db, label: `Target ${formatDb(data.target_loss_db)}`, color: "#e6edf7", dash: "6 4" },
    { value: Math.max(floor, Y_FLOOR), label: `Non-clock floor ${formatDb(floor)} (simulated)`, color: NEUTRAL_SERIES, dash: "2 3" },
    { value: data.loss_ceiling_db, label: `Random-phase ceiling ${formatDb(data.loss_ceiling_db)}`, color: "#4a5d7a", dash: "1 4" },
  ];
  const sa65 = data.references.find((r) => r.provenance === "sourced");
  const ng = data.references.find((r) => r.provenance === "hypothetical_target");
  const xRefs: RefLine[] = [
    ...(sa65 ? [{ value: sa65.adev, label: `SA65 datasheet σy(1 s) = ${formatSci(sa65.adev)} · SOURCED`, color: SOURCED_REF, dash: "5 3" }] : []),
    ...(ng ? [{ value: ng.adev, label: `NextGen target < ${formatSci(ng.adev)} · HYPOTHETICAL`, color: HYPOTHETICAL_REF, dash: "1 3" }] : []),
  ];
  const yMax = 10 ** Math.ceil(Math.log10(data.loss_ceiling_db * 1.2));
  return { lines, markers, hLines, xRefs, yDomain: [Y_FLOOR, yMax] as [number, number] };
}

function ResultCard({ r, target, metric }: { r: RequirementResult; target: number; metric: string }) {
  const info = STATUS_INFO[r.status];
  const base = r.base_clock_at_scale_1[metric as "temporal" | "spatial"].total;
  const [blo, bhi] = r.approximate_bracket_adev_1s ?? [null, null];
  return (
    <article className="flex flex-col rounded-xl border border-border bg-background/40 p-4">
      <header className="flex flex-wrap items-center gap-2">
        <span className="inline-block h-2 w-2 rounded-full" style={{ background: styleFor(r.base_scenario_key).color }} />
        <h4 className="text-sm font-medium">{styleFor(r.base_scenario_key).short} noise shape</h4>
        <ProvenanceBadge kind={r.base_category} />
      </header>
      <div className={`mt-3 inline-flex w-fit items-center gap-1.5 rounded-md border px-2 py-1 text-xs ${TONE[info.tone]}`}>
        <span aria-hidden>{info.icon}</span>
        {info.label}
      </div>
      {r.required_adev_1s !== null ? (
        <div className="mt-3">
          <div className="text-[11px] uppercase tracking-wider text-muted">Modelled requirement</div>
          <div className="font-mono text-lg">σy(1 s) ≤ {formatSci(r.required_adev_1s)}</div>
          {r.status === "determined" && (
            <div className="mt-0.5 text-[11px] text-muted">
              Approx. Monte Carlo bracket: {blo === null ? "below range" : formatSci(blo)} – {bhi === null ? "above range" : formatSci(bhi)}
            </div>
          )}
          {r.status === "not_binding_in_range" && <div className="mt-0.5 text-[11px] text-muted">Lower bound only: met up to the top of the evaluated range.</div>}
        </div>
      ) : (
        <div className="mt-3 text-sm text-muted">No requirement can be stated for this range and target.</div>
      )}
      <p className="mt-2 text-xs leading-relaxed text-muted">{info.explain}</p>
      {r.required_adev_at_tau && (
        <table className="mt-3 w-full text-left text-[11px]">
          <caption className="mb-1 text-left text-muted">Scaled ADEV of this shape at system averaging times</caption>
          <tbody className="font-mono">
            {Object.entries(r.required_adev_at_tau).map(([k, v]) => (
              <tr key={k} className="border-t border-border/50"><td className="py-0.5 pr-2 font-sans text-muted">{k}</td><td className="py-0.5">≤ {formatSci(v)}</td></tr>
            ))}
          </tbody>
        </table>
      )}
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Stat label="Non-clock floor" value={formatDb(r.floor.loss_db)} hint="simulated" />
        <Stat label="Base model as specified" value={formatDb(base.loss_db)} hint={`σy(1 s) = ${formatSci(r.base_adev_1s)} · ${base.loss_db <= target ? "meets" : "misses"} target`} />
      </div>
      <details className="mt-3 text-[11px] leading-relaxed text-muted">
        <summary className="cursor-pointer text-foreground/80">Assumptions &amp; warnings ({r.warnings.length + r.messages.length})</summary>
        <ul className="mt-1 list-disc space-y-1 pl-4">
          {[...r.messages, ...r.warnings].map((m) => <li key={m}>{m}</li>)}
        </ul>
      </details>
    </article>
  );
}

export default function RequirementPanel({ data, width }: { data: RequirementsResponse; width?: number }) {
  const { lines, markers, hLines, xRefs, yDomain } = buildRequirementChart(data);
  const share: LineSeries[] = data.results.map((r) => ({
    id: `${r.base_scenario_key}-share`, label: `${styleFor(r.base_scenario_key).short} shape`,
    color: styleFor(r.base_scenario_key).color, dash: styleFor(r.base_scenario_key).dash,
    x: r.curve.map((p) => p.adev_1s), y: r.curve.map((p) => 100 * p.clock_variance_fraction),
  }));
  const metricLabel = data.metric === "spatial" ? "Spatial" : "Temporal";
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
        <ProvenanceBadge kind="simulated" />
        <span>
          Curves, floors and requirements are simulated ({data.n_monte_carlo} Monte Carlo runs, seed {data.seed}). Shaded bands: mean ± 2 standard errors —
          an approximate Monte Carlo band, not a validated confidence interval.
        </span>
      </div>
      <Legend items={[
        ...lines.map((l) => ({ id: l.id, label: l.label, color: l.color, dash: l.dash })),
        { id: "req", label: "Modelled requirement (at target)", color: "#e6edf7", marker: "circle" as const, hollow: true },
        { id: "src", label: "Sourced reference", color: SOURCED_REF, dash: "5 3" },
        { id: "hyp", label: "Hypothetical reference", color: HYPOTHETICAL_REF, dash: "1 3" },
      ]} />
      <LineChart
        width={width}
        ariaLabel={`${metricLabel} coherent integration loss versus sigma_y at 1 s of the scaled clock, by base noise shape, log-log`}
        lines={lines}
        points={markers}
        xScale="log"
        yScale="log"
        yDomain={yDomain}
        hLines={hLines}
        xRefs={xRefs}
        xLabel="σy(1 s) of the scaled clock model [dimensionless]"
        yLabel={`${metricLabel} loss, total [dB]`}
        tooltipX={(v) => `σy(1 s) = ${formatSci(v)}`}
        tooltipY={(v) => (v <= Y_FLOOR ? `≤ ${formatDb(Y_FLOOR)}` : formatDb(v))}
        height={380}
      />
      <p className="text-[11px] text-muted">Losses below {formatDb(Y_FLOOR)} are drawn at the axis floor. Each curve scales one base noise model uniformly; the x-axis shows the resulting σy(1 s).</p>
      <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
        {data.results.map((r) => <ResultCard key={r.base_scenario_key} r={r} target={data.target_loss_db} metric={data.metric} />)}
      </div>
      <div>
        <h3 className="text-sm font-medium">Clock versus non-clock influence</h3>
        <p className="mb-2 text-xs text-muted">Share of the relative time-error variance caused by the clock (the rest is synchronisation, calibration, distribution and propagation error).</p>
        <LineChart
          width={width}
          ariaLabel="Clock share of relative time-error variance versus sigma_y at 1 s"
          lines={share}
          xScale="log"
          yScale="linear"
          yDomain={[0, 100]}
          xRefs={xRefs}
          xLabel="σy(1 s) of the scaled clock model [dimensionless]"
          yLabel="Clock share of variance [%]"
          tooltipX={(v) => `σy(1 s) = ${formatSci(v)}`}
          tooltipY={(v) => `${v.toFixed(1)} %`}
          height={240}
        />
      </div>
      <ul className="list-disc space-y-1 pl-5 text-xs text-muted">
        {data.notes.map((n) => <li key={n}>{n}</li>)}
        <li>A modelled requirement is not a verified device capability, and no measured radar performance or detection range is implied.</li>
      </ul>
    </div>
  );
}
