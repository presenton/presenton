import json
from typing import Any, Literal

import dirtyjson  # type: ignore[import-untyped]
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from constants.presentation import MAX_OUTLINE_CONTENT_WORDS
from utils.infographic_catalog import InfographicType


class StrictSchemaModel(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)


class OpenAIStrictSchemaModel(StrictSchemaModel):
    @model_validator(mode="before")
    @classmethod
    def populate_missing_fields_with_none(cls, value: Any) -> Any:
        if not isinstance(value, dict):
            return value

        normalized = dict(value)
        for field_name, field in cls.model_fields.items():
            alias = field.alias
            if field_name in normalized or (alias and alias in normalized):
                continue
            normalized[alias or field_name] = None
        return normalized


class NoArgsInput(StrictSchemaModel):
    pass


class AddOutlineInput(OpenAIStrictSchemaModel):
    content: str = Field(
        ...,
        min_length=1,
        max_length=20000,
        description=f"Markdown content for the new outline slide. Maximum {MAX_OUTLINE_CONTENT_WORDS} words.",
    )
    index: int | None = Field(
        ...,
        ge=0,
        le=1000,
        description="Zero-based insert index. Use null to append to the end.",
    )


class UpdateOutlineInput(StrictSchemaModel):
    index: int = Field(ge=0, le=1000)
    content: str = Field(
        min_length=1,
        max_length=20000,
        description=f"Replacement markdown content for this outline slide. Maximum {MAX_OUTLINE_CONTENT_WORDS} words.",
    )


class DeleteOutlineInput(StrictSchemaModel):
    index: int = Field(ge=0, le=1000)


class MoveOutlineInput(StrictSchemaModel):
    from_index: int = Field(alias="fromIndex", ge=0, le=1000)
    to_index: int = Field(alias="toIndex", ge=0, le=1000)

    model_config = ConfigDict(extra="forbid", strict=True, populate_by_name=True)


class GetSlideAtIndexInput(StrictSchemaModel):
    index: int = Field(ge=0, le=1000)
    include_full_content: bool = Field(alias="includeFullContent")

    model_config = ConfigDict(extra="forbid", strict=True, populate_by_name=True)


class GetSmartPresentationContextInput(StrictSchemaModel):
    include_slide_html: bool = Field(default=False, alias="includeSlideHtml")
    max_html_chars_per_slide: int = Field(
        default=0,
        alias="maxHtmlCharsPerSlide",
        ge=0,
        le=50000,
        description=(
            "Optional HTML prefix length per slide. Use 0 for complete HTML when "
            "includeSlideHtml is true."
        ),
    )

    model_config = ConfigDict(extra="forbid", strict=True, populate_by_name=True)


class SearchSlidesInput(StrictSchemaModel):
    query: str = Field(min_length=1, max_length=1000)
    limit: int = Field(ge=1, le=10)


class ReadSourceDocumentsInput(OpenAIStrictSchemaModel):
    query: str | None = Field(
        ...,
        min_length=1,
        max_length=1000,
        description=(
            "Optional focus query for retrieving uploaded/source document content. "
            "Use null when the user asks for a general summary."
        ),
    )
    max_chars: int | None = Field(
        ...,
        alias="maxChars",
        ge=1000,
        le=30000,
        description="Maximum document text characters to return. Use null for the default.",
    )

    model_config = ConfigDict(extra="forbid", strict=True, populate_by_name=True)


class GetContentSchemaFromLayoutIdInput(StrictSchemaModel):
    layout_id: str = Field(alias="layoutId", min_length=1, max_length=200)

    model_config = ConfigDict(extra="forbid", strict=True, populate_by_name=True)


class GetAvailableBlocksInput(OpenAIStrictSchemaModel):
    query: str | None = Field(
        ...,
        min_length=1,
        max_length=1000,
        description=("Optional search text for block id, description, layout, or element types."),
    )
    layout_id: str | None = Field(
        ...,
        alias="layoutId",
        min_length=1,
        max_length=200,
        description="Optional layout id to restrict block candidates.",
    )
    element_type: str | None = Field(
        ...,
        alias="elementType",
        min_length=1,
        max_length=80,
        description=(
            "Optional current element type filter: text, container, image, "
            "text-list, table, vector, svg, chart, infographic, flex, grid, or "
            "group. For title/header/subtitle blocks, use text with a "
            "title/header/subtitle query."
        ),
    )
    block_id: str | None = Field(
        ...,
        alias="blockId",
        min_length=1,
        max_length=300,
        description=("Optional exact block id returned by a previous getAvailableBlocks call."),
    )
    include_full_content: bool | None = Field(
        ...,
        alias="includeFullContent",
        description=(
            "Set true only when exact component JSON is needed for addComponent/createComponent."
        ),
    )
    max_results: int | None = Field(
        ...,
        alias="maxResults",
        ge=1,
        le=50,
        description=("Maximum matching block summaries to return. Use null for the default."),
    )

    model_config = ConfigDict(extra="forbid", strict=True, populate_by_name=True)


