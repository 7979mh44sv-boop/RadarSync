# Radar Synchronization and Timing-Error Model (Phase 2)

Code: `backend/radarsync_sim/{network,timing_errors,coherence,radar,consistency}.py` ·
Tests: `backend/tests/sim/test_{network,coherence,radar}.py` ·
Report: `backend/scripts/phase2_report.py` · Builds on [clock_noise_model.md](clock_noise_model.md).

> **Scope.** This model turns clock and non-clock timing errors into relative time error,
> relative carrier phase error and coherent integration loss between radar nodes. It makes
> **no claims** about detection range, radar cross-section or operational performance.
> All system parameters are **assumptions**. All results are **simulated outputs** of those assumptions.
> The NextGen CSAC is **hypothetical**.

## 1. Provenance in this phase

| Item | Label |
|---|---|
| SA65 ADEV table, aging, temperature sensitivity, phase-noise limits | `SOURCED` (DS00003478F) |
| SA65 noise-type fit, OCXO coefficients, NextGen noise mix, aging-as-drift | `ASSUMPTION` (Phase 1) |
| NextGen ADEV < 1×10⁻¹⁵ at 1 s | `HYPOTHETICAL_TARGET` |
| Carrier, node count, durations, sync interval/error, correlation, every non-clock term | `ASSUMPTION` (`RadarNetworkConfig.parameter_table()`) |
| Every metric returned by `evaluate()` / `compare_scenarios()` | `SIMULATED` |

## 2. Mathematical model

Nodes i = 1…K, sample times t_n = n·τ₀ (n = 0…N−1). All time errors are in seconds.

**Clock error per node**

x_i(t) = √(1−ρ)·x_i^ind(t) + √ρ·x^com(t) + ½·D·u_i·t²

- x^ind and x^com are independent realisations of the Phase 1 stochastic clock model (white/flicker/random-walk FM, drift removed).
- ρ ∈ [0, 1] is the assumed common-mode correlation, for example a shared environment. Each node keeps its marginal statistics, and Var[x_i − x_j] = 2(1−ρ)·Var[x].
- Aging drift is assigned per node as D·u_i with u_i ~ U(−1, 1). The datasheet gives a magnitude bound, not a sign or spread, so this is an assumption.

**Non-clock terms** (independent across nodes; `timing_errors.py`)

| Category | Kind | Model | Parameter unit | In sync loop |
|---|---|---|---|---|
| Calibration | static | constant N(0, σ²) per node | s | no |
| Distribution | white | i.i.d. N(0, σ²) per sample | s | no |
| Propagation | random walk | Var[x(t)] = σ²·t | s/√s | no |
| Environmental | frequency ramp | x = ½·d_i·t², d_i ~ N(0, σ²) | s⁻¹ | yes |
| Synchronization | measurement error | e_ik ~ N(0, σ²) per node and epoch | s | — |

"In sync loop" means the term perturbs the node's timing *before* the sync correction (for example
temperature acting on the oscillator) and is therefore removed like clock error. Out-of-loop errors,
such as uncalibrated hardware delay, distribution jitter and propagation, are not seen by the sync
measurement and stay in the result.

**Synchronization / calibration strategy.** Epochs fall at t_k = k·T_s. The in-loop timing
s_i = x_i + (in-loop terms) is measured as s_i(t_k) + e_ik, and a correction C_i(t) is applied:

| Mode | Correction for t ∈ [t_k, t_k+1) |
|---|---|
| `none` | single epoch at t = 0 (initial alignment, then free-running holdover) |
| `time` | C_i = s_i(t_k) + e_ik |
| `time_frequency` | C_i = s_i(t_k) + e_ik + ŷ_ik·(t − t_k), with ŷ_ik = (meas_k − meas_k−1)/T_s (0 for k = 0) |

The residual time error is r_i(t) = s_i(t) − C_i(t) + (out-of-loop terms). C is linear in (s, e), so
r_i splits **exactly** into per-source contributions: clock, synchronization, calibration,
distribution, propagation and environmental. The tests check this to rounding precision.
CPIs are aligned to epochs, so no CPI straddles a correction step.

**Relative errors**

Δ_ij(t) = r_i(t) − r_j(t) [s],  φ_ij(t) = 2π·f_c·Δ_ij(t) [rad]

This assumes ideal frequency synthesis, so phase error scales linearly with the carrier frequency.

**Coherent integration** (`coherence.py`)

G = |(1/M)·Σ_m e^{jφ_m}|², loss = −10·log₁₀ E[G] dB

