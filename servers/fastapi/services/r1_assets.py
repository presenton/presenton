
"""R1 F11: reusable image assets already on disk."""

from __future__ import annotations

from pathlib import Path
from typing import Any

from utils.asset_directory_utils import get_images_directory, filesystem_image_path_to_app_data_url

_IMAGE_EXT = {".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg"}


def list_assets(limit: int = 100) -> list[dict[str, Any]]:
    root = Path(get_images_directory())
    if not root.exists():
        return []
    items: list[dict[str, Any]] = []
    for path in sorted(root.rglob("*")):
        if not path.is_file() or path.suffix.lower() not in _IMAGE_EXT:
            continue
        items.append(
            {
                "filename": path.name,
                "path": str(path),
                "url": filesystem_image_path_to_app_data_url(str(path)),
                "bytes": path.stat().st_size,
            }
        )
        if len(items) >= limit:
            break
    return items
