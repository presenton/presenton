from fastapi import FastAPI
from fastapi.testclient import TestClient

from api.v1.auth.router import API_V1_AUTH_ROUTER
from utils.simple_auth import setup_initial_credentials, validate_session_token


def _build_client() -> TestClient:
    app = FastAPI()
    app.include_router(API_V1_AUTH_ROUTER)
    return TestClient(app)


def test_login_returns_bearer_access_token(monkeypatch, tmp_path):
    monkeypatch.setenv("USER_CONFIG_PATH", str(tmp_path / "userConfig.json"))
    monkeypatch.delenv("DISABLE_AUTH", raising=False)
    setup_initial_credentials("admin", "secret123")

    client = _build_client()
    response = client.post(
        "/api/v1/auth/login",
        json={"username": "admin", "password": "secret123"},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["configured"] is True
    assert payload["authenticated"] is True
    assert payload["username"] == "admin"
    assert payload["token_type"] == "bearer"
    assert isinstance(payload["access_token"], str)
    assert validate_session_token(payload["access_token"]) == "admin"
