from __future__ import annotations

import re
from html.parser import HTMLParser

SLIDE_WIDTH = 1280.0
SLIDE_HEIGHT = 720.0
_VOID_TAGS = {
    "area",
    "base",
    "br",
    "col",
    "embed",
    "hr",
    "img",
    "input",
    "link",
    "meta",
    "param",
    "source",
    "track",
    "wbr",
}
_MEDIA_TAGS = {"canvas", "img", "svg", "table", "video"}
_NEGATIVE_LAYOUT_CLASS = re.compile(r"^-(?:m[trblxy]?|translate-[xy])-(?:\[|\d)", re.IGNORECASE)
_NEGATIVE_LAYOUT_STYLE = re.compile(
    r"(?:margin(?:-top|-right|-bottom|-left)?\s*:\s*-|"
    r"transform\s*:[^;]*translate(?:X|Y|3d)?\([^)]*-)",
    re.IGNORECASE,
)
_STYLE_VALUE = re.compile(
    r"(?:^|;)\s*(left|right|top|bottom|width|height|position|overflow)\s*:"
    r"\s*([^;]+)",
    re.IGNORECASE,
)
_ARBITRARY_PX_CLASS = re.compile(
    r"^(left|right|top|bottom|w|h)-\[(-?\d+(?:\.\d+)?)px\]$",
    re.IGNORECASE,
)
_SPACING_CLASS = re.compile(r"^(left|right|top|bottom|w|h)-(\d+(?:\.5)?)$", re.IGNORECASE)


class _LayoutNode:
    def __init__(
        self,
        tag: str,
        attrs: list[tuple[str, str | None]],
        parent: _LayoutNode | None,
    ) -> None:
        self.tag = tag.casefold()
        self.attrs = {name.casefold(): value or "" for name, value in attrs}
        self.parent = parent
        self.children: list[_LayoutNode] = []
        self.text: list[str] = []

    @property
    def classes(self) -> set[str]:
        return set(self.attrs.get("class", "").split())

    @property
    def styles(self) -> dict[str, str]:
        return {
            match.group(1).casefold(): match.group(2).strip()
            for match in _STYLE_VALUE.finditer(self.attrs.get("style", ""))
        }


class _LayoutParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.roots: list[_LayoutNode] = []
        self.stack: list[_LayoutNode] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        parent = self.stack[-1] if self.stack else None
        node = _LayoutNode(tag, attrs, parent)
        if parent is None:
            self.roots.append(node)
        else:
            parent.children.append(node)
        if tag.casefold() not in _VOID_TAGS:
            self.stack.append(node)

    def handle_startendtag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        self.handle_starttag(tag, attrs)
        if self.stack and self.stack[-1].tag == tag.casefold():
            self.stack.pop()

    def handle_endtag(self, tag: str) -> None:
        normalized = tag.casefold()
        for index in range(len(self.stack) - 1, -1, -1):
            if self.stack[index].tag == normalized:
                del self.stack[index:]
                return

    def handle_data(self, data: str) -> None:
        if self.stack and self.stack[-1].tag not in {"script", "style"}:
            self.stack[-1].text.append(data)


def _walk(node: _LayoutNode):
    yield node
    for child in node.children:
        yield from _walk(child)


def _visible_text(node: _LayoutNode) -> str:
    parts = list(node.text)
    for child in node.children:
        if child.tag not in {"script", "style"}:
            parts.append(_visible_text(child))
    return " ".join(" ".join(parts).split())


def _contains_media(node: _LayoutNode) -> bool:
    return node.tag in _MEDIA_TAGS or any(_contains_media(child) for child in node.children)


def _is_decorative(node: _LayoutNode) -> bool:
    current: _LayoutNode | None = node
    while current is not None:
        if current.attrs.get("aria-hidden", "").casefold() == "true":
            return True
        if current.attrs.get("data-decorative", "").casefold() == "true":
            return True
        current = current.parent
    return False


def _is_meaningful(node: _LayoutNode) -> bool:
    return bool(_visible_text(node)) or _contains_media(node)


def _is_positioned(node: _LayoutNode) -> bool:
    return bool(
        {"absolute", "fixed"} & node.classes
        or node.styles.get("position", "").casefold() in {"absolute", "fixed"}
    )


def _dimension_value(node: _LayoutNode, property_name: str) -> float | None:
    style_value = node.styles.get(property_name)
    if style_value:
        match = re.fullmatch(r"(-?\d+(?:\.\d+)?)px", style_value)
        if match:
            return float(match.group(1))

    class_property = {"width": "w", "height": "h"}.get(property_name, property_name)
    for token in node.classes:
        arbitrary = _ARBITRARY_PX_CLASS.fullmatch(token)
        if arbitrary and arbitrary.group(1).casefold() == class_property:
            return float(arbitrary.group(2))
        spacing = _SPACING_CLASS.fullmatch(token)
        if spacing and spacing.group(1).casefold() == class_property:
            return float(spacing.group(2)) * 4.0
    return None


