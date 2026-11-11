import Link from "next/link";
import { BrandMark } from "@/components/brand/BrandMark";
import { boxFaces, iso, poly } from "./iso";

export const STATUS_LABELS = ["CONCEPT HARDWARE — NOT YET BUILT", "SIMULATION-BASED — HARDWARE VALIDATION PENDING"] as const;

export const LAYERS = [
  { n: 1, t: "Calibration & synchronisation software", s: "Processor board: calibration, holdover monitoring, sync control" },
  { n: 2, t: "Atomic clock core", s: "Proposed next-gen chip-scale atomic clock (hypothetical)" },
  { n: 3, t: "Reference signal conditioning", s: "Low-noise distribution and frequency synthesis" },
  { n: 4, t: "Environmental stabilisation", s: "Thermal control and magnetic shielding" },
  { n: 5, t: "Timing signal outputs", s: "10 MHz · 1PPS · radar LO reference to the payload" },
] as const;

export const FLOW = [
  "Clock stability",
  "Timing reference",
  "Radar payload",
  "System-level synchronisation & calibration",
  "Potential distributed radar operation",
] as const;

export const ALSO_REQUIRED = ["Precise positioning (orbit knowledge)", "Doppler compensation", "Initial synchronisation", "Phase calibration"] as const;

const NAVY = "#163a63", ICE = "#dceaf4", SIGNAL = "#2679b8", AURORA = "#2ab6b0";

function Step({ n, title, children }: { n: number; title: string; children?: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-3">
      <span className="font-mono text-sm font-semibold text-signal">0{n}</span>
      <div>
        <h3 className="text-xl font-bold uppercase tracking-tight text-navy sm:text-2xl">{title}</h3>
        {children && <p className="mt-1 max-w-xl text-[15px] leading-relaxed text-slate-600">{children}</p>}
      </div>
    </div>
  );
}

/* ---------- 1. The challenge ---------- */
function ChallengeFigure() {
  const sats = [{ x: 90, y: 92, h: 20 }, { x: 260, y: 52, h: 95 }, { x: 430, y: 92, h: 160 }];
  return (
    <svg viewBox="0 0 520 190" role="img" aria-label="Three radar satellites, each with its own clock showing a slightly different time; the relative offsets between them must stay very small." className="h-auto w-full">
      <rect width="520" height="190" rx="20" fill={NAVY} />
      {sats.slice(1).map((s, i) => {
        const a = sats[i];
        const mx = (a.x + s.x) / 2, my = (a.y + s.y) / 2 - 16;
        return (
          <g key={i}>
            <line x1={a.x + 30} y1={a.y} x2={s.x - 30} y2={s.y} stroke={AURORA} strokeWidth="1.5" strokeDasharray="5 5" />
            <rect x={mx - 26} y={my - 13} width="52" height="22" rx="11" fill="#0b1f38" stroke={AURORA} />
            <text x={mx} y={my + 2} textAnchor="middle" fontSize="12" fill="#e3f5f4" className="font-mono">Δt{i + 1}{i + 2}</text>
          </g>
        );
      })}
      {sats.map((s, i) => (
        <g key={i} transform={`translate(${s.x} ${s.y})`}>
          <rect x="-34" y="-5" width="20" height="10" fill="#3b6ea5" />
          <rect x="14" y="-5" width="20" height="10" fill="#3b6ea5" />
          <rect x="-13" y="-12" width="26" height="24" rx="4" fill="#f5f8fc" />
          {/* each satellite's own clock, slightly different */}
          <g transform="translate(0 46)">
            <circle r="15" fill="#0b1f38" stroke={ICE} strokeWidth="1.5" />
            <line x1="0" y1="0" x2="0" y2="-10" stroke={ICE} strokeWidth="2" strokeLinecap="round" />
            <line x1="0" y1="0" x2={8 * Math.cos(((s.h - 90) * Math.PI) / 180)} y2={8 * Math.sin(((s.h - 90) * Math.PI) / 180)} stroke={AURORA} strokeWidth="2" strokeLinecap="round" />
          </g>
          <text y="80" textAnchor="middle" fontSize="11" fill={ICE} className="font-mono">SAT {i + 1}</text>
        </g>
      ))}
    </svg>
  );
}

