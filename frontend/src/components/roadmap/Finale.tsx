import Link from "next/link";

/** Deterministic star field (no randomness at render time). */
function starField(n: number, w: number, h: number, seed: number) {
  let s = seed;
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  return Array.from({ length: n }, () => ({ x: r() * w, y: r() * h, o: 0.2 + r() * 0.7, rad: r() < 0.1 ? 1.5 : 0.8 }));
}

/** A ring of satellites with links: original constellation artwork. */
function constellation(cx: number, cy: number, rx: number, ry: number, n: number) {
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2;
    return { x: cx + rx * Math.cos(a), y: cy + ry * Math.sin(a) };
  });
}

/** SECTION A — orbital sunrise with a satellite network. Concept illustration. */
export function VisionHero() {
  const stars = starField(120, 1600, 520, 11);
  const sats = constellation(800, 330, 520, 120, 9);
  return (
    <section aria-labelledby="vision-title" className="relative flex min-h-[92svh] flex-col overflow-hidden bg-[#0b1f38]">
      <svg viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" aria-hidden className="absolute inset-0 h-full w-full">
        <defs>
          <linearGradient id="sun-sky" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#0b1f38" />
            <stop offset="0.55" stopColor="#163a63" />
            <stop offset="0.82" stopColor="#2679b8" />
          </linearGradient>
          <radialGradient id="sun-glow" cx="50%" cy="100%" r="55%">
            <stop offset="0" stopColor="#fff4d6" stopOpacity="0.95" />
            <stop offset="0.12" stopColor="#ffd59a" stopOpacity="0.7" />
            <stop offset="0.35" stopColor="#2ab6b0" stopOpacity="0.35" />
            <stop offset="1" stopColor="#2679b8" stopOpacity="0" />
          </radialGradient>
          <filter id="sun-soft" x="-50%" y="-200%" width="200%" height="500%"><feGaussianBlur stdDeviation="22" /></filter>
          <radialGradient id="sun-horizon" cx="50%" cy="50%" r="50%">
            <stop offset="0" stopColor="#ffe2a8" stopOpacity="0.95" />
            <stop offset="0.25" stopColor="#ffc078" stopOpacity="0.55" />
            <stop offset="0.55" stopColor="#2ab6b0" stopOpacity="0.28" />
            <stop offset="1" stopColor="#2679b8" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="sun-earth" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#0f2a4a" />
            <stop offset="1" stopColor="#061325" />
          </linearGradient>
        </defs>
        <rect width="1600" height="900" fill="url(#sun-sky)" />
        {stars.map((s, i) => <circle key={i} cx={s.x} cy={s.y} r={s.rad} fill="#fff" opacity={s.o} />)}
        <ellipse cx="800" cy="1520" rx="1400" ry="760" fill="url(#sun-glow)" />
        {/* horizon sunrise: warm core fading to teal and blue, sitting on the limb */}
        <ellipse cx="800" cy="830" rx="760" ry="150" fill="url(#sun-horizon)" />
        <ellipse cx="800" cy="826" rx="300" ry="46" fill="#fff4d6" opacity="0.6" filter="url(#sun-soft)" />
        <ellipse cx="800" cy="1580" rx="1400" ry="760" fill="url(#sun-earth)" />
        <ellipse cx="800" cy="1580" rx="1400" ry="760" fill="none" stroke="#ffe7b3" strokeOpacity="0.8" strokeWidth="3" />
        <ellipse cx="800" cy="330" rx="520" ry="120" fill="none" stroke="#dceaf4" strokeOpacity="0.25" strokeDasharray="2 8" />
        {sats.map((p, i) => {
          const q = sats[(i + 1) % sats.length];
          return <line key={`l${i}`} x1={p.x} y1={p.y} x2={q.x} y2={q.y} stroke="#2ab6b0" strokeOpacity="0.7" strokeWidth="1.4" strokeDasharray="6 6" className="link-flow" />;
        })}
        {sats.map((p, i) => (
          <g key={`s${i}`} transform={`translate(${p.x} ${p.y})`}>
            <rect x="-16" y="-3" width="10" height="6" fill="#9cc0ff" opacity="0.8" />
            <rect x="6" y="-3" width="10" height="6" fill="#9cc0ff" opacity="0.8" />
            <circle r="5" fill="#f5f8fc" className="node-pulse" style={{ animationDelay: `${i * 0.35}s` }} />
          </g>
        ))}
      </svg>
      <div className="relative z-10 mx-auto flex w-full max-w-7xl flex-1 flex-col justify-end px-6 pb-20 pt-28">
        <p className="font-mono text-xs uppercase tracking-[0.35em] text-ice">Roadmap · The vision</p>
        <h1 id="vision-title" className="mt-4 text-5xl font-bold uppercase leading-[0.95] tracking-tight text-white sm:text-7xl lg:text-8xl">
          The future
          <br />
          is a network.
        </h1>
        <p className="mt-6 max-w-xl text-lg text-ice sm:text-xl">Precision timing for the next generation of satellite radar.</p>
        <p className="mt-6 text-xs uppercase tracking-[0.2em] text-ice/80">Concept illustration · Not a simulated orbit</p>
      </div>
    </section>
  );
}

