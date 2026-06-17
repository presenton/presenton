import asyncio
import base64
import contextlib
import html
import mimetypes
import os
import re
import urllib.parse
import tempfile
import uuid
import shutil
from pathlib import Path
from typing import Dict, List, Optional, Set, Tuple
from fastapi import HTTPException, UploadFile
from pydantic import BaseModel

from services.export_task_service import EXPORT_TASK_SERVICE
from templates.pptx_font_utils import (
    FontDetail,
    _font_style_variant,
    build_google_fonts_stylesheet_url,
    check_google_font_availability,
    extract_used_font_variants_from_pptx,
    extract_used_fonts_from_pptx,
    get_available_and_unavailable_fonts_for_pptx,
    convert_eot_to_ttf,
    extract_font_name_from_file,
    extract_raw_fonts_and_embedded_details,
    get_font_details,
    get_google_font_file_urls,
    get_index_of_matching_font_detail_or_none,
    normalize_font_family_name,
    normalize_font_variants,
    replace_fonts_in_pptx,
)
from utils.asset_directory_utils import (
    absolute_fastapi_asset_url,
    resolve_app_path_to_filesystem,
)
from utils.download_helpers import download_file
from utils.get_env import get_app_data_directory_env


class FontInfo(BaseModel):
    name: str
    url: str | None = None
    original_name: str | None = None
    family_name: str | None = None
    variant: str | None = None
    variants: List[str] | None = None


class FontCheckResponse(BaseModel):
    available_fonts: List[FontInfo]
    unavailable_fonts: List[FontInfo]


class FontsUploadAndSlidesPreviewResponse(BaseModel):
    slide_image_urls: List[str]
    pptx_url: str
    modified_pptx_url: str
    fonts: dict


class _PreviewLogger:
    def info(self, message: str):
        print(f"[fonts-preview] {message}")

    def warning(self, message: str):
        print(f"[fonts-preview] WARNING: {message}")

    def error(self, message: str):
        print(f"[fonts-preview] ERROR: {message}")


PREVIEW_WIDTH = 1280
PREVIEW_HEIGHT = 720


def _preview_dimensions_from_document(width: float, height: float) -> Tuple[int, int]:
    try:
        resolved_width = int(round(float(width)))
        resolved_height = int(round(float(height)))
    except (TypeError, ValueError):
        return PREVIEW_WIDTH, PREVIEW_HEIGHT

    if resolved_width <= 0 or resolved_height <= 0:
        return PREVIEW_WIDTH, PREVIEW_HEIGHT

    return resolved_width, resolved_height


def _css_string(value: str) -> str:
    return value.replace("\\", "\\\\").replace('"', '\\"')


def _font_weight_for_css(font_detail: FontDetail, variant: str) -> int:
    if font_detail.weight_class is not None:
        return int(font_detail.weight_class)
    if "bold" in variant:
        return 700
    return 400


def _font_style_for_css(variant: str) -> str:
    if "italic" in variant:
        return "italic"
    return "normal"


def _font_face_css_for_local_fonts(font_paths: List[str]) -> str:
    rules: List[str] = []
    seen: Set[Tuple[str, str]] = set()
    for font_path in font_paths:
        if not os.path.isfile(font_path):
            continue

        font_detail = get_font_details(font_path)
        if font_detail.error:
            continue

        variant = _font_detail_variant(font_detail, os.path.basename(font_path))
        if variant == "unsupported":
            variant = "regular"

        family_names = {
            name
            for name in (
                font_detail.family_name,
                font_detail.full_name,
                font_detail.postscript_name,
                _actual_uploaded_font_name(font_detail, variant, font_path),
            )
            if name
        }

        font_url = Path(font_path).resolve().as_uri()
        font_weight = _font_weight_for_css(font_detail, variant)
        font_style = _font_style_for_css(variant)
        for family_name in sorted(family_names):
            key = (family_name, font_url)
            if key in seen:
                continue
            seen.add(key)
            rules.append(
                '@font-face { '
                f'font-family: "{_css_string(family_name)}"; '
                f'src: url("{font_url}"); '
                f"font-weight: {font_weight}; "
                f"font-style: {font_style}; "
                "font-display: block; "
                "}"
            )

    return "\n".join(rules)


def _preview_asset_url_to_data_uri(url: str) -> str:
    if not url:
        return url

    parsed = urllib.parse.urlparse(url)
    if parsed.scheme in ("http", "https"):
        if not parsed.path.startswith(("/app_data/", "/static/")):
            return url
        candidate = urllib.parse.unquote(parsed.path)
    elif parsed.scheme == "file":
        candidate = urllib.parse.unquote(parsed.path)
    elif url.startswith(("/app_data/", "/static/")):
        candidate = url
    else:
        return url

    resolved = resolve_app_path_to_filesystem(candidate)
    if not resolved:
        return url

    try:
        data = Path(resolved).read_bytes()
    except OSError:
        return url

    mime_type = mimetypes.guess_type(resolved)[0] or "application/octet-stream"
    encoded = base64.b64encode(data).decode("ascii")
    return f"data:{mime_type};base64,{encoded}"


