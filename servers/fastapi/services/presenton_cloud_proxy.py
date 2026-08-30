from __future__ import annotations

import json
import logging
import uuid
from collections.abc import AsyncIterator
from typing import Any
from urllib.parse import parse_qs

from fastapi import Request
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.responses import JSONResponse, Response, StreamingResponse

from api.v1.auth.assets import normalized_app_data_parts
from models.sql.presenton_cloud_provider import PresentonCloudProvider
from models.sql.user import User
from services.database import async_session_maker
from services.presenton_cloud import (
    PresentonCloudError,
    get_presenton_provider,
    has_cloud_credentials,
    open_presenton_cloud_response,
)
from services.presenton_cloud_persistence import (
    get_local_presentation_generation_mode,
    get_local_slide_presentation_id,
    persist_cloud_presentation_complete,
    persist_cloud_presentation_created,
)
from services.provider_settings import get_provider_settings
from utils.get_env import get_presenton_oauth_issuer


logger = logging.getLogger(__name__)

CLOUD_GENERATION_PATHS = frozenset(
    {
        "/api/v1/ppt/files/upload",
        "/api/v1/ppt/files/decompose",
        "/api/v1/ppt/presentation/create",
        "/api/v1/ppt/presentation/prepare",
    }
)
CLOUD_EDIT_PATHS = frozenset(
    {
        "/api/v1/ppt/slide/edit",
        "/api/v1/ppt/presentation/update",
        "/api/v1/ppt/presentation/slide_update",
    }
)
CLOUD_SMART_PATHS = frozenset(
    {
        "/api/v2/ppt/presentation/generate-html/init",
        "/api/v2/ppt/presentation/update",
    }
)
CLOUD_API_PATH_PREFIXES = (
    "/api/v1/async-tasks",
    "/api/v1/ppt/outlines/",
    "/api/v1/ppt/presentation/stream/",
    "/api/v1/ppt/template/",
    "/api/v1/ppt/community/presentations",
    "/api/v1/ppt/chat/",
    "/api/v2/ppt/presentation/stream/",
)
CLOUD_PRIVATE_ASSET_PATH_PREFIXES = (
    "/app_data/images/",
    "/app_data/exports/",
    "/app_data/uploads/",
    "/app_data/pptx-to-html/",
    "/app_data/pptx-to-json/",
)
_READ_ONLY_CLOUD_PREFIXES = (
    "/api/v1/ppt/community/presentations",
)
_HOP_BY_HOP_HEADERS = {
    "connection",
    "keep-alive",
    "proxy-authenticate",
    "proxy-authorization",
    "te",
    "trailer",
    "transfer-encoding",
    "upgrade",
}
_REQUEST_HEADERS_TO_DROP = _HOP_BY_HOP_HEADERS | {
    "authorization",
    "content-length",
    "cookie",
    "host",
}
_RESPONSE_HEADERS_TO_DROP = _HOP_BY_HOP_HEADERS | {
    "content-length",
    "set-cookie",
}


def should_proxy_presenton_cloud(path: str) -> bool:
    return (
        path in CLOUD_GENERATION_PATHS
        or path in CLOUD_EDIT_PATHS
        or path in CLOUD_SMART_PATHS
        or path.startswith(
            CLOUD_API_PATH_PREFIXES + CLOUD_PRIVATE_ASSET_PATH_PREFIXES
        )
    )


def _request_method_is_supported(path: str, method: str) -> bool:
    if path.startswith(_READ_ONLY_CLOUD_PREFIXES):
        return method == "GET"
    return True


def _cloud_asset_belongs_to_provider(
    path: str,
    provider: PresentonCloudProvider,
) -> bool:
    if not path.startswith(CLOUD_PRIVATE_ASSET_PATH_PREFIXES):
        return True
    parts = normalized_app_data_parts(path)
    if not parts or len(parts) < 4 or parts[1] != "users":
        return False
    try:
        return uuid.UUID(parts[2]) == uuid.UUID(provider.subject)
    except (TypeError, ValueError):
        return False


def _forward_request_headers(request: Request) -> dict[str, str]:
    return {
        key: value
        for key, value in request.headers.items()
        if key.lower() not in _REQUEST_HEADERS_TO_DROP
    }


def _forward_response_headers(headers) -> dict[str, str]:
    return {
        key: value
        for key, value in headers.items()
        if key.lower() not in _RESPONSE_HEADERS_TO_DROP
    }


def _json_object(value: bytes) -> dict[str, Any] | None:
    try:
        payload = json.loads(value)
    except (UnicodeDecodeError, json.JSONDecodeError):
        return None
    return payload if isinstance(payload, dict) else None


def _uuid(value: Any) -> uuid.UUID | None:
    try:
        return uuid.UUID(str(value))
    except (TypeError, ValueError):
        return None


