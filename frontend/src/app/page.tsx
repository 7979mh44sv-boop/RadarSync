import BackendStatus from "@/components/BackendStatus";
import RadarScope from "@/components/RadarScope";

const pillars = [
  {
    title: "Clock Model",
    body: "ADEV-driven oscillator noise for the breakthrough CSAC and competing references.",
  },
  {
    title: "System Model",
    body: "Distribution jitter, link noise and drift propagated to radar-level coherence metrics.",
  },
  {
    title: "Sensitivity",
    body: "Sweeps that show when the clock is the limiting factor and when it is not.",
  },
];

export default function Home() {
  return (
    <div className="relative flex flex-1 flex-col overflow-hidden">
      <div className="bg-grid pointer-events-none absolute inset-0" />

      <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-3">
          <span className="h-3 w-3 rotate-45 border border-accent" />
          <span className="font-mono text-sm font-semibold tracking-[0.3em]">RADARSYNC</span>
        </div>
        <span className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
          NextSemi Deep-Tech Hackathon
        </span>
      </header>

      <main className="relative z-10 mx-auto grid w-full max-w-6xl flex-1 items-center gap-12 px-6 py-12 lg:grid-cols-2">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-accent">
            Chip-scale atomic timing for distributed radar
          </p>
          <h1 className="mt-6 text-5xl font-semibold leading-[1.05] tracking-tight sm:text-6xl">
            Precision Timing.
            <br />
            <span className="bg-gradient-to-r from-accent to-accent-2 bg-clip-text text-transparent">
              Distributed Intelligence.
            </span>
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted">
            RadarSync is building a transparent, auditable simulation that connects a breakthrough
            chip-scale atomic clock specification to system-level radar performance.
          </p>

          <div className="mt-10 max-w-xl">
            <BackendStatus />
          </div>
        </div>

        <div className="flex justify-center">
          <RadarScope />
        </div>
      </main>

      <section className="relative z-10 mx-auto grid w-full max-w-6xl gap-4 px-6 pb-12 sm:grid-cols-3">
        {pillars.map((p) => (
          <article key={p.title} className="rounded-xl border border-border bg-surface/60 p-5">
            <div className="flex items-center justify-between">
              <h3 className="font-medium">{p.title}</h3>
              <span className="rounded-full border border-warning/40 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-warning">
                Planned
              </span>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-muted">{p.body}</p>
          </article>
        ))}
      </section>

      <footer className="relative z-10 border-t border-border py-6 text-center font-mono text-xs text-muted">
        No simulation results are shown. The physical model has not been implemented yet.
      </footer>
    </div>
  );
}