def _localize_preview_asset_urls(html: str) -> str:
    def replace_attr(match: re.Match[str]) -> str:
        return (
            f"{match.group('prefix')}"
            f"{_preview_asset_url_to_data_uri(match.group('url'))}"
            f"{match.group('suffix')}"
        )

    def replace_css_url(match: re.Match[str]) -> str:
        quote = match.group("quote") or ""
        return f"url({quote}{_preview_asset_url_to_data_uri(match.group('url'))}{quote})"

    html = re.sub(
        r"(?P<prefix>\b(?:src|href|xlink:href)=['\"])(?P<url>[^'\"]+)(?P<suffix>['\"])",
        replace_attr,
        html,
        flags=re.IGNORECASE,
    )
    return re.sub(
        r"url\((?P<quote>['\"]?)(?P<url>[^)'\"]+)(?P=quote)\)",
        replace_css_url,
        html,
        flags=re.IGNORECASE,
    )


def _normalized_css_font_family(value: str) -> str:
    return " ".join(value.replace("_", " ").split()).casefold()


def _font_stylesheet_links_for_slide_html(
    slide_html: str, declared_font_css: str = ""
) -> str:
    declared_font_names = {
        _normalized_css_font_family(font_name)
        for font_name in re.findall(
            r"font-family\s*:\s*['\"]?([^;'\"}]+)",
            declared_font_css,
            flags=re.IGNORECASE,
        )
        if font_name.strip()
    }
    font_names = sorted(
        {
            font_name.replace("_", " ").strip()
            for font_name in re.findall(r"font-\[\s*['\"]([^'\"]+)['\"]\s*\]", slide_html)
            if font_name.strip()
            and _normalized_css_font_family(font_name) not in declared_font_names
        }
    )
    return "\n".join(
        f'<link href="{html.escape(build_google_fonts_stylesheet_url(font_name), quote=True)}" rel="stylesheet">'
        for font_name in font_names
    )


def _app_data_directory() -> str:
    app_data_dir = get_app_data_directory_env() or "/tmp/presenton"
    os.makedirs(app_data_dir, exist_ok=True)
    return app_data_dir


def _get_fonts_directory() -> str:
    fonts_dir = os.path.join(_app_data_directory(), "fonts")
    os.makedirs(fonts_dir, exist_ok=True)
    return fonts_dir


def _get_template_preview_session_dir(session_id: uuid.UUID) -> str:
    session_dir = os.path.join(
        _app_data_directory(), "uploads", "template-previews", str(session_id)
    )
    os.makedirs(session_dir, exist_ok=True)
    return session_dir


def _build_slide_preview_html(
    slide_html: str,
    font_css: str,
    font_links: str = "",
    width: int = PREVIEW_WIDTH,
    height: int = PREVIEW_HEIGHT,
) -> str:
    fastapi_base = absolute_fastapi_asset_url("/").rstrip("/") + "/"
    return f"""<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <base href="{fastapi_base}" />
  <script src="https://cdn.tailwindcss.com"></script>
  {font_links}
  <style>
    html,
    body {{
      width: {width}px;
      height: {height}px;
      margin: 0;
      padding: 0;
      overflow: hidden;
      background: #ffffff;
    }}

    *,
    *::before,
    *::after {{
      box-sizing: border-box;
    }}

    #slide-preview-root {{
      position: relative;
      width: {width}px;
      height: {height}px;
      margin: 0;
      padding: 0;
      overflow: hidden;
      background: #ffffff;
    }}

    .slide-container {{
      width: {width}px;
      height: {height}px;
      margin: 0;
      display: flex;
      align-items: flex-start;
      justify-content: center;
      overflow: hidden;
    }}

    .slide-content {{
      position: relative;
      width: {width}px;
      height: {height}px;
      margin: 0;
      flex: 0 0 auto;
      overflow: hidden;
      box-shadow: none;
    }}

    img,
    svg,
    video,
    canvas {{
      max-width: none;
    }}

    {font_css or ""}
  </style>
</head>
<body>
  <div id="slide-preview-root">{slide_html}</div>
</body>
</html>"""


