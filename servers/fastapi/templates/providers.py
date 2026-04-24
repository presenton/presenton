import asyncio
import base64
from dataclasses import dataclass
import time
from typing import Any, Awaitable, Callable, Optional

from fastapi import HTTPException
from google import genai
from google.genai import types as google_types
from llmai import AnthropicClient
from llmai.shared import (
    AnthropicClientConfig,
    ImageContentPart,
    SystemMessage,
    TextResponse,
    UserMessage,
)
from openai import AsyncOpenAI

from enums.llm_provider import LLMProvider
from utils.get_env import (
    get_anthropic_api_key_env,
    get_codex_access_token_env,
    get_codex_account_id_env,
    get_codex_refresh_token_env,
    get_codex_token_expires_env,
    get_google_api_key_env,
    get_openai_api_key_env,
)
from utils.llm_provider import get_llm_provider, get_model
from utils.set_env import (
    set_codex_access_token_env,
    set_codex_account_id_env,
    set_codex_refresh_token_env,
    set_codex_token_expires_env,
)

MAX_ATTEMPTS_PER_PROVIDER = 4


@dataclass(frozen=True)
class TemplateProviderSpec:
    provider: LLMProvider
    model: str


@dataclass(frozen=True)
class PlainLLMProvider:
    name: str
    call: Callable[[], Awaitable[str]]

def get_template_provider_spec() -> TemplateProviderSpec:
    provider = get_llm_provider()
    if provider == LLMProvider.OPENAI:
        return TemplateProviderSpec(provider=provider, model=get_model())
    if provider == LLMProvider.CODEX:
        return TemplateProviderSpec(provider=provider, model=get_model())
    if provider == LLMProvider.GOOGLE:
        return TemplateProviderSpec(provider=provider, model=get_model())
    if provider == LLMProvider.ANTHROPIC:
        return TemplateProviderSpec(provider=provider, model=get_model())

    raise HTTPException(
        status_code=400,
        detail="Template generation only supports OpenAI, Codex, Google, or Anthropic.",
    )


async def run_plain_provider_buckets(*, providers: list[PlainLLMProvider]) -> str:
    last_exception: Optional[Exception] = None

    for provider in providers:
        for attempt in range(1, MAX_ATTEMPTS_PER_PROVIDER + 1):
            try:
                response_text = await provider.call()
                if response_text:
                    return response_text
                raise ValueError("No output from template generation provider")
            except Exception as exc:
                last_exception = exc

    if isinstance(last_exception, HTTPException):
        raise last_exception
    raise HTTPException(status_code=500, detail="Failed to generate template output")


def _read_openai_response_text(response) -> str:
    output_text = getattr(response, "output_text", None)
    if output_text:
        return output_text
    text = getattr(response, "text", None)
    if text:
        return text
    return ""


def _get_openai_client() -> AsyncOpenAI:
    api_key = get_openai_api_key_env()
    if not api_key:
        raise HTTPException(status_code=400, detail="OPENAI_API_KEY is not set")
    return AsyncOpenAI(api_key=api_key, timeout=120.0)


def _get_codex_headers() -> dict:
    access_token = get_codex_access_token_env()
    if not access_token:
        raise HTTPException(
            status_code=400,
            detail="Codex OAuth access token is not set. Please authenticate via /api/v1/ppt/codex/auth/initiate",
        )

    expires_str = get_codex_token_expires_env()
    if expires_str:
        try:
            expires_ms = int(expires_str)
            now_ms = int(time.time() * 1000)
            if now_ms >= expires_ms - 60_000:
                refresh_token = get_codex_refresh_token_env()
                if refresh_token:
                    from utils.oauth.openai_codex import (
                        TokenSuccess,
                        get_account_id,
                        refresh_access_token,
                    )

                    result = refresh_access_token(refresh_token)
                    if isinstance(result, TokenSuccess):
                        set_codex_access_token_env(result.access)
                        set_codex_refresh_token_env(result.refresh)
                        set_codex_token_expires_env(str(result.expires))
                        account_id = get_account_id(result.access)
                        if account_id:
                            set_codex_account_id_env(account_id)
                        access_token = result.access
        except (TypeError, ValueError):
            pass

    account_id = get_codex_account_id_env() or ""
    return {
        "Authorization": f"Bearer {access_token}",
        "chatgpt-account-id": account_id,
        "OpenAI-Beta": "responses=experimental",
        "originator": "pi",
    }


