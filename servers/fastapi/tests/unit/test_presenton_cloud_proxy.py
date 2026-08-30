import asyncio
import json
import uuid
from datetime import timedelta
from types import SimpleNamespace

from starlette.requests import Request

from services import presenton_cloud_proxy
from utils.datetime_utils import get_current_utc_datetime


def _request(
    path: str,
    *,
    method: str = "POST",
    query: str = "",
    body: bytes = b"",
    headers: list[tuple[bytes, bytes]] | None = None,
) -> Request:
    sent = False

    async def receive():
        nonlocal sent
        if sent:
            return {"type": "http.disconnect"}
        sent = True
        return {"type": "http.request", "body": body, "more_body": False}

    return Request(
        {
            "type": "http",
            "http_version": "1.1",
            "method": method,
            "scheme": "http",
            "path": path,
            "raw_path": path.encode(),
            "query_string": query.encode(),
            "headers": headers or [],
            "client": ("127.0.0.1", 1234),
            "server": ("localhost", 5001),
        },
        receive,
    )


def test_proxy_path_selection_covers_standard_and_smart_generation_flows():
    proxied_paths = (
        "/api/v1/ppt/files/upload",
        "/api/v1/ppt/files/decompose",
        "/api/v1/ppt/presentation/create",
        "/api/v1/ppt/outlines/stream/presentation-id",
        "/api/v1/ppt/presentation/prepare",
        "/api/v1/ppt/presentation/stream/presentation-id",
        "/api/v1/ppt/template/all",
        "/api/v1/ppt/template/fonts-upload-and-slides-preview",
        "/api/v1/ppt/template/async",
        "/api/v1/ppt/template/layouts/create",
        "/api/v1/ppt/template/generate-blocks",
        "/api/v1/async-tasks",
        "/api/v1/ppt/community/presentations",
        "/api/v1/ppt/slide/edit",
        "/api/v1/ppt/presentation/update",
        "/api/v1/ppt/presentation/slide_update",
        "/api/v1/ppt/chat/message/stream",
        "/api/v2/ppt/presentation/generate-html/init",
        "/api/v2/ppt/presentation/stream/presentation-id",
        "/api/v2/ppt/presentation/update",
        "/app_data/images/users/00000000-0000-0000-0000-000000000001/generated.png",
        "/app_data/exports/users/00000000-0000-0000-0000-000000000001/generated.pptx",
    )
    for path in proxied_paths:
        assert presenton_cloud_proxy.should_proxy_presenton_cloud(path)

    assert not presenton_cloud_proxy.should_proxy_presenton_cloud(
        "/api/v1/ppt/codex/auth/status"
    )
    assert not presenton_cloud_proxy.should_proxy_presenton_cloud(
        "/api/v1/auth/presenton/status"
    )
    assert not presenton_cloud_proxy.should_proxy_presenton_cloud(
        "/api/v1/ppt/presentation/all"
    )
    assert not presenton_cloud_proxy.should_proxy_presenton_cloud(
        "/api/v1/ppt/presentation/presentation-id"
    )
    assert not presenton_cloud_proxy.should_proxy_presenton_cloud(
        "/api/v1/ppt/presentation/create/blank"
    )
    assert presenton_cloud_proxy.should_proxy_presenton_cloud(
        "/api/v1/ppt/outlines/presentation-id"
    )
    assert not presenton_cloud_proxy.should_proxy_presenton_cloud(
        "/api/v1/ppt/images/generate"
    )
    assert not presenton_cloud_proxy.should_proxy_presenton_cloud(
        "/app_data/templates/default/template.pptx"
    )
    assert not presenton_cloud_proxy.should_proxy_presenton_cloud(
        "/static/icons/regular/chart.png"
    )


def test_cloud_template_generation_supports_mutations_and_task_tracking():
    assert presenton_cloud_proxy._request_method_is_supported(
        "/api/v1/ppt/template/fonts-upload-and-slides-preview", "POST"
    )
    assert presenton_cloud_proxy._request_method_is_supported(
        "/api/v1/ppt/template/async", "POST"
    )
    assert presenton_cloud_proxy._request_method_is_supported(
        "/api/v1/ppt/template/template-id/layouts", "PATCH"
    )
    assert presenton_cloud_proxy._request_method_is_supported(
        "/api/v1/ppt/template/template-id", "DELETE"
    )
    assert not presenton_cloud_proxy._request_method_is_supported(
        "/api/v1/ppt/community/presentations", "POST"
    )


