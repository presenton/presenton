"""Ретраи и логирование доставки вебхуков (P7).

aiohttp.ClientSession подменяется фейком: он возвращает заготовленные ответы
или бросает исключение, а sleep перехватывается, чтобы тест не ждал реальные
задержки бэкоффа.
"""

import asyncio
from unittest.mock import AsyncMock, patch

import pytest

from models.sql.webhook_subscription import WebhookSubscription
from services.webhook_service import (
    WEBHOOK_DELIVERY_ATTEMPTS,
    WEBHOOK_RETRY_BACKOFF_SECONDS,
    WebhookService,
)


class _FakeResponse:
    def __init__(self, status: int, body: str = ""):
        self.status = status
        self._body = body

    async def text(self) -> str:
        return self._body

    async def __aenter__(self):
        return self

    async def __aexit__(self, *args):
        return False


class _FakeSession:
    """Фейк aiohttp.ClientSession: ответы по порядку, последний повторяется."""

    statuses: list[int] = []
    posts: list[dict] = []

    def __init__(self, *args, **kwargs):
        pass

    def post(self, url, json=None, headers=None):
        index = min(len(_FakeSession.posts), len(_FakeSession.statuses) - 1)
        status = _FakeSession.statuses[index]
        _FakeSession.posts.append({"url": url, "json": json, "headers": headers})
        return _FakeResponse(status)

    async def __aenter__(self):
        return self

    async def __aexit__(self, *args):
        return False


class _ExplodingSession(_FakeSession):
    exceptions: list[Exception] = []

    def post(self, url, json=None, headers=None):
        index = min(len(_FakeSession.posts), len(_ExplodingSession.exceptions) - 1)
        _FakeSession.posts.append({"url": url, "json": json, "headers": headers})
        raise _ExplodingSession.exceptions[index]


@pytest.fixture(autouse=True)
def _fast_sleep():
    with patch.object(asyncio, "sleep", new=AsyncMock()) as sleep_mock:
        yield sleep_mock


@pytest.fixture(autouse=True)
def _reset_fake():
    _FakeSession.statuses = []
    _FakeSession.posts = []
    _ExplodingSession.exceptions = []
    yield


def _subscription() -> WebhookSubscription:
    return WebhookSubscription(
        id="webhook-x",
        url="https://bot.example/hook",
        secret="test-secret",
        event="presentation.generation.completed",
    )


@pytest.mark.anyio
async def test_successful_first_attempt_sends_json_with_secret():
    _FakeSession.statuses = [200]
    with patch("services.webhook_service.aiohttp.ClientSession", _FakeSession):
        await WebhookService.send_request_to_webhook(_subscription(), {"ok": True})

    assert _FakeSession.posts == [
        {
            "url": "https://bot.example/hook",
            "json": {"ok": True},
            "headers": {"Content-Type": "application/json", "Authorization": "Bearer test-secret"},
        }
    ]


@pytest.mark.anyio
async def test_http_500_is_retried_with_backoff_then_succeeds():
    _FakeSession.statuses = [500, 500, 200]
    with patch("services.webhook_service.aiohttp.ClientSession", _FakeSession):
        await WebhookService.send_request_to_webhook(_subscription(), {})

    assert len(_FakeSession.posts) == 3
    assert WEBHOOK_RETRY_BACKOFF_SECONDS[:2] == (2, 5)


@pytest.mark.anyio
async def test_persistent_5xx_exhausts_all_attempts():
    _FakeSession.statuses = [503]
    with patch("services.webhook_service.aiohttp.ClientSession", _FakeSession):
        await WebhookService.send_request_to_webhook(_subscription(), {})

    assert len(_FakeSession.posts) == WEBHOOK_DELIVERY_ATTEMPTS


@pytest.mark.anyio
async def test_http_429_is_retried():
    _FakeSession.statuses = [429, 200]
    with patch("services.webhook_service.aiohttp.ClientSession", _FakeSession):
        await WebhookService.send_request_to_webhook(_subscription(), {})

    assert len(_FakeSession.posts) == 2


@pytest.mark.anyio
async def test_http_404_is_not_retried():
    _FakeSession.statuses = [404]
    with patch("services.webhook_service.aiohttp.ClientSession", _FakeSession):
        await WebhookService.send_request_to_webhook(_subscription(), {})

    assert len(_FakeSession.posts) == 1


@pytest.mark.anyio
async def test_network_error_is_retried():
    _ExplodingSession.exceptions = [
        TimeoutError("boom"),
        ConnectionError("refused"),
        Exception("x"),
        Exception("y"),
    ]
    with patch("services.webhook_service.aiohttp.ClientSession", _ExplodingSession):
        await WebhookService.send_request_to_webhook(_subscription(), {})

    assert len(_FakeSession.posts) == WEBHOOK_DELIVERY_ATTEMPTS


@pytest.mark.anyio
async def test_failure_is_reported_via_logger(caplog):
    _FakeSession.statuses = [500]
    with patch("services.webhook_service.aiohttp.ClientSession", _FakeSession):
        with caplog.at_level("ERROR", logger="services.webhook_service"):
            await WebhookService.send_request_to_webhook(_subscription(), {})

    assert any("after 4 attempts" in record.message for record in caplog.records)
