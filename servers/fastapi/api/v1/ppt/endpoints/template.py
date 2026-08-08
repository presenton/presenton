import asyncio
import logging
import os
import random
from collections import Counter
from concurrent.futures import ThreadPoolExecutor, as_completed
from contextvars import copy_context
from datetime import datetime
from functools import partial
from typing import Annotated, Any, Optional
from urllib.parse import unquote, urlparse

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Body,
    Depends,
    File,
    Form,
    HTTPException,
    Path,
    Query,
    Response,
    UploadFile,
)
from pydantic import (
    AliasChoices,
    BaseModel,
    ConfigDict,
    Field,
    ValidationError,
    model_validator,
)
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from enums.async_task_status import AsyncTaskStatus
from models.api_error_model import APIErrorModel
from models.sql.async_task import AsyncTaskModel
from models.sql.template_v2 import TemplateV2
from services.database import async_session_maker, get_async_session
from services.export_task_service import EXPORT_TASK_SERVICE
from templates.preview import (
    FontsUploadAndSlidesPreviewResponse,
    upload_fonts_and_slides_preview_handler,
)
from templates.v2.generation import (
    MAX_PARALLEL_SLIDE_LAYOUTS,
    generate_prompted_slide_layout,
    generate_slide_layout,
    generate_template,
    merge_similar_components,
)
from templates.v2.models.elements import Image as SlideImageElement
from templates.v2.models.layouts import (
    MergedComponents,
    RawSlideLayouts,
    SlideLayout,
    SlideLayouts,
)
from utils.asset_directory_utils import resolve_app_path_to_filesystem
from utils.file_utils import get_original_file_name
from utils.icon_weights import (
    ALLOWED_ICON_TYPES,
    DEFAULT_ICON_TYPE,
    IconType,
    extract_icon_type_from_settings,
)
from utils.datetime_utils import get_current_utc_datetime
from utils.llm_client_error_handler import handle_llm_client_exceptions


TEMPLATE_ROUTER = APIRouter(prefix="/template", tags=["Templates"])
LOGGER = logging.getLogger(__name__)
_TEMPLATE_LAYOUT_PATCH_LOCKS: dict[str, asyncio.Lock] = {}
_TEMPLATE_LAYOUT_PATCH_LOCKS_GUARD = asyncio.Lock()
ASYNC_TASK_TYPE_TEMPLATE_CREATE = "template.create"
SLIDE_LAYOUT_GENERATION_MAX_TOKENS = 16000


class InitTemplateRequest(BaseModel):
    pptx_url: str
    slide_image_urls: list[str]
    fonts: dict[str, Any] = Field(default_factory=dict)
    name: Optional[str] = None
    description: Optional[str] = None
    icon_type: Optional[IconType] = DEFAULT_ICON_TYPE


class CreateTemplateRequest(InitTemplateRequest):
    pass


class GenerateTemplateBlocksRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    template_id: str = Field(validation_alias=AliasChoices("template_id", "id"))


class CreateTemplateLayoutsRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    template_id: str = Field(validation_alias=AliasChoices("template_id", "id"))
    index: Optional[int] = Field(default=None, ge=0)
    indices: Optional[list[int]] = None

    @model_validator(mode="after")
    def _validate_indices(self) -> "CreateTemplateLayoutsRequest":
        if self.index is None and self.indices is None:
            raise ValueError("Either index or indices is required")
        if self.index is not None and self.indices is not None:
            raise ValueError("Use either index or indices, not both")

        values = self.layout_indices
        if not values:
            raise ValueError("At least one slide index is required")
        if len(values) > MAX_PARALLEL_SLIDE_LAYOUTS:
            raise ValueError(
                f"At most {MAX_PARALLEL_SLIDE_LAYOUTS} slide layouts can be "
                "created at once"
            )
        if any(index < 0 for index in values):
            raise ValueError("Slide indices must be non-negative")
        if len(values) != len(set(values)):
            raise ValueError("Slide indices must be unique")
        return self

    @property
    def layout_indices(self) -> list[int]:
        if self.indices is not None:
            return list(self.indices)
        if self.index is not None:
            return [self.index]
        return []


class CreatedTemplateSlideLayout(BaseModel):
    index: int = Field(ge=0)
    layout: SlideLayout


class CreateTemplateLayoutsResponse(BaseModel):
    layouts: list[CreatedTemplateSlideLayout]


class GenerateTemplateLayoutRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    template_id: str = Field(validation_alias=AliasChoices("template_id", "id"))
    prompt: str = Field(min_length=1, max_length=8000)

    @model_validator(mode="after")
    def _normalize_prompt(self) -> "GenerateTemplateLayoutRequest":
        self.template_id = self.template_id.strip()
        self.prompt = self.prompt.strip()
        if not self.template_id:
            raise ValueError("Template ID cannot be empty")
        if not self.prompt:
            raise ValueError("Prompt cannot be empty")
        return self


class GenerateTemplateLayoutResponse(BaseModel):
    layout: SlideLayout
    response: str


class PatchTemplateSlideLayoutItem(BaseModel):
    index: int = Field(ge=0)
    layout: SlideLayout


class PatchTemplateSlideLayoutRequest(BaseModel):
    index: Optional[int] = Field(default=None, ge=0)
    layout: Optional[SlideLayout] = None
    layouts: Optional[list[PatchTemplateSlideLayoutItem]] = None

    @model_validator(mode="after")
    def _validate_layout_items(self) -> "PatchTemplateSlideLayoutRequest":
        has_single = self.index is not None or self.layout is not None
        has_batch = self.layouts is not None
        if has_single and has_batch:
            raise ValueError("Use either a single layout or layouts, not both")
        if has_single and (self.index is None or self.layout is None):
            raise ValueError("Both index and layout are required")
        if not has_single and not has_batch:
            raise ValueError("Either a single layout or layouts is required")
        if has_batch:
            if not self.layouts:
                raise ValueError("At least one layout is required")
            indices = [item.index for item in self.layouts]
            if len(indices) != len(set(indices)):
                raise ValueError("Layout indices must be unique")
        return self

    @property
    def layout_items(self) -> list[PatchTemplateSlideLayoutItem]:
        if self.layouts is not None:
            return list(self.layouts)
        if self.index is None or self.layout is None:
            return []
        return [
            PatchTemplateSlideLayoutItem(
                index=self.index,
                layout=self.layout,
            )
        ]


