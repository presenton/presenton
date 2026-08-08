from __future__ import annotations

import json
import logging
import mimetypes
import re
from concurrent.futures import ThreadPoolExecutor, as_completed
from contextvars import copy_context
from json import JSONDecodeError
from time import perf_counter
from typing import Any, Callable

from llmai import get_client
from llmai.shared import (
    AssistantMessage,
    ImageContentPart,
    JSONSchemaResponse,
    SystemMessage,
    ToolChoice,
    ToolChoiceMode,
    ToolResponseMessage,
    UserMessage,
)
from pydantic import BaseModel, ValidationError

from templates.v2.models.layouts import (
    Component,
    MergedComponent,
    MergedComponents,
    RawSlideLayout,
    RawSlideLayouts,
    SimilarComponentsList,
    SlideLayout,
    SlideLayouts,
)
from templates.v2.models.elements import Image as SlideImageElement
from templates.v2.models.elements import ImageFit
from templates.v2.tools import PREVIEW_SLIDE_TOOL_NAME, PreviewSlideTool
from utils.asset_directory_utils import resolve_image_path_to_filesystem
from utils.llm_config import get_llm_config
from utils.llm_provider import get_model

DEFAULT_VALIDATION_RETRIES = 5
MAX_PARALLEL_SLIDE_LAYOUTS = 10
MAX_PREVIEW_SLIDE_CALLS = 2
CONTENT_IMAGE_PLACEHOLDER_URL = "/static/images/replaceable_template_image.png"
CONTENT_ICON_PLACEHOLDER_URL = "/static/icons/placeholder.svg"

LOGGER = logging.getLogger(__name__)

_DUPLICATE_POSITION_GRID_UNITS = 5
_IGNORED_DUPLICATE_SCHEMA_KEYS = {
    "name",
    "max_length",
    "min_length",
    "max_items",
    "min_items",
    "max_item_length",
    "min_item_length",
    "max_columns",
    "min_columns",
    "max_rows",
    "min_rows",
    "max_children",
    "min_children",
}
_CONTENT_VALUE_KEYS_BY_ELEMENT_TYPE = {
    "chart": {
        "categories",
        "series",
        "source",
        "title",
        "title_color",
        "legend_color",
        "x_axis_title",
        "y_axis_title",
    },
    "image": {"data", "prompt"},
    "infographic": {"data"},
    "text": {"runs"},
    "math": {"latex"},
    "text-list": {"items"},
}


GENERATE_SLIDE_LAYOUT_SYSTEM_PROMPT = """
Convert the provided raw slide elements to components.

# Steps:
1. Analyze/Visualize the slide using provided raw pptx elements and image.
2. Divide the slide into a list of components using slide image.
3. Identify group of elements that belongs to each component.
4. Generate `id` and `description` for the layout.
5. Call `previewSlide` to visualize generated slide layout.
6. Return slide layout json if no issues are identified after `previewSlide`.

# General Rules:
- `id` and `description` must be related to layout and must not be derived from slide content.
- `id` should use 3 to 6 structural words in snake_case format.
- Do not include fixed counts or number words in `id` or `description`, such as two, three, four, numbered, or 4_bullet.
- Use plural dynamic region names instead, such as cards, bullets, sections, columns, rows, metrics, or callouts.
- Prefer clear structural ids such as `title_slide_with_image`, `title_description_right_image`, or `title_cards_bottom`.
- `description` should be around 15 to 30 words.
- `name` of element must be derived from layout, not from content.

# Layout Rules:
- Build the flexible component layout using `flex`, `grid`, `container`, etc.
- Use `flex` and `grid` only for list of similar items arranged in list or grid.
- Use `table` element for table and `chart` element for chart.
- Use `infographic` element for infographic or metric visuals like `progress_bar`, `gauge`, etc.
- Use `text-list` element for list of text like bullet points, numbered list, unordered list, etc.
- Use `math` for standalone mathematical expressions. Store valid LaTeX in `latex`; do not include `$` delimiters.
- Use `container` for flexible alignment and layout.
- Use `image` for images and icons.
- Identify icon color from slide image.
- For raster photos or generated content images, use `fit: "cover"` when the image should fill its frame without distortion, and use `fit: "contain"` when the full image must remain visible. Use `fit: "fill"` only for intentionally stretchable SVG/freeform assets, including clipped PPTX image fills with `clip_path`; never use it for plain photo boxes.

# Decorative and Content Element Rules:
- Use `decorative=false` for elements that carry slide meaning or should be replaced, including text, charts, tables, metrics, icons in bullet points and primary images/icons.
- Use `decorative=true` for fixed styling or branding, including backgrounds, frames, dividers, accents, logos, watermarks, and ornamental images/icons.
- If removal changes meaning, it is content; if removal only changes style, it is decorative.

# Position and Size Rules:
- Use local coordinates relative to component for elements.
- Every component must include `position` and `elements`.
- Don't provide position for elements inside flexible elements like `flex`, `grid`, `container`, etc.
- If children of `flex` and `grid` are not equally sized, provide `size` for children.
- Must provide `position` and `size` for elements inside `group` element.

# Chart Rules:
- Represent every chart using a single `chart` element.
- Chart coordinates are 1280x720 pixel units, never normalized 0-1 values.
- Every standalone chart must have an explicit local `position` and `size`; use the chart's visual bounds, or if adding a new chart with no source bounds, use `position: {"x": 0, "y": 0}` and a size that fills the chart component.
- Do not create tiny chart boxes. Explicit chart size must be at least 80px wide and 60px tall; prefer 640x300 or larger for primary charts.
- Detect charts by comparing the raw PPTX JSON with the reference slide image.
- When a chart is built from multiple raw elements, replace all elements that form the chart with one `chart` element.
- Chart-related parts such as legends, gridlines, axes, labels, and data series must be included within the `chart` element.
- If a line chart is represented using multiple `line` elements in the raw slide layout, remove those `line` elements and replace them with a single line `chart` element.
- If a chart legend is represented using separate `ellipse`, `shape`, or `text` elements, remove those elements. Do not recreate legends manually, because legends are included automatically by the `chart` element.
- If a chart is represented as an `image` element in the raw slide layout, convert that image into a `chart` element and remove the original `image` element.
- Always use a `chart` element for charts, even if the generated chart does not perfectly match the visual appearance of the reference slide image.
- Do not add standalone legends outside the `chart` element.

# Infographic Rules:
- Represent every infographic using a single `infographic` element.
- Detect infographic visuals by comparing the raw PPTX JSON with the reference slide image.
- When an infographic is built from multiple raw elements, replace all elements that form the infographic with one `infographic` element.
- If an infographic is represented as an `image` element in the raw slide layout, convert that image into an `infographic` element and remove the original `image` element.

# Vector Rules:
- For vector circles or ellipses, use `shape="ellipse"` instead of approximating the shape with many smooth polygon points.
- For freeform paths and polygons, use `shape="polygon"` or omit `shape`.

# Schema Rules:
- Set `decorative=true` for elements that should stay fixed as part of the template design.
- Set `decorative=false` for content elements that should be replaced when creating a new slide from this layout.
- For icon image elements, set `icon_type` to the closest visual style: `bold`, `duotone`, `fill`, `light`, `regular`, or `thin`. Omit `icon_type` for non-icon images.
- Try to keep `max_length`, `min_length`, `max_items` and `min_items` same as in the raw slide layout.
- If `flex` or `grid` contains list of same items, set the `max_length`, `min_length`, and other schema related constraints same for items.
- For same items arranged in `flex`/`grid` derive schema fields by averaging between those similar items.

# Preview Tool Rules:
- Must use `previewSlide` tool at least once to preview generated slide layout before returning final JSON.
- If no issues are identified in previewed slide image, return final json directly.
"""

