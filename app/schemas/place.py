"""Schemas for place search and export — the public API contract.

The radius and row-count limits live here as module constants so they appear in the generated
OpenAPI schema and are enforced automatically by pydantic, rather than being duplicated between
validation and configuration.
"""

from __future__ import annotations

from enum import StrEnum
from typing import Annotated, Final

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    computed_field,
    field_validator,
    model_validator,
)

from app.schemas.city import City

#: Search radius bounds, in kilometres. The upper bound keeps dense-metro queries inside the
#: platform's function timeout — a 12 km Hamburg query already returns ~4,000 places in ~10s.
MIN_RADIUS_KM: Final[int] = 1
MAX_RADIUS_KM: Final[int] = 25

#: Cap on rows accepted by the export endpoint. Also keeps the request body well under the
#: 4.5 MB limit Vercel imposes on serverless function payloads.
MAX_EXPORT_ROWS: Final[int] = 10_000


class AmenityType(StrEnum):
    """OpenStreetMap ``amenity`` values this API can collect.

    Extending the API to bars, pubs or ice-cream parlours is a matter of adding members here —
    the Overpass query is built from whatever the request asks for.
    """

    CAFE = "cafe"
    RESTAURANT = "restaurant"
    FAST_FOOD = "fast_food"

    @property
    def label(self) -> str:
        """Human-readable form, e.g. ``fast_food`` → ``Fast Food``."""
        return self.value.replace("_", " ").title()


class ExportFormat(StrEnum):
    """Supported download formats."""

    XLSX = "xlsx"
    CSV = "csv"
    GEOJSON = "geojson"


class Address(BaseModel):
    """Structured address, kept in parts so callers can group or filter by any component."""

    house_number: str | None = None
    street: str | None = None
    suburb: str | None = None
    city: str | None = None
    postcode: str | None = None

    @computed_field  # type: ignore[prop-decorator]
    @property
    def formatted(self) -> str | None:
        """Single-line address, or ``None`` when OSM carried no address tags at all."""
        parts = [self.house_number, self.street, self.suburb, self.city, self.postcode]
        joined = ", ".join(part for part in parts if part)
        return joined or None


class Place(BaseModel):
    """A single cafe, restaurant or fast-food outlet."""

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "osm_id": "node/1234567890",
                "name": "Cafe Central",
                "amenity": "cafe",
                "cuisine": ["coffee_shop", "cake"],
                "address": {"street": "Reeperbahn", "house_number": "12", "city": "Hamburg"},
                "phone": "+49 40 123456",
                "website": "https://example.com",
                "opening_hours": "Mo-Fr 08:00-18:00",
                "latitude": 53.5503,
                "longitude": 9.9937,
            }
        }
    )

    osm_id: str = Field(
        ...,
        description="Stable OpenStreetMap identifier, `<type>/<id>`. Used as the dedup key.",
    )
    name: str
    amenity: AmenityType
    cuisine: list[str] = Field(
        default_factory=list,
        description="OSM cuisine tags, split on `;`. Empty when untagged.",
    )
    address: Address = Field(default_factory=Address)
    phone: str | None = None
    website: str | None = None
    opening_hours: str | None = None
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)

    @computed_field  # type: ignore[prop-decorator]
    @property
    def maps_url(self) -> str:
        """Google Maps link for the coordinates."""
        return f"https://www.google.com/maps/search/?api=1&query={self.latitude},{self.longitude}"


class SearchStats(BaseModel):
    """Aggregate counts, so the UI need not recompute them over thousands of rows."""

    total: int
    by_amenity: dict[str, int] = Field(default_factory=dict)
    with_phone: int = 0
    with_website: int = 0
    with_opening_hours: int = 0


class SearchRequest(BaseModel):
    """Parameters for a place search."""

    model_config = ConfigDict(
        json_schema_extra={
            "example": {"city": "Hamburg", "radius_km": 12, "amenities": ["cafe", "restaurant"]}
        }
    )

    city: Annotated[str, Field(min_length=2, max_length=200)]
    radius_km: Annotated[int, Field(ge=MIN_RADIUS_KM, le=MAX_RADIUS_KM)] = 10
    amenities: Annotated[list[AmenityType], Field(min_length=1)] = Field(
        default_factory=lambda: list(AmenityType)
    )
    latitude: Annotated[float | None, Field(ge=-90, le=90)] = Field(
        default=None,
        description=(
            "Latitude of a suggestion the user picked. Supply with `longitude` to search that "
            "exact point and skip geocoding; omit both to geocode `city`."
        ),
    )
    longitude: Annotated[float | None, Field(ge=-180, le=180)] = Field(
        default=None, description="Longitude of a picked suggestion. Requires `latitude`."
    )

    @field_validator("city")
    @classmethod
    def _strip_city(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("City name must not be blank.")
        return stripped

    @field_validator("amenities")
    @classmethod
    def _dedupe_amenities(cls, value: list[AmenityType]) -> list[AmenityType]:
        """Preserve request order while dropping repeats, so the Overpass regex stays minimal."""
        return list(dict.fromkeys(value))

    @model_validator(mode="after")
    def _coordinates_are_all_or_nothing(self) -> SearchRequest:
        """Reject a half-supplied coordinate pair.

        Accepting one alone would mean silently geocoding the city name instead, returning
        results for somewhere the caller did not ask about.
        """
        if (self.latitude is None) != (self.longitude is None):
            raise ValueError("latitude and longitude must be supplied together.")
        return self

    @property
    def coordinates(self) -> tuple[float, float] | None:
        """The requested centre point, or ``None`` when the city name should be geocoded."""
        if self.latitude is None or self.longitude is None:
            return None
        return self.latitude, self.longitude


class SearchResponse(BaseModel):
    """Search results plus the resolved location and timing."""

    city: City
    radius_km: int
    amenities: list[AmenityType]
    stats: SearchStats
    places: list[Place]
    elapsed_ms: int = Field(..., description="Server-side duration, including upstream calls.")


class ExportRequest(BaseModel):
    """Render already-fetched rows into a downloadable file.

    The client posts back the rows it received from ``/places/search``, which keeps the endpoint
    stateless and avoids querying Overpass a second time for data the caller already holds.
    """

    format: ExportFormat = ExportFormat.XLSX
    city_name: Annotated[str, Field(min_length=1, max_length=200)]
    places: Annotated[list[Place], Field(min_length=1, max_length=MAX_EXPORT_ROWS)]
