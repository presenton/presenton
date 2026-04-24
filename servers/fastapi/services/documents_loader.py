import asyncio
import logging
import os
import tempfile
from pathlib import Path
from typing import Any, List, Optional, Tuple

import pdfplumber
from fastapi import HTTPException

from constants.documents import (
    IMAGE_EXTENSIONS,
    OFFICE_EXTENSIONS,
    PDF_EXTENSIONS,
    TEXT_EXTENSIONS,
)
from services.document_conversion_service import (
    DocumentConversionError,
    DocumentConversionService,
)
from services.liteparse_service import LiteParseError, LiteParseService
from utils.ocr_language import presentation_language_to_ocr_code

# Optional fallback converter (primarily useful on Windows)
try:
    from services.lightweight_document_service import DocumentService as DocumentServiceCls
except Exception:
    DocumentServiceCls = None

LOGGER = logging.getLogger(__name__)


class DocumentsLoader:
    DECOMPOSE_TIMEOUT_SECONDS = 600

    def __init__(
        self,
        file_paths: List[str],
        presentation_language: Optional[str] = None,
    ):
        self._file_paths = file_paths
        self._ocr_language = presentation_language_to_ocr_code(presentation_language)
        self.liteparse_service = LiteParseService(
            timeout_seconds=self.DECOMPOSE_TIMEOUT_SECONDS
        )
        self.document_conversion_service = DocumentConversionService()
        self.document_service: Any = (
            DocumentServiceCls() if DocumentServiceCls is not None else None
        )

        self._documents: List[str] = []
        self._images: List[List[str]] = []

    @property
    def documents(self):
        return self._documents

    @property
    def images(self):
        return self._images

    async def load_documents(
        self,
        temp_dir: Optional[str] = None,
        load_text: bool = True,
        load_images: bool = False,
    ):
        """If load_images is True, temp_dir must be provided"""

        documents: List[str] = []
        images: List[List[str]] = []

        for file_path in self._file_paths:
            if not os.path.exists(file_path):
                raise HTTPException(
                    status_code=404, detail=f"File {file_path} not found"
                )

            document = ""
            imgs: List[str] = []

            extension = Path(file_path).suffix.lower()
            LOGGER.info(
                "[DocumentsLoader] Processing file=%s extension=%s",
                file_path,
                extension,
            )

            if extension in PDF_EXTENSIONS:
                document, imgs = await self.load_pdf(
                    file_path, load_text, load_images, temp_dir
                )
            elif extension in TEXT_EXTENSIONS:
                document = await self.load_text(file_path)
            elif extension in OFFICE_EXTENSIONS:
                document = await asyncio.to_thread(
                    self.load_office_document,
                    file_path,
                    temp_dir,
                )
            elif extension in IMAGE_EXTENSIONS:
                document = await asyncio.to_thread(
                    self.load_image,
                    file_path,
                    temp_dir,
                )
            else:
                document = await asyncio.to_thread(self._parse_with_liteparse, file_path)

            documents.append(document)
            images.append(imgs)

        self._documents = documents
        self._images = images

    async def load_pdf(
        self,
        file_path: str,
        load_text: bool,
        load_images: bool,
        temp_dir: Optional[str] = None,
    ) -> Tuple[str, List[str]]:
        image_paths: List[str] = []
        document: str = ""

        if load_text:
            document = await asyncio.to_thread(self._parse_with_liteparse, file_path)

        if load_images:
            if temp_dir is None:
                raise HTTPException(
                    status_code=400,
                    detail="temp_dir is required when load_images is true",
                )
            image_paths = await self.get_page_images_from_pdf_async(file_path, temp_dir)

        return document, image_paths

    async def load_text(self, file_path: str) -> str:
        with open(file_path, "r", encoding="utf-8") as file:
            return await asyncio.to_thread(file.read)

    def load_office_document(self, file_path: str, temp_dir: Optional[str] = None) -> str:
        if temp_dir:
            converted_path = self.document_conversion_service.convert_office_to_pdf(
                file_path,
                temp_dir,
                timeout_seconds=self.DECOMPOSE_TIMEOUT_SECONDS,
            )
            return self._parse_with_liteparse(converted_path)

        with tempfile.TemporaryDirectory(prefix="office-convert-") as conversion_dir:
            converted_path = self.document_conversion_service.convert_office_to_pdf(
                file_path,
                conversion_dir,
                timeout_seconds=self.DECOMPOSE_TIMEOUT_SECONDS,
            )
            return self._parse_with_liteparse(converted_path)

    def load_image(self, file_path: str, temp_dir: Optional[str] = None) -> str:
        if temp_dir:
            converted_path = self.document_conversion_service.convert_image_to_png(
                file_path,
                temp_dir,
                timeout_seconds=self.DECOMPOSE_TIMEOUT_SECONDS,
            )
            return self._parse_with_liteparse(converted_path)

        with tempfile.TemporaryDirectory(prefix="image-convert-") as conversion_dir:
            converted_path = self.document_conversion_service.convert_image_to_png(
                file_path,
                conversion_dir,
                timeout_seconds=self.DECOMPOSE_TIMEOUT_SECONDS,
            )
            return self._parse_with_liteparse(converted_path)

    def _parse_with_liteparse(self, file_path: str) -> str:
        try:
            LOGGER.info("[DocumentsLoader] LiteParse start file=%s", file_path)
            return self.liteparse_service.parse_to_markdown(
                file_path,
                ocr_enabled=True,
                ocr_language=self._ocr_language,
            )
        except (LiteParseError, DocumentConversionError) as exc:
            LOGGER.warning(
                "[DocumentsLoader] Primary parse failed file=%s error=%s",
                file_path,
                exc,
            )
            if self.document_service is not None:
                try:
                    LOGGER.info("[DocumentsLoader] Trying fallback parser file=%s", file_path)
                    return self.document_service.parse_to_markdown(file_path)
                except Exception:
                    LOGGER.exception(
                        "[DocumentsLoader] Fallback parser failed file=%s",
                        file_path,
                    )
                    pass
            raise HTTPException(
                status_code=500,
                detail=f"Failed to parse document {os.path.basename(file_path)}: {exc}",
            ) from exc

    @classmethod
    def get_page_images_from_pdf(cls, file_path: str, temp_dir: str) -> List[str]:
        with pdfplumber.open(file_path) as pdf:
            images = []
            for page in pdf.pages:
                img = page.to_image(resolution=150)
                image_path = os.path.join(temp_dir, f"page_{page.page_number}.png")
                img.save(image_path)
                images.append(image_path)
            return images

    @classmethod
    async def get_page_images_from_pdf_async(cls, file_path: str, temp_dir: str):
        return await asyncio.to_thread(
            cls.get_page_images_from_pdf, file_path, temp_dir
        )
