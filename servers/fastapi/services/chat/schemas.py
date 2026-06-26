import json
from typing import Any, Literal

import dirtyjson  # type: ignore[import-untyped]
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


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
        description="Markdown content for the new outline slide.",
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
        description="Replacement markdown content for this outline slide.",
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


class SearchSlidesInput(StrictSchemaModel):
    query: str = Field(min_length=1, max_length=1000)
    limit: int = Field(ge=1, le=10)


class GetContentSchemaFromLayoutIdInput(StrictSchemaModel):
    layout_id: str = Field(alias="layoutId", min_length=1, max_length=200)

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


class SaveSlideInput(StrictSchemaModel):
    content: str = Field(
        min_length=2,
        max_length=200000,
        description=(
            "A JSON-serialized object for slide content. "
            "Example: '{\"title\": \"Q4 Revenue\", \"bullets\": [\"North America +22%\"]}'"
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


class DeleteSlideInput(StrictSchemaModel):
    index: int = Field(ge=0, le=1000)


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
