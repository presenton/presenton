import copy
import json
import logging
import re
import uuid
from typing import Any

from jsonschema import Draft202012Validator
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from models.image_prompt import ImagePrompt
from models.presentation_outline_model import PresentationOutlineModel, SlideOutlineModel
from models.sql.image_asset import ImageAsset
from models.sql.key_value import KeyValueSqlModel
from models.sql.presentation import PresentationModel
from models.sql.slide import SlideModel
from services.icon_finder_service import ICON_FINDER_SERVICE
from services.image_generation_service import ImageGenerationService
from services.mem0_presentation_memory_service import MEM0_PRESENTATION_MEMORY_SERVICE
from templates.presentation_layout import SlideLayoutModel
from utils.asset_directory_utils import (
    filesystem_image_path_to_app_data_url,
    get_images_directory,
    normalize_slide_asset_url,
)
from utils.icon_weights import DEFAULT_ICON_WEIGHT
from utils.outline_utils import get_presentation_title_from_presentation_outline
from utils.process_slides import (
    process_old_and_new_slides_and_fetch_assets,
    process_slide_and_fetch_assets,
)

LOGGER = logging.getLogger(__name__)
MAX_SCHEMA_ERRORS = 10
# Keep URL runtime fields during validation because many slide schemas require them.
# Speaker note is handled separately and should not affect JSON-schema checks.
RUNTIME_CONTENT_FIELDS = {"__speaker_note__"}
THEMES_STORAGE_KEY = "presentation_custom_themes"
CHAT_BUILTIN_THEMES: list[dict[str, Any]] = [
    {
        "id": "edge-yellow",
        "name": "Edge Yellow",
        "description": "Yellow and dark theme for professionalish and edge.",
        "user": "system",
        "logo": None,
        "logo_url": None,
        "company_name": None,
        "data": {
            "colors": {
                "primary": "#f5f547",
                "background": "#1f1f1f",
                "card": "#424242",
                "stroke": "#585858",
                "primary_text": "#161616",
                "background_text": "#f5f547",
                "graph_0": "#ffff54",
                "graph_1": "#f1f142",
                "graph_2": "#dada15",
                "graph_3": "#c1bf00",
                "graph_4": "#a8a600",
                "graph_5": "#908c00",
                "graph_6": "#797400",
                "graph_7": "#625c00",
                "graph_8": "#4d4500",
                "graph_9": "#382f00",
            },
            "fonts": {
                "textFont": {
                    "name": "Playfair Display",
                    "url": "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400..900&display=swap",
                }
            },
        },
    },
    {
        "id": "light-rose",
        "name": "Light Rose",
        "description": "Rose background with punchy font.",
        "user": "system",
        "logo": None,
        "logo_url": None,
        "company_name": None,
        "data": {
            "colors": {
                "primary": "#030204",
                "background": "#f69c9c",
                "card": "#ffaeb4",
                "stroke": "#bf6a6b",
                "primary_text": "#bebebe",
                "background_text": "#030202",
                "graph_0": "#2f2c32",
                "graph_1": "#444147",
                "graph_2": "#5a565d",
                "graph_3": "#706d73",
                "graph_4": "#88848b",
                "graph_5": "#a09da4",
                "graph_6": "#b9b6bd",
                "graph_7": "#d3cfd6",
                "graph_8": "#eae6ed",
                "graph_9": "#f7f3fb",
            },
            "fonts": {
                "textFont": {
                    "name": "Overpass",
                    "url": "https://fonts.googleapis.com/css2?family=Overpass:wght@100..900&display=swap",
                }
            },
        },
    },
    {
        "id": "mint-blue",
        "name": "Mint Blue",
        "description": "Mint green with blue heading.",
        "user": "system",
        "logo": None,
        "logo_url": None,
        "company_name": None,
        "data": {
            "colors": {
                "primary": "#3b3172",
                "background": "#ffffff",
                "card": "#80e7cf",
                "stroke": "#d1d1d1",
                "primary_text": "#ffffff",
                "background_text": "#3b3172",
                "graph_0": "#003d2d",
                "graph_1": "#005341",
                "graph_2": "#006a57",
                "graph_3": "#00826d",
                "graph_4": "#2b9a85",
                "graph_5": "#4ab39d",
                "graph_6": "#65cdb6",
                "graph_7": "#80e7cf",
                "graph_8": "#98ffe6",
                "graph_9": "#a5fff4",
            },
            "fonts": {
                "textFont": {
                    "name": "Prompt",
                    "url": "https://fonts.googleapis.com/css2?family=Prompt:wght@100..900&display=swap",
                }
            },
        },
    },
    {
        "id": "professional-blue",
        "name": "Professional Blue",
        "description": "Clean and professional blue theme.",
        "user": "system",
        "logo": None,
        "logo_url": None,
        "company_name": None,
        "data": {
            "colors": {
                "primary": "#161616",
                "background": "#ffffff",
                "card": "#dae6ff",
                "stroke": "#d1d1d1",
                "primary_text": "#eeeaea",
                "background_text": "#000000",
                "graph_0": "#2e2e2e",
                "graph_1": "#424242",
                "graph_2": "#585858",
                "graph_3": "#6f6f6f",
                "graph_4": "#868686",
                "graph_5": "#9e9e9e",
                "graph_6": "#b7b7b7",
                "graph_7": "#d1d1d1",
                "graph_8": "#e8e8e8",
                "graph_9": "#f5f5f5",
            },
            "fonts": {
                "textFont": {
                    "name": "Inter",
                    "url": "https://fonts.googleapis.com/css2?family=Inter:wght@100..900&display=swap",
                }
            },
        },
    },
    {
        "id": "professional-dark",
        "name": "Professional Dark",
        "description": "Clean and professional for dark corporate usage.",
        "user": "system",
        "logo": None,
        "logo_url": None,
        "company_name": None,
        "data": {
            "colors": {
                "primary": "#eff5f1",
                "background": "#050505",
                "card": "#424242",
                "stroke": "#585858",
                "primary_text": "#050505",
                "background_text": "#eff5f1",
                "graph_0": "#ebf6ff",
                "graph_1": "#dee8fa",
                "graph_2": "#c7d2e3",
                "graph_3": "#aeb8c9",
                "graph_4": "#959fb0",
                "graph_5": "#7d8797",
                "graph_6": "#666f7f",
                "graph_7": "#505867",
                "graph_8": "#3a4351",
                "graph_9": "#262e3c",
            },
            "fonts": {
                "textFont": {
                    "name": "Instrument Sans",
                    "url": "https://fonts.googleapis.com/css2?family=Instrument+Sans:ital,wght@0,400..700;1,400..700&display=swap",
                }
            },
        },
    },
]
THEME_COLOR_KEYS = [
    "primary",
    "background",
    "card",
    "stroke",
    "primary_text",
    "background_text",
    "graph_0",
    "graph_1",
    "graph_2",
    "graph_3",
    "graph_4",
    "graph_5",
    "graph_6",
    "graph_7",
    "graph_8",
    "graph_9",
]
DEFAULT_THEME_FONT = {
    "name": "Inter",
    "url": "https://fonts.googleapis.com/css2?family=Inter:wght@100..900&display=swap",
}


