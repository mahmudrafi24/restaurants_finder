"""Aggregates the v1 routes into a single router.

New resources are mounted here. The ``/api/v1`` prefix is applied by the application factory, so
adding a v2 later means a sibling package rather than a rewrite.
"""

from __future__ import annotations

from fastapi import APIRouter

from app.api.v1.routes import cities, health, places

router = APIRouter()
router.include_router(health.router)
router.include_router(cities.router)
router.include_router(places.router)
