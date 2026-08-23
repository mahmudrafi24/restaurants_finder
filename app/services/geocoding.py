"""Nominatim geocoding: place name → coordinates.

This is the authority for turning a submitted city name into coordinates. It does *not* drive
autocomplete — Nominatim matches complete names, so a partial "hambu" finds an unrelated village
rather than Hamburg; :mod:`app.services.suggest` handles type-ahead. It does serve as the
fallback when suggestions are unavailable.

Nominatim's usage policy caps callers at roughly one request per second and requires an
identifying User-Agent. Results are cached (:class:`~app.core.cache.TTLCache`) because city
coordinates never meaningfully change.
"""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING, Any, Final

from app.core.cache import TTLCache
from app.core.errors import CityNotFoundError
from app.schemas.city import BoundingBox, City, dedupe_cities

if TYPE_CHECKING:
    from app.config import Settings
    from app.core.http import UpstreamClient

logger = logging.getLogger(__name__)

SERVICE_NAME = "Nominatim"

#: Nominatim `addresstype`/`type` values that represent something a user would call a "city".
#: Used only for ordering suggestions, never to exclude results.
_PLACE_PRIORITY = {
    "city": 0,
    "town": 1,
    "municipality": 2,
    "borough": 3,
    "village": 4,
    "suburb": 5,
    "county": 6,
    "state": 7,
}

#: How many candidates :meth:`GeocodingService.resolve` asks for. Requesting a single result
#: would take Nominatim's own top hit, which is not always a place: searching "Hambu" returns a
#: restaurant in Italy above the village of that name. Fetching a few and applying
#: :func:`_suggestion_rank` picks the settlement instead.
_RESOLVE_CANDIDATES: Final[int] = 5


class GeocodingService:
    """Resolves place names via Nominatim."""

    def __init__(self, client: UpstreamClient, settings: Settings) -> None:
        self._client = client
        self._settings = settings
        self._cache: TTLCache[list[City]] = TTLCache(
            ttl_seconds=settings.city_cache_ttl_seconds,
            max_entries=settings.city_cache_max_entries,
        )

    async def search(self, query: str, *, limit: int | None = None) -> list[City]:
        """Return candidate places for a (possibly partial) name, best match first.

        Returns an empty list when nothing matches; callers that require a result should use
        :meth:`resolve` instead.
        """
        normalized = query.strip()
        if not normalized:
            return []

        effective_limit = limit or self._settings.city_suggestion_limit
        cache_key = f"{normalized.casefold()}:{effective_limit}"

        cached = await self._cache.get(cache_key)
        if cached is not None:
            logger.debug("geocode cache hit", extra={"query": normalized})
            return cached

        response = await self._client.request(
            "GET",
            f"{self._settings.nominatim_base_url}/search",
            service=SERVICE_NAME,
            params={
                "q": normalized,
                "format": "jsonv2",
                "limit": effective_limit,
                "addressdetails": 1,
                "accept-language": self._settings.preferred_language,
            },
        )
        cities = [city for raw in response.json() if (city := _parse_city(raw)) is not None]
        cities.sort(key=_suggestion_rank)
        # Sort first: dedupe keeps the first occurrence, which should be the best-ranked one.
        cities = dedupe_cities(cities)

        await self._cache.set(cache_key, cities)
        logger.info(
            "geocoded place name",
            extra={"query": normalized, "result_count": len(cities)},
        )
        return cities

    async def resolve(self, city: str) -> City:
        """Return the single best match for a place name.

        Raises:
            CityNotFoundError: Nominatim returned no usable result.
        """
        results = await self.search(city, limit=_RESOLVE_CANDIDATES)
        if not results:
            raise CityNotFoundError(city)
        return results[0]


def _parse_city(raw: dict[str, Any]) -> City | None:
    """Convert one Nominatim result into a :class:`City`, or ``None`` if it is unusable."""
    try:
        latitude = float(raw["lat"])
        longitude = float(raw["lon"])
    except (KeyError, TypeError, ValueError):
        logger.warning("skipping Nominatim result without usable coordinates")
        return None

    display_name = str(raw.get("display_name") or "").strip()
    address = raw.get("address") or {}

    return City(
        name=_short_name(raw, display_name),
        display_name=display_name or _short_name(raw, ""),
        latitude=latitude,
        longitude=longitude,
        country=address.get("country"),
        country_code=(raw.get("country_code") or address.get("country_code") or None),
        type=raw.get("addresstype") or raw.get("type"),
        bounding_box=_parse_bounding_box(raw.get("boundingbox")),
    )


def _short_name(raw: dict[str, Any], display_name: str) -> str:
    """Best available short label: Nominatim's ``name``, else the first display-name segment."""
    name = str(raw.get("name") or "").strip()
    if name:
        return name
    if display_name:
        return display_name.split(",")[0].strip()
    return "Unknown location"


def _parse_bounding_box(raw: object) -> BoundingBox | None:
    """Parse Nominatim's ``[south, north, west, east]`` string array."""
    if not isinstance(raw, list) or len(raw) != 4:
        return None
    try:
        south, north, west, east = (float(value) for value in raw)
    except (TypeError, ValueError):
        return None
    return BoundingBox(south=south, north=north, west=west, east=east)


def _suggestion_rank(city: City) -> int:
    """Sort key placing cities and towns above suburbs and administrative regions.

    ``list.sort`` is stable, so Nominatim's own relevance ordering is preserved within each
    priority band. This only ensures searching "Hamburg" surfaces the city rather than a
    same-named suburb elsewhere.
    """
    return _PLACE_PRIORITY.get(city.type or "", 99)
