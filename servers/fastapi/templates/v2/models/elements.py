"""Pydantic models matching the frontend slide element types."""

from __future__ import annotations

from enum import Enum
from typing import Annotated, Any, Literal, Optional, TypeAlias, Union, List

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from utils.infographic_catalog import normalize_infographic_data


def _validate_min_max(
    min_value: int | None,
    max_value: int | None,
    *,
    min_name: str,
    max_name: str,
) -> None:
    if min_value is None or max_value is None:
        return

    expected_min = (max_value + 1) // 2
    if min_value != expected_min:
        raise ValueError(
            f"{min_name} must equal half of {max_name}, rounded up ({expected_min})"
        )


class HorizontalAlignment(str, Enum):
    LEFT = "left"
    CENTER = "center"
    RIGHT = "right"
    JUSTIFY = "justify"


class VerticalAlignment(str, Enum):
    TOP = "top"
    MIDDLE = "middle"
    BOTTOM = "bottom"


class LayoutAlignment(str, Enum):
    FLEX_START = "flex-start"
    FLEX_END = "flex-end"
    CENTER = "center"
    STRETCH = "stretch"


class Marker(str, Enum):
    BULLET = "bullet"
    NUMBER = "number"
    NONE = "none"


class FlexDirection(str, Enum):
    ROW = "row"
    COLUMN = "column"


class ImageFit(str, Enum):
    CONTAIN = "contain"
    COVER = "cover"
    FILL = "fill"


class IconType(str, Enum):
    BOLD = "bold"
    DUOTONE = "duotone"
    FILL = "fill"
    LIGHT = "light"
    REGULAR = "regular"
    THIN = "thin"


class ChartType(str, Enum):
    BAR = "bar"
    HORIZONTAL_BAR = "horizontal_bar"
    LINE = "line"
    AREA = "area"
    PIE = "pie"
    DONUT = "donut"
    STACKED_BAR = "stacked_bar"
    HORIZONTAL_STACKED_BAR = "horizontal_stacked_bar"
    SCATTER = "scatter"
    RADAR = "radar"
    POLAR_AREA = "polar_area"


class DataLabelPosition(str, Enum):
    BASE = "base"
    MID = "mid"
    TOP = "top"
    OUTSIDE = "outside"


class Position(BaseModel):
    x: float
    y: float


class Size(BaseModel):
    width: float
    height: float


class Padding(BaseModel):
    top: float
    right: float
    bottom: float
    left: float


class Alignment(BaseModel):
    horizontal: Optional[HorizontalAlignment] = None
    vertical: Optional[VerticalAlignment] = None


class Font(BaseModel):
    size: Optional[float] = None
    family: Optional[str] = None
    color: Optional[str] = None
    bold: Optional[bool] = None
    italic: Optional[bool] = None
    underline: Optional[bool] = None
    line_height: Optional[float] = None
    letter_spacing: Optional[float] = None
    ellipsis: Optional[bool] = None
    opacity: Optional[float] = None


class Fill(BaseModel):
    color: str
    opacity: Optional[float] = None


class Stroke(BaseModel):
    color: str
    opacity: Optional[float] = None
    width: float
    dash: Optional[list[float]] = None


class BorderRadius(BaseModel):
    tl: float
    tr: float
    bl: float
    br: float


class Shadow(BaseModel):
    color: str
    blur: Optional[float] = None
    opacity: Optional[float] = None
    offset_x: Optional[float] = None
    offset_y: Optional[float] = None


class ChartSeries(BaseModel):
    name: str
    values: list[float]


class TextRun(BaseModel):
    text: str
    font: Optional[Font] = None

    @model_validator(mode="before")
    @classmethod
    def _reject_non_text_run_types(cls, value):
        if isinstance(value, dict) and value.get("type") not in {None, "text"}:
            raise ValueError("Text runs may only use type='text'")
        return value


