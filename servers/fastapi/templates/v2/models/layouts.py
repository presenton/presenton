from __future__ import annotations

from typing import Annotated, Any, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from utils.icon_weights import IconType

from .elements import (
    ChartSeries,
    ChartType,
    DataLabelPosition,
    Fill,
    Font,
    HorizontalAlignment,
    InfographicData,
    Marker,
    Position,
    Size,
    SlideElement,
)


SemanticElementPath = Annotated[
    str,
    Field(
        min_length=10,
        max_length=240,
        pattern=r"^elements\.\d+(?:\.(?:child|children\.\d+))*$",
    ),
]
HexColor = Annotated[str, Field(pattern=r"^#[0-9A-Fa-f]{6}$")]


class RawSlideLayout(BaseModel):
    id: str
    description: str
    elements: list[SlideElement]


class RawSlideLayouts(BaseModel):
    layouts: list[RawSlideLayout]


class Component(BaseModel):
    id: str
    description: str
    position: Position
    elements: list[SlideElement] = Field(min_length=1)


class SimilarComponents(BaseModel):
    model_config = ConfigDict(extra="forbid")

    indices: list[int] = Field(min_length=1)

    @model_validator(mode="after")
    def _indices_must_be_unique_and_non_negative(self) -> "SimilarComponents":
        if any(index < 0 for index in self.indices):
            raise ValueError("similar component indices must be non-negative")
        if len(self.indices) != len(set(self.indices)):
            raise ValueError("similar component indices must be unique")
        return self


class SimilarComponentsList(BaseModel):
    model_config = ConfigDict(extra="forbid")

    similar_components: list[SimilarComponents]


class MergedComponent(BaseModel):
    id: str
    description: str
    variants: list[Component] = Field(min_length=1)


class MergedComponents(BaseModel):
    components: list[MergedComponent]

    @model_validator(mode="after")
    def _component_ids_must_be_unique(self) -> "MergedComponents":
        ids = [component.id for component in self.components]
        if len(ids) != len(set(ids)):
            raise ValueError("merged component ids must be unique")
        return self


class SlideLayout(BaseModel):
    id: str
    description: str
    components: list[Component]

    @model_validator(mode="after")
    def _component_ids_must_be_unique(self) -> "SlideLayout":
        ids = [component.id for component in self.components]
        if len(ids) != len(set(ids)):
            raise ValueError("component ids must be unique within a slide layout")
        return self


class SlideLayouts(BaseModel):
    layouts: list[SlideLayout] = Field(min_length=1)

    @model_validator(mode="after")
    def _layout_ids_must_be_unique(self) -> "SlideLayouts":
        ids = [layout.id for layout in self.layouts]
        if len(ids) != len(set(ids)):
            raise ValueError("slide layout ids must be unique")
        return self


class SemanticElementAnnotation(BaseModel):
    """Semantic metadata for one existing source element."""

    model_config = ConfigDict(extra="forbid")

    path: SemanticElementPath
    name: str = Field(
        min_length=1,
        max_length=80,
        pattern=r"^[a-z][a-z0-9_]*$",
    )
    decorative: bool
    is_icon: bool | None = Field(
        default=None,
        description="Whether an annotated image is a replaceable icon rather than a content image.",
    )
    color: HexColor | None = Field(
        default=None,
        description="Visible foreground color of a replaceable icon, or null for non-icons.",
    )
    icon_type: IconType | None = Field(
        default=None,
        description=(
            "Visible icon style: bold, duotone, fill, light, regular, or thin; "
            "null for non-icons."
        ),
    )


class VisualReplacementGeometry(BaseModel):
    """Detected structured-content bounds in the candidate's coordinate space."""

    model_config = ConfigDict(extra="forbid")

    position: Position
    size: Size


