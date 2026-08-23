"""Geocoding service tests — parsing, caching, ranking and error translation."""

from __future__ import annotations

from typing import Any

import httpx
import pytest
import respx

from app.config import USER_AGENT_PRODUCT, Settings
from app.core.errors import (
    CityNotFoundError,
    UpstreamRateLimitedError,
    UpstreamTimeoutError,
    UpstreamUnavailableError,
)
from app.core.http import UpstreamClient
from app.services.geocoding import GeocodingService
from tests.conftest import NOMINATIM_URL


@pytest.fixture
async def service(settings: Settings) -> GeocodingService:
    return GeocodingService(UpstreamClient(settings), settings)


class TestSearch:
    async def test_parses_a_nominatim_result(
        self,
        service: GeocodingService,
        mock_upstreams: respx.MockRouter,
        nominatim_hamburg: list[dict[str, Any]],
    ) -> None:
        mock_upstreams.get(NOMINATIM_URL).respond(json=nominatim_hamburg)

        (city,) = await service.search("Hamburg")

        assert city.name == "Hamburg"
        assert city.display_name == "Hamburg, Germany"
        assert city.latitude == pytest.approx(53.550341)
        assert city.longitude == pytest.approx(10.000654)
        assert city.country == "Germany"
        assert city.country_code == "de"
        assert city.type == "city"

    async def test_parses_the_bounding_box(
        self,
        service: GeocodingService,
        mock_upstreams: respx.MockRouter,
        nominatim_hamburg: list[dict[str, Any]],
    ) -> None:
        mock_upstreams.get(NOMINATIM_URL).respond(json=nominatim_hamburg)

        (city,) = await service.search("Hamburg")

        assert city.bounding_box is not None
        assert city.bounding_box.south == pytest.approx(53.3949)
        assert city.bounding_box.east == pytest.approx(10.3253)

    async def test_sends_a_policy_compliant_user_agent(
        self,
        service: GeocodingService,
        mock_upstreams: respx.MockRouter,
        nominatim_hamburg: list[dict[str, Any]],
    ) -> None:
        """Nominatim blocks traffic it cannot attribute to an application and contact."""
        route = mock_upstreams.get(NOMINATIM_URL).respond(json=nominatim_hamburg)

        await service.search("Hamburg")

        user_agent = route.calls.last.request.headers["user-agent"]
        assert USER_AGENT_PRODUCT in user_agent
        assert "tests@acme.dev" in user_agent

    async def test_blank_query_makes_no_request(
        self, service: GeocodingService, mock_upstreams: respx.MockRouter
    ) -> None:
        route = mock_upstreams.get(NOMINATIM_URL)
        assert await service.search("   ") == []
        assert not route.called

    async def test_empty_upstream_result_is_not_an_error(
        self, service: GeocodingService, mock_upstreams: respx.MockRouter
    ) -> None:
        mock_upstreams.get(NOMINATIM_URL).respond(json=[])
        assert await service.search("Xyzzyville") == []

    async def test_skips_results_without_coordinates(
        self, service: GeocodingService, mock_upstreams: respx.MockRouter
    ) -> None:
        mock_upstreams.get(NOMINATIM_URL).respond(
            json=[
                {"display_name": "Broken", "name": "Broken"},
                {"lat": "1.0", "lon": "2.0", "name": "Fine", "display_name": "Fine"},
            ]
        )
        results = await service.search("mixed")
        assert [city.name for city in results] == ["Fine"]

    async def test_derives_a_short_name_from_the_display_name(
        self, service: GeocodingService, mock_upstreams: respx.MockRouter
    ) -> None:
        mock_upstreams.get(NOMINATIM_URL).respond(
            json=[{"lat": "1.0", "lon": "2.0", "display_name": "Köln, NRW, Germany"}]
        )
        (city,) = await service.search("koln")
        assert city.name == "Köln"

    async def test_ranks_cities_above_suburbs(
        self, service: GeocodingService, mock_upstreams: respx.MockRouter
    ) -> None:
        mock_upstreams.get(NOMINATIM_URL).respond(
            json=[
                {
                    "lat": "1.0",
                    "lon": "1.0",
                    "name": "Hamburg",
                    "display_name": "Hamburg, Pennsylvania",
                    "addresstype": "suburb",
                },
                {
                    "lat": "2.0",
                    "lon": "2.0",
                    "name": "Hamburg",
                    "display_name": "Hamburg, Germany",
                    "addresstype": "city",
                },
            ]
        )
        results = await service.search("Hamburg")
        assert results[0].display_name == "Hamburg, Germany"

    async def test_drops_repeated_places(
        self, service: GeocodingService, mock_upstreams: respx.MockRouter
    ) -> None:
        """Nominatim can return a settlement's node and its boundary relation as two results."""
        mock_upstreams.get(NOMINATIM_URL).respond(
            json=[
                {
                    "lat": "52.1594747",
                    "lon": "4.4908843",
                    "name": "Leiden",
                    "display_name": "Leiden, South Holland, Netherlands",
                    "addresstype": "city",
                },
                {
                    "lat": "52.1594747",
                    "lon": "4.4908843",
                    "name": "Leiden",
                    "display_name": "Leiden, South Holland, Netherlands",
                    "addresstype": "city",
                },
            ]
        )

        assert len(await service.search("leiden")) == 1

    async def test_keeps_the_better_ranked_of_two_duplicates(
        self, service: GeocodingService, mock_upstreams: respx.MockRouter
    ) -> None:
        """Deduping must run after ranking, or the survivor is whichever arrived first."""
        mock_upstreams.get(NOMINATIM_URL).respond(
            json=[
                {
                    "lat": "1.0",
                    "lon": "1.0",
                    "name": "Springfield",
                    "display_name": "Springfield, Illinois",
                    "addresstype": "suburb",
                },
                {
                    "lat": "1.0",
                    "lon": "1.0",
                    "name": "Springfield",
                    "display_name": "Springfield, Illinois",
                    "addresstype": "city",
                },
            ]
        )

        (city,) = await service.search("springfield")
        assert city.type == "city"