class GetAvailableInfographicsInput(OpenAIStrictSchemaModel):
    infographic_type: InfographicType | None = Field(
        ...,
        alias="infographicType",
        description=("Optional exact infographic type. Use null to browse or search the catalog."),
    )
    query: str | None = Field(
        ...,
        min_length=1,
        max_length=300,
        description=(
            "Optional search text for a use case, category, type, or name. "
            "Use null to return the complete catalog."
        ),
    )

    model_config = ConfigDict(extra="forbid", strict=True, populate_by_name=True)


class GenerateImageInput(StrictSchemaModel):
    prompt: str = Field(min_length=1, max_length=4000)


class GenerateIconInput(StrictSchemaModel):
    query: str = Field(min_length=1, max_length=1000)


class GenerateAssetItemInput(StrictSchemaModel):
    kind: Literal["image", "icon"]
    prompt: str = Field(
        min_length=1,
        max_length=4000,
        description="Image prompt or icon search query.",
    )


class GenerateAssetsInput(StrictSchemaModel):
    assets: list[GenerateAssetItemInput] = Field(min_length=1, max_length=12)


class AddNewSlideInput(OpenAIStrictSchemaModel):
    index: int | None = Field(
        ...,
        ge=0,
        le=1000,
        description="Zero-based insert index. Use null to append.",
    )


class SaveSlideInput(StrictSchemaModel):
    content: str = Field(
        min_length=2,
        max_length=200000,
        description=(
            "A JSON-serialized object for slide content. "
            'Example: \'{"title": "Q4 Revenue", "bullets": ["North America +22%"]}\''
        ),
    )
    layout_id: str = Field(alias="layoutId", min_length=1, max_length=200)
    index: int = Field(ge=0, le=1000)
    replace_old_slide_at_index: bool = Field(alias="replaceOldSlideAtIndex")

    model_config = ConfigDict(extra="forbid", strict=True, populate_by_name=True)

    @field_validator("content")
    @classmethod
    def validate_content(cls, value: str) -> str:
        try:
            parsed: Any = dirtyjson.loads(value)
        except Exception:
            parsed = json.loads(value)

        if not isinstance(parsed, dict):
            raise ValueError("'content' must be a JSON object.")

        return value


class SaveSmartSlideInput(StrictSchemaModel):
    html: str = Field(
        min_length=1,
        max_length=500000,
        description="Complete replacement HTML fragment for one Smart slide.",
    )
    index: int = Field(ge=0, le=1000)
    replace_old_slide_at_index: bool = Field(alias="replaceOldSlideAtIndex")
    speaker_note: str | None = Field(
        default=None,
        alias="speakerNote",
        max_length=10000,
    )
    edit_prompt: str | None = Field(
        default=None,
        alias="editPrompt",
        max_length=4000,
    )

    model_config = ConfigDict(extra="forbid", strict=True, populate_by_name=True)


class AddNewSlideLayoutInput(StrictSchemaModel):
    content: str = Field(
        min_length=2,
        max_length=200000,
        description="A JSON-serialized object matching the selected layout schema.",
    )
    layout_id: str = Field(alias="layoutId", min_length=1, max_length=200)
    index: int = Field(ge=0, le=1000)

    model_config = ConfigDict(extra="forbid", strict=True, populate_by_name=True)

    @field_validator("content")
    @classmethod
    def validate_content(cls, value: str) -> str:
        try:
            parsed: Any = dirtyjson.loads(value)
        except Exception:
            parsed = json.loads(value)

        if not isinstance(parsed, dict):
            raise ValueError("'content' must be a JSON object.")

        return value


class UpdateSlideInput(AddNewSlideLayoutInput):
    pass


class DeleteSlideInput(StrictSchemaModel):
    index: int = Field(ge=0, le=1000)


class GetSlideElementsInput(OpenAIStrictSchemaModel):
    index: int = Field(
        ...,
        ge=0,
        le=1000,
        description="Zero-based slide index whose rendered UI layout you want to inspect.",
    )
    include_full_json: bool | None = Field(
        ...,
        alias="includeFullJson",
        description="Set true only when the exact UI layout JSON is required.",
    )

    model_config = ConfigDict(extra="forbid", strict=True, populate_by_name=True)


