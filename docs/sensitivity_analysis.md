# Sensitivity Analysis and Modelled Clock-Stability Requirements (Phase 3)

Code: `backend/radarsync_sim/sensitivity.py` · API: `backend/app/services/sensitivity.py`,
`/api/v1/sensitivity/*` · Tests: `backend/tests/sim/test_sensitivity.py`,
`backend/tests/test_api_sensitivity.py`, `frontend/tests/{sensitivity.test.ts,phase3.integration.test.tsx}` ·
Builds on [clock_noise_model.md](clock_noise_model.md) and [radar_timing_model.md](radar_timing_model.md).

> **Scope.** This phase asks how simulated coherence loss depends on clock stability and on system
> parameters, and what clock stability would meet a chosen loss target **under explicitly stated
> assumptions**. A modelled requirement is **not** a verified device capability. Nothing here is a
> measured radar result, and no detection range, RCS or operational benefit is claimed.

## 1. Question and approach

For a radar network configuration (carrier, nodes, CPI, observation, sync mode and interval, and the
non-clock error budget, all `ASSUMPTION`s), we ask:

1. How do temporal and spatial coherence loss change as one parameter varies, with everything else held fixed?
2. What is the largest clock instability for which the simulated loss stays at or below a target L*?

No new physics is introduced. Every loss is computed with the validated Phase 2 functions
(`simulate_network`, `temporal_gains`, `spatial_gains`) on clock models from Phase 1.

## 2. Clock-noise scaling, and why one ADEV number is not enough

A clock is described by its whole Allan-deviation curve. The mix of white, flicker and random-walk FM
plus drift decides which averaging times dominate the coherence loss. A requirement is therefore stated
**relative to a base noise shape**:

σ_y(τ) → s · σ_y,base(τ)  (`radar.scale_clock`, every term including drift scaled by s)

It is reported as:
- the equivalent **σ_y(1 s) = s · σ_y,base(1 s)**, as a convenient label;
- the scaled ADEV at the averaging times the system actually uses: the CPI, 1 s, and the sync interval
  (or the observation time if there is no sync).

It is computed separately for each base shape: the SA65 fit, the illustrative OCXO, and the two
hypothetical NextGen mixes. If the shapes disagree, a single-number specification would be
insufficient. The examples below show that they do disagree.

## 3. Exact rescaling with common random numbers

With fixed seeds, every clock-noise generator is linear in its coefficient and drift is deterministic.
So the clock contribution of the scaled model is exactly s times the base contribution, and the
non-clock contribution does not change:

r(s) = s · r_clock(1) + r_non-clock

This was verified to rounding precision (about 10⁻¹⁵ relative) for all four scenarios
(`test_clock_contribution_is_exactly_linear_in_scale`).

`RealizationSet` simulates each Monte Carlo run once and evaluates any scale from the stored residuals.
The same holds for any carrier frequency, because time errors don't depend on it.

Consequences:
- **Consistency:** `RealizationSet.losses(1)` reproduces Phase 2 `evaluate()` to 10⁻¹² (tested).
- **Common random numbers:** all scales and carrier values share identical realisations, so curves are
  smooth and differences reflect the parameter, not resampling.
- **Determinism:** identical seeds give identical results (tested at engine and API level).
- **Cost:** each additional scale costs only the coherence-gain evaluation (about 1.5 ms per run for
  4 nodes × 10⁴ samples), not a new simulation.

Node count, observation, sync mode, sync interval and clock correlation change the simulation itself.
Sweeps over them re-simulate with the same master seed.

## 4. Uncertainty treatment

For each quantity, the R Monte Carlo runs give per-run mean gains G_r. We report:
- the mean gain Ḡ and loss L = −10·log₁₀ Ḡ;
- the standard error of the mean, SE_G = std(G_r, ddof = 1)/√R;
- the delta-method loss error, SE_dB = (10/ln 10)·SE_G/Ḡ;
- a band of Ḡ ± 2·SE_G, converted to dB.

