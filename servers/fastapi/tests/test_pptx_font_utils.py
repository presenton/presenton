import asyncio
import os
import zipfile
from types import SimpleNamespace

import pytest

from templates import fonts_and_slides_preview
from templates import pptx_font_utils


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

    async def read(self) -> bytes:
        return self._content


async def _run_sync_in_test(func, *args, **kwargs):
    return func(*args, **kwargs)


def _fake_corrupted_pptx_bytes() -> bytes:
    return b"this is not a valid powerpoint zip package"


def test_build_google_fonts_stylesheet_url_includes_regular_and_bold_weights():
    assert (
        pptx_font_utils.build_google_fonts_stylesheet_url("Open Sans")
        == "https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;700&display=swap"
    )


def test_normalize_font_family_name_strips_localized_bold_token():
    assert pptx_font_utils.normalize_font_family_name("Arial Gras") == "Arial"


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


def test_preview_dimensions_preserve_converter_aspect_ratio():
    assert fonts_and_slides_preview._preview_dimensions_from_document(
        1280.0, 960.0
    ) == (1280, 960)
    assert fonts_and_slides_preview._preview_dimensions_from_document(0, 0) == (
        1280,
        720,
    )


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
    assert '<script src="https://cdn.tailwindcss.com"></script>' in html
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


@pytest.mark.anyio
async def test_create_slide_previews_from_html_uses_converter_dimensions_and_fonts(
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
        async def convert_pptx_to_html(self, pptx_path, get_fonts=False):
            assert pptx_path == "deck.pptx"
            assert get_fonts is True
            return SimpleNamespace(
                slides=['<div class="slide-content">Slide</div>'],
                font_css=".deck-font { color: black; }",
                width=1024.0,
                height=768.0,
            )

        async def render_htmls_to_images(self, htmls, width, height):
            render_calls.append((htmls, width, height))
            return SimpleNamespace(paths=[str(rendered_path)])

    monkeypatch.setattr(
        fonts_and_slides_preview,
        "EXPORT_TASK_SERVICE",
        FakeExportTaskService(),
    )

    result = await fonts_and_slides_preview.render_pptx_slides_to_images(
        modified_pptx_path="deck.pptx",
        font_paths_for_install=[str(font_path)],
        max_slides=1,
        logger=DummyLogger(),
    )

    assert result == [str(rendered_path)]
    assert len(render_calls) == 1
    htmls, width, height = render_calls[0]
    assert width == 1024
    assert height == 768
    assert len(htmls) == 1
    html = htmls[0]
    assert ".deck-font { color: black; }" in html
    assert 'font-family: "Khand Bold";' in html


@pytest.mark.anyio
async def test_create_slide_previews_from_html_batches_slides_in_one_task(
    monkeypatch,
    tmp_path,
):
    output_paths = [tmp_path / "slide-1.png", tmp_path / "slide-2.png"]
    for output_path in output_paths:
        output_path.write_bytes(b"png")
    render_calls = []

    class FakeExportTaskService:
        async def convert_pptx_to_html(self, pptx_path, get_fonts=False):
            return SimpleNamespace(
                slides=[
                    '<div class="slide-content">One</div>',
                    '<div class="slide-content">Two</div>',
                ],
                font_css="",
                width=320.0,
                height=180.0,
            )

        async def render_htmls_to_images(self, htmls, width, height):
            render_calls.append((htmls, width, height))
            return SimpleNamespace(paths=[str(path) for path in output_paths])

    monkeypatch.setattr(
        fonts_and_slides_preview,
        "EXPORT_TASK_SERVICE",
        FakeExportTaskService(),
    )

    result = await fonts_and_slides_preview.render_pptx_slides_to_images(
        modified_pptx_path="deck.pptx",
        font_paths_for_install=[],
        max_slides=None,
        logger=DummyLogger(),
    )

    assert len(render_calls) == 1
    htmls, width, height = render_calls[0]
    assert width == 320
    assert height == 180
    assert len(htmls) == 2
    assert "One" in htmls[0]
    assert "Two" in htmls[1]
    assert result == [str(path) for path in output_paths]


@pytest.mark.anyio
async def test_create_slide_previews_uses_html_render_path(monkeypatch, tmp_path):
    html_paths = [str(tmp_path / "slide1.png"), str(tmp_path / "slide2.png")]

    async def fake_create_from_html(
        modified_pptx_path,
        font_paths_for_install,
        max_slides,
        logger,
    ):
        assert modified_pptx_path == "deck.pptx"
        assert font_paths_for_install == ["font.ttf"]
        assert max_slides == 2
        return html_paths

    async def fake_persist_files_to_session(pairs):
        return [destination for destination, _source in pairs]

    monkeypatch.setattr(
        fonts_and_slides_preview,
        "render_pptx_slides_to_images",
        fake_create_from_html,
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
        )
    ]


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
