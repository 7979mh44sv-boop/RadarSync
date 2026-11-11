const DOES = [
  "Stochastic clock noise (white, flicker, random-walk FM, drift) from sourced, assumed and hypothetical models",
  "Synchronisation and non-clock timing errors per satellite radar node",
  "Relative time and carrier-phase error between nodes",
  "Temporal and spatial coherent-integration loss (Monte Carlo)",
  "Sensitivity sweeps and modelled clock-stability requirements",
];
const DOES_NOT = [
  "Orbital dynamics, relative motion or the inter-satellite link itself",
  "SAR image formation or image quality metrics",
  "Radiation, thermal-vacuum or other space-environment effects",
  "Indefinite, link-free phase coherence (never claimed)",
  "Detection range, radar cross-section or operational performance",
  "Measured hardware data (all results are simulated)",
];

export default function ModelScope() {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="rounded-xl border border-accent/30 bg-accent/5 p-4">
        <h3 className="text-sm font-medium text-accent">What RadarSync models</h3>
        <ul className="mt-2 space-y-1.5 text-xs leading-relaxed text-foreground/85">
          {DOES.map((d) => <li key={d} className="flex gap-2"><span aria-hidden className="text-accent">✓</span>{d}</li>)}
        </ul>
      </div>
      <div className="rounded-xl border border-border bg-background/40 p-4">
        <h3 className="text-sm font-medium text-foreground/90">What it does not model</h3>
        <ul className="mt-2 space-y-1.5 text-xs leading-relaxed text-muted">
          {DOES_NOT.map((d) => <li key={d} className="flex gap-2"><span aria-hidden>✕</span>{d}</li>)}
        </ul>
      </div>
    </div>
  );
}
