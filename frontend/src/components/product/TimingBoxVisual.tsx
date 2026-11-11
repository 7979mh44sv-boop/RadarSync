/** Conceptual block view of the proposed RadarSync Timing Box. Not a built device, not a mechanical design. */
const BLOCKS = [
  { x: 40, y: 70, w: 150, h: 70, t: "Atomic clock core", s: "CSAC-class reference" },
  { x: 215, y: 70, w: 150, h: 70, t: "Reference generation", s: "10 MHz · 1PPS · LO ref" },
  { x: 40, y: 160, w: 150, h: 60, t: "Environmental", s: "thermal + magnetic stabilisation" },
  { x: 215, y: 160, w: 150, h: 60, t: "Calibration & sync", s: "software + telemetry" },
];

export default function TimingBoxVisual() {
  return (
    <figure className="w-full">
      <svg viewBox="0 0 405 260" role="img" aria-labelledby="tb-title tb-desc" className="h-auto w-full">
        <title id="tb-title">Conceptual block view of the proposed RadarSync Timing Box</title>
        <desc id="tb-desc">A compact enclosure containing an atomic clock core, reference signal generation, environmental stabilisation, and calibration and synchronisation software, with outputs to the radar payload and an interface to the inter-satellite link. Conceptual; the hardware has not been built.</desc>
        <defs>
          <linearGradient id="tb-shell" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0" stopColor="#14233a" />
            <stop offset="1" stopColor="#0a111c" />
          </linearGradient>
        </defs>
        <rect x={20} y={30} width={365} height={210} rx={18} fill="url(#tb-shell)" stroke="#38e1c6" strokeOpacity={0.6} strokeWidth={1.5} />
        <text x={36} y={56} className="fill-[#e6edf7] font-mono text-[13px]" letterSpacing="2">RADARSYNC TIMING BOX</text>
        <text x={370} y={56} textAnchor="end" className="fill-[#7d8ba1] text-[11px]">concept</text>
        {BLOCKS.map((b) => (
          <g key={b.t}>
            <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={10} fill="#0d1726" stroke="#33445e" />
            <text x={b.x + 12} y={b.y + 26} className="fill-[#e6edf7] text-[13px]">{b.t}</text>
            <text x={b.x + 12} y={b.y + 46} className="fill-[#9fb0c6] text-[11px]">{b.s}</text>
          </g>
        ))}
        <line x1={190} y1={105} x2={215} y2={105} stroke="#38e1c6" strokeWidth={2} />
        {/* outputs */}
        <line x1={385} y1={95} x2={402} y2={95} stroke="#5b8cff" strokeWidth={2} />
        <line x1={385} y1={190} x2={402} y2={190} stroke="#38e1c6" strokeWidth={2} strokeDasharray="4 3" />
        <text x={30} y={18} className="fill-[#7d8ba1] text-[11px]">Outputs → radar payload (reference) · Interface → inter-satellite sync link</text>
      </svg>
    </figure>
  );
}
