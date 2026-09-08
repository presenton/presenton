import sys
import argparse
import asyncio
import json
import logging
import traceback
from pathlib import Path
from urllib.parse import urlsplit

import httpx
import httpx2
from fastmcp import FastMCP
from fastmcp.server.auth import AccessToken, TokenVerifier
from fastmcp.server.dependencies import get_access_token, get_http_headers
from fastmcp.server.providers.openapi import MCPType, RouteMap

from utils.get_env import (
    PresentationGenerationMode,
    get_presentation_generation_mode,
    get_presenton_public_url,
    is_disable_auth_enabled,
    is_presenton_electron_desktop,
)
from services.database import async_session_maker
from services.api_keys import API_KEY_PREFIX, verify_api_key
from api.v1.auth.config import SESSION_COOKIE_NAME
from api.v1.auth.users import get_jwt_strategy
from utils.mcp_public_urls import MCP_REQUEST_HEADER

OPENAPI_SPEC_PATH = Path(__file__).with_name("openai_spec.json")
MCP_API_BASE_URL = "http://127.0.0.1:8000"
# Presentation generation can take several minutes; keep MCP upstream reads open.
MCP_API_TIMEOUT_SECONDS = 600.0
MCP_API_CONNECT_TIMEOUT_SECONDS = 15.0
# The session is copied into an in-process background generation job and used
# again by the exporter after all slides are ready. A five-minute token could
# expire during a perfectly healthy 10-20 minute deck generation, especially
# on first boot while models are being downloaded.
MCP_INTERNAL_SESSION_TTL_SECONDS = 60 * 60
LOGGER = logging.getLogger(__name__)
MCP_ALLOWED_HOSTS = ["localhost", "127.0.0.1", "::1"]
MCP_LOCAL_ALLOWED_ORIGINS = [
    "http://localhost:*",
    "https://localhost:*",
    "http://127.0.0.1:*",
    "https://127.0.0.1:*",
    "http://[::1]:*",
    "https://[::1]:*",
]

# The HTTP API contains many internal and administrative routes that are useful to
# the web app but should not be advertised to an MCP client. Keep this allowlist
# intentionally small so an LLM can reliably select the presentation workflow.
MCP_STANDARD_ROUTE_MAPS = [
    RouteMap(
        methods=["POST"],
        pattern=r"^/api/v1/ppt/presentation/generate/async$",
        mcp_type=MCPType.TOOL,
    ),
]

MCP_SMART_ROUTE_MAPS = [
    RouteMap(
        methods=["POST"],
        pattern=r"^/api/v2/ppt/presentation/generate/smart/async$",
        mcp_type=MCPType.TOOL,
    ),
]

MCP_TEMPLATE_ROUTE_MAPS = [
    RouteMap(
        methods=["GET"],
        pattern=r"^/api/v1/ppt/template/all$",
        mcp_type=MCPType.TOOL,
    ),
    RouteMap(
        methods=["POST"],
        pattern=r"^/api/v1/ppt/template/mcp-upload$",
        mcp_type=MCPType.TOOL,
    ),
    RouteMap(
        methods=["POST"],
        pattern=r"^/api/v1/ppt/template/async$",
        mcp_type=MCPType.TOOL,
    ),
]

MCP_SHARED_ROUTE_MAPS = [
    RouteMap(
        methods=["POST"],
        pattern=r"^/api/v1/ppt/files/mcp-upload$",
        mcp_type=MCPType.TOOL,
    ),
    RouteMap(
        methods=["GET"],
        pattern=r"^/api/v1/async-tasks/status/\{id\}$",
        mcp_type=MCPType.TOOL,
    ),
]

MCP_TOOL_NAMES = {
    "generate_presentation_async_api_v1_ppt_presentation_generate_async_post": (
        "start_standard_presentation"
    ),
    "generate_smart_presentation_async": "start_smart_presentation",
    "template_list": "list_templates",
    "mcp_template_upload": "upload_template_assets",
    "create_template_api_v1_ppt_template_async_post": "start_template_generation",
    "mcp_files_upload": "upload_files",
    "check_async_task_status_api_v1_async_tasks_status__id__get": "get_job_status",
}

