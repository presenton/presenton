import asyncio
import copy
from datetime import datetime
import json
import logging
import random
import re
import traceback
from typing import Annotated, Any, List, Literal, Optional, Tuple
import dirtyjson
from fastapi import (
    APIRouter,
    BackgroundTasks,
    Body,
    Depends,
    HTTPException,
    Path,
    Query,
    Request,
)
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select
from constants.presentation import MAX_NUMBER_OF_SLIDES
from enums.async_task_status import AsyncTaskStatus
from enums.webhook_event import WebhookEvent
from models.api_error_model import APIErrorModel
from models.generate_presentation_request import GeneratePresentationRequest
from models.presentation_and_path import PresentationPathAndEditPath
from models.presentation_from_template import EditPresentationRequest
from models.presentation_outline_model import (
    PresentationOutlineModel,
    SlideOutlineModel,
)
from enums.tone import Tone
from enums.verbosity import Verbosity
from models.presentation_structure_model import PresentationStructureModel
from models.presentation_with_slides import (
    PresentationWithSlides,
)
from services.documents_loader import DocumentsLoader
from services.chat.slide_ui_helpers import _normalize_generated_image_fit
from services.temp_file_service import TEMP_FILE_SERVICE
from services.webhook_service import WebhookService
from services.image_generation_service import ImageGenerationService
from services.mem0_presentation_memory_service import (
    MEM0_PRESENTATION_MEMORY_SERVICE,
)
from utils.dict_utils import deep_update
from utils.export_utils import export_presentation
from utils.mcp_public_urls import absolute_mcp_result_links
from utils.llm_calls.generate_presentation_outlines import (
    generate_ppt_outline,
    get_messages as get_outline_messages,
)
from models.sql.slide import SlideModel
from models.sse_response import (
    SSECompleteResponse,
    SSEErrorResponse,
    SSEResponse,
    SSEStatusResponse,
)

from services.database import get_async_session
from services.database import async_session_maker
from services.concurrent_service import CONCURRENT_SERVICE
from models.sql.presentation import PresentationModel, PresentationVersion
from models.sql.template_v2 import TemplateV2
from models.sql.async_task import AsyncTaskModel
from utils.asset_directory_utils import get_images_directory
from utils.llm_calls.generate_presentation_structure import (
    generate_presentation_structure,
)
from utils.llm_calls.generate_slide_content import (
    get_slide_content_from_type_and_outline,
)
from utils.latex_text import parse_latex_tags, replace_text_runs
from utils.ppt_utils import (
    select_toc_or_list_slide_layout_index,
)
from utils.outline_utils import (
    get_images_for_slides_from_outline,
    get_no_of_outlines_to_generate_for_n_slides,
    get_no_of_toc_required_for_n_outlines,
    get_presentation_outline_model_with_toc,
    get_presentation_title_from_presentation_outline,
)
from utils.outline_limits import normalize_outline_payload
from utils.process_slides import (
    process_slide_add_placeholder_assets,
    process_slide_and_fetch_assets,
)
from utils.icon_weights import DEFAULT_ICON_TYPE, extract_icon_type_from_settings
from utils.llm_utils import TextGenerationMetrics, message_content_to_text
from utils.sse import safe_sse_stream
from api.v1.auth.config import SESSION_COOKIE_NAME
from utils.web_search import get_selected_web_search_provider, get_web_search_route
from utils.web_search import build_web_search_query, get_web_search_context
from api.v1.auth.context import (
    get_current_owner_id,
    reset_current_owner_id,
    reset_current_owner_is_admin,
    set_current_owner_id,
    set_current_owner_is_admin,
)
from models.presentation_layout import PresentationLayoutModel, SlideLayoutModel
from templates.v2.schema import get_template_schema
from templates.v2.content import (
    hydrate_repeated_top_level_groups,
    repeated_child_source_index,
)
from templates.v2.theme import template_theme_for_presentation
from templates.default_templates import resolve_default_template_id
from services.community_presentations import (
    build_community_design_context,
    load_community_references,
    merge_reference_fonts,
    normalize_community_ids,
)
from utils.llm_calls.generate_smart_presentation import (
    generate_smart_presentation,
    resolve_smart_slide_count,
)
import uuid

logger = logging.getLogger(__name__)


PRESENTATION_ROUTER = APIRouter(prefix="/presentation", tags=["Presentation"])
ASYNC_TASK_TYPE_PRESENTATION_GENERATE = "presentation.generate"
CUSTOM_TEMPLATE_PREFIX = "custom-"
BLANK_PRESENTATION_LAYOUT_GROUP = "blank"
BLANK_PRESENTATION_LAYOUT_ID = "__blank_slide__"
BLANK_PRESENTATION_SLIDE_UI: dict[str, Any] = {
    "id": BLANK_PRESENTATION_LAYOUT_ID,
    "description": "Empty slide.",
    "background": "#FFFFFF",
    "components": [],
    "elements": [
        {
            "type": "vector",
            "shape": "polygon",
            "points": [
                {"x": 0, "y": 0},
                {"x": 1280, "y": 0},
                {"x": 1280, "y": 720},
                {"x": 0, "y": 720},
            ],
            "closed": True,
            "fill": {"color": "#FFFFFF"},
            "decorative": True,
        }
    ],
}


class PresentationPrepareResponse(BaseModel):
    presentation_id: uuid.UUID


def _blank_presentation_slide_ui() -> dict[str, Any]:
    return copy.deepcopy(BLANK_PRESENTATION_SLIDE_UI)


def presentation_task_progress_data(
    created_slides: int,
    remaining_slides: int,
    presentation_id: Optional[uuid.UUID | str] = None,
) -> dict[str, Any]:
    data: dict[str, Any] = {
        "created_slides": max(created_slides, 0),
        "remaining_slides": max(remaining_slides, 0),
    }
    # Carried from the moment the task is created, so a polling caller can
    # identify the presentation even while it is still generating -- and,
    # more importantly, after a task ends in error, when there is no
    # response body to learn it from.
    if presentation_id is not None:
        data["presentation_id"] = str(presentation_id)
    return data


def _requested_slide_count(request: GeneratePresentationRequest) -> int:
    if request.slides_markdown:
        return len(request.slides_markdown)
    return request.n_slides or 0


def _template_reference(template_id: str) -> str:
    return template_id


def _extract_template_id(value: Optional[str]) -> Optional[str]:
    if not isinstance(value, str):
        return None

    candidate = value.strip()
    if not candidate:
        return None
    if candidate.startswith(CUSTOM_TEMPLATE_PREFIX):
        candidate = candidate[len(CUSTOM_TEMPLATE_PREFIX) :].strip()
    return candidate or None


async def _resolve_requested_template(
    template_name: str,
    sql_session: AsyncSession,
) -> Optional[TemplateV2]:
    template_id = _extract_template_id(template_name)
    if not template_id:
        return None

    template = await sql_session.get(TemplateV2, template_id)
    if template:
        return template
    if resolve_default_template_id(template_name):
        return None

    raise HTTPException(
        status_code=400,
        detail="Template not found. Please use a valid template.",
    )


def _copy_template_layout_payload(
    template: TemplateV2,
) -> dict[str, Any]:
    layout_payload = copy.deepcopy(template.layouts)
    if not isinstance(layout_payload, dict):
        raise HTTPException(
            status_code=400,
            detail="Template layout JSON must be an object",
        )

    icon_type = _template_icon_type(template, layout_payload)
    layout_payload["icon_type"] = icon_type
    layout_payload["icon_weight"] = icon_type
    layout_payload["name"] = _template_reference(template.id)
    layout_payload["template_id"] = template.id
    return layout_payload


def _template_icon_type(
    template: TemplateV2,
    layout_payload: dict[str, Any] | None = None,
) -> str:
    for settings in (template.assets, layout_payload, template.layouts):
        if isinstance(settings, dict):
            icon_type = extract_icon_type_from_settings(settings)
            if icon_type != DEFAULT_ICON_TYPE:
                return icon_type
    return DEFAULT_ICON_TYPE


async def _resolve_generation_layout(
    template_name: str,
    sql_session: AsyncSession,
) -> tuple[
    dict[str, Any],
    PresentationLayoutModel,
    Optional[dict[str, str]],
    Optional[dict[str, Any]],
]:
    template = await _resolve_requested_template(template_name, sql_session)
    if template is None:
        bundled_template_id = resolve_default_template_id(template_name)
        if not bundled_template_id:
            raise HTTPException(
                status_code=400,
                detail="Template not found. Please use a valid template.",
            )
        template = await sql_session.get(TemplateV2, bundled_template_id)
        if not template:
            raise HTTPException(
                status_code=503,
                detail=(
                    f"Bundled template '{template_name}' is not available. "
                    "Restart the service to import bundled templates."
                ),
            )
        logger.info(
            "[presentation.generate] resolved bundled template alias "
            "name=%r template_id=%s",
            template_name,
            bundled_template_id,
        )

    layout_payload = _copy_template_layout_payload(template)
    return (
        layout_payload,
        _build_template_structure_layout(template, layout_payload),
        _extract_template_fonts_from_assets(template.assets),
        template_theme_for_presentation(
            template_id=template.id,
            template_name=template.name,
            template_description=template.description,
            theme=template.theme,
        ),
    )


def _hydrate_template_slide_ui(
    slide: SlideModel,
    layout_payload: Any = None,
) -> None:
    if not _is_template_layout_payload(layout_payload):
        return

    ui = slide.ui
    if not isinstance(ui, dict):
        ui = _template_slide_ui(layout_payload, slide.layout)
    slide.ui = _apply_template_content_to_ui(ui, slide.content)


def _coerce_presentation_font_map(value: Any) -> Optional[dict[str, str]]:
    if not isinstance(value, dict):
        return None

    fonts = {
        name.strip(): url.strip()
        for name, url in value.items()
        if isinstance(name, str)
        and isinstance(url, str)
        and name.strip()
        and url.strip()
    }
    return fonts or None


def _extract_template_fonts_from_assets(assets: Any) -> Optional[dict[str, str]]:
    if not isinstance(assets, dict):
        return None
    return _coerce_presentation_font_map(assets.get("fonts"))


def _presentation_response_data(presentation: PresentationModel) -> dict:
    data = presentation.model_dump(exclude={"layout", "structure"})
    data["type"] = (
        "smart" if presentation.generation_mode == "smart" else "standard"
    )
    return data


def _insert_toc_layouts(
    structure: PresentationStructureModel,
    n_toc_slides: int,
    include_title_slide: bool,
    toc_slide_layout_index: int,
):
    if n_toc_slides <= 0 or toc_slide_layout_index == -1:
        return

    insertion_index = 1 if include_title_slide else 0
    for i in range(n_toc_slides):
        structure.slides.insert(insertion_index + i, toc_slide_layout_index)


def _layout_count(layout_payload: Any) -> int:
    if isinstance(layout_payload, dict):
        layouts = layout_payload.get("layouts", layout_payload.get("slides"))
        return len(layouts) if isinstance(layouts, list) else 0
    if isinstance(layout_payload, list):
        return len(layout_payload)
    return 0


def _normalize_presentation_structure(
    structure: PresentationStructureModel,
    *,
    outline_count: int,
    layout_count: int,
) -> PresentationStructureModel:
    """Keep prepared structure indexes safe for the streaming endpoint.

    Structured LLM responses can still contain too few indexes or indexes
    outside the available layout range. Fill or replace those selections
    before persisting the prepared presentation so streaming cannot reject
    data that ``/prepare`` accepted.
    """
    normalized = list(structure.slides[:outline_count])
    while len(normalized) < outline_count:
        normalized.append(random.randrange(layout_count))

    structure.slides = [
        layout_index
        if 0 <= layout_index < layout_count
        else random.randrange(layout_count)
        for layout_index in normalized
    ]
    return structure


