from typing import Annotated, Any
from urllib.parse import quote

import aiohttp
from fastapi import APIRouter, Body, HTTPException
from pydantic import BaseModel, Field


OPENROUTER_ROUTER = APIRouter(prefix="/openrouter", tags=["OpenRouter"])
DEFAULT_OPENROUTER_API_URL = "https://openrouter.ai/api/v1"


class OpenRouterProviderOption(BaseModel):
    value: str
    label: str
    available: bool = True
    context_length: int | None = None
    max_completion_tokens: int | None = None
    supported_parameters: list[str] = Field(default_factory=list)


def _provider_option(item: dict[str, Any]) -> OpenRouterProviderOption | None:
    value = item.get("tag") or item.get("slug") or item.get("provider_name")
    label = item.get("provider_name") or item.get("name") or value
    if not isinstance(value, str) or not value.strip():
        return None
    status = item.get("status")
    available = status not in {"down", "unavailable", "disabled"}
    parameters = item.get("supported_parameters")
    return OpenRouterProviderOption(
        value=value.strip(),
        label=str(label or value).strip(),
        available=available,
        context_length=item.get("context_length")
        if isinstance(item.get("context_length"), int)
        else None,
        max_completion_tokens=item.get("max_completion_tokens")
        if isinstance(item.get("max_completion_tokens"), int)
        else None,
        supported_parameters=[str(value) for value in parameters]
        if isinstance(parameters, list)
        else [],
    )


async def _get_json(
    session: aiohttp.ClientSession, url: str
) -> tuple[int, Any]:
    async with session.get(url) as response:
        try:
            payload = await response.json(content_type=None)
        except Exception:
            payload = None
        return response.status, payload


@OPENROUTER_ROUTER.post(
    "/providers/available", response_model=list[OpenRouterProviderOption]
)
async def get_available_openrouter_providers(
    model: Annotated[str, Body()],
    api_key: Annotated[str, Body()],
    base_url: Annotated[str | None, Body()] = None,
):
    model = model.strip()
    api_key = api_key.strip()
    if not model:
        raise HTTPException(status_code=400, detail="OpenRouter model is required")
    if not api_key:
        raise HTTPException(status_code=400, detail="OpenRouter API key is required")

    api_root = (base_url or DEFAULT_OPENROUTER_API_URL).strip().rstrip("/")
    headers = {"Authorization": f"Bearer {api_key}"}
    async with aiohttp.ClientSession(headers=headers) as session:
        endpoint_items: list[dict[str, Any]] = []
        if "/" in model:
            author, slug = model.split("/", 1)
            endpoint_url = (
                f"{api_root}/models/{quote(author, safe='')}/"
                f"{quote(slug, safe='')}/endpoints"
            )
            status, payload = await _get_json(session, endpoint_url)
            if status < 400 and isinstance(payload, dict):
                data = payload.get("data", payload)
                if isinstance(data, dict) and isinstance(data.get("endpoints"), list):
                    endpoint_items = [
                        item for item in data["endpoints"] if isinstance(item, dict)
                    ]

        if not endpoint_items:
            status, payload = await _get_json(session, f"{api_root}/providers")
            if status >= 400:
                raise HTTPException(
                    status_code=400 if status < 500 else 502,
                    detail="OpenRouter could not list providers for this model",
                )
            data = payload.get("data", []) if isinstance(payload, dict) else payload
            if isinstance(data, list):
                endpoint_items = [item for item in data if isinstance(item, dict)]

    options = [option for item in endpoint_items if (option := _provider_option(item))]
    deduplicated = {option.value: option for option in options}
    return sorted(deduplicated.values(), key=lambda option: option.label.lower())
