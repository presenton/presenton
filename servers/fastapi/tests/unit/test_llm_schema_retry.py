"""Тесты ретрая upstream schema-нарушений в structured-генерации.

Класс ошибки из прода: апстрим-провайдер (Sail Research) отбивает запрос
«response_format violated: model output did not match response JSON Schema …».
Модель недетерминирована — повторная попытка обычно проходит, поэтому такой
класс ретраится, прочие ошибки идут наверх сразу.
"""

from __future__ import annotations

import asyncio
import json

import pytest
from fastapi import HTTPException

from utils import llm_utils
from utils.llm_utils import (
    _is_transient_parse_error,
    _is_upstream_rate_or_server_error,
    _is_upstream_schema_violation,
    generate_structured_with_schema_retries,
)

SAIL_VIOLATION = (
    "Upstream error from Sail Research: response_format violated: "
    'model output did not match response JSON Schema at : "right_text_stack" '
    "is a required property"
)


class FakeLLMError(Exception):
    def __init__(self, message: str) -> None:
        self.message = message
        super().__init__(message)


class FakeUpstreamStatusError(Exception):
    """Ошибка провайдера с HTTP-статусом (как у openai/anthropic SDK)."""

    def __init__(self, status_code: int, message: str = "upstream error") -> None:
        self.status_code = status_code
        super().__init__(message)


def _messages() -> list:
    return []


@pytest.fixture(autouse=True)
def _fast_sleep(monkeypatch: pytest.MonkeyPatch):
    async def instant(_seconds: float) -> None:
        return None

    monkeypatch.setattr(llm_utils.asyncio, "sleep", instant)
    # get_generate_kwargs требует настроенного LLM-провайдера — в тестах не нужен
    monkeypatch.setattr(llm_utils, "get_generate_kwargs", lambda **kwargs: dict(kwargs))


def test_classifies_upstream_schema_violation() -> None:
    assert _is_upstream_schema_violation(FakeLLMError(SAIL_VIOLATION))
    assert _is_upstream_schema_violation(
        FakeLLMError("model output did not match response JSON Schema at : x")
    )
    assert not _is_upstream_schema_violation(FakeLLMError("connection reset by peer"))
    assert not _is_upstream_schema_violation(HTTPException(status_code=400, detail="bad input"))


