"""A tiny in-process TTL cache.

Used for geocoding results, which are effectively static and whose upstream (Nominatim) caps
callers at roughly one request per second. Caching is therefore a policy requirement, not an
optimisation.

Deliberately in-process: it needs no external service, and a cold serverless instance simply
starts empty. If the deployment ever needs a cache shared across instances, replace the
internals here with Redis — :class:`TTLCache` is the only thing callers depend on.
"""

from __future__ import annotations

import asyncio
import time
from collections import OrderedDict
from typing import Generic, TypeVar

T = TypeVar("T")


class TTLCache(Generic[T]):
    """Async-safe mapping whose entries expire, with least-recently-used eviction.

    Args:
        ttl_seconds: Lifetime of an entry. Non-positive disables caching entirely.
        max_entries: Hard cap on stored entries; the least recently used is evicted first.
    """

    def __init__(self, *, ttl_seconds: int, max_entries: int) -> None:
        self._ttl = ttl_seconds
        self._max_entries = max(1, max_entries)
        self._entries: OrderedDict[str, tuple[float, T]] = OrderedDict()
        self._lock = asyncio.Lock()

    async def get(self, key: str) -> T | None:
        """Return the cached value, or ``None`` if absent or expired."""
        if self._ttl <= 0:
            return None
        async with self._lock:
            entry = self._entries.get(key)
            if entry is None:
                return None
            expires_at, value = entry
            if expires_at <= time.monotonic():
                del self._entries[key]
                return None
            self._entries.move_to_end(key)
            return value

    async def set(self, key: str, value: T) -> None:
        """Store a value, evicting the least recently used entry if the cache is full."""
        if self._ttl <= 0:
            return
        async with self._lock:
            self._entries[key] = (time.monotonic() + self._ttl, value)
            self._entries.move_to_end(key)
            while len(self._entries) > self._max_entries:
                self._entries.popitem(last=False)

    async def clear(self) -> None:
        async with self._lock:
            self._entries.clear()

    def __len__(self) -> int:
        return len(self._entries)
