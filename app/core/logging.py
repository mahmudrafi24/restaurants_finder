"""Logging setup.

Emits single-line JSON in production so Vercel's log drains and most aggregators can parse it
without a custom grok pattern, and human-readable text in development.
"""

from __future__ import annotations

import json
import logging
import sys
from typing import Any

#: Attributes present on every ``LogRecord``; anything else was added by the caller via
#: ``extra=`` and belongs in the structured output.
_RESERVED_ATTRS = frozenset(
    {
        "args", "asctime", "created", "exc_info", "exc_text", "filename", "funcName",
        "levelname", "levelno", "lineno", "module", "msecs", "message", "msg", "name",
        "pathname", "process", "processName", "relativeCreated", "stack_info", "taskName",
        "thread", "threadName",
    }
)  # fmt: skip


class JsonFormatter(logging.Formatter):
    """Render records as one JSON object per line."""

    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, Any] = {
            "timestamp": self.formatTime(record, "%Y-%m-%dT%H:%M:%S%z"),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        for key, value in record.__dict__.items():
            if key not in _RESERVED_ATTRS and not key.startswith("_"):
                payload[key] = value
        if record.exc_info:
            payload["exception"] = self.formatException(record.exc_info)
        return json.dumps(payload, default=str, ensure_ascii=False)


def configure_logging(*, level: str = "INFO", json_output: bool = False) -> None:
    """Install a single stdout handler on the root logger.

    Idempotent: existing handlers are replaced, so calling this from both the app factory and a
    test fixture does not duplicate output.
    """
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(
        JsonFormatter()
        if json_output
        else logging.Formatter("%(levelname)-8s %(name)-32s %(message)s")
    )

    root = logging.getLogger()
    root.handlers.clear()
    root.addHandler(handler)
    root.setLevel(level.upper())

    # httpx logs every request at INFO, which is noise once our own logs carry the same facts.
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("httpcore").setLevel(logging.WARNING)
