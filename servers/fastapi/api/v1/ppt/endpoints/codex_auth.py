"""
OpenAI Codex OAuth endpoints.

Flow:
  1. POST /codex/auth/initiate  — start the flow, get back an auth URL + session_id
  2. Browser opens the URL, user authenticates with OpenAI
  3. OpenAI redirects to http://localhost:1455/auth/callback (captured by local server)
  4. GET  /codex/auth/status/{session_id}  — poll until code captured; exchanges and stores tokens
  5. POST /codex/auth/exchange  — manual fallback if browser callback didn't fire
  6. POST /codex/auth/refresh   — refresh a stored token
"""
import uuid
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from utils.oauth.openai_codex import (
    CodexAccountProfile,
    OAuthCallbackServer,
    TokenSuccess,
    create_authorization_flow,
    exchange_authorization_code,
    get_account_profile,
    parse_authorization_input,
    refresh_access_token,
)
from utils.get_env import (
    get_codex_access_token_env,
    get_codex_email_env,
    get_codex_is_pro_env,
    get_codex_refresh_token_env,
    get_codex_token_expires_env,
    get_codex_username_env,
)
from utils.set_env import (
    set_codex_access_token_env,
    set_codex_account_id_env,
    set_codex_email_env,
    set_codex_is_pro_env,
    set_codex_refresh_token_env,
    set_codex_token_expires_env,
    set_codex_model_env,
    set_codex_username_env,
)
from utils.user_config import save_codex_tokens_to_user_config

CODEX_AUTH_ROUTER = APIRouter(prefix="/codex/auth", tags=["Codex OAuth"])

# ---------------------------------------------------------------------------
# In-memory session store  {session_id: {"verifier": str, "state": str, "server": OAuthCallbackServer}}
# Sessions are short-lived; garbage-collected when consumed.
# ---------------------------------------------------------------------------
_sessions: dict[str, dict] = {}


# ---------------------------------------------------------------------------
# Request / Response models
# ---------------------------------------------------------------------------

class InitiateResponse(BaseModel):
    session_id: str
    url: str
    instructions: str


class StatusResponse(BaseModel):
    status: str  # "pending" | "success" | "failed"
    account_id: Optional[str] = None
    username: Optional[str] = None
    email: Optional[str] = None
    is_pro: Optional[bool] = None
    detail: Optional[str] = None


class ExchangeRequest(BaseModel):
    session_id: str
    code: str  # raw code OR full redirect URL OR code#state shorthand


class ExchangeResponse(BaseModel):
    account_id: Optional[str] = None
    username: Optional[str] = None
    email: Optional[str] = None
    is_pro: Optional[bool] = None


class RefreshResponse(BaseModel):
    account_id: Optional[str]
    username: Optional[str] = None
    email: Optional[str] = None
    is_pro: Optional[bool] = None
    detail: str


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------

def _parse_optional_bool(value: Optional[str]) -> Optional[bool]:
    if value is None:
        return None
    normalized = value.strip().lower()
    if normalized in {"true", "1", "yes", "y"}:
        return True
    if normalized in {"false", "0", "no", "n"}:
        return False
    return None


def _store_token(result: TokenSuccess) -> CodexAccountProfile:
    """Persist token fields in env vars and userConfig.json. Returns parsed profile."""
    set_codex_access_token_env(result.access)
    set_codex_refresh_token_env(result.refresh)
    set_codex_token_expires_env(str(result.expires))

    profile = get_account_profile(result.access, result.id_token)
    set_codex_account_id_env(profile.account_id or "")
    set_codex_username_env(profile.username or "")
    set_codex_email_env(profile.email or "")
    set_codex_is_pro_env("" if profile.is_pro is None else str(profile.is_pro))

    save_codex_tokens_to_user_config()
    return profile


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@CODEX_AUTH_ROUTER.post("/initiate", response_model=InitiateResponse)
async def initiate_codex_auth():
    """
    Start the OpenAI Codex OAuth flow.

    Returns an authorization URL to open in the browser and a session_id to use
    when polling /status or calling /exchange.  A local HTTP server is started
    on port 1455 to receive the redirect automatically.
    """
    flow = create_authorization_flow()
    server = OAuthCallbackServer(state=flow.state)
    server_started = server.start()

    session_id = str(uuid.uuid4())
    _sessions[session_id] = {
        "verifier": flow.verifier,
        "state": flow.state,
        "server": server,
        "server_started": server_started,
    }

    instructions = (
        "Open the URL in your browser and complete the OpenAI login. "
        + (
            "The callback will be captured automatically."
            if server_started
            else "Port 1455 could not be bound — paste the redirect URL or code into /exchange."
        )
    )

    return InitiateResponse(
        session_id=session_id,
        url=flow.url,
        instructions=instructions,
    )


