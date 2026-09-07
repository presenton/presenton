"""Pydantic models matching the frontend slide element types."""

from __future__ import annotations

from enum import Enum
from typing import Annotated, Any, Literal, TypeAlias

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from utils.chart_semantics import coerce_chart_type_for_categories
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
        raise ValueError(f"{min_name} must equal half of {max_name}, rounded up ({expected_min})")


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
    horizontal: HorizontalAlignment | None = None
    vertical: VerticalAlignment | None = None


class Font(BaseModel):
    size: float | None = None
    family: str | None = None
    color: str | None = None
    bold: bool | None = None
    italic: bool | None = None
    underline: bool | None = None
    line_height: float | None = None
    letter_spacing: float | None = None
    ellipsis: bool | None = None
    opacity: float | None = None


class Fill(BaseModel):
    color: str
    opacity: float | None = None


class Stroke(BaseModel):
    color: str
    opacity: float | None = None
    width: float
    dash: list[float] | None = None


class BorderRadius(BaseModel):
    tl: float
    tr: float
    bl: float
    br: float


class Shadow(BaseModel):
    color: str
    blur: float | None = None
    opacity: float | None = None
    offset_x: float | None = None
    offset_y: float | None = None


class ChartSeries(BaseModel):
    name: str
    values: list[float]


class TextRun(BaseModel):
    text: str
    font: Font | None = None

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
    font: Font | None = None


TextRunValue: TypeAlias = TextRun | LatexTextRun


class Text(BaseModel):
    type: Literal["text"]
    position: Position | None = None
    size: Size | None = None
    rotation: float | None = None
    font: Font | None = None
    alignment: Alignment | None = None
    fill: Fill | None = None
    stroke: Stroke | None = None
    shadow: Shadow | None = None
    runs: list[TextRunValue]

    # Schema
    decorative: bool
    name: str
    max_length: int
    min_length: int


class Container(BaseModel):  # Konva Group
    type: Literal["container"]
    position: Position | None = None
    size: Size | None = None
    rotation: float | None = None
    alignment: Alignment | None = None
    fill: Fill | None = None
    stroke: Stroke | None = None
    border_radius: BorderRadius | None = None
    shadow: Shadow | None = None
    padding: Padding | None = None
    child: SlideElement | None = None


class Image(BaseModel):  # Konva Image
    type: Literal["image"]
    position: Position | None = None
    size: Size | None = None
    rotation: float | None = None
    flip_h: bool | None = None
    flip_v: bool | None = None
    opacity: float | None = None
    data: str
    fit: ImageFit | None = None
    focus_x: float | None = None
    focus_y: float | None = None
    crop_scale: float | None = None
    border_radius: BorderRadius | None = None
    clip_path: str | None = None
    color: str | None = None

    # Schema
    decorative: bool
    name: str
    prompt: str | None = None
    is_icon: bool
    icon_type: IconType | None = None


class TextList(BaseModel):  # Konva Group
    type: Literal["text-list"]
    position: Position | None = None
    size: Size | None = None
    rotation: float | None = None
    font: Font | None = None
    marker: Marker | None = None
    # gap/marker_gap — новый апстримовый контроль отступов списков
    gap: float | None = None
    marker_gap: float | None = None
    items: list[list[TextRunValue]]

    # Schema
    decorative: bool
    name: str
    max_items: int
    min_items: int
    max_item_length: int
    min_item_length: int


class TableCell(BaseModel):
    color: Fill | None = None
    font: Font | None = None
    alignment: HorizontalAlignment | None = None
    runs: list[TextRunValue]


class Table(BaseModel):
    type: Literal["table"]
    position: Position | None = None
    size: Size | None = None
    rotation: float | None = None
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
    tension: float | None = Field(default=None, ge=0, le=1)
    segments: int | None = Field(default=16, ge=1, le=96)


class Vector(BaseModel):
    type: Literal["vector"]
    shape: VectorShape | None = None
    points: list[Position] = Field(min_length=2)
    closed: bool | None = None
    curve: VectorCurve | None = None
    corner_radii: list[Annotated[float, Field(ge=0)]] | None = None
    start_marker: VectorMarker | None = None
    end_marker: VectorMarker | None = None
    rotation: float | None = None
    opacity: float | None = None
    fill: Fill | None = None
    stroke: Stroke | None = None
    shadow: Shadow | None = None


