import sys
import argparse
import asyncio
import traceback
from pathlib import Path

import httpx
from fastmcp import FastMCP
from fastmcp.server.auth import AccessToken, TokenVerifier
from fastmcp.server.dependencies import get_access_token, get_http_headers
import json

from utils.get_env import is_disable_auth_enabled, is_presenton_electron_desktop
from utils.simple_auth import is_auth_configured, validate_session_token

OPENAPI_SPEC_PATH = Path(__file__).with_name("openai_spec.json")
MCP_API_BASE_URL = "http://127.0.0.1:8000"
# Presentation generation can take several minutes; keep MCP upstream reads open.
MCP_API_TIMEOUT_SECONDS = 600.0
MCP_API_CONNECT_TIMEOUT_SECONDS = 15.0

with OPENAPI_SPEC_PATH.open("r", encoding="utf-8") as f:
    openapi_spec = json.load(f)


class PresentonTokenVerifier(TokenVerifier):
    """Validate Presenton session tokens for MCP HTTP auth."""

    async def verify_token(self, token: str) -> AccessToken | None:
        username = validate_session_token(token)
        if not username:
            return None

        return AccessToken(
            token=token,
            client_id=username,
            scopes=[],
            claims={"u": username},
        )


def is_mcp_server_enabled() -> bool:
    """MCP is only supported in server/Docker deployments, not the Electron app."""
    return not is_presenton_electron_desktop()


def create_mcp_auth_provider() -> TokenVerifier | None:
    """Enable MCP bearer auth only when app auth is configured."""
    if is_disable_auth_enabled() or not is_auth_configured():
        return None
    return PresentonTokenVerifier()


def get_mcp_api_timeout() -> httpx.Timeout:
    return httpx.Timeout(
        timeout=MCP_API_TIMEOUT_SECONDS,
        connect=MCP_API_CONNECT_TIMEOUT_SECONDS,
    )


def create_openapi_api_client() -> httpx.AsyncClient:
    return httpx.AsyncClient(
        base_url=MCP_API_BASE_URL,
        timeout=get_mcp_api_timeout(),
        event_hooks={"request": [attach_request_auth_header]},
    )


async def attach_request_auth_header(request: httpx.Request) -> None:
    """Forward the authenticated MCP caller token to FastAPI tool endpoints."""
    if "authorization" in request.headers:
        return

    access_token = get_access_token()
    if access_token:
        request.headers["Authorization"] = f"Bearer {access_token.token}"
        return

    forwarded_headers = get_http_headers(include={"authorization"})
    incoming_auth_header = forwarded_headers.get("authorization")
    if incoming_auth_header:
        request.headers["Authorization"] = incoming_auth_header


async def main():
    try:
        if not is_mcp_server_enabled():
            print(
                "INFO: MCP server is disabled in the Presenton Electron desktop app "
                "(PRESENTON_ELECTRON=true)."
            )
            return

        print("DEBUG: MCP (OpenAPI) Server startup initiated")
        parser = argparse.ArgumentParser(
            description="Run the MCP server (from OpenAPI)"
        )
        parser.add_argument(
            "--port", type=int, default=8001, help="Port for the MCP HTTP server"
        )

        parser.add_argument(
            "--name",
            type=str,
            default="Presenton API (OpenAPI)",
            help="Display name for the generated MCP server",
        )
        args = parser.parse_args()
        print(f"DEBUG: Parsed args - port={args.port}")

        async with create_openapi_api_client() as api_client:
            # Build MCP server from OpenAPI
            print("DEBUG: Creating FastMCP server from OpenAPI spec...")
            mcp_auth_provider = create_mcp_auth_provider()
            mcp = FastMCP.from_openapi(
                openapi_spec=openapi_spec,
                client=api_client,
                name=args.name,
                auth=mcp_auth_provider,
            )
            print("DEBUG: MCP server created from OpenAPI successfully")

            # Start the MCP server
            uvicorn_config = {"reload": True}
            print(f"DEBUG: Starting MCP server on host=127.0.0.1, port={args.port}")
            await mcp.run_async(
                transport="http",
                host="127.0.0.1",
                port=args.port,
                uvicorn_config=uvicorn_config,
            )
            print("DEBUG: MCP server run_async completed")
    except Exception as e:
        print(f"ERROR: MCP server startup failed: {e}")
        print(f"ERROR: Traceback: {traceback.format_exc()}")
        raise


if __name__ == "__main__":
    print("DEBUG: Starting MCP (OpenAPI) main function")
    try:
        asyncio.run(main())
    except Exception as e:
        print(f"FATAL ERROR: {e}")
        print(f"FATAL TRACEBACK: {traceback.format_exc()}")
        sys.exit(1)
