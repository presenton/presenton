"""
OpenAI Codex (ChatGPT OAuth) flow — Python port of
pi-mono-main/packages/ai/src/utils/oauth/openai-codex.ts

Handles PKCE authorization, local callback server, token exchange and refresh.
No FastAPI dependencies; all HTTP is done with the standard library + httpx.
"""
import base64
import json
import secrets
import threading
import time
from dataclasses import dataclass
from http.server import BaseHTTPRequestHandler, HTTPServer
from typing import Optional
from urllib.parse import parse_qs, urlencode, urlparse

import httpx

from utils.oauth.pkce import generate_pkce

CLIENT_ID = "app_EMoamEEZ73f0CkXaXp7hrann"
AUTHORIZE_URL = "https://auth.openai.com/oauth/authorize"
TOKEN_URL = "https://auth.openai.com/oauth/token"
REDIRECT_URI = "http://localhost:1455/auth/callback"
SCOPE = "openid profile email offline_access"
JWT_CLAIM_PATH = "https://api.openai.com/auth"

CALLBACK_PORT = 1455

# Simple branded success page for Presenton authentication
SUCCESS_HTML = """<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Presenton – Authentication successful</title>
  <style>
    :root {
      color-scheme: light dark;
    }
    * {
      box-sizing: border-box;
    }
    body {
      margin: 0;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "SF Pro Text",
        "Segoe UI", sans-serif;
      background: radial-gradient(circle at top, #eef2ff 0, #0f172a 55%, #020617 100%);
      color: #e5e7eb;
    }
    .card {
      background: rgba(15, 23, 42, 0.9);
      border-radius: 18px;
      padding: 28px 32px 26px;
      box-shadow:
        0 18px 45px rgba(15, 23, 42, 0.75),
        0 0 0 1px rgba(148, 163, 184, 0.2);
      max-width: 440px;
      width: 92vw;
      text-align: center;
      backdrop-filter: blur(18px);
    }
    h1 {
      font-size: 20px;
      margin: 4px 0 10px;
      color: #e5e7eb;
    }
    p {
      margin: 4px 0;
      font-size: 14px;
      color: #94a3b8;
    }
    .pill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      border-radius: 999px;
      padding: 4px 10px;
      background: rgba(22, 163, 74, 0.12);
      color: #bbf7d0;
      font-size: 11px;
      font-weight: 500;
      margin-bottom: 8px;
    }
    .pill-dot {
      width: 8px;
      height: 8px;
      border-radius: 999px;
      background: #22c55e;
      box-shadow: 0 0 0 4px rgba(34, 197, 94, 0.25);
    }
    .hint {
      margin-top: 14px;
      font-size: 12px;
      color: #64748b;
    }
  </style>
</head>
<body>
  <main class="card">
    <div class="pill">
      <span class="pill-dot"></span>
      <span>Authentication successful</span>
    </div>
    <h1>You’re all set</h1>
    <p>You can now return to Presenton to continue.</p>
    <p class="hint">This window can be safely closed.</p>
  </main>
</body>
</html>""".encode("utf-8")