async def render_pptx_slides_to_images(
    modified_pptx_path: str,
    font_paths_for_install: List[str],
    max_slides: Optional[int],
    logger,
) -> List[str]:
    local_font_css = ""
    if font_paths_for_install:
        local_font_css = await asyncio.to_thread(
            _font_face_css_for_local_fonts,
            font_paths_for_install,
        )
        logger.info("Prepared custom font CSS for HTML preview rendering")

    pptx_document = await EXPORT_TASK_SERVICE.convert_pptx_to_html(
        modified_pptx_path, get_fonts=True
    )
    if not pptx_document.slides:
        raise RuntimeError("PPTX-to-HTML returned no slides")

    slide_htmls = pptx_document.slides
    if max_slides:
        slide_htmls = slide_htmls[:max_slides]

    # The enterprise converter normalizes decks to a 1280px target width and
    # derives height from the source slide size. Keep that aspect ratio here.
    width, height = _preview_dimensions_from_document(
        pptx_document.width,
        pptx_document.height,
    )
    logger.info(
        f"Rendering {len(slide_htmls)} slide previews from PPTX-to-HTML at {width}x{height}"
    )

    localized_slide_htmls = []
    localized_font_css = _localize_preview_asset_urls(
        "\n".join(css for css in (pptx_document.font_css, local_font_css) if css)
    )
    for slide_html in slide_htmls:
        localized_slide_html = _localize_preview_asset_urls(slide_html)
        localized_slide_htmls.append(
            _build_slide_preview_html(
                localized_slide_html,
                localized_font_css,
                font_links=_font_stylesheet_links_for_slide_html(
                    localized_slide_html, localized_font_css
                ),
                width=width,
                height=height,
            )
        )

    rendered = await EXPORT_TASK_SERVICE.render_htmls_to_images(
        htmls=localized_slide_htmls,
        width=width,
        height=height,
    )
    logger.info(
        f"Rendered {len(rendered.paths)} HTML slide previews in one Chromium task"
    )
    return rendered.paths


def _font_variants_by_normalized_name(pptx_path: str) -> Dict[str, Set[str]]:
    font_variants = extract_used_font_variants_from_pptx(pptx_path)
    normalized_variants: Dict[str, Set[str]] = {}
    for font_name, variants in font_variants.items():
        normalized_name = normalize_font_family_name(font_name)
        if normalized_name:
            normalized_variants.setdefault(normalized_name, set()).update(variants)
    return normalized_variants


def _variants_for_font_name(
    font_name: str, variants_by_normalized_name: Dict[str, Set[str]]
) -> List[str]:
    return normalize_font_variants(
        variants_by_normalized_name.get(normalize_font_family_name(font_name))
    )


def _font_variant_display_name(font_name: str, variant: str) -> str:
    labels = {
        "regular": "Regular",
        "bold": "Bold",
        "italic": "Italic",
        "bold_italic": "Bold Italic",
    }
    return f"{font_name} {labels.get(variant, variant.replace('_', ' ').title())}"


def _font_info_entry(
    font_name: str,
    url: Optional[str],
    variant: str,
    original_name: Optional[str] = None,
) -> FontInfo:
    return FontInfo(
        name=_font_variant_display_name(font_name, variant),
        url=url,
        original_name=original_name or font_name,
        family_name=font_name,
        variant=variant,
        variants=[variant],
    )


def _font_info_entries(
    fonts_data: List[Tuple[str, Optional[str]]],
    variants_by_normalized_name: Dict[str, Set[str]],
    original_names_by_normalized_variant: Optional[Dict[Tuple[str, str], str]] = None,
) -> List[FontInfo]:
    entries: List[FontInfo] = []
    for name, url in fonts_data:
        variants = _variants_for_font_name(name, variants_by_normalized_name)
        for variant in variants:
            original_name = (original_names_by_normalized_variant or {}).get(
                (normalize_font_family_name(name), variant)
            )
            entries.append(_font_info_entry(name, url, variant, original_name))
    return entries


def _original_names_by_normalized_variant(
    font_variants: Dict[str, Set[str]],
) -> Dict[Tuple[str, str], str]:
    originals: Dict[Tuple[str, str], str] = {}
    for original_name, variants in font_variants.items():
        normalized_name = normalize_font_family_name(original_name)
        if not normalized_name:
            continue
        for variant in normalize_font_variants(variants):
            originals.setdefault((normalized_name, variant), original_name)
    return originals


def _font_detail_variant(font_detail: FontDetail, filename: str = "") -> str:
    compact_metadata = " ".join(
        value or ""
        for value in (
            font_detail.subfamily_name,
            font_detail.full_name,
            font_detail.postscript_name,
            filename,
        )
    ).lower()
    compact_metadata = "".join(char for char in compact_metadata if char.isalnum())
    italic = "italic" in compact_metadata or "oblique" in compact_metadata
    if font_detail.weight_class is not None:
        if font_detail.weight_class == 700:
            bold = True
        elif font_detail.weight_class == 400:
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


