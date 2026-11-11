import ProvenanceBadge from "@/components/ProvenanceBadge";
import ConceptLabel from "./ConceptLabel";
import SatelliteIntegration from "./SatelliteIntegration";
import TimingBoxRender from "./TimingBoxRender";
import TimingBoxVisual from "./TimingBoxVisual";

export function Band({ id, kicker, title, lead, children, className = "" }: {
  id?: string; kicker: string; title: string; lead?: React.ReactNode; children?: React.ReactNode; className?: string;
}) {
  return (
    <section id={id} aria-labelledby={id ? `${id}-title` : undefined} tabIndex={id ? -1 : undefined}
      className={`scroll-mt-6 py-16 outline-none sm:py-24 ${className}`}>
      <div className="mx-auto w-full max-w-7xl px-6">
        <p className="font-mono text-xs uppercase tracking-[0.35em] text-accent">{kicker}</p>
        <h2 id={id ? `${id}-title` : undefined} className="mt-3 text-3xl font-bold uppercase leading-[1.05] tracking-tight text-navy sm:text-5xl">{title}</h2>
        {lead && <p className="mt-4 max-w-2xl text-lg leading-relaxed text-slate-600">{lead}</p>}
        {children && <div className="mt-10">{children}</div>}
      </div>
    </section>
  );
}

function Tag({ kind }: { kind: "hypothesis" | "proposed" | "plan" | "done" }) {
  const map = {
    hypothesis: "border-dotted border-violet-500 text-violet-700",
    proposed: "border-dashed border-slate-400 text-slate-600",
    plan: "border-dashed border-accent-2 text-accent-2",
    done: "border-accent/60 text-accent",
  } as const;
  return <span className={`inline-flex rounded-full border px-2 py-0.5 font-mono text-[10px] tracking-wider ${map[kind]}`}>{kind.toUpperCase()}</span>;
}

function Card({ title, children, tag }: { title: string; children: React.ReactNode; tag?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-ice bg-white p-5 transition-colors hover:border-accent/40 hover:bg-white">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-base font-semibold text-navy">{title}</h3>
        {tag}
      </div>
      <div className="mt-2 text-sm leading-relaxed text-slate-600">{children}</div>
    </div>
  );
}

function More({ children, label = "Details" }: { children: React.ReactNode; label?: string }) {
  return (
    <details className="mt-3 text-xs leading-relaxed text-slate-500">
      <summary className="cursor-pointer text-slate-600 hover:text-navy">{label}</summary>
      <div className="mt-2">{children}</div>
    </details>
  );
}

/** The five points a jury should get in 30 seconds. */
export const JURY_POINTS = [
  { k: "What", v: "A precision timing module for satellites." },
  { k: "For whom", v: "Teams building distributed satellite radar." },
  { k: "Why", v: "Satellites must share exact time to combine radar signals." },
  { k: "Proof", v: "Our software simulates timing needs and radar coherence." },
  { k: "Status", v: "Concept and simulation done. Prototype next." },
];