class SlideElementTableCellInput(OpenAIStrictSchemaModel):
    section: Literal["columns", "rows"]
    column_index: int = Field(..., alias="columnIndex", ge=0, le=100)
    row_index: int | None = Field(
        ...,
        alias="rowIndex",
        ge=0,
        le=100,
        description="Required when section is rows; ignored for columns.",
    )
    text: str = Field(..., min_length=0, max_length=5000)

    model_config = ConfigDict(extra="forbid", strict=True, populate_by_name=True)

    @model_validator(mode="after")
    def validate_row_target(self) -> "SlideElementTableCellInput":
        if self.section == "rows" and self.row_index is None:
            raise ValueError("rowIndex is required when section is rows.")
        return self


class SlideElementChartSeriesInput(OpenAIStrictSchemaModel):
    name: str = Field(..., min_length=1, max_length=200)
    values: list[float] = Field(..., min_length=1, max_length=100)

    @model_validator(mode="before")
    @classmethod
    def normalize_data_alias(cls, value: Any) -> Any:
        if not isinstance(value, dict):
            return value
        normalized = dict(value)
        if "values" not in normalized and "data" in normalized:
            normalized["values"] = normalized.pop("data")
        return normalized


DataLabelPosition = Literal["base", "mid", "top", "outside"]


class SlideElementChartInput(OpenAIStrictSchemaModel):
    chart_type: (
        Literal[
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
        ]
        | None
    ) = Field(
        ...,
        alias="chartType",
        description=(
            "Chart type. Supports the same chart types as the editor: bar, "
            "horizontal_bar, stacked_bar, horizontal_stacked_bar, line, area, "
            "pie, donut, scatter, bubble, radar, and polar_area."
        ),
    )
    title: str | None = Field(..., min_length=0, max_length=500)
    title_color: str | None = Field(..., alias="titleColor", min_length=1, max_length=32)
    legend_color: str | None = Field(..., alias="legendColor", min_length=1, max_length=32)
    categories: list[str] | None = Field(..., min_length=1, max_length=100)
    series: list[SlideElementChartSeriesInput] | None = Field(..., min_length=1, max_length=20)
    colors: list[str] | None = Field(
        ...,
        min_length=1,
        max_length=12,
        description=(
            "Optional chart palette. Use user-specified colors when provided; "
            "otherwise omit/null so the current theme graph colors are used."
        ),
    )
    axis_color: str | None = Field(..., alias="axisColor", min_length=1, max_length=32)
    grid_color: str | None = Field(..., alias="gridColor", min_length=1, max_length=32)
    x_axis: bool | None = Field(..., alias="xAxis")
    y_axis: bool | None = Field(..., alias="yAxis")
    x_axis_grid: bool | None = Field(..., alias="xAxisGrid")
    y_axis_grid: bool | None = Field(..., alias="yAxisGrid")
    x_axis_title: str | None = Field(..., alias="xAxisTitle", min_length=0, max_length=200)
    y_axis_title: str | None = Field(..., alias="yAxisTitle", min_length=0, max_length=200)
    data_labels: DataLabelPosition | None = Field(
        ...,
        alias="dataLabels",
        description=(
            "Optional data label placement. Use null to hide labels; otherwise "
            "use base, mid, top, or outside."
        ),
    )
    legend: bool | None = Field(...)

    model_config = ConfigDict(extra="forbid", strict=True, populate_by_name=True)


class SlideElementInfographicDataInput(OpenAIStrictSchemaModel):
    type: Literal["progress_bar", "gauge"] | None = Field(...)
    min_value: float | None = Field(..., alias="minValue")
    max_value: float | None = Field(..., alias="maxValue")
    value: float | None = Field(...)

    model_config = ConfigDict(extra="forbid", strict=True, populate_by_name=True)

    @model_validator(mode="after")
    def validate_range(self) -> "SlideElementInfographicDataInput":
        if (
            self.max_value is not None
            and self.min_value is not None
            and self.max_value <= self.min_value
        ):
            raise ValueError("maxValue must be greater than minValue.")
        return self


class SlideElementInfographicInput(OpenAIStrictSchemaModel):
    data: dict[str, Any] | None = Field(
        ...,
        description=(
            "Partial nested infographic data. Meter updates use type, min_value, "
            "max_value, and value; structural updates use the catalog-native items, "
            "Gantt, matrix, hierarchy, label, or axis fields. Supplied fields merge "
            "into the current data."
        ),
    )
    colors: list[str] | None = Field(
        ...,
        min_length=2,
        max_length=12,
        description="Base and highlight colors, followed by optional extra colors.",
    )


