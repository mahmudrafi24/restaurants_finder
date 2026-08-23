"""Place search orchestration: geocode → fetch → normalise → deduplicate → summarise.

This module contains the two fixes that recover the data the original CLI dropped:

* **Deduplication keys on the OSM ``type/id``**, not on the name. The CLI's ``seen.add(name)``
  collapsed every chain to a single row per city — 527 of 3,951 Hamburg places (13%) were lost
  that way.
* **The search radius is an explicit parameter.** The CLI iterated ``[5, 8, 12]`` km and broke on
  the first success, so a healthy run never looked beyond 5 km.

A second, narrower dedup pass then collapses genuine double-mappings — the same venue tagged
both as a node and as a building way — which share a name, amenity and position but not an id.
"""

from __future__ import annotations

import logging
import time
from typing import TYPE_CHECKING, Any, Final

from app.schemas.city import City
from app.schemas.place import Address, AmenityType, Place, SearchResponse, SearchStats

if TYPE_CHECKING:
    from collections.abc import Iterable, Sequence

    from app.services.geocoding import GeocodingService
    from app.services.overpass import OverpassService

logger = logging.getLogger(__name__)

#: Coordinate precision for near-duplicate detection. Four decimal places is roughly 11 m at
#: mid-latitudes — tight enough to keep neighbouring venues distinct, loose enough to match a
#: POI node against the centroid of its own building outline.
_COORD_PRECISION: Final[int] = 4

#: OSM tags checked in order when reading a single logical value. ``contact:*`` is the newer
#: convention; plenty of data still uses the bare key.
_PHONE_KEYS: Final[tuple[str, ...]] = ("phone", "contact:phone", "telephone")
_WEBSITE_KEYS: Final[tuple[str, ...]] = ("website", "contact:website", "url")


class PlaceSearchService:
    """Coordinates geocoding and Overpass into a single search operation."""

    def __init__(self, geocoding: GeocodingService, overpass: OverpassService) -> None:
        self._geocoding = geocoding
        self._overpass = overpass

    async def search(
        self,
        *,
        city: str,
        radius_km: int,
        amenities: Sequence[AmenityType],
        coordinates: tuple[float, float] | None = None,
    ) -> SearchResponse:
        """Resolve ``city`` and return every matching place within ``radius_km``.

        Args:
            coordinates: Optional ``(latitude, longitude)`` from a suggestion the user already
                picked. Supplying it skips geocoding, so the search centres on exactly the place
                shown in the UI and Nominatim is spared a redundant call.

        Raises:
            CityNotFoundError: The place name could not be geocoded.
            UpstreamError: Nominatim or Overpass failed. See :mod:`app.core.errors`.
        """
        started = time.perf_counter()

        resolved = (
            City(name=city, display_name=city, latitude=coordinates[0], longitude=coordinates[1])
            if coordinates is not None
            else await self._geocoding.resolve(city)
        )
        elements = await self._overpass.fetch_amenities(
            latitude=resolved.latitude,
            longitude=resolved.longitude,
            radius_km=radius_km,
            amenities=amenities,
        )
        places = normalize_elements(elements)
        elapsed_ms = int((time.perf_counter() - started) * 1000)

        logger.info(
            "completed place search",
            extra={
                "city": resolved.name,
                "radius_km": radius_km,
                "element_count": len(elements),
                "place_count": len(places),
                "elapsed_ms": elapsed_ms,
            },
        )

        return SearchResponse(
            city=resolved,
            radius_km=radius_km,
            amenities=list(amenities),
            stats=build_stats(places),
            places=places,
            elapsed_ms=elapsed_ms,
        )


# ── Normalisation ────────────────────────────────────────────────────────────


def normalize_elements(elements: Iterable[dict[str, Any]]) -> list[Place]:
    """Convert raw Overpass elements into deduplicated :class:`Place` objects.

    Elements without a name, without usable coordinates, or with an amenity value outside
    :class:`AmenityType` are skipped. Results are sorted by name for stable output.
    """
    by_osm_id: dict[str, Place] = {}
    skipped_unnamed = 0
    skipped_no_coords = 0

    for element in elements:
        tags = element.get("tags") or {}

        name = _clean(tags.get("name"))
        if not name:
            skipped_unnamed += 1
            continue

        coordinates = _extract_coordinates(element)
        if coordinates is None:
            skipped_no_coords += 1
            continue

        amenity = _parse_amenity(tags.get("amenity"))
        if amenity is None:
            continue

        osm_id = f"{element.get('type', 'node')}/{element.get('id', '')}"
        latitude, longitude = coordinates

        # Keyed on the OSM id, so two branches of one chain are two rows. This is the fix for
        # the CLI's name-based dedup.
        by_osm_id[osm_id] = Place(
            osm_id=osm_id,
            name=name,
            amenity=amenity,
            cuisine=_parse_cuisine(tags.get("cuisine")),
            address=_parse_address(tags),
            phone=_first_tag(tags, _PHONE_KEYS),
            website=_normalize_website(_first_tag(tags, _WEBSITE_KEYS)),
            opening_hours=_clean(tags.get("opening_hours")),
            latitude=latitude,
            longitude=longitude,
        )

    places = _collapse_double_mappings(by_osm_id.values())
    places.sort(key=lambda place: (place.name.casefold(), place.osm_id))

    if skipped_unnamed or skipped_no_coords:
        logger.debug(
            "skipped unusable OSM elements",
            extra={"unnamed": skipped_unnamed, "without_coordinates": skipped_no_coords},
        )
    return places


