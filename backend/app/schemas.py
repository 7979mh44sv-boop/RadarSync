"""Pydantic request/response models for the simulation API.

All physical quantities use SI units (s, Hz, rad, dimensionless fractional frequency)
except where a field name says otherwise (e.g. *_db). Every numeric value that
originates in the simulation package carries a provenance label.
"""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

ProvenanceLabel = Literal["sourced", "assumption", "hypothetical_target", "simulated"]

# ---------------------------------------------------------------------------
# Computation limits (protect the server from expensive requests)
# ---------------------------------------------------------------------------
MAX_NODES = 16
MAX_SAMPLES_PER_NODE = 100_000
MAX_MONTE_CARLO = 32
MAX_WORK_UNITS = 30_000_000
"""Upper bound on scenarios x runs x samples x (nodes + node pairs); about 2 s of compute."""
MAX_PLOT_POINTS = 2_000
MAX_ADEV_SIM_SAMPLES = 2**17


class QuantityOut(BaseModel):
    value: float
    unit: str
    provenance: ProvenanceLabel
    source: str


class ApiModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


# ---------------------------------------------------------------------------
# Scenarios
# ---------------------------------------------------------------------------
class ScenarioOut(BaseModel):
    key: str
    label: str
    category: ProvenanceLabel
    parameters: dict[str, QuantityOut]
    valid_tau_range_s: tuple[float, float] | None = Field(
        description="Averaging-time range [s] over which the ADEV is constrained by sourced data or the target; "
        "null if fully assumed."
    )
    adev_at_1s: QuantityOut
    notes: str


class SourcedPointOut(BaseModel):
    tau_s: float
    adev: float
    provenance: ProvenanceLabel
    source: str


class ScenarioListOut(BaseModel):
    scenarios: list[ScenarioOut]
    sa65_datasheet_adev: list[SourcedPointOut]
    nextgen_target: SourcedPointOut


# ---------------------------------------------------------------------------
# Allan deviation
# ---------------------------------------------------------------------------
class AdevRequest(ApiModel):
    scenario_keys: list[str] = Field(min_length=1, max_length=8)
    tau_min_s: float = Field(1e-3, ge=1e-4, le=1e3)
    tau_max_s: float = Field(1e4, ge=1e-3, le=1e5)
    points_per_decade: int = Field(10, ge=2, le=50)
    include_simulated: bool = True
    simulated_sample_interval_s: float = Field(0.1, ge=1e-3, le=10.0)
    simulated_samples: int = Field(2**15, ge=256, le=MAX_ADEV_SIM_SAMPLES)
    seed: int = Field(20261110, ge=0, le=2**32 - 1)

    @model_validator(mode="after")
    def _check(self) -> "AdevRequest":
        if self.tau_max_s <= self.tau_min_s:
            raise ValueError("tau_max_s must be greater than tau_min_s")
        if len(set(self.scenario_keys)) != len(self.scenario_keys):
            raise ValueError("scenario_keys must be unique")
        return self


class AdevCurveOut(BaseModel):
    scenario_key: str
    label: str
    tau_s: list[float]
    model_adev: list[float]
    constrained: list[bool] = Field(description="True where tau lies inside the scenario's constrained range.")
    model_provenance: ProvenanceLabel = Field(
        description="Provenance of the model curve itself: the analytic ADEV of the assumed power-law model."
    )
    simulated_tau_s: list[float] | None = None
    simulated_adev: list[float] | None = None
    simulated_provenance: ProvenanceLabel | None = None


class AdevOut(BaseModel):
    curves: list[AdevCurveOut]
    seed: int
    notes: list[str]


# ---------------------------------------------------------------------------
# Network / radar configuration
# ---------------------------------------------------------------------------
class NonClockTermsIn(ApiModel):
    calibration_rms_s: float = Field(1e-12, ge=0, le=1e-9, description="Static per-node residual delay calibration error [s].")
    distribution_jitter_rms_s: float = Field(0.5e-12, ge=0, le=1e-9, description="White LO/clock distribution jitter per sample [s].")
    propagation_random_walk_s_per_sqrt_s: float = Field(0.1e-12, ge=0, le=1e-9, description="Propagation path random walk [s/sqrt(s)].")
    environmental_ramp_rms_per_s: float = Field(0.0, ge=0, le=1e-12, description="Temperature-induced fractional-frequency ramp rms [1/s] (in sync loop).")


