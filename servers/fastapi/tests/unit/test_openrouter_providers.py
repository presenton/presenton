import asyncio

from api.v1.ppt.endpoints import openrouter


class FakeSession:
    async def __aenter__(self):
        return self

    async def __aexit__(self, _exc_type, _exc, _traceback):
        return None


def test_openrouter_provider_discovery_normalizes_model_endpoints(monkeypatch):
    monkeypatch.setattr(
        openrouter.aiohttp,
        "ClientSession",
        lambda **_kwargs: FakeSession(),
    )

    async def fake_get_json(_session, url):
        assert url.endswith("/models/openai/gpt-4o/endpoints")
        return 200, {
            "data": {
                "endpoints": [
                    {
                        "tag": "groq",
                        "provider_name": "Groq",
                        "status": "available",
                        "context_length": 131072,
                        "max_completion_tokens": 32768,
                        "supported_parameters": ["tools", "reasoning"],
                    }
                ]
            }
        }

    monkeypatch.setattr(openrouter, "_get_json", fake_get_json)

    result = asyncio.run(
        openrouter.get_available_openrouter_providers(
            model="openai/gpt-4o",
            api_key="key",
            base_url=None,
        )
    )

    assert result[0].value == "groq"
    assert result[0].label == "Groq"
    assert result[0].max_completion_tokens == 32768


def test_openrouter_provider_discovery_falls_back_to_global_list(monkeypatch):
    monkeypatch.setattr(
        openrouter.aiohttp,
        "ClientSession",
        lambda **_kwargs: FakeSession(),
    )
    responses = iter(
        [
            (404, {}),
            (200, {"data": [{"slug": "together", "name": "Together"}]}),
        ]
    )

    async def fake_get_json(_session, _url):
        return next(responses)

    monkeypatch.setattr(openrouter, "_get_json", fake_get_json)

    result = asyncio.run(
        openrouter.get_available_openrouter_providers(
            model="custom/alias",
            api_key="key",
            base_url="https://openrouter.ai/api/v1",
        )
    )

    assert [provider.value for provider in result] == ["together"]