/* ---------- 2. Exploded view ---------- */
function ExplodedView() {
  // Footprint 150 x 105 spans ~128 px vertically; layers are 100 px apart so each top face shows a clear band.
  const P = iso(200, 690);
  const W = 150, D = 105;
  const slab = (z: number, t: number, top: string, front: string, right: string, x0 = 0, y0 = 0, w = W, d = D) => {
    const f = boxFaces(P, x0, y0, z, w, d, t);
    return (
      <g>
        <polygon points={poly(f.front)} fill={front} />
        <polygon points={poly(f.right)} fill={right} />
        <polygon points={poly(f.top)} fill={top} stroke="#ffffff" strokeOpacity="0.4" strokeWidth="0.8" />
      </g>
    );
  };
  const chip = (x: number, y: number, z: number, w: number, d: number, t: number, c: string) => {
    const f = boxFaces(P, x, y, z, w, d, t);
    return <g><polygon points={poly(f.front)} fill="#0b1f38" /><polygon points={poly(f.right)} fill="#091827" /><polygon points={poly(f.top)} fill={c} /></g>;
  };
  // Elevations, bottom to top: 5 base/outputs, 4 shield, 3 RF board, 2 clock core, 1 processor board, lid.
  const Z = { base: 0, shield: 100, rf: 200, clock: 290, cpu: 400, lid: 500 };
  const LABEL_X = 470;
  const callout = (n: number, from: [number, number]) => {
    const y = from[1];
    return (
      <g key={n}>
        <line x1={from[0]} y1={y} x2={LABEL_X - 18} y2={y} stroke={SIGNAL} strokeWidth="1.2" />
        <circle cx={from[0]} cy={y} r="3.4" fill={SIGNAL} />
        <circle cx={LABEL_X} cy={y} r="14" fill={NAVY} />
        <text x={LABEL_X} y={y + 4.5} textAnchor="middle" fontSize="13" fontWeight="700" fill="#fff">{n}</text>
        <text x={LABEL_X + 24} y={y - 2} fontSize="15" fontWeight="700" fill={NAVY}>{LAYERS[n - 1].t}</text>
        <text x={LABEL_X + 24} y={y + 16} fontSize="12" fill="#4a6481">{LAYERS[n - 1].s}</text>
      </g>
    );
  };
  const guide = (x: number, y: number) => {
    const [a, b] = P(x, y, Z.base + 46); const [c, d] = P(x, y, Z.lid);
    return <line key={`${x}-${y}`} x1={a} y1={b} x2={c} y2={d} stroke={SIGNAL} strokeOpacity="0.3" strokeDasharray="3 5" />;
  };
  const cell = P(W * 0.6, D * 0.68, Z.clock + 44);
  return (
    <svg viewBox="0 175 980 660" role="img" aria-label="Exploded view of the proposed RadarSync Timing Box: calibration and synchronisation software board, atomic clock core, reference signal conditioning board, environmental stabilisation shield and a base with timing outputs. Concept hardware, not yet built." className="h-auto w-full">
      <defs>
        <linearGradient id="ex-lid" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stopColor="#f5f8fc" /><stop offset="1" stopColor="#a9b9cb" /></linearGradient>
        <linearGradient id="ex-gold" x1="0" x2="1"><stop offset="0" stopColor="#8a6a1f" /><stop offset="0.5" stopColor="#f2d48a" /><stop offset="1" stopColor="#8a6a1f" /></linearGradient>
        <radialGradient id="ex-cell" cx="50%" cy="50%" r="50%"><stop offset="0" stopColor="#d9fffb" /><stop offset="0.55" stopColor={AURORA} /><stop offset="1" stopColor="#0f5e5a" /></radialGradient>
      </defs>
      {[guide(0, 0), guide(W, 0), guide(W, D), guide(0, D)]}
      {/* 5 · base enclosure with timing outputs on the front face */}
      {slab(Z.base, 46, "#c7d5e3", "#5a7390", "#3d556f")}
      {[0, 1, 2].map((i) => {
        const [cx, cy] = P(26 + i * 46, D, 23);
        return <g key={i}><ellipse cx={cx} cy={cy} rx="10" ry="8.5" fill="#0b1f38" /><ellipse cx={cx} cy={cy} rx="7" ry="5.8" fill="url(#ex-gold)" /><ellipse cx={cx} cy={cy} rx="2.4" ry="2" fill="#2a1d05" /></g>;
      })}
      {/* 4 · environmental stabilisation (shield can) */}
      {slab(Z.shield, 34, "#e7eef5", "#8fa4bb", "#6f86a0", 10, 8, W - 20, D - 16)}
      {/* 3 · reference signal conditioning board, parts toward the visible front */}
      {slab(Z.rf, 7, "#1d3b5f", "#122a45", "#0d2036", 4, 4, W - 8, D - 8)}
      {chip(78, 60, Z.rf + 7, 36, 30, 9, "#3d6591")}{chip(30, 66, Z.rf + 7, 26, 26, 7, "#2f557f")}{chip(112, 30, Z.rf + 7, 24, 40, 8, "#3d6591")}
      {/* 2 · atomic clock core: physics package with glowing vapour cell */}
      {slab(Z.clock, 44, "#d9e4ee", "#7d93ab", "#5d748d", 40, 30, 80, 62)}
      <ellipse cx={cell[0]} cy={cell[1]} rx="46" ry="26" fill={AURORA} opacity="0.2" />
      <ellipse cx={cell[0]} cy={cell[1]} rx="26" ry="15" fill="url(#ex-cell)" />
      {/* 1 · calibration & synchronisation processor board */}
      {slab(Z.cpu, 7, "#1d3b5f", "#122a45", "#0d2036", 4, 4, W - 8, D - 8)}
      {chip(66, 52, Z.cpu + 7, 40, 40, 10, "#0b1f38")}{chip(24, 70, Z.cpu + 7, 22, 16, 5, "#2f557f")}{chip(118, 30, Z.cpu + 7, 20, 30, 5, "#2f557f")}
      {(() => { const [x, y] = P(86, 72, Z.cpu + 17); return <text x={x} y={y + 3} textAnchor="middle" fontSize="8" fill={AURORA} className="font-mono">SYNC</text>; })()}
      {/* lid with brand mark */}
      {slab(Z.lid, 12, "url(#ex-lid)", "#8fa4bb", "#6f86a0")}
      {(() => { const [x, y] = P(W / 2, D / 2, Z.lid + 12); return <g transform={`translate(${x - 13} ${y - 13})`} color={NAVY}><BrandMark size={26} /></g>; })()}
      {/* callouts: horizontal leaders from each layer's visible right edge */}
      {callout(1, P(W - 4, D * 0.7, Z.cpu + 7))}
      {callout(2, P(120, 70, Z.clock + 22))}
      {callout(3, P(W - 4, D * 0.7, Z.rf + 7))}
      {callout(4, P(W - 10, D * 0.6, Z.shield + 17))}
      {callout(5, P(W, D * 0.75, 23))}
      <text x="40" y="205" fontSize="12" letterSpacing="3" fill={SIGNAL} className="font-mono">EXPLODED VIEW · CONCEPT</text>
    </svg>
  );
}

