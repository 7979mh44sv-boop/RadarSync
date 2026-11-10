"""RadarSync scientific simulation package.

This package is pure physics/numerics: it depends only on NumPy and SciPy and
must never import the FastAPI web layer (`app`), FastAPI, Starlette or Pydantic.
That rule is enforced by `tests/sim/test_independence.py`.

Modules
-------
provenance    Labels separating sourced specs, assumptions, hypothetical targets
              and simulated outputs.
parameters    Sourced reference data (datasheets, challenge brief).
noise         Power-law fractional-frequency noise generators.
clock         Clock noise model: y(t), time error x(t), phase error phi(t).
stability     Overlapping Allan deviation estimator.
scenarios     OCXO / existing CSAC (SA65) / hypothetical NextGen CSAC.
timing_errors Non-clock timing-error terms and the synchronisation configuration.
network       Multi-node clock + non-clock errors with synchronisation corrections.
coherence     Coherent-integration gain and analytical expectations.
radar         Relative time/phase error and coherent loss metrics; scenario comparison.
consistency   Model-implied phase noise vs. sourced SA65 limits.
sensitivity   Parameter sweeps and modelled clock-stability requirements (Phase 3).
"""

__version__ = "0.4.0"
