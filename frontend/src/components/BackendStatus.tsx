"use client";

import { useEffect, useState } from "react";
import { fetchHealth, type HealthResponse } from "@/lib/api";

type State =
  | { kind: "loading" }
  | { kind: "online"; data: HealthResponse; latencyMs: number }
  | { kind: "offline"; error: string };

const POLL_INTERVAL_MS = 10_000;

/** Compact backend link indicator for the header. */
export default function BackendStatus() {
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    let controller: AbortController | null = null;
    async function check() {
      controller?.abort();
      controller = new AbortController();
      const started = performance.now();
      try {
        const data = await fetchHealth(controller.signal);
        setState({ kind: "online", data, latencyMs: performance.now() - started });
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setState({ kind: "offline", error: (err as Error).message });
      }
    }
    check();
    const id = setInterval(check, POLL_INTERVAL_MS);
    return () => {
      clearInterval(id);
      controller?.abort();
    };
  }, []);

  const dot = state.kind === "online" ? "bg-accent" : state.kind === "offline" ? "bg-danger" : "bg-warning";
  const label = state.kind === "online" ? "Engine online" : state.kind === "offline" ? "Engine unreachable" : "Connecting";
  const detail =
    state.kind === "online"
      ? `sim v${state.data.simulation_version} · ${state.latencyMs.toFixed(0)} ms`
      : state.kind === "offline"
        ? "start backend on :8000"
        : "";

  return (
    <div aria-live="polite" className="flex items-center gap-2 rounded-full border border-border bg-surface/80 px-3 py-1.5 text-xs" title={state.kind === "offline" ? state.error : undefined}>
      <span className={`relative inline-flex h-2 w-2 rounded-full ${dot}`}>
        {state.kind === "online" && <span className="absolute inset-0 animate-ping rounded-full bg-accent opacity-60" />}
      </span>
      <span>{label}</span>
      {detail && <span className="font-mono text-muted">{detail}</span>}
    </div>
  );
}