class SlideElementTableValueInput(StrictSchemaModel):
    text: str = Field(min_length=0, max_length=5000)


SlideElementTableValue = str | int | float | bool | None | SlideElementTableValueInput


class SlideElementTableInput(OpenAIStrictSchemaModel):
    columns: list[SlideElementTableValue] | None = Field(..., min_length=1, max_length=100)
    headers: list[SlideElementTableValue] | None = Field(..., min_length=1, max_length=100)
    rows: list[list[SlideElementTableValue]] = Field(min_length=1, max_length=100)

    @model_validator(mode="after")
    def validate_columns_or_headers(self) -> "SlideElementTableInput":
        if self.columns is None and self.headers is None:
            raise ValueError("columns or headers is required.")
        return self


class SlideElementPositionInput(StrictSchemaModel):
    x: float = Field(ge=-10000, le=10000)
    y: float = Field(ge=-10000, le=10000)


class SlideElementSizeInput(StrictSchemaModel):
    width: float = Field(ge=1, le=10000)
    height: float = Field(ge=1, le=10000)


class AddInfographicInput(OpenAIStrictSchemaModel):
    infographic_type: InfographicType = Field(
        ...,
        alias="infographicType",
        description="Exact type returned by getAvailableInfographics.",
    )
    target: Literal["existing_slide", "new_slide"] = Field(...)
    slide_index: int | None = Field(
        ...,
        alias="slideIndex",
        ge=0,
        le=1000,
        description=("Required for existing_slide; optional insertion index for new_slide."),
    )
    data: dict[str, Any] = Field(
        ...,
        description=(
            "Infographic content matching the selected catalog entry. The tool adds "
            "data.type automatically."
        ),
    )
    position: SlideElementPositionInput | None = Field(...)
    size: SlideElementSizeInput | None = Field(...)
    colors: list[str] | None = Field(..., min_length=2, max_length=12)
    text_color: str | None = Field(
        ...,
        alias="textColor",
        min_length=1,
        max_length=64,
    )
    component_id: str | None = Field(
        ...,
        alias="componentId",
        min_length=1,
        max_length=120,
    )
    insert_index: int | None = Field(
        ...,
        alias="insertIndex",
        ge=0,
        le=1000,
    )

    model_config = ConfigDict(extra="forbid", strict=True, populate_by_name=True)

    @model_validator(mode="after")
    def validate_target(self) -> "AddInfographicInput":
        if self.target == "existing_slide" and self.slide_index is None:
            raise ValueError("slideIndex is required for target existing_slide.")
        if self.target == "new_slide" and self.component_id is not None:
            raise ValueError("componentId must be null for target new_slide.")
        return self


class SlideElementVectorCurveInput(OpenAIStrictSchemaModel):
    type: Literal["smooth"] = Field(...)
    tension: float | None = Field(..., ge=0, le=1)
    segments: int | None = Field(..., ge=1, le=96)


class SlideElementVectorInput(OpenAIStrictSchemaModel):
    shape: Literal["polygon", "ellipse"] | None = Field(...)
    points: list[SlideElementPositionInput] | None = Field(
        ...,
        min_length=2,
        max_length=200,
        description="Replacement vector vertices in component-local canvas pixels.",
    )
    closed: bool | None = Field(...)
    curve: SlideElementVectorCurveInput | None = Field(...)
    corner_radii: list[float] | None = Field(
        ...,
        alias="cornerRadii",
        min_length=2,
        max_length=200,
    )
    start_marker: (
        Literal["none", "arrow", "stealth", "triangle", "circle", "square", "diamond"] | None
    ) = Field(..., alias="startMarker")
    end_marker: (
        Literal["none", "arrow", "stealth", "triangle", "circle", "square", "diamond"] | None
    ) = Field(..., alias="endMarker")

    model_config = ConfigDict(extra="forbid", strict=True, populate_by_name=True)