def _collapse_double_mappings(places: Iterable[Place]) -> list[Place]:
    """Drop entries that describe the same venue twice.

    OSM frequently carries a venue both as a POI node and as a building way. Those share name,
    amenity and position but have different ids, so id-based dedup keeps both. Matching on
    (name, amenity, rounded position) removes the duplicate while leaving distinct venues —
    even same-named ones a street apart — untouched.

    The richer record wins, so an entry with a phone number is preferred over a bare one.
    """
    best: dict[tuple[str, str, float, float], Place] = {}
    total = 0
    for place in places:
        total += 1
        key = (
            place.name.casefold(),
            place.amenity.value,
            round(place.latitude, _COORD_PRECISION),
            round(place.longitude, _COORD_PRECISION),
        )
        incumbent = best.get(key)
        if incumbent is None or _completeness(place) > _completeness(incumbent):
            best[key] = place

    if (removed := total - len(best)) > 0:
        logger.debug("collapsed double-mapped venues", extra={"removed": removed})
    return list(best.values())


def _completeness(place: Place) -> int:
    """Count populated optional fields — used to pick the better of two duplicate records."""
    return sum(
        1
        for value in (
            place.phone,
            place.website,
            place.opening_hours,
            place.address.formatted,
            place.cuisine or None,
        )
        if value
    )


def _extract_coordinates(element: dict[str, Any]) -> tuple[float, float] | None:
    """Read a lat/lon pair from a node's own position or a way/relation's ``center``."""
    if element.get("type") == "node":
        latitude, longitude = element.get("lat"), element.get("lon")
    else:
        center = element.get("center") or {}
        latitude, longitude = center.get("lat"), center.get("lon")

    if latitude is None or longitude is None:
        return None
    try:
        parsed = (float(latitude), float(longitude))
    except (TypeError, ValueError):
        return None

    if not (-90 <= parsed[0] <= 90 and -180 <= parsed[1] <= 180):
        return None
    return parsed


def _parse_amenity(raw: object) -> AmenityType | None:
    """Map an OSM ``amenity`` tag onto :class:`AmenityType`, or ``None`` if unsupported."""
    if not isinstance(raw, str):
        return None
    try:
        return AmenityType(raw.strip().lower())
    except ValueError:
        return None


def _parse_cuisine(raw: object) -> list[str]:
    """Split OSM's semicolon-delimited ``cuisine`` tag into distinct values."""
    if not isinstance(raw, str):
        return []
    values = (part.strip().lower() for part in raw.split(";"))
    return list(dict.fromkeys(value for value in values if value))


def _parse_address(tags: dict[str, Any]) -> Address:
    return Address(
        house_number=_clean(tags.get("addr:housenumber")),
        street=_clean(tags.get("addr:street")),
        suburb=_clean(tags.get("addr:suburb")) or _clean(tags.get("addr:district")),
        city=_clean(tags.get("addr:city")),
        postcode=_clean(tags.get("addr:postcode")),
    )


def _first_tag(tags: dict[str, Any], keys: Sequence[str]) -> str | None:
    """Return the first non-empty value among ``keys``, taking one entry from a `;` list."""
    for key in keys:
        value = _clean(tags.get(key))
        if value:
            return value.split(";")[0].strip() or None
    return None


def _normalize_website(raw: str | None) -> str | None:
    """Ensure a website value is a usable absolute URL.

    OSM data commonly omits the scheme (``www.example.com``). Values that still do not look like
    a URL are dropped rather than surfaced as broken links.
    """
    if not raw:
        return None
    value = raw.strip()
    if value.lower().startswith(("http://", "https://")):
        return value
    if "." not in value or " " in value:
        return None
    return f"https://{value.lstrip('/')}"


def _clean(value: object) -> str | None:
    """Trim a tag value, collapsing empties to ``None``."""
    if not isinstance(value, str):
        return None
    return value.strip() or None


# ── Statistics ───────────────────────────────────────────────────────────────


def build_stats(places: Sequence[Place]) -> SearchStats:
    """Summarise a result set so the client does not have to iterate thousands of rows."""
    by_amenity: dict[str, int] = {}
    for place in places:
        by_amenity[place.amenity.value] = by_amenity.get(place.amenity.value, 0) + 1

    return SearchStats(
        total=len(places),
        by_amenity=by_amenity,
        with_phone=sum(1 for place in places if place.phone),
        with_website=sum(1 for place in places if place.website),
        with_opening_hours=sum(1 for place in places if place.opening_hours),
    )
