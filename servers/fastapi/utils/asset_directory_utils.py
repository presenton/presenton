import os
from typing import Optional
from urllib.parse import urlparse, unquote

from utils.get_env import (
    get_app_data_directory_env,
    get_fastapi_public_base_url,
    get_temp_directory_env,
    is_disable_auth_enabled,
)
from utils.path_helpers import get_resource_path
from api.v1.auth.assets import (
    SHARED_APP_DATA_ROOTS,
    is_app_data_path_authorized,
    normalized_app_data_parts,
)
from api.v1.auth.context import get_current_owner_id, get_current_owner_is_admin


def _owned_directory(root_name: str) -> str:
    directory = os.path.join(get_app_data_directory_env(), root_name)
    owner_id = get_current_owner_id()
    if owner_id is not None:
        directory = os.path.join(directory, "users", str(owner_id))
    os.makedirs(directory, exist_ok=True)
    return directory


def absolute_fastapi_asset_url(path: str) -> str:
    """
    Turn a FastAPI-served path (/app_data/..., /static/...) into a full URL when the public
    base is configured (split Next + FastAPI, e.g. Electron); otherwise return the path.
    """
    p = (path or "").strip()
    if not p:
        return p
    if p.startswith(("http://", "https://")):
        return p
    if not p.startswith("/"):
        p = f"/{p}"
    base = get_fastapi_public_base_url()
    if base:
        return f"{base}{p}"
    return p


def normalize_slide_asset_url(path_or_url: str) -> str:
    """Slide JSON media URLs: keep https/data/blob; make /app_data and /static absolute when FastAPI base is set."""
    if not path_or_url or not isinstance(path_or_url, str):
        return path_or_url
    s = path_or_url.strip()
    if s.startswith(("http://", "https://", "data:", "blob:")):
        return s
    if s.startswith(("/app_data/", "/static/")):
        return absolute_fastapi_asset_url(s)
    return filesystem_image_path_to_app_data_url(s)


def filesystem_image_path_to_app_data_url(path_or_url: str) -> str:
    """
    Browser-facing URL for files saved under APP_DATA_DIRECTORY/images.

    Raw absolute paths (Linux/macOS/Windows) are interpreted by the browser as paths on the
    web origin (e.g. Next.js), so AI-generated images break while https stock URLs work.
    Map known app-data image files to FastAPI's /app_data/images/... mount, as an absolute
    URL when NEXT_PUBLIC_FAST_API is set (Electron).
    """
    if not path_or_url or not isinstance(path_or_url, str):
        return path_or_url
    stripped = path_or_url.strip()
    if stripped.startswith(("http://", "https://", "data:", "blob:")):
        return stripped
    if stripped.startswith(("/app_data/", "/static/")):
        return absolute_fastapi_asset_url(stripped)
    app_data = get_app_data_directory_env()
    if not app_data:
        return stripped
    images_root = os.path.normpath(os.path.join(app_data, "images"))
    try:
        abs_image = os.path.normpath(os.path.abspath(stripped))
        abs_root = os.path.normpath(os.path.abspath(images_root))
    except (OSError, ValueError):
        return stripped
    abs_image_key = os.path.normcase(abs_image)
    abs_root_key = os.path.normcase(abs_root)
    try:
        common = os.path.commonpath([abs_root, abs_image])
    except ValueError:
        return stripped
    if os.path.normcase(common) != abs_root_key:
        return stripped
    rel = os.path.relpath(abs_image, abs_root)
    if rel.startswith(".."):
        return stripped
    return absolute_fastapi_asset_url("/app_data/images/" + rel.replace(os.sep, "/"))


def resolve_app_path_to_filesystem(path_or_url: str) -> Optional[str]:
    """
    Resolve an app-served path or URL to an actual filesystem path.

    Handles:
    - Path strings: /app_data/images/..., /static/..., absolute paths, relative
    - file:// URLs returned by export runtimes
        - HTTP URLs whose path component is an absolute filesystem path:
      When img src is /Users/.../images/xxx.png, browser resolves to
      http://origin/Users/.../images/xxx.png. Next.js returns 404 for these.

    Returns the filesystem path if the file exists, else None.
    """
    if not isinstance(path_or_url, str) or not path_or_url.strip():
        return None
    path = path_or_url.strip()
    if path_or_url.startswith("http") or path_or_url.startswith("file:"):
        try:
            parsed = urlparse(path_or_url)
            path = unquote(parsed.path)
            if parsed.scheme == "file" and os.name == "nt" and path.startswith("/"):
                path = path[1:]
        except Exception:
            return None

    if path.startswith("/app_data/"):
        app_data = get_app_data_directory_env()
        if not app_data or not _app_data_url_allowed(path):
            return None
        relative = path[len("/app_data/"):]
        return _existing_file_within(os.path.join(app_data, relative), app_data)

    if path.startswith("/static/"):
        relative = path[len("/static/"):]
        static_root = get_resource_path("static")
        return _existing_file_within(os.path.join(static_root, relative), static_root)

    if os.path.isabs(path):
        return _resolve_allowed_absolute_file(path)

    return _existing_file_within(
        os.path.join(get_images_directory(), path),
        get_images_directory(),
    )


def _existing_file_within(candidate: str, root: str) -> Optional[str]:
    try:
        resolved_candidate = os.path.realpath(candidate)
        resolved_root = os.path.realpath(root)
        if os.path.commonpath([resolved_candidate, resolved_root]) != resolved_root:
            return None
    except (OSError, ValueError):
        return None
    return resolved_candidate if os.path.isfile(resolved_candidate) else None


def _app_data_url_allowed(path: str) -> bool:
    owner_id = get_current_owner_id()
    if owner_id is None:
        parts = normalized_app_data_parts(path)
        return bool(
            parts
            and (
                is_disable_auth_enabled()
                or parts[0] in SHARED_APP_DATA_ROOTS
            )
        )
    return is_app_data_path_authorized(
        path,
        user_id=owner_id,
        is_admin=get_current_owner_is_admin(),
    )


def _resolve_allowed_absolute_file(path: str) -> Optional[str]:
    app_data = get_app_data_directory_env()
    if app_data:
        candidate = _existing_file_within(path, app_data)
        if candidate:
            relative = os.path.relpath(candidate, os.path.realpath(app_data))
            app_url = "/app_data/" + relative.replace(os.sep, "/")
            return candidate if _app_data_url_allowed(app_url) else None

    temp_root = get_temp_directory_env() or "/tmp/presenton"
    owner_id = get_current_owner_id()
    allowed_temp_root = (
        os.path.join(temp_root, str(owner_id)) if owner_id is not None else temp_root
    )
    candidate = _existing_file_within(path, allowed_temp_root)
    if candidate:
        return candidate

    static_root = get_resource_path("static")
    return _existing_file_within(path, static_root)


def resolve_image_path_to_filesystem(path_or_url: str) -> Optional[str]:
    return resolve_app_path_to_filesystem(path_or_url)


def get_images_directory():
    return _owned_directory("images")


def get_exports_directory():
    return _owned_directory("exports")

def get_uploads_directory():
    return _owned_directory("uploads")


def get_narration_directory():
    return _owned_directory("narration")


def get_videos_directory():
    return _owned_directory("videos")


def get_videos_root_directory():
    """
    Unscoped root of the videos directory (no per-owner subfolder), used to
    compute a relative "users/<id>/filename.mp4"-style path for building
    download URLs -- mirrors how the Next.js PDF/PPTX export route computes
    paths relative to its unscoped exports root.
    """
    return os.path.join(get_app_data_directory_env(), "videos")
