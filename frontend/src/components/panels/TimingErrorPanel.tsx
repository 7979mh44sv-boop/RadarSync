"use client";

import LineChart from "@/components/charts/LineChart";
import Legend from "@/components/charts/Legend";
import { Stat } from "@/components/Panel";
import type { TimingSeries } from "@/lib/api";
import { chooseTimeUnit, formatSeconds, linearTicks } from "@/lib/format";
import { NEUTRAL_SERIES, TOTAL_SERIES, styleFor } from "@/lib/scenarios";

const CATEGORY_LABEL: Record<string, string> = {
  clock: "Clock (oscillator noise + drift)",
  synchronization: "Synchronization measurement",
  calibration: "Calibration residual",
  distribution: "Distribution jitter",
  propagation: "Propagation wander",
  environmental: "Environmental ramp",
};

export default function TimingErrorPanel({ data, width }: { data: TimingSeries; width?: number }) {
  const maxAbs = Math.max(...data.total_s.map(Math.abs), ...data.clock_s.map(Math.abs), ...data.non_clock_s.map(Math.abs));
  const u = chooseTimeUnit(maxAbs);
  const scale = (a: number[]) => a.map((v) => v * u.factor);
  const color = styleFor(data.scenario_key).color;
  const [i, j] = data.node_pair;
  const totalLine = [{ id: "total", label: "Total", color: TOTAL_SERIES, x: data.t_s, y: scale(data.total_s), width: 1.75 }];
  const partLines = [
    { id: "clock", label: "Clock-induced", color, x: data.t_s, y: scale(data.clock_s), width: 2 },
    { id: "non_clock", label: "Non-clock", color: NEUTRAL_SERIES, x: data.t_s, y: scale(data.non_clock_s), width: 1.5 },
  ];
  // Shared, symmetric y-domain so both small multiples are directly comparable.
  const m = maxAbs * u.factor;
  const tick = linearTicks(-m, m, 4);
  const step = tick.length > 1 ? tick[1] - tick[0] : m || 1;
  const yDomain: [number, number] = [-Math.ceil(m / step) * step || -1, Math.ceil(m / step) * step || 1];
  const epochs = data.sync_epochs_s.length <= 120 ? data.sync_epochs_s : [];
  const contributions = Object.entries(data.contribution_rms_s).sort((a, b) => b[1].value - a[1].value);
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="rms total" value={formatSeconds(data.rms_s.total.value)} hint={`node ${i} − node ${j}`} />
        <Stat label="rms clock-induced" value={formatSeconds(data.rms_s.clock.value)} />
        <Stat label="rms non-clock" value={formatSeconds(data.rms_s.non_clock.value)} />
      </div>
      {([
        ["Total relative time error", totalLine, "total"],
        ["Decomposition: clock-induced vs. non-clock", partLines, "parts"],
      ] as const).map(([title, ls, id]) => (
        <div key={id}>
          <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-xs font-medium text-foreground/90">{title}</h3>
            <Legend items={[
              ...ls.map((l) => ({ id: l.id, label: l.label, color: l.color })),
              ...(epochs.length ? [{ id: "sync", label: "Sync epoch", color: "#4a5d7a", dash: "2 4" }] : []),
            ]} />
          </div>
          <LineChart
            width={width}
            ariaLabel={`${title} between node ${i} and node ${j}, in ${u.unit}, versus time`}
            lines={[...ls]}
            xScale="linear"
            yScale="linear"
            yDomain={yDomain}
            xLabel="Time [s]"
            yLabel={`node ${i} − node ${j} [${u.unit}]`}
            yTickFormat={(v) => String(Number(v.toPrecision(4)))}
            tooltipX={(v) => `t = ${Number(v.toPrecision(5))} s`}
            tooltipY={(v) => `${Number(v.toPrecision(4))} ${u.unit}`}
            verticalMarkers={epochs}
            height={230}
          />
        </div>
      ))}
      <p className="text-xs text-muted">
        One seeded realisation (run seed {data.run_seed}); every {data.decimation === 1 ? "sample is" : `${data.decimation}th sample is`} plotted
        {data.decimation > 1 ? " (intermediate samples omitted for display; rms values use all samples)" : ""}.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <caption className="mb-2 text-left text-[11px] uppercase tracking-wider text-muted">rms relative time error by source (this node pair)</caption>
          <thead className="text-muted">
            <tr><th className="py-1 pr-4 font-normal">Source</th><th className="py-1 pr-4 font-normal">Type</th><th className="py-1 font-normal">rms</th></tr>
          </thead>
          <tbody className="font-mono">
            {contributions.map(([k, q]) => (
              <tr key={k} className="border-t border-border/60">
                <td className="py-1 pr-4 font-sans text-foreground/90">{CATEGORY_LABEL[k] ?? k}</td>
                <td className="py-1 pr-4 font-sans text-muted">{k === "clock" ? "clock-induced" : "non-clock"}</td>
                <td className="py-1">{formatSeconds(q.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
