
"""R1 F03: extract spreadsheet ranges as typed tables. No LLM."""

from __future__ import annotations

import csv
import json
import re
import uuid
import zipfile
from pathlib import Path
from typing import Any
from xml.etree import ElementTree

from fastapi import HTTPException

from services.office_document_service import OfficeDocumentError, _extract_shared_strings, _local_name, _read_xml
from utils.get_env import get_app_data_directory_env

_A1 = re.compile(r"^([A-Za-z]+)(\d+)$")


def col_to_index(col: str) -> int:
    n = 0
    for ch in col.upper():
        n = n * 26 + (ord(ch) - 64)
    return n


def parse_a1_range(spec: str | None) -> tuple[int, int, int, int] | None:
    if not spec or not str(spec).strip():
        return None
    text = str(spec).replace("$", "").strip().upper()
    if ":" not in text:
        text = f"{text}:{text}"
    start, end = text.split(":", 1)
    m1, m2 = _A1.match(start), _A1.match(end)
    if not m1 or not m2:
        raise HTTPException(422, f"Invalid A1 range: {spec}")
    c1, r1 = col_to_index(m1.group(1)), int(m1.group(2))
    c2, r2 = col_to_index(m2.group(1)), int(m2.group(2))
    return min(c1, c2), min(r1, r2), max(c1, c2), max(r1, r2)


def _parse_cell_value(raw: str, cell_type: str | None) -> Any:
    if cell_type in {None, "", "n"}:
        try:
            if raw == "":
                return None
            if "." in raw or "e" in raw.lower():
                return float(raw)
            return int(raw)
        except ValueError:
            return raw
    if cell_type == "b":
        return raw in {"1", "true", "TRUE"}
    return raw


def extract_csv(path: Path, a1: str | None = None) -> dict[str, Any]:
    with path.open(newline="", encoding="utf-8-sig", errors="replace") as fh:
        rows = [list(row) for row in csv.reader(fh)]
    bounds = parse_a1_range(a1)
    warnings: list[str] = []
    if bounds:
        c1, r1, c2, r2 = bounds
        table = []
        for r in range(r1, r2 + 1):
            row = []
            src = rows[r - 1] if 0 <= r - 1 < len(rows) else []
            for c in range(c1, c2 + 1):
                if c - 1 < len(src):
                    value = src[c - 1]
                    row.append(_coerce(value))
                else:
                    row.append(None)
                    warnings.append(f"missing {chr(64+c)}{r}" if c <= 26 else f"missing col{c}r{r}")
            table.append(row)
        rows = table
    else:
        rows = [[_coerce(v) for v in row] for row in rows]
    columns = [str(c) if c is not None else "" for c in (rows[0] if rows else [])]
    body = rows[1:] if len(rows) > 1 else []
    return {
        "kind": "table",
        "sheet": None,
        "range": a1,
        "columns": columns,
        "rows": body,
        "warnings": warnings,
        "engine": "csv",
    }


def _coerce(value: Any) -> Any:
    if value is None or value == "":
        return None
    if isinstance(value, (int, float, bool)):
        return value
    text = str(value).strip()
    if re.fullmatch(r"-?\d+", text):
        return int(text)
    if re.fullmatch(r"-?\d+\.\d+", text):
        return float(text)
    return text


def extract_xlsx(path: Path, sheet: str | int | None = None, a1: str | None = None) -> dict[str, Any]:
    bounds = parse_a1_range(a1)
    warnings: list[str] = []
    try:
        archive = zipfile.ZipFile(path)
    except (OSError, zipfile.BadZipFile) as exc:
        raise HTTPException(422, f"Could not parse spreadsheet: {path.name}") from exc
    with archive:
        shared = _extract_shared_strings(archive)
        members = sorted(
            (name for name in archive.namelist() if re.fullmatch(r"xl/worksheets/sheet\d+\.xml", name)),
            key=lambda n: [int(p) if p.isdigit() else p for p in re.split(r"(\d+)", n)],
        )
        if not members:
            raise HTTPException(422, "Workbook has no worksheets")
        if isinstance(sheet, int):
            member = members[sheet] if 0 <= sheet < len(members) else None
        elif isinstance(sheet, str) and sheet.strip():
            member = members[0]
            warnings.append(f"sheet name {sheet!r} ignored; using first sheet")
        else:
            member = members[0]
        if member is None:
            raise HTTPException(422, "Worksheet index out of range")
        root = _read_xml(archive, member)
        cells: dict[tuple[int, int], Any] = {}
        for cell in root.iter():
            if _local_name(cell.tag) != "c":
                continue
            ref = cell.attrib.get("r")
            if not ref:
                continue
            m = _A1.match(ref)
            if not m:
                continue
            col, row = col_to_index(m.group(1)), int(m.group(2))
            cell_type = cell.attrib.get("t")
            if cell_type == "inlineStr":
                value = " ".join(
                    (el.text or "").strip()
                    for el in cell.iter()
                    if _local_name(el.tag) == "t"
                )
            else:
                raw = next(
                    ((el.text or "").strip() for el in cell if _local_name(el.tag) == "v"),
                    "",
                )
                if cell_type == "s" and raw.isdigit():
                    idx = int(raw)
                    value = shared[idx] if idx < len(shared) else raw
                else:
                    value = _parse_cell_value(raw, cell_type)
            cells[(row, col)] = value
    if bounds:
        c1, r1, c2, r2 = bounds
    else:
        if not cells:
            raise HTTPException(422, "Worksheet is empty")
        r1 = min(r for r, _ in cells)
        r2 = max(r for r, _ in cells)
        c1 = min(c for _, c in cells)
        c2 = max(c for _, c in cells)
    table = []
    for r in range(r1, r2 + 1):
        row = []
        for c in range(c1, c2 + 1):
            if (r, c) in cells:
                row.append(cells[(r, c)])
            else:
                row.append(None)
                if bounds:
                    warnings.append(f"empty cell r{r}c{c}")
        table.append(row)
    columns = [str(c) if c is not None else "" for c in (table[0] if table else [])]
    body = table[1:] if len(table) > 1 else []
    return {
        "kind": "table",
        "sheet": member,
        "range": a1,
        "columns": columns,
        "rows": body,
        "warnings": warnings[:50],
        "engine": "xlsx",
    }


def extract_tabular_source(path: str, sheet: str | int | None = None, a1: str | None = None) -> dict[str, Any]:
    file_path = Path(path)
    if not file_path.exists():
        raise HTTPException(404, f"File not found: {file_path.name}")
    ext = file_path.suffix.lower()
    if ext in {".csv", ".tsv"}:
        result = extract_csv(file_path, a1)
    elif ext in {".xlsx", ".xlsm"}:
        result = extract_xlsx(file_path, sheet, a1)
    else:
        raise HTTPException(422, f"Tabular extract supports csv/tsv/xlsx, not {ext}")
    result["source"] = {"filename": file_path.name, "path": str(file_path)}
    return result


def persist_source_snapshot(payload: dict[str, Any]) -> dict[str, Any]:
    root = Path(get_app_data_directory_env() or "/tmp/presenton") / "sources"
    root.mkdir(parents=True, exist_ok=True)
    sid = uuid.uuid4().hex[:12]
    path = root / f"{sid}.json"
    snapshot = {**payload, "id": sid}
    path.write_text(json.dumps(snapshot, ensure_ascii=False, indent=2))
    snapshot["snapshot_path"] = str(path)
    return snapshot