GENERATE_PROMPTED_TEMPLATE_LAYOUT_SYSTEM_PROMPT = """
Create exactly one new editable Template V2 slide layout for the user's request.
The result is an in-memory draft; do not modify the template or a presentation.

Use the supplied reference layouts and reusable components to match the template's
visual language: typography, colors, spacing, geometry, decorative assets, and
component patterns.

Rules:
- Return one complete SlideLayout JSON object and no prose.
- Create a unique structural snake_case layout id and a 10-300 character description.
- Compose within a 1280x720 canvas. Component positions are canvas-relative and
  element positions are local to their component.
- Prefer adapting supplied layouts and reusable components over inventing structure.
- Reuse decorative asset URLs only when they occur in the supplied template JSON.
  Never invent an asset URL.
- Mark replaceable semantic text, lists, images, icons, charts, tables, and metrics
  as decorative=false. Keep backgrounds, logos, frames, dividers, and ornaments fixed.
- Use /static/images/replaceable_template_image.png for new replaceable images and
  /static/icons/placeholder.svg for new replaceable icons.
- Include realistic neutral preview content, valid schema limits, unique component
  ids, and enough room for the maximum declared content.
- Use type=vector for scratch-built shapes, lines, dividers, connectors, and arrows.
- Do not copy topic-specific wording from a reference layout.
""".strip()

PROMPTED_LAYOUT_MAX_REFERENCE_LAYOUTS = 4
PROMPTED_LAYOUT_MAX_REUSABLE_COMPONENTS = 8
PROMPTED_LAYOUT_MAX_CONTEXT_CHARS = 160_000
PROMPTED_LAYOUT_ID_PATTERN = re.compile(r"^[a-z][a-z0-9_]{2,79}$")

CLUSTER_SIMILAR_COMPONENTS_SYSTEM_PROMPT = """
Analyze components `id` and `description` and create clusters of similar components.

# Steps:
1. Analyze components `id` and `description`.
2. Identify similar components.
3. Return cluster of similar components as output.

# Rules:
- Group components only when they serve the same semantic purpose and have substantially similar structure.
- Different content is expected and does not make otherwise equivalent components dissimilar.
- Do not group components merely because they share broad words such as title, text, image, or content.
- Each group must contain at least one index.
"""


def _ensure_unique_slide_layout_ids(layouts: list[SlideLayout]) -> list[SlideLayout]:
    used_ids: set[str] = set()
    unique_layouts: list[SlideLayout] = []
    duplicate_count = 0

    for index, layout in enumerate(layouts):
        if layout.id not in used_ids:
            used_ids.add(layout.id)
            unique_layouts.append(layout)
            continue

        duplicate_count += 1
        suffix = index + 1
        candidate_id = f"{layout.id}_{suffix}"
        while candidate_id in used_ids:
            suffix += 1
            candidate_id = f"{layout.id}_{suffix}"
        used_ids.add(candidate_id)
        unique_layouts.append(
            layout.model_copy(deep=True, update={"id": candidate_id})
        )

    if duplicate_count:
        LOGGER.warning(
            "[templates.v2.generate] repaired duplicate slide layout ids count=%d",
            duplicate_count,
        )

    return unique_layouts


