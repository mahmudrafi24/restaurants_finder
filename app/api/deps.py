"""FastAPI dependency providers.

Long-lived objects (the HTTP client and the services wrapping it) are created once during the
application lifespan and stored on ``app.state``. These providers simply hand them to routes, so
tests can swap them by overriding a single dependency.

Service classes are imported at runtime, not under ``TYPE_CHECKING``: FastAPI resolves endpoint
annotations at import time to build the dependency graph, so a string forward reference here
would fail. There is no import cycle — the service layer never imports the API layer.
"""

from __future__ import annotations

from typing import Annotated

from fastapi import Depends, Request

from app.config import Settings, get_settings
from app.services.geocoding import GeocodingService
from app.services.places import PlaceSearchService
from app.services.suggest import SuggestionService


def get_geocoding_service(request: Request) -> GeocodingService:
    """Return the shared :class:`~app.services.geocoding.GeocodingService`."""
    service: GeocodingService = request.app.state.geocoding_service
    return service


def get_suggestion_service(request: Request) -> SuggestionService:
    """Return the shared :class:`~app.services.suggest.SuggestionService`."""
    service: SuggestionService = request.app.state.suggestion_service
    return service


def get_place_search_service(request: Request) -> PlaceSearchService:
    """Return the shared :class:`~app.services.places.PlaceSearchService`."""
    service: PlaceSearchService = request.app.state.place_search_service
    return service


SettingsDep = Annotated[Settings, Depends(get_settings)]
GeocodingDep = Annotated[GeocodingService, Depends(get_geocoding_service)]
SuggestionDep = Annotated[SuggestionService, Depends(get_suggestion_service)]
PlaceSearchDep = Annotated[PlaceSearchService, Depends(get_place_search_service)]