- **Temporal loss:** M samples of φ_ij inside one CPI, averaged over all CPIs, node pairs (bistatic links) and Monte Carlo runs. A constant phase offset cancels, so only phase *variation* within the CPI matters.
- **Spatial loss:** the K node phases φ_i = 2π·f_c·r_i at one instant, averaged over time and runs. Absolute node-to-node offsets matter, so sync and calibration errors enter here. A common-mode phase cancels.
- **Saturation:** fully random phases give E[G] = 1/M, so losses saturate at 10·log₁₀ M dB (temporal) and 10·log₁₀ K dB (spatial).

## 3. Phase-error assumptions and analytical results

These results assume jointly Gaussian, zero-mean phase errors. That holds for every stochastic term
here, because all are Gaussian and linear operations preserve Gaussianity.

| Case | Expected gain |
|---|---|
| i.i.d. phases, variance σ² (white jitter, static calibration across nodes) | E[G] = e^{−σ²} + (1 − e^{−σ²})/M |
| Stationary increments, structure function D_φ(τ) | E[G] = (1/M²)·Σ_{m,n} exp(−D_φ(\|t_m − t_n\|)/2) (exact) |
| White FM between two nodes (D_φ = (2π·f_c)²·2(1−ρ)·a²·τ), continuous window T | E[G] = 2(x − 1 + e^{−x})/x², x = D_φ(T)/2 |
| Linear phase ramp, frequency offset Δf | G = [sin(Mθ/2)/(M·sin(θ/2))]², θ = 2π·Δf·τ₀ (exact) |
| Small angles | loss ≈ (10/ln 10)·σ² ≈ 4.343·σ² dB |

## 4. Validation (deterministic tests)

| Test | Type | Result checked |
|---|---|---|
| Gain identities, common-offset invariance | exact | G(0) = 1, G(0, π) = 0 |
| Linear ramp vs. Dirichlet kernel | exact | rel. 1e-12 for four Δf; full cycle gives 0 |
| i.i.d. Gaussian | Monte Carlo (40 000 trials) | within 1% of formula |
| Discrete structure-function vs. continuous Brownian formula | numerical | rel. 1e-3 |
| Temporal loss, white FM, 2 nodes, no sync | network Monte Carlo vs. exact structure-function formula | ±0.1 dB, in a 1–4 dB regime |
| White jitter, temporal and spatial | network Monte Carlo vs. i.i.d. formula | ±0.03 dB |
| Static calibration: spatial loss only, no temporal loss | network Monte Carlo (3000 runs) | ±0.05 dB; temporal = 0 |
| ρ = 1 cancels relative clock error; ρ = 0.75 halves it | exact (common random numbers) | rel. 1e-9 |
| `time` sync resets the clock error to 0 at every epoch; sync error constant per interval with correct rms | exact / statistical | — |
| White FM residual variance grows as a²·u after reset | Monte Carlo (400 nodes) | ±15% |
| `time_frequency` residual for pure drift = ½·D·u_i·τ(τ + T_s) | exact | rel. 1e-6 |
| In-loop terms removed by sync, out-of-loop terms kept | exact | — |
| Term generators (static, white, random walk, ramp) | statistical / exact | — |
| Contributions sum to the total; determinism | exact | — |
| Clock-quality sweep reaches the non-clock floor | Monte Carlo | within 1% of floor; floor identical across sweep |
| Scenarios share config and random numbers; all metrics `SIMULATED` | exact | — |
| Model-implied phase noise formula; SA65 consistency signs | exact | — |
| No FastAPI, Starlette, Pydantic or `app` imports | subprocess | — |

**Tolerance setting:** each Monte Carlo tolerance was checked against 20 independent seed sets.
The worst observed errors were 0.032, 0.011, 0.005 and 0.024 dB, against tolerances of 0.1, 0.03, 0.03 and 0.05 dB.

## 5. Results at the default configuration (SIMULATED)

These results are reproducible with `cd backend && .venv/bin/python scripts/phase2_report.py`.
Every value is a simulated consequence of the assumed configuration below.

## Configuration (all ASSUMPTIONS)

| Parameter | Value | Unit |
|---|---|---|
| carrier_frequency_hz | 1e+10 | Hz |
| n_nodes | 4 | - |
| observation_s | 10 | s |
| sample_interval_s | 0.001 | s |
| cpi_s | 0.1 | s |
| sync_interval_s | 1 | s |
| sync_error_rms_s | 1e-12 | s |
| clock_correlation | 0 | - |
| term: residual hardware-delay calibration | 1e-12 | s |
| term: LO / clock distribution jitter | 5e-13 | s |
| term: propagation path wander | 1e-13 | s/s^0.5 |
| term: temperature-induced frequency ramp | 0 | 1/s |
| sync mode | time | - |
| Monte Carlo runs / seed | 16 / 20261110 | - |

## A. Scenario comparison (SIMULATED)