class SlideElementFontInput(OpenAIStrictSchemaModel):
    family: str | None = Field(..., min_length=1, max_length=200)
    size: float | None = Field(..., ge=1, le=512)
    color: str | None = Field(..., min_length=1, max_length=64)
    bold: bool | None = Field(...)
    italic: bool | None = Field(...)
    underline: bool | None = Field(...)
    line_height: float | None = Field(..., alias="lineHeight", ge=0.1, le=10)
    letter_spacing: float | None = Field(..., alias="letterSpacing", ge=-100, le=100)
    wrap: Literal["word", "char", "none"] | None = Field(...)
    opacity: float | None = Field(..., ge=0, le=1)

    model_config = ConfigDict(extra="forbid", strict=True, populate_by_name=True)

    @model_validator(mode="before")
    @classmethod
    def normalize_font_aliases(cls, value: Any) -> Any:
        if not isinstance(value, dict):
            return value
        normalized = dict(value)
        alias_pairs = (
            ("fontFamily", "family"),
            ("font_family", "family"),
            ("fontName", "family"),
            ("font_name", "family"),
            ("name", "family"),
            ("fontSize", "size"),
            ("font_size", "size"),
            ("fontColor", "color"),
            ("font_color", "color"),
            ("textColor", "color"),
            ("text_color", "color"),
            ("line_height", "lineHeight"),
            ("line-height", "lineHeight"),
            ("letter_spacing", "letterSpacing"),
            ("letter-spacing", "letterSpacing"),
        )
        for source_key, target_key in alias_pairs:
            if source_key in normalized and target_key not in normalized:
                normalized[target_key] = normalized.pop(source_key)
        return normalized


class SlideElementAlignmentInput(OpenAIStrictSchemaModel):
    horizontal: Literal["left", "center", "right", "justify"] | None = Field(...)
    vertical: Literal["top", "middle", "bottom"] | None = Field(...)


class SlideElementFillInput(OpenAIStrictSchemaModel):
    color: str | None = Field(..., min_length=1, max_length=64)
    opacity: float | None = Field(..., ge=0, le=1)


class SlideElementStrokeInput(OpenAIStrictSchemaModel):
    color: str | None = Field(..., min_length=1, max_length=64)
    opacity: float | None = Field(..., ge=0, le=1)
    width: float | None = Field(..., ge=0, le=100)
    dash: list[float] | None = Field(..., min_length=1, max_length=12)


