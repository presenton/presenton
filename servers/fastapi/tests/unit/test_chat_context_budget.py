import asyncio
import json
import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from fastapi import HTTPException
from llmai.openai.client import OpenAIClient
from llmai.shared import AssistantMessage, AssistantToolCall, SystemMessage, Tool, ToolResponseMessage, UserMessage
from llmai.shared.configs import OpenAIClientConfig
from llmai.shared.errors import LLMError
from llmai.shared.generation import GenerationDefaults

from services.chat.context_budget import (
    ChatContextBudget, CONTEXT_ERROR_DETAIL, TRUNCATED_ERROR_DETAIL,
    is_context_overflow, validate_completion,
)
from services.chat.service import ChatTurnResult, PresentationChatService


def _messages():
    return [SystemMessage(content="Preserve existing slide data."), UserMessage(content="Change the selected title.")]


def _call(call_id="edit", arguments='{"index":0,"text":"New title"}'):
    return AssistantToolCall(id=call_id, name="updateElement", arguments=arguments)


def _completion(calls=None, reason="stop"):
    return SimpleNamespace(type="completion", content=["Done"], tool_calls=calls or [], finish_reason=reason)


def test_budget_resolves_existing_output_defaults_and_unknown_alias(monkeypatch):
    monkeypatch.delenv("LLM_CONTEXT_WINDOW", raising=False)
    client = OpenAIClient(config=OpenAIClientConfig(api_key="test", generation=GenerationDefaults(discover_capabilities=False)))
    budget = ChatContextBudget.from_client(client, "unknown-deployment-alias")
    assert budget.context_window == 32768
    assert budget.output_limit == 8192
    monkeypatch.setenv("LLM_CONTEXT_WINDOW", "16384")
    assert ChatContextBudget.from_client(client, "unknown-deployment-alias").context_window == 16384
    monkeypatch.setenv("LLM_CONTEXT_WINDOW", "invalid")
    with pytest.raises(HTTPException, match="positive integer"):
        ChatContextBudget.from_client(client, "unknown-deployment-alias")


def test_budget_compacts_old_turns_without_changing_source_history():
    messages = [SystemMessage(content="system"), UserMessage(content="old" * 10000), AssistantMessage(content=["old reply"]), UserMessage(content="Edit selected title")]
    original = [message.model_dump() for message in messages]
    prepared = ChatContextBudget(8000, 2048).prepare(messages, None)
    assert prepared["messages"] == [messages[0], messages[-1]]
    assert prepared["max_tokens"] == 2048
    assert [message.model_dump() for message in messages] == original


def test_budget_summarizes_whole_old_tool_exchanges_and_keeps_latest_target():
    messages = _messages() + [
        AssistantMessage(tool_calls=[_call(arguments=json.dumps({"element": "x" * 20000}))]),
        ToolResponseMessage(id="edit", content=[json.dumps({"ok": True, "result": {"index": 0, "message": "Title updated"}})]),
        AssistantMessage(tool_calls=[AssistantToolCall(id="read", name="getSlideAtIndex", arguments='{"index":0}')]),
        ToolResponseMessage(id="read", content=['{"element":{"runs":[{"text":"Current title"}]}}']),
    ]
    prepared = ChatContextBudget(7000, 2048).prepare(messages, None)
    reduced = prepared["messages"]
    assert reduced[-2:] == messages[-2:]
    assert "Title updated" in str(reduced[2].content)
    assert "do not repeat" in str(reduced[2].content)
    assert len(messages) == 6
    assert [message.id for message in reduced if isinstance(message, ToolResponseMessage)] == ["read"]


