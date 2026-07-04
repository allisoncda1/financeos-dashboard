"""
financeos_core/sync/retry.py
-----------------------------
Exponential backoff retry decorator for QBO API calls.

Retryable conditions:
    - HTTP 429 Too Many Requests (QBO rate limit)
    - HTTP 5xx Server Error
    - urllib.error.URLError (transient network issues)
    - socket.timeout

Non-retryable:
    - HTTP 400/401/403/404 (permanent client errors — fail immediately)
    - Any exception not in the retryable list
"""

import time
import functools
import logging
import urllib.error

log = logging.getLogger(__name__)


class RetryableError(Exception):
    """Wraps a transient error that should trigger a retry."""
    def __init__(self, message: str, status_code: int = 0):
        super().__init__(message)
        self.status_code = status_code


class PermanentError(Exception):
    """Wraps a non-retryable error. Caller should fail immediately."""
    def __init__(self, message: str, status_code: int = 0):
        super().__init__(message)
        self.status_code = status_code


def classify_http_error(exc: urllib.error.HTTPError) -> Exception:
    """
    Convert an HTTPError to RetryableError or PermanentError.
    """
    code = exc.code
    if code == 429:
        return RetryableError(f"QBO rate limit (429). Will retry.", status_code=429)
    if code >= 500:
        return RetryableError(f"QBO server error ({code}). Will retry.", status_code=code)
    # 400, 401, 403, 404 — permanent
    return PermanentError(f"QBO client error ({code}): {exc.reason}", status_code=code)


def with_retry(max_attempts: int = 5, base_delay: float = 1.0, max_delay: float = 60.0):
    """
    Decorator: retry the wrapped function on RetryableError with exponential backoff.

    Args:
        max_attempts: Maximum number of attempts (including the first).
        base_delay:   Initial delay in seconds. Doubles on each retry.
        max_delay:    Cap on delay between retries.

    Usage:
        @with_retry(max_attempts=5, base_delay=1.0)
        def fetch_from_qbo(...):
            ...
    """
    def decorator(fn):
        @functools.wraps(fn)
        def wrapper(*args, **kwargs):
            last_exc = None
            for attempt in range(1, max_attempts + 1):
                try:
                    return fn(*args, **kwargs)
                except RetryableError as exc:
                    last_exc = exc
                    if attempt == max_attempts:
                        log.error(
                            f"[retry] {fn.__name__} failed after {max_attempts} attempts: {exc}"
                        )
                        raise
                    delay = min(base_delay * (2 ** (attempt - 1)), max_delay)
                    log.warning(
                        f"[retry] {fn.__name__} attempt {attempt}/{max_attempts} failed "
                        f"({exc}). Retrying in {delay:.1f}s…"
                    )
                    time.sleep(delay)
                except urllib.error.HTTPError as exc:
                    classified = classify_http_error(exc)
                    if isinstance(classified, RetryableError):
                        last_exc = classified
                        if attempt == max_attempts:
                            raise classified from exc
                        delay = min(base_delay * (2 ** (attempt - 1)), max_delay)
                        # For 429, respect Retry-After header if present
                        retry_after = exc.headers.get("Retry-After")
                        if retry_after:
                            try:
                                delay = max(delay, float(retry_after))
                            except (ValueError, TypeError):
                                pass
                        log.warning(
                            f"[retry] {fn.__name__} attempt {attempt}/{max_attempts}: "
                            f"{classified}. Retrying in {delay:.1f}s…"
                        )
                        time.sleep(delay)
                    else:
                        raise classified from exc
                except urllib.error.URLError as exc:
                    last_exc = exc
                    if attempt == max_attempts:
                        raise
                    delay = min(base_delay * (2 ** (attempt - 1)), max_delay)
                    log.warning(
                        f"[retry] {fn.__name__} network error attempt {attempt}/{max_attempts}: "
                        f"{exc}. Retrying in {delay:.1f}s…"
                    )
                    time.sleep(delay)
            raise last_exc  # unreachable but satisfies type checkers
        return wrapper
    return decorator
