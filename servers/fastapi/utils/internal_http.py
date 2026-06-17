from utils.simple_auth import (
    SESSION_COOKIE_NAME,
    create_session_token,
    get_configured_auth_username,
    get_internal_auth_headers,
)


def internal_request_headers() -> dict[str, str]:
    """Headers for trusted loopback calls between FastAPI and Next.js."""
    headers = dict(get_internal_auth_headers())
    username = get_configured_auth_username()
    if username and "Cookie" not in headers:
        token = create_session_token(username)
        headers["Cookie"] = f"{SESSION_COOKIE_NAME}={token}"
    return headers
