import BackendStatus from "@/components/BackendStatus";
import Dashboard from "@/components/Dashboard";
import RadarScope from "@/components/RadarScope";

export default function Home() {
  return (
    <div className="relative flex flex-1 flex-col">
      <div className="bg-grid pointer-events-none absolute inset-x-0 top-0 h-[420px]" />

      <header className="relative z-10 mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-3 px-6 pt-6">
        <div className="flex items-center gap-3">
          <span className="h-3 w-3 rotate-45 border border-accent" />
          <span className="font-mono text-sm font-semibold tracking-[0.3em]">RADARSYNC</span>
          <span className="hidden font-mono text-xs uppercase tracking-[0.2em] text-muted sm:inline">· NextSemi Deep-Tech Hackathon</span>
        </div>
        <BackendStatus />
      </header>

      <section className="relative z-10 mx-auto grid w-full max-w-7xl items-center gap-8 px-6 pt-10 pb-2 md:grid-cols-[minmax(0,1fr)_200px]">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-accent">Chip-scale atomic timing for distributed radar</p>
          <h1 className="mt-4 text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl">
            Precision Timing.{" "}
            <span className="bg-gradient-to-r from-accent to-accent-2 bg-clip-text text-transparent">Distributed Intelligence.</span>
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-relaxed text-muted">
            An auditable simulation that traces clock stability through node synchronisation to radar coherent-integration loss,
            comparing an existing CSAC, an illustrative OCXO and a hypothetical next-generation CSAC under identical assumptions.
          </p>
        </div>
        <div className="hidden md:block">
          <RadarScope />
        </div>
      </section>

      <main className="relative z-10 flex-1">
        <Dashboard />
      </main>

      <footer className="relative z-10 border-t border-border px-6 py-6 text-center text-xs leading-relaxed text-muted">
        All results are simulated from stated assumptions and sourced datasheet values. No measured radar performance,
        detection-range improvement or operational capability is claimed.
      </footer>
    </div>
  );
}