def _font_variant_family_name(font_name: str, variant: str) -> str:
    return _font_variant_display_name(font_name, variant)


def _font_name_has_explicit_variant(font_name: str) -> bool:
    return bool(font_name and normalize_font_family_name(font_name) != font_name.strip())


def _actual_uploaded_font_name(
    detail: FontDetail,
    variant: str,
    font_filename: str,
) -> str:
    if detail.full_name:
        return detail.full_name
    if detail.family_name:
        family_name = normalize_font_family_name(detail.family_name)
        return _font_variant_family_name(family_name or detail.family_name, variant)

    filename_family = normalize_font_family_name(
        os.path.splitext(os.path.basename(font_filename))[0]
    )
    return _font_variant_family_name(filename_family or font_filename, variant)


def _direct_upload_replacement_font_name(
    original_name: str,
    requested_variant: str,
    uploaded_variant: str,
    detail: FontDetail,
    font_filename: str,
) -> str:
    actual_font_name = _actual_uploaded_font_name(
        detail, uploaded_variant, font_filename
    )
    original_family_name = normalize_font_family_name(original_name)
    if (
        not original_family_name
        or not _font_name_has_explicit_variant(original_name)
        or requested_variant != uploaded_variant
    ):
        return actual_font_name

    uploaded_name_candidates = (
        detail.family_name,
        detail.full_name,
        detail.postscript_name,
        os.path.splitext(os.path.basename(font_filename))[0],
    )
    for candidate in uploaded_name_candidates:
        if normalize_font_family_name(candidate) == original_family_name:
            return _font_variant_family_name(original_family_name, requested_variant)

    return actual_font_name


def _write_bytes_to_path(path: str, data: bytes) -> None:
    with open(path, "wb") as file:
        file.write(data)


def _strip_trailing_modified_suffix(name: str) -> str:
    cleaned_name = (name or "").strip()
    lowered_name = cleaned_name.casefold()
    for suffix in ("-modified", "_modified", " modified"):
        if lowered_name.endswith(suffix):
            return cleaned_name[: -len(suffix)].rstrip(" -_")
    return cleaned_name


def _build_modified_pptx_filename(original_filename: str) -> str:
    safe_filename = os.path.basename((original_filename or "").strip())
    stem, extension = os.path.splitext(safe_filename)
    base_stem = _strip_trailing_modified_suffix(stem) or stem.strip() or "presentation"
    return f"{base_stem}-modified{extension or '.pptx'}"


async def check_fonts_in_pptx_handler(pptx_file: UploadFile) -> FontCheckResponse:
    """
    Extract fonts from a PPTX file and check their availability in Google Fonts.

    Returns:
        FontCheckResponse with available and unavailable fonts
    """
    # Validate PPTX file
    filename = getattr(pptx_file, "filename", "") or ""
    if not filename.lower().endswith(".pptx"):
        raise HTTPException(
            status_code=400, detail="Invalid file type. Expected PPTX file"
        )

    with tempfile.TemporaryDirectory() as temp_dir:
        # Save uploaded PPTX file
        pptx_path = os.path.join(temp_dir, "presentation.pptx")
        pptx_content = await pptx_file.read()
        await asyncio.to_thread(_write_bytes_to_path, pptx_path, pptx_content)
        font_variants_by_name = await asyncio.to_thread(
            extract_used_font_variants_from_pptx, pptx_path
        )
        variants_by_normalized_name = await asyncio.to_thread(
            _font_variants_by_normalized_name, pptx_path
        )
        original_names_by_normalized_variant = _original_names_by_normalized_variant(
            font_variants_by_name
        )

        (
            available_fonts_data,
            unavailable_fonts_data,
        ) = await get_available_and_unavailable_fonts_for_pptx(pptx_path, temp_dir)

        return FontCheckResponse(
            available_fonts=_font_info_entries(
                available_fonts_data,
                variants_by_normalized_name,
                original_names_by_normalized_variant,
            ),
            unavailable_fonts=_font_info_entries(
                unavailable_fonts_data,
                variants_by_normalized_name,
                original_names_by_normalized_variant,
            ),
        )


