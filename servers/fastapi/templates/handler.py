import os
import random
import re
import uuid
from datetime import datetime
from typing import Any, List, Optional

import aiohttp
from fastapi import Body, Depends, File, Form, HTTPException, Path, Query, UploadFile
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import delete, select

from constants.presentation import DEFAULT_TEMPLATES
from models.sql.presentation_layout_code import PresentationLayoutCodeModel
from models.sql.template import TemplateModel
from models.sql.template_create_info import TemplateCreateInfoModel
from services.database import get_async_session
from services.export_task_service import EXPORT_TASK_SERVICE
from templates.example import build_template_example
from templates.get_layout_by_name import get_layout_by_name
from templates.presentation_layout import PresentationLayoutModel
from templates.preview import (
    FontsUploadAndSlidesPreviewResponse,
    upload_fonts_and_slides_preview_handler,
)
from templates.prompts import (
    SLIDE_LAYOUT_CREATION_SYSTEM_PROMPT,
    SLIDE_LAYOUT_EDIT_SECTION_SYSTEM_PROMPT,
    SLIDE_LAYOUT_EDIT_SYSTEM_PROMPT,
)
from templates.providers import edit_slide_layout_code, generate_slide_layout_code
from utils.asset_directory_utils import (
    resolve_app_path_to_filesystem,
    resolve_image_path_to_filesystem,
)


class TemplateDetail(BaseModel):
    id: str
    name: str
    total_layouts: Optional[int] = None


class TemplateLayoutData(BaseModel):
    template: uuid.UUID
    layout_id: str
    layout_name: str
    layout_code: str
    fonts: Optional[Any] = None


class TemplateData(BaseModel):
    id: uuid.UUID
    init_id: Optional[uuid.UUID] = None
    name: str
    description: Optional[str] = None
    created_at: datetime


class GetTemplateLayoutsResponse(BaseModel):
    layouts: list[TemplateLayoutData]
    template: Optional[TemplateData] = None
    fonts: Optional[Any] = None


class TemplateExample(BaseModel):
    template: str
    slides: List[dict]


class CreateTemplateInitRequest(BaseModel):
    pptx_url: str
    slide_image_urls: List[str]
    fonts: dict = {}


class CreateSlideLayoutRequest(BaseModel):
    id: uuid.UUID
    index: int


class CreateSlideLayoutResponse(BaseModel):
    react_component: str


class EditSlideLayoutRequest(BaseModel):
    react_component: str
    prompt: str


class EditSlideLayoutResponse(CreateSlideLayoutResponse):
    pass


class EditSlideLayoutSectionRequest(BaseModel):
    react_component: str
    section: str
    prompt: str


class EditSlideLayoutSectionResponse(CreateSlideLayoutResponse):
    pass


class SaveTemplateLayoutData(BaseModel):
    layout_id: str
    layout_name: str
    layout_code: str


class SaveTemplateRequest(BaseModel):
    template_info_id: uuid.UUID
    name: str
    description: Optional[str] = None
    layouts: List[SaveTemplateLayoutData]


class SaveTemplateResponse(BaseModel):
    id: uuid.UUID
    name: str
    description: Optional[str] = None
    created_at: datetime


class CloneTemplateRequest(BaseModel):
    id: str
    name: str
    description: Optional[str] = None


class UpdateTemplateRequest(BaseModel):
    id: uuid.UUID
    layouts: List[SaveTemplateLayoutData]


class SaveSlideLayoutRequest(BaseModel):
    template_id: uuid.UUID
    layout_id: str
    layout_code: str


class CloneSlideLayoutRequest(BaseModel):
    template_id: str
    layout_id: str
    layout_name: Optional[str] = None


def _strip_code_fences(value: str) -> str:
    return (
        value.replace("```tsx", "")
        .replace("```typescript", "")
        .replace("```ts", "")
        .replace("```", "")
        .strip()
    )


