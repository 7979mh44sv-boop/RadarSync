import ProvenanceBadge from "@/components/ProvenanceBadge";
import ConceptLabel from "./ConceptLabel";
import SatelliteIntegration from "./SatelliteIntegration";
import TimingBoxVisual from "./TimingBoxVisual";

function Section({ id, eyebrow, title, children, lead }: { id: string; eyebrow: string; title: string; lead?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} tabIndex={-1} className="scroll-mt-6 rounded-2xl border border-border bg-surface/80 p-5 outline-none sm:p-6">
      <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-accent">{eyebrow}</p>
      <h2 id={`${id}-title`} className="mt-1 text-xl font-semibold tracking-tight">{title}</h2>
      {lead && <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted">{lead}</p>}
      <div className="mt-5">{children}</div>
    </section>
  );
}

function Tag({ kind }: { kind: "hypothesis" | "sourced" | "proposed" | "plan" | "done" }) {
  const map = {
    hypothesis: "border-dotted border-violet-300/70 text-violet-200",
    sourced: "border-slate-300/60 text-slate-100",
    proposed: "border-dashed border-slate-500 text-slate-300",
    plan: "border-dashed border-accent-2/60 text-accent-2",
    done: "border-accent/60 text-accent",
  } as const;
  const label = { hypothesis: "HYPOTHESIS", sourced: "SOURCED", proposed: "PROPOSED", plan: "PLAN", done: "DONE" }[kind];
  return <span className={`inline-flex rounded-full border px-2 py-0.5 font-mono text-[10px] tracking-wider ${map[kind]}`}>{label}</span>;
}

export const COMPONENTS = [
  {
    t: "Atomic clock core",
    b: "A chip-scale atomic clock as the frequency reference. Today's sourced reference is the Microchip SA65 (σy(1 s) = 3×10⁻¹⁰); the challenge's NextGen CSAC (σy(1 s) < 10⁻¹⁵) is hypothetical technology.",
    tag: "proposed" as const,
  },
  {
    t: "Reference signal generation",
    b: "Clean 10 MHz, 1PPS and local-oscillator reference outputs for the radar payload, so every satellite derives its carrier and timing from a stable, characterised source.",
    tag: "proposed" as const,
  },
  {
    t: "Environmental stabilisation",
    b: "Thermal and magnetic stabilisation. Motivated by sourced SA65 sensitivities: ±3×10⁻¹⁰ frequency change over −40…+80 °C and ±9×10⁻¹¹ per gauss.",
    tag: "proposed" as const,
  },
  {
    t: "Calibration & sync software",
    b: "The RadarSync models behind this dashboard, extended into on-board calibration, holdover monitoring and a mission timing-budget tool that tells integrators which clock stability they actually need.",
    tag: "proposed" as const,
  },
];

export function ProductSection() {
  return (
    <Section id="product" eyebrow="The product" title="RadarSync Timing Box"
      lead={<>A compact atomic-clock-based precision timing module that gives every radar satellite in a formation a stable, characterised time and frequency reference — plus the software that turns clock specifications into a radar coherence budget. <span className="text-foreground">The hardware has not been built;</span> this site is the scientific software proof of concept behind it.</>}>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        <div className="space-y-2">
          <TimingBoxVisual />
          <ConceptLabel />
        </div>
        <ul className="grid gap-3 sm:grid-cols-2">
          {COMPONENTS.map((c) => (
            <li key={c.t} className="rounded-xl border border-border bg-background/40 p-4">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-medium">{c.t}</h3>
                <Tag kind={c.tag} />
              </div>
              <p className="mt-2 text-xs leading-relaxed text-muted">{c.b}</p>
            </li>
          ))}
        </ul>
      </div>
      <div className="mt-6">
        <h3 className="mb-2 text-sm font-medium">How it integrates into a distributed satellite radar</h3>
        <SatelliteIntegration />
      </div>
    </Section>
  );
}