| Scenario | rms rel. time error: total / clock / non-clock | rms rel. phase (total) | temporal loss total / clock-only [dB] | spatial loss total / clock-only [dB] | clock share of variance |
|---|---|---|---|---|---|
| OCXO (illustrative) | 2.57 ps / 1.43 ps / 2.32 ps | 0.162 rad | 0.00868 / 0.000192 | 0.0425 / 0.0131 | 0.276 |
| Existing CSAC (Microchip SA65, industrial) | 297 ps / 297 ps / 2.32 ps | 18.7 rad | 12.7 / 12.7 | 5.99 / 5.99 | 1.000 |
| NextGen CSAC (hypothetical, white fm) | 2.32 ps / 0.00129 ps / 2.32 ps | 0.146 rad | 0.0085 / 5.55e-10 | 0.0345 / 1.08e-08 | 0.000 |
| NextGen CSAC (hypothetical, flicker floor) | 2.32 ps / 0.00152 ps / 2.32 ps | 0.146 rad | 0.0085 / 3.87e-10 | 0.0345 / 1.49e-08 | 0.000 |

## B. Clock-quality sweep at fixed non-clock floor (SIMULATED)

SA65 model with every ADEV term scaled by s.

| s | ADEV(1 s) | spatial loss total [dB] | non-clock floor [dB] | clock share |
|---|---|---|---|---|
| 1 | 3.05e-10 | 5.9888 | 0.0345 | 1.000 |
| 0.316 | 9.64e-11 | 5.7814 | 0.0345 | 0.999 |
| 0.1 | 3.05e-11 | 3.5024 | 0.0345 | 0.994 |
| 0.0316 | 9.64e-12 | 0.5635 | 0.0345 | 0.943 |
| 0.01 | 3.05e-12 | 0.0864 | 0.0345 | 0.622 |
| 0.00316 | 9.64e-13 | 0.0387 | 0.0345 | 0.141 |
| 0.001 | 3.05e-13 | 0.0346 | 0.0345 | 0.016 |
| 0.000316 | 9.64e-14 | 0.0344 | 0.0345 | 0.002 |
| 0.0001 | 3.05e-14 | 0.0345 | 0.0345 | 0.000 |
| 3.16e-05 | 9.64e-15 | 0.0345 | 0.0345 | 0.000 |
| 1e-05 | 3.05e-15 | 0.0345 | 0.0345 | 0.000 |

## C. Sync-interval sweep, time-only sync (SIMULATED)

| Sync interval | Scenario | clock rms rel. time error | spatial loss total [dB] | clock share |
|---|---|---|---|---|
| 1 s | OCXO (illustrative) | 0.946 ps | 0.0419 | 0.143 |
| 1 s | Existing CSAC (Microchip SA65, industrial) | 275 ps | 5.88 | 1.000 |
| 1 s | NextGen CSAC (hypothetical, white fm) | 0.862 fs | 0.0343 | 0.000 |
| 1 s | NextGen CSAC (hypothetical, flicker floor) | 0.844 fs | 0.0343 | 0.000 |
| 10 s | OCXO (illustrative) | 9.53 ps | 0.536 | 0.943 |
| 10 s | Existing CSAC (Microchip SA65, industrial) | 1.01e+03 ps | 6.03 | 1.000 |
| 10 s | NextGen CSAC (hypothetical, white fm) | 0.0071 ps | 0.0351 | 0.000 |
| 10 s | NextGen CSAC (hypothetical, flicker floor) | 0.00976 ps | 0.0351 | 0.000 |
| 100 s | OCXO (illustrative) | 96.2 ps | 4.85 | 0.999 |
| 100 s | Existing CSAC (Microchip SA65, industrial) | 3.06e+03 ps | 6.01 | 1.000 |
| 100 s | NextGen CSAC (hypothetical, white fm) | 0.663 ps | 0.0395 | 0.066 |
| 100 s | NextGen CSAC (hypothetical, flicker floor) | 0.674 ps | 0.0396 | 0.069 |

## D. SA65 model vs. sourced phase-noise limits (10 MHz output)

| Offset | Model-implied L(f) | Datasheet limit | Margin |
|---|---|---|---|
| 1 Hz | -50.3 dBc/Hz | -44 dBc/Hz | +6.3 dB |
| 10 Hz | -70.3 dBc/Hz | -64 dBc/Hz | +6.3 dB |
| 100 Hz | -90.3 dBc/Hz | -110 dBc/Hz | -19.7 dB |
| 1000 Hz | -110.3 dBc/Hz | -128 dBc/Hz | -17.7 dB |
| 10000 Hz | -130.3 dBc/Hz | -135 dBc/Hz | -4.7 dB |
| 100000 Hz | -150.3 dBc/Hz | -140 dBc/Hz | +10.3 dB |

