import asyncio
import io
import os
import struct
import zipfile
import xml.etree.ElementTree as ET
from types import SimpleNamespace

import pytest

from templates import fonts_and_slides_preview
from templates import pptx_font_utils
from models.sql.font_upload import FontUpload


class DummyLogger:
    def info(self, *_args, **_kwargs):
        return None

    def warning(self, *_args, **_kwargs):
        return None


_SIZE_UNSET = object()


class DummyUploadFile:
    def __init__(
        self,
        filename: str,
        content: bytes = b"font",
        size: int | None | object = _SIZE_UNSET,
    ) -> None:
        self.filename = filename
        self._content = content
        self.size = len(content) if size is _SIZE_UNSET else size

    async def read(self, size: int = -1) -> bytes:
        if size is None or size < 0:
            data, self._content = self._content, b""
            return data
        data, self._content = self._content[:size], self._content[size:]
        return data


async def _run_sync_in_test(func, *args, **kwargs):
    return func(*args, **kwargs)


def _fake_corrupted_pptx_bytes() -> bytes:
    return b"this is not a valid powerpoint zip package"


def _fake_pptx_bytes(slide_count: int) -> bytes:
    buffer = io.BytesIO()
    slide_ids = "\n".join(
        f'<p:sldId id="{255 + index}" r:id="rId{index}" />'
        for index in range(1, slide_count + 1)
    )
    rels = "\n".join(
        f'<Relationship Id="rId{index}" '
        'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" '
        f'Target="slides/slide{index}.xml" />'
        for index in range(1, slide_count + 1)
    )
    overrides = "\n".join(
        f'<Override PartName="/ppt/slides/slide{index}.xml" '
        'ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml" />'
        for index in range(1, slide_count + 1)
    )
    with zipfile.ZipFile(buffer, "w") as archive:
        archive.writestr(
            "[Content_Types].xml",
            f"""\
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
{overrides}
</Types>""",
        )
        archive.writestr(
            "ppt/presentation.xml",
            f"""\
<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <p:sldIdLst>
{slide_ids}
  </p:sldIdLst>
</p:presentation>""",
        )
        archive.writestr(
            "ppt/_rels/presentation.xml.rels",
            f"""\
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
{rels}
</Relationships>""",
        )
        for index in range(1, slide_count + 1):
            archive.writestr(f"ppt/slides/slide{index}.xml", "<p:sld />")
            archive.writestr(f"ppt/slides/_rels/slide{index}.xml.rels", "<rels />")
    return buffer.getvalue()


def test_build_google_fonts_stylesheet_url_includes_regular_and_bold_weights():
    assert (
        pptx_font_utils.build_google_fonts_stylesheet_url("Open Sans")
        == "https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;700&display=swap"
    )


def test_normalize_font_family_name_strips_localized_bold_token():
    assert pptx_font_utils.normalize_font_family_name("Arial Gras") == "Arial"


def test_normalize_font_family_name_preserves_width_tokens():
    assert (
        pptx_font_utils.normalize_font_family_name("Latin Condensed")
        == "Latin Condensed"
    )
    assert (
        pptx_font_utils.normalize_font_family_name("Roboto Condensed Bold")
        == "Roboto Condensed"
    )
    assert (
        pptx_font_utils.normalize_font_family_name("Arial Narrow Bold")
        == "Arial Narrow"
    )


def test_extract_font_from_eot_uses_header_font_data_offset(tmp_path):
    embedded_font = b"\x00\x01\x00\x00valid-font-data"
    header_body = b"metadata-before-font\x00\x01\x00\x00not-the-font"
    eot_size = 8 + len(header_body) + len(embedded_font)
    font_data_size = len(embedded_font)
    eot_path = tmp_path / "font.fntdata"
    eot_path.write_bytes(
        struct.pack("<II", eot_size, font_data_size) + header_body + embedded_font
    )

    assert pptx_font_utils.extract_font_from_eot(eot_path) == embedded_font


def test_check_fonts_in_pptx_rejects_100mb_file_from_upload_size():
    upload = DummyUploadFile(
        "deck.pptx",
        content=b"",
        size=fonts_and_slides_preview.MAX_FONT_CHECK_UPLOAD_SIZE_BYTES,
    )

    with pytest.raises(fonts_and_slides_preview.HTTPException) as exc_info:
        asyncio.run(fonts_and_slides_preview.check_fonts_in_pptx_handler(upload))

    assert exc_info.value.status_code == 413
    assert exc_info.value.detail == "File size must be less than 100MB."


def test_check_fonts_in_pptx_rejects_oversize_after_read_when_size_missing(
    monkeypatch,
):
    monkeypatch.setattr(
        fonts_and_slides_preview, "MAX_FONT_CHECK_UPLOAD_SIZE_BYTES", 4
    )
    upload = DummyUploadFile("deck.pptx", content=b"abcd", size=None)

    with pytest.raises(fonts_and_slides_preview.HTTPException) as exc_info:
        asyncio.run(fonts_and_slides_preview.check_fonts_in_pptx_handler(upload))

    assert exc_info.value.status_code == 413
    assert exc_info.value.detail == "File size must be less than 100MB."


def test_check_fonts_in_pptx_rejects_corrupted_pptx():
    upload = DummyUploadFile("corrupted.pptx", content=_fake_corrupted_pptx_bytes())

    with pytest.raises(fonts_and_slides_preview.HTTPException) as exc_info:
        asyncio.run(fonts_and_slides_preview.check_fonts_in_pptx_handler(upload))

    assert exc_info.value.status_code == 400
    assert exc_info.value.detail == fonts_and_slides_preview.INVALID_PPTX_UPLOAD_ERROR


def test_upload_fonts_and_preview_rejects_corrupted_pptx():
    upload = DummyUploadFile("corrupted.pptx", content=_fake_corrupted_pptx_bytes())

    with pytest.raises(fonts_and_slides_preview.HTTPException) as exc_info:
        asyncio.run(
            fonts_and_slides_preview.upload_fonts_and_preview_handler(
                pptx_file=upload,
                font_files=[],
                original_font_names=[],
                get_slide_images=True,
            )
        )

    assert exc_info.value.status_code == 400
    assert exc_info.value.detail == fonts_and_slides_preview.INVALID_PPTX_UPLOAD_ERROR


def test_template_preview_slide_cap_and_pptx_trim(tmp_path):
    pptx_path = tmp_path / "deck.pptx"
    pptx_path.write_bytes(_fake_pptx_bytes(52))

    assert fonts_and_slides_preview._resolve_template_preview_slide_cap(None) == 50
    assert fonts_and_slides_preview._resolve_template_preview_slide_cap(100) == 50
    with pytest.raises(fonts_and_slides_preview.HTTPException) as exc_info:
        fonts_and_slides_preview._resolve_template_preview_slide_cap(0)
    assert exc_info.value.status_code == 400

    trimmed_path = fonts_and_slides_preview._trim_pptx_to_max_slides(
        str(pptx_path),
        50,
        str(tmp_path),
        DummyLogger(),
    )

    assert trimmed_path != str(pptx_path)
    with zipfile.ZipFile(trimmed_path) as archive:
        assert "ppt/slides/slide50.xml" in archive.namelist()
        assert "ppt/slides/slide51.xml" not in archive.namelist()
        presentation_xml = ET.fromstring(archive.read("ppt/presentation.xml"))
        slide_ids = presentation_xml.findall(
            ".//p:sldId", fonts_and_slides_preview.PPT_NS
        )
        assert len(slide_ids) == 50
        rels_xml = ET.fromstring(archive.read("ppt/_rels/presentation.xml.rels"))
        assert rels_xml.find(
            ".//*[@Id='rId51']",
        ) is None
        content_types = archive.read("[Content_Types].xml").decode()
        assert "/ppt/slides/slide51.xml" not in content_types