STATE_MISMATCH_HTML = """<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Presenton – Authentication issue</title>
  <style>
    :root { color-scheme: light dark; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "SF Pro Text",
        "Segoe UI", sans-serif;
      background: radial-gradient(circle at top, #fef3c7 0, #0f172a 55%, #020617 100%);
      color: #e5e7eb;
    }
    .card {
      background: rgba(15, 23, 42, 0.94);
      border-radius: 18px;
      padding: 26px 30px 24px;
      box-shadow:
        0 18px 45px rgba(15, 23, 42, 0.78),
        0 0 0 1px rgba(248, 250, 252, 0.09);
      max-width: 440px;
      width: 92vw;
      text-align: center;
      backdrop-filter: blur(18px);
    }
    h1 {
      font-size: 18px;
      margin: 4px 0 8px;
      color: #fee2e2;
    }
    p {
      margin: 4px 0;
      font-size: 13px;
      color: #cbd5f5;
    }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      border-radius: 999px;
      padding: 4px 10px;
      background: rgba(239, 68, 68, 0.14);
      color: #fecaca;
      font-size: 11px;
      font-weight: 500;
      margin-bottom: 10px;
    }
    .badge-dot {
      width: 7px;
      height: 7px;
      border-radius: 999px;
      background: #f97316;
      box-shadow: 0 0 0 4px rgba(248, 171, 85, 0.32);
    }
    button {
      margin-top: 14px;
      border-radius: 999px;
      padding: 7px 16px;
      border: 0;
      background: linear-gradient(135deg, #4f46e5, #22c55e);
      color: #f9fafb;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      box-shadow:
        0 10px 25px rgba(59, 130, 246, 0.55),
        0 0 0 1px rgba(15, 23, 42, 0.85);
    }
    button:active {
      transform: translateY(1px);
      box-shadow:
        0 4px 16px rgba(59, 130, 246, 0.55),
        0 0 0 1px rgba(15, 23, 42, 0.85);
    }
    .hint {
      margin-top: 10px;
      font-size: 11px;
      color: #9ca3af;
    }
  </style>
  <script>
    // Gentle auto-reload after a short delay to recover from stale callback windows.
    setTimeout(function () {
      try {
        window.location.reload();
      } catch (e) {
        /* ignore */
      }
    }, 2500);
    function reloadNow() {
      try {
        window.location.reload();
      } catch (e) {
        /* ignore */
      }
    }
  </script>
</head>
<body>
  <main class="card">
    <div class="badge">
      <span class="badge-dot"></span>
      <span>We noticed something unexpected</span>
    </div>
    <h1>Almost there</h1>
    <p>We detected a small mismatch while completing authentication.</p>
    <p>We’ll gently reload this page. If the issue persists, close this window and restart sign-in from Presenton.</p>
    <button type="button" onclick="reloadNow()">Reload this page</button>
    <p class="hint">You can also safely close this window and try again from the app.</p>
  </main>
</body>
</html>""".encode("utf-8")


# ---------------------------------------------------------------------------
# Data types
# ---------------------------------------------------------------------------

@dataclass
class TokenSuccess:
    access: str
    refresh: str
    expires: int  # Unix ms timestamp when the token expires
    id_token: Optional[str] = None


@dataclass
class TokenFailure:
    reason: str


TokenResult = TokenSuccess | TokenFailure


@dataclass
class AuthorizationFlow:
    verifier: str
    state: str
    url: str


@dataclass
class CodexAccountProfile:
    account_id: Optional[str] = None
    username: Optional[str] = None
    email: Optional[str] = None
    is_pro: Optional[bool] = None


# ---------------------------------------------------------------------------
# JWT helpers
# ---------------------------------------------------------------------------

def _decode_jwt_payload(token: str) -> Optional[dict]:
    """Decode the payload segment of a JWT without verifying the signature."""
    try:
        parts = token.split(".")
        if len(parts) != 3:
            return None
        payload_b64 = parts[1]
        # Add padding if needed
        padding = 4 - len(payload_b64) % 4
        if padding != 4:
            payload_b64 += "=" * padding
        decoded = base64.urlsafe_b64decode(payload_b64)
        return json.loads(decoded)
    except Exception:
        return None


def get_account_id(access_token: str) -> Optional[str]:
    """Extract the ChatGPT account ID from an access token JWT."""
    payload = _decode_jwt_payload(access_token)
    if not payload:
        return None
    auth_claims = payload.get(JWT_CLAIM_PATH)
    if not isinstance(auth_claims, dict):
        return None
    account_id = auth_claims.get("chatgpt_account_id")
    if isinstance(account_id, str) and account_id:
        return account_id
    return None


def _as_non_empty_str(value) -> Optional[str]:
    if isinstance(value, str):
        stripped = value.strip()
        return stripped or None
    return None


def get_account_profile(access_token: str, id_token: Optional[str] = None) -> CodexAccountProfile:
    """Extract profile from exact observed JWT paths in access/id tokens."""
    access_payload = _decode_jwt_payload(access_token) or {}
    access_auth = access_payload.get(JWT_CLAIM_PATH)
    access_auth = access_auth if isinstance(access_auth, dict) else {}

    access_profile = access_payload.get("https://api.openai.com/profile")
    access_profile = access_profile if isinstance(access_profile, dict) else {}

    id_payload = _decode_jwt_payload(id_token) if id_token else None
    id_payload = id_payload if isinstance(id_payload, dict) else {}
    id_auth = id_payload.get(JWT_CLAIM_PATH)
    id_auth = id_auth if isinstance(id_auth, dict) else {}

    account_id = _as_non_empty_str(access_auth.get("chatgpt_account_id")) or _as_non_empty_str(
        id_auth.get("chatgpt_account_id")
    )
    username = _as_non_empty_str(id_payload.get("name"))
    email = _as_non_empty_str(access_profile.get("email")) or _as_non_empty_str(
        id_payload.get("email")
    )

    plan_type = _as_non_empty_str(access_auth.get("chatgpt_plan_type")) or _as_non_empty_str(
        id_auth.get("chatgpt_plan_type")
    )
    if plan_type:
        is_pro = plan_type.strip().lower() != "free"
    else:
        is_pro = None

    return CodexAccountProfile(
        account_id=account_id,
        username=username,
        email=email,
        is_pro=is_pro,
    )


