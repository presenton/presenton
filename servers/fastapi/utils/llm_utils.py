import asyncio
import json
import logging
import math
import threading
import time
from collections.abc import AsyncGenerator, Awaitable, Callable, Sequence
from dataclasses import dataclass
from typing import Any

import dirtyjson
from fastapi import HTTPException
from llmai.shared import (
    LLMTool,
    Message,
    ReasoningConfig,
    ResponseFormat,
    ResponseStreamCompletionChunk,
    UserMessage,
    normalize_content_parts,
)

from utils.get_env import get_llm_slow_call_warn_seconds
from utils.llm_config import get_extra_body, llm_structured_outputs_enabled
from utils.schema_utils import get_schema_validation_errors

LOGGER = logging.getLogger(__name__)
CLIENT_DISCONNECT_POLL_SECONDS = 0.1
DisconnectChecker = Callable[[], Awaitable[bool]]
TextChunkCallback = Callable[[str], Awaitable[None]]


@dataclass(frozen=True)
class TextGenerationMetrics:
    model: str
    input_tokens: int
    output_tokens: int
    total_tokens: int
    tokens_per_second: float
    duration_seconds: float
    estimated: bool
    thinking_tokens: int | None = None
    thinking_tokens_estimated: bool = False
    supports_thinking: bool = False
    finish_reason: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "model": self.model,
            "input_tokens": self.input_tokens,
            "output_tokens": self.output_tokens,
            "total_tokens": self.total_tokens,
            "tokens_per_second": round(self.tokens_per_second, 2),
            "duration_seconds": round(self.duration_seconds, 3),
            "estimated": self.estimated,
            "thinking_tokens": self.thinking_tokens,
            "thinking_tokens_estimated": self.thinking_tokens_estimated,
            "supports_thinking": self.supports_thinking,
        }


async def _raise_if_client_disconnected(
    disconnect_checker: DisconnectChecker | None,
) -> None:
    if disconnect_checker and await disconnect_checker():
        raise asyncio.CancelledError


async def _generate_structured_content(
    client: Any,
    *,
    disconnect_checker: DisconnectChecker | None,
    text_chunk_callback: TextChunkCallback | None = None,
    finish_reason_out: list[str] | None = None,
    **kwargs: Any,
) -> dict | None:
    # Always stream, even with nothing to stream *to*. Structured generation
    # runs without an explicit max_tokens, so providers default to the model
    # ceiling, and the Anthropic SDK refuses a non-streaming request whose
    # estimated duration exceeds ten minutes -- it raises before sending
    # anything, so the call fails in seconds rather than running long. That
    # only bit callers with no disconnect checker and no chunk callback, i.e.
    # background generation, which made it look provider- or size-specific.
    # Streaming is what the SDK asks for here and is accepted identically by
    # the other providers, so it is the single path.
    completion_content: Any = None
    streamed_text: list[str] = []
    try:
        async for event in stream_generate_events(
            client,
            disconnect_checker=disconnect_checker,
            **{**kwargs, "stream": True},
        ):
            if isinstance(event, ResponseStreamCompletionChunk):
                completion_content = event.content
                if finish_reason_out is not None and getattr(event, "finish_reason", None):
                    finish_reason_out.append(str(event.finish_reason))
            elif getattr(event, "type", None) == "content":
                chunk = getattr(event, "chunk", None)
                if isinstance(chunk, str):
                    streamed_text.append(chunk)
                    if text_chunk_callback is not None:
                        await text_chunk_callback(chunk)
    except Exception as error:
        if not _is_json_parse_failure(error):
            raise
        # llmai жёстко парсит финальный контент при JSONSchemaResponse и
        # роняет JSONDecodeError (обёрнутый в LLMError), хотя дельты контента
        # уже прилетели: streamed_text содержит полный ответ. Гасим ошибку и
        # отдадим текст tolerant-парсеру ниже — это спасает ответы с prose
        # вокруг JSON и markdown-ограждениями; прочие классы (disconnect,
        # 429/5xx) пробрасываются штатно.
        LOGGER.warning(
            "[llm.parse] provider returned non-JSON final content (%s); "
            "falling back to tolerant parse of %d streamed chars",
            error,
            sum(len(chunk) for chunk in streamed_text),
        )

    content = extract_structured_content(completion_content)
    if content is not None:
        if text_chunk_callback is not None and not streamed_text:
            serialized = serialize_structured_content(completion_content)
            if serialized:
                await text_chunk_callback(serialized)
        return content
    return extract_structured_content("".join(streamed_text))


