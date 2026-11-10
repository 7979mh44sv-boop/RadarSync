# Clock Noise Model

Code: `backend/radarsync_sim/` · Tests: `backend/tests/sim/` · Status: implemented, validated numerically.

> **Scope.** This model produces stochastic clock time/phase error from stated noise
> parameters. It makes **no claims** about radar performance, and the NextGen CSAC
> scenario is **hypothetical**. Nothing in this document is a measurement.

## 1. Labels

Every input and output carries one of these provenance labels (`radarsync_sim/provenance.py`):

| Label | Meaning |
|---|---|
| `SOURCED` | Transcribed from a cited document (datasheet, challenge brief). |
| `ASSUMPTION` | Illustrative engineering assumption by the team. Not a measurement. |
| `HYPOTHETICAL_TARGET` | Specification posited by the challenge. Not measured. |
| `SIMULATED` | Output of this model. |

## 2. Model

Fractional frequency deviation y(t) = (ν − ν₀)/ν₀ (dimensionless) is modelled as a sum of
independent, zero-mean Gaussian power-law processes plus an optional deterministic drift:

y(t) = y_WFM(t) + y_FFM(t) + y_RWFM(t) + D·t

| Component | One-sided PSD S_y(f) | Allan variance σ_y²(τ) | Parameter | Unit |
|---|---|---|---|---|
| White FM | h₀ | h₀/(2τ) = a²/τ | `a` | s^½ |
| Flicker FM | h₋₁ f⁻¹ | 2 ln2 · h₋₁ = b² | `b` | — |
| Random-walk FM | h₋₂ f⁻² | (2π²/3) h₋₂ τ = c²τ | `c` | s^-½ |
| Linear drift | — | D²τ²/2 | `D` | s⁻¹ |

Model ADEV: σ_y(τ) = √(a²/τ + b² + c²τ + D²τ²/2) (IEEE Std 1139; NIST SP 1065, Riley 2008).

**Time error** x(t) = ∫₀ᵗ y dt′ [s]. **Phase error** φ(t) = 2π·f_carrier·x(t) [rad].
This assumes ideal frequency synthesis from the reference to the carrier (fractional
frequency preserved), so phase error scales linearly with f_carrier.

### Not modelled (yet)
White/flicker phase modulation, spurs, temperature/voltage/magnetic sensitivity, vibration,
retrace, warm-up, distribution and link noise. These belong to later modules.

## 3. Noise generation

Samples y[k] are averages of y(t) over intervals of length τ₀.

| Component | Method | Calibration |
|---|---|---|
| White FM | i.i.d. Gaussian | variance a²/τ₀ (exact) |
| Flicker FM | Kasdin–Walter (1992) filter (1 − z⁻¹)^(−½), h₀ = 1, h_k = h_{k−1}(k − ½)/k, applied via FFT convolution | white-input variance Q = π b²/(2 ln 2), from S_y ≈ Q/(πf) for f ≪ 1/τ₀ |
| Random-walk FM | cumulative sum of Gaussian steps | step variance 3c²τ₀ (diffusion D_w = 3c²) |
| Drift | exact interval average D·t_mid | — |

Known discretisation effects, which the tests check:
- Random-walk FM: Allan variance inflated by (1 + 1/(2m²)), i.e. ×√1.5 in ADEV at m = 1.
- Flicker FM: ADEV exceeds b by about 20% at m = 1, 3% at m = 4, and <1% for m ≥ 8.

**Determinism:** `SeedSequence(seed).spawn(3)` gives each stochastic component its own stream.
Equal seeds give bitwise-identical output, and disabling one component does not change the others.

## 4. Allan deviation estimator

Overlapping ADEV from phase data (NIST SP 1065 eq. 11):

σ_y²(mτ₀) = Σᵢ (x[i+2m] − 2x[i+m] + x[i])² / (2(N − 2m)(mτ₀)²), i = 0 … N−2m−1.

Default averaging factors are octave-spaced, m = 1, 2, 4, … ≤ (N−1)/4.
Confidence intervals are not implemented yet.

## 5. Scenarios (`radarsync_sim/scenarios.py`)

| Scenario | Category | Coefficients | ADEV constrained for |
|---|---|---|---|
| Existing CSAC: Microchip SA65 (industrial; commercial optional) | SOURCED data, ASSUMED decomposition | Non-negative least-squares fit of a, b, c to the datasheet ADEV table | τ = 1 … 1000 s (commercial: 1 … 100 s) |
| OCXO | ASSUMPTION | a = 3×10⁻¹³ s^½, b = 1×10⁻¹², c = 1×10⁻¹⁴ s^-½, D = 0; configurable, not from any product | — |
| NextGen CSAC, `white_fm` | HYPOTHETICAL_TARGET | a = 9.5×10⁻¹⁶ s^½ (assumed) | τ = 1 s only |
| NextGen CSAC, `flicker_floor` | HYPOTHETICAL_TARGET | a = 7.0×10⁻¹⁶ s^½, b = 6.5×10⁻¹⁶ (assumed) | τ = 1 s only |

