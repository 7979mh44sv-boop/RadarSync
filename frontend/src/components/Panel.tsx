import type { ReactNode } from "react";

export type LoadState = "idle" | "loading" | "ready" | "error";

export function Panel({ id, eyebrow, title, subtitle, actions, children }: {
  id?: string;
  eyebrow: string;
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section id={id} className="rounded-2xl border border-border bg-surface/80 p-5 backdrop-blur sm:p-6">
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-accent">{eyebrow}</p>
          <h2 className="mt-1 text-lg font-semibold tracking-tight">{title}</h2>
          {subtitle && <p className="mt-1 max-w-3xl text-sm leading-relaxed text-muted">{subtitle}</p>}
        </div>
        {actions}
      </header>
      {children}
    </section>
  );
}

export function StatusBlock({ state, error, empty, height = 200 }: {
  state: LoadState;
  error?: string | null;
  empty?: string;
  height?: number;
}) {
  if (state === "loading") {
    return (
      <div role="status" className="flex animate-pulse items-center justify-center rounded-xl border border-dashed border-border text-sm text-muted" style={{ height }}>
        Running simulation…
      </div>
    );
  }
  if (state === "error") {
    return (
      <div role="alert" className="flex flex-col items-center justify-center gap-1 rounded-xl border border-danger/40 bg-danger/5 p-4 text-center text-sm" style={{ height }}>
        <span className="font-medium text-danger">Request failed</span>
        <span className="max-w-xl text-muted">{error}</span>
      </div>
    );
  }
  return (
    <div className="flex items-center justify-center rounded-xl border border-dashed border-border text-sm text-muted" style={{ height }}>
      {empty ?? "No data yet."}
    </div>
  );
}

export function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-border bg-background/40 px-4 py-3">
      <div className="text-[11px] uppercase tracking-wider text-muted">{label}</div>
      <div className="mt-1 font-mono text-lg text-foreground">{value}</div>
      {hint && <div className="mt-0.5 text-[11px] text-muted">{hint}</div>}
    </div>
  );
}
