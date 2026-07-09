import asyncio
import json
import logging
from collections.abc import AsyncGenerator, Sequence
from typing import Any, Optional

import dirtyjson
from fastapi import HTTPException
from llmai.shared import (
    LLMTool,
    Message,
    ResponseFormat,
    UserMessage,
    normalize_content_parts,
)

from utils.llm_config import get_extra_body
from utils.schema_utils import get_schema_validation_errors


LOGGER = logging.getLogger(__name__)


def get_generate_kwargs(
    model: str,
    messages: Sequence[Message],
    max_tokens: Optional[int] = None,
    tools: Optional[list[LLMTool]] = None,
    response_format: Optional[ResponseFormat] = None,
    stream: bool = False,
) -> dict[str, Any]:
    kwargs: dict[str, Any] = {
        "model": model,
        "messages": list(messages),
        "stream": stream,
    }
    if max_tokens is not None:
        kwargs["max_tokens"] = max_tokens
    if tools:
        kwargs["tools"] = tools
    if response_format is not None:
        kwargs["response_format"] = response_format

    extra_body = get_extra_body(uses_tool_choice=bool(tools or response_format))
    if extra_body:
        kwargs["extra_body"] = extra_body

    return kwargs


def structured_validation_feedback_user_message(
    content: dict,
    validation_errors: list[str],
) -> UserMessage:
    max_error_count = 10
    max_json_chars = 6000

    formatted_errors = validation_errors[:max_error_count]
    if len(validation_errors) > max_error_count:
        formatted_errors.append(
            f"...and {len(validation_errors) - max_error_count} more validation errors."
        )

    previous_response = json.dumps(
        content,
        ensure_ascii=False,
        indent=2,
        default=str,
    )
    if len(previous_response) > max_json_chars:
        previous_response = previous_response[:max_json_chars] + "\n... (truncated)"

    return UserMessage(
        content=(
            "The previous JSON response did not match the required response schema.\n\n"
            "Validation errors:\n"
            + "\n".join(f"- {error}" for error in formatted_errors)
            + "\n\nPrevious invalid JSON:\n"
            + f"```json\n{previous_response}\n```\n\n"
            + "Return corrected JSON only. Make sure it fully matches the required schema."
        )
    )


def is_retryable_llm_error(exc: BaseException) -> bool:
    """Transient provider-side failures worth retrying transparently.

    Covers Groq strict structured-output glitches (json_validate_failed / schema
    mismatch where the model emits garbage that fails the JSON Schema), rate
    limits (429), and transient 5xx / overloaded errors.
    """
    status = getattr(exc, "status_code", None)
    if not isinstance(status, int):
        status = getattr(exc, "status", None)
    if isinstance(status, int) and (status == 429 or 500 <= status < 600):
        return True
    text = (f"{getattr(exc, 'message', '') or ''} {exc}").lower()
    signatures = (
        "json_validate_failed",
        "generated json does not match",
        "does not match the expected schema",
        "rate_limit",
        "rate limit",
        "too many requests",
        "overloaded",
        "service unavailable",
        # Gemini / Google rate-limit + transient wording
        "quota exceeded",
        "exceeded your current quota",
        "resource_exhausted",
        "resource exhausted",
        "please retry in",
        "429",
        "internal error",
        "try again later",
    )
    return any(sig in text for sig in signatures)


def retry_after_seconds(exc: BaseException, default: float = 0.0) -> float:
    """Provider-suggested wait (seconds) for a rate-limit error, if present.

    Gemini free-tier 429s carry 'Please retry in 59.2s' / 'retryDelay: "59s"'.
    Honoring it lets a burst-limited free tier finish instead of hard-failing.
    """
    import re

    text = f"{getattr(exc, 'message', '') or ''} {exc}"
    match = re.search(
        r"retry(?:\s+in|\s*delay\"?\s*:\s*\"?)\s*([\d.]+)\s*s",
        text,
        re.IGNORECASE,
    )
    if match:
        try:
            return float(match.group(1))
        except ValueError:
            pass
    return default


# Retry pacing: rate-limit waits honor the provider delay (capped); other
# retryable glitches use a short exponential backoff.
_MAX_RETRYABLE_ATTEMPTS = 6
_MAX_RETRY_WAIT_SECONDS = 65.0


def _retry_wait_seconds(exc: BaseException, attempt: int) -> float:
    provider_delay = retry_after_seconds(exc)
    backoff = min(0.5 * (attempt + 1), 8.0)
    return min(max(provider_delay + 1.0 if provider_delay else 0.0, backoff), _MAX_RETRY_WAIT_SECONDS)


