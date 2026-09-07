"""Семантическая валидация данных графиков.

LLM и шаблоны периодически рисуют столбчатые диаграммы по временным рядам
(годы, даты, месяцы) — на проде это выглядело как «выручка 2018–2022» в виде
bar chart. Анализатор определяет временной характер категорий и принудительно
переключает рендер на линейный график. Работает на трёх уровнях:
pydantic-модель Chart (template-v2), контент-валидатор LLM-генерации и
фронтенд-мапперы (страховка на старых деках).
"""

from __future__ import annotations

import re
from typing import Any

CHART_TYPE_KEY_ALIASES = ("chart_type", "chartType")
CATEGORIES_KEY_ALIASES = ("categories", "labels", "x_values")

#: Типы, которые для временных рядов бессмысленны → заменяются на line.
TEMPORAL_INCOMPATIBLE_CHART_TYPES = frozenset(
    {
        "bar",
        "horizontal_bar",
        "stacked_bar",
        "horizontal_stacked_bar",
        "pie",
        "donut",
        "polar_area",
        "radar",
    }
)

TEMPORAL_CHART_TYPE = "line"

_YEAR_RE = re.compile(r"^\d{4}\s*(?:г\.?|год|year)?$", re.IGNORECASE)
_ISO_DATE_RE = re.compile(r"^\d{4}-\d{1,2}(-\d{1,2})?$")
_NUMERIC_DATE_RE = re.compile(r"^\d{1,2}[./]\d{1,2}([./]\d{2,4})?$")
_QUARTER_RE = re.compile(
    r"^(?:q[1-4]|[1-4]\s*(?:кв(?:артал)?\.?|quarter))\s*(?:\d{4})?$",
    re.IGNORECASE,
)
_MONTH_YEAR_NUMERIC_RE = re.compile(r"^\d{1,2}\s*[-/]\s*\d{4}$")
_HALF_YEAR_RE = re.compile(r"^(?:h[12]|полугодие\s*\d?)\s*(?:\d{4})?$", re.IGNORECASE)

_MONTH_NAMES = {
    # Английский
    "january",
    "february",
    "march",
    "april",
    "may",
    "june",
    "july",
    "august",
    "september",
    "october",
    "november",
    "december",
    "jan",
    "feb",
    "mar",
    "apr",
    "jun",
    "jul",
    "aug",
    "sep",
    "sept",
    "oct",
    "nov",
    "dec",
    # Русский (именительный и родительный падежи, сокращения)
    "январь",
    "февраль",
    "март",
    "апрель",
    "май",
    "июнь",
    "июль",
    "август",
    "сентябрь",
    "октябрь",
    "ноябрь",
    "декабрь",
    "января",
    "февраля",
    "марта",
    "апреля",
    "июня",
    "июля",
    "августа",
    "сентября",
    "октября",
    "ноября",
    "декабря",
    "янв",
    "фев",
    "мар",
    "апр",
    "июн",
    "июл",
    "авг",
    "сен",
    "сент",
    "окт",
    "ноя",
    "нояб",
    "дек",
}

_MONTH_DAY_RE = re.compile(
    r"^(?:\d{1,2}\s+(?:[а-яё]+|[a-z]+)|(?:[а-яё]+|[a-z]+)\s+\d{1,4})(?:\s+\d{2,4})?$",
    re.IGNORECASE,
)


def is_temporal_category(value: str) -> bool:
    """Похоже ли одиночное значение категории на точку времени."""
    if not value:
        return False
    text = value.strip().lower()
    if not text or len(text) > 32:
        return False
    if _YEAR_RE.match(text):
        return True
    if _ISO_DATE_RE.match(text):
        return True
    if _NUMERIC_DATE_RE.match(text):
        return True
    if _QUARTER_RE.match(text):
        return True
    if _MONTH_YEAR_NUMERIC_RE.match(text):
        return True
    if _HALF_YEAR_RE.match(text):
        return True
    if text in _MONTH_NAMES:
        return True
    # «12 марта», «март 2024», «march 24»
    if _MONTH_DAY_RE.match(text):
        parts = text.split()
        return any(part in _MONTH_NAMES for part in parts)
    return False


def is_temporal_categories(categories: list[Any] | None) -> bool:
    """Является ли набор категорий временным рядом.

    Порог: минимум 3 временные категории и не менее 60% ряда — единичный
    «2024» среди обычных меток («Q1», «Q2» легитимны и для категорий)
    ряд не делает, а реальные временные ряды почти всегда временны́е целиком.
    """
    if not categories:
        return False
    values = [str(value) for value in categories if str(value).strip()]
    if len(values) < 3:
        return False
    temporal = sum(1 for value in values if is_temporal_category(value))
    return temporal >= 3 and temporal / len(values) >= 0.6


def coerce_chart_type_for_categories(
    chart_type: str | None,
    categories: list[Any] | None,
) -> str | None:
    """Тип графика с учётом семантики категорий.

    Возвращает исправленный тип, если категории — временной ряд, а текущий
    тип с ним несовместим; иначе None (исправление не требуется).
    """
    if not chart_type:
        return None
    if chart_type not in TEMPORAL_INCOMPATIBLE_CHART_TYPES:
        return None
    if is_temporal_categories(categories):
        return TEMPORAL_CHART_TYPE
    return None


def apply_chart_semantics(element: dict) -> list[str]:
    """Исправить chart-элемент слайда на месте; вернуть список правок.

    Устойчив к алиасам ключей (chart_type/chartType, categories/labels) —
    через один вход проходят и контент LLM, и template-fill, и чат-апдейты.
    """
    changes: list[str] = []
    if not isinstance(element, dict):
        return changes

    type_key = next((key for key in CHART_TYPE_KEY_ALIASES if key in element), None)
    if type_key is None:
        return changes

    categories: list[Any] | None = None
    for key in CATEGORIES_KEY_ALIASES:
        value = element.get(key)
        if isinstance(value, list):
            categories = value
            break

    chart_type = element.get(type_key)
    if not isinstance(chart_type, str):
        return changes

    corrected = coerce_chart_type_for_categories(chart_type, categories)
    if corrected and corrected != chart_type:
        element[type_key] = corrected
        changes.append(f"chart_type '{chart_type}' -> '{corrected}' (temporal categories)")
    return changes


def apply_chart_semantics_to_content(content: dict) -> list[str]:
    """Пройтись по всем chart-элементам контента слайда; вернуть список правок."""
    changes: list[str] = []
    if not isinstance(content, dict):
        return changes

    def walk(node: Any) -> None:
        if isinstance(node, dict):
            type_value = node.get("type") if isinstance(node.get("type"), str) else None
            if type_value == "chart" or any(key in node for key in CHART_TYPE_KEY_ALIASES):
                changes.extend(apply_chart_semantics(node))
            for value in node.values():
                walk(value)
        elif isinstance(node, list):
            for value in node:
                walk(value)

    walk(content)
    return changes