class Chart(BaseModel):
    type: Literal["chart"]
    position: Position | None = None
    size: Size | None = None
    rotation: float | None = None
    chart_type: ChartType
    title: str | None = None
    title_color: str | None = None
    legend_color: str | None = None
    # text_color — новая апстримовая настройка цвета текста диаграммы
    text_color: str | None = None

    # PPTX chart model emitted by the template-v2 converter.
    colors: list[str] | None = None
    x_axis: bool | None = None
    y_axis: bool | None = None
    x_axis_title: str | None = None
    y_axis_title: str | None = None
    axis_color: str | None = None
    categories: list[str] | None = None
    series: list[ChartSeries] | None = None
    data_labels: DataLabelPosition | None = None
    legend: bool | None = None
    x_axis_grid: bool | None = None
    y_axis_grid: bool | None = None
    grid_color: str | None = None
    source: str | None = None

    # Schema
    decorative: bool
    name: str

    @model_validator(mode="after")
    def _pie_and_donut_use_only_first_series(self) -> Chart:
        if (
            self.chart_type in {ChartType.PIE, ChartType.DONUT}
            and self.series
            and len(self.series) > 1
        ):
            self.series = self.series[:1]
        return self

    @model_validator(mode="after")
    def _temporal_categories_require_line_chart(self) -> Chart:
        # Bar/pie по временным рядам (годы, даты, месяцы) — частая ошибка
        # генерации и зашитых шаблонов; семантический анализатор переводит
        # такой график в line на границе схемы.
        corrected = coerce_chart_type_for_categories(
            self.chart_type.value,
            self.categories,
        )
        if corrected:
            self.chart_type = ChartType(corrected)
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
    def _size_must_be_visible_when_explicit(self) -> Chart:
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
    VERTICAL_FUNNEL = "vertical_funnel"
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
    model_config = ConfigDict(extra="forbid")

    type: Literal["progress_bar"]
    max_value: float
    min_value: float
    value: float

    @model_validator(mode="after")
    def _validate_range(self) -> ProgressBarInfographicData:
        if self.max_value <= self.min_value:
            raise ValueError("max_value must be greater than min_value")
        return self


class GaugeInfographicData(BaseModel):
    model_config = ConfigDict(extra="forbid")

    type: Literal["gauge"]
    max_value: float
    min_value: float
    value: float

    @model_validator(mode="after")
    def _validate_range(self) -> GaugeInfographicData:
        if self.max_value <= self.min_value:
            raise ValueError("max_value must be greater than min_value")
        return self


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
    "vertical_funnel",
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


InfographicData = Annotated[
    ProgressBarInfographicData | GaugeInfographicData | StructuralInfographicData,
    Field(discriminator="type"),
]


class Infographic(BaseModel):
    type: Literal["infographic"]
    position: Position | None = None
    size: Size | None = None
    rotation: float | None = None
    # Инфографика из каталога (StructuralInfographicData extra="allow")
    # покрывает и старые типы progress_bar/gauge — единый union апстрима.
    data: InfographicData

    # Design
    colors: list[str] = Field(default_factory=list)
    text_color: str | None = None

    # Schema
    decorative: bool
    name: str


class Flex(BaseModel):
    type: Literal["flex"]
    position: Position | None = None
    size: Size | None = None
    rotation: float | None = None
    direction: FlexDirection
    wrap: bool | None = None
    align_items: LayoutAlignment | None = None
    justify_content: LayoutAlignment | None = None
    gap: float | None = None
    column_gap: float | None = None
    row_gap: float | None = None
    children: list[SlideElement]

    # Schema
    name: str
    max_children: int
    min_children: int


class Grid(BaseModel):
    type: Literal["grid"]
    position: Position | None = None
    size: Size | None = None
    rotation: float | None = None
    columns: int
    rows: int | None = None
    gap: float | None = None
    column_gap: float | None = None
    row_gap: float | None = None
    align_items: LayoutAlignment | None = None
    justify_items: LayoutAlignment | None = None
    children: list[SlideElement]

    # Schema
    name: str
    max_children: int
    min_children: int


class Group(BaseModel):
    type: Literal["group"]
    position: Position | None = None
    size: Size | None = None
    children: list[SlideElement]

    # Schema
    name: str


SlideElement: TypeAlias = Annotated[
    Text
    | Container
    | Image
    | TextList
    | Table
    | Vector
    | Chart
    | Infographic
    | Flex
    | Grid
    | Group,
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
    "InfographicData",
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
