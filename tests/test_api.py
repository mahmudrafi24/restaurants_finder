"""End-to-end route tests through the ASGI app, with upstreams mocked."""

from __future__ import annotations

import io
import json
from typing import Any

import httpx
import pytest
import respx
from openpyxl import load_workbook

from tests.conftest import NOMINATIM_URL, OVERPASS_URL, PHOTON_URL


@pytest.fixture
def hamburg_upstreams(
    mock_upstreams: respx.MockRouter,
    nominatim_hamburg: list[dict[str, Any]],
    hamburg_overpass_payload: dict[str, Any],
) -> respx.MockRouter:
    """Both upstreams answering as they do for a real Hamburg search.

    Routes are named so tests can assert on them via ``mock_upstreams["nominatim"]`` rather than
    re-registering, which would shadow the mock set up here.
    """
    mock_upstreams.get(NOMINATIM_URL, name="nominatim").respond(json=nominatim_hamburg)
    mock_upstreams.post(OVERPASS_URL, name="overpass").respond(json=hamburg_overpass_payload)
    return mock_upstreams


class TestHealth:
    async def test_reports_ok(self, client: httpx.AsyncClient) -> None:
        response = await client.get("/api/v1/health")
        assert response.status_code == 200
        assert response.json()["status"] == "ok"

    async def test_does_not_call_upstreams(
        self, client: httpx.AsyncClient, mock_upstreams: respx.MockRouter
    ) -> None:
        """Health must not depend on third-party availability, or a bad Overpass day looks
        like an outage here."""
        await client.get("/api/v1/health")
        assert not mock_upstreams.calls

    async def test_root_redirects_to_docs(self, client: httpx.AsyncClient) -> None:
        response = await client.get("/")
        assert response.status_code == 307
        assert response.headers["location"] == "/docs"


class TestCitySearch:
    async def test_returns_suggestions(
        self,
        client: httpx.AsyncClient,
        mock_upstreams: respx.MockRouter,
        photon_hamburg: dict[str, Any],
    ) -> None:
        mock_upstreams.get(PHOTON_URL).respond(json=photon_hamburg)

        response = await client.get("/api/v1/cities/search", params={"q": "hambu"})

        assert response.status_code == 200
        body = response.json()
        assert body["query"] == "hambu"
        assert body["results"][0]["name"] == "Hamburg"

    async def test_partial_names_are_served_by_photon_not_nominatim(
        self,
        client: httpx.AsyncClient,
        mock_upstreams: respx.MockRouter,
        photon_hamburg: dict[str, Any],
        nominatim_hamburg: list[dict[str, Any]],
    ) -> None:
        """Nominatim matches whole names only, so it cannot drive an autocomplete."""
        photon = mock_upstreams.get(PHOTON_URL).respond(json=photon_hamburg)
        nominatim = mock_upstreams.get(NOMINATIM_URL).respond(json=nominatim_hamburg)

        await client.get("/api/v1/cities/search", params={"q": "hambu"})

        assert photon.call_count == 1
        assert not nominatim.calls

    async def test_falls_back_to_nominatim_when_photon_fails(
        self,
        client: httpx.AsyncClient,
        mock_upstreams: respx.MockRouter,
        nominatim_hamburg: list[dict[str, Any]],
    ) -> None:
        """A dead suggestion provider should degrade the search box, not break it."""
        mock_upstreams.get(PHOTON_URL).mock(side_effect=httpx.ConnectError("down"))
        mock_upstreams.get(NOMINATIM_URL).respond(json=nominatim_hamburg)

        response = await client.get("/api/v1/cities/search", params={"q": "Hamburg"})

        assert response.status_code == 200
        assert response.json()["results"][0]["name"] == "Hamburg"

    async def test_no_match_returns_empty_list_not_404(
        self, client: httpx.AsyncClient, mock_upstreams: respx.MockRouter
    ) -> None:
        """A half-typed name is a normal autocomplete state, not an error."""
        mock_upstreams.get(PHOTON_URL).respond(json={"features": []})

        response = await client.get("/api/v1/cities/search", params={"q": "zzzz"})

        assert response.status_code == 200
        assert response.json()["results"] == []

    async def test_rejects_too_short_a_query(self, client: httpx.AsyncClient) -> None:
        response = await client.get("/api/v1/cities/search", params={"q": "a"})
        assert response.status_code == 422
        assert response.json()["error"]["code"] == "validation_error"


