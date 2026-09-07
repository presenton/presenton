import json
from copy import deepcopy
from datetime import datetime
from typing import Any

from llmai import get_client
from llmai.shared import JSONSchemaResponse, Message, SystemMessage, UserMessage

from models.presentation_layout import SlideLayoutModel
from models.presentation_outline_model import SlideOutlineModel
from utils.content_quality import get_content_quality_errors
from utils.language_validation import (
    get_language_mismatch_errors,
    resolve_prompt_language,
)
from utils.llm_client_error_handler import handle_llm_client_exceptions
from utils.llm_config import get_llm_config
from utils.llm_provider import get_model
from utils.llm_utils import DisconnectChecker, generate_structured_with_schema_retries
from utils.schema_utils import (
    add_field_in_schema,
    ensure_array_schemas_have_items,
    remove_fields_from_schema,
)

SLIDE_CONTENT_SYSTEM_PROMPT = r"""
You will be given slide content and response schema.
You need to generate structured content json based on the schema.

# Steps
1. Analyze the content.
2. Analyze the response schema.
3. Generate structured content json based on the schema.
4. Generate speaker note if required.
5. Provide structured content json as output.

# General Rules
- Follow language guidelines.
- Slide Language is authoritative when it is explicitly set. If slide content
  or user instructions request a different language, ignore that conflicting
  language request unless Slide Language says auto-detect.
- Speaker notes must be plain text (no markdown).
- Never exceed max character limits; do not clip mid-sentence to fit—rephrase instead.
- Do not use emojis or $schema fields.
- Follow the intended outcome of user instructions when they do not conflict with Slide
  Language; do not generalize or expand their scope.
- Apply slide-specific instructions only to the exact slide mentioned (first/second/last/named) and only once.
- Do not apply patterns across multiple slides unless explicitly requested.
- If instructions are ambiguous, use the most direct interpretation without extending scope.
- Treat chart, layout, styling, positioning, and other visual instructions as production
  controls. Honor them through the selected schema, but never emit those instructions or
  meta-commentary as a title, body, label, table cell, or speaker note.
- Output fields must contain only audience-facing content and data. For chart fields,
  populate the requested labels, series, and values rather than text such as "create a
  bar chart" or "show this data as a graph".
- Every string value is content the audience will read: real facts, names, numbers and
  phrasing in the slide language. Never fill values with response-schema field names or
  JSON-Schema keywords ("minLength", "type object", "additional_properties"), internal
  identifiers ("__tablecard", "__speaker_note__"), generation chatter ("please wait
  while I import...", "some text ..."), placeholder junk ("...", "TBD"), or glued or
  truncated words ("поставщиNo hardware"). If you cannot produce a value, write the
  shortest meaningful content for that field instead.

# Math Expression Rules
- Wrap every LaTeX expression in `<latex>` and `</latex>` inside the generated string.
- Put only valid LaTeX inside the tags and do not include `$`, `$$`, `\(`, or `\[` delimiters.
- Keep surrounding prose outside the tags. Example: `The area is <latex>\pi r^2</latex>.`
- Apply the same rule to strings in text lists and table cells.
- Do not use `<latex>` tags for ordinary text.

{markdown_emphasis_rules}

{user_instructions}

{tone_instructions}

{verbosity_instructions}

{output_fields_instructions}
"""


SLIDE_CONTENT_USER_PROMPT = """
# Current Date and Time:
{current_date_time}

# Icon Query And Image Prompt Language:
English

# Slide Language:
{language}

{slide_number_section}
# SLIDE CONTENT: START
{content}
# SLIDE CONTENT: END
"""

ASSET_ONLY_FIELDS = ["__image_url__", "__icon_url__"]

# Апстрим: мягкие лимиты слов в промпте — цель по 0.8 от жёсткого потолка
# схемы, чтобы провайдер не подрезал текст у самой границы.
SLIDE_CONTENT_LENGTH_RATIO = 0.8

