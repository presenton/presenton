import asyncio
import os
import shutil
from pathlib import Path
from typing import Dict, List, Optional, Sequence, Tuple
import uuid

from fastapi import HTTPException, UploadFile
from pydantic import BaseModel
from sqlalchemy import or_, select

from models.sql.font_upload import FontUpload
from services.database import async_session_maker
from templates.pptx_font_utils import (
    FontDetail,
    extract_font_name_from_file,
    get_font_details,
    normalize_font_family_name,
)
from utils.asset_directory_utils import absolute_fastapi_asset_url
from utils.get_env import get_app_data_directory_env


ALLOWED_FONT_EXTENSIONS = {
    ".eot",
    ".fntdata",
    ".otf",
    ".ttc",
    ".ttf",
    ".woff",
    ".woff2",
}

FONT_CONTENT_TYPES = {
    ".eot": "application/vnd.ms-fontobject",
    ".fntdata": "application/octet-stream",
    ".otf": "font/otf",
    ".ttc": "font/collection",
    ".ttf": "font/ttf",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
}


class FontUploadInfo(BaseModel):
    id: uuid.UUID
    filename: str
    path: str
    family_name: Optional[str] = None
    subfamily_name: Optional[str] = None
    full_name: Optional[str] = None
    postscript_name: Optional[str] = None
    normalized_family_name: str
    weight_class: Optional[int] = None
    width_class: Optional[int] = None
    format: Optional[str] = None
    size_bytes: int
    url: str


class FontUploadsResponse(BaseModel):
    fonts: List[FontUploadInfo]


def get_fonts_directory() -> str:
    app_data_dir = get_app_data_directory_env() or "/tmp/presenton"
    fonts_dir = os.path.join(app_data_dir, "fonts")
    os.makedirs(fonts_dir, exist_ok=True)
    return fonts_dir


def get_font_upload_variant(font_upload: FontUpload) -> str:
    compact_metadata = " ".join(
        value or ""
        for value in (
            font_upload.subfamily_name,
            font_upload.full_name,
            font_upload.postscript_name,
            font_upload.filename,
        )
    ).lower()
    compact_metadata = "".join(char for char in compact_metadata if char.isalnum())
    italic = "italic" in compact_metadata or "oblique" in compact_metadata
    if font_upload.weight_class is not None:
        if font_upload.weight_class == 700:
            bold = True
        elif font_upload.weight_class == 400:
            bold = False
        else:
            return "unsupported"
    else:
        bold = "bold" in compact_metadata or "gras" in compact_metadata
        unsupported_weight = any(
            token in compact_metadata
            for token in ("semibold", "demibold", "medium", "extrabold", "black")
        )
        if unsupported_weight and not bold:
            return "unsupported"

    if bold and italic:
        return "bold_italic"
    if bold:
        return "bold"
    if italic:
        return "italic"
    return "regular"


def validate_font_filename(filename: str) -> str:
    extension = Path(filename).suffix.lower()
    if extension not in ALLOWED_FONT_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid font file type for '{filename}'",
        )
    return extension


def is_allowed_font_filename(filename: str) -> bool:
    return Path(filename).suffix.lower() in ALLOWED_FONT_EXTENSIONS


def safe_font_filename(filename: str) -> str:
    name = os.path.basename(filename or "font")
    return name.replace("/", "_").replace("\\", "_")


def _font_upload_filesystem_path(font_upload: FontUpload) -> str:
    if os.path.isabs(font_upload.path):
        return font_upload.path
    return os.path.join(
        get_app_data_directory_env() or "/tmp/presenton", font_upload.path
    )


def _font_path_to_url(path: str) -> str:
    app_data = get_app_data_directory_env() or "/tmp/presenton"
    try:
        abs_path = os.path.abspath(path)
        abs_app_data = os.path.abspath(app_data)
        common = os.path.commonpath([abs_path, abs_app_data])
    except ValueError:
        return path
    if common != abs_app_data:
        return path

    rel = os.path.relpath(abs_path, abs_app_data).replace(os.sep, "/")
    return absolute_fastapi_asset_url(f"/app_data/{rel}")