class VisualChartReplacement(VisualReplacementGeometry):
    """One image or grouped visual region recognized as a quantitative chart."""

    model_config = ConfigDict(extra="forbid")

    kind: Literal["chart"]
    path: SemanticElementPath
    chart_type: ChartType
    title: str | None
    title_color: HexColor | None
    legend_color: HexColor | None
    text_color: HexColor | None = Field(
        description="Data-label and general chart text color."
    )
    colors: list[HexColor] = Field(
        min_length=1,
        max_length=24,
        description=(
            "Renderer-ordered mark palette: slices/categories for category-colored "
            "single-series charts, otherwise series order."
        ),
    )
    x_axis: bool
    y_axis: bool
    x_axis_title: str | None
    y_axis_title: str | None
    axis_color: HexColor | None
    categories: list[str] = Field(min_length=1, max_length=24)
    series: list[ChartSeries] = Field(min_length=1, max_length=12)
    data_labels: DataLabelPosition | None
    legend: bool
    x_axis_grid: bool
    y_axis_grid: bool
    grid_color: HexColor | None
    source: str | None

    @model_validator(mode="after")
    def _chart_data_must_be_rectangular(self) -> "VisualChartReplacement":
        if any(len(series.values) != len(self.categories) for series in self.series):
            raise ValueError("chart series values must match categories")
        if (
            self.chart_type in {ChartType.PIE, ChartType.DONUT}
            and len(self.series) != 1
        ):
            raise ValueError("pie and donut replacements must contain one series")
        return self


class VisualInfographicReplacement(VisualReplacementGeometry):
    """One complete infographic image or grouped bounded metric region."""

    model_config = ConfigDict(extra="forbid")

    kind: Literal["infographic"]
    path: SemanticElementPath
    data: InfographicData
    colors: list[HexColor] = Field(
        min_length=2,
        max_length=24,
        description=(
            "Renderer order: metric inactive/fill slots or qualitative "
            "base/background followed by ordered accents."
        ),
    )
    text_color: HexColor | None = Field(
        description="Shared external, heading, body, and label text color."
    )

    @model_validator(mode="after")
    def _metric_fields_must_be_valid(self) -> "VisualInfographicReplacement":
        if self.data.type not in {"progress_bar", "gauge"}:
            return self
        if self.text_color is not None:
            raise ValueError("metric infographic text_color must be null")
        if not self.data.min_value <= self.data.value <= self.data.max_value:
            raise ValueError("metric value must fit its declared range")
        if len(self.colors) > 8:
            raise ValueError("metric infographic colors cannot exceed eight slots")
        return self


class VisualTableCell(BaseModel):
    """Visible content and styling extracted for one table cell."""

    model_config = ConfigDict(extra="forbid")

    text: str = Field(max_length=2000)
    color: Fill | None
    font: Font | None
    alignment: HorizontalAlignment | None


class VisualTableReplacement(VisualReplacementGeometry):
    """One image or grouped visual region recognized as a table."""

    model_config = ConfigDict(extra="forbid")

    kind: Literal["table"]
    path: SemanticElementPath
    columns: list[VisualTableCell] = Field(min_length=1, max_length=24)
    rows: list[list[VisualTableCell]] = Field(max_length=40)

    @model_validator(mode="after")
    def _table_data_must_be_rectangular(self) -> "VisualTableReplacement":
        if any(len(row) != len(self.columns) for row in self.rows):
            raise ValueError("table replacement rows must match columns")
        return self


class VisualTextListReplacement(BaseModel):
    """One image or grouped visual region recognized as an ordered or unordered list."""

    model_config = ConfigDict(extra="forbid")

    kind: Literal["text-list"]
    path: SemanticElementPath
    marker: Marker
    font: Font | None
    gap: float = Field(
        ge=0,
        le=720,
        description="Vertical pixel gap between consecutive list items.",
    )
    marker_gap: float = Field(
        ge=0,
        le=1280,
        description="Horizontal pixel gap between each marker and its item text.",
    )
    items: list[Annotated[str, Field(min_length=1, max_length=2000)]] = Field(
        min_length=1,
        max_length=40,
    )

    @model_validator(mode="after")
    def _unmarked_list_has_no_marker_gap(self) -> "VisualTextListReplacement":
        if self.marker == Marker.NONE and self.marker_gap != 0:
            raise ValueError("an unmarked text list must have marker_gap=0")
        return self


VisualDataReplacement = Annotated[
    VisualChartReplacement
    | VisualInfographicReplacement
    | VisualTableReplacement
    | VisualTextListReplacement,
    Field(discriminator="kind"),
]


class VisualDataReplacementPlan(BaseModel):
    """Focused vision decisions that convert rendered regions into data elements."""

    model_config = ConfigDict(extra="forbid")

    replacements: list[VisualDataReplacement]

    @model_validator(mode="after")
    def _paths_must_be_unique_and_disjoint(self) -> "VisualDataReplacementPlan":
        paths = [replacement.path for replacement in self.replacements]
        if len(paths) != len(set(paths)):
            raise ValueError("a visual region can have at most one replacement")
        for index, path in enumerate(paths):
            prefix = f"{path}."
            if any(
                other.startswith(prefix)
                for other_index, other in enumerate(paths)
                if other_index != index
            ):
                raise ValueError("replacement regions cannot contain one another")
        return self