class TestPlaceSearch:
    async def test_returns_places_and_stats(
        self, client: httpx.AsyncClient, hamburg_upstreams: respx.MockRouter
    ) -> None:
        response = await client.post(
            "/api/v1/places/search", json={"city": "Hamburg", "radius_km": 12}
        )

        assert response.status_code == 200
        body = response.json()
        assert body["city"]["name"] == "Hamburg"
        assert body["radius_km"] == 12
        # Well above the 2,862 rows the CLI's 5 km + name-dedup produced for Hamburg.
        assert body["stats"]["total"] > 3_500
        assert body["stats"]["total"] == len(body["places"])
        assert set(body["stats"]["by_amenity"]) == {"cafe", "restaurant", "fast_food"}

    async def test_includes_computed_fields(
        self, client: httpx.AsyncClient, hamburg_upstreams: respx.MockRouter
    ) -> None:
        response = await client.post("/api/v1/places/search", json={"city": "Hamburg"})
        place = response.json()["places"][0]

        assert place["maps_url"].startswith("https://www.google.com/maps/search/")
        assert "formatted" in place["address"]
        assert place["osm_id"].split("/")[0] in {"node", "way", "relation"}

    async def test_defaults_to_all_amenities(
        self, client: httpx.AsyncClient, hamburg_upstreams: respx.MockRouter
    ) -> None:
        response = await client.post("/api/v1/places/search", json={"city": "Hamburg"})
        assert response.json()["amenities"] == ["cafe", "restaurant", "fast_food"]

    async def test_filters_by_requested_amenity(
        self,
        client: httpx.AsyncClient,
        mock_upstreams: respx.MockRouter,
        nominatim_hamburg: list[dict[str, Any]],
    ) -> None:
        mock_upstreams.get(NOMINATIM_URL).respond(json=nominatim_hamburg)
        route = mock_upstreams.post(OVERPASS_URL).respond(json={"elements": []})

        await client.post("/api/v1/places/search", json={"city": "Hamburg", "amenities": ["cafe"]})

        assert '"amenity"~"^(cafe)$"' in route.calls.last.request.content.decode()

    async def test_unknown_city_is_404(
        self, client: httpx.AsyncClient, mock_upstreams: respx.MockRouter
    ) -> None:
        mock_upstreams.get(NOMINATIM_URL).respond(json=[])

        response = await client.post("/api/v1/places/search", json={"city": "Xyzzyville"})

        assert response.status_code == 404
        assert response.json()["error"]["code"] == "city_not_found"

    async def test_supplied_coordinates_skip_geocoding(
        self, client: httpx.AsyncClient, hamburg_upstreams: respx.MockRouter
    ) -> None:
        """A picked suggestion already carries coordinates; re-geocoding could land elsewhere."""
        nominatim = hamburg_upstreams["nominatim"]
        overpass = hamburg_upstreams["overpass"]

        response = await client.post(
            "/api/v1/places/search",
            json={"city": "Hamburg", "latitude": 53.5501721, "longitude": 10.0013165},
        )

        assert response.status_code == 200
        assert not nominatim.calls
        assert "53.5501721,10.0013165" in overpass.calls.last.request.content.decode()

    async def test_supplied_coordinates_are_echoed_back(
        self, client: httpx.AsyncClient, hamburg_upstreams: respx.MockRouter
    ) -> None:
        response = await client.post(
            "/api/v1/places/search",
            json={"city": "Hamburg Altstadt", "latitude": 53.55, "longitude": 10.0},
        )

        city = response.json()["city"]
        assert city["name"] == "Hamburg Altstadt"
        assert (city["latitude"], city["longitude"]) == (53.55, 10.0)

    @pytest.mark.parametrize(
        "payload",
        [
            {"city": "Hamburg", "latitude": 53.55},
            {"city": "Hamburg", "longitude": 10.0},
        ],
    )
    async def test_rejects_half_a_coordinate_pair(
        self, client: httpx.AsyncClient, payload: dict[str, Any]
    ) -> None:
        """Silently geocoding instead would return results for a place nobody asked about."""
        response = await client.post("/api/v1/places/search", json=payload)
        assert response.status_code == 422

    async def test_upstream_timeout_is_504(
        self,
        client: httpx.AsyncClient,
        mock_upstreams: respx.MockRouter,
        nominatim_hamburg: list[dict[str, Any]],
    ) -> None:
        mock_upstreams.get(NOMINATIM_URL).respond(json=nominatim_hamburg)
        mock_upstreams.post(OVERPASS_URL).mock(side_effect=httpx.ReadTimeout("slow"))

        response = await client.post("/api/v1/places/search", json={"city": "Hamburg"})

        assert response.status_code == 504
        assert response.json()["error"]["code"] == "upstream_timeout"

    @pytest.mark.parametrize(
        ("payload", "reason"),
        [
            ({"city": "H"}, "city shorter than the minimum"),
            ({"city": "Hamburg", "radius_km": 0}, "radius below the minimum"),
            ({"city": "Hamburg", "radius_km": 100}, "radius above the maximum"),
            ({"city": "Hamburg", "amenities": []}, "no amenity selected"),
            ({"city": "Hamburg", "amenities": ["nightclub"]}, "unsupported amenity"),
            ({}, "missing city"),
        ],
    )
    async def test_rejects_invalid_requests(
        self, client: httpx.AsyncClient, payload: dict[str, Any], reason: str
    ) -> None:
        response = await client.post("/api/v1/places/search", json=payload)
        assert response.status_code == 422, reason
        assert response.json()["error"]["code"] == "validation_error"


