import asyncio
from types import SimpleNamespace
import uuid

import httpx
import pytest

import mcp_server
from models.sql.user import User


def test_is_mcp_server_enabled_in_server_deployments(monkeypatch):
    monkeypatch.setattr(mcp_server, "is_presenton_electron_desktop", lambda: False)

    assert mcp_server.is_mcp_server_enabled() is True


def test_is_mcp_server_disabled_in_electron_desktop(monkeypatch):
    monkeypatch.setattr(mcp_server, "is_presenton_electron_desktop", lambda: True)

    assert mcp_server.is_mcp_server_enabled() is False


def test_create_mcp_auth_provider_disabled_when_auth_is_disabled(monkeypatch):
    monkeypatch.setattr(mcp_server, "is_disable_auth_enabled", lambda: True)

    assert mcp_server.create_mcp_auth_provider() is None


def test_create_mcp_auth_provider_enabled_for_server_auth(monkeypatch):
    monkeypatch.setattr(mcp_server, "is_disable_auth_enabled", lambda: False)

    provider = mcp_server.create_mcp_auth_provider()
    assert isinstance(provider, mcp_server.PresentonTokenVerifier)


def _mock_api_key_verifier(monkeypatch, token: str | None):
    user_id = uuid.uuid4()
    user = User(
        id=user_id,
        username="normal-user",
        hashed_password="unused",
        is_active=True,
        is_superuser=False,
        is_verified=True,
    )
    async def verify_api_key(_session, supplied_token):
        if token and supplied_token == token:
            return SimpleNamespace(api_key_id="0123456789abcdef", user=user)
        return None

    monkeypatch.setattr(mcp_server, "verify_api_key", verify_api_key)

    class SessionContext:
        async def __aenter__(self):
            return object()

        async def __aexit__(self, *_args):
            return None

    monkeypatch.setattr(mcp_server, "async_session_maker", SessionContext)
    return user


def test_presenton_token_verifier_accepts_normal_user_api_key(monkeypatch):
    token = "sk-presenton-0123456789abcdef." + "s" * 40
    user = _mock_api_key_verifier(monkeypatch, token)
    verifier = mcp_server.PresentonTokenVerifier()

    access_token = asyncio.run(verifier.verify_token(token))

    assert access_token is not None
    assert access_token.token == token
    assert access_token.client_id == str(user.id)
    assert access_token.claims["u"] == "normal-user"
    assert access_token.claims["role"] == "user"
    assert access_token.claims["api_key_id"] == "0123456789abcdef"


def test_presenton_token_verifier_uses_generation_length_internal_session(monkeypatch):
    token = "sk-presenton-0123456789abcdef." + "s" * 40
    _mock_api_key_verifier(monkeypatch, token)
    captured = {}

    class Strategy:
        async def write_token(self, _user):
            return "internal-session"

    def strategy(*, lifetime_seconds):
        captured["lifetime_seconds"] = lifetime_seconds
        return Strategy()

    monkeypatch.setattr(mcp_server, "get_jwt_strategy", strategy)

    access_token = asyncio.run(mcp_server.PresentonTokenVerifier().verify_token(token))

    assert access_token is not None
    assert access_token.claims["internal_session_token"] == "internal-session"
    assert captured["lifetime_seconds"] == 60 * 60


def test_presenton_token_verifier_rejects_invalid_token(monkeypatch):
    _mock_api_key_verifier(monkeypatch, None)
    verifier = mcp_server.PresentonTokenVerifier()

    access_token = asyncio.run(
        verifier.verify_token("sk-presenton-invalid-token")
    )

    assert access_token is None


def test_attach_request_auth_header_uses_authenticated_mcp_token(monkeypatch):
    monkeypatch.setattr(mcp_server, "get_http_headers", lambda include=None: {})
    monkeypatch.setattr(
        mcp_server,
        "get_access_token",
        lambda: SimpleNamespace(token="session-abc"),
    )
    request = httpx.Request("POST", "http://127.0.0.1:8000/api/v1/example")

    asyncio.run(mcp_server.attach_request_auth_header(request))

    assert request.headers["Authorization"] == "Bearer session-abc"


