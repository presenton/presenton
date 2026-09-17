from utils.theme_recolor import build_color_map, recolor_ui

SOURCE_COLORS = {
    "primary": "#7C5CFF",
    "background": "#FFFFFF",
    "card": "#F2F2F2",
    "background_text": "#111111",
}
TARGET_COLORS = {
    "primary": "#00FFAA",
    "background": "#0A0D18",
    "card": "#141A2E",
    "background_text": "#E6EAF5",
}


def _sample_ui() -> dict:
    return {
        "type": "root",
        "children": [
            {
                "type": "text",
                "color": "#111111",
                "content": "our brand color #7C5CFF",
            },
            {
                "type": "container",
                "background": "#FFFFFF",
                "children": [
                    {"type": "chart", "colors": ["#7C5CFF", "#F2F2F2", "#00FF00"]}
                ],
            },
        ],
    }


def test_build_color_map_maps_first_role_on_collision():
    color_map = build_color_map(
        {"primary": "#FFF", "background": "#FFF"},
        {"primary": "#000000", "background": "#111111"},
    )
    assert color_map["#ffffff"] == "#000000"


def test_recolor_ui_maps_known_fields_and_leaves_text_untouched():
    ui = _sample_ui()
    result = recolor_ui(ui, SOURCE_COLORS, TARGET_COLORS)

    text_element = result["children"][0]
    assert text_element["color"] == "#E6EAF5"
    assert text_element["content"] == "our brand color #7C5CFF"

    container = result["children"][1]
    assert container["background"] == "#0A0D18"

    chart = container["children"][0]
    assert chart["colors"] == ["#00FFAA", "#141A2E", "#00FF00"]

    # original input is untouched (deep copy)
    assert ui["children"][0]["color"] == "#111111"
