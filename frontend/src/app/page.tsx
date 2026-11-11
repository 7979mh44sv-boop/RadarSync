import BackendStatus from "@/components/BackendStatus";
import Dashboard from "@/components/Dashboard";
import ConceptLabel from "@/components/product/ConceptLabel";
import {
  CustomerSection,
  ProductSection,
  RoadmapSection,
  ValidationSection,
  VisionSection,
  WhyUsSection,
} from "@/components/product/ProductSections";
import TimingBoxVisual from "@/components/product/TimingBoxVisual";
import ValueChain from "@/components/product/ValueChain";
import ModelScope from "@/components/story/ModelScope";
import ResearchContext from "@/components/story/ResearchContext";
import StoryStrip from "@/components/story/StoryStrip";

const NAV = [
  { href: "#why-us", label: "Why us" },
  { href: "#product", label: "Product" },
  { href: "#insight", label: "Live simulation" },
  { href: "#customer", label: "Customer" },
  { href: "#roadmap", label: "Roadmap" },
];

function PartHeading({ id, label, title }: { id: string; label: string; title: string }) {
  return (
    <div id={id} className="scroll-mt-6 border-t border-border/60 pt-8">
      <p className="font-mono text-xs uppercase tracking-[0.35em] text-accent">{label}</p>
      <h2 className="mt-1 text-2xl font-semibold tracking-tight">{title}</h2>
    </div>
  );
}

export default function Home() {
  return (
    <div className="relative flex flex-1 flex-col">
      <a href="#product" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-accent focus:px-3 focus:py-2 focus:text-background">
        Skip to the product
      </a>
      <div className="bg-grid pointer-events-none absolute inset-x-0 top-0 h-[560px]" />

      <header className="relative z-10 mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-3 px-6 pt-6">
        <div className="flex items-center gap-3">
          <span className="h-3 w-3 rotate-45 border border-accent" />
          <span className="font-mono text-sm font-semibold tracking-[0.3em]">RADARSYNC</span>
          <span className="hidden font-mono text-xs uppercase tracking-[0.2em] text-muted sm:inline">· NextSemi Deep-Tech Hackathon</span>
        </div>
        <nav aria-label="Sections" className="order-3 w-full overflow-x-auto md:order-none md:w-auto">
          <ul className="flex gap-4 whitespace-nowrap text-xs text-muted">
            {NAV.map((n) => <li key={n.href}><a href={n.href} className="hover:text-foreground">{n.label}</a></li>)}
          </ul>
        </nav>
        <BackendStatus />
      </header>

      <section className="relative z-10 mx-auto grid w-full max-w-7xl items-center gap-10 px-6 pt-12 pb-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,460px)]">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-accent">Distributed satellite radar · precision timing hardware</p>
          <h1 className="mt-4 text-4xl font-semibold leading-[1.05] tracking-tight sm:text-6xl">
            One Constellation.{" "}
            <span className="bg-gradient-to-r from-accent to-accent-2 bg-clip-text text-transparent">One Coherent Radar.</span>
          </h1>
          <p className="mt-4 text-xl text-foreground/90">The Precision Timing Backbone for Distributed Satellite Radar.</p>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted">
            Several small radar satellites can image like one large radar — if they agree on time and carrier phase. RadarSync proposes the
            <span className="text-foreground"> Timing Box</span>: a compact atomic-clock-based timing module with calibration software, backed by a
            validated simulation that shows which clock stability a formation really needs and when other errors dominate.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <a href="#product" className="rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-background hover:bg-accent/90">See the Timing Box</a>
            <a href="#insight" className="rounded-lg border border-border px-4 py-2.5 text-sm hover:border-accent/60">Run the live simulation</a>
          </div>
          <p className="mt-4 text-xs text-muted">Hardware not yet built · all results simulated from stated assumptions · no measured satellite radar performance.</p>
        </div>
        <div className="space-y-2">
          <TimingBoxVisual />
          <ConceptLabel />
        </div>
      </section>

      <section aria-label="Story" className="relative z-10 mx-auto w-full max-w-7xl px-6 pb-4">
        <StoryStrip />
      </section>

      <div className="relative z-10 mx-auto w-full max-w-7xl space-y-6 px-4 sm:px-6">
        <PartHeading id="part-why-us" label="Part 1 · Why us" title="The team's execution and differentiation" />
        <WhyUsSection />

        <PartHeading id="part-how" label="Part 2 · How" title="Product, technology and simulated evidence" />
        <ProductSection />
      </div>

      <main className="relative z-10 flex-1">
        <Dashboard />
      </main>

      <div className="relative z-10 mx-auto w-full max-w-7xl space-y-6 px-4 pb-10 sm:px-6">
        <ValidationSection />

        <PartHeading id="part-what" label="Part 3 · What" title="Customer, value and business opportunity" />
        <CustomerSection />
        <section id="value-chain" aria-labelledby="value-chain-title" className="scroll-mt-6 rounded-2xl border border-border bg-surface/80 p-5 sm:p-6">
          <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-accent">Buyer value chain</p>
          <h2 id="value-chain-title" className="mt-1 text-xl font-semibold tracking-tight">Research → Customer problem → Hardware capability → Simulated evidence → Buyer benefit → Remaining validation</h2>
          <div className="mt-5"><ValueChain /></div>
        </section>
        <RoadmapSection />
        <VisionSection />

        <section id="research" aria-labelledby="research-title" className="scroll-mt-6 rounded-2xl border border-border bg-surface/80 p-5 sm:p-6">
          <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-accent">Adjacent research</p>
          <h2 id="research-title" className="mt-1 text-lg font-semibold tracking-tight">Coherence across separately moving radar nodes is an open problem</h2>
          <div className="mt-4"><ResearchContext /></div>
        </section>
        <section aria-labelledby="scope-title" className="rounded-2xl border border-border bg-surface/80 p-5 sm:p-6">
          <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-accent">Model scope</p>
          <h2 id="scope-title" className="mt-1 mb-4 text-lg font-semibold tracking-tight">What the simulation covers — and what it does not</h2>
          <ModelScope />
        </section>
      </div>

      <footer className="relative z-10 border-t border-border px-6 py-6 text-center text-xs leading-relaxed text-muted">
        The RadarSync Timing Box is a proposed product concept; the hardware has not been built. All results are simulated from stated assumptions and
        sourced datasheet values. No measured satellite radar performance, customers, partnerships, market sizes or cost savings are claimed.
        Product and satellite graphics are conceptual.
      </footer>
    </div>
  );
}