def _normalize_layout_code_for_create(code: str) -> str:
    normalized = _strip_code_fences(code)
    normalized = (
        normalized.replace("image_url", "__image_url__")
        .replace("icon_url", "__icon_url__")
        .replace("image_prompt", "__image_prompt__")
        .replace("icon_query", "__icon_query__")
    )

    first_import_match = re.search(r"(?m)^\s*import\b", normalized)
    if first_import_match:
        normalized = normalized[first_import_match.start() :]

    first_export_match = re.search(r"(?m)^\s*export\b", normalized)
    if first_export_match:
        normalized = normalized[: first_export_match.start()]

    normalized = re.sub(
        r"(?ms)^\s*(?:import|export)\b.*?;(?:\r?\n|$)",
        "",
        normalized,
    )
    normalized = re.sub(
        r"(?m)^\s*(?:import|export)\b.*(?:\r?\n|$)",
        "",
        normalized,
    )
    normalized = normalized.strip()
    normalized = re.sub(
        r'(layoutId\s*=\s*["\'])([^"\']+)(["\'])',
        lambda match: (
            match.group(0)
            if re.search(r"-\d{4}$", match.group(2))
            else f"{match.group(1)}{match.group(2)}-{random.randint(1000, 9999)}{match.group(3)}"
        ),
        normalized,
    )
    return normalized


def _update_layout_id_in_code(code: str) -> tuple[str, str]:
    match = re.search(r'(layoutId\s*=\s*["\'])([^"\']+)(["\'])', code)
    if not match:
        raise HTTPException(status_code=400, detail="layoutId not found in layout code")

    current_id = match.group(2)
    suffix = f"{random.randint(1000, 9999)}"
    new_id = re.sub(r"-\d{4}$", f"-{suffix}", current_id)
    if new_id == current_id:
        new_id = f"{current_id}-{suffix}"

    new_code = re.sub(
        r'(layoutId\s*=\s*["\'])([^"\']+)(["\'])',
        f"\\1{new_id}\\3",
        code,
        count=1,
    )
    return new_code, new_id


async def _download_image_bytes(image_url: str) -> bytes:
    async with aiohttp.ClientSession() as session:
        async with session.get(image_url) as response:
            if response.status != 200:
                raise HTTPException(
                    status_code=400,
                    detail=f"Failed to download slide image: {image_url}",
                )
            return await response.read()


async def _read_image_bytes_and_media_type(image_url: str) -> tuple[bytes, str]:
    actual_image_path = resolve_image_path_to_filesystem(image_url)
    if actual_image_path and os.path.isfile(actual_image_path):
        with open(actual_image_path, "rb") as image_file:
            image_bytes = image_file.read()
        file_extension = os.path.splitext(actual_image_path)[1].lower()
    else:
        image_bytes = await _download_image_bytes(image_url)
        file_extension = os.path.splitext(image_url)[1].lower()

    media_type_map = {
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".gif": "image/gif",
        ".webp": "image/webp",
    }
    return image_bytes, media_type_map.get(file_extension, "image/png")


async def get_all_templates(
    include_defaults: bool = Query(
        default=True, description="Whether to include default templates"
    ),
    sql_session: AsyncSession = Depends(get_async_session),
):
    result = await sql_session.execute(
        select(
            TemplateModel.id,
            TemplateModel.name,
            func.count(PresentationLayoutCodeModel.id).label("total_layouts"),
        )
        .join(
            PresentationLayoutCodeModel,
            PresentationLayoutCodeModel.presentation == TemplateModel.id,
        )
        .group_by(TemplateModel.id, TemplateModel.name)
    )
    rows = result.all()

    templates: list[TemplateDetail] = []
    if include_defaults:
        templates.extend(
            TemplateDetail(id=template, name=template) for template in DEFAULT_TEMPLATES
        )

    templates.extend(
        TemplateDetail(
            id=f"custom-{template_id}",
            name=template_name,
            total_layouts=total_layouts,
        )
        for template_id, template_name, total_layouts in rows
    )
    return templates