@pytest.mark.anyio
async def test_retries_upstream_schema_violation(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Первый вызов — апстрим-нарушение, второй — контент: итог успешный."""
    calls: list[int] = []

    async def fake_generate(_client=None, **_kwargs):
        calls.append(1)
        if len(calls) == 1:
            raise FakeLLMError(SAIL_VIOLATION)
        return {"title": "ok"}

    monkeypatch.setattr(llm_utils, "_generate_structured_content", fake_generate)

    result = await generate_structured_with_schema_retries(
        client=object(),
        model="test-model",
        messages=_messages(),
        response_format={"type": "json_schema"},
        json_schema={"type": "object"},
    )
    assert result == {"title": "ok"}
    assert len(calls) == 2


@pytest.mark.anyio
async def test_upstream_violation_retries_are_capped(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Постоянный апстрим-бросок — после лимита ошибка идёт наверх."""
    calls: list[int] = []

    async def fake_generate(_client=None, **_kwargs):
        calls.append(1)
        raise FakeLLMError(SAIL_VIOLATION)

    monkeypatch.setattr(llm_utils, "_generate_structured_content", fake_generate)

    with pytest.raises(FakeLLMError):
        await generate_structured_with_schema_retries(
            client=object(),
            model="test-model",
            messages=_messages(),
            response_format={"type": "json_schema"},
            json_schema={"type": "object"},
        )
    # 1 первая попытка + 2 ретрая
    assert len(calls) == 3


@pytest.mark.anyio
async def test_other_errors_do_not_retry(monkeypatch: pytest.MonkeyPatch) -> None:
    """Нерелевантная ошибка (сеть/контракт) ретраится пустым контентом —
    прежний механизм, схема-нарушение тут ни при чём; апстрим-нарушение
    с чужим текстом наверх сразу."""
    calls: list[int] = []

    async def fake_generate(_client=None, **_kwargs):
        calls.append(1)
        raise FakeLLMError("connection reset by peer")

    monkeypatch.setattr(llm_utils, "_generate_structured_content", fake_generate)

    with pytest.raises(FakeLLMError):
        await generate_structured_with_schema_retries(
            client=object(),
            model="test-model",
            messages=_messages(),
            response_format={"type": "json_schema"},
            json_schema={"type": "object"},
        )
    assert len(calls) == 1


@pytest.mark.anyio
async def test_empty_content_still_retries_three_times(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Пустой контент (не исключение) — прежний механизм: 3 попытки → 400."""
    calls: list[int] = []

    async def fake_generate(_client=None, **_kwargs):
        calls.append(1)
        return None

    monkeypatch.setattr(llm_utils, "_generate_structured_content", fake_generate)

    with pytest.raises(HTTPException) as exc_info:
        await generate_structured_with_schema_retries(
            client=object(),
            model="test-model",
            messages=_messages(),
            response_format={"type": "json_schema"},
            json_schema={"type": "object"},
        )
    assert exc_info.value.status_code == 400
    assert len(calls) == 3
    assert asyncio is not None  # sleep уже подменён фикстурой


# ---------------------------------------------------------------------------
# 429/5xx от провайдера: отдельный класс ретраев с экспоненциальными паузами
# ---------------------------------------------------------------------------


def test_classifies_upstream_rate_or_server_error() -> None:
    assert _is_upstream_rate_or_server_error(FakeUpstreamStatusError(429))
    assert _is_upstream_rate_or_server_error(FakeUpstreamStatusError(500))
    assert _is_upstream_rate_or_server_error(FakeUpstreamStatusError(503))
    assert _is_upstream_rate_or_server_error(FakeLLMError("Rate limit reached for requests"))
    assert _is_upstream_rate_or_server_error(FakeLLMError("Too many requests, slow down"))
    assert not _is_upstream_rate_or_server_error(FakeUpstreamStatusError(400))
    assert not _is_upstream_rate_or_server_error(FakeUpstreamStatusError(401))
    # локальные HTTP-ошибки движка апстримом не считаются
    assert not _is_upstream_rate_or_server_error(
        HTTPException(status_code=429, detail="quota exhausted")
    )
    assert not _is_upstream_rate_or_server_error(FakeLLMError("connection reset by peer"))


@pytest.mark.anyio
async def test_retries_rate_limit_error(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """429 → пауза → повторный вызов возвращает контент."""
    calls: list[int] = []

    async def fake_generate(_client=None, **_kwargs):
        calls.append(1)
        if len(calls) == 1:
            raise FakeUpstreamStatusError(429, "rate limit exceeded")
        return {"title": "ok"}

    monkeypatch.setattr(llm_utils, "_generate_structured_content", fake_generate)

    result = await generate_structured_with_schema_retries(
        client=object(),
        model="test-model",
        messages=_messages(),
        response_format={"type": "json_schema"},
        json_schema={"type": "object"},
    )
    assert result == {"title": "ok"}
    assert len(calls) == 2


@pytest.mark.anyio
async def test_rate_limit_retries_are_capped(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Постоянный 429 — после лимита ретраев ошибка идёт наверх."""
    calls: list[int] = []

    async def fake_generate(_client=None, **_kwargs):
        calls.append(1)
        raise FakeUpstreamStatusError(500, "internal server error")

    monkeypatch.setattr(llm_utils, "_generate_structured_content", fake_generate)

    with pytest.raises(FakeUpstreamStatusError):
        await generate_structured_with_schema_retries(
            client=object(),
            model="test-model",
            messages=_messages(),
            response_format={"type": "json_schema"},
            json_schema={"type": "object"},
        )
    # 1 первая попытка + 3 ретрая
    assert len(calls) == 4


@pytest.mark.anyio
async def test_schema_violation_and_rate_limit_retry_independently(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Счётчики ретраев независимы: 429 не съедает бюджет schema-ретраев."""
    calls: list[str] = []

    async def fake_generate(_client=None, **_kwargs):
        if len(calls) == 0:
            calls.append("rate")
            raise FakeUpstreamStatusError(429, "rate limit exceeded")
        if len(calls) == 1:
            calls.append("schema")
            raise FakeLLMError(SAIL_VIOLATION)
        calls.append("ok")
        return {"title": "ok"}

    monkeypatch.setattr(llm_utils, "_generate_structured_content", fake_generate)

    result = await generate_structured_with_schema_retries(
        client=object(),
        model="test-model",
        messages=_messages(),
        response_format={"type": "json_schema"},
        json_schema={"type": "object"},
    )
    assert result == {"title": "ok"}
    assert calls == ["rate", "schema", "ok"]


# ---------------------------------------------------------------------------
# Пустой/битый JSON от модели: transient parse-ошибки ретраятся отдельно
# (прод-кейс 2026-09-05: «Expecting value: line 1 column 1 (char 0)»)
# ---------------------------------------------------------------------------


def test_classifies_transient_parse_error() -> None:
    assert _is_transient_parse_error(json.JSONDecodeError("Expecting value", "", 0))
    # обёрнутые варианты с тем же текстом (в т.ч. прод-кейс HTTPException)
    assert _is_transient_parse_error(FakeLLMError("Expecting value: line 1 column 1 (char 0)"))
    assert _is_transient_parse_error(
        HTTPException(status_code=500, detail="Expecting value: line 1 column 1 (char 0)")
    )
    assert _is_transient_parse_error(FakeLLMError("Invalid JSON in model response"))
    assert not _is_transient_parse_error(FakeLLMError("connection reset by peer"))
    assert not _is_transient_parse_error(HTTPException(status_code=400, detail="bad input"))


@pytest.mark.anyio
async def test_retries_transient_parse_error(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Пустой JSON → пауза → повторный вызов возвращает контент."""
    calls: list[int] = []

    async def fake_generate(_client=None, **_kwargs):
        calls.append(1)
        if len(calls) == 1:
            raise json.JSONDecodeError("Expecting value", "", 0)
        return {"title": "ok"}

    monkeypatch.setattr(llm_utils, "_generate_structured_content", fake_generate)

    result = await generate_structured_with_schema_retries(
        client=object(),
        model="test-model",
        messages=_messages(),
        response_format={"type": "json_schema"},
        json_schema={"type": "object"},
    )
    assert result == {"title": "ok"}
    assert len(calls) == 2


@pytest.mark.anyio
async def test_transient_parse_retries_are_capped(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Постоянно пустой JSON — после лимита ретраев ошибка идёт наверх."""
    calls: list[int] = []

    async def fake_generate(_client=None, **_kwargs):
        calls.append(1)
        raise json.JSONDecodeError("Expecting value", "", 0)

    monkeypatch.setattr(llm_utils, "_generate_structured_content", fake_generate)

    with pytest.raises(json.JSONDecodeError):
        await generate_structured_with_schema_retries(
            client=object(),
            model="test-model",
            messages=_messages(),
            response_format={"type": "json_schema"},
            json_schema={"type": "object"},
        )
    # 1 первая попытка + 2 ретрая
    assert len(calls) == 3
