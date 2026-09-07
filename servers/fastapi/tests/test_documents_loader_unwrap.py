import json

from services.documents_loader import (
    _unwrap_liteparse_json_line_if_stored,
    clean_extracted_document_text,
)


def test_unwrap_strips_liteparse_json_line():
    inner = 'Title\n\nBody with "quotes" and\nnewlines.'
    line = json.dumps(
        {"ok": True, "filePath": "/tmp/x.pdf", "text": inner},
        ensure_ascii=False,
    )
    assert _unwrap_liteparse_json_line_if_stored(line) == inner
    assert _unwrap_liteparse_json_line_if_stored(" \n" + line) == inner


def test_unwrap_leaves_plain_text():
    t = "Not JSON. {Braces} in prose."
    assert _unwrap_liteparse_json_line_if_stored(t) is t


def test_unwrap_rejects_malformed_json():
    t = "{not valid json"
    assert _unwrap_liteparse_json_line_if_stored(t) is t


def test_clean_extracts_text_when_json_truncated():
    """Drops everything before the "text" value and unescapes, even if JSON is not closed."""
    blob = (
        '{"ok": true, "filePath": "/tmp/x.pdf", "text": "    similarweb |  HypeAuditor\\n\\n2024" '
    )
    # Missing closing " } — json.loads will fail, fallback path should still return body
    out = clean_extracted_document_text(blob)
    assert "similarweb" in out
    assert "ok" not in out
    assert "filePath" not in out


def test_clean_same_as_unwrap_for_valid_line():
    inner = "Prose only."
    line = json.dumps(
        {"ok": True, "filePath": "/tmp/x.pdf", "text": inner},
        ensure_ascii=False,
    )
    assert clean_extracted_document_text(line) == inner


def test_clean_double_json_embedded_in_text_field():
    inner2 = "Final body."
    inner1 = json.dumps(
        {"ok": True, "filePath": "/a.pdf", "text": inner2},
        ensure_ascii=False,
    )
    outer = json.dumps(
        {"ok": True, "filePath": "/b.pdf", "text": inner1},
        ensure_ascii=False,
    )
    assert clean_extracted_document_text(outer) == inner2