async def get_layouts(
    template_id: str = Path(..., description="The id of the template"),
    session: AsyncSession = Depends(get_async_session),
):
    if not template_id or not template_id.strip():
        raise HTTPException(status_code=400, detail="Template ID cannot be empty")

    try:
        cleaned_template_id = template_id.replace("custom-", "")
        template_id_uuid = uuid.UUID(cleaned_template_id)
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Invalid custom template ID") from exc

    result = await session.execute(
        select(PresentationLayoutCodeModel).where(
            PresentationLayoutCodeModel.presentation == template_id_uuid
        )
    )
    layouts_db = result.scalars().all()
    if not layouts_db:
        raise HTTPException(
            status_code=404,
            detail=f"No layouts found for template ID: {template_id}",
        )

    template_meta = await session.get(TemplateModel, template_id_uuid)
    template = None
    if template_meta:
        template = TemplateData(
            id=template_id_uuid,
            init_id=None,
            name=template_meta.name,
            description=template_meta.description,
            created_at=template_meta.created_at,
        )

    layouts = [
        TemplateLayoutData(
            template=template_id_uuid,
            layout_id=layout.layout_id,
            layout_name=layout.layout_name,
            layout_code=layout.layout_code,
            fonts=layout.fonts,
        )
        for layout in layouts_db
    ]
    return GetTemplateLayoutsResponse(
        layouts=layouts,
        template=template,
        fonts=layouts[0].fonts if layouts else None,
    )


async def get_template_by_id(
    id: str = Path(
        ...,
        description=f"The id of the template, must be one of {', '.join(DEFAULT_TEMPLATES)} or your custom template",
    ),
    sql_session: AsyncSession = Depends(get_async_session),
):
    if id.startswith("custom-"):
        try:
            template_id = uuid.UUID(id.replace("custom-", ""))
        except Exception as exc:
            raise HTTPException(
                status_code=400,
                detail="Template not found. Please use a valid template.",
            ) from exc

        template = await sql_session.get(TemplateModel, template_id)
        if not template:
            raise HTTPException(
                status_code=400,
                detail="Template not found. Please use a valid template.",
            )

    return await get_layout_by_name(id)


async def get_template_example(
    id: str = Path(
        ...,
        description=f"The id of the template, must be one of {', '.join(DEFAULT_TEMPLATES)} or your custom template",
    ),
    sql_session: AsyncSession = Depends(get_async_session),
):
    template = await get_template_by_id(id=id, sql_session=sql_session)
    return TemplateExample(**build_template_example(id, template))


async def upload_fonts_and_slides_preview(
    pptx_file: UploadFile = File(..., description="PPTX file to preview"),
    font_files: Optional[List[UploadFile]] = File(
        default=None, description="Font files to upload"
    ),
    original_font_names: Optional[List[str]] = Form(default=None),
):
    return await upload_fonts_and_slides_preview_handler(
        pptx_file=pptx_file,
        font_files=font_files,
        original_font_names=original_font_names,
        max_slides=25,
    )


async def init_create_template(
    request: CreateTemplateInitRequest,
    sql_session: AsyncSession = Depends(get_async_session),
):
    if not request.slide_image_urls:
        raise HTTPException(
            status_code=400, detail="At least one slide image is required"
        )

    pptx_path = resolve_app_path_to_filesystem(request.pptx_url)
    if not pptx_path or not os.path.isfile(pptx_path):
        raise HTTPException(status_code=400, detail="PPTX file not found")

    pptx_document = await EXPORT_TASK_SERVICE.convert_pptx_to_html(
        pptx_path, get_fonts=False
    )
    if not pptx_document.slides:
        raise HTTPException(
            status_code=500,
            detail="PPTX-to-HTML export returned no slides",
        )

    if len(pptx_document.slides) < len(request.slide_image_urls):
        raise HTTPException(
            status_code=400,
            detail=(
                "PPTX-to-HTML export returned fewer slides than the preview images. "
                f"Expected at least {len(request.slide_image_urls)}, got {len(pptx_document.slides)}."
            ),
        )

    slide_htmls = pptx_document.slides[: len(request.slide_image_urls)]
    template_create_info = TemplateCreateInfoModel(
        fonts=request.fonts or {},
        pptx_url=request.pptx_url,
        slide_image_urls=request.slide_image_urls,
        slide_htmls=slide_htmls,
    )
    sql_session.add(template_create_info)
    await sql_session.commit()
    await sql_session.refresh(template_create_info)
    return template_create_info.id