class UpdateTemplateMetadataRequest(BaseModel):
    id: Optional[str] = None
    name: Optional[str] = None
    description: Optional[str] = None
    layout_count: Optional[int] = Field(default=None, ge=0)
    thumbnail: Optional[str] = None
    is_default: Optional[bool] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    merged_components: Optional[dict[str, Any]] = None
    layouts: Optional[dict[str, Any]] = None
    fonts: Optional[dict[str, str]] = None
    icon_type: Optional[IconType] = None


class TemplateListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    description: Optional[str] = None
    layout_count: int = 0
    thumbnail: Optional[str] = None
    is_default: bool = False
    created_at: datetime
    updated_at: datetime


class TemplateListResponse(BaseModel):
    items: list[TemplateListItem]
    total: int
    page: int
    page_size: int


class TemplateResponse(TemplateListItem):
    merged_components: Optional[dict[str, Any]] = None
    layouts: Optional[dict[str, Any]] = None
    fonts: dict[str, str] = Field(default_factory=dict)


def _template_task_progress_data(
    created_layouts: int,
    remaining_layouts: int,
    name: str | None = None,
    thumbnail: str | None = None,
    completed_layout_indices: set[int] | None = None,
) -> dict[str, Any]:
    total_layouts = max(created_layouts, 0) + max(remaining_layouts, 0)
    if completed_layout_indices is None:
        completed_layout_indices = set(range(max(created_layouts, 0)))
    return {
        "created_layouts": max(created_layouts, 0),
        "remaining_layouts": max(remaining_layouts, 0),
        "slide_layout_statuses": [
            {
                "index": index,
                "status": "completed"
                if index in completed_layout_indices
                else "pending",
            }
            for index in range(total_layouts)
        ],
        "name": name,
        "thumbnail": thumbnail,
    }


def _template_request_name(request: InitTemplateRequest) -> str:
    return (request.name or "").strip() or _derive_template_name(request.pptx_url, "")


def _template_request_thumbnail(request: InitTemplateRequest) -> str | None:
    for slide_image_url in request.slide_image_urls:
        if isinstance(slide_image_url, str) and slide_image_url.strip():
            return slide_image_url.strip()
    return None


def _template_request_icon_type(request: InitTemplateRequest) -> str:
    return extract_icon_type_from_settings(request.model_dump(mode="json"))


def _derive_template_name(pptx_url: str, pptx_path: str) -> str:
    source = pptx_path or unquote(urlparse(pptx_url).path) or pptx_url
    basename = os.path.basename(source.rstrip("/"))
    if "----" in basename:
        basename = get_original_file_name(basename)
    name = os.path.splitext(basename)[0].strip()
    return name or "Untitled template"


def _collect_image_urls_from_layouts(layouts_json: dict[str, Any]) -> list[str]:
    images: list[str] = []
    seen: set[str] = set()

    def visit(value: Any) -> None:
        if isinstance(value, dict):
            if value.get("type") == "image":
                image_data = value.get("data")
                if isinstance(image_data, str):
                    image_url = image_data.strip()
                    if image_url and image_url not in seen:
                        seen.add(image_url)
                        images.append(image_url)

            for child_value in value.values():
                visit(child_value)
            return

        if isinstance(value, list):
            for item in value:
                visit(item)

    visit(layouts_json)
    return images


def _icon_type_value(value: Any) -> str | None:
    raw_value = getattr(value, "value", value)
    if not isinstance(raw_value, str):
        return None

    normalized = raw_value.strip().lower().replace("_", "-")
    if normalized in ALLOWED_ICON_TYPES:
        return normalized
    return None


def _count_icon_types_in_elements(
    elements: list[Any],
    counts: Counter[str],
) -> None:
    for element in elements:
        if isinstance(element, SlideImageElement):
            icon_type = _icon_type_value(element.icon_type)
            if icon_type is not None:
                counts[icon_type] += 1

        child = getattr(element, "child", None)
        if child is not None:
            _count_icon_types_in_elements([child], counts)

        children = getattr(element, "children", None)
        if isinstance(children, list):
            _count_icon_types_in_elements(children, counts)


def _most_common_icon_type_in_layouts(layouts: SlideLayouts) -> str | None:
    counts: Counter[str] = Counter()
    for layout in layouts.layouts:
        for component in layout.components:
            _count_icon_types_in_elements(component.elements, counts)

    return counts.most_common(1)[0][0] if counts else None


def _template_generated_icon_type(
    request: InitTemplateRequest,
    generated_layouts: SlideLayouts,
) -> str:
    generated_icon_type = _most_common_icon_type_in_layouts(generated_layouts)
    return generated_icon_type or _template_request_icon_type(request)


def _set_template_icon_type_asset(
    assets: dict[str, Any],
    generated_layouts: SlideLayouts,
) -> None:
    icon_type = _most_common_icon_type_in_layouts(generated_layouts)
    if icon_type is None:
        return

    assets["icon_type"] = icon_type
    assets["icon_weight"] = icon_type


def _count_layouts(layouts_json: Any) -> int:
    if isinstance(layouts_json, dict):
        layouts = layouts_json.get("layouts")
        return len(layouts) if isinstance(layouts, list) else 0
    if isinstance(layouts_json, list):
        return len(layouts_json)
    return 0


async def _generate_slide_layouts(
    raw_layouts: RawSlideLayouts,
    slide_image_urls: list[str],
    fonts: dict[str, str] | None = None,
) -> SlideLayouts:
    LOGGER.info(
        "[template.create] slide layout generation start slides=%d",
        len(raw_layouts.layouts),
    )
    try:
        generated_layouts = await _run_template_generation_thread(
            generate_template,
            raw_layouts,
            slide_image_urls,
            fonts,
        )
        layouts = _coerce_generated_slide_layouts(generated_layouts)
    except (ValidationError, ValueError) as exc:
        LOGGER.exception(
            "[template.create] slide layout generation produced invalid output "
            "slides=%d",
            len(raw_layouts.layouts),
        )
        raise HTTPException(
            status_code=500,
            detail="Slide layout generation produced invalid output",
        ) from exc

    LOGGER.info(
        "[template.create] slide layout generation complete slides=%d "
        "components=%d",
        len(layouts.layouts),
        sum(len(layout.components) for layout in layouts.layouts),
    )
    return layouts


