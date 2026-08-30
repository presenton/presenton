from __future__ import annotations

import logging
import uuid
from typing import Any

from sqlalchemy import delete

from models.sql.presentation import PresentationModel, PresentationVersion
from models.sql.slide import SlideModel
from services.database import async_session_maker


logger = logging.getLogger(__name__)


def _uuid(value: Any) -> uuid.UUID | None:
    try:
        return uuid.UUID(str(value))
    except (TypeError, ValueError):
        return None


def _text(value: Any, fallback: str = "") -> str:
    return value if isinstance(value, str) else fallback


def _optional_text(value: Any) -> str | None:
    return value if isinstance(value, str) else None


def _dict(value: Any) -> dict | None:
    return value if isinstance(value, dict) else None


def _string_list(value: Any) -> list[str] | None:
    if not isinstance(value, list):
        return None
    strings = [item for item in value if isinstance(item, str)]
    return strings or None


async def persist_cloud_presentation_created(
    owner_id: uuid.UUID | None,
    request_payload: dict[str, Any],
    cloud_payload: dict[str, Any],
) -> None:
    presentation_id = _uuid(
        cloud_payload.get("id") or cloud_payload.get("presentation_id")
    )
    if presentation_id is None:
        logger.warning("Cloud create response did not include a valid presentation id")
        return

    requested_count = request_payload.get("n_slides")
    cloud_count = cloud_payload.get("n_slides")
    n_slides = next(
        (
            value
            for value in (cloud_count, requested_count)
            if isinstance(value, int) and value >= 0
        ),
        0,
    )
    generation_mode = request_payload.get("generation_mode")
    if generation_mode not in {"standard", "smart"}:
        generation_mode = "standard"

    async with async_session_maker() as session:
        presentation = await session.get(PresentationModel, presentation_id)
        if presentation is not None:
            if presentation.owner_id != owner_id:
                logger.error(
                    "Refusing to overwrite another user's local presentation: %s",
                    presentation_id,
                )
                return
            presentation.generation_mode = generation_mode
        else:
            presentation = PresentationModel(
                id=presentation_id,
                owner_id=owner_id,
                version=PresentationVersion.V2_STANDARD,
                content=_text(
                    cloud_payload.get("content"),
                    _text(request_payload.get("content")),
                ),
                n_slides=n_slides,
                language=_text(
                    cloud_payload.get("language"),
                    _text(request_payload.get("language")),
                ),
                title=_optional_text(cloud_payload.get("title")),
                file_paths=_string_list(request_payload.get("file_paths")),
                instructions=_optional_text(request_payload.get("instructions")),
                tone=_optional_text(cloud_payload.get("tone"))
                or _optional_text(request_payload.get("tone")),
                verbosity=_optional_text(cloud_payload.get("verbosity"))
                or _optional_text(request_payload.get("verbosity")),
                include_table_of_contents=bool(
                    request_payload.get("include_table_of_contents", False)
                ),
                include_title_slide=bool(
                    request_payload.get("include_title_slide", True)
                ),
                web_search=bool(request_payload.get("web_search", False)),
                generation_mode=generation_mode,
                community_design_ids=request_payload.get("community_design_ids")
                if isinstance(request_payload.get("community_design_ids"), list)
                else None,
            )
            session.add(presentation)
        await session.commit()


async def persist_cloud_presentation_complete(
    owner_id: uuid.UUID | None,
    cloud_payload: dict[str, Any],
    generation_mode: str | None = None,
) -> None:
    presentation_id = _uuid(cloud_payload.get("id"))
    slides_payload = cloud_payload.get("slides")
    if presentation_id is None or not isinstance(slides_payload, list):
        logger.warning("Cloud completion payload is missing presentation data")
        return

    payload_mode = cloud_payload.get("type") or cloud_payload.get(
        "generation_mode"
    )
    if payload_mode not in {"standard", "smart"}:
        payload_mode = generation_mode
    if payload_mode not in {"standard", "smart"}:
        payload_mode = (
            "smart"
            if any(
                isinstance(slide, dict)
                and isinstance(slide.get("html_content") or slide.get("html"), str)
                and bool((slide.get("html_content") or slide.get("html")).strip())
                for slide in slides_payload
            )
            else "standard"
        )

    async with async_session_maker() as session:
        presentation = await session.get(PresentationModel, presentation_id)
        if presentation is not None and presentation.owner_id != owner_id:
            logger.error(
                "Refusing to overwrite another user's local presentation: %s",
                presentation_id,
            )
            return
        if presentation is None:
            presentation = PresentationModel(
                id=presentation_id,
                owner_id=owner_id,
                version=PresentationVersion.V2_STANDARD,
                content=_text(cloud_payload.get("content")),
                n_slides=len(slides_payload),
                language=_text(cloud_payload.get("language")),
                generation_mode=payload_mode,
            )

        presentation.generation_mode = payload_mode

        presentation.content = _text(
            cloud_payload.get("content"), presentation.content
        )
        presentation.n_slides = (
            cloud_payload.get("n_slides")
            if isinstance(cloud_payload.get("n_slides"), int)
            else len(slides_payload)
        )
        presentation.language = _text(
            cloud_payload.get("language"), presentation.language
        )
        presentation.title = _optional_text(cloud_payload.get("title"))
        presentation.tone = _optional_text(cloud_payload.get("tone"))
        presentation.verbosity = _optional_text(cloud_payload.get("verbosity"))
        presentation.theme = _dict(cloud_payload.get("theme"))
        presentation.fonts = _dict(cloud_payload.get("fonts"))
        presentation.owner_id = owner_id

        slides: list[SlideModel] = []
        for fallback_index, value in enumerate(slides_payload):
            if not isinstance(value, dict):
                continue
            slide_id = _uuid(value.get("id")) or uuid.uuid4()
            html_content = _optional_text(
                value.get("html_content") or value.get("html")
            )
            slides.append(
                SlideModel(
                    id=slide_id,
                    owner_id=owner_id,
                    presentation=_uuid(value.get("presentation"))
                    or _uuid(value.get("presentation_id"))
                    or presentation_id,
                    layout_group=_text(
                        value.get("layout_group"),
                        "smart-html" if html_content else "cloud",
                    ),
                    layout=_text(
                        value.get("layout"),
                        "smart-html" if html_content else "cloud",
                    ),
                    index=value.get("index")
                    if isinstance(value.get("index"), int)
                    else fallback_index,
                    content=_dict(value.get("content")) or {},
                    html_content=html_content,
                    speaker_note=_optional_text(value.get("speaker_note")),
                    properties=_dict(value.get("properties")),
                    ui=_dict(value.get("ui")),
                )
            )

        await session.execute(
            delete(SlideModel).where(SlideModel.presentation == presentation_id)
        )
        session.add(presentation)
        session.add_all(slides)
        await session.commit()


async def get_local_presentation_generation_mode(
    owner_id: uuid.UUID | None,
    presentation_id: uuid.UUID,
) -> str | None:
    async with async_session_maker() as session:
        presentation = await session.get(PresentationModel, presentation_id)
        if presentation is None or presentation.owner_id != owner_id:
            return None
        return (
            "smart" if presentation.generation_mode == "smart" else "standard"
        )


async def get_local_slide_presentation_id(
    owner_id: uuid.UUID | None,
    slide_id: uuid.UUID,
) -> uuid.UUID | None:
    async with async_session_maker() as session:
        slide = await session.get(SlideModel, slide_id)
        if slide is None or slide.owner_id != owner_id:
            return None
        return slide.presentation