@pytest.mark.anyio
async def test_upload_fonts_and_preview_uses_trimmed_pptx_for_processing(
    monkeypatch,
    tmp_path,
):
    captured = {}
    slide_path = tmp_path / "slide_1.png"
    slide_path.write_bytes(b"png")

    def assert_slide_count(path, expected_count):
        with zipfile.ZipFile(path) as archive:
            presentation_xml = ET.fromstring(archive.read("ppt/presentation.xml"))
            slide_ids = presentation_xml.findall(
                ".//p:sldId", fonts_and_slides_preview.PPT_NS
            )
            assert len(slide_ids) == expected_count
            assert "ppt/slides/slide50.xml" in archive.namelist()
            assert "ppt/slides/slide51.xml" not in archive.namelist()

    def fake_font_variants(path):
        captured["font_variant_pptx_path"] = path
        assert_slide_count(path, 50)
        return {}

    async def fake_upload_fonts_and_fix_fonts_in_pptx(
        pptx_path,
        temp_dir,
        original_filename,
        font_files,
        original_font_names,
        logger,
        session_dir,
        upload_fonts=True,
        google_font_replacements=None,
    ):
        del temp_dir, original_filename, font_files, original_font_names, logger
        del session_dir, upload_fonts, google_font_replacements
        captured["font_processing_pptx_path"] = pptx_path
        assert_slide_count(pptx_path, 50)
        return set(), {}, {}, [], pptx_path, [], [], {}, [], {}

    async def fake_create_slide_previews(
        modified_pptx_path,
        temp_dir,
        font_paths_for_install,
        font_mapping,
        explicit_font_aliases,
        protected_font_names,
        max_slides,
        logger,
        session_dir,
        font_stylesheet_urls=None,
    ):
        del temp_dir, font_paths_for_install, font_mapping, explicit_font_aliases
        del protected_font_names, logger, session_dir
        assert font_stylesheet_urls == []
        captured["preview_pptx_path"] = modified_pptx_path
        assert max_slides == 50
        assert_slide_count(modified_pptx_path, 50)
        return [str(slide_path)]

    async def fake_upload_presentations(modified_pptx_path, logger, session_dir):
        del logger, session_dir
        captured["uploaded_pptx_path"] = modified_pptx_path
        assert_slide_count(modified_pptx_path, 50)
        return modified_pptx_path

    monkeypatch.setattr(
        fonts_and_slides_preview,
        "_font_variants_by_normalized_name",
        fake_font_variants,
    )
    monkeypatch.setattr(
        fonts_and_slides_preview,
        "upload_fonts_and_fix_fonts_in_pptx",
        fake_upload_fonts_and_fix_fonts_in_pptx,
    )
    monkeypatch.setattr(
        fonts_and_slides_preview,
        "create_slide_previews",
        fake_create_slide_previews,
    )
    monkeypatch.setattr(
        fonts_and_slides_preview,
        "upload_presentations",
        fake_upload_presentations,
    )
    monkeypatch.setattr(
        fonts_and_slides_preview,
        "_public_urls_for_local_paths",
        lambda paths: list(paths),
    )

    response = await fonts_and_slides_preview.upload_fonts_and_preview_handler(
        pptx_file=DummyUploadFile("deck.pptx", content=_fake_pptx_bytes(52)),
        font_files=[],
        original_font_names=[],
        temp_dir=str(tmp_path),
    )

    assert captured["font_variant_pptx_path"].endswith("presentation-first-50.pptx")
    assert captured["font_processing_pptx_path"] == captured["font_variant_pptx_path"]
    assert captured["preview_pptx_path"] == captured["font_variant_pptx_path"]
    assert captured["uploaded_pptx_path"] == captured["font_variant_pptx_path"]
    assert response.pptx_url == captured["font_variant_pptx_path"]
    assert response.modified_pptx_url == captured["font_variant_pptx_path"]
    assert response.slide_image_urls == [str(slide_path)]


@pytest.mark.anyio
async def test_upload_fonts_and_preview_passes_google_fonts_to_html_preview(
    monkeypatch,
    tmp_path,
):
    captured = {}
    slide_path = tmp_path / "slide_1.png"
    slide_path.write_bytes(b"png")

    monkeypatch.setattr(
        fonts_and_slides_preview,
        "_font_variants_by_normalized_name",
        lambda *_args: {"Open Sans": {"bold"}},
    )

    async def fake_upload_fonts_and_fix_fonts_in_pptx(
        pptx_path,
        temp_dir,
        original_filename,
        font_files,
        original_font_names,
        logger,
        session_dir,
        upload_fonts=True,
        google_font_replacements=None,
    ):
        del temp_dir, original_filename, font_files, original_font_names
        del logger, session_dir, upload_fonts, google_font_replacements
        return {"Open Sans"}, {}, {}, [], pptx_path, [], [], {}, [], {}

    async def fake_check_google_font_availability(font_name, variants=None):
        captured["checked_font"] = font_name
        captured["checked_variants"] = variants
        return True

    async def fake_create_slide_previews(
        modified_pptx_path,
        temp_dir,
        font_paths_for_install,
        font_mapping,
        explicit_font_aliases,
        protected_font_names,
        max_slides,
        logger,
        session_dir,
        font_stylesheet_urls=None,
    ):
        del modified_pptx_path, temp_dir, font_paths_for_install, font_mapping
        del explicit_font_aliases, protected_font_names, max_slides, logger
        del session_dir
        captured["font_stylesheet_urls"] = font_stylesheet_urls
        return [str(slide_path)]

    monkeypatch.setattr(
        fonts_and_slides_preview,
        "upload_fonts_and_fix_fonts_in_pptx",
        fake_upload_fonts_and_fix_fonts_in_pptx,
    )
    monkeypatch.setattr(
        fonts_and_slides_preview,
        "check_google_font_availability",
        fake_check_google_font_availability,
    )
    monkeypatch.setattr(
        fonts_and_slides_preview,
        "create_slide_previews",
        fake_create_slide_previews,
    )
    monkeypatch.setattr(
        fonts_and_slides_preview,
        "_public_urls_for_local_paths",
        lambda paths: list(paths),
    )

    response = await fonts_and_slides_preview.upload_fonts_and_preview_handler(
        pptx_file=DummyUploadFile("deck.pptx", content=_fake_pptx_bytes(1)),
        font_files=[],
        original_font_names=[],
        upload_presentation=False,
        temp_dir=str(tmp_path),
    )

    expected_url = (
        "https://fonts.googleapis.com/css2"
        "?family=Open+Sans:wght@400;700&display=swap"
    )
    assert captured["checked_font"] == "Open Sans"
    assert captured["checked_variants"] == ["bold"]
    assert captured["font_stylesheet_urls"] == [expected_url]
    assert response.fonts == {"Open Sans": expected_url}
    assert response.slide_image_urls == [str(slide_path)]


@pytest.mark.anyio
async def test_upload_fonts_and_preview_replaces_pptx_fonts_with_selected_google_fonts(
    monkeypatch,
    tmp_path,
):
    captured = {}
    slide_path = tmp_path / "slide_1.png"
    slide_path.write_bytes(b"png")
    google_url = (
        "https://fonts.googleapis.com/css2"
        "?family=Poppins:wght@100..900&display=swap"
    )

    monkeypatch.setattr(
        fonts_and_slides_preview,
        "_font_variants_by_normalized_name",
        lambda *_args: {"Open Sans": {"bold"}},
    )

    async def fake_upload_fonts_and_fix_fonts_in_pptx(
        pptx_path,
        temp_dir,
        original_filename,
        font_files,
        original_font_names,
        logger,
        session_dir,
        upload_fonts=True,
        google_font_replacements=None,
    ):
        del temp_dir, original_filename, font_files, original_font_names
        del logger, session_dir, upload_fonts
        captured["google_font_replacements"] = google_font_replacements
        return (
            {"Open Sans"},
            {},
            google_font_replacements or {},
            [],
            pptx_path,
            [],
            [],
            {},
            [],
            {},
        )

    async def fake_create_slide_previews(
        modified_pptx_path,
        temp_dir,
        font_paths_for_install,
        font_mapping,
        explicit_font_aliases,
        protected_font_names,
        max_slides,
        logger,
        session_dir,
        font_stylesheet_urls=None,
    ):
        del modified_pptx_path, temp_dir, font_paths_for_install, font_mapping
        del explicit_font_aliases, protected_font_names, max_slides, logger
        del session_dir
        captured["font_stylesheet_urls"] = font_stylesheet_urls
        return [str(slide_path)]

    monkeypatch.setattr(
        fonts_and_slides_preview,
        "upload_fonts_and_fix_fonts_in_pptx",
        fake_upload_fonts_and_fix_fonts_in_pptx,
    )
    monkeypatch.setattr(
        fonts_and_slides_preview,
        "create_slide_previews",
        fake_create_slide_previews,
    )
    monkeypatch.setattr(
        fonts_and_slides_preview,
        "_public_urls_for_local_paths",
        lambda paths: list(paths),
    )

    response = await fonts_and_slides_preview.upload_fonts_and_preview_handler(
        pptx_file=DummyUploadFile("deck.pptx", content=_fake_pptx_bytes(1)),
        font_files=[],
        original_font_names=[],
        google_font_original_names=["Open Sans Bold"],
        google_font_replacement_names=["Poppins"],
        google_font_urls=[google_url],
        upload_presentation=False,
        temp_dir=str(tmp_path),
    )

    assert captured["google_font_replacements"] == {"Open Sans Bold": "Poppins"}
    assert captured["font_stylesheet_urls"] == [google_url]
    assert response.fonts == {"Poppins": google_url}
    assert response.slide_image_urls == [str(slide_path)]


def test_build_google_fonts_stylesheet_url_sorts_and_deduplicates_weights():
    assert (
        pptx_font_utils.build_google_fonts_stylesheet_url("DM Sans", weights=[700, 400, 700])
        == "https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;700&display=swap"
    )


def test_build_google_fonts_stylesheet_url_supports_italic_variants():
    assert (
        pptx_font_utils.build_google_fonts_stylesheet_url(
            "Montserrat", variants=["regular", "bold", "italic", "bold_italic"]
        )
        == "https://fonts.googleapis.com/css2?family=Montserrat:ital,wght@0,400;0,700;1,400;1,700&display=swap"
    )


class _FakeGoogleFontsResponse:
    def __init__(self, status, css):
        self.status = status
        self._css = css

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return False

    async def text(self):
        return self._css


class _FakeGoogleFontsSession:
    def __init__(self, status, css, requested_urls):
        self._status = status
        self._css = css
        self._requested_urls = requested_urls

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return False

    def get(self, url, timeout=None):
        self._requested_urls.append(url)
        return _FakeGoogleFontsResponse(self._status, self._css)


def test_check_google_font_availability_rejects_compatibility_font_kit(monkeypatch):
    css = """\
@font-face {
  font-family: 'Calibri';
  src: url(https://fonts.gstatic.com/l/font?kit=J7afnpV-BGlaFfdAhLEY6w) format('woff2');
}
"""
    monkeypatch.setattr(
        pptx_font_utils.aiohttp,
        "ClientSession",
        lambda: _FakeGoogleFontsSession(200, css, []),
    )

    assert asyncio.run(pptx_font_utils.check_google_font_availability("Calibri")) is False