This band is an **approximate Monte Carlo band, not a validated confidence interval**. Its coverage has
not been verified, and it says nothing about model or parameter uncertainty. With R = 1, no SE is reported.

## 5. Requirement solver (`clock_requirement`)

Inputs: a base shape, the configuration, a metric (temporal or spatial), the target L*, and a range of
σ_y(1 s) to evaluate.

1. Evaluate the total loss on a log grid of scales (default 13 points).
2. **Non-clock floor:** the non-clock-only loss, which is clock-independent. If it is ≥ L*, return
   `infeasible_non_clock_floor`; no clock improvement can meet the target. If the floor lies within
   2 SE of L*, flag the verdict as marginal.
3. If the target is missed even at the smallest scale, return `not_reached_in_range`. Any requirement
   lies below the evaluated range, so none is fabricated.
4. If the target is met at every scale, return `not_binding_in_range`, reporting only a lower bound
   (the top of the range).
5. **Monotonicity is checked, not assumed.** Any decrease between neighbouring grid points larger than
   2·√(SE²ᵢ + SE²ᵢ₊₁), or more than one crossing of the target, gives `ambiguous_non_monotonic`. In that
   case the conservative value (the last scale before the first failure) is reported as indicative.
6. Otherwise (`determined`), refine by bisection in log s on the same realisations (default 8 steps).
   - The **reported requirement** is the largest evaluated scale meeting the target. It is conservative
     at the bisection resolution.
   - Also reported: the log-interpolated crossing of the mean curve, and an **approximate bracket** from
     where the mean ± 2 SE curves cross the target. A bracket end can be "outside range".
7. The base model as specified (s = 1) is evaluated for context only. It never affects the status.

The ceiling is checked too: a target at or above the random-phase ceiling (10·log₁₀ M temporal,
10·log₁₀ K spatial) is rejected, because every clock would trivially meet it.

## 6. Limits and validation of requests

The API enforces:
- **Sweeps:** at most 12 values, all unique and within each parameter's range. The integer-multiple
  rules for CPI, sync interval and observation are checked by `RadarNetworkConfig`.
- **Requirements:** a 5–25 point grid and at most 12 refinement steps.
- **Memory:** runs × nodes × samples ≤ 4×10⁶ per base clock.
- **Work budget:** a measured cost model (bases or scenarios × evaluations × runs × samples × (nodes + pairs))
  capped at 2×10⁸ units, about 5 s.

Invalid requests return HTTP 422 with a readable message. Unknown scenarios return 404.

## 7. Example results (SIMULATED)

These results use the default configuration. **Every value below is an `ASSUMPTION`, not sourced:**
- 10 GHz carrier, 4 nodes, 10 s observation, 1 ms samples, 100 ms CPI
- time-only sync every 1 s, 1 ps sync error
- non-clock terms: 1 ps calibration, 0.5 ps jitter, 0.1 ps/√s propagation
- 16 Monte Carlo runs, seed 20261110

Reproduce via `POST /api/v1/sensitivity/clock-requirement` with these defaults.

**Spatial loss target 1 dB** (ceiling 6.02 dB):

| Base noise shape | Status | Modelled requirement σ_y(1 s) | Approx. MC bracket | Non-clock floor (± 2 SE) | Base model as specified |
|---|---|---|---|---|---|
| SA65 fit (sourced table, assumed decomposition) | determined | ≤ 1.32×10⁻¹¹ | 1.27–1.38×10⁻¹¹ | 0.0345 ± 0.0073 dB | 5.99 dB |
| OCXO (illustrative) | determined | ≤ 1.00×10⁻¹¹ | 0.75–1.13×10⁻¹¹ | 0.0345 ± 0.0073 dB | 0.0425 dB |
| NextGen, white FM (hypothetical) | determined | ≤ 1.01×10⁻¹¹ | 0.88–1.09×10⁻¹¹ | 0.0345 ± 0.0073 dB | 0.0345 dB |
| NextGen, flicker floor (hypothetical) | determined | ≤ 8.86×10⁻¹² | 0.81–0.98×10⁻¹¹ | 0.0345 ± 0.0073 dB | 0.0345 dB |

