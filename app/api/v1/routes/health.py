"""Health and readiness endpoint."""

from __future__ import annotations

from fastapi import APIRouter
from pydantic import BaseModel

from app.api.deps import SettingsDep
from app.config import VERSION

router = APIRouter(tags=["system"])


class HealthResponse(BaseModel):
    """Liveness payload."""

    status: str
    version: str
    environment: str


@router.get("/health", response_model=HealthResponse, summary="Liveness check")
async def health(settings: SettingsDep) -> HealthResponse:
    """Report that the service is up.

    Deliberately does not call Nominatim or Overpass — a health check that depends on third-party
    availability causes restart loops when those providers have a bad day.
    """
    return HealthResponse(status="ok", version=VERSION, environment=settings.environment)