def generate_template(
    layouts: RawSlideLayouts,
    slide_image_urls: list[str],
    fonts: dict[str, str] | None = None,
) -> SlideLayouts:
    """Generate each template slide directly as a complete SlideLayout."""
    if not layouts.layouts:
        raise ValueError("layouts must contain at least one slide layout")
    if len(slide_image_urls) != len(layouts.layouts):
        raise ValueError("slide_image_urls must contain one image for each layout")

    started_at = perf_counter()
    slide_count = len(layouts.layouts)
    max_workers = min(MAX_PARALLEL_SLIDE_LAYOUTS, slide_count)
    LOGGER.info(
        "[templates.v2.generate] direct slide layout generation start "
        "slides=%d max_parallel=%d validation_retries=%d",
        slide_count,
        max_workers,
        DEFAULT_VALIDATION_RETRIES,
    )

    layouts_by_index: dict[int, SlideLayout] = {}
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = {
            executor.submit(
                copy_context().run,
                generate_slide_layout,
                layout,
                index,
                slide_image_urls[index],
                fonts,
            ): index
            for index, layout in enumerate(layouts.layouts)
        }
        for future in as_completed(futures):
            index = futures[future]
            layouts_by_index[index] = future.result()
            LOGGER.info(
                "[templates.v2.generate] slide layout complete slide=%d/%d "
                "components=%d completed=%d/%d",
                index + 1,
                slide_count,
                len(layouts_by_index[index].components),
                len(layouts_by_index),
                slide_count,
            )

    ordered_layouts = [layouts_by_index[index] for index in range(slide_count)]
    generated = SlideLayouts(layouts=_ensure_unique_slide_layout_ids(ordered_layouts))
    LOGGER.info(
        "[templates.v2.generate] direct slide layout generation complete "
        "slides=%d components=%d duration_ms=%.1f",
        slide_count,
        sum(len(layout.components) for layout in generated.layouts),
        _elapsed_ms(started_at),
    )
    return generated


def merge_similar_components(layouts: SlideLayouts) -> MergedComponents:
    indexed_components = [
        component for layout in layouts.layouts for component in layout.components
    ]
    if len(indexed_components) < 2:
        return _build_merged_components(indexed_components, [])

    component_summaries = [
        {
            "index": index,
            "id": component.id,
            "description": component.description,
        }
        for index, component in enumerate(indexed_components)
    ]
    LOGGER.info(
        "[templates.v2.deduplicate] clustering start components=%d",
        len(indexed_components),
    )
    response = _generate_with_validation_retries(
        client=get_client(config=get_llm_config()),
        model=get_model(),
        messages=[
            SystemMessage(content=CLUSTER_SIMILAR_COMPONENTS_SYSTEM_PROMPT),
            UserMessage(
                content=json.dumps({"components": component_summaries}, indent=2)
            ),
        ],
        label="similar component clusters",
        output_model=SimilarComponentsList,
        response_name="SimilarComponentsResponse",
        validation_retries=DEFAULT_VALIDATION_RETRIES,
        extra_validator=lambda clusters: _validate_similarity_groups(
            clusters,
            component_count=len(indexed_components),
        ),
        max_tokens=16000,
    )
    clusters = SimilarComponentsList.model_validate(response)
    merged = _build_merged_components(
        indexed_components,
        [group.indices for group in clusters.similar_components],
    )
    deduplicated = _deduplicate_merged_components(merged)
    LOGGER.info(
        "[templates.v2.deduplicate] clustering complete components=%d "
        "similar_groups=%d merged_components=%d structural_duplicates=%d",
        len(indexed_components),
        len(clusters.similar_components),
        len(deduplicated.components),
        len(merged.components) - len(deduplicated.components),
    )
    return deduplicated


def _validate_similarity_groups(
    clusters: SimilarComponentsList,
    *,
    component_count: int,
) -> None:
    seen: set[int] = set()
    for group in clusters.similar_components:
        for index in group.indices:
            if index >= component_count:
                raise ValueError(
                    f"similar component index {index} is outside the available range"
                )
            if index in seen:
                raise ValueError(
                    f"component index {index} appears in more than one similarity group"
                )
            seen.add(index)


def _build_merged_components(
    components: list[Component],
    similar_groups: list[list[int]],
) -> MergedComponents:
    group_by_index = {
        index: sorted(group) for group in similar_groups for index in group
    }
    used_indices: set[int] = set()
    used_ids: set[str] = set()
    merged_components: list[MergedComponent] = []

    for index, component in enumerate(components):
        if index in used_indices:
            continue
        variant_indices = group_by_index.get(index, [index])
        variants = [components[variant_index] for variant_index in variant_indices]
        used_indices.update(variant_indices)
        merged_components.append(
            MergedComponent(
                id=_unique_merged_component_id(component.id, used_ids),
                description=component.description,
                variants=variants,
            )
        )

    return MergedComponents(components=merged_components)


def _deduplicate_merged_components(merged: MergedComponents) -> MergedComponents:
    if len(merged.components) < 2:
        return merged

    parent = list(range(len(merged.components)))
    signature_owner: dict[tuple[Any, ...], int] = {}

    def find(index: int) -> int:
        while parent[index] != index:
            parent[index] = parent[parent[index]]
            index = parent[index]
        return index

    def union(first: int, second: int) -> None:
        first_root = find(first)
        second_root = find(second)
        if first_root == second_root:
            return
        if first_root < second_root:
            parent[second_root] = first_root
        else:
            parent[first_root] = second_root

    for index, component_group in enumerate(merged.components):
        for signature in _merged_component_variant_signatures(component_group):
            previous_index = signature_owner.get(signature)
            if previous_index is None:
                signature_owner[signature] = index
                continue
            union(index, previous_index)

    components_by_root: dict[int, list[int]] = {}
    for index in range(len(merged.components)):
        root = find(index)
        components_by_root.setdefault(root, []).append(index)

    deduplicated: list[MergedComponent] = []
    emitted_roots: set[int] = set()
    for index, component_group in enumerate(merged.components):
        root = find(index)
        if root in emitted_roots:
            continue
        emitted_roots.add(root)
        duplicate_indices = components_by_root[root]
        variants = [
            variant
            for duplicate_index in duplicate_indices
            for variant in merged.components[duplicate_index].variants
        ]
        deduplicated.append(
            component_group.model_copy(deep=True, update={"variants": variants})
        )

    return MergedComponents(components=deduplicated)


def _merged_component_variant_signatures(
    component_group: MergedComponent,
) -> tuple[tuple[Any, ...], ...]:
    seen: set[tuple[Any, ...]] = set()
    signatures: list[tuple[Any, ...]] = []
    for variant in component_group.variants:
        signature = _component_duplicate_signature(variant)
        if signature in seen:
            continue
        seen.add(signature)
        signatures.append(signature)
    return tuple(signatures)


