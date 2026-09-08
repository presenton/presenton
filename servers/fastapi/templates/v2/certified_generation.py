from __future__ import annotations

import copy
import json
import logging
import math
import mimetypes
import re
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from json import JSONDecodeError
from time import perf_counter
from typing import Any, Callable

from llmai.shared import (
    AssistantMessage,
    ImageContentPart,
    JSONSchemaResponse,
    Message,
    SystemMessage,
    TextContentPart,
    UserMessage,
)
from pydantic import BaseModel, ValidationError

from templates.v2.models.layouts import (
    Component,
    FlexibleFlowNodePlan,
    FlexibleRegionPlan,
    FlexibleSlidePlan,
    MergedComponent,
    MergedComponents,
    RawSlideLayout,
    RawSlideLayouts,
    SimilarComponentsList,
    SlideLayout,
    SlideLayouts,
    SemanticSlideManifest,
    TextCapacityAdjustment,
    TextCapacityPlan,
    VisualChartReplacement,
    VisualDataReplacement,
    VisualDataReplacementPlan,
    VisualInfographicReplacement,
    VisualTextListReplacement,
    flexible_slide_plan_llm_json_schema,
    semantic_slide_manifest_llm_json_schema,
    slide_layout_llm_json_schema,
    text_capacity_plan_llm_json_schema,
    visual_data_replacement_plan_llm_json_schema,
)
from templates.v2.models.elements import Image as SlideImageElement
from templates.v2.models.elements import ImageFit, InfographicType
from utils.asset_directory_utils import resolve_image_path_to_filesystem
from utils.icon_weights import DEFAULT_ICON_TYPE

DEFAULT_VALIDATION_RETRIES = 5
MAX_PARALLEL_SLIDE_LAYOUTS = 10
TEMPLATE_GENERATION_MAX_COMPLETION_TOKENS = 16000
TEXT_CAPACITY_SAFETY_FACTOR = 0.85
CONTENT_IMAGE_PLACEHOLDER_URL = "/static/images/replaceable_template_image.png"
CONTENT_ICON_PLACEHOLDER_URL = "/static/icons/placeholder.svg"

LOGGER = logging.getLogger(__name__)

TemplateMessages = list[Message]


@dataclass(frozen=True)
class TemplateStructuredProvider:
    name: str
    call: Callable[[TemplateMessages, dict[str, Any], str, int], Any]


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
        "x_axis_title",
        "y_axis_title",
    },
    "image": {"data", "prompt"},
    "infographic": {"data"},
    "text": {"runs"},
    "text-list": {"items"},
}


GENERATE_SLIDE_LAYOUT_SYSTEM_PROMPT = """
Analyze the reference slide and return semantic metadata for its existing source elements.

# Steps:
1. Analyze the reference image, indexed source elements, editable candidates, and available fonts.
2. Partition the indexed elements into reusable components without changing their source order.
3. Classify and structurally name every editable candidate.
4. Verify complete coverage and return one SemanticSlideManifest JSON object.

# Output Rules:
- Return a SemanticSlideManifest JSON object only.
- Set id to a concise lowercase snake_case description of the layout's reusable visual structure and editable content roles.
- Never copy source_layout.id or use source ids, suffixes, or ordinals such as slide_4, page_4, or layout_4; prefer hanging_icons_with_summary_cards.
- Do not alter source elements.
- Component ids must be unique; reference elements only by zero-based source index.
- Assign every source index once. Order components by earliest index and preserve relative order within element_indices.
- Return one annotation per provided editable candidate path, with no missing or extra paths.

# Component Rules:
- Divide the slide into the smallest useful reusable visual regions based on visible spatial grouping; a repeated collection is one component, not one component per item.
- Keep one semantic component for a coherent visual region even when it contains nested rows, columns, or grids.
- Group a title and description only when proximity, alignment, spacing, or a shared container makes one visible block; keep independent copy separate.
- Keep every repeated collection of metrics, cards, steps, or equivalent visual items together in one semantic component instead of creating one component per item or merging it with nearby copy.
- Do not split equivalent repeated items because one item has a highlighted color, alternate surface, or other state styling when their geometry and editable-field roles still match.
- Keep a connected timeline, process, or step sequence in one component when its shared connector, repeated markers, and repeated copy form one coherent region.
- In such a sequence, keep each repeated marker or node with its corresponding heading and description; only the connector spanning items is shared scaffolding.
- Keep a shared footer band in one component; the flexible pass can nest independent label/value pairs inside its outer layout.
- Components may reference non-contiguous source indices when source stacking order interleaves otherwise distinct visual regions.
- Never merge distinct visual regions merely to make component indices contiguous.
- Set repeated_items to null; a later focused pass decides flexible regions.

# Content Classification Rules:
- decorative=false marks replaceable content; decorative=true marks fixed visual scaffolding that remains unchanged.
- Treat visible text, charts, tables, metrics, semantic images, and topic icons as replaceable, except logos and watermarks.
- Treat each structured table as one atomic editable element; headers, cells, cell text, fills, borders, and grid lines are internal table data.
- Treat each structured chart as one atomic editable element; its title, plot, labels, legend, gridlines, axes, ticks, and source are internal chart data.
- Never split, separately name, annotate, or group a table or chart internal as another editable element; one table or chart maps to one annotation.
- Treat supported structured infographics as replaceable content. Keep only unsupported qualitative diagrams as fixed visual scaffolding.
- Treat connector and branching lines, rings, arcs, circle outlines, Venn-diagram circles, backgrounds, logos, frames, borders, and dividers as decorative.
- Classify by whether the new slide's content generator should replace the value: a ring around a replaceable topic icon is decorative, while the icon is content.

# Image and Icon Rules:
- Set is_icon for every image annotation: true for a compact symbolic icon intended for icon search, and false for a photo, screenshot, or illustration.
- Classify by visible role, not source is_icon, which may default to false for imported PPTX images.
- Omit is_icon for non-image annotations.
- For is_icon=true, use the visible icon glyph's six-digit hexadecimal foreground color, excluding any surrounding card, badge, circle, frame, or background.
- For every is_icon=true annotation, set icon_type to the closest visible style: bold, duotone, fill, light, regular, or thin.
- Infer icon_type visually: stroke weight maps to thin through bold, a silhouette to fill, and a layered glyph to duotone.
- Set color and icon_type to null for is_icon=false images and non-image annotations.

# Naming Rules:
- Derive layout descriptions, component names, and element names from stable visual structure and editable field roles, never example content.
- Use lowercase snake_case identifiers beginning with a letter.
- Use generic names when sample content is a person, organization, company, role, name, year, date, or similar metadata.
- Prefer `top_marker`, `footer_left_label`, or `footer_right_value` over sample-driven names such as `year_marker`, `person_name`, or `organization_role`.
- Prefer `title_with_image_cards`, `card_image`, `card_heading`, and `card_description` over topic-specific names such as `agenda_cards`.
- Give corresponding editable fields in repeated equivalent items the same unindexed name, such as `card_heading` and `card_description` in every card.
- Do not encode repeated-item position in field names; reserve left, center, and right for independent non-repeated fields.
- Do not encode fixed counts or number words in layout or component identifiers.
- Descriptions should explain geometry, reusable regions, and intended content in 15 to 30 words.
"""

DETECT_VISUAL_DATA_REGIONS_SYSTEM_PROMPT = """
Identify existing visual regions that should become structured data or list elements.

# Steps:
1. Compare the reference slide image with the supplied image and grouped-region candidates.
2. Find candidates whose pixels, children, or geometrically enclosed sibling elements collectively render exactly one chart, infographic, table, or text list.
3. Extract the visible data and styling into one typed replacement for each confident match.
4. Return one complete VisualDataReplacementPlan JSON object.

# Output and Bounds Rules:
- Return a VisualDataReplacementPlan JSON object only.
- Reference only paths listed in visual_region_candidates.
- Put every replacement's typed fields directly on its replacement object.
- Return position and size for every chart, infographic, and table in the same coordinate space as its selected candidate.
- Keep bounds inside the candidate and tight around the complete visual, excluding transparent or unrelated padding. Copy candidate bounds exactly only when the visible visual fills them.
- When an image-rendered chart sits inside a larger panel or frame, fit the complete chart inside that panel's visible interior and preserve clear padding on all four sides. Never reuse image-canvas bounds that cross or touch the panel edges.
- For an inset gauge or progress visual, trim canvas padding and use the visible mark's axis-aligned bounds instead of the full candidate bounds.
- Do not return position or size for text-list replacements; they reuse the selected candidate's original bounds.
- Return an empty replacements list when there is no confident match.

# Candidate Rules:
- Never replace an existing structured chart, infographic, table, or text-list; those are extracted deterministically.
- Target an image or group/container whose pixels, children, or geometrically enclosed siblings draw one structured region.
- A panel or frame candidate may anchor a chart assembled from sibling marks and text inside its bounds; select that anchor and extract the complete chart.
- Atomicity is mandatory: one table or chart becomes exactly one typed replacement with all internal visual content.
- A table includes every header and body cell, all cell text, fills, borders, and row and column lines. Never emit table cells, rows, headers, borders, or text separately.
- A chart includes its plot, title, marks, data labels, category and series labels, legend, gridlines, axes, ticks, axis titles, and source.
- Never emit or leave any chart internal as a separate sibling, descendant, or replacement.
- Select the smallest candidate anchoring or containing the complete table or chart and no unrelated content.
- If none exists, return no replacement instead of replacing only part of the visual.

# Classification Rules:
- A chart primarily communicates quantities through bars, lines, areas, slices, points, bubbles, radar, or polar marks.
- A progress bar shows one value on a bounded linear track; a gauge shows one value on a bounded dial, arc, ring, or meter.
- Treat an image as an infographic only when it is one cohesive visual with embedded headings, labels, descriptions, or values; replace the complete image.
- Use kind=infographic for either a complete infographic image or a standalone progress-bar/gauge image or grouped region.
- For other infographics, choose the closest supported data.type and require one complete image.
- Use vertical_funnel for vertically stacked, value-proportional bands and conversion_funnel for horizontal stages.
- A table requires a clear rectangular grid; use the first visible row as columns and all remaining rows as rows.
- Treat a candidate as a text-list only when it contains a coherent sequence of list items. Use marker=bullet for unordered/bulleted lists, marker=number for ordered/numbered lists, and marker=none only for a visibly unmarked list.
- Do not replace maps, decorative geometry, photos, logos, whole-dashboard screenshots, or regions with multiple independent structures.
- Never return both a parent and its descendant.

# Extraction and Styling Rules:
- Transcribe visible titles, category labels, series names, numeric values, range bounds, and source text faithfully when legible.
- If exact chart values are absent, use simple normalized values that preserve visible proportions without inventing precision.
- For assembled bars with shared tracks and visible numeric ticks, derive each value from filled length against the displayed scale; do not estimate from label proximity.
- Use generic category or series labels only when illegible.
- Extract chart type, data, source, title, axes, gridlines, legend, label position, and every visible text or stroke color.
- For pie and donut charts, return exactly one series with one value per category.
- For every chart, each series values array must have exactly one value per category.
- Set x_axis and y_axis false for pie, donut, polar_area, and radar charts unless explicit axes are visible.
- For visible colors, use fully opaque interior pixels, not antialiased or blended edges. Reuse the exact RGB across matching roles or sibling charts that visibly share a flat palette; do not estimate each similar shade independently. Otherwise use null. Colors arrays are ordered renderer slots.
- For chart colors, pie and donut colors[i] is category/slice i; multi-series colors[i] is series i.
- In single-series bar, stacked-bar, polar-area, scatter, or bubble charts, colors[i] is category/data point i.
- For a single-series line or area chart, colors[0] controls line/fill and later colors control successive point fills. Cycle only underspecified palettes.
- title_color controls titles; legend_color legends; text_color data labels and general text; axis_color axis lines, ticks, tick labels, and axis titles; grid_color only gridlines.
- For infographic data.type=progress_bar or data.type=gauge, preserve visible minimum, maximum, and value.
- colors[0] is the inactive track/base arc and colors[1] is the filled progress/value arc. These metric renderers draw no text, so text_color is null.
- Use 0 and 100 only for a clear percentage or when no other scale is visible.
- For qualitative infographics, preserve item order and hierarchy and order colors as [base, accent_1, accent_2, ...].
- colors[0] is the base and colors[1:] follow visible item order. For org_chart and decision_tree, colors[1 + depth] is the node color at that depth.
- For tables, transcribe every visible cell and its color, font, emphasis, and alignment. Keep rows rectangular and use null for uncertain styling.
- For text lists, transcribe items without markers, preserve shared font styling, and set marker separately.
- Set gap to empty vertical pixels between item content boxes and marker_gap to empty horizontal pixels after the marker. Use 0 marker_gap for marker=none.
- Use representative shared spacing when it varies slightly; gap and marker_gap must be non-negative.
"""

GEMINI_VISUAL_DATA_TABLE_ENCODING_PROMPT = """
# Gemini complex visual-data response encoding:
- This section overrides the table and infographic response shapes above for Gemini only. Chart and text-list replacements still use their typed fields directly.
- For a table replacement, return exactly `kind`, `path`, `position`, `size`, and `data_json`. Do not return `columns` or `rows` beside `data_json`.
- `data_json` is a JSON string whose decoded value has this exact shape:
  `{"columns": [CELL, ...], "rows": [[CELL, ...], ...]}`
- Every `CELL` has this exact shape:
  `{"text": string, "color": null | {"color": "#RRGGBB", "opacity": number | null}, "font": null | {"size": number | null, "family": string | null, "color": "#RRGGBB" | null, "bold": boolean | null, "italic": boolean | null, "underline": boolean | null, "line_height": number | null, "letter_spacing": number | null, "ellipsis": boolean | null, "opacity": number | null}, "alignment": null | "left" | "center" | "right" | "justify"}`
- `columns` is the first visible table row. Each entry in `rows` is one remaining visible row and must contain exactly the same number of cells as `columns`.
- Because `data_json` is itself a string inside the response JSON, escape its inner double quotes correctly. Do not wrap it in Markdown fences.
- Do not include `kind`, `path`, `position`, or `size` inside the decoded `data_json` object.
- For an infographic replacement, return exactly `kind`, `path`, `position`, `size`, and `data_json`.
- For kind=infographic, `data_json` is a JSON string whose decoded value has this exact outer shape:
  `{"data": INFOGRAPHIC_DATA, "colors": ["#RRGGBB", ...], "text_color": "#RRGGBB" | null}`
- INFOGRAPHIC_DATA must follow the exact selected infographic data.type schema from the response contract and include all text visible inside the source image.
- Do not include `kind`, `path`, `position`, or `size` inside the decoded infographic `data_json` object.
"""