SLIDE_CONTENT_LENGTH_RULES = """

# Character Budget Rules
Treat the maximum shown for every field as an absolute ceiling, counting spaces and punctuation. When minimum and maximum are equal, aim for that exact count; however, if an exact count would require a clipped word, invented abbreviation, padding, repetition, or unsupported fact, use a shorter natural value instead. Never exceed the maximum.

For targets below 10 characters, use a complete familiar word or source-supported label. For longer fields, rephrase with complete natural wording. Before returning JSON, silently check every constrained string and shorten any value over its ceiling. Never invent numbers or measurements.
"""


def _scale_string_length_constraints(
    value: Any,
    *,
    markdown_targets: bool = False,
    remove_min_length: bool = False,
    remove_max_length: bool = False,
) -> Any:
    if isinstance(value, dict):
        scaled = {
            key: _scale_string_length_constraints(
                item,
                markdown_targets=markdown_targets,
                remove_min_length=remove_min_length,
                remove_max_length=remove_max_length,
            )
            for key, item in value.items()
        }
        if scaled.get("type") != "string":
            return scaled

        minimum = scaled.get("minLength")
        if isinstance(minimum, int):
            if remove_min_length:
                scaled.pop("minLength", None)
            else:
                scaled["minLength"] = max(
                    1, int(minimum * SLIDE_CONTENT_LENGTH_RATIO)
                )

        maximum = scaled.get("maxLength")
        if isinstance(maximum, int):
            soft_maximum = max(1, int(maximum * SLIDE_CONTENT_LENGTH_RATIO))
            if remove_max_length:
                scaled.pop("maxLength", None)
            else:
                scaled["maxLength"] = soft_maximum
                if markdown_targets:
                    scaled["minLength"] = soft_maximum
        return scaled

    if isinstance(value, list):
        return [
            _scale_string_length_constraints(
                item,
                markdown_targets=markdown_targets,
                remove_min_length=remove_min_length,
                remove_max_length=remove_max_length,
            )
            for item in value
        ]

    return deepcopy(value)


def build_slide_content_schemas(response_schema: dict) -> tuple[dict, dict, dict]:
    prompt_schema = _scale_string_length_constraints(
        response_schema,
        markdown_targets=True,
    )
    provider_schema = _scale_string_length_constraints(
        response_schema,
        remove_max_length=True,
    )
    validation_schema = _scale_string_length_constraints(
        provider_schema,
        remove_min_length=True,
        remove_max_length=True,
    )
    return prompt_schema, provider_schema, validation_schema


_MAX_SCHEMA_DESCRIPTION_LINES = 60


def _schema_length_bounds(node: dict) -> str:
    """«, 2..6 items» / «, up to 120 chars» / «» — по ограничениям схемы."""
    bounds: list[str] = []
    minimum = node.get("minLength")
    maximum = node.get("maxLength")
    if isinstance(minimum, int) and isinstance(maximum, int):
        bounds.append(f"{minimum}..{maximum} chars")
    elif isinstance(maximum, int):
        bounds.append(f"up to {maximum} chars")
    elif isinstance(minimum, int):
        bounds.append(f"at least {minimum} chars")
    min_items = node.get("minItems")
    max_items = node.get("maxItems")
    if isinstance(min_items, int) and isinstance(max_items, int):
        bounds.append(f"{min_items}..{max_items} items")
    elif isinstance(max_items, int):
        bounds.append(f"up to {max_items} items")
    if not bounds:
        return ""
    return ", " + " and ".join(bounds)


def _schema_enum_options(node: dict) -> str:
    options = node.get("enum")
    if not isinstance(options, list) or not options:
        return ""
    rendered = ", ".join(str(option) for option in options[:8])
    return f" (one of: {rendered})"