def _get_codex_client() -> AsyncOpenAI:
    headers = _get_codex_headers()
    access_token = (headers.get("Authorization") or "").replace("Bearer ", "").strip()
    default_headers = {
        key: value
        for key, value in headers.items()
        if key.lower() not in {"authorization", "content-type", "accept"}
    }
    return AsyncOpenAI(
        base_url="https://chatgpt.com/backend-api/codex",
        api_key=access_token or "codex",
        default_headers=default_headers,
        timeout=120.0,
    )


def _get_google_client() -> genai.Client:
    api_key = get_google_api_key_env()
    if not api_key:
        raise HTTPException(status_code=400, detail="GOOGLE_API_KEY is not set")
    return genai.Client(api_key=api_key)


def _get_anthropic_client() -> AnthropicClient:
    api_key = get_anthropic_api_key_env()
    if not api_key:
        raise HTTPException(status_code=400, detail="ANTHROPIC_API_KEY is not set")
    return AnthropicClient(config=AnthropicClientConfig(api_key=api_key))


def _read_llmai_response_text(response: Any) -> str:
    content = getattr(response, "content", None)
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts: list[str] = []
        for part in content:
            if isinstance(part, str):
                parts.append(part)
                continue
            text = getattr(part, "text", None)
            if isinstance(text, str):
                parts.append(text)
        return "".join(parts)
    return getattr(content, "text", None) or ""


async def _call_openai_like(
    *,
    client: AsyncOpenAI,
    model: str,
    system_prompt: str,
    user_text: str,
    image_bytes: Optional[bytes] = None,
    media_type: str = "image/png",
) -> str:
    content = [{"type": "input_text", "text": user_text}]
    if image_bytes:
        content.insert(
            0,
            {
                "type": "input_image",
                "image_url": f"data:{media_type};base64,{base64.b64encode(image_bytes).decode('utf-8')}",
            },
        )

    response = await client.responses.create(
        model=model,
        instructions=system_prompt,
        input=[{"role": "user", "content": content}],
        text={"verbosity": "medium"},
        store=False,
    )
    output_text = _read_openai_response_text(response)
    if not output_text:
        raise HTTPException(status_code=500, detail="No output from template provider")
    return output_text


def _response_event_to_dict(event: Any) -> dict:
    if isinstance(event, dict):
        return event
    if hasattr(event, "model_dump"):
        return event.model_dump()
    return {
        "type": getattr(event, "type", None),
        "delta": getattr(event, "delta", None),
        "text": getattr(event, "text", None),
        "item": getattr(event, "item", None),
        "response": getattr(event, "response", None),
        "error": getattr(event, "error", None),
        "message": getattr(event, "message", None),
    }


async def _call_codex(
    *,
    model: str,
    system_prompt: str,
    user_text: str,
    image_bytes: Optional[bytes] = None,
    media_type: str = "image/png",
) -> str:
    client = _get_codex_client()
    content = [{"type": "input_text", "text": user_text}]
    if image_bytes:
        content.insert(
            0,
            {
                "type": "input_image",
                "image_url": f"data:{media_type};base64,{base64.b64encode(image_bytes).decode('utf-8')}",
            },
        )

    stream = await client.responses.create(
        model=model,
        instructions=system_prompt,
        input=[{"role": "user", "content": content}],
        text={"verbosity": "medium"},
        store=False,
        stream=True,
    )

    text_parts: list[str] = []

    async for event in stream:
        payload = _response_event_to_dict(event)
        event_type = payload.get("type") or ""

        if event_type == "response.output_text.delta":
            delta = payload.get("delta") or ""
            if delta:
                text_parts.append(delta)
            continue

        if event_type == "response.output_text.done":
            text = payload.get("text") or ""
            if text and not text_parts:
                text_parts.append(text)
            continue

        if event_type in ("response.error", "response.failed", "error"):
            error_detail = payload.get("message") or payload.get("error") or str(payload)
            raise HTTPException(status_code=502, detail=f"Codex error: {error_detail}"[:400])

    output_text = "".join(text_parts).strip()
    if not output_text:
        raise HTTPException(status_code=500, detail="No output from template provider")
    return output_text