def test_budget_counts_tools_and_reduces_output_only_after_compaction():
    budget = ChatContextBudget(6000, 8192)
    base = budget.prepare(_messages(), None)
    tools = [Tool(name="tool", description="schema" * 1000, input_schema={"type": "object"})]
    with_tools = budget.prepare(_messages(), tools)
    assert 1024 <= with_tools["max_tokens"] < base["max_tokens"] < 8192
    with pytest.raises(HTTPException) as caught:
        budget.prepare(_messages(), [Tool(name="tool", description="x" * 30000)])
    assert caught.value.detail == CONTEXT_ERROR_DETAIL


def test_budget_never_slices_latest_target_json_or_latest_request():
    messages = _messages() + [
        AssistantMessage(tool_calls=[AssistantToolCall(id="read", name="getSlideAtIndex", arguments='{"index":0}')]),
        ToolResponseMessage(id="read", content=[json.dumps({"html": "x" * 40000})]),
    ]
    with pytest.raises(HTTPException):
        ChatContextBudget(8000, 2048).prepare(messages, None)
    assert len(json.loads(messages[-1].content[0])["html"]) == 40000
    with pytest.raises(HTTPException):
        ChatContextBudget(8000, 2048).prepare([UserMessage(content="x" * 40000)], None)


def test_utf8_budget_is_more_cautious_for_non_ascii():
    budget = ChatContextBudget(12000, 20000)
    ascii_cap = budget.prepare([UserMessage(content="a" * 3000)], None)["max_tokens"]
    unicode_cap = budget.prepare([UserMessage(content="界" * 3000)], None)["max_tokens"]
    assert unicode_cap < ascii_cap


def test_overflow_classifier_inspects_wrapped_error_and_learns_deployment_limit():
    cause = ValueError('context_length_exceeded: maximum context length is 16,384 tokens; 12000 in the messages')
    error = LLMError(400, "Provider rejected request", cause=cause)
    assert is_context_overflow(error)
    assert not is_context_overflow(ValueError("rate limit exceeded"))
    budget = ChatContextBudget(128000, 8192)
    budget.learn_overflow(error, _messages(), None)
    assert budget.context_window == 16384
    assert budget.output_limit == 4096
    assert budget.tokens_per_byte > 1 / 3


@pytest.mark.parametrize("reason", ["length", "max_tokens", "max_output_tokens", "MAX_TOKENS"])
def test_truncated_completions_are_rejected(reason):
    with pytest.raises(HTTPException) as caught:
        validate_completion(_completion([_call()], reason))
    assert caught.value.detail == TRUNCATED_ERROR_DETAIL


def test_missing_finish_reason_uses_native_output_usage_as_guard():
    completion = _completion([_call()], None)
    completion.usage = SimpleNamespace(output_tokens=2048)
    with pytest.raises(HTTPException):
        validate_completion(completion, 2048)
    validate_completion(completion, 4096)


class _Client:
    def __init__(self, responses):
        self.responses = list(responses)
        self.requests = []

    def prepare_generation(self, **kwargs):
        return SimpleNamespace(max_output_tokens=8192, reasoning=SimpleNamespace(budget_tokens=None))

    def generate(self, **kwargs):
        self.requests.append(kwargs)
        response = self.responses.pop(0)
        if isinstance(response, Exception):
            raise response
        return response


def _service(monkeypatch, client):
    monkeypatch.setenv("LLM", "openai")
    monkeypatch.setenv("LLM_CONTEXT_WINDOW", "32768")
    monkeypatch.setattr("services.chat.service.get_llm_config", lambda: None)
    monkeypatch.setattr("services.chat.service.get_client", lambda **kwargs: client)
    monkeypatch.setattr("services.chat.service.get_model", lambda: "test-alias")

    async def stream(client, **kwargs):
        result = client.generate(**kwargs)
        for event in result if isinstance(result, list) else [result]:
            yield event

    monkeypatch.setattr("services.chat.service.stream_generate_events", stream)
    service = PresentationChatService.__new__(PresentationChatService)
    service._tools = SimpleNamespace(
        get_tool_definitions=lambda: [], set_turn_context=lambda text: None,
        execute_tool_call=AsyncMock(return_value={"ok": True, "tool": "updateElement", "result": {"message": "Updated", "index": 0}}),
    )
    service._prepare_turn_context = AsyncMock(return_value=(uuid.uuid4(), _messages(), "Edit title"))
    service._persist_turn = AsyncMock(return_value=ChatTurnResult(uuid.uuid4(), "Done", ["updateElement"]))
    return service