def _describe_schema_properties(
    properties: dict,
    lines: list[str],
    depth: int,
) -> None:
    indent = "  " * depth
    for name, node in properties.items():
        if len(lines) >= _MAX_SCHEMA_DESCRIPTION_LINES:
            return
        if not isinstance(node, dict):
            lines.append(f"{indent}- {name}")
            continue
        node_type = node.get("type") or "any"
        description = str(node.get("description") or "").strip()
        suffix = f": {description}" if description else ""
        if node_type == "object":
            child_properties = node.get("properties")
            lines.append(f"{indent}- {name} (object){suffix}")
            if isinstance(child_properties, dict) and child_properties:
                _describe_schema_properties(child_properties, lines, depth + 1)
        elif node_type == "array":
            items = node.get("items")
            if (
                isinstance(items, dict)
                and items.get("type") == "object"
                and isinstance(items.get("properties"), dict)
            ):
                lines.append(
                    f"{indent}- {name} (array of objects){_schema_length_bounds(node)}{suffix}, "
                    "each object with:"
                )
                _describe_schema_properties(items["properties"], lines, depth + 1)
            elif isinstance(items, dict) and items.get("type"):
                lines.append(
                    f"{indent}- {name} (array of {items['type']})"
                    f"{_schema_length_bounds(node)}{suffix}"
                )
            else:
                lines.append(f"{indent}- {name} (array){_schema_length_bounds(node)}{suffix}")
        else:
            lines.append(
                f"{indent}- {name} ({node_type}{_schema_length_bounds(node)})"
                f"{_schema_enum_options(node)}{suffix}"
            )


def _describe_response_schema(response_schema: dict) -> str | None:
    """Человекочитаемый список полей вместо сырого JSON-дампа.

    Сырой дамп в промпте даёт модели готовый словарь для попугайства:
    прод-кейс 2026-09-05 — таблица, чьи ячейки повторяли «minLength»,
    «type object» и «additional_properties» из дампа схемы. Если описание
    не собралось, вызывающий код откатывается к сырому дампу.
    """
    properties = response_schema.get("properties")
    if not isinstance(properties, dict) or not properties:
        return None
    lines: list[str] = []
    _describe_schema_properties(properties, lines, 0)
    if not lines or len(lines) >= _MAX_SCHEMA_DESCRIPTION_LINES:
        return None
    return "\n".join(lines)


def _get_schema_markdown(response_schema: dict | None) -> str:
    if not response_schema:
        return "- Follow the provided response schema strictly."
    described = _describe_response_schema(response_schema)
    if described:
        return (
            "- Follow this response schema. Fields (name, type, character limits, "
            f"meaning):\n{described}"
        )
    try:
        schema_text = json.dumps(response_schema, ensure_ascii=False)
    except Exception:
        return "- Follow the provided response schema strictly."
    return f"- Follow this response schema exactly: {schema_text}"


def get_system_prompt(
    tone: str | None = None,
    verbosity: str | None = None,
    instructions: str | None = None,
    response_schema: dict | None = None,
):
    markdown_emphasis_rules = (
        "- Strictly use markdown to emphasize important points, by bolding or "
        "italicizing the part of text."
    )

    user_instructions = f"# User Instructions:\n{instructions}" if instructions else ""
    tone_instructions = f"# Tone Instructions:\nMake slide as {tone} as possible." if tone else ""

    verbosity_instructions = ""
    if verbosity:
        verbosity_instructions = "# Verbosity Instructions:\n"
        if verbosity == "concise":
            verbosity_instructions += "Make slide as concise as possible."
        elif verbosity == "standard":
            verbosity_instructions += "Make slide as standard as possible."
        elif verbosity == "text-heavy":
            verbosity_instructions += "Make slide as text-heavy as possible."

    output_fields_instructions = "# Output Fields:\n" + _get_schema_markdown(response_schema)

    system_prompt = SLIDE_CONTENT_SYSTEM_PROMPT.format(
        markdown_emphasis_rules=markdown_emphasis_rules,
        user_instructions=user_instructions,
        tone_instructions=tone_instructions,
        verbosity_instructions=verbosity_instructions,
        output_fields_instructions=output_fields_instructions,
    )
    return system_prompt + SLIDE_CONTENT_LENGTH_RULES