GENERATE_FLEXIBLE_REGIONS_SYSTEM_PROMPT = """
Identify fixed flow groups and repeatable regions in the semantic slide manifest.

# Steps:
1. Compare geometry, visual structure, semantic relationships, and editable-field hierarchy within each component.
2. Skip components that cannot be confidently partitioned into two visual units.
3. Build each remaining component bottom-up from ordered source-index leaves into the smallest valid rooted flow tree.
4. Mechanically verify every tree against the validation rules below.
5. Return one complete FlexibleSlidePlan JSON object.

# Output and Tree Rules:
- Return a FlexibleSlidePlan JSON object only.
- Return an empty regions list when the slide has no meaningful fixed flow group or repeatable dynamic region.
- Reference only input component ids and source indices; each component has at most one flexible region.
- Set root_flow_id to one declared flow id and keep every other flow reachable from that root exactly once.
- Every item returns both keys and exactly one reference: indices with flow_id=null, or flow_id with indices=null.
- Every flow needs at least two items; one item is invalid even when it contains multiple indices.
- Never wrap all component indices in one leaf merely to create a region. Omit that component from regions instead.
- Collapse one-child helper flows; omit the region if its root still has one item.
- The root must use every component index once, with no cycles, shared flows, omissions, additions, or orphan flows.
- Sort each leaf's indices by source order without duplicates; flow nodes may arrange leaves by geometry.

# Composition Rules:
- Use fixed flow for semantically bound but different items whose spacing or alignment should survive content changes.
- Put aligned title, subtitle or badge, and description in one fixed column when shared alignment and spacing form a visible block.
- Reserve fixed-column height for text capacity; flex cannot fix an undersized title or subtitle.
- When a badge or label background overlaps its text, nest them in a group, then use that group as one row or column item.
- Model a shared footer as one outer row containing nested rows for its independent label/value pairs.
- Use one source index per leaf when the child is already complete; combine indices only when they form one inseparable visual unit.
- A group node must contain at least two separate items; put each overlapping source index in its own leaf instead of one combined leaf.
- Use a repeatable region only when every item has the same semantic field hierarchy and substantially similar visual geometry.
- Include each repeatable item's fixed card surface, local connector, icon frame, local marker or node, and editable content together.
- Use one direct multi-index leaf per card only for a homogeneous regular row or grid with no internal flow.
- Add per-card flows when its parts must reflow or overlap.
- For circular items with central headline/icon and lower title-subtitle copy, use item groups. The lower pair needs a column; headline and icon may be leaves or another column.
- A connector is shared only when one line spans or branches across multiple items; otherwise attach it to the item whose frame, marker, or node it terminates at.
- For a sequence separated as `A | B | C`, attach each divider to the upcoming item: B owns the first divider and C owns the second. The first item has no leading divider.
- Never collect one-to-one item dividers in a separate scaffold; only a line that genuinely spans or branches across multiple items is shared.
- When icons hang from separate lines, create one child group per icon node containing that node's connector, circular frame, and replaceable content icon.
- Keep hanging icon child groups in one parent group so irregular positions remain fixed within one repeated structure.
- Connector direction or length, frame rotation, and decorative container/group wrapper differences do not prevent grouping when every node has the same connector-frame-icon roles.
- In a qualitative diagram with shared fixed frames, paths, or connectors, put all equivalent local node groups in one nested repeatable flow under the fixed root group.
- Use group for irregular diagram nodes, and do not leave equivalent diagram nodes as separately named siblings; each child owns its badge or circle and icon.
- For a timeline or step list, put each marker with its matching heading and description inside the repeated item.
- Keep only a connector spanning multiple timeline items as a separate fixed leaf under the same group root.
- Never place repeated item markers in a standalone scaffold when each marker identifies one repeatable item.
- Keep repeated-looking items fixed only when their scaffolding has no one-to-one semantic mapping; do not use connector direction, length, or offset alone to split local nodes.
- Do not place unrelated logos, charts, decorative backgrounds, or distant metadata in one flexible region.

# Geometry Rules:
- Use row for a single horizontal sequence, column for a single vertical sequence, and grid for multiple rows and columns.
- Use grid only for repeatable equivalent items; fixed heterogeneous groups must use row or column.
- Choose the most specific geometry mode independently at every flow node, including flows nested inside a larger group.
- Treat group as a fallback only after the items fail the row, column, and grid geometry rules.
- Never use group merely because items are semantically related or belong to one fixed structure.
- If homogeneous direct items share one row or column rule, use row or column even when their parent structure requires group.
- Choose a repeated-item wrapper mode collectively across all sibling items, not separately from each item's local geometry.
- Use column for equivalent items in distinct vertical bands despite varying widths or horizontal offsets.
- If corresponding child subflows swap order, mirror sides, or use different offsets across repeated items, no shared row or column rule exists; use group for every item wrapper.
- Do not reduce a copy column beside a card or visual cluster to a row merely because their outer bounds are side by side when their relative placement mirrors or varies across items.
- For side lists flanking central content, use a column root of complete item groups; nest each heading-description copy as a column beside its badge or marker.
- This side-list rule overrides the generic row rule: the marker-plus-copy item wrapper is a group because the marker is anchored to central content, not governed by horizontal reflow.
- Keep the aligned copy in a nested column and the card's overlapping parts in a nested group; let the complete item group preserve the fixed relation between those subflows.
- When an irregular group contains an aligned subsection, represent that subsection as a nested row, column, or grid flow.
- In particular, place a vertically aligned title and description in a column flow instead of flattening them into a card group.
- Use group for intentionally irregular or overlapping items whose absolute relative positions must remain unchanged.
- Choose row only for a non-overlapping horizontal sequence with shared vertical alignment, and column only for the vertical equivalent.
- When heterogeneous items are irregular, overlapping, or not aligned as a row or column, use group; when that grouping is not meaningful, omit the region.

# Naming Rules:
- A repeatable group must contain equivalent complete items; only its item wrappers are indexed, such as metric_item_1 and metric_item_2.
- Keep corresponding child field names identical and unindexed across items, such as metric_icon, metric_value, and metric_label.
- Give each complete repeated-item flow a singular numbered wrapper name such as `text_card_1`, `text_card_2`, or `metric_item_1`.
- Do not concatenate child field names into wrappers, and do not use left, center, or right in repeated item or child names.
- Give every flow a unique structural id and name based on visible structure and child fields; prefer image_cards over agenda_cards.
- Prefer no region over a low-confidence or visually irregular grouping.

# Validation Rules:
- Confirm each flow has at least two items and each item has exactly one non-null reference.
- Confirm sorted leaves cover component element_indices exactly once and every flow is reachable once from root_flow_id.
- Confirm row, column, and grid match geometry; use group only when none fits, or omit the region.
"""

GENERATE_TEXT_CAPACITY_SYSTEM_PROMPT = """
Decide safe capacity growth and alignment for editable text boxes without changing the design.

# Steps:
1. Compare each editable text box with its parent bounds, nearby content, flow role, and the reference image.
2. Evaluate horizontal and vertical space independently and choose precise expansion amounts.
3. Decide the text's horizontal and vertical alignment from the reference image and visible structural role.
4. Express growth as extra characters or lines and return one TextCapacityPlan JSON object.

# Output and Alignment Rules:
- Return a TextCapacityPlan JSON object only.
- Reference only non-decorative text candidate paths from the semantic manifest.
- Return an empty adjustments list when every text box already uses its intended design region.
- left_characters and right_characters add horizontal capacity; top_lines and bottom_lines add vertical capacity.
- Set horizontal_alignment to preserve, left, center, right, or justify and vertical_alignment to preserve, top, middle, or bottom.
- Use justify only when the reference text visibly aligns to both left and right edges across multiple lines; do not justify short labels, titles, metrics, or single-line text.
- Use preserve for correct source alignment. Omit a full no-op, but allow zero growth for an alignment-only adjustment.
- Return all four amounts and both alignments for every adjustment; never return coordinates, pixel sizes, or font values.
- Infer alignment from the reference image and visible geometry, never from semantic names such as badge, pill, chip, or tag.
- For text visibly centered inside a compact surface, return center and middle even when imported text-box bounds or source alignment metadata disagree with the rendered pixels.
- Preserve visibly intentional asymmetric padding; use the surrounding surface only to recognize genuinely centered overlay text.

# Horizontal Growth Rules:
- Keep short labels, page markers, footers, and metric values single-line and visually compact, but do not confuse compactness with tight source bounds.
- Test proportional-font capacity with the widest plausible replacement, such as 100% instead of 96%.
- When unobstructed same-row space exists, request enough horizontal growth for that widest plausible replacement instead of leaving usable space unclaimed.
- Grow left-aligned text to the right, right-aligned text to the left, and centered text on both sides unless a nearby obstacle or boundary requires a safer direction.
- For a left-aligned slide or section title, request right growth only when its full-height corridor and required gap are clear.
- A single-line title whose glyphs begin at its left edge is left-aligned even when metadata says justify.
- If clear space extends right through the title's full vertical span, request positive right growth even when current text fits. Items entirely below its span do not block.
- Nearby items or columns block that growth even when a small source gap remains.
- Preserve the visible gap to a progress bar or neighboring text, and never grow a primary value across an adjacent change indicator or other sibling.
- For a percentage displayed after a progress bar with clear room on its right, request positive right_characters and zero vertical growth.
- Expand dates and other metadata values horizontally with zero vertical growth; give aligned metadata fields compatible horizontal expansion when they share a safe edge.
- Allow titles, subtitles, body text, and card descriptions to expand when unused aligned space exists.

# Vertical Growth Rules:
- Count the lines required by the current text at its actual font size and width.
- If a title or subtitle needs more lines than its declared height can hold, request missing vertical capacity; a later flex wrapper will not contain overflow.
- Preserve width when widening would change intentional wrapping, gutters, columns, or alignment; vertical growth may still be safe.
- Let a final body or description in a vertical content region expand downward through clear aligned space for longer content.
- Do not assume clear space after short body copy is intentional. Substantial same-column space below a final description requires a positive bottom_lines value up to 12.
- In a title-description block above later content, grow the final description downward through its clear corridor toward the next region.
- A final heading-description callout description should normally get positive bottom_lines; use zero only when foreground content or a hard edge immediately blocks it.
- Decorative backgrounds, corner accents, and surfaces behind a text region are not foreground obstacles and do not block safe text-capacity growth.
- Stop downward growth at the nearest parent, slide edge, or obstacle, and keep horizontal growth at zero unless side space is independently safe.

# Repeatable Field Rules:
- For each repeated row, column, or grid, match fields by annotation name and structural role across sibling items before choosing any adjustment.
- Compute the most constrained item's safe adjustment from the intersection of safe directions, then copy identical six-setting tuples to every occurrence.
- In repeated metric cards with a label above a value and clear space, grow every label downward and every left-aligned value rightward.
- If horizontal clearance differs but every final repeated description has clear room below, set horizontal growth to zero and use the smallest shared positive bottom_lines value.
- Do not omit one repeated description or give it zero bottom_lines when positive downward growth is safe for every corresponding description.
- Apply that same tuple across mirrored lists when corresponding descriptions all have safe downward space.
- In repeated cards with clear interior space to the right and below, give every title and description positive right_characters and bottom_lines.
- Use identical settings across items while preserving left and top anchors and card padding.
- Corresponding repeated fields share one safe capacity range so the compiled schema exposes one array item shape.

# Safety Rules:
- Preserve deliberate whitespace and do not expand across another content element, card boundary, divider, image, or visual column.
- In a vertical flow, prefer growing body or description fields over compact titles and labels without changing their content hierarchy.
"""

