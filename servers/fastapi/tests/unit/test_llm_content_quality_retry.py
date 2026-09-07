"""Тесты контент-QC в structured-генерации и слайд-ретрая.

Провал контент-QC после всех schema-починок не должен возвращать последний
невалидный ответ (источник мусорных слайдов, прод-кейс 2026-09-05):
вызовы с ``content_validator`` получают SlideContentQualityError, вызывающий
код (presentation.py) перегенерирует слайд и только затем отдаёт ошибку.
Вызовы без валидатора (outline/structure/edit) сохраняют прежний фолбэк.
"""

from __future__ import annotations

import pytest
from fastapi import HTTPException

from api.v1.ppt.endpoints.presentation import (
    generate_slide_content_with_quality_retry,
)
from utils import llm_utils
from utils.content_quality import get_content_quality_errors
from utils.llm_utils import (
    SlideContentQualityError,
    generate_structured_with_schema_retries,
)

SCHEMA = {
    "type": "object",
    "properties": {
        "title": {"type": "string", "maxLength": 60},
        "minLength": {"type": "string"},
    },
}

# Валидный по схеме, но мусорный по содержанию ответ (прод-кейс: schema-эхо
# в заголовке). ``minLength`` — имя поля из схемы, структурой проходит.
GARBAGE_CONTENT = {"title": "__tablecard", "minLength": "type object"}

CLEAN_CONTENT = {"title": "Импортозамещение ПО", "minLength": "Строка контента"}


def _content_validator(content: dict) -> list[str]:
    return get_content_quality_errors(SCHEMA, content)


def _messages() -> list:
    return []


@pytest.fixture(autouse=True)
def _fast_sleep(monkeypatch: pytest.MonkeyPatch):
    async def instant(_seconds: float) -> None:
        return None

    monkeypatch.setattr(llm_utils.asyncio, "sleep", instant)
    monkeypatch.setattr(llm_utils, "get_generate_kwargs", lambda **kwargs: dict(kwargs))


@pytest.mark.anyio
async def test_garbage_content_raises_instead_of_returning(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Мусор, валидный по схеме, после всех попыток роняет вызов, а не сохраняется."""

    async def fake_generate(_client=None, **_kwargs):
        return dict(GARBAGE_CONTENT)

    monkeypatch.setattr(llm_utils, "_generate_structured_content", fake_generate)

    with pytest.raises(SlideContentQualityError) as exc_info:
        await generate_structured_with_schema_retries(
            client=object(),
            model="test-model",
            messages=_messages(),
            response_format={"type": "json_schema"},
            json_schema=SCHEMA,
            validate_schema=True,
            content_validator=_content_validator,
        )
    assert exc_info.value.status_code == 502
    assert "response-schema field names" in str(exc_info.value.detail)


@pytest.mark.anyio
async def test_content_feedback_mentions_quality_issues(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """В фидбек для модели попадает контентный раздел, а не только schema-ошибки."""
    seen_messages: list[list] = []

    async def fake_generate(_client=None, **kwargs):
        seen_messages.append(kwargs["messages"])
        return dict(GARBAGE_CONTENT)

    monkeypatch.setattr(llm_utils, "_generate_structured_content", fake_generate)

    with pytest.raises(SlideContentQualityError):
        await generate_structured_with_schema_retries(
            client=object(),
            model="test-model",
            messages=_messages(),
            response_format={"type": "json_schema"},
            json_schema=SCHEMA,
            validate_schema=True,
            content_validator=_content_validator,
        )
    # Попыток несколько; во всех, кроме первой, фидбек с контентным разделом
    assert len(seen_messages) > 1
    feedback = seen_messages[-1][-1].content
    assert "Content quality issues" in feedback
    assert "response-schema field names" in feedback


@pytest.mark.anyio
async def test_clean_content_passes_with_validator(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Чистый контент с валидатором возвращается без лишних попыток."""
    calls: list[int] = []

    async def fake_generate(_client=None, **_kwargs):
        calls.append(1)
        return dict(CLEAN_CONTENT)

    monkeypatch.setattr(llm_utils, "_generate_structured_content", fake_generate)

    result = await generate_structured_with_schema_retries(
        client=object(),
        model="test-model",
        messages=_messages(),
        response_format={"type": "json_schema"},
        json_schema=SCHEMA,
        validate_schema=True,
        content_validator=_content_validator,
    )
    assert result == CLEAN_CONTENT
    assert len(calls) == 1


@pytest.mark.anyio
async def test_without_validator_legacy_fallback_kept(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Без валидатора (outline/structure) прежний фолбэк сохранён: последний
    невалидный ответ возвращается с warning'ом."""

    async def fake_generate(_client=None, **_kwargs):
        return {"title": 12345}  # нарушение типа: string ожидался бы

    monkeypatch.setattr(llm_utils, "_generate_structured_content", fake_generate)

    result = await generate_structured_with_schema_retries(
        client=object(),
        model="test-model",
        messages=_messages(),
        response_format={"type": "json_schema"},
        json_schema={"type": "object", "properties": {"title": {"type": "string"}}},
        validate_schema=True,
    )
    assert result == {"title": 12345}


# ---------------------------------------------------------------------------
# Слайд-ретрай поверх контент-QC (presentation.py)
# ---------------------------------------------------------------------------


@pytest.mark.anyio
async def test_slide_retry_recovers_after_garbage() -> None:
    """Первая попытка — мусор, вторая — контент: слайд спасён, ошибка не летит."""
    calls: list[int] = []

    async def generate():
        calls.append(1)
        if len(calls) == 1:
            raise SlideContentQualityError(["$.title: value echoes a response-schema field name"])
        return dict(CLEAN_CONTENT)

    result = await generate_slide_content_with_quality_retry(generate, slide_number=10)
    assert result == CLEAN_CONTENT
    assert len(calls) == 2


@pytest.mark.anyio
async def test_slide_retry_exhausted_raises_with_slide_number() -> None:
    """Обе попытки мусорные — наверх HTTPException с номером слайда."""

    async def generate():
        raise SlideContentQualityError(["$.title: value echoes a response-schema field name"])

    with pytest.raises(HTTPException) as exc_info:
        await generate_slide_content_with_quality_retry(generate, slide_number=10)
    assert exc_info.value.status_code == 502
    assert "Slide 10" in str(exc_info.value.detail)


@pytest.mark.anyio
async def test_slide_retry_attempts_are_capped() -> None:
    calls: list[int] = []

    async def generate():
        calls.append(1)
        raise SlideContentQualityError(["$.title: garbage"])

    with pytest.raises(HTTPException):
        await generate_slide_content_with_quality_retry(generate, slide_number=1)
    assert len(calls) == 2


@pytest.mark.anyio
async def test_slide_retry_does_not_swallow_other_errors() -> None:
    """Чужие ошибки (сеть/провайдер) сквозь ретрай не проходят."""

    async def generate():
        raise HTTPException(status_code=400, detail="LLM did not return any content")

    with pytest.raises(HTTPException) as exc_info:
        await generate_slide_content_with_quality_retry(generate, slide_number=1)
    assert exc_info.value.status_code == 400