def get_generate_kwargs(
    model: str,
    messages: Sequence[Message],
    max_tokens: int | None = None,
    tools: list[LLMTool] | None = None,
    response_format: ResponseFormat | None = None,
    reasoning: ReasoningConfig | None = None,
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
    effective_response_format = response_format if llm_structured_outputs_enabled() else None
    if effective_response_format is not None:
        kwargs["response_format"] = effective_response_format
    if reasoning is not None:
        kwargs["reasoning"] = reasoning

    extra_body = get_extra_body(uses_tool_choice=bool(tools or effective_response_format))
    if extra_body:
        kwargs["extra_body"] = extra_body

    return kwargs


def estimate_text_tokens(value: str) -> int:
    """Return a stable approximation when a provider omits token usage."""
    return max(1, round(len(value) / 4)) if value else 0


def estimate_thinking_tokens(value: str) -> int:
    """Match llmai's visible-reasoning estimate for streamed thinking chunks."""
    return math.ceil(len(value.encode("utf-8")) / 4) if value else 0


def estimate_message_tokens(messages: Sequence[Message]) -> int:
    return sum(
        estimate_text_tokens(extract_text(getattr(message, "content", None)) or "")
        for message in messages
    )


def _usage_token_value(usage: Any, *names: str) -> int | None:
    for name in names:
        value = usage.get(name) if isinstance(usage, dict) else getattr(usage, name, None)
        if isinstance(value, (int, float)):
            return int(value)
    return None


def _usage_thinking_tokens(usage: Any) -> tuple[int | None, bool]:
    """Return llmai's best thinking count and whether that count is estimated."""
    if usage is None:
        return None, False

    reasoning = (
        usage.get("reasoning") if isinstance(usage, dict) else getattr(usage, "reasoning", None)
    )
    billed_tokens = _usage_token_value(reasoning, "billed_tokens")
    if billed_tokens is not None:
        billed_estimated = (
            reasoning.get("billed_estimated", False)
            if isinstance(reasoning, dict)
            else getattr(reasoning, "billed_estimated", False)
        )
        return billed_tokens, bool(billed_estimated)

    visible_tokens = _usage_token_value(reasoning, "visible_tokens")
    if visible_tokens is not None:
        return visible_tokens, True

    return _usage_token_value(usage, "thinking_tokens", "reasoning_tokens"), False


def build_text_generation_metrics(
    *,
    model: str,
    messages: Sequence[Message],
    content: str,
    streamed_thinking: str,
    completion: Any,
    started_at: float,
    model_supports_thinking: bool = False,
) -> TextGenerationMetrics:
    usage = getattr(completion, "usage", None) if completion is not None else None
    exact_input_tokens = _usage_token_value(usage, "input_tokens", "prompt_tokens")
    exact_output_tokens = _usage_token_value(usage, "output_tokens", "completion_tokens")
    input_tokens = (
        exact_input_tokens if exact_input_tokens is not None else estimate_message_tokens(messages)
    )
    output_tokens = (
        exact_output_tokens if exact_output_tokens is not None else estimate_text_tokens(content)
    )
    thinking_tokens, thinking_tokens_estimated = _usage_thinking_tokens(usage)
    if thinking_tokens is None and streamed_thinking:
        thinking_tokens = estimate_thinking_tokens(streamed_thinking)
        thinking_tokens_estimated = True

    supports_thinking = bool(
        model_supports_thinking or thinking_tokens is not None or streamed_thinking
    )
    if (
        supports_thinking
        and exact_output_tokens is not None
        and (thinking_tokens is None or thinking_tokens_estimated)
    ):
        inferred_thinking_tokens = max(
            0,
            exact_output_tokens - estimate_text_tokens(content),
        )
        if thinking_tokens is None or inferred_thinking_tokens > thinking_tokens:
            thinking_tokens = inferred_thinking_tokens
            thinking_tokens_estimated = True
    if supports_thinking and thinking_tokens is None:
        thinking_tokens = 0
        thinking_tokens_estimated = True

    # Provider-reported output usage normally already includes reasoning
    # tokens. When usage is unavailable, however, ``output_tokens`` is only an
    # estimate of visible content. Include the separately streamed thinking
    # estimate so live throughput does not incorrectly read 0 t/s while a
    # reasoning model is actively working.
    generated_tokens = output_tokens
    if exact_output_tokens is None and thinking_tokens is not None:
        generated_tokens += thinking_tokens

    duration_seconds = (
        getattr(completion, "duration_seconds", None) if completion is not None else None
    )
    if not isinstance(duration_seconds, (int, float)) or duration_seconds <= 0:
        duration_seconds = max(time.perf_counter() - started_at, 1e-9)
    total_tokens = _usage_token_value(usage, "total_tokens")
    if total_tokens is None:
        total_tokens = input_tokens + generated_tokens

    return TextGenerationMetrics(
        model=model,
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        total_tokens=total_tokens,
        tokens_per_second=generated_tokens / duration_seconds,
        duration_seconds=duration_seconds,
        estimated=exact_input_tokens is None or exact_output_tokens is None,
        thinking_tokens=thinking_tokens,
        thinking_tokens_estimated=thinking_tokens_estimated,
        supports_thinking=supports_thinking,
    )


def structured_validation_feedback_user_message(
    content: dict,
    validation_errors: list[str],
    *,
    content_errors: list[str] | None = None,
) -> UserMessage:
    max_error_count = 10
    max_json_chars = 6000

    def _format_errors(errors: list[str]) -> list[str]:
        formatted = errors[:max_error_count]
        if len(errors) > max_error_count:
            formatted.append(f"...and {len(errors) - max_error_count} more validation errors.")
        return formatted

    sections: list[str] = []
    if content_errors:
        sections.append(
            "Content quality issues (the JSON structure is valid, but these values "
            "are not real audience-facing content):\n"
            + "\n".join(f"- {error}" for error in _format_errors(content_errors))
            + "\n\nReplace every flagged value with meaningful content about the "
            "slide topic in the slide language. Never use response-schema field "
            'names or keywords (e.g. "minLength", "type object"), internal '
            'identifiers (e.g. "__tablecard"), generation meta-commentary, '
            'placeholder punctuation (e.g. "..."), or glued/truncated words.'
        )
    if validation_errors:
        sections.append(
            "The previous JSON response did not match the required response schema.\n\n"
            "Validation errors:\n"
            + "\n".join(f"- {error}" for error in _format_errors(validation_errors))
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
            "\n\n".join(sections)
            + "\n\nPrevious invalid JSON:\n"
            + f"```json\n{previous_response}\n```\n\n"
            + "Return corrected JSON only. Make sure it fully matches the required schema."
        )
    )