class LatexTextRun(BaseModel):
    type: Literal["latex"]
    latex: str = Field(min_length=1, max_length=4000)
    display_mode: bool = False
    font: Optional[Font] = None


TextRunValue: TypeAlias = Union[TextRun, LatexTextRun]


class Text(BaseModel):
    type: Literal["text"]
    position: Optional[Position] = None
    size: Optional[Size] = None
    rotation: Optional[float] = None
    font: Optional[Font] = None
    alignment: Optional[Alignment] = None
    fill: Optional[Fill] = None
    stroke: Optional[Stroke] = None
    shadow: Optional[Shadow] = None
    runs: list[TextRunValue]

    # Schema
    decorative: bool
    name: str
    max_length: int
    min_length: int


class Container(BaseModel):  # Konva Group
    type: Literal["container"]
    position: Optional[Position] = None
    size: Optional[Size] = None
    rotation: Optional[float] = None
    alignment: Optional[Alignment] = None
    fill: Optional[Fill] = None
    stroke: Optional[Stroke] = None
    border_radius: Optional[BorderRadius] = None
    shadow: Optional[Shadow] = None
    padding: Optional[Padding] = None
    child: Optional[SlideElement] = None


class Image(BaseModel):  # Konva Image
    type: Literal["image"]
    position: Optional[Position] = None
    size: Optional[Size] = None
    rotation: Optional[float] = None
    flip_h: Optional[bool] = None
    flip_v: Optional[bool] = None
    opacity: Optional[float] = None
    data: str
    fit: Optional[ImageFit] = None
    focus_x: Optional[float] = None
    focus_y: Optional[float] = None
    crop_scale: Optional[float] = None
    border_radius: Optional[BorderRadius] = None
    clip_path: Optional[str] = None
    color: Optional[str] = None

    # Schema
    decorative: bool
    name: str
    prompt: Optional[str] = None
    is_icon: bool
    icon_type: Optional[IconType] = None


class TextList(BaseModel):  # Konva Group
    type: Literal["text-list"]
    position: Optional[Position] = None
    size: Optional[Size] = None
    rotation: Optional[float] = None
    font: Optional[Font] = None
    marker: Optional[Marker] = None
    items: list[list[TextRunValue]]

    # Schema
    decorative: bool
    name: str
    max_items: int
    min_items: int
    max_item_length: int
    min_item_length: int


class TableCell(BaseModel):
    color: Optional[Fill] = None
    font: Optional[Font] = None
    alignment: Optional[HorizontalAlignment] = None
    runs: List[TextRunValue]


class Table(BaseModel):
    type: Literal["table"]
    position: Optional[Position] = None
    size: Optional[Size] = None
    rotation: Optional[float] = None
    columns: list[TableCell]
    rows: list[list[TableCell]]

    # Schema
    decorative: bool
    name: str
    max_columns: int
    min_columns: int
    max_rows: int
    min_rows: int


class VectorShape(str, Enum):
    POLYGON = "polygon"
    ELLIPSE = "ellipse"


class VectorMarker(str, Enum):
    NONE = "none"
    ARROW = "arrow"
    STEALTH = "stealth"
    TRIANGLE = "triangle"
    CIRCLE = "circle"
    SQUARE = "square"
    DIAMOND = "diamond"


class VectorCurve(BaseModel):
    type: Literal["smooth"]
    tension: Optional[float] = Field(default=None, ge=0, le=1)
    segments: Optional[int] = Field(default=16, ge=1, le=96)


class Vector(BaseModel):
    type: Literal["vector"]
    shape: Optional[VectorShape] = None
    points: list[Position] = Field(min_length=2)
    closed: Optional[bool] = None
    curve: Optional[VectorCurve] = None
    corner_radii: Optional[list[Annotated[float, Field(ge=0)]]] = None
    start_marker: Optional[VectorMarker] = None
    end_marker: Optional[VectorMarker] = None
    rotation: Optional[float] = None
    opacity: Optional[float] = None
    fill: Optional[Fill] = None
    stroke: Optional[Stroke] = None
    shadow: Optional[Shadow] = None