def _build_template_layout_model(
    layout_payload: dict[str, Any],
    *,
    layout_name: str,
) -> PresentationLayoutModel:
    try:
        template_schema = get_template_schema(layout_payload)
    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid template layout JSON: {exc}",
        ) from exc

    source_layouts = layout_payload.get("layouts")
    if not isinstance(source_layouts, list):
        source_layouts = []

    slides: list[SlideLayoutModel] = []
    for index, schema_layout in enumerate(template_schema["layouts"]):
        if not isinstance(schema_layout, dict):
            continue

        source_layout = (
            source_layouts[index]
            if index < len(source_layouts) and isinstance(source_layouts[index], dict)
            else {}
        )
        layout_id = (
            schema_layout.get("layout_id")
            or source_layout.get("id")
            or f"layout_{index + 1}"
        )
        layout_schema = schema_layout.get("schema")
        if not isinstance(layout_schema, dict):
            layout_schema = {
                "title": str(layout_id),
                "description": source_layout.get("description"),
            }

        slides.append(
            SlideLayoutModel(
                id=str(layout_id),
                name=source_layout.get("name") or layout_schema.get("title"),
                description=source_layout.get("description")
                or layout_schema.get("description"),
                json_schema=layout_schema,
            )
        )

    if not slides:
        raise HTTPException(
            status_code=400,
            detail="Template layout JSON must contain at least one layout",
        )

    return PresentationLayoutModel(
        name=layout_name,
        ordered=False,
        icon_type=extract_icon_type_from_settings(layout_payload),
        slides=slides,
    )


def _build_template_structure_layout(
    template: TemplateV2,
    layout_payload: dict[str, Any],
) -> PresentationLayoutModel:
    return _build_template_layout_model(
        layout_payload,
        layout_name=_template_reference(template.id),
    )


def _is_template_layout_payload(layout_payload: Any) -> bool:
    return (
        isinstance(layout_payload, dict)
        and isinstance(layout_payload.get("layouts"), list)
    )


def _template_slide_ui(
    layout_payload: Any,
    layout_id: str,
) -> Optional[dict[str, Any]]:
    if not _is_template_layout_payload(layout_payload):
        return None

    for layout in layout_payload["layouts"]:
        if isinstance(layout, dict) and str(layout.get("id")) == str(layout_id):
            return copy.deepcopy(layout)
    return None


GENERATED_VALUE_ELEMENT_TYPES = {
    "text",
    "math",
    "image",
    "text-list",
    "table",
    "chart",
    "infographic",
}
GENERATED_TABLE_TEXT_FONT = {
    "family": "Sniglet",
    "size": 12,
    "color": "#082314",
}
GENERATED_TABLE_HEADER_FONT = {
    **GENERATED_TABLE_TEXT_FONT,
    "bold": True,
}
GENERATED_TABLE_CELL_FILL = {
    "color": "#F8F4E9",
    "opacity": 1,
}
GENERATED_TABLE_CELL_STROKE = {
    "color": "#D8D3C4",
    "opacity": 1,
    "width": 1,
}
TEMPLATE_STRONG_MARKDOWN_DELIMITERS = ("**", "__")
TEMPLATE_EMPHASIS_MARKDOWN_DELIMITERS = ("*", "_")
TEMPLATE_MARKDOWN_DELIMITERS = (
    *TEMPLATE_STRONG_MARKDOWN_DELIMITERS,
    *TEMPLATE_EMPHASIS_MARKDOWN_DELIMITERS,
)


def _template_component_content_keys(components: list[Any]) -> list[str]:
    ids: list[str] = []
    for index, component in enumerate(components):
        component_id = (
            component.get("id")
            if isinstance(component, dict) and isinstance(component.get("id"), str)
            else None
        )
        ids.append(component_id or f"component_{index}")

    counts: dict[str, int] = {}
    for component_id in ids:
        counts[component_id] = counts.get(component_id, 0) + 1

    indexes: dict[str, int] = {}
    used: set[str] = set()
    keys: list[str] = []
    for component_id in ids:
        occurrence_index = indexes.get(component_id, 0)
        indexes[component_id] = occurrence_index + 1
        base = (
            f"{component_id}_{occurrence_index}"
            if counts.get(component_id, 0) > 1
            else component_id
        )

        key = base
        suffix = 1
        while key in used:
            key = f"{base}_{suffix}"
            suffix += 1
        used.add(key)
        keys.append(key)

    return keys


def _apply_template_content_to_ui(
    ui: Optional[dict[str, Any]],
    content: dict[str, Any],
) -> Optional[dict[str, Any]]:
    if not isinstance(ui, dict):
        return ui

    components = ui.get("components")
    if not isinstance(components, list) or not components:
        return ui

    component_keys = _template_component_content_keys(components)
    hydrated_ui = copy.deepcopy(ui)
    hydrated_components = hydrated_ui.get("components")
    if not isinstance(hydrated_components, list):
        return hydrated_ui

    for index, component in enumerate(hydrated_components):
        if not isinstance(component, dict):
            continue

        component_id = component.get("id")
        component_content = content.get(component_keys[index])
        if not isinstance(component_content, dict) and isinstance(component_id, str):
            component_content = content.get(component_id)
        if not isinstance(component_content, dict):
            component_content = {}

        elements = component.get("elements")
        if isinstance(elements, list):
            repeated_groups = hydrate_repeated_top_level_groups(
                elements,
                component_content,
                apply_item=lambda element, item: _apply_template_content_to_element(
                    element,
                    item,
                    direct_value=True,
                ),
            )
            component["elements"] = (
                repeated_groups
                if repeated_groups is not None
                else _apply_template_content_to_element_list(
                    elements,
                    component_content,
                )
            )

    return hydrated_ui


def _apply_template_content_to_element(
    element: Any,
    content: Any,
    *,
    direct_value: bool = False,
    preferred_content_keys: list[str] | None = None,
    name_occurrences: dict[str, int] | None = None,
) -> Any:
    if not isinstance(element, dict):
        return element

    content_values = content if isinstance(content, dict) else {}
    element_type = element.get("type")
    name = element.get("name") if isinstance(element.get("name"), str) else None
    has_value = False
    value = None
    if name:
        if preferred_content_keys is None and name_occurrences is not None:
            preferred_content_keys = _template_repeated_content_keys_for_name(
                name,
                content_values,
                name_occurrences,
            )
        has_value, value = _template_content_value(
            content_values,
            name,
            preferred_keys=preferred_content_keys,
        )

    if (
        element.get("decorative") is False
        and name
        and has_value
        and element_type in GENERATED_VALUE_ELEMENT_TYPES
    ):
        return _apply_template_content_value(element, value)

    # Repeated flex/grid schemas omit the child-name wrapper when an item is a
    # direct generated value. For example, three image children are emitted as
    # [{"image_prompt": ..., "image_url": ...}, ...], not as
    # [{"gallery_photo": {...}}, ...]. In that case the array item itself is
    # the value for the child element.
    if (
        direct_value
        and not has_value
        and element.get("decorative") is False
        and element_type in GENERATED_VALUE_ELEMENT_TYPES
    ):
        return _apply_template_content_value(element, content)

    nested_content = value if isinstance(value, dict) else content_values
    nested_direct_value = direct_value and not has_value
    nested_name_occurrences = (
        {}
        if has_value and isinstance(value, dict)
        else name_occurrences
    )

    if element_type == "container":
        updated = copy.deepcopy(element)
        updated["child"] = _apply_template_content_to_element(
            element.get("child"),
            nested_content,
            direct_value=nested_direct_value,
            name_occurrences=nested_name_occurrences,
        )
        return updated

    if element_type in {"flex", "grid", "group"}:
        updated = copy.deepcopy(element)
        children = element.get("children")
        if not isinstance(children, list):
            children = []
        updated["children"] = _apply_template_content_to_children(
            children,
            value,
            nested_content,
            direct_value=nested_direct_value,
            name_occurrences=nested_name_occurrences,
            center_repeated_children=element_type == "group",
        )
        return updated

    return copy.deepcopy(element)


def _template_content_value(
    content: dict[str, Any],
    name: str,
    *,
    preferred_keys: list[str] | None = None,
) -> tuple[bool, Any]:
    candidates: list[str] = []
    for candidate in [
        *(preferred_keys or []),
        *_template_content_name_candidates(name),
    ]:
        if candidate and candidate not in candidates:
            candidates.append(candidate)

    for candidate in candidates:
        if candidate in content:
            return True, content[candidate]
    return False, None


def _template_content_name_candidates(name: str) -> list[str]:
    without_numeric_token = re.sub(r"_\d+(?=_|$)", "", name)
    without_prefix = (
        without_numeric_token.split("_", 1)[1]
        if "_" in without_numeric_token
        else without_numeric_token
    )

    candidates = []
    for candidate in (name, without_numeric_token, without_prefix):
        if candidate and candidate not in candidates:
            candidates.append(candidate)
    return candidates


def _apply_template_content_to_children(
    children: list[Any],
    value: Any,
    content: Any,
    *,
    direct_value: bool = False,
    name_occurrences: dict[str, int] | None = None,
    center_repeated_children: bool = False,
) -> list[Any]:
    if isinstance(value, list) and children:
        return [
            _apply_template_content_to_element(
                _repeated_child_for_index(
                    children,
                    index,
                    content_count=len(value),
                    center_when_reduced=center_repeated_children,
                ),
                item,
                direct_value=True,
            )
            for index, item in enumerate(value)
        ]

    return _apply_template_content_to_element_list(
        children,
        content,
        direct_value=direct_value,
        name_occurrences=name_occurrences,
    )


def _repeated_child_for_index(
    children: list[Any],
    index: int,
    *,
    content_count: int,
    center_when_reduced: bool,
) -> Any:
    source_index = repeated_child_source_index(
        index,
        template_count=len(children),
        content_count=content_count,
        center_when_reduced=center_when_reduced,
    )
    source = copy.deepcopy(children[source_index])
    if not isinstance(source, dict):
        return source

    source.pop("__presenton_manual_position", None)
    if index >= len(children):
        _normalize_repeated_names(source, index)
    return source


def _normalize_repeated_names(value: Any, index: int) -> None:
    if isinstance(value, list):
        for item in value:
            _normalize_repeated_names(item, index)
        return

    if not isinstance(value, dict):
        return

    name = value.get("name")
    if isinstance(name, str):
        value["name"] = re.sub(r"_\d+(?=_|$)", f"_{index + 1}", name)

    for nested in value.values():
        _normalize_repeated_names(nested, index)


def _apply_template_content_to_element_list(
    elements: list[Any],
    content: Any,
    *,
    direct_value: bool = False,
    name_occurrences: dict[str, int] | None = None,
) -> list[Any]:
    scoped_name_occurrences = name_occurrences if name_occurrences is not None else {}
    hydrated_elements: list[Any] = []
    for element in elements:
        hydrated_elements.append(
            _apply_template_content_to_element(
                element,
                content,
                direct_value=direct_value,
                name_occurrences=scoped_name_occurrences,
            )
        )
    return hydrated_elements


def _template_repeated_content_keys_for_name(
    name: str,
    content: dict[str, Any],
    name_occurrences: dict[str, int],
) -> list[str] | None:
    occurrence_index = name_occurrences.get(name, 0)
    name_occurrences[name] = occurrence_index + 1
    if occurrence_index == 0:
        return None

    suffixed_key = f"{name}_{occurrence_index + 1}"
    return [suffixed_key] if suffixed_key in content else None


