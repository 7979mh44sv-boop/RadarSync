/** Typed client for the RadarSync FastAPI backend. Types mirror backend/app/schemas.py. */

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export type Provenance = "sourced" | "assumption" | "hypothetical_target" | "simulated";

export interface QuantityOut {
  value: number;
  unit: string;
  provenance: Provenance;
  source: string;
}

export interface HealthResponse {
  status: string;
  service: string;
  version: string;
  environment: string;
  timestamp: string;
  simulation_version: string;
  numpy_version: string;
  scipy_version: string;
}

export interface ScenarioOut {
  key: string;
  label: string;
  category: Provenance;
  parameters: Record<string, QuantityOut>;
  valid_tau_range_s: [number, number] | null;
  adev_at_1s: QuantityOut;
  notes: string;
}

export interface SourcedPoint {
  tau_s: number;
  adev: number;
  provenance: Provenance;
  source: string;
}

export interface ScenarioList {
  scenarios: ScenarioOut[];
  sa65_datasheet_adev: SourcedPoint[];
  nextgen_target: SourcedPoint;
}

export interface AdevCurve {
  scenario_key: string;
  label: string;
  tau_s: number[];
  model_adev: number[];
  constrained: boolean[];
  model_provenance: Provenance;
  simulated_tau_s: number[] | null;
  simulated_adev: number[] | null;
  simulated_provenance: Provenance | null;
}

export interface AdevResponse {
  curves: AdevCurve[];
  seed: number;
  notes: string[];
}

export interface NonClockTerms {
  calibration_rms_s: number;
  distribution_jitter_rms_s: number;
  propagation_random_walk_s_per_sqrt_s: number;
  environmental_ramp_rms_per_s: number;
}

export type SyncMode = "none" | "time" | "time_frequency";

export interface NetworkConfig {
  carrier_frequency_hz: number;
  n_nodes: number;
  observation_s: number;
  sample_interval_s: number;
  cpi_s: number;
  sync_mode: SyncMode;
  sync_interval_s: number;
  sync_error_rms_s: number;
  clock_correlation: number;
  non_clock: NonClockTerms;
  n_monte_carlo: number;
  seed: number;
}

export interface TimingSeries {
  scenario_key: string;
  label: string;
  node_pair: [number, number];
  t_s: number[];
  clock_s: number[];
  non_clock_s: number[];
  total_s: number[];
  decimation: number;
  sync_epochs_s: number[];
  rms_s: Record<"clock" | "non_clock" | "total", QuantityOut>;
  contribution_rms_s: Record<string, QuantityOut>;
  run_seed: number;
  provenance: Provenance;
}

export interface CoherenceResult {
  scenario_key: string;
  label: string;
  metrics: Record<string, QuantityOut>;
  contribution_rms_s: Record<string, QuantityOut>;
}

export interface CoherenceResponse {
  results: CoherenceResult[];
  config_parameters: Record<string, QuantityOut>;
  n_monte_carlo: number;
  seed: number;
  confidence_intervals: "not computed";
  loss_ceiling_temporal_db: number;
  loss_ceiling_spatial_db: number;
  notes: string[];
}

export interface ParameterSpec {
  name: string;
  label: string;
  unit: string;
  default: number | string;
  minimum: number | null;
  maximum: number | null;
  options: string[] | null;
  provenance: Provenance;
  description: string;
}

export interface ParametersResponse {
  parameters: ParameterSpec[];
  limits: Record<string, number>;
  rules: string[];
}

export interface PhaseNoiseCheck {
  offset_hz: number;
  model_dbc_hz: number;
  datasheet_limit_dbc_hz: number;
  margin_db: number;
}

export interface LimitationsResponse {
  sa65_phase_noise_check: PhaseNoiseCheck[];
  max_model_excess_db: number;
  statements: string[];
}

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "ApiError";
  }
}

/** Turn FastAPI error payloads (422 list or string detail) into one readable sentence. */
export function describeApiError(status: number, body: unknown): string {
  const detail = (body as { detail?: unknown } | null)?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((d: { msg?: string; loc?: unknown[] }) => {
        const field = Array.isArray(d.loc) ? d.loc.filter((p) => p !== "body").join(".") : "";
        const msg = (d.msg ?? "invalid value").replace(/^Value error, /, "");
        return field ? `${field}: ${msg}` : msg;
      })
      .join("; ");
  }
  return `Backend responded with HTTP ${status}`;
}

async function request<T>(path: string, init?: RequestInit & { signal?: AbortSignal }): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    cache: "no-store",
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      /* non-JSON error */
    }
    throw new ApiError(describeApiError(res.status, body), res.status);
  }
  return res.json() as Promise<T>;
}

const post = <T,>(path: string, body: unknown, signal?: AbortSignal) =>
  request<T>(path, { method: "POST", body: JSON.stringify(body), signal });

export const api = {
  health: (signal?: AbortSignal) => request<HealthResponse>("/health", { signal }),
  scenarios: (signal?: AbortSignal) => request<ScenarioList>("/api/v1/scenarios", { signal }),
  parameters: (signal?: AbortSignal) => request<ParametersResponse>("/api/v1/parameters", { signal }),
  limitations: (signal?: AbortSignal) => request<LimitationsResponse>("/api/v1/limitations", { signal }),
  adev: (body: { scenario_keys: string[]; seed?: number }, signal?: AbortSignal) =>
    post<AdevResponse>("/api/v1/clock/adev", body, signal),
  timing: (
    body: { scenario_key: string; config: NetworkConfig; node_pair: [number, number]; max_points?: number },
    signal?: AbortSignal,
  ) => post<TimingSeries>("/api/v1/network/timing", body, signal),
  coherence: (body: { scenario_keys: string[]; config: NetworkConfig }, signal?: AbortSignal) =>
    post<CoherenceResponse>("/api/v1/radar/coherence", body, signal),
};

/** Kept for the status indicator. */
export const fetchHealth = api.health;