async def _run_service(service, streaming):
    if streaming:
        return [event async for event in service.stream_reply("Edit title")]
    return await service._run_llm_with_tools(_messages())


@pytest.mark.parametrize("streaming", [False, True])
def test_overflow_retries_failed_call_without_replaying_successful_edits(monkeypatch, streaming):
    client = _Client([
        _completion([_call()]),
        LLMError(400, '{"error":{"code":"context_length_exceeded","message":"maximum context length is 32768 tokens"}}'),
        _completion(),
    ])
    service = _service(monkeypatch, client)
    asyncio.run(_run_service(service, streaming))
    assert len(client.requests) == 3
    assert client.requests[2]["max_tokens"] < client.requests[1]["max_tokens"]
    service._tools.execute_tool_call.assert_awaited_once()


@pytest.mark.parametrize("streaming", [False, True])
@pytest.mark.parametrize("malformed", [False, True])
def test_incomplete_tool_batch_executes_nothing(monkeypatch, streaming, malformed):
    response = _completion([_call(), _call("second", '{"text":')]) if malformed else _completion([_call()], "length")
    client = _Client([response])
    service = _service(monkeypatch, client)
    with pytest.raises(HTTPException) as caught:
        asyncio.run(_run_service(service, streaming))
    assert caught.value.detail == TRUNCATED_ERROR_DETAIL
    service._tools.execute_tool_call.assert_not_awaited()
    service._persist_turn.assert_not_awaited()
    assert len(client.requests) == 1


@pytest.mark.parametrize("streaming", [False, True])
def test_repeated_overflow_returns_safe_error_after_one_retry(monkeypatch, streaming):
    error = LLMError(400, 'context_length_exceeded secret-key http://internal-provider/private')
    client = _Client([error, error])
    service = _service(monkeypatch, client)
    with pytest.raises(HTTPException) as caught:
        asyncio.run(_run_service(service, streaming))
    assert caught.value.detail == CONTEXT_ERROR_DETAIL
    assert "secret-key" not in caught.value.detail
    assert len(client.requests) == 2


def test_stream_never_retries_after_content_is_emitted(monkeypatch):
    client = _Client([])
    service = _service(monkeypatch, client)

    async def partial_stream(client, **kwargs):
        client.requests.append(kwargs)
        yield SimpleNamespace(type="content", chunk="Starting")
        raise LLMError(400, "context_length_exceeded")

    monkeypatch.setattr("services.chat.service.stream_generate_events", partial_stream)
    with pytest.raises(HTTPException):
        asyncio.run(_run_service(service, True))
    assert len(client.requests) == 1
    service._tools.execute_tool_call.assert_not_awaited()


def test_missing_stream_completion_is_not_saved_as_success(monkeypatch):
    client = _Client([[SimpleNamespace(type="content", chunk="Partial response")]])
    service = _service(monkeypatch, client)
    with pytest.raises(HTTPException) as caught:
        asyncio.run(_run_service(service, True))
    assert caught.value.detail == TRUNCATED_ERROR_DETAIL
    service._persist_turn.assert_not_awaited()


def test_final_synthesis_uses_same_budget_and_retry(monkeypatch):
    client = _Client([LLMError(400, "context_length_exceeded"), _completion()])
    service = _service(monkeypatch, client)
    result = asyncio.run(service._try_final_response_without_tools(
        client=client, model="test", messages=_messages(), budget=ChatContextBudget(32768, 8192),
    ))
    assert result == "Done"
    assert len(client.requests) == 2
    assert "tools" not in client.requests[0]
