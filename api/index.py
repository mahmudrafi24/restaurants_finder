"""Vercel entrypoint.

Vercel's Python runtime discovers files under ``api/`` and serves the module-level ``app`` as an
ASGI application. ``vercel.json`` rewrites every path here, so FastAPI still owns routing.
"""

from app.main import app

__all__ = ["app"]