def test_cloud_template_task_list_is_forwarded_to_v3(monkeypatch):
    captured = {}
    provider = SimpleNamespace(
        subject=str(uuid.uuid4()),
        access_token_encrypted="encrypted-access",
        token_expires_at=get_current_utc_datetime() + timedelta(hours=1),
    )

    class FakeUpstream:
        status_code = 200
        headers = {"content-type": "application/json"}

        async def aiter_raw(self):
            yield b"[]"

        async def aclose(self):
            pass

    class FakeClient:
        async def aclose(self):
            pass

    async def get_settings(_session):
        return {"LLM": "presenton"}

    async def get_provider(_session, _issuer):
        return provider

    async def open_response(_session, **kwargs):
        captured.update(kwargs)
        return FakeClient(), FakeUpstream()

    monkeypatch.setattr(presenton_cloud_proxy, "get_provider_settings", get_settings)
    monkeypatch.setattr(presenton_cloud_proxy, "get_presenton_provider", get_provider)
    monkeypatch.setattr(
        presenton_cloud_proxy,
        "open_presenton_cloud_response",
        open_response,
    )

    async def exercise():
        response = await presenton_cloud_proxy.maybe_proxy_presenton_cloud_request(
            _request(
                "/api/v1/async-tasks",
                method="GET",
                query="type=template.create&status=pending",
            ),
            SimpleNamespace(),
            SimpleNamespace(id=uuid.uuid4()),
        )
        assert response is not None
        return b"".join([chunk async for chunk in response.body_iterator])

    assert asyncio.run(exercise()) == b"[]"
    assert captured["method"] == "GET"
    assert captured["path"] == "/api/v3/async-task"
    assert captured["query_string"] == "type=template.create&status=pending"


def test_complete_presentation_is_extracted_from_split_sse_frames():
    buffer = bytearray(
        b'event: response\ndata: {"type":"complete","presentation":{"id":"'
    )
    assert presenton_cloud_proxy._complete_presentations_from_sse(buffer) == []

    buffer.extend(
        b'00000000-0000-0000-0000-000000000001","slides":[]}}\n\n'
    )
    assert presenton_cloud_proxy._complete_presentations_from_sse(buffer) == [
        {
            "id": "00000000-0000-0000-0000-000000000001",
            "slides": [],
        }
    ]
    assert buffer == bytearray()


def test_cloud_private_assets_require_the_oauth_subject_namespace():
    cloud_user_id = uuid.uuid4()
    provider = SimpleNamespace(subject=str(cloud_user_id))

    assert presenton_cloud_proxy._cloud_asset_belongs_to_provider(
        f"/app_data/images/users/{cloud_user_id}/generated.png",
        provider,
    )
    assert not presenton_cloud_proxy._cloud_asset_belongs_to_provider(
        f"/app_data/images/users/{uuid.uuid4()}/generated.png",
        provider,
    )
    assert not presenton_cloud_proxy._cloud_asset_belongs_to_provider(
        "/app_data/images/generated.png",
        provider,
    )