def _complete_payloads_from_sse(buffer: bytearray) -> list[dict[str, Any]]:
    payloads: list[dict[str, Any]] = []
    while True:
        boundary = buffer.find(b"\n\n")
        if boundary == -1:
            break
        frame = bytes(buffer[:boundary]).replace(b"\r\n", b"\n")
        del buffer[: boundary + 2]
        data = b"\n".join(
            line[6:] for line in frame.splitlines() if line.startswith(b"data: ")
        )
        payload = _json_object(data)
        if payload and payload.get("type") == "complete":
            payloads.append(payload)
    return payloads


def _complete_presentations_from_sse(buffer: bytearray) -> list[dict]:
    return [
        presentation
        for payload in _complete_payloads_from_sse(buffer)
        if isinstance((presentation := payload.get("presentation")), dict)
    ]


def _query_value(query_string: str, key: str) -> str | None:
    values = parse_qs(query_string).get(key)
    return values[0] if values else None


def _smart_slide(slide: dict[str, Any], presentation_id: uuid.UUID) -> dict:
    return {
        "id": slide.get("id"),
        "presentation_id": str(presentation_id),
        "index": slide.get("index", 0),
        "html": slide.get("html") or slide.get("html_content"),
        "speaker_note": slide.get("speaker_note"),
    }


def _smart_update_payload(
    payload: dict[str, Any], presentation_id: uuid.UUID
) -> dict[str, Any]:
    result: dict[str, Any] = {"id": str(presentation_id)}
    for key in ("n_slides", "title"):
        if key in payload:
            result[key] = payload[key]
    slides = payload.get("slides")
    if isinstance(slides, list):
        result["slides"] = [
            _smart_slide(slide, presentation_id)
            for slide in slides
            if isinstance(slide, dict)
        ]
    return result


async def _read_cloud_json(
    session: AsyncSession,
    *,
    issuer: str,
    method: str,
    path: str,
    query_string: str = "",
    content: bytes | None = None,
) -> dict[str, Any]:
    client, response = await open_presenton_cloud_response(
        session,
        issuer=issuer,
        method=method,
        path=path,
        query_string=query_string,
        headers={"content-type": "application/json"},
        content=content,
    )
    try:
        body = await response.aread()
        payload = _json_object(body)
        if not 200 <= response.status_code < 300:
            detail = payload.get("detail") if payload else None
            raise PresentonCloudError(
                response.status_code,
                detail if isinstance(detail, str) else "Presenton cloud request failed",
            )
        if payload is None:
            raise PresentonCloudError(502, "Presenton cloud returned invalid JSON")
        return payload
    finally:
        await response.aclose()
        await client.aclose()


async def _fetch_cloud_presentation(
    session: AsyncSession,
    *,
    issuer: str,
    presentation_id: uuid.UUID,
    generation_mode: str,
) -> dict[str, Any]:
    version = "v2" if generation_mode == "smart" else "v1"
    return await _read_cloud_json(
        session,
        issuer=issuer,
        method="GET",
        path=f"/api/{version}/ppt/presentation/{presentation_id}/ui",
    )


async def _sync_cloud_presentation(
    session: AsyncSession,
    *,
    issuer: str,
    owner_id: uuid.UUID | None,
    presentation_id: uuid.UUID,
    generation_mode: str,
) -> None:
    try:
        presentation = await _fetch_cloud_presentation(
            session,
            issuer=issuer,
            presentation_id=presentation_id,
            generation_mode=generation_mode,
        )
        await persist_cloud_presentation_complete(
            owner_id,
            presentation,
            generation_mode=generation_mode,
        )
    except PresentonCloudError as exc:
        logger.warning(
            "Could not mirror cloud presentation %s locally: %s",
            presentation_id,
            exc.detail,
        )


async def _resolve_presentation_context(
    *,
    owner_id: uuid.UUID | None,
    path: str,
    query_string: str,
    payload: dict[str, Any] | None,
) -> tuple[uuid.UUID | None, str]:
    presentation_id: uuid.UUID | None = None
    generation_mode = "standard"

    if path == "/api/v2/ppt/presentation/generate-html/init":
        return None, "smart"

    if path == "/api/v1/ppt/presentation/create":
        if payload and payload.get("generation_mode") == "smart":
            generation_mode = "smart"
        return None, generation_mode

    if payload:
        presentation_id = _uuid(
            payload.get("presentation_id") or payload.get("id")
        )
        if presentation_id is None and isinstance(payload.get("slide"), dict):
            presentation_id = _uuid(payload["slide"].get("presentation"))

    if presentation_id is None and path == "/api/v1/ppt/slide/edit" and payload:
        slide_id = _uuid(payload.get("id"))
        if slide_id is not None:
            presentation_id = await get_local_slide_presentation_id(
                owner_id, slide_id
            )

    if presentation_id is None:
        presentation_id = _uuid(_query_value(query_string, "presentation_id"))

    if presentation_id is None and (
        path.startswith("/api/v1/ppt/presentation/stream/")
        or path.startswith("/api/v2/ppt/presentation/stream/")
        or path.startswith("/api/v1/ppt/outlines/")
    ):
        presentation_id = _uuid(path.rsplit("/", 1)[-1])

    requested_type = (payload or {}).get("presentation_type") or _query_value(
        query_string, "presentation_type"
    )
    if path.startswith("/api/v2/ppt/presentation/stream/"):
        generation_mode = "smart"
    elif requested_type == "smart":
        generation_mode = "smart"
    elif presentation_id is not None:
        generation_mode = (
            await get_local_presentation_generation_mode(
                owner_id, presentation_id
            )
            or "standard"
        )
    return presentation_id, generation_mode