async def _merge_generated_components(layouts: SlideLayouts) -> MergedComponents:
    LOGGER.info(
        "[template.create] component de-duplication start components=%d",
        sum(len(layout.components) for layout in layouts.layouts),
    )
    try:
        merged_components = await _run_template_generation_thread(
            merge_similar_components,
            layouts,
        )
    except (ValidationError, ValueError) as exc:
        LOGGER.exception(
            "[template.create] component de-duplication produced invalid output"
        )
        return MergedComponents(components=[])

    LOGGER.info(
        "[template.create] component de-duplication complete merged_components=%d",
        len(merged_components.components),
    )
    return merged_components


async def _commit_template_task_progress(
    task: AsyncTaskModel,
    sql_session: AsyncSession,
    *,
    completed_layout_indices: set[int],
    total_layouts: int,
    name: str | None,
    thumbnail: str | None,
) -> None:
    task.data = _template_task_progress_data(
        created_layouts=len(completed_layout_indices),
        remaining_layouts=total_layouts - len(completed_layout_indices),
        completed_layout_indices=completed_layout_indices,
        name=name,
        thumbnail=thumbnail,
    )
    task.updated_at = datetime.now()
    sql_session.add(task)
    await sql_session.commit()


def _ensure_unique_async_slide_layout_ids(
    layouts: list[SlideLayout],
) -> list[SlideLayout]:
    used_ids: set[str] = set()
    unique_layouts: list[SlideLayout] = []
    for index, layout in enumerate(layouts):
        if layout.id not in used_ids:
            used_ids.add(layout.id)
            unique_layouts.append(layout)
            continue

        suffix = index + 1
        candidate_id = f"{layout.id}_{suffix}"
        while candidate_id in used_ids:
            suffix += 1
            candidate_id = f"{layout.id}_{suffix}"
        used_ids.add(candidate_id)
        unique_layouts.append(
            layout.model_copy(deep=True, update={"id": candidate_id})
        )
    return unique_layouts


async def _generate_slide_layouts_with_task_progress(
    raw_layouts: RawSlideLayouts,
    slide_image_urls: list[str],
    fonts: dict[str, str] | None,
    task: AsyncTaskModel,
    sql_session: AsyncSession,
    *,
    name: str | None,
    thumbnail: str | None,
) -> SlideLayouts:
    if not raw_layouts.layouts:
        raise ValueError("layouts must contain at least one slide layout")
    if len(slide_image_urls) != len(raw_layouts.layouts):
        raise ValueError("slide_image_urls must contain one image for each layout")

    slide_count = len(raw_layouts.layouts)
    max_workers = min(MAX_PARALLEL_SLIDE_LAYOUTS, slide_count)
    LOGGER.info(
        "[template.create.async] slide layout generation start "
        "task_id=%s slides=%d max_parallel=%d",
        task.id,
        slide_count,
        max_workers,
    )
    loop = asyncio.get_running_loop()
    completed_layout_indices: set[int] = set()
    layouts_by_index: dict[int, SlideLayout] = {}

    async def generate_one(index: int, executor: ThreadPoolExecutor):
        context = copy_context()
        generated_layout = await loop.run_in_executor(
            executor,
            context.run,
            partial(
                generate_slide_layout,
                raw_layouts.layouts[index],
                index,
                slide_image_urls[index],
                fonts,
                max_tokens=SLIDE_LAYOUT_GENERATION_MAX_TOKENS,
            ),
        )
        layout = (
            generated_layout
            if isinstance(generated_layout, SlideLayout)
            else SlideLayout.model_validate(generated_layout)
        )
        return index, layout

    with ThreadPoolExecutor(
        max_workers=max_workers,
        thread_name_prefix="template-slide-layout",
    ) as executor:
        pending_tasks = [
            asyncio.create_task(generate_one(index, executor))
            for index in range(slide_count)
        ]
        try:
            for completed_task in asyncio.as_completed(pending_tasks):
                index, layout = await completed_task
                layouts_by_index[index] = layout
                completed_layout_indices.add(index)
                await _commit_template_task_progress(
                    task,
                    sql_session,
                    completed_layout_indices=completed_layout_indices,
                    total_layouts=slide_count,
                    name=name,
                    thumbnail=thumbnail,
                )
                LOGGER.info(
                    "[template.create.async] slide layout complete "
                    "task_id=%s slide=%d/%d components=%d completed=%d/%d",
                    task.id,
                    index + 1,
                    slide_count,
                    len(layout.components),
                    len(completed_layout_indices),
                    slide_count,
                )
        except Exception:
            for pending_task in pending_tasks:
                pending_task.cancel()
            raise

    ordered_layouts = [layouts_by_index[index] for index in range(slide_count)]
    unique_layouts = _ensure_unique_async_slide_layout_ids(ordered_layouts)
    layouts = _with_randomized_layout_ids(SlideLayouts(layouts=unique_layouts))
    LOGGER.info(
        "[template.create.async] slide layout generation complete "
        "task_id=%s slides=%d components=%d",
        task.id,
        len(layouts.layouts),
        sum(len(layout.components) for layout in layouts.layouts),
    )
    return layouts


async def _run_template_generation_thread(func: Any, *args: Any) -> Any:
    loop = asyncio.get_running_loop()
    context = copy_context()
    with ThreadPoolExecutor(
        max_workers=1,
        thread_name_prefix="template-generation",
    ) as executor:
        return await loop.run_in_executor(executor, context.run, partial(func, *args))


def _coerce_generated_slide_layouts(generated_layouts: Any) -> SlideLayouts:
    if isinstance(generated_layouts, SlideLayouts):
        return generated_layouts
    return SlideLayouts.model_validate(generated_layouts)


def _coerce_template_slide_layouts(layouts_json: Any) -> SlideLayouts:
    if isinstance(layouts_json, SlideLayouts):
        return layouts_json
    if isinstance(layouts_json, list):
        return SlideLayouts.model_validate({"layouts": layouts_json})
    return SlideLayouts.model_validate(layouts_json)


