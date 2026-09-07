"""Fallback-рендер слайда при сбое LLM-генерации.

Один упавший слайд раньше валил всю деку: asyncio.gather отменял остальные
вызовы, и пользователь не получал ничего. Теперь слайд собирается детерминистически
из аутлайна: обязательные поля json_schema лейаута заполняются предложениями
аутлайна с учётом min/max длины каждого поля. Язык fallback-слайда корректен
по построению — аутлайн уже сгенерирован на запрошенном языке.
"""

from __future__ import annotations

import re
from typing import Any

from models.presentation_layout import SlideLayoutModel
from models.presentation_outline_model import SlideOutlineModel

_DEFAULT_MAX_LENGTH = 120
_FALLBACK_NOTE_MARK = (
    "Автоматический слайд: содержимое восстановлено из плана после сбоя генерации."
)

_MARKDOWN_PREFIX_RE = re.compile(r"^[#>\-*\s`]+")
_SENTENCE_SPLIT_RE = re.compile(r"(?<=[.!?;:])\s+|\n+")


def _strip_markdown(text: str) -> str:
    cleaned = _MARKDOWN_PREFIX_RE.sub("", text.strip())
    return cleaned.replace("**", "").replace("*", "").replace("`", "").strip()


class _OutlineTextSource:
    """Циклическая выдача фрагментов аутлайна нужной длины."""

    def __init__(self, text: str) -> None:
        sentences = [_strip_markdown(part) for part in _SENTENCE_SPLIT_RE.split(text or "")]
        self._sentences = [part for part in sentences if part]
        self._index = 0

    def next_chunk(self, min_length: int, max_length: int) -> str:
        if not self._sentences:
            return ""

        parts: list[str] = []
        length = 0
        # Собираем предложения, пока не закроем minLength (или цикл не сделает
        # полный оборот — тогда отдаём что есть).
        for _ in range(len(self._sentences) + 1):
            sentence = self._sentences[self._index % len(self._sentences)]
            self._index += 1
            parts.append(sentence)
            length = sum(len(part) + 1 for part in parts) - 1
            if length >= min_length:
                break

        chunk = " ".join(parts)
        if max_length and len(chunk) > max_length:
            cut = chunk[:max_length]
            # Не режем слово посередине: отступаем к последнему пробелу,
            # если он не слишком короткий относительно лимита.
            space = cut.rfind(" ")
            if space >= max(0, int(max_length * 0.4)):
                cut = cut[:space]
            chunk = cut.rstrip(" ,;:-")
        return chunk


def _string_bounds(node: dict) -> tuple[int, int]:
    min_length = node.get("minLength")
    max_length = node.get("maxLength")
    low = min_length if isinstance(min_length, int) and min_length > 0 else 0
    high = max_length if isinstance(max_length, int) and max_length > 0 else _DEFAULT_MAX_LENGTH
    if low > high:
        low = high
    return low, high


def _fill_string(node: dict, source: _OutlineTextSource) -> str:
    low, high = _string_bounds(node)
    return source.next_chunk(low, high)


def _array_size_bounds(node: dict) -> tuple[int, int]:
    min_items = node.get("minItems")
    max_items = node.get("maxItems")
    low = min_items if isinstance(min_items, int) and min_items > 0 else 1
    high = max_items if isinstance(max_items, int) and max_items > 0 else max(low, 4)
    if low > high:
        low = high
    return low, high


def _fill_from_schema(node: dict, source: _OutlineTextSource) -> Any:
    node_type = node.get("type")
    if node_type == "string":
        return _fill_string(node, source)
    if node_type == "array":
        items = node.get("items")
        if not isinstance(items, dict):
            return []
        low, high = _array_size_bounds(node)
        return [_fill_from_schema(items, source) for _ in range(low)][:high]
    if node_type == "object":
        properties = node.get("properties")
        required = node.get("required")
        if not isinstance(properties, dict):
            return {}
        required_keys = set(required) if isinstance(required, list) else set(properties)
        filled: dict[str, Any] = {}
        for key, child in properties.items():
            if key in required_keys and isinstance(child, dict):
                filled[str(key)] = _fill_from_schema(child, source)
        return filled
    return ""


def build_fallback_slide_content(
    slide_layout: SlideLayoutModel,
    outline: SlideOutlineModel,
) -> dict:
    """Детерминистический контент слайда из аутлайна по схеме лейаута."""
    source = _OutlineTextSource(outline.content or "")
    schema = slide_layout.json_schema if isinstance(slide_layout.json_schema, dict) else {}
    filled = _fill_from_schema(schema, source) if schema else {}
    return filled if isinstance(filled, dict) else {}


def build_fallback_speaker_note(outline: SlideOutlineModel) -> str:
    note = _strip_markdown(outline.content or "")
    if not note:
        return _FALLBACK_NOTE_MARK
    return note[:500]