async def upload_fonts_and_preview_handler(
    pptx_file: UploadFile,
    font_files: Optional[List[UploadFile]] = None,
    original_font_names: Optional[List[str]] = None,
    max_slides: Optional[int] = None,
    upload_fonts: bool = True,
    get_slide_images: bool = True,
    upload_presentation: bool = True,
    temp_dir: Optional[str] = None,
) -> FontsUploadAndSlidesPreviewResponse:
    """
    Upload custom fonts, replace them in the PPTX, generate preview images.

    Args:
        pptx_file: PPTX file to modify
        font_files: List of font files to use as replacements
        original_font_names: Original font names in PPTX to replace

    Returns:
        UploadPreviewResponse with slide preview URLs and modified PPTX URL
    """
    num_font_files = len(font_files or [])
    num_original_names = len(original_font_names or [])
    # If one is provided without the other
    if (num_font_files and not num_original_names) or (
        num_original_names and not num_font_files
    ):
        raise HTTPException(
            status_code=400,
            detail="Both font_files and original_font_names must be provided together",
        )
    if num_font_files != num_original_names:
        raise HTTPException(
            status_code=400,
            detail="Number of font files must match number of original font names",
        )

    # Validate PPTX file
    filename = getattr(pptx_file, "filename", "") or ""
    if not filename.lower().endswith(".pptx"):
        raise HTTPException(
            status_code=400, detail="Invalid file type. Expected PPTX file"
        )

    logger = _PreviewLogger()

    logger.info(f"Processing font upload and preview for {num_font_files} fonts")

    temp_dir_context = (
        contextlib.nullcontext(temp_dir) if temp_dir else tempfile.TemporaryDirectory()
    )
    with temp_dir_context as temp_dir:
        # Save uploaded PPTX file
        pptx_path = os.path.join(temp_dir, "presentation.pptx")
        pptx_content = await pptx_file.read()
        await asyncio.to_thread(_write_bytes_to_path, pptx_path, pptx_content)
        logger.info(f"Saved PPTX file to {pptx_path}")
        variants_by_normalized_name = await asyncio.to_thread(
            _font_variants_by_normalized_name, pptx_path
        )

        session_id = uuid.uuid4()
        session_dir = _get_template_preview_session_dir(session_id)

        (
            raw_fonts,
            found_embedded_fonts_with_url,
            font_mapping,
            custom_font_files,
            modified_pptx_path,
            font_paths_for_install,
            font_upload_pairs,
            embedded_font_aliases,
            protected_embedded_font_names,
            font_variant_mapping,
        ) = await upload_fonts_and_fix_fonts_in_pptx(
            pptx_path=pptx_path,
            temp_dir=temp_dir,
            original_filename=filename,
            font_files=font_files,
            original_font_names=original_font_names,
            logger=logger,
            session_dir=session_dir,
            upload_fonts=upload_fonts,
        )

        slide_image_paths: List[str] = []
        if get_slide_images:
            slide_image_paths = await create_slide_previews(
                modified_pptx_path=modified_pptx_path,
                temp_dir=temp_dir,
                font_paths_for_install=font_paths_for_install,
                font_mapping=font_mapping,
                explicit_font_aliases=embedded_font_aliases,
                protected_font_names=protected_embedded_font_names,
                max_slides=max_slides,
                logger=logger,
                session_dir=session_dir,
            )

        modified_pptx_path_out = ""
        if upload_presentation:
            modified_pptx_path_out = await upload_presentations(
                modified_pptx_path=modified_pptx_path,
                logger=logger,
                session_dir=session_dir,
            )

        fonts: Dict[str, str] = {}
        for name, url in found_embedded_fonts_with_url.items():
            actual_name = font_mapping.get(name, name)
            fonts[actual_name] = url
            logger.info(f"Added embedded font: {actual_name} -> {url}")

        if font_upload_pairs:
            font_urls = _public_urls_for_local_paths(
                [dest for dest, _ in font_upload_pairs]
            )
            for (font_path, original_name), font_url in zip(
                custom_font_files, font_urls
            ):
                detail = await asyncio.to_thread(get_font_details, font_path)
                variant = _font_detail_variant(detail, os.path.basename(font_path))
                actual_name = (
                    (font_variant_mapping.get(original_name) or {}).get(variant)
                    or font_mapping.get(original_name)
                    or detail.full_name
                    or detail.family_name
                    or original_name
                )
                fonts[actual_name] = font_url
                logger.info(f"Added custom font: {actual_name} -> {font_url}")

        # Check for Google Fonts availability
        logger.info("Checking for Google Fonts availability")
        all_fonts = set(raw_fonts)

        # Remove fonts that were replaced with custom or embedded fonts
        normalized_original_font_names = {
            normalize_font_family_name(name) for name in (original_font_names or [])
        }
        replaced_names = set(normalized_original_font_names)
        replaced_names.update(font_mapping.keys())
        replaced_names.update(found_embedded_fonts_with_url.keys())
        all_fonts = {
            normalize_font_family_name(f) for f in all_fonts if f not in replaced_names
        }
        fonts_to_check = sorted(font for font in all_fonts if font)

        # Check each font's availability in Google Fonts concurrently
        tasks = [
            check_google_font_availability(
                font,
                variants=_variants_for_font_name(font, variants_by_normalized_name),
            )
            for font in fonts_to_check
        ]
        results = await asyncio.gather(*tasks)

        for font, is_available in zip(fonts_to_check, results):
            if is_available:
                google_fonts_url = build_google_fonts_stylesheet_url(
                    font,
                    variants=_variants_for_font_name(font, variants_by_normalized_name),
                )
                fonts[font] = google_fonts_url
                logger.info(f"Added Google Font: {font} -> {google_fonts_url}")

        logger.info(
            f"Found {len([k for k, v in fonts.items() if 'fonts.googleapis.com' in v])} available Google Fonts"
        )

        slide_image_urls: List[str] = []
        if get_slide_images:
            slide_image_urls = _public_urls_for_local_paths(slide_image_paths)
        modified_pptx_url = modified_pptx_path
        if upload_presentation:
            modified_pptx_url = _public_urls_for_local_paths([modified_pptx_path_out])[0]
        logger.info("Generated public URLs")

        logger.info(
            f"Upload and preview completed successfully with {len(fonts)} total fonts"
        )

        return FontsUploadAndSlidesPreviewResponse(
            slide_image_urls=slide_image_urls,
            pptx_url=modified_pptx_url,
            modified_pptx_url=modified_pptx_url,
            fonts=fonts,
        )