async def get_font_upload_url(font_upload: FontUpload) -> str:
    return _font_path_to_url(_font_upload_filesystem_path(font_upload))


async def font_upload_to_info(font_upload: FontUpload) -> FontUploadInfo:
    return FontUploadInfo(
        id=font_upload.id,
        filename=font_upload.filename,
        path=font_upload.path,
        family_name=font_upload.family_name,
        subfamily_name=font_upload.subfamily_name,
        full_name=font_upload.full_name,
        postscript_name=font_upload.postscript_name,
        normalized_family_name=font_upload.normalized_family_name,
        weight_class=font_upload.weight_class,
        width_class=font_upload.width_class,
        format=font_upload.format,
        size_bytes=font_upload.size_bytes,
        url=await get_font_upload_url(font_upload),
    )


def _font_detail_to_extras(detail: FontDetail) -> dict:
    data = detail.model_dump()
    for key in (
        "file",
        "size_bytes",
        "family_name",
        "subfamily_name",
        "full_name",
        "postscript_name",
        "weight_class",
        "width_class",
        "format",
    ):
        data.pop(key, None)
    return {key: value for key, value in data.items() if value is not None}


def _build_font_upload_from_path(
    font_path: str,
    filename: Optional[str] = None,
) -> FontUpload:
    detail = get_font_details(font_path)
    if detail.error:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Failed to extract font info for '{filename or font_path}': "
                f"{detail.error}"
            ),
        )

    family_name = detail.family_name or extract_font_name_from_file(font_path)
    normalized_family_name = normalize_font_family_name(family_name)
    if not normalized_family_name:
        raise HTTPException(
            status_code=400,
            detail=f"Could not determine font family for '{filename or font_path}'",
        )

    return FontUpload(
        filename=filename or os.path.basename(font_path),
        path=font_path,
        normalized_family_name=normalized_family_name,
        family_name=detail.family_name or family_name,
        subfamily_name=detail.subfamily_name,
        full_name=detail.full_name,
        postscript_name=detail.postscript_name,
        weight_class=detail.weight_class,
        width_class=detail.width_class,
        format=detail.format,
        size_bytes=detail.size_bytes,
        extras=_font_detail_to_extras(detail),
    )


async def backfill_font_uploads_from_disk() -> None:
    fonts_dir = get_fonts_directory()
    if not os.path.isdir(fonts_dir):
        return

    candidate_paths = [
        os.path.join(fonts_dir, filename)
        for filename in os.listdir(fonts_dir)
        if is_allowed_font_filename(filename)
        and os.path.isfile(os.path.join(fonts_dir, filename))
    ]
    if not candidate_paths:
        return

    async with async_session_maker() as session:
        result = await session.execute(select(FontUpload.path))
        existing_paths = set(result.scalars().all())
        existing_abs_paths = {
            os.path.abspath(path)
            for path in existing_paths
            if path and os.path.isabs(path)
        }

        added = False
        for font_path in candidate_paths:
            if (
                font_path in existing_paths
                or os.path.abspath(font_path) in existing_abs_paths
            ):
                continue
            try:
                session.add(_build_font_upload_from_path(font_path))
                added = True
            except HTTPException:
                continue
        if added:
            await session.commit()


async def persist_font_file(
    src_path: str,
    filename: Optional[str] = None,
) -> Tuple[FontUpload, str]:
    source_filename = safe_font_filename(filename or os.path.basename(src_path))
    extension = validate_font_filename(source_filename)
    unique_filename = (
        f"{Path(source_filename).stem}_{uuid.uuid4().hex[:8]}{extension}"
    )
    dest_path = os.path.join(get_fonts_directory(), unique_filename)
    await _copy_file(src_path, dest_path)

    font_upload = _build_font_upload_from_path(dest_path, filename=unique_filename)
    async with async_session_maker() as session:
        session.add(font_upload)
        await session.commit()
        await session.refresh(font_upload)
    return font_upload, dest_path