def _with_randomized_layout_ids(layouts: SlideLayouts) -> SlideLayouts:
    return SlideLayouts(
        layouts=[
            layout.model_copy(
                deep=True,
                update={
                    "id": f"{layout.id}_{random.randint(1000, 9999)}",
                },
            )
            for layout in layouts.layouts
        ]
    )


def _get_template_slide_image_urls(template: TemplateV2) -> list[str | None]:
    if not isinstance(template.assets, dict):
        return []

    slide_image_urls = template.assets.get("slide_image_urls")
    if not isinstance(slide_image_urls, list):
        return []

    return [
        slide_image_url.strip()
        if isinstance(slide_image_url, str) and slide_image_url.strip()
        else None
        for slide_image_url in slide_image_urls
    ]


def _coerce_font_map(value: Any) -> dict[str, str]:
    if not isinstance(value, dict):
        return {}
    return {
        name.strip(): url.strip()
        for name, url in value.items()
        if isinstance(name, str)
        and isinstance(url, str)
        and name.strip()
        and url.strip()
    }


def _get_template_fonts(template: TemplateV2) -> dict[str, str]:
    if not isinstance(template.assets, dict):
        return {}
    return _coerce_font_map(template.assets.get("fonts"))


def _get_template_thumbnail_from_assets(assets: Any) -> str | None:
    if not isinstance(assets, dict):
        return None

    thumbnail = assets.get("thumbnail")
    if isinstance(thumbnail, str) and thumbnail.strip():
        return thumbnail.strip()

    slide_image_urls = assets.get("slide_image_urls")
    if not isinstance(slide_image_urls, list):
        return None

    for slide_image_url in slide_image_urls:
        if isinstance(slide_image_url, str) and slide_image_url.strip():
            return slide_image_url.strip()
    return None


async def _get_template_layout_patch_lock(template_id: str) -> asyncio.Lock:
    async with _TEMPLATE_LAYOUT_PATCH_LOCKS_GUARD:
        lock = _TEMPLATE_LAYOUT_PATCH_LOCKS.get(template_id)
        if lock is None:
            lock = asyncio.Lock()
            _TEMPLATE_LAYOUT_PATCH_LOCKS[template_id] = lock
        return lock


async def _prepare_template_source(
    request: InitTemplateRequest,
    *,
    operation: str,
) -> tuple[str, RawSlideLayouts, dict[str, Any], dict[str, str]]:
    LOGGER.info(
        "[template.%s] request received pptx_url=%s slide_images=%d "
        "font_count=%d has_name=%s",
        operation,
        request.pptx_url,
        len(request.slide_image_urls),
        len(request.fonts or {}),
        bool((request.name or "").strip()),
    )
    if not request.slide_image_urls:
        LOGGER.warning(
            "[template.%s] rejected request without slide images pptx_url=%s",
            operation,
            request.pptx_url,
        )
        raise HTTPException(
            status_code=400, detail="At least one slide image is required"
        )

    pptx_path = resolve_app_path_to_filesystem(request.pptx_url)
    if not pptx_path or not os.path.isfile(pptx_path):
        LOGGER.warning(
            "[template.%s] rejected request; PPTX file not found "
            "pptx_url=%s resolved_path=%s",
            operation,
            request.pptx_url,
            pptx_path,
        )
        raise HTTPException(status_code=400, detail="PPTX file not found")

    LOGGER.info(
        "[template.%s] converting PPTX to JSON pptx_path=%s",
        operation,
        pptx_path,
    )
    pptx_json = await EXPORT_TASK_SERVICE.convert_pptx_to_json(pptx_path)
    try:
        raw_layouts = RawSlideLayouts.model_validate(
            pptx_json.model_dump(mode="json")
        )
    except ValidationError as exc:
        LOGGER.exception(
            "[template.%s] PPTX-to-JSON export produced invalid slide "
            "layout JSON pptx_path=%s",
            operation,
            pptx_path,
        )
        raise HTTPException(
            status_code=500,
            detail="PPTX-to-JSON export produced invalid slide layout JSON",
        ) from exc
    LOGGER.info(
        "[template.%s] PPTX-to-JSON validation complete pptx_path=%s "
        "slides=%d",
        operation,
        pptx_path,
        len(raw_layouts.layouts),
    )

    if len(raw_layouts.layouts) > len(request.slide_image_urls):
        LOGGER.info(
            "[template.%s] capping raw layouts to preview images "
            "raw_slides=%d slide_images=%d",
            operation,
            len(raw_layouts.layouts),
            len(request.slide_image_urls),
        )
        raw_layouts = RawSlideLayouts(
            layouts=raw_layouts.layouts[: len(request.slide_image_urls)]
        )
    elif len(request.slide_image_urls) > len(raw_layouts.layouts):
        raise HTTPException(
            status_code=400,
            detail="Exactly one slide image is required for each slide layout",
        )

    return (
        pptx_path,
        raw_layouts,
        raw_layouts.model_dump(mode="json", exclude_none=True),
        _coerce_font_map(request.fonts),
    )


def _layout_indexes_from_assets(assets: Any, layout_count: int) -> list[int]:
    if isinstance(assets, dict):
        indexes = assets.get("layout_indexes")
        if (
            isinstance(indexes, list)
            and len(indexes) == layout_count
            and all(isinstance(index, int) and index >= 0 for index in indexes)
            and len(indexes) == len(set(indexes))
        ):
            return list(indexes)
    return list(range(layout_count))


def _raw_layout_count(template: TemplateV2) -> int | None:
    if not isinstance(template.raw_layouts, dict):
        return None
    layouts = template.raw_layouts.get("layouts")
    return len(layouts) if isinstance(layouts, list) else None