def _apply_template_content_value(element: dict[str, Any], value: Any) -> dict[str, Any]:
    element_type = element.get("type")
    if element_type == "text":
        return _apply_template_text_content(element, value)
    if element_type == "math":
        return _apply_template_math_content(element, value)
    if element_type == "image":
        return _apply_template_image_content(element, value)
    if element_type == "text-list":
        return _apply_template_text_list_content(element, value)
    if element_type == "table":
        return _apply_template_table_content(element, value)
    if element_type == "chart":
        return _apply_template_chart_content(element, value)
    if element_type == "infographic":
        return _apply_template_infographic_content(element, value)
    return copy.deepcopy(element)


def _apply_template_infographic_content(
    element: dict[str, Any],
    value: Any,
) -> dict[str, Any]:
    updated = copy.deepcopy(element)
    if not isinstance(value, dict):
        return updated

    data = value.get("data")
    if isinstance(data, dict):
        current_data = updated.get("data")
        if isinstance(current_data, dict):
            incoming_data = copy.deepcopy(data)
            current_type = current_data.get("type")
            if isinstance(current_type, str):
                incoming_data["type"] = current_type
            updated["data"] = {
                **copy.deepcopy(current_data),
                **incoming_data,
            }
        else:
            updated["data"] = copy.deepcopy(data)

    colors = value.get("colors")
    if isinstance(colors, list) and colors:
        updated["colors"] = copy.deepcopy(colors)
    return updated


def _apply_template_math_content(
    element: dict[str, Any],
    value: Any,
) -> dict[str, Any]:
    latex = _read_template_text(value)
    if latex is None or latex.strip() == "":
        return copy.deepcopy(element)

    normalized = latex.strip()
    if normalized.startswith("$$") and normalized.endswith("$$") and len(normalized) > 4:
        normalized = normalized[2:-2].strip()
    elif normalized.startswith(r"\[") and normalized.endswith(r"\]") and len(normalized) > 4:
        normalized = normalized[2:-2].strip()

    updated = copy.deepcopy(element)
    updated["latex"] = normalized[:4000]
    return updated


def _read_template_text(value: Any) -> Optional[str]:
    if isinstance(value, str):
        return value
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        return str(value)
    if isinstance(value, dict):
        text = value.get("text")
        if isinstance(text, str):
            return text
        if isinstance(text, (int, float)) and not isinstance(text, bool):
            return str(text)
    return None


def _apply_template_text_content(
    element: dict[str, Any],
    value: Any,
) -> dict[str, Any]:
    text = _read_template_text(value)
    if text is None or text == "":
        return copy.deepcopy(element)

    updated = copy.deepcopy(element)
    first_run = _first_template_text_run(element.get("runs"))
    updated["runs"] = _template_text_runs_from_markdown(
        text,
        first_run,
        fallback_font=element.get("font"),
    )
    updated.pop("text", None)
    return updated


def _apply_template_image_content(
    element: dict[str, Any],
    value: Any,
) -> dict[str, Any]:
    if not isinstance(value, dict):
        return copy.deepcopy(element)

    url = None
    for key in ("image_url", "icon_url", "__image_url__", "__icon_url__", "url"):
        candidate = value.get(key)
        if isinstance(candidate, str) and candidate:
            url = candidate
            break

    if not url:
        return copy.deepcopy(element)

    updated = copy.deepcopy(element)
    updated["data"] = url
    _normalize_generated_image_fit(updated, url)
    prompt = _template_asset_prompt(value, element.get("is_icon") is True)
    if prompt:
        updated["prompt"] = prompt
    return updated


def _template_asset_prompt(value: Any, is_icon: bool) -> Optional[str]:
    if not isinstance(value, dict):
        return None

    prompt_keys = (
        ("icon_query", "__icon_query__", "query", "prompt")
        if is_icon
        else ("image_prompt", "__image_prompt__", "prompt", "query")
    )
    for key in prompt_keys:
        prompt = value.get(key)
        if isinstance(prompt, str) and prompt.strip():
            return prompt
    return None


def _apply_template_text_list_content(
    element: dict[str, Any],
    value: Any,
) -> dict[str, Any]:
    if not isinstance(value, list):
        return copy.deepcopy(element)

    existing_items = element.get("items")
    if not isinstance(existing_items, list):
        existing_items = []

    items = []
    for index, item in enumerate(value):
        text = _read_template_text(item)
        if text is not None and text != "":
            existing_runs = (
                existing_items[index]
                if index < len(existing_items) and isinstance(existing_items[index], list)
                else None
            )
            first_run = (
                existing_runs[0]
                if isinstance(existing_runs, list)
                and existing_runs
                and isinstance(existing_runs[0], dict)
                else {}
            )
            items.append(
                _template_text_runs_from_markdown(
                    text,
                    first_run,
                    fallback_font=element.get("font"),
                )
            )

    updated = copy.deepcopy(element)
    updated["items"] = items
    return updated


def _apply_template_table_content(
    element: dict[str, Any],
    value: Any,
) -> dict[str, Any]:
    if not isinstance(value, dict):
        return copy.deepcopy(element)

    template_columns = element.get("columns")
    if not isinstance(template_columns, list):
        template_columns = []
    template_rows = [
        row
        for row in element.get("rows", [])
        if isinstance(row, list)
    ]

    generated_columns = [
        _read_template_table_text(item)
        for item in value.get("columns", [])
    ] if isinstance(value.get("columns"), list) else []
    generated_rows = [
        [_read_template_table_text(cell) for cell in row]
        for row in value.get("rows", [])
        if isinstance(row, list)
    ] if isinstance(value.get("rows"), list) else []
    fallback_row = template_rows[-1] if template_rows else template_columns

    updated = copy.deepcopy(element)
    updated["columns"] = (
        _merge_template_table_row_to_length(
            template_columns,
            generated_columns,
            is_header=True,
        )
        if generated_columns
        else copy.deepcopy(template_columns)
    )
    updated["rows"] = (
        [
            _merge_template_table_row_to_length(
                template_rows[index] if index < len(template_rows) else fallback_row,
                row,
                is_header=False,
            )
            for index, row in enumerate(generated_rows)
        ]
        if generated_rows
        else copy.deepcopy(template_rows)
    )
    return updated


def _merge_template_table_row_to_length(
    template_cells: list[Any],
    generated_texts: list[Optional[str]],
    *,
    is_header: bool,
) -> list[Any]:
    fallback_cell = template_cells[-1] if template_cells else None
    return [
        _replace_template_table_cell_text(
            template_cells[index] if index < len(template_cells) else fallback_cell,
            text or "",
            is_header=is_header,
        )
        for index, text in enumerate(generated_texts)
    ]


def _replace_template_table_cell_text(
    cell: Any,
    text: str,
    *,
    is_header: bool,
) -> dict[str, Any]:
    font = GENERATED_TABLE_HEADER_FONT if is_header else GENERATED_TABLE_TEXT_FONT
    if not isinstance(cell, dict):
        return {
            "color": GENERATED_TABLE_CELL_FILL,
            "stroke": GENERATED_TABLE_CELL_STROKE,
            "font": font,
            "runs": _template_text_runs_from_markdown(
                text,
                {"font": font},
            ),
        }

    updated = copy.deepcopy(cell)
    first_run = _first_template_text_run(cell.get("runs"))
    run_font = first_run.get("font") if isinstance(first_run.get("font"), dict) else None
    next_font = run_font or cell.get("font") or font
    updated["color"] = cell.get("color") or cell.get("fill") or GENERATED_TABLE_CELL_FILL
    updated["stroke"] = cell.get("stroke") or GENERATED_TABLE_CELL_STROKE
    updated["font"] = cell.get("font") or next_font
    updated["runs"] = _template_text_runs_from_markdown(
        text,
        first_run,
        fallback_font=next_font,
    )
    updated.pop("text", None)
    updated.pop("fill", None)
    return updated


def _first_template_text_run(runs: Any) -> dict[str, Any]:
    if isinstance(runs, list) and runs and isinstance(runs[0], dict):
        return runs[0]
    return {}


