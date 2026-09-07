from utils.slide_background import (
    apply_slide_background,
    is_light_color,
    mix_colors,
    slide_background_gradient,
    strip_white_fullbleed_backgrounds,
)

THEME = {
    "name": "Test Theme",
    "data": {"colors": {"background": "#F5F8FE", "primary": "#2563EB"}},
}


def _fullbleed_vector(color="#FFFFFF"):
    return {
        "type": "vector",
        "name": "bg_rect",
        "fill": {"color": color, "opacity": 1},
        "points": [
            {"x": 0, "y": 0},
            {"x": 1280, "y": 0},
            {"x": 1280, "y": 720},
            {"x": 0, "y": 720},
        ],
        "closed": True,
    }


def test_gradient_is_palette_based_and_valid_css():
    gradient = slide_background_gradient("#F5F8FE", "#2563EB", slide_index=0)
    assert gradient.startswith("linear-gradient(")
    assert "#f5f8fe" in gradient
    # Угол меняется от слайда к слайду — дека не выглядит штампованной.
    other = slide_background_gradient("#F5F8FE", "#2563EB", slide_index=1)
    assert gradient != other


def test_dark_theme_gradient_stays_dark():
    gradient = slide_background_gradient("#1D242D", "#3B82F6")
    assert "#1d242d" in gradient
    assert is_light_color("#1D242D") is False
    assert is_light_color("#F5F8FE") is True


def test_mix_colors():
    assert mix_colors("#000000", "#ffffff", 0.5) == "#808080"
    assert mix_colors("#ff0000", "#ff0000", 0.9) == "#ff0000"


def test_strip_white_fullbleed_backgrounds():
    ui = {
        "elements": [_fullbleed_vector(), {"type": "text", "name": "keep_me"}],
        "components": [{"elements": [_fullbleed_vector("#ffffff")]}],
    }
    removed = strip_white_fullbleed_backgrounds(ui)
    assert len(removed) == 2
    assert ui["elements"] == [{"type": "text", "name": "keep_me"}]
    assert ui["components"][0]["elements"] == []


def test_strip_keeps_cards_and_non_white_backgrounds():
    ui = {
        "elements": [
            {
                "type": "vector",
                "fill": {"color": "#FFFFFF", "opacity": 1},
                "points": [
                    {"x": 100, "y": 100},
                    {"x": 300, "y": 100},
                    {"x": 300, "y": 300},
                    {"x": 100, "y": 300},
                ],
            },
            _fullbleed_vector("#1D242D"),
        ]
    }
    assert strip_white_fullbleed_backgrounds(ui) == []
    assert len(ui["elements"]) == 2


def test_apply_slide_background_injects_gradient():
    ui = {"elements": [_fullbleed_vector()]}
    result = apply_slide_background(ui, THEME, slide_index=2)
    assert result is ui
    assert ui["background"].startswith("linear-gradient(")
    assert ui["elements"] == []


def test_apply_slide_background_respects_explicit():
    ui = {"background": "#ABCDEF", "elements": [_fullbleed_vector()]}
    apply_slide_background(ui, THEME)
    assert ui["background"] == "#ABCDEF"
    # Явный фон лейаута не перекрывается — белый full-bleed остаётся на месте.
    assert len(ui["elements"]) == 1


def test_apply_slide_background_without_theme_is_noop():
    ui = {"elements": [_fullbleed_vector()]}
    assert apply_slide_background(ui, None) is ui
    assert "background" not in ui
    assert apply_slide_background(None, THEME) is None