def get_mcp_route_maps(
    generation_mode: PresentationGenerationMode,
) -> list[RouteMap]:
    """Expose only workflows enabled by PRESENTATION_GENERATION_MODE."""
    route_maps: list[RouteMap] = []
    if generation_mode in {"both", "standard"}:
        route_maps.extend(MCP_STANDARD_ROUTE_MAPS)
        route_maps.extend(MCP_TEMPLATE_ROUTE_MAPS)
    if generation_mode in {"both", "smart"}:
        route_maps.extend(MCP_SMART_ROUTE_MAPS)
    route_maps.extend(MCP_SHARED_ROUTE_MAPS)
    route_maps.append(RouteMap(mcp_type=MCPType.EXCLUDE))
    return route_maps


def get_mcp_allowed_origins() -> list[str]:
    """Return browser origins trusted by the MCP DNS-rebinding guard."""
    origins = list(MCP_LOCAL_ALLOWED_ORIGINS)
    public_url = get_presenton_public_url()
    if not public_url:
        return origins

    parsed = urlsplit(public_url)
    if parsed.scheme in {"http", "https"} and parsed.netloc:
        public_origin = f"{parsed.scheme}://{parsed.netloc}"
        if public_origin not in origins:
            origins.append(public_origin)
    return origins


def get_mcp_instructions(generation_mode: PresentationGenerationMode) -> str:
    enabled_workflows = {
        "both": "Standard, Smart, and template generation",
        "standard": "Standard and template generation",
        "smart": "Smart generation",
    }[generation_mode]
    reference_generation_tools = {
        "both": "start_standard_presentation or start_smart_presentation",
        "standard": "start_standard_presentation",
        "smart": "start_smart_presentation",
    }[generation_mode]
    instructions = f"""# Presenton MCP

Create and export presentations with Presenton. Enabled workflows: {enabled_workflows}.
Follow the workflows below exactly. Tool results from the current run are the only
source of truth for IDs, paths, URLs, job state, and generated assets.

# Hard rules

1. Use only tools returned by tools/list. Never refer to removed or unavailable tools.
2. Never invent, shorten, edit, decode, or reconstruct an ID, path, or URL returned by
   a tool. Copy returned values exactly into the next tool call.
3. A client attachment ID, OpenWebUI UUID, filename, browser blob URL, and local client
   path are not uploaded Presenton files. If binary bytes are unavailable, stop and
   explain that the attachment cannot be uploaded.
4. For every upload, send standard base64 of the raw file bytes only. Do not send a
   data-URI prefix, Markdown, a filename in place of bytes, or base64 of an attachment ID.
5. Start one asynchronous job for one requested result. Do not start a duplicate job
   merely because the first job is still pending.
6. Never ask the user to paste a Presenton API key into chat.

# Choose the workflow

- Source document or image used as presentation content: upload_files, then use an
  enabled presentation generation workflow.

# Reference file upload

Use this flow for PDFs, text files, office documents, spreadsheets, presentations, and
images that provide source content for a generated deck.

1. Call upload_files once. For each file provide filename and content_base64.
2. Require a successful result with a non-empty file_paths array.
3. Pass that exact file_paths array as the files field of
   {reference_generation_tools}. Pass the array itself, not the surrounding result object.
4. If upload_files fails, do not call a generation tool with client-local paths or
   attachment IDs. Report the upload error.

When no source files are needed, omit files or use null according to the tool schema.
Do not invent an empty placeholder path.
"""
    if generation_mode in {"both", "standard"}:
        instructions += """
# Standard and template workflow selection

- upload_files and upload_template_assets are different operations. Never substitute
  the output of one for an input expected from the other.
- Custom visual template from a PPTX: upload_template_assets, then
  start_template_generation, then get_job_status.
- Browse built-in or completed custom templates: list_templates.
- Layout-based editable deck: start_standard_presentation, then get_job_status.

# Template listing

- Call list_templates with default=true for built-in templates only.
- Call list_templates with default=false for the authenticated user's completed custom
  templates only.
- Omit default only when both groups are wanted.
- Use the exact returned template id as the template field for Standard generation.
- Use preview_url only for viewing or sharing the template preview; never use it as a
  template id, upload path, or generation input.

# Custom template generation

Use this flow only when the user wants to turn a PPTX into a reusable custom template.

1. Call upload_template_assets with pptx.filename and pptx.content_base64. Include fonts
   only when replacement font bytes are actually available.
2. Require all three upload outputs: non-empty pptx_url, non-empty slide_image_urls, and
   fonts. The fonts mapping may be empty, but pass it unchanged.
3. Call start_template_generation exactly once with pptx_url, slide_image_urls, and fonts
   copied unchanged from upload_template_assets. Add name, description, and icon_type
   only when known.
4. Poll get_job_status with the returned task id until completed or error.
5. After completion, call list_templates with default=false and verify the returned
   template id. Share its preview_url when the user wants to inspect it.

Never pass upload_files.file_paths as pptx_url. Never pass a source PPTX directly to
start_template_generation. Never call start_template_generation with an empty
slide_image_urls array.

# Standard generation

1. Resolve the template before generation. Use an exact id returned by list_templates,
   or use the documented tool default when the user did not choose a template.
2. If source files are requested, complete Reference file upload first and pass the
   returned file_paths array unchanged as files.
3. Call start_standard_presentation exactly once with the requested content and settings.
4. Poll get_job_status with its returned task id until completed or error.
"""
    if generation_mode in {"both", "smart"}:
        instructions += """
# Smart workflow selection

- HTML-based Smart deck: start_smart_presentation, then get_job_status.

# Smart generation

1. If source files are requested, complete Reference file upload first and pass the
   returned file_paths array unchanged as files.
2. Call start_smart_presentation exactly once with the requested content and settings.
3. Poll get_job_status with its returned task id until completed or error.

Smart generation does not accept a Standard template id. Do not call template tools
unless the user separately asked to create or inspect a Standard/custom template.
"""
    instructions += """
# Job polling and completion

1. Read the task id from the start tool result and pass it unchanged as id to
   get_job_status.
2. While status is pending, wait 10-15 seconds and poll the same task id again. Progress
   messages and increasing created slide/layout counts mean the job is working.
3. completed is success. For presentation jobs, use data.path as the exported file URL
   and data.edit_path as the editor URL.
4. error is terminal failure. Report the returned error detail. Do not retry the same
   arguments blindly and do not claim success.
5. Do not stop polling solely because generation takes several minutes. First-run model
   downloads and larger decks can legitimately take longer.

# Final response

Claim success only after a tool reports completed or an immediate listing/upload call
returns the required fields. Give the user the relevant exported path, edit path, or
template preview URL. Keep internal task details brief unless troubleshooting is needed.
"""
    return instructions