def _get_slide_number_section(slide_number: int | None) -> str:
    if slide_number is None:
        return ""
    return f"# Slide Number:\n{slide_number}\n"


def get_user_prompt(outline: str, language: str | None, slide_number: int | None = None):
    return SLIDE_CONTENT_USER_PROMPT.format(
        current_date_time=datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        language=resolve_prompt_language(language),
        slide_number_section=_get_slide_number_section(slide_number),
        content=outline,
    )


def get_messages(
    outline: str,
    language: str | None,
    tone: str | None = None,
    verbosity: str | None = None,
    instructions: str | None = None,
    response_schema: dict | None = None,
    *,
    slide_number: int | None = None,
) -> list[Message]:

    return [
        SystemMessage(
            content=get_system_prompt(
                tone,
                verbosity,
                instructions,
                response_schema,
            ),
        ),
        UserMessage(
            content=get_user_prompt(outline, language, slide_number),
        ),
    ]


def _schema_has_content_fields(response_schema: dict | None) -> bool:
    if not isinstance(response_schema, dict):
        return False

    properties = response_schema.get("properties")
    return isinstance(properties, dict) and bool(properties)


def _prepare_response_schema(json_schema: dict | None) -> dict | None:
    if not isinstance(json_schema, dict):
        return None

    response_schema = remove_fields_from_schema(json_schema, ASSET_ONLY_FIELDS)
    if not _schema_has_content_fields(response_schema):
        return None

    if response_schema.get("type") != "object":
        response_schema["type"] = "object"

    response_schema = add_field_in_schema(
        response_schema,
        {
            "__speaker_note__": {
                "type": "string",
                "minLength": 100,
                "maxLength": 500,
                "description": "Speaker note for the slide",
            }
        },
        True,
    )
    return ensure_array_schemas_have_items(response_schema)


def _content_validator(response_schema: dict, language: str | None):
    """Контент-QC + языковая валидация для ретрай-цикла.

    Language Detection как промежуточный шаг перед рендерингом: текст не на
    запрошенном языке уходит модели на переделку вместе с качественными
    ошибками, а не доезжает до слайда.
    """

    def validate(content: dict) -> list[str]:
        return [
            *get_content_quality_errors(response_schema, content),
            *get_language_mismatch_errors(content, language),
        ]

    return validate


async def get_slide_content_from_type_and_outline(
    slide_layout: SlideLayoutModel,
    outline: SlideOutlineModel,
    language: str | None,
    tone: str | None = None,
    verbosity: str | None = None,
    instructions: str | None = None,
    *,
    slide_number: int | None = None,
    disconnect_checker: DisconnectChecker | None = None,
):
    response_schema = _prepare_response_schema(slide_layout.json_schema)
    if response_schema is None:
        return {}

    prompt_schema, provider_schema, validation_schema = build_slide_content_schemas(
        response_schema
    )

    client = get_client(config=get_llm_config())
    model = get_model()

    try:
        response_format = JSONSchemaResponse(
            name="response",
            json_schema=provider_schema,
            strict=True,
        )
        messages = get_messages(
            outline.content,
            language,
            tone,
            verbosity,
            instructions,
            prompt_schema,
            slide_number=slide_number,
        )

        return await generate_structured_with_schema_retries(
            client,
            model,
            messages=messages,
            response_format=response_format,
            json_schema=validation_schema,
            strict=False,
            validate_schema=True,
            content_validator=_content_validator(response_schema, language),
            disconnect_checker=disconnect_checker,
        )

    except Exception as e:
        raise handle_llm_client_exceptions(e)
