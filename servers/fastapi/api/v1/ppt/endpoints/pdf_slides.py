import os
import shutil
import tempfile
import subprocess
from typing import List, Optional
from fastapi import APIRouter, UploadFile, File, HTTPException
from pydantic import BaseModel

from services.documents_loader import DocumentsLoader
from utils.asset_directory_utils import get_images_directory
from utils.gcs_storage import maybe_upload_file_to_gcs
import uuid
from constants.documents import PDF_MIME_TYPES


PDF_SLIDES_ROUTER = APIRouter(prefix="/pdf-slides", tags=["PDF Slides"])


class PdfSlideData(BaseModel):
    slide_number: int
    screenshot_url: str


class PdfSlidesResponse(BaseModel):
    success: bool
    slides: List[PdfSlideData]
    total_slides: int


@PDF_SLIDES_ROUTER.post("/process", response_model=PdfSlidesResponse)
async def process_pdf_slides(
    pdf_file: UploadFile = File(..., description="PDF file to process")
):
    """
    Process a PDF file to extract slide screenshots.

    This endpoint:
    1. Validates the uploaded PDF file
    2. Uses ImageMagick to convert PDF pages to PNG images
    3. Returns screenshot URLs for each slide/page

    Note: Font installation is not needed since PDFs already have fonts embedded.
    """

    # Validate PDF file
    if pdf_file.content_type not in PDF_MIME_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type. Expected PDF file, got {pdf_file.content_type}",
        )
    # Enforce 100MB size limit
    if (
        hasattr(pdf_file, "size")
        and pdf_file.size
        and pdf_file.size > (100 * 1024 * 1024)
    ):
        raise HTTPException(
            status_code=400,
            detail="PDF file exceeded max upload size of 100 MB",
        )

    # Create temporary directory for processing
    with tempfile.TemporaryDirectory() as temp_dir:
        try:
            # Save uploaded PDF file
            pdf_path = os.path.join(temp_dir, "presentation.pdf")
            with open(pdf_path, "wb") as f:
                pdf_content = await pdf_file.read()
                f.write(pdf_content)

            # Generate screenshots from PDF using ImageMagick
            screenshot_paths = await DocumentsLoader.get_page_images_from_pdf_async(
                pdf_path, temp_dir
            )
            print(f"Generated {len(screenshot_paths)} PDF screenshots")

            # Move screenshots to images directory and generate URLs
            images_dir = get_images_directory()
            presentation_id = uuid.uuid4()
            presentation_images_dir = os.path.join(images_dir, str(presentation_id))
            os.makedirs(presentation_images_dir, exist_ok=True)

            slides_data = []

            for i, screenshot_path in enumerate(screenshot_paths, 1):
                # Move screenshot to permanent location
                screenshot_filename = f"slide_{i}.png"
                permanent_screenshot_path = os.path.join(
                    presentation_images_dir, screenshot_filename
                )

                if (
                    os.path.exists(screenshot_path)
                    and os.path.getsize(screenshot_path) > 0
                ):
                    # Use shutil.copy2 instead of os.rename to handle cross-device moves
                    shutil.copy2(screenshot_path, permanent_screenshot_path)
                    gcs_url = maybe_upload_file_to_gcs(
                        permanent_screenshot_path,
                        relative_path=f"images/{presentation_id}/{screenshot_filename}",
                    )
                    screenshot_url = (
                        gcs_url
                        or f"/app_data/images/{presentation_id}/{screenshot_filename}"
                    )
                else:
                    # Fallback if screenshot generation failed or file is empty placeholder
                    screenshot_url = "/static/images/placeholder.jpg"

                slides_data.append(
                    PdfSlideData(slide_number=i, screenshot_url=screenshot_url)
                )

            return PdfSlidesResponse(
                success=True, slides=slides_data, total_slides=len(slides_data)
            )

        except Exception as e:
            print(f"Error processing PDF slides: {str(e)}")
            raise HTTPException(
                status_code=500, detail=f"Failed to process PDF: {str(e)}"
            )
