import httpx
import pytest
from fastapi import HTTPException

from services import codex_models


def entry(slug="new-account-model", **extra):
    return {
        "slug": slug, "display_name": "Account model", "visibility": "list",
        "priority": 1, "supported_in_api": False,
        "supported_reasoning_levels": [{"effort": "low"}, {"effort": "ultra"}],
        **extra,
    }


def transport(monkeypatch, handler):
    original = httpx.Client
    monkeypatch.setattr(codex_models.httpx, "Client", lambda **kwargs: original(
        transport=httpx.MockTransport(handler), **kwargs,
    ))


def test_catalog_projection_visibility_order_and_unknown_capabilities():
    parsed = codex_models.parse_catalog({"models": [
        entry("second", priority=2), entry("first", priority=0, context_window=123456),
        entry("hidden", visibility="hide"), entry("internal", visibility="none"),
    ]})
    assert [model.id for model in parsed] == ["first", "second"]
    assert parsed[0].context_window == 123456
    assert parsed[0].supported_reasoning_levels == ("low", "ultra")
    assert parsed[1].parallel_tool_calls is None
    assert codex_models.capability_overrides(parsed[0]) == {
        "chatgpt:first": {"reasoning": True, "reasoning_levels": ["low"]},
    }


def test_catalog_never_exposes_instructions_identity_or_invents_limits():
    model = codex_models.parse_catalog({"models": [entry(
        instructions="private upstream instructions", account_id="private-account",
        max_output_tokens=100, tool_call=True, supports_json_schema=True,
    )]})[0]
    data = model.model_dump()
    for key in ["instructions", "account_id", "max_output_tokens", "tool_call", "supports_json_schema"]:
        assert key not in data


def test_empty_catalog_is_valid():
    assert codex_models.parse_catalog({"models": []}) == ()


def test_equal_priorities_have_stable_exact_id_order():
    models = codex_models.parse_catalog({"models": [
        entry("z-future", priority=4), entry("a-future", priority=4),
    ]})
    assert [model.id for model in models] == ["a-future", "z-future"]


def test_experimental_maximum_does_not_become_effective_context():
    model = codex_models.parse_catalog({"models": [entry(max_context_window=872000)]})[0]
    assert model.context_window is None


def test_transport_has_separate_connect_timeout_and_never_follows_redirects(monkeypatch):
    real_client = httpx.Client
    captured = {}

    def create_client(**kwargs):
        captured.update(kwargs)
        return real_client(
            transport=httpx.MockTransport(lambda _: httpx.Response(200, json={"models": []})),
            **kwargs,
        )

    monkeypatch.setattr(codex_models.httpx, "Client", create_client)
    assert codex_models.fetch_catalog("test-access", None) == ()
    assert captured["timeout"].connect == 5.0
    assert captured["timeout"].read == 15.0
    assert captured["follow_redirects"] is False


@pytest.mark.parametrize("payload", [{}, {"models": {}}, {"models": [None]}, {"models": [entry(slug="")]}])
def test_malformed_catalog_is_controlled(payload):
    with pytest.raises(HTTPException) as error:
        codex_models.parse_catalog(payload)
    assert error.value.status_code == 502


def test_fixed_endpoint_auth_headers_and_no_catalog_cache(monkeypatch):
    calls = []
    def handler(request):
        calls.append(request)
        assert request.url.host == "chatgpt.com"
        assert request.url.path == "/backend-api/codex/models"
        assert request.url.params["client_version"] == "0.169.0"
        assert request.headers["Authorization"] == "Bearer test-access"
        assert request.headers["ChatGPT-Account-ID"] == "test-account"
        assert request.headers["User-Agent"] == "Presenton"
        assert "originator" not in request.headers
        return httpx.Response(200, json={"models": [entry()]}, headers={"Cache-Control": "private, no-store"})
    transport(monkeypatch, handler)
    for _ in range(2):
        assert codex_models.fetch_catalog("test-access", "test-account")[0].id == "new-account-model"
    assert len(calls) == 2


@pytest.mark.parametrize("status, expected", [(302, 502), (401, 401), (403, 401), (429, 503), (500, 502)])
def test_errors_do_not_leak_provider_bodies(monkeypatch, status, expected):
    transport(monkeypatch, lambda request: httpx.Response(status, text="secret upstream body"))
    with pytest.raises(HTTPException) as error:
        codex_models.fetch_catalog("test-access", None)
    assert error.value.status_code == expected
    assert "secret" not in error.value.detail


def test_exact_model_and_effort_validation():
    models = codex_models.parse_catalog({"models": [entry()]})
    assert codex_models.validate_model(models, "new-account-model", {}).id == "new-account-model"
    for model, config in [("removed-model", {}), ("new-account-model", {"LLM_REASONING_EFFORT": "ultra"}), ("new-account-model", {"LLM_REASONING_EFFORT": "max"})]:
        with pytest.raises(HTTPException) as error:
            codex_models.validate_model(models, model, config)
        assert error.value.status_code == 400