def _template_text_runs_from_markdown(
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
    parsed = _parse_template_markdown_text(text)
    has_markdown_style = any(style for _parsed_text, style in parsed)
    base_run = _template_base_run_for_markdown(
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
        _append_template_text_run(text_runs, run)

    if text_runs:
        return text_runs
    return [{**base_run, "text": " "}]


def _template_base_run_for_markdown(
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


def _parse_template_markdown_text(
    text: str,
) -> list[tuple[str, dict[str, bool]]]:
    parsed: list[tuple[str, dict[str, bool]]] = []
    index = 0

    while index < len(text):
        strong_delimiter = _template_read_markdown_delimiter(
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

        emphasis_delimiter = _template_read_markdown_delimiter(
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

        next_index = _template_next_markdown_delimiter_index(text, index + 1)
        parsed.append(
            (
                text[index : len(text) if next_index == -1 else next_index],
                {},
            )
        )
        index = len(text) if next_index == -1 else next_index

    return parsed


def _template_read_markdown_delimiter(
    text: str,
    index: int,
    delimiters: tuple[str, ...],
) -> Optional[str]:
    for delimiter in delimiters:
        if text.startswith(delimiter, index):
            return delimiter
    return None


def _template_next_markdown_delimiter_index(text: str, start: int) -> int:
    indexes = [
        index
        for index in (
            text.find(delimiter, start)
            for delimiter in TEMPLATE_MARKDOWN_DELIMITERS
        )
        if index != -1
    ]
    return min(indexes) if indexes else -1


def _append_template_text_run(
    text_runs: list[dict[str, Any]],
    run: dict[str, Any],
) -> None:
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


def _read_template_table_text(value: Any) -> Optional[str]:
    primitive_text = _read_template_primitive_table_text(value)
    if primitive_text is not None:
        return primitive_text[:80]

    if not isinstance(value, dict):
        return None

    runs = value.get("runs")
    if isinstance(runs, list):
        run_text = "".join(
            run.get("text", "")
            for run in runs
            if isinstance(run, dict) and isinstance(run.get("text"), str)
        )
        if run_text:
            return run_text[:80]

    for key in ("text", "value"):
        text = _read_template_primitive_table_text(value.get(key))
        if text is not None:
            return text[:80]

    return None


def _read_template_primitive_table_text(value: Any) -> Optional[str]:
    if isinstance(value, str):
        return value
    if isinstance(value, bool):
        return str(value).lower()
    if isinstance(value, (int, float)):
        return str(value)
    return None


def _read_template_data_labels(value: Any) -> Optional[str]:
    if value is True:
        return "top"
    if value is False or value is None:
        return None
    if isinstance(value, str):
        normalized = value.strip().lower()
        if normalized in {"base", "mid", "top", "outside"}:
            return normalized
    return None


def _apply_template_chart_content(
    element: dict[str, Any],
    value: Any,
) -> dict[str, Any]:
    updated = copy.deepcopy(element)
    updated.pop("data_labels_color", None)
    updated.pop("grid", None)
    if not isinstance(value, dict):
        return updated

    chart_type = value.get("chartType", value.get("chart_type"))
    if chart_type in {
        "area",
        "bar",
        "bubble",
        "donut",
        "horizontal_bar",
        "horizontal_stacked_bar",
        "line",
        "pie",
        "polar_area",
        "radar",
        "scatter",
        "stacked_bar",
    }:
        updated["chart_type"] = chart_type
    if isinstance(value.get("title"), str):
        updated["title"] = value["title"]
    if isinstance(value.get("categories"), list) and value["categories"]:
        updated["categories"] = value["categories"]
    if isinstance(value.get("series"), list) and value["series"]:
        updated["series"] = value["series"]
    colors = value.get("colors")
    if isinstance(colors, list) and colors:
        updated["colors"] = colors
    for source_key, target_key in (
        ("axisColor", "axis_color"),
        ("axis_color", "axis_color"),
        ("gridColor", "grid_color"),
        ("grid_color", "grid_color"),
        ("legendColor", "legend_color"),
        ("legend_color", "legend_color"),
        ("xAxisTitle", "x_axis_title"),
        ("x_axis_title", "x_axis_title"),
        ("yAxisTitle", "y_axis_title"),
        ("y_axis_title", "y_axis_title"),
        ("source", "source"),
    ):
        if isinstance(value.get(source_key), str):
            updated[target_key] = value[source_key]
    for source_key, target_key in (
        ("xAxis", "x_axis"),
        ("x_axis", "x_axis"),
        ("yAxis", "y_axis"),
        ("y_axis", "y_axis"),
        ("xAxisGrid", "x_axis_grid"),
        ("x_axis_grid", "x_axis_grid"),
        ("yAxisGrid", "y_axis_grid"),
        ("y_axis_grid", "y_axis_grid"),
    ):
        if isinstance(value.get(source_key), bool):
            updated[target_key] = value[source_key]
    for source_key in ("dataLabels", "data_labels"):
        if source_key in value:
            updated["data_labels"] = _read_template_data_labels(value.get(source_key))
    return updated


def _get_presentation_stream_layout(
    presentation: PresentationModel,
) -> PresentationLayoutModel:
    if _is_template_layout_payload(presentation.layout):
        layout_name = str(presentation.layout.get("name") or "template")
        return _build_template_layout_model(
            presentation.layout,
            layout_name=layout_name,
        )

    return presentation.get_layout()


async def _resolve_prepare_layout(
    layout: str,
    sql_session: AsyncSession,
) -> tuple[dict[str, Any], PresentationLayoutModel, Optional[dict[str, str]]]:
    template_id = _extract_template_id(layout)
    if not template_id:
        raise HTTPException(
            status_code=400,
            detail="Template id is required",
        )

    template = await sql_session.get(TemplateV2, template_id)
    if not template:
        raise HTTPException(status_code=404, detail="Template layout not found")

    layout_payload = _copy_template_layout_payload(template)

    structure_layout = _build_template_structure_layout(template, layout_payload)
    return (
        layout_payload,
        structure_layout,
        _extract_template_fonts_from_assets(template.assets),
    )


def build_export_cookie_header(request: Request) -> Optional[str]:
    cookie_header = (request.headers.get("cookie") or "").strip()
    if cookie_header:
        return cookie_header

    internal_session_token = getattr(
        request.state, "internal_session_token", None
    )
    if isinstance(internal_session_token, str) and internal_session_token:
        return f"{SESSION_COOKIE_NAME}={internal_session_token}"

    session_token = request.cookies.get(SESSION_COOKIE_NAME)
    if session_token:
        return f"{SESSION_COOKIE_NAME}={session_token}"

    return None


@PRESENTATION_ROUTER.get("/all", response_model=List[PresentationWithSlides])
async def get_all_presentations(
    version: Annotated[
        Optional[PresentationVersion],
        Query(description="Only include presentations matching this version."),
    ] = None,
    include_slides: Annotated[
        bool,
        Query(
            description=(
                "Include the first slide for dashboard previews. "
                "Disable this for metadata-only presentation lists."
            )
        ),
    ] = True,
    sql_session: AsyncSession = Depends(get_async_session),
):
    if include_slides:
        query = select(PresentationModel, SlideModel).join(
            SlideModel,
            (SlideModel.presentation == PresentationModel.id) & (SlideModel.index == 0),
        )
    else:
        query = select(PresentationModel)

    if version is not None:
        query = query.where(PresentationModel.version == version)
    query = query.order_by(PresentationModel.created_at.desc())

    results = await sql_session.execute(query)
    if not include_slides:
        return [
            PresentationWithSlides(
                **_presentation_response_data(presentation),
                slides=[],
            )
            for presentation in results.scalars().all()
        ]

    rows = results.all()
    presentations_with_slides = []
    for presentation, first_slide in rows:
        slides = [first_slide]
        presentations_with_slides.append(
            PresentationWithSlides(
                **_presentation_response_data(presentation),
                slides=slides,
            )
        )
    return presentations_with_slides


@PRESENTATION_ROUTER.get("/{id}", response_model=PresentationWithSlides)
async def get_presentation(
    id: uuid.UUID,
    request: Request,
    sql_session: AsyncSession = Depends(get_async_session),
):
    presentation = await sql_session.get(PresentationModel, id)
    if not presentation:
        raise HTTPException(404, "Presentation not found")
    slides_result = await sql_session.scalars(
        select(SlideModel)
        .where(SlideModel.presentation == id)
        .order_by(SlideModel.index)
    )
    slides = list(slides_result)
    return PresentationWithSlides(
        **_presentation_response_data(presentation),
        slides=slides,
    )


@PRESENTATION_ROUTER.delete("/{id}", status_code=204)
async def delete_presentation(
    id: uuid.UUID, sql_session: AsyncSession = Depends(get_async_session)
):
    presentation = await sql_session.get(PresentationModel, id)
    if not presentation:
        raise HTTPException(404, "Presentation not found")

    await sql_session.delete(presentation)
    await sql_session.commit()


@PRESENTATION_ROUTER.post("/{id}/duplicate", response_model=PresentationWithSlides)
async def duplicate_presentation(
    id: uuid.UUID, sql_session: AsyncSession = Depends(get_async_session)
):
    presentation = await sql_session.get(PresentationModel, id)
    if not presentation:
        raise HTTPException(404, "Presentation not found")

    slides = list(
        await sql_session.scalars(
            select(SlideModel)
            .where(SlideModel.presentation == id)
            .order_by(SlideModel.index)
        )
    )
    new_presentation = presentation.get_new_presentation()
    if new_presentation.title:
        new_presentation.title = f"{new_presentation.title} (Copy)"
    new_slides = [slide.get_new_slide(new_presentation.id) for slide in slides]

    sql_session.add(new_presentation)
    sql_session.add_all(new_slides)
    await sql_session.commit()
    await sql_session.refresh(new_presentation)

    return PresentationWithSlides(
        **_presentation_response_data(new_presentation),
        slides=new_slides,
    )


@PRESENTATION_ROUTER.post("/{id}/export", response_model=PresentationPathAndEditPath)
async def export_existing_presentation(
    id: uuid.UUID,
    request_http: Request,
    export_as: Annotated[Literal["pptx", "pdf"], Body(embed=True)] = "pptx",
    sql_session: AsyncSession = Depends(get_async_session),
):
    """Export a presentation that already exists.

    Until now export could only happen as a side effect of the endpoint that
    created a presentation (`/generate`, `/edit`, `/derive`). If that request
    was interrupted — a reverse proxy closing a long-running connection, a
    client disconnect, a browser tab closing — the presentation itself was
    still generated and stored, but the exported file could no longer be
    reached through the API at all. The work was done and paid for, and the
    only way back to it was generating the whole thing again.

    This exposes the same `export_presentation` helper those endpoints already
    call, keyed on an existing presentation id, so an interrupted export can be
    retried without regenerating. It also makes the self-hosted v1 API
    consistent with the hosted v3 API, which offers `POST /presentation/export`.
    """
    presentation = await sql_session.get(PresentationModel, id)
    if not presentation:
        raise HTTPException(404, "Presentation not found")

    presentation_and_path = await export_presentation(
        presentation.id,
        presentation.title or str(uuid.uuid4()),
        export_as,
        cookie_header=build_export_cookie_header(request_http),
    )

    return PresentationPathAndEditPath(
        **presentation_and_path.model_dump(),
        edit_path=f"/presentation?id={presentation.id}",
    )


@PRESENTATION_ROUTER.post("/create", response_model=PresentationModel)
async def create_presentation(
    content: Annotated[str, Body()],
    n_slides: Annotated[Optional[int], Body()] = None,
    language: Annotated[Optional[str], Body()] = None,
    file_paths: Annotated[Optional[List[str]], Body()] = None,
    tone: Annotated[Tone, Body()] = Tone.DEFAULT,
    verbosity: Annotated[Verbosity, Body()] = Verbosity.STANDARD,
    instructions: Annotated[Optional[str], Body()] = None,
    include_table_of_contents: Annotated[bool, Body()] = False,
    include_title_slide: Annotated[bool, Body()] = True,
    web_search: Annotated[bool, Body()] = False,
    generation_mode: Annotated[Literal["standard", "smart"], Body()] = "standard",
    community_design_ids: Annotated[Optional[List[int]], Body()] = None,
    sql_session: AsyncSession = Depends(get_async_session),
):

    if n_slides is not None and n_slides < 1:
        raise HTTPException(
            status_code=400,
            detail="Number of slides must be greater than 0",
        )

    if n_slides is not None and n_slides > MAX_NUMBER_OF_SLIDES:
        raise HTTPException(
            status_code=400,
            detail=f"Number of slides cannot be greater than {MAX_NUMBER_OF_SLIDES}",
        )

    if include_table_of_contents and n_slides is not None and n_slides < 3:
        raise HTTPException(
            status_code=400,
            detail="Number of slides cannot be less than 3 if table of contents is included",
    )

    normalized_community_ids = normalize_community_ids(community_design_ids)
    if generation_mode != "smart" and normalized_community_ids:
        raise HTTPException(
            status_code=400,
            detail="Community references are available only in Smart mode",
        )
    if generation_mode == "smart" and not (
        content.strip() or file_paths or normalized_community_ids
    ):
        raise HTTPException(
            status_code=400,
            detail="A prompt, document, or community reference is required",
        )

    presentation_id = uuid.uuid4()
    language_to_store = (language or "").strip()
    validated_file_paths = (
        TEMP_FILE_SERVICE.resolve_existing_temp_paths(file_paths)
        if file_paths
        else None
    )
    # DB schema stores an int; 0 is used as internal marker for auto slide count.
    n_slides_to_store = n_slides if n_slides is not None else 0

    presentation = PresentationModel(
        id=presentation_id,
        version=PresentationVersion.V2_STANDARD,
        content=content,
        n_slides=n_slides_to_store,
        language=language_to_store,
        file_paths=validated_file_paths,
        tone=tone.value,
        verbosity=verbosity.value,
        instructions=instructions,
        include_table_of_contents=include_table_of_contents,
        include_title_slide=include_title_slide,
        web_search=web_search,
        generation_mode=generation_mode,
        community_design_ids=normalized_community_ids or None,
    )

    sql_session.add(presentation)
    await sql_session.commit()

    search_route, actual_search_provider = get_web_search_route()
    logger.info(
        "Created presentation: id=%s web_search_enabled=%s selected_web_search_provider=%s "
        "web_search_route=%s actual_web_search_provider=%s",
        presentation_id,
        web_search,
        get_selected_web_search_provider().value,
        search_route,
        (
            actual_search_provider.value
            if actual_search_provider
            else ("model-native" if search_route == "native" else "none")
        ),
    )

    return presentation


@PRESENTATION_ROUTER.post(
    "/create/blank",
    response_model=PresentationWithSlides,
    status_code=201,
)
async def create_blank_presentation(
    sql_session: AsyncSession = Depends(get_async_session),
):
    presentation_id = uuid.uuid4()
    presentation = PresentationModel(
        id=presentation_id,
        version=PresentationVersion.V2_STANDARD,
        content="",
        n_slides=1,
        language="English",
        title="Untitled Presentation",
        layout=None,
        fonts=None,
        include_title_slide=False,
    )
    slide = SlideModel(
        presentation=presentation_id,
        layout_group=BLANK_PRESENTATION_LAYOUT_GROUP,
        layout=BLANK_PRESENTATION_LAYOUT_ID,
        index=0,
        content={},
        speaker_note="",
        ui=_blank_presentation_slide_ui(),
    )

    sql_session.add(presentation)
    sql_session.add(slide)
    try:
        await sql_session.commit()
    except Exception:
        await sql_session.rollback()
        raise

    await sql_session.refresh(presentation)
    await sql_session.refresh(slide)

    return PresentationWithSlides(
        **_presentation_response_data(presentation),
        slides=[slide],
    )


@PRESENTATION_ROUTER.post("/prepare", response_model=PresentationPrepareResponse)
async def prepare_presentation(
    presentation_id: Annotated[uuid.UUID, Body()],
    outlines: Annotated[List[SlideOutlineModel], Body()],
    layout: Annotated[str, Body()],
    title: Annotated[Optional[str], Body()] = None,
    sql_session: AsyncSession = Depends(get_async_session),
):
    if not outlines:
        raise HTTPException(status_code=400, detail="Outlines are required")
    if len(outlines) > MAX_NUMBER_OF_SLIDES:
        raise HTTPException(
            status_code=400,
            detail=f"Number of outlines cannot be greater than {MAX_NUMBER_OF_SLIDES}",
        )

    presentation = await sql_session.get(PresentationModel, presentation_id)
    if not presentation:
        raise HTTPException(status_code=404, detail="Presentation not found")

    presentation_outline_model = PresentationOutlineModel(slides=outlines)

    layout_payload, structure_layout, template_fonts = await _resolve_prepare_layout(
        layout, sql_session
    )
    total_slide_layouts = _layout_count(layout_payload)
    if total_slide_layouts < 1:
        raise HTTPException(
            status_code=400,
            detail="Layout must contain at least one slide layout",
        )
    total_outlines = len(outlines)

    if structure_layout.ordered:
        presentation_structure = structure_layout.to_presentation_structure()
    else:
        presentation_structure: PresentationStructureModel = (
            await generate_presentation_structure(
                presentation_outline=presentation_outline_model,
                presentation_layout=structure_layout,
                instructions=presentation.instructions,
                source_content=presentation.content,
            )
        )

    presentation_structure = _normalize_presentation_structure(
        presentation_structure,
        outline_count=total_outlines,
        layout_count=total_slide_layouts,
    )

    if presentation.include_table_of_contents:
        n_toc_slides = get_no_of_toc_required_for_n_outlines(
            n_outlines=total_outlines,
            title_slide=presentation.include_title_slide,
            target_total_slides=(presentation.n_slides if presentation.n_slides > 0 else None),
        )
        toc_slide_layout_index = select_toc_or_list_slide_layout_index(structure_layout)
        _insert_toc_layouts(
            presentation_structure,
            n_toc_slides,
            presentation.include_title_slide,
            toc_slide_layout_index,
        )
        if toc_slide_layout_index != -1 and n_toc_slides > 0:
            presentation_outline_model = get_presentation_outline_model_with_toc(
                outline=presentation_outline_model,
                n_toc_slides=n_toc_slides,
                title_slide=presentation.include_title_slide,
            )

    sql_session.add(presentation)
    presentation.outlines = presentation_outline_model.model_dump(mode="json")
    presentation.title = title or presentation.title
    # Final slide generation should follow the reviewed outline text. The
    # original upload language can be stale after outline-page chat edits such
    # as "convert these to Chinese".
    presentation.language = ""
    presentation.layout = layout_payload
    presentation.fonts = template_fonts
    presentation.set_structure(presentation_structure)
    await sql_session.commit()

    await MEM0_PRESENTATION_MEMORY_SERVICE.store_generated_outlines(
        presentation.id,
        presentation.outlines,
    )

    return PresentationPrepareResponse(presentation_id=presentation.id)


async def stream_smart_presentation(
    presentation: PresentationModel,
    sql_session: AsyncSession,
) -> StreamingResponse:
    presentation_id = presentation.id
    requested_slide_count = resolve_smart_slide_count(presentation.n_slides)

    async def inner():
        slide_count = requested_slide_count
        presentation.n_slides = slide_count
        existing_slides = list(
            await sql_session.scalars(
                select(SlideModel)
                .where(SlideModel.presentation == presentation_id)
                .order_by(SlideModel.index)
            )
        )
        if existing_slides:
            if presentation.fonts:
                yield SSEResponse(
                    event="response",
                    data=json.dumps(
                        {"type": "fonts", "fonts": presentation.fonts}
                    ),
                ).to_string()
            for slide in existing_slides:
                yield SSEResponse(
                    event="response",
                    data=json.dumps(
                        {
                            "type": "slide_html",
                            "index": slide.index,
                            "slide_id": str(slide.id),
                            "html": slide.html_content,
                            "slide": slide.model_dump(mode="json"),
                        }
                    ),
                ).to_string()
            if len(existing_slides) >= slide_count:
                presentation.title = (
                    presentation.title
                    or str(existing_slides[0].content.get("title") or "").strip()
                    or "Presentation"
                )
                sql_session.add(presentation)
                await sql_session.commit()
                response = PresentationWithSlides(
                    **_presentation_response_data(presentation),
                    slides=existing_slides[:slide_count],
                )
                yield SSECompleteResponse(
                    key="presentation",
                    value=response.model_dump(mode="json"),
                ).to_string()
                return

        yield SSEStatusResponse(
            status=(
                f"Resuming Smart presentation from slide {len(existing_slides) + 1}"
                if existing_slides
                else "Preparing Smart presentation"
            )
        ).to_string()
        references = await load_community_references(
            presentation.community_design_ids
        )
        community_context = build_community_design_context(references)
        reference_fonts = merge_reference_fonts(references)

        source_parts: list[str] = []
        if presentation.file_paths:
            yield SSEStatusResponse(status="Reading source documents").to_string()
            documents_loader = DocumentsLoader(
                file_paths=presentation.file_paths,
                presentation_language=presentation.language,
            )
            await documents_loader.load_documents(
                TEMP_FILE_SERVICE.create_temp_dir()
            )
            source_parts.extend(document for document in documents_loader.documents if document)

        if presentation.web_search:
            yield SSEStatusResponse(status="Searching the web").to_string()
            search_context = await get_web_search_context(
                build_web_search_query(
                    presentation.content,
                    presentation.instructions,
                )
            )
            if search_context:
                source_parts.append(search_context)

        source_context = "\n\n".join(source_parts)
        if len(source_context) > 90_000:
            source_context = source_context[:90_000]

        presentation.fonts = presentation.fonts or reference_fonts or {
            "Inter": "/vendor/fonts/sans_serif/inter/Inter[opsz,wght].ttf"
        }
        # Release the request session's read transaction before independent
        # checkpoint sessions begin writing (important for SQLite), while also
        # persisting the resolved slide count and fonts for reconnects.
        sql_session.add(presentation)
        await sql_session.commit()
        yield SSEResponse(
            event="response",
            data=json.dumps({"type": "fonts", "fonts": presentation.fonts}),
        ).to_string()
        yield SSEStatusResponse(
            status=(
                f"Continuing from slide {len(existing_slides) + 1}"
                if existing_slides
                else (
                    "Applying community design reference"
                    if references
                    else "Designing the complete presentation"
                )
            )
        ).to_string()
        streamed_slides: dict[int, SlideModel] = {
            slide.index: slide for slide in existing_slides
        }
        generation_events: asyncio.Queue[tuple[str, Any]] = asyncio.Queue()

        async def emit_slide(index: int, slide: dict[str, str]) -> None:
            if index < 0 or index >= slide_count:
                return
            streamed_slide = streamed_slides.get(index)
            if streamed_slide is None:
                streamed_slide = SlideModel(
                    presentation=presentation_id,
                    layout_group="smart-html",
                    layout="smart-html",
                    index=index,
                    content={"title": slide["title"]},
                    html_content=slide["html"],
                    speaker_note="",
                )
                streamed_slides[index] = streamed_slide
            else:
                streamed_slide.content = {"title": slide["title"]}
                streamed_slide.html_content = slide["html"]
                streamed_slide.speaker_note = ""

            # Checkpoint before emitting. If the model later runs out of tokens
            # or the SSE client reconnects, generation resumes after this slide
            # instead of throwing away the accepted prefix.
            async with async_session_maker() as checkpoint_session:
                checkpoint = (
                    await checkpoint_session.scalars(
                        select(SlideModel).where(
                            SlideModel.presentation == presentation_id,
                            SlideModel.index == index,
                        )
                    )
                ).first()
                if checkpoint is None:
                    checkpoint = SlideModel(
                        id=streamed_slide.id,
                        owner_id=get_current_owner_id(),
                        presentation=presentation_id,
                        layout_group="smart-html",
                        layout="smart-html",
                        index=index,
                        content={"title": slide["title"]},
                        html_content=slide["html"],
                        speaker_note="",
                    )
                else:
                    streamed_slide.id = checkpoint.id
                    checkpoint.layout_group = "smart-html"
                    checkpoint.layout = "smart-html"
                    checkpoint.content = {"title": slide["title"]}
                    checkpoint.html_content = slide["html"]
                    checkpoint.speaker_note = ""
                checkpoint_session.add(checkpoint)
                checkpoint_presentation = await checkpoint_session.get(
                    PresentationModel, presentation_id
                )
                if checkpoint_presentation is not None:
                    checkpoint_presentation.n_slides = slide_count
                    checkpoint_presentation.fonts = presentation.fonts
                    checkpoint_session.add(checkpoint_presentation)
                await checkpoint_session.commit()
            await generation_events.put(("slide", streamed_slide))

        async def emit_metrics(metrics: TextGenerationMetrics) -> None:
            await generation_events.put(("metrics", metrics))

        async def emit_retry(next_slide_index: int, _error: str) -> None:
            await generation_events.put(
                (
                    "status",
                    f"Retrying from slide {next_slide_index + 1} with saved progress",
                )
            )

        generation_task = asyncio.create_task(
            generate_smart_presentation(
                content=presentation.content,
                n_slides=slide_count,
                language=presentation.language,
                tone=presentation.tone,
                verbosity=presentation.verbosity,
                instructions=presentation.instructions,
                include_title_slide=presentation.include_title_slide,
                include_table_of_contents=presentation.include_table_of_contents,
                source_context=source_context,
                community_design_context=community_context,
                fonts=presentation.fonts,
                existing_slides=[
                    {"html": slide.html_content or ""} for slide in existing_slides
                ],
                existing_title=presentation.title,
                on_slide=emit_slide,
                on_metrics=emit_metrics,
                on_retry=emit_retry,
            )
        )

        try:
            while not generation_task.done() or not generation_events.empty():
                try:
                    event_type, event_value = await asyncio.wait_for(
                        generation_events.get(), timeout=0.1
                    )
                except asyncio.TimeoutError:
                    continue
                if event_type == "status":
                    yield SSEStatusResponse(status=str(event_value)).to_string()
                    continue
                if event_type == "metrics":
                    metrics = event_value
                    if not isinstance(metrics, TextGenerationMetrics):
                        raise TypeError("Invalid Smart generation metrics event")
                    yield SSEResponse(
                        event="response",
                        data=json.dumps(
                            {"type": "generation_metrics", **metrics.to_dict()}
                        ),
                    ).to_string()
                    continue
                streamed_slide = event_value
                if not isinstance(streamed_slide, SlideModel):
                    raise TypeError("Invalid Smart slide event")
                yield SSEResponse(
                    event="response",
                    data=json.dumps(
                        {
                            "type": "slide_html",
                            "index": streamed_slide.index,
                            "slide_id": str(streamed_slide.id),
                            "html": streamed_slide.html_content,
                            "slide": streamed_slide.model_dump(mode="json"),
                        }
                    ),
                ).to_string()
            deck = await generation_task
        finally:
            if not generation_task.done():
                generation_task.cancel()
                await asyncio.gather(generation_task, return_exceptions=True)

        final_title = deck["title"]
        final_fonts = dict(presentation.fonts or {})

        # Start a fresh transaction so this session sees slides committed by
        # the checkpoint sessions. Do not delete/reinsert them: the editor may
        # already have persisted asset or HTML updates while generation ran.
        await sql_session.rollback()
        final_presentation = await sql_session.get(PresentationModel, presentation_id)
        if final_presentation is None:
            raise HTTPException(status_code=404, detail="Presentation not found")
        slides = list(
            await sql_session.scalars(
                select(SlideModel)
                .where(SlideModel.presentation == presentation_id)
                .order_by(SlideModel.index)
            )
        )
        slides_by_index = {slide.index: slide for slide in slides}
        for index, slide in enumerate(deck["slides"]):
            if index in slides_by_index:
                continue
            recovered_slide = SlideModel(
                presentation=presentation_id,
                layout_group="smart-html",
                layout="smart-html",
                index=index,
                content={"title": slide["title"]},
                html_content=slide["html"],
                speaker_note="",
            )
            sql_session.add(recovered_slide)
            slides_by_index[index] = recovered_slide
        slides = [slides_by_index[index] for index in range(slide_count)]

        final_presentation.title = final_title
        final_presentation.n_slides = slide_count
        final_presentation.fonts = final_fonts
        sql_session.add(final_presentation)
        await sql_session.commit()

        response = PresentationWithSlides(
            **_presentation_response_data(final_presentation),
            slides=slides,
        )
        yield SSECompleteResponse(
            key="presentation",
            value=response.model_dump(mode="json"),
        ).to_string()

    async def rollback_stream_session():
        await sql_session.rollback()

    async def smart_error_metadata(exc: Exception) -> dict[str, object]:
        async with async_session_maker() as progress_session:
            completed_slides = len(
                list(
                    await progress_session.scalars(
                        select(SlideModel).where(
                            SlideModel.presentation == presentation_id
                        )
                    )
                )
            )
        status_code = exc.status_code if isinstance(exc, HTTPException) else 500
        return {
            "source": "generation",
            "status_code": status_code,
            "error_type": exc.__class__.__name__,
            "retryable": (
                status_code in {408, 429} or status_code >= 500
            ),
            "completed_slides": completed_slides,
            "total_slides": requested_slide_count,
        }

    return StreamingResponse(
        safe_sse_stream(
            inner(),
            logger=logger,
            error_detail="Failed to generate the Smart presentation. Please try again.",
            on_error=rollback_stream_session,
            error_metadata=smart_error_metadata,
        ),
        media_type="text/event-stream",
    )


@PRESENTATION_ROUTER.get("/stream/{id}", response_model=PresentationWithSlides)
async def stream_presentation(
    id: uuid.UUID, sql_session: AsyncSession = Depends(get_async_session)
):
    presentation = await sql_session.get(PresentationModel, id)
    if not presentation:
        raise HTTPException(status_code=404, detail="Presentation not found")
    if presentation.generation_mode == "smart":
        return await stream_smart_presentation(presentation, sql_session)
    if not presentation.structure:
        raise HTTPException(
            status_code=400,
            detail="Presentation not prepared for stream",
        )
    if not presentation.outlines:
        raise HTTPException(
            status_code=400,
            detail="Outlines can not be empty",
        )

    try:
        structure = presentation.get_structure()
        layout = _get_presentation_stream_layout(presentation)
        outline = presentation.get_presentation_outline()
    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail="Presentation has invalid generated data",
        ) from exc

    if not layout.slides:
        raise HTTPException(status_code=400, detail="Presentation layout has no slides")
    original_structure = list(structure.slides)
    structure = _normalize_presentation_structure(
        structure,
        outline_count=len(outline.slides),
        layout_count=len(layout.slides),
    )
    if structure.slides != original_structure:
        logger.warning(
            "Repairing invalid prepared presentation structure: "
            "presentation_id=%s old=%s new=%s",
            id,
            original_structure,
            structure.slides,
        )
        presentation.set_structure(structure)
        sql_session.add(presentation)
        await sql_session.commit()

    image_generation_service = ImageGenerationService(get_images_directory())

    async def inner():
        icon_weight = layout.icon_weight
        image_urls_for_slides = get_images_for_slides_from_outline(outline.slides)

        async_assets_generation_tasks: List[asyncio.Task] = []
        asset_events: asyncio.Queue = asyncio.Queue()
        asset_warnings_by_slide: dict[int, list[dict]] = {}

        async def notify_slide_assets_ready(slide_index: int, asset_task: asyncio.Task):
            try:
                await asset_task
            except Exception:
                logger.exception(
                    "Slide asset generation failed: presentation_id=%s slide_index=%s",
                    id,
                    slide_index,
                )
                asset_warnings_by_slide.setdefault(slide_index, []).append(
                    {
                        "type": "asset_generation_failed",
                        "message": "Some slide assets could not be generated.",
                    }
                )
            finally:
                await asset_events.put(slide_index)

        slides: List[SlideModel] = []
        yield SSEResponse(
            event="response",
            data=json.dumps({"type": "chunk", "chunk": '{ "slides": [ '}),
        ).to_string()
        yielded_slide_asset_sse_count = 0

        for i, slide_layout_index in enumerate(structure.slides):
            slide_layout = layout.slides[slide_layout_index]

            try:
                slide_content = await get_slide_content_from_type_and_outline(
                    slide_layout,
                    outline.slides[i],
                    presentation.language,
                    presentation.tone,
                    presentation.verbosity,
                    presentation.instructions,
                    slide_number=i + 1,
                )
            except HTTPException as e:
                yield SSEErrorResponse(detail=e.detail).to_string()
                return

            slide = SlideModel(
                presentation=id,
                layout_group=layout.name,
                layout=slide_layout.id,
                index=i,
                speaker_note=slide_content.get("__speaker_note__", ""),
                content=slide_content,
                ui=_template_slide_ui(presentation.layout, slide_layout.id),
            )
            slides.append(slide)

            # This will mutate slide and add placeholder assets
            process_slide_add_placeholder_assets(slide)
            slide.ui = _apply_template_content_to_ui(slide.ui, slide.content)

            # This will mutate slide - start task immediately so it runs in parallel with next slide LLM generation
            asset_warnings_by_slide[i] = []
            asset_task = asyncio.create_task(
                process_slide_and_fetch_assets(
                    image_generation_service,
                    slide,
                    outline_image_urls=(
                        image_urls_for_slides[i]
                        if i < len(image_urls_for_slides)
                        else None
                    ),
                    icon_weight=icon_weight,
                    allow_image_fallback=True,
                    image_warnings=asset_warnings_by_slide[i],
                )
            )
            async_assets_generation_tasks.append(asset_task)
            asyncio.create_task(notify_slide_assets_ready(i, asset_task))

            yield SSEResponse(
                event="response",
                data=json.dumps({"type": "chunk", "chunk": slide.model_dump_json()}),
            ).to_string()

            while True:
                try:
                    done_idx = asset_events.get_nowait()
                except asyncio.QueueEmpty:
                    break
                slides[done_idx].ui = _apply_template_content_to_ui(
                    slides[done_idx].ui,
                    slides[done_idx].content,
                )
                yielded_slide_asset_sse_count += 1
                yield SSEResponse(
                    event="response",
                    data=json.dumps(
                        {
                            "type": "slide_assets",
                            "slide_index": done_idx,
                            "slide": slides[done_idx].model_dump(mode="json"),
                            "warnings": asset_warnings_by_slide.get(done_idx, []),
                        }
                    ),
                ).to_string()

        yield SSEResponse(
            event="response",
            data=json.dumps({"type": "chunk", "chunk": " ] }"}),
        ).to_string()

        while yielded_slide_asset_sse_count < len(slides):
            done_idx = await asset_events.get()
            slides[done_idx].ui = _apply_template_content_to_ui(
                slides[done_idx].ui,
                slides[done_idx].content,
            )
            yielded_slide_asset_sse_count += 1
            yield SSEResponse(
                event="response",
                data=json.dumps(
                    {
                        "type": "slide_assets",
                        "slide_index": done_idx,
                        "slide": slides[done_idx].model_dump(mode="json"),
                        "warnings": asset_warnings_by_slide.get(done_idx, []),
                    }
                ),
            ).to_string()

        generated_assets_lists = await asyncio.gather(
            *async_assets_generation_tasks,
            return_exceptions=True,
        )
        generated_assets = []
        for assets_list in generated_assets_lists:
            if isinstance(assets_list, Exception):
                logger.error(
                    "Slide asset generation failed during final collection: %s",
                    assets_list,
                )
                continue
            generated_assets.extend(assets_list)

        for slide in slides:
            slide.ui = _apply_template_content_to_ui(slide.ui, slide.content)

        # Moved this here to make sure new slides are generated before deleting the old ones
        await sql_session.execute(
            delete(SlideModel).where(
                SlideModel.presentation == id,
                SlideModel.owner_id == get_current_owner_id(),
            )
        )
        await sql_session.commit()

        sql_session.add(presentation)
        sql_session.add_all(slides)
        sql_session.add_all(generated_assets)
        await sql_session.commit()

        response = PresentationWithSlides(
            **_presentation_response_data(presentation),
            slides=slides,
        )

        yield SSECompleteResponse(
            key="presentation",
            value=response.model_dump(mode="json"),
        ).to_string()

    async def rollback_stream_session():
        await sql_session.rollback()

    return StreamingResponse(
        safe_sse_stream(
            inner(),
            logger=logger,
            error_detail="Failed to generate presentation slides. Please try again.",
            on_error=rollback_stream_session,
        ),
        media_type="text/event-stream",
    )


@PRESENTATION_ROUTER.patch("/update", response_model=PresentationWithSlides)
async def update_presentation(
    request: Request,
    id: Annotated[uuid.UUID, Body()],
    base_document: Annotated[Optional[dict], Body()] = None,
    sql_session: AsyncSession = Depends(get_async_session),
):
    from services.document_compare_and_swap import save_document_if_unchanged
    payload = await request.json()
    changes = {key: payload[key] for key in ("slides", "title", "theme", "n_slides") if key in payload}
    presentation, slides = await save_document_if_unchanged(sql_session, id, base_document, changes)
    return PresentationWithSlides(**_presentation_response_data(presentation), slides=slides)


@PRESENTATION_ROUTER.patch("/slide_update", response_model=SlideModel)
async def update_presentation_slide(
    slide: Annotated[SlideModel, Body(embed=True)],
    base_slide: Annotated[Optional[SlideModel], Body()] = None,
    sql_session: AsyncSession = Depends(get_async_session),
):
    from services.slide_compare_and_swap import save_slide_if_unchanged
    return await save_slide_if_unchanged(sql_session, slide, base_slide)


async def check_if_api_request_is_valid(
    request: GeneratePresentationRequest,
    sql_session: AsyncSession = Depends(get_async_session),
) -> Tuple[uuid.UUID,]:
    presentation_id = uuid.uuid4()
    print(f"Presentation ID: {presentation_id}")

    # Making sure either content, slides markdown or files is provided
    if not (request.content or request.slides_markdown or request.files):
        raise HTTPException(
            status_code=400,
            detail="Either content or slides markdown or files is required to generate presentation",
        )

    if request.n_slides is not None and request.n_slides <= 0:
        raise HTTPException(
            status_code=400,
            detail="Number of slides must be greater than 0",
        )

    if request.n_slides is not None and request.n_slides > MAX_NUMBER_OF_SLIDES:
        raise HTTPException(
            status_code=400,
            detail=f"Number of slides cannot be greater than {MAX_NUMBER_OF_SLIDES}",
        )

    if (
        request.slides_markdown is not None
        and len(request.slides_markdown) > MAX_NUMBER_OF_SLIDES
    ):
        raise HTTPException(
            status_code=400,
            detail=f"Number of slides cannot be greater than {MAX_NUMBER_OF_SLIDES}",
        )

    if (
        request.include_table_of_contents
        and request.n_slides is not None
        and request.n_slides < 3
    ):
        raise HTTPException(
            status_code=400,
            detail="Number of slides cannot be less than 3 if table of contents is included",
        )

    # Checking if template is valid. Generation supports TemplateV2 rows and
    # bundled TemplateV2 names only.
    template = await _resolve_requested_template(
        request.template,
        sql_session,
    )
    if template:
        request.template = template.id
        return (presentation_id,)

    if resolve_default_template_id(request.template):
        return (presentation_id,)

    raise HTTPException(
        status_code=400,
        detail="Template not found. Please use a valid template.",
    )


async def generate_presentation_handler(
    request: GeneratePresentationRequest,
    presentation_id: uuid.UUID,
    async_status: Optional[AsyncTaskModel],
    export_cookie_header: Optional[str] = None,
    request_http: Optional[Request] = None,
    sql_session: AsyncSession = Depends(get_async_session),
):
    try:
        disconnect_checker = (
            request_http.is_disconnected if request_http is not None else None
        )

        async def raise_if_client_disconnected() -> None:
            if disconnect_checker and await disconnect_checker():
                logger.info(
                    "[presentation.generate] client disconnected presentation_id=%s",
                    presentation_id,
                )
                raise asyncio.CancelledError

        await raise_if_client_disconnected()
        using_slides_markdown = False
        language_to_use = (request.language or "").strip() or None
        additional_context = ""

        if request.slides_markdown:
            using_slides_markdown = True
            if len(request.slides_markdown) > MAX_NUMBER_OF_SLIDES:
                raise HTTPException(
                    status_code=400,
                    detail=f"Number of slides cannot be greater than {MAX_NUMBER_OF_SLIDES}",
                )
            request.n_slides = len(request.slides_markdown)

        if not using_slides_markdown:
            # Updating async status
            if async_status:
                async_status.message = "Generating presentation outlines"
                async_status.data = presentation_task_progress_data(
                    created_slides=0,
                    remaining_slides=_requested_slide_count(request),
                    presentation_id=presentation_id,
                )
                async_status.updated_at = datetime.now()
                sql_session.add(async_status)
                await sql_session.commit()

            if request.files:
                documents_loader = DocumentsLoader(
                    file_paths=request.files,
                    presentation_language=request.language,
                )
                await documents_loader.load_documents()
                documents = documents_loader.documents
                if documents:
                    additional_context = "\n\n".join(documents)

            # Finding number of slides to generate by considering table of contents
            n_slides_to_generate = request.n_slides
            if request.include_table_of_contents and request.n_slides is not None:
                n_slides_to_generate = (
                    get_no_of_outlines_to_generate_for_n_slides(
                        n_slides=request.n_slides,
                        toc=True,
                        title_slide=request.include_title_slide,
                    )
                )

            outline_messages = get_outline_messages(
                request.content,
                n_slides_to_generate,
                language_to_use,
                additional_context,
                request.tone.value,
                request.verbosity.value,
                request.instructions,
                request.include_title_slide,
                request.include_table_of_contents,
            )
            await MEM0_PRESENTATION_MEMORY_SERVICE.store_generation_context(
                presentation_id=presentation_id,
                system_prompt=(
                    message_content_to_text(outline_messages[0].content)
                    if len(outline_messages) > 0
                    else None
                ),
                user_prompt=(
                    message_content_to_text(outline_messages[1].content)
                    if len(outline_messages) > 1
                    else None
                ),
                extracted_document_text=additional_context,
                source_content=request.content,
                instructions=request.instructions,
            )

            presentation_outlines_text = ""
            async for chunk in generate_ppt_outline(
                request.content,
                n_slides_to_generate,
                language_to_use,
                additional_context,
                request.tone.value,
                request.verbosity.value,
                request.instructions,
                request.include_title_slide,
                request.web_search,
                request.include_table_of_contents,
                disconnect_checker=disconnect_checker,
            ):

                if isinstance(chunk, HTTPException):
                    raise chunk

                presentation_outlines_text += chunk

            try:
                presentation_outlines_json = dict(
                    dirtyjson.loads(presentation_outlines_text)
                )
            except Exception:
                traceback.print_exc()
                raise HTTPException(
                    status_code=400,
                    detail="Failed to generate presentation outlines. Please try again.",
                )
            presentation_outlines = PresentationOutlineModel(
                **normalize_outline_payload(
                    presentation_outlines_json,
                    MAX_NUMBER_OF_SLIDES,
                )
            )

            if n_slides_to_generate is not None:
                if len(presentation_outlines.slides) < n_slides_to_generate:
                    raise HTTPException(
                        status_code=400,
                        detail=(
                            "Failed to generate presentation outlines with requested "
                            "number of slides. Please try again."
                        ),
                    )
                # Overshooting by a slide or two is common and recoverable:
                # keep the first n and drop the rest. Only undershooting is a
                # real failure, since there is nothing to pad the deck with.
                presentation_outlines.slides = presentation_outlines.slides[
                    :n_slides_to_generate
                ]

            total_outlines = len(presentation_outlines.slides)

        else:
            # Setting outlines to slides markdown
            presentation_outlines = PresentationOutlineModel(
                slides=[
                    SlideOutlineModel(content=slide)
                    for slide in request.slides_markdown
                ]
            )
            total_outlines = len(request.slides_markdown)

            await MEM0_PRESENTATION_MEMORY_SERVICE.store_generation_context(
                presentation_id=presentation_id,
                system_prompt=None,
                user_prompt=None,
                extracted_document_text=None,
                source_content=request.content,
                instructions=request.instructions,
            )

        await MEM0_PRESENTATION_MEMORY_SERVICE.store_generated_outlines(
            presentation_id,
            presentation_outlines.model_dump(mode="json"),
        )

        # Updating async status
        if async_status:
            async_status.message = "Selecting layout for each slide"
            async_status.updated_at = datetime.now()
            sql_session.add(async_status)
            await sql_session.commit()

        print("-" * 40)
        print(f"Generated {total_outlines} outlines for the presentation")

        logger.info(
            "[presentation.generate] loading layout template=%r presentation_id=%s",
            request.template,
            presentation_id,
        )
        (
            layout_payload,
            layout_model,
            template_fonts,
            template_theme,
        ) = await _resolve_generation_layout(request.template, sql_session)
        logger.info(
            "[presentation.generate] layout ready template=%r slides=%d ordered=%s icon_weight=%s",
            request.template,
            len(layout_model.slides),
            layout_model.ordered,
            layout_model.icon_weight,
        )
        total_slide_layouts = len(layout_model.slides)

        # Generate Structure
        if layout_model.ordered:
            presentation_structure = layout_model.to_presentation_structure()
        else:
            presentation_structure: PresentationStructureModel = (
                await generate_presentation_structure(
                    presentation_outline=presentation_outlines,
                    presentation_layout=layout_model,
                    instructions=request.instructions,
                    using_slides_markdown=using_slides_markdown,
                    source_content=request.content,
                    disconnect_checker=disconnect_checker,
                )
            )

        presentation_structure.slides = presentation_structure.slides[:total_outlines]
        for index in range(total_outlines):
            random_slide_index = random.randint(0, total_slide_layouts - 1)
            if index >= total_outlines:
                presentation_structure.slides.append(random_slide_index)
                continue
            if presentation_structure.slides[index] >= total_slide_layouts:
                presentation_structure.slides[index] = random_slide_index

        should_include_toc = (
            request.include_table_of_contents and not using_slides_markdown
        )
        if should_include_toc:
            n_toc_slides = get_no_of_toc_required_for_n_outlines(
                n_outlines=total_outlines,
                title_slide=request.include_title_slide,
                target_total_slides=request.n_slides,
            )
            toc_slide_layout_index = select_toc_or_list_slide_layout_index(layout_model)
            _insert_toc_layouts(
                presentation_structure,
                n_toc_slides,
                request.include_title_slide,
                toc_slide_layout_index,
            )
            if toc_slide_layout_index != -1 and n_toc_slides > 0:
                presentation_outlines = get_presentation_outline_model_with_toc(
                    outline=presentation_outlines,
                    n_toc_slides=n_toc_slides,
                    title_slide=request.include_title_slide,
                )

        final_n_slides = request.n_slides
        if final_n_slides is None:
            final_n_slides = len(presentation_outlines.slides)

        # Create PresentationModel
        presentation = PresentationModel(
            id=presentation_id,
            version=PresentationVersion.V2_STANDARD,
            content=request.content,
            n_slides=final_n_slides,
            language=language_to_use or "",
            title=get_presentation_title_from_presentation_outline(
                presentation_outlines
            ),
            outlines=presentation_outlines.model_dump(),
            layout=layout_payload,
            structure=presentation_structure.model_dump(),
            tone=request.tone.value,
            verbosity=request.verbosity.value,
            instructions=request.instructions,
            fonts=template_fonts,
            theme=template_theme,
        )

        # Updating async status
        if async_status:
            async_status.message = "Generating slides"
            async_status.data = presentation_task_progress_data(
                created_slides=0,
                remaining_slides=final_n_slides or 0,
                presentation_id=presentation_id,
            )
            async_status.updated_at = datetime.now()
            sql_session.add(async_status)
            await sql_session.commit()

        image_generation_service = ImageGenerationService(get_images_directory())
        async_assets_generation_tasks = []
        image_warnings: List[dict] = []

        # 7. Generate slide content concurrently (batched), then build slides and fetch assets
        slides: List[SlideModel] = []

        slide_layout_indices = presentation_structure.slides
        slide_layouts = [layout_model.slides[idx] for idx in slide_layout_indices]
        total_slides_to_create = len(slide_layouts)

        # Schedule slide content generation and asset fetching in batches of 10
        batch_size = 10
        for start in range(0, len(slide_layouts), batch_size):
            await raise_if_client_disconnected()
            end = min(start + batch_size, len(slide_layouts))

            print(f"Generating slides from {start} to {end}")

            # Generate contents for this batch concurrently
            content_tasks = [
                get_slide_content_from_type_and_outline(
                    slide_layouts[i],
                    presentation_outlines.slides[i],
                    language_to_use,
                    request.tone.value,
                    request.verbosity.value,
                    request.instructions,
                    slide_number=i + 1,
                    disconnect_checker=disconnect_checker,
                )
                for i in range(start, end)
            ]
            batch_contents: List[dict] = await asyncio.gather(*content_tasks)

            # Build slides for this batch
            batch_slides: List[SlideModel] = []
            for offset, slide_content in enumerate(batch_contents):
                i = start + offset
                slide_layout = slide_layouts[i]
                slide = SlideModel(
                    presentation=presentation_id,
                    layout_group=layout_model.name,
                    layout=slide_layout.id,
                    index=i,
                    speaker_note=slide_content.get("__speaker_note__"),
                    content=slide_content,
                    ui=_template_slide_ui(layout_payload, slide_layout.id),
                )
                slides.append(slide)
                batch_slides.append(slide)

            if async_status:
                async_status.data = presentation_task_progress_data(
                    created_slides=len(slides),
                    remaining_slides=total_slides_to_create - len(slides),
                    presentation_id=presentation_id,
                )
                async_status.updated_at = datetime.now()
                sql_session.add(async_status)
                await sql_session.commit()

            if using_slides_markdown:
                image_urls_for_batch = get_images_for_slides_from_outline(
                    presentation_outlines.slides[start:end]
                )
            else:
                image_urls_for_batch = [[] for _ in batch_slides]

            # Start asset fetch tasks immediately so they run in parallel with next batch's LLM calls
            asset_tasks = [
                asyncio.create_task(
                    process_slide_and_fetch_assets(
                        image_generation_service,
                        slide,
                        outline_image_urls=image_urls_for_batch[offset],
                        icon_weight=layout_model.icon_weight,
                        allow_image_fallback=True,
                        image_warnings=image_warnings,
                    )
                )
                for offset, slide in enumerate(batch_slides)
            ]
            async_assets_generation_tasks.extend(asset_tasks)

        if async_status:
            async_status.message = "Fetching assets for slides"
            async_status.data = presentation_task_progress_data(
                created_slides=len(slides),
                remaining_slides=0,
                presentation_id=presentation_id,
            )
            async_status.updated_at = datetime.now()
            sql_session.add(async_status)
            await sql_session.commit()

        # Run all asset tasks concurrently while batches may still be generating content
        generated_assets_list = await asyncio.gather(*async_assets_generation_tasks)
        generated_assets = []
        for assets_list in generated_assets_list:
            generated_assets.extend(assets_list)
        for warning in image_warnings:
            logger.warning(
                "Slide image generation warning: presentation_id=%s detail=%s",
                presentation_id,
                warning.get("detail"),
            )

        for slide in slides:
            _hydrate_template_slide_ui(slide, layout_payload)

        # 8. Save PresentationModel and Slides
        sql_session.add(presentation)
        sql_session.add_all(slides)
        sql_session.add_all(generated_assets)
        await sql_session.commit()

        if async_status:
            async_status.message = "Exporting presentation"
            async_status.updated_at = datetime.now()
            sql_session.add(async_status)

        # 9. Export
        presentation_and_path = await export_presentation(
            presentation_id,
            presentation.title or str(uuid.uuid4()),
            request.export_as,
            cookie_header=export_cookie_header,
        )

        response = PresentationPathAndEditPath(
            **presentation_and_path.model_dump(),
            edit_path=f"/presentation?id={presentation_id}",
        )

        if async_status:
            async_status.message = "Presentation generation completed"
            async_status.status = AsyncTaskStatus.COMPLETED
            async_status.data = {
                **presentation_task_progress_data(
                    created_slides=len(slides),
                    remaining_slides=0,
                    presentation_id=presentation_id,
                ),
                # The same fields the synchronous endpoint returns in its
                # response body. Without them a polling caller learns only
                # that *a* task finished, with no way to reach the file it
                # produced -- the result was previously reachable only by
                # receiving the completion webhook.
                "path": response.path,
                "edit_path": response.edit_path,
            }
            async_status.updated_at = datetime.now()
            sql_session.add(async_status)
            await sql_session.commit()

        # Triggering webhook on success
        CONCURRENT_SERVICE.run_task(
            None,
            WebhookService.send_webhook,
            WebhookEvent.PRESENTATION_GENERATION_COMPLETED,
            response.model_dump(mode="json"),
        )

        return response

    except Exception as e:
        if not isinstance(e, HTTPException):
            traceback.print_exc()
            e = HTTPException(status_code=500, detail="Presentation generation failed")

        api_error_model = APIErrorModel.from_exception(e)

        # Triggering webhook on failure
        CONCURRENT_SERVICE.run_task(
            None,
            WebhookService.send_webhook,
            WebhookEvent.PRESENTATION_GENERATION_FAILED,
            api_error_model.model_dump(mode="json"),
        )

        if async_status:
            async_status.status = AsyncTaskStatus.ERROR
            async_status.message = "Presentation generation failed"
            async_status.updated_at = datetime.now()
            async_status.error = api_error_model.model_dump(mode="json")
            sql_session.add(async_status)
            await sql_session.commit()

        else:
            raise e


@PRESENTATION_ROUTER.post("/generate", response_model=PresentationPathAndEditPath)
async def generate_presentation_sync(
    request_http: Request,
    request: GeneratePresentationRequest,
    sql_session: AsyncSession = Depends(get_async_session),
):
    try:
        (presentation_id,) = await check_if_api_request_is_valid(request, sql_session)
        response = await generate_presentation_handler(
            request,
            presentation_id,
            None,
            export_cookie_header=build_export_cookie_header(request_http),
            request_http=request_http,
            sql_session=sql_session,
        )
        return response.model_copy(
            update=absolute_mcp_result_links(
                request_http,
                {"path": response.path, "edit_path": response.edit_path},
            )
        )
    except HTTPException:
        raise
    except Exception:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Presentation generation failed")


async def _run_generate_presentation_task(
    request: GeneratePresentationRequest,
    presentation_id: uuid.UUID,
    task_id: str,
    export_cookie_header: Optional[str],
    owner_id: uuid.UUID | None = None,
) -> None:
    owner_token = set_current_owner_id(owner_id)
    admin_token = set_current_owner_is_admin(False)
    try:
        async with async_session_maker() as sql_session:
            async_status = await sql_session.get(AsyncTaskModel, task_id)
            if not async_status:
                logger.warning(
                    "[presentation.generate.async] task missing task_id=%s",
                    task_id,
                )
                return

            async_status.status = AsyncTaskStatus.PENDING
            async_status.message = "Starting presentation generation"
            async_status.data = presentation_task_progress_data(
                created_slides=0,
                remaining_slides=_requested_slide_count(request),
                presentation_id=presentation_id,
            )
            async_status.updated_at = datetime.now()
            sql_session.add(async_status)
            await sql_session.commit()

            await generate_presentation_handler(
                request,
                presentation_id,
                async_status=async_status,
                export_cookie_header=export_cookie_header,
                sql_session=sql_session,
            )
    finally:
        reset_current_owner_is_admin(admin_token)
        reset_current_owner_id(owner_token)


@PRESENTATION_ROUTER.post("/generate/async", response_model=AsyncTaskModel)
async def generate_presentation_async(
    request_http: Request,
    request: GeneratePresentationRequest,
    background_tasks: BackgroundTasks,
    sql_session: AsyncSession = Depends(get_async_session),
):
    try:
        (presentation_id,) = await check_if_api_request_is_valid(request, sql_session)

        async_status = AsyncTaskModel(
            type=ASYNC_TASK_TYPE_PRESENTATION_GENERATE,
            status=AsyncTaskStatus.PENDING,
            message="Queued for generation",
            data=presentation_task_progress_data(
                created_slides=0,
                remaining_slides=_requested_slide_count(request),
                presentation_id=presentation_id,
            ),
        )
        sql_session.add(async_status)
        await sql_session.commit()
        await sql_session.refresh(async_status)

        background_tasks.add_task(
            _run_generate_presentation_task,
            request,
            presentation_id,
            async_status.id,
            build_export_cookie_header(request_http),
            get_current_owner_id(),
        )
        return async_status

    except Exception as e:
        if not isinstance(e, HTTPException):
            print(e)
            e = HTTPException(status_code=500, detail="Presentation generation failed")

        raise e


@PRESENTATION_ROUTER.get("/status/{id}", response_model=AsyncTaskModel)
async def check_async_presentation_generation_status(
    request: Request,
    id: str = Path(description="ID of the presentation generation task"),
    sql_session: AsyncSession = Depends(get_async_session),
):
    status = await sql_session.get(AsyncTaskModel, id)
    if not status:
        raise HTTPException(
            status_code=404, detail="No presentation generation task found"
        )
    response = status.model_copy(deep=True)
    if response.data:
        response.data = absolute_mcp_result_links(request, response.data)
    return response


@PRESENTATION_ROUTER.post("/edit", response_model=PresentationPathAndEditPath)
async def edit_presentation_with_new_content(
    request_http: Request,
    data: Annotated[EditPresentationRequest, Body()],
    sql_session: AsyncSession = Depends(get_async_session),
):
    presentation = await sql_session.get(PresentationModel, data.presentation_id)
    if not presentation:
        raise HTTPException(status_code=404, detail="Presentation not found")

    slides = await sql_session.scalars(
        select(SlideModel).where(SlideModel.presentation == data.presentation_id)
    )

    new_slides = []
    slides_to_delete = []
    for each_slide in slides:
        updated_content = None
        new_slide_data = list(
            filter(lambda x: x.index == each_slide.index, data.slides)
        )
        if new_slide_data:
            updated_content = deep_update(each_slide.content, new_slide_data[0].content)
            new_slide = each_slide.get_new_slide(presentation.id, updated_content)
            _hydrate_template_slide_ui(new_slide, presentation.layout)
            new_slides.append(new_slide)
            slides_to_delete.append(each_slide.id)

    await sql_session.execute(
        delete(SlideModel).where(
            SlideModel.id.in_(slides_to_delete),
            SlideModel.owner_id == get_current_owner_id(),
        )
    )

    sql_session.add_all(new_slides)
    await sql_session.commit()

    presentation_and_path = await export_presentation(
        presentation.id,
        presentation.title or str(uuid.uuid4()),
        data.export_as,
        cookie_header=build_export_cookie_header(request_http),
    )

    return PresentationPathAndEditPath(
        **presentation_and_path.model_dump(),
        edit_path=f"/presentation?id={presentation.id}",
    )


@PRESENTATION_ROUTER.post("/derive", response_model=PresentationPathAndEditPath)
async def derive_presentation_from_existing_one(
    request_http: Request,
    data: Annotated[EditPresentationRequest, Body()],
    sql_session: AsyncSession = Depends(get_async_session),
):
    presentation = await sql_session.get(PresentationModel, data.presentation_id)
    if not presentation:
        raise HTTPException(status_code=404, detail="Presentation not found")

    slides = await sql_session.scalars(
        select(SlideModel).where(SlideModel.presentation == data.presentation_id)
    )

    new_presentation = presentation.get_new_presentation()
    new_slides = []
    for each_slide in slides:
        updated_content = None
        new_slide_data = list(
            filter(lambda x: x.index == each_slide.index, data.slides)
        )
        if new_slide_data:
            updated_content = deep_update(each_slide.content, new_slide_data[0].content)
        new_slide = each_slide.get_new_slide(new_presentation.id, updated_content)
        _hydrate_template_slide_ui(new_slide, new_presentation.layout)
        new_slides.append(new_slide)

    sql_session.add(new_presentation)
    sql_session.add_all(new_slides)
    await sql_session.commit()

    presentation_and_path = await export_presentation(
        new_presentation.id,
        new_presentation.title or str(uuid.uuid4()),
        data.export_as,
        cookie_header=build_export_cookie_header(request_http),
    )

    return PresentationPathAndEditPath(
        **presentation_and_path.model_dump(),
        edit_path=f"/presentation?id={new_presentation.id}",
    )