class Chart(BaseModel):
    type: Literal["chart"]
    position: Optional[Position] = None
    size: Optional[Size] = None
    rotation: Optional[float] = None
    chart_type: ChartType
    title: Optional[str] = None
    title_color: Optional[str] = None
    legend_color: Optional[str] = None

    # PPTX chart model emitted by the template-v2 converter.
    colors: Optional[list[str]] = None
    x_axis: Optional[bool] = None
    y_axis: Optional[bool] = None
    x_axis_title: Optional[str] = None
    y_axis_title: Optional[str] = None
    axis_color: Optional[str] = None
    categories: Optional[list[str]] = None
    series: Optional[list[ChartSeries]] = None
    data_labels: Optional[DataLabelPosition] = None
    legend: Optional[bool] = None
    x_axis_grid: Optional[bool] = None
    y_axis_grid: Optional[bool] = None
    grid_color: Optional[str] = None
    source: Optional[str] = None

    # Schema
    decorative: bool
    name: str

    @model_validator(mode="after")
    def _pie_and_donut_use_only_first_series(self) -> "Chart":
        if (
            self.chart_type in {ChartType.PIE, ChartType.DONUT}
            and self.series
            and len(self.series) > 1
        ):
            self.series = self.series[:1]
        return self

    @field_validator("data_labels", mode="before")
    @classmethod
    def _coerce_legacy_data_labels(cls, value: object) -> object:
        if value is True:
            return DataLabelPosition.TOP
        if value is False or value is None:
            return None
        if isinstance(value, str):
            normalized = value.strip().lower()
            if normalized in {position.value for position in DataLabelPosition}:
                return normalized
        return value

    @model_validator(mode="after")
    def _size_must_be_visible_when_explicit(self) -> "Chart":
        if self.size is None:
            return self
        if self.size.width < 80 or self.size.height < 60:
            raise ValueError("chart size must be at least 80x60 px")
        return self


class InfographicType(str, Enum):
    PROGRESS_BAR = "progress_bar"
    GAUGE = "gauge"
    GANTT = "gantt"
    TIMELINE = "timeline"
    ROADMAP = "roadmap"
    MILESTONE_TIMELINE = "milestone_timeline"
    STAIRCASE = "staircase"
    SUPPLY_CHAIN = "supply_chain"
    STAIR_STEP_BLOCKS = "stair_step_blocks"
    MATURITY_MODEL = "maturity_model"
    PILLAR_FRAMEWORK = "pillar_framework"
    TRANSFORMATION_HUB = "transformation_hub"
    DIAGONAL_CIRCLES = "diagonal_circles"
    RISK_MATRIX = "risk_matrix"
    CHEVRON_PROCESS = "chevron_process"
    RADIAL_CYCLE = "radial_cycle"
    CONVERSION_FUNNEL = "conversion_funnel"
    PYRAMID = "pyramid"
    SEGMENTED_WHEEL = "segmented_wheel"
    CUSTOMER_JOURNEY = "customer_journey"
    BEFORE_AFTER = "before_after"
    IMPACT_EFFORT_MATRIX = "impact_effort_matrix"
    COMPARISON_MATRIX = "comparison_matrix"
    ORG_CHART = "org_chart"
    DECISION_TREE = "decision_tree"
    MIND_MAP = "mind_map"


class ProgressBarInfographicData(BaseModel):
    type: Literal["progress_bar"]
    max_value: float
    min_value: float
    value: float


class GaugeInfographicData(BaseModel):
    type: Literal["gauge"]
    max_value: float
    min_value: float
    value: float


