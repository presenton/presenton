import re

from models.presentation_layout import PresentationLayoutModel
from models.presentation_outline_model import PresentationOutlineModel


def get_presentation_title_from_outlines(
    presentation_outlines: PresentationOutlineModel,
) -> str:
    if not presentation_outlines.slides:
        return "Untitled Presentation"

    first_content = presentation_outlines.slides[0].content or ""

    if re.match(r"^\s*#{1,6}\s*Page\s+\d+\b", first_content):
        first_content = re.sub(
            r"^\s*#{1,6}\s*Page\s+\d+\b[\s,:\-]*",
            "",
            first_content,
            count=1,
        )

    return (
        first_content[:100].replace("#", "").replace("/", "").replace("\\", "").replace("\n", " ")
    )


def find_slide_layout_index_by_regex(layout: PresentationLayoutModel, patterns: list[str]) -> int:
    def _find_index(pattern: str) -> int:
        regex = re.compile(pattern, re.IGNORECASE)
        for index, slide_layout in enumerate(layout.slides):
            candidates = [
                slide_layout.id or "",
                (slide_layout.name or ""),
                (slide_layout.description or ""),
                (slide_layout.json_schema.get("title") if slide_layout.json_schema else ""),
            ]
            for text in candidates:
                if text and regex.search(text):
                    return index
        return -1

    for pattern in patterns:
        match_index = _find_index(pattern)
        if match_index != -1:
            return match_index

    return -1


def select_toc_or_list_slide_layout_index(
    layout: PresentationLayoutModel,
) -> int:
    toc_patterns = [
        r"\btable\s*of\s*contents\b",
        r"\btable[- ]?of[- ]?contents\b",
        r"\bagenda\b",
        r"\bcontents\b",
        r"\boutline\b",
        r"\bindex\b",
        r"\btoc\b",
    ]

    list_patterns = [
        r"\b(bullet(ed)?\s*list|bullets?)\b",
        r"\b(numbered\s*list|ordered\s*list|unordered\s*list)\b",
        r"\blist\b",
    ]

    toc_index = find_slide_layout_index_by_regex(layout, toc_patterns)
    if toc_index != -1:
        return toc_index

    return find_slide_layout_index_by_regex(layout, list_patterns)
