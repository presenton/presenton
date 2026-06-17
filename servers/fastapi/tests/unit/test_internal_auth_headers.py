from utils.simple_auth import (
    get_internal_auth_headers,
    setup_initial_credentials,
    validate_session_token,
)


def test_internal_auth_headers_empty_when_auth_is_not_configured(monkeypatch, tmp_path):
    monkeypatch.setenv("USER_CONFIG_PATH", str(tmp_path / "userConfig.json"))
    monkeypatch.delenv("DISABLE_AUTH", raising=False)

    assert get_internal_auth_headers() == {}


def test_internal_auth_headers_empty_when_auth_is_disabled(monkeypatch, tmp_path):
    monkeypatch.setenv("USER_CONFIG_PATH", str(tmp_path / "userConfig.json"))
    monkeypatch.setenv("DISABLE_AUTH", "true")
    setup_initial_credentials("admin", "secret123")

    assert get_internal_auth_headers() == {}


def test_internal_auth_headers_include_valid_bearer_token(monkeypatch, tmp_path):
    monkeypatch.setenv("USER_CONFIG_PATH", str(tmp_path / "userConfig.json"))
    monkeypatch.delenv("DISABLE_AUTH", raising=False)
    setup_initial_credentials("admin", "secret123")

    headers = get_internal_auth_headers()

    assert headers["Authorization"].startswith("Bearer ")
    token = headers["Authorization"].removeprefix("Bearer ")
    assert validate_session_token(token) == "admin"