def _component_duplicate_signature(component: Component) -> tuple[Any, ...]:
    component_data = component.model_dump(mode="json", exclude_none=True)
    root_size = _component_content_size(component_data)
    return (
        "component",
        ("aspect", _aspect_signature(root_size)),
        (
            "elements",
            tuple(
                _element_duplicate_signature(element, root_size=root_size)
                for element in component_data.get("elements", [])
            ),
        ),
    )


def _element_duplicate_signature(
    element: dict[str, Any],
    *,
    root_size: Any,
) -> tuple[Any, ...]:
    element_type = str(element.get("type", ""))
    decorative = bool(element.get("decorative", False))
    items: list[tuple[str, Any]] = []

    for key in sorted(element):
        if key in _IGNORED_DUPLICATE_SCHEMA_KEYS:
            continue

        value = element[key]
        if key == "position":
            items.append((key, _position_signature(value, root_size)))
            continue
        if key == "size":
            items.append((key, _size_signature(value, root_size)))
            continue
        if key == "child":
            child_signature = (
                _element_duplicate_signature(value, root_size=root_size)
                if isinstance(value, dict)
                else None
            )
            items.append((key, child_signature))
            continue
        if key == "children":
            children = value if isinstance(value, list) else []
            items.append(
                (
                    key,
                    tuple(
                        _element_duplicate_signature(child, root_size=root_size)
                        for child in children
                        if isinstance(child, dict)
                    ),
                )
            )
            continue
        if not decorative and key in _CONTENT_VALUE_KEYS_BY_ELEMENT_TYPE.get(
            element_type, set()
        ):
            continue
        if not decorative and element_type == "table" and key in {"columns", "rows"}:
            items.append((key, _normalize_signature_value(_strip_table_text(value))))
            continue

        items.append((key, _normalize_signature_value(value)))

    return tuple(items)


def _component_content_size(component_data: dict[str, Any]) -> dict[str, float] | None:
    elements = component_data.get("elements")
    if not isinstance(elements, list):
        return None
    bounds = _merge_bounds(
        _element_bounds(element)
        for element in elements
        if isinstance(element, dict)
    )
    if bounds is None:
        return None
    return {
        "width": max(1.0, bounds["x"] + bounds["width"]),
        "height": max(1.0, bounds["y"] + bounds["height"]),
    }


def _element_bounds(element: dict[str, Any]) -> dict[str, float] | None:
    element_type = str(element.get("type") or "")
    if element_type == "vector":
        points = [
            point
            for point in element.get("points", [])
            if isinstance(point, dict)
            and _coerce_number(point.get("x")) is not None
            and _coerce_number(point.get("y")) is not None
        ]
        if points:
            xs = [_coerce_number(point.get("x")) or 0.0 for point in points]
            ys = [_coerce_number(point.get("y")) or 0.0 for point in points]
            left = min(xs)
            top = min(ys)
            right = max(xs)
            bottom = max(ys)
            return {
                "x": left,
                "y": top,
                "width": max(1.0, right - left),
                "height": max(1.0, bottom - top),
            }

    position = element.get("position")
    size = element.get("size")
    x = _coerce_number(position.get("x")) if isinstance(position, dict) else None
    y = _coerce_number(position.get("y")) if isinstance(position, dict) else None
    width = _coerce_number(size.get("width")) if isinstance(size, dict) else None
    height = _coerce_number(size.get("height")) if isinstance(size, dict) else None
    own_bounds = (
        {
            "x": x or 0.0,
            "y": y or 0.0,
            "width": max(1.0, width),
            "height": max(1.0, height),
        }
        if width is not None and height is not None
        else None
    )
    child_bounds = _merge_bounds(
        _offset_bounds(_element_bounds(child), x or 0.0, y or 0.0)
        for child in _element_children(element)
    )
    return _merge_bounds([own_bounds, child_bounds])


def _element_children(element: dict[str, Any]) -> list[dict[str, Any]]:
    children: list[dict[str, Any]] = []
    for key in ("children", "elements"):
        value = element.get(key)
        if isinstance(value, list):
            children.extend(child for child in value if isinstance(child, dict))
    child = element.get("child")
    if isinstance(child, dict):
        children.append(child)
    item = element.get("item")
    if isinstance(item, dict):
        children.append(item)
    return children


def _offset_bounds(
    bounds: dict[str, float] | None,
    offset_x: float,
    offset_y: float,
) -> dict[str, float] | None:
    if bounds is None:
        return None
    return {
        "x": bounds["x"] + offset_x,
        "y": bounds["y"] + offset_y,
        "width": bounds["width"],
        "height": bounds["height"],
    }


def _merge_bounds(
    values: Any,
) -> dict[str, float] | None:
    bounds = [value for value in values if isinstance(value, dict)]
    if not bounds:
        return None
    left = min(value["x"] for value in bounds)
    top = min(value["y"] for value in bounds)
    right = max(value["x"] + value["width"] for value in bounds)
    bottom = max(value["y"] + value["height"] for value in bounds)
    return {
        "x": left,
        "y": top,
        "width": max(1.0, right - left),
        "height": max(1.0, bottom - top),
    }


def _strip_table_text(value: Any) -> Any:
    if isinstance(value, dict):
        return {
            key: _strip_table_text(child)
            for key, child in value.items()
            if key != "runs"
        }
    if isinstance(value, list):
        return [_strip_table_text(item) for item in value]
    return value


def _position_signature(value: Any, root_size: Any) -> tuple[Any, ...] | None:
    if not isinstance(value, dict):
        return None
    return (
        ("x", _axis_signature(value.get("x"), root_size, "width")),
        ("y", _axis_signature(value.get("y"), root_size, "height")),
    )


def _size_signature(value: Any, root_size: Any) -> tuple[Any, ...] | None:
    if not isinstance(value, dict):
        return None
    return (
        ("width", _axis_signature(value.get("width"), root_size, "width")),
        ("height", _axis_signature(value.get("height"), root_size, "height")),
    )


