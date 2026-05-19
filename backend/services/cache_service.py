"""
Cache Service - TTL-based in-memory caching layer
Drop-in replacement pattern: swap to Redis by changing the backend implementation
"""

import logging
import hashlib
import json
from typing import Any, Optional
from datetime import datetime, timezone
from cachetools import TTLCache
from functools import wraps

logger = logging.getLogger(__name__)


class CacheService:
    """In-memory TTL cache with namespace support.
    Designed as a drop-in replacement — swap to Redis by changing only this class."""

    def __init__(self):
        # Separate caches per domain for independent TTLs and sizing
        self._caches = {
            "plans": TTLCache(maxsize=32, ttl=300),       # 5 min for subscription plans
            "pricing": TTLCache(maxsize=32, ttl=300),      # 5 min for pricing
            "stats": TTLCache(maxsize=128, ttl=60),        # 1 min for dashboard stats
            "user": TTLCache(maxsize=512, ttl=120),        # 2 min for user lookups
            "crypto": TTLCache(maxsize=64, ttl=60),        # 1 min for crypto prices
            "health": TTLCache(maxsize=8, ttl=30),         # 30s for health checks
            "default": TTLCache(maxsize=256, ttl=120),     # 2 min default
        }
        self._hit_count = 0
        self._miss_count = 0

    def _get_cache(self, namespace: str) -> TTLCache:
        return self._caches.get(namespace, self._caches["default"])

    @staticmethod
    def _make_key(*args, **kwargs) -> str:
        """Build a deterministic cache key from arguments.

        SHA-256 is overkill for cache keying (no security threat model here) but
        we use it instead of MD5 to keep static analyzers happy and avoid any
        cryptographic-weakness flags. Performance cost is negligible at this
        call volume.
        """
        raw = json.dumps({"a": args, "k": kwargs}, sort_keys=True, default=str)
        return hashlib.sha256(raw.encode()).hexdigest()

    def get(self, namespace: str, key: str) -> Optional[Any]:
        cache = self._get_cache(namespace)
        val = cache.get(key)
        if val is not None:
            self._hit_count += 1
            return val
        self._miss_count += 1
        return None

    def set(self, namespace: str, key: str, value: Any):
        cache = self._get_cache(namespace)
        cache[key] = value

    def delete(self, namespace: str, key: str):
        cache = self._get_cache(namespace)
        cache.pop(key, None)

    def clear_namespace(self, namespace: str):
        cache = self._get_cache(namespace)
        cache.clear()

    def clear_all(self):
        for cache in self._caches.values():
            cache.clear()

    def stats(self) -> dict:
        total = self._hit_count + self._miss_count
        return {
            "hit_count": self._hit_count,
            "miss_count": self._miss_count,
            "hit_rate": f"{(self._hit_count / total * 100):.1f}%" if total else "0%",
            "namespaces": {
                ns: {"size": len(c), "maxsize": c.maxsize, "ttl": c.ttl}
                for ns, c in self._caches.items()
            },
        }


# Singleton
cache_service = CacheService()


def cached(namespace: str = "default", key_prefix: str = ""):
    """Decorator to cache async function results.

    Usage:
        @cached(namespace="plans", key_prefix="all")
        async def get_plans():
            ...
    """
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            key = f"{key_prefix}:{cache_service._make_key(*args[1:], **kwargs)}" if args else f"{key_prefix}:{cache_service._make_key(**kwargs)}"
            result = cache_service.get(namespace, key)
            if result is not None:
                return result
            result = await func(*args, **kwargs)
            if result is not None:
                cache_service.set(namespace, key, result)
            return result
        wrapper._cache_namespace = namespace
        wrapper._cache_key_prefix = key_prefix
        return wrapper
    return decorator
