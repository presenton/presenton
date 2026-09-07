"""Тесты пола шрифтов при авторинге v2-шаблонов (templates/v2/generation.py).

Прод-кейс 2026-09-05: body/подписи в готовых шаблонах авторились на 12–14px
(9–10.5pt в PPTX), подписи графиков падали до 8–9.9px. Рендер применяет
пол 12px на выдаче; авторинг шаблонов должен сохранять уже поднятые размеры,
чтобы превью совпадало с экспортом. На уровне Font-модели пол не ставим —
она парсит и сохранённые шаблоны старых дек.
"""

from __future__ import annotations

import pytest

from templates.v2.generation import _enforce_minimum_font_sizes
from templates.v2.models.elements import Font, Table, Text, TextList
from templates.v2.models.layouts import Component, SlideLayout


def _layout(elements: list) -> SlideLayout:
    return SlideLayout(
        id="test_layout",
        description="test layout",
        components=[
            Component(
                id="component_1",
                description="test component",
                position={"x": 0, "y": 0},
                elements=elements,
            )
        ],
    )


def _text(font: Font | None) -> Text:
    return Text(
        type="text",
        position={"x": 0, "y": 0},
        size={"width": 200, "height": 60},
        font=font,
        runs=[{"text": "текст", "font": Font(size=9, color="#111111")}],
        decorative=False,
        name="body_text",
        max_length=200,
        min_length=10,
    )


def test_bumps_small_element_font() -> None:
    layout = _enforce_minimum_font_sizes(_layout([_text(Font(size=9, color="#111111"))]))
    element = layout.components[0].elements[0]
    assert element.font.size == 12.0


def test_bumps_small_run_fonts() -> None:
    layout = _enforce_minimum_font_sizes(_layout([_text(None)]))
    element = layout.components[0].elements[0]
    assert element.runs[0].font.size == 12.0


def test_keeps_normal_fonts_untouched() -> None:
    layout = _enforce_minimum_font_sizes(_layout([_text(Font(size=16, color="#111111"))]))
    element = layout.components[0].elements[0]
    assert element.font.size == 16.0
    # ран с мелким шрифтом поднят, крупный не тронут
    layout_mixed = _enforce_minimum_font_sizes(
        _layout(
            [
                Text(
                    type="text",
                    position={"x": 0, "y": 0},
                    size={"width": 200, "height": 60},
                    runs=[
                        {"text": "мелкий", "font": Font(size=10.5, color="#111111")},
                        {"text": "крупный", "font": Font(size=18, color="#111111")},
                    ],
                    decorative=False,
                    name="mixed_text",
                    max_length=200,
                    min_length=10,
                )
            ]
        )
    )
    mixed = layout_mixed.components[0].elements[0]
    assert mixed.runs[0].font.size == 12.0
    assert mixed.runs[1].font.size == 18


def test_bumps_table_cell_fonts() -> None:
    cell = {
        "font": Font(size=9, color="#111111"),
        "runs": [{"text": "ячейка"}],
    }
    table = Table(
        type="table",
        position={"x": 0, "y": 0},
        size={"width": 400, "height": 200},
        columns=[cell],
        rows=[[cell]],
        decorative=False,
        name="table",
        max_columns=2,
        min_columns=1,
        max_rows=2,
        min_rows=1,
    )
    layout = _enforce_minimum_font_sizes(_layout([table]))
    element = layout.components[0].elements[0]
    assert element.columns[0].font.size == 12.0
    assert element.rows[0][0].font.size == 12.0


def test_bumps_text_list_fonts() -> None:
    text_list = TextList(
        type="text-list",
        position={"x": 0, "y": 0},
        size={"width": 300, "height": 120},
        font=Font(size=10, color="#111111"),
        items=[[{"text": "пункт", "font": Font(size=9, color="#111111")}]],
        decorative=False,
        name="bullets",
        max_items=5,
        min_items=1,
        max_item_length=80,
        min_item_length=5,
    )
    layout = _enforce_minimum_font_sizes(_layout([text_list]))
    element = layout.components[0].elements[0]
    assert element.font.size == 12.0
    assert element.items[0][0].font.size == 12.0


def test_layout_without_fonts_is_unchanged() -> None:
    layout = _layout([_text(None)])
    element = layout.components[0].elements[0]
    element.runs[0].font.size = 14
    normalized = _enforce_minimum_font_sizes(layout)
    assert normalized.components[0].elements[0].runs[0].font.size == 14


@pytest.mark.parametrize("size", [11.9, 1, 0.5])
def test_boundary_sizes_are_bumped(size: float) -> None:
    layout = _enforce_minimum_font_sizes(_layout([_text(Font(size=size, color="#111111"))]))
    assert layout.components[0].elements[0].font.size == 12.0
