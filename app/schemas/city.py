"""Schemas for geocoding (city lookup)."""

from __future__ import annotations

from typing import TYPE_CHECKING

from pydantic import BaseModel, ConfigDict, Field

if TYPE_CHECKING:
    from collections.abc import Iterable

#: Decimal places coordinates are rounded to when deciding whether two results are the same place.
#: Four places is roughly 11 m — far tighter than the distance between two settlements, and far
#: looser than the difference between a geocoder's node and relation records for one city.
_COORDINATE_PRECISION = 4


class BoundingBox(BaseModel):
    """Geographic extent of a place, as returned by Nominatim."""

    south: float = Field(..., ge=-90, le=90)
    north: float = Field(..., ge=-90, le=90)
    west: float = Field(..., ge=-180, le=180)
    east: float = Field(..., ge=-180, le=180)


class City(BaseModel):
    """A geocoded place the user can search within."""

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "name": "Hamburg",
                "display_name": "Hamburg, Germany",
                "latitude": 53.550341,
                "longitude": 10.000654,
                "country": "Germany",
                "country_code": "de",
                "type": "city",
            }
        }
    )

    name: str = Field(..., description="Short place name, suitable for filenames and headings.")
    display_name: str = Field(..., description="Full comma-separated name from Nominatim.")
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    country: str | None = None
    country_code: str | None = Field(None, max_length=8)
    type: str | None = Field(None, description="Nominatim place class, e.g. city, town, suburb.")
    bounding_box: BoundingBox | None = None


class CitySearchResponse(BaseModel):
    """Autocomplete suggestions for a partial place name."""

    query: str
    results: list[City]


def dedupe_cities(cities: Iterable[City]) -> list[City]:
    """Drop repeated places, keeping the first — and therefore best-ranked — of each.

    OpenStreetMap holds several objects per settlement: a node for the centre, a relation for the
    administrative boundary, sometimes both plus a locality. Geocoders index each separately and
    happily return all of them, which reaches the user as the same city listed two or three times.
    """
    seen: set[tuple[str, float, float]] = set()
    unique: list[City] = []

    for city in cities:
        key = (
            city.display_name.casefold(),
            round(city.latitude, _COORDINATE_PRECISION),
            round(city.longitude, _COORDINATE_PRECISION),
        )
        if key in seen:
            continue
        seen.add(key)
        unique.append(city)

    return unique
