"""Языковая валидация сгенерированного контента.

Промпты получают Slide Language, но никто не проверял, что модель реально
написала текст на этом языке: «Russian» в запросе спокойно превращался в
английский слайд. Здесь — детектор письменности (script detection) по
Unicode-диапазонам без внешних зависимостей и валидатор, который включается
в общий content_validator-ретрай структурированной генерации.

Аудит-поля (image prompts / icon queries) сознательно исключены: они
принудительно английские по контракту промпта.
"""

from __future__ import annotations

import re
from collections.abc import Iterator
from typing import Any

#: Письменности, которые умеем распознавать по диапазонам Unicode.
SCRIPT_CYRILLIC = "cyrillic"
SCRIPT_LATIN = "latin"
SCRIPT_HAN = "han"
SCRIPT_ARABIC = "arabic"
SCRIPT_HEBREW = "hebrew"
SCRIPT_GREEK = "greek"
SCRIPT_DEVANAGARI = "devanagari"
SCRIPT_KANA = "kana"
SCRIPT_HANGUL = "hangul"

_SCRIPT_RANGES: tuple[tuple[str, tuple[int, int]], ...] = (
    (SCRIPT_CYRILLIC, (0x0400, 0x04FF)),
    (SCRIPT_LATIN, (0x0041, 0x005A)),
    (SCRIPT_LATIN, (0x0061, 0x007A)),
    (SCRIPT_LATIN, (0x00C0, 0x024F)),
    (SCRIPT_HAN, (0x4E00, 0x9FFF)),
    (SCRIPT_ARABIC, (0x0600, 0x06FF)),
    (SCRIPT_HEBREW, (0x0590, 0x05FF)),
    (SCRIPT_GREEK, (0x0370, 0x03FF)),
    (SCRIPT_DEVANAGARI, (0x0900, 0x097F)),
    (SCRIPT_KANA, (0x3040, 0x30FF)),
    (SCRIPT_HANGUL, (0xAC00, 0xD7AF)),
)

#: Ключевые слова языков → ожидаемая письменность. Матчим по границам слов
#: в нижнем регистре, чтобы «belarusian» не ловился подстрокой «ru».
_LANGUAGE_SCRIPT_KEYWORDS: tuple[tuple[str, tuple[str, ...]], ...] = (
    (
        SCRIPT_CYRILLIC,
        (
            "russian",
            "русск",
            "ukrainian",
            "украин",
            "belarusian",
            "беларус",
            "bulgarian",
            "болгар",
            "serbian",
            "серб",
            "kazakh",
            "казах",
            "kyrgyz",
            "киргиз",
            "macedonian",
            "македон",
            "mongolian",
            "монголь",
            "tajik",
            "таджик",
        ),
    ),
    (
        SCRIPT_LATIN,
        (
            "english",
            "англий",
            "german",
            "немец",
            "french",
            "француз",
            "spanish",
            "испан",
            "italian",
            "итальян",
            "portuguese",
            "португаль",
            "dutch",
            "нидерланд",
            "голланд",
            "polish",
            "польск",
            "czech",
            "чешск",
            "slovak",
            "словацк",
            "slovenian",
            "словен",
            "croatian",
            "хорват",
            "hungarian",
            "венгер",
            "romanian",
            "румын",
            "estonian",
            "эстон",
            "latvian",
            "латышск",
            "lithuanian",
            "литовск",
            "finnish",
            "финск",
            "swedish",
            "шведск",
            "norwegian",
            "норвеж",
            "danish",
            "датск",
            "turkish",
            "турецк",
            "indonesian",
            "индонез",
            "vietnamese",
            "вьетнамск",
            "uzbek",
            "узбек",
        ),
    ),
    (SCRIPT_HAN, ("chinese", "китайск", "mandarin")),
    (SCRIPT_ARABIC, ("arabic", "арабск")),
    (SCRIPT_HEBREW, ("hebrew", "иврит")),
    (SCRIPT_GREEK, ("greek", "греческ")),
    (SCRIPT_DEVANAGARI, ("hindi", "хинди", "marathi", "маратхи")),
    (SCRIPT_KANA, ("japanese", "японск")),
    (SCRIPT_HANGUL, ("korean", "корейск")),
)

# Короткие коды языков (ru, en, de, ...) — только целиком, по границам слов.
_LANGUAGE_CODE_SCRIPTS: dict[str, str] = {
    "ru": SCRIPT_CYRILLIC,
    "uk": SCRIPT_CYRILLIC,
    "be": SCRIPT_CYRILLIC,
    "bg": SCRIPT_CYRILLIC,
    "sr": SCRIPT_CYRILLIC,
    "kk": SCRIPT_CYRILLIC,
    "ky": SCRIPT_CYRILLIC,
    "mn": SCRIPT_CYRILLIC,
    "en": SCRIPT_LATIN,
    "de": SCRIPT_LATIN,
    "fr": SCRIPT_LATIN,
    "es": SCRIPT_LATIN,
    "it": SCRIPT_LATIN,
    "pt": SCRIPT_LATIN,
    "nl": SCRIPT_LATIN,
    "pl": SCRIPT_LATIN,
    "cs": SCRIPT_LATIN,
    "tr": SCRIPT_LATIN,
    "zh": SCRIPT_HAN,
    "ja": SCRIPT_KANA,
    "ko": SCRIPT_HANGUL,
    "ar": SCRIPT_ARABIC,
    "he": SCRIPT_HEBREW,
    "el": SCRIPT_GREEK,
    "hi": SCRIPT_DEVANAGARI,
}

