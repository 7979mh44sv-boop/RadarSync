"use client";

import { useEffect, useState } from "react";
import type { LoadState } from "@/components/Panel";

export interface ApiState<T> {
  state: LoadState;
  data: T | null;
  error: string | null;
}

/**
 * Fetch whenever the serialised request body changes. Loading is derived (the stored result's
 * key differs from the current key), so no state is set synchronously inside the effect.
 * `call` must be a stable module-level function.
 */
export function useApiRequest<B, T>(body: B | null, call: (body: B, signal: AbortSignal) => Promise<T>): ApiState<T> {
  const key = body === null ? null : JSON.stringify(body);
  const [result, setResult] = useState<{ key: string; data: T | null; error: string | null } | null>(null);
  useEffect(() => {
    if (key === null) return;
    const ctrl = new AbortController();
    call(JSON.parse(key) as B, ctrl.signal)
      .then((data) => setResult({ key, data, error: null }))
      .catch((e) => !ctrl.signal.aborted && setResult({ key, data: null, error: e instanceof Error ? e.message : String(e) }));
    return () => ctrl.abort();
  }, [key, call]);
  if (key === null) return { state: "idle", data: null, error: null };
  if (result?.key !== key) return { state: "loading", data: null, error: null };
  return result.error ? { state: "error", data: null, error: result.error } : { state: "ready", data: result.data, error: null };
}