async def _merge_single_slide_update(
    session: AsyncSession,
    *,
    issuer: str,
    presentation_id: uuid.UUID,
    generation_mode: str,
    slide: dict[str, Any],
) -> bytes:
    presentation = await _fetch_cloud_presentation(
        session,
        issuer=issuer,
        presentation_id=presentation_id,
        generation_mode=generation_mode,
    )
    slides = presentation.get("slides")
    cloud_slides = list(slides) if isinstance(slides, list) else []
    slide_id = str(slide.get("id"))
    replacement = (
        _smart_slide(slide, presentation_id)
        if generation_mode == "smart"
        else slide
    )
    replaced = False
    for index, existing in enumerate(cloud_slides):
        if isinstance(existing, dict) and str(existing.get("id")) == slide_id:
            cloud_slides[index] = replacement
            replaced = True
            break
    if not replaced:
        cloud_slides.append(replacement)

    update = {
        "id": str(presentation_id),
        "n_slides": len(cloud_slides),
        "title": presentation.get("title"),
        "slides": cloud_slides,
    }
    if generation_mode == "standard" and isinstance(
        presentation.get("theme"), dict
    ):
        update["theme"] = presentation["theme"]
    return json.dumps(update).encode("utf-8")


async def maybe_proxy_presenton_cloud_request(
    request: Request,
    session: AsyncSession,
    user: User | None,
    *,
    allow_unowned: bool = False,
) -> Response | None:
    path = request.url.path
    if (
        (user is None and not allow_unowned)
        or not should_proxy_presenton_cloud(path)
        or not _request_method_is_supported(path, request.method)
    ):
        return None

    owner_id = user.id if user is not None else None

    settings = await get_provider_settings(session)
    if settings.get("LLM") != "presenton":
        if _query_value(request.url.query, "presenton_cloud_only") == "true":
            return JSONResponse(
                status_code=409,
                content={
                    "detail": (
                        "Presenton cloud templates were requested but "
                        "Presenton is not selected"
                    )
                },
            )
        return None

    issuer = get_presenton_oauth_issuer()
    provider = await get_presenton_provider(session, issuer)
    if not has_cloud_credentials(provider):
        return JSONResponse(
            status_code=503,
            content={
                "detail": "Presenton is selected but the global provider is not connected"
            },
        )
    assert provider is not None
    if not _cloud_asset_belongs_to_provider(path, provider):
        return None

    request_body = await request.body()
    request_payload = _json_object(request_body)
    presentation_id, generation_mode = await _resolve_presentation_context(
        owner_id=owner_id,
        path=path,
        query_string=request.url.query,
        payload=request_payload,
    )

    upstream_path = path
    upstream_method = request.method
    upstream_body = request_body
    if path.startswith("/api/v1/async-tasks"):
        upstream_path = path.replace(
            "/api/v1/async-tasks",
            "/api/v3/async-task",
            1,
        )
    elif path.startswith("/api/v1/ppt/chat/"):
        upstream_path = path.replace("/api/v1/ppt/chat/", "/api/v3/chat/", 1)
    elif path.startswith("/api/v1/ppt/community/presentations"):
        upstream_path = path.replace(
            "/api/v1/ppt/community/presentations",
            "/api/v3/community/presentations",
            1,
        )
    elif path == "/api/v1/ppt/presentation/create" and generation_mode == "smart":
        upstream_path = "/api/v2/ppt/presentation/generate-html/init"
    elif (
        path.startswith("/api/v1/ppt/presentation/stream/")
        and generation_mode == "smart"
    ):
        upstream_path = path.replace(
            "/api/v1/ppt/presentation/stream/",
            "/api/v2/ppt/presentation/stream/",
            1,
        )
    elif path == "/api/v1/ppt/presentation/update" and generation_mode == "smart":
        if presentation_id is not None and request_payload is not None:
            upstream_body = json.dumps(
                _smart_update_payload(request_payload, presentation_id)
            ).encode("utf-8")
        upstream_path = "/api/v2/ppt/presentation/update"
        upstream_method = "PUT"
    elif path == "/api/v1/ppt/presentation/slide_update":
        slide = request_payload.get("slide") if request_payload else None
        if presentation_id is None or not isinstance(slide, dict):
            return JSONResponse(
                status_code=400,
                content={"detail": "A valid presentation slide is required"},
            )
        try:
            upstream_body = await _merge_single_slide_update(
                session,
                issuer=issuer,
                presentation_id=presentation_id,
                generation_mode=generation_mode,
                slide=slide,
            )
        except PresentonCloudError as exc:
            return JSONResponse(
                status_code=exc.status_code, content={"detail": exc.detail}
            )
        upstream_path = (
            "/api/v2/ppt/presentation/update"
            if generation_mode == "smart"
            else "/api/v1/ppt/presentation/update"
        )
        upstream_method = "PUT" if generation_mode == "smart" else "PATCH"

    try:
        client, upstream = await open_presenton_cloud_response(
            session,
            issuer=issuer,
            method=upstream_method,
            path=upstream_path,
            query_string=request.url.query,
            headers=_forward_request_headers(request),
            content=upstream_body,
        )
    except PresentonCloudError as exc:
        return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})

    is_success = 200 <= upstream.status_code < 300
    is_chat_stream = path.endswith("/chat/message/stream")
    is_presentation_stream = path.startswith(
        (
            "/api/v1/ppt/presentation/stream/",
            "/api/v2/ppt/presentation/stream/",
        )
    )
    is_create = path in {
        "/api/v1/ppt/presentation/create",
        "/api/v2/ppt/presentation/generate-html/init",
    }
    should_buffer = (
        is_create
        or path in CLOUD_EDIT_PATHS
        or (path.startswith("/api/v1/ppt/chat/") and not is_chat_stream)
    )
    if should_buffer:
        try:
            response_body = await upstream.aread()
            response_payload = _json_object(response_body)
            if is_success and is_create:
                if (
                    path == "/api/v1/ppt/presentation/create"
                    and generation_mode == "smart"
                    and response_payload is not None
                ):
                    smart_id = response_payload.get("presentation_id")
                    response_payload = {
                        **(request_payload or {}),
                        "id": smart_id,
                        "version": "v2-standard",
                        "generation_mode": "smart",
                        "fonts": response_payload.get("fonts") or {},
                        "slides": [],
                    }
                    response_body = json.dumps(response_payload).encode("utf-8")
                if request_payload is not None and response_payload is not None:
                    await persist_cloud_presentation_created(
                        owner_id,
                        request_payload,
                        response_payload,
                    )
            elif is_success and presentation_id is not None and path in (
                CLOUD_EDIT_PATHS | {"/api/v1/ppt/chat/message"}
            ):
                await _sync_cloud_presentation(
                    session,
                    issuer=issuer,
                    owner_id=owner_id,
                    presentation_id=presentation_id,
                    generation_mode=generation_mode,
                )
            return Response(
                content=response_body,
                status_code=upstream.status_code,
                headers=_forward_response_headers(upstream.headers),
            )
        finally:
            await upstream.aclose()
            await client.aclose()

    sse_buffer = bytearray()

    async def stream_body() -> AsyncIterator[bytes]:
        saw_complete = False
        synced_on_complete = False
        try:
            async for chunk in upstream.aiter_raw():
                if is_success and (
                    is_presentation_stream or is_chat_stream
                ):
                    sse_buffer.extend(chunk)
                    for payload in _complete_payloads_from_sse(sse_buffer):
                        saw_complete = True
                        presentation = payload.get("presentation")
                        if isinstance(presentation, dict):
                            await persist_cloud_presentation_complete(
                                owner_id,
                                presentation,
                                generation_mode=generation_mode,
                            )
                            synced_on_complete = True
                        elif presentation_id is not None and (
                            generation_mode == "smart" or is_chat_stream
                        ):
                            async with async_session_maker() as sync_session:
                                await _sync_cloud_presentation(
                                    sync_session,
                                    issuer=issuer,
                                    owner_id=owner_id,
                                    presentation_id=presentation_id,
                                    generation_mode=generation_mode,
                                )
                            synced_on_complete = True
                yield chunk
        finally:
            await upstream.aclose()
            await client.aclose()
            if (
                saw_complete
                and not synced_on_complete
                and presentation_id is not None
                and (generation_mode == "smart" or is_chat_stream)
            ):
                async with async_session_maker() as sync_session:
                    await _sync_cloud_presentation(
                        sync_session,
                        issuer=issuer,
                        owner_id=owner_id,
                        presentation_id=presentation_id,
                        generation_mode=generation_mode,
                    )

    return StreamingResponse(
        stream_body(),
        status_code=upstream.status_code,
        headers=_forward_response_headers(upstream.headers),
    )
