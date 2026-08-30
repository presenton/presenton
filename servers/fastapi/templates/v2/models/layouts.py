from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field, model_validator

from .elements import Position, SlideElement


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

    indices: list[int] = Field(min_length=2)

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


def slide_layout_llm_json_schema() -> dict:
    """Return the SlideLayout output schema with LLM-only string length hints."""
    schema = SlideLayout.model_json_schema()

    def add_length_hints(properties: dict) -> None:
        properties["id"].update(minLength=1, maxLength=80)
        properties["description"].update(minLength=10, maxLength=300)

    add_length_hints(schema["properties"])
    add_length_hints(schema["$defs"]["Component"]["properties"])
    return schema