def _axis_signature(value: Any, root_size: Any, axis_key: str) -> Any:
    number = _coerce_number(value)
    if number is None:
        return _normalize_signature_value(value)

    axis_size = None
    if isinstance(root_size, dict):
        axis_size = _coerce_number(root_size.get(axis_key))
    if axis_size is not None and axis_size > 0:
        normalized = (number / axis_size) * 1000
        return (
            round(normalized / _DUPLICATE_POSITION_GRID_UNITS)
            * _DUPLICATE_POSITION_GRID_UNITS
        )
    return round(number, 1)


def _aspect_signature(root_size: Any) -> Any:
    if not isinstance(root_size, dict):
        return None
    width = _coerce_number(root_size.get("width"))
    height = _coerce_number(root_size.get("height"))
    if width is None or height is None or height <= 0:
        return None
    return round((width / height) * 100)


def _normalize_signature_value(value: Any) -> Any:
    number = _coerce_number(value)
    if number is not None:
        return round(number, 2)
    if isinstance(value, str):
        return value.strip()
    if isinstance(value, dict):
        return tuple(
            (key, _normalize_signature_value(child))
            for key, child in sorted(value.items())
        )
    if isinstance(value, list):
        return tuple(_normalize_signature_value(item) for item in value)
    return value


def _coerce_number(value: Any) -> float | None:
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        return float(value)
    return None


def _unique_merged_component_id(component_id: str, used_ids: set[str]) -> str:
    if component_id not in used_ids:
        used_ids.add(component_id)
        return component_id

    suffix = 2
    while True:
        suffix_text = f"_{suffix}"
        candidate = f"{component_id[: 80 - len(suffix_text)]}{suffix_text}"
        if candidate not in used_ids:
            used_ids.add(candidate)
            return candidate
        suffix += 1


def generate_slide_layout(
    source_layout: RawSlideLayout,
    slide_index: int,
    slide_image_url: str,
    fonts: dict[str, str] | None = None,
    *,
    max_tokens: int | None = None,
) -> SlideLayout:
    payload = (
        _strip_decorative_fields(
            source_layout.model_dump(mode="json", exclude_none=True)
        ),
    )
    llm_config = get_llm_config()
    client = get_client(config=llm_config)
    model = get_model()
    messages = [
        SystemMessage(content=GENERATE_SLIDE_LAYOUT_SYSTEM_PROMPT),
        UserMessage(
            content=[
                _slide_image_content(slide_image_url),
                json.dumps(payload, indent=2),
            ]
        ),
    ]
    preview_tool = PreviewSlideTool(slide_index=slide_index, fonts=fonts)
    layout = _generate_preview_candidate(
        client=client,
        model=model,
        messages=messages,
        label=f"slide {slide_index + 1}",
        preview_tool=preview_tool,
        validation_retries=DEFAULT_VALIDATION_RETRIES,
        max_tokens=max_tokens,
    )
    return _replace_content_image_urls(layout)


def generate_prompted_slide_layout(
    prompt: str,
    template_layouts: SlideLayouts,
    merged_components: MergedComponents | None = None,
    template_name: str | None = None,
    template_description: str | None = None,
    fonts: dict[str, str] | None = None,
) -> SlideLayout:
    normalized_prompt = prompt.strip()
    if not normalized_prompt:
        raise ValueError("Prompt is required")

    context = _prompted_layout_context(
        prompt=normalized_prompt,
        template_layouts=template_layouts,
        merged_components=merged_components,
        template_name=template_name,
        template_description=template_description,
        fonts=fonts,
    )
    existing_layout_ids = {layout.id for layout in template_layouts.layouts}

    def validate_generated_layout(layout: SlideLayout) -> None:
        if not PROMPTED_LAYOUT_ID_PATTERN.fullmatch(layout.id):
            raise ValueError(
                "layout.id must be snake_case and begin with a lowercase letter"
            )
        if layout.id in existing_layout_ids:
            raise ValueError(
                f"layout.id '{layout.id}' already exists; create a unique layout id"
            )
        if not layout.components:
            raise ValueError("layout.components must contain at least one component")
        if not _contains_editable_template_content(
            layout.model_dump(mode="json", exclude_none=True)
        ):
            raise ValueError(
                "layout must contain at least one semantic element with decorative=false"
            )

    client = get_client(config=get_llm_config())
    model = get_model()
    generated = _generate_with_validation_retries(
        client=client,
        model=model,
        messages=[
            SystemMessage(content=GENERATE_PROMPTED_TEMPLATE_LAYOUT_SYSTEM_PROMPT),
            UserMessage(
                content=(
                    f"User request:\n{normalized_prompt}\n\n"
                    "Template context:\n"
                    f"{json.dumps(context, ensure_ascii=False)}"
                )
            ),
        ],
        label="prompted template layout",
        output_model=SlideLayout,
        response_name="PromptedTemplateLayoutResponse",
        validation_retries=DEFAULT_VALIDATION_RETRIES,
        extra_validator=validate_generated_layout,
        max_tokens=16_000,
    )
    return _replace_content_image_urls(SlideLayout.model_validate(generated))