async def create_slide_layout(
    request: CreateSlideLayoutRequest = Body(...),
    sql_session: AsyncSession = Depends(get_async_session),
):
    template_info = await sql_session.get(TemplateCreateInfoModel, request.id)
    if not template_info:
        raise HTTPException(status_code=400, detail="Template not found")

    total_slides = len(template_info.slide_htmls)
    if request.index < 0 or request.index >= total_slides:
        raise HTTPException(status_code=400, detail="Invalid slide index")

    slide_html = template_info.slide_htmls[request.index]
    slide_image_url = template_info.slide_image_urls[request.index]
    image_bytes, media_type = await _read_image_bytes_and_media_type(slide_image_url)

    fonts_text = ""
    if template_info.fonts:
        font_names = [font.replace(" ", "_") for font in template_info.fonts.keys()]
        fonts_text = "#PROVIDED FONTS\n- " + "\n- ".join(font_names)

    user_text = f"{fonts_text}\n\n#SLIDE HTML REFERENCE\n{slide_html}"
    react_component = await generate_slide_layout_code(
        system_prompt=SLIDE_LAYOUT_CREATION_SYSTEM_PROMPT,
        user_text=user_text,
        image_bytes=image_bytes,
        media_type=media_type,
    )
    normalized_react_component = _normalize_layout_code_for_create(react_component)

    return CreateSlideLayoutResponse(react_component=normalized_react_component)


async def edit_slide_layout(
    request: EditSlideLayoutRequest,
):
    user_text = f"#Prompt\n{request.prompt}\n\n#TSX code\n{request.react_component}"
    react_component = await edit_slide_layout_code(
        system_prompt=SLIDE_LAYOUT_EDIT_SYSTEM_PROMPT,
        user_text=user_text,
    )
    return EditSlideLayoutResponse(react_component=_strip_code_fences(react_component))


async def edit_slide_layout_section(
    request: EditSlideLayoutSectionRequest,
):
    user_text = (
        f"#Prompt\n{request.prompt}\n\n"
        f"#Section to make changes around\n{request.section}\n\n"
        f"#TSX code\n{request.react_component}"
    )
    react_component = await edit_slide_layout_code(
        system_prompt=SLIDE_LAYOUT_EDIT_SECTION_SYSTEM_PROMPT,
        user_text=user_text,
    )
    return EditSlideLayoutSectionResponse(
        react_component=_strip_code_fences(react_component)
    )


async def save_template(
    request: SaveTemplateRequest,
    sql_session: AsyncSession = Depends(get_async_session),
):
    if not request.layouts:
        raise HTTPException(status_code=400, detail="Layouts are required")

    template_info = await sql_session.get(TemplateCreateInfoModel, request.template_info_id)
    if not template_info:
        raise HTTPException(status_code=400, detail="Template info not found")

    template = TemplateModel(
        id=uuid.uuid4(),
        name=request.name,
        description=request.description,
    )
    sql_session.add(template)

    sql_session.add_all(
        [
            PresentationLayoutCodeModel(
                presentation=template.id,
                layout_id=layout.layout_id,
                layout_name=layout.layout_name,
                layout_code=layout.layout_code,
                fonts=template_info.fonts,
            )
            for layout in request.layouts
        ]
    )
    await sql_session.commit()
    await sql_session.refresh(template)

    return SaveTemplateResponse(
        id=template.id,
        name=template.name,
        description=template.description,
        created_at=template.created_at,
    )


async def clone_template(
    request: CloneTemplateRequest = Body(...),
    sql_session: AsyncSession = Depends(get_async_session),
):
    if not request.id or not request.id.strip():
        raise HTTPException(status_code=400, detail="Template ID cannot be empty")

    try:
        template_id_uuid = uuid.UUID(request.id.replace("custom-", ""))
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Invalid custom template ID") from exc

    template = await sql_session.get(TemplateModel, template_id_uuid)
    if not template:
        raise HTTPException(
            status_code=400,
            detail="Template not found. Please use a valid template.",
        )

    result = await sql_session.execute(
        select(PresentationLayoutCodeModel).where(
            PresentationLayoutCodeModel.presentation == template_id_uuid
        )
    )
    layouts_db = result.scalars().all()
    if not layouts_db:
        raise HTTPException(status_code=400, detail="No layouts found for template")

    new_template = TemplateModel(
        id=uuid.uuid4(),
        name=request.name,
        description=template.description
        if request.description is None
        else request.description,
    )
    sql_session.add(new_template)

    sql_session.add_all(
        [
            PresentationLayoutCodeModel(
                presentation=new_template.id,
                layout_id=layout.layout_id,
                layout_name=layout.layout_name,
                layout_code=layout.layout_code,
                fonts=layout.fonts,
            )
            for layout in layouts_db
        ]
    )
    await sql_session.commit()
    await sql_session.refresh(new_template)

    return SaveTemplateResponse(
        id=new_template.id,
        name=new_template.name,
        description=new_template.description,
        created_at=new_template.created_at,
    )


