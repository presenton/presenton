"""Контент-QC структурного контента слайдов.

jsonschema-валидация проверяет только структуру ответа: schema-эхо в ячейках
(«type object», «minLength»), протечки служебных идентификаторов
(«__tablecard»), мета-болтовню модели («Please wait while I import…»),
заглушки («.....») и склейки текста («поставщиNo hardware») она пропускает —
прод-кейс 2026-09-05, слайд 10 деки «ИТ в России». Здесь содержательные
проверки: ошибки складываются к schema-ошибкам в
``generate_structured_with_schema_retries`` и провоцируют починку ответа,
а не сохранение мусора.
"""

from __future__ import annotations

import re
from typing import Any

from utils.schema_utils import format_json_path

#: Ключевые слова JSON Schema, которые модель иногда перефразирует в
#: значениях контента (прод-кейс: ячейки таблицы «minLength», «type object»).
#: Включая примитивы типов: их пара «type object» — типичный schema-эхо.
_JSON_SCHEMA_KEYWORDS = frozenset(
    {
        "additionalproperties",
        "additionalitems",
        "allof",
        "anyof",
        "array",
        "boolean",
        "const",
        "default",
        "enum",
        "examples",
        "format",
        "integer",
        "items",
        "maxcontains",
        "maxitems",
        "maxlength",
        "maximum",
        "mincontains",
        "minitems",
        "minlength",
        "minimum",
        "null",
        "nullable",
        "number",
        "object",
        "oneof",
        "pattern",
        "properties",
        "propertynames",
        "required",
        "string",
        "type",
        "uniqueitems",
    }
)

#: Частые слова, которые встречаются и в легитимном контенте: одиночное
#: совпадение с ними эхом не считаем («Description» как заголовок колонки).
#: Составные совпадения из нескольких слов («type object») ловим всегда.
_COMMON_ECHO_WORDS = frozenset(
    {
        "body",
        "chart",
        "columns",
        "content",
        "data",
        "default",
        "description",
        "header",
        "icon",
        "id",
        "image",
        "items",
        "label",
        "list",
        "main",
        "name",
        "note",
        "number",
        "object",
        "required",
        "rows",
        "string",
        "table",
        "text",
        "title",
        "type",
        "url",
        "value",
    }
)

#: Мета-болтовня модели, попадающая в значения вместо контента. Маркеры
#: нижним регистром, ищутся подстрокой — список данных, расширяется по
#: новым прод-кейсам.
_META_CHATTER_MARKERS = (
    "please wait while",
    "pro-tip",
    "pro tip:",
    "as an ai",
    "i cannot fulfill",
    "i will now generate",
    "i'll now generate",
    "let me generate",
    "let me import",
    "typos are ignored",
    "import / corrected / generated",
    "this response note is inaccurate",
    "generated text?",
    "placeholder text",
    "lorem ipsum",
    "example text",
    "sample text",
    "your text here",
    "текст-заполнитель",
    "плейсхолдер",
    "вставьте текст",
    "здесь будет текст",
    "случайный текст",
    "пример текста",
)

#: «Some text» ловим регуляркой: подстрока без границы слова ловила бы
#: «handsome textbook».
_SOME_TEXT_RE = re.compile(r"\bsome text\b", re.IGNORECASE)

#: Заглушки вместо контента: «TBD», «xxx», «...» и прочая пунктуация.
_PLACEHOLDER_FULL_RE = re.compile(r"\W*(?:tbd|tba|xxx)\W*", re.IGNORECASE)
_PUNCTUATION_ONLY_RE = re.compile(r"[\W_]+", re.UNICODE)

#: Склейка кириллицы и латиницы внутри одного слова («поставщиNo hardware»)
#: — признак оборванного/склеенного поколения. Раздельные слова
#: («Python-разработчик», «B2B») не совпадают.
_SCRIPT_GLUE_RE = re.compile(r"[А-Яа-яЁё][A-Za-z]|[A-Za-z][А-Яа-яЁё]")

_RAW_JSON_RE = re.compile(r"[\"']\s*:")

MAX_CONTENT_QUALITY_ERRORS = 20


def get_content_quality_errors(
    response_schema: dict | None,
    content: dict,
    *,
    max_errors: int = MAX_CONTENT_QUALITY_ERRORS,
) -> list[str]:
    """Содержательные ошибки в контенте слайда (пустой список — всё хорошо).

    Обходит все строковые значения ``content``, включая вложенные массивы и
    ``__speaker_note__``; имена полей ``response_schema`` нужны детектору
    schema-эха, enum-значения схемы образуют allowlist легитимных значений.
    """
    terms, enum_values = _collect_schema_terms(response_schema)
    errors: list[str] = []

    def walk(node: Any, path: list[Any]) -> None:
        if len(errors) >= max_errors:
            return
        if isinstance(node, dict):
            for key, value in node.items():
                walk(value, [*path, str(key)])
        elif isinstance(node, list):
            for index, value in enumerate(node):
                walk(value, [*path, index])
        elif isinstance(node, str):
            reason = _string_issue(node, terms, enum_values)
            if reason:
                errors.append(f"{format_json_path(path)}: {reason}")

    walk(content, [])
    return errors