class SemanticComponentManifest(BaseModel):
    """References source elements without allowing the LLM to rewrite them."""

    model_config = ConfigDict(extra="forbid")

    id: str = Field(
        min_length=1,
        max_length=80,
        pattern=r"^[a-z][a-z0-9_]*$",
        description="Unique component id within this semantic slide manifest.",
    )
    description: str = Field(min_length=10, max_length=300)
    element_indices: list[int] = Field(
        min_length=1,
        description=(
            "Ascending, unique source indices assigned to this component; all "
            "components together must partition the slide source indices."
        ),
    )
    repeated_items: list[list[int]] | None = None

    @model_validator(mode="after")
    def _validate_source_references(self) -> "SemanticComponentManifest":
        if any(index < 0 for index in self.element_indices):
            raise ValueError("component element indices must be non-negative")
        if len(self.element_indices) != len(set(self.element_indices)):
            raise ValueError("component element indices must be unique")

        if self.repeated_items is None:
            return self
        if len(self.repeated_items) < 2:
            raise ValueError("repeated_items must contain at least two items")
        if any(not item for item in self.repeated_items):
            raise ValueError("repeated_items cannot contain an empty item")

        repeated_indices = [index for item in self.repeated_items for index in item]
        if len(repeated_indices) != len(set(repeated_indices)) or set(
            repeated_indices
        ) != set(self.element_indices):
            raise ValueError(
                "repeated_items must partition the component element indices"
            )
        return self


class SemanticSlideManifest(BaseModel):
    """LLM-authored intent used by the deterministic layout compiler."""

    model_config = ConfigDict(extra="forbid")

    id: str = Field(
        min_length=1,
        max_length=80,
        pattern=r"^[a-z][a-z0-9_]*$",
    )
    description: str = Field(min_length=10, max_length=300)
    components: list[SemanticComponentManifest] = Field(min_length=1)
    annotations: list[SemanticElementAnnotation]

    @model_validator(mode="after")
    def _semantic_ids_and_paths_must_be_unique(self) -> "SemanticSlideManifest":
        component_ids = [component.id for component in self.components]
        if len(component_ids) != len(set(component_ids)):
            raise ValueError("semantic component ids must be unique")

        paths = [annotation.path for annotation in self.annotations]
        if len(paths) != len(set(paths)):
            raise ValueError("semantic annotation paths must be unique")
        return self


class FlexibleFlowItemPlan(BaseModel):
    """One leaf item or nested flow reference in a flexible flow tree."""

    model_config = ConfigDict(extra="forbid")

    indices: list[int] | None = Field(
        default=None,
        description=(
            "Ascending, unique source indices for one leaf visual unit; null "
            "when flow_id is used."
        ),
    )
    flow_id: str | None = Field(
        default=None,
        min_length=1,
        max_length=80,
        pattern=r"^[a-z][a-z0-9_]*$",
        description="Nested flow id; null when indices is used.",
    )

    @model_validator(mode="after")
    def _must_reference_one_item_kind(self) -> "FlexibleFlowItemPlan":
        if (self.indices is None) == (self.flow_id is None):
            raise ValueError("flow item must contain either indices or flow_id")
        if self.indices is not None:
            if not self.indices:
                raise ValueError("flow item indices cannot be empty")
            if any(index < 0 for index in self.indices):
                raise ValueError("flow item indices must be non-negative")
            if len(self.indices) != len(set(self.indices)):
                raise ValueError("flow item indices must be unique")
        return self


class FlexibleFlowNodePlan(BaseModel):
    """One row, column, grid, or absolute group node in a flow tree."""

    model_config = ConfigDict(extra="forbid")

    id: str = Field(
        min_length=1,
        max_length=80,
        pattern=r"^[a-z][a-z0-9_]*$",
    )
    name: str = Field(
        min_length=1,
        max_length=80,
        pattern=r"^[a-z][a-z0-9_]*$",
    )
    mode: Literal["row", "column", "grid", "group"] = Field(
        description=(
            "Geometry-derived layout: row for aligned horizontal items, column "
            "for aligned vertical items, grid for regular repeated grids, or "
            "group for meaningful irregular or overlapping items."
        )
    )
    items: list[FlexibleFlowItemPlan] = Field(
        min_length=2,
        description="Two or more leaf items or nested flow references; never unary.",
    )


