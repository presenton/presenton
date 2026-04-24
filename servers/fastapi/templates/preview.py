import asyncio
from dataclasses import dataclass
import os
import re
import shutil
import subprocess
import tempfile
import uuid
import zipfile
from pathlib import Path
from typing import Dict, List, Optional

from fastapi import File, HTTPException, UploadFile
from pydantic import BaseModel

from constants.documents import PPTX_MIME_TYPES
from services.documents_loader import DocumentsLoader
from templates.font_utils import (
    collect_normalized_fonts_from_xmls,
    get_available_and_unavailable_fonts,
)
from utils.get_env import get_app_data_directory_env

try:
    from fontTools.ttLib import TTFont

    FONTTOOLS_AVAILABLE = True
except ImportError:
    FONTTOOLS_AVAILABLE = False


SUPPORTED_FONT_EXTENSIONS = {
    ".ttf": "font/ttf",
    ".otf": "font/otf",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
    ".eot": "application/vnd.ms-fontobject",
}


class FontInfo(BaseModel):
    name: str
    url: str | None = None


class FontCheckResponse(BaseModel):
    available_fonts: List[FontInfo]
    unavailable_fonts: List[FontInfo]


class FontsUploadAndSlidesPreviewResponse(BaseModel):
    slide_image_urls: List[str]
    pptx_url: str
    modified_pptx_url: str
    fonts: dict


@dataclass
class StoredFont:
    display_name: str
    url: str
    temp_path: str


def _get_soffice_binary() -> str:
    configured = os.environ.get("SOFFICE_PATH")
    if configured:
        return configured
    return "soffice.exe" if os.name == "nt" else "soffice"


def _windows_hidden_subprocess_kwargs() -> Dict[str, object]:
    if os.name != "nt":
        return {}

    startupinfo = subprocess.STARTUPINFO()
    startupinfo.dwFlags |= subprocess.STARTF_USESHOWWINDOW
    return {
        "creationflags": getattr(subprocess, "CREATE_NO_WINDOW", 0),
        "startupinfo": startupinfo,
    }


def _app_data_directory() -> str:
    app_data_dir = get_app_data_directory_env() or "/tmp/presenton"
    os.makedirs(app_data_dir, exist_ok=True)
    return app_data_dir


def _get_fonts_directory() -> str:
    fonts_dir = os.path.join(_app_data_directory(), "fonts")
    os.makedirs(fonts_dir, exist_ok=True)
    return fonts_dir


def _get_images_directory() -> str:
    images_dir = os.path.join(_app_data_directory(), "images")
    os.makedirs(images_dir, exist_ok=True)
    return images_dir


def _get_template_uploads_directory() -> str:
    uploads_dir = os.path.join(_app_data_directory(), "uploads", "template-previews")
    os.makedirs(uploads_dir, exist_ok=True)
    return uploads_dir


def _write_bytes_to_path(path: str, data: bytes) -> None:
    with open(path, "wb") as file:
        file.write(data)


def _copy_file(source_path: str, destination_path: str) -> None:
    shutil.copy2(source_path, destination_path)


def _extract_font_name_from_file(file_path: str) -> str:
    filename = os.path.basename(file_path)
    base_name = os.path.splitext(filename)[0]
    if not FONTTOOLS_AVAILABLE:
        return base_name

    try:
        font = TTFont(file_path)
        if "name" in font:
            name_table = font["name"]
            for name_id in (1, 4, 6):
                for record in name_table.names:
                    if record.nameID != name_id:
                        continue
                    if record.langID in (0x409, 0):
                        font_name = record.toUnicode().strip()
                        if font_name:
                            font.close()
                            return font_name
            for record in name_table.names:
                if record.nameID != 1:
                    continue
                font_name = record.toUnicode().strip()
                if font_name:
                    font.close()
                    return font_name
        font.close()
    except Exception:
        pass

    return base_name


def _validate_pptx_file(pptx_file: UploadFile) -> None:
    filename = getattr(pptx_file, "filename", "") or ""
    if not filename.lower().endswith(".pptx"):
        raise HTTPException(
            status_code=400,
            detail="Invalid file type. Expected PPTX file",
        )
    if pptx_file.content_type and pptx_file.content_type not in PPTX_MIME_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type. Expected PPTX file, got {pptx_file.content_type}",
        )


def _ensure_valid_font_file(font_file: UploadFile) -> None:
    filename = font_file.filename or ""
    extension = os.path.splitext(filename)[1].lower()
    if extension not in SUPPORTED_FONT_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid font file. Supported formats: {', '.join(SUPPORTED_FONT_EXTENSIONS.keys())}",
        )


