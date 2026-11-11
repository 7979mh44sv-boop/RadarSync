/** Conceptual satellite-formation integration diagram. Not an orbit simulation, not data, not a radar image. */
const SATS = [
  { x: 110, y: 70, label: "Satellite A" },
  { x: 320, y: 46, label: "Satellite B" },
  { x: 530, y: 70, label: "Satellite C" },
];
const SWATH = { cx: 320, cy: 262, rx: 170, ry: 16 };

function Sat({ x, y, label }: { x: number; y: number; label: string }) {
  return (
    <g>
      <rect x={x - 46} y={y - 6} width={30} height={12} fill="#1b2d4a" stroke="#5b8cff" strokeOpacity={0.7} />
      <rect x={x + 16} y={y - 6} width={30} height={12} fill="#1b2d4a" stroke="#5b8cff" strokeOpacity={0.7} />
      <rect x={x - 16} y={y - 14} width={32} height={28} rx={4} fill="#16233a" stroke="#c9d4e3" />
      <rect x={x - 9} y={y - 7} width={18} height={14} rx={2} fill="#0a111c" stroke="#38e1c6" strokeWidth={1.4} />
      <text x={x} y={y + 3.5} textAnchor="middle" className="fill-[#38e1c6] font-mono text-[8px]">TB</text>
      <text x={x} y={y - 22} textAnchor="middle" className="fill-[#c9d4e3] font-mono text-[13px]">{label}</text>
    </g>
  );
}

export default function SatelliteIntegration() {
  return (
    <figure className="w-full">
      <svg viewBox="0 0 640 300" role="img" aria-labelledby="sat-title sat-desc" className="h-auto w-full">
        <title id="sat-title">Conceptual integration of RadarSync Timing Boxes in a distributed satellite radar</title>
        <desc id="sat-desc">Three radar satellites, each carrying a proposed RadarSync Timing Box (TB), exchange synchronisation over an inter-satellite link and coherently observe a common ground swath. Conceptual only: not an orbit simulation, not measured data, not a radar image.</desc>
        <defs>
          <linearGradient id="sat-beam" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#5b8cff" stopOpacity="0.26" />
            <stop offset="1" stopColor="#5b8cff" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <path d="M0 268 Q 160 250 320 262 T 640 266 V300 H0Z" fill="#0d1726" />
        <ellipse {...SWATH} fill="none" stroke="#5b8cff" strokeOpacity={0.55} strokeDasharray="3 4" />
        <text x={SWATH.cx} y={SWATH.cy + 30} textAnchor="middle" className="fill-[#7d8ba1] text-[13px]">Common imaged swath</text>
        {SATS.map((s) => (
          <polygon key={`b-${s.label}`} points={`${s.x},${s.y + 14} ${SWATH.cx - 100},${SWATH.cy} ${SWATH.cx + 100},${SWATH.cy}`} fill="url(#sat-beam)" />
        ))}
        {SATS.slice(1).map((s, i) => (
          <line key={`l-${s.label}`} x1={SATS[i].x + 46} y1={SATS[i].y} x2={s.x - 46} y2={s.y} stroke="#38e1c6" strokeWidth={1.6} strokeDasharray="6 5" />
        ))}
        {SATS.map((s) => <Sat key={s.label} {...s} />)}
        <rect x={170} y={112} width={300} height={44} rx={8} fill="#04070d" fillOpacity={0.8} />
        <text x={320} y={130} textAnchor="middle" className="fill-[#38e1c6] text-[14px]">inter-satellite synchronisation link</text>
        <text x={320} y={148} textAnchor="middle" className="fill-[#9fb0c6] text-[12.5px]">TB = proposed Timing Box on each satellite</text>
      </svg>
      <ul aria-hidden className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted">
        <li className="flex items-center gap-1.5"><span className="inline-block h-0 w-5 border-t-2 border-dashed border-accent" />Synchronisation link</li>
        <li className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-3 rounded-sm border border-accent" />Timing Box (proposed)</li>
        <li className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-4 bg-accent-2/30" />Radar illumination</li>
      </ul>
      <figcaption className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted">
        <span className="rounded-full border border-dashed border-slate-500 px-2 py-0.5 font-mono uppercase tracking-wider text-slate-300">Conceptual illustration</span>
        <span>Not an orbit simulation, not measured data and not a radar image.</span>
      </figcaption>
    </figure>
  );
}