def test_linked_request_is_forwarded_with_body_query_and_stream(monkeypatch):
    captured = {}
    provider = SimpleNamespace(
        subject=str(uuid.uuid4()),
        access_token_encrypted="encrypted-access",
        token_expires_at=get_current_utc_datetime() + timedelta(hours=1),
    )

    class FakeUpstream:
        def __init__(self):
            self.status_code = 200
            self.headers = {
                "content-type": "text/event-stream",
                "content-length": "999",
                "set-cookie": "cloud_session=secret",
                "x-cloud-request-id": "request-id",
            }
            self.closed = False

        async def aiter_raw(self):
            yield b'data: {"status":"running"}\n\n'
            yield b'data: {"status":"complete"}\n\n'

        async def aclose(self):
            self.closed = True

    class FakeClient:
        closed = False

        async def aclose(self):
            self.closed = True

    upstream = FakeUpstream()
    client = FakeClient()

    async def get_provider(_session, issuer):
        captured["provider_issuer"] = issuer
        return provider

    async def get_settings(_session):
        return {"LLM": "presenton"}

    async def open_response(_session, **kwargs):
        captured.update(kwargs)
        return client, upstream

    monkeypatch.setattr(presenton_cloud_proxy, "get_presenton_provider", get_provider)
    monkeypatch.setattr(presenton_cloud_proxy, "get_provider_settings", get_settings)
    monkeypatch.setattr(
        presenton_cloud_proxy,
        "open_presenton_cloud_response",
        open_response,
    )
    monkeypatch.setattr(
        presenton_cloud_proxy,
        "get_presenton_oauth_issuer",
        lambda: "https://api.presenton.test",
    )

    user_id = uuid.uuid4()
    presentation_id = uuid.uuid4()

    async def generation_mode(owner, requested_id):
        assert owner == user_id
        assert requested_id == presentation_id
        return "standard"

    monkeypatch.setattr(
        presenton_cloud_proxy,
        "get_local_presentation_generation_mode",
        generation_mode,
    )

    request = _request(
        f"/api/v1/ppt/presentation/stream/{presentation_id}",
        query="mode=smart",
        body=b'{"prompt":"Build a deck"}',
        headers=[
            (b"authorization", b"Bearer local-session"),
            (b"cookie", b"session=local-secret"),
            (b"host", b"localhost:5001"),
            (b"content-length", b"25"),
            (b"content-type", b"application/json"),
            (b"x-presenton-client", b"open-source"),
        ],
    )

    async def exercise():
        response = await presenton_cloud_proxy.maybe_proxy_presenton_cloud_request(
            request,
            SimpleNamespace(),
            SimpleNamespace(id=user_id),
        )
        assert response is not None
        chunks = [chunk async for chunk in response.body_iterator]
        return response, b"".join(chunks)

    response, body = asyncio.run(exercise())

    assert body == (
        b'data: {"status":"running"}\n\n'
        b'data: {"status":"complete"}\n\n'
    )
    assert captured["provider_issuer"] == "https://api.presenton.test"
    assert "user_id" not in captured
    assert captured["issuer"] == "https://api.presenton.test"
    assert captured["method"] == "POST"
    assert captured["path"] == f"/api/v1/ppt/presentation/stream/{presentation_id}"
    assert captured["query_string"] == "mode=smart"
    assert captured["content"] == b'{"prompt":"Build a deck"}'
    assert captured["headers"] == {
        "content-type": "application/json",
        "x-presenton-client": "open-source",
    }
    assert response.status_code == 200
    assert response.headers["content-type"] == "text/event-stream"
    assert response.headers["x-cloud-request-id"] == "request-id"
    assert "content-length" not in response.headers
    assert "set-cookie" not in response.headers
    assert upstream.closed is True
    assert client.closed is True


def test_cloud_create_is_saved_locally_before_response(monkeypatch):
    owner_id = uuid.uuid4()
    presentation_id = uuid.uuid4()
    captured = {}

    class FakeUpstream:
        status_code = 200
        headers = {"content-type": "application/json"}

        async def aread(self):
            return (
                b'{"presentation_id":"'
                + str(presentation_id).encode()
                + b'","fonts":{}}'
            )

        async def aclose(self):
            captured["upstream_closed"] = True

    class FakeClient:
        async def aclose(self):
            captured["client_closed"] = True

    async def get_settings(_session):
        return {"LLM": "presenton"}

    async def get_provider(_session, _issuer):
        return SimpleNamespace(
            subject=str(owner_id),
            access_token_encrypted="encrypted-access",
            token_expires_at=get_current_utc_datetime() + timedelta(hours=1),
        )

    async def open_response(_session, **_kwargs):
        return FakeClient(), FakeUpstream()

    async def persist(owner, request_payload, cloud_payload):
        captured["persisted"] = (owner, request_payload, cloud_payload)

    monkeypatch.setattr(presenton_cloud_proxy, "get_provider_settings", get_settings)
    monkeypatch.setattr(presenton_cloud_proxy, "get_presenton_provider", get_provider)
    monkeypatch.setattr(
        presenton_cloud_proxy,
        "open_presenton_cloud_response",
        open_response,
    )
    monkeypatch.setattr(
        presenton_cloud_proxy,
        "persist_cloud_presentation_created",
        persist,
    )

    response = asyncio.run(
        presenton_cloud_proxy.maybe_proxy_presenton_cloud_request(
            _request(
                "/api/v1/ppt/presentation/create",
                body=b'{"content":"Build a deck","n_slides":5,"generation_mode":"smart"}',
                headers=[(b"content-type", b"application/json")],
            ),
            SimpleNamespace(),
            SimpleNamespace(id=owner_id),
        )
    )

    assert response.status_code == 200
    assert captured["persisted"][0] == owner_id
    assert captured["persisted"][1]["generation_mode"] == "smart"
    assert captured["persisted"][2]["id"] == str(presentation_id)
    assert response.body
    assert captured["upstream_closed"] is True
    assert captured["client_closed"] is True


