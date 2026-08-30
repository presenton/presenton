import json

from models.sql.template_v2 import TemplateV2
from templates.v2.models.layouts import SlideLayouts
from templates.v2.theme import (
    ThemeRoleSelection,
    build_theme_profile,
    contrast_ratio,
    generate_template_theme,
    materialize_theme,
    select_theme_roles_deterministically,
    select_theme_roles_with_llm,
    template_theme_for_presentation,
)


def _generated_layouts() -> SlideLayouts:
    return SlideLayouts.model_validate(
        {
            "layouts": [
                {
                    "id": "title_and_chart",
                    "description": "Title and chart layout with branded accent styling",
                    "components": [
                        {
                            "id": "main",
                            "description": "Full slide surface with title and chart content",
                            "position": {"x": 0, "y": 0},
                            "elements": [
                                {
                                    "type": "container",
                                    "position": {"x": 0, "y": 0},
                                    "size": {"width": 1280, "height": 720},
                                    "fill": {"color": "#F8FAFC"},
                                },
                                {
                                    "type": "container",
                                    "position": {"x": 80, "y": 100},
                                    "size": {"width": 300, "height": 100},
                                    "fill": {"color": "#2563EB"},
                                    "stroke": {"color": "#CBD5E1", "width": 1},
                                },
                                {
                                    "type": "text",
                                    "position": {"x": 80, "y": 40},
                                    "size": {"width": 800, "height": 60},
                                    "font": {
                                        "family": "Inter",
                                        "size": 36,
                                        "color": "#111827",
                                    },
                                    "runs": [{"text": "Example title"}],
                                    "decorative": False,
                                    "name": "title",
                                    "min_length": 1,
                                    "max_length": 80,
                                },
                                {
                                    "type": "chart",
                                    "position": {"x": 500, "y": 180},
                                    "size": {"width": 600, "height": 360},
                                    "chart_type": "bar",
                                    "colors": ["#2563EB", "#14B8A6", "#F59E0B"],
                                    "decorative": False,
                                    "name": "chart",
                                },
                            ],
                        }
                    ],
                },
                {
                    "id": "content_cards",
                    "description": "Content cards arranged over a light neutral surface",
                    "components": [
                        {
                            "id": "main",
                            "description": "Full slide background and repeated card surfaces",
                            "position": {"x": 0, "y": 0},
                            "elements": [
                                {
                                    "type": "container",
                                    "position": {"x": 0, "y": 0},
                                    "size": {"width": 1280, "height": 720},
                                    "fill": {"color": "#F9FBFD"},
                                },
                                {
                                    "type": "container",
                                    "position": {"x": 100, "y": 150},
                                    "size": {"width": 420, "height": 300},
                                    "fill": {"color": "#FFFFFF"},
                                    "stroke": {"color": "#CBD5E1", "width": 1},
                                    "child": {
                                        "type": "text",
                                        "position": {"x": 24, "y": 24},
                                        "size": {"width": 360, "height": 80},
                                        "font": {
                                            "family": "Inter",
                                            "size": 24,
                                            "color": "#111827",
                                        },
                                        "runs": [{"text": "Example card"}],
                                        "decorative": False,
                                        "name": "card_title",
                                        "min_length": 1,
                                        "max_length": 60,
                                    },
                                },
                            ],
                        }
                    ],
                },
            ]
        }
    )


def test_theme_profile_is_compact_and_merges_near_colors():
    profile = build_theme_profile(
        _generated_layouts(), {"Inter": "https://cdn.example.com/inter.woff2"}
    )
    colors = {color.hex: color for color in profile.colors}

    assert "#F8FAFC" in colors
    assert "#F9FBFD" not in colors
    assert colors["#F8FAFC"].slide_count == 2
    assert colors["#F8FAFC"].fill_area == 2.0
    assert colors["#2563EB"].chart_count == 1
    assert profile.fonts[0].url == "https://cdn.example.com/inter.woff2"
    assert any(pair.contrast >= 4.5 for pair in profile.color_pairs)

    serialized = json.dumps(profile.model_dump(mode="json"))
    assert "Example title" not in serialized
    assert "components" not in serialized


def test_materialize_theme_repairs_contrast_and_completes_graph_colors():
    profile = build_theme_profile(
        _generated_layouts(), {"Inter": "https://cdn.example.com/inter.woff2"}
    )
    ids = {color.hex: color.id for color in profile.colors}
    theme = materialize_theme(
        profile,
        ThemeRoleSelection(
            primary=ids["#2563EB"],
            background=ids["#F8FAFC"],
            card=ids["#F8FAFC"],
            stroke=ids["#F8FAFC"],
            background_text=ids["#2563EB"],
            primary_text=ids["#2563EB"],
            graph_colors=[ids["#2563EB"], ids["#14B8A6"]],
            text_font=profile.fonts[0].id,
        ),
    )
    colors = theme.colors.model_dump()

    assert contrast_ratio(colors["background_text"], colors["background"]) >= 4.5
    assert contrast_ratio(colors["primary_text"], colors["primary"]) >= 4.5
    assert colors["card"] != colors["background"]
    assert colors["stroke"] != colors["background"]
    assert len({colors[f"graph_{index}"] for index in range(10)}) == 10


def test_llm_receives_only_compact_profile(monkeypatch):
    profile = build_theme_profile(
        _generated_layouts(), {"Inter": "https://cdn.example.com/inter.woff2"}
    )
    color_ids = [color.id for color in profile.colors]
    captured = {}

    def fake_generate(**kwargs):
        captured.update(kwargs)
        return {
            "primary": color_ids[1],
            "background": color_ids[0],
            "card": color_ids[0],
            "stroke": color_ids[-1],
            "background_text": color_ids[-1],
            "primary_text": color_ids[0],
            "graph_colors": color_ids[1:4] or [color_ids[0]],
            "text_font": profile.fonts[0].id,
        }

    monkeypatch.setattr("templates.v2.generation._generate_with_validation_retries", fake_generate)
    monkeypatch.setattr("templates.v2.theme.get_client", lambda **_kwargs: object())
    monkeypatch.setattr("templates.v2.theme.get_llm_config", lambda: object())
    monkeypatch.setattr("templates.v2.theme.get_model", lambda: "test-model")

    select_theme_roles_with_llm(profile)

    prompt_payload = captured["messages"][1].content
    assert "components" not in prompt_payload
    assert "Example title" not in prompt_payload
    assert "https://" not in prompt_payload
    assert captured["max_tokens"] == 2000


def test_generation_falls_back_and_theme_wraps_for_presentation(monkeypatch):
    monkeypatch.setattr(
        "templates.v2.theme.select_theme_roles_with_llm",
        lambda _profile: (_ for _ in ()).throw(RuntimeError("unavailable")),
    )
    theme = generate_template_theme(
        _generated_layouts(), {"Inter": "https://cdn.example.com/inter.woff2"}
    )
    template = TemplateV2(
        id="template-one",
        name="Brand Template",
        theme=theme.model_dump(mode="json"),
    )
    wrapped = template_theme_for_presentation(
        template_id=template.id,
        template_name=template.name,
        template_description=template.description,
        theme=template.theme,
    )

    assert wrapped["name"] == "Brand Template Theme"
    assert wrapped["data"] == theme.model_dump(mode="json")
    assert wrapped["source"] == "template"
    assert select_theme_roles_deterministically(
        build_theme_profile(_generated_layouts())
    ).primary