class UpdateSlideElementInput(OpenAIStrictSchemaModel):
    index: int = Field(..., ge=0, le=1000)
    element_path: str = Field(
        ...,
        alias="elementPath",
        min_length=1,
        max_length=500,
        description=(
            "Element path returned by getSlideAtIndex, for example "
            "components[0].elements[1].children[0]."
        ),
    )
    text: str | None = Field(
        ...,
        min_length=0,
        max_length=20000,
        description="Replacement text for a text element or replacement image/icon data.",
    )
    items: list[str] | None = Field(
        ...,
        min_length=1,
        max_length=100,
        description="Replacement item text for a text-list element.",
    )
    table_cell: SlideElementTableCellInput | None = Field(
        ...,
        alias="tableCell",
        description="A single table header/body cell update.",
    )
    chart: SlideElementChartInput | None = Field(
        ...,
        description=(
            "Chart update using the new chart model: chartType, title, "
            "categories, series.values, colors, axes, data labels, and legend."
        ),
    )
    vector: SlideElementVectorInput | None = Field(
        ...,
        description=(
            "Vector update using shape, points, closed, smooth curve, cornerRadii, "
            "and optional startMarker/endMarker line endpoints. "
            "Use position/size for ordinary vector move and resize requests."
        ),
    )
    infographic: SlideElementInfographicInput | None = Field(
        ...,
        description=("Infographic update using catalog-native nested data and ordered colors."),
    )
    table: SlideElementTableInput | None = Field(
        ...,
        description="Whole table update with columns/headers and rows.",
    )
    element: str | None = Field(
        ...,
        min_length=2,
        max_length=120000,
        description=(
            "Optional JSON-serialized element patch for toolbar-style properties "
            "such as fill, stroke, font, alignment, opacity, crop, "
            "border_radius, padding, shadow, or line dash. Prefer the chart field "
            "for chart data, the vector field for vector structure, and the "
            "infographic field for infographic data/colors. "
            "Object values are merged into the current element."
        ),
    )
    font: SlideElementFontInput | None = Field(
        ...,
        description=(
            "Toolbar-style text font patch. For text, text-list, and table "
            "elements, this updates both the element font and existing text runs."
        ),
    )
    alignment: SlideElementAlignmentInput | None = Field(
        ...,
        description="Toolbar-style text alignment patch for text elements.",
    )
    fill: SlideElementFillInput | None = Field(
        ...,
        description="Toolbar-style fill/background patch for elements that support fill.",
    )
    stroke: SlideElementStrokeInput | None = Field(
        ...,
        description="Toolbar-style stroke/border/line patch.",
    )
    color: str | None = Field(
        ...,
        min_length=1,
        max_length=64,
        description=(
            "Convenience color patch. For text, text-list, and table elements this "
            "means font.color; for icons/images it updates element color; for "
            "closed vectors it updates fill, for open vectors it updates stroke, "
            "and for infographics it updates the highlight color."
        ),
    )
    opacity: float | None = Field(
        ...,
        ge=0,
        le=1,
        description="Toolbar-style element opacity patch.",
    )
    position: SlideElementPositionInput | None = Field(
        ...,
        description="Optional element position update for move requests.",
    )
    size: SlideElementSizeInput | None = Field(
        ...,
        description="Optional element size update for resize/shrink/grow requests.",
    )

    model_config = ConfigDict(extra="forbid", strict=True, populate_by_name=True)

    @model_validator(mode="before")
    @classmethod
    def normalize_common_llm_payloads(cls, value: Any) -> Any:
        if not isinstance(value, dict):
            return value
        normalized = dict(value)
        chart_keys = (
            "axisColor",
            "axis_color",
            "categories",
            "chartType",
            "chart_type",
            "colors",
            "dataLabels",
            "data_labels",
            "gridColor",
            "grid_color",
            "legend",
            "legendColor",
            "legend_color",
            "series",
            "title",
            "titleColor",
            "title_color",
            "xAxis",
            "xAxisGrid",
            "xAxisTitle",
            "x_axis",
            "x_axis_grid",
            "x_axis_title",
            "yAxis",
            "yAxisGrid",
            "yAxisTitle",
            "y_axis",
            "y_axis_grid",
            "y_axis_title",
        )
        if "chart" not in normalized and any(key in normalized for key in chart_keys):
            normalized["chart"] = {
                key: normalized.pop(key) for key in chart_keys if key in normalized
            }

        font_aliases = {
            "fontFamily": "family",
            "font_family": "family",
            "fontName": "family",
            "font_name": "family",
            "fontSize": "size",
            "font_size": "size",
            "fontColor": "color",
            "font_color": "color",
            "textColor": "color",
            "text_color": "color",
            "bold": "bold",
            "italic": "italic",
            "underline": "underline",
            "lineHeight": "lineHeight",
            "line_height": "lineHeight",
            "letterSpacing": "letterSpacing",
            "letter_spacing": "letterSpacing",
            "wrap": "wrap",
        }
        font_patch = dict(normalized["font"]) if isinstance(normalized.get("font"), dict) else {}
        for source_key, target_key in font_aliases.items():
            if source_key in normalized and target_key not in font_patch:
                font_patch[target_key] = normalized.pop(source_key)
        if font_patch and "font" not in normalized:
            normalized["font"] = font_patch
        elif font_patch:
            normalized["font"] = font_patch

        alignment_aliases = {
            "align": "horizontal",
            "textAlign": "horizontal",
            "text_align": "horizontal",
            "horizontalAlign": "horizontal",
            "horizontal_align": "horizontal",
            "horizontalAlignment": "horizontal",
            "verticalAlign": "vertical",
            "vertical_align": "vertical",
            "verticalAlignment": "vertical",
        }
        alignment_patch = (
            dict(normalized["alignment"]) if isinstance(normalized.get("alignment"), dict) else {}
        )
        for source_key, target_key in alignment_aliases.items():
            if source_key in normalized and target_key not in alignment_patch:
                alignment_patch[target_key] = normalized.pop(source_key)
        if alignment_patch:
            normalized["alignment"] = alignment_patch

        fill_patch = dict(normalized["fill"]) if isinstance(normalized.get("fill"), dict) else {}
        for source_key in (
            "fillColor",
            "fill_color",
            "backgroundColor",
            "background_color",
        ):
            if source_key in normalized and "color" not in fill_patch:
                fill_patch["color"] = normalized.pop(source_key)
        if "fillOpacity" in normalized and "opacity" not in fill_patch:
            fill_patch["opacity"] = normalized.pop("fillOpacity")
        if "fill_opacity" in normalized and "opacity" not in fill_patch:
            fill_patch["opacity"] = normalized.pop("fill_opacity")
        if fill_patch:
            normalized["fill"] = fill_patch

        stroke_patch = (
            dict(normalized["stroke"]) if isinstance(normalized.get("stroke"), dict) else {}
        )
        for source_key in ("strokeColor", "stroke_color", "borderColor", "border_color"):
            if source_key in normalized and "color" not in stroke_patch:
                stroke_patch["color"] = normalized.pop(source_key)
        for source_key in ("strokeWidth", "stroke_width", "borderWidth", "border_width"):
            if source_key in normalized and "width" not in stroke_patch:
                stroke_patch["width"] = normalized.pop(source_key)
        if "strokeOpacity" in normalized and "opacity" not in stroke_patch:
            stroke_patch["opacity"] = normalized.pop("strokeOpacity")
        if "stroke_opacity" in normalized and "opacity" not in stroke_patch:
            stroke_patch["opacity"] = normalized.pop("stroke_opacity")
        if stroke_patch:
            normalized["stroke"] = stroke_patch
        return normalized


