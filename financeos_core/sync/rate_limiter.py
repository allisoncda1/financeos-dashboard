"""
financeos_core/sync/rate_limiter.py
-------------------------------------
Token bucket rate limiter for QBO API calls, one limiter per realm.

QBO limits:
    500 requests/minute per realm (standard tier)

Strategy:
    - Process one entity at a time (guaranteed by runner.py)
    - 120ms minimum gap between requests within a realm (~500/min max)
    - On 429: the retry decorator handles backoff — this limiter is proactive

The limiter is realm-scoped so that if the runner ever processes entities
concurrently in the future, each realm is governed independently.
"""

import time
import threading
import logging
from typing import Dict

log = logging.getLogger(__name__)


class TokenBucket:
    """
    Thread-safe token bucket rate limiter.

    Args:
        requests_per_minute: Maximum requests allowed per minute.
        min_gap_ms: Minimum milliseconds between any two requests (floor).
    """

    def __init__(self, requests_per_minute: int = 500, min_gap_ms: int = 120):
        self._rate = requests_per_minute / 60.0          # tokens per second
        self._capacity = requests_per_minute
        self._tokens = float(requests_per_minute)
        self._last_refill = time.monotonic()
        self._last_request = 0.0
        self._min_gap = min_gap_ms / 1000.0
        self._lock = threading.Lock()

    def acquire(self) -> None:
        """
        Block until a token is available. Enforces both the rate limit
        and the minimum gap between requests.
        """
        with self._lock:
            # Enforce minimum gap regardless of token count
            now = time.monotonic()
            since_last = now - self._last_request
            if since_last < self._min_gap:
                time.sleep(self._min_gap - since_last)
                now = time.monotonic()

            # Refill bucket based on elapsed time
            elapsed = now - self._last_refill
            self._tokens = min(self._capacity, self._tokens + elapsed * self._rate)
            self._last_refill = now

            if self._tokens < 1:
                sleep_time = (1.0 - self._tokens) / self._rate
                log.debug(f"[rate_limiter] Bucket empty — sleeping {sleep_time:.3f}s")
                time.sleep(sleep_time)
                self._tokens = 0.0
            else:
                self._tokens -= 1.0

            self._last_request = time.monotonic()


# Global registry of per-realm limiters
_limiters: Dict[str, TokenBucket] = {}
_registry_lock = threading.Lock()


def get_limiter(realm_id: str) -> TokenBucket:
    """
    Return the TokenBucket for a given QBO realm, creating it if necessary.
    All callers for the same realm share the same limiter instance.
    """
    with _registry_lock:
        if realm_id not in _limiters:
            _limiters[realm_id] = TokenBucket(
                requests_per_minute=500,
                min_gap_ms=120,
            )
        return _limiters[realm_id]