async def upload_fonts_and_fix_fonts_in_pptx(
    pptx_path: str,
    temp_dir: str,
    original_filename: str,
    font_files: Optional[List[UploadFile]],
    original_font_names: Optional[List[str]],
    logger,
    session_dir: str,
    upload_fonts: bool = True,
) -> Tuple[
    Set[str],
    Dict[str, str],
    Dict[str, str],
    List[Tuple[str, str]],
    str,
    List[str],
    List[Tuple[str, str]],
    Dict[str, str],
    List[str],
    Dict[str, Dict[str, str]],
]:
    (
        raw_fonts,
        emb_font_details,
        emb_font_paths,
    ) = await asyncio.to_thread(
        extract_raw_fonts_and_embedded_details,
        pptx_path,
        temp_dir,
    )
    logger.info("Extracted raw fonts and embedded details")

    if upload_fonts:
        (
            found_embedded_fonts_with_url,
            found_embedded_fonts_with_path,
            embedded_actual_names,
        ) = await _prepare_embedded_fonts(
            raw_fonts,
            emb_font_details,
            emb_font_paths,
            temp_dir,
            logger,
        )
        logger.info("Prepared embedded fonts")
    else:
        found_embedded_fonts_with_url = {}
        found_embedded_fonts_with_path = {}
        embedded_actual_names = {}

    custom_font_files, font_mapping, font_variant_mapping = await _save_uploaded_fonts_to_temp(
        font_files, original_font_names, temp_dir, logger
    )
    logger.info("Saved uploaded fonts to temp")

    embedded_font_aliases: Dict[str, str] = {}
    protected_embedded_font_names = list(found_embedded_fonts_with_path.keys())

    font_paths_for_install: List[str] = [
        font_path for font_path, _ in custom_font_files
    ]
    font_paths_for_install.extend(found_embedded_fonts_with_path.values())

    # Replace fonts in PPTX using python-pptx
    modified_pptx_filename = _build_modified_pptx_filename(original_filename)
    modified_pptx_path = os.path.join(temp_dir, modified_pptx_filename)
    if font_mapping:
        logger.info("Replacing fonts in PPTX")
        await asyncio.to_thread(
            replace_fonts_in_pptx,
            pptx_path,
            font_mapping,
            modified_pptx_path,
            font_variant_mapping,
        )
        logger.info("Fonts replaced successfully")
    else:
        modified_pptx_path = pptx_path
        logger.info("No custom fonts provided; using original PPTX without replacement")

    font_upload_pairs: List[Tuple[str, str]] = []
    if upload_fonts:
        font_upload_pairs = [
            (
                os.path.join(session_dir, "fonts", os.path.basename(font_path)),
                font_path,
            )
            for font_path, _ in custom_font_files
        ]
        if font_upload_pairs:
            logger.info(f"Persisting {len(font_upload_pairs)} font files")
            await _persist_files_to_session(font_upload_pairs)
            logger.info("Persisted font files")

    return (
        raw_fonts,
        found_embedded_fonts_with_url,
        font_mapping,
        custom_font_files,
        modified_pptx_path,
        font_paths_for_install,
        font_upload_pairs,
        embedded_font_aliases,
        protected_embedded_font_names,
        font_variant_mapping,
    )