def test_attach_request_auth_header_uses_internal_session_without_forwarding_key(
    monkeypatch,
):
    monkeypatch.setattr(mcp_server, "get_http_headers", lambda include=None: {})
    monkeypatch.setattr(
        mcp_server,
        "get_access_token",
        lambda: SimpleNamespace(
            token="sk-presenton-0123456789abcdef." + "s" * 40,
            claims={
                "user_id": str(uuid.uuid4()),
                "internal_session_token": "short-lived-session",
            },
        ),
    )
    request = httpx.Request("POST", "http://127.0.0.1:8000/api/v1/example")

    asyncio.run(mcp_server.attach_request_auth_header(request))

    assert "Authorization" not in request.headers
    assert "short-lived-session" in request.headers["Cookie"]
    assert "sk-presenton" not in request.headers["Cookie"]


def test_attach_request_auth_header_keeps_existing_auth_header(monkeypatch):
    monkeypatch.setattr(mcp_server, "get_http_headers", lambda include=None: {})
    monkeypatch.setattr(
        mcp_server,
        "get_access_token",
        lambda: SimpleNamespace(token="session-abc"),
    )
    request = httpx.Request(
        "POST",
        "http://127.0.0.1:8000/api/v1/example",
        headers={"Authorization": "Bearer existing"},
    )

    asyncio.run(mcp_server.attach_request_auth_header(request))

    assert request.headers["Authorization"] == "Bearer existing"


def test_attach_request_auth_header_skips_when_no_mcp_access_token(monkeypatch):
    monkeypatch.setattr(mcp_server, "get_access_token", lambda: None)
    monkeypatch.setattr(mcp_server, "get_http_headers", lambda include=None: {})
    request = httpx.Request("POST", "http://127.0.0.1:8000/api/v1/example")

    asyncio.run(mcp_server.attach_request_auth_header(request))

    assert "Authorization" not in request.headers


def test_attach_request_auth_header_forwards_incoming_authorization_header(monkeypatch):
    monkeypatch.setattr(mcp_server, "get_access_token", lambda: None)
    monkeypatch.setattr(
        mcp_server,
        "get_http_headers",
        lambda include=None: {"authorization": "Basic YWRtaW46c2VjcmV0MTIz"},
    )
    request = httpx.Request("POST", "http://127.0.0.1:8000/api/v1/example")

    asyncio.run(mcp_server.attach_request_auth_header(request))

    assert request.headers["Authorization"].startswith("Basic ")


def test_attach_request_auth_header_forwards_public_origin(monkeypatch):
    monkeypatch.setattr(mcp_server, "get_access_token", lambda: None)
    monkeypatch.setattr(
        mcp_server,
        "get_http_headers",
        lambda include=None: {
            "host": "internal.example",
            "x-forwarded-host": "presenton.example.com",
            "x-forwarded-proto": "https",
        },
    )
    request = httpx.Request("GET", "http://127.0.0.1:8000/api/v1/ppt/template/all")

    asyncio.run(mcp_server.attach_request_auth_header(request))

    assert request.headers["X-Forwarded-Host"] == "presenton.example.com"
    assert request.headers["X-Forwarded-Proto"] == "https"
    assert request.headers["X-Presenton-MCP-Request"] == "1"


def test_get_mcp_api_timeout_supports_long_running_requests():
    timeout = mcp_server.get_mcp_api_timeout()

    assert timeout.read >= 300
    assert timeout.write >= 300
    assert timeout.pool >= 300
    assert timeout.connect == mcp_server.MCP_API_CONNECT_TIMEOUT_SECONDS


def test_mcp_origin_allowlist_includes_loopback_and_configured_public_origin(
    monkeypatch,
):
    monkeypatch.setenv(
        "PRESENTON_PUBLIC_URL",
        "https://slides.example.com/presenton/",
    )

    origins = mcp_server.get_mcp_allowed_origins()

    assert "http://localhost:*" in origins
    assert "http://127.0.0.1:*" in origins
    assert "https://slides.example.com" in origins
    assert "https://slides.example.com/presenton" not in origins
    assert mcp_server.MCP_ALLOWED_HOSTS == ["localhost", "127.0.0.1", "::1"]


def test_mcp_origin_allowlist_omits_unconfigured_public_origin(monkeypatch):
    monkeypatch.delenv("PRESENTON_PUBLIC_URL", raising=False)

    origins = mcp_server.get_mcp_allowed_origins()

    assert origins == mcp_server.MCP_LOCAL_ALLOWED_ORIGINS