class UpdateSlideComponentInput(OpenAIStrictSchemaModel):
    index: int = Field(..., ge=0, le=1000)
    component_id: str = Field(..., alias="componentId", min_length=1, max_length=120)
    position: SlideElementPositionInput | None = Field(
        ...,
        description="Optional component position update for move requests.",
    )
    size: SlideElementSizeInput | None = Field(
        ...,
        description=(
            "Optional target bounds for resize/shrink/grow requests. The component's "
            "contained elements scale to these bounds; component JSON does not store size."
        ),
    )

    model_config = ConfigDict(extra="forbid", strict=True, populate_by_name=True)


class DeleteSlideComponentInput(StrictSchemaModel):
    index: int = Field(ge=0, le=1000)
    component_id: str = Field(alias="componentId", min_length=1, max_length=120)

    model_config = ConfigDict(extra="forbid", strict=True, populate_by_name=True)


class DeleteSlideElementInput(StrictSchemaModel):
    index: int = Field(ge=0, le=1000)
    element_path: str = Field(alias="elementPath", min_length=1, max_length=500)

    model_config = ConfigDict(extra="forbid", strict=True, populate_by_name=True)


class AddElementInput(OpenAIStrictSchemaModel):
    index: int = Field(..., ge=0, le=1000)
    element: str = Field(
        ...,
        min_length=2,
        max_length=120000,
        description=(
            "A JSON-serialized rendered UI element object. Use 1280 x 720 stage "
            "pixels and keep new free-component geometry fully inside that window."
        ),
    )
    component_id: str | None = Field(
        ...,
        alias="componentId",
        min_length=1,
        max_length=120,
        description="Optional target component id. Use null to add as a new free component.",
    )
    insert_index: int | None = Field(
        ...,
        alias="insertIndex",
        ge=0,
        le=1000,
        description="Zero-based insert position. Use null to append.",
    )

    model_config = ConfigDict(extra="forbid", strict=True, populate_by_name=True)


class AddSlideComponentInput(OpenAIStrictSchemaModel):
    index: int = Field(..., ge=0, le=1000)
    component: str = Field(
        ...,
        min_length=2,
        max_length=200000,
        description=(
            "A JSON-serialized component object to add to the slide: "
            '{"id": "...", "description": "...", "position": {"x": 128, "y": 120}, '
            '"elements": [ ... ]}. Do not include component size; child element '
            "bounds define the component bounds. "
            "Use 1280 x 720 stage pixels, not normalized 0-1 values, and keep "
            "position and derived bounds fully inside that visible window. "
            "Copy the shape of an existing component from getAvailableBlocks or "
            "getSlideAtIndex(includeFullContent=true)."
        ),
    )
    source_block_id: str | None = Field(
        ...,
        alias="sourceBlockId",
        min_length=1,
        max_length=300,
        description=(
            "Block id returned by getAvailableBlocks when this component is adapted "
            "from a reusable block. Required for table/chart component additions "
            "when a matching reusable block exists, and preferred for styled "
            "title/header/card/metric/text additions when a matching block exists."
        ),
    )
    insert_index: int | None = Field(
        ...,
        alias="insertIndex",
        ge=0,
        le=1000,
        description="Zero-based position among components. Use null to append at the end.",
    )

    model_config = ConfigDict(extra="forbid", strict=True, populate_by_name=True)


class UpdateComponentInput(OpenAIStrictSchemaModel):
    index: int = Field(..., ge=0, le=1000)
    component_id: str = Field(..., alias="componentId", min_length=1, max_length=120)
    action: (
        Literal[
            "update",
            "group",
            "ungroup",
            "duplicate",
            "bring-to-front",
            "bring-forward",
            "send-backward",
            "send-to-back",
            "bringToFront",
            "bringForward",
            "sendBackward",
            "sendToBack",
        ]
        | None
    ) = Field(
        ...,
        description=(
            "Use update for move/resize/replace, group to combine components, "
            "ungroup to split one component, duplicate to copy a component, or "
            "a layer action to reorder it."
        ),
    )
    component_ids: list[str] | None = Field(
        ...,
        alias="componentIds",
        min_length=2,
        max_length=20,
        description=(
            "Component ids to group. Include componentId in this list; ignored for "
            "update and ungroup."
        ),
    )
    position: SlideElementPositionInput | None = Field(
        ...,
        description="Optional component position update for move requests.",
    )
    size: SlideElementSizeInput | None = Field(
        ...,
        description=(
            "Optional target bounds for resize/shrink/grow requests. The component's "
            "contained elements scale to these bounds; component JSON does not store size."
        ),
    )
    component: str | None = Field(
        ...,
        min_length=2,
        max_length=200000,
        description="Optional JSON-serialized replacement component.",
    )

    model_config = ConfigDict(extra="forbid", strict=True, populate_by_name=True)


