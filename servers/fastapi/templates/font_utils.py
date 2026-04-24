import asyncio
import re
import xml.etree.ElementTree as ET
from typing import Iterable

import aiohttp

_STYLE_TOKENS = {
    "italic",
    "italics",
    "ital",
    "oblique",
    "roman",
    "bolditalic",
    "bolditalics",
    "thin",
    "hairline",
    "extralight",
    "ultralight",
    "light",
    "demilight",
    "semilight",
    "book",
    "regular",
    "normal",
    "medium",
    "semibold",
    "demibold",
    "bold",
    "extrabold",
    "ultrabold",
    "black",
    "extrablack",
    "ultrablack",
    "heavy",
    "narrow",
    "condensed",
    "semicondensed",
    "extracondensed",
    "ultracondensed",
    "expanded",
    "semiexpanded",
    "extraexpanded",
    "ultraexpanded",
}
_STYLE_MODIFIERS = {"semi", "demi", "extra", "ultra"}


def _insert_spaces_in_camel_case(value: str) -> str:
    value = re.sub(r"(?<=[a-z0-9])([A-Z])", r" \1", value)
    value = re.sub(r"([A-Z]+)([A-Z][a-z])", r"\1 \2", value)
    return value


def normalize_font_family_name(raw_name: str) -> str:
    if not raw_name:
        return raw_name

    name = raw_name.replace("_", " ").replace("-", " ")
    name = _insert_spaces_in_camel_case(name)
    name = re.sub(r"\s+", " ", name).strip()
    lower_name = name.lower()

    for style in sorted(_STYLE_TOKENS, key=len, reverse=True):
        suffix = " " + style
        if lower_name.endswith(suffix):
            name = name[: -len(suffix)]
            lower_name = lower_name[: -len(suffix)]
            break

    tokens_original = name.split(" ")
    tokens_filtered: list[str] = []
    for index, token in enumerate(tokens_original):
        lower_token = token.lower()
        if index == 0:
            tokens_filtered.append(token)
            continue
        if lower_token in _STYLE_TOKENS or lower_token in _STYLE_MODIFIERS:
            continue
        tokens_filtered.append(token)

    if not tokens_filtered:
        tokens_filtered = tokens_original

    return re.sub(r"\s+", " ", " ".join(tokens_filtered).strip())


def extract_fonts_from_oxml(xml_content: str) -> list[str]:
    fonts = set()

    try:
        root = ET.fromstring(xml_content)
        namespaces = {
            "a": "http://schemas.openxmlformats.org/drawingml/2006/main",
            "p": "http://schemas.openxmlformats.org/presentationml/2006/main",
            "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
        }

        for xpath in (".//a:latin", ".//a:ea", ".//a:cs", ".//a:font"):
            for font_elem in root.findall(xpath, namespaces):
                typeface = font_elem.attrib.get("typeface")
                if typeface:
                    fonts.add(typeface)

        for rpr_elem in root.findall(".//a:rPr", namespaces):
            for font_elem in rpr_elem.findall(".//a:latin", namespaces):
                typeface = font_elem.attrib.get("typeface")
                if typeface:
                    fonts.add(typeface)

        for font_elem in root.findall(".//latin"):
            typeface = font_elem.attrib.get("typeface")
            if typeface:
                fonts.add(typeface)

        fonts.update(re.findall(r'typeface="([^"]+)"', xml_content))

        system_fonts = {"+mn-lt", "+mj-lt", "+mn-ea", "+mj-ea", "+mn-cs", "+mj-cs", ""}
        return sorted(font for font in fonts if font not in system_fonts and font.strip())
    except Exception:
        return []


def get_google_font_css_url(font_name: str) -> str:
    return f"https://fonts.googleapis.com/css2?family={font_name.replace(' ', '+')}&display=swap"


async def check_google_font_availability(font_name: str) -> bool:
    try:
        async with aiohttp.ClientSession() as session:
            async with session.head(
                get_google_font_css_url(font_name),
                timeout=aiohttp.ClientTimeout(total=10),
            ) as response:
                return response.status == 200
    except Exception:
        return False


def collect_normalized_fonts_from_xmls(slide_xmls: Iterable[str]) -> list[str]:
    raw_fonts = set()
    for xml_content in slide_xmls:
        raw_fonts.update(extract_fonts_from_oxml(xml_content))

    normalized_fonts = {normalize_font_family_name(font) for font in raw_fonts}
    return sorted(font for font in normalized_fonts if font)


async def get_available_and_unavailable_fonts(
    font_names: Iterable[str],
) -> tuple[list[tuple[str, str]], list[tuple[str, None]]]:
    normalized_fonts = sorted({font for font in font_names if font})
    if not normalized_fonts:
        return [], []

    results = await asyncio.gather(
        *[check_google_font_availability(font) for font in normalized_fonts]
    )

    available_fonts: list[tuple[str, str]] = []
    unavailable_fonts: list[tuple[str, None]] = []
    for font_name, is_available in zip(normalized_fonts, results):
        if is_available:
            available_fonts.append((font_name, get_google_font_css_url(font_name)))
        else:
            unavailable_fonts.append((font_name, None))
    return available_fonts, unavailable_fonts
