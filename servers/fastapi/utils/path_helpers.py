"""Paths relative to the FastAPI process working directory (Docker / local dev).

The API is always started with cwd set to the `servers/fastapi` package root
(see start.js), without OS-specific layout handling.
"""

from __future__ import annotations

import os


def get_resource_path(relative_path: str) -> str:
    """Absolute path to bundled read-only assets (e.g. ``static/``, ``assets/``)."""
    return os.path.abspath(os.path.join(os.getcwd(), relative_path))


def get_writable_path(relative_path: str) -> str:
    """Absolute path under cwd for caches and generated files; ensures the directory exists."""
    path = os.path.abspath(os.path.join(os.getcwd(), relative_path))
    os.makedirs(path, exist_ok=True)
    return path
