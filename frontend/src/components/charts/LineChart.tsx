"use client";

import { useId, useMemo, useState } from "react";
import { linearTicks, logTicks, makeScale, nearestIndex, superscript, type ScaleKind } from "@/lib/format";
import { useWidth } from "./useWidth";

export interface LineSeries {
  id: string;
  label: string;
  color: string;
  x: number[];
  y: number[];
  dash?: string;
  /** Per-point emphasis; segments between two emphasised points are drawn thick and opaque. */
  emphasis?: boolean[];
  width?: number;
  opacity?: number;
  /** Optional uncertainty band drawn as a faint area (same x as the line). */
  band?: { lo: number[]; hi: number[] };
}

export interface RefLine {
  value: number;
  label: string;
  color: string;
  dash?: string;
}

export interface PointSeries {
  id: string;
  label: string;
  color: string;
  x: number[];
  y: number[];
  shape: "circle" | "square" | "triangle";
  hollow?: boolean;
  size?: number;
  /** Native per-mark hover text. */
  titles?: string[];
}

export interface LineChartProps {
  lines: LineSeries[];
  points?: PointSeries[];
  xScale: ScaleKind;
  yScale: ScaleKind;
  xLabel: string;
  yLabel: string;
  xTickFormat?: (v: number) => string;
  yTickFormat?: (v: number) => string;
  tooltipX: (v: number) => string;
  tooltipY: (v: number) => string;
  height?: number;
  verticalMarkers?: number[];
  ariaLabel: string;
  /** Fixed width (for server-side rendering in tests); otherwise measured. */
  width?: number;
  symmetricY?: boolean;
  /** Fixed y-domain (e.g. shared across small multiples). */
  yDomain?: [number, number];
  /** Labelled horizontal reference lines (e.g. target, floor). */
  hLines?: RefLine[];
  /** Labelled vertical reference lines (e.g. sourced or hypothetical reference values). */
  xRefs?: RefLine[];
}

const M = { top: 14, right: 18, bottom: 46, left: 74 };

const pow10 = (v: number) => {
  const e = Math.round(Math.log10(v));
  return e === 0 ? "1" : e === 1 ? "10" : `10${superscript(e)}`;
};

function extent(values: number[], kind: ScaleKind): [number, number] {
  const v = values.filter((x) => Number.isFinite(x) && (kind === "linear" || x > 0));
  if (v.length === 0) return kind === "log" ? [1, 10] : [0, 1];
  let lo = Math.min(...v);
  let hi = Math.max(...v);
  if (kind === "log") {
    return [10 ** Math.floor(Math.log10(lo) + 1e-9), 10 ** Math.ceil(Math.log10(hi) - 1e-9)];
  }
  if (lo === hi) {
    lo -= Math.abs(lo) || 1;
    hi += Math.abs(hi) || 1;
  }
  const t = linearTicks(lo, hi, 5);
  const step = t.length > 1 ? t[1] - t[0] : 1;
  return [Math.min(lo, Math.floor(lo / step) * step), Math.max(hi, Math.ceil(hi / step) * step)];
}

function markerPath(shape: PointSeries["shape"], x: number, y: number, s: number) {
  if (shape === "square") return `M${x - s} ${y - s}h${2 * s}v${2 * s}h${-2 * s}Z`;
  if (shape === "triangle") return `M${x - s * 1.2} ${y - s}L${x + s * 1.2} ${y - s}L${x} ${y + s * 1.1}Z`;
  return `M${x - s} ${y}a${s} ${s} 0 1 0 ${2 * s} 0a${s} ${s} 0 1 0 ${-2 * s} 0`;
}