export function JurySummary() {
  return (
    <section aria-label="RadarSync in 30 seconds" className="border-y border-ice bg-cloud">
      <dl className="mx-auto grid w-full max-w-7xl gap-px px-6 py-8 sm:grid-cols-2 lg:grid-cols-5">
        {JURY_POINTS.map((p) => (
          <div key={p.k} className="py-3 lg:px-4">
            <dt className="font-mono text-[11px] uppercase tracking-[0.3em] text-accent">{p.k}</dt>
            <dd className="mt-1 text-sm leading-snug text-navy">{p.v}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export const COMPONENTS = [
  { t: "Atomic clock core", s: "Keeps very stable time.",
    d: "Today's sourced reference: Microchip SA65, σy(1 s) = 3×10⁻¹⁰. The challenge's NextGen CSAC (σy(1 s) < 10⁻¹⁵) is hypothetical technology.", tag: "proposed" as const },
  { t: "Reference signals", s: "Clean 10 MHz, 1PPS and radar reference outputs.",
    d: "Every satellite derives its carrier and timing from one stable, characterised source.", tag: "proposed" as const },
  { t: "Stable environment", s: "Shields the clock from heat and magnetic fields.",
    d: "Motivated by sourced SA65 sensitivities: ±3×10⁻¹⁰ over −40…+80 °C and ±9×10⁻¹¹ per gauss.", tag: "proposed" as const },
  { t: "Calibration software", s: "Shows which clock a mission really needs.",
    d: "Built on the RadarSync models on this site: calibration, holdover monitoring and a timing-budget tool.", tag: "proposed" as const },
];

export function WhyUsSection() {
  return (
    <Band id="why-us" kicker="How we work" title="We measure what matters." lead="We show when the clock limits a radar — and when it does not.">
      <div className="grid gap-4 md:grid-cols-3">
        <Card title="Working science">A tested simulation from clock noise to radar coherence.
          <More>Phase 1 clock models, Phase 2 multi-satellite synchronisation, Phase 3 requirement solver — backed by automated analytical, Monte Carlo, API and rendering tests.</More></Card>
        <Card title="System view">We don&apos;t just sell a better clock. We size the whole timing budget.</Card>
        <Card title="Honest evidence">Every number is labelled: sourced, assumed, hypothetical or simulated.</Card>
      </div>
    </Band>
  );
}

export function ProductSection({ afterRender }: { afterRender?: React.ReactNode } = {}) {
  return (
    <Band id="product" kicker="02 · How" title="The Timing Box"
      lead="One compact module. Designed to keep every satellite in a formation on precise time.">
      <div className="rounded-3xl border border-ice bg-gradient-to-b from-ice to-cloud px-4 py-8 sm:px-10">
        <TimingBoxRender priority />
      </div>
      {afterRender && <div className="mt-16">{afterRender}</div>}
      <h3 className="mt-16 text-2xl font-bold uppercase tracking-tight text-navy sm:text-3xl">Architecture</h3>
      <p className="mt-2 max-w-xl text-slate-600">Four building blocks. One compact module.</p>
      <div className="mt-6 grid items-center gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <div className="rounded-3xl border border-ice bg-gradient-to-b from-white to-transparent p-6">
          <TimingBoxVisual />
          <div className="mt-3"><ConceptLabel /></div>
        </div>
        <ul className="grid gap-4 sm:grid-cols-2">
          {COMPONENTS.map((c) => (
            <li key={c.t}><Card title={c.t}>{c.s}<More>{c.d}</More></Card></li>
          ))}
        </ul>
      </div>
      <div className="mt-20">
        <h3 className="text-2xl font-bold uppercase tracking-tight text-navy sm:text-3xl">On every satellite</h3>
        <p className="mt-2 max-w-xl text-slate-600">Each satellite carries a Timing Box. A link keeps them in sync.</p>
        <div className="mt-6"><SatelliteIntegration /></div>
      </div>
      <div className="mt-16 grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-signal/40 bg-ice/70 p-6">
          <h3 className="font-semibold uppercase tracking-[0.15em] text-navy">Why customers need it</h3>
          <p className="mt-2 text-slate-700">Know exactly which clock your formation needs, and put a stable, characterised reference on every satellite where timing limits the radar.</p>
        </div>
        <div className="rounded-2xl border border-warning/40 bg-warning/5 p-6">
          <h3 className="font-semibold uppercase tracking-[0.15em] text-warning">Where we are</h3>
          <p className="mt-2 text-slate-700">Engineering the next generation of precision timing hardware. Concept and simulation are done; the prototype is next. Precise timing works together with synchronisation and calibration to make a radar coherent.</p>
        </div>
      </div>
    </Band>
  );
}

export function ProblemSection() {
  return (
    <Band id="problem" kicker="The problem" title="Many satellites. Many clocks."
      lead="In a satellite radar formation, every satellite has its own clock. To work as one radar, they must agree on time and phase." />
  );
}

export function MissionSection() {
  return (
    <Band id="mission" kicker="Our mission" title="Precision timing across the constellation."
      lead="Each satellite carries its own Timing Box. With synchronisation and calibration, they can help a formation work as one radar." />
  );
}

export function WhyItMattersSection() {
  return (
    <Band id="why-it-matters" kicker="Why this approach matters" title="Small timing errors, big losses."
      lead="If the satellites disagree, their radar signals no longer add up. At 10 GHz, 100 ps of timing error already means about 6 radians of phase (2π·f·Δt)." />
  );
}

export function ScienceIntro() {
  return (
    <Band id="science" kicker="02 · How" title="See the science."
      lead="Live results from our simulation. Change the setup and run it yourself." />
  );
}

export function ValidationSection() {
  const done = [
    "Clock noise models from sourced SA65 datasheet data",
    "Multi-satellite timing and coherence simulation, checked against theory",
    "Requirement solver, including targets no clock can meet",
    "Live dashboard and API with labels on every number",
  ];
  const open = [
    "Build the Timing Box prototype and measure its performance",
    "Space qualification: radiation and thermal-vacuum testing (today's commercial SA65 is not rated for space, sourced)",
    "Extend the model: orbital dynamics, the inter-satellite link and SAR imaging",
    "Demonstrate a next-generation clock core (today: the challenge's hypothetical target)",
    "Customer discovery interviews with radar and mission teams",
    "Long holdover beyond the simulated 100 s and in-orbit aging",
  ];
  return (
    <Band id="validation" kicker="Evidence" title="What we've built. What's next.">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-accent/30 bg-accent/5 p-6">
          <h3 className="flex items-center gap-2 font-semibold text-accent">Built and validated in simulation <ProvenanceBadge kind="simulated" /></h3>
          <ul className="mt-3 space-y-2 text-sm text-slate-700">{done.map((d) => <li key={d} className="flex gap-2"><span aria-hidden className="text-accent">✓</span>{d}</li>)}</ul>
        </div>
        <div className="rounded-2xl border border-warning/40 bg-warning/5 p-6">
          <h3 className="font-semibold text-warning">Next milestones</h3>
          <ul className="mt-3 space-y-2 text-sm text-slate-700">{open.map((d) => <li key={d} className="flex gap-2"><span aria-hidden className="text-warning">!</span>{d}</li>)}</ul>
        </div>
      </div>
    </Band>
  );
}

export function CustomerSection() {
  const buyers = [
    { t: "Radar payload makers", b: "Need payloads on different satellites to stay phase-aligned." },
    { t: "Distributed SAR missions", b: "Know the clock they need before they build." },
    { t: "Satellite integrators", b: "Buy a tested timing module instead of designing one." },
  ];
  return (
    <Band id="customer" kicker="03 · What" title="Who we serve."
      lead="Teams building the next generation of distributed satellite radar.">
      <div className="grid gap-4 md:grid-cols-3">
        {buyers.map((b) => <Card key={b.t} title={b.t}>{b.b}</Card>)}
      </div>
      <p className="mt-3 text-sm text-slate-500">Our target segments for the first customer conversations.</p>
      <p className="mt-8 max-w-3xl text-lg leading-relaxed text-slate-700">
        <span className="font-semibold text-accent">Why they buy: </span>
        Precision timing is the foundation of coordinated satellite radar. We size the clock to the mission and show where calibration matters
        just as much — so every part of the timing budget pulls its weight.
      </p>
    </Band>
  );
}

export function RoadmapSection() {
  const steps = [
    { t: "Proof of concept", b: "Simulation and dashboard.", k: "done" as const },
    { t: "Customer discovery", b: "Talk to radar and mission teams.", k: "plan" as const },
    { t: "Lab prototype", b: "Build it with a commercial CSAC. Measure it.", k: "plan" as const },
    { t: "Environment tests", b: "Heat, magnetic fields, vibration.", k: "plan" as const },
    { t: "Space qualification", b: "Radiation tests and a payload pilot.", k: "plan" as const },
  ];
  const risks = [
    { r: "Breakthrough clock not available", m: "Pluggable clock core; today's CSACs plus our timing-budget software still add value." },
    { r: "Non-clock errors dominate", m: "Our solver detects this early; the product includes calibration and sync tools." },
    { r: "Space qualification cost and time", m: "Start from parts with existing space options (SA65 lists option -007, sourced); qualify step by step." },
    { r: "Model ≠ hardware", m: "Prototype measurements feed back into the models; assumptions stay labelled." },
  ];
  return (
    <Band id="roadmap" kicker="Milestones" title="Roadmap.">
      <ol className="grid gap-4 md:grid-cols-5">
        {steps.map((s, i) => (
          <li key={s.t} className="rounded-2xl border border-ice p-4 transition-colors hover:border-accent/40">
            <div className="flex items-center justify-between"><span className="font-mono text-xs text-accent">0{i + 1}</span><Tag kind={s.k} /></div>
            <h3 className="mt-3 font-semibold text-navy">{s.t}</h3>
            <p className="mt-1 text-sm text-slate-600">{s.b}</p>
          </li>
        ))}
      </ol>
      <details className="mt-6 rounded-2xl border border-ice p-4 text-sm">
        <summary className="cursor-pointer font-semibold text-navy">Engineering risks and how we reduce them</summary>
        <table className="mt-3 w-full text-left text-sm">
          <tbody>{risks.map((r) => <tr key={r.r} className="border-t border-ice align-top"><td className="py-2 pr-4 text-navy">{r.r}</td><td className="py-2 text-slate-600">{r.m}</td></tr>)}</tbody>
        </table>
      </details>
    </Band>
  );
}

export function VisionSection() {
  return (
    <Band id="vision" kicker="03 · What" title="The bigger picture."
      lead="Start with satellite radar. Grow into a timing platform for distributed sensing — later perhaps aviation.">
      <p className="text-sm text-slate-500">This is a growth hypothesis, not a proven market size.</p>
    </Band>
  );
}
