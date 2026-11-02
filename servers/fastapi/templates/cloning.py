"""Copy bundled templates into the existing custom-template storage."""

import asyncio
from pathlib import Path
import shutil
from typing import Any
import uuid

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from models.sql.template_v2 import TemplateV2
from utils.asset_directory_utils import (
    absolute_fastapi_asset_url,
    get_pptx_to_json_directory,
)
from utils.get_env import get_app_data_directory_env


def _rewrite_asset_urls(value: Any, source_prefix: str, target_prefix: str) -> Any:
    if isinstance(value, str):
        if value.startswith(source_prefix):
            return target_prefix + value[len(source_prefix):]
        return value
    if isinstance(value, list):
        return [_rewrite_asset_urls(item, source_prefix, target_prefix) for item in value]
    if isinstance(value, dict):
        return {
            key: _rewrite_asset_urls(item, source_prefix, target_prefix)
            for key, item in value.items()
        }
    return value


def _copy_assets(source: Path, destination: Path) -> None:
    # Never follow a template symlink into private server files when copying
    # shared bundled assets into a user's custom-template storage.
    if source.is_symlink() or any(path.is_symlink() for path in source.rglob("*")):
        raise OSError("Template assets cannot contain symlinks")
    shutil.copytree(source, destination)


async def clone_builtin_template(template: TemplateV2, session: AsyncSession) -> str:
    if not template.is_default:
        raise HTTPException(400, "Only built-in templates can be copied")
    if (
        not template.id
        or template.id in {".", ".."}
        or "/" in template.id
        or "\\" in template.id
    ):
        raise HTTPException(400, "Invalid built-in template ID")

    app_data = Path(get_app_data_directory_env() or "/tmp/presenton")
    source_root = (app_data / "templates").resolve()
    source = source_root / template.id / "static"
    if not source.resolve().is_relative_to(source_root):
        raise HTTPException(400, "Invalid built-in template asset path")

    template_id = str(uuid.uuid4())
    destination = Path(get_pptx_to_json_directory()) / template_id
    source_prefix = f"/app_data/templates/{template.id}/static/"
    relative_destination = destination.relative_to(app_data)
    target_prefix = absolute_fastapi_asset_url(
        f"/app_data/{relative_destination.as_posix()}/"
    )
    payload = {
        field: _rewrite_asset_urls(getattr(template, field), source_prefix, target_prefix)
        for field in (
            "raw_layouts",
            "components",
            "merged_components",
            "layouts",
            "theme",
            "assets",
        )
    }
    if isinstance(payload["assets"], dict):
        payload["assets"]["template_id"] = template_id
    custom_template = TemplateV2(
        id=template_id,
        name=f"{template.name} (copy)",
        description=template.description,
        is_default=False,
        **payload,
    )
    try:
        await asyncio.to_thread(_copy_assets, source, destination)
        session.add(custom_template)
        await session.commit()
    except Exception:
        await session.rollback()
        await asyncio.to_thread(shutil.rmtree, destination, ignore_errors=True)
        raise
    return template_id