class NetworkConfigIn(ApiModel):
    carrier_frequency_hz: float = Field(10e9, ge=1e8, le=1e11)
    n_nodes: int = Field(4, ge=2, le=MAX_NODES)
    observation_s: float = Field(10.0, gt=0, le=100.0)
    sample_interval_s: float = Field(1e-3, ge=1e-4, le=1.0)
    cpi_s: float = Field(0.1, gt=0, le=10.0)
    sync_mode: Literal["none", "time", "time_frequency"] = "time"
    sync_interval_s: float = Field(1.0, gt=0, le=100.0)
    sync_error_rms_s: float = Field(1e-12, ge=0, le=1e-9)
    clock_correlation: float = Field(0.0, ge=0.0, le=1.0)
    non_clock: NonClockTermsIn = Field(default_factory=NonClockTermsIn)
    n_monte_carlo: int = Field(16, ge=1, le=MAX_MONTE_CARLO)
    seed: int = Field(20261110, ge=0, le=2**32 - 1)

    @property
    def n_samples(self) -> int:
        return int(round(self.observation_s / self.sample_interval_s))

    def work_units(self, n_scenarios: int, n_runs: int | None = None) -> int:
        pairs = self.n_nodes * (self.n_nodes - 1) // 2
        runs = self.n_monte_carlo if n_runs is None else n_runs
        return n_scenarios * runs * self.n_samples * (self.n_nodes + pairs)

    @model_validator(mode="after")
    def _check(self) -> "NetworkConfigIn":
        if self.n_samples > MAX_SAMPLES_PER_NODE:
            raise ValueError(
                f"observation_s / sample_interval_s = {self.n_samples} samples exceeds the limit of "
                f"{MAX_SAMPLES_PER_NODE}; increase the sample interval or shorten the observation"
            )
        # Delegate integer-multiple rules to the simulation package (single source of truth).
        from app.services.simulation import build_config

        build_config(self)
        return self


class ScenarioSelection(ApiModel):
    scenario_keys: list[str] = Field(min_length=1, max_length=8)

    @model_validator(mode="after")
    def _unique(self) -> "ScenarioSelection":
        if len(set(self.scenario_keys)) != len(self.scenario_keys):
            raise ValueError("scenario_keys must be unique")
        return self


class TimingRequest(ApiModel):
    scenario_key: str
    config: NetworkConfigIn = Field(default_factory=NetworkConfigIn)
    node_pair: tuple[int, int] = (0, 1)
    max_points: int = Field(1000, ge=50, le=MAX_PLOT_POINTS)

    @model_validator(mode="after")
    def _check(self) -> "TimingRequest":
        i, j = self.node_pair
        if i == j or not (0 <= i < self.config.n_nodes and 0 <= j < self.config.n_nodes):
            raise ValueError(f"node_pair must be two distinct node indices in [0, {self.config.n_nodes - 1}]")
        if self.config.work_units(1, n_runs=1) > MAX_WORK_UNITS:
            raise ValueError("requested simulation exceeds the computation limit")
        return self


class TimingSeriesOut(BaseModel):
    scenario_key: str
    label: str
    node_pair: tuple[int, int]
    t_s: list[float]
    clock_s: list[float]
    non_clock_s: list[float]
    total_s: list[float]
    decimation: int = Field(description="Every k-th simulated sample is returned; intermediate samples are omitted.")
    sync_epochs_s: list[float]
    rms_s: dict[str, QuantityOut] = Field(description="rms over all samples (not only returned points) of this pair.")
    contribution_rms_s: dict[str, QuantityOut] = Field(description="rms relative time error per source category, this pair.")
    run_seed: int
    provenance: ProvenanceLabel = "simulated"