#: upstream-провайдеры иногда отбивают генерацию нарушением response-схемы
#: (например, «Upstream error from Sail Research: response_format violated:
#: model output did not match response JSON Schema …»). Модель недетерминирована:
#: повторная попытка того же запроса обычно проходит. Ретраим только этот класс.
_UPSTREAM_SCHEMA_VIOLATION_MARKERS = (
    "response_format violated",
    "did not match response json schema",
    "upstream error from",
)
_MAX_UPSTREAM_SCHEMA_RETRIES = 2
_UPSTREAM_RETRY_DELAYS_SEC = (1.0, 2.0)

#: 429/5xx от провайдера — временный отказ: под нагрузкой аккаунта или самого
#: апстрима повторная попытка через паузу обычно проходит. Ретраим отдельно
#: от schema-нарушений, со своим счётчиком и экспоненциальными паузами.
_MAX_UPSTREAM_RATE_RETRIES = 3
_UPSTREAM_RATE_RETRY_DELAYS_SEC = (1.0, 4.0, 8.0)
_UPSTREAM_RATE_LIMIT_MARKERS = ("rate limit", "rate_limit", "too many requests")

#: Пустой/битый JSON в structured-вызове — transient-флейм модели. Прод-кейс
#: (2026-09-05): «Expecting value: line 1 column 1 (char 0)» — модель отдала
#: пустой контент; одиночный повтор того же запроса обычно проходит.
_MAX_TRANSIENT_PARSE_RETRIES = 2
_TRANSIENT_PARSE_RETRY_DELAYS_SEC = (1.0, 2.0)
#: Фразы сообщений json.JSONDecodeError. llmai заворачивает исключения стрима
#: в LLMError(500, "500: <message>", cause=original) — bare-проверка
#: isinstance(error, JSONDecodeError) на обёртке не работает, матчить нужно
#: cause-цепочку или текст (_is_json_parse_failure).
_JSON_PARSE_ERROR_MARKERS = (
    "expecting value",
    "expecting ',' delimiter",
    "expecting property name",
    "unterminated string",
    "extra data",
    "invalid control character",
    "invalid \\escape",
    "invalid json",
    "json decode error",
)


