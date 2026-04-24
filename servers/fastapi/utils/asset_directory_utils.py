import os
from typing import Optional
from urllib.parse import urlparse, unquote

from utils.get_env import get_app_data_directory_env


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
    if not path_or_url:
        return None
    # Extract path from HTTP URL if needed
    path = path_or_url
    if path_or_url.startswith("http") or path_or_url.startswith("file:"):
        try:
            parsed = urlparse(path_or_url)
            path = unquote(parsed.path)
            if parsed.scheme == "file" and os.name == "nt" and path.startswith("/"):
                path = path[1:]
        except Exception:
            return None
    # Handle /app_data/images/
    if path.startswith("/app_data/images/"):
        relative = path[len("/app_data/images/"):]
        app_data = get_app_data_directory_env()
        if app_data:
            actual = os.path.join(app_data, "images", relative)
            if os.path.isfile(actual):
                return actual
        # Fallback: get_images_directory() + relative
        actual = os.path.join(get_images_directory(), relative)
        return actual if os.path.isfile(actual) else None
    # Handle /app_data/ (other subdirs)
    if path.startswith("/app_data/"):
        relative = path[len("/app_data/"):]
        app_data = get_app_data_directory_env()
        if app_data:
            actual = os.path.join(app_data, relative)
            return actual if os.path.isfile(actual) else None
    # Handle absolute filesystem path (e.g. from HTTP URL path on Mac)
    if path.startswith("/Users/") or path.startswith("/home/") or path.startswith("/var/"):
        return path if os.path.isfile(path) else None
    if "Application Support" in path or ("Library" in path and "images" in path):
        return path if os.path.isfile(path) else None
    # Handle /static/
    if path.startswith("/static/"):
        relative = path[len("/static/"):]
        actual = os.path.join("static", relative)
        return actual if os.path.isfile(actual) else None
    # Absolute path as-is
    if os.path.isabs(path):
        return path if os.path.isfile(path) else None
    # Relative to images directory
    actual = os.path.join(get_images_directory(), path)
    return actual if os.path.isfile(actual) else None


def resolve_image_path_to_filesystem(path_or_url: str) -> Optional[str]:
    return resolve_app_path_to_filesystem(path_or_url)


def get_images_directory():
    images_directory = os.path.join(get_app_data_directory_env(), "images")
    os.makedirs(images_directory, exist_ok=True)
    return images_directory


def get_exports_directory():
    export_directory = os.path.join(get_app_data_directory_env(), "exports")
    os.makedirs(export_directory, exist_ok=True)
    return export_directory

def get_uploads_directory():
    uploads_directory = os.path.join(get_app_data_directory_env(), "uploads")
    os.makedirs(uploads_directory, exist_ok=True)
    return uploads_directory