class FlexibleRegionPlan(BaseModel):
    """A validated nested flow tree for one semantic component."""

    model_config = ConfigDict(extra="forbid")

    component_id: str = Field(
        min_length=1,
        max_length=80,
        pattern=r"^[a-z][a-z0-9_]*$",
    )
    root_flow_id: str = Field(
        min_length=1,
        max_length=80,
        pattern=r"^[a-z][a-z0-9_]*$",
    )
    flows: list[FlexibleFlowNodePlan] = Field(
        min_length=1,
        description=(
            "Only flows reachable exactly once from root_flow_id; omit orphan "
            "and shared helper flows."
        ),
    )

    @model_validator(mode="after")
    def _flow_ids_must_be_unique(self) -> "FlexibleRegionPlan":
        flow_ids = [flow.id for flow in self.flows]
        if len(flow_ids) != len(set(flow_ids)):
            raise ValueError("flexible flow ids must be unique")
        if self.root_flow_id not in set(flow_ids):
            raise ValueError("root_flow_id must reference a declared flow")
        return self


class FlexibleSlidePlan(BaseModel):
    """Second-pass decisions for nested fixed and repeatable flow trees."""

    model_config = ConfigDict(extra="forbid")

    regions: list[FlexibleRegionPlan] = Field(
        description=(
            "Confident flexible regions only; use an empty list rather than an "
            "invalid, unary, incomplete, or uncertain region."
        )
    )

    @model_validator(mode="after")
    def _component_ids_must_be_unique(self) -> "FlexibleSlidePlan":
        component_ids = [region.component_id for region in self.regions]
        if len(component_ids) != len(set(component_ids)):
            raise ValueError("a component can contain at most one flexible region")
        return self


class TextCapacityAdjustment(BaseModel):
    """LLM-directed growth and alignment for one existing text box."""

    model_config = ConfigDict(extra="forbid")

    path: str = Field(
        min_length=10,
        max_length=240,
        pattern=r"^elements\.\d+(?:\.(?:child|children\.\d+))*$",
    )
    left_characters: int = Field(ge=0, le=200)
    right_characters: int = Field(ge=0, le=200)
    top_lines: int = Field(ge=0, le=12)
    bottom_lines: int = Field(ge=0, le=12)
    horizontal_alignment: Literal[
        "preserve", "left", "center", "right", "justify"
    ]
    vertical_alignment: Literal["preserve", "top", "middle", "bottom"]

    @model_validator(mode="before")
    @classmethod
    def _upgrade_legacy_direction_request(cls, value: Any) -> Any:
        if not isinstance(value, dict) or "expand" not in value:
            return value
        upgraded = dict(value)
        directions = set(upgraded.pop("expand", []))
        legacy_lines = int(upgraded.pop("max_lines", 0) or 0)
        upgraded.update(
            {
                "left_characters": 200 if "left" in directions else 0,
                "right_characters": 200 if "right" in directions else 0,
                "top_lines": legacy_lines if "top" in directions else 0,
                "bottom_lines": legacy_lines if "bottom" in directions else 0,
                "horizontal_alignment": "preserve",
                "vertical_alignment": "preserve",
            }
        )
        return upgraded

    @model_validator(mode="after")
    def _must_change_capacity_or_alignment(self) -> "TextCapacityAdjustment":
        requests_growth = any(
            (
                self.left_characters,
                self.right_characters,
                self.top_lines,
                self.bottom_lines,
            )
        )
        changes_alignment = (
            self.horizontal_alignment != "preserve"
            or self.vertical_alignment != "preserve"
        )
        if not requests_growth and not changes_alignment:
            raise ValueError(
                "text capacity adjustment must request growth or alignment"
            )
        return self


class TextCapacityPlan(BaseModel):
    """Third-pass text capacity decisions for existing editable text boxes."""

    model_config = ConfigDict(extra="forbid")

    adjustments: list[TextCapacityAdjustment] = Field(
        description=(
            "Effective growth or alignment changes only; use an empty list when "
            "nothing should change and never include a no-op adjustment."
        )
    )

    @model_validator(mode="after")
    def _paths_must_be_unique(self) -> "TextCapacityPlan":
        paths = [adjustment.path for adjustment in self.adjustments]
        if len(paths) != len(set(paths)):
            raise ValueError("a text box can have at most one capacity adjustment")
        return self


def slide_layout_llm_json_schema() -> dict:
    """Return the SlideLayout output schema with LLM-only string length hints."""
    schema = SlideLayout.model_json_schema()

    def add_length_hints(properties: dict) -> None:
        properties["id"].update(minLength=1, maxLength=80)
        properties["description"].update(minLength=10, maxLength=300)

    add_length_hints(schema["properties"])
    add_length_hints(schema["$defs"]["Component"]["properties"])
    return schema


