"""Тесты контент-QC структурного контента слайдов (utils/content_quality.py).

Прод-кейс 2026-09-05 (дека «ИТ в России», слайд 10): jsonschema пропустил
слайд, чей заголовок был «__tablecard», ячейки таблицы повторяли имена полей
схемы («type object», «minLength»), а тело — мета-болтовню модели
(«Please wait while I import…»). Эти тесты фиксируют: каждый класс мусора
ловится, легитимный контент не флагается.
"""

from __future__ import annotations

from utils.content_quality import get_content_quality_errors

TABLECARD_SCHEMA = {
    "type": "object",
    "properties": {
        "title": {"type": "string", "maxLength": 60},
        "columns": {"type": "array", "maxItems": 5},
        "rows": {"type": "array", "maxItems": 8},
        "bottom_note": {"type": "string", "maxLength": 200},
        "title_description": {"type": "string", "maxLength": 120},
        "__speaker_note__": {"type": "string", "minLength": 100},
    },
}


def _errors(content: dict, schema: dict | None = TABLECARD_SCHEMA) -> list[str]:
    return get_content_quality_errors(schema, content)


def test_clean_content_passes() -> None:
    content = {
        "title": "Импортозамещение ПО",
        "rows": [["Реестр отечественного ПО", "18 400 продуктов"]],
        "bottom_note": "Данные Минцифры за 2025 год.",
        "__speaker_note__": "Расскажите про рост реестра и подчеркните роль "
        "отечественных вендоров в гос-секторе за последние три года.",
    }
    assert _errors(content) == []


def test_schema_echo_in_cells_is_flagged() -> None:
    # Прод-кейс: ячейки таблицы повторяют поля и ключевые слова схемы.
    content = {
        "title": "__tablecard",
        "rows": [["type object", "title"], ["minLength", "maxLength"]],
    }
    errors = _errors(content)
    joined = "\n".join(errors)
    assert "response-schema field names" in joined


def test_compound_schema_names_are_flagged() -> None:
    content = {
        "title": "Состав полей",
        "rows": [["title description"], ["bottom_note"], ["additional_properties"]],
    }
    errors = _errors(content)
    assert len(errors) == 3


def test_single_common_words_are_not_flagged() -> None:
    content = {
        "title": "Структура отчёта",
        "rows": [["Description", "Value"], ["rows", "columns"]],
    }
    assert _errors(content) == []


def test_leaked_internal_identifiers_are_flagged() -> None:
    assert _errors({"title": "__tablecard"})
    assert _errors({"note": "__speaker_note__"})


def test_meta_chatter_is_flagged() -> None:
    # Прод-кейс: тело слайда — болтовня модели про импорт/исправление текста.
    content = {
        "title": "Заголовок",
        "bottom_note": (
            "Some text ... an image ... slide 10? Please wait while I import / "
            "corrected / generated text? Actually, the answer requires a special "
            "response because Typos are ignored and can be twisted, original. "
            "Pro-Tip: ty"
        ),
    }
    errors = _errors(content)
    joined = "\n".join(errors)
    assert "meta-commentary" in joined


def test_meta_chatter_in_speaker_note_is_flagged() -> None:
    content = {
        "title": "Образование и подготовка кадров",
        "__speaker_note__": (
            "Образование и подготовка кадров - centralized cross-import? "
            "...sentation...? No, more precisely: this response note is inaccurate."
        ),
    }
    errors = _errors(content)
    joined = "\n".join(errors)
    assert "meta-commentary" in joined


def test_placeholder_punctuation_is_flagged() -> None:
    assert _errors({"title": "Слайд", "rows": [["....."]]})
    assert _errors({"title": "Слайд", "rows": [["…"]]})
    # одиночное тире и длинное тире — легитимные пустые маркеры
    assert not _errors({"title": "Слайд", "rows": [["—"]]})


def test_placeholder_tbd_is_flagged() -> None:
    assert _errors({"title": "Слайд", "rows": [["TBD"]]})


def test_script_glue_is_flagged() -> None:
    # Прод-кейс: «поставщиNo hardware and software.» — обрыв слова с вклейкой.
    errors = _errors({"title": "Поставщики", "bottom_note": "поставщиNo hardware and software."})
    joined = "\n".join(errors)
    assert "glued mid-word" in joined