def test_check_google_font_availability_checks_requested_variant_url(monkeypatch):
    requested_urls = []
    css = """\
@font-face {
  font-family: 'Montserrat';
  src: url(https://fonts.gstatic.com/s/montserrat/v31/font.woff2) format('woff2');
}
"""
    monkeypatch.setattr(
        pptx_font_utils.aiohttp,
        "ClientSession",
        lambda: _FakeGoogleFontsSession(200, css, requested_urls),
    )

    assert (
        asyncio.run(
            pptx_font_utils.check_google_font_availability(
                "Montserrat", variants=["regular", "bold", "italic"]
            )
        )
        is True
    )
    assert requested_urls == [
        "https://fonts.googleapis.com/css2?family=Montserrat:ital,wght@0,400;0,700;1,400&display=swap"
    ]


def test_extract_fonts_from_oxml_ignores_embedded_font_declarations():
    xml = """\
<p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
                xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
                xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <p:embeddedFontLst>
    <p:embeddedFont>
      <p:font typeface="Unused Embedded Font"/>
      <p:regular r:id="rId1"/>
    </p:embeddedFont>
  </p:embeddedFontLst>
</p:presentation>
"""

    assert pptx_font_utils.extract_fonts_from_oxml(xml) == []


def test_extract_fonts_from_oxml_prefers_latin_font_over_script_fallbacks():
    xml = """\
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
       xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld>
    <p:spTree>
      <p:sp>
        <p:txBody>
          <a:p>
            <a:r>
              <a:rPr>
                <a:latin typeface="Montserrat"/>
                <a:ea typeface="Arial"/>
                <a:cs typeface="Arial"/>
              </a:rPr>
              <a:t>Hello</a:t>
            </a:r>
          </a:p>
        </p:txBody>
      </p:sp>
    </p:spTree>
  </p:cSld>
</p:sld>
"""

    assert pptx_font_utils.extract_fonts_from_oxml(xml) == ["Montserrat"]


def test_font_info_entries_preserve_original_variant_name():
    original_names = fonts_and_slides_preview._original_names_by_normalized_variant(
        {"Arial Gras": {"bold"}}
    )

    entries = fonts_and_slides_preview._font_info_entries(
        [("Arial", None)],
        {"Arial": {"bold"}},
        original_names,
    )

    assert len(entries) == 1
    assert entries[0].name == "Arial Bold"
    assert entries[0].original_name == "Arial Gras"
    assert entries[0].family_name == "Arial"
    assert entries[0].variant == "bold"
    assert entries[0].variants == ["bold"]


def test_font_info_entries_use_explicit_variants_without_family_expansion():
    entries = fonts_and_slides_preview._font_info_entries(
        [("HK Grotesk", None, ["regular"])],
        {"HK Grotesk": {"regular", "bold", "bold_italic"}},
    )

    assert len(entries) == 1
    assert entries[0].name == "HK Grotesk Regular"
    assert entries[0].variant == "regular"
    assert entries[0].variants == ["regular"]


def test_font_info_entries_do_not_duplicate_explicit_variant_name():
    entries = fonts_and_slides_preview._font_info_entries(
        [("Aileron Bold", None, ["bold"])],
        {"Aileron": {"bold"}},
        {("Aileron", "bold"): "Aileron Bold"},
    )

    assert len(entries) == 1
    assert entries[0].name == "Aileron Bold"
    assert entries[0].original_name == "Aileron Bold"
    assert entries[0].family_name == "Aileron"
    assert entries[0].variant == "bold"
    assert entries[0].variants == ["bold"]


def test_preview_dimensions_preserve_converter_aspect_ratio():
    assert fonts_and_slides_preview._preview_dimensions_from_document(
        1280.0, 960.0
    ) == (1280, 960)
    assert fonts_and_slides_preview._preview_dimensions_from_document(0, 0) == (
        1280,
        720,
    )


def test_preview_dimensions_from_pptx_use_export_core_coordinate_space(tmp_path):
    pptx_path = tmp_path / "deck.pptx"
    with zipfile.ZipFile(pptx_path, "w") as archive:
        archive.writestr(
            "ppt/presentation.xml",
            """\
<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:sldSz cx="9144000" cy="5143500" />
</p:presentation>""",
        )

    assert fonts_and_slides_preview._preview_dimensions_from_pptx(
        str(pptx_path)
    ) == (960, 540)


def test_build_slide_preview_html_adds_fixed_viewport_css(monkeypatch):
    monkeypatch.setattr(
        fonts_and_slides_preview,
        "absolute_fastapi_asset_url",
        lambda path: f"http://backend.test{path}",
    )

    html = fonts_and_slides_preview._build_slide_preview_html(
        '<div class="slide-content">Slide</div>',
        '@font-face { font-family: "Khand"; src: url("file:///font.ttf"); }',
        font_links='<link href="https://fonts.googleapis.com/css2?family=Khand:wght@400;700&amp;display=swap" rel="stylesheet">',
        width=1024,
        height=768,
    )

    assert '<base href="http://backend.test/" />' in html
    assert (
        '<script src="http://backend.test/static/vendor/'
        'tailwindcss-browser-4.3.3.js"></script>' in html
    )
    assert "cdn.tailwindcss.com" not in html
    assert (
        '<script src="http://backend.test/static/vendor/'
        'chart-4.5.1.umd.min.js"></script>' in html
    )
    assert (
        '<script src="http://backend.test/static/vendor/'
        'chartjs-plugin-datalabels-2.2.0.min.js"></script>' in html
    )
    assert "cdn.jsdelivr.net/npm/chart.js" not in html
    assert "width: 1024px;" in html
    assert "height: 768px;" in html
    assert ".slide-content" in html
    assert "position: relative;" in html
    assert "fonts.googleapis.com/css2?family=Khand" in html
    assert 'font-family: "Khand"' in html
    assert '<div class="slide-content">Slide</div>' in html


def test_font_stylesheet_links_for_slide_html_extracts_tailwind_font_classes():
    links = fonts_and_slides_preview._font_stylesheet_links_for_slide_html(
        "<span class=\"font-['Poppins']\"></span>"
        "<span class=\"font-['DM_Sans']\"></span>"
    )

    assert "family=Poppins:wght@400;700" in links
    assert "family=DM+Sans:wght@400;700" in links
    assert links.count('rel="stylesheet"') == 2


def test_font_stylesheet_links_skip_embedded_and_uploaded_fonts():
    links = fonts_and_slides_preview._font_stylesheet_links_for_slide_html(
        "<span class=\"font-['Poppins']\"></span>"
        "<span class=\"font-['Snell_Roundhand']\"></span>"
        "<span class=\"font-['DM_Sans']\"></span>",
        "@font-face { font-family: 'Poppins'; src: url(data:font/ttf;base64,AA); }"
        '@font-face { font-family: "Snell Roundhand"; src: url(data:font/ttf;base64,AA); }',
    )

    assert "family=Poppins" not in links
    assert "family=Snell+Roundhand" not in links
    assert "family=DM+Sans:wght@400;700" in links
    assert links.count('rel="stylesheet"') == 1


def test_font_css_family_aliases_match_tailwind_underscore_font_values():
    css = (
        "@font-face { font-family: 'Hagrid_Text_Heavy'; "
        "src: url('/app_data/pptx-to-html/session/fonts/hagrid.otf'); }"
        "@font-face { font-family: 'Aileron'; "
        "src: url('/app_data/pptx-to-html/session/fonts/aileron.otf'); }"
    )

    aliases = fonts_and_slides_preview._font_css_family_aliases(css)

    assert 'font-family: "Hagrid Text Heavy"' in aliases
    assert "hagrid.otf" in aliases
    assert "Aileron" not in aliases


def test_font_face_css_for_declared_fonts_uses_actual_font_metadata(
    monkeypatch,
    tmp_path,
):
    monkeypatch.setenv("TEMP_DIRECTORY", str(tmp_path))
    font_path = tmp_path / "Formula-Bold.otf"
    font_path.write_bytes(b"font")
    font_url = font_path.resolve().as_uri()

    monkeypatch.setattr(
        fonts_and_slides_preview,
        "get_font_details",
        lambda path: pptx_font_utils.FontDetail(
            file=path,
            size_bytes=123,
            family_name="Formula",
            full_name="Formula Bold",
            subfamily_name="Regular",
            postscript_name="FormulaCondensed-Bold",
            weight_class=700,
        ),
    )

    css = fonts_and_slides_preview._font_face_css_for_declared_fonts(
        "@font-face { "
        "font-family: 'Formula_Bold'; "
        "font-weight: 400; "
        f"src: url('{font_url}') format('opentype'); "
        "}"
    )

    assert 'font-family: "Formula_Bold";' in css
    assert 'font-family: "Formula Bold";' in css
    assert 'font-family: "Formula";' in css
    assert "font-weight: 700;" in css
    assert f'url("{font_url}")' in css


def test_tailwind_fallback_css_handles_converted_slide_utility_classes():
    css = fonts_and_slides_preview._tailwind_fallback_css_for_slide_html(
        '<div class="absolute left-[72.0px] top-[109.7px] '
        'w-[440.5px] h-[57.5px] overflow-visible bg-[#F15560]">'
        '<span class="text-[42.7px] text-[#FFFFFF] font-bold '
        "font-['Formula_Bold']\">CAMPAIGN GOALS</span>"
        "</div>"
    )

    assert '[class~="absolute"]{position:absolute;}' in css
    assert '[class~="left-[72.0px]"]{left:72.0px;}' in css
    assert '[class~="text-[42.7px]"]{font-size:42.7px;}' in css
    assert '[class~="text-[#FFFFFF]"]{color:#FFFFFF;}' in css
    assert '[class~="font-bold"]{font-weight:700;}' in css
    assert (
        '[class~="font-[\'Formula_Bold\']"]{font-family:"Formula_Bold", Arial, sans-serif;}'
        in css
    )


