from templates.handler import _normalize_layout_code_for_create


def test_normalize_layout_code_repairs_bare_asset_fields():
    code = """
const data = {
  icon: {
    __icon_url__
    __icon_query__: "play"
  },
};
"""

    normalized = _normalize_layout_code_for_create(code)

    assert '__icon_url__: "/static/icons/placeholder.svg",' in normalized
    assert '__icon_query__: "play"' in normalized


def test_normalize_layout_code_rewrites_raw_asset_field_names():
    code = """
const data = {
  icon: {
    icon_url: "/static/icons/placeholder.svg",
    icon_query: "play",
  },
};
"""

    normalized = _normalize_layout_code_for_create(code)

    assert '__icon_url__: "/static/icons/placeholder.svg"' in normalized
    assert '__icon_query__: "play"' in normalized


def test_normalize_layout_code_does_not_renormalize_asset_fields():
    code = """
const data = {
  icon: {
    __icon_url__: "/static/icons/placeholder.svg",
    __icon_query__: "play",
  },
};
"""

    normalized = _normalize_layout_code_for_create(code)

    assert "____icon_url____" not in normalized
    assert "____icon_query____" not in normalized
    assert '__icon_url__: "/static/icons/placeholder.svg"' in normalized