def _merge_template_layout_items(
    template: TemplateV2,
    items: list[PatchTemplateSlideLayoutItem],
) -> tuple[SlideLayouts, list[int]]:
    existing_layouts = (
        _coerce_template_slide_layouts(template.layouts)
        if template.layouts is not None
        else None
    )
    existing_items = existing_layouts.layouts if existing_layouts else []
    layout_indexes = _layout_indexes_from_assets(template.assets, len(existing_items))
    layout_by_index = dict(zip(layout_indexes, existing_items))
    raw_slide_count = _raw_layout_count(template)
    if raw_slide_count is None:
        max_slide_count = len(existing_layouts.layouts) if existing_layouts else None
    elif existing_layouts is not None:
        max_slide_count = max(raw_slide_count, len(existing_layouts.layouts))
    else:
        max_slide_count = raw_slide_count

    for item in items:
        if max_slide_count is not None and item.index >= max_slide_count:
            raise HTTPException(status_code=400, detail="Invalid slide index")
        layout_by_index[item.index] = item.layout

    ordered_indexes = sorted(layout_by_index)
    try:
        return (
            SlideLayouts(
                layouts=[layout_by_index[index] for index in ordered_indexes]
            ),
            ordered_indexes,
        )
    except ValidationError as exc:
        raise HTTPException(
            status_code=400,
            detail="Patched template layouts are invalid",
        ) from exc


def _generate_indexed_slide_layouts(
    raw_layouts: RawSlideLayouts,
    indices: list[int],
    slide_image_urls: list[str | None],
    fonts: dict[str, str],
) -> list[CreatedTemplateSlideLayout]:
    max_workers = min(MAX_PARALLEL_SLIDE_LAYOUTS, len(indices))
    layouts_by_index: dict[int, SlideLayout] = {}
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = {
            executor.submit(
                copy_context().run,
                partial(
                    generate_slide_layout,
                    raw_layouts.layouts[index],
                    index,
                    slide_image_urls[index],
                    fonts,
                    max_tokens=SLIDE_LAYOUT_GENERATION_MAX_TOKENS,
                ),
            ): index
            for index in indices
        }
        for future in as_completed(futures):
            index = futures[future]
            generated_layout = future.result()
            layouts_by_index[index] = (
                generated_layout
                if isinstance(generated_layout, SlideLayout)
                else SlideLayout.model_validate(generated_layout)
            )

    ordered_layouts = [layouts_by_index[index] for index in indices]
    randomized = _with_randomized_layout_ids(SlideLayouts(layouts=ordered_layouts))
    return [
        CreatedTemplateSlideLayout(index=index, layout=layout)
        for index, layout in zip(indices, randomized.layouts)
    ]


@TEMPLATE_ROUTER.get(
    "/all",
    response_model=TemplateListResponse,
    operation_id="template_list",
)
async def list_templates(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    default: Annotated[
        Optional[bool],
        Query(
            description="Only include default templates when true, custom templates when false.",
        ),
    ] = None,
    sql_session: AsyncSession = Depends(get_async_session),
):
    offset = (page - 1) * page_size
    query = (
        select(
            TemplateV2.id,
            TemplateV2.name,
            TemplateV2.description,
            TemplateV2.layouts,
            TemplateV2.assets,
            TemplateV2.is_default,
            TemplateV2.created_at,
            TemplateV2.updated_at,
        )
        .order_by(TemplateV2.created_at.desc())
    )
    if default is not None:
        query = query.where(TemplateV2.is_default == default)

    result = await sql_session.execute(query)

    items: list[TemplateListItem] = []
    for (
        template_id,
        name,
        description,
        layouts,
        assets,
        is_default,
        created_at,
        updated_at,
    ) in result.all():
        if default is not None and bool(is_default) != default:
            continue

        layout_count = _count_layouts(layouts)
        if layout_count == 0:
            continue

        items.append(
            TemplateListItem(
                id=template_id,
                name=name,
                description=description,
                layout_count=layout_count,
                thumbnail=_get_template_thumbnail_from_assets(assets),
                is_default=is_default,
                created_at=created_at,
                updated_at=updated_at,
            )
        )

    return TemplateListResponse(
        items=items[offset : offset + page_size],
        total=len(items),
        page=page,
        page_size=page_size,
    )


@TEMPLATE_ROUTER.post(
    "/fonts-upload-and-slides-preview",
    response_model=FontsUploadAndSlidesPreviewResponse,
)
async def upload_template_fonts_and_slides_preview(
    pptx_file: UploadFile = File(..., description="PPTX file to preview"),
    font_files: Optional[list[UploadFile]] = File(
        default=None, description="Font files to upload"
    ),
    original_font_names: Optional[list[str]] = Form(default=None),
    google_font_original_names: Optional[list[str]] = Form(default=None),
    google_font_replacement_names: Optional[list[str]] = Form(default=None),
    google_font_names: Optional[list[str]] = Form(default=None),
    google_font_urls: Optional[list[str]] = Form(default=None),
):
    return await upload_fonts_and_slides_preview_handler(
        pptx_file=pptx_file,
        font_files=font_files,
        original_font_names=original_font_names,
        google_font_original_names=google_font_original_names,
        google_font_replacement_names=google_font_replacement_names,
        google_font_names=google_font_names,
        google_font_urls=google_font_urls,
    )


@TEMPLATE_ROUTER.post(
    "/init",
    status_code=201,
    response_model=str,
)
async def init_template(
    request: InitTemplateRequest = Body(...),
    sql_session: AsyncSession = Depends(get_async_session),
):
    pptx_path, raw_layouts, raw_layouts_json, available_fonts = (
        await _prepare_template_source(request, operation="init")
    )
    icon_type = _template_request_icon_type(request)
    template = TemplateV2(
        name=(request.name or "").strip() or _derive_template_name(
            request.pptx_url, pptx_path
        ),
        description=request.description,
        raw_layouts=raw_layouts_json,
        layouts=None,
        assets={
            "pptx_url": request.pptx_url,
            "icon_type": icon_type,
            "icon_weight": icon_type,
            "fonts": available_fonts,
            "slide_image_urls": request.slide_image_urls,
            "images": _collect_image_urls_from_layouts(raw_layouts_json),
            "layout_indexes": [],
        },
    )
    LOGGER.info(
        "[template.init] persisting template name=%s slides=%d images=%d",
        template.name,
        len(raw_layouts.layouts),
        len(template.assets.get("images", [])),
    )
    sql_session.add(template)
    await sql_session.commit()
    await sql_session.refresh(template)
    LOGGER.info(
        "[template.init] template persisted template_id=%s name=%s",
        template.id,
        template.name,
    )
    return template.id