AUTO_DETECT_LANGUAGE_INSTRUCTION = (
    "auto-detect from the slide content and use the same language as the slide content"
)

_AUTO_LANGUAGE_RE = re.compile(r"^\s*auto\b", re.IGNORECASE)

#: Поля, значения которых — служебные промпты для ассетов, всегда английские.
ASSET_PROMPT_FIELD_MARKERS = ("image_prompt", "icon_query", "alt_text")

_MIN_TEXT_ALPHA_CHARS = 40
_MIN_EXPECTED_SCRIPT_SHARE = 0.5

_WORD_RE = re.compile(r"[a-zа-яё]+", re.IGNORECASE)


def detect_script_counts(text: str) -> dict[str, int]:
    """Число буквенных символов каждой письменности в тексте."""
    counts: dict[str, int] = {}
    for char in text:
        code = ord(char)
        for script, (low, high) in _SCRIPT_RANGES:
            if low <= code <= high:
                counts[script] = counts.get(script, 0) + 1
                break
    return counts


def expected_script_for_language(language: str | None) -> str | None:
    """Ожидаемая письменность для ярлыка языка («Russian (Русский)» → cyrillic)."""
    if not language:
        return None
    normalized = str(language).strip()
    if not normalized:
        return None

    lowered = normalized.lower()

    # «Auto» в любом виде — язык определяем по контенту, ожидания нет.
    if _AUTO_LANGUAGE_RE.match(lowered):
        return None

    for code, script in _LANGUAGE_CODE_SCRIPTS.items():
        if re.search(rf"\b{re.escape(code)}\b", lowered):
            return script

    for script, keywords in _LANGUAGE_SCRIPT_KEYWORDS:
        for keyword in keywords:
            if re.search(rf"\b{re.escape(keyword)}", lowered):
                return script

    # Неопознанный ярлык (в т.ч. редкий кириллический) — валидацию не
    # включаем: ложноположительный ретрай хуже отсутствия проверки.
    return None


def resolve_prompt_language(language: str | None) -> str:
    """Ярлык языка для промпта: None/auto-варианты → инструкция авто-детекта.

    Фронтенд исторически присылал «Auto (English)» — дословная подстановка
    такого значения в промпт была явной английской подсказкой. Любое
    auto-значение теперь сводится к нейтральному авто-детекту.
    """
    if language is None:
        return AUTO_DETECT_LANGUAGE_INSTRUCTION
    value = str(language).strip()
    if not value or _AUTO_LANGUAGE_RE.match(value):
        return AUTO_DETECT_LANGUAGE_INSTRUCTION
    return value


def iter_content_strings(
    node: Any,
    *,
    path: tuple[Any, ...] = (),
    skip_asset_prompts: bool = True,
) -> Iterator[tuple[tuple[Any, ...], str]]:
    """Обход строковых значений контента; asset-промпты исключаются."""
    if isinstance(node, dict):
        for key, value in node.items():
            key_str = str(key)
            if skip_asset_prompts and any(
                marker in key_str.lower() for marker in ASSET_PROMPT_FIELD_MARKERS
            ):
                continue
            yield from iter_content_strings(
                value, path=(*path, key_str), skip_asset_prompts=skip_asset_prompts
            )
    elif isinstance(node, list):
        for index, value in enumerate(node):
            yield from iter_content_strings(
                value, path=(*path, index), skip_asset_prompts=skip_asset_prompts
            )
    elif isinstance(node, str):
        yield path, node


def get_language_mismatch_errors(
    content: dict,
    language: str | None,
    *,
    min_alpha_chars: int = _MIN_TEXT_ALPHA_CHARS,
    min_expected_share: float = _MIN_EXPECTED_SCRIPT_SHARE,
) -> list[str]:
    """Ошибки несоответствия языка контента запрошенному (пустой список — ок).

    Сравниваем доминирующую письменность контента с ожидаемой от языка.
    Пустой/неопознанный язык или auto-режим проверку не включают: для них
    нет эталона. Короткие значения (подписи, числа) не дают достаточного
    объёма букв и не влияют на вердикт — решает суммарная статистика
    по слайду.
    """
    expected_script = expected_script_for_language(language)
    if expected_script is None:
        return []

    counts = {expected_script: 0}
    total = 0
    for _path, value in iter_content_strings(content):
        for script, count in detect_script_counts(value).items():
            counts[script] = counts.get(script, 0) + count
            total += count

    if total < min_alpha_chars:
        return []

    expected_share = counts.get(expected_script, 0) / total
    if expected_share >= min_expected_share:
        return []

    dominant_script = max(counts, key=lambda script: counts[script])
    return [
        (
            "output language mismatch: Slide Language is "
            f"'{language}' (expected {expected_script} script), but generated "
            f"text is mostly {dominant_script} "
            f"({expected_script} share {round(expected_share * 100)}%). "
            f"Rewrite every text value in {language}."
        )
    ]
