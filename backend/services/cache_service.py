"""
Cache Service — TTL cache with a pluggable backend.

  • Default: in-memory TTLCache (per-pod). Perfect for single-instance/preview.
  • If REDIS_URL is set: a shared Redis backend so all replicas read/write and
    invalidate the same cache. Falls back to in-memory automatically if Redis is
    unreachable, so the app never hard-fails on a cache hiccup.

The public API (get/set/delete/clear_namespace/clear_all/cached) is identical for
both backends, so no call site changes when you attach Redis in production.
"""

import os
import logging
import hashlib
import json
from typing import Any, Optional
from cachetools import TTLCache
from functools import wraps

logger = logging.getLogger(__name__)

# Per-namespace TTL (seconds) + max in-memory size.
NAMESPACE_TTL = {
    "plans": 300,
    "pricing": 300,
    "stats": 60,
    "user": 120,
    "crypto": 60,
    "health": 30,
    "default": 120,
}
NAMESPACE_MAXSIZE = {
    "plans": 32, "pricing": 32, "stats": 128, "user": 512,
    "crypto": 64, "health": 8, "default": 256,
}


class CacheService:
    """TTL cache; uses Redis when REDIS_URL is configured, else in-memory."""

    def __init__(self):
        self._caches = {
            ns: TTLCache(maxsize=NAMESPACE_MAXSIZE.get(ns, 256), ttl=ttl)
            for ns, ttl in NAMESPACE_TTL.items()
        }
        self._hit_count = 0
        self._miss_count = 0
        self._redis = None
        self.backend = "memory"
        self._init_redis()

    def _init_redis(self):
        url = os.environ.get("REDIS_URL")
        if not url:
            return
        try:
            import redis
            client = redis.Redis.from_url(
                url, decode_responses=True,
                socket_timeout=0.5, socket_connect_timeout=0.5,
            )
            client.ping()
            self._redis = client
            self.backend = "redis"
            logger.info("[cache] using shared Redis backend")
        except Exception as e:
            logger.warning("[cache] REDIS_URL set but unreachable, using in-memory: %s", e)
            self._redis = None
            self.backend = "memory"

    def _get_cache(self, namespace: str) -> TTLCache:
        return self._caches.get(namespace, self._caches["default"])

    def _ttl(self, namespace: str) -> int:
        return NAMESPACE_TTL.get(namespace, NAMESPACE_TTL["default"])

    @staticmethod
    def _rkey(namespace: str, key: str) -> str:
        return f"nc:{namespace}:{key}"

    @staticmethod
    def _make_key(*args, **kwargs) -> str:
        """Deterministic cache key from arguments (SHA-256, no security purpose)."""
        raw = json.dumps({"a": args, "k": kwargs}, sort_keys=True, default=str)
        return hashlib.sha256(raw.encode()).hexdigest()

    def get(self, namespace: str, key: str) -> Optional[Any]:
        if self._redis is not None:
            try:
                raw = self._redis.get(self._rkey(namespace, key))
                if raw is not None:
                    self._hit_count += 1
                    return json.loads(raw)
                self._miss_count += 1
                return None
            except Exception as e:
                logger.warning("[cache] redis get failed, falling back: %s", e)
        cache = self._get_cache(namespace)
        val = cache.get(key)
        if val is not None:
            self._hit_count += 1
            return val
        self._miss_count += 1
        return None

    def set(self, namespace: str, key: str, value: Any):
        if self._redis is not None:
            try:
                self._redis.set(self._rkey(namespace, key), json.dumps(value, default=str), ex=self._ttl(namespace))
                return
            except Exception as e:
                logger.warning("[cache] redis set failed, falling back: %s", e)
        self._get_cache(namespace)[key] = value

    def delete(self, namespace: str, key: str):
        if self._redis is not None:
            try:
                self._redis.delete(self._rkey(namespace, key))
                return
            except Exception as e:
                logger.warning("[cache] redis delete failed: %s", e)
        self._get_cache(namespace).pop(key, None)

    def clear_namespace(self, namespace: str):
        if self._redis is not None:
            try:
                for k in self._redis.scan_iter(match=f"nc:{namespace}:*", count=500):
                    self._redis.delete(k)
                return
            except Exception as e:
                logger.warning("[cache] redis clear_namespace failed: %s", e)
        self._get_cache(namespace).clear()

    def clear_all(self):
        if self._redis is not None:
            try:
                for k in self._redis.scan_iter(match="nc:*", count=500):
                    self._redis.delete(k)
                return
            except Exception as e:
                logger.warning("[cache] redis clear_all failed: %s", e)
        for cache in self._caches.values():
            cache.clear()

    def stats(self) -> dict:
        total = self._hit_count + self._miss_count
        out = {
            "backend": self.backend,
            "hit_count": self._hit_count,
            "miss_count": self._miss_count,
            "hit_rate": f"{(self._hit_count / total * 100):.1f}%" if total else "0%",
        }
        if self._redis is None:
            out["namespaces"] = {
                ns: {"size": len(c), "maxsize": c.maxsize, "ttl": c.ttl}
                for ns, c in self._caches.items()
            }
        return out


# Singleton
cache_service = CacheService()


def cached(namespace: str = "default", key_prefix: str = ""):
    """Decorator to cache async function results."""
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
