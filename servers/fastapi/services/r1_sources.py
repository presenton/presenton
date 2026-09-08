
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
