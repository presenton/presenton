import copy
import json
import logging
import os
import re
import uuid
from typing import Any

from jsonschema import Draft202012Validator
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from constants.presentation import MAX_NUMBER_OF_SLIDES
from models.image_prompt import ImagePrompt
from models.presentation_outline_model import PresentationOutlineModel, SlideOutlineModel
from models.sql.image_asset import ImageAsset
from models.sql.key_value import KeyValueSqlModel
from models.sql.presentation import PresentationModel
from models.sql.slide import SlideModel
from models.sql.template_v2 import TemplateV2
from services.icon_finder_service import ICON_FINDER_SERVICE
from services.documents_loader import DocumentsLoader
from services.image_generation_service import ImageGenerationService
from services.mem0_presentation_memory_service import MEM0_PRESENTATION_MEMORY_SERVICE
from services.temp_file_service import TEMP_FILE_SERVICE
from templates.presentation_layout import PresentationLayoutModel, SlideLayoutModel
from templates.v2.schema import get_template_schema
from utils.asset_directory_utils import (
    filesystem_image_path_to_app_data_url,
    get_images_directory,
    normalize_slide_asset_url,
)
from utils.icon_weights import DEFAULT_ICON_WEIGHT, extract_icon_type_from_settings
from utils.outline_utils import get_presentation_title_from_presentation_outline
from utils.outline_limits import normalize_outline_content
from utils.process_slides import (
    process_old_and_new_slides_and_fetch_assets,
    process_slide_and_fetch_assets,
)

