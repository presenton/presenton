import asyncio
import math
import time
from collections import deque


class LoginRateLimiter:
    """Small in-process limiter; nginx provides the outer per-IP boundary."""

    def __init__(self, max_failures: int = 5, window_seconds: int = 300) -> None:
        self.max_failures = max_failures
        self.window_seconds = window_seconds
        self._failures: dict[str, deque[float]] = {}
        self._lock = asyncio.Lock()

    async def retry_after(self, key: str) -> int | None:
        async with self._lock:
            failures = self._active_failures(key)
            if len(failures) < self.max_failures:
                return None
            return max(1, math.ceil(self.window_seconds - (time.monotonic() - failures[0])))

    async def record_failure(self, key: str) -> None:
        async with self._lock:
            failures = self._active_failures(key)
            failures.append(time.monotonic())
            self._failures[key] = failures
            self._prune_empty_entries()

    async def clear(self, key: str) -> None:
        async with self._lock:
            self._failures.pop(key, None)

    def _active_failures(self, key: str) -> deque[float]:
        now = time.monotonic()
        failures = self._failures.get(key, deque())
        while failures and now - failures[0] >= self.window_seconds:
            failures.popleft()
        if failures:
            self._failures[key] = failures
        else:
            self._failures.pop(key, None)
        return failures

    def _prune_empty_entries(self) -> None:
        if len(self._failures) < 10_000:
            return
        for key in list(self._failures):
            self._active_failures(key)


LOGIN_RATE_LIMITER = LoginRateLimiter()


def login_rate_limit_key(client_host: str | None, username: str) -> str:
    return f"{client_host or 'unknown'}:{username.strip().casefold()}"