export const STATUS_LEGEND = [
  { k: "Simulated today", b: "Clock-to-coherence model, requirement solver and live dashboard.", cls: "border-accent-2 bg-[#e3f5f4] text-[#0f5e5a]" },
  { k: "Next", b: "Prototype, multi-node tests, space qualification and first customer programmes.", cls: "border-warning bg-[#fdf1e1] text-[#7a4700]" },
  { k: "Long-term vision", b: "Timing infrastructure for cooperative space systems; later aviation.", cls: "border-violet-500 bg-[#f1ecfd] text-violet-800" },
];

export const STAGES = [
  { n: "01", t: "Prove", when: "NEXT", items: ["Build the Timing Box prototype.", "Measure clock and system performance.", "Validate the simulation against hardware data."] },
  { n: "02", t: "Deploy", when: "THEN", items: ["Test synchronisation and calibration with multiple radar nodes.", "Validate environmental robustness.", "Work toward space qualification and a satellite mission demonstration."] },
  { n: "03", t: "Scale", when: "LATER", items: ["Develop a repeatable hardware product.", "Pursue integration with satellite radar developers.", "Explore broader space timing applications and, later, aviation."] },
];

/** SECTION B — three connected stages (planned milestones, not achievements). */
export function PathToHardware() {
  return (
    <section aria-labelledby="path-title" className="bg-cloud py-20 sm:py-28">
      <div className="mx-auto w-full max-w-7xl px-6">
        <p className="font-mono text-xs uppercase tracking-[0.35em] text-signal">The plan</p>
        <h2 id="path-title" className="mt-3 text-3xl font-bold uppercase tracking-tight text-navy sm:text-5xl">The path to real hardware.</h2>
        <p className="mt-4 max-w-2xl text-lg text-slate-600">Three stages from prototype to product.</p>
        <ul className="mt-8 grid gap-3 md:grid-cols-3" aria-label="Status legend">
          {STATUS_LEGEND.map((s) => (
            <li key={s.k} className={`rounded-xl border-l-4 px-4 py-3 ${s.cls}`}>
              <div className="text-xs font-semibold uppercase tracking-[0.18em]">{s.k}</div>
              <div className="mt-1 text-sm">{s.b}</div>
            </li>
          ))}
        </ul>
        <ol className="relative mt-14 grid gap-6 lg:grid-cols-3">
          <div aria-hidden className="absolute left-8 right-8 top-8 hidden h-1 rounded-full bg-gradient-to-r from-signal via-aurora to-navy lg:block" />
          {STAGES.map((s) => (
            <li key={s.n} className="relative rounded-3xl border border-ice bg-white p-7 shadow-[0_20px_50px_-30px_rgba(22,58,99,0.45)] transition-transform hover:-translate-y-1">
              <div className="flex items-center justify-between">
                <span className="flex h-16 w-16 items-center justify-center rounded-full bg-navy font-mono text-xl font-bold text-white ring-8 ring-cloud">{s.n}</span>
                <span className="rounded-full border border-signal/50 px-2.5 py-1 font-mono text-[10px] tracking-wider text-signal">{s.when}</span>
              </div>
              <h3 className="mt-6 text-3xl font-bold uppercase tracking-tight text-navy">{s.t}</h3>
              <ul className="mt-4 space-y-2.5 text-[15px] leading-relaxed text-slate-700">
                {s.items.map((it) => <li key={it} className="flex gap-2.5"><span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-aurora" />{it}</li>)}
              </ul>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

export const COMPANY_MESSAGES = [
  { t: "A focused first customer", b: "Distributed satellite radar developers." },
  { t: "A potential repeatable product", b: "Timing hardware with integrated calibration software." },
  { t: "A larger vision", b: "Precision timing infrastructure for cooperative space systems." },
];

/** SECTION C — investor messages, labelled as hypotheses. */
export function WhyCompany() {
  return (
    <section aria-labelledby="company-title" className="bg-gradient-to-b from-ice/70 to-cloud py-20 sm:py-28">
      <div className="mx-auto w-full max-w-7xl px-6">
        <p className="font-mono text-xs uppercase tracking-[0.35em] text-signal">The opportunity</p>
        <h2 id="company-title" className="mt-3 text-3xl font-bold uppercase tracking-tight text-navy sm:text-5xl">Why RadarSync can scale.</h2>
        <p className="mt-4 text-sm text-slate-500">Our investment thesis — to be proven with customers.</p>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {COMPANY_MESSAGES.map((m, i) => (
            <div key={m.t} className="rounded-3xl bg-white p-7 shadow-[0_20px_50px_-35px_rgba(22,58,99,0.5)]">
              <span className="font-mono text-sm text-aurora">0{i + 1}</span>
              <h3 className="mt-3 text-xl font-semibold text-navy">{m.t}</h3>
              <p className="mt-2 text-slate-600">{m.b}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/** SECTION D — closing image with a single call to action. */
export function ClosingImpression() {
  const stars = starField(160, 1600, 900, 29);
  const ring = constellation(1040, 420, 300, 300, 12);
  const inner = constellation(1040, 420, 170, 170, 7);
  return (
    <section aria-labelledby="closing-title" className="relative overflow-hidden bg-[#071629] py-28 sm:py-40">
      <svg viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" aria-hidden className="absolute inset-0 h-full w-full">
        <defs>
          <radialGradient id="close-glow" cx="65%" cy="47%" r="45%">
            <stop offset="0" stopColor="#2679b8" stopOpacity="0.55" />
            <stop offset="1" stopColor="#071629" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width="1600" height="900" fill="#071629" />
        <rect width="1600" height="900" fill="url(#close-glow)" />
        {stars.map((s, i) => <circle key={i} cx={s.x} cy={s.y} r={s.rad} fill="#fff" opacity={s.o * 0.8} />)}
        {[ring, inner].map((pts, k) => pts.map((p, i) => {
          const q = pts[(i + 1) % pts.length];
          return <line key={`c${k}-${i}`} x1={p.x} y1={p.y} x2={q.x} y2={q.y} stroke={k ? "#2ab6b0" : "#9cc0ff"} strokeOpacity="0.55" strokeWidth="1.2" strokeDasharray="5 7" className="link-flow" />;
        }))}
        {inner.map((p, i) => <line key={`r${i}`} x1="1040" y1="420" x2={p.x} y2={p.y} stroke="#2ab6b0" strokeOpacity="0.25" />)}
        {[...ring, ...inner].map((p, i) => <circle key={`n${i}`} cx={p.x} cy={p.y} r={i < ring.length ? 4.5 : 3.5} fill="#f5f8fc" className="node-pulse" style={{ animationDelay: `${(i % 6) * 0.45}s` }} />)}
        <circle cx="1040" cy="420" r="9" fill="#2ab6b0" />
        <circle cx="1040" cy="420" r="22" fill="#2ab6b0" opacity="0.2" className="node-pulse" />
      </svg>
      <div className="relative z-10 mx-auto w-full max-w-7xl px-6">
        <h2 id="closing-title" className="text-6xl font-bold uppercase tracking-tight text-white sm:text-8xl lg:text-9xl">RadarSync.</h2>
        <p className="mt-6 max-w-2xl font-mono text-sm uppercase tracking-[0.35em] text-ice sm:text-base">Timing the next era of space radar.</p>
        <Link href="/science" className="mt-12 inline-block border-2 border-white px-8 py-4 text-sm font-semibold uppercase tracking-[0.25em] text-white transition-colors hover:bg-white hover:text-navy focus-visible:bg-white focus-visible:text-navy focus-visible:outline-none">
          Explore the science
        </Link>
        <p className="mt-10 text-xs uppercase tracking-[0.2em] text-ice/70">Concept stage · Simulation-backed · Hardware next</p>
      </div>
    </section>
  );
}