async def _call_google(
    *,
    model: str,
    system_prompt: str,
    user_text: str,
    image_bytes: Optional[bytes] = None,
    media_type: str = "image/png",
) -> str:
    client = _get_google_client()
    parts = [google_types.Part.from_text(text=user_text)]
    if image_bytes:
        parts.append(google_types.Part.from_bytes(data=image_bytes, mime_type=media_type))

    response = await asyncio.to_thread(
        client.models.generate_content,
        model=model,
        contents=[google_types.Content(role="user", parts=parts)],
        config=google_types.GenerateContentConfig(
            system_instruction=system_prompt,
            response_mime_type="text/plain",
        ),
    )
    output_text = getattr(response, "text", None) or ""
    if not output_text:
        raise HTTPException(status_code=500, detail="No output from template provider")
    return output_text


async def _call_anthropic(
    *,
    model: str,
    system_prompt: str,
    user_text: str,
    image_bytes: Optional[bytes] = None,
    media_type: str = "image/png",
) -> str:
    client = _get_anthropic_client()
    content: str | list[object] = user_text
    if image_bytes:
        content = [
            user_text,
            ImageContentPart(data=image_bytes, mime_type=media_type),
        ]

    response = await asyncio.to_thread(
        client.generate,
        model=model,
        messages=[
            SystemMessage(content=system_prompt),
            UserMessage(content=content),
        ],
        response_format=TextResponse(),
        max_tokens=8192,
    )
    output_text = _read_llmai_response_text(response)
    if not output_text:
        raise HTTPException(status_code=500, detail="No output from template provider")
    return output_text


def _build_provider_call(
    *,
    spec: Optional[TemplateProviderSpec] = None,
    system_prompt: str,
    user_text: str,
    image_bytes: Optional[bytes] = None,
    media_type: str = "image/png",
) -> PlainLLMProvider:
    spec = spec or get_template_provider_spec()

    if spec.provider == LLMProvider.OPENAI:
        return PlainLLMProvider(
            name="OpenAI",
            call=lambda: _call_openai_like(
                client=_get_openai_client(),
                model=spec.model,
                system_prompt=system_prompt,
                user_text=user_text,
                image_bytes=image_bytes,
                media_type=media_type,
            ),
        )
    if spec.provider == LLMProvider.CODEX:
        return PlainLLMProvider(
            name="Codex",
            call=lambda: _call_codex(
                model=spec.model,
                system_prompt=system_prompt,
                user_text=user_text,
                image_bytes=image_bytes,
                media_type=media_type,
            ),
        )
    if spec.provider == LLMProvider.GOOGLE:
        return PlainLLMProvider(
            name="Google",
            call=lambda: _call_google(
                model=spec.model,
                system_prompt=system_prompt,
                user_text=user_text,
                image_bytes=image_bytes,
                media_type=media_type,
            ),
        )
    if spec.provider == LLMProvider.ANTHROPIC:
        return PlainLLMProvider(
            name="Anthropic",
            call=lambda: _call_anthropic(
                model=spec.model,
                system_prompt=system_prompt,
                user_text=user_text,
                image_bytes=image_bytes,
                media_type=media_type,
            ),
        )

    raise HTTPException(
        status_code=400,
        detail="Template generation only supports OpenAI, Codex, Google, or Anthropic.",
    )


async def generate_slide_layout_code(
    *,
    system_prompt: str,
    user_text: str,
    image_bytes: bytes,
    media_type: str = "image/png",
) -> str:
    provider = _build_provider_call(
        system_prompt=system_prompt,
        user_text=user_text,
        image_bytes=image_bytes,
        media_type=media_type,
    )
    return await run_plain_provider_buckets(providers=[provider])


async def edit_slide_layout_code(
    *,
    system_prompt: str,
    user_text: str,
) -> str:
    provider = _build_provider_call(
        system_prompt=system_prompt,
        user_text=user_text,
    )
    return await run_plain_provider_buckets(providers=[provider])