export function WhyUsSection() {
  const items = [
    { t: "Working scientific proof of concept", b: "A validated simulation stack from clock noise to radar coherence: Phase 1 clock models, Phase 2 multi-node synchronisation, Phase 3 requirement solver — backed by automated analytical, Monte Carlo, API and rendering tests." },
    { t: "System-level differentiation", b: "We do not sell “a better clock”. We quantify when clock stability limits coherence and when non-clock errors dominate — the timing budget a radar integrator actually needs." },
    { t: "Evidence discipline", b: "Every number is labelled sourced, assumption, hypothetical or simulated. Limitations are shown, not hidden — the basis for credible customer and investor conversations." },
  ];
  return (
    <Section id="why-us" eyebrow="Why us" title="Execution and differentiation">
      <ul className="grid gap-3 md:grid-cols-3">
        {items.map((i) => (
          <li key={i.t} className="rounded-xl border border-border bg-background/40 p-4">
            <h3 className="text-sm font-medium">{i.t}</h3>
            <p className="mt-2 text-xs leading-relaxed text-muted">{i.b}</p>
          </li>
        ))}
      </ul>
    </Section>
  );
}

export function CustomerSection() {
  const buyers = [
    { t: "Satellite radar payload manufacturers", b: "Need a reference that keeps radar payloads on different spacecraft phase-coherent." },
    { t: "Distributed SAR mission developers", b: "Need to know which clock stability and synchronisation interval their coherence budget requires before committing to a design." },
    { t: "Satellite system integrators", b: "Need a qualified, characterised timing subsystem with clear interfaces instead of in-house timing design." },
  ];
  return (
    <Section id="customer" eyebrow="Who buys and why" title="Initial buyers to investigate"
      lead={<>Distributed satellite radar is our only MVP market. The buyer groups below are <span className="text-foreground">hypotheses to investigate</span>: no interviews, purchase intent, partnerships or market sizes are claimed.</>}>
      <ul className="grid gap-3 md:grid-cols-3">
        {buyers.map((b) => (
          <li key={b.t} className="rounded-xl border border-border bg-background/40 p-4">
            <div className="flex items-center justify-between gap-2"><h3 className="text-sm font-medium">{b.t}</h3><Tag kind="hypothesis" /></div>
            <p className="mt-2 text-xs leading-relaxed text-muted">{b.b}</p>
          </li>
        ))}
      </ul>
      <div className="mt-4 rounded-xl border border-border/70 bg-background/30 p-4 text-sm leading-relaxed">
        <span className="font-semibold text-accent">Why they might buy (hypothesis): </span>
        coherent multi-satellite radar only works if the satellites agree on time and carrier phase. A characterised timing module plus a
        quantified timing budget could reduce coherence risk and how often the formation must re-synchronise — <span className="text-foreground">but only where clock
        error, not calibration or link error, limits coherence.</span> The simulation below shows when that condition holds.
      </div>
    </Section>
  );
}

export function ValidationSection() {
  const done = [
    "Clock noise models from sourced SA65 datasheet data, with validated Allan-deviation estimation",
    "Multi-node synchronisation and coherence-loss simulation with analytical and Monte Carlo checks",
    "Requirement solver: which clock stability meets a coherence target, with explicit infeasible cases",
    "Interactive dashboard and API with provenance labels on every number",
  ];
  const open = [
    "Timing Box hardware: not built; no measured performance",
    "Space qualification: the commercial SA65 is not rated for space (sourced); radiation and thermal-vacuum behaviour untested",
    "Orbital dynamics, inter-satellite link performance and SAR image formation: not modelled",
    "NextGen CSAC performance: hypothetical challenge technology",
    "Customer requirements and buying process: interviews still to be done",
    "Long holdover beyond the simulated 100 s and in-orbit aging: not modelled",
  ];
  return (
    <Section id="validation" eyebrow="Evidence" title="What we have validated — and what remains unproven">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-accent/30 bg-accent/5 p-4">
          <h3 className="flex items-center gap-2 text-sm font-medium text-accent">Validated in simulation <ProvenanceBadge kind="simulated" /></h3>
          <ul className="mt-2 space-y-1.5 text-xs leading-relaxed text-foreground/85">{done.map((d) => <li key={d} className="flex gap-2"><span aria-hidden className="text-accent">✓</span>{d}</li>)}</ul>
        </div>
        <div className="rounded-xl border border-warning/40 bg-warning/5 p-4">
          <h3 className="text-sm font-medium text-warning">Still unproven</h3>
          <ul className="mt-2 space-y-1.5 text-xs leading-relaxed text-foreground/85">{open.map((d) => <li key={d} className="flex gap-2"><span aria-hidden className="text-warning">!</span>{d}</li>)}</ul>
        </div>
      </div>
    </Section>
  );
}

