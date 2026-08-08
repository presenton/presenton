from __future__ import annotations

import asyncio
import json
import logging
import mimetypes
from pathlib import Path

from llmai.shared import ImageContentPart, Tool
from pydantic import PrivateAttr

from services.export_task_service import EXPORT_TASK_SERVICE
from templates.v2.models.layouts import SlideLayout
from utils.get_env import get_app_data_directory_env

SLIDE_PREVIEW_WIDTH = 1280
SLIDE_PREVIEW_HEIGHT = 720
PREVIEW_SLIDE_TOOL_NAME = "previewSlide"
LOGGER = logging.getLogger(__name__)


class PreviewSlideTool(Tool):
    """LLM tool definition and executor for rendering a candidate slide layout."""

    _slide_index: int | None = PrivateAttr(default=None)
    _preview_count: int = PrivateAttr(default=0)
    _fonts: dict[str, str] = PrivateAttr(default_factory=dict)

    def __init__(
        self,
        *,
        slide_index: int | None = None,
        fonts: dict[str, str] | None = None,
    ) -> None:
        super().__init__(
            name=PREVIEW_SLIDE_TOOL_NAME,
            description=(
                "Render a complete SlideLayout to a 1280x720 image for visual review. "
                "Call this with a full candidate layout before returning the final layout. "
                "At most two preview calls are allowed for each slide."
            ),
            schema=SlideLayout,
            strict=False,
        )
        self._slide_index = slide_index
        self._preview_count = 0
        self._fonts = dict(fonts or {})

    def render(self, layout: SlideLayout) -> ImageContentPart:
        self._preview_count += 1
        preview_index = self._preview_count
        layout_json = layout.model_dump(mode="json", exclude_none=True)
        components = [
            component.model_dump(mode="json", exclude_none=True)
            for component in layout.components
        ]
        result = asyncio.run(
            EXPORT_TASK_SERVICE.render_json_to_image(
                components,
                SLIDE_PREVIEW_WIDTH,
                SLIDE_PREVIEW_HEIGHT,
                fonts=self._fonts,
            )
        )
        with open(result.path, "rb") as image_file:
            image_data = image_file.read()
        self._save_preview_artifacts(
            layout_json=layout_json,
            image_data=image_data,
            preview_index=preview_index,
        )
        mime_type = mimetypes.guess_type(result.path)[0] or "image/png"
        return ImageContentPart(data=image_data, mime_type=mime_type)

    def _save_preview_artifacts(
        self,
        *,
        layout_json: dict,
        image_data: bytes,
        preview_index: int,
    ) -> None:
        if self._slide_index is None:
            return
        app_data_dir = get_app_data_directory_env()
        if not app_data_dir:
            return

        preview_dir = (
            Path(app_data_dir) / "preview_slide" / str(self._slide_index)
        )
        try:
            preview_dir.mkdir(parents=True, exist_ok=True)
            json_path = preview_dir / f"{preview_index}.json"
            png_path = preview_dir / f"{preview_index}.png"
            json_path.write_text(
                json.dumps(layout_json, indent=2) + "\n",
                encoding="utf-8",
            )
            png_path.write_bytes(image_data)
            LOGGER.info(
                "[templates.v2.preview] saved preview artifacts slide=%s "
                "preview=%d json=%s image=%s",
                self._slide_index,
                preview_index,
                json_path,
                png_path,
            )
        except OSError:
            LOGGER.exception(
                "[templates.v2.preview] failed to save preview artifacts "
                "slide=%s preview=%d directory=%s",
                self._slide_index,
                preview_index,
                preview_dir,
            )


__all__ = [
    "PREVIEW_SLIDE_TOOL_NAME",
    "PreviewSlideTool",
    "SLIDE_PREVIEW_HEIGHT",
    "SLIDE_PREVIEW_WIDTH",
]