CLUSTER_SIMILAR_COMPONENTS_SYSTEM_PROMPT = """
Analyze component summaries and create clusters of structurally interchangeable components.

# Steps:
1. Compare each component's role, editable schema, element hierarchy, geometry, and aspect ratio.
2. Group only components that can safely substitute for one another without changing generated content shape.
3. Return one complete SimilarComponentsList JSON object.

# Rules:
- Group components only when they have the same structural role, substantially similar geometry, and compatible editable-field hierarchy.
- Ignore example content. Different topics do not make equivalent components dissimilar, and similar topics do not make different components equivalent.
- Do not group components merely because they share broad words such as title, text, image, or content.
- Keep components separate when their region placement, repeated-item arrangement, min/max capacity, connector geometry, or child schema differs materially.
- Each group must contain at least one index; singleton groups are valid.
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
        unique_layouts.append(layout.model_copy(deep=True, update={"id": candidate_id}))

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
    """Generate certified template layouts through focused semantic passes."""
    if not layouts.layouts:
        raise ValueError("layouts must contain at least one slide layout")
    if len(slide_image_urls) != len(layouts.layouts):
        raise ValueError("slide_image_urls must contain one image for each layout")

    started_at = perf_counter()
    slide_count = len(layouts.layouts)
    max_workers = min(MAX_PARALLEL_SLIDE_LAYOUTS, slide_count)
    LOGGER.info(
        "[templates.v2.generate] certified multi-pass generation start "
        "slides=%d max_parallel=%d validation_retries=%d",
        slide_count,
        max_workers,
        DEFAULT_VALIDATION_RETRIES,
    )

    layouts_by_index: dict[int, SlideLayout] = {}
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = {
            executor.submit(
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
        "[templates.v2.generate] certified multi-pass generation complete "
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
        _component_clustering_summary(component, index=index)
        for index, component in enumerate(indexed_components)
    ]
    LOGGER.info(
        "[templates.v2.deduplicate] clustering start components=%d",
        len(indexed_components),
    )
    response = _generate_structured_with_provider_fallback(
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
        providers=_template_clustering_structured_providers(),
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


def _component_clustering_summary(
    component: Component,
    *,
    index: int,
) -> dict[str, Any]:
    from templates.v2.schema import get_component_schema

    component_data = component.model_dump(mode="json", exclude_none=True)
    bounds = _component_content_size(component_data)
    return {
        "index": index,
        "id": component.id,
        "description": component.description,
        "position": component.position.model_dump(mode="json"),
        "content_bounds": bounds,
        "element_hierarchy": [
            element.get("type")
            for element in _walk_element_dicts(component_data["elements"])
        ],
        "editable_schema": get_component_schema(component),
    }


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
        _element_bounds(element) for element in elements if isinstance(element, dict)
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
    if element_type == "container" and own_bounds is not None:
        return own_bounds
    child_bounds = _merge_bounds(
        _offset_bounds(_element_bounds(child), x or 0.0, y or 0.0)
        for child in _element_children(element)
    )
    return _merge_bounds([own_bounds, child_bounds])


def _vector_has_visible_paint(element: dict[str, Any]) -> bool:
    if element.get("type") != "vector":
        return True

    for property_name in ("fill", "stroke", "shadow"):
        paint = element.get(property_name)
        if not isinstance(paint, dict):
            continue
        opacity = _coerce_number(paint.get("opacity"))
        if opacity is not None and opacity <= 0:
            continue
        if property_name == "stroke":
            width = _coerce_number(paint.get("width"))
            if width is not None and width <= 0:
                continue
        return True
    return False


def _vector_is_text_bounds_twin(
    element: dict[str, Any],
    target: dict[str, Any],
    target_bounds: dict[str, float],
    element_bounds: dict[str, float],
) -> bool:
    if element.get("type") != "vector" or target.get("type") != "text":
        return False
    fill = element.get("fill")
    if isinstance(fill, dict) and _coerce_number(fill.get("opacity")) != 0:
        return False
    return all(
        abs(element_bounds[key] - target_bounds[key]) <= 0.5
        for key in ("x", "y", "width", "height")
    )


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


_SEMANTIC_ELEMENT_TYPES = {
    "text",
    "image",
    "text-list",
    "table",
    "chart",
    "infographic",
}
_SUPPORTED_TEMPLATE_INFOGRAPHIC_TYPES = {
    infographic_type.value for infographic_type in InfographicType
}
_VISUAL_DATA_REGION_TYPES = {"container", "group", "image"}
_SCHEMA_LIMIT_PAIRS = (
    ("min_length", "max_length"),
    ("min_items", "max_items"),
    ("min_item_length", "max_item_length"),
    ("min_columns", "max_columns"),
    ("min_rows", "max_rows"),
    ("min_children", "max_children"),
)


def _visual_data_generation_payload(
    source_layout: RawSlideLayout,
) -> tuple[dict[str, Any], set[str]]:
    source_data = source_layout.model_dump(mode="json", exclude_none=True)
    candidates = list(_visual_data_region_candidates(source_data["elements"]))
    return {
        "source_layout": {
            "id": source_data["id"],
            "description": source_data["description"],
        },
        "indexed_elements": [
            {
                "source_index": index,
                "element": _strip_decorative_fields(element),
            }
            for index, element in enumerate(source_data["elements"])
        ],
        "visual_region_candidates": candidates,
    }, {candidate["path"] for candidate in candidates}


def _visual_data_region_candidates(elements: list[dict[str, Any]]):
    for index, element in enumerate(elements):
        yield from _visual_data_region_candidates_in_element(
            element,
            path=f"elements.{index}",
        )


def _visual_data_region_candidates_in_element(element: Any, *, path: str):
    if not isinstance(element, dict):
        return

    element_type = element.get("type")
    bounds = _element_bounds(element)
    if (
        element_type in _VISUAL_DATA_REGION_TYPES
        and not (element_type == "image" and element.get("is_icon") is True)
        and bounds is not None
        and bounds["width"] >= 24
        and bounds["height"] >= 12
    ):
        yield {
            "path": path,
            "type": element_type,
            "name": element.get("name"),
            "position": {"x": bounds["x"], "y": bounds["y"]},
            "size": {"width": bounds["width"], "height": bounds["height"]},
            "content_preview": _element_content_preview(element),
        }

    child = element.get("child")
    if isinstance(child, dict):
        yield from _visual_data_region_candidates_in_element(
            child,
            path=f"{path}.child",
        )

    children = element.get("children")
    if isinstance(children, list):
        for index, nested in enumerate(children):
            yield from _visual_data_region_candidates_in_element(
                nested,
                path=f"{path}.children.{index}",
            )


def _validate_visual_data_replacement_plan(
    plan: VisualDataReplacementPlan,
    *,
    candidate_paths: set[str],
    source_elements: list[dict[str, Any]],
) -> None:
    for replacement in plan.replacements:
        if replacement.path not in candidate_paths:
            raise ValueError(
                f"visual data replacement references unknown candidate {replacement.path}"
            )
        target = _element_at_semantic_path(source_elements, replacement.path)
        bounds = _element_bounds(target)
        if bounds is None or bounds["width"] <= 0 or bounds["height"] <= 0:
            raise ValueError(
                f"visual data replacement has no usable bounds: {replacement.path}"
            )
        if isinstance(replacement, VisualTextListReplacement):
            replacement_bounds = bounds
        else:
            replacement_bounds = {
                "x": replacement.position.x,
                "y": replacement.position.y,
                "width": replacement.size.width,
                "height": replacement.size.height,
            }
            _require_finite_numbers(replacement_bounds, label="replacement bounds")
            if (
                replacement_bounds["width"] <= 0
                or replacement_bounds["height"] <= 0
            ):
                raise ValueError(
                    "visual data replacement must have positive size: "
                    f"{replacement.path}"
                )
            if not _bounds_contains(bounds, replacement_bounds):
                raise ValueError(
                    "visual data replacement bounds must stay inside candidate: "
                    f"{replacement.path}"
                )
        if (
            isinstance(replacement, VisualInfographicReplacement)
            and replacement.data.type not in {"progress_bar", "gauge"}
            and target.get("type") != "image"
        ):
            raise ValueError(
                "complete infographic replacements must target one image: "
                f"{replacement.path}"
            )
        if isinstance(replacement, VisualChartReplacement) and (
            replacement_bounds["width"] < 80 or replacement_bounds["height"] < 60
        ):
            raise ValueError(
                f"chart replacement must be at least 80x60 px: {replacement.path}"
            )


def _apply_visual_data_replacement_plan(
    source_layout: RawSlideLayout,
    plan: VisualDataReplacementPlan,
) -> RawSlideLayout:
    source_data = source_layout.model_dump(mode="json", exclude_none=True)
    source_elements = source_data["elements"]
    for replacement in plan.replacements:
        target = _element_at_semantic_path(source_elements, replacement.path)
        converted = _visual_data_replacement_element(target, replacement)
        target.clear()
        target.update(converted)
    return RawSlideLayout.model_validate(source_data)


def _visual_data_replacement_element(
    target: dict[str, Any],
    replacement: VisualDataReplacement,
) -> dict[str, Any]:
    target_bounds = _element_bounds(target)
    if target_bounds is None:
        raise ValueError(f"replacement target has no bounds: {replacement.path}")

    if isinstance(replacement, VisualTextListReplacement):
        position = {"x": target_bounds["x"], "y": target_bounds["y"]}
        size = {
            "width": target_bounds["width"],
            "height": target_bounds["height"],
        }
    else:
        position = replacement.position.model_dump(mode="json")
        size = replacement.size.model_dump(mode="json")

    common: dict[str, Any] = {
        "position": position,
        "size": size,
        "name": str(target.get("name") or replacement.kind),
        "decorative": False,
    }
    rotation = target.get("rotation")
    if isinstance(rotation, (int, float)) and not isinstance(rotation, bool):
        common["rotation"] = float(rotation)

    replacement_data = replacement.model_dump(mode="json")
    replacement_data.pop("kind", None)
    replacement_data.pop("path", None)
    replacement_data.pop("position", None)
    replacement_data.pop("size", None)
    if replacement.kind == "chart":
        return {
            "type": "chart",
            **common,
            **replacement_data,
        }
    if replacement.kind == "table":
        columns = [
            _visual_table_cell_element(cell) for cell in replacement_data.pop("columns")
        ]
        rows = [
            [_visual_table_cell_element(cell) for cell in row]
            for row in replacement_data.pop("rows")
        ]
        return {
            "type": "table",
            **common,
            "columns": columns,
            "rows": rows,
            "min_columns": (len(columns) + 1) // 2,
            "max_columns": len(columns),
            "min_rows": (len(rows) + 1) // 2,
            "max_rows": len(rows),
        }
    if replacement.kind == "text-list":
        items = replacement_data.pop("items")
        item_lengths = [len(item) for item in items]
        max_item_length = max(1, max(item_lengths))
        return {
            "type": "text-list",
            **common,
            **replacement_data,
            "items": [[{"text": item}] for item in items],
            "min_items": (len(items) + 1) // 2,
            "max_items": len(items),
            "min_item_length": (max_item_length + 1) // 2,
            "max_item_length": max_item_length,
        }
    if replacement.kind == "infographic":
        return {
            "type": "infographic",
            **common,
            **replacement_data,
        }
    raise ValueError(f"unsupported visual data replacement kind: {replacement.kind}")


def _visual_table_cell_element(cell: dict[str, Any]) -> dict[str, Any]:
    cell_data = dict(cell)
    text = cell_data.pop("text")
    font = cell_data.get("font")
    runs: list[dict[str, Any]] = [{"text": text}]
    if isinstance(font, dict):
        runs[0]["font"] = font
    return {
        **{key: value for key, value in cell_data.items() if value is not None},
        "runs": runs,
    }


def _semantic_generation_payload(
    source_layout: RawSlideLayout,
    fonts: dict[str, str] | None,
) -> tuple[dict[str, Any], set[str]]:
    source_data = source_layout.model_dump(mode="json", exclude_none=True)
    indexed_elements = [
        {"source_index": index, "element": element}
        for index, element in enumerate(source_data["elements"])
    ]
    candidates = list(_semantic_candidates(source_data["elements"]))
    payload = {
        "source_layout": {
            "id": source_data["id"],
            "description": source_data["description"],
        },
        "available_font_families": sorted((fonts or {}).keys()),
        "indexed_elements": indexed_elements,
        "editable_candidates": candidates,
    }
    return _strip_decorative_fields(payload), {
        candidate["path"] for candidate in candidates
    }


def _semantic_candidates(elements: list[dict[str, Any]]):
    for index, element in enumerate(elements):
        yield from _semantic_candidates_in_element(
            element,
            path=f"elements.{index}",
        )


def _semantic_candidates_in_element(element: Any, *, path: str):
    if not isinstance(element, dict):
        return

    element_type = element.get("type")
    if element_type in _SEMANTIC_ELEMENT_TYPES and (
        element_type != "infographic" or _is_supported_template_infographic(element)
    ):
        yield {
            "path": path,
            "type": element_type,
            "current_name": element.get("name"),
            "content_preview": _element_content_preview(element),
        }

    child = element.get("child")
    if isinstance(child, dict):
        yield from _semantic_candidates_in_element(child, path=f"{path}.child")

    children = element.get("children")
    if isinstance(children, list):
        for index, nested in enumerate(children):
            yield from _semantic_candidates_in_element(
                nested,
                path=f"{path}.children.{index}",
            )


def _is_supported_template_infographic(element: dict[str, Any]) -> bool:
    data = element.get("data")
    return (
        isinstance(data, dict)
        and data.get("type") in _SUPPORTED_TEMPLATE_INFOGRAPHIC_TYPES
    )


def _element_content_preview(element: dict[str, Any]) -> str | None:
    element_type = element.get("type")
    if element_type == "text":
        return "".join(
            str(run.get("text") or run.get("latex") or "")
            for run in element.get("runs", [])
            if isinstance(run, dict)
        )[:240]
    if element_type == "text-list":
        return json.dumps(element.get("items", []), ensure_ascii=False)[:240]
    if element_type == "image":
        return str(element.get("prompt") or element.get("data") or "")[:240]
    if element_type == "chart":
        return str(element.get("title") or element.get("chart_type") or "")[:240]
    return None


def _validate_semantic_manifest(
    manifest: SemanticSlideManifest,
    *,
    source_element_count: int,
    candidate_paths: set[str],
    source_elements: list[dict[str, Any]],
) -> None:
    referenced_indices = [
        index
        for component in manifest.components
        for index in component.element_indices
    ]
    expected_indices = set(range(source_element_count))
    if (
        len(referenced_indices) != source_element_count
        or set(referenced_indices) != expected_indices
    ):
        raise ValueError("components must assign every source index exactly once")
    for component in manifest.components:
        if component.element_indices != sorted(component.element_indices):
            raise ValueError(
                f"component {component.id} must preserve relative source order"
            )
    if any(component.repeated_items is not None for component in manifest.components):
        raise ValueError("repeated_items must be null in the semantic pass")

    annotation_paths = {annotation.path for annotation in manifest.annotations}
    if annotation_paths != candidate_paths:
        missing = sorted(candidate_paths - annotation_paths)
        extra = sorted(annotation_paths - candidate_paths)
        raise ValueError(
            f"annotations must exactly cover editable candidates; missing={missing} extra={extra}"
        )
    for annotation in manifest.annotations:
        element = _element_at_semantic_path(
            source_elements,
            annotation.path,
        )
        element_type = element.get("type")
        if element_type == "image" and annotation.is_icon is None:
            raise ValueError(
                f"image annotation must classify is_icon: {annotation.path}"
            )
        if element_type != "image" and annotation.is_icon is not None:
            raise ValueError(
                f"non-image annotation cannot classify is_icon: {annotation.path}"
            )
        if element_type != "image" and annotation.color is not None:
            raise ValueError(
                f"non-image annotation cannot classify icon color: {annotation.path}"
            )
        if element_type != "image" and annotation.icon_type is not None:
            raise ValueError(
                f"non-image annotation cannot classify icon type: {annotation.path}"
            )
        if element_type == "image" and annotation.is_icon is True:
            if annotation.color is None:
                raise ValueError(
                    "replaceable icon annotation must classify color: "
                    f"{annotation.path}"
                )
            if annotation.icon_type is None:
                raise ValueError(
                    "replaceable icon annotation must classify icon_type: "
                    f"{annotation.path}"
                )
        elif annotation.color is not None:
            raise ValueError(
                f"non-icon annotation cannot classify icon color: {annotation.path}"
            )
        elif annotation.icon_type is not None:
            raise ValueError(
                f"non-icon annotation cannot classify icon type: {annotation.path}"
            )
        if (
            element_type
            in {
                "chart",
                "infographic",
                "table",
                "text-list",
            }
            and annotation.decorative
        ):
            raise ValueError(
                f"structured data element must be replaceable: {annotation.path}"
            )


def _flexible_generation_payload(
    source_layout: RawSlideLayout,
    manifest: SemanticSlideManifest,
) -> dict[str, Any]:
    source_data = source_layout.model_dump(mode="json", exclude_none=True)
    return {
        "semantic_manifest": manifest.model_dump(mode="json"),
        "indexed_elements": [
            {
                "source_index": index,
                "element": _strip_decorative_fields(element),
            }
            for index, element in enumerate(source_data["elements"])
        ],
    }


def _text_capacity_generation_payload(
    source_layout: RawSlideLayout,
    manifest: SemanticSlideManifest,
    flexible_plan: FlexibleSlidePlan,
) -> dict[str, Any]:
    source_data = source_layout.model_dump(mode="json", exclude_none=True)
    editable_text_paths = {
        annotation.path
        for annotation in manifest.annotations
        if not annotation.decorative
        and _element_at_semantic_path(source_data["elements"], annotation.path).get(
            "type"
        )
        == "text"
    }
    return {
        "semantic_manifest": manifest.model_dump(mode="json"),
        "flexible_plan": flexible_plan.model_dump(mode="json"),
        "editable_text_boxes": [
            {
                "path": path,
                "element": _strip_decorative_fields(
                    _element_at_semantic_path(source_data["elements"], path)
                ),
            }
            for path in sorted(editable_text_paths)
        ],
        "indexed_elements": [
            {
                "source_index": index,
                "element": _strip_decorative_fields(element),
            }
            for index, element in enumerate(source_data["elements"])
        ],
    }


def _validate_text_capacity_plan(
    plan: TextCapacityPlan,
    *,
    manifest: SemanticSlideManifest,
    flexible_plan: FlexibleSlidePlan,
    source_elements: list[dict[str, Any]],
) -> None:
    annotated_elements = copy.deepcopy(source_elements)
    for annotation in manifest.annotations:
        element = _element_at_semantic_path(annotated_elements, annotation.path)
        element["name"] = annotation.name
        element["decorative"] = annotation.decorative

    editable_text_paths = {
        annotation.path
        for annotation in manifest.annotations
        if not annotation.decorative
        and _element_at_semantic_path(source_elements, annotation.path).get("type")
        == "text"
    }
    vertical_reflow_paths = _fixed_column_vertical_reflow_paths(
        flexible_plan,
        manifest,
        source_elements,
    )
    unsupported_growth_paths: set[str] = set()
    for adjustment in plan.adjustments:
        if adjustment.path not in editable_text_paths:
            raise ValueError(
                f"text capacity path is not an editable text box: {adjustment.path}"
            )
        if _text_adjustment_requests_growth(adjustment):
            element, siblings, boundary = _element_context_at_semantic_path(
                source_elements,
                adjustment.path,
            )
            try:
                _planned_text_capacity(
                    element,
                    siblings=siblings,
                    boundary=boundary,
                    adjustment=adjustment,
                )
            except _TextCapacityGrowthNotApplicable as exc:
                if (
                    adjustment.path in vertical_reflow_paths
                    and (adjustment.top_lines or adjustment.bottom_lines)
                ):
                    continue
                unsupported_growth_paths.add(adjustment.path)
                LOGGER.info(
                    "[templates.v2.generate] ignoring unsupported text-capacity "
                    "growth path=%s reason=%s",
                    adjustment.path,
                    exc,
                )

    repeated_path_groups: list[tuple[str, int, tuple[str, ...]]] = []
    for region in flexible_plan.regions:
        flow_by_id = {flow.id: flow for flow in region.flows}
        for flow in region.flows:
            flow_items = _flow_node_item_indices(flow, flow_by_id)
            if not _region_items_are_structurally_equivalent(
                flow_items,
                annotated_elements,
            ):
                continue
            item_paths = [
                _editable_text_paths_for_indices(item, manifest, source_elements)
                for item in flow_items
            ]
            if len({len(paths) for paths in item_paths}) != 1:
                raise ValueError(
                    f"flexible flow {flow.name} has incompatible editable text fields"
                )
            for field_number, corresponding_paths in enumerate(
                zip(*item_paths),
                start=1,
            ):
                repeated_path_groups.append(
                    (flow.name, field_number, tuple(corresponding_paths))
                )

    # A repeatable field exposes one shared content shape. If one item's geometry
    # cannot support the requested growth, remove that growth from every
    # corresponding item rather than leaving inconsistent capacity limits.
    changed = True
    while changed:
        changed = False
        for _flow_name, _field_number, corresponding_paths in repeated_path_groups:
            if not unsupported_growth_paths.intersection(corresponding_paths):
                continue
            previous_count = len(unsupported_growth_paths)
            unsupported_growth_paths.update(corresponding_paths)
            changed = changed or len(unsupported_growth_paths) != previous_count

    if unsupported_growth_paths:
        normalized_adjustments: list[TextCapacityAdjustment] = []
        for adjustment in plan.adjustments:
            if adjustment.path not in unsupported_growth_paths:
                normalized_adjustments.append(adjustment)
                continue
            if (
                adjustment.horizontal_alignment == "preserve"
                and adjustment.vertical_alignment == "preserve"
            ):
                continue
            normalized_adjustments.append(
                adjustment.model_copy(
                    update={
                        "left_characters": 0,
                        "right_characters": 0,
                        "top_lines": 0,
                        "bottom_lines": 0,
                    }
                )
            )
        plan.adjustments = normalized_adjustments

    adjustments = {adjustment.path: adjustment for adjustment in plan.adjustments}
    for flow_name, field_number, corresponding_paths in repeated_path_groups:
        corresponding_adjustments = [
            adjustments.get(path) for path in corresponding_paths
        ]
        if not any(corresponding_adjustments):
            continue
        if not all(corresponding_adjustments):
            raise ValueError(
                f"text capacity field {field_number} in flexible flow "
                f"{flow_name} must be adjusted for every repeated item"
            )
        settings = {
            (
                adjustment.left_characters,
                adjustment.right_characters,
                adjustment.top_lines,
                adjustment.bottom_lines,
                adjustment.horizontal_alignment,
                adjustment.vertical_alignment,
            )
            for adjustment in corresponding_adjustments
            if adjustment is not None
        }
        if len(settings) != 1:
            raise ValueError(
                f"text capacity field {field_number} in flexible flow "
                f"{flow_name} must use identical settings"
            )


def _editable_text_paths_for_indices(
    indices: list[int],
    manifest: SemanticSlideManifest,
    source_elements: list[dict[str, Any]],
) -> list[str]:
    index_set = set(indices)
    return sorted(
        (
            annotation.path
            for annotation in manifest.annotations
            if not annotation.decorative
            and int(annotation.path.split(".", 2)[1]) in index_set
            and _element_at_semantic_path(
                source_elements,
                annotation.path,
            ).get("type")
            == "text"
        ),
        key=_semantic_path_sort_key,
    )


def _semantic_path_sort_key(path: str) -> tuple[tuple[int, int | str], ...]:
    return tuple(
        (0, int(token)) if token.isdigit() else (1, token) for token in path.split(".")
    )


def _apply_text_capacity_plan(
    source_elements: list[dict[str, Any]],
    plan: TextCapacityPlan,
    *,
    vertical_reflow_paths: set[str] | None = None,
) -> set[str]:
    vertical_reflow_paths = vertical_reflow_paths or set()
    pending_vertical_reflow_paths: set[str] = set()
    for adjustment in plan.adjustments:
        element, siblings, boundary = _element_context_at_semantic_path(
            source_elements,
            adjustment.path,
        )
        original_position = element.get("position") or {}
        original_size = element.get("size") or {}
        requested_flow_reflow = (
            adjustment.path in vertical_reflow_paths
            and bool(adjustment.top_lines or adjustment.bottom_lines)
        )
        expanded: dict[str, float] | None = None
        max_length: int | None = None
        if _text_adjustment_requests_growth(adjustment):
            try:
                expanded, max_length = _planned_text_capacity(
                    element,
                    siblings=siblings,
                    boundary=boundary,
                    adjustment=adjustment,
                )
            except _TextCapacityGrowthNotApplicable:
                if not requested_flow_reflow:
                    raise
                geometry_adjustment = _geometry_text_capacity_adjustment(
                    adjustment,
                    vertical_reflow_paths=vertical_reflow_paths,
                )
                if _text_adjustment_requests_growth(geometry_adjustment):
                    try:
                        expanded, max_length = _planned_text_capacity(
                            element,
                            siblings=siblings,
                            boundary=boundary,
                            adjustment=geometry_adjustment,
                        )
                    except _TextCapacityGrowthNotApplicable:
                        expanded = None
                        max_length = None
                pending_vertical_reflow_paths.add(adjustment.path)

        if expanded is not None and max_length is not None:
            element["position"] = {"x": expanded["x"], "y": expanded["y"]}
            element["size"] = {
                "width": expanded["width"],
                "height": expanded["height"],
            }
            existing_max = int(element.get("max_length") or 0)
            element["max_length"] = max(existing_max, max_length)
            element["min_length"] = max(1, (element["max_length"] + 1) // 2)
            _raise_text_limits_for_geometry(
                element,
                max_lines=_existing_text_box_line_capacity(element),
            )
            if requested_flow_reflow:
                vertical_growth_applied = (
                    expanded["height"]
                    > float(original_size.get("height") or 0) + 0.5
                    or expanded["y"]
                    < float(original_position.get("y") or 0) - 0.5
                )
                if not vertical_growth_applied:
                    pending_vertical_reflow_paths.add(adjustment.path)
        _apply_text_alignment_adjustment(element, adjustment)
    return pending_vertical_reflow_paths


def _text_adjustment_requests_growth(
    adjustment: TextCapacityAdjustment,
) -> bool:
    return any(
        (
            adjustment.left_characters,
            adjustment.right_characters,
            adjustment.top_lines,
            adjustment.bottom_lines,
        )
    )


def _apply_text_alignment_adjustment(
    element: dict[str, Any],
    adjustment: TextCapacityAdjustment,
) -> None:
    if (
        adjustment.horizontal_alignment == "preserve"
        and adjustment.vertical_alignment == "preserve"
    ):
        return
    alignment = element.setdefault("alignment", {})
    if adjustment.horizontal_alignment != "preserve":
        alignment["horizontal"] = adjustment.horizontal_alignment
    if adjustment.vertical_alignment != "preserve":
        alignment["vertical"] = adjustment.vertical_alignment


class _TextCapacityGrowthNotApplicable(ValueError):
    """Requested text growth cannot safely increase the source text box."""


def _planned_text_capacity(
    element: dict[str, Any],
    *,
    siblings: list[dict[str, Any]],
    boundary: dict[str, float],
    adjustment: TextCapacityAdjustment,
) -> tuple[dict[str, float], int]:
    position = element.get("position")
    size = element.get("size")
    if not isinstance(position, dict) or not isinstance(size, dict):
        raise _TextCapacityGrowthNotApplicable(
            f"text capacity path has no explicit bounds: {adjustment.path}"
        )
    rotation = float(element.get("rotation") or 0)
    if abs(rotation) > 0.1:
        raise _TextCapacityGrowthNotApplicable(
            f"rotated text boxes cannot be expanded safely: {adjustment.path}"
        )

    original = {
        "x": float(position["x"]),
        "y": float(position["y"]),
        "width": float(size["width"]),
        "height": float(size["height"]),
    }
    directions = {
        direction
        for direction, amount in (
            ("left", adjustment.left_characters),
            ("right", adjustment.right_characters),
            ("top", adjustment.top_lines),
            ("bottom", adjustment.bottom_lines),
        )
        if amount > 0
    }
    safe_expanded = _expand_text_bounds(
        original,
        siblings=siblings,
        boundary=boundary,
        directions=directions,
        target=element,
    )
    _width, _height, font_size, line_height = _text_capacity_geometry(element)
    character_width = font_size * 0.58
    safe_right = safe_expanded["x"] + safe_expanded["width"]
    safe_bottom = safe_expanded["y"] + safe_expanded["height"]
    original_right = original["x"] + original["width"]
    original_bottom = original["y"] + original["height"]
    expanded_left = max(
        safe_expanded["x"],
        original["x"] - adjustment.left_characters * character_width,
    )
    expanded_top = max(
        safe_expanded["y"],
        original["y"] - adjustment.top_lines * line_height,
    )
    expanded_right = min(
        safe_right,
        original_right + adjustment.right_characters * character_width,
    )
    expanded_bottom = min(
        safe_bottom,
        original_bottom + adjustment.bottom_lines * line_height,
    )
    expanded = {
        "x": round(expanded_left, 2),
        "y": round(expanded_top, 2),
        "width": round(max(original["width"], expanded_right - expanded_left), 2),
        "height": round(max(original["height"], expanded_bottom - expanded_top), 2),
    }
    original_area = original["width"] * original["height"]
    expanded_area = expanded["width"] * expanded["height"]
    if original_area <= 0 or expanded_area < original_area * 1.08:
        raise _TextCapacityGrowthNotApplicable(
            f"text capacity path has no meaningful safe expansion: {adjustment.path}"
        )

    expanded_element = copy.deepcopy(element)
    expanded_element["size"] = {
        "width": expanded["width"],
        "height": expanded["height"],
    }
    original_max_lines = _existing_text_box_line_capacity(element)
    expanded_max_lines = _existing_text_box_line_capacity(expanded_element)
    existing_max = int(element.get("max_length") or 0)
    original_units = _estimated_text_capacity_units(
        element,
        max_lines=original_max_lines,
    )
    expanded_units = _estimated_text_capacity_units(
        expanded_element,
        max_lines=expanded_max_lines,
    )
    scaled_existing_max = math.floor(
        existing_max * expanded_units / max(1, original_units)
    )
    max_length = max(
        _estimated_text_capacity(
            expanded_element,
            max_lines=expanded_max_lines,
        ),
        scaled_existing_max,
    )
    if max_length <= existing_max:
        max_length = math.floor(existing_max * expanded_area / original_area)
    if max_length <= existing_max:
        raise _TextCapacityGrowthNotApplicable(
            f"text capacity path does not increase usable content: {adjustment.path}"
        )
    return expanded, max_length


def _element_context_at_semantic_path(
    source_elements: list[dict[str, Any]],
    path: str,
) -> tuple[dict[str, Any], list[dict[str, Any]], dict[str, float]]:
    tokens = path.split(".")
    if len(tokens) < 2 or tokens[0] != "elements":
        raise ValueError(f"invalid semantic element path {path}")

    collection = source_elements
    value = collection[int(tokens[1])]
    boundary = {"x": 0.0, "y": 0.0, "width": 1280.0, "height": 720.0}
    index = 2
    while index < len(tokens):
        parent = value
        parent_size = parent.get("size") if isinstance(parent, dict) else None
        if isinstance(parent_size, dict):
            boundary = {
                "x": 0.0,
                "y": 0.0,
                "width": float(parent_size["width"]),
                "height": float(parent_size["height"]),
            }
        token = tokens[index]
        if token == "child":
            child = parent.get("child")
            if not isinstance(child, dict):
                raise ValueError(f"invalid semantic element path {path}")
            collection = [child]
            value = child
            index += 1
            continue
        if token == "children" and index + 1 < len(tokens):
            children = parent.get("children")
            if not isinstance(children, list):
                raise ValueError(f"invalid semantic element path {path}")
            collection = children
            value = collection[int(tokens[index + 1])]
            index += 2
            continue
        raise ValueError(f"invalid semantic element path {path}")
    return value, collection, boundary


def _expand_text_bounds(
    bounds: dict[str, float],
    *,
    siblings: list[dict[str, Any]],
    boundary: dict[str, float],
    directions: set[str],
    target: dict[str, Any],
) -> dict[str, float]:
    margin = 6.0
    left = bounds["x"]
    top = bounds["y"]
    right = left + bounds["width"]
    bottom = top + bounds["height"]
    target_index = next(
        (index for index, sibling in enumerate(siblings) if sibling is target),
        len(siblings),
    )
    obstacle_entries = []
    enclosing_surfaces = []
    for sibling_index, sibling in enumerate(siblings):
        if sibling is target or not isinstance(sibling, dict):
            continue
        sibling_bounds = _element_bounds(sibling)
        if sibling_bounds is None:
            continue
        # PPTX conversion emits vector twins for text bounds. Expansion amount
        # is a visual-model decision, so these twins must not become surfaces.
        if _vector_is_text_bounds_twin(sibling, target, bounds, sibling_bounds):
            continue
        if not _vector_has_visible_paint(sibling):
            continue
        if _bounds_contains(sibling_bounds, bounds):
            enclosing_surfaces.append(sibling_bounds)
            continue
        if _bounds_overlap(bounds, sibling_bounds):
            continue
        obstacle_entries.append(
            (
                sibling_bounds,
                sibling.get("decorative") is True,
                sibling_index,
            )
        )

    boundary_area = boundary["width"] * boundary["height"]
    local_surfaces = [
        surface
        for surface in enclosing_surfaces
        if surface["width"] * surface["height"] < boundary_area * 0.95
    ]
    if local_surfaces:
        surface = min(
            local_surfaces,
            key=lambda item: item["width"] * item["height"],
        )
        surface_right = surface["x"] + surface["width"]
        surface_bottom = surface["y"] + surface["height"]
        boundary_right = boundary["x"] + boundary["width"]
        boundary_bottom = boundary["y"] + boundary["height"]
        local_left = max(boundary["x"], surface["x"] + margin)
        local_top = max(boundary["y"], surface["y"] + margin)
        local_right = min(boundary_right, surface_right - margin)
        local_bottom = min(boundary_bottom, surface_bottom - margin)
        if local_right > local_left and local_bottom > local_top:
            boundary = {
                "x": local_left,
                "y": local_top,
                "width": local_right - local_left,
                "height": local_bottom - local_top,
            }
            obstacle_entries = [
                entry
                for entry in obstacle_entries
                if not (
                    entry[1]
                    and entry[2] < target_index
                    and not _bounds_contains(surface, entry[0])
                )
            ]

    obstacles = [entry[0] for entry in obstacle_entries]

    if "left" in directions:
        limit = boundary["x"]
        for obstacle in obstacles:
            obstacle_right = obstacle["x"] + obstacle["width"]
            if _ranges_overlap(
                top, bottom, obstacle["y"], obstacle["y"] + obstacle["height"]
            ):
                if obstacle_right <= left:
                    limit = max(limit, obstacle_right + margin)
        left = min(left, limit)
    if "right" in directions:
        limit = boundary["x"] + boundary["width"]
        for obstacle in obstacles:
            if _ranges_overlap(
                top, bottom, obstacle["y"], obstacle["y"] + obstacle["height"]
            ):
                if obstacle["x"] >= right:
                    limit = min(limit, obstacle["x"] - margin)
        right = max(right, limit)
    if "top" in directions:
        limit = boundary["y"]
        for obstacle in obstacles:
            obstacle_bottom = obstacle["y"] + obstacle["height"]
            if _ranges_overlap(
                left, right, obstacle["x"], obstacle["x"] + obstacle["width"]
            ):
                if obstacle_bottom <= top:
                    limit = max(limit, obstacle_bottom + margin)
        top = min(top, limit)
    if "bottom" in directions:
        limit = boundary["y"] + boundary["height"]
        for obstacle in obstacles:
            if _ranges_overlap(
                left, right, obstacle["x"], obstacle["x"] + obstacle["width"]
            ):
                if obstacle["y"] >= bottom:
                    limit = min(limit, obstacle["y"] - margin)
        bottom = max(bottom, limit)

    return {
        "x": round(left, 2),
        "y": round(top, 2),
        "width": round(max(bounds["width"], right - left), 2),
        "height": round(max(bounds["height"], bottom - top), 2),
    }


def _ranges_overlap(
    first_start: float,
    first_end: float,
    second_start: float,
    second_end: float,
) -> bool:
    return first_start < second_end and second_start < first_end


def _bounds_overlap(
    first: dict[str, float],
    second: dict[str, float],
) -> bool:
    return _ranges_overlap(
        first["x"],
        first["x"] + first["width"],
        second["x"],
        second["x"] + second["width"],
    ) and _ranges_overlap(
        first["y"],
        first["y"] + first["height"],
        second["y"],
        second["y"] + second["height"],
    )


def _bounds_contains(
    outer: dict[str, float],
    inner: dict[str, float],
) -> bool:
    tolerance = 0.5
    return (
        outer["x"] <= inner["x"] + tolerance
        and outer["y"] <= inner["y"] + tolerance
        and outer["x"] + outer["width"] + tolerance >= inner["x"] + inner["width"]
        and outer["y"] + outer["height"] + tolerance >= inner["y"] + inner["height"]
    )


def _estimated_text_capacity(element: dict[str, Any], *, max_lines: int) -> int:
    capacity_units = _estimated_text_capacity_units(
        element,
        max_lines=max_lines,
    )
    current_text = "".join(
        str(run.get("text") or run.get("latex") or "")
        for run in element.get("runs", [])
        if isinstance(run, dict)
    )
    return max(
        len(current_text),
        math.floor(capacity_units * TEXT_CAPACITY_SAFETY_FACTOR),
    )


def _normalize_existing_text_box_limits(elements: list[dict[str, Any]]) -> None:
    """Raise editable text limits when the existing box safely supports more copy."""
    for element in _walk_element_dicts(elements):
        if element.get("type") != "text" or element.get("decorative") is not False:
            continue

        _raise_text_limits_for_geometry(
            element,
            max_lines=_existing_text_box_line_capacity(element),
        )


def _raise_text_limits_for_geometry(
    element: dict[str, Any],
    *,
    max_lines: int,
) -> None:
    estimated_maximum = _estimated_text_capacity(
        element,
        max_lines=max_lines,
    )
    existing_maximum = int(element.get("max_length") or 0)
    if estimated_maximum <= existing_maximum:
        return

    element["max_length"] = estimated_maximum
    element["min_length"] = max(1, (estimated_maximum + 1) // 2)


def _existing_text_box_line_capacity(element: dict[str, Any]) -> int:
    _width, height, _font_size, line_height = _text_capacity_geometry(element)
    return max(1, min(12, math.floor(height / line_height + 0.15)))


def _estimated_text_capacity_units(
    element: dict[str, Any],
    *,
    max_lines: int,
) -> int:
    width, height, font_size, line_height = _text_capacity_geometry(element)
    line_count = max(1, min(max_lines, math.ceil(height / line_height)))
    characters_per_line = max(1, math.floor(width / (font_size * 0.58)))
    return characters_per_line * line_count


def _text_capacity_geometry(
    element: dict[str, Any],
) -> tuple[float, float, float, float]:
    size = element.get("size") or {}
    font = element.get("font") or {}
    run_fonts = [
        run.get("font") or {}
        for run in element.get("runs", [])
        if isinstance(run, dict)
    ]
    font_sizes = [
        float(value)
        for value in [font.get("size"), *[item.get("size") for item in run_fonts]]
        if isinstance(value, (int, float)) and not isinstance(value, bool) and value > 0
    ]
    font_size = max(font_sizes, default=18.0)
    line_height_value = font.get("line_height")
    if isinstance(line_height_value, (int, float)) and line_height_value > 2:
        line_height = float(line_height_value)
    elif isinstance(line_height_value, (int, float)) and line_height_value > 0:
        line_height = font_size * float(line_height_value)
    else:
        line_height = font_size * 1.2

    width = max(1.0, float(size.get("width") or 1))
    height = max(1.0, float(size.get("height") or 1))
    return width, height, font_size, line_height


def _validate_flexible_plan(
    plan: FlexibleSlidePlan,
    *,
    manifest: SemanticSlideManifest,
    source_elements: list[dict[str, Any]],
) -> None:
    components = {component.id: component for component in manifest.components}
    annotated_elements = copy.deepcopy(source_elements)
    for annotation in manifest.annotations:
        element = _element_at_semantic_path(annotated_elements, annotation.path)
        element["name"] = annotation.name
        element["decorative"] = annotation.decorative
    for region in plan.regions:
        component = components.get(region.component_id)
        if component is None:
            raise ValueError(
                f"flexible region references unknown component {region.component_id}"
            )
        flow_by_id = {flow.id: flow for flow in region.flows}
        referenced_flow_ids: list[str] = []
        leaf_indices: list[int] = []

        def validate_flow(flow_id: str, ancestors: tuple[str, ...]) -> list[int]:
            if flow_id in ancestors:
                raise ValueError(f"flexible flow tree contains a cycle at {flow_id}")
            flow = flow_by_id.get(flow_id)
            if flow is None:
                raise ValueError(f"flexible flow references unknown flow {flow_id}")

            item_indices: list[list[int]] = []
            for item in flow.items:
                if item.indices is not None:
                    indices = item.indices
                    if indices != sorted(indices):
                        raise ValueError(
                            f"flexible flow {flow.name} must preserve source order "
                            "inside each leaf"
                        )
                    leaf_indices.extend(indices)
                else:
                    assert item.flow_id is not None
                    referenced_flow_ids.append(item.flow_id)
                    indices = validate_flow(item.flow_id, (*ancestors, flow_id))
                item_indices.append(indices)

            flattened = [index for indices in item_indices for index in indices]
            if len(flattened) != len(set(flattened)):
                raise ValueError(f"flexible flow {flow.name} reuses source indices")
            repeatable = _region_items_are_structurally_equivalent(
                item_indices,
                annotated_elements,
            )
            if flow.mode != "group":
                requested_mode = flow.mode
                try:
                    if repeatable:
                        inferred_mode, _inferred_detail = _infer_repeat_geometry(
                            item_indices,
                            source_elements,
                        )
                    else:
                        inferred_mode, _inferred_detail = _infer_fixed_flow_geometry(
                            item_indices,
                            source_elements,
                        )
                except ValueError as exc:
                    LOGGER.info(
                        "[templates.v2.generate] preserving flexible flow as group "
                        "name=%s requested_mode=%s reason=%s",
                        flow.name,
                        requested_mode,
                        exc,
                    )
                    flow.mode = "group"
                else:
                    if inferred_mode != requested_mode:
                        LOGGER.info(
                            "[templates.v2.generate] preserving flexible flow as "
                            "group name=%s requested_mode=%s inferred_mode=%s",
                            flow.name,
                            requested_mode,
                            inferred_mode,
                        )
                        flow.mode = "group"
            return flattened

        root_indices = validate_flow(region.root_flow_id, ())
        if set(root_indices) != set(component.element_indices):
            raise ValueError(
                f"flexible region for {region.component_id} must partition its "
                "entire component"
            )
        if len(leaf_indices) != len(set(leaf_indices)):
            raise ValueError("flexible flow tree must reference each source index once")
        reachable_ids = {region.root_flow_id, *referenced_flow_ids}
        if reachable_ids != set(flow_by_id):
            raise ValueError(
                "every declared flexible flow must be reachable from the root"
            )
        if len(referenced_flow_ids) != len(set(referenced_flow_ids)):
            raise ValueError(
                "nested flexible flows cannot be shared by multiple parent items"
            )


def _repeat_item_structure_signature(
    indices: list[int],
    source_elements: list[dict[str, Any]],
) -> tuple[str, ...]:
    fields: list[str] = []

    def visit(element: Any) -> None:
        if not isinstance(element, dict):
            return
        element_type = element.get("type")
        if isinstance(element_type, str):
            decorative = bool(element.get("decorative", True))
            if decorative and _is_straight_divider_vector(element):
                return
            name = str(element.get("name") or "")
            normalized_name = _repeatable_base_name(name) if not decorative else ""
            fields.append(f"{element_type}:{decorative}:{normalized_name}")
        child = element.get("child")
        if isinstance(child, dict):
            visit(child)
        children = element.get("children")
        if isinstance(children, list):
            for nested in children:
                visit(nested)

    for index in indices:
        visit(source_elements[index])
    return tuple(sorted(fields))


def _region_items_are_structurally_equivalent(
    items: list[list[int]],
    source_elements: list[dict[str, Any]],
) -> bool:
    signatures = [
        _repeat_item_structure_signature(item, source_elements) for item in items
    ]
    return bool(signatures) and all(
        signature == signatures[0] for signature in signatures[1:]
    )


def _flow_item_indices(
    item: Any,
    flow_by_id: dict[str, FlexibleFlowNodePlan],
) -> list[int]:
    if item.indices is not None:
        return list(item.indices)
    nested = flow_by_id[str(item.flow_id)]
    return [
        index
        for nested_item in nested.items
        for index in _flow_item_indices(nested_item, flow_by_id)
    ]


def _flow_node_item_indices(
    flow: FlexibleFlowNodePlan,
    flow_by_id: dict[str, FlexibleFlowNodePlan],
) -> list[list[int]]:
    return [_flow_item_indices(item, flow_by_id) for item in flow.items]


def _bounds_for_indices(
    elements: list[dict[str, Any]],
    indices: list[int],
) -> dict[str, float]:
    bounds = _merge_bounds(_element_bounds(elements[index]) for index in indices)
    if bounds is None:
        raise ValueError("source elements do not have derivable bounds")
    return bounds


def _infer_repeat_geometry(
    items: list[list[int]],
    source_elements: list[dict[str, Any]],
) -> tuple[str, int]:
    bounds = [_bounds_for_indices(source_elements, item) for item in items]
    widths = [item["width"] for item in bounds]
    heights = [item["height"] for item in bounds]
    if min(widths) <= 0 or min(heights) <= 0:
        raise ValueError("flexible items must have positive bounds")
    if max(widths) / min(widths) > 1.35 or max(heights) / min(heights) > 1.35:
        raise ValueError("flexible items have incompatible sizes")

    x_clusters = _coordinate_clusters(
        [item["x"] + item["width"] / 2 for item in bounds],
        tolerance=max(8.0, sum(widths) / len(widths) * 0.25),
    )
    y_clusters = _coordinate_clusters(
        [item["y"] + item["height"] / 2 for item in bounds],
        tolerance=max(8.0, sum(heights) / len(heights) * 0.25),
    )
    if len(y_clusters) == 1:
        mode, columns = "row", len(items)
    elif len(x_clusters) == 1:
        mode, columns = "column", 1
    elif len(x_clusters) > 1 and len(y_clusters) > 1 and len(items) >= 4:
        mode, columns = "grid", len(x_clusters)
    else:
        raise ValueError("repeated items do not form a regular row, column, or grid")

    _validate_regular_repeat_geometry(
        mode,
        bounds,
        x_clusters=x_clusters,
        y_clusters=y_clusters,
    )
    return mode, columns


def _infer_fixed_flow_geometry(
    items: list[list[int]],
    source_elements: list[dict[str, Any]],
) -> tuple[str, str]:
    bounds = [_bounds_for_indices(source_elements, item) for item in items]
    if any(item["width"] <= 0 or item["height"] <= 0 for item in bounds):
        raise ValueError("fixed flow items must have positive bounds")

    candidates: list[tuple[str, str]] = []
    row_alignment = _cross_axis_alignment(bounds, axis="y")
    if row_alignment and _items_do_not_overlap(bounds, axis="x"):
        candidates.append(("row", row_alignment))
    column_alignment = _cross_axis_alignment(bounds, axis="x")
    if column_alignment and _items_do_not_overlap(bounds, axis="y"):
        candidates.append(("column", column_alignment))

    if not candidates:
        raise ValueError("fixed flow items do not form an aligned row or column")
    if len(candidates) == 1:
        return candidates[0]

    center_x = [item["x"] + item["width"] / 2 for item in bounds]
    center_y = [item["y"] + item["height"] / 2 for item in bounds]
    horizontal_span = max(center_x) - min(center_x)
    vertical_span = max(center_y) - min(center_y)
    return candidates[0] if horizontal_span >= vertical_span else candidates[1]


def _items_do_not_overlap(
    bounds: list[dict[str, float]],
    *,
    axis: str,
) -> bool:
    size_key = "width" if axis == "x" else "height"
    ordered = sorted(bounds, key=lambda item: item[axis])
    return all(
        ordered[index + 1][axis]
        >= ordered[index][axis]
        + ordered[index][size_key]
        - max(
            2.0,
            min(
                ordered[index][size_key],
                ordered[index + 1][size_key],
            )
            * 0.05,
        )
        for index in range(len(ordered) - 1)
    )


def _cross_axis_alignment(
    bounds: list[dict[str, float]],
    *,
    axis: str,
) -> str | None:
    size_key = "width" if axis == "x" else "height"
    tolerance = max(4.0, min(item[size_key] for item in bounds) * 0.2)
    candidates = (
        ("flex-start", [item[axis] for item in bounds]),
        (
            "center",
            [item[axis] + item[size_key] / 2 for item in bounds],
        ),
        (
            "flex-end",
            [item[axis] + item[size_key] for item in bounds],
        ),
    )
    return next(
        (
            alignment
            for alignment, values in candidates
            if max(values) - min(values) <= tolerance
        ),
        None,
    )


def _validate_regular_repeat_geometry(
    mode: str,
    bounds: list[dict[str, float]],
    *,
    x_clusters: list[float],
    y_clusters: list[float],
) -> None:
    if mode in {"row", "column"}:
        axis = "x" if mode == "row" else "y"
        size_key = "width" if mode == "row" else "height"
        ordered = sorted(bounds, key=lambda item: item[axis])
        gaps = [
            ordered[index + 1][axis] - (ordered[index][axis] + ordered[index][size_key])
            for index in range(len(ordered) - 1)
        ]
        if any(gap < -1 for gap in gaps):
            raise ValueError("flexible items cannot overlap along their flow axis")
        return

    _require_regular_distances(
        [
            x_clusters[index + 1] - x_clusters[index]
            for index in range(len(x_clusters) - 1)
        ],
        label="grid columns",
    )
    _require_regular_distances(
        [
            y_clusters[index + 1] - y_clusters[index]
            for index in range(len(y_clusters) - 1)
        ],
        label="grid rows",
    )
    occupied_cells = {
        (
            min(
                range(len(y_clusters)),
                key=lambda index: abs(
                    y_clusters[index] - (item["y"] + item["height"] / 2)
                ),
            ),
            min(
                range(len(x_clusters)),
                key=lambda index: abs(
                    x_clusters[index] - (item["x"] + item["width"] / 2)
                ),
            ),
        )
        for item in bounds
    }
    expected_cells = [
        (row, column)
        for row in range(len(y_clusters))
        for column in range(len(x_clusters))
    ][: len(bounds)]
    if len(occupied_cells) != len(bounds) or occupied_cells != set(expected_cells):
        raise ValueError("grid items must fill cells in regular row-major order")


def _require_regular_distances(values: list[float], *, label: str) -> None:
    if len(values) < 2:
        return
    average = sum(values) / len(values)
    tolerance = max(8.0, abs(average) * 0.25)
    if max(values) - min(values) > tolerance:
        raise ValueError(f"{label} must be visually regular")


def _coordinate_clusters(values: list[float], *, tolerance: float) -> list[float]:
    clusters: list[list[float]] = []
    for value in sorted(values):
        if (
            not clusters
            or abs(value - sum(clusters[-1]) / len(clusters[-1])) > tolerance
        ):
            clusters.append([value])
        else:
            clusters[-1].append(value)
    return [sum(cluster) / len(cluster) for cluster in clusters]


def _compile_semantic_layout(
    source_layout: RawSlideLayout,
    manifest: SemanticSlideManifest,
    flexible_plan: FlexibleSlidePlan,
    text_capacity_plan: TextCapacityPlan,
) -> SlideLayout:
    source_elements = copy.deepcopy(
        source_layout.model_dump(mode="json", exclude_none=True)["elements"]
    )
    for element in _walk_element_dicts(source_elements):
        if element.get(
            "type"
        ) == "infographic" and not _is_supported_template_infographic(element):
            element["decorative"] = True
    for annotation in manifest.annotations:
        element = _element_at_semantic_path(source_elements, annotation.path)
        element["name"] = annotation.name
        element["decorative"] = annotation.decorative
        if element.get("type") == "image" and annotation.is_icon is not None:
            element["is_icon"] = annotation.is_icon
            if annotation.is_icon and annotation.color is not None:
                element["color"] = annotation.color
            if annotation.is_icon and annotation.icon_type is not None:
                element["icon_type"] = annotation.icon_type
    _reserve_single_line_text_overflow_space(
        source_elements,
        manifest,
        text_capacity_plan,
    )
    _normalize_existing_text_box_limits(source_elements)
    geometry_elements = copy.deepcopy(source_elements)
    vertical_reflow_paths = _fixed_column_vertical_reflow_paths(
        flexible_plan,
        manifest,
        source_elements,
    )
    pending_vertical_reflow_paths = _apply_text_capacity_plan(
        source_elements,
        text_capacity_plan,
        vertical_reflow_paths=vertical_reflow_paths,
    )
    vertical_growth_lines = {
        int(adjustment.path.split(".")[1]): (
            adjustment.top_lines + adjustment.bottom_lines
        )
        for adjustment in text_capacity_plan.adjustments
        if adjustment.path in pending_vertical_reflow_paths
        and (adjustment.top_lines or adjustment.bottom_lines)
    }

    regions = {region.component_id: region for region in flexible_plan.regions}
    components: list[Component] = []
    original_component_bounds = {
        component.id: _bounds_for_indices(
            geometry_elements,
            component.element_indices,
        )
        for component in manifest.components
    }
    # Components render as atomic groups in list order. The semantic model may
    # return those groups in visual-reading order (for example, a title before
    # an image panel), which can move an early full-slide background above the
    # title and hide it. Anchor every group to its bottom-most source layer so
    # the compiled component stack follows the original slide stack.
    component_manifests = sorted(
        manifest.components,
        key=lambda component: component.element_indices[0],
    )
    for component_manifest in component_manifests:
        region = regions.get(component_manifest.id)
        component_bounds = _bounds_for_indices(
            source_elements,
            component_manifest.element_indices,
        )
        if region is None:
            elements = [
                _localize_top_level_element(
                    source_elements[index],
                    offset_x=component_bounds["x"],
                    offset_y=component_bounds["y"],
                )
                for index in component_manifest.element_indices
            ]
        else:
            elements = [
                _compile_flexible_region(
                    region,
                    source_elements,
                    component_bounds=component_bounds,
                    geometry_elements=geometry_elements,
                    vertical_growth_lines=vertical_growth_lines,
                )
            ]

        _normalize_dynamic_region_field_limits(elements)
        components.append(
            Component.model_validate(
                {
                    "id": component_manifest.id,
                    "description": component_manifest.description,
                    "position": {
                        "x": component_bounds["x"],
                        "y": component_bounds["y"],
                    },
                    "elements": elements,
                }
            )
        )

    _reflow_components_after_vertical_capacity(
        components,
        original_bounds=original_component_bounds,
        vertically_growing_component_ids={
            component.id
            for component in manifest.components
            if set(component.element_indices).intersection(vertical_growth_lines)
        },
    )
    layout = SlideLayout(
        id=manifest.id,
        description=manifest.description,
        components=components,
    )
    _certify_compiled_layout(layout)
    return layout


def _element_at_semantic_path(
    source_elements: list[dict[str, Any]],
    path: str,
) -> dict[str, Any]:
    tokens = path.split(".")
    if len(tokens) < 2 or tokens[0] != "elements":
        raise ValueError(f"invalid semantic element path {path}")
    value: Any = source_elements[int(tokens[1])]
    index = 2
    while index < len(tokens):
        token = tokens[index]
        if token == "child":
            value = value["child"]
            index += 1
            continue
        if token == "children" and index + 1 < len(tokens):
            value = value["children"][int(tokens[index + 1])]
            index += 2
            continue
        raise ValueError(f"invalid semantic element path {path}")
    if not isinstance(value, dict):
        raise ValueError(f"semantic path {path} does not resolve to an element")
    return value


def _localize_top_level_element(
    element: dict[str, Any],
    *,
    offset_x: float,
    offset_y: float,
) -> dict[str, Any]:
    localized = copy.deepcopy(element)
    position = localized.get("position")
    if isinstance(position, dict):
        position["x"] = float(position.get("x", 0)) - offset_x
        position["y"] = float(position.get("y", 0)) - offset_y
    elif localized.get("type") == "vector":
        for point in localized.get("points", []):
            if isinstance(point, dict):
                point["x"] = float(point.get("x", 0)) - offset_x
                point["y"] = float(point.get("y", 0)) - offset_y
    return localized


def _compile_flexible_region(
    region: FlexibleRegionPlan,
    source_elements: list[dict[str, Any]],
    *,
    component_bounds: dict[str, float],
    geometry_elements: list[dict[str, Any]] | None = None,
    vertical_growth_lines: dict[int, int] | None = None,
) -> dict[str, Any]:
    flow_by_id = {flow.id: flow for flow in region.flows}
    return _compile_flow_node(
        flow_by_id[region.root_flow_id],
        flow_by_id,
        source_elements,
        node_bounds=component_bounds,
        geometry_elements=geometry_elements or source_elements,
        vertical_growth_lines=vertical_growth_lines or {},
    )


def _compile_flow_node(
    flow: FlexibleFlowNodePlan,
    flow_by_id: dict[str, FlexibleFlowNodePlan],
    source_elements: list[dict[str, Any]],
    *,
    node_bounds: dict[str, float],
    geometry_elements: list[dict[str, Any]] | None = None,
    vertical_growth_lines: dict[int, int] | None = None,
) -> dict[str, Any]:
    geometry_elements = geometry_elements or source_elements
    vertical_growth_lines = vertical_growth_lines or {}
    flow_items = _flow_node_item_indices(flow, flow_by_id)
    repeatable = _region_items_are_structurally_equivalent(
        flow_items,
        source_elements,
    )
    if flow.mode == "group":
        mode, columns, align_items = "group", 1, None
    elif repeatable:
        mode, columns = _infer_repeat_geometry(flow_items, geometry_elements)
        align_items = None
    else:
        mode, align_items = _infer_fixed_flow_geometry(
            flow_items,
            geometry_elements,
        )
        columns = 1
    item_bounds = [_bounds_for_indices(source_elements, item) for item in flow_items]
    item_order = (
        list(range(len(flow_items)))
        if mode == "group"
        else sorted(
            range(len(flow_items)),
            key=(
                (lambda index: item_bounds[index]["x"])
                if mode == "row"
                else (lambda index: item_bounds[index]["y"])
                if mode == "column"
                else (
                    lambda index: (
                        item_bounds[index]["y"],
                        item_bounds[index]["x"],
                    )
                )
            ),
        )
    )
    ordered_plans = [flow.items[index] for index in item_order]
    ordered_items = [flow_items[index] for index in item_order]
    ordered_bounds = [item_bounds[index] for index in item_order]
    geometry_item_bounds = [
        _bounds_for_indices(geometry_elements, item) for item in flow_items
    ]
    ordered_geometry_bounds = [geometry_item_bounds[index] for index in item_order]
    children: list[dict[str, Any]] = []
    fluid_capable: list[bool] = []
    first_editable_names: list[str] | None = None
    first_editable_types: list[str] | None = None

    for item_number, (item_plan, indices, bounds) in enumerate(
        zip(ordered_plans, ordered_items, ordered_bounds),
        start=1,
    ):
        if item_plan.flow_id is not None:
            child = _compile_flow_node(
                flow_by_id[item_plan.flow_id],
                flow_by_id,
                source_elements,
                node_bounds=bounds,
                geometry_elements=geometry_elements,
                vertical_growth_lines=vertical_growth_lines,
            )
            if mode == "group":
                child["position"] = {
                    "x": bounds["x"] - node_bounds["x"],
                    "y": bounds["y"] - node_bounds["y"],
                }
            else:
                child.pop("position", None)
            can_fill_space = True
        else:
            localization_bounds = node_bounds if mode == "group" else bounds
            item_children = [
                _localize_top_level_element(
                    source_elements[index],
                    offset_x=localization_bounds["x"],
                    offset_y=localization_bounds["y"],
                )
                for index in sorted(indices)
            ]
            if mode == "group" and len(item_children) == 1:
                child = item_children[0]
                can_fill_space = False
            elif not repeatable and len(item_children) == 1:
                child = item_children[0]
                child.pop("position", None)
                can_fill_space = True
            else:
                if mode == "group":
                    item_children = [
                        _localize_top_level_element(
                            source_elements[index],
                            offset_x=bounds["x"],
                            offset_y=bounds["y"],
                        )
                        for index in sorted(indices)
                    ]
                child = {
                    "type": "group",
                    "name": f"{_singular_name(flow.name)}_item_{item_number}",
                    "position": (
                        {
                            "x": bounds["x"] - node_bounds["x"],
                            "y": bounds["y"] - node_bounds["y"],
                        }
                        if mode == "group"
                        else None
                    ),
                    "size": {
                        "width": bounds["width"],
                        "height": bounds["height"],
                    },
                    "children": item_children,
                }
                can_fill_space = False

        editable = list(_editable_element_dicts([child]))
        if repeatable and first_editable_names is None:
            first_editable_names = [
                _repeatable_base_name(str(element.get("name") or element["type"]))
                for element in editable
            ]
            first_editable_types = [str(element.get("type")) for element in editable]
        elif repeatable and [str(element.get("type")) for element in editable] != (
            first_editable_types or []
        ):
            raise ValueError(f"flexible flow {flow.name} has incompatible fields")
        if repeatable and len(editable) != len(first_editable_names or []):
            raise ValueError(f"flexible flow {flow.name} has incompatible fields")
        if repeatable:
            for element, base_name in zip(editable, first_editable_names or []):
                element["name"] = base_name
            for element in _walk_element_dicts(_element_children(child)):
                name = element.get("name")
                if isinstance(name, str) and name:
                    element["name"] = _repeatable_base_name(name)

        children.append(child)
        fluid_capable.append(can_fill_space)

    if repeatable:
        _normalize_repeatable_field_limits(children)

    if not repeatable and mode != "group":
        _apply_fixed_flow_child_sizing(
            children,
            ordered_bounds,
            fluid_capable,
            mode=mode,
            cross_size=node_bounds["width"]
            if mode == "column"
            else node_bounds["height"],
            align_items=align_items,
        )
        if (
            mode == "column"
            and align_items == "flex-start"
            and any(child.get("size") is None for child in children)
        ):
            align_items = "stretch"

    main_axis_gap = (
        _axis_gap(
            ordered_bounds,
            axis="x" if mode == "row" else "y",
        )
        if mode in {"row", "column"}
        else 0.0
    )
    compiled_height = node_bounds["height"]
    if not repeatable and mode == "column":
        _apply_requested_fixed_column_vertical_growth(
            children,
            ordered_plans,
            ordered_geometry_bounds,
            vertical_growth_lines=vertical_growth_lines,
        )
        child_heights = [
            float(size["height"])
            for child in children
            if isinstance((size := child.get("size")), dict)
            and isinstance(size.get("height"), (int, float))
        ]
        if len(child_heights) == len(children):
            compiled_height = max(
                compiled_height,
                sum(child_heights) + main_axis_gap * max(0, len(children) - 1),
            )

    min_children = max(1, (len(children) + 1) // 2) if repeatable else len(children)
    base: dict[str, Any] = {
        "type": "group" if mode == "group" else "grid" if mode == "grid" else "flex",
        "name": flow.name,
        "position": {"x": 0.0, "y": 0.0},
        "size": {
            "width": node_bounds["width"],
            "height": round(compiled_height, 2),
        },
        "children": children,
    }
    if mode != "group":
        base["min_children"] = min_children
        base["max_children"] = len(children)
    if mode == "group":
        pass
    elif mode == "grid":
        base.update(
            {
                "columns": columns,
                "rows": math.ceil(len(children) / columns),
                "column_gap": _axis_gap(ordered_bounds, axis="x"),
                "row_gap": _axis_gap(ordered_bounds, axis="y"),
            }
        )
    else:
        base.update(
            {
                "direction": mode,
                "gap": main_axis_gap,
            }
        )
        if align_items is not None:
            base["align_items"] = align_items
        if repeatable:
            base["justify_content"] = "center"
    return base


def _apply_fixed_flow_child_sizing(
    children: list[dict[str, Any]],
    bounds: list[dict[str, float]],
    fluid_capable: list[bool],
    *,
    mode: str,
    cross_size: float | None = None,
    align_items: str | None = None,
) -> None:
    eligible = [
        index for index, can_fill_space in enumerate(fluid_capable) if can_fill_space
    ]
    if not children or not eligible:
        return

    main_size = "width" if mode == "row" else "height"
    main_sizes = [item[main_size] for item in bounds]
    equal_share = (
        len(eligible) == len(children) and max(main_sizes) / min(main_sizes) <= 1.1
    )
    flexible_indices = (
        set(range(len(children)))
        if equal_share
        else {max(eligible, key=main_sizes.__getitem__)}
    )
    if mode == "column":
        if align_items == "flex-start" and cross_size is not None:
            for index in flexible_indices:
                if children[index].get("type") in {"text", "text-list"}:
                    continue
                size = children[index].get("size")
                if isinstance(size, dict):
                    size["width"] = max(float(size["width"]), cross_size)
        return

    for index in flexible_indices:
        if children[index].get("type") in {"text", "text-list"}:
            continue
        children[index].pop("size", None)


def _editable_element_dicts(elements: list[dict[str, Any]]):
    for element in elements:
        if not isinstance(element, dict):
            continue
        if (
            element.get("type") in _SEMANTIC_ELEMENT_TYPES
            and element.get("decorative") is False
        ):
            yield element
        child = element.get("child")
        if isinstance(child, dict):
            yield from _editable_element_dicts([child])
        children = element.get("children")
        if isinstance(children, list):
            yield from _editable_element_dicts(children)


def _normalize_repeatable_field_limits(children: list[dict[str, Any]]) -> None:
    field_sets = [list(_editable_element_dicts([child])) for child in children]
    if len(field_sets) < 2 or len({len(fields) for fields in field_sets}) != 1:
        return

    field_signatures = [
        [
            (
                field.get("type"),
                _repeatable_base_name(str(field.get("name") or field.get("type"))),
            )
            for field in fields
        ]
        for fields in field_sets
    ]
    if any(signature != field_signatures[0] for signature in field_signatures[1:]):
        return

    for corresponding_fields in zip(*field_sets):
        for minimum_key, maximum_key in _SCHEMA_LIMIT_PAIRS:
            minimums = [field.get(minimum_key) for field in corresponding_fields]
            maximums = [field.get(maximum_key) for field in corresponding_fields]
            if not all(isinstance(value, int) for value in minimums + maximums):
                continue

            shared_maximum = min(maximums)
            shared_minimum = min(minimums)
            shared_minimum = min(shared_minimum, shared_maximum)
            for field in corresponding_fields:
                field[minimum_key] = shared_minimum
                field[maximum_key] = shared_maximum


def _normalize_dynamic_region_field_limits(elements: list[dict[str, Any]]) -> None:
    """Share schema limits across matching fields in every dynamic flex/grid."""
    for element in elements:
        if not isinstance(element, dict):
            continue

        children = element.get("children")
        if isinstance(children, list):
            minimum = element.get("min_children")
            maximum = element.get("max_children")
            if (
                element.get("type") in {"flex", "grid"}
                and isinstance(minimum, int)
                and isinstance(maximum, int)
                and minimum < maximum
            ):
                _normalize_repeatable_field_limits(children)
            _normalize_dynamic_region_field_limits(children)

        child = element.get("child")
        if isinstance(child, dict):
            _normalize_dynamic_region_field_limits([child])


def _repeatable_base_name(name: str) -> str:
    normalized = re.sub(r"_\d+(?=_|$)", "", name, count=1)
    return _safe_identifier(normalized, fallback="content")


def _singular_name(name: str) -> str:
    if name.endswith("ies") and len(name) > 3:
        return name[:-3] + "y"
    if name.endswith("s") and len(name) > 1:
        return name[:-1]
    return name


def _axis_gap(bounds: list[dict[str, float]], *, axis: str) -> float:
    size_key = "width" if axis == "x" else "height"
    ordered = sorted(bounds, key=lambda item: item[axis])
    gaps = [
        ordered[index + 1][axis] - (ordered[index][axis] + ordered[index][size_key])
        for index in range(len(ordered) - 1)
        if ordered[index + 1][axis]
        >= ordered[index][axis] + ordered[index][size_key] - 1
    ]
    return round(max(0.0, sum(gaps) / len(gaps)), 2) if gaps else 0.0


def _certify_compiled_layout(layout: SlideLayout) -> None:
    if not layout.components:
        raise ValueError("compiled layout must contain at least one component")
    for component in layout.components:
        if not component.elements:
            raise ValueError(f"component {component.id} is empty")
        if not math.isfinite(component.position.x) or not math.isfinite(
            component.position.y
        ):
            raise ValueError(f"component {component.id} has non-finite position")
        for element in component.elements:
            _certify_element_tree(element.model_dump(mode="json", exclude_none=True))

        if any(
            element.get("decorative") is False
            for element in _walk_element_dicts(
                [
                    element.model_dump(mode="json", exclude_none=True)
                    for element in component.elements
                ]
            )
        ):
            from templates.v2.schema import get_component_schema

            if get_component_schema(component) is None:
                raise ValueError(
                    f"component {component.id} has editable elements but no content schema"
                )


def _certify_element_tree(element: dict[str, Any]) -> None:
    position = element.get("position")
    if isinstance(position, dict):
        _require_finite_numbers(position, label="position")
    size = element.get("size")
    if isinstance(size, dict):
        _require_finite_numbers(size, label="size")
        if size.get("width", 0) <= 0 or size.get("height", 0) <= 0:
            raise ValueError("element sizes must be positive")

    for min_name, max_name in _SCHEMA_LIMIT_PAIRS:
        min_value = element.get(min_name)
        max_value = element.get(max_name)
        if min_value is None or max_value is None:
            continue
        if min_value < 0 or max_value < 0 or min_value > max_value:
            raise ValueError(f"invalid schema limits {min_name}/{max_name}")

    if element.get("type") == "table":
        columns = element.get("columns", [])
        for row in element.get("rows", []):
            if len(row) != len(columns):
                raise ValueError("table rows must match the declared column count")
    if element.get("type") == "chart":
        categories = element.get("categories")
        if isinstance(categories, list):
            for series in element.get("series") or []:
                if len(series.get("values", [])) != len(categories):
                    raise ValueError("chart series values must match categories")
    if element.get("type") in {"flex", "grid"}:
        child_count = len(element.get("children") or [])
        if (
            not element.get("min_children", 0)
            <= child_count
            <= element.get("max_children", 0)
        ):
            raise ValueError("flexible child count must fit its declared limits")
    if element.get("type") == "grid":
        columns = element.get("columns", 0)
        rows = element.get("rows")
        if columns < 1 or (rows is not None and rows < 1):
            raise ValueError("grid dimensions must be positive")
        if rows is not None and len(element.get("children") or []) > columns * rows:
            raise ValueError("grid dimensions cannot contain all children")

    for child in _element_children(element):
        _certify_element_tree(child)


def _require_finite_numbers(value: dict[str, Any], *, label: str) -> None:
    for number in value.values():
        if isinstance(number, bool) or not isinstance(number, (int, float)):
            raise ValueError(f"{label} must contain only numbers")
        if not math.isfinite(float(number)):
            raise ValueError(f"{label} must contain only finite numbers")


def _walk_element_dicts(elements: list[dict[str, Any]]):
    for element in elements:
        if not isinstance(element, dict):
            continue
        yield element
        yield from _walk_element_dicts(_element_children(element))


def _safe_identifier(value: str, *, fallback: str) -> str:
    normalized = re.sub(r"[^a-z0-9]+", "_", value.strip().lower()).strip("_")
    if not normalized or not normalized[0].isalpha():
        normalized = f"{fallback}_{normalized}".strip("_")
    return normalized[:80] or fallback


def _fallback_semantic_manifest(source_layout: RawSlideLayout) -> SemanticSlideManifest:
    source_data = source_layout.model_dump(mode="json", exclude_none=True)
    annotations = []
    used_names: set[str] = set()
    for candidate in _semantic_candidates(source_data["elements"]):
        element_type = str(candidate["type"])
        element = _element_at_semantic_path(
            source_data["elements"],
            candidate["path"],
        )
        base_name = _safe_identifier(
            str(candidate.get("current_name") or element_type),
            fallback="content",
        )
        name = base_name
        suffix = 2
        while name in used_names:
            suffix_text = str(suffix)
            name = f"{base_name[: 79 - len(suffix_text)]}_{suffix_text}"
            suffix += 1
        used_names.add(name)
        annotation = {
            "path": candidate["path"],
            "name": name,
            "decorative": (
                False
                if element_type
                in {"chart", "infographic", "table", "text", "text-list"}
                else bool(element.get("decorative", True))
            ),
        }
        if element_type == "image":
            annotation["is_icon"] = element.get("is_icon") is True
            if annotation["is_icon"]:
                annotation["icon_type"] = (
                    element.get("icon_type") or DEFAULT_ICON_TYPE
                )
        annotations.append(annotation)
    description = source_layout.description.strip()
    if len(description) < 10:
        description = "Faithful reusable slide layout preserving all source elements."
    return SemanticSlideManifest.model_validate(
        {
            "id": _safe_identifier(source_layout.id, fallback="slide_layout"),
            "description": description[:300],
            "components": [
                {
                    "id": "slide_content",
                    "description": "Complete source slide preserved as one safe reusable component.",
                    "element_indices": list(range(len(source_data["elements"]))),
                    "repeated_items": None,
                }
            ],
            "annotations": annotations,
        }
    )


def generate_slide_layout(
    source_layout: RawSlideLayout,
    slide_index: int,
    slide_image_url: str,
    fonts: dict[str, str] | None = None,
    *,
    max_tokens: int | None = None,
) -> SlideLayout:
    if not source_layout.elements:
        raise ValueError("source slide must contain at least one element")

    image_part = _openai_image_part(slide_image_url)
    visual_payload, visual_candidate_paths = _visual_data_generation_payload(
        source_layout
    )
    if visual_candidate_paths:
        try:
            visual_response = _generate_structured_with_provider_fallback(
                messages=[
                    SystemMessage(content=DETECT_VISUAL_DATA_REGIONS_SYSTEM_PROMPT),
                    UserMessage(
                        content=[
                            image_part,
                            TextContentPart(text=json.dumps(visual_payload, indent=2)),
                        ],
                    ),
                ],
                label=f"slide {slide_index + 1} visual data regions",
                output_model=VisualDataReplacementPlan,
                response_name="VisualDataReplacementPlanResponse",
                validation_retries=DEFAULT_VALIDATION_RETRIES,
                extra_validator=lambda plan: _validate_visual_data_replacement_plan(
                    plan,
                    candidate_paths=visual_candidate_paths,
                    source_elements=source_layout.model_dump(
                        mode="json", exclude_none=True
                    )["elements"],
                ),
                max_tokens=max_tokens,
            )
            visual_plan = VisualDataReplacementPlan.model_validate(visual_response)
            source_layout = _apply_visual_data_replacement_plan(
                source_layout,
                visual_plan,
            )
        except Exception:
            LOGGER.exception(
                "[templates.v2.generate] visual-data pass failed; preserving "
                "source regions slide=%d",
                slide_index + 1,
            )

    source_data = source_layout.model_dump(mode="json", exclude_none=True)
    semantic_payload, candidate_paths = _semantic_generation_payload(
        source_layout,
        fonts,
    )
    try:
        semantic_response = _generate_structured_with_provider_fallback(
            messages=[
                SystemMessage(content=GENERATE_SLIDE_LAYOUT_SYSTEM_PROMPT),
                UserMessage(
                    content=[
                        image_part,
                        TextContentPart(text=json.dumps(semantic_payload, indent=2)),
                    ],
                ),
            ],
            label=f"slide {slide_index + 1} semantic manifest",
            output_model=SemanticSlideManifest,
            response_name="SemanticSlideManifestResponse",
            validation_retries=DEFAULT_VALIDATION_RETRIES,
            extra_validator=lambda manifest: _validate_semantic_manifest(
                manifest,
                source_element_count=len(source_data["elements"]),
                candidate_paths=candidate_paths,
                source_elements=source_data["elements"],
            ),
            max_tokens=max_tokens,
        )
        manifest = SemanticSlideManifest.model_validate(semantic_response)
    except Exception:
        LOGGER.exception(
            "[templates.v2.generate] semantic pass failed; using "
            "fidelity-preserving fallback slide=%d",
            slide_index + 1,
        )
        return _replace_content_image_urls(_fallback_slide_layout(source_layout))

    flexible_plan = FlexibleSlidePlan(regions=[])
    try:
        flexible_response = _generate_structured_with_provider_fallback(
            messages=[
                SystemMessage(content=GENERATE_FLEXIBLE_REGIONS_SYSTEM_PROMPT),
                UserMessage(
                    content=[
                        image_part,
                        TextContentPart(
                            text=json.dumps(
                                _flexible_generation_payload(source_layout, manifest),
                                indent=2,
                            )
                        ),
                    ],
                ),
            ],
            label=f"slide {slide_index + 1} flexible regions",
            output_model=FlexibleSlidePlan,
            response_name="FlexibleSlidePlanResponse",
            validation_retries=DEFAULT_VALIDATION_RETRIES,
            extra_validator=lambda plan: _validate_flexible_plan(
                plan,
                manifest=manifest,
                source_elements=source_data["elements"],
            ),
            max_tokens=max_tokens,
        )
        flexible_plan = FlexibleSlidePlan.model_validate(flexible_response)
    except Exception:
        LOGGER.exception(
            "[templates.v2.generate] flexible-region pass failed; preserving "
            "the semantic layout slide=%d",
            slide_index + 1,
        )

    text_capacity_plan = TextCapacityPlan(adjustments=[])
    try:
        text_capacity_response = _generate_structured_with_provider_fallback(
            messages=[
                SystemMessage(content=GENERATE_TEXT_CAPACITY_SYSTEM_PROMPT),
                UserMessage(
                    content=[
                        image_part,
                        TextContentPart(
                            text=json.dumps(
                                _text_capacity_generation_payload(
                                    source_layout,
                                    manifest,
                                    flexible_plan,
                                ),
                                indent=2,
                            )
                        ),
                    ],
                ),
            ],
            label=f"slide {slide_index + 1} text capacity",
            output_model=TextCapacityPlan,
            response_name="TextCapacityPlanResponse",
            validation_retries=DEFAULT_VALIDATION_RETRIES,
            extra_validator=lambda plan: _validate_text_capacity_plan(
                plan,
                manifest=manifest,
                flexible_plan=flexible_plan,
                source_elements=source_data["elements"],
            ),
            max_tokens=max_tokens,
        )
        text_capacity_plan = TextCapacityPlan.model_validate(text_capacity_response)
    except Exception:
        LOGGER.exception(
            "[templates.v2.generate] text-capacity pass failed; preserving "
            "validated semantic and flexible decisions slide=%d",
            slide_index + 1,
        )

    compile_attempts = [
        (flexible_plan, text_capacity_plan),
        (flexible_plan, TextCapacityPlan(adjustments=[])),
        (FlexibleSlidePlan(regions=[]), text_capacity_plan),
        (FlexibleSlidePlan(regions=[]), TextCapacityPlan(adjustments=[])),
    ]
    seen_attempts: set[str] = set()
    for candidate_flexible, candidate_capacity in compile_attempts:
        signature = json.dumps(
            [
                candidate_flexible.model_dump(mode="json"),
                candidate_capacity.model_dump(mode="json"),
            ],
            sort_keys=True,
        )
        if signature in seen_attempts:
            continue
        seen_attempts.add(signature)
        try:
            layout = _compile_semantic_layout(
                source_layout,
                manifest,
                candidate_flexible,
                candidate_capacity,
            )
        except Exception:
            LOGGER.exception(
                "[templates.v2.generate] compile certification failed; "
                "retrying with fewer optional decisions slide=%d flex=%s text=%s",
                slide_index + 1,
                bool(candidate_flexible.regions),
                bool(candidate_capacity.adjustments),
            )
            continue
        return _replace_content_image_urls(layout)

    LOGGER.error(
        "[templates.v2.generate] all compile certifications failed; using "
        "fidelity-preserving fallback slide=%d",
        slide_index + 1,
    )
    return _replace_content_image_urls(_fallback_slide_layout(source_layout))


def _fallback_slide_layout(source_layout: RawSlideLayout) -> SlideLayout:
    return _compile_semantic_layout(
        source_layout,
        _fallback_semantic_manifest(source_layout),
        FlexibleSlidePlan(regions=[]),
        TextCapacityPlan(adjustments=[]),
    )


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
        if element.is_icon:
            element.data = CONTENT_ICON_PLACEHOLDER_URL
        else:
            element.data = CONTENT_IMAGE_PLACEHOLDER_URL
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


def _is_straight_divider_vector(element: dict[str, Any]) -> bool:
    if element.get("type") != "vector" or element.get("closed") is True:
        return False
    points = element.get("points")
    if not isinstance(points, list) or len(points) != 2:
        return False
    if any(not isinstance(point, dict) for point in points):
        return False
    try:
        delta_x = abs(float(points[1]["x"]) - float(points[0]["x"]))
        delta_y = abs(float(points[1]["y"]) - float(points[0]["y"]))
    except (KeyError, TypeError, ValueError):
        return False
    return (delta_x <= 1.0 < delta_y) or (delta_y <= 1.0 < delta_x)


def _apply_requested_fixed_column_vertical_growth(
    children: list[dict[str, Any]],
    plans: list[FlexibleFlowItemPlan],
    original_bounds: list[dict[str, float]],
    *,
    vertical_growth_lines: dict[int, int],
) -> None:
    """Grow only text leaves with explicit vertical capacity instructions."""
    for child, plan, bounds in zip(children, plans, original_bounds):
        if child.get("type") != "text" or plan.indices is None:
            continue
        requested_lines = max(
            (vertical_growth_lines.get(index, 0) for index in plan.indices),
            default=0,
        )
        if requested_lines < 1:
            continue
        size = child.get("size")
        if not isinstance(size, dict):
            continue

        original = copy.deepcopy(child)
        original["size"] = {
            "width": float(size.get("width") or bounds["width"]),
            "height": bounds["height"],
        }
        original_lines = _existing_text_box_line_capacity(original)
        _width, height, _font_size, line_height = _text_capacity_geometry(child)
        target_lines = min(12, original_lines + requested_lines)
        requested_height = target_lines * line_height
        if requested_height > height + 0.5:
            size["height"] = round(requested_height, 2)
        _raise_text_limits_for_geometry(child, max_lines=target_lines)


def _component_rendered_bounds(component: Component) -> dict[str, float]:
    elements = [
        element.model_dump(mode="json", exclude_none=True)
        for element in component.elements
    ]
    bounds = _bounds_for_indices(elements, list(range(len(elements))))
    return {
        "x": component.position.x + bounds["x"],
        "y": component.position.y + bounds["y"],
        "width": bounds["width"],
        "height": bounds["height"],
    }


def _fixed_column_vertical_reflow_paths(
    flexible_plan: FlexibleSlidePlan,
    manifest: SemanticSlideManifest,
    source_elements: list[dict[str, Any]],
) -> set[str]:
    """Return top-level text leaves whose column can absorb vertical growth."""
    editable_paths = {
        annotation.path
        for annotation in manifest.annotations
        if not annotation.decorative
    }
    paths: set[str] = set()
    for region in flexible_plan.regions:
        for flow in region.flows:
            if flow.mode != "column":
                continue
            for item in flow.items:
                if item.indices is None or len(item.indices) != 1:
                    continue
                index = item.indices[0]
                path = f"elements.{index}"
                if (
                    path in editable_paths
                    and source_elements[index].get("type") == "text"
                ):
                    paths.add(path)
    return paths


def _geometry_text_capacity_adjustment(
    adjustment: TextCapacityAdjustment,
    *,
    vertical_reflow_paths: set[str],
) -> TextCapacityAdjustment:
    if (
        adjustment.path not in vertical_reflow_paths
        or not (adjustment.top_lines or adjustment.bottom_lines)
    ):
        return adjustment
    return adjustment.model_copy(
        update={
            "top_lines": 0,
            "bottom_lines": 0,
        }
    )


def _reflow_components_after_vertical_capacity(
    components: list[Component],
    *,
    original_bounds: dict[str, dict[str, float]],
    vertically_growing_component_ids: set[str],
) -> None:
    """Preserve spacing below wrappers enlarged by explicit vertical requests."""
    if not vertically_growing_component_ids:
        return

    components_by_id = {component.id: component for component in components}
    affected_component_ids = set(vertically_growing_component_ids)
    ordered_ids = sorted(
        vertically_growing_component_ids,
        key=lambda component_id: original_bounds[component_id]["y"],
    )
    for component_id in ordered_ids:
        component = components_by_id[component_id]
        current = _component_rendered_bounds(component)
        original = original_bounds[component_id]
        growth = current["height"] - original["height"]
        if growth <= 0.5:
            continue
        original_bottom = original["y"] + original["height"]
        for other in components:
            if other.id == component_id:
                continue
            other_original = original_bounds[other.id]
            if other_original["y"] < original_bottom - 0.5:
                continue
            other_current = _component_rendered_bounds(other)
            if not _ranges_overlap(
                current["x"],
                current["x"] + current["width"],
                other_current["x"],
                other_current["x"] + other_current["width"],
            ):
                continue
            other.position.y = round(other.position.y + growth, 2)
            affected_component_ids.add(other.id)

    for component_id in affected_component_ids:
        component = components_by_id[component_id]
        bounds = _component_rendered_bounds(component)
        if bounds["y"] < -0.5 or bounds["y"] + bounds["height"] > 720.5:
            raise ValueError(
                "explicit vertical text-capacity growth moves a component "
                f"outside the slide: {component.id}"
            )


def _reserve_single_line_text_overflow_space(
    elements: list[dict[str, Any]],
    manifest: SemanticSlideManifest,
    text_capacity_plan: TextCapacityPlan,
) -> None:
    """Give compact metric values physical substitution headroom."""
    growth_adjusted_paths = {
        adjustment.path
        for adjustment in text_capacity_plan.adjustments
        if _text_adjustment_requests_growth(adjustment)
    }
    for annotation in manifest.annotations:
        name_tokens = set(annotation.name.lower().split("_"))
        if (
            annotation.decorative
            or annotation.path in growth_adjusted_paths
            or not {"metric", "value"}.issubset(name_tokens)
        ):
            continue
        element, siblings, boundary = _element_context_at_semantic_path(
            elements,
            annotation.path,
        )
        if (
            element.get("type") != "text"
            or _existing_text_box_line_capacity(element) != 1
            or abs(float(element.get("rotation") or 0)) > 0.1
        ):
            continue

        position = element.get("position")
        size = element.get("size")
        if not isinstance(position, dict) or not isinstance(size, dict):
            continue
        width = float(size.get("width") or 0)
        height = float(size.get("height") or 0)
        if width <= 0 or height <= 0:
            continue

        horizontal_alignment = (element.get("alignment") or {}).get("horizontal")
        if horizontal_alignment == "right":
            directions = {"left"}
        elif horizontal_alignment in {"center", "justify"}:
            directions = {"left", "right"}
        else:
            directions = {"right"}

        original = {
            "x": float(position.get("x") or 0),
            "y": float(position.get("y") or 0),
            "width": width,
            "height": height,
        }
        available = _expand_text_bounds(
            original,
            siblings=siblings,
            boundary=boundary,
            directions=directions,
            target=element,
        )
        desired_width = width / TEXT_CAPACITY_SAFETY_FACTOR
        extra_width = desired_width - width
        if extra_width <= 0:
            continue

        original_right = original["x"] + width
        if directions == {"left"}:
            left = max(available["x"], original["x"] - extra_width)
            right = original_right
        elif directions == {"left", "right"}:
            half_extra = extra_width / 2
            left = max(available["x"], original["x"] - half_extra)
            right = min(
                available["x"] + available["width"],
                original_right + half_extra,
            )
        else:
            left = original["x"]
            right = min(
                available["x"] + available["width"],
                original_right + extra_width,
            )

        expanded_width = right - left
        if expanded_width <= width + 0.5:
            continue
        element["position"] = {
            **position,
            "x": round(left, 2),
        }
        element["size"] = {
            **size,
            "width": round(expanded_width, 2),
        }


def _openai_image_part(slide_image_url: str) -> ImageContentPart:
    image_path = resolve_image_path_to_filesystem(slide_image_url)
    if image_path:
        with open(image_path, "rb") as image_file:
            image_bytes = image_file.read()
        mime_type = mimetypes.guess_type(image_path)[0] or "image/png"
        return ImageContentPart(data=image_bytes, mime_type=mime_type)
    return ImageContentPart(url=slide_image_url)


def _template_structured_providers() -> list[TemplateStructuredProvider]:
    # Resolve through the public module so existing integrations can override
    # the configured client/model at the established extension point.
    from templates.v2 import generation as public_generation

    client = public_generation.get_client(config=public_generation.get_llm_config())
    model = public_generation.get_model()
    return [
        TemplateStructuredProvider(
            name=model,
            call=lambda messages, schema, response_name, max_tokens: _call_llm(
                client=client,
                model=model,
                messages=messages,
                response_schema=schema,
                response_name=response_name,
                max_tokens=max_tokens,
            ),
        )
    ]


def _template_clustering_structured_providers() -> list[TemplateStructuredProvider]:
    return _template_structured_providers()


def _call_llm(
    *,
    client: Any,
    model: str,
    messages: TemplateMessages,
    response_schema: dict[str, Any],
    response_name: str,
    max_tokens: int,
) -> Any:
    response_schema = _response_schema_for_model(
        model=model,
        response_name=response_name,
        response_schema=response_schema,
    )
    response = client.generate(
        model=model,
        messages=messages,
        response_format=JSONSchemaResponse(
            name=response_name,
            strict=False,
            json_schema=response_schema,
        ),
        max_tokens=max_tokens,
    )
    return response.content


def _response_schema_for_model(
    *,
    model: str,
    response_name: str,
    response_schema: dict[str, Any],
) -> dict[str, Any]:
    if (
        "gemini" in model.lower()
        and response_name == "VisualDataReplacementPlanResponse"
    ):
        return visual_data_replacement_plan_llm_json_schema()
    return response_schema


def _messages_for_structured_provider(
    *,
    messages: TemplateMessages,
    model: str,
    response_name: str,
) -> TemplateMessages:
    if not (
        "gemini" in model.lower()
        and response_name == "VisualDataReplacementPlanResponse"
    ):
        return list(messages)

    provider_messages: TemplateMessages = []
    instructions_added = False
    for message in messages:
        if (
            not instructions_added
            and isinstance(message, SystemMessage)
            and isinstance(message.content, str)
        ):
            provider_messages.append(
                SystemMessage(
                    content=(
                        f"{message.content.rstrip()}\n\n"
                        f"{GEMINI_VISUAL_DATA_TABLE_ENCODING_PROMPT.strip()}"
                    )
                )
            )
            instructions_added = True
            continue
        provider_messages.append(message)
    return provider_messages


def _generate_structured_with_provider_fallback(
    *,
    messages: TemplateMessages,
    label: str,
    output_model: type[BaseModel],
    response_name: str,
    validation_retries: int,
    extra_validator: Callable[[Any], None] | None = None,
    providers: list[TemplateStructuredProvider] | None = None,
    max_tokens: int | None = None,
) -> dict[str, Any]:
    response_schema = _llm_output_json_schema(output_model)
    effective_max_tokens = max_tokens or TEMPLATE_GENERATION_MAX_COMPLETION_TOKENS
    attempts_per_provider = max(1, validation_retries)
    last_error: Exception | None = None

    for provider in providers or _template_structured_providers():
        provider_response_schema = _response_schema_for_model(
            model=provider.name,
            response_name=response_name,
            response_schema=response_schema,
        )
        attempt_messages = _messages_for_structured_provider(
            messages=messages,
            model=provider.name,
            response_name=response_name,
        )
        for attempt in range(1, attempts_per_provider + 1):
            attempt_started_at = perf_counter()
            raw_response: Any = None
            try:
                LOGGER.info(
                    "[templates.v2.llm] request start label=%s provider=%s "
                    "attempt=%d/%d messages=%d",
                    label,
                    provider.name,
                    attempt,
                    attempts_per_provider,
                    len(attempt_messages),
                )
                raw_response = provider.call(
                    attempt_messages,
                    provider_response_schema,
                    response_name,
                    effective_max_tokens,
                )
                parsed = _parse_json_content(raw_response)
                validated = _validate_output_model(
                    parsed,
                    output_model,
                    extra_validator=extra_validator,
                )
                LOGGER.info(
                    "[templates.v2.llm] response validated label=%s provider=%s "
                    "attempt=%d/%d duration_ms=%.1f schema=%s",
                    label,
                    provider.name,
                    attempt,
                    attempts_per_provider,
                    _elapsed_ms(attempt_started_at),
                    response_name,
                )
                return validated
            except Exception as exc:
                last_error = exc
                LOGGER.warning(
                    "[templates.v2.llm] request failed label=%s provider=%s "
                    "attempt=%d/%d duration_ms=%.1f",
                    label,
                    provider.name,
                    attempt,
                    attempts_per_provider,
                    _elapsed_ms(attempt_started_at),
                    exc_info=True,
                )
                if attempt == attempts_per_provider:
                    break
                attempt_messages = _messages_for_structured_retry(
                    messages=attempt_messages,
                    label=label,
                    output_model=output_model,
                    error=exc,
                    invalid_response=raw_response,
                    response_schema=provider_response_schema,
                )

    if last_error is not None:
        raise last_error
    raise RuntimeError(f"LLM failed to generate {label}")


def _messages_for_structured_retry(
    *,
    messages: TemplateMessages,
    label: str,
    output_model: type[BaseModel],
    error: Exception,
    invalid_response: Any | None,
    response_schema: dict[str, Any] | None = None,
) -> TemplateMessages:
    next_messages = list(messages)
    if invalid_response is not None:
        next_messages.append(
            AssistantMessage(content=[_json_dumps_for_prompt(invalid_response)])
        )

    next_messages.append(
        UserMessage(
            content=_model_validation_repair_prompt(
                label=label,
                output_model=output_model,
                invalid_response=(
                    invalid_response
                    if isinstance(invalid_response, dict)
                    else {"response": invalid_response}
                ),
                error=error,
                response_schema=response_schema,
            )
            if isinstance(error, ValidationError)
            else _json_repair_prompt(
                label=label,
                output_model=output_model,
                invalid_response=invalid_response,
                error=error,
            )
        )
    )
    return next_messages


def _validate_output_model(
    parsed: dict[str, Any],
    output_model: type[BaseModel],
    *,
    extra_validator: Callable[[Any], None] | None = None,
) -> dict[str, Any]:
    if output_model is VisualDataReplacementPlan:
        parsed = _normalize_visual_data_replacement_response(parsed)
    validated = output_model.model_validate(parsed)
    if extra_validator is not None:
        extra_validator(validated)
    return validated.model_dump(mode="json")


def _normalize_visual_data_replacement_response(
    parsed: dict[str, Any],
) -> dict[str, Any]:
    normalized = copy.deepcopy(parsed)
    replacements = normalized.get("replacements")
    if not isinstance(replacements, list):
        return normalized

    for replacement in replacements:
        if not isinstance(replacement, dict):
            continue
        data_json = replacement.pop("data_json", None)
        if isinstance(data_json, str):
            payload = json.loads(data_json)
            if not isinstance(payload, dict):
                raise ValueError("visual replacement data_json must encode an object")
            replacement.update(payload)
    return normalized


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
        if isinstance(part, dict):
            text = part.get("text")
            if isinstance(text, str):
                parts.append(text)
            continue
        text = getattr(part, "text", None)
        if isinstance(text, str):
            parts.append(text)
    return "".join(parts) if parts else None


def _json_repair_prompt(
    *,
    label: str,
    output_model: type[BaseModel],
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
    repair_rules = _structured_output_repair_rules(output_model)
    if repair_rules:
        parts.extend(
            [
                "",
                "task_specific_correction_rules:",
                *[f"- {rule}" for rule in repair_rules],
            ]
        )
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
    response_schema: dict[str, Any] | None = None,
) -> str:
    instructions = [
        f"The previous {label} JSON did not match the required schema.",
        "Return a complete corrected replacement JSON object.",
    ]
    if output_model is SlideLayout:
        instructions.extend(
            [
                "Return id, description, and the complete components list.",
                "Each component must include position and local-coordinate elements.",
            ]
        )
    repair_rules = _structured_output_repair_rules(output_model)
    if repair_rules:
        instructions.extend(
            [
                "",
                "Task-specific correction rules:",
                *[f"- {rule}" for rule in repair_rules],
            ]
        )
    instructions.extend(
        [
            "Return raw JSON only, with no markdown, comments, or explanation.",
            "",
            "validation_errors:",
            _format_error_for_prompt(error),
            "",
            "invalid_response:",
            _json_dumps_for_prompt(invalid_response),
            "",
            "required_json_schema:",
            _json_dumps_for_prompt(
                response_schema or _llm_output_json_schema(output_model)
            ),
        ]
    )
    return "\n".join(instructions)


def _structured_output_repair_rules(
    output_model: type[BaseModel],
) -> list[str]:
    if output_model is FlexibleSlidePlan:
        return [
            "Omit a component from regions unless its root can contain at least two visual items.",
            "Every flow items array must contain at least two items; collapse unary helper flows.",
            "Return both keys for every item with exactly one non-null: indices plus flow_id=null, or indices=null plus flow_id.",
            "Sort indices inside every leaf and partition the component element_indices exactly once with no missing, extra, or reused indices.",
            "Keep every declared flow reachable exactly once from root_flow_id; remove orphan and shared flows.",
            "Use row only for an aligned horizontal sequence, column only for an aligned vertical sequence, grid only for a regular repeated grid, and group for meaningful irregular or overlapping items.",
            "If the geometry or partition remains uncertain, omit the region instead of guessing.",
        ]
    if output_model is TextCapacityPlan:
        return [
            "Return every adjustment as one complete object containing path, all "
            "four growth fields, and both alignment fields; never split fields "
            "across array entries.",
            "Omit every no-op adjustment whose growth values are all zero and whose alignments are both preserve.",
            "Return an empty adjustments list when no text box needs growth or an alignment change.",
        ]
    if output_model is SemanticSlideManifest:
        return [
            "Give every semantic component a unique id; never reuse an id for separate components.",
            "Assign every source index exactly once and preserve ascending source order inside each component.",
            "Order components by their earliest source index so component stacking follows the source slide.",
        ]
    return []


def _llm_output_json_schema(output_model: type[BaseModel]) -> dict[str, Any]:
    if output_model is SemanticSlideManifest:
        return semantic_slide_manifest_llm_json_schema()
    if output_model is FlexibleSlidePlan:
        return flexible_slide_plan_llm_json_schema()
    if output_model is TextCapacityPlan:
        return text_capacity_plan_llm_json_schema()
    if output_model is SlideLayout:
        return slide_layout_llm_json_schema()
    return output_model.model_json_schema()


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