/* ---------- 3. How it works: one Timing Box per satellite ---------- */
function ConstellationFigure() {
  const sats = [{ x: 120, y: 80 }, { x: 330, y: 50 }, { x: 540, y: 80 }];
  return (
    <svg viewBox="0 0 660 260" role="img" aria-label="Three radar satellites, each carrying its own proposed Timing Box, linked for synchronisation and calibration while observing a common area." className="h-auto w-full">
      <defs>
        <linearGradient id="hw-sky" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#0b1f38" /><stop offset="1" stopColor={NAVY} /></linearGradient>
        <linearGradient id="hw-beam" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor={SIGNAL} stopOpacity="0.35" /><stop offset="1" stopColor={SIGNAL} stopOpacity="0" /></linearGradient>
      </defs>
      <rect width="660" height="260" rx="20" fill="url(#hw-sky)" />
      <path d="M0 236 Q 330 205 660 236 V260 H0Z" fill="#2679b8" opacity="0.35" />
      <ellipse cx="330" cy="228" rx="150" ry="12" fill="none" stroke={ICE} strokeOpacity="0.6" strokeDasharray="3 4" />
      {sats.map((s, i) => <polygon key={`b${i}`} points={`${s.x},${s.y + 16} 230,228 430,228`} fill="url(#hw-beam)" />)}
      {sats.slice(1).map((s, i) => (
        <line key={`l${i}`} x1={sats[i].x + 44} y1={sats[i].y} x2={s.x - 44} y2={s.y} stroke={AURORA} strokeWidth="1.8" strokeDasharray="6 5" className="link-flow" />
      ))}
      <text x="330" y="112" textAnchor="middle" fontSize="12" fill="#e3f5f4">synchronisation &amp; calibration link</text>
      {sats.map((s, i) => (
        <g key={i} transform={`translate(${s.x} ${s.y})`}>
          <rect x="-44" y="-6" width="28" height="12" fill="#3b6ea5" stroke="#9cc0ff" strokeOpacity="0.7" />
          <rect x="16" y="-6" width="28" height="12" fill="#3b6ea5" stroke="#9cc0ff" strokeOpacity="0.7" />
          <rect x="-16" y="-15" width="32" height="30" rx="4" fill="#f5f8fc" />
          <rect x="-10" y="-8" width="20" height="16" rx="2" fill={NAVY} stroke={AURORA} strokeWidth="1.5" />
          <text y="3.5" textAnchor="middle" fontSize="8" fontWeight="700" fill={AURORA} className="font-mono">TB</text>
          <text y="-24" textAnchor="middle" fontSize="11" fill={ICE} className="font-mono">SAT {i + 1}</text>
        </g>
      ))}
      <text x="18" y="252" fontSize="10" fill={ICE} opacity="0.8" className="font-mono">TB = proposed Timing Box · concept illustration, not an orbit simulation</text>
    </svg>
  );
}