def test_auth_disabled_cloud_create_uses_unowned_desktop_rows(monkeypatch):
    presentation_id = uuid.uuid4()
    captured = {}

    class FakeUpstream:
        status_code = 200
        headers = {"content-type": "application/json"}

        async def aread(self):
            return json.dumps({"id": str(presentation_id)}).encode()

        async def aclose(self):
            pass

    class FakeClient:
        async def aclose(self):
            pass

    async def get_settings(_session):
        return {"LLM": "presenton"}

    async def get_provider(_session, _issuer):
        return SimpleNamespace(
            subject=str(uuid.uuid4()),
            access_token_encrypted="encrypted-access",
            token_expires_at=get_current_utc_datetime() + timedelta(hours=1),
        )

    async def open_response(_session, **_kwargs):
        return FakeClient(), FakeUpstream()

    async def persist(owner, request_payload, cloud_payload):
        captured["persisted"] = (owner, request_payload, cloud_payload)

    monkeypatch.setattr(presenton_cloud_proxy, "get_provider_settings", get_settings)
    monkeypatch.setattr(presenton_cloud_proxy, "get_presenton_provider", get_provider)
    monkeypatch.setattr(
        presenton_cloud_proxy, "open_presenton_cloud_response", open_response
    )
    monkeypatch.setattr(
        presenton_cloud_proxy, "persist_cloud_presentation_created", persist
    )

    response = asyncio.run(
        presenton_cloud_proxy.maybe_proxy_presenton_cloud_request(
            _request(
                "/api/v1/ppt/presentation/create",
                body=b'{"content":"Build a desktop deck","n_slides":3}',
                headers=[(b"content-type", b"application/json")],
            ),
            SimpleNamespace(),
            None,
            allow_unowned=True,
        )
    )

    assert response.status_code == 200
    assert captured["persisted"][0] is None
    assert captured["persisted"][1]["content"] == "Build a desktop deck"
    assert captured["persisted"][2]["id"] == str(presentation_id)


def test_smart_create_is_adapted_to_cloud_v2(monkeypatch):
    owner_id = uuid.uuid4()
    presentation_id = uuid.uuid4()
    opened = []

    class FakeUpstream:
        status_code = 200
        headers = {"content-type": "application/json"}

        async def aread(self):
            return json.dumps(
                {"presentation_id": str(presentation_id), "fonts": {}}
            ).encode()

        async def aclose(self):
            pass

    class FakeClient:
        async def aclose(self):
            pass

    async def get_settings(_session):
        return {"LLM": "presenton"}

    async def get_provider(_session, _issuer):
        return SimpleNamespace(
            subject=str(owner_id),
            access_token_encrypted="encrypted-access",
            token_expires_at=get_current_utc_datetime() + timedelta(hours=1),
        )

    async def open_response(_session, **kwargs):
        opened.append(kwargs)
        return FakeClient(), FakeUpstream()

    async def persist(*_args):
        pass

    monkeypatch.setattr(presenton_cloud_proxy, "get_provider_settings", get_settings)
    monkeypatch.setattr(presenton_cloud_proxy, "get_presenton_provider", get_provider)
    monkeypatch.setattr(
        presenton_cloud_proxy, "open_presenton_cloud_response", open_response
    )
    monkeypatch.setattr(
        presenton_cloud_proxy, "persist_cloud_presentation_created", persist
    )

    response = asyncio.run(
        presenton_cloud_proxy.maybe_proxy_presenton_cloud_request(
            _request(
                "/api/v1/ppt/presentation/create",
                body=json.dumps(
                    {
                        "content": "Build a deck",
                        "n_slides": 5,
                        "generation_mode": "smart",
                    }
                ).encode(),
                headers=[(b"content-type", b"application/json")],
            ),
            SimpleNamespace(),
            SimpleNamespace(id=owner_id),
        )
    )

    assert opened[0]["path"] == "/api/v2/ppt/presentation/generate-html/init"
    assert json.loads(response.body)["id"] == str(presentation_id)