**Sourced SA65 data** (Microchip DS00003478F, 09/2025):
- Industrial ADEV: 3×10⁻¹⁰, 1×10⁻¹⁰, 3×10⁻¹¹, 1×10⁻¹¹ at τ = 1, 10, 100, 1000 s.
- Commercial ADEV limits: ≤ 4×10⁻¹⁰, 1.5×10⁻¹⁰, 4×10⁻¹¹ at 1, 10, 100 s.
- Aging: < 9×10⁻¹⁰/month (typical, after 30 days).
- SSB phase noise at 10 MHz is stored for later use; it is **not** used to derive any spectrum.

**Fitted SA65 coefficients** (`ASSUMPTION`: derived from the sourced table above, not published by Microchip):

| Grade | a [s^½] | b [–] | c [s^-½] | D [s⁻¹] (from aging, assumption) |
|---|---|---|---|---|
| Industrial | 3.047×10⁻¹⁰ | 0 | 8.424×10⁻¹⁴ | 3.472×10⁻¹⁶ |
| Commercial | 4.161×10⁻¹⁰ | 0 | 0 | 3.472×10⁻¹⁶ |

The fit puts no flicker floor (b = 0) in the tabulated range. That does **not** mean the device
has none: it only means the datasheet table, which follows τ^-½ closely, gives no evidence of one.

**SA65 fit quality:** these are datasheet *limits*, so the fit represents spec-limit performance.
The largest deviations are −3.6% (industrial) and −12.3% (commercial), both at τ = 10 s.
The commercial table has a bump that a power-law sum cannot follow.

**NextGen rules:**
1. ADEV < 1×10⁻¹⁵ at 1 s is a hypothetical *upper bound* from the challenge, not a measured value.
2. A single ADEV point does not determine the noise-type mix or the behaviour at other τ.
   The two variants are explicit assumptions, and the code rejects any variant whose model ADEV(1 s) exceeds the target.
3. The challenge says to keep all other SA65 specifications. Aging is therefore applied by default
   as a constant linear drift D = 9×10⁻¹⁰ / 30 d ≈ 3.5×10⁻¹⁶ s⁻¹ (`include_sa65_aging=False` disables it).
   Treating a monthly aging figure as a constant short-term drift is an assumption.

**Consequence of these assumptions** (an analytic property of the model, not a simulation result):
with SA65-level aging, the drift term D·τ/√2 equals the white-FM term a/√τ of the `white_fm`
variant at τ = (2a²/D²)^(1/3) ≈ 2.5 s. Beyond a few seconds, the NextGen ADEV is therefore set by
the assumed drift and not by the 1 s stability, unless drift is estimated and removed. Whether
this matters depends on the coherence and synchronisation intervals of the target system,
which later modules will analyse.

## 6. Validation tests (`backend/tests/sim/`)

| Test | Checks |
|---|---|
| Estimator vs. naive loop | Vectorised OADEV equals the textbook sum (rtol 1e-12). |
| Constant frequency offset | ADEV = 0. |
| Linear drift | ADEV = Dτ/√2 exactly (rtol 1e-9). |
| Kasdin–Walter coefficients | Known values for β = 0, 1, 2. |
| Power-law slopes | Log-log slope −½ / 0 / +½ (±0.03) over m = 8…512. |
| Power-law levels | Within 5% of theory for m = 8…128 (8-seed ensemble). The tolerance was set from the measured 99th-percentile error (≤ 3.3%) over 30 independent seed sets. |
| τ₀ scaling | White FM correct for τ₀ = 1 ms, 1 s, 10 s. |
| RWFM discretisation | Matches the predicted (1 + 1/(2m²)) bias at m = 1, 2. |
| Time-error growth | White FM: ensemble ⟨x²(t)⟩ = a²t (500 realisations). |
| Phase error | Constant 1×10⁻⁹ offset at 10 GHz for 1 s gives exactly 10 cycles. φ = 2πf·x in general. |
| Drift integration | x = D t²/2 exactly. |
| Determinism | Bitwise-reproducible seeds; independent component streams. |
| Composite model | Independent components add in Allan variance. |
| SA65 fit | Reproduces the datasheet table within the documented fit error. |
| NextGen target | ADEV(1 s) ≤ 1×10⁻¹⁵ analytically and in simulation, for all variants, with and without aging. |
| Provenance | Every coefficient is labelled and sourced/justified; sourced items cite DS00003478F. |
| Layer independence | Importing `radarsync_sim` loads no FastAPI, Starlette, Pydantic or `app` modules. |

## 7. Limitations

- The power-law model is a parametric assumption. It is constrained by data only over each scenario's `valid_tau_range`.
- The OCXO numbers are placeholders until replaced by a sourced part.
- No confidence intervals on ADEV estimates yet.
- No environmental, distribution or link noise yet.
- Gaussian statistics are assumed. No frequency jumps or outliers.
