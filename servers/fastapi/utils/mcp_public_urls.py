from collections.abc import Mapping
from typing import Any

from fastapi import Request

from utils.get_env import get_presenton_public_url


MCP_REQUEST_HEADER = "X-Presenton-MCP-Request"
MCP_LINK_FIELDS = frozenset({"path", "edit_path", "preview_url"})


def is_mcp_request(request: Request) -> bool:
    return request.headers.get(MCP_REQUEST_HEADER, "").strip() == "1"


def absolute_mcp_url(request: Request, value: str) -> str:
    """Make a host-relative MCP result link usable by client-neutral renderers."""
    if not is_mcp_request(request) or not value.startswith("/"):
        return value

    configured_origin = get_presenton_public_url()
    if configured_origin:
        return f"{configured_origin}{value}"

    forwarded_proto = (request.headers.get("x-forwarded-proto") or "").split(
        ",", 1
    )[0].strip()
    scheme = (
        forwarded_proto
        if forwarded_proto in {"http", "https"}
        else request.url.scheme
    )
    forwarded_host = (request.headers.get("x-forwarded-host") or "").split(
        ",", 1
    )[0].strip()
    host = forwarded_host or request.headers.get("host") or request.url.netloc
    if not host:
        return value
    return f"{scheme}://{host}{value}"


def absolute_mcp_result_links(
    request: Request, payload: Mapping[str, Any]
) -> dict[str, Any]:
    """Copy a result payload and qualify its known browser-facing link fields."""
    result = dict(payload)
    for field in MCP_LINK_FIELDS:
        value = result.get(field)
        if isinstance(value, str):
            result[field] = absolute_mcp_url(request, value)
    return result