def test_font_face_css_for_local_fonts_includes_family_and_full_names(
    monkeypatch,
    tmp_path,
):
    font_path = tmp_path / "Khand-Bold.ttf"
    font_path.write_bytes(b"font")

    monkeypatch.setattr(
        fonts_and_slides_preview,
        "get_font_details",
        lambda path: pptx_font_utils.FontDetail(
            file=path,
            size_bytes=123,
            family_name="Khand",
            full_name="Khand Bold",
            subfamily_name="Bold",
            weight_class=700,
        ),
    )

    css = fonts_and_slides_preview._font_face_css_for_local_fonts([str(font_path)])

    assert 'font-family: "Khand";' in css
    assert 'font-family: "Khand Bold";' in css
    assert f'url("{font_path.resolve().as_uri()}")' in css
    assert "font-weight: 700;" in css
    assert "font-style: normal;" in css


def test_localize_preview_asset_urls_rewrites_app_data_http_urls(monkeypatch, tmp_path):
    image_path = tmp_path / "asset.png"
    image_path.write_bytes(b"png")

    def fake_resolve(path_or_url):
        assert path_or_url == "/app_data/pptx-to-html/session/images/asset.png"
        return str(image_path)

    monkeypatch.setattr(
        fonts_and_slides_preview,
        "resolve_app_path_to_filesystem",
        fake_resolve,
    )

    html = (
        '<img src="http://127.0.0.1:5001/app_data/pptx-to-html/session/images/asset.png">'
        "<div style=\"background-image: url('/app_data/pptx-to-html/session/images/asset.png')\"></div>"
    )

    localized = fonts_and_slides_preview._localize_preview_asset_urls(html)

    assert localized.count("data:image/png;base64,cG5n") == 2
    assert "http://127.0.0.1:5001/app_data" not in localized
    assert "url('data:image/png;base64,cG5n')" in localized


def test_localize_preview_asset_urls_absolutizes_unresolved_app_data_urls(
    monkeypatch,
):
    monkeypatch.setattr(
        fonts_and_slides_preview,
        "resolve_app_path_to_filesystem",
        lambda _path_or_url: None,
    )
    monkeypatch.setattr(
        fonts_and_slides_preview,
        "absolute_fastapi_asset_url",
        lambda path: f"http://backend.test{path}",
    )

    html = (
        "@font-face { font-family: 'Aileron'; "
        "src: url('/app_data/pptx-to-html/session/fonts/aileron.otf'); }"
    )

    localized = fonts_and_slides_preview._localize_preview_asset_urls(html)

    assert (
        "url('http://backend.test/app_data/pptx-to-html/session/fonts/aileron.otf')"
        in localized
    )


def test_localize_preview_asset_urls_leaves_external_urls(monkeypatch):
    calls = []
    monkeypatch.setattr(
        fonts_and_slides_preview,
        "resolve_app_path_to_filesystem",
        lambda path_or_url: calls.append(path_or_url) or None,
    )

    html = '<img src="https://example.com/image.png">'

    assert fonts_and_slides_preview._localize_preview_asset_urls(html) == html
    assert calls == []


def test_localize_preview_asset_urls_resolves_converter_relative_assets(
    monkeypatch,
    tmp_path,
):
    monkeypatch.setenv("APP_DATA_DIRECTORY", str(tmp_path))
    monkeypatch.setenv("DISABLE_AUTH", "true")
    artifact_dir = tmp_path / "pptx-to-html" / "session"
    image_path = artifact_dir / "images" / "asset.png"
    svg_with_png_extension_path = artifact_dir / "images" / "icon.png"
    font_path = artifact_dir / "fonts" / "deck.woff2"
    image_path.parent.mkdir(parents=True)
    font_path.parent.mkdir(parents=True)
    image_path.write_bytes(b"png")
    svg_with_png_extension_path.write_bytes(b'<svg xmlns="http://www.w3.org/2000/svg"/>')
    font_path.write_bytes(b"font")

    html = (
        '<img src="images/asset.png">'
        '<img src="images/icon.png">'
        "<style>@font-face { src: url('fonts/deck.woff2'); }</style>"
    )

    localized = fonts_and_slides_preview._localize_preview_asset_urls(
        html,
        relative_asset_root=str(artifact_dir),
    )

    assert 'src="data:image/png;base64,cG5n"' in localized
    assert 'src="data:image/svg+xml;base64,' in localized
    assert "url('data:font/woff2;base64,Zm9udA==')" in localized


def test_localize_preview_asset_urls_rejects_relative_path_traversal(tmp_path):
    artifact_dir = tmp_path / "pptx-to-html" / "session"
    artifact_dir.mkdir(parents=True)
    outside_path = tmp_path / "secret.png"
    outside_path.write_bytes(b"secret")
    html = '<img src="../../secret.png">'

    localized = fonts_and_slides_preview._localize_preview_asset_urls(
        html,
        relative_asset_root=str(artifact_dir),
    )

    assert localized == html


@pytest.mark.anyio
async def test_create_slide_previews_from_json_uses_pptx_dimensions_and_fonts(
    monkeypatch,
    tmp_path,
):
    font_path = tmp_path / "Khand-Bold.ttf"
    font_path.write_bytes(b"font")
    rendered_path = tmp_path / "slide.png"
    rendered_path.write_bytes(b"png")
    render_calls = []

    monkeypatch.setattr(
        fonts_and_slides_preview,
        "get_font_details",
        lambda path: pptx_font_utils.FontDetail(
            file=path,
            size_bytes=123,
            family_name="Khand",
            full_name="Khand Bold",
            subfamily_name="Bold",
            weight_class=700,
        ),
    )

    class FakeExportTaskService:
        async def convert_pptx_to_json(self, pptx_path):
            assert pptx_path == "deck.pptx"
            return SimpleNamespace(
                layouts=[{"elements": [{"type": "text", "text": "Slide"}]}],
            )

        async def render_jsons_to_images(self, data, width, height, fonts=None):
            render_calls.append((data, width, height, fonts))
            return SimpleNamespace(paths=[str(rendered_path)])

    monkeypatch.setattr(
        fonts_and_slides_preview,
        "EXPORT_TASK_SERVICE",
        FakeExportTaskService(),
    )
    monkeypatch.setattr(
        fonts_and_slides_preview,
        "_preview_dimensions_from_pptx",
        lambda _path: (1024, 768),
    )

    result = await fonts_and_slides_preview.render_pptx_slides_to_images(
        modified_pptx_path="deck.pptx",
        font_paths_for_install=[str(font_path)],
        max_slides=1,
        logger=DummyLogger(),
        font_stylesheet_urls=[
            "https://fonts.googleapis.com/css2?family=Montserrat:wght@400&display=swap"
        ],
    )

    assert result == [str(rendered_path)]
    assert len(render_calls) == 1
    layouts, width, height, fonts = render_calls[0]
    assert width == 1024
    assert height == 768
    assert layouts == [{"elements": [{"type": "text", "text": "Slide"}]}]
    assert 'font-family: "Khand Bold";' in fonts["css"]
    assert font_path.resolve().as_uri() in fonts["css"]
    assert fonts["fonts"] == [
        "https://fonts.googleapis.com/css2?family=Montserrat:wght@400&display=swap"
    ]


@pytest.mark.anyio
async def test_create_slide_previews_from_json_batches_slides_in_one_task(
    monkeypatch,
    tmp_path,
):
    output_paths = [tmp_path / "slide-1.png", tmp_path / "slide-2.png"]
    for output_path in output_paths:
        output_path.write_bytes(b"png")
    render_calls = []

    class FakeExportTaskService:
        async def convert_pptx_to_json(self, pptx_path):
            return SimpleNamespace(
                layouts=[
                    {"elements": [{"type": "text", "text": "One"}]},
                    {"elements": [{"type": "text", "text": "Two"}]},
                ],
            )

        async def render_jsons_to_images(self, data, width, height, fonts=None):
            render_calls.append((data, width, height, fonts))
            return SimpleNamespace(paths=[str(path) for path in output_paths])

    monkeypatch.setattr(
        fonts_and_slides_preview,
        "EXPORT_TASK_SERVICE",
        FakeExportTaskService(),
    )
    monkeypatch.setattr(
        fonts_and_slides_preview,
        "_preview_dimensions_from_pptx",
        lambda _path: (320, 180),
    )

    result = await fonts_and_slides_preview.render_pptx_slides_to_images(
        modified_pptx_path="deck.pptx",
        font_paths_for_install=[],
        max_slides=None,
        logger=DummyLogger(),
    )

    assert len(render_calls) == 1
    layouts, width, height, fonts = render_calls[0]
    assert width == 320
    assert height == 180
    assert len(layouts) == 2
    assert layouts[0]["elements"][0]["text"] == "One"
    assert layouts[1]["elements"][0]["text"] == "Two"
    assert fonts is None
    assert result == [str(path) for path in output_paths]