def _prompted_layout_context(
    *,
    prompt: str,
    template_layouts: SlideLayouts,
    merged_components: MergedComponents | None,
    template_name: str | None,
    template_description: str | None,
    fonts: dict[str, str] | None,
) -> dict[str, Any]:
    prompt_terms = _search_terms(prompt)
    ranked_layouts = sorted(
        enumerate(template_layouts.layouts),
        key=lambda item: (
            -_template_context_match_score(
                prompt_terms,
                item[1].id,
                item[1].description,
                *(
                    component.description
                    for component in item[1].components
                ),
            ),
            item[0],
        ),
    )
    selected_layouts = [
        layout.model_dump(mode="json", exclude_none=True)
        for _, layout in ranked_layouts[:PROMPTED_LAYOUT_MAX_REFERENCE_LAYOUTS]
    ]

    ranked_components: list[tuple[int, int, MergedComponent]] = []
    if merged_components is not None:
        ranked_components = sorted(
            (
                (
                    -_template_context_match_score(
                        prompt_terms,
                        component.id,
                        component.description,
                    ),
                    index,
                    component,
                )
                for index, component in enumerate(merged_components.components)
            ),
            key=lambda item: (item[0], item[1]),
        )
    selected_components = [
        component.model_dump(mode="json", exclude_none=True)
        for _, _, component in ranked_components[
            :PROMPTED_LAYOUT_MAX_REUSABLE_COMPONENTS
        ]
    ]

    context: dict[str, Any] = {
        "template": {
            "name": template_name,
            "description": template_description,
            "fonts": sorted((fonts or {}).keys()),
            "existing_layout_ids": [
                layout.id for layout in template_layouts.layouts
            ],
        },
        "reference_layouts": selected_layouts,
        "reusable_components": selected_components,
    }

    while (
        len(json.dumps(context, ensure_ascii=False))
        > PROMPTED_LAYOUT_MAX_CONTEXT_CHARS
    ):
        if context["reusable_components"]:
            context["reusable_components"].pop()
            continue
        if len(context["reference_layouts"]) > 1:
            context["reference_layouts"].pop()
            continue
        break

    return context


def _search_terms(value: str) -> set[str]:
    return {
        term
        for term in re.findall(r"[a-z0-9]+", value.lower())
        if len(term) > 2
    }


def _template_context_match_score(
    prompt_terms: set[str],
    *values: str,
) -> int:
    searchable = " ".join(values).lower().replace("_", " ")
    return sum(1 for term in prompt_terms if term in searchable)


def _contains_editable_template_content(value: Any) -> bool:
    if isinstance(value, dict):
        if value.get("decorative") is False and isinstance(
            value.get("type"), str
        ):
            return True
        return any(
            _contains_editable_template_content(child)
            for child in value.values()
        )
    if isinstance(value, list):
        return any(_contains_editable_template_content(child) for child in value)
    return False


def _replace_content_image_urls(layout: SlideLayout) -> SlideLayout:
    normalized = layout.model_copy(deep=True)
    for component in normalized.components:
        _replace_content_image_urls_in_elements(component.elements)
    return normalized


def _replace_content_image_urls_in_elements(elements: list[Any]) -> None:
    for element in elements:
        _replace_content_image_url_in_element(element)


def _replace_content_image_url_in_element(element: Any) -> None:
    if isinstance(element, SlideImageElement) and element.decorative is False:
        element.data = (
            CONTENT_ICON_PLACEHOLDER_URL
            if element.is_icon
            else CONTENT_IMAGE_PLACEHOLDER_URL
        )
        if not element.is_icon and element.fit != ImageFit.COVER:
            element.fit = ImageFit.COVER

    child = getattr(element, "child", None)
    if child is not None:
        _replace_content_image_url_in_element(child)

    children = getattr(element, "children", None)
    if isinstance(children, list):
        _replace_content_image_urls_in_elements(children)


def _strip_decorative_fields(value: Any) -> Any:
    if isinstance(value, dict):
        return {
            key: _strip_decorative_fields(child)
            for key, child in value.items()
            if key != "decorative"
        }
    if isinstance(value, list):
        return [_strip_decorative_fields(item) for item in value]
    return value


