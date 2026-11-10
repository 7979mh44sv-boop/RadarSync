"""Simulation API (v1). Thin HTTP layer over app.services.simulation."""

from fastapi import APIRouter, HTTPException

from app import schemas as S
from app.services import simulation as svc

router = APIRouter(prefix="/api/v1", tags=["simulation"])


def _not_found(err: KeyError) -> HTTPException:
    return HTTPException(status_code=404, detail=str(err.args[0]))


@router.get("/scenarios", response_model=S.ScenarioListOut, summary="Clock scenarios and provenance")
def get_scenarios() -> S.ScenarioListOut:
    return svc.list_scenarios()


@router.get("/parameters", response_model=S.ParametersOut, summary="Configurable parameters, ranges and limits")
def get_parameters() -> S.ParametersOut:
    return svc.parameter_specs()


@router.get("/limitations", response_model=S.LimitationsOut, summary="Model limitations and SA65 consistency check")
def get_limitations() -> S.LimitationsOut:
    return svc.limitations()


@router.post("/clock/adev", response_model=S.AdevOut, summary="Allan deviation curves (model and simulated)")
def post_adev(req: S.AdevRequest) -> S.AdevOut:
    try:
        return svc.adev_curves(req)
    except KeyError as e:
        raise _not_found(e) from None


@router.post("/network/timing", response_model=S.TimingSeriesOut, summary="Relative timing error time series")
def post_timing(req: S.TimingRequest) -> S.TimingSeriesOut:
    try:
        return svc.timing_series(req)
    except KeyError as e:
        raise _not_found(e) from None


@router.post("/radar/coherence", response_model=S.CoherenceOut, summary="Coherent integration loss metrics")
def post_coherence(req: S.CoherenceRequest) -> S.CoherenceOut:
    try:
        return svc.coherence(req)
    except KeyError as e:
        raise _not_found(e) from None
