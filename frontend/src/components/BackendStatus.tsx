"use client";

import { useEffect, useState } from "react";
import { API_BASE_URL, fetchHealth, type HealthResponse } from "@/lib/api";

type State =
  | { kind: "loading" }
  | { kind: "online"; data: HealthResponse; latencyMs: number }
  | { kind: "offline"; error: string };

const POLL_INTERVAL_MS = 10_000;

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

  const dot =
    state.kind === "online" ? "bg-accent" : state.kind === "offline" ? "bg-danger" : "bg-warning";
  const label =
    state.kind === "online" ? "Online" : state.kind === "offline" ? "Unreachable" : "Connecting";

  return (
    <section
      aria-live="polite"
      className="rounded-2xl border border-border bg-surface/80 p-6 backdrop-blur"
    >
      <header className="flex items-center justify-between">
        <h2 className="text-xs font-medium uppercase tracking-[0.2em] text-muted">
          Simulation Engine Link
        </h2>
        <span className="flex items-center gap-2 text-sm">
          <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${dot}`}>
            {state.kind === "online" && (
              <span className="absolute inset-0 animate-ping rounded-full bg-accent opacity-60" />
            )}
          </span>
          {label}
        </span>
      </header>

      <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-3 font-mono text-sm">
        <dt className="text-muted">Endpoint</dt>
        <dd className="truncate text-right">{API_BASE_URL}/health</dd>
        {state.kind === "online" && (
          <>
            <dt className="text-muted">Service</dt>
            <dd className="text-right">
              {state.data.service} v{state.data.version}
            </dd>
            <dt className="text-muted">Round-trip</dt>
            <dd className="text-right">{state.latencyMs.toFixed(1)} ms</dd>
            <dt className="text-muted">NumPy / SciPy</dt>
            <dd className="text-right">
              {state.data.numpy_version} / {state.data.scipy_version}
            </dd>
          </>
        )}
        {state.kind === "offline" && (
          <dd className="col-span-2 text-danger">
            {state.error}. Start the backend with{" "}
            <code className="text-foreground">uvicorn app.main:app --reload</code>.
          </dd>
        )}
      </dl>
    </section>
  );
}