def test_native_smart_create_keeps_cloud_v2_response(monkeypatch):
    owner_id = uuid.uuid4()
    presentation_id = uuid.uuid4()
    captured = {}

    class FakeUpstream:
        status_code = 200
        headers = {"content-type": "application/json"}

        async def aread(self):
            return json.dumps(
                {"presentation_id": str(presentation_id), "fonts": {}}
            ).encode()

        async def aclose(self):
            pass

    class FakeClient:
        async def aclose(self):
            pass

    async def get_settings(_session):
        return {"LLM": "presenton"}

    async def get_provider(_session, _issuer):
        return SimpleNamespace(
            subject=str(owner_id),
            access_token_encrypted="encrypted-access",
            token_expires_at=get_current_utc_datetime() + timedelta(hours=1),
        )

    async def open_response(_session, **kwargs):
        captured["upstream"] = kwargs
        return FakeClient(), FakeUpstream()

    async def persist(owner, request_payload, response_payload):
        captured["persisted"] = (owner, request_payload, response_payload)

    monkeypatch.setattr(presenton_cloud_proxy, "get_provider_settings", get_settings)
    monkeypatch.setattr(presenton_cloud_proxy, "get_presenton_provider", get_provider)
    monkeypatch.setattr(
        presenton_cloud_proxy, "open_presenton_cloud_response", open_response
    )
    monkeypatch.setattr(
        presenton_cloud_proxy, "persist_cloud_presentation_created", persist
    )

    response = asyncio.run(
        presenton_cloud_proxy.maybe_proxy_presenton_cloud_request(
            _request(
                "/api/v2/ppt/presentation/generate-html/init",
                body=json.dumps(
                    {
                        "content": "Build a deck",
                        "n_slides": 5,
                        "generation_mode": "smart",
                    }
                ).encode(),
                headers=[(b"content-type", b"application/json")],
            ),
            SimpleNamespace(),
            SimpleNamespace(id=owner_id),
        )
    )

    assert captured["upstream"]["path"] == (
        "/api/v2/ppt/presentation/generate-html/init"
    )
    assert captured["persisted"][0] == owner_id
    assert captured["persisted"][1]["generation_mode"] == "smart"
    assert captured["persisted"][2]["presentation_id"] == str(presentation_id)
    assert json.loads(response.body) == {
        "presentation_id": str(presentation_id),
        "fonts": {},
    }


def test_native_smart_stream_does_not_depend_on_local_mode(monkeypatch):
    presentation_id = uuid.uuid4()

    async def unexpected_local_lookup(*_args):
        raise AssertionError("native v2 stream should already be known as smart")

    monkeypatch.setattr(
        presenton_cloud_proxy,
        "get_local_presentation_generation_mode",
        unexpected_local_lookup,
    )

    resolved_id, mode = asyncio.run(
        presenton_cloud_proxy._resolve_presentation_context(
            owner_id=uuid.uuid4(),
            path=f"/api/v2/ppt/presentation/stream/{presentation_id}",
            query_string="",
            payload=None,
        )
    )

    assert resolved_id == presentation_id
    assert mode == "smart"


