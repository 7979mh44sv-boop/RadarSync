"use client";

import { formatDb, linearTicks, makeScale } from "@/lib/format";
import { useWidth } from "./useWidth";

export interface LossRow {
  key: string;
  label: string;
  color: string;
  total: number;
  clock: number;
  nonClock: number;
}

const M = { top: 20, right: 70, bottom: 40, left: 168 };
const BAR = 9;
const GAP = 2;
const ROW_PAD = 14;

/**
 * Horizontal grouped bars: total (scenario color), clock-only (scenario color, hatched),
 * non-clock-only (neutral). Values are in dB; a dashed line marks the fully-random ceiling.
 */
export default function LossBars({ rows, ceilingDb, ariaLabel, width: fixedWidth }: {
  rows: LossRow[];
  ceilingDb: number;
  ariaLabel: string;
  width?: number;
}) {
  const [ref, measured] = useWidth<HTMLDivElement>(fixedWidth ?? 0);
  const width = fixedWidth ?? measured;
  const rowH = 3 * BAR + 2 * GAP + ROW_PAD;
  const ih = rows.length * rowH;
  const height = ih + M.top + M.bottom;
  const iw = Math.max(10, width - M.left - M.right);
  const maxVal = Math.max(...rows.flatMap((r) => [r.total, r.clock, r.nonClock]), 1e-6);
  const showCeiling = ceilingDb <= maxVal * 1.6;
  const domainMax = showCeiling ? ceilingDb : maxVal * 1.1;
  const ticks = linearTicks(0, domainMax, Math.max(3, Math.floor(iw / 80)));
  const sx = makeScale("linear", [0, Math.max(domainMax, ticks[ticks.length - 1])], [0, iw]);

  const bars = (r: LossRow) => [
    { kind: "Total", v: r.total, fill: r.color, hatch: false },
    { kind: "Clock only", v: r.clock, fill: r.color, hatch: true },
    { kind: "Non-clock only", v: r.nonClock, fill: "#6b778a", hatch: false },
  ];

  return (
    <div ref={ref} className="w-full" style={{ minHeight: height }}>
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label={ariaLabel} className="block">
          <defs>
            {rows.map((r) => (
              <pattern key={r.key} id={`hatch-${r.key}`} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <rect width="6" height="6" fill={r.color} fillOpacity="0.3" />
                <line x1="0" y1="0" x2="0" y2="6" stroke={r.color} strokeWidth="2.5" />
              </pattern>
            ))}
          </defs>
          <g transform={`translate(${M.left},${M.top})`}>
            {ticks.map((t) => (
              <g key={t}>
                <line x1={sx(t)} x2={sx(t)} y1={0} y2={ih} stroke="#dceaf4" />
                <text x={sx(t)} y={ih + 16} textAnchor="middle" className="fill-muted font-mono text-[11px]">{t}</text>
              </g>
            ))}
            <text x={iw / 2} y={ih + 34} textAnchor="middle" className="fill-foreground/80 text-[12px]">
              Coherent integration loss [dB] (higher = worse)
            </text>
            {showCeiling && (
              <g>
                <line x1={sx(ceilingDb)} x2={sx(ceilingDb)} y1={-2} y2={ih} stroke="#163a63" strokeOpacity={0.5} strokeDasharray="4 4" />
                <text x={sx(ceilingDb)} y={-8} textAnchor="end" className="fill-muted text-[10px]">
                  random-phase ceiling {formatDb(ceilingDb)}
                </text>
              </g>
            )}
            {rows.map((r, ri) => {
              const y0 = ri * rowH + ROW_PAD / 2;
              return (
                <g key={r.key}>
                  <text x={-10} y={y0 + (3 * BAR + 2 * GAP) / 2} dy="0.32em" textAnchor="end" className="fill-foreground text-[12px]">
                    {r.label}
                  </text>
                  {bars(r).map((b, bi) => {
                    const y = y0 + bi * (BAR + GAP);
                    const w = Math.max(0, sx(Math.min(b.v, domainMax)) - sx(0));
                    return (
                      <g key={b.kind}>
                        <rect x={0} y={y} width={Math.max(w, 1.5)} height={BAR} rx={2}
                          fill={b.hatch ? `url(#hatch-${r.key})` : b.fill} stroke={b.hatch ? r.color : "none"} strokeWidth={b.hatch ? 1 : 0}>
                          <title>{`${r.label} · ${b.kind}: ${formatDb(b.v)}`}</title>
                        </rect>
                        {bi === 0 && (
                          <text x={Math.max(w, 1.5) + 6} y={y + BAR / 2} dy="0.32em" className="fill-foreground font-mono text-[11px]">
                            {formatDb(b.v)}
                          </text>
                        )}
                      </g>
                    );
                  })}
                </g>
              );
            })}
            <line x1={0} x2={0} y1={0} y2={ih} stroke="#9fb6cc" />
          </g>
        </svg>
      )}
    </div>
  );
}