async def generate_structured_with_schema_retries(
    client: Any,
    model: str,
    *,
    messages: Sequence[Message],
    response_format: ResponseFormat,
    json_schema: dict,
    strict: bool = False,
    validate_schema: bool = False,
    validate_schema_max_loop_count: int = 4,
) -> dict:
    """
    Parse retries (inner loop) plus optional JSON Schema validation feedback loops (outer loop),
    matching the overflow-mitigation behavior from structured generation with validate_schema.
    """
    max_validation_loops = max(1, validate_schema_max_loop_count)
    working_messages: list[Message] = list(messages)

    for validation_attempt in range(max_validation_loops):
        content: Optional[dict] = None
        for attempt in range(_MAX_RETRYABLE_ATTEMPTS):
            try:
                response = await asyncio.to_thread(
                    client.generate,
                    **get_generate_kwargs(
                        model=model,
                        messages=working_messages,
                        response_format=response_format,
                    ),
                )
            except Exception as exc:
                if attempt < _MAX_RETRYABLE_ATTEMPTS - 1 and is_retryable_llm_error(exc):
                    wait = _retry_wait_seconds(exc, attempt)
                    LOGGER.warning(
                        "Structured generate attempt %s/%s failed (retryable), "
                        "waiting %.1fs then retrying: %s",
                        attempt + 1,
                        _MAX_RETRYABLE_ATTEMPTS,
                        wait,
                        exc,
                    )
                    await asyncio.sleep(wait)
                    continue
                raise
            content = extract_structured_content(response.content)
            if content is not None:
                break
            if attempt < _MAX_RETRYABLE_ATTEMPTS - 1:
                await asyncio.sleep(0.5 * (attempt + 1))

        if content is None:
            raise HTTPException(
                status_code=400,
                detail="LLM did not return any content",
            )

        if not validate_schema:
            return content

        validation_errors = get_schema_validation_errors(
            json_schema,
            content,
            strict=strict,
        )

        if not validation_errors:
            return content

        formatted_validation_errors = " | ".join(validation_errors)
        if validation_attempt == max_validation_loops - 1:
            LOGGER.warning(
                "Validation error after max fixes, returning last response: %s",
                formatted_validation_errors,
            )
            return content

        LOGGER.warning(
            "Validation error, attempting fix %s/%s: %s",
            validation_attempt + 1,
            max_validation_loops - 1,
            formatted_validation_errors,
        )
        working_messages.append(
            structured_validation_feedback_user_message(content, validation_errors)
        )

    raise HTTPException(status_code=400, detail="LLM did not return any content")


def extract_text(content: Any) -> Optional[str]:
    if content is None:
        return None
    if isinstance(content, str):
        return content
    if isinstance(content, Sequence) and not isinstance(content, (bytes, bytearray)):
        parts: list[str] = []
        for part in content:
            if isinstance(part, str):
                parts.append(part)
                continue
            text = getattr(part, "text", None)
            if isinstance(text, str):
                parts.append(text)
        joined = "".join(parts)
        return joined or None
    text = getattr(content, "text", None)
    if isinstance(text, str):
        return text
    return None


def extract_structured_content(content: Any) -> Optional[dict]:
    if content is None:
        return None
    if isinstance(content, dict):
        return content
    if hasattr(content, "model_dump"):
        dumped = content.model_dump(mode="json")
        if isinstance(dumped, dict):
            return dumped

    raw_text = extract_text(content)
    if not raw_text:
        return None

    try:
        parsed = dirtyjson.loads(raw_text)
    except Exception:
        return None

    if isinstance(parsed, dict):
        return dict(parsed)
    return None


def serialize_structured_content(content: Any) -> Optional[str]:
    parsed = extract_structured_content(content)
    if parsed is not None:
        return json.dumps(parsed, ensure_ascii=False)

    raw_text = extract_text(content)
    if raw_text:
        return raw_text
    return None


def message_content_to_text(content: Sequence[Any] | str | None) -> Optional[str]:
    joined = "".join(
        part.text
        for part in normalize_content_parts(content)
        if isinstance(getattr(part, "text", None), str)
    )
    return joined or None


async def stream_generate_events(client: Any, **kwargs) -> AsyncGenerator[Any, None]:
    loop = asyncio.get_running_loop()
    queue: asyncio.Queue[Any] = asyncio.Queue()
    sentinel = object()

    def worker():
        try:
            for event in client.generate(**kwargs):
                loop.call_soon_threadsafe(queue.put_nowait, event)
        except Exception as exc:
            loop.call_soon_threadsafe(queue.put_nowait, exc)
        finally:
            loop.call_soon_threadsafe(queue.put_nowait, sentinel)

    worker_task = asyncio.create_task(asyncio.to_thread(worker))
    try:
        while True:
            item = await queue.get()
            if item is sentinel:
                break
            if isinstance(item, Exception):
                raise item
            yield item
    finally:
        await worker_task
