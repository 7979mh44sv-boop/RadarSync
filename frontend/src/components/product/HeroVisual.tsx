/** Original full-bleed hero art: stars, Earth limb and a small satellite formation. Concept illustration only. */
function stars(n: number) {
  let s = 7;
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  return Array.from({ length: n }, () => ({ x: r() * 1600, y: r() * 560, o: 0.25 + r() * 0.65, rad: r() < 0.08 ? 1.4 : 0.8 }));
}
const STARS = stars(140);
// Centre-right so the formation stays visible when the art is centre-cropped on portrait phones.
const SATS = [
  { x: 820, y: 250 },
  { x: 990, y: 195 },
  { x: 1160, y: 240 },
];

export default function HeroVisual() {
  return (
    <svg viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" aria-hidden className="absolute inset-0 h-full w-full">
      <defs>
        <radialGradient id="hv-glow" cx="50%" cy="100%" r="75%">
          <stop offset="0" stopColor="#1d4ed8" stopOpacity="0.55" />
          <stop offset="0.45" stopColor="#0b1d3a" stopOpacity="0.5" />
          <stop offset="1" stopColor="#0b1f38" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="hv-earth" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#0f2a52" />
          <stop offset="0.12" stopColor="#06101f" />
          <stop offset="1" stopColor="#020409" />
        </linearGradient>
        <linearGradient id="hv-fade" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#0b1f38" stopOpacity="0.9" />
          <stop offset="0.55" stopColor="#0b1f38" stopOpacity="0.2" />
          <stop offset="1" stopColor="#000" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect width="1600" height="900" fill="#0b1f38" />
      {STARS.map((s, i) => <circle key={i} cx={s.x} cy={s.y} r={s.rad} fill="#fff" opacity={s.o} />)}
      <rect width="1600" height="900" fill="url(#hv-glow)" />
      <ellipse cx="800" cy="1650" rx="1500" ry="1000" fill="url(#hv-earth)" />
      <ellipse cx="800" cy="1650" rx="1500" ry="1000" fill="none" stroke="#7fb4ff" strokeOpacity="0.55" strokeWidth="2.5" />
      <ellipse cx="800" cy="1650" rx="1508" ry="1008" fill="none" stroke="#3b82f6" strokeOpacity="0.18" strokeWidth="14" />
      {/* formation links */}
      {SATS.slice(1).map((s, i) => (
        <line key={i} x1={SATS[i].x} y1={SATS[i].y} x2={s.x} y2={s.y} stroke="#9ff3e3" strokeOpacity="0.7" strokeWidth="1.5" strokeDasharray="6 7" />
      ))}
      {/* radar footprints */}
      {SATS.map((s, i) => (
        <polygon key={`b${i}`} points={`${s.x},${s.y + 10} ${900},700 ${1100},700`} fill="#5b8cff" opacity="0.07" />
      ))}
      {SATS.map((s, i) => (
        <g key={`s${i}`} transform={`translate(${s.x} ${s.y})`}>
          <rect x="-44" y="-5" width="28" height="10" fill="#1e3a66" stroke="#9cc0ff" strokeOpacity="0.8" />
          <rect x="16" y="-5" width="28" height="10" fill="#1e3a66" stroke="#9cc0ff" strokeOpacity="0.8" />
          <rect x="-14" y="-12" width="28" height="24" rx="3" fill="#dfe7f3" />
          <rect x="-7" y="-6" width="14" height="12" rx="2" fill="#0a111c" stroke="#38e1c6" strokeWidth="1.5" />
        </g>
      ))}
      <rect width="1600" height="900" fill="url(#hv-fade)" />
    </svg>
  );
}