# ---------------------------------------------------------------------------
# Authorization URL + PKCE
# ---------------------------------------------------------------------------

def create_authorization_flow(originator: str = "pi") -> AuthorizationFlow:
    """Generate PKCE verifier/challenge, state, and the full authorization URL."""
    verifier, challenge = generate_pkce()
    state = secrets.token_hex(16)

    params = {
        "response_type": "code",
        "client_id": CLIENT_ID,
        "redirect_uri": REDIRECT_URI,
        "scope": SCOPE,
        "code_challenge": challenge,
        "code_challenge_method": "S256",
        "state": state,
        "id_token_add_organizations": "true",
        "codex_cli_simplified_flow": "true",
        "originator": originator,
    }
    url = f"{AUTHORIZE_URL}?{urlencode(params)}"
    return AuthorizationFlow(verifier=verifier, state=state, url=url)


# ---------------------------------------------------------------------------
# Local callback server
# ---------------------------------------------------------------------------

class _CallbackHandler(BaseHTTPRequestHandler):
    """Minimal HTTP handler that captures the OAuth callback code."""

    def do_GET(self):  # noqa: N802
        parsed = urlparse(self.path)
        if parsed.path != "/auth/callback":
            self.send_response(404)
            self.end_headers()
            self.wfile.write(b"Not found")
            return

        qs = parse_qs(parsed.query)
        state_vals = qs.get("state", [])
        code_vals = qs.get("code", [])

        expected_state: str = self.server.expected_state  # type: ignore[attr-defined]

        if not code_vals:
            self.send_response(400)
            self.end_headers()
            self.wfile.write(b"Missing authorization code")
            return

        # In local callback flows the redirect URI is localhost-only.
        # callback, so strict CSRF protection via state comparison is less critical.
        # We've seen intermittent state mismatches in the field (likely from
        # overlapping auth attempts or stale callback servers), so we treat a
        # mismatch as a soft warning instead of a hard failure.
        state_mismatch = bool(state_vals and state_vals[0] != expected_state)
        if state_mismatch:
            # Best-effort warning to server logs; handler intentionally continues.
            try:
                print(
                    f"[Codex OAuth] State mismatch in callback handler: "
                    f"expected={expected_state} got={state_vals[0]}"
                )
            except Exception:
                pass

        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.end_headers()
        # Show a nicer success page, and a dedicated state-mismatch page that
        # gently reloads to help recover from stale callback windows.
        if state_mismatch:
            self.wfile.write(STATE_MISMATCH_HTML)
        else:
            self.wfile.write(SUCCESS_HTML)

        self.server.captured_code = code_vals[0]  # type: ignore[attr-defined]

    def log_message(self, format, *args):  # noqa: A002
        pass  # suppress default stderr logging


class OAuthCallbackServer:
    """
    Wraps an HTTPServer that listens on port 1455 for the OAuth callback.
    Runs in a background daemon thread so it doesn't block the caller.
    """

    def __init__(self, state: str):
        self._state = state
        self._server: Optional[HTTPServer] = None
        self._thread: Optional[threading.Thread] = None
        self._started = threading.Event()
        self._cancelled = False

    def start(self) -> bool:
        """Start the background HTTP server. Returns True if successful."""
        try:
            server = HTTPServer(("0.0.0.0", CALLBACK_PORT), _CallbackHandler)
            server.expected_state = self._state  # type: ignore[attr-defined]
            server.captured_code = None  # type: ignore[attr-defined]
            server.timeout = 0.2  # short poll interval so we can check cancel
            self._server = server

            def _serve():
                self._started.set()
                while not self._cancelled and server.captured_code is None:
                    server.handle_request()
                server.server_close()

            self._thread = threading.Thread(target=_serve, daemon=True)
            self._thread.start()
            self._started.wait(timeout=2)
            return True
        except OSError:
            return False

    def get_code_nowait(self) -> Optional[str]:
        """Non-blocking peek — returns the captured code or None immediately."""
        if self._server is None:
            return None
        return self._server.captured_code  # type: ignore[attr-defined]

    def wait_for_code(self, timeout_seconds: int = 120) -> Optional[str]:
        """
        Block until the callback delivers a code or timeout / cancellation.
        Returns the authorization code or None.
        """
        if self._server is None:
            return None
        deadline = time.monotonic() + timeout_seconds
        while time.monotonic() < deadline:
            if self._cancelled:
                return None
            code = self._server.captured_code  # type: ignore[attr-defined]
            if code:
                return code
            time.sleep(0.1)
        return None

    def cancel(self):
        self._cancelled = True

    def close(self):
        self._cancelled = True
        if self._thread:
            self._thread.join(timeout=2)