class CoherenceRequest(ApiModel):
    scenario_keys: list[str] = Field(min_length=1, max_length=8)
    config: NetworkConfigIn = Field(default_factory=NetworkConfigIn)

    @model_validator(mode="after")
    def _check(self) -> "CoherenceRequest":
        ScenarioSelection(scenario_keys=self.scenario_keys)
        work = self.config.work_units(len(self.scenario_keys))
        if work > MAX_WORK_UNITS:
            raise ValueError(
                f"requested simulation ({work:.3g} work units) exceeds the limit of {MAX_WORK_UNITS:.3g}; "
                "reduce nodes, Monte Carlo runs, scenarios or samples"
            )
        return self


class CoherenceResultOut(BaseModel):
    scenario_key: str
    label: str
    metrics: dict[str, QuantityOut]
    contribution_rms_s: dict[str, QuantityOut]


class CoherenceOut(BaseModel):
    results: list[CoherenceResultOut]
    config_parameters: dict[str, QuantityOut]
    n_monte_carlo: int
    seed: int
    confidence_intervals: Literal["not computed"] = "not computed"
    loss_ceiling_temporal_db: float = Field(description="10 log10(M): loss for fully random phases within a CPI.")
    loss_ceiling_spatial_db: float = Field(description="10 log10(K): loss for fully random phases across nodes.")
    notes: list[str]


# ---------------------------------------------------------------------------
# Parameters, limits and model limitations
# ---------------------------------------------------------------------------
class ParameterSpecOut(BaseModel):
    name: str
    label: str
    unit: str
    default: float | int | str
    minimum: float | None = None
    maximum: float | None = None
    options: list[str] | None = None
    provenance: ProvenanceLabel = "assumption"
    description: str


class ParametersOut(BaseModel):
    parameters: list[ParameterSpecOut]
    limits: dict[str, float]
    rules: list[str]


class PhaseNoiseCheckOut(BaseModel):
    offset_hz: float
    model_dbc_hz: float
    datasheet_limit_dbc_hz: float
    margin_db: float
    datasheet_provenance: ProvenanceLabel = "sourced"
    model_provenance: ProvenanceLabel = "assumption"


class LimitationsOut(BaseModel):
    sa65_phase_noise_check: list[PhaseNoiseCheckOut]
    max_model_excess_db: float
    statements: list[str]


# ---------------------------------------------------------------------------
# Phase 3: sensitivity analysis and clock-stability requirements
# ---------------------------------------------------------------------------
SWEEP_MAX_VALUES = 12
SENSITIVITY_MAX_WORK_UNITS = 200_000_000
"""Budget for sensitivity requests (about 5 s): see app.services.sensitivity for the cost model."""
REALIZATION_MAX_VALUES = 4_000_000
"""Monte Carlo runs x nodes x samples held in memory per base clock (about 64 MB)."""

SweepParameter = Literal["clock_scale", "carrier_frequency_hz", "n_nodes", "observation_s",
                         "sync_interval_s", "sync_mode", "clock_correlation"]
CoherenceMetric = Literal["temporal", "spatial"]


class LossEstimateOut(BaseModel):
    loss_db: float
    se_db: float | None = Field(description="Delta-method standard error of the Monte Carlo mean; null for one run.")
    band_db: tuple[float, float] = Field(description="Approximate mean +/- 2 SE band [dB]; not a validated confidence interval.")
    provenance: ProvenanceLabel = "simulated"


class LossBreakdownOut(BaseModel):
    temporal: dict[str, LossEstimateOut]
    spatial: dict[str, LossEstimateOut]
    clock_variance_fraction: float
    rms_relative_time_error_s: dict[str, float]


class SweepOptionOut(BaseModel):
    name: str
    label: str
    unit: str
    kind: Literal["numeric", "categorical"]
    minimum: float | None = None
    maximum: float | None = None
    default_values: list[float | str]
    note: str


class SensitivityOptionsOut(BaseModel):
    parameters: list[SweepOptionOut]
    limits: dict[str, float]
    requirement_defaults: dict[str, float | int | str]
    uncertainty_note: str