class PresentationChatMemoryLayer:
    """
    Memory abstraction for chat tools and context retrieval.

    This layer intentionally hides where data comes from (SQL-backed persisted state
    and mem0 retrieval) behind `get` and `search`-style methods so chat logic stays
    decoupled from storage details.
    """

    def __init__(self, sql_session: AsyncSession, presentation_id: uuid.UUID):
        self._sql_session = sql_session
        self._presentation_id = presentation_id

    async def get(self, key: str) -> Any:
        if key != "presentation_outline":
            return None

        # Prefer live slides from SQL so slide count and slide indices are always current.
        slides_result = await self._sql_session.scalars(
            select(SlideModel)
            .where(SlideModel.presentation == self._presentation_id)
            .order_by(SlideModel.index)
        )
        slides = list(slides_result)
        if slides:
            LOGGER.info(
                "Chat outline loaded from slides table (presentation_id=%s, slides=%d)",
                self._presentation_id,
                len(slides),
            )
            return {
                "source": "slides_table",
                "slide_count": len(slides),
                "slides": [
                    {
                        "slide_id": str(slide.id),
                        "index": slide.index,
                        "layout_id": slide.layout,
                        "content": slide.content,
                        "speaker_note": slide.speaker_note,
                    }
                    for slide in slides
                ],
            }

        presentation = await self._sql_session.get(PresentationModel, self._presentation_id)
        if not presentation or not presentation.outlines:
            LOGGER.info(
                "Chat memory miss for outline (presentation_id=%s)",
                self._presentation_id,
            )
            return None

        LOGGER.info(
            "Chat outline fallback hit from presentation.outlines (presentation_id=%s)",
            self._presentation_id,
        )
        return presentation.outlines

    async def search(self, query: str, limit: int = 5) -> list[dict[str, Any]]:
        """
        Search slides directly from SQL-backed slide rows.

        Results are intentionally compact (snippet-first) to keep tool-call payloads
        small for models with limited context windows.
        """

        trimmed_query = (query or "").strip()
        if not trimmed_query:
            return []

        slides_result = await self._sql_session.scalars(
            select(SlideModel).where(SlideModel.presentation == self._presentation_id)
        )
        slides = sorted(list(slides_result), key=lambda slide: slide.index)
        if not slides:
            LOGGER.info(
                "Chat memory miss for slide search (presentation_id=%s, reason=no_slides)",
                self._presentation_id,
            )
            return []

        query_lower = trimmed_query.lower()
        query_tokens = set(re.findall(r"[a-z0-9]{2,}", query_lower))
        ranked: list[tuple[int, dict[str, Any]]] = []
        for slide in slides:
            serialized = self._serialize_slide(slide)
            searchable = serialized.lower()

            score = 0
            if query_lower in searchable:
                score += 8
            if query_tokens:
                score += sum(1 for token in query_tokens if token in searchable)
            if score <= 0:
                continue

            ranked.append(
                (
                    score,
                    {
                        "slide_id": str(slide.id),
                        "index": slide.index,
                        "slide_number": slide.index + 1,
                        "layout_id": slide.layout,
                        "snippet": self._build_snippet(serialized, query_lower),
                        "score": score,
                    },
                )
            )

        ranked.sort(key=lambda item: (-item[0], item[1]["index"]))
        results = [entry for _, entry in ranked[: max(1, limit)]]
        LOGGER.info(
            "Chat DB slide search completed (presentation_id=%s, query=%r, hits=%d)",
            self._presentation_id,
            trimmed_query,
            len(results),
        )
        return results

    async def get_slide_at_index(
        self, index: int, *, include_full_content: bool = False
    ) -> dict[str, Any] | None:
        slide = await self._sql_session.scalar(
            select(SlideModel).where(
                SlideModel.presentation == self._presentation_id,
                SlideModel.index == index,
            )
        )
        if not slide:
            LOGGER.info(
                "Chat memory miss for slide by index (presentation_id=%s, index=%d)",
                self._presentation_id,
                index,
            )
            return None

        response: dict[str, Any] = {
            "slide_id": str(slide.id),
            "index": slide.index,
            "slide_number": slide.index + 1,
            "layout_id": slide.layout,
            "content_preview": self._build_snippet(
                self._serialize_slide(slide),
                query_lower="",
                window=420,
            ),
            "speaker_note": slide.speaker_note,
        }
        if include_full_content:
            response["content"] = slide.content
        return response

    async def get_outline_draft(self) -> dict[str, Any]:
        presentation = await self._sql_session.get(PresentationModel, self._presentation_id)
        if not presentation:
            return {
                "found": False,
                "message": "Presentation not found.",
                "slide_count": 0,
                "slides": [],
            }

        slides = self._normalize_outline_slides(presentation.outlines)
        if not slides:
            return {
                "found": False,
                "message": "No outline draft is available yet.",
                "slide_count": 0,
                "slides": [],
            }

        return {
            "found": True,
            "message": "Outline draft fetched successfully.",
            "slide_count": len(slides),
            "slides": [
                {
                    "index": index,
                    "slide_number": index + 1,
                    "title": self._extract_outline_title(slide["content"]),
                    "content": slide["content"],
                }
                for index, slide in enumerate(slides)
            ],
        }

    async def add_outline(
        self,
        *,
        content: str,
        index: int | None = None,
    ) -> dict[str, Any]:
        presentation = await self._sql_session.get(PresentationModel, self._presentation_id)
        if not presentation:
            return {
                "saved": False,
                "message": "Presentation not found.",
            }

        slides = self._normalize_outline_slides(presentation.outlines)
        insert_index = len(slides) if index is None else min(max(0, index), len(slides))
        slides.insert(insert_index, {"content": content.strip()})
        await self._save_outline_slides(presentation, slides)

        return {
            "saved": True,
            "action": "created",
            "message": f"Outline slide added at index {insert_index}.",
            "index": insert_index,
            "slide_count": len(slides),
        }

    async def update_outline(self, *, index: int, content: str) -> dict[str, Any]:
        presentation = await self._sql_session.get(PresentationModel, self._presentation_id)
        if not presentation:
            return {
                "saved": False,
                "message": "Presentation not found.",
            }

        slides = self._normalize_outline_slides(presentation.outlines)
        target_index = max(0, index)
        if target_index >= len(slides):
            return {
                "saved": False,
                "message": f"No outline slide found at index {target_index}.",
                "index": target_index,
                "slide_count": len(slides),
            }

        slides[target_index] = {"content": content.strip()}
        await self._save_outline_slides(presentation, slides)

        return {
            "saved": True,
            "action": "updated",
            "message": f"Outline slide at index {target_index} was updated.",
            "index": target_index,
            "slide_count": len(slides),
        }

    async def delete_outline(self, *, index: int) -> dict[str, Any]:
        presentation = await self._sql_session.get(PresentationModel, self._presentation_id)
        if not presentation:
            return {
                "deleted": False,
                "message": "Presentation not found.",
            }

        slides = self._normalize_outline_slides(presentation.outlines)
        target_index = max(0, index)
        if target_index >= len(slides):
            return {
                "deleted": False,
                "message": f"No outline slide found at index {target_index}.",
                "index": target_index,
                "slide_count": len(slides),
            }

        slides.pop(target_index)
        await self._save_outline_slides(presentation, slides)

        return {
            "deleted": True,
            "action": "deleted",
            "message": f"Outline slide at index {target_index} was deleted.",
            "index": target_index,
            "slide_count": len(slides),
        }

    async def move_outline(self, *, from_index: int, to_index: int) -> dict[str, Any]:
        presentation = await self._sql_session.get(PresentationModel, self._presentation_id)
        if not presentation:
            return {
                "saved": False,
                "message": "Presentation not found.",
            }

        slides = self._normalize_outline_slides(presentation.outlines)
        source_index = max(0, from_index)
        if source_index >= len(slides):
            return {
                "saved": False,
                "message": f"No outline slide found at index {source_index}.",
                "from_index": source_index,
                "slide_count": len(slides),
            }

        destination_index = min(max(0, to_index), len(slides) - 1)
        [slide] = slides[source_index : source_index + 1]
        del slides[source_index]
        slides.insert(destination_index, slide)
        await self._save_outline_slides(presentation, slides)

        return {
            "saved": True,
            "action": "moved",
            "message": (
                f"Outline slide moved from index {source_index} "
                f"to index {destination_index}."
            ),
            "from_index": source_index,
            "to_index": destination_index,
            "slide_count": len(slides),
        }

    async def get_available_layouts(self) -> list[dict[str, Any]]:
        presentation = await self._sql_session.get(PresentationModel, self._presentation_id)
        if not presentation or not isinstance(presentation.layout, dict):
            return []

        try:
            layout_model = presentation.get_layout()
        except Exception:
            LOGGER.exception(
                "Failed to parse presentation layout (presentation_id=%s)",
                self._presentation_id,
            )
            return []

        return [
            {
                "id": layout.id,
                "name": layout.name,
                "description": layout.description,
            }
            for layout in layout_model.slides
        ]

    async def get_content_schema_from_layout_id(self, layout_id: str) -> dict[str, Any] | None:
        layout = await self._get_layout_by_id(layout_id)
        if not layout:
            return None
        return layout.json_schema

    async def _get_presentation_icon_weight(
        self, presentation: PresentationModel | None = None
    ) -> str:
        if presentation is None:
            presentation = await self._sql_session.get(
                PresentationModel, self._presentation_id
            )
        if not presentation or not isinstance(presentation.layout, dict):
            return DEFAULT_ICON_WEIGHT
        try:
            return presentation.get_layout().icon_weight
        except Exception:
            LOGGER.exception(
                "Failed to parse presentation icon weight (presentation_id=%s)",
                self._presentation_id,
            )
            return DEFAULT_ICON_WEIGHT

    async def generate_image(self, prompt: str) -> str:
        image_generation_service = ImageGenerationService(get_images_directory())
        image = await image_generation_service.generate_image(ImagePrompt(prompt=prompt))

        if isinstance(image, ImageAsset):
            self._sql_session.add(image)
            await self._sql_session.commit()
            return filesystem_image_path_to_app_data_url(image.path)

        return normalize_slide_asset_url(str(image))

    async def generate_icon(self, query: str) -> str:
        icons = await ICON_FINDER_SERVICE.search_icons(
            query,
            k=1,
            weight=await self._get_presentation_icon_weight(),
        )
        if icons:
            return normalize_slide_asset_url(icons[0])
        return normalize_slide_asset_url("/static/icons/placeholder.svg")

    async def save_slide(
        self,
        *,
        content: dict[str, Any],
        layout_id: str,
        index: int,
        replace_old_slide_at_index: bool,
    ) -> dict[str, Any]:
        presentation = await self._sql_session.get(PresentationModel, self._presentation_id)
        if not presentation:
            return {
                "saved": False,
                "message": "Presentation not found.",
                "validation_errors": [],
            }

        layout = await self._get_layout_by_id(layout_id, presentation=presentation)
        if not layout:
            return {
                "saved": False,
                "message": f"Layout '{layout_id}' was not found in this presentation.",
                "validation_errors": [f"Unknown layout_id '{layout_id}'."],
            }
        icon_weight = await self._get_presentation_icon_weight(presentation)

        validation_errors = self._validate_slide_content(
            content=content,
            schema=layout.json_schema,
        )
        if validation_errors:
            return {
                "saved": False,
                "message": "Slide content failed schema validation.",
                "validation_errors": validation_errors,
            }

        target_index = max(0, index)
        image_generation_service = ImageGenerationService(get_images_directory())

        if replace_old_slide_at_index:
            existing_slide = await self._sql_session.scalar(
                select(SlideModel).where(
                    SlideModel.presentation == self._presentation_id,
                    SlideModel.index == target_index,
                )
            )
            if not existing_slide:
                return {
                    "saved": False,
                    "message": f"No existing slide found at index {target_index} to replace.",
                    "validation_errors": [],
                }

            updated_content = copy.deepcopy(content)
            new_assets = await process_old_and_new_slides_and_fetch_assets(
                image_generation_service=image_generation_service,
                old_slide_content=existing_slide.content or {},
                new_slide_content=updated_content,
                icon_weight=icon_weight,
            )

            existing_slide.id = uuid.uuid4()
            existing_slide.layout = layout_id
            existing_slide.layout_group = self._resolve_layout_group(
                presentation=presentation,
                fallback=existing_slide.layout_group,
            )
            existing_slide.content = updated_content
            existing_slide.speaker_note = self._extract_speaker_note(updated_content)
            self._sql_session.add(existing_slide)
            self._sql_session.add_all(new_assets)
            await self._sql_session.commit()

            await MEM0_PRESENTATION_MEMORY_SERVICE.store_slide_edit(
                presentation_id=self._presentation_id,
                slide_index=target_index,
                edit_prompt=f"[chat_tool_save_slide_replace] layout_id={layout_id}",
                edited_slide_content=updated_content,
            )

            return {
                "saved": True,
                "action": "replaced",
                "message": f"Slide at index {target_index} was replaced successfully.",
                "slide_id": str(existing_slide.id),
                "index": target_index,
            }

        slides_result = await self._sql_session.scalars(
            select(SlideModel)
            .where(SlideModel.presentation == self._presentation_id)
            .order_by(SlideModel.index)
        )
        slides = list(slides_result)

        if slides:
            max_index = max(slide.index for slide in slides)
            insert_index = min(target_index, max_index + 1)
            slides_to_shift = [slide for slide in slides if slide.index >= insert_index]
        else:
            insert_index = 0
            slides_to_shift = []

        for slide in sorted(slides_to_shift, key=lambda each: each.index, reverse=True):
            slide.index += 1
            self._sql_session.add(slide)

        new_slide_content = copy.deepcopy(content)
        new_slide = SlideModel(
            presentation=self._presentation_id,
            layout_group=self._resolve_layout_group(presentation=presentation),
            layout=layout_id,
            index=insert_index,
            content=new_slide_content,
            speaker_note=self._extract_speaker_note(new_slide_content),
        )
        new_assets = await process_slide_and_fetch_assets(
            image_generation_service=image_generation_service,
            slide=new_slide,
            icon_weight=icon_weight,
        )

        self._sql_session.add(new_slide)
        self._sql_session.add_all(new_assets)
        await self._sql_session.commit()
        await self._sql_session.refresh(new_slide)

        await MEM0_PRESENTATION_MEMORY_SERVICE.store_slide_edit(
            presentation_id=self._presentation_id,
            slide_index=insert_index,
            edit_prompt=f"[chat_tool_save_slide_new] layout_id={layout_id}",
            edited_slide_content=new_slide.content,
        )

        return {
            "saved": True,
            "action": "created",
            "message": f"New slide saved at index {insert_index}.",
            "slide_id": str(new_slide.id),
            "index": insert_index,
            "shifted_slide_count": len(slides_to_shift),
        }

    async def delete_slide(self, *, index: int) -> dict[str, Any]:
        target_index = max(0, index)
        slide = await self._sql_session.scalar(
            select(SlideModel).where(
                SlideModel.presentation == self._presentation_id,
                SlideModel.index == target_index,
            )
        )
        if not slide:
            return {
                "deleted": False,
                "message": f"No slide found at index {target_index}.",
                "index": target_index,
            }

        await self._sql_session.delete(slide)

        slides_result = await self._sql_session.scalars(
            select(SlideModel).where(SlideModel.presentation == self._presentation_id)
        )
        slides = sorted(list(slides_result), key=lambda each: each.index)
        shifted_count = 0
        for each_slide in slides:
            if each_slide.index <= target_index:
                continue
            each_slide.index -= 1
            self._sql_session.add(each_slide)
            shifted_count += 1

        await self._sql_session.commit()

        return {
            "deleted": True,
            "message": f"Slide at index {target_index} was deleted successfully.",
            "deleted_slide_id": str(slide.id),
            "index": target_index,
            "shifted_slide_count": shifted_count,
        }

    async def set_presentation_theme(
        self,
        *,
        theme_query: str | None = None,
        custom_theme: dict[str, Any] | None = None,
        save_custom_theme: bool = True,
    ) -> dict[str, Any]:
        requested_theme = (theme_query or "").strip()
        has_custom_theme = isinstance(custom_theme, dict)
        if not requested_theme and not has_custom_theme:
            return {
                "applied": False,
                "message": "Theme query or custom theme payload is required.",
            }

        presentation = await self._sql_session.get(PresentationModel, self._presentation_id)
        if not presentation:
            return {
                "applied": False,
                "message": "Presentation not found.",
            }

        current_theme = (
            presentation.theme if isinstance(presentation.theme, dict) else None
        )
        available_themes = await self._get_chat_available_themes()
        selected_theme: dict[str, Any] | None = None
        custom_theme_saved = False
        selected_source = "query"

        if has_custom_theme:
            custom_theme_payload = custom_theme if isinstance(custom_theme, dict) else {}
            selected_theme = self._build_custom_theme_from_payload(
                custom_theme=custom_theme_payload,
                requested_theme=requested_theme,
                current_theme=current_theme,
                available_themes=available_themes,
            )
            if not selected_theme:
                return {
                    "applied": False,
                    "message": (
                        "Invalid custom theme payload. Include colors and optional font "
                        "details (name/url), or use a theme name/id query."
                    ),
                    "requested_theme": requested_theme or None,
                }

            selected_source = "custom"
            if save_custom_theme:
                await self._upsert_custom_theme_in_store(selected_theme)
                custom_theme_saved = True
        else:
            selected_theme = self._select_theme_for_query(
                requested_theme,
                available_themes,
                current_theme,
            )

        if not selected_theme:
            return {
                "applied": False,
                "message": (
                    "No matching theme found. Try a specific theme name/id, "
                    "use 'dark'/'light'/'another', or provide customTheme."
                ),
                "requested_theme": requested_theme,
                "available_themes": [
                    {"id": str(theme.get("id") or ""), "name": str(theme.get("name") or "")}
                    for theme in available_themes
                ],
            }

        previous_theme = copy.deepcopy(current_theme) if current_theme else None
        presentation.theme = copy.deepcopy(selected_theme)
        self._sql_session.add(presentation)
        await self._sql_session.commit()

        selected_name = str(selected_theme.get("name") or "selected theme")
        selected_id = str(selected_theme.get("id") or "")
        previous_name = self._extract_theme_name(previous_theme)

        return {
            "applied": True,
            "message": f"Theme changed to '{selected_name}'.",
            "requested_theme": requested_theme or None,
            "theme": selected_theme,
            "theme_id": selected_id,
            "theme_name": selected_name,
            "theme_source": selected_source,
            "custom_theme_saved": custom_theme_saved,
            "previous_theme_name": previous_name,
        }

    async def get_presentation_theme_catalog(self) -> dict[str, Any]:
        presentation = await self._sql_session.get(PresentationModel, self._presentation_id)
        if not presentation:
            return {
                "found": False,
                "message": "Presentation not found.",
                "current_theme": None,
                "available_themes": [],
                "count": 0,
            }

        current_theme = (
            copy.deepcopy(presentation.theme)
            if isinstance(presentation.theme, dict)
            else None
        )
        current_theme_id = (
            str((current_theme or {}).get("id") or "").strip().lower()
            if current_theme
            else ""
        )
        builtin_theme_ids = {
            str(theme.get("id") or "").strip().lower() for theme in CHAT_BUILTIN_THEMES
        }

        available_themes = await self._get_chat_available_themes()
        catalog: list[dict[str, Any]] = []
        for theme in available_themes:
            theme_id = str(theme.get("id") or "").strip()
            theme_name = str(theme.get("name") or "").strip()
            if not theme_id and not theme_name:
                continue
            normalized_theme_id = theme_id.lower()
            catalog.append(
                {
                    "id": theme_id,
                    "name": theme_name or theme_id,
                    "description": str(theme.get("description") or "").strip(),
                    "source": (
                        "built_in"
                        if normalized_theme_id in builtin_theme_ids
                        else "custom"
                    ),
                    "is_current": bool(
                        current_theme_id
                        and normalized_theme_id
                        and normalized_theme_id == current_theme_id
                    ),
                }
            )

        current_theme_summary: dict[str, Any] | None = None
        if current_theme:
            current_theme_summary = {
                "id": str(current_theme.get("id") or "").strip(),
                "name": str(current_theme.get("name") or "").strip(),
                "description": str(current_theme.get("description") or "").strip(),
            }

        return {
            "found": True,
            "count": len(catalog),
            "current_theme": current_theme_summary,
            "available_themes": catalog,
            "available_theme_ids": [theme["id"] for theme in catalog if theme.get("id")],
            "message": "Theme catalog fetched successfully.",
        }

    async def retrieve_context(self, query: str) -> str:
        context = await MEM0_PRESENTATION_MEMORY_SERVICE.retrieve_context(
            self._presentation_id,
            query,
        )
        if context:
            LOGGER.info(
                "Chat memory semantic context hit (presentation_id=%s, chars=%d)",
                self._presentation_id,
                len(context),
            )
        else:
            LOGGER.info(
                "Chat memory semantic context miss (presentation_id=%s)",
                self._presentation_id,
            )
        return context

    async def _get_layout_by_id(
        self,
        layout_id: str,
        presentation: PresentationModel | None = None,
    ) -> SlideLayoutModel | None:
        if not presentation:
            presentation = await self._sql_session.get(PresentationModel, self._presentation_id)
        if not presentation or not isinstance(presentation.layout, dict):
            return None

        try:
            layout_model = presentation.get_layout()
        except Exception:
            return None

        for layout in layout_model.slides:
            if layout.id == layout_id:
                return layout
        return None

    def _validate_slide_content(
        self,
        *,
        content: dict[str, Any],
        schema: dict[str, Any],
    ) -> list[str]:
        validation_content = self._strip_runtime_fields(content)
        validator = Draft202012Validator(schema)
        errors = sorted(validator.iter_errors(validation_content), key=lambda err: err.path)

        if not errors:
            return []

        formatted_errors: list[str] = []
        for err in errors[:MAX_SCHEMA_ERRORS]:
            location = ".".join([str(part) for part in err.path]) or "$"
            formatted_errors.append(f"{location}: {err.message}")
        return formatted_errors

    @staticmethod
    def _strip_runtime_fields(value: Any) -> Any:
        if isinstance(value, dict):
            sanitized: dict[str, Any] = {}
            for key, nested_value in value.items():
                if key in RUNTIME_CONTENT_FIELDS:
                    continue
                sanitized[key] = PresentationChatMemoryLayer._strip_runtime_fields(
                    nested_value
                )
            return sanitized

        if isinstance(value, list):
            return [
                PresentationChatMemoryLayer._strip_runtime_fields(item) for item in value
            ]

        return value

    @staticmethod
    def _extract_speaker_note(content: dict[str, Any]) -> str:
        value = content.get("__speaker_note__")
        if isinstance(value, str):
            return value
        return ""

    @staticmethod
    def _resolve_layout_group(
        *,
        presentation: PresentationModel,
        fallback: str = "presentation",
    ) -> str:
        if isinstance(presentation.layout, dict):
            name = str(presentation.layout.get("name") or "").strip()
            if name:
                return name
        return fallback

    @staticmethod
    def _normalize_outline_slides(outlines: Any) -> list[dict[str, str]]:
        if not isinstance(outlines, dict):
            return []

        raw_slides = outlines.get("slides")
        if not isinstance(raw_slides, list):
            return []

        slides: list[dict[str, str]] = []
        for raw_slide in raw_slides:
            raw_content: Any
            if isinstance(raw_slide, dict):
                raw_content = raw_slide.get("content", "")
            else:
                raw_content = raw_slide

            if isinstance(raw_content, str):
                content = raw_content
            elif raw_content is None:
                content = ""
            else:
                try:
                    content = json.dumps(raw_content, ensure_ascii=False)
                except Exception:
                    content = str(raw_content)

            slides.append({"content": content})

        return slides

    async def _save_outline_slides(
        self,
        presentation: PresentationModel,
        slides: list[dict[str, str]],
    ) -> None:
        outline_model = PresentationOutlineModel(
            slides=[SlideOutlineModel(content=slide["content"]) for slide in slides]
        )
        presentation.outlines = outline_model.model_dump(mode="json")
        presentation.n_slides = len(outline_model.slides)
        presentation.title = get_presentation_title_from_presentation_outline(
            outline_model
        )

        self._sql_session.add(presentation)
        await self._sql_session.commit()

        await MEM0_PRESENTATION_MEMORY_SERVICE.store_generated_outlines(
            presentation.id,
            presentation.outlines,
        )

    @staticmethod
    def _extract_outline_title(markdown_content: str) -> str:
        for line in markdown_content.splitlines():
            stripped = line.strip()
            if not stripped:
                continue
            heading_match = re.match(r"^#{1,6}\s*(.+?)\s*$", stripped)
            if heading_match:
                return heading_match.group(1).strip()
            return stripped[:120]
        return "Untitled outline"

    @staticmethod
    def _serialize_slide(slide: SlideModel) -> str:
        content_text = ""
        try:
            content_text = json.dumps(slide.content or {}, ensure_ascii=False)
        except Exception:
            content_text = str(slide.content)

        speaker_note = slide.speaker_note or ""
        return f"slide_index={slide.index}\nlayout_id={slide.layout}\n{content_text}\n{speaker_note}"

    @staticmethod
    def _build_snippet(text: str, query_lower: str, window: int = 320) -> str:
        normalized = " ".join(text.split())
        if not normalized:
            return ""

        offset = normalized.lower().find(query_lower)
        if offset == -1:
            return normalized[:window]

        start = max(0, offset - window // 3)
        end = min(len(normalized), start + window)
        return normalized[start:end]

    async def _get_chat_available_themes(self) -> list[dict[str, Any]]:
        merged_themes: list[dict[str, Any]] = [copy.deepcopy(theme) for theme in CHAT_BUILTIN_THEMES]
        row = await self._sql_session.scalar(
            select(KeyValueSqlModel).where(KeyValueSqlModel.key == THEMES_STORAGE_KEY)
        )
        if not row or not isinstance(row.value, dict):
            return merged_themes

        custom_themes = row.value.get("themes")
        if not isinstance(custom_themes, list):
            return merged_themes

        existing_ids = {
            str(theme.get("id") or "").strip().lower() for theme in merged_themes
        }
        for custom_theme in custom_themes:
            if not isinstance(custom_theme, dict):
                continue
            theme_data = custom_theme.get("data")
            colors = theme_data.get("colors") if isinstance(theme_data, dict) else None
            if not isinstance(colors, dict) or "background" not in colors:
                continue

            custom_theme_copy = copy.deepcopy(custom_theme)
            custom_theme_copy.setdefault("user", "local")
            theme_id = str(custom_theme_copy.get("id") or "").strip().lower()
            if theme_id and theme_id in existing_ids:
                continue
            if theme_id:
                existing_ids.add(theme_id)
            merged_themes.append(custom_theme_copy)
        return merged_themes

    async def _upsert_custom_theme_in_store(self, theme: dict[str, Any]) -> None:
        row = await self._sql_session.scalar(
            select(KeyValueSqlModel).where(KeyValueSqlModel.key == THEMES_STORAGE_KEY)
        )
        themes: list[dict[str, Any]] = []
        if row and isinstance(row.value, dict):
            raw_themes = row.value.get("themes")
            if isinstance(raw_themes, list):
                themes = copy.deepcopy(raw_themes)

        theme_id = str(theme.get("id") or "").strip().lower()
        replaced = False
        if theme_id:
            for idx, existing_theme in enumerate(themes):
                existing_id = str(existing_theme.get("id") or "").strip().lower()
                if existing_id == theme_id:
                    themes[idx] = copy.deepcopy(theme)
                    replaced = True
                    break
        if not replaced:
            themes.append(copy.deepcopy(theme))

        if row:
            row.value = {"themes": themes}
            self._sql_session.add(row)
            return
        self._sql_session.add(KeyValueSqlModel(key=THEMES_STORAGE_KEY, value={"themes": themes}))

    @staticmethod
    def _resolve_base_theme_for_customization(
        current_theme: dict[str, Any] | None,
        available_themes: list[dict[str, Any]],
    ) -> dict[str, Any]:
        if isinstance(current_theme, dict):
            data = current_theme.get("data")
            colors = data.get("colors") if isinstance(data, dict) else None
            if isinstance(colors, dict):
                return copy.deepcopy(current_theme)

        preferred_base = PresentationChatMemoryLayer._find_theme_by_id(
            available_themes, "professional-blue"
        )
        if preferred_base:
            return copy.deepcopy(preferred_base)

        if available_themes:
            return copy.deepcopy(available_themes[0])

        return {
            "id": "professional-blue",
            "name": "Professional Blue",
            "description": "Fallback base theme.",
            "user": "system",
            "logo": None,
            "logo_url": None,
            "company_name": None,
            "data": {
                "colors": {
                    "primary": "#161616",
                    "background": "#ffffff",
                    "card": "#dae6ff",
                    "stroke": "#d1d1d1",
                    "primary_text": "#eeeaea",
                    "background_text": "#000000",
                    "graph_0": "#2e2e2e",
                    "graph_1": "#424242",
                    "graph_2": "#585858",
                    "graph_3": "#6f6f6f",
                    "graph_4": "#868686",
                    "graph_5": "#9e9e9e",
                    "graph_6": "#b7b7b7",
                    "graph_7": "#d1d1d1",
                    "graph_8": "#e8e8e8",
                    "graph_9": "#f5f5f5",
                },
                "fonts": {"textFont": DEFAULT_THEME_FONT},
            },
        }

    @staticmethod
    def _build_custom_theme_from_payload(
        *,
        custom_theme: dict[str, Any],
        requested_theme: str,
        current_theme: dict[str, Any] | None,
        available_themes: list[dict[str, Any]],
    ) -> dict[str, Any] | None:
        base_theme = PresentationChatMemoryLayer._resolve_base_theme_for_customization(
            current_theme, available_themes
        )

        payload = copy.deepcopy(custom_theme)
        data_block = payload.get("data") if isinstance(payload.get("data"), dict) else payload
        if not isinstance(data_block, dict):
            return None

        colors_override = PresentationChatMemoryLayer._extract_colors_from_payload(data_block)
        if not colors_override:
            return None

        merged_colors = PresentationChatMemoryLayer._merge_theme_colors(
            base_theme=base_theme,
            color_overrides=colors_override,
        )
        if not merged_colors:
            return None

        text_font = PresentationChatMemoryLayer._extract_text_font_from_payload(
            data_block, base_theme
        )
        if not text_font:
            return None

        name_candidates = [
            payload.get("name"),
            data_block.get("name"),
            requested_theme,
            "Custom Theme",
        ]
        theme_name = next(
            (
                str(candidate).strip()
                for candidate in name_candidates
                if isinstance(candidate, str) and str(candidate).strip()
            ),
            "Custom Theme",
        )
        theme_id = PresentationChatMemoryLayer._sanitize_theme_id(
            str(payload.get("id") or "")
        )
        if not theme_id:
            theme_id = PresentationChatMemoryLayer._sanitize_theme_id(theme_name)
        if not theme_id:
            theme_id = f"chat-custom-{uuid.uuid4().hex[:8]}"

        description = str(
            payload.get("description")
            or data_block.get("description")
            or f"Custom theme generated from chat request: {theme_name}"
        ).strip()

        theme_data = payload.get("data")
        final_data = copy.deepcopy(theme_data) if isinstance(theme_data, dict) else {}
        final_data["colors"] = merged_colors
        final_data["fonts"] = {"textFont": text_font}

        return {
            "id": theme_id,
            "name": theme_name,
            "description": description,
            "user": str(payload.get("user") or "local"),
            "logo": payload.get("logo"),
            "logo_url": payload.get("logo_url"),
            "company_name": payload.get("company_name"),
            "data": final_data,
        }

    @staticmethod
    def _extract_colors_from_payload(data_block: dict[str, Any]) -> dict[str, str]:
        raw_colors = data_block.get("colors")
        if not isinstance(raw_colors, dict):
            return {}

        normalized_colors: dict[str, str] = {}
        for key in THEME_COLOR_KEYS:
            value = raw_colors.get(key)
            if not isinstance(value, str):
                continue
            normalized_hex = PresentationChatMemoryLayer._normalize_hex_color(value)
            if normalized_hex:
                normalized_colors[key] = normalized_hex

        return normalized_colors

    @staticmethod
    def _merge_theme_colors(
        *,
        base_theme: dict[str, Any],
        color_overrides: dict[str, str],
    ) -> dict[str, str] | None:
        data = base_theme.get("data")
        base_colors = data.get("colors") if isinstance(data, dict) else None
        if not isinstance(base_colors, dict):
            return None

        merged: dict[str, str] = {}
        for key in THEME_COLOR_KEYS:
            override = color_overrides.get(key)
            if override:
                merged[key] = override
                continue

            base_value = base_colors.get(key)
            if isinstance(base_value, str):
                normalized = PresentationChatMemoryLayer._normalize_hex_color(base_value)
                merged[key] = normalized or base_value
                continue

            # Keep resulting theme always complete for frontend variable mapping.
            merged[key] = "#000000"

        return merged

    @staticmethod
    def _extract_text_font_from_payload(
        data_block: dict[str, Any],
        base_theme: dict[str, Any],
    ) -> dict[str, str] | None:
        candidate: dict[str, Any] | None = None
        fonts = data_block.get("fonts")
        if isinstance(fonts, dict):
            text_font = fonts.get("textFont")
            if isinstance(text_font, dict):
                candidate = text_font
        if not candidate:
            text_font = data_block.get("textFont")
            if isinstance(text_font, dict):
                candidate = text_font

        if not candidate:
            base_data = base_theme.get("data")
            base_fonts = base_data.get("fonts") if isinstance(base_data, dict) else None
            base_text_font = base_fonts.get("textFont") if isinstance(base_fonts, dict) else None
            if isinstance(base_text_font, dict):
                candidate = base_text_font

        if not candidate:
            candidate = DEFAULT_THEME_FONT

        name = candidate.get("name")
        url = candidate.get("url")
        if not isinstance(name, str) or not name.strip():
            return None
        if not isinstance(url, str) or not url.strip():
            return None

        return {"name": name.strip(), "url": url.strip()}

    @staticmethod
    def _sanitize_theme_id(value: str) -> str:
        slug = re.sub(r"[^a-z0-9]+", "-", value.strip().lower()).strip("-")
        return slug[:64]

    @staticmethod
    def _normalize_hex_color(value: str) -> str | None:
        normalized = value.strip().lower()
        if not normalized:
            return None
        if normalized.startswith("#"):
            normalized = normalized[1:]

        if len(normalized) == 3:
            expanded = "".join(ch * 2 for ch in normalized)
            if re.fullmatch(r"[0-9a-f]{6}", expanded):
                return f"#{expanded}"
            return None

        if len(normalized) != 6:
            return None
        if not re.fullmatch(r"[0-9a-f]{6}", normalized):
            return None
        return f"#{normalized}"

    @staticmethod
    def _select_theme_for_query(
        requested_theme: str,
        available_themes: list[dict[str, Any]],
        current_theme: dict[str, Any] | None,
    ) -> dict[str, Any] | None:
        normalized_query = requested_theme.strip().lower()
        if not normalized_query:
            return None

        # Direct exact match by id or name.
        for theme in available_themes:
            theme_id = str(theme.get("id") or "").strip().lower()
            theme_name = str(theme.get("name") or "").strip().lower()
            if normalized_query in {theme_id, theme_name}:
                return theme

        current_theme_id = str((current_theme or {}).get("id") or "").strip().lower()
        query_tokens = [token for token in re.split(r"[\s_-]+", normalized_query) if token]

        if "dark" in query_tokens or any(
            token in normalized_query for token in ("night", "black")
        ):
            for preferred in ("professional-dark", "edge-yellow"):
                theme = PresentationChatMemoryLayer._find_theme_by_id(
                    available_themes, preferred
                )
                if theme:
                    return theme

        if "light" in query_tokens or any(
            token in normalized_query for token in ("bright", "white")
        ):
            for preferred in ("professional-blue", "mint-blue", "light-rose"):
                theme = PresentationChatMemoryLayer._find_theme_by_id(
                    available_themes, preferred
                )
                if theme:
                    return theme

        if any(token in normalized_query for token in ("another", "different", "change")):
            opposite = (
                not PresentationChatMemoryLayer._is_dark_theme(current_theme)
                if current_theme
                else True
            )
            candidates = [
                theme
                for theme in available_themes
                if str(theme.get("id") or "").strip().lower() != current_theme_id
            ]
            for theme in candidates:
                if PresentationChatMemoryLayer._is_dark_theme(theme) == opposite:
                    return theme
            if candidates:
                return candidates[0]

        # Fuzzy contains match over id/name/description.
        for theme in available_themes:
            haystack = " ".join(
                [
                    str(theme.get("id") or "").strip().lower(),
                    str(theme.get("name") or "").strip().lower(),
                    str(theme.get("description") or "").strip().lower(),
                ]
            )
            if normalized_query in haystack:
                return theme
            if query_tokens and all(token in haystack for token in query_tokens):
                return theme

        return None

    @staticmethod
    def _find_theme_by_id(
        themes: list[dict[str, Any]], theme_id: str
    ) -> dict[str, Any] | None:
        normalized_theme_id = theme_id.strip().lower()
        for theme in themes:
            current_id = str(theme.get("id") or "").strip().lower()
            if current_id == normalized_theme_id:
                return theme
        return None

    @staticmethod
    def _extract_theme_name(theme: dict[str, Any] | None) -> str | None:
        if not isinstance(theme, dict):
            return None
        name = theme.get("name")
        if isinstance(name, str) and name.strip():
            return name.strip()
        theme_id = theme.get("id")
        if isinstance(theme_id, str) and theme_id.strip():
            return theme_id.strip()
        return None

    @staticmethod
    def _is_dark_theme(theme: dict[str, Any] | None) -> bool:
        if not isinstance(theme, dict):
            return False
        data = theme.get("data")
        if not isinstance(data, dict):
            return False
        colors = data.get("colors")
        if not isinstance(colors, dict):
            return False
        background = colors.get("background")
        if not isinstance(background, str):
            return False
        return PresentationChatMemoryLayer._is_dark_hex(background)

    @staticmethod
    def _is_dark_hex(hex_color: str) -> bool:
        normalized = hex_color.strip().lstrip("#")
        if len(normalized) != 6:
            return False
        try:
            red = int(normalized[0:2], 16)
            green = int(normalized[2:4], 16)
            blue = int(normalized[4:6], 16)
        except ValueError:
            return False
        # Relative luminance approximation.
        luma = (0.299 * red + 0.587 * green + 0.114 * blue) / 255
        return luma < 0.5
