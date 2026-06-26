from __future__ import annotations

import os
from typing import Any

import aiohttp
from pydantic import BaseModel


class ValidatedLayoutCode(BaseModel):
    layout_code: str
    layout_id: str
    layout_name: str
    layout_description: str
    schema_json_value: Any


class LayoutCodeValidationError(Exception):
    def __init__(
        self,
        error: str,
        *,
        line: int | None = None,
        column: int | None = None,
    ) -> None:
        super().__init__(error)
        self.error = error
        self.line = line
        self.column = column

    def to_detail(self) -> dict[str, Any]:
        detail: dict[str, Any] = {"error": self.error}
        if self.line is not None:
            detail["line"] = self.line
        if self.column is not None:
            detail["column"] = self.column
        return detail


class LayoutCodeValidationServiceError(Exception):
    pass


def _endpoint_from_base(base_url: str) -> str:
    base = base_url.strip().rstrip("/")
    if base.endswith("/api/validate-layout-code"):
        return base
    return f"{base}/api/validate-layout-code"


def _validation_url_candidates() -> list[str]:
    explicit_endpoint = (os.getenv("LAYOUT_CODE_VALIDATION_URL") or "").strip()
    if explicit_endpoint:
        return [_endpoint_from_base(explicit_endpoint)]

    candidate_bases = [
        os.getenv("NEXT_PUBLIC_URL"),
        os.getenv("PRESENTON_NEXT_URL"),
        "http://localhost",
        "http://localhost:3000",
    ]

    seen: set[str] = set()
    urls: list[str] = []
    for base in candidate_bases:
        if not base:
            continue
        url = _endpoint_from_base(base)
        if url in seen:
            continue
        seen.add(url)
        urls.append(url)
    return urls


def _coerce_validation_error(payload: Any, fallback: str) -> LayoutCodeValidationError:
    if not isinstance(payload, dict):
        return LayoutCodeValidationError(fallback)
    return LayoutCodeValidationError(
        str(payload.get("error") or fallback),
        line=payload.get("line") if isinstance(payload.get("line"), int) else None,
        column=payload.get("column")
        if isinstance(payload.get("column"), int)
        else None,
    )


async def validate_layout_code(layout_code: str) -> ValidatedLayoutCode:
    last_service_error: str | None = None
    timeout = aiohttp.ClientTimeout(total=20)

    for url in _validation_url_candidates():
        try:
            async with aiohttp.ClientSession(timeout=timeout) as session:
                async with session.post(
                    url,
                    json={"layout_code": layout_code},
                    headers={"Content-Type": "application/json"},
                ) as response:
                    payload = await response.json(content_type=None)

                    if response.status == 200 and isinstance(payload, dict):
                        return ValidatedLayoutCode(
                            layout_code=str(payload.get("layout_code") or ""),
                            layout_id=str(payload.get("layoutId") or ""),
                            layout_name=str(payload.get("layoutName") or ""),
                            layout_description=str(
                                payload.get("layoutDescription") or ""
                            ),
                            schema_json_value=payload.get("schemaJSON"),
                        )

                    if response.status == 400:
                        raise _coerce_validation_error(
                            payload, "Layout code validation failed"
                        )

                    last_service_error = (
                        f"Layout validation service returned HTTP {response.status}"
                    )
        except LayoutCodeValidationError:
            raise
        except (aiohttp.ClientError, TimeoutError) as exc:
            last_service_error = str(exc) or exc.__class__.__name__
        except Exception as exc:  # noqa: BLE001
            last_service_error = str(exc) or exc.__class__.__name__

    raise LayoutCodeValidationServiceError(
        last_service_error or "Layout validation service is unavailable"
    )
