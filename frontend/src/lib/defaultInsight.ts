"use client";

import { api, sensitivityApi, type NetworkConfig, type ParametersResponse, type RequirementRequest, type RequirementsResponse, type ScenarioList } from "./api";
import { useApiRequest, type ApiState } from "./useApiRequest";

/** Default (assumed) network configuration from the backend's parameter specification. */
export function defaultConfigFrom(p: ParametersResponse): NetworkConfig {
  const d = (name: string) => p.parameters.find((x) => x.name === name)?.default as number;
  return {
    carrier_frequency_hz: d("carrier_frequency_hz"), n_nodes: d("n_nodes"), observation_s: d("observation_s"),
    sample_interval_s: d("sample_interval_s"), cpi_s: d("cpi_s"),
    sync_mode: p.parameters.find((x) => x.name === "sync_mode")?.default as NetworkConfig["sync_mode"],
    sync_interval_s: d("sync_interval_s"), sync_error_rms_s: d("sync_error_rms_s"), clock_correlation: d("clock_correlation"),
    non_clock: {
      calibration_rms_s: d("calibration_rms_s"), distribution_jitter_rms_s: d("distribution_jitter_rms_s"),
      propagation_random_walk_s_per_sqrt_s: d("propagation_random_walk_s_per_sqrt_s"), environmental_ramp_rms_per_s: d("environmental_ramp_rms_per_s"),
    },
    n_monte_carlo: d("n_monte_carlo"), seed: d("seed"),
  };
}

// One shared request per page load: the Key Insight and the value chain use identical inputs.
let metaPromise: Promise<{ params: ParametersResponse; scenarios: ScenarioList }> | null = null;
const requirementCache = new Map<string, Promise<RequirementsResponse>>();

function loadMeta() {
  metaPromise ??= Promise.all([api.parameters(), api.scenarios()]).then(([params, scenarios]) => ({ params, scenarios }));
  metaPromise.catch(() => { metaPromise = null; });
  return metaPromise;
}

const fetchDefaultInsight = () =>
  loadMeta().then(({ params, scenarios }) => {
    const body: RequirementRequest = {
      base_scenario_keys: scenarios.scenarios.map((s) => s.key), config: defaultConfigFrom(params),
      metric: "spatial", target_loss_db: 1,
    };
    const key = JSON.stringify(body);
    if (!requirementCache.has(key)) {
      const p = sensitivityApi.requirement(body);
      p.catch(() => requirementCache.delete(key));
      requirementCache.set(key, p);
    }
    return requirementCache.get(key)!;
  });

const DEFAULT_BODY = { kind: "default" as const };

/** Phase 3 requirement at the default assumptions (1 dB spatial target, every clock noise shape). */
export function useDefaultInsight(): ApiState<RequirementsResponse> {
  return useApiRequest(DEFAULT_BODY, fetchDefaultInsight);
}