**Temporal loss target 1 dB** (ceiling 20 dB): the SA65 shape gives ≤ 4.26×10⁻¹¹, the OCXO shape
≤ 7.99×10⁻¹¹, NextGen white FM ≤ 4.26×10⁻¹¹ and NextGen flicker floor ≤ 5.19×10⁻¹¹ (all `determined`).

**Spatial target 0.01 dB:** `infeasible_non_clock_floor` for every shape. The assumed non-clock errors
alone give 0.0345 dB.

**Sync-interval sweep, spatial total loss [dB], time-only sync:**

| Sync interval | SA65 | OCXO (illustrative) | NextGen white FM | NextGen flicker floor | Non-clock only |
|---|---|---|---|---|---|
| 0.1 s | 5.63 | 0.035 | 0.035 | 0.035 | 0.035 |
| 1 s | 5.99 | 0.043 | 0.035 | 0.035 | 0.035 |
| 5 s | 6.01 | 0.22 | 0.041 | 0.041 | 0.041 |
| 10 s | 6.03 | 0.54 | 0.035 | 0.035 | 0.035 |

### Interpretation (what these simulated numbers do and do not say)

- **Under these assumptions,** 1 dB spatial loss needs σ_y(1 s) of roughly 1×10⁻¹¹. The exact value
  depends on noise shape: 0.89–1.32×10⁻¹¹ across the four shapes. That is about 20–35× more stable
  than the SA65 datasheet value at 1 s, consistent with the simulated SA65 spatial loss of about 6 dB
  (the random-phase ceiling).
- **The hypothetical NextGen target (< 10⁻¹⁵ at 1 s) lies about four decades below this
  requirement.** At 1 s time sync, everything below about 10⁻¹³ sits on the non-clock floor, so the
  model shows **no additional coherence benefit** from the extra stability in this configuration.
  Benefits appear only where clock error, not the floor, dominates. One example is longer holdover:
  the illustrative OCXO's loss grows with the sync interval, while the NextGen variants stay at the
  floor. That comparison depends on the illustrative OCXO coefficients.
- **Shape matters.** The temporal requirement is identical for the SA65 and NextGen white-FM shapes,
  because both are white-FM-dominated within a 100 ms CPI. The spatial requirement differs between
  them, because their drift shares differ. A specification needs the ADEV at the system's averaging
  times, not one number.
- **The non-clock floor decides feasibility.** Tighter targets require a better non-clock budget
  (sync, calibration, distribution, propagation) rather than a better clock.
- Near the random-phase ceiling, Monte Carlo means scatter around it and can exceed it slightly (for
  example 6.03 dB against 6.02 dB).

## 8. Limitations

1. All system parameters and non-clock magnitudes are illustrative assumptions. Requirements scale
   with them, especially with carrier frequency, since phase error ∝ f_c.
2. **Uniform scaling** keeps the noise shape fixed. Real clock improvements may change the shape (for
   example, lowering white FM but not the flicker floor). Those cases need separate base shapes.
3. **SA65:** the ADEV is constrained only for τ = 1–1000 s, so sub-second behaviour (relevant to CPIs)
   is extrapolated and uncertain. The fitted model's implied phase noise differs from the datasheet
   limits by up to 19.7 dB. That mismatch does **not** bound actual coherence loss in either direction.
4. **The OCXO is illustrative,** not a sourced commercial product. **The NextGen CSAC is hypothetical:**
   only ADEV < 10⁻¹⁵ at 1 s is posited, and its behaviour at other τ is assumed.
5. Monte Carlo bands are approximate (Section 4). With few runs, the standard errors are themselves
   uncertain. The requirement bracket reflects Monte Carlo noise only.
6. Grid and bisection resolution limit how precisely a requirement is located. The reported value is
   conservative at that resolution.
7. All Phase 2 limitations still apply: Gaussian independent noise, an idealised sync model, ideal
   synthesis, and no geometry, waveform or processing gains.