def _generate_preview_candidate(
    *,
    client: Any,
    model: str,
    messages: list[Any],
    label: str,
    preview_tool: PreviewSlideTool,
    validation_retries: int,
    max_tokens: int | None = None,
) -> SlideLayout:
    attempt_messages = list(messages)
    last_error: Exception | None = None
    max_attempts = validation_retries + 1
    preview_call_count = 0

    for attempt in range(1, max_attempts + 1):
        attempt_started_at = perf_counter()
        preview_tool_available = preview_call_count < MAX_PREVIEW_SLIDE_CALLS and (
            attempt <= validation_retries or preview_call_count == 0
        )
        LOGGER.info(
            "[templates.v2.llm] %s: requesting slide layout attempt=%d/%d model=%s",
            label,
            attempt,
            max_attempts,
            model,
        )
        try:
            generate_kwargs = {
                "model": model,
                "messages": attempt_messages,
                "response_format": JSONSchemaResponse(
                    name="SlideLayoutResponse",
                    strict=False,
                    json_schema=SlideLayout,
                ),
            }
            if max_tokens is not None:
                generate_kwargs["max_tokens"] = max_tokens
            if preview_tool_available:
                generate_kwargs.update(
                    {
                        "tools": [preview_tool],
                        "tool_choice": ToolChoice(
                            mode=ToolChoiceMode.AUTO,
                            tools=[PREVIEW_SLIDE_TOOL_NAME],
                        ),
                    }
                )
            response = client.generate(**generate_kwargs)
            tool_call = None
            if preview_tool_available:
                tool_call = next(
                    (
                        call
                        for call in list(getattr(response, "tool_calls", []) or [])
                        if call.name == preview_tool.name
                    ),
                    None,
                )
            if tool_call is None:
                parsed = _parse_json_content(response.content)
                layout = SlideLayout.model_validate(parsed)
                LOGGER.info(
                    "[templates.v2.llm] %s: slide layout JSON returned "
                    "attempt=%d/%d duration_ms=%.1f components=%d",
                    label,
                    attempt,
                    max_attempts,
                    _elapsed_ms(attempt_started_at),
                    len(layout.components),
                )
                return layout

            arguments = json.loads(tool_call.arguments or "{}")
            if not isinstance(arguments, dict):
                raise ValueError(f"{preview_tool.name} arguments must be a JSON object")
            candidate_layout = SlideLayout.model_validate(arguments)
            preview_call_count += 1
            LOGGER.info(
                "[templates.v2.llm] %s: preview slide called attempt=%d/%d "
                "preview_call=%d components=%d",
                label,
                attempt,
                max_attempts,
                preview_call_count,
                len(candidate_layout.components),
            )
            LOGGER.info(
                "[templates.v2.llm] %s: rendering preview slide attempt=%d/%d",
                label,
                attempt,
                max_attempts,
            )
            preview_image = preview_tool.render(candidate_layout)
            LOGGER.info(
                "[templates.v2.llm] %s: preview slide rendered attempt=%d/%d "
                "duration_ms=%.1f",
                label,
                attempt,
                max_attempts,
                _elapsed_ms(attempt_started_at),
            )
            if attempt > validation_retries:
                LOGGER.info(
                    "[templates.v2.llm] %s: returning preview slide JSON as final "
                    "attempt=%d/%d preview_call=%d duration_ms=%.1f components=%d",
                    label,
                    attempt,
                    max_attempts,
                    preview_call_count,
                    _elapsed_ms(attempt_started_at),
                    len(candidate_layout.components),
                )
                return candidate_layout

            response_messages = list(getattr(response, "messages", []) or [])
            if response_messages:
                history_messages = response_messages
            else:
                response_text = _text_from_content(getattr(response, "content", None))
                assistant_message = AssistantMessage(
                    content=[response_text] if response_text else None,
                    tool_calls=[tool_call],
                )
                history_messages = [*attempt_messages, assistant_message]

            attempt_messages = [
                *history_messages,
                ToolResponseMessage(
                    id=tool_call.id,
                    content=["The slide preview was rendered successfully."],
                ),
                UserMessage(
                    content=[
                        preview_image,
                        _preview_feedback_instruction(preview_call_count),
                    ]
                ),
            ]
            LOGGER.info(
                "[templates.v2.llm] %s: asking LLM to review rendered preview "
                "attempt=%d/%d",
                label,
                attempt,
                max_attempts,
            )
        except (JSONDecodeError, ValidationError, ValueError) as exc:
            last_error = exc
            LOGGER.warning(
                "[templates.v2.llm] %s: invalid slide layout response "
                "attempt=%d/%d duration_ms=%.1f error=%s",
                label,
                attempt,
                max_attempts,
                _elapsed_ms(attempt_started_at),
                exc,
            )
            if attempt > validation_retries:
                raise
            retry_instruction = (
                f"Return one complete SlideLayout JSON object, or call "
                f"{preview_tool.name} with one complete SlideLayout JSON object."
                if preview_call_count < MAX_PREVIEW_SLIDE_CALLS
                else "Return one complete SlideLayout JSON object without calling a tool."
            )
            attempt_messages = [
                *attempt_messages,
                UserMessage(
                    content=(
                        f"The previous response for {label} was invalid. "
                        f"{retry_instruction}\n\n"
                        f"errors:\n{_format_error_for_prompt(exc)}"
                    )
                ),
            ]
        except Exception as exc:
            last_error = exc
            LOGGER.warning(
                "[templates.v2.llm] %s: preview slide flow failed "
                "attempt=%d/%d duration_ms=%.1f error=%s",
                label,
                attempt,
                max_attempts,
                _elapsed_ms(attempt_started_at),
                exc,
            )
            if attempt > validation_retries:
                raise
            retry_instruction = (
                "Call the tool again with the complete candidate SlideLayout."
                if preview_call_count < MAX_PREVIEW_SLIDE_CALLS
                else "Return one complete SlideLayout JSON object without calling a tool."
            )
            attempt_messages = [
                *attempt_messages,
                UserMessage(
                    content=(
                        f"The {preview_tool.name} call for {label} failed. "
                        f"{retry_instruction}\n\n"
                        f"errors:\n{_format_error_for_prompt(exc)}"
                    )
                ),
            ]

    if last_error is not None:
        raise last_error
    raise RuntimeError(f"LLM failed to produce a preview candidate for {label}")


def _preview_feedback_instruction(preview_call_count: int) -> str:
    base = (
        "Review this rendered candidate against the original slide image. "
        "Fix visual problems such as incorrect grouping, alignment, sizing, "
        "overflow, spacing, colors, and local coordinates. "
    )
    if preview_call_count >= MAX_PREVIEW_SLIDE_CALLS:
        return (
            base + "You have used the maximum number of previewSlide calls. "
            "Return the complete final SlideLayout JSON without calling previewSlide again, "
            "even when no changes are needed."
        )
    return (
        base
        + "Return the complete final SlideLayout JSON, or call previewSlide one more time "
        "only if another visual check is needed."
    )


def _slide_image_content(slide_image_url: str) -> ImageContentPart:
    image_path = resolve_image_path_to_filesystem(slide_image_url)
    if image_path:
        with open(image_path, "rb") as image_file:
            image_bytes = image_file.read()
        mime_type = mimetypes.guess_type(image_path)[0] or "image/png"
        return ImageContentPart(data=image_bytes, mime_type=mime_type)

    return ImageContentPart(url=slide_image_url)