StructuralInfographicType = Literal[
    "gantt",
    "timeline",
    "roadmap",
    "milestone_timeline",
    "staircase",
    "supply_chain",
    "stair_step_blocks",
    "maturity_model",
    "pillar_framework",
    "transformation_hub",
    "diagonal_circles",
    "risk_matrix",
    "chevron_process",
    "radial_cycle",
    "conversion_funnel",
    "pyramid",
    "segmented_wheel",
    "customer_journey",
    "before_after",
    "impact_effort_matrix",
    "comparison_matrix",
    "org_chart",
    "decision_tree",
    "mind_map",
]


class StructuralInfographicData(BaseModel):
    type: StructuralInfographicType

    model_config = ConfigDict(extra="allow")

    @model_validator(mode="before")
    @classmethod
    def validate_structural_data(cls, value: Any) -> Any:
        if not isinstance(value, dict):
            return value
        infographic_type = value.get("type")
        if not isinstance(infographic_type, str):
            return value
        return normalize_infographic_data(infographic_type, value)  # type: ignore[arg-type]


class Infographic(BaseModel):
    type: Literal["infographic"]
    position: Optional[Position] = None
    size: Optional[Size] = None
    rotation: Optional[float] = None
    data: Annotated[
        Union[
            ProgressBarInfographicData,
            GaugeInfographicData,
            StructuralInfographicData,
        ],
        Field(discriminator="type"),
    ]

    # Design
    colors: List[str] = Field(default_factory=list)
    text_color: Optional[str] = None

    # Schema
    decorative: bool
    name: str


class Flex(BaseModel):
    type: Literal["flex"]
    position: Optional[Position] = None
    size: Optional[Size] = None
    rotation: Optional[float] = None
    direction: FlexDirection
    wrap: Optional[bool] = None
    align_items: Optional[LayoutAlignment] = None
    justify_content: Optional[LayoutAlignment] = None
    gap: Optional[float] = None
    column_gap: Optional[float] = None
    row_gap: Optional[float] = None
    children: list[SlideElement]

    # Schema
    name: str
    max_children: int
    min_children: int


class Grid(BaseModel):
    type: Literal["grid"]
    position: Optional[Position] = None
    size: Optional[Size] = None
    rotation: Optional[float] = None
    columns: int
    rows: Optional[int] = None
    gap: Optional[float] = None
    column_gap: Optional[float] = None
    row_gap: Optional[float] = None
    align_items: Optional[LayoutAlignment] = None
    justify_items: Optional[LayoutAlignment] = None
    children: list[SlideElement]

    # Schema
    name: str
    max_children: int
    min_children: int


class Group(BaseModel):
    type: Literal["group"]
    position: Optional[Position] = None
    size: Optional[Size] = None
    children: list[SlideElement]

    # Schema
    name: str


SlideElement: TypeAlias = Annotated[
    Union[
        Text,
        Container,
        Image,
        TextList,
        Table,
        Vector,
        Chart,
        Infographic,
        Flex,
        Grid,
        Group,
    ],
    Field(discriminator="type"),
]


for _model in (Container, Flex, Grid, Group):
    _model.model_rebuild()


__all__ = [
    "Alignment",
    "BorderRadius",
    "Chart",
    "ChartSeries",
    "ChartType",
    "Container",
    "Fill",
    "Flex",
    "FlexDirection",
    "Font",
    "Grid",
    "HorizontalAlignment",
    "Image",
    "ImageFit",
    "IconType",
    "Infographic",
    "InfographicType",
    "GaugeInfographicData",
    "LayoutAlignment",
    "LatexTextRun",
    "Marker",
    "Padding",
    "Position",
    "ProgressBarInfographicData",
    "StructuralInfographicData",
    "StructuralInfographicType",
    "Shadow",
    "Size",
    "SlideElement",
    "Group",
    "Stroke",
    "Table",
    "TableCell",
    "Text",
    "TextList",
    "TextRun",
    "TextRunValue",
    "VerticalAlignment",
    "Vector",
    "VectorCurve",
    "VectorMarker",
    "VectorShape",
]
