import sys
import argparse
import asyncio
import traceback

import httpx
from fastmcp import FastMCP
import json

from utils.simple_auth import get_internal_auth_headers

with open("openai_spec.json", "r") as f:
    openapi_spec = json.load(f)


async def attach_internal_auth_header(request: httpx.Request) -> None:
    if "authorization" in request.headers:
        return

    auth_header = get_internal_auth_headers().get("Authorization")
    if auth_header:
        request.headers["Authorization"] = auth_header


async def main():
    try:
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

        # Create an HTTP client that the MCP server will use to call the API
        api_client = httpx.AsyncClient(
            base_url="http://127.0.0.1:8000",
            timeout=60.0,
            event_hooks={"request": [attach_internal_auth_header]},
        )

        # Build MCP server from OpenAPI
        print("DEBUG: Creating FastMCP server from OpenAPI spec...")
        mcp = FastMCP.from_openapi(
            openapi_spec=openapi_spec,
            client=api_client,
            name=args.name,
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
