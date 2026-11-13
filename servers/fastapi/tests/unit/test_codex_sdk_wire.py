"""Exercise the real pinned SDK serializer and SSE parser, with no sockets."""
import json
import socket

import httpx
import openai
import pytest
from llmai import get_model_capabilities
from llmai.shared import JSONSchemaResponse, Tool, ToolChoiceMode, UserMessage

from services import codex_credentials, configured_llm
from services.codex_models import CodexModel


MODEL = "presenton-fixture-unregistered-1028"
SCHEMA = {
    "type": "object", "properties": {"answer": {"type": "string"}},
    "required": ["answer"], "additionalProperties": False,
}


def sse_response(*, tool: bool):
    output = [{
        "type": "function_call", "id": "fc_fixture", "call_id": "call_fixture",
        "name": "fixture_echo", "arguments": '{"answer":"fixture"}', "status": "completed",
    }] if tool else [{
        "type": "message", "id": "msg_fixture", "status": "completed", "role": "assistant",
        "content": [{"type": "output_text", "text": '{"answer":"fixture"}', "annotations": [], "logprobs": []}],
    }]
    events = []
    if not tool:
        events.append({
            "type": "response.output_text.delta", "sequence_number": 1, "item_id": "msg_fixture",
            "output_index": 0, "content_index": 0, "delta": '{"answer":"fixture"}', "logprobs": [],
        })
    events.append({
        "type": "response.completed", "sequence_number": 2,
        "response": {
            "id": "resp_fixture", "object": "response", "created_at": 0,
            "status": "completed", "model": MODEL, "output": output,
            "usage": {"input_tokens": 1, "output_tokens": 1, "total_tokens": 2},
            "error": None, "incomplete_details": None,
        },
    })
    return "".join("event: " + event["type"] + "\ndata: " + json.dumps(event) + "\n\n" for event in events)


@pytest.mark.parametrize("case", ["plain", "structured", "tools", "reasoning"])
def test_discovered_unknown_model_reaches_real_sdk_wire_and_parser(monkeypatch, case):
    assert get_model_capabilities(MODEL, provider="chatgpt").raw == {}
    network_attempts = []
    original_connect = socket.socket.connect
    def guarded_connect(sock, address):
        if sock.family in {socket.AF_INET, socket.AF_INET6}:
            network_attempts.append(1)
            raise AssertionError("No real network is permitted in SDK wire acceptance")
        return original_connect(sock, address)
    monkeypatch.setattr(socket.socket, "connect", guarded_connect)
    monkeypatch.setattr(socket, "create_connection", lambda *args, **kwargs: pytest.fail("No network connection is permitted"))
    monkeypatch.setattr(socket, "getaddrinfo", lambda *args, **kwargs: pytest.fail("No DNS is permitted"))

    captured = []
    def handler(request):
        assert request.method == "POST"
        assert str(request.url) == "https://fixture.invalid/backend-api/codex/responses"
        payload = json.loads(request.content)
        assert payload["model"] == MODEL
        assert payload["stream"] is True
        assert "max_output_tokens" not in payload
        captured.append(payload)
        return httpx.Response(200, headers={"Content-Type": "text/event-stream"}, content=sse_response(tool=case == "tools"))

    real_openai = openai.OpenAI
    def mocked_openai(**kwargs):
        kwargs.update({
            "base_url": "https://fixture.invalid/backend-api/codex",
            "http_client": httpx.Client(transport=httpx.MockTransport(handler), trust_env=False),
            "max_retries": 0,
        })
        return real_openai(**kwargs)
    monkeypatch.setattr("llmai.chatgpt.client.OpenAI", mocked_openai)
    config = {"LLM": "codex", "CODEX_MODEL": MODEL, "CODEX_ACCESS_TOKEN": "fixture-access", "CODEX_ACCOUNT_ID": "fixture-account"}
    if case == "reasoning":
        config.update({"LLM_REASONING_MODE": "enabled", "LLM_REASONING_EFFORT": "high"})
    snapshot = codex_credentials._snapshot(config)
    monkeypatch.setenv("LLM", "codex")
    monkeypatch.setattr(codex_credentials, "refresh_credentials", lambda: snapshot)
    monkeypatch.setattr(codex_credentials, "ensure_current", lambda _: None)
    metadata = CodexModel(
        id=MODEL, name="Fixture account model", context_window=123456,
        supported_reasoning_levels=("low", "high", "ultra") if case == "reasoning" else (),
        parallel_tool_calls=False, supports_reasoning_summary_parameter=False,
    )
    monkeypatch.setattr(configured_llm, "fetch_catalog", lambda *args: (metadata,))
    resolved = configured_llm.resolve_configured_llm()
    kwargs = {"model": resolved.model, "messages": [UserMessage(content="Return a fixture answer.")]}
    if case == "structured":
        kwargs["response_format"] = JSONSchemaResponse(name="Fixture", strict=True, json_schema=SCHEMA)
    if case == "tools":
        kwargs["tools"] = [Tool(name="fixture_echo", description="A fixture function.", strict=True, schema=SCHEMA)]
        kwargs["tool_choice"] = {"mode": ToolChoiceMode.REQUIRED}
    try:
        response = resolved.client.generate(**kwargs)
    finally:
        resolved.client._client.close()
    assert len(captured) == 1
    assert network_attempts == []
    assert captured[0]["parallel_tool_calls"] is False
    assert "summary" not in captured[0].get("reasoning", {})
    if case == "structured":
        assert captured[0]["text"]["format"]["type"] == "json_schema"
        assert response.content == {"answer": "fixture"}
    elif case == "tools":
        assert captured[0]["tools"][0]["type"] == "function"
        assert response.tool_calls[0].name == "fixture_echo"
    elif case == "reasoning":
        assert captured[0]["reasoning"]["effort"] == "high"
        assert resolved.client.get_model_capabilities(MODEL).reasoning.source.value == "application"
    else:
        assert response.content