with OPENAPI_SPEC_PATH.open("r", encoding="utf-8") as f:
    openapi_spec = json.load(f)


class PresentonTokenVerifier(TokenVerifier):
    """Validate the same user-scoped API keys accepted by the REST API."""

    async def verify_token(self, token: str) -> AccessToken | None:
        if not token.startswith(API_KEY_PREFIX):
            return None
        async with async_session_maker() as session:
            verified = await verify_api_key(session, token)
            if verified is None:
                return None
            user = verified.user
            try:
                internal_session_token = await get_jwt_strategy(
                    lifetime_seconds=MCP_INTERNAL_SESSION_TTL_SECONDS
                ).write_token(user)
            except ValueError:
                # Unit tests and incomplete development shells may not have a
                # USER_CONFIG_PATH. Production startup always creates it.
                internal_session_token = None

        return AccessToken(
            token=token,
            client_id=str(user.id),
            scopes=[],
            claims={
                "u": user.username,
                "role": "admin" if user.is_superuser else "user",
                "user_id": str(user.id),
                "api_key_id": verified.api_key_id,
                "internal_session_token": internal_session_token,
            },
        )


def is_mcp_server_enabled() -> bool:
    """MCP is only supported in server/Docker deployments, not the Electron app."""
    return not is_presenton_electron_desktop()