def _build_created_template(
    request: CreateTemplateRequest,
    *,
    pptx_path: str,
    raw_layouts_json: dict[str, Any],
    available_fonts: dict[str, str],
    generated_layouts: SlideLayouts,
    merged_components: MergedComponents,
) -> TemplateV2:
    icon_type = _template_generated_icon_type(request, generated_layouts)
    return TemplateV2(
        name=(request.name or "").strip() or _derive_template_name(
            request.pptx_url, pptx_path
        ),
        description=request.description,
        raw_layouts=raw_layouts_json,
        merged_components=merged_components.model_dump(
            mode="json", exclude_none=True
        ),
        layouts=generated_layouts.model_dump(mode="json", exclude_none=True),
        assets={
            "icon_type": icon_type,
            "icon_weight": icon_type,
            "fonts": available_fonts,
            "slide_image_urls": request.slide_image_urls,
            "images": _collect_image_urls_from_layouts(raw_layouts_json),
        },
    )


async def _create_template_sync(
    request: CreateTemplateRequest = Body(...),
    sql_session: AsyncSession = Depends(get_async_session),
):
    pptx_path, raw_layouts, raw_layouts_json, available_fonts = (
        await _prepare_template_source(request, operation="create")
    )
    generated_layouts = await _generate_slide_layouts(
        raw_layouts,
        request.slide_image_urls,
        available_fonts,
    )
    generated_layouts = _with_randomized_layout_ids(generated_layouts)
    merged_components = await _merge_generated_components(generated_layouts)
    template = _build_created_template(
        request,
        pptx_path=pptx_path,
        raw_layouts_json=raw_layouts_json,
        available_fonts=available_fonts,
        generated_layouts=generated_layouts,
        merged_components=merged_components,
    )
    LOGGER.info(
        "[template.create] persisting template name=%s slides=%d images=%d",
        template.name,
        len(raw_layouts.layouts),
        len(template.assets.get("images", [])),
    )
    sql_session.add(template)
    await sql_session.commit()
    await sql_session.refresh(template)
    LOGGER.info(
        "[template.create] template persisted template_id=%s name=%s",
        template.id,
        template.name,
    )
    return template


async def _create_template_with_task_progress(
    request: CreateTemplateRequest,
    task: AsyncTaskModel,
    sql_session: AsyncSession,
) -> TemplateV2:
    pptx_path, raw_layouts, raw_layouts_json, available_fonts = (
        await _prepare_template_source(request, operation="create")
    )
    name = (request.name or "").strip() or _derive_template_name(
        request.pptx_url, pptx_path
    )
    thumbnail = _template_request_thumbnail(request)
    await _commit_template_task_progress(
        task,
        sql_session,
        completed_layout_indices=set(),
        total_layouts=len(raw_layouts.layouts),
        name=name,
        thumbnail=thumbnail,
    )
    try:
        generated_layouts = await _generate_slide_layouts_with_task_progress(
            raw_layouts,
            request.slide_image_urls,
            available_fonts,
            task,
            sql_session,
            name=name,
            thumbnail=thumbnail,
        )
    except (ValidationError, ValueError) as exc:
        LOGGER.exception(
            "[template.create.async] slide layout generation produced "
            "invalid output task_id=%s slides=%d",
            task.id,
            len(raw_layouts.layouts),
        )
        raise HTTPException(
            status_code=500,
            detail="Slide layout generation produced invalid output",
        ) from exc
    merged_components = await _merge_generated_components(generated_layouts)
    template = _build_created_template(
        request,
        pptx_path=pptx_path,
        raw_layouts_json=raw_layouts_json,
        available_fonts=available_fonts,
        generated_layouts=generated_layouts,
        merged_components=merged_components,
    )
    LOGGER.info(
        "[template.create.async] persisting template task_id=%s name=%s "
        "slides=%d images=%d",
        task.id,
        template.name,
        len(raw_layouts.layouts),
        len(template.assets.get("images", [])),
    )
    sql_session.add(template)
    await sql_session.commit()
    await sql_session.refresh(template)
    LOGGER.info(
        "[template.create.async] template persisted task_id=%s "
        "template_id=%s name=%s",
        task.id,
        template.id,
        template.name,
    )
    return template


async def _run_create_template_task(
    task_id: str,
    request: CreateTemplateRequest,
) -> None:
    async with async_session_maker() as sql_session:
        task = await sql_session.get(AsyncTaskModel, task_id)
        if not task:
            LOGGER.warning(
                "[template.create.async] task missing task_id=%s",
                task_id,
            )
            return

        try:
            task.status = AsyncTaskStatus.PENDING
            task.message = "Creating template"
            task.data = _template_task_progress_data(
                created_layouts=0,
                remaining_layouts=len(request.slide_image_urls),
                name=_template_request_name(request),
                thumbnail=_template_request_thumbnail(request),
            )
            task.updated_at = datetime.now()
            sql_session.add(task)
            await sql_session.commit()

            task.message = "Generating slide layouts"
            template = await _create_template_with_task_progress(
                request,
                task,
                sql_session,
            )
            created_layouts = _count_layouts(template.layouts)

            task.status = AsyncTaskStatus.COMPLETED
            task.message = "Template creation completed"
            task.data = _template_task_progress_data(
                created_layouts=created_layouts,
                remaining_layouts=len(request.slide_image_urls) - created_layouts,
                name=template.name,
                thumbnail=_get_template_thumbnail_from_assets(template.assets),
            )
            task.updated_at = datetime.now()
            sql_session.add(task)
            await sql_session.commit()
        except Exception as exc:
            LOGGER.exception(
                "[template.create.async] template creation failed task_id=%s",
                task_id,
            )
            task.status = AsyncTaskStatus.ERROR
            task.message = "Template creation failed"
            api_error = APIErrorModel.from_exception(
                exc
                if isinstance(exc, HTTPException)
                else HTTPException(status_code=500, detail="Template creation failed")
            )
            task.error = api_error.model_dump(mode="json")
            task.updated_at = datetime.now()
            sql_session.add(task)
            await sql_session.commit()


@TEMPLATE_ROUTER.post(
    "/async",
    status_code=201,
    response_model=AsyncTaskModel,
)
async def create_template(
    background_tasks: BackgroundTasks,
    request: CreateTemplateRequest = Body(...),
    sql_session: AsyncSession = Depends(get_async_session),
):
    task = AsyncTaskModel(
        type=ASYNC_TASK_TYPE_TEMPLATE_CREATE,
        status=AsyncTaskStatus.PENDING,
        message="Queued for template creation",
        data=_template_task_progress_data(
            created_layouts=0,
            remaining_layouts=len(request.slide_image_urls),
            name=_template_request_name(request),
            thumbnail=_template_request_thumbnail(request),
        ),
    )
    sql_session.add(task)
    await sql_session.commit()
    await sql_session.refresh(task)

    background_tasks.add_task(_run_create_template_task, task.id, request)
    return task


