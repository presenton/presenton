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
import asyncio
import uuid
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from utils.oauth.openai_codex import (
    CodexAccountProfile,
    OAuthCallbackServer,
    TokenFailure,
    TokenSuccess,
    create_authorization_flow,
    exchange_authorization_code,
    get_account_profile,
    parse_authorization_input,
)
from services import codex_credentials

CODEX_AUTH_ROUTER = APIRouter(prefix="/codex/auth", tags=["Codex OAuth"])
CHATGPT_AUTH_REQUIRED_HEADERS = {"X-Presenton-Auth-Action": "codex-reauth"}
CHATGPT_AUTH_REQUIRED_PREFIX = "CHATGPT_AUTH_REQUIRED:"

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


def _store_token(result: TokenSuccess, *, expected=None) -> CodexAccountProfile:
    _, profile = codex_credentials.store_token(result, expected=expected)
    return profile


async def _exchange_session_code(
    session_id: str, session: dict, code: str,
) -> CodexAccountProfile | TokenFailure:
    """Own exchange, persistence and cleanup even if the HTTP caller leaves."""
    try:
        result = await asyncio.to_thread(
            exchange_authorization_code, code, session["verifier"],
        )
        if not isinstance(result, TokenSuccess):
            return result
        return await asyncio.to_thread(
            _store_token, result, expected=session["credentials"],
        )
    finally:
        try:
            await asyncio.to_thread(session["server"].close)
        finally:
            if _sessions.get(session_id) is session:
                _sessions.pop(session_id, None)


def _observe_exchange_result(task: asyncio.Task) -> None:
    # Shielded work may outlive every HTTP waiter. Retrieve a detached failure
    # without logging credentials; active waiters still receive the exception.
    if not task.cancelled():
        task.exception()


def _start_session_exchange(session_id: str, session: dict, code: str) -> asyncio.Task:
    # No await between checking and claiming this process-local session.
    task = session.get("exchange_task")
    if task is None:
        task = asyncio.create_task(_exchange_session_code(session_id, session, code))
        session["exchange_task"] = task
        task.add_done_callback(_observe_exchange_result)
    return task


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
    credentials = await asyncio.to_thread(codex_credentials.current_credentials)
    flow = create_authorization_flow()
    server = OAuthCallbackServer(state=flow.state)
    server_started = await asyncio.to_thread(server.start)

    session_id = str(uuid.uuid4())
    _sessions[session_id] = {
        "credentials": credentials,
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

    task = session.get("exchange_task")
    if task is None:
        server: OAuthCallbackServer = session["server"]
        code = server.get_code_nowait() if session.get("server_started") else None
        if code is None:
            return StatusResponse(status="pending")
        task = _start_session_exchange(session_id, session, code)

    result = await asyncio.shield(task)
    if isinstance(result, TokenFailure):
        return StatusResponse(status="failed", detail=result.reason)

    profile = result
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
    if session.get("exchange_task") is not None:
        raise HTTPException(status_code=409, detail="ChatGPT sign-in is already being completed. Wait for it to finish.")

    parsed = parse_authorization_input(body.code)
    code = parsed.get("code")
    incoming_state = parsed.get("state")

    if not code:
        raise HTTPException(status_code=400, detail="Could not extract authorization code from input")

    if incoming_state and incoming_state != session["state"]:
        raise HTTPException(status_code=400, detail="State mismatch — possible CSRF")

    result = await asyncio.shield(_start_session_exchange(body.session_id, session, code))
    if isinstance(result, TokenFailure):
        raise HTTPException(status_code=502, detail=f"Token exchange failed: {result.reason}")

    profile = result
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
    snapshot = await asyncio.to_thread(codex_credentials.refresh_credentials, force=True)
    profile = get_account_profile(snapshot.access_token)
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

    snapshot = await asyncio.to_thread(codex_credentials.current_credentials)
    access_token = snapshot.access_token
    if not access_token:
        return StatusResponse(status="not_authenticated", detail="No access token stored")

    expires_str = snapshot.expires
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
        username=profile.username or snapshot.config.get("CODEX_USERNAME"),
        email=profile.email or snapshot.config.get("CODEX_EMAIL"),
        is_pro=(
            profile.is_pro
            if profile.is_pro is not None
            else _parse_optional_bool(str(snapshot.config.get("CODEX_IS_PRO", "")))
        ),
    )


@CODEX_AUTH_ROUTER.post("/logout")
async def logout_codex():
    """
    Clear all stored Codex OAuth credentials from environment variables and userConfig.json.
    """
    await asyncio.to_thread(codex_credentials.logout)
    return {"detail": "Logged out successfully"}
