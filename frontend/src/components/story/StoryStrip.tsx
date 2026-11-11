const STEPS = [
  {
    k: "Problem",
    title: "Separate satellites, separate clocks",
    body: "In a distributed satellite radar every spacecraft carries its own radar payload and oscillator. To act as one coherent radar, they must agree on time and carrier phase. At 10 GHz, a 100 ps timing error already corresponds to 2π·f·Δt ≈ 6.3 rad of phase.",
  },
  {
    k: "Simulation",
    title: "From clock noise to coherence loss",
    body: "RadarSync propagates sourced and assumed clock-noise models, synchronisation and non-clock timing errors (calibration, distribution, propagation) through Monte Carlo simulation to temporal and spatial coherent-integration loss.",
  },
  {
    k: "Insight",
    title: "When does the clock matter?",
    body: "The requirement solver shows which clock stability a coherence-loss target needs under stated assumptions, and where non-clock errors dominate so that a better clock no longer helps.",
  },
];

export default function StoryStrip() {
  return (
    <ol className="grid gap-3 md:grid-cols-3" aria-label="Problem, simulation and insight">
      {STEPS.map((s, i) => (
        <li key={s.k} className="relative rounded-2xl border border-border bg-surface/70 p-4">
          <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.25em] text-accent">
            <span className="flex h-5 w-5 items-center justify-center rounded-full border border-accent/60 text-[10px]">{i + 1}</span>
            {s.k}
          </div>
          <h2 className="mt-2 text-base font-semibold">{s.title}</h2>
          <p className="mt-1 text-sm leading-relaxed text-muted">{s.body}</p>
          {i < STEPS.length - 1 && (
            <span aria-hidden className="absolute -right-3 top-1/2 z-10 hidden -translate-y-1/2 text-lg text-accent md:block">→</span>
          )}
        </li>
      ))}
    </ol>
  );
}