async def update_template(
    request: UpdateTemplateRequest,
    sql_session: AsyncSession = Depends(get_async_session),
):
    if not request.layouts:
        raise HTTPException(status_code=400, detail="Layouts are required")

    template = await sql_session.get(TemplateModel, request.id)
    if not template:
        raise HTTPException(status_code=400, detail="Template not found")

    existing_layout = await sql_session.scalar(
        select(PresentationLayoutCodeModel).where(
            PresentationLayoutCodeModel.presentation == request.id
        )
    )
    fonts = existing_layout.fonts if existing_layout else None

    await sql_session.execute(
        delete(PresentationLayoutCodeModel).where(
            PresentationLayoutCodeModel.presentation == request.id
        )
    )
    sql_session.add_all(
        [
            PresentationLayoutCodeModel(
                presentation=template.id,
                layout_id=layout.layout_id,
                layout_name=layout.layout_name,
                layout_code=layout.layout_code,
                fonts=fonts,
            )
            for layout in request.layouts
        ]
    )
    await sql_session.commit()

    return SaveTemplateResponse(
        id=template.id,
        name=template.name,
        description=template.description,
        created_at=template.created_at,
    )


async def save_slide_layout(
    request: SaveSlideLayoutRequest,
    sql_session: AsyncSession = Depends(get_async_session),
):
    template = await sql_session.get(TemplateModel, request.template_id)
    if not template:
        raise HTTPException(status_code=400, detail="Template not found")

    layout = await sql_session.scalar(
        select(PresentationLayoutCodeModel).where(
            PresentationLayoutCodeModel.presentation == request.template_id,
            PresentationLayoutCodeModel.layout_id == request.layout_id,
        )
    )
    if not layout:
        raise HTTPException(status_code=400, detail="Layout not found")

    layout.layout_code = request.layout_code
    sql_session.add(layout)
    await sql_session.commit()


async def clone_slide_layout(
    request: CloneSlideLayoutRequest = Body(...),
    sql_session: AsyncSession = Depends(get_async_session),
):
    if not request.template_id or not request.template_id.strip():
        raise HTTPException(status_code=400, detail="Template ID cannot be empty")

    try:
        template_id_uuid = uuid.UUID(request.template_id.replace("custom-", ""))
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Invalid custom template ID") from exc

    template = await sql_session.get(TemplateModel, template_id_uuid)
    if not template:
        raise HTTPException(status_code=400, detail="Template not found")

    layout = await sql_session.scalar(
        select(PresentationLayoutCodeModel).where(
            PresentationLayoutCodeModel.presentation == template_id_uuid,
            PresentationLayoutCodeModel.layout_id == request.layout_id,
        )
    )
    if not layout:
        raise HTTPException(status_code=400, detail="Layout not found")

    new_layout_code, new_layout_id = _update_layout_id_in_code(layout.layout_code)
    new_layout = PresentationLayoutCodeModel(
        presentation=template_id_uuid,
        layout_id=new_layout_id,
        layout_name=request.layout_name or layout.layout_name,
        layout_code=new_layout_code,
        fonts=layout.fonts,
    )
    sql_session.add(new_layout)
    await sql_session.commit()
    await sql_session.refresh(new_layout)

    return SaveTemplateLayoutData(
        layout_id=new_layout.layout_id,
        layout_name=new_layout.layout_name,
        layout_code=new_layout.layout_code,
    )