@pytest.mark.anyio
async def test_render_pptx_slides_to_images_rejects_image_count_mismatch(monkeypatch):
    class FakeExportTaskService:
        async def convert_pptx_to_json(self, pptx_path):
            return SimpleNamespace(
                layouts=[{"elements": []}, {"elements": []}],
            )

        async def render_jsons_to_images(self, data, width, height, fonts=None):
            return SimpleNamespace(paths=["slide-1.png"])

    monkeypatch.setattr(
        fonts_and_slides_preview,
        "EXPORT_TASK_SERVICE",
        FakeExportTaskService(),
    )

    with pytest.raises(fonts_and_slides_preview.HTTPException) as exc_info:
        await fonts_and_slides_preview.render_pptx_slides_to_images(
            modified_pptx_path="deck.pptx",
            font_paths_for_install=[],
            max_slides=None,
            logger=DummyLogger(),
        )

    assert exc_info.value.status_code == 500
    assert "expected 2, got 1" in exc_info.value.detail


@pytest.mark.anyio
async def test_create_slide_previews_uses_json_render_path(monkeypatch, tmp_path):
    rendered_paths = [str(tmp_path / "slide1.png"), str(tmp_path / "slide2.png")]

    async def fake_render_from_json(
        modified_pptx_path,
        font_paths_for_install,
        max_slides,
        logger,
        font_stylesheet_urls=None,
    ):
        assert modified_pptx_path == "deck.pptx"
        assert font_paths_for_install == ["font.ttf"]
        assert max_slides == 2
        assert font_stylesheet_urls is None
        return rendered_paths

    async def fake_persist_files_to_session(pairs):
        return [destination for destination, _source in pairs]

    monkeypatch.setattr(
        fonts_and_slides_preview,
        "render_pptx_slides_to_images",
        fake_render_from_json,
    )
    monkeypatch.setattr(
        fonts_and_slides_preview,
        "_persist_files_to_session",
        fake_persist_files_to_session,
    )

    result = await fonts_and_slides_preview.create_slide_previews(
        modified_pptx_path="deck.pptx",
        temp_dir=str(tmp_path),
        font_paths_for_install=["font.ttf"],
        font_mapping={},
        explicit_font_aliases=None,
        protected_font_names=None,
        max_slides=2,
        logger=DummyLogger(),
        session_dir=str(tmp_path / "session"),
    )

    assert result == [
        str(tmp_path / "session" / "slide_1.png"),
        str(tmp_path / "session" / "slide_2.png"),
    ]


def test_create_font_alias_config_protects_embedded_font_names(tmp_path):
    alias_path = pptx_font_utils.create_font_alias_config(
        ["Akzidenz-Grotesk Heavy", "Open Sauce Bold"],
        temp_dir=str(tmp_path),
        protected_font_names=["Akzidenz-Grotesk Heavy"],
    )

    alias_xml = open(alias_path, encoding="utf-8").read()

    assert "<string>Akzidenz-Grotesk</string>" not in alias_xml
    assert "<string>Akzidenz-Grotesk Heavy</string>" not in alias_xml
    assert "<string>Open Sauce Bold</string>" in alias_xml
    assert "<string>Open Sauce</string>" in alias_xml


def test_create_font_alias_config_preserves_explicit_aliases(tmp_path):
    alias_path = pptx_font_utils.create_font_alias_config(
        ["Legacy Font Heavy", "Installed Font Heavy"],
        temp_dir=str(tmp_path),
        explicit_aliases={"Legacy Font Heavy": "Installed Font Heavy"},
    )

    alias_xml = open(alias_path, encoding="utf-8").read()

    assert "<string>Legacy Font Heavy</string>" in alias_xml
    assert "<string>Installed Font Heavy</string>" in alias_xml
    assert "<string>Legacy Font</string>" not in alias_xml


def test_get_available_and_unavailable_fonts_for_pptx_returns_bold_google_font_url(
    monkeypatch,
):
    async def fake_to_thread(func, *args, **kwargs):
        return func(*args, **kwargs)

    monkeypatch.setattr(pptx_font_utils.asyncio, "to_thread", fake_to_thread)

    monkeypatch.setattr(
        pptx_font_utils,
        "extract_raw_fonts_and_embedded_details",
        lambda pptx_path, temp_dir: ({"Open Sans"}, [], []),
    )

    async def fake_check_google_font_availability(font_name: str, variants=None) -> bool:
        assert font_name == "Open Sans"
        assert variants == ["regular"]
        return True

    monkeypatch.setattr(
        pptx_font_utils,
        "check_google_font_availability",
        fake_check_google_font_availability,
    )

    available_fonts, unavailable_fonts = asyncio.run(
        pptx_font_utils.get_available_and_unavailable_fonts_for_pptx(
            "presentation.pptx", "/tmp"
        )
    )

    assert unavailable_fonts == []
    assert available_fonts == [
        (
            "Open Sans",
            "https://fonts.googleapis.com/css2?family=Open+Sans:wght@400&display=swap",
            ["regular"],
        )
    ]


def test_get_available_and_unavailable_fonts_for_pptx_returns_variant_google_font_url(
    monkeypatch,
):
    async def fake_to_thread(func, *args, **kwargs):
        return func(*args, **kwargs)

    monkeypatch.setattr(pptx_font_utils.asyncio, "to_thread", fake_to_thread)
    monkeypatch.setattr(
        pptx_font_utils,
        "extract_raw_fonts_and_embedded_details",
        lambda pptx_path, temp_dir: ({"Montserrat"}, [], []),
    )
    monkeypatch.setattr(
        pptx_font_utils,
        "extract_used_font_variants_from_pptx",
        lambda pptx_path: {"Montserrat": {"regular", "bold", "italic"}},
    )

    async def fake_check_google_font_availability(font_name: str, variants=None) -> bool:
        assert variants == ["regular", "bold", "italic"]
        return True

    monkeypatch.setattr(
        pptx_font_utils,
        "check_google_font_availability",
        fake_check_google_font_availability,
    )

    available_fonts, unavailable_fonts = asyncio.run(
        pptx_font_utils.get_available_and_unavailable_fonts_for_pptx(
            "presentation.pptx", "/tmp"
        )
    )

    assert unavailable_fonts == []
    assert available_fonts == [
        (
            "Montserrat",
            "https://fonts.googleapis.com/css2?family=Montserrat:ital,wght@0,400;0,700;1,400&display=swap",
            ["regular", "bold", "italic"],
        )
    ]


def test_get_available_and_unavailable_fonts_for_pptx_is_variant_aware(
    monkeypatch,
):
    async def fake_to_thread(func, *args, **kwargs):
        return func(*args, **kwargs)

    monkeypatch.setattr(pptx_font_utils.asyncio, "to_thread", fake_to_thread)
    monkeypatch.setattr(
        pptx_font_utils,
        "extract_raw_fonts_and_embedded_details",
        lambda pptx_path, temp_dir: (
            {"HK Grotesk", "HK Grotesk Semi-Bold"},
            [object()],
            [],
        ),
    )
    monkeypatch.setattr(
        pptx_font_utils,
        "extract_used_font_variants_from_pptx",
        lambda pptx_path: {
            "HK Grotesk": {"regular"},
            "HK Grotesk Semi-Bold": {"bold"},
        },
    )
    monkeypatch.setattr(
        pptx_font_utils,
        "get_index_of_matching_font_detail_or_none",
        lambda font_name, _details: 0
        if font_name == "HK Grotesk Semi-Bold"
        else None,
    )

    async def fake_check_google_font_availability(font_name: str, variants=None) -> bool:
        assert font_name == "HK Grotesk"
        assert variants == ["regular"]
        return False

    monkeypatch.setattr(
        pptx_font_utils,
        "check_google_font_availability",
        fake_check_google_font_availability,
    )

    available_fonts, unavailable_fonts = asyncio.run(
        pptx_font_utils.get_available_and_unavailable_fonts_for_pptx(
            "presentation.pptx", "/tmp"
        )
    )

    assert available_fonts == [
        (
            "HK Grotesk Semi-Bold",
            "https://example.com/just-a-placeholder-url.ttf",
            ["bold"],
        )
    ]
    assert unavailable_fonts == [("HK Grotesk", None, ["regular"])]


