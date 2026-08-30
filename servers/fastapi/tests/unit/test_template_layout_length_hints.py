from templates.v2.models.layouts import (
    MergedComponents,
    SlideLayout,
    slide_layout_llm_json_schema,
)


def _long_component() -> dict:
    return {
        "id": "c" * 81,
        "description": "component " * 40,
        "position": {"x": 0, "y": 0},
        "elements": [
            {
                "type": "image",
                "data": "/image.png",
                "decorative": True,
                "name": "background",
                "is_icon": False,
            }
        ],
    }


def test_layout_models_do_not_validate_id_or_description_lengths():
    component = _long_component()
    layout = SlideLayout.model_validate(
        {
            "id": "l" * 81,
            "description": "layout " * 50,
            "components": [component],
        }
    )
    merged = MergedComponents.model_validate(
        {
            "components": [
                {
                    "id": "m" * 81,
                    "description": "merged " * 50,
                    "variants": [component],
                }
            ]
        }
    )

    assert len(layout.id) == 81
    assert len(layout.components[0].description) > 300
    assert len(merged.components[0].id) == 81
    assert len(merged.components[0].description) > 300


def test_layout_length_limits_exist_only_in_llm_output_schema():
    runtime_schema = SlideLayout.model_json_schema()
    llm_schema = slide_layout_llm_json_schema()

    assert "minLength" not in runtime_schema["properties"]["id"]
    assert "maxLength" not in runtime_schema["properties"]["description"]
    assert llm_schema["properties"]["id"]["minLength"] == 1
    assert llm_schema["properties"]["id"]["maxLength"] == 80
    assert llm_schema["properties"]["description"]["minLength"] == 10
    assert llm_schema["properties"]["description"]["maxLength"] == 300
    component = llm_schema["$defs"]["Component"]["properties"]
    assert component["id"]["minLength"] == 1
    assert component["id"]["maxLength"] == 80
    assert component["description"]["minLength"] == 10
    assert component["description"]["maxLength"] == 300