def create_mcp_auth_provider() -> TokenVerifier | None:
    """Require user-scoped bearer auth whenever server auth is enabled."""
    if is_disable_auth_enabled():
        return None
    return PresentonTokenVerifier()


def get_mcp_api_timeout() -> httpx2.Timeout:
    return httpx2.Timeout(
        timeout=MCP_API_TIMEOUT_SECONDS,
        connect=MCP_API_CONNECT_TIMEOUT_SECONDS,
    )


def create_openapi_api_client() -> httpx2.AsyncClient:
    return httpx2.AsyncClient(
        base_url=MCP_API_BASE_URL,
        timeout=get_mcp_api_timeout(),
        event_hooks={"request": [attach_request_auth_header]},
    )


def create_mcp_server(
    api_client: httpx.AsyncClient | httpx2.AsyncClient,
    *,
    name: str = "Presenton",
    auth: TokenVerifier | None = None,
) -> FastMCP:
    """Create the MCP server with only the public presentation workflow exposed."""
    generation_mode = get_presentation_generation_mode()
    return FastMCP.from_openapi(
        openapi_spec=openapi_spec,
        client=api_client,
        name=name,
        auth=auth,
        route_maps=get_mcp_route_maps(generation_mode),
        mcp_names=MCP_TOOL_NAMES,
        instructions=get_mcp_instructions(generation_mode),
    )


async def attach_request_auth_header(request: httpx.Request | httpx2.Request) -> None:
    """Exchange the MCP key for an internal session when calling FastAPI.

    The long-lived API key is deliberately never forwarded to an API
    endpoint. The fallback paths exist for auth-disabled development and for
    older tests which provide a token object without verified claims.
    """
    incoming_headers = get_http_headers(
        include={
            "authorization",
            "host",
            "x-forwarded-host",
            "x-forwarded-proto",
        }
    )
    request.headers[MCP_REQUEST_HEADER] = "1"

    # Preserve the public origin across the MCP -> internal FastAPI request so
    # API responses can expose browser links for the host the client connected to.
    forwarded_host = incoming_headers.get("x-forwarded-host") or incoming_headers.get(
        "host"
    )
    if forwarded_host:
        request.headers["X-Forwarded-Host"] = forwarded_host
    forwarded_proto = incoming_headers.get("x-forwarded-proto")
    if forwarded_proto:
        request.headers["X-Forwarded-Proto"] = forwarded_proto

    if "authorization" in request.headers or "cookie" in request.headers:
        return

    access_token = get_access_token()
    if access_token:
        claims = getattr(access_token, "claims", None) or {}
        internal_session_token = claims.get("internal_session_token")
        if internal_session_token:
            request.headers["Cookie"] = (
                f"{SESSION_COOKIE_NAME}={internal_session_token}"
            )
            return
        if claims.get("user_id"):
            raise RuntimeError(
                "Unable to create an internal Presenton session for the MCP request"
            )
        request.headers["Authorization"] = f"Bearer {access_token.token}"
        return

    incoming_auth_header = incoming_headers.get("authorization")
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
            uvicorn_config = {"reload": False}
            print(f"DEBUG: Starting MCP server on host=127.0.0.1, port={args.port}")
            await mcp.run_async(
                transport="http",
                host="127.0.0.1",
                port=args.port,
                uvicorn_config=uvicorn_config,
                host_origin_protection=True,
                allowed_hosts=MCP_ALLOWED_HOSTS,
                allowed_origins=get_mcp_allowed_origins(),
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
