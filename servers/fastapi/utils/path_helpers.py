"""Paths relative to the FastAPI process working directory (Docker / local dev).

The API is always started with cwd set to the `servers/fastapi` package root
(see start.js), without OS-specific layout handling.

Packaged builds may run with cwd under an app install dir (often read-only under
``/opt``). Writable caches must use ``APP_DATA_DIRECTORY`` when set.
"""

from __future__ import annotations

import os


def get_resource_path(relative_path: str) -> str:
    """Absolute path to bundled read-only assets (e.g. ``static/``, ``assets/``)."""
    return os.path.abspath(os.path.join(os.getcwd(), relative_path))


def get_writable_path(relative_path: str) -> str:
    """Absolute path for caches and generated files; ensures the directory exists."""
    app_data = (os.getenv("APP_DATA_DIRECTORY") or "").strip()
    if app_data:
        base = app_data
    else:
        base = os.getcwd()
    path = os.path.abspath(os.path.join(base, relative_path))
    os.makedirs(path, exist_ok=True)
    return path
