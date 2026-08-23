"""Domain exceptions and their HTTP representation.

Services raise these instead of ``HTTPException`` so they stay transport-agnostic; the handlers
registered in :mod:`app.main` translate them into responses. Every error carries a stable
machine-readable ``code`` that clients can branch on without parsing prose.
"""

from __future__ import annotations

from typing import Any


class AppError(Exception):
    """Base class for expected, user-facing failures."""

    status_code: int = 500
    code: str = "internal_error"
    message: str = "An unexpected error occurred."

    def __init__(
        self,
        message: str | None = None,
        *,
        details: dict[str, Any] | None = None,
    ) -> None:
        self.message = message or self.message
        self.details = details or {}
        super().__init__(self.message)

    def to_payload(self) -> dict[str, Any]:
        """Serialise into the API's error envelope."""
        payload: dict[str, Any] = {"error": {"code": self.code, "message": self.message}}
        if self.details:
            payload["error"]["details"] = self.details
        return payload


# ── Client errors ────────────────────────────────────────────────────────────


class ValidationError(AppError):
    status_code = 422
    code = "validation_error"
    message = "The request payload is invalid."


class CityNotFoundError(AppError):
    status_code = 404
    code = "city_not_found"
    message = "No matching city was found."

    def __init__(self, city: str) -> None:
        super().__init__(
            f"Could not find a location matching {city!r}. Try a larger or differently "
            "spelled place name.",
            details={"query": city},
        )


class ExportTooLargeError(AppError):
    status_code = 413
    code = "export_too_large"
    message = "The export request contains too many rows."

    def __init__(self, given: int, maximum: int) -> None:
        super().__init__(
            f"Cannot export {given:,} rows; the limit is {maximum:,}. Narrow the search radius "
            "or filter the results first.",
            details={"given": given, "maximum": maximum},
        )


class UnsupportedFormatError(AppError):
    status_code = 400
    code = "unsupported_format"
    message = "The requested export format is not supported."

    def __init__(self, fmt: str, supported: list[str]) -> None:
        super().__init__(
            f"Export format {fmt!r} is not supported. Available formats: {', '.join(supported)}.",
            details={"requested": fmt, "supported": supported},
        )


# ── Upstream errors ──────────────────────────────────────────────────────────


class UpstreamError(AppError):
    """Base class for failures originating in Nominatim or Overpass."""

    status_code = 502
    code = "upstream_error"
    message = "An upstream data provider returned an unexpected response."

    def __init__(self, service: str, message: str | None = None) -> None:
        super().__init__(message, details={"service": service})


class UpstreamTimeoutError(UpstreamError):
    status_code = 504
    code = "upstream_timeout"

    def __init__(self, service: str) -> None:
        super().__init__(
            service,
            f"{service} took too long to respond. Dense cities can exceed the time limit — "
            "try a smaller radius.",
        )


class UpstreamRateLimitedError(UpstreamError):
    status_code = 429
    code = "upstream_rate_limited"

    def __init__(self, service: str, retry_after: float | None = None) -> None:
        super().__init__(
            service,
            f"{service} is rate limiting requests. Please wait a moment and try again.",
        )
        if retry_after is not None:
            self.details["retry_after_seconds"] = retry_after


class UpstreamUnavailableError(UpstreamError):
    status_code = 503
    code = "upstream_unavailable"

    def __init__(self, service: str) -> None:
        super().__init__(
            service,
            f"{service} is temporarily unavailable. This is usually transient — try again shortly.",
        )
