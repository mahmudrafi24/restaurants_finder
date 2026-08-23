"""Settings parsing.

These tests construct :class:`Settings` from environment variables rather than keyword
arguments. That distinction matters: pydantic-settings applies JSON decoding to complex types
only when reading from an environment or dotenv source, so a kwargs-only test suite cannot catch
a malformed `CORS_ORIGINS` — which is exactly how a deployment breaks.
"""

from __future__ import annotations

import pytest

from app.config import BLOCKED_USER_AGENT_TOKENS, USER_AGENT_PRODUCT, VERSION, Settings


class TestCorsOrigins:
    def test_parses_a_comma_separated_env_var(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setenv("CORS_ORIGINS", "http://localhost:3000,https://app.vercel.app")
        settings = Settings(_env_file=None)  # type: ignore[call-arg]
        assert settings.cors_origins == ["http://localhost:3000", "https://app.vercel.app"]

    def test_tolerates_whitespace_between_entries(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setenv("CORS_ORIGINS", " http://a.test , http://b.test ")
        settings = Settings(_env_file=None)  # type: ignore[call-arg]
        assert settings.cors_origins == ["http://a.test", "http://b.test"]

    def test_accepts_a_single_origin(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setenv("CORS_ORIGINS", "https://only.test")
        settings = Settings(_env_file=None)  # type: ignore[call-arg]
        assert settings.cors_origins == ["https://only.test"]

    def test_still_accepts_a_json_array(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setenv("CORS_ORIGINS", '["https://a.test","https://b.test"]')
        settings = Settings(_env_file=None)  # type: ignore[call-arg]
        assert settings.cors_origins == ["https://a.test", "https://b.test"]

    def test_empty_value_yields_no_origins(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setenv("CORS_ORIGINS", "")
        settings = Settings(_env_file=None)  # type: ignore[call-arg]
        assert settings.cors_origins == []

    def test_defaults_to_local_frontend(self) -> None:
        settings = Settings(_env_file=None)  # type: ignore[call-arg]
        assert settings.cors_origins == ["http://localhost:3000"]


class TestCorsOriginRegex:
    def test_blank_value_disables_the_regex(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """An empty regex would otherwise compile to a pattern that matches every origin."""
        monkeypatch.setenv("CORS_ORIGIN_REGEX", "  ")
        settings = Settings(_env_file=None)  # type: ignore[call-arg]
        assert settings.cors_origin_regex is None

    def test_defaults_to_matching_vercel_previews(self) -> None:
        settings = Settings(_env_file=None)  # type: ignore[call-arg]
        assert settings.cors_origin_regex == r"https://.*\.vercel\.app"


class TestUserAgent:
    def test_identifies_the_app_and_a_contact(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """Nominatim's usage policy requires both; it blocks traffic it cannot attribute."""
        monkeypatch.setenv("CONTACT_EMAIL", "ops@acme.dev")
        monkeypatch.setenv("APP_URL", "https://acme.dev/app")

        user_agent = Settings(_env_file=None).user_agent  # type: ignore[call-arg]

        expected = f"{USER_AGENT_PRODUCT}/{VERSION} (+https://acme.dev/app; ops@acme.dev)"
        assert user_agent == expected

    def test_omits_the_contact_when_unset(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setenv("APP_URL", "https://acme.dev/app")
        monkeypatch.delenv("CONTACT_EMAIL", raising=False)

        user_agent = Settings(_env_file=None).user_agent  # type: ignore[call-arg]

        assert user_agent == f"{USER_AGENT_PRODUCT}/{VERSION} (+https://acme.dev/app)"

    @pytest.mark.parametrize(
        "email",
        ["you@example.com", "contact@example.org", "dev@localhost", "  ", "a@EXAMPLE.COM"],
    )
    def test_placeholder_contacts_are_dropped(
        self, monkeypatch: pytest.MonkeyPatch, email: str
    ) -> None:
        """Verified live: Nominatim answers a UA containing a reserved-domain address with a
        blanket HTTP 403, so a placeholder is worse than no address at all."""
        monkeypatch.setenv("CONTACT_EMAIL", email)

        settings = Settings(_env_file=None)  # type: ignore[call-arg]

        assert settings.contact_email is None
        assert "example" not in settings.user_agent.rpartition("(+")[2]

    def test_keeps_a_real_contact(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setenv("CONTACT_EMAIL", " ops@acme.dev ")
        assert Settings(_env_file=None).contact_email == "ops@acme.dev"  # type: ignore[call-arg]

    @pytest.mark.parametrize("token", sorted(BLOCKED_USER_AGENT_TOKENS))
    def test_carries_no_blocked_token(self, monkeypatch: pytest.MonkeyPatch, token: str) -> None:
        """Overpass refuses these outright, before parsing the query.

        Verified live: an identical request is answered 406 for ``TestScraper/1.0`` and 200 for
        ``TestFinder/1.0``. Renaming the product token to include one of these words would take
        every search offline while leaving city autocomplete working — a confusing failure this
        test exists to prevent.
        """
        monkeypatch.setenv("CONTACT_EMAIL", "ops@acme.dev")
        monkeypatch.setenv("APP_URL", "https://acme.dev/app")

        assert token not in Settings(_env_file=None).user_agent.casefold()  # type: ignore[call-arg]

    def test_product_token_carries_no_blocked_token(self) -> None:
        assert not any(
            token in USER_AGENT_PRODUCT.casefold() for token in BLOCKED_USER_AGENT_TOKENS
        )


class TestEnvironment:
    @pytest.mark.parametrize(
        ("value", "expected"),
        [("production", True), ("staging", False), ("development", False)],
    )
    def test_is_production_flag(
        self, monkeypatch: pytest.MonkeyPatch, value: str, expected: bool
    ) -> None:
        monkeypatch.setenv("ENVIRONMENT", value)
        assert Settings(_env_file=None).is_production is expected  # type: ignore[call-arg]

    def test_rejects_an_unknown_environment(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setenv("ENVIRONMENT", "wherever")
        with pytest.raises(ValueError, match="environment"):
            Settings(_env_file=None)  # type: ignore[call-arg]

    def test_rejects_an_out_of_range_radius(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setenv("DEFAULT_RADIUS_KM", "500")
        with pytest.raises(ValueError, match="default_radius_km"):
            Settings(_env_file=None)  # type: ignore[call-arg]
