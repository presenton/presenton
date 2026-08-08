from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, File, HTTPException, UploadFile
from pydantic import BaseModel

from templates.preview import FontCheckResponse, check_fonts_in_pptx_handler
from utils.font_uploads import (
    FONT_CONTENT_TYPES,
    delete_font_upload,
    font_upload_to_info,
    get_font_upload_url,
    list_font_uploads,
    persist_upload_file,
)


FONTS_ROUTER = APIRouter(prefix="/fonts", tags=["fonts"])

SUPPORTED_FONT_EXTENSIONS = FONT_CONTENT_TYPES


class FontUploadResponse(BaseModel):
    success: bool
    font_name: str
    font_url: str
    font_path: str
    message: Optional[str] = None


class FontListResponse(BaseModel):
    success: bool
    fonts: List[dict]
    message: Optional[str] = None


class UploadedFontsResponse(BaseModel):
    fonts: List[dict]


def _font_display_name(font_info) -> str:
    return (
        font_info.family_name
        or font_info.full_name
        or font_info.normalized_family_name
        or Path(font_info.filename).stem
    )


def _font_original_name(filename: str) -> str:
    path = Path(filename)
    stem = path.stem
    if "_" in stem and len(stem.rsplit("_", 1)[-1]) == 8:
        stem = stem.rsplit("_", 1)[0]
    return f"{stem}{path.suffix}"


@FONTS_ROUTER.post("/upload", response_model=FontUploadResponse)
async def upload_font(
    font_file: UploadFile = File(
        ..., description="Font file to upload (.ttf, .otf, .woff, .woff2, .eot)"
    )
):
    try:
        if not font_file.filename:
            raise HTTPException(status_code=400, detail="No file name provided")

        font_upload, _font_path = await persist_upload_file(font_file)
        font_info = await font_upload_to_info(font_upload)
        font_name = _font_display_name(font_info)

        return FontUploadResponse(
            success=True,
            font_name=font_name,
            font_url=await get_font_upload_url(font_upload),
            font_path=font_info.path,
            message=f"Font '{font_name}' uploaded successfully",
        )

    except HTTPException:
        raise
    except Exception as exc:
        print(f"Error uploading font: {exc}")
        raise HTTPException(
            status_code=500, detail=f"Error uploading font: {exc}"
        ) from exc


@FONTS_ROUTER.get("/list", response_model=FontListResponse)
async def list_fonts():
    try:
        response = await list_font_uploads()
        fonts = []
        for font_info in response.fonts:
            file_ext = Path(font_info.filename).suffix.lower()
            fonts.append(
                {
                    "id": str(font_info.id),
                    "filename": font_info.filename,
                    "font_name": _font_display_name(font_info),
                    "original_name": _font_original_name(font_info.filename),
                    "font_url": font_info.url,
                    "font_path": font_info.path,
                    "font_type": SUPPORTED_FONT_EXTENSIONS.get(file_ext, "unknown"),
                    "file_size": font_info.size_bytes,
                    "family_name": font_info.family_name,
                    "subfamily_name": font_info.subfamily_name,
                    "full_name": font_info.full_name,
                    "postscript_name": font_info.postscript_name,
                    "normalized_family_name": font_info.normalized_family_name,
                    "weight_class": font_info.weight_class,
                    "width_class": font_info.width_class,
                    "format": font_info.format,
                }
            )

        return FontListResponse(
            success=True,
            fonts=fonts,
            message=f"Found {len(fonts)} font files",
        )

    except Exception as exc:
        print(f"Error listing fonts: {exc}")
        raise HTTPException(
            status_code=500, detail=f"Error listing fonts: {exc}"
        ) from exc


@FONTS_ROUTER.get("/uploaded", response_model=UploadedFontsResponse)
async def get_uploaded_fonts():
    try:
        response = await list_font_uploads()
        return UploadedFontsResponse(
            fonts=[
                {
                    "id": str(font_info.id),
                    "name": _font_display_name(font_info),
                    "url": font_info.url,
                }
                for font_info in response.fonts
            ]
        )

    except Exception as exc:
        print(f"Error getting uploaded fonts: {exc}")
        raise HTTPException(
            status_code=500, detail=f"Error getting uploaded fonts: {exc}"
        ) from exc


FONTS_ROUTER.post("/check", response_model=FontCheckResponse)(
    check_fonts_in_pptx_handler
)


@FONTS_ROUTER.delete("/delete/{filename}")
async def delete_font(filename: str):
    try:
        deleted = await delete_font_upload(filename)
        return {
            "success": True,
            "message": f"Font '{deleted.filename}' deleted successfully",
        }

    except HTTPException:
        raise
    except Exception as exc:
        print(f"Error deleting font: {exc}")
        raise HTTPException(
            status_code=500, detail=f"Error deleting font: {exc}"
        ) from exc
