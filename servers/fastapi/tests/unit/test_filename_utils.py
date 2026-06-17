from pathvalidate import sanitize_filename

from utils.filename_utils import safe_export_basename, MAX_EXPORT_BASENAME_BYTES


def test_safe_export_basename_short_name_unchanged():
    assert safe_export_basename("Hello World") == "Hello World"


def test_safe_export_basename_empty_falls_back_to_presentation():
    assert safe_export_basename("") == "presentation"
    assert safe_export_basename("   ") == "presentation"


def test_safe_export_basename_long_ascii_truncated_with_hash():
    long_name = "a" * 300
    result = safe_export_basename(long_name)
    assert len(result.encode("utf-8")) <= MAX_EXPORT_BASENAME_BYTES
    assert "_" in result


def test_safe_filename_japanese_under_os_limit():
    title = "2026下半期営業戦略 " + "あ" * 80
    safe = safe_export_basename(sanitize_filename(title))
    assert len(safe.encode("utf-8")) + len(".pptx") <= 255


def test_safe_export_basename_exactly_at_limit_unchanged():
    name = "x" * MAX_EXPORT_BASENAME_BYTES
    result = safe_export_basename(name)
    assert result == name
    assert len(result.encode("utf-8")) == MAX_EXPORT_BASENAME_BYTES