class TestResolve:
    async def test_returns_the_best_match(
        self,
        service: GeocodingService,
        mock_upstreams: respx.MockRouter,
        nominatim_hamburg: list[dict[str, Any]],
    ) -> None:
        mock_upstreams.get(NOMINATIM_URL).respond(json=nominatim_hamburg)
        city = await service.resolve("Hamburg")
        assert city.name == "Hamburg"

    async def test_raises_when_nothing_matches(
        self, service: GeocodingService, mock_upstreams: respx.MockRouter
    ) -> None:
        mock_upstreams.get(NOMINATIM_URL).respond(json=[])

        with pytest.raises(CityNotFoundError) as exc_info:
            await service.resolve("Xyzzyville")

        assert exc_info.value.status_code == 404
        assert exc_info.value.details["query"] == "Xyzzyville"


class TestCaching:
    async def test_repeat_query_is_served_from_cache(
        self,
        settings: Settings,
        mock_upstreams: respx.MockRouter,
        nominatim_hamburg: list[dict[str, Any]],
    ) -> None:
        """Required by Nominatim's ~1 req/s policy, not merely an optimisation."""
        cached_settings = settings.model_copy(update={"city_cache_ttl_seconds": 3600})
        service = GeocodingService(UpstreamClient(cached_settings), cached_settings)
        route = mock_upstreams.get(NOMINATIM_URL).respond(json=nominatim_hamburg)

        await service.search("Hamburg")
        await service.search("hamburg")  # case-insensitive key
        await service.search("  Hamburg  ")  # whitespace-insensitive key

        assert route.call_count == 1

    async def test_cache_disabled_by_zero_ttl(
        self,
        service: GeocodingService,
        mock_upstreams: respx.MockRouter,
        nominatim_hamburg: list[dict[str, Any]],
    ) -> None:
        route = mock_upstreams.get(NOMINATIM_URL).respond(json=nominatim_hamburg)

        await service.search("Hamburg")
        await service.search("Hamburg")

        assert route.call_count == 2


class TestErrorTranslation:
    async def test_timeout(
        self, service: GeocodingService, mock_upstreams: respx.MockRouter
    ) -> None:
        """A socket timeout raises httpx.TimeoutException, not HTTPStatusError — the CLI's
        handler only caught the latter, so a slow upstream killed the whole run."""
        mock_upstreams.get(NOMINATIM_URL).mock(side_effect=httpx.ReadTimeout("too slow"))

        with pytest.raises(UpstreamTimeoutError):
            await service.search("Hamburg")

    async def test_rate_limited(
        self, service: GeocodingService, mock_upstreams: respx.MockRouter
    ) -> None:
        mock_upstreams.get(NOMINATIM_URL).respond(status_code=429, headers={"Retry-After": "2"})

        with pytest.raises(UpstreamRateLimitedError) as exc_info:
            await service.search("Hamburg")

        assert exc_info.value.status_code == 429
        assert exc_info.value.details["retry_after_seconds"] == pytest.approx(2.0)

    async def test_service_unavailable(
        self, service: GeocodingService, mock_upstreams: respx.MockRouter
    ) -> None:
        mock_upstreams.get(NOMINATIM_URL).respond(status_code=503)

        with pytest.raises(UpstreamUnavailableError):
            await service.search("Hamburg")

    async def test_connection_error(
        self, service: GeocodingService, mock_upstreams: respx.MockRouter
    ) -> None:
        mock_upstreams.get(NOMINATIM_URL).mock(side_effect=httpx.ConnectError("no route"))

        with pytest.raises(UpstreamUnavailableError):
            await service.search("Hamburg")


class TestRetries:
    async def test_retries_then_succeeds(
        self,
        settings: Settings,
        mock_upstreams: respx.MockRouter,
        nominatim_hamburg: list[dict[str, Any]],
    ) -> None:
        retrying = settings.model_copy(update={"max_retries": 2, "retry_backoff_seconds": 0.0})
        service = GeocodingService(UpstreamClient(retrying), retrying)
        route = mock_upstreams.get(NOMINATIM_URL).mock(
            side_effect=[
                httpx.Response(503),
                httpx.Response(200, json=nominatim_hamburg),
            ]
        )

        (city,) = await service.search("Hamburg")

        assert city.name == "Hamburg"
        assert route.call_count == 2

    async def test_does_not_retry_client_errors(
        self, settings: Settings, mock_upstreams: respx.MockRouter
    ) -> None:
        """A 400 will fail identically every time; retrying only wastes the time budget."""
        retrying = settings.model_copy(update={"max_retries": 3, "retry_backoff_seconds": 0.0})
        service = GeocodingService(UpstreamClient(retrying), retrying)
        route = mock_upstreams.get(NOMINATIM_URL).respond(status_code=400)

        with pytest.raises(Exception, match="HTTP 400"):
            await service.search("Hamburg")

        assert route.call_count == 1