class SweepRequest(ApiModel):
    scenario_keys: list[str] = Field(min_length=1, max_length=4)
    config: NetworkConfigIn = Field(default_factory=NetworkConfigIn)
    parameter: SweepParameter
    values: list[float | str] = Field(min_length=2, max_length=SWEEP_MAX_VALUES)

    @model_validator(mode="after")
    def _check(self) -> "SweepRequest":
        ScenarioSelection(scenario_keys=self.scenario_keys)
        from app.services.sensitivity import validate_sweep

        validate_sweep(self)
        return self


class SweepSeriesOut(BaseModel):
    scenario_key: str
    label: str
    values: list[float | str]
    points: list[LossBreakdownOut]
    monotonic_check: str | None = Field(description="Result of the monotonicity check where a direction is expected.")


class SweepOut(BaseModel):
    parameter: SweepParameter
    unit: str
    series: list[SweepSeriesOut]
    config_parameters: dict[str, QuantityOut]
    n_monte_carlo: int
    seed: int
    loss_ceiling_temporal_db: list[float]
    loss_ceiling_spatial_db: list[float]
    notes: list[str]


class RequirementRequest(ApiModel):
    base_scenario_keys: list[str] = Field(min_length=1, max_length=4)
    config: NetworkConfigIn = Field(default_factory=NetworkConfigIn)
    metric: CoherenceMetric = "spatial"
    target_loss_db: float = Field(1.0, gt=0, le=30)
    adev_1s_min: float = Field(1e-17, ge=1e-20, le=1e-6, description="Smallest sigma_y(1 s) of the scaled clock to evaluate.")
    adev_1s_max: float = Field(1e-8, ge=1e-19, le=1e-5, description="Largest sigma_y(1 s) of the scaled clock to evaluate.")
    n_grid: int = Field(13, ge=5, le=25)
    refine_steps: int = Field(8, ge=0, le=12)

    @model_validator(mode="after")
    def _check(self) -> "RequirementRequest":
        if len(set(self.base_scenario_keys)) != len(self.base_scenario_keys):
            raise ValueError("base_scenario_keys must be unique")
        if not self.adev_1s_max > self.adev_1s_min * 1.0001:
            raise ValueError("adev_1s_max must be greater than adev_1s_min")
        from app.services.sensitivity import validate_requirement

        validate_requirement(self)
        return self


class RequirementPointOut(BaseModel):
    adev_1s: float
    scale: float
    total: LossEstimateOut
    clock_only: LossEstimateOut
    non_clock_only: LossEstimateOut
    clock_variance_fraction: float


class RequirementOut(BaseModel):
    base_scenario_key: str
    label: str
    base_category: ProvenanceLabel
    base_adev_1s: float
    status: Literal["determined", "infeasible_non_clock_floor", "not_reached_in_range",
                    "not_binding_in_range", "ambiguous_non_monotonic"]
    required_adev_1s: float | None = Field(description="Largest evaluated sigma_y(1 s) meeting the target (conservative); "
                                           "a modelled requirement, not a device capability.")
    crossing_adev_1s: float | None
    approximate_bracket_adev_1s: tuple[float | None, float | None] | None
    required_adev_at_tau: dict[str, float] | None = Field(description="Scaled ADEV of the base shape at system averaging times.")
    floor: LossEstimateOut
    base_clock_at_scale_1: LossBreakdownOut
    curve: list[RequirementPointOut]
    monotonic_violations: list[int]
    messages: list[str]
    warnings: list[str]
    provenance: ProvenanceLabel = "simulated"


class RequirementsOut(BaseModel):
    metric: CoherenceMetric
    target_loss_db: float
    loss_ceiling_db: float
    results: list[RequirementOut]
    references: list[SourcedPointOut] = Field(description="Sourced and hypothetical sigma_y(1 s) reference values for context.")
    config_parameters: dict[str, QuantityOut]
    n_monte_carlo: int
    seed: int
    uncertainty_note: str
    notes: list[str]
