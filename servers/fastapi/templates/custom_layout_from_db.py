import logging
import uuid
from typing import Any

import aiohttp
from fastapi import HTTPException
from sqlalchemy import select

from models.sql.presentation_layout_code import PresentationLayoutCodeModel
from models.sql.template import TemplateModel
from services.database import async_session_maker
from templates.presentation_layout import PresentationLayoutModel
from utils.internal_http import internal_request_headers

LOGGER = logging.getLogger(__name__)

_CUSTOM_COMPILE_URL = "http://localhost/api/template/custom"


async def load_custom_presentation_layout(layout_name: str) -> PresentationLayoutModel:
    """Load a custom template from the DB and compile layouts via Next.js (no Puppeteer)."""
    if not layout_name.startswith("custom-"):
        raise HTTPException(
            status_code=400,
            detail=f"Invalid custom template id: {layout_name}",
        )

    try:
        template_uuid = uuid.UUID(layout_name.replace("custom-", "", 1))
    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail="Invalid custom template ID",
        ) from exc

    LOGGER.info(
        "[template_layout] loading custom template via server compile template=%r",
        layout_name,
    )

    async with async_session_maker() as session:
        template_meta = await session.get(TemplateModel, template_uuid)
        result = await session.execute(
            select(PresentationLayoutCodeModel).where(
                PresentationLayoutCodeModel.presentation == template_uuid
            )
        )
        layouts_db = result.scalars().all()

    if not template_meta:
        raise HTTPException(
            status_code=404,
            detail=f"Template '{layout_name}' not found",
        )

    if not layouts_db:
        raise HTTPException(
            status_code=404,
            detail=f"No layouts found for template '{layout_name}'",
        )

    payload = await _compile_custom_layouts_on_nextjs(
        layout_name=layout_name,
        layouts_db=layouts_db,
    )

    slides = payload.get("slides") or []
    if not slides:
        raise HTTPException(
            status_code=404,
            detail=f"Template '{layout_name}' not found",
        )

    LOGGER.info(
        "[template_layout] custom server compile OK template=%r slides=%d",
        layout_name,
        len(slides),
    )
    return PresentationLayoutModel(**payload)


async def _compile_custom_layouts_on_nextjs(
    layout_name: str,
    layouts_db: list[PresentationLayoutCodeModel],
) -> dict[str, Any]:
    body = {
        "group": layout_name,
        "layouts": [
            {
                "layout_id": layout.layout_id,
                "layout_name": layout.layout_name,
                "layout_code": layout.layout_code,
            }
            for layout in layouts_db
        ],
    }

    headers = internal_request_headers()

    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(
                _CUSTOM_COMPILE_URL, json=body, headers=headers
            ) as response:
                if response.status == 200:
                    payload = await response.json()
                    if isinstance(payload, dict):
                        return payload
                    raise HTTPException(
                        status_code=500,
                        detail="Custom template compile returned invalid payload",
                    )

                error = await response.text()
                LOGGER.error(
                    "[template_layout] custom server compile HTTP %s template=%r body=%s",
                    response.status,
                    layout_name,
                    (error or "")[:600],
                )
                if response.status == 404:
                    raise HTTPException(
                        status_code=404,
                        detail=f"Template '{layout_name}' not found",
                    )
                raise HTTPException(
                    status_code=500,
                    detail=f"Failed to compile custom template layouts: {error or response.status}",
                )
    except HTTPException:
        raise
    except aiohttp.ClientError as exc:
        LOGGER.exception(
            "[template_layout] custom server compile request failed template=%r",
            layout_name,
        )
        raise HTTPException(
            status_code=500,
            detail=f"Failed to reach template compile service: {exc}",
        ) from exc
