/** Decorative radar scope. Purely visual; displays no data. */
export default function RadarScope() {
  return (
    <div
      aria-hidden
      className="relative aspect-square w-full max-w-md overflow-hidden rounded-full border border-accent/30 bg-[radial-gradient(circle,rgb(56_225_198/0.08),transparent_70%)]"
    >
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="absolute rounded-full border border-accent/15"
          style={{ inset: `${i * 12.5}%` }}
        />
      ))}
      <div className="absolute inset-x-0 top-1/2 h-px bg-accent/15" />
      <div className="absolute inset-y-0 left-1/2 w-px bg-accent/15" />
      <div className="radar-sweep absolute inset-0 rounded-full" />
      <div className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent shadow-[0_0_12px_var(--accent)]" />
    </div>
  );
}
