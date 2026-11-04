"""Request-local budgeting. Never changes persisted history or truncates edit JSON."""

import json
import math
import os
import re
from dataclasses import dataclass
from typing import Any

from fastapi import HTTPException
from llmai.models import get_context_window
from llmai.shared import AssistantMessage, Message, SystemMessage, ToolResponseMessage, UserMessage
from pydantic import BaseModel


CONTEXT_ERROR_DETAIL = (
    "The AI editor could not fit this request within the model's context window. "
    "Try a smaller edit or a model with a larger context window. For a custom "
    "deployment, set LLM_CONTEXT_WINDOW to its deployed token limit."
)
TRUNCATED_ERROR_DETAIL = (
    "The AI response was incomplete, so edits from that response were not applied. "
    "Try a smaller edit or increase Max output tokens in Advanced Settings. "
    "Earlier successful edits in this turn are still saved."
)


def _json_value(value: Any) -> Any:
    if isinstance(value, type) and issubclass(value, BaseModel):
        return value.model_json_schema()
    if isinstance(value, BaseModel):
        return _json_value(value.model_dump(exclude_none=True))
    if isinstance(value, dict):
        return {key: _json_value(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [_json_value(item) for item in value]
    return value


def _request_bytes(messages: list[Message], tools: list[Any] | None) -> int:
    # Include tool schemas and tool-call arguments, not just visible text.
    payload = _json_value({"messages": messages, "tools": tools or []})
    return len(json.dumps(payload, ensure_ascii=False, default=str).encode("utf-8"))


def _error_text(error: Exception) -> str:
    """Inspect wrapped SDK errors locally; never send their raw text to the UI."""
    parts: list[str] = []
    seen: set[int] = set()
    current: BaseException | None = error
    while current is not None and id(current) not in seen and len(seen) < 5:
        seen.add(id(current))
        parts.extend((str(current), str(getattr(current, "body", ""))))
        current = getattr(current, "cause", None) or current.__cause__
    return " ".join(parts).lower()


def is_context_overflow(error: Exception) -> bool:
    text = _error_text(error)
    return any(marker in text for marker in (
        "context_length_exceeded", "maximum context length", "prompt is too long",
        "input_too_long", "exceeds the context window", "exceed context window",
        "exceeds the available context", "input token count exceeds",
    ))


def validate_completion(completion: Any, max_tokens: int | None = None) -> None:
    if completion is None:
        raise HTTPException(status_code=422, detail=TRUNCATED_ERROR_DETAIL)
    reason = (getattr(completion, "finish_reason", None) or "").lower()
    usage = getattr(completion, "usage", None)
    output_tokens = getattr(usage, "output_tokens", None)
    # Some llmai adapters omit termination metadata. Treat an exhausted native
    # output count conservatively in that case, before applying any tool calls.
    exhausted = not reason and isinstance(output_tokens, int) and max_tokens is not None and output_tokens >= max_tokens
    if reason in {"length", "max_tokens", "max_output_tokens"} or exhausted:
        raise HTTPException(status_code=422, detail=TRUNCATED_ERROR_DETAIL)
    # Validate the entire batch before executing its first tool. A malformed
    # later call must not leave half of a response's edits applied.
    for call in getattr(completion, "tool_calls", []) or []:
        try:
            arguments = json.loads(call.arguments or "{}")
            if not isinstance(arguments, dict):
                raise ValueError("Tool arguments must be an object")
        except (ValueError, TypeError):
            raise HTTPException(status_code=422, detail=TRUNCATED_ERROR_DETAIL) from None


def _receipt(message: ToolResponseMessage, tool_name: str) -> dict[str, Any]:
    text = "".join(part if isinstance(part, str) else part.text for part in message.content or [])
    try:
        payload = json.loads(text)
    except (ValueError, TypeError):
        payload = {}
    result = payload.get("result") if isinstance(payload, dict) else None
    receipt: dict[str, Any] = {"tool": tool_name, "ok": payload.get("ok") if isinstance(payload, dict) else None}
    # Keep mutation receipts and target identifiers, without replaying large
    # source data or replacement arguments. Read details must be fetched again.
    if isinstance(result, dict):
        for key in ("message", "index", "slide_number", "slide_id", "component_id", "element_path", "saved", "updated", "added", "deleted"):
            value = result.get(key)
            if isinstance(value, (str, int, bool)):
                receipt[key] = value[:240] + "..." if key == "message" and isinstance(value, str) and len(value) > 240 else value
    return receipt


def _compact_one(messages: list[Message]) -> bool:
    latest_user = max((i for i, message in enumerate(messages) if isinstance(message, UserMessage)), default=0)
    old_users = [i for i, message in enumerate(messages[:latest_user]) if isinstance(message, UserMessage)]
    if old_users:
        start = old_users[0]
        end = old_users[1] if len(old_users) > 1 else latest_user
        messages[start:end] = [message for message in messages[start:end] if isinstance(message, SystemMessage)]
        return True
    if any(not isinstance(message, SystemMessage) for message in messages[:latest_user]):
        messages[:latest_user] = [message for message in messages[:latest_user] if isinstance(message, SystemMessage)]
        return True

    groups: list[tuple[int, int]] = []
    for start, message in enumerate(messages):
        if not isinstance(message, AssistantMessage) or not message.tool_calls:
            continue
        end = start + 1
        while end < len(messages) and isinstance(messages[end], ToolResponseMessage):
            end += 1
        expected = {call.id for call in message.tool_calls}
        actual = [response.id for response in messages[start + 1:end]]
        if len(actual) == len(expected) and set(actual) == expected:
            groups.append((start, end))
    # Keep the most recent complete tool exchange intact, including the latest
    # authoritative target. Replace whole older exchanges to avoid orphan IDs.
    if len(groups) < 2:
        return False
    start, end = groups[0]
    calls = {call.id: call.name for call in messages[start].tool_calls}
    receipts = [_receipt(response, calls[response.id]) for response in messages[start + 1:end]]
    messages[start:end] = [AssistantMessage(content=[
        "Earlier tool results (already executed; do not repeat successful edits). "
        "Source details omitted for space; read current targets again if needed: "
        + json.dumps(receipts, ensure_ascii=False)
    ])]
    return True


@dataclass
class ChatContextBudget:
    context_window: int
    output_limit: int
    minimum_output: int = 1024
    # UTF-8 bytes/3 is deliberately more cautious than the existing chars/4
    # usage estimate. It is still an estimate, so provider overflow gets one
    # bounded retry. No tokenizer downloads or third-party counting services.
    tokens_per_byte: float = 1 / 3
    margin: int = 1024

    @classmethod
    def from_client(cls, client: Any, model: str) -> "ChatContextBudget":
        prepared = client.prepare_generation(model=model, tools_requested=True)
        override = os.environ.get("LLM_CONTEXT_WINDOW", "").strip()
        if override:
            try:
                window = int(override)
                if window <= 0:
                    raise ValueError
            except ValueError:
                raise HTTPException(status_code=400, detail="LLM_CONTEXT_WINDOW must be a positive integer.") from None
        else:
            # Unknown aliases get a provisional assumption, never the SDK's
            # unrelated 4,000-token unknown-model fallback. Deployments can
            # override nominal model metadata; errors can lower it this turn.
            window = get_context_window(model, provider=getattr(client, "PROVIDER_NAME", None), default=32768)
        reasoning = prepared.reasoning.budget_tokens or 0
        minimum = max(min(1024, prepared.max_output_tokens), reasoning + 512 if reasoning else 0)
        if minimum > prepared.max_output_tokens:
            raise HTTPException(status_code=400, detail="Max output tokens must leave room for an answer after the configured reasoning token budget.")
        return cls(window, prepared.max_output_tokens, minimum)

    def prepare(self, messages: list[Message], tools: list[Any] | None) -> dict[str, Any]:
        working = list(messages)
        margin = max(self.margin, self.context_window // 20)

        def remaining() -> int:
            return self.context_window - math.ceil(_request_bytes(working, tools) * self.tokens_per_byte) - margin

        available = remaining()
        while available < self.output_limit and _compact_one(working):
            available = remaining()
        if available < self.minimum_output:
            raise HTTPException(status_code=422, detail=CONTEXT_ERROR_DETAIL)
        return {"messages": working, "max_tokens": min(self.output_limit, available)}

    def learn_overflow(self, error: Exception, messages: list[Message], tools: list[Any] | None) -> None:
        text = _error_text(error)
        match = re.search(r"(?:maximum context length(?: is| of)?|max_model_len[=:]?|context window(?: is| of)?)\s*([\d,]+)", text)
        limit = int(match.group(1).replace(",", "")) if match else None
        if limit and limit > 0:
            self.context_window = min(self.context_window, limit)
        else:
            self.context_window = max(1, self.context_window * 3 // 4)
        self.output_limit = max(self.minimum_output, self.output_limit // 2)
        # Some servers report the actual prompt count; calibrate our estimate
        # upwards for this request without persisting model/deployment guesses.
        match = re.search(r"messages resulted in\s*([\d,]+)\s*tokens|([\d,]+)\s+in the messages", text)
        if match:
            actual = int((match.group(1) or match.group(2)).replace(",", ""))
            self.tokens_per_byte = max(self.tokens_per_byte, actual / max(1, _request_bytes(messages, tools)))
