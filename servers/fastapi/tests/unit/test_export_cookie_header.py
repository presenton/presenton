from starlette.requests import Request

from api.v1.ppt.endpoints.presentation import _build_export_cookie_header
from api.v1.auth.config import SESSION_COOKIE_NAME


def _request(*, headers: dict[str, str]) -> Request:
    request = Request(
        {
            "type": "http",
            "method": "POST",
            "path": "/api/v1/ppt/generate",
            "headers": [
                (name.lower().encode(), value.encode())
                for name, value in headers.items()
            ],
        }
    )
    return request


def test_internal_session_token_wins_over_mcp_bearer_token():
    request = _request(
        headers={"Authorization": "Bearer sk-presenton-api-key"}
    )
    request.state.internal_session_token = "middleware-generated-jwt"

    assert _build_export_cookie_header(request) == (
        f"{SESSION_COOKIE_NAME}=middleware-generated-jwt"
    )


def test_browser_cookie_wins_over_internal_and_bearer_tokens():
    cookie_header = f"{SESSION_COOKIE_NAME}=browser-jwt; theme=dark"
    request = _request(
        headers={
            "Cookie": cookie_header,
            "Authorization": "Bearer sk-presenton-api-key",
        }
    )
    request.state.internal_session_token = "middleware-generated-jwt"

    assert _build_export_cookie_header(request) == cookie_header
