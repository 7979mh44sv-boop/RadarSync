import { BrandMark } from "@/components/brand/BrandMark";

export const RENDER_LABEL = "CONCEPT RENDER — HARDWARE NOT YET BUILT";

/**
 * Original vector concept render of the proposed RadarSync Timing Box.
 * Not a photograph and not a mechanical design: proportions are illustrative.
 */
export default function TimingBoxRender({ priority = false }: { priority?: boolean }) {
  // Isometric box: top face, front face, right face.
  const top = "M120 150 L330 70 L560 150 L350 232 Z";
  const front = "M120 150 L350 232 L350 360 L120 278 Z";
  const side = "M350 232 L560 150 L560 278 L350 360 Z";
  const fins = Array.from({ length: 9 }, (_, i) => i);
  const sma = [0, 1, 2];
  return (
    <figure className="relative w-full" aria-labelledby={priority ? "render-cap-main" : undefined}>
      <svg viewBox="0 0 680 460" role="img" aria-label="Concept render of the proposed RadarSync Timing Box, a compact metal enclosure with RF connectors. Hardware not yet built." className="h-auto w-full">
        <defs>
          <radialGradient id="tbr-stage" cx="50%" cy="85%" r="60%">
            <stop offset="0" stopColor="#dceaf4" stopOpacity="0.9" />
            <stop offset="1" stopColor="#f5f8fc" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="tbr-top" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0" stopColor="#e9eef5" />
            <stop offset="0.45" stopColor="#aeb8c6" />
            <stop offset="1" stopColor="#6c7787" />
          </linearGradient>
          <linearGradient id="tbr-front" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor="#3b4352" />
            <stop offset="0.55" stopColor="#5d6878" />
            <stop offset="1" stopColor="#2a313d" />
          </linearGradient>
          <linearGradient id="tbr-side" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor="#1f2530" />
            <stop offset="1" stopColor="#11151c" />
          </linearGradient>
          <linearGradient id="tbr-gold" x1="0" x2="1">
            <stop offset="0" stopColor="#8a6a1f" />
            <stop offset="0.5" stopColor="#f2d48a" />
            <stop offset="1" stopColor="#8a6a1f" />
          </linearGradient>
          <linearGradient id="tbr-sheen" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor="#fff" stopOpacity="0" />
            <stop offset="0.5" stopColor="#fff" stopOpacity="0.35" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
          <filter id="tbr-blur"><feGaussianBlur stdDeviation="14" /></filter>
        </defs>
        <rect width="680" height="460" fill="url(#tbr-stage)" />
        {/* shadow */}
        <ellipse cx="345" cy="372" rx="250" ry="30" fill="#000" opacity="0.35" filter="url(#tbr-blur)" />
        {/* faces */}
        <path d={front} fill="url(#tbr-front)" />
        <path d={side} fill="url(#tbr-side)" />
        <path d={top} fill="url(#tbr-top)" />
        <path d="M200 120 L410 202 L430 194 L220 112 Z" fill="url(#tbr-sheen)" opacity="0.6" />
        {/* edges */}
        <path d={`${top} M350 232 L350 360 M120 150 L120 278 L350 360 L560 278 L560 150`} fill="none" stroke="#dbe3ee" strokeOpacity="0.35" strokeWidth="1.2" />
        {/* heat-sink fins on the side face */}
        {fins.map((i) => {
          const t = 0.12 + i * 0.09;
          const x1 = 350 + 210 * t, y1 = 232 - 82 * t;
          return <line key={i} x1={x1} y1={y1 + 18} x2={x1} y2={y1 + 108} stroke="#3a4250" strokeWidth="5" strokeLinecap="round" />;
        })}
        {/* engraved logo and wordmark on top face (skewed onto the plane) */}
        <g transform="matrix(1 0.39 -1.05 0.38 292 126)">
          <g transform="translate(-2 -14) scale(1.1)" color="#2b3340"><BrandMark size={26} /></g>
          <text x="32" y="6" className="font-mono" fontSize="15" fontWeight="700" letterSpacing="3.5" fill="#2b3340">RADARSYNC</text>
          <text x="33" y="24" className="font-mono" fontSize="8.5" letterSpacing="3" fill="#3d4654">TIMING BOX · CONCEPT</text>
        </g>
        {/* front panel: SMA connectors + LED */}
        {sma.map((i) => {
          const cx = 170 + i * 56, cy = 222 + i * 20;
          return (
            <g key={i}>
              <ellipse cx={cx} cy={cy} rx="15" ry="13" fill="#151a22" />
              <ellipse cx={cx} cy={cy} rx="11" ry="9.5" fill="url(#tbr-gold)" />
              <ellipse cx={cx} cy={cy} rx="4" ry="3.4" fill="#2a1d05" />
              <text x={cx} y={cy + 27} textAnchor="middle" fontSize="8" fill="#b9c3d1" className="font-mono">{["10 MHz", "1PPS", "REF"][i]}</text>
            </g>
          );
        })}
        <circle cx="318" cy="300" r="4.5" fill="#38e1c6" />
        <circle cx="318" cy="300" r="10" fill="#38e1c6" opacity="0.25" />
        {/* mounting flanges */}
        <path d="M108 268 L120 272 L120 286 L108 282 Z M548 284 L560 278 L572 282 L560 288 Z" fill="#9aa5b4" />
        <text x="340" y="440" textAnchor="middle" className="font-mono" fontSize="13" letterSpacing="3" fill="#2679b8">{RENDER_LABEL}</text>
      </svg>
      <figcaption id={priority ? "render-cap-main" : undefined} className="mt-2 text-center font-mono text-[11px] uppercase tracking-[0.25em] text-signal">
        {RENDER_LABEL} · illustration, not a photograph
      </figcaption>
    </figure>
  );
}
