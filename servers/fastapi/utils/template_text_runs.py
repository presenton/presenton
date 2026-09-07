"""Разбор текстовой разметки шаблонов в runs (text elements).

Перенесено из ``api/v1/ppt/endpoints/presentation.py`` (использовалось там же
при гидрации сгенерированного контента), чтобы редакторский сервис
(``services/deck_editor_service.py``) поддерживал ту же разметку при ручных
правках текста: ``**жирный**`` / ``__жирный__``, ``*курсив*`` / ``_курсив_``,
``<latex>…</latex>`` (через ``utils.latex_text``).
"""

from __future__ import annotations

import copy
from typing import Any

from utils.latex_text import parse_latex_tags, replace_text_runs

TEMPLATE_STRONG_MARKDOWN_DELIMITERS = ("**", "__")
TEMPLATE_EMPHASIS_MARKDOWN_DELIMITERS = ("*", "_")
TEMPLATE_MARKDOWN_DELIMITERS = (
    *TEMPLATE_STRONG_MARKDOWN_DELIMITERS,
    *TEMPLATE_EMPHASIS_MARKDOWN_DELIMITERS,
)


def template_text_runs_from_markdown(
    text: str,
    first_run: Any,
    *,
    fallback_font: Any = None,
) -> list[dict[str, Any]]:
    if parse_latex_tags(text) is not None or (
        isinstance(first_run, dict) and first_run.get("type") == "latex"
    ):
        return replace_text_runs(
            [first_run] if isinstance(first_run, dict) else None,
            text,
            fallback_font,
        )

    base_run = copy.deepcopy(first_run) if isinstance(first_run, dict) else {}
    parsed = parse_template_markdown_text(text)
    has_markdown_style = any(style for _parsed_text, style in parsed)
    base_run = template_base_run_for_markdown(
        base_run,
        fallback_font,
        strip_inline_emphasis=has_markdown_style,
    )

    text_runs: list[dict[str, Any]] = []
    for parsed_text, style in parsed:
        run = copy.deepcopy(base_run)
        run["text"] = parsed_text
        if style:
            font = run.get("font")
            run["font"] = {
                **(copy.deepcopy(font) if isinstance(font, dict) else {}),
                **style,
            }
        append_template_text_run(text_runs, run)

    if text_runs:
        return text_runs
    return [{**base_run, "text": " "}]


def template_base_run_for_markdown(
    base_run: dict[str, Any],
    fallback_font: Any,
    *,
    strip_inline_emphasis: bool,
) -> dict[str, Any]:
    font = base_run.get("font")
    if isinstance(fallback_font, dict):
        merged_font = {
            **copy.deepcopy(fallback_font),
            **(copy.deepcopy(font) if isinstance(font, dict) else {}),
        }
        base_run["font"] = merged_font
    elif isinstance(font, dict):
        base_run["font"] = copy.deepcopy(font)

    if strip_inline_emphasis and isinstance(base_run.get("font"), dict):
        base_run["font"].pop("bold", None)
        base_run["font"].pop("italic", None)

    return base_run


def parse_template_markdown_text(text: str) -> list[tuple[str, dict[str, bool]]]:
    parsed: list[tuple[str, dict[str, bool]]] = []
    index = 0

    while index < len(text):
        strong_delimiter = read_markdown_delimiter(
            text,
            index,
            TEMPLATE_STRONG_MARKDOWN_DELIMITERS,
        )
        if strong_delimiter:
            close = text.find(strong_delimiter, index + len(strong_delimiter))
            if close > index + len(strong_delimiter):
                parsed.append(
                    (
                        text[index + len(strong_delimiter) : close],
                        {"bold": True},
                    )
                )
                index = close + len(strong_delimiter)
                continue

        emphasis_delimiter = read_markdown_delimiter(
            text,
            index,
            TEMPLATE_EMPHASIS_MARKDOWN_DELIMITERS,
        )
        if emphasis_delimiter:
            close = text.find(emphasis_delimiter, index + len(emphasis_delimiter))
            if close > index + len(emphasis_delimiter):
                parsed.append(
                    (
                        text[index + len(emphasis_delimiter) : close],
                        {"italic": True},
                    )
                )
                index = close + len(emphasis_delimiter)
                continue

        next_index = next_markdown_delimiter_index(text, index + 1)
        parsed.append(
            (
                text[index : len(text) if next_index == -1 else next_index],
                {},
            )
        )
        index = len(text) if next_index == -1 else next_index

    return parsed


def read_markdown_delimiter(text: str, index: int, delimiters: tuple[str, ...]) -> str | None:
    for delimiter in delimiters:
        if text.startswith(delimiter, index):
            return delimiter
    return None


def next_markdown_delimiter_index(text: str, start: int) -> int:
    indexes = [
        index
        for index in (text.find(delimiter, start) for delimiter in TEMPLATE_MARKDOWN_DELIMITERS)
        if index != -1
    ]
    return min(indexes) if indexes else -1


def append_template_text_run(text_runs: list[dict[str, Any]], run: dict[str, Any]) -> None:
    text = run.get("text")
    if not isinstance(text, str) or text == "":
        return

    previous = text_runs[-1] if text_runs else None
    if isinstance(previous, dict):
        previous_style = {key: value for key, value in previous.items() if key != "text"}
        next_style = {key: value for key, value in run.items() if key != "text"}
        if previous_style == next_style and isinstance(previous.get("text"), str):
            previous["text"] += text
            return

    text_runs.append(run)