async def _persist_custom_fonts(
    font_files: Optional[List[UploadFile]],
    original_font_names: Optional[List[str]],
    temp_dir: str,
) -> list[StoredFont]:
    if not font_files:
        return []

    stored_fonts: list[StoredFont] = []
    fonts_dir = _get_fonts_directory()

    for index, font_file in enumerate(font_files):
        _ensure_valid_font_file(font_file)

        original_name = (
            original_font_names[index]
            if original_font_names and index < len(original_font_names)
            else None
        )
        extension = os.path.splitext(font_file.filename or "")[1].lower()
        unique_name = f"{Path(font_file.filename or f'font_{index}').stem}_{uuid.uuid4().hex[:8]}{extension}"
        temp_font_path = os.path.join(temp_dir, unique_name)
        permanent_font_path = os.path.join(fonts_dir, unique_name)
        font_bytes = await font_file.read()

        await asyncio.to_thread(_write_bytes_to_path, temp_font_path, font_bytes)
        await asyncio.to_thread(_write_bytes_to_path, permanent_font_path, font_bytes)

        actual_font_name = await asyncio.to_thread(
            _extract_font_name_from_file, permanent_font_path
        )
        display_name = original_name or actual_font_name
        stored_fonts.append(
            StoredFont(
                display_name=display_name,
                url=f"/app_data/fonts/{unique_name}",
                temp_path=temp_font_path,
            )
        )

    return stored_fonts


def _create_font_alias_config(raw_fonts: List[str]) -> str:
    mappings: Dict[str, str] = {}
    for font_name in raw_fonts:
        normalized = font_name
        if not normalized:
            continue
        mappings[font_name] = normalized

    fd, fonts_conf_path = tempfile.mkstemp(prefix="fonts_alias_", suffix=".conf")
    os.close(fd)
    with open(fonts_conf_path, "w", encoding="utf-8") as cfg:
        cfg.write(
            """<?xml version='1.0'?>
<!DOCTYPE fontconfig SYSTEM "urn:fontconfig:fonts.dtd">
<fontconfig>
  <include>/etc/fonts/fonts.conf</include>
"""
        )
        for source_family, destination_family in mappings.items():
            if source_family == destination_family:
                continue
            cfg.write(
                f"""
  <match target="pattern">
    <test name="family" compare="eq">
      <string>{source_family}</string>
    </test>
    <edit name="family" mode="assign" binding="strong">
      <string>{destination_family}</string>
    </edit>
  </match>
"""
            )
        cfg.write("\n</fontconfig>\n")
    return fonts_conf_path


async def _install_fonts(font_paths: List[str]) -> None:
    if not font_paths:
        return

    for font_path in font_paths:
        try:
            subprocess.run(
                ["cp", font_path, "/usr/share/fonts/truetype/"],
                check=True,
                capture_output=True,
            )
        except subprocess.CalledProcessError:
            continue

    try:
        subprocess.run(["fc-cache", "-f", "-v"], check=True, capture_output=True)
    except subprocess.CalledProcessError:
        pass


def extract_slide_xmls(pptx_path: str, temp_dir: str) -> List[str]:
    slide_xmls: list[str] = []
    extract_dir = os.path.join(temp_dir, "pptx_extract")

    with zipfile.ZipFile(pptx_path, "r") as zip_ref:
        zip_ref.extractall(extract_dir)

    slides_dir = os.path.join(extract_dir, "ppt", "slides")
    if not os.path.exists(slides_dir):
        raise HTTPException(status_code=400, detail="No slides directory found in PPTX")

    slide_files = [
        file_name
        for file_name in os.listdir(slides_dir)
        if file_name.startswith("slide") and file_name.endswith(".xml")
    ]
    slide_files.sort(key=lambda value: int(re.sub(r"[^0-9]", "", value) or "0"))

    for slide_file in slide_files:
        slide_path = os.path.join(slides_dir, slide_file)
        with open(slide_path, "r", encoding="utf-8") as slide_handle:
            slide_xmls.append(slide_handle.read())

    return slide_xmls


async def convert_pptx_to_pdf(
    pptx_path: str,
    temp_dir: str,
    slide_xmls: Optional[List[str]] = None,
) -> str:
    screenshots_dir = os.path.join(temp_dir, "screenshots")
    os.makedirs(screenshots_dir, exist_ok=True)

    slide_xmls = slide_xmls or extract_slide_xmls(pptx_path, temp_dir)
    raw_fonts = collect_normalized_fonts_from_xmls(slide_xmls)
    fonts_conf_path = _create_font_alias_config(raw_fonts)
    env = os.environ.copy()
    env["FONTCONFIG_FILE"] = fonts_conf_path

    try:
        subprocess.run(
            [
                _get_soffice_binary(),
                "--headless",
                "--convert-to",
                "pdf",
                "--outdir",
                screenshots_dir,
                pptx_path,
            ],
            check=True,
            capture_output=True,
            text=True,
            timeout=500,
            env=env,
            **_windows_hidden_subprocess_kwargs(),
        )
    except subprocess.TimeoutExpired as exc:
        raise HTTPException(
            status_code=500,
            detail="LibreOffice PDF conversion timed out after 500 seconds",
        ) from exc
    except subprocess.CalledProcessError as exc:
        error_message = exc.stderr if exc.stderr else str(exc)
        raise HTTPException(
            status_code=500,
            detail=f"LibreOffice PDF conversion failed: {error_message}",
        ) from exc

    pdf_files = [file_name for file_name in os.listdir(screenshots_dir) if file_name.endswith(".pdf")]
    if not pdf_files:
        raise HTTPException(
            status_code=500, detail="LibreOffice failed to generate a PDF file"
        )

    return os.path.join(screenshots_dir, pdf_files[0])