def semantic_slide_manifest_llm_json_schema() -> dict:
    """Return the strict, reference-only output contract for layout generation."""
    return SemanticSlideManifest.model_json_schema()


def visual_data_replacement_plan_llm_json_schema() -> dict:
    """Return a Gemini-safe schema with complex payloads in JSON envelopes."""
    schema = VisualDataReplacementPlan.model_json_schema()
    definitions = schema["$defs"]
    typed_definition_names = [
        "VisualChartReplacement",
        "VisualTextListReplacement",
    ]
    alternatives = []
    for definition_name in typed_definition_names:
        kind_schema = definitions[definition_name]["properties"]["kind"]
        if "const" in kind_schema:
            kind_schema["enum"] = [kind_schema.pop("const")]
        alternatives.append({"$ref": f"#/$defs/{definition_name}"})

    alternatives.append(
        {
            "type": "object",
            "additionalProperties": False,
            "properties": {
                "kind": {"type": "string", "enum": ["table"]},
                "path": {
                    "type": "string",
                    "minLength": 10,
                    "maxLength": 240,
                },
                "position": {"$ref": "#/$defs/Position"},
                "size": {"$ref": "#/$defs/Size"},
                "data_json": {
                    "type": "string",
                    "minLength": 2,
                    "maxLength": 120000,
                },
            },
            "required": ["kind", "path", "position", "size", "data_json"],
        }
    )
    alternatives.append(
        {
            "type": "object",
            "additionalProperties": False,
            "properties": {
                "kind": {"type": "string", "enum": ["infographic"]},
                "path": {
                    "type": "string",
                    "minLength": 10,
                    "maxLength": 240,
                },
                "position": {"$ref": "#/$defs/Position"},
                "size": {"$ref": "#/$defs/Size"},
                "data_json": {
                    "type": "string",
                    "minLength": 2,
                    "maxLength": 120000,
                },
            },
            "required": ["kind", "path", "position", "size", "data_json"],
        }
    )
    schema["properties"]["replacements"]["items"] = {"anyOf": alternatives}
    _prune_unused_schema_definitions(schema)
    return schema


def _prune_unused_schema_definitions(schema: dict[str, Any]) -> None:
    definitions = schema.get("$defs")
    if not isinstance(definitions, dict):
        return

    referenced: set[str] = set()

    def collect(value: Any) -> None:
        if isinstance(value, dict):
            reference = value.get("$ref")
            if isinstance(reference, str) and reference.startswith("#/$defs/"):
                referenced.add(reference.removeprefix("#/$defs/"))
            for key, child in value.items():
                if key != "$defs":
                    collect(child)
        elif isinstance(value, list):
            for child in value:
                collect(child)

    collect(schema)
    pending = list(referenced)
    while pending:
        definition_name = pending.pop()
        definition = definitions.get(definition_name)
        before = set(referenced)
        collect(definition)
        pending.extend(referenced - before)

    schema["$defs"] = {
        name: definition
        for name, definition in definitions.items()
        if name in referenced
    }


def flexible_slide_plan_llm_json_schema() -> dict:
    """Return an LLM contract that exposes the exclusive flow-item variants."""
    schema = FlexibleSlidePlan.model_json_schema()
    item_schema = schema["$defs"]["FlexibleFlowItemPlan"]
    indices_schema = dict(item_schema["properties"]["indices"]["anyOf"][0])
    indices_schema.update(minItems=1)
    flow_id_schema = dict(item_schema["properties"]["flow_id"]["anyOf"][0])

    # The runtime model keeps nullable fields for convenient Python access, but
    # the LLM should see two mutually exclusive shapes. Requiring both keys with
    # one explicit null is supported by JSON Schema anyOf and prevents responses
    # that set both fields—or neither—before deterministic tree validation.
    item_schema["required"] = ["indices", "flow_id"]
    item_schema["anyOf"] = [
        {
            "properties": {
                "indices": indices_schema,
                "flow_id": {"type": "null"},
            }
        },
        {
            "properties": {
                "indices": {"type": "null"},
                "flow_id": flow_id_schema,
            }
        },
    ]
    return schema


def text_capacity_plan_llm_json_schema() -> dict:
    """Return a flat LLM contract; runtime validation rejects no-op adjustments."""
    return TextCapacityPlan.model_json_schema()