@TEMPLATE_ROUTER.post(
    "/layouts/generate",
    response_model=GenerateTemplateLayoutResponse,
)
async def generate_template_layout_from_prompt(
    request: GenerateTemplateLayoutRequest = Body(...),
    sql_session: AsyncSession = Depends(get_async_session),
):
    template = await sql_session.get(TemplateV2, request.template_id)
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    if template.layouts is None:
        raise HTTPException(
            status_code=400,
            detail="Template layouts are unavailable",
        )

    try:
        template_layouts = _coerce_template_slide_layouts(template.layouts)
    except ValidationError as exc:
        LOGGER.exception(
            "[template.layouts.generate] template has invalid layouts "
            "template_id=%s",
            request.template_id,
        )
        raise HTTPException(
            status_code=500,
            detail="Template layouts are invalid",
        ) from exc

    merged_components: MergedComponents | None = None
    if template.merged_components is not None:
        try:
            merged_components = MergedComponents.model_validate(
                template.merged_components
            )
        except ValidationError:
            LOGGER.warning(
                "[template.layouts.generate] ignoring invalid merged components "
                "template_id=%s",
                request.template_id,
                exc_info=True,
            )

    LOGGER.info(
        "[template.layouts.generate] prompted layout generation start "
        "template_id=%s reference_layouts=%d",
        request.template_id,
        len(template_layouts.layouts),
    )
    try:
        layout = await _run_template_generation_thread(
            generate_prompted_slide_layout,
            request.prompt,
            template_layouts,
            merged_components,
            template.name,
            template.description,
            _get_template_fonts(template),
        )
    except Exception as exc:
        LOGGER.exception(
            "[template.layouts.generate] prompted layout generation failed "
            "template_id=%s",
            request.template_id,
        )
        raise handle_llm_client_exceptions(exc) from exc

    generated_layout = (
        layout
        if isinstance(layout, SlideLayout)
        else SlideLayout.model_validate(layout)
    )
    LOGGER.info(
        "[template.layouts.generate] prompted layout generation complete "
        "template_id=%s layout_id=%s components=%d",
        request.template_id,
        generated_layout.id,
        len(generated_layout.components),
    )
    return GenerateTemplateLayoutResponse(
        layout=generated_layout,
        response=(
            f"Created the {generated_layout.id.replace('_', ' ')} "
            "template layout."
        ),
    )


@TEMPLATE_ROUTER.post(
    "/layouts/create",
    response_model=CreateTemplateLayoutsResponse,
)
async def create_template_slide_layouts(
    request: CreateTemplateLayoutsRequest = Body(...),
    sql_session: AsyncSession = Depends(get_async_session),
):
    template = await sql_session.get(TemplateV2, request.template_id)
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    _require_private_template(template)

    if not isinstance(template.raw_layouts, dict):
        raise HTTPException(
            status_code=400,
            detail="Template raw layouts are unavailable",
        )

    try:
        raw_layouts = RawSlideLayouts.model_validate(template.raw_layouts)
    except ValidationError as exc:
        LOGGER.exception(
            "[template.layouts.create] template has invalid raw layouts "
            "template_id=%s",
            request.template_id,
        )
        raise HTTPException(
            status_code=500,
            detail="Template raw layouts are invalid",
        ) from exc

    indices = request.layout_indices
    if any(index >= len(raw_layouts.layouts) for index in indices):
        raise HTTPException(status_code=400, detail="Invalid slide index")

    slide_image_urls = _get_template_slide_image_urls(template)
    missing_slide_image = any(
        index >= len(slide_image_urls) or slide_image_urls[index] is None
        for index in indices
    )
    if missing_slide_image:
        raise HTTPException(
            status_code=400,
            detail="Slide image URL is unavailable for requested slide index",
        )

    LOGGER.info(
        "[template.layouts.create] slide layout creation start "
        "template_id=%s slides=%s/%d",
        request.template_id,
        ",".join(str(index + 1) for index in indices),
        len(raw_layouts.layouts),
    )
    try:
        created_layouts = await _run_template_generation_thread(
            _generate_indexed_slide_layouts,
            raw_layouts,
            indices,
            slide_image_urls,
            _get_template_fonts(template),
        )
    except (ValidationError, ValueError) as exc:
        LOGGER.exception(
            "[template.layouts.create] slide layout creation produced "
            "invalid output template_id=%s slides=%s",
            request.template_id,
            ",".join(str(index + 1) for index in indices),
        )
        raise HTTPException(
            status_code=500,
            detail="Slide layout creation produced invalid output",
        ) from exc

    LOGGER.info(
        "[template.layouts.create] slide layout creation complete "
        "template_id=%s slides=%s components=%d",
        request.template_id,
        ",".join(str(index + 1) for index in indices),
        sum(len(item.layout.components) for item in created_layouts),
    )
    return CreateTemplateLayoutsResponse(layouts=created_layouts)


@TEMPLATE_ROUTER.post(
    "/generate-blocks",
    response_model=TemplateResponse,
)
async def generate_template_blocks(
    request: GenerateTemplateBlocksRequest = Body(...),
    sql_session: AsyncSession = Depends(get_async_session),
):
    template = await sql_session.get(TemplateV2, request.template_id)
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    _require_private_template(template)

    if template.layouts is None:
        raise HTTPException(
            status_code=400,
            detail="Template layouts are unavailable",
        )

    try:
        layouts = _coerce_template_slide_layouts(template.layouts)
    except ValidationError as exc:
        LOGGER.exception(
            "[template.generate_blocks] template has invalid layouts "
            "template_id=%s",
            request.template_id,
        )
        raise HTTPException(
            status_code=500,
            detail="Template layouts are invalid",
        ) from exc

    merged_components = await _merge_generated_components(layouts)
    template.merged_components = merged_components.model_dump(
        mode="json",
        exclude_none=True,
    )
    sql_session.add(template)
    await sql_session.commit()
    await sql_session.refresh(template)
    LOGGER.info(
        "[template.generate_blocks] component blocks generated "
        "template_id=%s layouts=%d merged_components=%d",
        request.template_id,
        len(layouts.layouts),
        len(merged_components.components),
    )
    return template