/* ---------- 4. Value: schematic, not data ---------- */
function ValueSketch() {
  const x0 = 50, x1 = 600, y0 = 210, syncs = [50, 233, 416, 600];
  const seg = (k: number) => {
    let less = "", more = "";
    for (let i = 0; i < 3; i++) {
      const a = syncs[i], b = syncs[i + 1];
      const pts = Array.from({ length: 24 }, (_, j) => {
        const u = j / 23;
        return [a + u * (b - a), Math.sqrt(u)];
      });
      less += "M" + pts.map(([x, u]) => `${x.toFixed(1)} ${(y0 - 115 * u).toFixed(1)}`).join(" L") + " ";
      more += "M" + pts.map(([x, u]) => `${x.toFixed(1)} ${(y0 - 115 * k * u).toFixed(1)}`).join(" L") + " ";
    }
    return { less, more };
  };
  const { less, more } = seg(0.32);
  return (
    <svg viewBox="0 0 640 250" role="img" aria-label="Schematic, not data: between synchronisation events, the relative timing error grows more slowly with a more stable timing reference than with a less stable one." className="h-auto w-full">
      <rect width="640" height="250" rx="20" fill="#ffffff" stroke={ICE} />
      {syncs.map((x, i) => (
        <g key={i}>
          <line x1={x} y1={78} x2={x} y2={y0} stroke={SIGNAL} strokeOpacity="0.45" strokeDasharray="3 4" />
          <text x={x} y={y0 + 18} textAnchor="middle" fontSize="10.5" fill="#4a6481" className="font-mono">sync</text>
        </g>
      ))}
      <line x1={x0} y1={y0} x2={x1 + 10} y2={y0} stroke={NAVY} strokeWidth="1.4" />
      <line x1={x0} y1={y0} x2={x0} y2={36} stroke={NAVY} strokeWidth="1.4" />
      <path d={less} fill="none" stroke="#8aa0b8" strokeWidth="2.5" />
      <path d={more} fill="none" stroke={AURORA} strokeWidth="3" />
      <text x={x1 + 12} y={y0 + 4} fontSize="11" fill={NAVY}>time</text>
      <text transform={`translate(${x0 - 16} ${y0 - 4}) rotate(-90)`} fontSize="11" fill={NAVY}>relative timing error</text>
      <g fontSize="12">
        <line x1="380" y1="32" x2="404" y2="32" stroke="#8aa0b8" strokeWidth="2.5" /><text x="410" y="36" fill="#4a6481">less stable reference</text>
        <line x1="380" y1="52" x2="404" y2="52" stroke={AURORA} strokeWidth="3" /><text x="410" y="56" fill="#4a6481">more stable reference</text>
      </g>
      <text x="62" y="30" fontSize="10.5" letterSpacing="2" fill={SIGNAL} className="font-mono">SCHEMATIC — NOT DATA</text>
    </svg>
  );
}

