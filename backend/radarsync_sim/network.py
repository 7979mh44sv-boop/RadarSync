"""Multi-node radar timing network: clock + non-clock errors with synchronisation.

For node i at sample times t_n = n tau0 (n = 0 .. N-1):

    x_i(t)   = sqrt(1 - rho) x_i^ind(t) + sqrt(rho) x^common(t) + D u_i t^2 / 2     clock [s]
    s_i(t)   = x_i(t) + sum(in-loop non-clock terms)                               in sync loop
    r_i(t)   = s_i(t) - C_i(t) + sum(out-of-loop non-clock terms)                  residual [s]

where C_i is the synchronisation correction built from measurements
s_i(t_k) + e_ik at epochs t_k (e_ik ~ N(0, sigma_sync^2)):

    TIME:            C_i(t) = s_i(t_k) + e_ik
    TIME_FREQUENCY:  C_i(t) = s_i(t_k) + e_ik + yhat_ik (t - t_k),
                     yhat_ik = (measured_k - measured_{k-1}) / T_s  (0 for k = 0)
    NONE:            single epoch at t = 0.

C is linear in (s, e), so r splits exactly into per-source contributions.
"""

from dataclasses import dataclass, field, replace

import numpy as np

from radarsync_sim.clock import ClockNoiseModel
from radarsync_sim.provenance import Provenance, Quantity
from radarsync_sim.timing_errors import (
    ErrorCategory,
    NonClockTerm,
    SyncConfig,
    SyncMode,
    default_non_clock_terms,
)

CLOCK = "clock"


def _ratio(numerator: float, denominator: float, what: str) -> int:
    r = numerator / denominator
    if r < 1 or not np.isclose(r, round(r), rtol=0, atol=1e-9):
        raise ValueError(f"{what} must be a positive integer multiple ({numerator} / {denominator})")
    return int(round(r))


@dataclass(frozen=True)
class RadarNetworkConfig:
    """System parameters. All are ASSUMPTIONS (see `parameter_table`)."""

    carrier_frequency_hz: float = 10e9
    n_nodes: int = 4
    observation_s: float = 10.0
    sample_interval_s: float = 1e-3
    cpi_s: float = 0.1
    sync: SyncConfig = field(
        default_factory=lambda: SyncConfig(
            SyncMode.TIME, 1.0,
            Quantity(1e-12, "s", Provenance.ASSUMPTION, "Illustrative 1 ps rms time-transfer error per epoch."),
        )
    )
    clock_correlation: float = 0.0
    non_clock_terms: tuple[NonClockTerm, ...] = field(default_factory=default_non_clock_terms)
    n_monte_carlo: int = 16
    seed: int = 20261110

    def __post_init__(self) -> None:
        if self.n_nodes < 2:
            raise ValueError("need at least 2 nodes")
        if not 0.0 <= self.clock_correlation <= 1.0:
            raise ValueError("clock_correlation must be in [0, 1]")
        if self.carrier_frequency_hz <= 0 or self.n_monte_carlo < 1:
            raise ValueError("invalid carrier frequency or Monte Carlo count")
        n = _ratio(self.observation_s, self.sample_interval_s, "observation / sample interval")
        m = _ratio(self.cpi_s, self.sample_interval_s, "CPI / sample interval")
        if n % m:
            raise ValueError("observation must be an integer number of CPIs")
        if self.sync.mode is not SyncMode.NONE:
            s = _ratio(self.sync.interval_s, self.sample_interval_s, "sync interval / sample interval")
            if s % m or n % s:
                raise ValueError("sync interval must be a multiple of the CPI and divide the observation")

    @property
    def n_samples(self) -> int:
        return int(round(self.observation_s / self.sample_interval_s))

    @property
    def samples_per_cpi(self) -> int:
        return int(round(self.cpi_s / self.sample_interval_s))

    @property
    def samples_per_sync(self) -> int:
        if self.sync.mode is SyncMode.NONE:
            return self.n_samples
        return int(round(self.sync.interval_s / self.sample_interval_s))

    def parameter_table(self) -> dict[str, Quantity]:
        a = Provenance.ASSUMPTION
        why = "Assumed system parameter for illustration; configurable."
        table = {
            "carrier_frequency_hz": Quantity(self.carrier_frequency_hz, "Hz", a, why),
            "n_nodes": Quantity(self.n_nodes, "-", a, why),
            "observation_s": Quantity(self.observation_s, "s", a, why),
            "sample_interval_s": Quantity(self.sample_interval_s, "s", a, why),
            "cpi_s": Quantity(self.cpi_s, "s", a, why),
            "sync_interval_s": Quantity(self.sync.interval_s, "s", a, f"{why} Mode: {self.sync.mode}."),
            "sync_error_rms_s": self.sync.error_rms,
            "clock_correlation": Quantity(self.clock_correlation, "-", a, why),
        }
        table.update({f"term: {t.name}": t.rms for t in self.non_clock_terms})
        return table


