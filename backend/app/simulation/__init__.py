"""RadarSync scientific simulation package.

Structure (mirrors the NextSemi challenge validation requirements):

    parameters    Sourced inputs vs. engineering assumptions, each with provenance.
    clock         Oscillator / atomic-clock noise models (ADEV-based).
    distribution  Noise added beyond the clock: distribution jitter, link noise, etc.
    architectures Baseline and competing timing architectures to compare.
    radar         Conversion of timing error into radar-level metrics.
    sensitivity   Parameter sweeps: when is the clock the limiting factor?

STATUS: scaffolding only. No physical model is implemented yet, and no
simulation results should be quoted from this package until it is.
"""