export default function TimingBoxInfographic() {
  return (
    <section id="infographic" aria-labelledby="infographic-title" className="scroll-mt-20 rounded-[2rem] border border-ice bg-gradient-to-b from-white to-cloud p-6 shadow-[0_40px_90px_-60px_rgba(22,58,99,0.6)] sm:p-10">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.35em] text-signal">At a glance</p>
          <h2 id="infographic-title" className="mt-2 text-3xl font-bold uppercase tracking-tight text-navy sm:text-5xl">The Timing Box, explained.</h2>
        </div>
        <ul className="flex flex-col gap-2" aria-label="Status">
          {STATUS_LABELS.map((s) => (
            <li key={s} className="rounded-full border border-warning bg-[#fdf1e1] px-4 py-1.5 font-mono text-[11px] font-semibold tracking-[0.12em] text-[#7a4700]">{s}</li>
          ))}
        </ul>
      </div>

      {/* 1 + 4 side by side on desktop: problem and value */}
      <div className="mt-12 grid gap-10 lg:grid-cols-2">
        <div>
          <Step n={1} title="The challenge">Multiple radar satellites need highly precise relative timing. Each carries its own clock, and their small offsets (Δt) add up to phase errors: at 10 GHz, 100 ps is already about 6 radians.</Step>
          <div className="mt-5"><ChallengeFigure /></div>
        </div>
        <div>
          <Step n={4} title="The value">More stable relative timing between synchronisation events. Together with synchronisation and calibration, that can give a distributed radar more timing margin.</Step>
          <div className="mt-5"><ValueSketch /></div>
          <Link href="/science" className="mt-3 inline-block text-sm font-semibold text-signal hover:text-navy">See the simulated evidence →</Link>
        </div>
      </div>

      <div className="mt-16">
        <Step n={2} title="Inside the RadarSync Timing Box">Five building blocks. One compact module.</Step>
        <div className="mt-6 rounded-3xl border border-ice bg-white p-4 sm:p-8"><ExplodedView /></div>
        <ol className="mt-4 grid gap-2 text-sm sm:grid-cols-2 lg:hidden" aria-label="Exploded view legend">
          {LAYERS.map((l) => (
            <li key={l.n} className="flex gap-2"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-navy text-xs font-bold text-white">{l.n}</span><span><span className="font-semibold text-navy">{l.t}.</span> <span className="text-slate-600">{l.s}</span></span></li>
          ))}
        </ol>
      </div>

      <div className="mt-16">
        <Step n={3} title="How it works">A Timing Box on every satellite.</Step>
        <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:items-center">
          <ConstellationFigure />
          <div>
            <ol className="flex flex-col gap-2" aria-label="System flow">
              {FLOW.map((f, i) => (
                <li key={f} className="flex flex-col items-start">
                  <span className={`rounded-xl px-4 py-2.5 text-sm font-semibold ${i === FLOW.length - 1 ? "border border-dashed border-signal text-signal" : "bg-navy text-white"}`}>{f}</span>
                  {i < FLOW.length - 1 && <span aria-hidden className="ml-6 text-lg leading-5 text-aurora">↓</span>}
                </li>
              ))}
            </ol>
            <div className="mt-5 rounded-2xl border border-ice bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.15em] text-navy">Also required — not provided by the clock alone</p>
              <ul className="mt-2 grid gap-1.5 text-sm text-slate-700 sm:grid-cols-2">
                {ALSO_REQUIRED.map((a) => <li key={a} className="flex gap-2"><span aria-hidden className="text-signal">+</span>{a}</li>)}
              </ul>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-14 flex flex-col gap-3 rounded-2xl bg-navy p-6 text-white sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-ice">05 · Status</p>
          <p className="mt-1 text-lg font-semibold">Engineering the next generation of precision timing hardware.</p>
        </div>
        <p className="font-mono text-[11px] tracking-[0.12em] text-ice">Concept and simulation done · Prototype next</p>
      </div>
    </section>
  );
}
