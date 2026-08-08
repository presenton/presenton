"""
Template font check and slide preview handlers.

Implementation is ported from presenton-enterprise fonts_and_slides_preview flow,
adapted for local app_data storage instead of S3.
"""

from typing import List, Optional

from fastapi import File, HTTPException, UploadFile

from templates.fonts_and_slides_preview import (
    FontCheckResponse,
    FontInfo,
    FontsUploadAndSlidesPreviewResponse,
    check_fonts_in_pptx_handler as _check_fonts_in_pptx_handler,
    upload_fonts_and_preview_handler,
)

__all__ = [
    "FontInfo",
    "FontCheckResponse",
    "FontsUploadAndSlidesPreviewResponse",
    "check_fonts_in_pptx_handler",
    "upload_fonts_and_slides_preview_handler",
]


async def check_fonts_in_pptx_handler(
    pptx_file: UploadFile = File(..., description="PPTX file to analyze fonts from"),
) -> FontCheckResponse:
    return await _check_fonts_in_pptx_handler(pptx_file)


async def upload_fonts_and_slides_preview_handler(
    pptx_file: UploadFile,
    font_files: Optional[List[UploadFile]] = None,
    original_font_names: Optional[List[str]] = None,
    google_font_original_names: Optional[List[str]] = None,
    google_font_replacement_names: Optional[List[str]] = None,
    google_font_names: Optional[List[str]] = None,
    google_font_urls: Optional[List[str]] = None,
    max_slides: Optional[int] = None,
    upload_fonts: bool = True,
    get_slide_images: bool = True,
    upload_presentation: bool = True,
    temp_dir: Optional[str] = None,
) -> FontsUploadAndSlidesPreviewResponse:
    return await upload_fonts_and_preview_handler(
        pptx_file=pptx_file,
        font_files=font_files,
        original_font_names=original_font_names,
        google_font_original_names=google_font_original_names,
        google_font_replacement_names=google_font_replacement_names,
        google_font_names=google_font_names,
        google_font_urls=google_font_urls,
        max_slides=max_slides,
        upload_fonts=upload_fonts,
        get_slide_images=get_slide_images,
        upload_presentation=upload_presentation,
        temp_dir=temp_dir,
    )