LOGGER = logging.getLogger(__name__)
MAX_SCHEMA_ERRORS = 10
DEFAULT_SOURCE_DOCUMENT_CHARS = 12000
MAX_SOURCE_DOCUMENT_CHARS = 30000
SLIDE_STAGE_WIDTH = 1280.0
SLIDE_STAGE_HEIGHT = 720.0
CUSTOM_TEMPLATE_PREFIX = "custom-"
BLANK_SLIDE_LAYOUT_ID = "__blank_slide__"
BLANK_TEMPLATE_LAYOUT: dict[str, Any] = {
    "id": BLANK_SLIDE_LAYOUT_ID,
    "description": "Empty slide.",
    "background": "#FFFFFF",
    "components": [],
    "elements": [
        {
            "type": "vector",
            "shape": "polygon",
            "points": [
                {"x": 0, "y": 0},
                {"x": 1280, "y": 0},
                {"x": 1280, "y": 720},
                {"x": 0, "y": 720},
            ],
            "closed": True,
            "fill": {"color": "#FFFFFF"},
        }
    ],
}
TEMPLATE_GENERATED_ELEMENT_TYPES = {
    "text",
    "math",
    "image",
    "text-list",
    "table",
    "chart",
    "infographic",
}
# Keep URL runtime fields during validation because many slide schemas require them.
# Speaker note is handled separately and should not affect JSON-schema checks.
RUNTIME_CONTENT_FIELDS = {"__speaker_note__"}
DEFAULT_INSERT_BOXES = {
    "chart": {
        "position": {"x": 128.0, "y": 108.0},
        "size": {"width": 1024.0, "height": 460.0},
        "min_size": {"width": 320.0, "height": 180.0},
    },
    "table": {
        "position": {"x": 128.0, "y": 120.0},
        "size": {"width": 1024.0, "height": 410.0},
        "min_size": {"width": 420.0, "height": 160.0},
    },
}
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
        ui = self._slide_ui_layout(slide)
        if include_full_content:
            response["content"] = slide.content
            response["ui"] = ui if ui is not None else slide.ui
        if ui is not None:
            response["ui_summary"] = await self.get_slide_ui_elements(
                index=slide.index,
                include_full_json=False,
            )
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
        if len(slides) >= MAX_NUMBER_OF_SLIDES:
            return {
                "saved": False,
                "message": f"Outline slide limit reached. You can have at most {MAX_NUMBER_OF_SLIDES} outlines.",
                "slide_count": len(slides),
                "max_slide_count": MAX_NUMBER_OF_SLIDES,
            }
        insert_index = len(slides) if index is None else min(max(0, index), len(slides))
        slides.insert(insert_index, {"content": normalize_outline_content(content.strip())})
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

        slides[target_index] = {"content": normalize_outline_content(content.strip())}
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
        presentation = await self._sql_session.get(
            PresentationModel, self._presentation_id
        )
        layout_model = await self._get_layout_model(presentation)
        if not layout_model:
            return []

        return [
            {
                "id": layout.id,
                "name": layout.name,
                "description": layout.description,
            }
            for layout in layout_model.slides
        ]

    async def get_available_blocks(
        self,
        *,
        query: str | None = None,
        layout_id: str | None = None,
        element_type: str | None = None,
        block_id: str | None = None,
        include_full_content: bool = False,
        max_results: int = 20,
    ) -> dict[str, Any]:
        presentation = await self._sql_session.get(
            PresentationModel, self._presentation_id
        )
        if not presentation:
            return {
                "found": False,
                "count": 0,
                "blocks": [],
                "message": "Presentation not found.",
            }

        candidates = await self._collect_template_block_candidates(presentation)
        query_text = (query or "").strip().lower()
        layout_filter = (layout_id or "").strip()
        element_filter = (element_type or "").strip().lower()
        block_filter = (block_id or "").strip()

        matches: list[tuple[int, int, dict[str, Any]]] = []
        for source_index, candidate in enumerate(candidates):
            if block_filter and candidate.get("block_id") != block_filter:
                continue
            if layout_filter and candidate.get("layout_id") != layout_filter:
                continue
            element_types = {
                str(item).lower()
                for item in candidate.get("element_types", [])
                if item is not None
            }
            if element_filter and element_filter not in element_types:
                continue
            score = self._block_match_score(candidate, query_text)
            if query_text and score <= 0:
                continue
            matches.append((score, source_index, candidate))

        matches.sort(
            key=lambda item: (
                -item[0],
                bool(item[2].get("decorative")),
                item[1],
            )
        )

        limit = min(max(max_results, 1), 50)
        blocks = [
            self._format_available_block(
                candidate,
                include_full_content=include_full_content,
            )
            for _, _, candidate in matches[:limit]
        ]
        return {
            "found": bool(blocks),
            "count": len(blocks),
            "total_matches": len(matches),
            "blocks": blocks,
            "truncated": len(matches) > len(blocks),
            "message": (
                f"Found {len(blocks)} matching block(s)."
                if blocks
                else "No matching blocks were found."
            ),
        }

    async def read_source_documents(
        self,
        *,
        query: str | None = None,
        max_chars: int | None = None,
    ) -> dict[str, Any]:
        presentation = await self._sql_session.get(
            PresentationModel, self._presentation_id
        )
        if not presentation:
            return {
                "found": False,
                "message": "Presentation not found.",
                "documents": [],
            }

        char_budget = min(
            max(max_chars or DEFAULT_SOURCE_DOCUMENT_CHARS, 1000),
            MAX_SOURCE_DOCUMENT_CHARS,
        )
        source_paths = [
            path
            for path in (presentation.file_paths or [])
            if isinstance(path, str) and path.strip()
        ]

        documents: list[dict[str, Any]] = []
        errors: list[dict[str, str]] = []
        remaining_chars = char_budget

        for source_index, raw_path in enumerate(source_paths):
            if remaining_chars <= 0:
                break

            name = os.path.basename(raw_path) or f"Document {source_index + 1}"
            try:
                resolved_path = TEMP_FILE_SERVICE.resolve_temp_path(
                    raw_path,
                    must_exist=True,
                )
                loader = DocumentsLoader(
                    file_paths=[resolved_path],
                    presentation_language=presentation.language,
                )
                temp_dir = TEMP_FILE_SERVICE.create_temp_dir(str(uuid.uuid4()))
                await loader.load_documents(temp_dir=temp_dir)
                parsed_text = loader.documents[0] if loader.documents else ""
            except Exception as exc:
                errors.append({"name": name, "error": str(exc)})
                continue

            trimmed = self._trim_document_text(parsed_text, remaining_chars)
            if not trimmed:
                errors.append({"name": name, "error": "No text was extracted."})
                continue

            documents.append(
                {
                    "index": source_index,
                    "name": name,
                    "content": trimmed,
                    "truncated": len(parsed_text.strip()) > len(trimmed),
                }
            )
            remaining_chars -= len(trimmed)

        if documents:
            omitted_count = max(0, len(source_paths) - len(documents) - len(errors))
            return {
                "found": True,
                "source": "uploaded_files",
                "count": len(documents),
                "documents": documents,
                "errors": errors,
                "omitted_count": omitted_count,
                "message": f"Read {len(documents)} source document(s).",
            }

        fallback_query = (
            (query or "").strip()
            or "uploaded source document extracted PDF document text summary"
        )
        fallback_context = await MEM0_PRESENTATION_MEMORY_SERVICE.retrieve_context(
            self._presentation_id,
            fallback_query,
        )
        if fallback_context.strip():
            return {
                "found": True,
                "source": "presentation_memory",
                "count": 1,
                "documents": [
                    {
                        "index": 0,
                        "name": "Indexed source document context",
                        "content": self._trim_document_text(
                            fallback_context,
                            char_budget,
                        ),
                        "truncated": len(fallback_context.strip()) > char_budget,
                    }
                ],
                "errors": errors,
                "message": (
                    "Source upload files were unavailable, so indexed document "
                    "memory was returned instead."
                ),
            }

        if source_paths:
            return {
                "found": False,
                "source": "uploaded_files",
                "count": 0,
                "documents": [],
                "errors": errors,
                "message": (
                    "Source document files are recorded for this presentation, "
                    "but no readable text could be extracted."
                ),
            }

        return {
            "found": False,
            "source": "presentation",
            "count": 0,
            "documents": [],
            "errors": errors,
            "message": "No uploaded source documents are linked to this presentation.",
        }

    async def get_content_schema_from_layout_id(
        self, layout_id: str
    ) -> dict[str, Any] | None:
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
        layout_model = await self._get_layout_model(presentation)
        return layout_model.icon_weight if layout_model else DEFAULT_ICON_WEIGHT

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

    async def add_blank_slide(self, *, index: int | None = None) -> dict[str, Any]:
        presentation = await self._sql_session.get(PresentationModel, self._presentation_id)
        if not presentation:
            return {"added": False, "message": "Presentation not found."}

        slides_result = await self._sql_session.scalars(
            select(SlideModel)
            .where(SlideModel.presentation == self._presentation_id)
            .order_by(SlideModel.index)
        )
        slides = list(slides_result)
        if len(slides) >= MAX_NUMBER_OF_SLIDES:
            return {
                "added": False,
                "message": f"Slide limit reached. You can have at most {MAX_NUMBER_OF_SLIDES} slides.",
                "slide_count": len(slides),
                "max_slide_count": MAX_NUMBER_OF_SLIDES,
            }
        insert_index = (
            len(slides)
            if index is None
            else min(max(0, index), len(slides))
        )
        for slide in sorted(
            [slide for slide in slides if slide.index >= insert_index],
            key=lambda each: each.index,
            reverse=True,
        ):
            slide.index += 1
            self._sql_session.add(slide)

        presentation.n_slides = len(slides) + 1
        self._sql_session.add(presentation)
        new_slide = SlideModel(
            presentation=self._presentation_id,
            layout_group=self._resolve_layout_group(presentation=presentation),
            layout=BLANK_SLIDE_LAYOUT_ID,
            index=insert_index,
            content={},
            speaker_note="",
            ui=self._blank_slide_ui(),
        )
        self._sql_session.add(new_slide)
        await self._sql_session.commit()
        await self._sql_session.refresh(new_slide)
        return {
            "added": True,
            "message": f"Blank slide added at index {insert_index}.",
            "slide_id": str(new_slide.id),
            "index": insert_index,
            "slide_number": insert_index + 1,
        }

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
        layout_group = self._resolve_layout_group(presentation=presentation)

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
            image_warnings: list[dict] = []
            new_assets = await process_old_and_new_slides_and_fetch_assets(
                image_generation_service=image_generation_service,
                old_slide_content=existing_slide.content or {},
                new_slide_content=updated_content,
                icon_weight=icon_weight,
                use_template_asset_fields=(
                    self._is_template_layout_payload(presentation.layout)
                    or isinstance(existing_slide.ui, dict)
                    or existing_slide.layout_group.startswith(CUSTOM_TEMPLATE_PREFIX)
                ),
                allow_image_fallback=True,
                image_warnings=image_warnings,
            )
            for warning in image_warnings:
                LOGGER.warning(
                    "Chat slide replacement image generation warning: "
                    "presentation_id=%s slide_index=%s detail=%s",
                    self._presentation_id,
                    target_index,
                    warning.get("detail"),
                )

            existing_slide.id = uuid.uuid4()
            existing_slide.layout = layout_id
            existing_slide.layout_group = layout_group
            existing_slide.content = updated_content
            existing_slide.ui = await self._build_template_slide_ui(
                presentation=presentation,
                layout_id=layout_id,
                content=updated_content,
            )
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
        if len(slides) >= MAX_NUMBER_OF_SLIDES:
            return {
                "saved": False,
                "message": f"Slide limit reached. You can have at most {MAX_NUMBER_OF_SLIDES} slides.",
                "validation_errors": [],
                "slide_count": len(slides),
                "max_slide_count": MAX_NUMBER_OF_SLIDES,
            }

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
            layout_group=layout_group,
            layout=layout_id,
            index=insert_index,
            content=new_slide_content,
            speaker_note=self._extract_speaker_note(new_slide_content),
        )
        image_warnings: list[dict] = []
        new_assets = await process_slide_and_fetch_assets(
            image_generation_service=image_generation_service,
            slide=new_slide,
            icon_weight=icon_weight,
            allow_image_fallback=True,
            image_warnings=image_warnings,
        )
        for warning in image_warnings:
            LOGGER.warning(
                "Chat slide image generation warning: presentation_id=%s detail=%s",
                self._presentation_id,
                warning.get("detail"),
            )
        new_slide.ui = await self._build_template_slide_ui(
            presentation=presentation,
            layout_id=layout_id,
            content=new_slide.content,
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

        presentation = await self._sql_session.get(PresentationModel, self._presentation_id)
        slides_result = await self._sql_session.scalars(
            select(SlideModel)
            .where(SlideModel.presentation == self._presentation_id)
            .order_by(SlideModel.index)
        )
        slides = sorted(list(slides_result), key=lambda each: each.index)
        deleted_slide_id = str(slide.id)

        if len(slides) <= 1:
            fallback_slide = self._create_blank_slide_from_reference(
                presentation=presentation,
                source_slide=slide,
                index=0,
            )
            await self._sql_session.delete(slide)
            if presentation:
                presentation.n_slides = 1
                self._sql_session.add(presentation)
            self._sql_session.add(fallback_slide)
            await self._sql_session.commit()
            await self._sql_session.refresh(fallback_slide)

            return {
                "deleted": True,
                "message": "Deleted the final slide and added a blank fallback slide.",
                "deleted_slide_id": deleted_slide_id,
                "slide_id": str(fallback_slide.id),
                "index": 0,
                "slide_number": 1,
                "shifted_slide_count": 0,
                "blank_fallback": True,
            }

        await self._sql_session.delete(slide)

        remaining_slides = [
            each_slide for each_slide in slides if each_slide.id != slide.id
        ]
        shifted_count = 0
        for each_slide in remaining_slides:
            if each_slide.index <= target_index:
                continue
            each_slide.index -= 1
            self._sql_session.add(each_slide)
            shifted_count += 1

        if presentation:
            presentation.n_slides = len(remaining_slides)
            self._sql_session.add(presentation)

        await self._sql_session.commit()

        return {
            "deleted": True,
            "message": f"Slide at index {target_index} was deleted successfully.",
            "deleted_slide_id": deleted_slide_id,
            "index": target_index,
            "shifted_slide_count": shifted_count,
        }

    async def _get_slide_by_index(self, index: int) -> SlideModel | None:
        return await self._sql_session.scalar(
            select(SlideModel).where(
                SlideModel.presentation == self._presentation_id,
                SlideModel.index == max(0, index),
            )
        )

    async def _get_current_theme(self) -> dict[str, Any] | None:
        presentation = await self._sql_session.get(
            PresentationModel,
            self._presentation_id,
        )
        return (
            copy.deepcopy(presentation.theme)
            if presentation and isinstance(presentation.theme, dict)
            else None
        )

    @staticmethod
    def _blank_slide_ui() -> dict[str, Any]:
        return copy.deepcopy(BLANK_TEMPLATE_LAYOUT)

    def _create_blank_slide_from_reference(
        self,
        *,
        presentation: PresentationModel | None,
        source_slide: SlideModel,
        index: int,
    ) -> SlideModel:
        layout_group = (
            source_slide.layout_group.strip()
            if isinstance(source_slide.layout_group, str)
            else ""
        )
        if not layout_group and presentation:
            layout_group = self._resolve_layout_group(presentation=presentation)
        if not layout_group:
            layout_group = "presentation"

        return SlideModel(
            presentation=self._presentation_id,
            layout_group=layout_group,
            layout=BLANK_SLIDE_LAYOUT_ID,
            index=index,
            content={},
            speaker_note="",
            ui=self._blank_slide_ui(),
        )

    @staticmethod
    def _slide_ui_layout(slide: SlideModel) -> dict[str, Any] | None:
        ui = slide.ui
        if not isinstance(ui, dict):
            return None
        if not isinstance(ui.get("components"), list):
            return None
        return ui

    async def _save_slide_ui(self, slide: SlideModel, ui: dict[str, Any]) -> None:
        # Persist the mutated raw layout dict directly. We intentionally avoid
        # round-tripping through pydantic so richer runtime fields on the slide
        # UI (assets, tiptap ids, etc.) are preserved untouched.
        self._strip_component_sizes(ui)
        slide.ui = ui
        self._sql_session.add(slide)
        await self._sql_session.commit()
        await self._sql_session.refresh(slide)

    @staticmethod
    def _strip_component_sizes(ui: dict[str, Any]) -> None:
        components = ui.get("components")
        if not isinstance(components, list):
            return
        for component in components:
            if isinstance(component, dict):
                component.pop("size", None)

    async def get_slide_ui_elements(
        self, *, index: int, include_full_json: bool = False
    ) -> dict[str, Any]:
        # Imported lazily so chat startup does not load rendered-slide helper code
        # unless the assistant actually inspects UI elements.
        from services.chat.slide_ui_helpers import (
            _collect_editable_elements,
            _compact_components,
        )

        slide = await self._get_slide_by_index(index)
        if not slide:
            return {
                "found": False,
                "message": f"No slide found at index {max(0, index)}.",
            }
        ui = self._slide_ui_layout(slide)
        if ui is None:
            return {
                "found": True,
                "editable": False,
                "index": slide.index,
                "slide_number": slide.index + 1,
                "message": (
                    "This slide is not a rendered template (ui) slide. Use "
                    "saveSlide or updateSlide to edit it instead."
                ),
            }

        editable = _collect_editable_elements(ui, include_visual_elements=True)
        response: dict[str, Any] = {
            "found": True,
            "editable": True,
            "index": slide.index,
            "slide_number": slide.index + 1,
            "layout_id": ui.get("id"),
            "description": ui.get("description"),
            "component_count": len(ui.get("components", [])),
            "components": _compact_components(ui),
            "editable_count": len(editable),
            "elements": editable,
            "message": (
                f"Slide {slide.index + 1} renders from its ui layout with "
                f"{len(ui.get('components', []))} component(s) and "
                f"{len(editable)} editable element(s)."
            ),
        }
        if include_full_json:
            response["ui"] = ui
        return response

    async def update_slide_ui_element(
        self,
        *,
        index: int,
        element_path: str,
        text: str | None = None,
        items: list[str] | None = None,
        table_cell: dict[str, Any] | None = None,
        table: dict[str, Any] | None = None,
        chart: dict[str, Any] | None = None,
        vector: dict[str, Any] | None = None,
        infographic: dict[str, Any] | None = None,
        element_patch: dict[str, Any] | None = None,
        position: dict[str, Any] | None = None,
        size: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        from services.chat.slide_ui_helpers import (
            _apply_element_style_patch,
            _apply_image_element_value,
            _component_id_for_path,
            _content_update_requested_for_type,
            _looks_like_asset_reference,
            _normalize_chart_element,
            _resolve_element_path,
            _resolve_image_update_payload,
            _validate_current_element_model,
            _update_chart_element,
            _update_infographic_element,
            _update_table_element,
            _update_table_cell,
            _update_text_element,
            _update_text_list_element,
            _update_vector_element,
        )

        slide = await self._get_slide_by_index(index)
        if not slide:
            return {"updated": False, "message": f"No slide found at index {max(0, index)}."}
        ui = self._slide_ui_layout(slide)
        if ui is None:
            return {
                "updated": False,
                "message": "This slide has no editable ui layout; use saveSlide instead.",
            }

        ui = copy.deepcopy(ui)
        element = _resolve_element_path(ui, element_path)
        element_type = str(element.get("type") or "")
        theme = await self._get_current_theme()
        element_updated = False
        if element_patch is not None:
            if "type" in element_patch and not isinstance(element_patch.get("type"), str):
                raise ValueError("element.type must be a string when provided.")
            self._merge_ui_patch(element, element_patch)
            self._sync_ui_text_fields(element)
            _apply_element_style_patch(element, element_patch)
            element_type = str(element.get("type") or element_type)
            if element_type == "chart":
                _normalize_chart_element(element, theme)
            element_updated = True
        content_update_requested = _content_update_requested_for_type(
            element_type,
            text=text,
            items=items,
            table_cell=table_cell,
            table=table,
            chart=chart,
            vector=vector,
            infographic=infographic,
        )

        if content_update_requested and element_type == "text":
            if text is None:
                raise ValueError("text is required for text elements.")
            _update_text_element(element, text)
        elif content_update_requested and element_type == "math":
            if text is None:
                raise ValueError("text is required for math elements.")
            normalized_latex = text.strip()
            if (
                normalized_latex.startswith("$$")
                and normalized_latex.endswith("$$")
                and len(normalized_latex) > 4
            ):
                normalized_latex = normalized_latex[2:-2].strip()
            elif (
                normalized_latex.startswith(r"\[")
                and normalized_latex.endswith(r"\]")
                and len(normalized_latex) > 4
            ):
                normalized_latex = normalized_latex[2:-2].strip()
            if not normalized_latex:
                raise ValueError("Math expressions cannot be empty.")
            element["latex"] = normalized_latex[:4000]
        elif content_update_requested and element_type == "text-list":
            if items is None:
                raise ValueError("items is required for text-list elements.")
            _update_text_list_element(element, items)
        elif content_update_requested and element_type == "table":
            if table is not None:
                _update_table_element(element, table)
            elif table_cell is not None:
                _update_table_cell(element, table_cell)
            else:
                raise ValueError("table or tableCell is required for table elements.")
        elif content_update_requested and element_type == "chart":
            if chart is None:
                raise ValueError("chart is required for chart elements.")
            _update_chart_element(element, chart, theme)
        elif content_update_requested and element_type == "vector":
            if vector is None:
                raise ValueError("vector is required for vector content updates.")
            _update_vector_element(element, vector)
        elif content_update_requested and element_type == "infographic":
            if infographic is None:
                raise ValueError(
                    "infographic is required for infographic content updates."
                )
            _update_infographic_element(element, infographic)
        elif content_update_requested and element_type == "image":
            payload = _resolve_image_update_payload(text, items)
            if payload is None:
                raise ValueError(
                    "Image/icon updates require `text` with a URL returned by "
                    "generateAssets, generateImage, or generateIcon."
                )
            if isinstance(payload, str) and not _looks_like_asset_reference(payload):
                generated_url = await (
                    self.generate_icon(payload)
                    if element.get("is_icon") is True
                    else self.generate_image(payload)
                )
                element["data"] = generated_url
                element["prompt"] = payload.strip()
            else:
                _apply_image_element_value(element, payload)
        elif content_update_requested:
            raise ValueError(f"Element type '{element_type}' is not content-editable.")

        geometry_updated = self._update_ui_element_box(
            element,
            position=position,
            size=size,
        )
        if not content_update_requested and not geometry_updated and not element_updated:
            raise ValueError("No element content or geometry update was provided.")
        _validate_current_element_model(element)

        await self._save_slide_ui(slide, ui)
        component_id = _component_id_for_path(ui, element_path)
        return {
            "updated": True,
            "index": slide.index,
            "slide_number": slide.index + 1,
            "component_id": component_id,
            "element_path": element_path,
            "element_type": element_type,
            "position": element.get("position"),
            "size": element.get("size"),
            "message": (
                f"Updated {element_type} content on slide {slide.index + 1}."
            ),
        }

    async def update_slide_ui_component(
        self,
        *,
        index: int,
        component_id: str,
        action: str | None = None,
        component_ids: list[str] | None = None,
        position: dict[str, Any] | None = None,
        size: dict[str, Any] | None = None,
        replacement_component: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        slide = await self._get_slide_by_index(index)
        if not slide:
            return {"updated": False, "message": f"No slide found at index {max(0, index)}."}
        ui = self._slide_ui_layout(slide)
        if ui is None:
            return {
                "updated": False,
                "message": "This slide has no editable ui layout; use saveSlide instead.",
            }

        ui = copy.deepcopy(ui)
        components = ui.get("components")
        if not isinstance(components, list):
            return {"updated": False, "message": "Slide has no components list."}

        normalized_action = self._normalize_component_action(action)

        if normalized_action == "ungroup":
            return await self._ungroup_slide_ui_component(
                slide=slide,
                ui=ui,
                components=components,
                component_id=component_id,
            )
        if normalized_action == "group":
            return await self._group_slide_ui_components(
                slide=slide,
                ui=ui,
                components=components,
                component_id=component_id,
                component_ids=component_ids or [component_id],
            )
        if normalized_action == "duplicate":
            return await self._duplicate_slide_ui_component(
                slide=slide,
                ui=ui,
                components=components,
                component_id=component_id,
            )
        if normalized_action in {
            "bring-to-front",
            "bring-forward",
            "send-backward",
            "send-to-back",
        }:
            return await self._reorder_slide_ui_component(
                slide=slide,
                ui=ui,
                components=components,
                component_id=component_id,
                action=normalized_action,
            )

        component = next(
            (
                candidate
                for candidate in components
                if isinstance(candidate, dict) and candidate.get("id") == component_id
            ),
            None,
        )
        if component is None:
            return {
                "updated": False,
                "message": f"Component '{component_id}' was not found.",
            }
        updated = False
        if replacement_component is not None:
            from services.chat.slide_ui_helpers import (
                _normalize_chart_tree,
                _normalize_image_tree,
                _validate_chart_insert_tree,
            )

            if not isinstance(replacement_component.get("elements"), list):
                raise ValueError("replacement component must include elements.")
            replacement = copy.deepcopy(replacement_component)
            _normalize_image_tree(replacement)
            _validate_chart_insert_tree(replacement)
            replacement["id"] = component_id
            replacement.setdefault("description", component.get("description"))
            replacement.setdefault("position", component.get("position"))
            replacement.pop("size", None)
            component_index = components.index(component)
            components[component_index] = replacement
            component = replacement
            self._sync_ui_text_fields(component)
            self._normalize_added_visual_block(component)
            _normalize_chart_tree(component, await self._get_current_theme())
            self._fit_component_to_stage(component)
            updated = True
        if size is not None:
            # Match the editor's corner-resize behavior. Updating only the
            # component frame leaves a standalone chart/image/table at its old
            # size and creates empty space inside the enlarged selection box.
            if self._scale_component_contents_for_resize(component, size):
                updated = True
        if self._update_ui_box(component, position=position):
            updated = True
        if not updated:
            raise ValueError("No component geometry update was provided.")

        await self._save_slide_ui(slide, ui)
        return {
            "updated": True,
            "index": slide.index,
            "slide_number": slide.index + 1,
            "component_id": component_id,
            "position": component.get("position"),
            "box": self._component_box(component),
            "message": f"Updated component '{component_id}' on slide {slide.index + 1}.",
        }

    async def _ungroup_slide_ui_component(
        self,
        *,
        slide: SlideModel,
        ui: dict[str, Any],
        components: list[Any],
        component_id: str,
    ) -> dict[str, Any]:
        from services.chat.slide_ui_helpers import _ungrouped_components_from_component

        component_index, component = next(
            (
                (idx, candidate)
                for idx, candidate in enumerate(components)
                if isinstance(candidate, dict) and candidate.get("id") == component_id
            ),
            (None, None),
        )
        if component_index is None or not isinstance(component, dict):
            return {
                "updated": False,
                "message": f"Component '{component_id}' was not found.",
            }

        parts = _ungrouped_components_from_component(
            component,
            component_index,
            used_ids={
                str(item.get("id"))
                for idx, item in enumerate(components)
                if idx != component_index and isinstance(item, dict)
            },
        )
        if not parts:
            raise ValueError("Component does not contain safely separable elements.")

        components[component_index : component_index + 1] = parts
        await self._save_slide_ui(slide, ui)
        return {
            "updated": True,
            "action": "ungrouped",
            "index": slide.index,
            "slide_number": slide.index + 1,
            "component_id": component_id,
            "created_component_ids": [part["id"] for part in parts],
            "message": f"Ungrouped component '{component_id}' on slide {slide.index + 1}.",
        }

    async def _group_slide_ui_components(
        self,
        *,
        slide: SlideModel,
        ui: dict[str, Any],
        components: list[Any],
        component_id: str,
        component_ids: list[str],
    ) -> dict[str, Any]:
        requested_ids = []
        for raw_id in [component_id, *component_ids]:
            if raw_id and raw_id not in requested_ids:
                requested_ids.append(raw_id)
        if len(requested_ids) < 2:
            raise ValueError("Grouping requires at least two component ids.")

        selected: list[tuple[int, dict[str, Any]]] = []
        for idx, component in enumerate(components):
            if isinstance(component, dict) and component.get("id") in requested_ids:
                selected.append((idx, component))
        found_ids = {str(component.get("id")) for _, component in selected}
        missing_ids = [item for item in requested_ids if item not in found_ids]
        if missing_ids:
            raise ValueError(f"Component(s) not found: {', '.join(missing_ids)}")

        boxes = [
            self._component_box(component)
            for _, component in selected
        ]
        if any(box is None for box in boxes):
            raise ValueError("Cannot group components without valid derived bounds.")
        typed_boxes = [box for box in boxes if box is not None]
        left = min(box["x"] for box in typed_boxes)
        top = min(box["y"] for box in typed_boxes)
        right = max(box["x"] + box["width"] for box in typed_boxes)
        bottom = max(box["y"] + box["height"] for box in typed_boxes)

        grouped_elements: list[dict[str, Any]] = []
        for (_, component), box in zip(selected, typed_boxes):
            elements = component.get("elements")
            if not isinstance(elements, list):
                continue
            for element in elements:
                if not isinstance(element, dict):
                    continue
                copied = copy.deepcopy(element)
                element_position = copied.get("position")
                if isinstance(element_position, dict):
                    copied["position"] = {
                        "x": float(box["x"]) + float(element_position.get("x") or 0) - left,
                        "y": float(box["y"]) + float(element_position.get("y") or 0) - top,
                    }
                else:
                    copied["position"] = {
                        "x": float(box["x"]) - left,
                        "y": float(box["y"]) - top,
                    }
                grouped_elements.append(copied)

        if not grouped_elements:
            raise ValueError("Cannot group components with no elements.")

        first_index = min(idx for idx, _ in selected)
        selected_indices = {idx for idx, _ in selected}
        group_id = self._unique_ui_component_id(component_id or "group", [
            component
            for idx, component in enumerate(components)
            if idx not in selected_indices
        ])
        group_component = {
            "id": group_id,
            "description": "Grouped component",
            "position": {"x": left, "y": top},
            "elements": grouped_elements,
        }

        next_components = [
            component
            for idx, component in enumerate(components)
            if idx not in selected_indices
        ]
        next_components.insert(first_index, group_component)
        ui["components"] = next_components
        await self._save_slide_ui(slide, ui)
        return {
            "updated": True,
            "action": "grouped",
            "index": slide.index,
            "slide_number": slide.index + 1,
            "component_id": group_id,
            "grouped_component_ids": requested_ids,
            "message": f"Grouped {len(selected)} components on slide {slide.index + 1}.",
        }

    async def _duplicate_slide_ui_component(
        self,
        *,
        slide: SlideModel,
        ui: dict[str, Any],
        components: list[Any],
        component_id: str,
    ) -> dict[str, Any]:
        component_index, component = self._find_ui_component(components, component_id)
        if component_index is None or not isinstance(component, dict):
            return {
                "updated": False,
                "message": f"Component '{component_id}' was not found.",
            }

        duplicate = copy.deepcopy(component)
        duplicate_id = self._unique_ui_component_id(f"{component_id}_copy", components)
        duplicate["id"] = duplicate_id
        position = duplicate.get("position")
        if isinstance(position, dict):
            duplicate["position"] = {
                **position,
                "x": float(position.get("x") or 0) + 16,
                "y": float(position.get("y") or 0) + 16,
            }
        components.insert(component_index + 1, duplicate)
        await self._save_slide_ui(slide, ui)
        return {
            "updated": True,
            "action": "duplicated",
            "index": slide.index,
            "slide_number": slide.index + 1,
            "component_id": duplicate_id,
            "source_component_id": component_id,
            "message": f"Duplicated component '{component_id}' on slide {slide.index + 1}.",
        }

    async def _reorder_slide_ui_component(
        self,
        *,
        slide: SlideModel,
        ui: dict[str, Any],
        components: list[Any],
        component_id: str,
        action: str,
    ) -> dict[str, Any]:
        component_index, component = self._find_ui_component(components, component_id)
        if component_index is None or component is None:
            return {
                "updated": False,
                "message": f"Component '{component_id}' was not found.",
            }

        target_index = self._component_layer_target_index(
            component_index,
            len(components),
            action,
        )
        if target_index == component_index:
            return {
                "updated": False,
                "action": action,
                "index": slide.index,
                "slide_number": slide.index + 1,
                "component_id": component_id,
                "message": f"Component '{component_id}' is already at that layer.",
            }

        moved = components.pop(component_index)
        components.insert(target_index, moved)
        await self._save_slide_ui(slide, ui)
        return {
            "updated": True,
            "action": action,
            "index": slide.index,
            "slide_number": slide.index + 1,
            "component_id": component_id,
            "component_index": target_index,
            "message": f"Reordered component '{component_id}' on slide {slide.index + 1}.",
        }

    @staticmethod
    def _normalize_component_action(action: str | None) -> str:
        return {
            "bringToFront": "bring-to-front",
            "bringForward": "bring-forward",
            "sendBackward": "send-backward",
            "sendToBack": "send-to-back",
        }.get(action or "update", action or "update")

    @staticmethod
    def _component_layer_target_index(
        component_index: int,
        component_count: int,
        action: str,
    ) -> int:
        if component_count <= 1:
            return component_index
        if action == "send-to-back":
            return 0
        if action == "send-backward":
            return max(0, component_index - 1)
        if action == "bring-forward":
            return min(component_count - 1, component_index + 1)
        if action == "bring-to-front":
            return component_count - 1
        return component_index

    @staticmethod
    def _find_ui_component(
        components: list[Any],
        component_id: str,
    ) -> tuple[int | None, dict[str, Any] | None]:
        return next(
            (
                (idx, candidate)
                for idx, candidate in enumerate(components)
                if isinstance(candidate, dict) and candidate.get("id") == component_id
            ),
            (None, None),
        )

    @staticmethod
    def _component_box(component: dict[str, Any]) -> dict[str, float] | None:
        position = component.get("position")
        if not isinstance(position, dict):
            return None
        x = position.get("x")
        y = position.get("y")
        content_size = PresentationChatMemoryLayer._component_content_size(component)
        if content_size is None:
            return None
        width = content_size.get("width")
        height = content_size.get("height")
        if not all(
            isinstance(value, (int, float))
            for value in (x, y, width, height)
        ):
            return None
        if width <= 0 or height <= 0:
            return None
        return {
            "x": float(x),
            "y": float(y),
            "width": float(width),
            "height": float(height),
        }

    @staticmethod
    def _component_content_size(component: dict[str, Any]) -> dict[str, float] | None:
        elements = component.get("elements")
        if not isinstance(elements, list):
            return None
        width = 1.0
        height = 1.0
        has_element = False
        for element in elements:
            if not isinstance(element, dict):
                continue
            box = PresentationChatMemoryLayer._element_local_box(element)
            if box is None:
                continue
            has_element = True
            width = max(width, box["x"] + box["width"])
            height = max(height, box["y"] + box["height"])
        if not has_element:
            return None
        return {"width": width, "height": height}

    @staticmethod
    def _element_local_box(element: dict[str, Any]) -> dict[str, float] | None:
        element_type = str(element.get("type") or "").lower()
        if element_type == "vector":
            return PresentationChatMemoryLayer._vector_element_box(element)

        position = element.get("position")
        size = element.get("size")
        x = position.get("x") if isinstance(position, dict) else 0
        y = position.get("y") if isinstance(position, dict) else 0
        width = size.get("width") if isinstance(size, dict) else None
        height = size.get("height") if isinstance(size, dict) else None
        if not all(isinstance(value, (int, float)) for value in (x, y, width, height)):
            return None
        if width <= 0 or height <= 0:
            return None
        return {
            "x": float(x),
            "y": float(y),
            "width": float(width),
            "height": float(height),
        }

    @staticmethod
    def _vector_element_box(element: dict[str, Any]) -> dict[str, float] | None:
        points = element.get("points")
        if not isinstance(points, list):
            return None
        parsed = []
        for point in points:
            if not isinstance(point, dict):
                continue
            x = point.get("x")
            y = point.get("y")
            if isinstance(x, (int, float)) and isinstance(y, (int, float)):
                parsed.append((float(x), float(y)))
        if not parsed:
            return None
        min_x = min(point[0] for point in parsed)
        min_y = min(point[1] for point in parsed)
        max_x = max(point[0] for point in parsed)
        max_y = max(point[1] for point in parsed)
        stroke = element.get("stroke")
        stroke_width = 1.0
        if isinstance(stroke, dict) and isinstance(stroke.get("width"), (int, float)):
            stroke_width = max(0.0, float(stroke["width"]))
        return {
            "x": min_x,
            "y": min_y,
            "width": max(max_x - min_x, stroke_width, 1.0),
            "height": max(max_y - min_y, stroke_width, 1.0),
        }

    @classmethod
    def _scale_component_contents_for_resize(
        cls,
        component: dict[str, Any],
        target_size: dict[str, Any],
    ) -> bool:
        current_size = cls._component_content_size(component)
        if not isinstance(current_size, dict):
            return False
        current_width = current_size.get("width")
        current_height = current_size.get("height")
        target_width = target_size.get("width")
        target_height = target_size.get("height")
        if not all(
            isinstance(value, (int, float))
            for value in (current_width, current_height, target_width, target_height)
        ):
            return False
        if current_width <= 0 or current_height <= 0:
            return False

        scale_x = float(target_width) / float(current_width)
        scale_y = float(target_height) / float(current_height)
        if abs(scale_x - 1.0) < 0.001 and abs(scale_y - 1.0) < 0.001:
            return False

        elements = component.get("elements")
        if not isinstance(elements, list):
            return False
        font_scale = (scale_x * scale_y) ** 0.5
        for element in elements:
            if isinstance(element, dict):
                cls._scale_ui_element_for_component_resize(
                    element,
                    scale_x=scale_x,
                    scale_y=scale_y,
                    font_scale=font_scale,
                )
        return True

    @classmethod
    def _scale_ui_element_for_component_resize(
        cls,
        element: dict[str, Any],
        *,
        scale_x: float,
        scale_y: float,
        font_scale: float,
    ) -> None:
        position = element.get("position")
        if isinstance(position, dict):
            x = position.get("x")
            y = position.get("y")
            if isinstance(x, (int, float)) and isinstance(y, (int, float)):
                element["position"] = {
                    "x": float(x) * scale_x,
                    "y": float(y) * scale_y,
                }

        size = element.get("size")
        if isinstance(size, dict):
            width = size.get("width")
            height = size.get("height")
            if isinstance(width, (int, float)) and isinstance(height, (int, float)):
                element["size"] = {
                    "width": max(1.0, float(width) * scale_x),
                    "height": max(1.0, float(height) * scale_y),
                }

        if str(element.get("type") or "").lower() == "vector":
            points = element.get("points")
            if isinstance(points, list):
                element["points"] = [
                    cls._scale_vector_point(point, scale_x=scale_x, scale_y=scale_y)
                    for point in points
                ]

        if str(element.get("type") or "").lower() in {
            "text",
            "math",
            "text-list",
            "table",
        }:
            cls._scale_font_metrics_for_component_resize(element, font_scale)

        for key in ("children", "elements"):
            children = element.get(key)
            if isinstance(children, list):
                for child in children:
                    if isinstance(child, dict):
                        cls._scale_ui_element_for_component_resize(
                            child,
                            scale_x=scale_x,
                            scale_y=scale_y,
                            font_scale=font_scale,
                        )
        child = element.get("child")
        if isinstance(child, dict):
            cls._scale_ui_element_for_component_resize(
                child,
                scale_x=scale_x,
                scale_y=scale_y,
                font_scale=font_scale,
            )

    @staticmethod
    def _scale_vector_point(
        point: Any,
        *,
        scale_x: float,
        scale_y: float,
    ) -> Any:
        if not isinstance(point, dict):
            return point
        x = point.get("x")
        y = point.get("y")
        if not isinstance(x, (int, float)) or not isinstance(y, (int, float)):
            return point
        return {
            **point,
            "x": float(x) * scale_x,
            "y": float(y) * scale_y,
        }

    @classmethod
    def _scale_font_metrics_for_component_resize(
        cls,
        value: Any,
        scale: float,
    ) -> None:
        if isinstance(value, list):
            for item in value:
                cls._scale_font_metrics_for_component_resize(item, scale)
            return
        if not isinstance(value, dict):
            return

        font = value.get("font")
        if isinstance(font, dict):
            size = font.get("size")
            if isinstance(size, (int, float)):
                font["size"] = min(512.0, max(1.0, round(float(size) * scale, 2)))
            for key in ("letter_spacing", "letterSpacing"):
                spacing = font.get(key)
                if isinstance(spacing, (int, float)):
                    font[key] = round(float(spacing) * scale, 2)

        # Child layout nodes are scaled separately so their text metrics are
        # not applied twice. These fields contain only text/table content.
        for key, child_value in value.items():
            if key in {"font", "children", "elements", "child"}:
                continue
            if isinstance(child_value, (dict, list)):
                cls._scale_font_metrics_for_component_resize(child_value, scale)

    async def delete_slide_ui_component(
        self, *, index: int, component_id: str
    ) -> dict[str, Any]:
        slide = await self._get_slide_by_index(index)
        if not slide:
            return {"deleted": False, "message": f"No slide found at index {max(0, index)}."}
        ui = self._slide_ui_layout(slide)
        if ui is None:
            return {
                "deleted": False,
                "message": "This slide has no editable ui layout; use saveSlide instead.",
            }

        ui = copy.deepcopy(ui)
        components = ui.get("components")
        before = len(components)
        ui["components"] = [
            component
            for component in components
            if not (
                isinstance(component, dict) and component.get("id") == component_id
            )
        ]
        if len(ui["components"]) == before:
            return {
                "deleted": False,
                "message": f"Component '{component_id}' was not found on slide {slide.index + 1}.",
            }

        await self._save_slide_ui(slide, ui)
        return {
            "deleted": True,
            "index": slide.index,
            "slide_number": slide.index + 1,
            "component_id": component_id,
            "message": (
                f"Deleted component '{component_id}' from slide {slide.index + 1}."
            ),
        }

    async def delete_slide_ui_element(
        self, *, index: int, element_path: str
    ) -> dict[str, Any]:
        from services.chat.slide_ui_helpers import _component_id_for_path

        slide = await self._get_slide_by_index(index)
        if not slide:
            return {"deleted": False, "message": f"No slide found at index {max(0, index)}."}
        ui = self._slide_ui_layout(slide)
        if ui is None:
            return {
                "deleted": False,
                "message": "This slide has no editable ui layout; use saveSlide instead.",
            }

        ui = copy.deepcopy(ui)
        removed = self._remove_element_at_path(ui, element_path)
        if not removed:
            return {
                "deleted": False,
                "message": (
                    f"Could not delete element at '{element_path}'. Only indexed "
                    "elements[] / children[] entries can be removed; to remove a whole "
                    "component use deleteComponent."
                ),
            }

        component_id = _component_id_for_path(ui, element_path)
        await self._save_slide_ui(slide, ui)
        return {
            "deleted": True,
            "index": slide.index,
            "slide_number": slide.index + 1,
            "component_id": component_id,
            "element_path": element_path,
            "message": f"Deleted element '{element_path}' on slide {slide.index + 1}.",
        }

    async def add_slide_ui_component(
        self,
        *,
        index: int,
        component: dict[str, Any],
        insert_index: int | None = None,
    ) -> dict[str, Any]:
        slide = await self._get_slide_by_index(index)
        if not slide:
            return {"added": False, "message": f"No slide found at index {max(0, index)}."}
        ui = self._slide_ui_layout(slide)
        if ui is None:
            return {
                "added": False,
                "message": "This slide has no editable ui layout; use saveSlide instead.",
            }
        if not isinstance(component, dict):
            raise ValueError("component must be a JSON object.")
        elements = component.get("elements")
        if not isinstance(elements, list) or not elements:
            raise ValueError("component.elements must be a non-empty list.")
        from services.chat.slide_ui_helpers import (
            _normalize_chart_tree,
            _normalize_image_tree,
            _validate_chart_insert_tree,
        )

        ui = copy.deepcopy(ui)
        components = ui.get("components")
        new_component = copy.deepcopy(component)
        _normalize_image_tree(new_component)
        _validate_chart_insert_tree(new_component)
        existing_ids = {
            str(existing.get("id"))
            for existing in components
            if isinstance(existing, dict) and existing.get("id")
        }
        new_id = str(new_component.get("id") or "").strip()
        if not new_id or new_id in existing_ids:
            base = new_id or "component"
            suffix = len(components) + 1
            candidate = f"{base}_{suffix}"
            while candidate in existing_ids:
                suffix += 1
                candidate = f"{base}_{suffix}"
            new_id = candidate
        new_component["id"] = new_id
        new_component.setdefault(
            "description", f"Component {new_id} added via assistant."
        )
        # Keep assistant-authored text content in the canonical renderable shape.
        self._sync_ui_text_fields(new_component)
        self._normalize_added_visual_block(new_component)
        _normalize_chart_tree(new_component, await self._get_current_theme())
        self._fit_component_to_stage(new_component)

        position = (
            len(components)
            if insert_index is None
            else min(max(0, insert_index), len(components))
        )
        components.insert(position, new_component)

        await self._save_slide_ui(slide, ui)
        return {
            "added": True,
            "index": slide.index,
            "slide_number": slide.index + 1,
            "component_id": new_id,
            "component_index": position,
            "message": (
                f"Added component '{new_id}' to slide {slide.index + 1}."
            ),
        }

    async def add_slide_ui_element(
        self,
        *,
        index: int,
        element: dict[str, Any],
        component_id: str | None = None,
        insert_index: int | None = None,
    ) -> dict[str, Any]:
        slide = await self._get_slide_by_index(index)
        if not slide:
            return {"added": False, "message": f"No slide found at index {max(0, index)}."}
        ui = self._slide_ui_layout(slide)
        if ui is None:
            return {
                "added": False,
                "message": "This slide has no editable ui layout; use saveSlide instead.",
            }
        from services.chat.slide_ui_helpers import (
            _normalize_chart_element,
            _normalize_image_tree,
            _validate_chart_insert_tree,
        )

        ui = copy.deepcopy(ui)
        components = ui.get("components")
        if not isinstance(components, list):
            return {"added": False, "message": "Slide has no components list."}

        new_element = copy.deepcopy(element)
        _normalize_image_tree(new_element)
        _validate_chart_insert_tree(new_element)
        if component_id:
            component_index, component = next(
                (
                    (idx, candidate)
                    for idx, candidate in enumerate(components)
                    if isinstance(candidate, dict) and candidate.get("id") == component_id
                ),
                (None, None),
            )
            if component_index is None or not isinstance(component, dict):
                return {
                    "added": False,
                    "message": f"Component '{component_id}' was not found.",
                }
            elements = component.setdefault("elements", [])
            if not isinstance(elements, list):
                raise ValueError("Target component has no elements list.")
            position = len(elements) if insert_index is None else min(max(0, insert_index), len(elements))
            elements.insert(position, new_element)
            path = f"components[{component_index}].elements[{position}]"
        else:
            position_box = new_element.get("position") if isinstance(new_element.get("position"), dict) else {}
            size_box = new_element.get("size") if isinstance(new_element.get("size"), dict) else {}
            is_vector = str(new_element.get("type") or "").lower() == "vector"
            vector_box = self._vector_element_box(new_element) if is_vector else None
            component_x = float(
                position_box.get("x")
                if isinstance(position_box.get("x"), (int, float))
                else vector_box["x"]
                if vector_box is not None
                else 128
            )
            component_y = float(
                position_box.get("y")
                if isinstance(position_box.get("y"), (int, float))
                else vector_box["y"]
                if vector_box is not None
                else 120
            )
            component = {
                "id": self._unique_ui_component_id(
                    str(new_element.get("name") or new_element.get("type") or "element"),
                    components,
                ),
                "description": f"Element {new_element.get('type') or ''} added via assistant.".strip(),
                "position": {
                    "x": component_x,
                    "y": component_y,
                },
                "elements": [new_element],
            }
            if is_vector and vector_box is not None:
                target_size = (
                    {
                        "width": float(size_box["width"]),
                        "height": float(size_box["height"]),
                    }
                    if isinstance(size_box.get("width"), (int, float))
                    and isinstance(size_box.get("height"), (int, float))
                    else None
                )
                self._update_ui_element_box(
                    new_element,
                    position={"x": 0.0, "y": 0.0},
                    size=target_size,
                )
            else:
                new_element["position"] = {"x": 0, "y": 0}
                new_element["size"] = {
                    "width": float(size_box.get("width") or 320),
                    "height": float(size_box.get("height") or 120),
                }
            self._normalize_added_visual_block(component)
            self._fit_component_to_stage(component)
            component_position = len(components) if insert_index is None else min(max(0, insert_index), len(components))
            components.insert(component_position, component)
            component_id = str(component["id"])
            path = f"components[{component_position}].elements[0]"

        self._sync_ui_text_fields(new_element)
        if new_element.get("type") == "chart":
            _normalize_chart_element(new_element, await self._get_current_theme())
        await self._save_slide_ui(slide, ui)
        return {
            "added": True,
            "index": slide.index,
            "slide_number": slide.index + 1,
            "component_id": component_id,
            "element_path": path,
            "message": f"Added element on slide {slide.index + 1}.",
        }

    @staticmethod
    def _unique_ui_component_id(base: str, components: list[Any]) -> str:
        normalized = re.sub(r"[^a-z0-9]+", "_", base.strip().lower()).strip("_") or "component"
        used = {
            str(component.get("id"))
            for component in components
            if isinstance(component, dict) and component.get("id")
        }
        candidate = normalized[:80]
        suffix = 2
        while candidate in used:
            suffix_text = f"_{suffix}"
            candidate = f"{normalized[: 80 - len(suffix_text)]}{suffix_text}"
            suffix += 1
        return candidate

    @staticmethod
    def _merge_ui_patch(target: dict[str, Any], patch: dict[str, Any]) -> None:
        for key, value in patch.items():
            if isinstance(value, dict) and isinstance(target.get(key), dict):
                PresentationChatMemoryLayer._merge_ui_patch(target[key], value)
            else:
                target[key] = copy.deepcopy(value)

    @staticmethod
    def _sync_ui_text_fields(node: Any) -> None:
        """Recursively keep assistant-authored text content renderable."""
        if isinstance(node, dict):
            if node.get("type") == "text":
                runs = node.get("runs")
                if isinstance(runs, list) and runs:
                    joined = "".join(
                        str(run.get("text") or "")
                        for run in runs
                        if isinstance(run, dict)
                    )
                    node["text"] = joined
                elif isinstance(node.get("text"), str):
                    node["runs"] = [{"text": node["text"]}]
            elif node.get("type") == "table":
                PresentationChatMemoryLayer._sync_ui_table_cells(node)
            for value in node.values():
                PresentationChatMemoryLayer._sync_ui_text_fields(value)
        elif isinstance(node, list):
            for value in node:
                PresentationChatMemoryLayer._sync_ui_text_fields(value)

    @staticmethod
    def _sync_ui_table_cells(element: dict[str, Any]) -> None:
        fallback_font = element.get("font")
        columns = element.get("columns")
        if not isinstance(columns, list) and isinstance(element.get("headers"), list):
            columns = element["headers"]
        if isinstance(columns, list):
            element["columns"] = [
                PresentationChatMemoryLayer._normalized_ui_table_cell(
                    cell,
                    fallback_font,
                )
                for cell in columns
            ]

        rows = element.get("rows")
        if isinstance(rows, list):
            element["rows"] = [
                [
                    PresentationChatMemoryLayer._normalized_ui_table_cell(
                        cell,
                        fallback_font,
                    )
                    for cell in row
                ]
                if isinstance(row, list)
                else row
                for row in rows
            ]

    @staticmethod
    def _normalized_ui_table_cell(cell: Any, fallback_font: Any) -> dict[str, Any]:
        if isinstance(cell, dict):
            normalized = copy.deepcopy(cell)
            cell_font = normalized.get("font") or fallback_font
            existing_runs = normalized.get("runs")
            normalized_runs = (
                PresentationChatMemoryLayer._normalized_ui_text_runs(
                    existing_runs,
                    cell_font,
                )
                if isinstance(existing_runs, list)
                else []
            )
            alias_text = PresentationChatMemoryLayer._table_cell_alias_text(normalized)
            if normalized_runs and (
                PresentationChatMemoryLayer._runs_plain_text(normalized_runs)
                or not alias_text
            ):
                normalized["runs"] = normalized_runs
            else:
                normalized["runs"] = PresentationChatMemoryLayer._replacement_runs_from_existing(
                    existing_runs,
                    alias_text,
                    cell_font,
                )
            return normalized

        return {
            "runs": PresentationChatMemoryLayer._replacement_runs_from_existing(
                None,
                PresentationChatMemoryLayer._table_cell_text_value(cell),
                fallback_font,
            )
        }

    @staticmethod
    def _normalized_ui_text_runs(runs: list[Any], fallback_font: Any) -> list[dict[str, Any]]:
        normalized: list[dict[str, Any]] = []
        for run in runs:
            if isinstance(run, dict):
                next_run = copy.deepcopy(run)
                next_run["text"] = PresentationChatMemoryLayer._table_cell_text_value(
                    next_run.get("text")
                    if "text" in next_run
                    else next_run.get("content")
                    if "content" in next_run
                    else next_run.get("value")
                )
                normalized.append(next_run)
            else:
                next_run = {
                    "text": PresentationChatMemoryLayer._table_cell_text_value(run)
                }
                if isinstance(fallback_font, dict):
                    next_run["font"] = copy.deepcopy(fallback_font)
                normalized.append(next_run)
        return normalized

    @staticmethod
    def _runs_plain_text(runs: list[dict[str, Any]]) -> str:
        return "".join(str(run.get("text") or "") for run in runs)

    @staticmethod
    def _table_cell_alias_text(cell: dict[str, Any]) -> str:
        for key in ("text", "content", "value", "label", "data"):
            if key in cell:
                return PresentationChatMemoryLayer._table_cell_text_value(cell[key])
        return ""

    @staticmethod
    def _table_cell_text_value(value: Any) -> str:
        if value is None:
            return ""
        if isinstance(value, (str, int, float, bool)):
            return str(value)
        if isinstance(value, list):
            return "".join(
                PresentationChatMemoryLayer._table_cell_text_value(item)
                for item in value
            )
        if isinstance(value, dict):
            runs = value.get("runs")
            if isinstance(runs, list):
                text = "".join(
                    PresentationChatMemoryLayer._table_cell_text_value(run)
                    for run in runs
                )
                if text:
                    return text
            for key in ("text", "content", "value", "label", "data"):
                if key in value:
                    return PresentationChatMemoryLayer._table_cell_text_value(value[key])
            return ""
        return str(value)

    @staticmethod
    def _normalize_added_visual_block(component: dict[str, Any]) -> None:
        kind = PresentationChatMemoryLayer._insert_visual_kind(component)
        if kind is None:
            return
        defaults = DEFAULT_INSERT_BOXES[kind]
        min_size = defaults["min_size"]
        for element in component.get("elements", []):
            if not isinstance(element, dict) or element.get("type") != kind:
                continue
            if PresentationChatMemoryLayer._box_too_small(
                element.get("size"),
                min_size,
            ):
                component["position"] = copy.deepcopy(defaults["position"])
                element["position"] = {"x": 0, "y": 0}
                element["size"] = copy.deepcopy(defaults["size"])

    @staticmethod
    def _fit_component_to_stage(component: dict[str, Any]) -> None:
        position = component.get("position")
        box = PresentationChatMemoryLayer._component_box(component)
        if not isinstance(position, dict) or box is None:
            return
        x = position.get("x")
        y = position.get("y")
        width = box.get("width")
        height = box.get("height")
        if not all(isinstance(value, (int, float)) for value in (x, y, width, height)):
            return
        width = max(1.0, float(width))
        height = max(1.0, float(height))
        scale = min(SLIDE_STAGE_WIDTH / width, SLIDE_STAGE_HEIGHT / height, 1.0)
        if scale < 1.0:
            PresentationChatMemoryLayer._scale_component_contents_for_resize(
                component,
                {
                    "width": width * scale,
                    "height": height * scale,
                },
            )
            box = PresentationChatMemoryLayer._component_box(component)
            if box is None:
                return
            width = min(max(1.0, float(box["width"])), SLIDE_STAGE_WIDTH)
            height = min(max(1.0, float(box["height"])), SLIDE_STAGE_HEIGHT)
        component["position"] = {
            "x": min(max(0.0, float(x)), SLIDE_STAGE_WIDTH - width),
            "y": min(max(0.0, float(y)), SLIDE_STAGE_HEIGHT - height),
        }

    @staticmethod
    def _insert_visual_kind(component: dict[str, Any]) -> str | None:
        elements = component.get("elements")
        if not isinstance(elements, list):
            return None
        types = {
            element.get("type")
            for element in elements
            if isinstance(element, dict)
        }
        if "chart" in types:
            return "chart"
        if "table" in types:
            return "table"
        return None

    @staticmethod
    def _box_too_small(size: Any, min_size: dict[str, float]) -> bool:
        if not isinstance(size, dict):
            return True
        width = size.get("width")
        height = size.get("height")
        if not isinstance(width, (int, float)) or not isinstance(height, (int, float)):
            return True
        return width < min_size["width"] or height < min_size["height"]

    @staticmethod
    def _remove_element_at_path(ui: dict[str, Any], path: str) -> bool:
        segments = path.split(".")
        if not segments:
            return False

        last = segments[-1]
        match = re.match(r"^(components|elements|children)\[(\d+)\]$", last)
        if not match:
            return False
        key = match.group(1)
        target_index = int(match.group(2))

        parent: Any = ui
        for segment in segments[:-1]:
            if segment == "child":
                if not isinstance(parent, dict) or not isinstance(
                    parent.get("child"), dict
                ):
                    return False
                parent = parent["child"]
                continue
            seg_match = re.match(r"^(components|elements|children)\[(\d+)\]$", segment)
            if not seg_match:
                return False
            seg_key = seg_match.group(1)
            seg_index = int(seg_match.group(2))
            if not isinstance(parent, dict) or not isinstance(parent.get(seg_key), list):
                return False
            values = parent[seg_key]
            if seg_index >= len(values) or not isinstance(values[seg_index], dict):
                return False
            parent = values[seg_index]

        if not isinstance(parent, dict) or not isinstance(parent.get(key), list):
            return False
        values = parent[key]
        if target_index >= len(values):
            return False
        values.pop(target_index)
        return True

    @classmethod
    def _update_ui_element_box(
        cls,
        target: dict[str, Any],
        *,
        position: dict[str, Any] | None = None,
        size: dict[str, Any] | None = None,
    ) -> bool:
        if str(target.get("type") or "").lower() != "vector":
            return cls._update_ui_box(target, position=position, size=size)
        if position is None and size is None:
            return False

        box = cls._vector_element_box(target)
        points = target.get("points")
        if box is None or not isinstance(points, list):
            raise ValueError("Vector geometry requires at least two numeric points.")

        next_x = float(position["x"]) if position is not None else box["x"]
        next_y = float(position["y"]) if position is not None else box["y"]
        next_width = float(size["width"]) if size is not None else box["width"]
        next_height = float(size["height"]) if size is not None else box["height"]
        scale_x = next_width / box["width"]
        scale_y = next_height / box["height"]

        target["points"] = [
            {
                **point,
                "x": next_x + (float(point["x"]) - box["x"]) * scale_x,
                "y": next_y + (float(point["y"]) - box["y"]) * scale_y,
            }
            for point in points
            if isinstance(point, dict)
            and isinstance(point.get("x"), (int, float))
            and isinstance(point.get("y"), (int, float))
        ]
        if size is not None and isinstance(target.get("corner_radii"), list):
            radius_scale = min(abs(scale_x), abs(scale_y))
            target["corner_radii"] = [
                float(value) * radius_scale
                if isinstance(value, (int, float))
                else value
                for value in target["corner_radii"]
            ]
        target.pop("position", None)
        target.pop("size", None)
        return True

    @staticmethod
    def _update_ui_box(
        target: dict[str, Any],
        *,
        position: dict[str, Any] | None = None,
        size: dict[str, Any] | None = None,
    ) -> bool:
        updated = False
        if position is not None:
            target["position"] = {
                "x": float(position["x"]),
                "y": float(position["y"]),
            }
            updated = True
        if size is not None:
            target["size"] = {
                "width": float(size["width"]),
                "height": float(size["height"]),
            }
            updated = True
        return updated

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
            current_theme_colors = self._extract_theme_colors(current_theme)
            current_theme_summary = {
                "id": str(current_theme.get("id") or "").strip(),
                "name": str(current_theme.get("name") or "").strip(),
                "description": str(current_theme.get("description") or "").strip(),
                "colors": current_theme_colors,
                "chart_colors": self._chart_palette_from_theme_colors(
                    current_theme_colors,
                ),
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

    async def _collect_template_block_candidates(
        self,
        presentation: PresentationModel,
    ) -> list[dict[str, Any]]:
        sources: list[tuple[str, dict[str, Any]]] = []
        if isinstance(presentation.layout, dict):
            sources.append(("presentation_layout", presentation.layout))

            seen_template_ids: set[str] = set()
            for key in ("name", "template_id"):
                template_id = self._extract_template_id(presentation.layout.get(key))
                if not template_id or template_id in seen_template_ids:
                    continue
                seen_template_ids.add(template_id)
                template = await self._sql_session.get(TemplateV2, template_id)
                if template:
                    sources.extend(self._template_block_sources(template))

        candidates: list[dict[str, Any]] = []
        seen_block_ids: set[str] = set()
        for source, payload in sources:
            candidates.extend(
                self._block_candidates_from_merged_components(
                    payload,
                    source=source,
                    seen_block_ids=seen_block_ids,
                )
            )
            candidates.extend(
                self._block_candidates_from_layouts(
                    payload,
                    source=source,
                    seen_block_ids=seen_block_ids,
                )
            )
        return candidates

    @staticmethod
    def _template_block_sources(template: TemplateV2) -> list[tuple[str, dict[str, Any]]]:
        sources: list[tuple[str, dict[str, Any]]] = []
        for label, payload in (
            ("template_merged_components", template.merged_components),
            ("template_components", template.components),
            ("template_layouts", template.layouts),
            ("template_raw_layouts", template.raw_layouts),
        ):
            if isinstance(payload, dict):
                sources.append((label, payload))
        return sources

    @classmethod
    def _block_candidates_from_merged_components(
        cls,
        payload: dict[str, Any],
        *,
        source: str,
        seen_block_ids: set[str],
    ) -> list[dict[str, Any]]:
        raw_components = payload.get("components")
        if not isinstance(raw_components, list):
            return []

        candidates: list[dict[str, Any]] = []
        for group_index, group in enumerate(raw_components):
            if not isinstance(group, dict):
                continue
            variants = group.get("variants")
            if not isinstance(variants, list):
                variants = [group]
            variant_count = len([item for item in variants if isinstance(item, dict)])
            for variant_index, component in enumerate(variants):
                if not isinstance(component, dict):
                    continue
                component_id = str(
                    component.get("id")
                    or group.get("id")
                    or f"component_{group_index + 1}"
                )
                block_id = cls._unique_block_id(
                    f"merged:{group.get('id') or component_id}:{variant_index}",
                    seen_block_ids,
                )
                candidates.append(
                    cls._build_block_candidate(
                        source=source,
                        block_id=block_id,
                        layout_id=None,
                        layout_description=None,
                        component=component,
                        component_id=component_id,
                        description=(
                            group.get("description")
                            or component.get("description")
                            or ""
                        ),
                        variant_index=variant_index,
                        variant_count=variant_count,
                    )
                )
        return candidates

    @classmethod
    def _block_candidates_from_layouts(
        cls,
        payload: dict[str, Any],
        *,
        source: str,
        seen_block_ids: set[str],
    ) -> list[dict[str, Any]]:
        layouts = payload.get("layouts")
        if not isinstance(layouts, list):
            return []

        candidates: list[dict[str, Any]] = []
        for layout_index, layout in enumerate(layouts):
            if not isinstance(layout, dict):
                continue
            components = layout.get("components")
            if not isinstance(components, list):
                continue
            layout_id = str(layout.get("id") or f"layout_{layout_index + 1}")
            layout_description = (
                str(layout.get("description"))
                if layout.get("description") is not None
                else None
            )
            for component_index, component in enumerate(components):
                if not isinstance(component, dict):
                    continue
                component_id = str(
                    component.get("id") or f"component_{component_index + 1}"
                )
                block_id = cls._unique_block_id(
                    f"layout:{layout_id}:{component_id}",
                    seen_block_ids,
                )
                candidates.append(
                    cls._build_block_candidate(
                        source=source,
                        block_id=block_id,
                        layout_id=layout_id,
                        layout_description=layout_description,
                        component=component,
                        component_id=component_id,
                        description=str(component.get("description") or ""),
                    )
                )
        return candidates

    @classmethod
    def _build_block_candidate(
        cls,
        *,
        source: str,
        block_id: str,
        layout_id: str | None,
        layout_description: str | None,
        component: dict[str, Any],
        component_id: str,
        description: str,
        variant_index: int | None = None,
        variant_count: int | None = None,
    ) -> dict[str, Any]:
        candidate = {
            "block_id": block_id,
            "source": source,
            "layout_id": layout_id,
            "layout_description": layout_description,
            "component_id": component_id,
            "description": description,
            "position": copy.deepcopy(component.get("position")),
            "box": copy.deepcopy(cls._component_box(component)),
            "element_count": len(component.get("elements", []))
            if isinstance(component.get("elements"), list)
            else 0,
            "element_types": cls._component_element_types(component),
            "element_names": cls._component_element_names(component),
            "decorative": cls._component_is_decorative(component),
            "component": copy.deepcopy(component),
        }
        if variant_index is not None:
            candidate["variant_index"] = variant_index
        if variant_count is not None:
            candidate["variant_count"] = variant_count
        return candidate

    @staticmethod
    def _component_element_types(component: dict[str, Any]) -> list[str]:
        seen: set[str] = set()
        ordered: list[str] = []

        def visit(element: Any) -> None:
            if not isinstance(element, dict):
                return
            element_type = element.get("type")
            if element_type is not None:
                value = str(element_type)
                if value not in seen:
                    seen.add(value)
                    ordered.append(value)
            child = element.get("child")
            if isinstance(child, dict):
                visit(child)
            children = element.get("children")
            if isinstance(children, list):
                for nested in children:
                    visit(nested)

        elements = component.get("elements")
        if isinstance(elements, list):
            for element in elements:
                visit(element)
        return ordered

    @staticmethod
    def _component_element_names(component: dict[str, Any]) -> list[str]:
        seen: set[str] = set()
        ordered: list[str] = []

        def visit(element: Any) -> None:
            if not isinstance(element, dict):
                return
            name = element.get("name")
            if name is not None:
                value = str(name).strip()
                if value and value not in seen:
                    seen.add(value)
                    ordered.append(value)
            child = element.get("child")
            if isinstance(child, dict):
                visit(child)
            children = element.get("children")
            if isinstance(children, list):
                for nested in children:
                    visit(nested)

        elements = component.get("elements")
        if isinstance(elements, list):
            for element in elements:
                visit(element)
        return ordered

    @staticmethod
    def _component_is_decorative(component: dict[str, Any]) -> bool:
        elements = component.get("elements")
        if not isinstance(elements, list) or not elements:
            return False
        return all(
            isinstance(element, dict) and element.get("decorative") is True
            for element in elements
        )

    @staticmethod
    def _unique_block_id(block_id: str, seen_block_ids: set[str]) -> str:
        normalized = re.sub(r"[^a-zA-Z0-9:_-]+", "_", block_id).strip("_")
        normalized = normalized or "block"
        candidate = normalized
        suffix = 2
        while candidate in seen_block_ids:
            candidate = f"{normalized}:{suffix}"
            suffix += 1
        seen_block_ids.add(candidate)
        return candidate

    @staticmethod
    def _block_match_score(candidate: dict[str, Any], query: str) -> int:
        if not query:
            return 1
        haystack = " ".join(
            str(value or "")
            for value in (
                candidate.get("block_id"),
                candidate.get("component_id"),
                candidate.get("description"),
                candidate.get("layout_id"),
                candidate.get("layout_description"),
                " ".join(str(item) for item in candidate.get("element_types", [])),
                " ".join(str(item) for item in candidate.get("element_names", [])),
            )
        ).lower()
        score = 0
        if query in haystack:
            score += 10
        for word in re.findall(r"[a-z0-9_-]+", query):
            if word in haystack:
                score += 1
        return score

    @staticmethod
    def _format_available_block(
        candidate: dict[str, Any],
        *,
        include_full_content: bool,
    ) -> dict[str, Any]:
        keys = (
            "block_id",
            "source",
            "layout_id",
            "layout_description",
            "component_id",
            "description",
            "position",
            "size",
            "element_count",
            "element_types",
            "element_names",
            "decorative",
            "variant_index",
            "variant_count",
        )
        block = {key: candidate.get(key) for key in keys if key in candidate}
        if include_full_content:
            block["component"] = copy.deepcopy(candidate.get("component"))
        return block

    async def _get_layout_by_id(
        self,
        layout_id: str,
        presentation: PresentationModel | None = None,
    ) -> SlideLayoutModel | None:
        if not presentation:
            presentation = await self._sql_session.get(
                PresentationModel, self._presentation_id
            )
        layout_model = await self._get_layout_model(presentation)
        if not layout_model:
            return None

        for layout in layout_model.slides:
            if layout.id == layout_id:
                return layout
        return None

    async def _get_layout_model(
        self,
        presentation: PresentationModel | None,
    ) -> PresentationLayoutModel | None:
        if not presentation or not isinstance(presentation.layout, dict):
            return None

        if self._is_template_layout_payload(presentation.layout):
            return self._build_template_layout_model(
                presentation.layout,
                layout_name=str(presentation.layout.get("name") or "template"),
            )

        try:
            return presentation.get_layout()
        except Exception:
            template_model = await self._resolve_template_layout_model(presentation)
            if template_model:
                return template_model
            LOGGER.exception(
                "Failed to parse presentation layout (presentation_id=%s)",
                self._presentation_id,
            )
            return None

    async def _resolve_template_layout_model(
        self,
        presentation: PresentationModel,
    ) -> PresentationLayoutModel | None:
        candidate_ids: list[str] = []
        seen_ids: set[str] = set()

        if isinstance(presentation.layout, dict):
            for key in ("name", "template_id"):
                template_id = self._extract_template_id(presentation.layout.get(key))
                if template_id and template_id not in seen_ids:
                    candidate_ids.append(template_id)
                    seen_ids.add(template_id)

        for template_id in candidate_ids:
            template = await self._sql_session.get(TemplateV2, template_id)
            if not template or not isinstance(template.layouts, dict):
                continue
            layout_payload = copy.deepcopy(template.layouts)
            icon_type = extract_icon_type_from_settings(template.assets)
            layout_payload["icon_type"] = icon_type
            layout_payload["icon_weight"] = icon_type
            return self._build_template_layout_model(
                layout_payload,
                layout_name=f"{CUSTOM_TEMPLATE_PREFIX}{template.id}",
            )

        return None

    @staticmethod
    def _is_template_layout_payload(layout_payload: Any) -> bool:
        return (
            isinstance(layout_payload, dict)
            and isinstance(layout_payload.get("layouts"), list)
        )

    @staticmethod
    def _extract_template_id(value: Any) -> str | None:
        if not isinstance(value, str) or not value:
            return None

        candidate = value.strip()
        if not candidate:
            return None
        if candidate.startswith(CUSTOM_TEMPLATE_PREFIX):
            candidate = candidate[len(CUSTOM_TEMPLATE_PREFIX) :].strip()
        return candidate or None

    @staticmethod
    def _build_template_layout_model(
        layout_payload: dict[str, Any],
        *,
        layout_name: str,
    ) -> PresentationLayoutModel:
        template_schema = get_template_schema(layout_payload)
        source_layouts = layout_payload.get("layouts")
        if not isinstance(source_layouts, list):
            source_layouts = []

        slides: list[SlideLayoutModel] = []
        for index, schema_layout in enumerate(template_schema["layouts"]):
            if not isinstance(schema_layout, dict):
                continue

            source_layout = (
                source_layouts[index]
                if index < len(source_layouts)
                and isinstance(source_layouts[index], dict)
                else {}
            )
            layout_id = (
                schema_layout.get("layout_id")
                or source_layout.get("id")
                or f"layout_{index + 1}"
            )
            layout_schema = schema_layout.get("schema")
            if not isinstance(layout_schema, dict):
                layout_schema = {
                    "title": str(layout_id),
                    "description": source_layout.get("description"),
                }

            slides.append(
                SlideLayoutModel(
                    id=str(layout_id),
                    name=source_layout.get("name") or layout_schema.get("title"),
                    description=source_layout.get("description")
                    or layout_schema.get("description"),
                    json_schema=layout_schema,
                )
            )

        return PresentationLayoutModel(
            name=layout_name,
            ordered=False,
            icon_type=extract_icon_type_from_settings(layout_payload),
            slides=slides,
        )

    async def _build_template_slide_ui(
        self,
        *,
        presentation: PresentationModel,
        layout_id: str,
        content: dict[str, Any],
    ) -> dict[str, Any] | None:
        source_layout = await self._get_template_raw_layout_by_id(
            presentation=presentation,
            layout_id=layout_id,
        )
        if source_layout is None:
            return None

        ui = copy.deepcopy(source_layout)
        theme = presentation.theme if isinstance(presentation.theme, dict) else None
        self._apply_template_content_to_ui(ui, content, theme=theme)
        self._sync_ui_text_fields(ui)
        from services.chat.slide_ui_helpers import _normalize_chart_tree

        _normalize_chart_tree(ui, theme)
        return ui

    async def _get_template_raw_layout_by_id(
        self,
        *,
        presentation: PresentationModel,
        layout_id: str,
    ) -> dict[str, Any] | None:
        if isinstance(presentation.layout, dict):
            source = self._raw_layout_from_payload(presentation.layout, layout_id)
            if source is not None:
                return source

            for key in ("name", "template_id"):
                template_id = self._extract_template_id(presentation.layout.get(key))
                if not template_id:
                    continue
                template = await self._sql_session.get(TemplateV2, template_id)
                if template and isinstance(template.layouts, dict):
                    source = self._raw_layout_from_payload(template.layouts, layout_id)
                    if source is not None:
                        return source

        return None

    @staticmethod
    def _raw_layout_from_payload(
        layout_payload: dict[str, Any],
        layout_id: str,
    ) -> dict[str, Any] | None:
        layouts = layout_payload.get("layouts")
        if not isinstance(layouts, list):
            return None

        for layout in layouts:
            if isinstance(layout, dict) and str(layout.get("id")) == str(layout_id):
                return layout
        return None

    @classmethod
    def _apply_template_content_to_ui(
        cls,
        ui: dict[str, Any],
        content: dict[str, Any],
        *,
        theme: dict[str, Any] | None = None,
    ) -> None:
        components = ui.get("components")
        if not isinstance(components, list):
            return

        component_counts: dict[str, int] = {}
        for component in components:
            if isinstance(component, dict):
                component_id = str(component.get("id") or "")
                component_counts[component_id] = (
                    component_counts.get(component_id, 0) + 1
                )

        component_seen: dict[str, int] = {}
        used_keys: set[str] = set()
        for component in components:
            if not isinstance(component, dict):
                continue
            component_id = str(component.get("id") or "")
            occurrence_index = component_seen.get(component_id, 0)
            component_seen[component_id] = occurrence_index + 1
            candidate_keys = [component_id]
            if component_counts.get(component_id, 0) > 1:
                candidate_keys.insert(0, f"{component_id}_{occurrence_index}")

            component_content = None
            for key in candidate_keys:
                if key in used_keys:
                    continue
                value = content.get(key)
                if isinstance(value, dict):
                    component_content = value
                    used_keys.add(key)
                    break
            if component_content is None:
                continue

            cls._apply_template_component_content(
                component,
                component_content,
                theme=theme,
            )

    @classmethod
    def _apply_template_component_content(
        cls,
        component: dict[str, Any],
        content: dict[str, Any],
        *,
        theme: dict[str, Any] | None = None,
    ) -> None:
        elements = component.get("elements")
        if not isinstance(elements, list):
            return

        cls._apply_template_elements_content(
            elements,
            content,
            theme=theme,
        )

    @classmethod
    def _apply_template_element_content(
        cls,
        element: dict[str, Any],
        content: Any,
        *,
        theme: dict[str, Any] | None = None,
        direct_value: bool = False,
        preferred_content_keys: list[str] | None = None,
        name_occurrences: dict[str, int] | None = None,
    ) -> None:
        content_values = content if isinstance(content, dict) else {}
        element_type = element.get("type")
        name = element.get("name")
        has_value = False
        value = None
        if isinstance(name, str):
            if preferred_content_keys is None and name_occurrences is not None:
                preferred_content_keys = cls._template_repeated_content_keys_for_name(
                    name,
                    content_values,
                    name_occurrences,
                )
            has_value, value = cls._template_content_value(
                content_values,
                name,
                preferred_keys=preferred_content_keys,
            )

        if (
            has_value
            and element.get("decorative") is False
            and element_type in TEMPLATE_GENERATED_ELEMENT_TYPES
        ):
            cls._set_template_element_value(
                element,
                value,
                theme=theme,
            )
            return

        if (
            direct_value
            and not has_value
            and element.get("decorative") is False
            and element_type in TEMPLATE_GENERATED_ELEMENT_TYPES
        ):
            cls._set_template_element_value(
                element,
                content,
                theme=theme,
            )
            return

        nested_content = value if isinstance(value, dict) else content_values
        nested_direct_value = direct_value and not has_value
        nested_name_occurrences = (
            {}
            if has_value and isinstance(value, dict)
            else name_occurrences
        )

        child = element.get("child")
        if isinstance(child, dict):
            cls._apply_template_element_content(
                child,
                nested_content,
                theme=theme,
                direct_value=nested_direct_value,
                name_occurrences=nested_name_occurrences,
            )

        children = element.get("children")
        if isinstance(children, list):
            if isinstance(value, list) and children:
                next_children: list[Any] = []
                for index, item in enumerate(value):
                    source_child = copy.deepcopy(children[min(index, len(children) - 1)])
                    if isinstance(source_child, dict):
                        cls._apply_template_element_content(
                            source_child,
                            item,
                            theme=theme,
                            direct_value=True,
                        )
                    next_children.append(source_child)
                element["children"] = next_children
                return

            cls._apply_template_elements_content(
                children,
                nested_content,
                theme=theme,
                direct_value=nested_direct_value,
                name_occurrences=nested_name_occurrences,
            )

    @classmethod
    def _apply_template_elements_content(
        cls,
        elements: list[Any],
        content: Any,
        *,
        theme: dict[str, Any] | None = None,
        direct_value: bool = False,
        name_occurrences: dict[str, int] | None = None,
    ) -> None:
        scoped_name_occurrences = (
            name_occurrences if name_occurrences is not None else {}
        )
        for element in elements:
            if not isinstance(element, dict):
                continue
            cls._apply_template_element_content(
                element,
                content,
                theme=theme,
                direct_value=direct_value,
                name_occurrences=scoped_name_occurrences,
            )

    @staticmethod
    def _template_repeated_content_keys_for_name(
        name: str,
        content: dict[str, Any],
        name_occurrences: dict[str, int],
    ) -> list[str] | None:
        occurrence_index = name_occurrences.get(name, 0)
        name_occurrences[name] = occurrence_index + 1
        if occurrence_index == 0:
            return None

        suffixed_key = f"{name}_{occurrence_index + 1}"
        return [suffixed_key] if suffixed_key in content else None

    @staticmethod
    def _template_content_value(
        content: dict[str, Any],
        name: str,
        *,
        preferred_keys: list[str] | None = None,
    ) -> tuple[bool, Any]:
        candidates: list[str] = []
        for candidate in [
            *(preferred_keys or []),
            *PresentationChatMemoryLayer._template_content_name_candidates(name),
        ]:
            if candidate and candidate not in candidates:
                candidates.append(candidate)

        for candidate in candidates:
            if candidate in content:
                return True, content[candidate]
        return False, None

    @staticmethod
    def _template_content_name_candidates(name: str) -> list[str]:
        without_numeric_token = re.sub(r"_\d+(?=_|$)", "", name)
        without_prefix = (
            without_numeric_token.split("_", 1)[1]
            if "_" in without_numeric_token
            else without_numeric_token
        )

        candidates: list[str] = []
        for candidate in (name, without_numeric_token, without_prefix):
            if candidate and candidate not in candidates:
                candidates.append(candidate)
        return candidates

    @classmethod
    def _set_template_element_value(
        cls,
        element: dict[str, Any],
        value: Any,
        *,
        theme: dict[str, Any] | None = None,
    ) -> None:
        element_type = element.get("type")
        if element_type == "text":
            text = cls._template_text_value(value)
            if text is None or text == "":
                return
            cls._set_template_runs_text(element, text)
            element["text"] = text
            return

        if element_type == "math":
            latex = cls._template_text_value(value)
            if latex is None or not latex.strip():
                return
            normalized = latex.strip()
            if normalized.startswith("$$") and normalized.endswith("$$"):
                normalized = normalized[2:-2].strip()
            elif normalized.startswith(r"\[") and normalized.endswith(r"\]"):
                normalized = normalized[2:-2].strip()
            element["latex"] = normalized[:4000]
            return

        if element_type == "text-list" and isinstance(value, list):
            source_items = (
                element.get("items") if isinstance(element.get("items"), list) else []
            )
            element["items"] = [
                cls._replacement_runs_from_existing(
                    source_items[index] if index < len(source_items) else None,
                    cls._template_text_value(item) or "",
                    element.get("font"),
                )
                for index, item in enumerate(value)
            ]
            return

        if element_type == "image":
            asset_url = cls._template_asset_url(value)
            if asset_url:
                from services.chat.slide_ui_helpers import (
                    _normalize_generated_image_fit,
                )

                element["data"] = asset_url
                _normalize_generated_image_fit(element, asset_url)
                prompt = cls._template_asset_prompt(
                    value,
                    element.get("is_icon") is True,
                )
                if prompt:
                    element["prompt"] = prompt
            return

        if element_type == "chart" and isinstance(value, dict):
            from services.chat.slide_ui_helpers import _apply_chart_content_update

            _apply_chart_content_update(element, value, theme)
            return

        if element_type == "infographic" and isinstance(value, dict):
            cls._set_template_infographic_content(element, value)
            return

        if element_type == "table":
            if isinstance(value, dict):
                cls._set_template_table_content(element, value)
            elif isinstance(value, list):
                cls._set_template_table_rows(element, value)

    @staticmethod
    def _set_template_infographic_content(
        element: dict[str, Any],
        value: dict[str, Any],
    ) -> None:
        data = value.get("data")
        if isinstance(data, dict) and data.get("type") in {"progress_bar", "gauge"}:
            next_data: dict[str, Any] = {"type": data["type"]}
            for key in ("min_value", "max_value", "value"):
                raw = data.get(key)
                if isinstance(raw, (int, float)):
                    next_data[key] = float(raw)
            if {"min_value", "max_value", "value"}.issubset(next_data):
                element["data"] = next_data

        colors = value.get("colors")
        if isinstance(colors, list):
            element["colors"] = [
                color
                for color in colors
                if isinstance(color, str) and color.strip()
            ]

    @classmethod
    def _set_template_runs_text(cls, element: dict[str, Any], text: str) -> None:
        element["runs"] = cls._replacement_runs_from_existing(
            element.get("runs"),
            text,
            element.get("font"),
        )

    @staticmethod
    def _template_text_value(value: Any) -> str | None:
        if isinstance(value, str):
            return value
        if isinstance(value, (int, float)) and not isinstance(value, bool):
            return str(value)
        if isinstance(value, dict):
            text = value.get("text")
            if isinstance(text, str):
                return text
            if isinstance(text, (int, float)) and not isinstance(text, bool):
                return str(text)
        return None

    @staticmethod
    def _replacement_runs_from_existing(
        existing_runs: Any,
        text: str,
        fallback_font: Any,
    ) -> list[dict[str, Any]]:
        if isinstance(existing_runs, list) and existing_runs:
            first = existing_runs[0]
            if isinstance(first, dict):
                run = copy.deepcopy(first)
                run["text"] = text
                return [run]
        run: dict[str, Any] = {"text": text}
        if isinstance(fallback_font, dict):
            run["font"] = copy.deepcopy(fallback_font)
        return [run]

    @staticmethod
    def _template_asset_url(value: Any) -> str | None:
        if isinstance(value, str):
            return normalize_slide_asset_url(value)
        if not isinstance(value, dict):
            return None

        fallback_url: str | None = None
        for key in (
            "data",
            "url",
            "image_url",
            "icon_url",
            "__image_url__",
            "__icon_url__",
        ):
            asset_url = value.get(key)
            if isinstance(asset_url, str) and asset_url.strip():
                normalized_url = normalize_slide_asset_url(asset_url)
                if normalized_url.strip().startswith(
                    ("http://", "https://", "/app_data/", "/static/", "data:", "blob:")
                ):
                    return normalized_url
                if fallback_url is None:
                    fallback_url = normalized_url
        return fallback_url

    @staticmethod
    def _template_asset_prompt(value: Any, is_icon: bool) -> str | None:
        if not isinstance(value, dict):
            return None

        prompt_keys = (
            ("icon_query", "__icon_query__", "query", "prompt")
            if is_icon
            else ("image_prompt", "__image_prompt__", "prompt", "query")
        )
        for key in prompt_keys:
            prompt = value.get(key)
            if isinstance(prompt, str) and prompt.strip():
                return prompt
        return None

    @classmethod
    def _set_template_table_content(
        cls,
        element: dict[str, Any],
        value: dict[str, Any],
    ) -> None:
        columns = value.get("columns")
        if isinstance(columns, list):
            existing_columns = (
                element.get("columns")
                if isinstance(element.get("columns"), list)
                else []
            )
            element["columns"] = cls._template_table_cells_from_values(
                existing_columns,
                columns,
                element.get("font"),
            )

        rows = value.get("rows")
        if isinstance(rows, list):
            cls._set_template_table_rows(element, rows)

    @classmethod
    def _template_table_cells_from_values(
        cls,
        existing_cells: list[Any],
        values: list[Any],
        fallback_font: Any,
    ) -> list[dict[str, Any]]:
        fallback_cell = existing_cells[-1] if existing_cells else None
        cells: list[dict[str, Any]] = []
        for index, value in enumerate(values):
            existing_cell = (
                existing_cells[index]
                if index < len(existing_cells)
                else fallback_cell
            )
            existing_runs = (
                existing_cell.get("runs")
                if isinstance(existing_cell, dict)
                else None
            )
            cell = copy.deepcopy(existing_cell) if isinstance(existing_cell, dict) else {}
            cell["runs"] = cls._replacement_runs_from_existing(
                existing_runs,
                cls._table_cell_text_value(value),
                cell.get("font") or fallback_font,
            )
            cells.append(cell)
        return cells

    @classmethod
    def _set_template_table_rows(
        cls,
        element: dict[str, Any],
        rows: list[Any],
    ) -> None:
        existing_rows = (
            element.get("rows") if isinstance(element.get("rows"), list) else []
        )
        next_rows: list[list[dict[str, Any]]] = []
        for row_index, row in enumerate(rows):
            if not isinstance(row, list):
                continue
            existing_row = (
                existing_rows[row_index]
                if row_index < len(existing_rows)
                and isinstance(existing_rows[row_index], list)
                else []
            )
            next_rows.append(
                cls._template_table_cells_from_values(
                    existing_row,
                    row,
                    element.get("font"),
                )
            )
        element["rows"] = next_rows

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
            if PresentationChatMemoryLayer._is_template_layout_payload(
                presentation.layout
            ):
                return "template"
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

            slides.append({"content": normalize_outline_content(content)})

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

    @staticmethod
    def _trim_document_text(text: str, limit: int) -> str:
        normalized = (text or "").strip()
        if not normalized:
            return ""
        if len(normalized) <= limit:
            return normalized
        return f"{normalized[:limit].rstrip()}\n[Document content truncated]"

    @staticmethod
    def _extract_theme_colors(theme: dict[str, Any]) -> dict[str, Any]:
        data = theme.get("data")
        colors = data.get("colors") if isinstance(data, dict) else None
        if isinstance(colors, dict):
            return copy.deepcopy(colors)
        colors = theme.get("colors")
        return copy.deepcopy(colors) if isinstance(colors, dict) else {}

    @staticmethod
    def _chart_palette_from_theme_colors(colors: dict[str, Any]) -> list[str]:
        palette: list[str] = []
        for index in range(10):
            value = colors.get(f"graph_{index}")
            if not isinstance(value, str):
                continue
            color = PresentationChatMemoryLayer._normalize_hex_color(value)
            if color:
                palette.append(color)
        if palette:
            return palette
        fallback_keys = ("primary", "card", "stroke", "background_text", "primary_text")
        fallback_palette: list[str] = []
        for key in fallback_keys:
            value = colors.get(key)
            if not isinstance(value, str):
                continue
            color = PresentationChatMemoryLayer._normalize_hex_color(value)
            if color:
                fallback_palette.append(color)
        return fallback_palette

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