def _is_upstream_schema_violation(error: BaseException) -> bool:
    """Upstream-отбой по response-схеме — единственный класс, который ретраим."""
    candidates = [str(error), getattr(error, "message", None)]
    for candidate in candidates:
        if not candidate:
            continue
        lowered = candidate.lower()
        if any(marker in lowered for marker in _UPSTREAM_SCHEMA_VIOLATION_MARKERS):
            return True
    return False


def _is_upstream_rate_or_server_error(error: BaseException) -> bool:
    """429/5xx от провайдера: по ``status_code``, фолбэк — по тексту ошибки.

    Локальные HTTP-ошибки движка (fastapi ``HTTPException``) апстримом не
    считаются и не ретраятся этим механизмом.
    """
    if isinstance(error, HTTPException):
        return False
    status_code = getattr(error, "status_code", None)
    if isinstance(status_code, int):
        return status_code == 429 or status_code >= 500
    text = str(error).lower()
    return any(marker in text for marker in _UPSTREAM_RATE_LIMIT_MARKERS)


def _is_json_parse_failure(error: BaseException) -> bool:
    """Битый/непарсящийся JSON от провайдера, в т.ч. завёрнутый llmai.

    llmai при structured-вызове жёстко парсит финальный контент
    (``json.loads``) и роняет JSONDecodeError; до нас исключение доходит
    как LLMError с оригиналом в ``cause``/``__cause__``, поэтому проверяем
    цепочку, а не только сам error.
    """
    candidates = (
        error,
        getattr(error, "cause", None),
        error.__cause__,
    )
    for candidate in candidates:
        if isinstance(candidate, json.JSONDecodeError):
            return True
    text = str(error).lower()
    return any(marker in text for marker in _JSON_PARSE_ERROR_MARKERS)


def _is_transient_parse_error(error: BaseException) -> bool:
    """Пустой/битый JSON от модели в structured-вызове — transient-флейм.

    Ловим и сырой ``JSONDecodeError`` (например, незащищённый
    ``json.loads`` в llmai для openai-совместимых провайдеров), и
    обёрнутые варианты с тем же текстом ошибки.
    """
    return _is_json_parse_failure(error)


def _warn_if_slow_llm_call(model: str, duration_seconds: float) -> None:
    """Warning для одиночного медленного LLM-вызова (стенд-диагностика)."""
    threshold = get_llm_slow_call_warn_seconds()
    if threshold > 0 and duration_seconds >= threshold:
        LOGGER.warning(
            "[llm.slow_call] model=%s duration_s=%.1f threshold_s=%.0f",
            model,
            duration_seconds,
            threshold,
        )