class TestExport:
    @staticmethod
    def _payload(export_format: str, count: int = 2) -> dict[str, Any]:
        return {
            "format": export_format,
            "city_name": "Hamburg",
            "places": [
                {
                    "osm_id": f"node/{index}",
                    "name": f"Place {index}",
                    "amenity": "cafe",
                    "latitude": 53.55 + index / 1000,
                    "longitude": 10.0,
                }
                for index in range(count)
            ],
        }

    async def test_xlsx_download(self, client: httpx.AsyncClient) -> None:
        response = await client.post("/api/v1/places/export", json=self._payload("xlsx"))

        assert response.status_code == 200
        assert response.headers["content-type"].startswith(
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )
        assert (
            'filename="hamburg_cafes_restaurants.xlsx"' in response.headers["content-disposition"]
        )

        sheet = load_workbook(io.BytesIO(response.content))["Results"]
        assert sheet.max_row == 4  # title + header + 2 rows

    async def test_csv_download(self, client: httpx.AsyncClient) -> None:
        response = await client.post("/api/v1/places/export", json=self._payload("csv"))

        assert response.status_code == 200
        assert response.headers["content-type"].startswith("text/csv")
        assert response.content.decode("utf-8-sig").startswith("Name,Type,Cuisine")

    async def test_geojson_download(self, client: httpx.AsyncClient) -> None:
        response = await client.post("/api/v1/places/export", json=self._payload("geojson"))

        assert response.status_code == 200
        assert response.headers["content-type"].startswith("application/geo+json")
        assert json.loads(response.content)["type"] == "FeatureCollection"

    async def test_defaults_to_xlsx(self, client: httpx.AsyncClient) -> None:
        payload = self._payload("xlsx")
        del payload["format"]

        response = await client.post("/api/v1/places/export", json=payload)

        assert response.status_code == 200
        assert response.headers["content-disposition"].endswith(".xlsx")

    async def test_exposes_content_disposition_to_the_browser(
        self, client: httpx.AsyncClient
    ) -> None:
        """Without this header the cross-origin frontend cannot read the filename."""
        response = await client.post("/api/v1/places/export", json=self._payload("csv"))
        assert "Content-Disposition" in response.headers["access-control-expose-headers"]

    async def test_makes_no_upstream_calls(
        self, client: httpx.AsyncClient, mock_upstreams: respx.MockRouter
    ) -> None:
        """Export renders rows the client already holds; re-querying Overpass would double
        the load for no benefit."""
        await client.post("/api/v1/places/export", json=self._payload("xlsx"))
        assert not mock_upstreams.calls

    async def test_rejects_an_empty_row_set(self, client: httpx.AsyncClient) -> None:
        response = await client.post(
            "/api/v1/places/export",
            json={"format": "xlsx", "city_name": "Hamburg", "places": []},
        )
        assert response.status_code == 422

    async def test_rejects_an_unsupported_format(self, client: httpx.AsyncClient) -> None:
        response = await client.post("/api/v1/places/export", json=self._payload("pdf"))
        assert response.status_code == 422

    async def test_rejects_too_many_rows(self, client: httpx.AsyncClient) -> None:
        response = await client.post("/api/v1/places/export", json=self._payload("csv", 10_001))
        assert response.status_code == 422


class TestErrorEnvelope:
    async def test_validation_errors_list_fields(self, client: httpx.AsyncClient) -> None:
        response = await client.post("/api/v1/places/search", json={"city": "H"})

        error = response.json()["error"]
        assert error["code"] == "validation_error"
        assert error["details"]["fields"][0]["field"] == "city"
        assert error["details"]["fields"][0]["message"]

    async def test_unknown_route_is_404(self, client: httpx.AsyncClient) -> None:
        response = await client.get("/api/v1/nope")
        assert response.status_code == 404