def _generate_with_validation_retries(
    *,
    client: Any,
    model: str,
    messages: list[Any],
    label: str,
    output_model: type[BaseModel],
    response_name: str,
    validation_retries: int,
    extra_validator: Callable[[Any], None] | None = None,
    max_tokens: int = 8192,
) -> dict[str, Any]:
    attempt_messages = list(messages)
    last_error: Exception | None = None
    max_attempts = validation_retries + 1

    for attempt in range(1, max_attempts + 1):
        attempt_started_at = perf_counter()
        LOGGER.info(
            "[templates.v2.llm] request start label=%s model=%s attempt=%d/%d "
            "retry=%d/%d messages=%d",
            label,
            model,
            attempt,
            max_attempts,
            attempt - 1,
            validation_retries,
            len(attempt_messages),
        )
        try:
            response = client.generate(
                model=model,
                messages=attempt_messages,
                response_format=JSONSchemaResponse(
                    name=response_name,
                    strict=False,
                    json_schema=output_model,
                ),
                max_tokens=max_tokens,
            )
        except Exception as exc:
            last_error = exc
            LOGGER.warning(
                "[templates.v2.llm] request failed label=%s model=%s "
                "attempt=%d/%d duration_ms=%.1f error=%s",
                label,
                model,
                attempt,
                max_attempts,
                _elapsed_ms(attempt_started_at),
                exc,
            )
            if attempt > validation_retries:
                raise
            attempt_messages = _messages_for_generation_error_retry(
                messages=attempt_messages,
                label=label,
                error=exc,
            )
            continue

        try:
            parsed = _parse_json_content(response.content)
            validated = _validate_output_model(
                parsed,
                output_model,
                extra_validator=extra_validator,
            )
            LOGGER.info(
                "[templates.v2.llm] response validated label=%s model=%s "
                "attempt=%d/%d duration_ms=%.1f schema=%s",
                label,
                model,
                attempt,
                max_attempts,
                _elapsed_ms(attempt_started_at),
                response_name,
            )
            return validated
        except ValidationError as exc:
            last_error = exc
            if attempt > validation_retries:
                raise
            attempt_messages = _messages_for_model_validation_retry(
                messages=attempt_messages,
                response=response,
                label=label,
                output_model=output_model,
                error=exc,
                invalid_response=parsed,
            )
        except (JSONDecodeError, ValueError) as exc:
            last_error = exc
            if attempt > validation_retries:
                raise
            attempt_messages = _messages_for_json_repair_retry(
                messages=attempt_messages,
                response=response,
                label=label,
                error=exc,
            )

    if last_error is not None:
        raise last_error
    raise RuntimeError(f"LLM failed to generate {label}")


def _validate_output_model(
    parsed: dict[str, Any],
    output_model: type[BaseModel],
    *,
    extra_validator: Callable[[Any], None] | None = None,
) -> dict[str, Any]:
    validated = output_model.model_validate(parsed)
    if extra_validator is not None:
        extra_validator(validated)
    return validated.model_dump(mode="json")


def _parse_json_content(content: Any) -> dict[str, Any]:
    text_content = _text_from_content(content)
    parsed = json.loads(text_content) if text_content is not None else content
    if not isinstance(parsed, dict):
        raise ValueError("LLM response must be a JSON object")
    return parsed


def _text_from_content(content: Any) -> str | None:
    if isinstance(content, str):
        return content
    if not isinstance(content, list):
        return None

    parts: list[str] = []
    for part in content:
        if isinstance(part, str):
            parts.append(part)
            continue
        text = getattr(part, "text", None)
        if isinstance(text, str):
            parts.append(text)
    return "".join(parts) if parts else None


def _messages_for_generation_error_retry(
    *,
    messages: list[Any],
    label: str,
    error: Exception,
) -> list[Any]:
    return [
        *messages,
        UserMessage(
            content=_json_repair_prompt(
                label=label,
                invalid_response=None,
                error=error,
            )
        ),
    ]


def _messages_for_json_repair_retry(
    *,
    messages: list[Any],
    response: Any,
    label: str,
    error: Exception,
) -> list[Any]:
    invalid_response = _text_from_content(response.content) or response.content
    return [
        *messages,
        AssistantMessage(content=[_json_dumps_for_prompt(invalid_response)]),
        UserMessage(
            content=_json_repair_prompt(
                label=label,
                invalid_response=invalid_response,
                error=error,
            )
        ),
    ]


def _messages_for_model_validation_retry(
    *,
    messages: list[Any],
    response: Any,
    label: str,
    output_model: type[BaseModel],
    error: ValidationError,
    invalid_response: dict[str, Any],
) -> list[Any]:
    return [
        *messages,
        AssistantMessage(content=[_json_dumps_for_prompt(invalid_response)]),
        UserMessage(
            content=_model_validation_repair_prompt(
                label=label,
                output_model=output_model,
                invalid_response=invalid_response,
                error=error,
            )
        ),
    ]


def _json_repair_prompt(
    *,
    label: str,
    invalid_response: Any | None,
    error: Exception,
) -> str:
    parts = [
        f"The previous {label} response was not valid for this task.",
        "Return a complete replacement JSON object.",
        "Return raw JSON only. Do not include markdown fences, comments, explanations, or text outside the JSON object.",
        "",
        "errors:",
        _format_error_for_prompt(error),
    ]
    if invalid_response is not None:
        parts.extend(
            ["", "invalid_response:", _json_dumps_for_prompt(invalid_response)]
        )
    return "\n".join(parts)


def _model_validation_repair_prompt(
    *,
    label: str,
    output_model: type[BaseModel],
    invalid_response: dict[str, Any],
    error: ValidationError,
) -> str:
    return "\n".join(
        [
            f"The previous {label} JSON did not match the required schema.",
            "Return a complete corrected replacement JSON object.",
            "For a SlideLayout, return id, description, and the complete components list in the same response.",
            "Each component must include position and local-coordinate elements. Do not include component size.",
            "Return raw JSON only. Do not include markdown fences, comments, explanations, or text outside the JSON object.",
            "",
            "validation_errors:",
            _format_error_for_prompt(error),
            "",
            "invalid_response:",
            _json_dumps_for_prompt(invalid_response),
            "",
            "required_json_schema:",
            _json_dumps_for_prompt(output_model.model_json_schema()),
        ]
    )


def _format_error_for_prompt(error: Exception) -> str:
    if isinstance(error, ValidationError):
        return _json_dumps_for_prompt(error.errors(include_input=False))
    if isinstance(error, JSONDecodeError):
        return _json_dumps_for_prompt([{"type": "JSONDecodeError", "msg": str(error)}])
    return _json_dumps_for_prompt([{"type": type(error).__name__, "msg": str(error)}])


def _json_dumps_for_prompt(value: Any) -> str:
    return json.dumps(value, indent=2, ensure_ascii=False, default=str)


def _elapsed_ms(started_at: float) -> float:
    return (perf_counter() - started_at) * 1000
