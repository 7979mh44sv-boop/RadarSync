"use client";

import LineChart, { type LineSeries, type PointSeries } from "@/components/charts/LineChart";
import Legend, { type LegendItem } from "@/components/charts/Legend";
import ProvenanceBadge from "@/components/ProvenanceBadge";
import type { AdevResponse, ScenarioList } from "@/lib/api";
import { formatSci, formatSeconds } from "@/lib/format";
import { styleFor } from "@/lib/scenarios";

export function buildAdevChart(adev: AdevResponse, scenarios: ScenarioList) {
  const keys = new Set(adev.curves.map((c) => c.scenario_key));
  const lines: LineSeries[] = adev.curves.map((c) => ({
    id: c.scenario_key,
    label: styleFor(c.scenario_key).short,
    color: styleFor(c.scenario_key).color,
    dash: styleFor(c.scenario_key).dash,
    x: c.tau_s,
    y: c.model_adev,
    emphasis: c.constrained,
  }));
  const points: PointSeries[] = adev.curves
    .filter((c) => c.simulated_tau_s && c.simulated_adev)
    .map((c) => ({
      id: `${c.scenario_key}-sim`,
      label: `${styleFor(c.scenario_key).short} (simulated estimate)`,
      color: styleFor(c.scenario_key).color,
      x: c.simulated_tau_s!,
      y: c.simulated_adev!,
      shape: "circle" as const,
      size: 2.8,
      titles: c.simulated_tau_s!.map((t, i) => `SIMULATED overlapping ADEV, ${styleFor(c.scenario_key).short}: τ = ${formatSeconds(t)}, σy = ${formatSci(c.simulated_adev![i])}`),
    }));
  if (keys.has("sa65_industrial")) {
    const d = scenarios.sa65_datasheet_adev;
    points.push({
      id: "sa65-datasheet", label: "SA65 datasheet ADEV (sourced)", color: styleFor("sa65_industrial").color,
      x: d.map((p) => p.tau_s), y: d.map((p) => p.adev), shape: "square", hollow: true, size: 5.5,
      titles: d.map((p) => `SOURCED: σy(${p.tau_s} s) = ${formatSci(p.adev)} — ${p.source}`),
    });
  }
  if (keys.has("nextgen_white_fm") || keys.has("nextgen_flicker_floor")) {
    const t = scenarios.nextgen_target;
    points.push({
      id: "nextgen-target", label: "NextGen target, upper bound (hypothetical)", color: styleFor("nextgen_white_fm").color,
      x: [t.tau_s], y: [t.adev], shape: "triangle", hollow: true, size: 6.5,
      titles: [`HYPOTHETICAL TARGET: σy(1 s) < ${formatSci(t.adev)} — not measured. ${t.source}`],
    });
  }
  return { lines, points };
}

export default function ClockStabilityPanel({ adev, scenarios, width }: {
  adev: AdevResponse;
  scenarios: ScenarioList;
  width?: number;
}) {
  const { lines, points } = buildAdevChart(adev, scenarios);
  const legend: LegendItem[] = [
    ...lines.map((l) => ({ id: l.id, label: l.label, color: l.color, dash: l.dash })),
    ...points.filter((p) => !p.id.endsWith("-sim")).map((p) => ({
      id: p.id, label: p.label, color: p.color, marker: p.shape === "square" ? ("square" as const) : ("triangle" as const), hollow: true,
    })),
    { id: "sim", label: "Simulated estimate (one seeded run)", color: "#8b96a8", marker: "circle" as const },
  ];
  return (
    <div className="space-y-4">
      <Legend items={legend} />
      <LineChart
        width={width}
        ariaLabel="Allan deviation versus averaging time for the selected clock scenarios, log-log axes"
        lines={lines}
        points={points}
        xScale="log"
        yScale="log"
        xLabel="Averaging time τ [s]"
        yLabel="Allan deviation σy(τ) [dimensionless]"
        tooltipX={(v) => `τ = ${formatSeconds(v)}`}
        tooltipY={(v) => `σy = ${formatSci(v)}`}
        height={380}
      />
      <div className="grid gap-3 text-xs leading-relaxed text-muted md:grid-cols-3">
        <p><span className="text-foreground">Thick segments</span> are constrained by data: the SA65 datasheet table (τ = 1–1000 s). <span className="text-foreground">Thin, faded segments</span> are extrapolations of the assumed power-law model. Sub-second SA65 behaviour is uncertain.</p>
        <p className="flex flex-wrap items-start gap-1.5"><ProvenanceBadge kind="hypothetical_target" /> NextGen is constrained only at τ = 1 s by the challenge target (an upper bound, not a measurement). Both variants are assumed noise mixes and include SA65-level aging drift.</p>
        <p className="flex flex-wrap items-start gap-1.5"><ProvenanceBadge kind="assumption" /> The OCXO curve uses illustrative coefficients; it is not a sourced commercial product. <ProvenanceBadge kind="simulated" /> dots: overlapping ADEV of one seeded realisation (seed {adev.seed}).</p>
      </div>
    </div>
  );
}
