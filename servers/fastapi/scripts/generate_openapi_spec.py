"""Regenerate the static OpenAPI document consumed by the MCP server."""

import json
from pathlib import Path

from api.main import app


OUTPUT_PATH = Path(__file__).resolve().parents[1] / "openai_spec.json"


def main() -> None:
    OUTPUT_PATH.write_text(
        json.dumps(app.openapi(), separators=(",", ":")),
        encoding="utf-8",
    )


if __name__ == "__main__":
    main()