def test_mcp_standard_instructions_define_unambiguous_workflows():
    instructions = mcp_server.get_mcp_instructions("standard")

    assert "# Hard rules" in instructions
    assert "# Reference file upload" in instructions
    assert "# Custom template generation" in instructions
    assert "# Standard generation" in instructions
    assert "# Job polling and completion" in instructions
    assert "OpenWebUI UUID" in instructions
    assert "data-URI prefix" in instructions
    assert (
        "upload_files and upload_template_assets are different operations"
        in instructions
    )
    assert "Pass that exact file_paths array as the files field" in instructions
    assert "copied unchanged from upload_template_assets" in instructions
    assert "Never pass upload_files.file_paths as pptx_url" in instructions
    assert "Do not start a duplicate job" in instructions
    assert "While status is pending, wait 10-15 seconds" in instructions
    assert "error is terminal failure" in instructions
    assert "initialize_template" not in instructions
    assert "start_smart_presentation" not in instructions
    assert "generate_smart_presentation" not in instructions


def test_mcp_smart_instructions_only_name_smart_workflow():
    instructions = mcp_server.get_mcp_instructions("smart")

    assert "# Reference file upload" in instructions
    assert "# Smart generation" in instructions
    assert "start_smart_presentation" in instructions
    assert "get_job_status" in instructions
    assert "start_standard_presentation" not in instructions
    assert "upload_template_assets" not in instructions
    assert "start_template_generation" not in instructions
    assert "list_templates" not in instructions
    assert "generate_smart_presentation" not in instructions


def test_mcp_upload_tools_publish_complete_input_and_output_schemas(monkeypatch):
    monkeypatch.setenv("PRESENTATION_GENERATION_MODE", "both")

    async def get_upload_tools():
        async with httpx.AsyncClient(base_url="http://127.0.0.1:8000") as client:
            server = mcp_server.create_mcp_server(client)
            return {
                tool.name: tool
                for tool in await server.list_tools()
                if tool.name in {"upload_files", "upload_template_assets"}
            }

    tools = asyncio.run(get_upload_tools())

    assert set(tools) == {"upload_files", "upload_template_assets"}
    for tool in tools.values():
        assert tool.parameters["type"] == "object"
        assert tool.parameters["required"]
        assert tool.output_schema["type"] == "object"
        assert tool.output_schema["required"]

    file_items = tools["upload_files"].parameters["properties"]["files"]["items"]
    assert file_items["required"] == ["filename", "content_base64"]
    assert tools["upload_files"].output_schema["required"] == ["file_paths"]

    template_input = tools["upload_template_assets"].parameters["properties"]["pptx"]
    assert template_input["required"] == ["filename", "content_base64"]
    assert tools["upload_template_assets"].output_schema["required"] == [
        "pptx_url",
        "slide_image_urls",
    ]


@pytest.mark.parametrize(
    ("generation_mode", "expected_tools"),
    [
        (
            "both",
            {
                "start_standard_presentation",
                "start_smart_presentation",
                "list_templates",
                "upload_template_assets",
                "start_template_generation",
                "upload_files",
                "get_job_status",
            },
        ),
        (
            "standard",
            {
                "start_standard_presentation",
                "list_templates",
                "upload_template_assets",
                "start_template_generation",
                "upload_files",
                "get_job_status",
            },
        ),
        (
            "smart",
            {
                "start_smart_presentation",
                "upload_files",
                "get_job_status",
            },
        ),
        (
            "invalid",
            {
                "start_standard_presentation",
                "start_smart_presentation",
                "list_templates",
                "upload_template_assets",
                "start_template_generation",
                "upload_files",
                "get_job_status",
            },
        ),
    ],
)
def test_mcp_tools_follow_presentation_generation_mode(
    monkeypatch, generation_mode, expected_tools
):
    monkeypatch.setenv("PRESENTATION_GENERATION_MODE", generation_mode)

    async def list_tool_names():
        async with httpx.AsyncClient(base_url="http://127.0.0.1:8000") as client:
            server = mcp_server.create_mcp_server(client)
            return {tool.name for tool in await server.list_tools()}

    assert asyncio.run(list_tool_names()) == expected_tools
