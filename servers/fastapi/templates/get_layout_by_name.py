import logging
import json
import os
import aiohttp
from urllib.parse import urlencode
from typing import Any

from fastapi import HTTPException

from services.export_task_service import EXPORT_TASK_SERVICE
from templates.custom_layout_from_db import load_custom_presentation_layout
from templates.presentation_layout import PresentationLayoutModel
from utils.icon_weights import extract_icon_weight_from_settings
from utils.internal_http import internal_request_headers

LOGGER = logging.getLogger(__name__)

_MAX_LOG_DETAIL = 600


def _preview_detail(text: str, limit: int = _MAX_LOG_DETAIL) -> str:
    text = text.replace("\n", " ").strip()
    if len(text) <= limit:
        return text
    return text[: limit - 3] + "..."


def _read_builtin_template_settings(layout_name: str) -> dict[str, Any] | None:
    if not layout_name or layout_name.startswith("custom-"):
        return None
    if "/" in layout_name or "\\" in layout_name or layout_name in {".", ".."}:
        return None

    service_dir = os.path.dirname(__file__)
    candidates = [
        os.path.abspath(
            os.path.join(
                service_dir,
                "..",
                "..",
                "nextjs",
                "app",
                "presentation-templates",
                layout_name,
                "settings.json",
            )
        ),
        os.path.abspath(
            os.path.join(
                os.getcwd(),
                "..",
                "nextjs",
                "app",
                "presentation-templates",
                layout_name,
                "settings.json",
            )
        ),
    ]

    for settings_path in candidates:
        if not os.path.isfile(settings_path):
            continue
        try:
            with open(settings_path, "r", encoding="utf-8") as settings_file:
                settings = json.load(settings_file)
            return settings if isinstance(settings, dict) else None
        except Exception as exc:  # noqa: BLE001
            LOGGER.warning(
                "[template_layout] failed reading local template settings template=%r path=%s error=%s",
                layout_name,
                settings_path,
                _preview_detail(str(exc)),
            )
            return None

    return None


async def _fetch_template_fallback_payload(
    layout_name: str,
) -> tuple[dict[str, Any] | None, str | None]:
    fallback_url = f"http://localhost/api/template?group={layout_name}"
    LOGGER.info(
        "[template_layout] trying HTTP fallback template=%r url=%s",
        layout_name,
        fallback_url,
    )
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(
                fallback_url, headers=internal_request_headers()
            ) as response:
                if response.status == 200:
                    payload = await response.json()
                    LOGGER.info(
                        "[template_layout] fallback OK template=%r slide_count=%d",
                        layout_name,
                        len(payload.get("slides") or []),
                    )
                    return payload, None

                error = await response.text()
                LOGGER.warning(
                    "[template_layout] fallback HTTP %s template=%r body=%s",
                    response.status,
                    layout_name,
                    _preview_detail(error or ""),
                )
                return None, error
    except aiohttp.ClientError as exc:
        error = str(exc)
        LOGGER.warning(
            "[template_layout] fallback request failed template=%r error=%s",
            layout_name,
            error,
        )
        return None, error
    except Exception as exc:  # noqa: BLE001
        error = str(exc)
        LOGGER.warning(
            "[template_layout] fallback unexpected error template=%r error=%s",
            layout_name,
            _preview_detail(error),
        )
        return None, error


async def get_layout_by_name(layout_name: str) -> PresentationLayoutModel:
    if layout_name.startswith("custom-"):
        return await load_custom_presentation_layout(layout_name)

    query = urlencode({"group": layout_name})
    url = f"http://localhost/schema?{query}"

    LOGGER.info(
        "[template_layout] resolving template=%r primary_schema_url=%s",
        layout_name,
        url,
    )

    schema_payload: dict[str, Any] | None = None
    runtime_error: str | None = None

    try:
        schema = await EXPORT_TASK_SERVICE.extract_schema(url)
        schema_payload = schema.model_dump()
        slide_ids = [s.get("id") for s in schema_payload.get("slides") or []][:12]
        LOGGER.info(
            "[template_layout] extract-schema succeeded template=%r "
            "payload_name=%r ordered=%s icon_weight=%s slide_count=%d slide_ids(sample)=%s",
            layout_name,
            schema_payload.get("name"),
            schema_payload.get("ordered"),
            schema_payload.get("icon_weight"),
            len(schema_payload.get("slides") or []),
            slide_ids,
        )
    except HTTPException as exc:
        # Backward compatibility: older export runtimes do not implement
        # extract-schema and return "Invalid task type".
        runtime_error = str(exc.detail)
    except Exception as exc:  # noqa: BLE001
        runtime_error = str(exc)

    if schema_payload is None:
        schema_payload, fallback_error = await _fetch_template_fallback_payload(
            layout_name
        )
        if schema_payload and runtime_error:
            LOGGER.info(
                "[template_layout] primary extract-schema failed template=%r detail=%s",
                layout_name,
                _preview_detail(runtime_error),
            )

        if schema_payload is None:
            error_detail = runtime_error or fallback_error or "unknown error"
            if runtime_error:
                LOGGER.warning(
                    "[template_layout] extract-schema HTTP error template=%r detail=%s",
                    layout_name,
                    _preview_detail(runtime_error),
                )
            LOGGER.error(
                "[template_layout] no schema payload template=%r combined_detail=%s",
                layout_name,
                _preview_detail(error_detail),
            )
            raise HTTPException(
                status_code=404,
                detail=f"Template '{layout_name}' not found: {error_detail}",
            )
    elif not layout_name.startswith("custom-"):
        # The bundled export runtime can read the schema page but currently keeps
        # only name/order/slides from settings. The JSON fallback is cheaper and
        # preserves template-level settings such as icon weight.
        fallback_payload, _ = await _fetch_template_fallback_payload(layout_name)
        if fallback_payload:
            fallback_icon_weight = extract_icon_weight_from_settings(fallback_payload)
            schema_payload["icon_weight"] = fallback_icon_weight

    local_settings = _read_builtin_template_settings(layout_name)
    if local_settings:
        local_icon_weight = extract_icon_weight_from_settings(local_settings)
        schema_payload["icon_weight"] = local_icon_weight
        LOGGER.info(
            "[template_layout] local settings applied template=%r icon_weight=%s",
            layout_name,
            local_icon_weight,
        )

    slides = schema_payload.get("slides") or []
    if not slides:
        LOGGER.error(
            "[template_layout] slides empty after resolve template=%r keys=%s",
            layout_name,
            list(schema_payload.keys()),
        )
        raise HTTPException(
            status_code=404,
            detail=f"Template '{layout_name}' not found",
        )

    LOGGER.info(
        "[template_layout] building PresentationLayoutModel template=%r slides=%d icon_weight=%s",
        layout_name,
        len(slides),
        schema_payload.get("icon_weight"),
    )
    return PresentationLayoutModel(**schema_payload)