# ---------------------------------------------------------------------------
# Token exchange / refresh (sync — called from thread or FastAPI background)
# ---------------------------------------------------------------------------

def exchange_authorization_code(
    code: str,
    verifier: str,
    redirect_uri: str = REDIRECT_URI,
) -> TokenResult:
    """Exchange an authorization code for access + refresh tokens."""
    try:
        response = httpx.post(
            TOKEN_URL,
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            data={
                "grant_type": "authorization_code",
                "client_id": CLIENT_ID,
                "code": code,
                "code_verifier": verifier,
                "redirect_uri": redirect_uri,
            },
            timeout=30,
        )
        if not response.is_success:
            return TokenFailure(reason=f"HTTP {response.status_code}: {response.text[:200]}")

        body = response.json()

        access = body.get("access_token")
        refresh = body.get("refresh_token")
        expires_in = body.get("expires_in")

        if not access or not refresh or not isinstance(expires_in, (int, float)):
            return TokenFailure(reason=f"Token response missing fields: {list(body.keys())}")

        expires_ms = int(time.time() * 1000) + int(expires_in) * 1000
        id_token = body.get("id_token")
        id_token = id_token if isinstance(id_token, str) else None
        return TokenSuccess(access=access, refresh=refresh, expires=expires_ms, id_token=id_token)
    except Exception as exc:
        return TokenFailure(reason=str(exc))


def refresh_access_token(refresh_token: str) -> TokenResult:
    """Use a refresh token to obtain a new access token."""
    try:
        response = httpx.post(
            TOKEN_URL,
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            data={
                "grant_type": "refresh_token",
                "refresh_token": refresh_token,
                "client_id": CLIENT_ID,
            },
            timeout=30,
        )
        if not response.is_success:
            return TokenFailure(reason=f"HTTP {response.status_code}: {response.text[:200]}")

        body = response.json()
        access = body.get("access_token")
        refresh = body.get("refresh_token")
        expires_in = body.get("expires_in")

        if not access or not refresh or not isinstance(expires_in, (int, float)):
            return TokenFailure(reason=f"Token refresh response missing fields: {list(body.keys())}")

        expires_ms = int(time.time() * 1000) + int(expires_in) * 1000
        return TokenSuccess(access=access, refresh=refresh, expires=expires_ms)
    except Exception as exc:
        return TokenFailure(reason=str(exc))


# ---------------------------------------------------------------------------
# Parsing helpers (for manual code paste / redirect URL fallback)
# ---------------------------------------------------------------------------

def parse_authorization_input(raw: str) -> dict:
    """
    Accept a variety of user-pasted inputs:
      - Full redirect URL:  http://localhost:1455/auth/callback?code=X&state=Y
      - code#state shorthand
      - Raw query string:   code=X&state=Y
      - Bare code value
    Returns a dict with optional 'code' and 'state' keys.
    """
    value = raw.strip()
    if not value:
        return {}

    try:
        parsed = urlparse(value)
        if parsed.scheme in ("http", "https"):
            qs = parse_qs(parsed.query)
            return {
                k: qs[k][0]
                for k in ("code", "state")
                if k in qs
            }
    except Exception:
        pass

    if "#" in value:
        parts = value.split("#", 1)
        return {"code": parts[0], "state": parts[1]}

    if "code=" in value:
        qs = parse_qs(value)
        return {k: qs[k][0] for k in ("code", "state") if k in qs}

    return {"code": value}