def test_extract_used_fonts_from_pptx_only_returns_fonts_used_by_slide_content(tmp_path):
    pptx_path = tmp_path / "font-check.pptx"

    files = {
        "ppt/presentation.xml": """\
<p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
                xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
                xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <p:sldIdLst>
    <p:sldId id="256" r:id="rId1"/>
  </p:sldIdLst>
  <p:embeddedFontLst>
    <p:embeddedFont>
      <p:font typeface="Unused Embedded Font"/>
      <p:regular r:id="rIdEmbedded"/>
    </p:embeddedFont>
  </p:embeddedFontLst>
</p:presentation>
""",
        "ppt/_rels/presentation.xml.rels": """\
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1"
                Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide"
                Target="slides/slide1.xml"/>
  <Relationship Id="rIdTheme"
                Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme"
                Target="theme/theme1.xml"/>
</Relationships>
""",
        "ppt/theme/theme1.xml": """\
<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
  <a:themeElements>
    <a:fontScheme name="Custom">
      <a:majorFont>
        <a:latin typeface="Heading Theme Font"/>
      </a:majorFont>
      <a:minorFont>
        <a:latin typeface="Body Theme Font"/>
      </a:minorFont>
    </a:fontScheme>
  </a:themeElements>
</a:theme>
""",
        "ppt/slides/slide1.xml": """\
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
       xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
       xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <p:cSld>
    <p:spTree>
      <p:sp>
        <p:nvSpPr>
          <p:cNvPr id="2" name="Body Placeholder"/>
          <p:cNvSpPr/>
          <p:nvPr>
            <p:ph type="body" idx="1"/>
          </p:nvPr>
        </p:nvSpPr>
        <p:spPr/>
        <p:txBody>
          <a:bodyPr/>
          <a:lstStyle/>
          <a:p>
            <a:r>
              <a:t>Hello world</a:t>
            </a:r>
          </a:p>
        </p:txBody>
      </p:sp>
    </p:spTree>
  </p:cSld>
</p:sld>
""",
        "ppt/slides/_rels/slide1.xml.rels": """\
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1"
                Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout"
                Target="../slideLayouts/slideLayout1.xml"/>
</Relationships>
""",
        "ppt/slideLayouts/slideLayout1.xml": """\
<p:sldLayout xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
             xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld>
    <p:spTree>
      <p:sp>
        <p:nvSpPr>
          <p:cNvPr id="3" name="Layout Placeholder"/>
          <p:cNvSpPr/>
          <p:nvPr>
            <p:ph type="body" idx="1"/>
          </p:nvPr>
        </p:nvSpPr>
        <p:spPr/>
        <p:txBody>
          <a:bodyPr/>
          <a:lstStyle/>
        </p:txBody>
      </p:sp>
    </p:spTree>
  </p:cSld>
</p:sldLayout>
""",
        "ppt/slideLayouts/_rels/slideLayout1.xml.rels": """\
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1"
                Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster"
                Target="../slideMasters/slideMaster1.xml"/>
</Relationships>
""",
        "ppt/slideMasters/slideMaster1.xml": """\
<p:sldMaster xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
             xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld>
    <p:spTree/>
  </p:cSld>
  <p:txStyles>
    <p:bodyStyle>
      <a:lvl1pPr>
        <a:defRPr>
          <a:latin typeface="+mn-lt"/>
        </a:defRPr>
      </a:lvl1pPr>
    </p:bodyStyle>
  </p:txStyles>
</p:sldMaster>
""",
    }

    with zipfile.ZipFile(pptx_path, "w") as archive:
        for name, content in files.items():
            archive.writestr(name, content)

    assert pptx_font_utils.extract_used_fonts_from_pptx(str(pptx_path)) == {
        "Body Theme Font"
    }


def test_extract_used_fonts_from_pptx_prefers_latin_font_over_fallbacks(tmp_path):
    pptx_path = tmp_path / "font-fallbacks.pptx"

    with zipfile.ZipFile(pptx_path, "w") as archive:
        archive.writestr(
            "ppt/presentation.xml",
            """\
<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
                xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <p:sldIdLst>
    <p:sldId id="256" r:id="rId1"/>
  </p:sldIdLst>
</p:presentation>
""",
        )
        archive.writestr(
            "ppt/_rels/presentation.xml.rels",
            """\
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1"
                Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide"
                Target="slides/slide1.xml"/>
</Relationships>
""",
        )
        archive.writestr(
            "ppt/slides/slide1.xml",
            """\
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
       xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld>
    <p:spTree>
      <p:sp>
        <p:txBody>
          <a:p>
            <a:r>
              <a:rPr>
                <a:latin typeface="Georgia"/>
                <a:ea typeface="Arial"/>
                <a:cs typeface="Arial"/>
              </a:rPr>
              <a:t>Hello world</a:t>
            </a:r>
          </a:p>
        </p:txBody>
      </p:sp>
    </p:spTree>
  </p:cSld>
</p:sld>
""",
        )

    assert pptx_font_utils.extract_used_fonts_from_pptx(str(pptx_path)) == {"Georgia"}


def test_extract_used_font_variants_from_pptx_reads_bold_and_italic_runs(tmp_path):
    pptx_path = tmp_path / "font-variants.pptx"

    with zipfile.ZipFile(pptx_path, "w") as archive:
        archive.writestr(
            "ppt/presentation.xml",
            """\
<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
                xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <p:sldIdLst>
    <p:sldId id="256" r:id="rId1"/>
  </p:sldIdLst>
</p:presentation>
""",
        )
        archive.writestr(
            "ppt/_rels/presentation.xml.rels",
            """\
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1"
                Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide"
                Target="slides/slide1.xml"/>
</Relationships>
""",
        )
        archive.writestr(
            "ppt/slides/slide1.xml",
            """\
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
       xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld>
    <p:spTree>
      <p:sp>
        <p:txBody>
          <a:p>
            <a:r>
              <a:rPr b="1">
                <a:latin typeface="Montserrat"/>
              </a:rPr>
              <a:t>Bold</a:t>
            </a:r>
            <a:r>
              <a:rPr i="1">
                <a:latin typeface="Montserrat"/>
              </a:rPr>
              <a:t>Italic</a:t>
            </a:r>
            <a:r>
              <a:rPr b="1" i="1">
                <a:latin typeface="Georgia"/>
              </a:rPr>
              <a:t>Bold italic</a:t>
            </a:r>
          </a:p>
        </p:txBody>
      </p:sp>
    </p:spTree>
  </p:cSld>
</p:sld>
""",
        )

    assert pptx_font_utils.extract_used_font_variants_from_pptx(str(pptx_path)) == {
        "Georgia": {"bold_italic"},
        "Montserrat": {"bold", "italic"},
    }


def test_replace_fonts_in_pptx_uses_variant_specific_family_names(tmp_path):
    pptx_path = tmp_path / "font-replace.pptx"
    output_path = tmp_path / "font-replaced.pptx"

    with zipfile.ZipFile(pptx_path, "w") as archive:
        archive.writestr(
            "ppt/slides/slide1.xml",
            """\
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
       xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld>
    <p:spTree>
      <p:sp>
        <p:txBody>
          <a:p>
            <a:pPr>
              <a:defRPr>
                <a:latin typeface="Arial"/>
              </a:defRPr>
            </a:pPr>
            <a:r>
              <a:rPr>
                <a:latin typeface="Arial"/>
              </a:rPr>
              <a:t>Regular</a:t>
            </a:r>
            <a:r>
              <a:rPr b="1">
                <a:latin typeface="Arial"/>
              </a:rPr>
              <a:t>Bold</a:t>
            </a:r>
            <a:r>
              <a:rPr i="1">
                <a:latin typeface="Arial"/>
              </a:rPr>
              <a:t>Italic</a:t>
            </a:r>
            <a:r>
              <a:rPr b="1"/>
              <a:t>Inherited bold</a:t>
            </a:r>
          </a:p>
        </p:txBody>
      </p:sp>
    </p:spTree>
  </p:cSld>
</p:sld>
""",
        )

    pptx_font_utils.replace_fonts_in_pptx(
        str(pptx_path),
        {"Arial": "Arial Regular"},
        str(output_path),
        font_variant_mapping={
            "Arial": {
                "regular": "Arial Regular",
                "bold": "Arial Bold",
                "italic": "Arial Italic",
            }
        },
    )

    with zipfile.ZipFile(output_path, "r") as archive:
        xml = archive.read("ppt/slides/slide1.xml").decode("utf-8")

    assert 'typeface="Arial Regular"' in xml
    assert 'typeface="Arial Bold"' in xml
    assert 'typeface="Arial Italic"' in xml
    assert xml.count('typeface="Arial Bold"') == 2


def test_replace_fonts_in_pptx_rewrites_xml_without_variant_mapping(tmp_path):
    pptx_path = tmp_path / "font-replace-simple.pptx"
    output_path = tmp_path / "font-replaced-simple.pptx"

    files = {
        "ppt/slides/slide1.xml": """\
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
       xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld>
    <p:spTree>
      <p:sp>
        <p:txBody>
          <a:p>
            <a:r>
              <a:rPr>
                <a:latin typeface="Akzidenz-Grotesk Heavy"/>
              </a:rPr>
              <a:t>Slide</a:t>
            </a:r>
          </a:p>
        </p:txBody>
      </p:sp>
    </p:spTree>
  </p:cSld>
</p:sld>
""",
        "ppt/slideLayouts/slideLayout1.xml": """\
<p:sldLayout xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
             xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld>
    <p:spTree>
      <p:sp>
        <p:txBody>
          <a:p>
            <a:pPr>
              <a:defRPr>
                <a:latin typeface="Akzidenz-Grotesk Heavy"/>
              </a:defRPr>
            </a:pPr>
          </a:p>
        </p:txBody>
      </p:sp>
    </p:spTree>
  </p:cSld>
</p:sldLayout>
""",
        "ppt/charts/chart1.xml": """\
<c:chartSpace xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
              xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart">
  <c:chart>
    <c:title>
      <c:tx>
        <c:rich>
          <a:p>
            <a:r>
              <a:rPr>
                <a:latin typeface="Akzidenz-Grotesk Heavy"/>
              </a:rPr>
              <a:t>Chart</a:t>
            </a:r>
          </a:p>
        </c:rich>
      </c:tx>
    </c:title>
  </c:chart>
</c:chartSpace>
""",
    }

    with zipfile.ZipFile(pptx_path, "w") as archive:
        for name, content in files.items():
            archive.writestr(name, content)

    pptx_font_utils.replace_fonts_in_pptx(
        str(pptx_path),
        {"Akzidenz-Grotesk Heavy": "Akzidenz-Grotesk Black"},
        str(output_path),
    )

    with zipfile.ZipFile(output_path, "r") as archive:
        for name in files:
            xml = archive.read(name).decode("utf-8")
            assert 'typeface="Akzidenz-Grotesk Black"' in xml
            assert "Akzidenz-Grotesk Heavy" not in xml


