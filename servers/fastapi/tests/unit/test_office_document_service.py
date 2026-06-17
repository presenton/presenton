import zipfile

import pytest

from services.office_document_service import (
    OfficeDocumentError,
    extract_office_document_text,
)


def _write_zip(path, files):
    with zipfile.ZipFile(path, "w") as archive:
        for name, content in files.items():
            archive.writestr(name, content)


def test_extracts_pptx_slide_text_in_slide_order(tmp_path):
    path = tmp_path / "deck.pptx"
    _write_zip(
        path,
        {
            "ppt/slides/slide10.xml": "<p:sld xmlns:p='p' xmlns:a='a'><a:t>Ten</a:t></p:sld>",
            "ppt/slides/slide2.xml": "<p:sld xmlns:p='p' xmlns:a='a'><a:t>Two</a:t></p:sld>",
            "ppt/slides/slide1.xml": "<p:sld xmlns:p='p' xmlns:a='a'><a:t>One</a:t></p:sld>",
        },
    )

    assert extract_office_document_text(str(path)) == "One\n\nTwo\n\nTen"


def test_extracts_docx_paragraphs(tmp_path):
    path = tmp_path / "document.docx"
    _write_zip(
        path,
        {
            "word/document.xml": (
                "<w:document xmlns:w='w'><w:body>"
                "<w:p><w:r><w:t>Hello</w:t></w:r><w:r><w:t>world</w:t></w:r></w:p>"
                "<w:p><w:r><w:t>Second paragraph</w:t></w:r></w:p>"
                "</w:body></w:document>"
            )
        },
    )

    assert extract_office_document_text(str(path)) == "Hello world\nSecond paragraph"


def test_rejects_legacy_binary_office_formats(tmp_path):
    path = tmp_path / "legacy.ppt"
    path.write_bytes(b"legacy")

    with pytest.raises(OfficeDocumentError, match="external office conversion engine"):
        extract_office_document_text(str(path))
