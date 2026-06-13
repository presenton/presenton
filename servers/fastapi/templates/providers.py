import asyncio
from typing import Awaitable, Callable, Optional

from fastapi import HTTPException
from llmai import get_client
from llmai.shared import ImageContentPart, SystemMessage, TextResponse, UserMessage

from enums.llm_provider import LLMProvider
from utils.llm_config import get_llm_config
from utils.llm_provider import get_llm_provider, get_model
from utils.llm_utils import extract_text
from utils.template_vision_errors import (
    VISION_LAYOUT_USER_MESSAGE,
    is_likely_vision_capability_error,
)

MAX_ATTEMPTS_PER_PROVIDER = 4


def _exception_message(exc: Exception) -> str:
    if isinstance(exc, HTTPException):
        detail = exc.detail
        if isinstance(detail, str):
            message = detail
        else:
            message = str(detail)
    else:
        message = str(exc) or exc.__class__.__name__
    return " ".join(message.split())[:500]


def _resolve_template_provider_and_model() -> tuple[LLMProvider, str]:
    """Uses the configured text LLM; slide layout generation requires vision (image parts)."""
    return get_llm_provider(), get_model()


def _provider_label(provider: LLMProvider) -> str:
    if provider == LLMProvider.OPENAI:
        return "OpenAI"
    if provider == LLMProvider.CODEX:
        return "Codex"
    if provider == LLMProvider.GOOGLE:
        return "Google"
    if provider == LLMProvider.VERTEX:
        return "Vertex AI"
    if provider == LLMProvider.ANTHROPIC:
        return "Anthropic"
    if provider == LLMProvider.AZURE:
        return "Azure OpenAI"
    if provider == LLMProvider.BEDROCK:
        return "Amazon Bedrock"
    if provider == LLMProvider.OLLAMA:
        return "Ollama"
    if provider == LLMProvider.OPENROUTER:
        return "OpenRouter"
    if provider == LLMProvider.FIREWORKS:
        return "Fireworks"
    if provider == LLMProvider.TOGETHER:
        return "Together AI"
    if provider == LLMProvider.CEREBRAS:
        return "Cerebras"
    if provider == LLMProvider.CUSTOM:
        return "Custom"
    if provider == LLMProvider.RODIUMAI:
        return "RodiumAi"
    if provider == LLMProvider.LITELLM:
        return "LiteLLM"
    if provider == LLMProvider.LMSTUDIO:
        return "LM Studio"
    return "Template provider"


def _template_user_content(
    *,
    user_text: str,
    image_bytes: Optional[bytes],
    media_type: str,
) -> str | list[object]:
    if not image_bytes:
        return user_text
    return [
        ImageContentPart(data=image_bytes, mime_type=media_type),
        user_text,
    ]


async def _call_template_provider_with_llmai(
    *,
    model: str,
    system_prompt: str,
    user_text: str,
    image_bytes: Optional[bytes] = None,
    media_type: str = "image/png",
) -> str:
    client = get_client(config=get_llm_config())
    response = await asyncio.to_thread(
        client.generate,
        model=model,
        messages=[
            SystemMessage(content=system_prompt),
            UserMessage(
                content=_template_user_content(
                    user_text=user_text,
                    image_bytes=image_bytes,
                    media_type=media_type,
                )
            ),
        ],
        response_format=TextResponse(),
        max_tokens=8192,
    )
    output_text = extract_text(response.content) or ""
    if not output_text:
        raise HTTPException(status_code=500, detail="No output from template provider")
    return output_text


async def _run_template_llm_with_retries(
    *,
    provider_label: str,
    call: Callable[[], Awaitable[str]],
    requires_vision: bool = False,
) -> str:
    last_exception: Optional[Exception] = None

    for _ in range(1, MAX_ATTEMPTS_PER_PROVIDER + 1):
        try:
            response_text = await call()
            if response_text:
                return response_text
            raise ValueError("No output from template generation provider")
        except HTTPException as exc:
            if requires_vision and is_likely_vision_capability_error(exc):
                raise HTTPException(
                    status_code=400, detail=VISION_LAYOUT_USER_MESSAGE
                ) from exc
            if 400 <= exc.status_code < 500:
                raise exc
            last_exception = exc
        except Exception as exc:
            if requires_vision and is_likely_vision_capability_error(exc):
                raise HTTPException(
                    status_code=400, detail=VISION_LAYOUT_USER_MESSAGE
                ) from exc
            last_exception = exc

    if isinstance(last_exception, HTTPException):
        raise last_exception
    if last_exception:
        raise HTTPException(
            status_code=502,
            detail=f"{provider_label} error: {_exception_message(last_exception)}",
        )
    raise HTTPException(status_code=500, detail="Failed to generate template output")


def _template_provider_label_and_call(
    *,
    system_prompt: str,
    user_text: str,
    image_bytes: Optional[bytes] = None,
    media_type: str = "image/png",
) -> tuple[str, Callable[[], Awaitable[str]]]:
    provider, model = _resolve_template_provider_and_model()
    label = _provider_label(provider)
    return (
        label,
        lambda: _call_template_provider_with_llmai(
            model=model,
            system_prompt=system_prompt,
            user_text=user_text,
            image_bytes=image_bytes,
            media_type=media_type,
        ),
    )


async def generate_slide_layout_code(
    *,
    system_prompt: str,
    user_text: str,
    image_bytes: bytes,
    media_type: str = "image/png",
) -> str:
    label, call = _template_provider_label_and_call(
        system_prompt=system_prompt,
        user_text=user_text,
        image_bytes=image_bytes,
        media_type=media_type,
    )
    return await _run_template_llm_with_retries(
        provider_label=label, call=call, requires_vision=True
    )


async def edit_slide_layout_code(
    *,
    system_prompt: str,
    user_text: str,
) -> str:
    label, call = _template_provider_label_and_call(
        system_prompt=system_prompt,
        user_text=user_text,
    )
    return await _run_template_llm_with_retries(provider_label=label, call=call)