class SlideContentQualityError(HTTPException):
    """LLM-контент не прошёл контент-QC после всех попыток починки.

    Возвращать заведомо мусорный ответ (schema-эхо, мета-болтовня, обрывы)
    в деку хуже, чем уронить генерацию слайда: вызывающий код решает —
    перегенерировать слайд или упасть с внятной ошибкой.
    """

    def __init__(self, validation_errors: list[str]) -> None:
        self.validation_errors = list(validation_errors)
        super().__init__(
            status_code=502,
            detail=(
                "LLM returned invalid content after all validation attempts: "
                + " | ".join(self.validation_errors[:8])
            ),
        )


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
    content_validator: Callable[[dict], list[str]] | None = None,
    disconnect_checker: DisconnectChecker | None = None,
    text_chunk_callback: TextChunkCallback | None = None,
) -> dict:
    """
    Parse retries (inner loop) plus optional JSON Schema validation feedback loops (outer loop),
    matching the overflow-mitigation behavior from structured generation with validate_schema.
    """
    max_validation_loops = max(1, validate_schema_max_loop_count)
    working_messages: list[Message] = list(messages)
    schema_retries = 0
    rate_retries = 0
    parse_retries = 0
    first_call = True

    for validation_attempt in range(max_validation_loops):
        content: dict | None = None
        finish_reasons: list[str] = []
        empty_attempts = 0
        while content is None:
            await _raise_if_client_disconnected(disconnect_checker)
            try:
                call_started = time.monotonic()
                content = await _generate_structured_content(
                    client,
                    disconnect_checker=disconnect_checker,
                    text_chunk_callback=(
                        text_chunk_callback if validation_attempt == 0 and first_call else None
                    ),
                    finish_reason_out=finish_reasons,
                    **get_generate_kwargs(
                        model=model,
                        messages=working_messages,
                        response_format=response_format,
                    ),
                )
                _warn_if_slow_llm_call(model, time.monotonic() - call_started)
                first_call = False
            except Exception as error:
                if schema_retries < _MAX_UPSTREAM_SCHEMA_RETRIES and (
                    _is_upstream_schema_violation(error)
                ):
                    schema_retries += 1
                    delay = _UPSTREAM_RETRY_DELAYS_SEC[
                        min(schema_retries, len(_UPSTREAM_RETRY_DELAYS_SEC)) - 1
                    ]
                    LOGGER.warning(
                        "Upstream schema violation, retry %d/%d in %.0fs: %s",
                        schema_retries,
                        _MAX_UPSTREAM_SCHEMA_RETRIES,
                        delay,
                        error,
                    )
                    await asyncio.sleep(delay)
                    continue
                if rate_retries < _MAX_UPSTREAM_RATE_RETRIES and (
                    _is_upstream_rate_or_server_error(error)
                ):
                    rate_retries += 1
                    delay = _UPSTREAM_RATE_RETRY_DELAYS_SEC[
                        min(rate_retries, len(_UPSTREAM_RATE_RETRY_DELAYS_SEC)) - 1
                    ]
                    LOGGER.warning(
                        "Upstream rate limit / server error, retry %d/%d in %.0fs: %s",
                        rate_retries,
                        _MAX_UPSTREAM_RATE_RETRIES,
                        delay,
                        error,
                    )
                    await asyncio.sleep(delay)
                    continue
                if parse_retries < _MAX_TRANSIENT_PARSE_RETRIES and (
                    _is_transient_parse_error(error)
                ):
                    parse_retries += 1
                    delay = _TRANSIENT_PARSE_RETRY_DELAYS_SEC[
                        min(parse_retries, len(_TRANSIENT_PARSE_RETRY_DELAYS_SEC)) - 1
                    ]
                    LOGGER.warning(
                        "Transient parse failure, retry %d/%d in %.0fs: %s",
                        parse_retries,
                        _MAX_TRANSIENT_PARSE_RETRIES,
                        delay,
                        error,
                    )
                    await asyncio.sleep(delay)
                    continue
                raise
            if content is not None:
                break
            empty_attempts += 1
            if empty_attempts >= 3:
                break
            await asyncio.sleep(0.5 * empty_attempts)

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

        # Контент-QC запускаем и при schema-ошибках: содержательный фидбек
        # («ячейки повторяют имена полей схемы») полезнее голого списка
        # нарушений и не должен срезаться лимитом ошибок в фидбеке.
        content_errors = list(content_validator(content)) if content_validator else []
        # Обрыв по лимиту токенов: JSON при structured outputs остаётся
        # валидным, но текст заканчивается на полуслове. Отдаём модели
        # фидбек на укорачивание, а не обрывок в деку.
        if "length" in finish_reasons or "max_tokens" in finish_reasons:
            content_errors.append(
                "response was truncated by the token limit "
                "(finish_reason=length): shorten the text values so the "
                "complete JSON fits, do not clip mid-sentence"
            )
            LOGGER.warning(
                "[llm.truncation] structured response hit token limit "
                "(finish_reason=%s), feeding shorten-feedback",
                ",".join(finish_reasons),
            )
        # Контентные ошибки вперёд: фидбек обрезается до 10 строк.
        all_validation_errors = content_errors + validation_errors

        if not all_validation_errors:
            return content

        formatted_validation_errors = " | ".join(all_validation_errors)
        if validation_attempt == max_validation_loops - 1:
            if content_validator is not None:
                # С вызовом, которому важен контент, возвращать последний
                # невалидный ответ нельзя — это и есть источник мусорных
                # слайдов (прод-кейс 2026-09-05). Роняем слайд: вызывающий
                # код перегенерит его или отдаст ошибку пользователю.
                LOGGER.error(
                    "Content validation failed after max fixes, raising: %s",
                    formatted_validation_errors,
                )
                raise SlideContentQualityError(all_validation_errors)
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
            structured_validation_feedback_user_message(
                content,
                validation_errors,
                content_errors=content_errors or None,
            )
        )

    raise HTTPException(status_code=400, detail="LLM did not return any content")


def extract_text(content: Any) -> str | None:
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