export default function LineChart(props: LineChartProps) {
  const { lines, points = [], xScale, yScale, height = 340 } = props;
  const [ref, measured] = useWidth<HTMLDivElement>(props.width ?? 0);
  const width = props.width ?? measured;
  const clipId = useId().replace(/:/g, "");
  const [hover, setHover] = useState<number | null>(null);

  const geom = useMemo(() => {
    const xs = [...lines.flatMap((l) => l.x), ...points.flatMap((p) => p.x), ...(props.xRefs ?? []).map((r) => r.value)];
    const ys = [
      ...lines.flatMap((l) => [...l.y, ...(l.band ? [...l.band.lo, ...l.band.hi] : [])]),
      ...points.flatMap((p) => p.y),
      ...(props.hLines ?? []).map((h) => h.value),
    ];
    const xd = extent(xs, xScale);
    if (xScale === "linear" && xs.length) {
      xd[0] = Math.min(...xs);
      xd[1] = Math.max(...xs);
    }
    let yd = props.yDomain ?? extent(ys, yScale);
    if (!props.yDomain && props.symmetricY && yScale === "linear") {
      const m = Math.max(Math.abs(yd[0]), Math.abs(yd[1]));
      yd = [-m, m];
    }
    const iw = Math.max(10, width - M.left - M.right);
    const ih = height - M.top - M.bottom;
    return {
      xd, yd, iw, ih,
      sx: makeScale(xScale, xd, [0, iw]),
      sy: makeScale(yScale, yd, [ih, 0]),
      xTicks: xScale === "log" ? logTicks(xd[0], xd[1]) : linearTicks(xd[0], xd[1], Math.max(3, Math.floor(iw / 90))),
      yTicks: yScale === "log" ? logTicks(yd[0], yd[1]) : linearTicks(yd[0], yd[1], 5),
    };
  }, [lines, points, xScale, yScale, width, height, props.symmetricY, props.yDomain, props.hLines, props.xRefs]);

  const primary = lines[0];
  const fmtX = props.xTickFormat ?? (xScale === "log" ? pow10 : (v: number) => String(v));
  const fmtY = props.yTickFormat ?? (yScale === "log" ? pow10 : (v: number) => String(v));

  function onMove(e: React.PointerEvent<SVGRectElement>) {
    if (!primary) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const { xd, iw } = geom;
    const frac = px / iw;
    const xv = xScale === "log" ? 10 ** (Math.log10(xd[0]) + frac * (Math.log10(xd[1]) - Math.log10(xd[0]))) : xd[0] + frac * (xd[1] - xd[0]);
    setHover(nearestIndex(primary.x, xv, xScale));
  }

  const hx = hover !== null && primary ? primary.x[hover] : null;

  return (
    <div ref={ref} className="relative w-full" style={{ minHeight: height }}>
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label={props.ariaLabel} className="block select-none">
          <defs>
            <clipPath id={clipId}>
              <rect x={0} y={-2} width={geom.iw} height={geom.ih + 4} />
            </clipPath>
          </defs>
          <g transform={`translate(${M.left},${M.top})`}>
            {/* grid + axes (recessive) */}
            {geom.yTicks.map((t) => (
              <g key={`y${t}`}>
                <line x1={0} x2={geom.iw} y1={geom.sy(t)} y2={geom.sy(t)} stroke="#dceaf4" strokeWidth={1} />
                <text x={-8} y={geom.sy(t)} dy="0.32em" textAnchor="end" className="fill-muted font-mono text-[11px]">
                  {fmtY(t)}
                </text>
              </g>
            ))}
            {geom.xTicks.map((t) => (
              <g key={`x${t}`}>
                <line x1={geom.sx(t)} x2={geom.sx(t)} y1={0} y2={geom.ih} stroke="#dceaf4" strokeWidth={1} />
                <text x={geom.sx(t)} y={geom.ih + 18} textAnchor="middle" className="fill-muted font-mono text-[11px]">
                  {fmtX(t)}
                </text>
              </g>
            ))}
            <line x1={0} x2={geom.iw} y1={geom.ih} y2={geom.ih} stroke="#9fb6cc" />
            <line x1={0} x2={0} y1={0} y2={geom.ih} stroke="#9fb6cc" />
            <text x={geom.iw / 2} y={geom.ih + 40} textAnchor="middle" className="fill-foreground/80 text-[12px]">
              {props.xLabel}
            </text>
            <text transform={`translate(${-60},${geom.ih / 2}) rotate(-90)`} textAnchor="middle" className="fill-foreground/80 text-[12px]">
              {props.yLabel}
            </text>

            <g clipPath={`url(#${clipId})`}>
              {(props.verticalMarkers ?? []).map((v) => (
                <line key={`v${v}`} x1={geom.sx(v)} x2={geom.sx(v)} y1={0} y2={geom.ih} stroke="#9fb6cc" strokeDasharray="2 4" />
              ))}
              {lines.map((l) =>
                l.band ? (
                  <path
                    key={`${l.id}-band`}
                    d={`M${l.x.map((x, i) => `${geom.sx(x)} ${geom.sy(l.band!.hi[i])}`).join("L")}L${l.x
                      .map((x, i) => `${geom.sx(x)} ${geom.sy(l.band!.lo[i])}`)
                      .reverse()
                      .join("L")}Z`}
                    fill={l.color}
                    fillOpacity={0.14}
                  />
                ) : null,
              )}
              {(props.hLines ?? []).map((h) => (
                <g key={`h-${h.label}`}>
                  <line x1={0} x2={geom.iw} y1={geom.sy(h.value)} y2={geom.sy(h.value)} stroke={h.color} strokeWidth={1.5} strokeDasharray={h.dash} />
                  <text x={geom.iw - 4} y={geom.sy(h.value) - 5} textAnchor="end" className="text-[10.5px]" fill={h.color}>{h.label}</text>
                </g>
              ))}
              {(props.xRefs ?? []).map((r, k) => (
                <g key={`x-${r.label}`}>
                  <line x1={geom.sx(r.value)} x2={geom.sx(r.value)} y1={0} y2={geom.ih} stroke={r.color} strokeWidth={1.25} strokeDasharray={r.dash} />
                  {/* Labels sit near the bottom (away from top-right reference labels) and flip left near the right edge. */}
                  <text
                    x={geom.sx(r.value) + (geom.sx(r.value) > geom.iw * 0.6 ? -4 : 4)}
                    y={geom.ih - 8 - 14 * k}
                    textAnchor={geom.sx(r.value) > geom.iw * 0.6 ? "end" : "start"}
                    className="text-[10.5px]"
                    fill={r.color}
                  >
                    {r.label}
                  </text>
                </g>
              ))}
              {lines.map((l) =>
                l.x.slice(1).map((_, i) => {
                  const strong = l.emphasis ? l.emphasis[i] && l.emphasis[i + 1] : true;
                  return (
                    <line
                      key={`${l.id}-${i}`}
                      x1={geom.sx(l.x[i])} y1={geom.sy(l.y[i])} x2={geom.sx(l.x[i + 1])} y2={geom.sy(l.y[i + 1])}
                      stroke={l.color}
                      strokeWidth={strong ? (l.width ?? 2.5) : 1.5}
                      strokeOpacity={(strong ? 1 : 0.55) * (l.opacity ?? 1)}
                      strokeDasharray={l.dash}
                      strokeLinecap="round"
                    />
                  );
                }),
              )}
              {points.map((p) =>
                p.x.map((x, i) => (
                  <path
                    key={`${p.id}-${i}`}
                    d={markerPath(p.shape, geom.sx(x), geom.sy(p.y[i]), p.size ?? 4.5)}
                    fill={p.hollow ? "#ffffff" : p.color}
                    stroke={p.hollow ? p.color : "#ffffff"}
                    strokeWidth={p.hollow ? 2 : 1.5}
                  >
                    {p.titles?.[i] && <title>{p.titles[i]}</title>}
                  </path>
                )),
              )}
              {hx !== null && (
                <line x1={geom.sx(hx)} x2={geom.sx(hx)} y1={0} y2={geom.ih} stroke="#163a63" strokeOpacity={0.45} />
              )}
            </g>
            <rect
              width={geom.iw}
              height={geom.ih}
              fill="transparent"
              onPointerMove={onMove}
              onPointerLeave={() => setHover(null)}
            />
          </g>
        </svg>
      )}
      {hx !== null && hover !== null && (
        <div
          className="pointer-events-none absolute z-10 min-w-48 rounded-lg border border-border bg-white/95 px-3 py-2 font-mono text-[11px] shadow-xl"
          style={{
            left: Math.min(M.left + geom.sx(hx) + 12, Math.max(0, width - 230)),
            top: M.top + 8,
          }}
        >
          <div className="mb-1 text-foreground">{props.tooltipX(hx)}</div>
          {lines.map((l) => {
            const i = nearestIndex(l.x, hx, xScale);
            return (
              <div key={l.id} className="flex items-center justify-between gap-4">
                <span className="flex items-center gap-1.5 text-muted">
                  <span className="inline-block h-0.5 w-3" style={{ background: l.color }} />
                  {l.label}
                </span>
                <span className="text-foreground">{i >= 0 ? props.tooltipY(l.y[i]) : "—"}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