def test_cloud_chat_compatibility_path_maps_to_v3(monkeypatch):
    owner_id = uuid.uuid4()
    presentation_id = uuid.uuid4()
    captured = {}

    class FakeUpstream:
        status_code = 200
        headers = {"content-type": "application/json"}

        async def aread(self):
            return b"[]"

        async def aclose(self):
            pass

    class FakeClient:
        async def aclose(self):
            pass

    async def get_settings(_session):
        return {"LLM": "presenton"}

    async def get_provider(_session, _issuer):
        return SimpleNamespace(
            subject=str(owner_id),
            access_token_encrypted="encrypted-access",
            token_expires_at=get_current_utc_datetime() + timedelta(hours=1),
        )

    async def open_response(_session, **kwargs):
        captured.update(kwargs)
        return FakeClient(), FakeUpstream()

    async def generation_mode(_owner, _presentation):
        return "smart"

    monkeypatch.setattr(presenton_cloud_proxy, "get_provider_settings", get_settings)
    monkeypatch.setattr(presenton_cloud_proxy, "get_presenton_provider", get_provider)
    monkeypatch.setattr(
        presenton_cloud_proxy, "open_presenton_cloud_response", open_response
    )
    monkeypatch.setattr(
        presenton_cloud_proxy,
        "get_local_presentation_generation_mode",
        generation_mode,
    )

    response = asyncio.run(
        presenton_cloud_proxy.maybe_proxy_presenton_cloud_request(
            _request(
                "/api/v1/ppt/chat/conversations",
                method="GET",
                query=(
                    f"presentation_id={presentation_id}"
                    "&presentation_type=smart"
                ),
            ),
            SimpleNamespace(),
            SimpleNamespace(id=owner_id),
        )
    )

    assert response.status_code == 200
    assert captured["path"] == "/api/v3/chat/conversations"
    assert captured["query_string"].endswith("presentation_type=smart")


def test_selected_but_disconnected_provider_returns_clear_error(monkeypatch):
    async def get_settings(_session):
        return {"LLM": "presenton"}

    async def get_provider(_session, _issuer):
        return None

    async def unexpected_open(*_args, **_kwargs):
        raise AssertionError("Cloud request must not be opened for an unlinked user")

    monkeypatch.setattr(presenton_cloud_proxy, "get_presenton_provider", get_provider)
    monkeypatch.setattr(presenton_cloud_proxy, "get_provider_settings", get_settings)
    monkeypatch.setattr(
        presenton_cloud_proxy,
        "open_presenton_cloud_response",
        unexpected_open,
    )

    response = asyncio.run(
        presenton_cloud_proxy.maybe_proxy_presenton_cloud_request(
            _request("/api/v1/ppt/presentation/create"),
            SimpleNamespace(),
            SimpleNamespace(id=uuid.uuid4()),
        )
    )

    assert response.status_code == 503
    assert response.body == (
        b'{"detail":"Presenton is selected but the global provider is not connected"}'
    )


def test_connected_provider_stays_local_when_not_selected(monkeypatch):
    async def get_settings(_session):
        return {"LLM": "openai"}

    async def unexpected_provider(*_args, **_kwargs):
        raise AssertionError("Provider credentials must not be read when unselected")

    monkeypatch.setattr(presenton_cloud_proxy, "get_provider_settings", get_settings)
    monkeypatch.setattr(
        presenton_cloud_proxy,
        "get_presenton_provider",
        unexpected_provider,
    )

    response = asyncio.run(
        presenton_cloud_proxy.maybe_proxy_presenton_cloud_request(
            _request("/api/v1/ppt/presentation/create"),
            SimpleNamespace(),
            SimpleNamespace(id=uuid.uuid4()),
        )
    )

    assert response is None


def test_cloud_only_template_request_never_falls_back_to_local(monkeypatch):
    async def get_settings(_session):
        return {"LLM": "openai"}

    async def unexpected_provider(*_args, **_kwargs):
        raise AssertionError("Local templates must not satisfy a cloud-only request")

    monkeypatch.setattr(presenton_cloud_proxy, "get_provider_settings", get_settings)
    monkeypatch.setattr(
        presenton_cloud_proxy,
        "get_presenton_provider",
        unexpected_provider,
    )

    response = asyncio.run(
        presenton_cloud_proxy.maybe_proxy_presenton_cloud_request(
            _request(
                "/api/v1/ppt/template/all",
                method="GET",
                query="page_size=100&presenton_cloud_only=true",
            ),
            SimpleNamespace(),
            SimpleNamespace(id=uuid.uuid4()),
        )
    )

    assert response.status_code == 409
    assert b"Presenton cloud templates" in response.body