async def create_slide_previews(
    modified_pptx_path: str,
    temp_dir: str,
    font_paths_for_install: List[str],
    font_mapping: Dict[str, str],
    explicit_font_aliases: Optional[Dict[str, str]],
    protected_font_names: Optional[List[str]],
    max_slides: Optional[int],
    logger,
    session_dir: str,
) -> List[str]:
    del temp_dir, font_mapping, explicit_font_aliases, protected_font_names

    screenshot_paths = await render_pptx_slides_to_images(
        modified_pptx_path=modified_pptx_path,
        font_paths_for_install=font_paths_for_install,
        max_slides=max_slides,
        logger=logger,
    )
    logger.info("Generated slide previews from PPTX-to-HTML with Chromium")

    if not screenshot_paths:
        raise HTTPException(status_code=500, detail="Failed to generate slide images")

    slide_upload_pairs = [
        (os.path.join(session_dir, f"slide_{idx}.png"), screenshot_path)
        for idx, screenshot_path in enumerate(screenshot_paths, start=1)
    ]
    logger.info(f"Persisting {len(slide_upload_pairs)} slide images")
    slide_image_paths = await _persist_files_to_session(slide_upload_pairs)
    logger.info("Persisted slide images")

    return slide_image_paths


async def upload_presentations(
    modified_pptx_path: str,
    logger,
    session_dir: str,
) -> str:
    pptx_upload_pairs = [
        (
            os.path.join(session_dir, os.path.basename(modified_pptx_path)),
            modified_pptx_path,
        ),
    ]
    logger.info("Persisting modified PPTX")
    persisted_paths = await _persist_files_to_session(pptx_upload_pairs)
    logger.info("Persisted PPTX file")

    return persisted_paths[0]


async def _save_uploaded_fonts_to_temp(
    font_files: Optional[List[UploadFile]],
    original_font_names: Optional[List[str]],
    temp_dir: str,
    logger,
) -> Tuple[List[Tuple[str, str]], Dict[str, str], Dict[str, Dict[str, str]]]:
    saved_fonts: List[Tuple[str, str]] = []
    font_mapping: Dict[str, str] = {}
    font_variant_mapping: Dict[str, Dict[str, str]] = {}

    if not font_files or not original_font_names:
        return saved_fonts, font_mapping, font_variant_mapping

    for i, (font_file, original_name) in enumerate(
        zip(font_files, original_font_names)
    ):
        font_filename = getattr(font_file, "filename", f"font_{i}")
        font_path = os.path.join(temp_dir, font_filename)

        font_content = await font_file.read()
        await asyncio.to_thread(_write_bytes_to_path, font_path, font_content)

        saved_fonts.append((font_path, original_name))

        detail = await asyncio.to_thread(get_font_details, font_path)
        uploaded_variant = _font_detail_variant(detail, font_filename)
        requested_variant = (
            _font_style_variant(original_name, None, [])
            if _font_name_has_explicit_variant(original_name)
            else uploaded_variant
        )
        original_family_name = normalize_font_family_name(original_name)
        actual_font_name = _direct_upload_replacement_font_name(
            original_name,
            requested_variant,
            uploaded_variant,
            detail,
            font_filename,
        )
        font_mapping[original_name] = actual_font_name
        font_variant_mapping.setdefault(original_name, {})[
            requested_variant
        ] = actual_font_name
        if original_family_name:
            font_variant_mapping.setdefault(original_family_name, {})[
                requested_variant
            ] = actual_font_name

        logger.info(
            f"Font mapping: {original_name} {requested_variant} -> {actual_font_name} ({font_filename})"
        )

    return saved_fonts, font_mapping, font_variant_mapping


