import asyncio
import json
from unittest.mock import MagicMock, patch

import pytest
from fastapi import HTTPException
from PIL import Image

from services.document_conversion_service import DocumentConversionService
from services.documents_loader import (
    DocumentsLoader,
    _unwrap_liteparse_json_line_if_stored,
    clean_extracted_document_text,
)


def test_unwrap_liteparse_json_line_extracts_text_field():
    inner_text = "Title\n\nBody with \"quotes\""
    payload = json.dumps({"ok": True, "filePath": "/tmp/test.pdf", "text": inner_text})

    assert _unwrap_liteparse_json_line_if_stored(payload) == inner_text
    assert _unwrap_liteparse_json_line_if_stored(f"  {payload}") == inner_text


def test_unwrap_liteparse_json_line_leaves_non_json_text():
    plain_text = "Not JSON, should stay as-is."
    assert _unwrap_liteparse_json_line_if_stored(plain_text) == plain_text


def test_clean_extracted_document_text_handles_malformed_json_body():
    malformed = (
        '{"ok": true, "filePath": "/tmp/test.pdf", "text": '
        '"hello\\nworld\\u0021 and trailing'
    )
    cleaned = clean_extracted_document_text(malformed)
    assert cleaned == "hello\nworld! and trailing"


def test_clean_extracted_document_text_unwraps_nested_liteparse_payloads():
    nested = json.dumps(
        {
            "ok": True,
            "filePath": "/tmp/outer.pdf",
            "text": json.dumps(
                {"ok": True, "filePath": "/tmp/inner.pdf", "text": "final body"}
            ),
        }
    )
    assert clean_extracted_document_text(nested) == "final body"


def test_load_pdf_requires_temp_dir_when_images_are_requested():
    loader = DocumentsLoader(file_paths=[])

    with pytest.raises(HTTPException) as exc:
        asyncio.run(
            loader.load_pdf(
                file_path="/tmp/fake.pdf",
                load_text=False,
                load_images=True,
                temp_dir=None,
            )
        )

    assert exc.value.status_code == 400
    assert "temp_dir is required" in exc.value.detail


def test_convert_image_to_png_writes_png_file(tmp_path):
    source_path = tmp_path / "upload.jpg"
    output_dir = tmp_path / "converted"
    Image.new("RGB", (8, 8), "white").save(source_path, format="JPEG")

    converted_path = DocumentConversionService().convert_image_to_png(
        str(source_path),
        str(output_dir),
    )

    assert converted_path.endswith(".png")
    with Image.open(converted_path) as image:
        assert image.format == "PNG"
        assert image.mode == "RGB"


@patch("services.documents_loader.DocumentsLoader._parse_with_liteparse")
@patch("services.documents_loader.DocumentConversionService.convert_image_to_png")
def test_load_image_converts_to_png_before_ocr(mock_convert, mock_parse):
    mock_convert.return_value = "/tmp/converted.png"
    mock_parse.return_value = "image text"
    loader = DocumentsLoader(file_paths=[])

    result = loader.load_image("/tmp/upload.webp", "/tmp/conversions")

    assert result == "image text"
    mock_convert.assert_called_once_with(
        "/tmp/upload.webp",
        "/tmp/conversions",
        timeout_seconds=DocumentsLoader.DECOMPOSE_TIMEOUT_SECONDS,
    )
    mock_parse.assert_called_once_with("/tmp/converted.png", dpi=300)


@patch("services.documents_loader.DocumentsLoader.load_office_document")
def test_load_documents_parses_office_files_without_liteparse(mock_extract, tmp_path):
    office_file = tmp_path / "deck.pptx"
    office_file.write_bytes(b"pptx")
    mock_extract.return_value = "slide text"
    loader = DocumentsLoader(file_paths=[str(office_file)])

    asyncio.run(loader.load_documents())

    assert loader.documents == ["slide text"]
    mock_extract.assert_called_once_with(str(office_file))


def _make_mock_page(text: str) -> MagicMock:
    page = MagicMock()
    page.extract_text.return_value = text
    return page


@patch("services.documents_loader.pdfplumber.open")
def test_is_scanned_pdf_returns_true_for_empty_pages(mock_open):
    mock_pdf = MagicMock()
    mock_pdf.pages = [_make_mock_page(""), _make_mock_page("")]
    mock_open.return_value.__enter__ = MagicMock(return_value=mock_pdf)
    mock_open.return_value.__exit__ = MagicMock(return_value=False)

    assert DocumentsLoader._is_scanned_pdf("/tmp/scanned.pdf") is True


@patch("services.documents_loader.pdfplumber.open")
def test_is_scanned_pdf_returns_false_for_text_pages(mock_open):
    mock_pdf = MagicMock()
    mock_pdf.pages = [
        _make_mock_page("Chapter 1: Introduction to calculus"),
        _make_mock_page("This chapter covers derivatives and integrals"),
    ]
    mock_open.return_value.__enter__ = MagicMock(return_value=mock_pdf)
    mock_open.return_value.__exit__ = MagicMock(return_value=False)

    assert DocumentsLoader._is_scanned_pdf("/tmp/text.pdf") is False


@patch("services.documents_loader.pdfplumber.open")
def test_is_scanned_pdf_threshold_edge_case(mock_open):
    mock_pdf = MagicMock()
    mock_pdf.pages = [_make_mock_page("x" * 49)]
    mock_open.return_value.__enter__ = MagicMock(return_value=mock_pdf)
    mock_open.return_value.__exit__ = MagicMock(return_value=False)

    assert DocumentsLoader._is_scanned_pdf("/tmp/edge.pdf", threshold=50) is True


@patch("services.documents_loader.pdfplumber.open")
def test_is_scanned_pdf_handles_exception_gracefully(mock_open):
    mock_open.side_effect = Exception("corrupt file")

    assert DocumentsLoader._is_scanned_pdf("/tmp/corrupt.pdf") is False
