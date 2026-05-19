import os
from typing import Literal
from urllib.parse import urlencode
import uuid

from pathvalidate import sanitize_filename

from models.presentation_and_path import PresentationAndPath
from services.export_task_service import EXPORT_TASK_SERVICE
from utils.get_env import get_fastapi_internal_url


def _get_next_public_url() -> str:
    return (os.getenv("NEXT_PUBLIC_URL") or "").strip() or "http://127.0.0.1"


def _get_next_public_fastapi_url() -> str | None:
    """Browser-facing FastAPI origin (Electron). Returns None in Docker/reverse-proxy
    setups where the browser should use same-origin via nginx."""
    value = (os.getenv("NEXT_PUBLIC_FAST_API") or "").strip()
    return value or None


def _build_presentation_export_url(presentation_id: uuid.UUID) -> tuple[str, str | None]:
    params = {"id": str(presentation_id)}
    # Only add fastapiUrl for Electron (where NEXT_PUBLIC_FAST_API is set for browser use).
    # In Docker, the PDF-maker page should use same-origin via nginx reverse proxy.
    fastapi_url = _get_next_public_fastapi_url()
    if fastapi_url:
        params["fastapiUrl"] = fastapi_url

    # Internal URL for the export task service (loopback inside container).
    internal_url = get_fastapi_internal_url()

    return (
        f"{_get_next_public_url().rstrip('/')}/pdf-maker?{urlencode(params)}",
        internal_url,
    )


async def export_presentation(
    presentation_id: uuid.UUID,
    title: str,
    export_as: Literal["pptx", "pdf"],
    cookie_header: str | None = None,
) -> PresentationAndPath:
    export_url, fastapi_url = _build_presentation_export_url(presentation_id)
    export_result = await EXPORT_TASK_SERVICE.export_from_url(
        url=export_url,
        title=sanitize_filename(title or str(uuid.uuid4())),
        export_as=export_as,
        fastapi_url=fastapi_url,
        cookie_header=cookie_header,
    )

    return PresentationAndPath(
        presentation_id=presentation_id,
        path=export_result.path,
    )
