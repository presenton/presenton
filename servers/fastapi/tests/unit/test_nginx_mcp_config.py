import re
from pathlib import Path


NGINX_CONFIG = Path(__file__).resolve().parents[4] / "nginx.conf"


def _location_block(config: str, path: str) -> str:
    match = re.search(
        rf"location {re.escape(path)} \{{(?P<body>.*?)\n    \}}",
        config,
        flags=re.DOTALL,
    )
    assert match is not None, f"Missing Nginx location for {path}"
    return match.group("body")


def test_mcp_routes_delegate_authentication_to_fastmcp():
    config = NGINX_CONFIG.read_text(encoding="utf-8")

    for path in ("/mcp/", "/mcp"):
        block = _location_block(config, path)
        assert "auth_request" not in block
        assert "proxy_pass http://localhost:8001/mcp" in block


def test_private_app_data_routes_still_use_auth_subrequest():
    config = NGINX_CONFIG.read_text(encoding="utf-8")

    for path in (
        "/app_data/images/",
        "/app_data/exports/",
        "/app_data/uploads/",
    ):
        assert "auth_request /_auth_check;" in _location_block(config, path)