class ThemeTextFontInput(OpenAIStrictSchemaModel):
    name: str | None = Field(..., min_length=1, max_length=200)
    url: str | None = Field(..., min_length=1, max_length=2000)


class ThemeFontsInput(OpenAIStrictSchemaModel):
    textFont: ThemeTextFontInput | None = Field(...)


class ThemeColorsInput(OpenAIStrictSchemaModel):
    primary: str | None = Field(..., min_length=4, max_length=16)
    background: str | None = Field(..., min_length=4, max_length=16)
    card: str | None = Field(..., min_length=4, max_length=16)
    stroke: str | None = Field(..., min_length=4, max_length=16)
    primary_text: str | None = Field(..., min_length=4, max_length=16)
    background_text: str | None = Field(..., min_length=4, max_length=16)
    graph_0: str | None = Field(..., min_length=4, max_length=16)
    graph_1: str | None = Field(..., min_length=4, max_length=16)
    graph_2: str | None = Field(..., min_length=4, max_length=16)
    graph_3: str | None = Field(..., min_length=4, max_length=16)
    graph_4: str | None = Field(..., min_length=4, max_length=16)
    graph_5: str | None = Field(..., min_length=4, max_length=16)
    graph_6: str | None = Field(..., min_length=4, max_length=16)
    graph_7: str | None = Field(..., min_length=4, max_length=16)
    graph_8: str | None = Field(..., min_length=4, max_length=16)
    graph_9: str | None = Field(..., min_length=4, max_length=16)


class CustomThemeDataInput(OpenAIStrictSchemaModel):
    name: str | None = Field(..., min_length=1, max_length=200)
    description: str | None = Field(..., min_length=1, max_length=1000)
    colors: ThemeColorsInput | None = Field(...)
    fonts: ThemeFontsInput | None = Field(...)
    textFont: ThemeTextFontInput | None = Field(...)


class CustomThemeInput(OpenAIStrictSchemaModel):
    id: str | None = Field(..., min_length=1, max_length=200)
    name: str | None = Field(..., min_length=1, max_length=200)
    description: str | None = Field(..., min_length=1, max_length=1000)
    user: str | None = Field(..., min_length=1, max_length=100)
    logo: str | None = Field(..., min_length=1, max_length=500)
    logo_url: str | None = Field(
        ...,
        alias="logoUrl",
        min_length=1,
        max_length=2000,
    )
    company_name: str | None = Field(
        ...,
        alias="companyName",
        min_length=1,
        max_length=200,
    )
    data: CustomThemeDataInput | None = Field(...)
    colors: ThemeColorsInput | None = Field(...)
    fonts: ThemeFontsInput | None = Field(...)
    textFont: ThemeTextFontInput | None = Field(...)

    model_config = ConfigDict(extra="forbid", strict=True, populate_by_name=True)


class SetPresentationThemeInput(OpenAIStrictSchemaModel):
    theme: str | None = Field(
        ...,
        min_length=1,
        max_length=200,
        description=(
            "Theme target requested by the user (e.g., 'dark', "
            "'professional-dark', 'light rose', or 'another'). Optional "
            "when customTheme is provided."
        ),
    )
    custom_theme: CustomThemeInput | None = Field(
        ...,
        alias="customTheme",
        description=(
            "Optional custom theme payload. Supports minimal colors/fonts payloads or "
            "a full theme object using only declared keys such as id, name, description, "
            "data.colors, and data.fonts.textFont."
        ),
    )
    save_custom_theme: bool | None = Field(
        ...,
        alias="saveCustomTheme",
        description=(
            "When customTheme is provided, persist it into local custom themes for reuse."
        ),
    )

    model_config = ConfigDict(extra="forbid", strict=True, populate_by_name=True)

    @model_validator(mode="after")
    def validate_theme_request(self) -> "SetPresentationThemeInput":
        if self.save_custom_theme is None:
            object.__setattr__(self, "save_custom_theme", True)
        if self.theme is None and self.custom_theme is None:
            raise ValueError("Either 'theme' or 'customTheme' must be provided.")
        return self