@dataclass(frozen=True)
class NetworkRealization:
    """Residual time errors [s], shape (n_nodes, n_samples), split by source. SIMULATED."""

    t: np.ndarray
    contributions: dict[str, np.ndarray]
    provenance: Provenance = Provenance.SIMULATED

    @property
    def clock(self) -> np.ndarray:
        return self.contributions[CLOCK]

    @property
    def non_clock(self) -> np.ndarray:
        return sum(v for k, v in self.contributions.items() if k != CLOCK)

    @property
    def total(self) -> np.ndarray:
        return sum(self.contributions.values())


def _child_int_seed(seq: np.random.SeedSequence) -> int:
    return int(seq.generate_state(1, dtype=np.uint64)[0])


def sync_correction(s: np.ndarray, e: np.ndarray, cfg: RadarNetworkConfig) -> np.ndarray:
    """Correction C(t) built from in-loop timing s (K x N) and epoch measurement errors e (K x n_epochs)."""
    n_samples, step = s.shape[1], cfg.samples_per_sync
    n = np.arange(n_samples)
    k = n // step
    measured = s[:, ::step] + e
    corr = measured[:, k]
    if cfg.sync.mode is SyncMode.TIME_FREQUENCY:
        yhat = np.zeros_like(measured)
        yhat[:, 1:] = np.diff(measured, axis=1) / (step * cfg.sample_interval_s)
        corr = corr + yhat[:, k] * ((n - k * step) * cfg.sample_interval_s)
    return corr


def simulate_network(clock: ClockNoiseModel, cfg: RadarNetworkConfig, run_seed: int) -> NetworkRealization:
    """One Monte Carlo realisation. Random streams are split by source, so scenarios that share
    `run_seed` use common random numbers (same underlying draws, different coefficients)."""
    k_nodes, n, tau0 = cfg.n_nodes, cfg.n_samples, cfg.sample_interval_s
    t = np.arange(n) * tau0
    s_common, s_nodes, s_drift, s_sync, s_terms = np.random.SeedSequence(run_seed).spawn(5)

    noise_only = replace(clock, drift_per_s=0.0)
    x_ind = np.array([noise_only.simulate(n, tau0, _child_int_seed(c)).x[:n] for c in s_nodes.spawn(k_nodes)])
    rho = cfg.clock_correlation
    x_clock = np.sqrt(1.0 - rho) * x_ind
    if rho > 0:
        x_clock += np.sqrt(rho) * noise_only.simulate(n, tau0, _child_int_seed(s_common)).x[:n]
    u = np.random.default_rng(s_drift).uniform(-1.0, 1.0, (k_nodes, 1))
    x_clock = x_clock + 0.5 * clock.drift_per_s * u * t[None, :] ** 2

    n_epochs = -(-n // cfg.samples_per_sync)
    e = np.random.default_rng(s_sync).normal(0.0, cfg.sync.error_rms.value, (k_nodes, n_epochs))
    zero_e = np.zeros_like(e)

    contributions: dict[str, np.ndarray] = {
        CLOCK: x_clock - sync_correction(x_clock, zero_e, cfg),
        ErrorCategory.SYNCHRONIZATION.value: -sync_correction(np.zeros_like(x_clock), e, cfg),
    }
    for term, seq in zip(cfg.non_clock_terms, s_terms.spawn(len(cfg.non_clock_terms))):
        x = term.generate(k_nodes, n, tau0, np.random.default_rng(seq))
        if term.corrected_by_sync:
            x = x - sync_correction(x, zero_e, cfg)
        key = term.category.value
        contributions[key] = contributions.get(key, 0.0) + x
    return NetworkRealization(t=t, contributions=contributions)
