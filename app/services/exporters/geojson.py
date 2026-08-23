"""GeoJSON export (RFC 7946).

Produces a ``FeatureCollection`` of ``Point`` features, so results drop straight into QGIS,
Leaflet, Mapbox, kepler.gl or ``geopandas`` without conversion.
"""

from __future__ import annotations

import json
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from collections.abc import Sequence

    from app.schemas.place import Place


class GeoJsonExporter:
    """Renders places as a GeoJSON ``FeatureCollection``."""

    media_type = "application/geo+json"
    extension = "geojson"

    def render(self, places: Sequence[Place], *, city_name: str) -> bytes:
        collection: dict[str, Any] = {
            "type": "FeatureCollection",
            # Non-standard but widely honoured metadata block; ignored by strict parsers.
            "metadata": {
                "city": city_name,
                "count": len(places),
                "source": "OpenStreetMap via Overpass API",
                "license": "ODbL 1.0",
            },
            "features": [self._feature(place) for place in places],
        }
        return json.dumps(collection, ensure_ascii=False, indent=2).encode("utf-8")

    @staticmethod
    def _feature(place: Place) -> dict[str, Any]:
        return {
            "type": "Feature",
            # RFC 7946 mandates [longitude, latitude] order.
            "geometry": {"type": "Point", "coordinates": [place.longitude, place.latitude]},
            "id": place.osm_id,
            "properties": {
                "name": place.name,
                "amenity": place.amenity.value,
                "cuisine": place.cuisine,
                "address": place.address.formatted,
                "phone": place.phone,
                "website": place.website,
                "opening_hours": place.opening_hours,
                "maps_url": place.maps_url,
            },
        }