@pytest.mark.anyio
async def test_uploaded_font_mapping_uses_original_variant_name_and_uploaded_actual_name(
    monkeypatch,
    tmp_path,
):
    monkeypatch.setattr(
        fonts_and_slides_preview.asyncio, "to_thread", _run_sync_in_test
    )

    def fake_get_font_details(path: str) -> pptx_font_utils.FontDetail:
        if path.endswith("Calibri-Bold.ttf"):
            return pptx_font_utils.FontDetail(
                file=path,
                size_bytes=123,
                family_name="Calibri",
                full_name="Calibri Bold",
                subfamily_name="Bold",
                weight_class=700,
            )
        return pptx_font_utils.FontDetail(
            file=path,
            size_bytes=123,
            family_name="Calibri",
            full_name="Calibri Regular",
            subfamily_name="Regular",
            weight_class=400,
        )

    monkeypatch.setattr(
        fonts_and_slides_preview,
        "get_font_details",
        fake_get_font_details,
    )

    (
        custom_font_files,
        font_mapping,
        font_variant_mapping,
    ) = await fonts_and_slides_preview._save_uploaded_fonts_to_temp(
        [
            DummyUploadFile("Calibri-Bold.ttf"),
            DummyUploadFile("Calibri-Regular.ttf"),
        ],
        ["Arial Bold", "Arial Regular"],
        str(tmp_path),
        DummyLogger(),
    )

    assert [original_name for _, original_name in custom_font_files] == [
        "Arial Bold",
        "Arial Regular",
    ]
    assert font_mapping == {
        "Arial Bold": "Calibri Bold",
        "Arial Regular": "Calibri Regular",
    }
    assert font_variant_mapping["Arial"] == {
        "bold": "Calibri Bold",
        "regular": "Calibri Regular",
    }
    assert font_variant_mapping["Arial Bold"] == {"bold": "Calibri Bold"}
    assert font_variant_mapping["Arial Regular"] == {"regular": "Calibri Regular"}


@pytest.mark.anyio
async def test_direct_upload_uses_canonical_name_for_localized_same_family_variant(
    monkeypatch,
    tmp_path,
):
    monkeypatch.setattr(
        fonts_and_slides_preview.asyncio, "to_thread", _run_sync_in_test
    )

    def fake_get_font_details(path: str) -> pptx_font_utils.FontDetail:
        return pptx_font_utils.FontDetail(
            file=path,
            size_bytes=123,
            family_name="Arial Gras",
            full_name="Arial Gras",
            subfamily_name="Gras",
            weight_class=700,
        )

    monkeypatch.setattr(
        fonts_and_slides_preview,
        "get_font_details",
        fake_get_font_details,
    )

    (
        _custom_font_files,
        font_mapping,
        font_variant_mapping,
    ) = await fonts_and_slides_preview._save_uploaded_fonts_to_temp(
        [DummyUploadFile("arialbd.ttf")],
        ["Arial Bold"],
        str(tmp_path),
        DummyLogger(),
    )

    assert font_mapping == {"Arial Bold": "Arial Bold"}
    assert font_variant_mapping["Arial"] == {"bold": "Arial Bold"}
    assert font_variant_mapping["Arial Bold"] == {"bold": "Arial Bold"}


@pytest.mark.anyio
async def test_direct_upload_keeps_different_replacement_font_family(
    monkeypatch,
    tmp_path,
):
    monkeypatch.setattr(
        fonts_and_slides_preview.asyncio, "to_thread", _run_sync_in_test
    )

    def fake_get_font_details(path: str) -> pptx_font_utils.FontDetail:
        return pptx_font_utils.FontDetail(
            file=path,
            size_bytes=123,
            family_name="Khand",
            full_name="Khand Bold",
            subfamily_name="Bold",
            weight_class=700,
        )

    monkeypatch.setattr(
        fonts_and_slides_preview,
        "get_font_details",
        fake_get_font_details,
    )

    (
        _custom_font_files,
        font_mapping,
        font_variant_mapping,
    ) = await fonts_and_slides_preview._save_uploaded_fonts_to_temp(
        [DummyUploadFile("Khand-Bold.ttf")],
        ["Arial Bold"],
        str(tmp_path),
        DummyLogger(),
    )

    assert font_mapping == {"Arial Bold": "Khand Bold"}
    assert font_variant_mapping["Arial"] == {"bold": "Khand Bold"}
    assert font_variant_mapping["Arial Bold"] == {"bold": "Khand Bold"}


@pytest.mark.anyio
async def test_custom_uploads_skip_saved_font_lookup_for_exact_variant_names(
    monkeypatch,
    tmp_path,
):
    captured_candidates = []
    captured_replacement = {}

    def fake_get_font_details(path: str) -> pptx_font_utils.FontDetail:
        if path.endswith("Calibri-Bold.ttf"):
            return pptx_font_utils.FontDetail(
                file=path,
                size_bytes=123,
                family_name="Calibri",
                full_name="Calibri Bold",
                subfamily_name="Bold",
                weight_class=700,
            )
        return pptx_font_utils.FontDetail(
            file=path,
            size_bytes=123,
            family_name="Calibri",
            full_name="Calibri Regular",
            subfamily_name="Regular",
            weight_class=400,
        )

    async def fake_get_font_uploads_for_names_by_variant(font_names):
        captured_candidates.extend(font_names)
        return {}

    def fake_replace_fonts_in_pptx(
        _pptx_path,
        font_mapping,
        _output_path,
        font_variant_mapping=None,
    ):
        captured_replacement["font_mapping"] = font_mapping
        captured_replacement["font_variant_mapping"] = font_variant_mapping

    monkeypatch.setattr(
        fonts_and_slides_preview,
        "extract_raw_fonts_and_embedded_details",
        lambda *_args: ({"Arial Bold", "Arial Regular"}, [], []),
    )
    monkeypatch.setattr(
        fonts_and_slides_preview,
        "_font_variants_by_normalized_name",
        lambda *_args: {"Arial": {"regular", "bold"}},
    )
    monkeypatch.setattr(
        fonts_and_slides_preview,
        "get_font_details",
        fake_get_font_details,
    )
    monkeypatch.setattr(
        fonts_and_slides_preview,
        "get_font_uploads_for_names_by_variant",
        fake_get_font_uploads_for_names_by_variant,
    )
    monkeypatch.setattr(
        fonts_and_slides_preview,
        "replace_fonts_in_pptx",
        fake_replace_fonts_in_pptx,
    )

    await fonts_and_slides_preview.upload_fonts_and_fix_fonts_in_pptx(
        pptx_path="deck.pptx",
        temp_dir=str(tmp_path),
        original_filename="deck.pptx",
        font_files=[
            DummyUploadFile("Calibri-Bold.ttf"),
            DummyUploadFile("Calibri-Regular.ttf"),
        ],
        original_font_names=["Arial Bold", "Arial Regular"],
        logger=DummyLogger(),
        session_dir=str(tmp_path / "session"),
        upload_fonts=False,
    )

    assert captured_candidates == []
    assert captured_replacement["font_mapping"] == {
        "Arial Bold": "Calibri Bold",
        "Arial Regular": "Calibri Regular",
    }
    assert captured_replacement["font_variant_mapping"]["Arial"] == {
        "bold": "Calibri Bold",
        "regular": "Calibri Regular",
    }


@pytest.mark.anyio
async def test_saved_font_uploads_are_used_for_missing_preview_fonts(
    monkeypatch,
    tmp_path,
):
    saved_regular = FontUpload(
        filename="Arial-Regular.ttf",
        path=str(tmp_path / "Arial-Regular.ttf"),
        normalized_family_name="Arial",
        family_name="Arial",
        full_name="Arial Regular",
        subfamily_name="Regular",
        weight_class=400,
        size_bytes=123,
    )
    saved_bold = FontUpload(
        filename="Arial-Bold.ttf",
        path=str(tmp_path / "Arial-Bold.ttf"),
        normalized_family_name="Arial",
        family_name="Arial",
        full_name="Arial Bold",
        subfamily_name="Bold",
        weight_class=700,
        size_bytes=123,
    )
    regular_path = tmp_path / "downloaded-regular.ttf"
    bold_path = tmp_path / "downloaded-bold.ttf"
    regular_path.write_bytes(b"regular")
    bold_path.write_bytes(b"bold")
    captured_replacement = {}
    captured_candidates = []

    async def fake_get_font_uploads_for_names_by_variant(font_names):
        captured_candidates.extend(font_names)
        return {"Arial": {"regular": saved_regular, "bold": saved_bold}}

    async def fake_download_font_uploads(font_uploads, _temp_dir):
        assert {font.filename for font in font_uploads} == {
            "Arial-Regular.ttf",
            "Arial-Bold.ttf",
        }
        return {
            saved_regular.id: str(regular_path),
            saved_bold.id: str(bold_path),
        }

    async def fake_get_font_upload_url(font_upload):
        return f"/app_data/fonts/{font_upload.filename}"

    def fake_replace_fonts_in_pptx(
        _pptx_path,
        font_mapping,
        _output_path,
        font_variant_mapping=None,
    ):
        captured_replacement["font_mapping"] = font_mapping
        captured_replacement["font_variant_mapping"] = font_variant_mapping

    monkeypatch.setattr(
        fonts_and_slides_preview,
        "extract_raw_fonts_and_embedded_details",
        lambda *_args: ({"Arial"}, [], []),
    )
    monkeypatch.setattr(
        fonts_and_slides_preview,
        "_font_variants_by_normalized_name",
        lambda *_args: {"Arial": {"regular", "bold"}},
    )
    monkeypatch.setattr(
        fonts_and_slides_preview,
        "get_font_uploads_for_names_by_variant",
        fake_get_font_uploads_for_names_by_variant,
    )
    monkeypatch.setattr(
        fonts_and_slides_preview,
        "download_font_uploads",
        fake_download_font_uploads,
    )
    monkeypatch.setattr(
        fonts_and_slides_preview,
        "get_font_upload_url",
        fake_get_font_upload_url,
    )
    monkeypatch.setattr(
        fonts_and_slides_preview,
        "replace_fonts_in_pptx",
        fake_replace_fonts_in_pptx,
    )

    result = await fonts_and_slides_preview.upload_fonts_and_fix_fonts_in_pptx(
        pptx_path="deck.pptx",
        temp_dir=str(tmp_path),
        original_filename="deck.pptx",
        font_files=None,
        original_font_names=None,
        logger=DummyLogger(),
        session_dir=str(tmp_path / "session"),
        upload_fonts=True,
    )

    assert captured_candidates == ["Arial"]
    assert captured_replacement["font_mapping"] == {"Arial": "Arial Regular"}
    assert captured_replacement["font_variant_mapping"]["Arial"] == {
        "regular": "Arial Regular",
        "bold": "Arial Bold",
    }
    assert str(regular_path) in result[5]
    assert str(bold_path) in result[5]
    assert result[1] == {
        "Arial Regular": "/app_data/fonts/Arial-Regular.ttf",
        "Arial Bold": "/app_data/fonts/Arial-Bold.ttf",
    }


