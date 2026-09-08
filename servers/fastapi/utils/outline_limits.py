import json
import re
from typing import Any

from constants.presentation import MAX_OUTLINE_CONTENT_WORDS


OUTLINE_WORD_PATTERN = re.compile(r"\S+")


def count_outline_words(text: str) -> int:
    return len(OUTLINE_WORD_PATTERN.findall(text or ""))


def trim_text_to_word_limit(
    text: str,
    max_words: int = MAX_OUTLINE_CONTENT_WORDS,
) -> str:
    if max_words <= 0:
        return ""

    matches = list(OUTLINE_WORD_PATTERN.finditer(text or ""))
    if len(matches) <= max_words:
        return text

    return text[: matches[max_words - 1].end()].rstrip()


def normalize_outline_content(value: Any) -> str:
    if value is None:
        return ""
    if not isinstance(value, str):
        value = str(value)
    return trim_text_to_word_limit(value, MAX_OUTLINE_CONTENT_WORDS)


def normalize_outline_payload(payload: dict[str, Any], max_slides: int) -> dict[str, Any]:
    normalized = dict(payload)
    raw_slides = normalized.get("slides")
    # Some providers implement structured output through a tool call. Anthropic
    # can occasionally put the complete JSON response in the tool's `slides`
    # argument as a JSON string instead of returning the requested array. Accept
    # that recoverable shape while leaving genuinely invalid output untouched so
    # Pydantic can report it to the caller.
    if isinstance(raw_slides, str):
        try:
            decoded_slides = json.loads(raw_slides)
        except (TypeError, ValueError):
            decoded_slides = None

        if isinstance(decoded_slides, dict):
            raw_slides = decoded_slides.get("slides")
        elif isinstance(decoded_slides, list):
            raw_slides = decoded_slides

    if not isinstance(raw_slides, list):
        return normalized

    normalized["slides"] = [
        {
            **slide,
            "content": normalize_outline_content(slide.get("content", "")),
        }
        if isinstance(slide, dict)
        else {"content": normalize_outline_content(slide)}
        for slide in raw_slides[:max_slides]
    ]
    return normalized
