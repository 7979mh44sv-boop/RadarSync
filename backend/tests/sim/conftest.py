import numpy as np

from radarsync_sim.clock import ClockNoiseModel
from radarsync_sim.stability import overlapping_adev

N = 2**15
SEEDS = range(8)


def ensemble_adev(model: ClockNoiseModel, m: np.ndarray, tau0: float = 1.0, n: int = N) -> np.ndarray:
    """Root of the seed-averaged Allan variance (reduces estimator scatter for tests)."""
    var = [overlapping_adev(model.simulate(n, tau0, s).x, tau0, m).adev ** 2 for s in SEEDS]
    return np.sqrt(np.mean(var, axis=0))


def loglog_slope(taus: np.ndarray, adev: np.ndarray) -> float:
    return float(np.polyfit(np.log10(taus), np.log10(adev), 1)[0])