async def _prepare_embedded_fonts(
    raw_fonts: Set[str],
    emb_font_details: List[FontDetail],
    emb_font_paths: List[str],
    temp_dir: str,
    logger,
) -> Tuple[Dict[str, str], Dict[str, str], Dict[str, str]]:
    if not raw_fonts or not emb_font_details:
        return {}, {}, {}

    random_id = str(uuid.uuid4())
    upload_tasks = []

    async def _process_font(
        font_name: str, font_detail: FontDetail, font_path: str
    ) -> Tuple[str, str, str, str]:
        converted_font_path = await asyncio.to_thread(
            convert_eot_to_ttf, font_path, temp_dir
        )
        extension = os.path.splitext(converted_font_path)[1] or ".ttf"
        base_name = font_detail.full_name or font_detail.family_name or font_name
        safe_name = base_name.replace("/", "_")
        embedded_dir = os.path.join(_get_fonts_directory(), "embedded", random_id)
        await asyncio.to_thread(os.makedirs, embedded_dir, exist_ok=True)
        dest_path = os.path.join(embedded_dir, f"{safe_name}{extension}")
        await asyncio.to_thread(shutil.copy2, converted_font_path, dest_path)
        url = _public_urls_for_local_paths([dest_path])[0]
        actual_font_name = (
            font_detail.full_name
            or font_detail.family_name
            or await asyncio.to_thread(extract_font_name_from_file, converted_font_path)
        )
        return font_name, url, converted_font_path, actual_font_name

    for font_name in raw_fonts:
        match_index = get_index_of_matching_font_detail_or_none(
            font_name, emb_font_details
        )
        if match_index is None or match_index >= len(emb_font_paths):
            continue
        font_detail = emb_font_details[match_index]
        font_path = emb_font_paths[match_index]
        upload_tasks.append(
            asyncio.create_task(_process_font(font_name, font_detail, font_path))
        )

    if not upload_tasks:
        return {}, {}, {}

    logger.info(f"Preparing {len(upload_tasks)} embedded fonts for delivery")
    results = await asyncio.gather(*upload_tasks)

    found_urls: Dict[str, str] = {}
    found_paths: Dict[str, str] = {}
    actual_names: Dict[str, str] = {}
    for font_name, url, converted_path, actual_font_name in results:
        found_urls[font_name] = url
        found_paths[font_name] = converted_path
        actual_names[font_name] = actual_font_name

    return found_urls, found_paths, actual_names


async def _download_available_google_fonts(
    candidate_google_fonts: Set[str],
    temp_dir: str,
    logger,
    variants_by_normalized_name: Optional[Dict[str, Set[str]]] = None,
) -> List[str]:
    if not candidate_google_fonts:
        return []

    api_key = (os.environ.get("GOOGLE_FONTS_API_KEY") or "").strip()
    if not api_key:
        logger.warning("GOOGLE_FONTS_API_KEY not set; skipping Google Fonts download")
        return []

    logger.info(f"Checking and downloading {len(candidate_google_fonts)} Google Fonts")
    availability = await asyncio.gather(
        *[
            check_google_font_availability(
                f,
                variants=_variants_for_font_name(f, variants_by_normalized_name or {}),
            )
            for f in candidate_google_fonts
        ]
    )

    google_download_dir = os.path.join(temp_dir, "google_fonts")
    await asyncio.to_thread(os.makedirs, google_download_dir, exist_ok=True)

    downloaded_paths: List[str] = []
    for family, is_available in zip(candidate_google_fonts, availability):
        if not is_available:
            continue
        file_urls = await get_google_font_file_urls(family, api_key)
        if not file_urls:
            logger.warning(f"Webfonts API returned no TTF/OTF URLs for '{family}'")
            continue
        extract_dir = os.path.join(google_download_dir, family.replace(" ", "_"))
        await asyncio.to_thread(os.makedirs, extract_dir, exist_ok=True)
        downloaded_for_family = 0
        for idx, file_url in enumerate(file_urls):
            filename = (
                os.path.basename(urllib.parse.urlparse(file_url).path)
                or f"{family}_{idx}.ttf"
            )
            dest_path = os.path.join(extract_dir, filename)
            try:
                downloaded_path = await download_file(file_url, extract_dir)
                if not downloaded_path or not os.path.exists(downloaded_path):
                    raise RuntimeError(
                        f"download_file returned invalid path for {file_url}"
                    )
                if os.path.abspath(downloaded_path) != os.path.abspath(dest_path):
                    await asyncio.to_thread(shutil.move, downloaded_path, dest_path)
                downloaded_paths.append(dest_path)
                downloaded_for_family += 1
            except Exception as exc:
                logger.warning(
                    f"Failed to download font file for '{family}' from {file_url}: {exc}"
                )
        if downloaded_for_family:
            logger.info(f"Downloaded {downloaded_for_family} file(s) for '{family}'")

    return downloaded_paths


async def _persist_files_to_session(pairs: List[Tuple[str, str]]) -> List[str]:
    if not pairs:
        return []

    persisted_paths: List[str] = []

    async def _copy_pair(dest_path: str, src_path: str) -> str:
        await asyncio.to_thread(os.makedirs, os.path.dirname(dest_path), exist_ok=True)
        await asyncio.to_thread(shutil.copy2, src_path, dest_path)
        return dest_path

    results = await asyncio.gather(
        *[_copy_pair(dest_path, src_path) for dest_path, src_path in pairs]
    )
    persisted_paths.extend(results)
    return persisted_paths


def _public_urls_for_local_paths(paths: List[str]) -> List[str]:
    if not paths:
        return []

    app_data = _app_data_directory()
    urls: List[str] = []
    for path in paths:
        rel = os.path.relpath(os.path.abspath(path), os.path.abspath(app_data))
        rel = rel.replace("\\", "/")
        urls.append(absolute_fastapi_asset_url(f"/app_data/{rel}"))
    return urls