@TEMPLATE_ROUTER.patch(
    "/{template_id}/layouts",
    response_model=TemplateResponse,
)
async def patch_template_slide_layout(
    template_id: str = Path(...),
    request: PatchTemplateSlideLayoutRequest = Body(...),
    sql_session: AsyncSession = Depends(get_async_session),
):
    lock = await _get_template_layout_patch_lock(template_id)
    async with lock:
        template = await sql_session.get(TemplateV2, template_id)
        if not template:
            raise HTTPException(status_code=404, detail="Template not found")
        _require_private_template(template)

        try:
            updated_layouts, layout_indexes = _merge_template_layout_items(
                template,
                request.layout_items,
            )
        except ValidationError as exc:
            LOGGER.exception(
                "[template.patch_layout] template has invalid layouts "
                "template_id=%s",
                template_id,
            )
            raise HTTPException(
                status_code=500,
                detail="Template layouts are invalid",
            ) from exc

        assets = dict(template.assets) if isinstance(template.assets, dict) else {}
        assets["layout_indexes"] = layout_indexes
        _set_template_icon_type_asset(assets, updated_layouts)
        template.layouts = updated_layouts.model_dump(mode="json", exclude_none=True)
        template.assets = assets
        sql_session.add(template)
        await sql_session.commit()
        await sql_session.refresh(template)
        LOGGER.info(
            "[template.patch_layout] slide layouts patched template_id=%s "
            "slides=%s saved_layouts=%d",
            template_id,
            ",".join(str(item.index + 1) for item in request.layout_items),
            len(updated_layouts.layouts),
        )
        return template


@TEMPLATE_ROUTER.patch("/{template_id}", response_model=TemplateResponse)
async def update_template_metadata(
    template_id: str = Path(...),
    request: UpdateTemplateMetadataRequest = Body(...),
    sql_session: AsyncSession = Depends(get_async_session),
):
    if request.id is not None and request.id != template_id:
        raise HTTPException(
            status_code=400,
            detail="Template ID in path does not match request body ID",
        )

    template = await sql_session.get(TemplateV2, template_id)
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    _require_private_template(template)

    has_updates = False

    if "name" in request.model_fields_set:
        name = (request.name or "").strip()
        if not name:
            raise HTTPException(status_code=400, detail="Template name is required")
        template.name = name
        has_updates = True

    if "description" in request.model_fields_set:
        description = (request.description or "").strip()
        template.description = description or None
        has_updates = True

    if "merged_components" in request.model_fields_set:
        if request.merged_components is None:
            template.merged_components = None
        else:
            try:
                merged_components = MergedComponents.model_validate(
                    request.merged_components
                )
            except ValidationError as exc:
                raise HTTPException(
                    status_code=400,
                    detail="Template merged components are invalid",
                ) from exc
            template.merged_components = merged_components.model_dump(
                mode="json",
                exclude_none=True,
            )
        has_updates = True

    if "layouts" in request.model_fields_set:
        assets = dict(template.assets) if isinstance(template.assets, dict) else {}
        if request.layouts is None:
            template.layouts = None
            assets["layout_indexes"] = []
        else:
            try:
                layouts = _coerce_template_slide_layouts(request.layouts)
            except ValidationError as exc:
                raise HTTPException(
                    status_code=400,
                    detail="Template layouts are invalid",
                ) from exc
            assets["layout_indexes"] = _layout_indexes_from_assets(
                assets,
                len(layouts.layouts),
            )
            _set_template_icon_type_asset(assets, layouts)
            template.layouts = layouts.model_dump(mode="json", exclude_none=True)
        template.assets = assets
        has_updates = True

    if "thumbnail" in request.model_fields_set:
        assets = dict(template.assets) if isinstance(template.assets, dict) else {}
        thumbnail = (request.thumbnail or "").strip()
        if thumbnail:
            assets["thumbnail"] = thumbnail
        else:
            assets.pop("thumbnail", None)
        template.assets = assets
        has_updates = True

    if "fonts" in request.model_fields_set:
        assets = dict(template.assets) if isinstance(template.assets, dict) else {}
        assets["fonts"] = _coerce_font_map(request.fonts)
        template.assets = assets
        has_updates = True

    if "icon_type" in request.model_fields_set:
        assets = dict(template.assets) if isinstance(template.assets, dict) else {}
        icon_type = extract_icon_type_from_settings(request.model_dump(mode="json"))
        assets["icon_type"] = icon_type
        assets["icon_weight"] = icon_type
        template.assets = assets
        has_updates = True

    if not has_updates:
        return template

    sql_session.add(template)
    await sql_session.commit()
    await sql_session.refresh(template)
    return template


@TEMPLATE_ROUTER.get(
    "/{template_id}",
    response_model=TemplateResponse,
    operation_id="template_get",
)
async def get_template(
    template_id: str = Path(...),
    sql_session: AsyncSession = Depends(get_async_session),
):
    template = await sql_session.get(TemplateV2, template_id)
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    return TemplateResponse(
        id=template.id,
        name=template.name,
        description=template.description,
        layout_count=_count_layouts(template.layouts),
        thumbnail=_get_template_thumbnail_from_assets(template.assets),
        is_default=template.is_default,
        created_at=template.created_at or get_current_utc_datetime(),
        updated_at=template.updated_at or get_current_utc_datetime(),
        merged_components=template.merged_components,
        layouts=template.layouts,
        fonts=_get_template_fonts(template),
    )


@TEMPLATE_ROUTER.delete("/{template_id}", status_code=204)
async def delete_template(
    template_id: str = Path(...),
    sql_session: AsyncSession = Depends(get_async_session),
):
    template = await sql_session.get(TemplateV2, template_id)
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    _require_private_template(template)
    await sql_session.delete(template)
    await sql_session.commit()
    return Response(status_code=204)
def _require_private_template(template: TemplateV2) -> None:
    if template.is_default:
        raise HTTPException(
            status_code=403,
            detail="Built-in templates are read-only",
        )