export function RoadmapSection() {
  const steps = [
    { t: "Scientific proof of concept", b: "Clock-to-coherence simulation, requirement solver, dashboard.", k: "done" as const },
    { t: "Customer discovery", b: "Interviews with payload makers, mission developers and integrators to confirm coherence targets and sync constraints.", k: "plan" as const },
    { t: "Lab prototype", b: "Timing Box built around a commercial CSAC; measure ADEV and phase noise; compare with the model.", k: "plan" as const },
    { t: "Environmental testing", b: "Thermal, magnetic and vibration characterisation; on-board calibration software.", k: "plan" as const },
    { t: "Space qualification & payload pilot", b: "Radiation and thermal-vacuum testing; integration study with a partner payload.", k: "plan" as const },
  ];
  const risks = [
    { r: "Breakthrough clock not available", m: "Design around a pluggable clock core; deliver value with today's CSACs plus the timing-budget software." },
    { r: "Non-clock errors dominate coherence", m: "Our solver identifies this case up front; the product includes calibration and sync-budget tooling, not only the clock." },
    { r: "Space qualification cost and time", m: "Start from parts with existing space options (SA65 lists a space option -007, sourced); qualify incrementally." },
    { r: "Model ≠ hardware", m: "Prototype measurements feed back into the validated models; the provenance system keeps assumptions explicit." },
  ];
  return (
    <Section id="roadmap" eyebrow="Roadmap" title="From proof of concept to flight hardware">
      <ol className="grid gap-3 md:grid-cols-5">
        {steps.map((s, i) => (
          <li key={s.t} className="rounded-xl border border-border bg-background/40 p-3">
            <div className="flex items-center justify-between"><span className="font-mono text-[11px] text-accent">Stage {i + 1}</span><Tag kind={s.k} /></div>
            <h3 className="mt-1 text-sm font-medium">{s.t}</h3>
            <p className="mt-1 text-xs leading-relaxed text-muted">{s.b}</p>
          </li>
        ))}
      </ol>
      <h3 className="mt-6 text-sm font-medium">Engineering risks and mitigation</h3>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full min-w-[560px] text-left text-xs">
          <thead className="text-muted"><tr><th className="py-1 pr-4 font-normal">Risk</th><th className="py-1 font-normal">Mitigation (plan)</th></tr></thead>
          <tbody>{risks.map((r) => <tr key={r.r} className="border-t border-border/60 align-top"><td className="py-1.5 pr-4 text-foreground/90">{r.r}</td><td className="py-1.5 text-muted">{r.m}</td></tr>)}</tbody>
        </table>
      </div>
    </Section>
  );
}

export function VisionSection() {
  return (
    <Section id="vision" eyebrow="Vision" title="A timing platform for distributed sensing">
      <div className="grid gap-3 md:grid-cols-3">
        {[
          ["Now (MVP)", "Distributed satellite radar: Timing Box concept + validated timing-budget software."],
          ["Next", "Standardised timing hardware family with the same calibration and budget software across missions."],
          ["Later", "Expansion into aviation and other distributed sensing markets."],
        ].map(([t, b]) => (
          <div key={t} className="rounded-xl border border-border bg-background/40 p-4">
            <div className="flex items-center justify-between"><h3 className="text-sm font-medium">{t}</h3><Tag kind={t === "Now (MVP)" ? "proposed" : "hypothesis"} /></div>
            <p className="mt-2 text-xs leading-relaxed text-muted">{b}</p>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-muted">The platform and expansion path are a growth hypothesis, not a proven market size.</p>
    </Section>
  );
}
