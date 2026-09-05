"""Тесты фолбэка битого JSON в structured-вызовах (прод-инцидент 2026-09-05).

llmai при JSONSchemaResponse жёстко парсит финальный контент стрима
(``json.loads`` в ``_final_content``) и роняет JSONDecodeError, завёрнутый в
LLMError с оригиналом в ``cause``. К моменту падения дельты контента уже
прилетели, поэтому движок спасает ответ tolerant-парсером накопленного
текста вместо падения генерации; outline-стрим аналогично сохраняет уже
yield'нутые чанки. Прочие классы ошибок (429/5xx, disconnect) пробрасываются
как раньше.
"""

from __future__ import annotations

import json
from types import SimpleNamespace

import pytest
from llmai.shared.errors import LLMError, LLMRateLimitError

from utils import llm_utils
from utils.llm_calls import generate_presentation_outlines
from utils.llm_utils import _generate_structured_content, _is_json_parse_failure

_JSON = '{"presentation_title": "ИТ в России", "slides": []}'


def _wrapped_parse_error(text: str = "Expecting value: line 1 column 1 (char 0)") -> LLMError:
    """Ошибка так, как её отдаёт llmai: LLMError с JSONDecodeError в cause."""
    return LLMError(500, f"500: {text}", cause=json.JSONDecodeError("Expecting value", "", 0))


def _stream_events(chunks: list[str], error: Exception | None = None):
    async def stream(_client=None, **_kwargs):
        for chunk in chunks:
            yield SimpleNamespace(type="content", chunk=chunk)
        if error is not None:
            raise error

    return stream


# ---------------------------------------------------------------------------
# Классификация parse-флейма с учётом обёртки llmai
# ---------------------------------------------------------------------------


def test_wrapped_json_decode_error_is_parse_failure() -> None:
    # isinstance-проверка на обёртке не работает — матчится cause-цепочка
    assert _is_json_parse_failure(_wrapped_parse_error())


def test_raw_json_decode_error_is_parse_failure() -> None:
    assert _is_json_parse_failure(json.JSONDecodeError("Expecting value", "", 0))


def test_all_json_decode_error_phrases_match() -> None:
    phrases = [
        "Unterminated string starting at: line 1 column 500 (char 499)",
        "Expecting ',' delimiter: line 1 column 42 (char 41)",
        "Expecting property name enclosed in double quotes: line 2 column 3",
        "Extra data: line 1 column 30 (char 29)",
        "Invalid control character at: line 1 column 12 (char 11)",
        "Invalid \\escape: line 1 column 8 (char 7)",
    ]
    for phrase in phrases:
        assert _is_json_parse_failure(LLMError(500, f"500: {phrase}")), phrase


def test_non_parse_errors_are_not_flagged() -> None:
    assert not _is_json_parse_failure(LLMRateLimitError(429, "rate limit exceeded"))
    assert not _is_json_parse_failure(LLMError(503, "Could not connect to the provider."))
    assert not _is_json_parse_failure(ValueError("something else entirely"))


# ---------------------------------------------------------------------------
# Tolerant-фолбэк в _generate_structured_content
# ---------------------------------------------------------------------------


@pytest.mark.anyio
async def test_stream_parse_failure_falls_back_to_streamed_json(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Дельты с валидным JSON + llmai упал на финальном json.loads — ответ спасён."""
    chunks = ['{"presentation_title": ', '"ИТ в России"}']
    monkeypatch.setattr(
        llm_utils, "stream_generate_events", _stream_events(chunks, _wrapped_parse_error())
    )

    content = await _generate_structured_content(client=object(), disconnect_checker=None)
    assert content == {"presentation_title": "ИТ в России"}


@pytest.mark.anyio
async def test_stream_parse_failure_falls_back_to_tolerant_parse(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Prose и markdown-ограждения вокруг JSON вытаскиваются tolerant-парсером."""
    chunks = ["Вот ответ:\n```json\n", _JSON, "\n```\nГотово."]
    monkeypatch.setattr(
        llm_utils, "stream_generate_events", _stream_events(chunks, _wrapped_parse_error())
    )

    content = await _generate_structured_content(client=object(), disconnect_checker=None)
    assert content == json.loads(_JSON)


@pytest.mark.anyio
async def test_stream_parse_failure_with_garbage_returns_none(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Мусор без JSON — None: дальше работают штатные empty-attempts/ретраи."""
    chunks = ["какая-то болтовня без структуры", "и без json"]
    monkeypatch.setattr(
        llm_utils, "stream_generate_events", _stream_events(chunks, _wrapped_parse_error())
    )

    content = await _generate_structured_content(client=object(), disconnect_checker=None)
    assert content is None


@pytest.mark.anyio
async def test_stream_rate_limit_error_is_not_swallowed(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """429-класс пробрасывается: фолбэк только для parse-ошибок."""
    chunks = ['{"title": "начало"']
    monkeypatch.setattr(
        llm_utils,
        "stream_generate_events",
        _stream_events(chunks, LLMRateLimitError(429, "rate limit exceeded")),
    )

    with pytest.raises(LLMRateLimitError):
        await _generate_structured_content(client=object(), disconnect_checker=None)


# ---------------------------------------------------------------------------
# Outline-стрим: сохраняем уже yield'нутые чанки
# ---------------------------------------------------------------------------


def _patch_outline_llm(
    monkeypatch: pytest.MonkeyPatch, chunks: list[str], error: Exception | None
) -> list:
    collected: list = []
    monkeypatch.setattr(generate_presentation_outlines, "get_model", lambda: "test-model")
    monkeypatch.setattr(generate_presentation_outlines, "get_client", lambda config=None: object())
    monkeypatch.setattr(generate_presentation_outlines, "get_llm_config", lambda **_kwargs: None)
    monkeypatch.setattr(
        generate_presentation_outlines, "get_web_search_route", lambda: ("none", None)
    )
    monkeypatch.setattr(
        generate_presentation_outlines, "get_generate_kwargs", lambda **kwargs: dict(kwargs)
    )
    monkeypatch.setattr(
        generate_presentation_outlines, "stream_generate_events", _stream_events(chunks, error)
    )
    return collected


async def _collect_outline(**kwargs) -> list:
    collected = []
    async for chunk in generate_presentation_outlines.generate_ppt_outline(
        "ИТ в России", 3, "ru", **kwargs
    ):
        collected.append(chunk)
    return collected


@pytest.mark.anyio
async def test_outline_parse_failure_keeps_streamed_chunks(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Упавший финал не превращает outline в HTTPException: чанки уже отданы."""
    _patch_outline_llm(
        monkeypatch,
        ['{"presentation_title": ', '"ИТ в России", "slides": []}'],
        _wrapped_parse_error(),
    )

    chunks = await _collect_outline()
    assert chunks == ['{"presentation_title": ', '"ИТ в России", "slides": []}']


@pytest.mark.anyio
async def test_outline_parse_failure_without_chunks_yields_nothing(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Пустой стрим с parse-ошибкой — пустой текст: коллектор уйдёт в transient-ретрай."""
    _patch_outline_llm(monkeypatch, [], _wrapped_parse_error())

    chunks = await _collect_outline()
    assert chunks == []


@pytest.mark.anyio
async def test_outline_upstream_error_still_yields_http_exception(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Не-parse-ошибки идут в общий обработчик (HTTPException), как раньше."""
    from fastapi import HTTPException

    _patch_outline_llm(monkeypatch, [], LLMRateLimitError(429, "rate limit exceeded"))

    chunks = await _collect_outline()
    assert len(chunks) == 1
    assert isinstance(chunks[0], HTTPException)
