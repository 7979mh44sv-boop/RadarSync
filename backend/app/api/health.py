"""Service health endpoint used by the dashboard and for local verification."""

from datetime import datetime, timezone

import numpy as np
import scipy
from fastapi import APIRouter
from pydantic import BaseModel

from app import __version__
from app.config import settings

router = APIRouter(tags=["health"])


class HealthResponse(BaseModel):
    status: str
    service: str
    version: str
    environment: str
    timestamp: datetime
    numpy_version: str
    scipy_version: str


@router.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(
        status="ok",
        service="radarsync-backend",
        version=__version__,
        environment=settings.environment,
        timestamp=datetime.now(timezone.utc),
        numpy_version=np.__version__,
        scipy_version=scipy.__version__,
    )