@pytest.mark.anyio
async def test_saved_font_upload_for_explicit_variant_uses_normalized_family_name(
    monkeypatch,
    tmp_path,
):
    saved_bold = FontUpload(
        filename="Arial-Bold.ttf",
        path=str(tmp_path / "Arial-Bold.ttf"),
        normalized_family_name="Arial",
        family_name="Arial",
        full_name="Arial Bold",
        subfamily_name="Bold",
        weight_class=700,
        size_bytes=123,
    )
    bold_path = tmp_path / "downloaded-bold.ttf"
    bold_path.write_bytes(b"bold")
    captured_replacement = {}

    async def fake_get_font_uploads_for_names_by_variant(font_names):
        assert font_names == ["Arial Bold"]
        return {"Arial Bold": {"bold": saved_bold}}

    async def fake_download_font_uploads(_font_uploads, _temp_dir):
        return {saved_bold.id: str(bold_path)}

    async def fake_get_font_upload_url(font_upload):
        return f"/app_data/fonts/{font_upload.filename}"

    def fake_replace_fonts_in_pptx(
        _pptx_path,
        font_mapping,
        _output_path,
        font_variant_mapping=None,
    ):
        captured_replacement["font_mapping"] = font_mapping
        captured_replacement["font_variant_mapping"] = font_variant_mapping

    monkeypatch.setattr(
        fonts_and_slides_preview,
        "extract_raw_fonts_and_embedded_details",
        lambda *_args: ({"Arial Bold"}, [], []),
    )
    monkeypatch.setattr(
        fonts_and_slides_preview,
        "_font_variants_by_normalized_name",
        lambda *_args: {"Arial": {"bold"}},
    )
    monkeypatch.setattr(
        fonts_and_slides_preview,
        "get_font_uploads_for_names_by_variant",
        fake_get_font_uploads_for_names_by_variant,
    )
    monkeypatch.setattr(
        fonts_and_slides_preview,
        "download_font_uploads",
        fake_download_font_uploads,
    )
    monkeypatch.setattr(
        fonts_and_slides_preview,
        "get_font_upload_url",
        fake_get_font_upload_url,
    )
    monkeypatch.setattr(
        fonts_and_slides_preview,
        "replace_fonts_in_pptx",
        fake_replace_fonts_in_pptx,
    )

    result = await fonts_and_slides_preview.upload_fonts_and_fix_fonts_in_pptx(
        pptx_path="deck.pptx",
        temp_dir=str(tmp_path),
        original_filename="deck.pptx",
        font_files=None,
        original_font_names=None,
        logger=DummyLogger(),
        session_dir=str(tmp_path / "session"),
        upload_fonts=True,
    )

    assert captured_replacement["font_mapping"] == {"Arial Bold": "Arial Bold"}
    assert captured_replacement["font_variant_mapping"]["Arial Bold"] == {
        "bold": "Arial Bold"
    }
    assert captured_replacement["font_variant_mapping"]["Arial"] == {
        "bold": "Arial Bold"
    }
    assert result[1] == {"Arial Bold": "/app_data/fonts/Arial-Bold.ttf"}


@pytest.mark.anyio
async def test_google_font_replacements_are_used_for_pptx_font_mapping(
    monkeypatch,
    tmp_path,
):
    captured_replacement = {}
    captured_candidates = []

    async def fake_get_font_uploads_for_names_by_variant(font_names):
        captured_candidates.extend(font_names)
        return {}

    def fake_replace_fonts_in_pptx(
        _pptx_path,
        font_mapping,
        _output_path,
        font_variant_mapping=None,
    ):
        captured_replacement["font_mapping"] = font_mapping
        captured_replacement["font_variant_mapping"] = font_variant_mapping

    monkeypatch.setattr(
        fonts_and_slides_preview,
        "extract_raw_fonts_and_embedded_details",
        lambda *_args: ({"Arial"}, [], []),
    )
    monkeypatch.setattr(
        fonts_and_slides_preview,
        "_font_variants_by_normalized_name",
        lambda *_args: {"Arial": {"bold"}},
    )
    monkeypatch.setattr(
        fonts_and_slides_preview,
        "get_font_uploads_for_names_by_variant",
        fake_get_font_uploads_for_names_by_variant,
    )
    monkeypatch.setattr(
        fonts_and_slides_preview,
        "replace_fonts_in_pptx",
        fake_replace_fonts_in_pptx,
    )

    await fonts_and_slides_preview.upload_fonts_and_fix_fonts_in_pptx(
        pptx_path="deck.pptx",
        temp_dir=str(tmp_path),
        original_filename="deck.pptx",
        font_files=None,
        original_font_names=None,
        logger=DummyLogger(),
        session_dir=str(tmp_path / "session"),
        upload_fonts=False,
        google_font_replacements={"Arial Bold": "Poppins"},
    )

    assert captured_candidates == []
    assert captured_replacement["font_mapping"] == {"Arial Bold": "Poppins"}
    assert captured_replacement["font_variant_mapping"]["Arial"] == {
        "bold": "Poppins"
    }
    assert captured_replacement["font_variant_mapping"]["Arial Bold"] == {
        "bold": "Poppins"
    }


@pytest.mark.anyio
async def test_embedded_fonts_are_installed_without_rewriting_pptx_names(
    monkeypatch,
    tmp_path,
):
    pptx_path = tmp_path / "deck.pptx"
    pptx_path.write_bytes(b"pptx")
    captured_replacement = {}

    async def fake_prepare_embedded_fonts(*_args, **_kwargs):
        return (
            {"Akzidenz-Grotesk Heavy": "https://example.com/akzidenz-black.otf"},
            {"Akzidenz-Grotesk Heavy": str(tmp_path / "akzidenz-black.otf")},
            {"Akzidenz-Grotesk Heavy": "Akzidenz-Grotesk Black"},
        )

    def fake_replace_fonts_in_pptx(
        _pptx_path,
        font_mapping,
        _output_path,
        font_variant_mapping=None,
    ):
        captured_replacement["font_mapping"] = font_mapping
        captured_replacement["font_variant_mapping"] = font_variant_mapping

    monkeypatch.setattr(
        fonts_and_slides_preview,
        "extract_raw_fonts_and_embedded_details",
        lambda *_args: ({"Akzidenz-Grotesk Heavy"}, [], []),
    )
    monkeypatch.setattr(
        fonts_and_slides_preview,
        "_prepare_embedded_fonts",
        fake_prepare_embedded_fonts,
    )
    monkeypatch.setattr(
        fonts_and_slides_preview,
        "replace_fonts_in_pptx",
        fake_replace_fonts_in_pptx,
    )

    result = await fonts_and_slides_preview.upload_fonts_and_fix_fonts_in_pptx(
        pptx_path=str(pptx_path),
        temp_dir=str(tmp_path),
        original_filename="deck.pptx",
        font_files=None,
        original_font_names=None,
        logger=DummyLogger(),
        session_dir=str(tmp_path / "session"),
        upload_fonts=True,
    )

    assert "font_mapping" not in captured_replacement
    assert result[1] == {
        "Akzidenz-Grotesk Heavy": "https://example.com/akzidenz-black.otf",
    }
    assert result[2] == {}
    assert result[5] == [str(tmp_path / "akzidenz-black.otf")]
    assert result[4] == str(pptx_path)
    assert result[7] == {}
    assert result[8] == ["Akzidenz-Grotesk Heavy"]


@pytest.mark.anyio
async def test_download_available_google_fonts_skips_when_api_key_missing(
    monkeypatch,
    tmp_path,
):
    calls = []

    async def fake_get_google_font_file_urls(*args, **kwargs):
        calls.append((args, kwargs))
        return []

    monkeypatch.delenv("GOOGLE_FONTS_API_KEY", raising=False)
    monkeypatch.setattr(
        fonts_and_slides_preview,
        "get_google_font_file_urls",
        fake_get_google_font_file_urls,
    )

    result = await fonts_and_slides_preview._download_available_google_fonts(
        {"Montserrat"},
        str(tmp_path),
        DummyLogger(),
    )

    assert result == []
    assert calls == []