def _edge_value(node: _LayoutNode, edge: str) -> float | None:
    if "inset-0" in node.classes or f"{edge}-0" in node.classes:
        return 0.0
    return _dimension_value(node, edge)


def _node_size(node: _LayoutNode) -> tuple[float | None, float | None]:
    if node.parent is None:
        return SLIDE_WIDTH, SLIDE_HEIGHT
    width = _dimension_value(node, "width")
    height = _dimension_value(node, "height")
    if "w-full" in node.classes:
        width = _node_size(node.parent)[0]
    if "h-full" in node.classes:
        height = _node_size(node.parent)[1]
    return width, height


def _positioned_rect(
    node: _LayoutNode,
) -> tuple[float, float, float, float] | None:
    parent_width, parent_height = (
        _node_size(node.parent)
        if node.parent
        else (
            SLIDE_WIDTH,
            SLIDE_HEIGHT,
        )
    )
    left = _edge_value(node, "left")
    right = _edge_value(node, "right")
    top = _edge_value(node, "top")
    bottom = _edge_value(node, "bottom")
    width, height = _node_size(node)

    if width is None and left is not None and right is not None and parent_width:
        width = parent_width - left - right
    if height is None and top is not None and bottom is not None and parent_height:
        height = parent_height - top - bottom
    if left is None and right is not None and width is not None and parent_width:
        left = parent_width - right - width
    if top is None and bottom is not None and height is not None and parent_height:
        top = parent_height - bottom - height
    if None in {left, top, width, height}:
        return None
    return float(left), float(top), float(width), float(height)


def _rectangles_overlap(
    first: tuple[float, float, float, float],
    second: tuple[float, float, float, float],
) -> bool:
    first_x, first_y, first_width, first_height = first
    second_x, second_y, second_width, second_height = second
    overlap_width = min(first_x + first_width, second_x + second_width) - max(first_x, second_x)
    overlap_height = min(first_y + first_height, second_y + second_height) - max(first_y, second_y)
    return overlap_width > 4 and overlap_height > 4


def inspect_smart_slide_layout(html: str) -> list[str]:
    """Return deterministic risks that commonly produce clipped/overlapping slides."""
    parser = _LayoutParser()
    parser.feed(html)
    if not parser.roots:
        return []
    root = parser.roots[0]
    issues: list[str] = []
    positioned_by_parent: dict[
        int, list[tuple[_LayoutNode, tuple[float, float, float, float]]]
    ] = {}

    for node in _walk(root):
        if node is root or not _is_meaningful(node) or _is_decorative(node):
            continue

        if any(_NEGATIVE_LAYOUT_CLASS.match(token) for token in node.classes) or (
            _NEGATIVE_LAYOUT_STYLE.search(node.attrs.get("style", ""))
        ):
            issues.append(
                "Meaningful content uses a negative margin or translation that can overlap nearby content."
            )

        has_hidden_overflow = "overflow-hidden" in node.classes or (
            node.styles.get("overflow", "").casefold() == "hidden"
        )
        if has_hidden_overflow and _visible_text(node):
            issues.append(
                "A nested container hides text overflow instead of fitting all text visibly."
            )

        if not _is_positioned(node):
            continue
        rect = _positioned_rect(node)
        if rect is None:
            issues.append(
                "Absolutely positioned meaningful content is missing a complete pixel box; use flex/grid or provide left/top/width/height."
            )
            continue
        x, y, width, height = rect
        parent_width, parent_height = (
            _node_size(node.parent)
            if node.parent
            else (
                SLIDE_WIDTH,
                SLIDE_HEIGHT,
            )
        )
        if width <= 0 or height <= 0 or x < 0 or y < 0:
            issues.append("Positioned meaningful content has invalid or off-canvas geometry.")
        elif parent_width is not None and x + width > parent_width + 1:
            issues.append(
                "Positioned meaningful content crosses the right slide/container boundary."
            )
        elif parent_height is not None and y + height > parent_height + 1:
            issues.append(
                "Positioned meaningful content crosses the bottom slide/container boundary."
            )

        positioned_by_parent.setdefault(id(node.parent), []).append((node, rect))

    for siblings in positioned_by_parent.values():
        for first_index, (_, first_rect) in enumerate(siblings):
            for _, second_rect in siblings[first_index + 1 :]:
                if _rectangles_overlap(first_rect, second_rect):
                    issues.append(
                        "Absolutely positioned sibling content boxes overlap; reflow them with flex/grid and explicit gaps."
                    )

    return list(dict.fromkeys(issues))