@CODEX_AUTH_ROUTER.get("/status/{session_id}", response_model=StatusResponse)
async def poll_codex_auth_status(session_id: str):
    """
    Poll for the result of an ongoing OAuth flow.

    Returns {"status": "pending"} until the callback server captures the code.
    On success the tokens are stored in environment variables and the session
    is cleaned up.
    """
    session = _sessions.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found or already consumed")

    server: OAuthCallbackServer = session["server"]

    # Non-blocking peek — check whether the callback server already received a code
    code = server.get_code_nowait() if session.get("server_started") else None

    if code is None:
        return StatusResponse(status="pending")

    # We have a code — exchange it
    verifier: str = session["verifier"]
    result = exchange_authorization_code(code, verifier)

    # Clean up session
    server.close()
    _sessions.pop(session_id, None)

    if not isinstance(result, TokenSuccess):
        return StatusResponse(status="failed", detail=result.reason)

    profile = _store_token(result)
    return StatusResponse(
        status="success",
        account_id=profile.account_id,
        username=profile.username,
        email=profile.email,
        is_pro=profile.is_pro,
    )


@CODEX_AUTH_ROUTER.post("/exchange", response_model=ExchangeResponse)
async def exchange_codex_code(body: ExchangeRequest):
    """
    Manual code exchange fallback.

    Accepts the session_id from /initiate and either:
    - a bare authorization code
    - the full redirect URL  (http://localhost:1455/auth/callback?code=…&state=…)
    - the code#state shorthand

    Exchanges the code for tokens and stores them in environment variables.
    """
    session = _sessions.get(body.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found or already consumed")

    parsed = parse_authorization_input(body.code)
    code = parsed.get("code")
    incoming_state = parsed.get("state")

    if not code:
        raise HTTPException(status_code=400, detail="Could not extract authorization code from input")

    if incoming_state and incoming_state != session["state"]:
        raise HTTPException(status_code=400, detail="State mismatch — possible CSRF")

    verifier: str = session["verifier"]
    server: OAuthCallbackServer = session["server"]

    result = exchange_authorization_code(code, verifier)

    server.close()
    _sessions.pop(body.session_id, None)

    if not isinstance(result, TokenSuccess):
        raise HTTPException(status_code=502, detail=f"Token exchange failed: {result.reason}")

    profile = _store_token(result)
    if not profile.account_id:
        raise HTTPException(status_code=502, detail="Token exchanged but could not extract account ID")

    return ExchangeResponse(
        account_id=profile.account_id,
        username=profile.username,
        email=profile.email,
        is_pro=profile.is_pro,
    )


@CODEX_AUTH_ROUTER.post("/refresh", response_model=RefreshResponse)
async def refresh_codex_token():
    """
    Refresh the stored Codex OAuth access token using the refresh token.

    Updates environment variables with the new tokens.
    """
    refresh_token = get_codex_refresh_token_env()
    if not refresh_token:
        raise HTTPException(
            status_code=400,
            detail="No Codex refresh token stored. Please authenticate first via /initiate",
        )

    result = refresh_access_token(refresh_token)
    if not isinstance(result, TokenSuccess):
        raise HTTPException(status_code=502, detail=f"Token refresh failed: {result.reason}")

    profile = _store_token(result)
    return RefreshResponse(
        account_id=profile.account_id,
        username=profile.username,
        email=profile.email,
        is_pro=profile.is_pro,
        detail="Token refreshed successfully",
    )


@CODEX_AUTH_ROUTER.get("/status", response_model=StatusResponse)
async def get_codex_auth_status():
    """
    Return whether a valid Codex OAuth token is currently stored.
    """
    import time

    access_token = get_codex_access_token_env()
    if not access_token:
        return StatusResponse(status="not_authenticated", detail="No access token stored")

    expires_str = get_codex_token_expires_env()
    if expires_str:
        try:
            expires_ms = int(expires_str)
            now_ms = int(time.time() * 1000)
            if now_ms >= expires_ms:
                return StatusResponse(status="expired", detail="Access token has expired — call /refresh")
        except (ValueError, TypeError):
            pass

    profile = get_account_profile(access_token)
    return StatusResponse(
        status="authenticated",
        account_id=profile.account_id,
        username=profile.username or get_codex_username_env(),
        email=profile.email or get_codex_email_env(),
        is_pro=(
            profile.is_pro
            if profile.is_pro is not None
            else _parse_optional_bool(get_codex_is_pro_env())
        ),
    )


@CODEX_AUTH_ROUTER.post("/logout")
async def logout_codex():
    """
    Clear all stored Codex OAuth credentials from environment variables and userConfig.json.
    """
    set_codex_access_token_env("")
    set_codex_refresh_token_env("")
    set_codex_token_expires_env("")
    set_codex_account_id_env("")
    set_codex_username_env("")
    set_codex_email_env("")
    set_codex_is_pro_env("")
    set_codex_model_env("")
    save_codex_tokens_to_user_config()
    return {"detail": "Logged out successfully"}