def test_separate_multilingual_words_are_not_flagged() -> None:
    content = {
        "title": "Технологии",
        "rows": [
            ["Python-разработчик", "B2B SaaS"],
            ["Импортозамещение Windows", "COBOL legacy"],
        ],
        "__speaker_note__": "Упомяните переход с Windows на Astra Linux в госсекторе.",
    }
    assert _errors(content) == []


def test_raw_json_fragment_is_flagged() -> None:
    errors = _errors({"title": "Слайд", "rows": [['{"type": "object"}']]})
    joined = "\n".join(errors)
    assert "raw JSON fragment" in joined


def test_errors_include_paths_and_are_capped() -> None:
    content = {
        "title": "minLength",
        "rows": [["...."] for _ in range(50)],
    }
    errors = get_content_quality_errors(TABLECARD_SCHEMA, content)
    assert 0 < len(errors) <= 20
    assert errors[0].startswith("$.title")


def test_works_without_schema() -> None:
    # Метa-болтовня, протечки и keywords JSON Schema ловятся и без схемы;
    # schema-эхо имён полей конкретного слайда — только со схемой.
    assert _errors({"title": "__tablecard"}, schema=None)
    assert _errors({"title": "minLength"}, schema=None)
    assert not _errors({"title": "customfield"}, schema=None)


# ---------------------------------------------------------------------------
# Ложные срабатывания на enum-значениях (прод-инцидент 2026-09-06)
# ---------------------------------------------------------------------------

CHART_SCHEMA = {
    "type": "object",
    "properties": {
        "right_chart_panel": {
            "type": "object",
            "properties": {
                "panel_line_chart": {
                    "type": "object",
                    "properties": {
                        "chart_type": {"type": "string", "enum": ["line", "bar", "area"]},
                        "series": {"type": "array"},
                    },
                }
            },
        },
        "left_visual_card": {
            "type": "object",
            "properties": {
                "line_chart_area": {
                    "type": "object",
                    "properties": {
                        "chart_type": {"type": "string", "enum": ["line", "bar", "area"]},
                    },
                },
                "alignment": {"type": "string", "enum": ["left", "center", "right"]},
            },
        },
    },
}


def test_legitimate_chart_type_values_pass() -> None:
    """Прод-инцидент: chart_type "line"/"area" при свойствах panel_line_chart
    и line_chart_area — легитимный контент, не schema-эхо."""
    content = {
        "right_chart_panel": {"panel_line_chart": {"chart_type": "line"}},
        "left_visual_card": {"line_chart_area": {"chart_type": "area"}},
    }
    assert _errors(content, CHART_SCHEMA) == []


def test_subtoken_words_in_values_pass() -> None:
    """Слова, совпадающие с суб-токенами имён полей («left» из left_visual_card),
    не запрещены легитимным значениям."""
    content = {
        "left_visual_card": {"alignment": "left"},
        "right_chart_panel": {"panel_line_chart": {"chart_type": "bar"}},
    }
    assert _errors(content, CHART_SCHEMA) == []


def test_enum_values_never_flagged_even_matching_field_name() -> None:
    schema = {
        "type": "object",
        "properties": {
            "line": {"type": "string", "enum": ["line"]},
        },
    }
    assert _errors({"line": "line"}, schema) == []


def test_compound_schema_names_still_flagged() -> None:
    """Составные имена ловятся компактной проверкой целого значения даже
    после отказа от суб-токенов."""
    content = {
        "title": "Состав полей",
        "rows": [["panel_line_chart"], ["line chart area"], ["line_chart"]],
    }
    errors = _errors(content, CHART_SCHEMA)
    assert len(errors) == 2, errors


def test_clean_chart_content_with_free_text_passes() -> None:
    content = {
        "right_chart_panel": {
            "panel_line_chart": {
                "chart_type": "line",
                "series": [{"name": "Продажи 2025", "values": [1, 2, 3]}],
            }
        },
        "left_visual_card": {
            "line_chart_area": {"chart_type": "bar"},
            "alignment": "center",
            "heading": "Выручка по кварталам",
        },
    }
    assert _errors(content, CHART_SCHEMA) == []