### Reading these results (what they do and do not show)

1. **SA65 at a 10 GHz carrier.** The simulated relative time error is about 300 ps between 1 s
   syncs. That is about 19 rad of carrier phase, so node-to-node coherence is lost entirely: the
   spatial loss reaches its 6.0 dB ceiling (10·log₁₀ K, K = 4). The temporal loss within a 100 ms
   CPI is 12.7 dB, against a ceiling of 20 dB (M = 100). τ = 1 s is inside the datasheet ADEV range,
   but the 100 ms temporal loss relies on sub-second extrapolation of the fitted model. Its accuracy
   for a real SA65 is not established, in either direction (limitation 1).
2. **Non-clock floor.** With the assumed ≈ 2.3 ps rms relative non-clock error, both NextGen
   variants and the illustrative OCXO sit close to the floor at 1 s sync. In Table B, once
   ADEV(1 s) falls below about 1×10⁻¹² (white-FM-shaped noise, this configuration), the clock's
   share of the phase variance drops below about 15%. Below about 3×10⁻¹³, further clock
   improvement does not change the loss. **Under these assumptions, ADEV = 1×10⁻¹⁵ gives no
   benefit over about 10⁻¹³ when syncing every second.**
3. **Holdover.** In Table C, the differences appear only when the sync interval grows. At 100 s,
   the illustrative OCXO's clock error dominates (4.9 dB spatial loss), while both NextGen variants
   stay near the floor. This comparison is only as good as the *illustrative* OCXO coefficients,
   and the NextGen clock term at 100 s is dominated by the *assumed* SA65-level aging drift
   (see clock_noise_model.md §5).
4. None of these numbers implies any detection range, RCS or mission outcome.

## 6. Limitations

1. **Sub-second extrapolation of SA65 (important).** The fitted SA65 model is constrained only for
   τ = 1–1000 s. Its implied phase noise (Table D) is consistent with the datasheet limits at
   1–10 Hz offsets but **exceeds them by up to 19.7 dB from 100 Hz to 10 kHz**. This mismatch
   suggests the model probably overstates the SA65's high-offset phase noise. It does **not**
   establish that the simulated SA65 temporal losses are an upper bound on real radar coherence
   loss, for these reasons:
   - The comparison is a spectral-density difference at six discrete offsets, against datasheet
     *limits* for a 10 MHz output, not a measured spectrum of any unit.
   - At 1 and 10 Hz the model lies 6.3 dB *below* the limits, so a real device may be noisier than
     the model there. For a 100 ms CPI, those offsets matter.
   - Coherence loss depends on phase noise integrated over the CPI's whole band, so a 19.7 dB gap
     at one offset does not map to a loss difference.
   - Noise added by synthesis to the carrier, white phase modulation, vibration and environment are
     not modelled. They could add loss beyond this model.

   Treat the SA65 sub-second temporal losses as indicative of the model's assumptions, not as a
   bound in either direction. A bound would need phase noise integrated from a measured or
   specified spectrum, which is not implemented. Spatial losses over 1 s sync intervals depend
   mainly on the constrained τ ≈ 1 s regime. For NextGen, behaviour at τ ≠ 1 s is unconstrained by
   the challenge.
2. Each noise term is assumed independent and Gaussian. There are no outliers, phase jumps or cycle slips.
3. Sync is modelled as an ideal, instantaneous correction with Gaussian measurement error. There is
   no sync-link protocol, latency, asymmetry or loop dynamics yet, and no Kalman/holdover filtering
   beyond the `time_frequency` predictor.
4. Non-clock magnitudes are illustrative placeholders. The environmental ramp is disabled by default.
   `sa65_temperature_ramp_rms()` derives one from the sourced SA65 sensitivity, assuming a linear
   temperature dependence and an assumed temperature rate. Environmental effects are applied
   identically for all clock scenarios.
5. Ideal frequency synthesis to the carrier is assumed. No synthesizer or PLL noise.
6. Geometry, target motion, waveform and processing gains are not modelled. Coherent loss is a
   timing-only metric.
7. The clock correlation ρ is applied to all stochastic clock terms equally.
8. **The OCXO is not a real product.** Its coefficients are illustrative assumptions:
   a = 3×10⁻¹³ s^½, b = 1×10⁻¹², c = 1×10⁻¹⁴ s^-½ and D = 0 (see clock_noise_model.md §5).
   Every OCXO comparison, including the 100 s holdover result, depends on these values and should
   be repeated with a sourced datasheet before any conclusion about OCXOs is drawn.
9. Monte Carlo results carry statistical error. The tolerance study in §4 quantifies it only for the
   test configurations. Confidence intervals for the default-configuration tables in §5 have not
   been computed yet.