async def store_slide_images(
    screenshot_paths: List[str],
    session_id: uuid.UUID,
) -> List[str]:
    images_dir = _get_images_directory()
    target_dir = os.path.join(images_dir, str(session_id))
    os.makedirs(target_dir, exist_ok=True)

    slide_image_urls: list[str] = []
    for index, screenshot_path in enumerate(screenshot_paths, start=1):
        file_name = f"slide_{index}.png"
        destination_path = os.path.join(target_dir, file_name)

        if os.path.exists(screenshot_path) and os.path.getsize(screenshot_path) > 0:
            await asyncio.to_thread(_copy_file, screenshot_path, destination_path)
            slide_image_urls.append(f"/app_data/images/{session_id}/{file_name}")
        else:
            slide_image_urls.append("/static/images/replaceable_template_image.png")

    return slide_image_urls


async def store_uploaded_pptx(
    pptx_path: str,
    session_id: uuid.UUID,
) -> str:
    uploads_dir = _get_template_uploads_directory()
    target_dir = os.path.join(uploads_dir, str(session_id))
    os.makedirs(target_dir, exist_ok=True)

    destination_path = os.path.join(target_dir, "presentation.pptx")
    await asyncio.to_thread(_copy_file, pptx_path, destination_path)
    return f"/app_data/uploads/template-previews/{session_id}/presentation.pptx"


async def get_available_and_unavailable_fonts_for_pptx(
    pptx_path: str, temp_dir: str
) -> tuple[list[tuple[str, str]], list[tuple[str, None]]]:
    slide_xmls = extract_slide_xmls(pptx_path, temp_dir)
    normalized_fonts = collect_normalized_fonts_from_xmls(slide_xmls)
    return await get_available_and_unavailable_fonts(normalized_fonts)


async def check_fonts_in_pptx_handler(
    pptx_file: UploadFile = File(..., description="PPTX file to analyze fonts from")
) -> FontCheckResponse:
    _validate_pptx_file(pptx_file)

    with tempfile.TemporaryDirectory() as temp_dir:
        pptx_path = os.path.join(temp_dir, "presentation.pptx")
        pptx_content = await pptx_file.read()
        await asyncio.to_thread(_write_bytes_to_path, pptx_path, pptx_content)

        available_fonts_data, unavailable_fonts_data = (
            await get_available_and_unavailable_fonts_for_pptx(pptx_path, temp_dir)
        )

    return FontCheckResponse(
        available_fonts=[
            FontInfo(name=name, url=url) for name, url in available_fonts_data
        ],
        unavailable_fonts=[
            FontInfo(name=name, url=url) for name, url in unavailable_fonts_data
        ],
    )


async def upload_fonts_and_slides_preview_handler(
    pptx_file: UploadFile,
    font_files: Optional[List[UploadFile]] = None,
    original_font_names: Optional[List[str]] = None,
    max_slides: Optional[int] = None,
) -> FontsUploadAndSlidesPreviewResponse:
    if (font_files and not original_font_names) or (
        original_font_names and not font_files
    ):
        raise HTTPException(
            status_code=400,
            detail="Both font_files and original_font_names must be provided together",
        )
    if font_files and original_font_names and len(font_files) != len(original_font_names):
        raise HTTPException(
            status_code=400,
            detail="Number of font files must match number of original font names",
        )

    _validate_pptx_file(pptx_file)

    with tempfile.TemporaryDirectory() as temp_dir:
        pptx_path = os.path.join(temp_dir, "presentation.pptx")
        pptx_content = await pptx_file.read()
        await asyncio.to_thread(_write_bytes_to_path, pptx_path, pptx_content)

        stored_fonts = await _persist_custom_fonts(
            font_files=font_files,
            original_font_names=original_font_names,
            temp_dir=temp_dir,
        )
        await _install_fonts([font.temp_path for font in stored_fonts])

        slide_xmls = extract_slide_xmls(pptx_path, temp_dir)
        pdf_path = await convert_pptx_to_pdf(pptx_path, temp_dir, slide_xmls=slide_xmls)
        screenshot_paths = await DocumentsLoader.get_page_images_from_pdf_async(
            pdf_path, temp_dir
        )

        if max_slides and len(screenshot_paths) > max_slides:
            screenshot_paths = screenshot_paths[:max_slides]

        session_id = uuid.uuid4()
        slide_image_urls = await store_slide_images(screenshot_paths, session_id)
        pptx_url = await store_uploaded_pptx(pptx_path, session_id)

        available_fonts, _ = await get_available_and_unavailable_fonts(
            collect_normalized_fonts_from_xmls(slide_xmls)
        )
        fonts: dict[str, str] = {name: url for name, url in available_fonts}
        fonts.update({font.display_name: font.url for font in stored_fonts})

        return FontsUploadAndSlidesPreviewResponse(
            slide_image_urls=slide_image_urls,
            pptx_url=pptx_url,
            modified_pptx_url=pptx_url,
            fonts=fonts,
        )