def _balanced_json_text(text: str) -> str | None:
    """Return the first brace-balanced ``{...}`` region of ``text``, if any."""
    start = text.find("{")
    if start == -1:
        return None
    depth = 0
    in_string = False
    escaped = False
    for i in range(start, len(text)):
        char = text[i]
        if in_string:
            if escaped:
                escaped = False
            elif char == "\\":
                escaped = True
            elif char == '"':
                in_string = False
            continue
        if char == '"':
            in_string = True
        elif char == "{":
            depth += 1
        elif char == "}":
            depth -= 1
            if depth == 0:
                return text[start : i + 1]
    return None


def _strip_markdown_fences(text: str) -> str:
    """Strip a ```json ... ``` (or ``` ... ```) code block around the response."""
    stripped = text.strip()
    if not stripped.startswith("```"):
        return stripped
    lines = stripped.splitlines()
    if lines and lines[0].strip().startswith("```"):
        body = "\n".join(lines[1:]).rstrip()
        if body.endswith("```"):
            body = body[:-3].rstrip()
        return body
    return stripped


def _extract_json_dict_from_text(raw_text: str) -> dict | None:
    """Parse a JSON object out of a model's text response.

    Tolerates markdown code fences and surrounding prose, which models
    occasionally produce when ``response_format`` is not requested (e.g. with
    ``LLM_STRUCTURED_OUTPUTS=false``). ``dirtyjson`` keeps accepting the dirty
    JSON shapes the engine already handles (trailing commas, comments).
    """
    text = _strip_markdown_fences(raw_text)
    if not text:
        return None
    candidates = [text, _balanced_json_text(text)]
    for candidate in candidates:
        if not candidate:
            continue
        try:
            parsed = dirtyjson.loads(candidate)
        except Exception:
            continue
        if isinstance(parsed, dict):
            return dict(parsed)
    return None


def extract_structured_content(content: Any) -> dict | None:
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

    return _extract_json_dict_from_text(raw_text)


def serialize_structured_content(content: Any) -> str | None:
    parsed = extract_structured_content(content)
    if parsed is not None:
        return json.dumps(parsed, ensure_ascii=False)

    raw_text = extract_text(content)
    if raw_text:
        return raw_text
    return None


def message_content_to_text(content: Sequence[Any] | str | None) -> str | None:
    joined = "".join(
        part.text
        for part in normalize_content_parts(content)
        if isinstance(getattr(part, "text", None), str)
    )
    return joined or None


async def stream_generate_events(
    client: Any,
    *,
    disconnect_checker: DisconnectChecker | None = None,
    **kwargs,
) -> AsyncGenerator[Any, None]:
    loop = asyncio.get_running_loop()
    queue: asyncio.Queue[Any] = asyncio.Queue()
    sentinel = object()
    stop_requested = threading.Event()

    def enqueue(item: Any) -> None:
        try:
            loop.call_soon_threadsafe(queue.put_nowait, item)
        except RuntimeError:
            pass

    def worker():
        events = None
        try:
            events = iter(client.generate(**kwargs))
            while not stop_requested.is_set():
                try:
                    event = next(events)
                except StopIteration:
                    break
                if stop_requested.is_set():
                    break
                enqueue(event)
        except Exception as exc:
            if not stop_requested.is_set():
                enqueue(exc)
        finally:
            if stop_requested.is_set() and events is not None:
                close = getattr(events, "close", None)
                if callable(close):
                    try:
                        close()
                    except Exception:
                        LOGGER.debug(
                            "Failed to close cancelled LLM stream",
                            exc_info=True,
                        )
            enqueue(sentinel)

    worker_task = asyncio.create_task(asyncio.to_thread(worker))
    completed = False
    try:
        while True:
            await _raise_if_client_disconnected(disconnect_checker)
            try:
                item = await asyncio.wait_for(
                    queue.get(),
                    timeout=(CLIENT_DISCONNECT_POLL_SECONDS if disconnect_checker else None),
                )
            except TimeoutError:
                continue
            if item is sentinel:
                completed = True
                break
            if isinstance(item, Exception):
                raise item
            yield item
    except asyncio.CancelledError:
        LOGGER.info("LLM stream cancelled because the client disconnected")
        raise
    finally:
        stop_requested.set()
        if completed or worker_task.done():
            await worker_task
        else:
            worker_task.add_done_callback(
                lambda task: None if task.cancelled() else task.exception()
            )