def _string_issue(
    value: str,
    terms: frozenset[str],
    enum_values: frozenset[str],
) -> str | None:
    if not value.strip():
        return None
    leak = _leak_reason(value)
    if leak:
        return leak
    lowered = value.lower()
    if any(marker in lowered for marker in _META_CHATTER_MARKERS):
        return "model meta-commentary in content value"
    if _SOME_TEXT_RE.search(lowered):
        return "model meta-commentary in content value"
    if _PLACEHOLDER_FULL_RE.fullmatch(lowered):
        return "placeholder instead of content"
    if ("..." in value or "…" in value) and _PUNCTUATION_ONLY_RE.fullmatch(value):
        return "placeholder punctuation instead of content"
    if _SCRIPT_GLUE_RE.search(value):
        return "cyrillic/latin text glued mid-word (truncated generation?)"
    head = value.lstrip()[:1]
    if head in {"{", "["} and _RAW_JSON_RE.search(value):
        return "raw JSON fragment in content value"
    return _schema_echo_reason(value, terms, enum_values)


def _leak_reason(value: str) -> str | None:
    stripped = value.strip()
    # __speaker_note__ / __image_prompt__ как значение — протечка внутреннего
    # поля; одиночное __tablecard — протечка идентификатора без закрывающих __.
    if re.fullmatch(r"__[A-Za-z0-9]+(?:_[A-Za-z0-9]+)+_?", stripped):
        return "internal identifier leaked as content"
    if stripped.startswith("__") and not stripped.endswith("__"):
        return "internal identifier leaked as content"
    return None


def _schema_echo_reason(
    value: str,
    terms: frozenset[str],
    enum_values: frozenset[str],
) -> str | None:
    stripped = value.strip().strip(":;,.")
    if not stripped:
        return None
    tokens = [token for token in re.split(r"[\s_\-]+", stripped) if token]
    if not tokens:
        return None
    # Значения enum'ов схемы — легитимный доменный контент по определению
    # (chart_type: "line", icon_type: "bold"): они никогда не эхо, даже если
    # совпадают с частями имён полей (прод-инцидент 2026-09-06: chart_type
    # "line" при свойстве panel_line_chart ронял генерацию).
    normalized_value_tokens = {_normalize_term(token) for token in tokens}
    if _normalize_term(stripped) in enum_values or normalized_value_tokens <= enum_values:
        return None
    # Целое значение с другим разделителем («additional_properties») может
    # совпадать с термином схемы, который сам по себе составной.
    compact = _normalize_term(stripped)
    if len(compact) >= 4 and compact in terms and compact not in _COMMON_ECHO_WORDS:
        return "value echoes a response-schema field name"
    if len(tokens) == 1:
        token = _normalize_term(tokens[0])
        # Одиночное слово-термин честно помечаем, только если оно не из
        # числа обычных слов контента, достаточно длинное, чтобы быть
        # схемным («enum» — да, «type» — нет), и является ПОЛНЫМ именем
        # поля/ключевым словом: суб-токены имён («line» из
        # «panel_line_chart») легитимным значениям не запрещены.
        if len(token) >= 4 and token in terms and token not in _COMMON_ECHO_WORDS:
            return "value echoes a response-schema field name"
        return None
    if all(_normalize_term(token) in terms for token in tokens):
        return "value consists of response-schema field names"
    return None


def _normalize_term(value: str) -> str:
    return re.sub(r"[\s_\-]+", "", value).lower()


def _collect_schema_terms(
    response_schema: dict | None,
) -> tuple[frozenset[str], frozenset[str]]:
    """Полные имена полей схемы + ключевые слова JSON Schema и enum-значения.

    Суб-токены имён (panel_line_chart -> «panel», «line») в термины эха не
    входят: они совпадают с легитимными короткими значениями
    (chart_type: "line") и роняли генерацию ложными срабатываниями
    (прод-инцидент 2026-09-06). Составные имена всё равно ловятся
    компактной проверкой целого значения в _schema_echo_reason.
    """
    terms: set[str] = set(_JSON_SCHEMA_KEYWORDS)
    enum_values: set[str] = set()

    def walk(node: Any) -> None:
        if isinstance(node, dict):
            options = node.get("enum")
            if isinstance(options, list):
                for option in options:
                    if isinstance(option, str):
                        enum_values.add(_normalize_term(option))
            properties = node.get("properties")
            if isinstance(properties, dict):
                for name in properties:
                    if isinstance(name, str) and name:
                        terms.add(_normalize_term(name))
                for value in properties.values():
                    walk(value)
            for key, value in node.items():
                if key != "properties":
                    walk(value)
        elif isinstance(node, list):
            for item in node:
                walk(item)

    walk(response_schema)
    return frozenset(terms), frozenset(enum_values)
