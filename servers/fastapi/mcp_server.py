import sys
import argparse
import asyncio
import json
import traceback
from pathlib import Path

import httpx
from fastmcp import FastMCP
from fastmcp.server.auth import AccessToken, TokenVerifier
from fastmcp.server.dependencies import get_access_token, get_http_headers
from fastmcp.server.providers.openapi import MCPType, RouteMap

from utils.get_env import is_disable_auth_enabled, is_presenton_electron_desktop
from models.sql.access_token import AccessToken as DatabaseAccessToken
from models.sql.user import User
from services.database import async_session_maker

OPENAPI_SPEC_PATH = Path(__file__).with_name("openai_spec.json")
MCP_API_BASE_URL = "http://127.0.0.1:8000"
# Presentation generation can take several minutes; keep MCP upstream reads open.
MCP_API_TIMEOUT_SECONDS = 600.0
MCP_API_CONNECT_TIMEOUT_SECONDS = 15.0

# The HTTP API contains many internal and administrative routes that are useful to
# the web app but should not be advertised to an MCP client. Keep this allowlist
# intentionally small so an LLM can reliably select the presentation workflow.
MCP_ROUTE_MAPS = [
    RouteMap(
        methods=["POST"],
        pattern=r"^/api/v1/ppt/presentation/generate$",
        mcp_type=MCPType.TOOL,
    ),
    RouteMap(
        methods=["POST"],
        pattern=r"^/api/v1/ppt/presentation/generate/async$",
        mcp_type=MCPType.TOOL,
    ),
    RouteMap(
        methods=["GET"],
        pattern=r"^/api/v1/ppt/presentation/status/\{id\}$",
        mcp_type=MCPType.TOOL,
    ),
    RouteMap(mcp_type=MCPType.EXCLUDE),
]

MCP_TOOL_NAMES = {
    "generate_presentation_sync_api_v1_ppt_presentation_generate_post": (
        "generate_presentation"
    ),
    "generate_presentation_async_api_v1_ppt_presentation_generate_async_post": (
        "generate_presentation_async"
    ),
    "check_async_presentation_generation_status_api_v1_ppt_presentation_status__id__get": (
        "get_presentation_generation_status"
    ),
}

MCP_INSTRUCTIONS = """Generate presentations with Presenton.

Use generate_presentation for the normal synchronous workflow. Use
generate_presentation_async for background generation, then poll
get_presentation_generation_status with the returned task ID until it completes.
"""

with OPENAPI_SPEC_PATH.open("r", encoding="utf-8") as f:
    openapi_spec = json.load(f)


class PresentonTokenVerifier(TokenVerifier):
    """Validate admin-owned Presenton API keys for MCP HTTP auth."""

    async def verify_token(self, token: str) -> AccessToken | None:
        if not token.startswith("sk-presenton-"):
            return None
        async with async_session_maker() as session:
            access_key = await session.get(DatabaseAccessToken, token)
            if access_key is None:
                return None
            user = await session.get(User, access_key.user_id)
            if user is None or not user.is_active or not user.is_superuser:
                return None

        return AccessToken(
            token=token,
            client_id=str(user.id),
            scopes=[],
            claims={"u": user.username, "role": "admin"},
        )


def is_mcp_server_enabled() -> bool:
    """MCP is only supported in server/Docker deployments, not the Electron app."""
    return not is_presenton_electron_desktop()


def create_mcp_auth_provider() -> TokenVerifier | None:
    """Require admin API-key bearer auth whenever server auth is enabled."""
    if is_disable_auth_enabled():
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


def create_mcp_server(
    api_client: httpx.AsyncClient,
    *,
    name: str = "Presenton",
    auth: TokenVerifier | None = None,
) -> FastMCP:
    """Create the MCP server with only the public presentation workflow exposed."""
    return FastMCP.from_openapi(
        openapi_spec=openapi_spec,
        client=api_client,
        name=name,
        auth=auth,
        route_maps=MCP_ROUTE_MAPS,
        mcp_names=MCP_TOOL_NAMES,
        instructions=MCP_INSTRUCTIONS,
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
            mcp = create_mcp_server(
                api_client,
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
