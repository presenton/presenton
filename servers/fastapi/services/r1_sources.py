
"""F03 remaining: PDF/DOCX/PPTX text snapshots, no LLM, numbers kept as in file."""

from __future__ import annotations

import json
import re
import uuid
from pathlib import Path
from typing import Any

from fastapi import HTTPException

from services.office_document_service import OfficeDocumentError, extract_office_document_text
from services.tabular_source import persist_source_snapshot
from utils.get_env import get_app_data_directory_env

_NUM = re.compile(r"-?\d+(?:\.\d+)?")


def extract_document_source(path: str) -> dict[str, Any]:
    file_path = Path(path)
    if not file_path.exists():
        raise HTTPException(404, f"File not found: {file_path.name}")
    ext = file_path.suffix.lower()
    warnings: list[str] = []
    text = ""
    try:
        if ext == ".pdf":
            import pdfplumber
            pages = []
            with pdfplumber.open(file_path) as pdf:
                for i, page in enumerate(pdf.pages):
                    page_text = page.extract_text() or ""
                    if not page_text.strip():
                        warnings.append(f"empty page {i+1}")
                    pages.append(page_text)
            text = "\n\n".join(pages)
        elif ext in {".docx", ".pptx", ".xlsx", ".csv", ".tsv", ".odt"}:
            text = extract_office_document_text(str(file_path))
        else:
            text = file_path.read_text(encoding="utf-8", errors="replace")
    except OfficeDocumentError as exc:
        raise HTTPException(422, str(exc)) from exc
    except Exception as exc:
        raise HTTPException(422, f"Extract failed: {exc}") from exc
    numbers = _NUM.findall(text)
    payload = {
        "kind": "document",
        "filename": file_path.name,
        "text": text,
        "numbers": numbers,
        "warnings": warnings,
        "engine": ext.lstrip(".") or "text",
    }
    return persist_source_snapshot(payload)


def extract_url_source(url: str) -> dict[str, Any]:
    from urllib.parse import urlparse
    from urllib.request import Request, urlopen
    import ipaddress
    import socket

    parsed = urlparse((url or "").strip())
    if parsed.scheme not in {"http", "https"} or not parsed.hostname:
        raise HTTPException(422, "Only http(s) URLs are allowed")
    host = parsed.hostname
    try:
        infos = socket.getaddrinfo(host, None)
    except OSError as exc:
        raise HTTPException(422, f"Could not resolve host: {host}") from exc
    for info in infos:
        ip = ipaddress.ip_address(info[4][0])
        if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved:
            raise HTTPException(422, "URL host is not allowed")
    req = Request(parsed.geturl(), headers={"User-Agent": "presenton-r1-extract"})
    try:
        with urlopen(req, timeout=10) as resp:
            raw = resp.read(200_000)
            text = raw.decode(resp.headers.get_content_charset() or "utf-8", errors="replace")
    except Exception as exc:
        raise HTTPException(422, f"Fetch failed: {exc}") from exc
    numbers = _NUM.findall(text)
    return persist_source_snapshot(
        {
            "kind": "url",
            "filename": host,
            "text": text[:20000],
            "numbers": numbers[:200],
            "warnings": [],
            "engine": "url",
            "source": {"url": parsed.geturl()},
        }
    )