async def persist_upload_file(font_file: UploadFile) -> Tuple[FontUpload, str]:
    filename = safe_font_filename(getattr(font_file, "filename", "") or "font")
    validate_font_filename(filename)
    extension = Path(filename).suffix.lower()
    unique_filename = f"{Path(filename).stem}_{uuid.uuid4().hex[:8]}{extension}"
    dest_path = os.path.join(get_fonts_directory(), unique_filename)

    with open(dest_path, "wb") as file:
        file.write(await font_file.read())

    font_upload = _build_font_upload_from_path(dest_path, filename=unique_filename)
    async with async_session_maker() as session:
        session.add(font_upload)
        await session.commit()
        await session.refresh(font_upload)
    return font_upload, dest_path


async def list_font_uploads() -> FontUploadsResponse:
    await backfill_font_uploads_from_disk()
    query = select(FontUpload).order_by(FontUpload.created_at.desc())

    async with async_session_maker() as session:
        result = await session.execute(query)
        font_uploads = result.scalars().all()

    return FontUploadsResponse(
        fonts=[await font_upload_to_info(font_upload) for font_upload in font_uploads]
    )


async def delete_font_upload(identifier: str) -> FontUploadInfo:
    await backfill_font_uploads_from_disk()
    filters = [FontUpload.filename == identifier]
    try:
        filters.append(FontUpload.id == uuid.UUID(identifier))
    except ValueError:
        pass

    async with async_session_maker() as session:
        result = await session.execute(select(FontUpload).where(or_(*filters)))
        font_upload = result.scalars().first()
        if font_upload is None:
            raise HTTPException(status_code=404, detail="Font upload not found")

        font_upload_info = await font_upload_to_info(font_upload)
        font_path = _font_upload_filesystem_path(font_upload)
        if os.path.isfile(font_path):
            os.remove(font_path)
        await session.delete(font_upload)
        await session.commit()

    return font_upload_info


async def get_font_uploads_for_names_by_variant(
    font_names: Sequence[str],
) -> Dict[str, Dict[str, FontUpload]]:
    await backfill_font_uploads_from_disk()
    normalized_to_originals: Dict[str, List[str]] = {}
    for font_name in font_names:
        normalized = normalize_font_family_name(font_name)
        if normalized:
            normalized_to_originals.setdefault(normalized, [])
            if font_name not in normalized_to_originals[normalized]:
                normalized_to_originals[normalized].append(font_name)

    if not normalized_to_originals:
        return {}

    query = select(FontUpload).where(
        FontUpload.normalized_family_name.in_(list(normalized_to_originals.keys()))
    )
    query = query.order_by(FontUpload.created_at.desc())

    async with async_session_maker() as session:
        result = await session.execute(query)

    matched: Dict[str, Dict[str, FontUpload]] = {}
    for font_upload in result.scalars().all():
        variant = get_font_upload_variant(font_upload)
        if variant == "unsupported":
            continue
        original_names = normalized_to_originals.get(
            font_upload.normalized_family_name, []
        )
        for original_name in original_names:
            matched.setdefault(original_name, {})
            if variant not in matched[original_name]:
                matched[original_name][variant] = font_upload
    return matched


async def download_font_uploads(
    font_uploads: Sequence[FontUpload],
    save_directory: str,
) -> Dict[uuid.UUID, str]:
    downloaded: Dict[uuid.UUID, str] = {}
    os.makedirs(save_directory, exist_ok=True)
    for font_upload in font_uploads:
        src_path = _font_upload_filesystem_path(font_upload)
        if not os.path.isfile(src_path):
            continue
        extension = Path(src_path).suffix
        dest_path = os.path.join(save_directory, f"{font_upload.id}{extension}")
        await _copy_file(src_path, dest_path)
        downloaded[font_upload.id] = dest_path
    return downloaded


async def _copy_file(src_path: str, dest_path: str) -> None:
    os.makedirs(os.path.dirname(dest_path), exist_ok=True)
    await asyncio.to_thread(shutil.copy2, src_path, dest_path)
