import asyncio
import copy
import json
import uuid
from unittest.mock import AsyncMock, patch

from llmai.shared import AssistantToolCall  # type: ignore[import-not-found]

from constants.presentation import MAX_NUMBER_OF_SLIDES, MAX_OUTLINE_CONTENT_WORDS
from models.sql.presentation import PresentationModel, PresentationVersion
from models.sql.slide import SlideModel
from services.chat.memory_layer import PresentationChatMemoryLayer
from services.chat.tools import ChatTools
from utils.outline_limits import count_outline_words


def _run(coro):
    return asyncio.run(coro)


def _slide_ui():
    return {
        "id": "intro",
        "description": "Intro slide layout for chat ui testing.",
        "components": [
            {
                "id": "hero",
                "description": "Hero title component for testing.",
                "position": {"x": 0, "y": 0},
                "elements": [
                    {
                        "type": "text",
                        "decorative": False,
                        "name": "Title",
                        "position": {"x": 0, "y": 0},
                        "size": {"width": 100, "height": 40},
                        "max_length": 100,
                        "min_length": 1,
                        "runs": [
                            {
                                "text": "Old title",
                                "font": {"size": 20, "family": "Inter"},
                            }
                        ],
                    }
                ],
            },
            {
                "id": "body",
                "description": "Body list component for testing.",
                "position": {"x": 0, "y": 50},
                "elements": [
                    {
                        "type": "text-list",
                        "decorative": False,
                        "name": "Bullets",
                        "position": {"x": 0, "y": 0},
                        "size": {"width": 100, "height": 60},
                        "max_items": 6,
                        "min_items": 1,
                        "max_item_length": 80,
                        "min_item_length": 1,
                        "items": [[{"text": "First point"}]],
                    }
                ],
            },
        ],
    }


def _slide():
    return SlideModel(
        id=uuid.uuid4(),
        presentation=uuid.uuid4(),
        layout_group="custom-x",
        layout="intro",
        index=0,
        content={},
        properties=None,
        ui=_slide_ui(),
    )


class _FakeSlideSession:
    def __init__(self, slide: SlideModel):
        self.slide = slide
        self.presentation = PresentationModel(
            id=slide.presentation,
            version=PresentationVersion.V1_STANDARD,
            content="deck",
            n_slides=1,
            language="English",
            theme={
                "id": "test-theme",
                "name": "Test Theme",
                "data": {
                    "colors": {
                        "background_text": "#111827",
                        "stroke": "#E5E7EB",
                        "graph_0": "#123456",
                        "graph_1": "#234567",
                        "graph_2": "#345678",
                    }
                },
            },
        )
        self.commit_count = 0
        self.added: list = []

    async def scalar(self, *_args, **_kwargs):
        return self.slide

    async def get(self, model, key):
        if model is PresentationModel and key == self.presentation.id:
            return self.presentation
        return None

    def add(self, obj):
        self.added.append(obj)

    async def commit(self):
        self.commit_count += 1

    async def refresh(self, _obj):
        return None


def _tools(slide: SlideModel) -> tuple[ChatTools, _FakeSlideSession]:
    session = _FakeSlideSession(slide)
    memory = PresentationChatMemoryLayer(session, slide.presentation)
    return ChatTools(memory), session


def _call(tools: ChatTools, name: str, arguments: dict):
    return _run(
        tools.execute_tool_call(
            AssistantToolCall(id="call_1", name=name, arguments=json.dumps(arguments))
        )
    )


def _set_reusable_table_layout(session: _FakeSlideSession):
    session.presentation.layout = {
        "name": "custom-test",
        "layouts": [
            {
                "id": "comparison",
                "description": "Comparison slide with reusable blocks.",
                "components": [
                    {
                        "id": "table_card",
                        "description": "Styled comparison table block.",
                        "position": {"x": 120, "y": 140},
                        "size": {"width": 900, "height": 360},
                        "elements": [{"type": "table", "name": "Comparison table"}],
                    },
                ],
            }
        ],
    }


def test_get_slide_elements_reports_editable_layout():
    slide = _slide()
    tools, _ = _tools(slide)

    result = _call(tools, "getSlideAtIndex", {"index": 0, "includeFullContent": True})

    assert result["ok"] is True
    payload = result["result"]["slide"]["ui_summary"]
    assert payload["editable"] is True
    assert payload["component_count"] == 2
    assert payload["editable_count"] == 2
    paths = {element["path"] for element in payload["elements"]}
    assert "components[0].elements[0]" in paths
    title = next(
        element
        for element in payload["elements"]
        if element["path"] == "components[0].elements[0]"
    )
    assert title["style"] == {"font": {"size": 20, "family": "Inter"}}


def test_get_available_blocks_returns_matching_block_summary_only():
    slide = _slide()
    tools, session = _tools(slide)
    session.presentation.layout = {
        "name": "custom-test",
        "layouts": [
            {
                "id": "comparison",
                "description": "Comparison slide with reusable blocks.",
                "components": [
                    {
                        "id": "title_block",
                        "description": "Simple title block.",
                        "position": {"x": 80, "y": 40},
                        "size": {"width": 600, "height": 80},
                        "elements": [{"type": "text", "name": "Title"}],
                    },
                    {
                        "id": "table_card",
                        "description": "Styled comparison table block.",
                        "position": {"x": 120, "y": 140},
                        "size": {"width": 900, "height": 360},
                        "elements": [{"type": "table", "name": "Comparison table"}],
                    },
                ],
            }
        ],
    }

    result = _call(
        tools,
        "getAvailableBlocks",
        {
            "query": "table",
            "layoutId": None,
            "elementType": "table",
            "blockId": None,
            "includeFullContent": False,
            "maxResults": 10,
        },
    )

    assert result["ok"] is True
    payload = result["result"]
    assert payload["found"] is True
    assert payload["count"] == 1
    block = payload["blocks"][0]
    assert block["block_id"] == "layout:comparison:table_card"
    assert block["layout_id"] == "comparison"
    assert block["component_id"] == "table_card"
    assert block["element_types"] == ["table"]
    assert block["element_names"] == ["Comparison table"]
    assert "component" not in block


def test_get_available_blocks_matches_title_element_names():
    slide = _slide()
    tools, session = _tools(slide)
    session.presentation.layout = {
        "name": "custom-test",
        "layouts": [
            {
                "id": "metrics",
                "description": "Metrics slide with reusable components.",
                "components": [
                    {
                        "id": "masthead",
                        "description": "Styled text component.",
                        "position": {"x": 72, "y": 48},
                        "size": {"width": 720, "height": 96},
                        "elements": [{"type": "text", "name": "Title"}],
                    },
                    {
                        "id": "body_copy",
                        "description": "Styled body copy component.",
                        "position": {"x": 72, "y": 160},
                        "size": {"width": 720, "height": 160},
                        "elements": [{"type": "text", "name": "Body"}],
                    },
                ],
            }
        ],
    }

    result = _call(
        tools,
        "getAvailableBlocks",
        {
            "query": "title",
            "layoutId": None,
            "elementType": "text",
            "blockId": None,
            "includeFullContent": False,
            "maxResults": 10,
        },
    )

    assert result["ok"] is True
    payload = result["result"]
    assert payload["found"] is True
    assert payload["count"] == 1
    block = payload["blocks"][0]
    assert block["block_id"] == "layout:metrics:masthead"
    assert block["element_types"] == ["text"]
    assert block["element_names"] == ["Title"]


def test_get_available_blocks_can_return_exact_block_json():
    slide = _slide()
    tools, session = _tools(slide)
    _set_reusable_table_layout(session)

    result = _call(
        tools,
        "getAvailableBlocks",
        {
            "query": None,
            "layoutId": None,
            "elementType": None,
            "blockId": "layout:comparison:table_card",
            "includeFullContent": True,
            "maxResults": 1,
        },
    )

    assert result["ok"] is True
    block = result["result"]["blocks"][0]
    assert block["component"]["id"] == "table_card"
    assert block["component"]["elements"][0]["type"] == "table"


def test_add_slide_element_requires_reusable_table_block_when_available():
    slide = _slide()
    tools, session = _tools(slide)
    _set_reusable_table_layout(session)
    table = {
        "type": "table",
        "name": "Plain table",
        "columns": ["Metric", "Value"],
        "rows": [["PM2.5", "39%"]],
    }

    result = _call(
        tools,
        "addElement",
        {"index": 0, "element": json.dumps(table)},
    )

    assert result["ok"] is False
    assert "Reusable block available for table insertion" in result["error"]
    assert "getAvailableBlocks" in result["recovery"]["guidance"][0]
    assert len(slide.ui["components"]) == 2
    assert session.commit_count == 0


def test_add_slide_component_requires_source_block_for_table_when_available():
    slide = _slide()
    tools, session = _tools(slide)
    _set_reusable_table_layout(session)
    component = {
        "id": "plain_table",
        "description": "Plain primitive table component.",
        "position": {"x": 100, "y": 100},
        "size": {"width": 900, "height": 300},
        "elements": [
            {
                "type": "table",
                "name": "Plain table",
                "columns": ["Metric", "Value"],
                "rows": [["PM2.5", "39%"]],
            }
        ],
    }

    result = _call(
        tools,
        "addComponent",
        {"index": 0, "component": json.dumps(component)},
    )

    assert result["ok"] is False
    assert "sourceBlockId='layout:comparison:table_card'" in result["error"]
    assert len(slide.ui["components"]) == 2
    assert session.commit_count == 0


def test_add_slide_component_accepts_source_block_for_table():
    slide = _slide()
    tools, session = _tools(slide)
    _set_reusable_table_layout(session)
    component = {
        "id": "table_card",
        "description": "Styled comparison table block.",
        "position": {"x": 120, "y": 140},
        "size": {"width": 900, "height": 360},
        "elements": [
            {
                "type": "table",
                "name": "Comparison table",
                "columns": ["Metric", "Value"],
                "rows": [["PM2.5", "39%"]],
            }
        ],
    }

    result = _call(
        tools,
        "addComponent",
        {
            "index": 0,
            "component": json.dumps(component),
            "sourceBlockId": "layout:comparison:table_card",
        },
    )

    assert result["ok"] is True
    assert result["result"]["added"] is True
    assert slide.ui["components"][-1]["id"] == "table_card"
    assert session.commit_count == 1


def test_update_slide_element_edits_ui_text():
    slide = _slide()
    tools, session = _tools(slide)

    result = _call(
        tools,
        "updateElement",
        {
            "index": 0,
            "elementPath": "components[0].elements[0]",
            "text": "New title",
        },
    )

    assert result["ok"] is True
    assert result["result"]["updated"] is True
    element = slide.ui["components"][0]["elements"][0]
    assert element["runs"][0]["text"] == "New title"
    # The renderer reads the flattened top-level `text` in preference to `runs`,
    # so it must be kept in sync or the edit is invisible / gets reverted.
    assert element["text"] == "New title"
    assert session.commit_count == 1


def test_update_slide_element_accepts_stringified_null_optionals():
    slide = _slide()
    tools, session = _tools(slide)

    result = _call(
        tools,
        "updateElement",
        {
            "index": 0,
            "elementPath": "components[0].elements[0]",
            "text": "New title",
            "items": "null",
            "tableCell": "null",
            "chart": "null",
            "table": "null",
            "element": "null",
            "position": "null",
            "size": "null",
        },
    )

    assert result["ok"] is True
    assert result["result"]["updated"] is True
    assert slide.ui["components"][0]["elements"][0]["text"] == "New title"
    assert session.commit_count == 1


def _slide_with_image():
    slide = _slide()
    slide.ui["components"].append(
        {
            "id": "visual",
            "description": "Hero image component.",
            "position": {"x": 0, "y": 120},
            "size": {"width": 100, "height": 80},
            "elements": [
                {
                    "type": "image",
                    "decorative": False,
                    "name": "Hero image",
                    "data": "/static/images/placeholder.jpg",
                    "is_icon": False,
                }
            ],
        }
    )
    return slide


def test_update_slide_element_moves_image_without_content_fields():
    slide = _slide_with_image()
    tools, session = _tools(slide)

    result = _call(
        tools,
        "updateElement",
        {
            "index": 0,
            "elementPath": "components[2].elements[0]",
            "text": None,
            "items": None,
            "tableCell": None,
            "chart": None,
            "table": None,
            "position": {"x": 12, "y": 34},
            "size": None,
        },
    )

    image = slide.ui["components"][2]["elements"][0]
    assert result["ok"] is True
    assert result["result"]["updated"] is True
    assert image["position"] == {"x": 12.0, "y": 34.0}
    assert image["data"] == "/static/images/placeholder.jpg"
    assert session.commit_count == 1


def test_update_slide_element_sets_image_url_from_text():
    slide = _slide_with_image()
    tools, session = _tools(slide)

    result = _call(
        tools,
        "updateElement",
        {
            "index": 0,
            "elementPath": "components[2].elements[0]",
            "text": "/app_data/images/glacier.png",
        },
    )

    image = slide.ui["components"][2]["elements"][0]
    assert result["ok"] is True
    assert image["data"].endswith("/app_data/images/glacier.png")
    assert session.commit_count == 1


@patch.object(PresentationChatMemoryLayer, "generate_image", new_callable=AsyncMock)
def test_update_slide_element_generates_image_from_prompt(mock_generate_image):
    mock_generate_image.return_value = "/app_data/images/generated.png"
    slide = _slide_with_image()
    tools, session = _tools(slide)

    result = _call(
        tools,
        "updateElement",
        {
            "index": 0,
            "elementPath": "components[2].elements[0]",
            "text": "Melting glacier aerial photo",
        },
    )

    image = slide.ui["components"][2]["elements"][0]
    assert result["ok"] is True
    assert image["data"] == "/app_data/images/generated.png"
    assert image["prompt"] == "Melting glacier aerial photo"
    mock_generate_image.assert_awaited_once_with("Melting glacier aerial photo")
    assert session.commit_count == 1


def test_update_slide_element_edits_ui_size():
    slide = _slide()
    tools, session = _tools(slide)

    result = _call(
        tools,
        "updateElement",
        {
            "index": 0,
            "elementPath": "components[0].elements[0]",
            "size": {"width": 80, "height": 24},
        },
    )

    assert result["ok"] is True
    assert result["result"]["updated"] is True
    assert slide.ui["components"][0]["elements"][0]["size"] == {
        "width": 80.0,
        "height": 24.0,
    }
    assert session.commit_count == 1


def test_update_slide_element_applies_toolbar_style_patch():
    slide = _slide()
    slide.ui["components"].append(
        {
            "id": "shape-block",
            "description": "Shape block.",
            "position": {"x": 0, "y": 120},
            "size": {"width": 100, "height": 80},
            "elements": [
                {
                    "type": "vector",
                    "shape": "polygon",
                    "points": [
                        {"x": 0, "y": 0},
                        {"x": 100, "y": 0},
                        {"x": 100, "y": 80},
                        {"x": 0, "y": 80},
                    ],
                    "closed": True,
                    "fill": {"color": "#FFFFFF", "opacity": 1},
                    "stroke": {"color": "#111111", "width": 0},
                }
            ],
        }
    )
    tools, session = _tools(slide)

    result = _call(
        tools,
        "updateElement",
        {
            "index": 0,
            "elementPath": "components[2].elements[0]",
            "element": json.dumps(
                {
                    "fill": {"color": "#FF0000", "opacity": 0.5},
                    "stroke": {"width": 2},
                }
            ),
        },
    )

    element = slide.ui["components"][2]["elements"][0]
    assert result["ok"] is True
    assert result["result"]["updated"] is True
    assert element["fill"] == {"color": "#FF0000", "opacity": 0.5}
    assert element["stroke"] == {"color": "#111111", "width": 2}
    assert session.commit_count == 1


def test_update_slide_element_edits_and_resizes_current_vector_model():
    slide = _slide()
    slide.ui["components"].append(
        {
            "id": "vector-block",
            "description": "Editable vector.",
            "position": {"x": 100, "y": 100},
            "elements": [
                {
                    "type": "vector",
                    "shape": "polygon",
                    "points": [
                        {"x": 0, "y": 0},
                        {"x": 100, "y": 0},
                        {"x": 100, "y": 50},
                        {"x": 0, "y": 50},
                    ],
                    "closed": True,
                    "fill": {"color": "#FFFFFF"},
                }
            ],
        }
    )
    tools, session = _tools(slide)

    result = _call(
        tools,
        "updateElement",
        {
            "index": 0,
            "elementPath": "components[2].elements[0]",
            "vector": {
                "shape": "ellipse",
                "points": [
                    {"x": 0, "y": 0},
                    {"x": 100, "y": 0},
                    {"x": 100, "y": 50},
                    {"x": 0, "y": 50},
                ],
                "closed": True,
            },
            "position": {"x": 20, "y": 30},
            "size": {"width": 200, "height": 100},
        },
    )

    vector = slide.ui["components"][2]["elements"][0]
    assert result["ok"] is True
    assert vector["shape"] == "ellipse"
    assert vector["points"] == [
        {"x": 20.0, "y": 30.0},
        {"x": 220.0, "y": 30.0},
        {"x": 220.0, "y": 130.0},
        {"x": 20.0, "y": 130.0},
    ]
    assert "position" not in vector
    assert "size" not in vector
    assert session.commit_count == 1


def test_update_slide_element_edits_current_infographic_model():
    slide = _slide()
    slide.ui["components"].append(
        {
            "id": "progress-block",
            "description": "Editable progress indicator.",
            "elements": [
                {
                    "type": "infographic",
                    "position": {"x": 0, "y": 0},
                    "size": {"width": 420, "height": 74},
                    "data": {
                        "type": "progress_bar",
                        "min_value": 0,
                        "max_value": 100,
                        "value": 40,
                    },
                    "colors": ["#E5E7EB", "#2563EB"],
                }
            ],
        }
    )
    tools, session = _tools(slide)

    result = _call(
        tools,
        "updateElement",
        {
            "index": 0,
            "elementPath": "components[2].elements[0]",
            "infographic": {
                "data": {
                    "type": "gauge",
                    "minValue": 10,
                    "maxValue": 90,
                    "value": 72,
                },
                "colors": ["#D1D5DB", "#16A34A"],
            },
        },
    )

    infographic = slide.ui["components"][2]["elements"][0]
    assert result["ok"] is True
    assert infographic["data"] == {
        "type": "gauge",
        "min_value": 10.0,
        "max_value": 90.0,
        "value": 72.0,
    }
    assert infographic["colors"] == ["#D1D5DB", "#16A34A"]
    assert session.commit_count == 1


def test_update_slide_element_merges_partial_infographic_data():
    slide = _slide()
    slide.ui["components"].append(
        {
            "id": "gauge-block",
            "description": "Editable gauge.",
            "elements": [
                {
                    "type": "infographic",
                    "position": {"x": 0, "y": 0},
                    "size": {"width": 320, "height": 190},
                    "data": {
                        "type": "gauge",
                        "min_value": 0,
                        "max_value": 100,
                        "value": 40,
                    },
                    "colors": ["#E5E7EB", "#2563EB"],
                }
            ],
        }
    )
    tools, session = _tools(slide)

    result = _call(
        tools,
        "updateElement",
        {
            "index": 0,
            "elementPath": "components[2].elements[0]",
            "infographic": {"data": {"value": 75}},
        },
    )

    infographic = slide.ui["components"][2]["elements"][0]
    assert result["ok"] is True
    assert infographic["data"] == {
        "type": "gauge",
        "min_value": 0,
        "max_value": 100,
        "value": 75.0,
    }
    assert session.commit_count == 1


def test_get_slide_elements_exposes_vector_infographic_and_svg_content():
    slide = _slide()
    slide.ui["components"].append(
        {
            "id": "new-elements",
            "description": "Current element models.",
            "elements": [
                {
                    "type": "vector",
                    "points": [{"x": 0, "y": 0}, {"x": 100, "y": 40}],
                    "closed": False,
                    "stroke": {"color": "#111111", "width": 2},
                },
                {
                    "type": "infographic",
                    "position": {"x": 0, "y": 50},
                    "size": {"width": 300, "height": 60},
                    "data": {
                        "type": "progress_bar",
                        "min_value": 0,
                        "max_value": 100,
                        "value": 65,
                    },
                    "colors": ["#EEEEEE", "#008800"],
                },
                {
                    "type": "svg",
                    "position": {"x": 0, "y": 120},
                    "size": {"width": 40, "height": 40},
                    "svg": "<svg></svg>",
                },
            ],
        }
    )
    tools, _ = _tools(slide)

    elements = _call(
        tools,
        "getSlideAtIndex",
        {"index": 0, "includeFullContent": False},
    )["result"]["slide"]["ui_summary"]["elements"]
    by_type = {element["type"]: element for element in elements}

    assert by_type["vector"]["content_editable"] is True
    assert by_type["vector"]["content"]["points"][1] == {"x": 100, "y": 40}
    assert by_type["infographic"]["content_editable"] is True
    assert by_type["infographic"]["content"]["data"]["value"] == 65
    assert by_type["svg"]["geometry_editable"] is True
    assert by_type["svg"]["content"] == {"svg_length": 11}


def test_update_slide_element_applies_text_font_patch_to_runs():
    slide = _slide()
    tools, session = _tools(slide)

    result = _call(
        tools,
        "updateElement",
        {
            "index": 0,
            "elementPath": "components[0].elements[0]",
            "font": {
                "family": "Roboto",
                "size": 36,
                "color": "#FF0000",
                "bold": True,
            },
            "alignment": {"horizontal": "center", "vertical": "middle"},
        },
    )

    element = slide.ui["components"][0]["elements"][0]
    assert result["ok"] is True
    assert result["result"]["updated"] is True
    assert element["font"] == {
        "family": "Roboto",
        "size": 36.0,
        "color": "#FF0000",
        "bold": True,
    }
    assert element["alignment"] == {"horizontal": "center", "vertical": "middle"}
    assert element["runs"][0]["text"] == "Old title"
    assert element["runs"][0]["font"] == {
        "size": 36.0,
        "family": "Roboto",
        "color": "#FF0000",
        "bold": True,
    }
    assert session.commit_count == 1


def test_update_slide_element_raw_font_patch_updates_text_runs():
    slide = _slide()
    tools, session = _tools(slide)

    result = _call(
        tools,
        "updateElement",
        {
            "index": 0,
            "elementPath": "components[0].elements[0]",
            "element": json.dumps(
                {
                    "font": {
                        "size": 44,
                        "color": "#00AAFF",
                    }
                }
            ),
        },
    )

    element = slide.ui["components"][0]["elements"][0]
    assert result["ok"] is True
    assert element["font"] == {"size": 44, "color": "#00AAFF"}
    assert element["runs"][0]["font"] == {
        "size": 44,
        "family": "Inter",
        "color": "#00AAFF",
    }
    assert session.commit_count == 1


def test_update_slide_element_accepts_common_text_style_aliases():
    slide = _slide()
    tools, session = _tools(slide)

    result = _call(
        tools,
        "updateElement",
        {
            "index": 0,
            "elementPath": "components[0].elements[0]",
            "fontSize": 28,
            "fontColor": "#22C55E",
            "fontFamily": "Inter Tight",
            "textAlign": "right",
        },
    )

    element = slide.ui["components"][0]["elements"][0]
    assert result["ok"] is True
    assert element["font"] == {
        "size": 28.0,
        "color": "#22C55E",
        "family": "Inter Tight",
    }
    assert element["alignment"] == {"horizontal": "right"}
    assert element["runs"][0]["font"] == {
        "size": 28.0,
        "family": "Inter Tight",
        "color": "#22C55E",
    }
    assert session.commit_count == 1


def test_update_slide_element_updates_math_latex_and_style():
    slide = _slide()
    slide.ui["components"].append(
        {
            "id": "formula",
            "description": "Editable equation.",
            "elements": [
                {
                    "type": "math",
                    "decorative": False,
                    "name": "Formula",
                    "latex": "E = mc^2",
                    "position": {"x": 0, "y": 0},
                    "size": {"width": 600, "height": 120},
                    "font": {"size": 36, "color": "#111827"},
                    "alignment": {
                        "horizontal": "center",
                        "vertical": "middle",
                    },
                }
            ],
        }
    )
    tools, session = _tools(slide)

    result = _call(
        tools,
        "updateElement",
        {
            "index": 0,
            "elementPath": "components[2].elements[0]",
            "text": r"$$\frac{x_i^2}{n}$$",
            "fontSize": 42,
            "fontColor": "#7C3AED",
            "textAlign": "left",
        },
    )

    element = slide.ui["components"][2]["elements"][0]
    assert result["ok"] is True
    assert element["latex"] == r"\frac{x_i^2}{n}"
    assert element["font"] == {"size": 42.0, "color": "#7C3AED"}
    assert element["alignment"] == {
        "horizontal": "left",
        "vertical": "middle",
    }
    assert session.commit_count == 1


def test_update_slide_element_text_list_color_updates_item_runs():
    slide = _slide()
    tools, session = _tools(slide)

    result = _call(
        tools,
        "updateElement",
        {
            "index": 0,
            "elementPath": "components[1].elements[0]",
            "color": "#7C3AED",
            "fontSize": 22,
        },
    )

    element = slide.ui["components"][1]["elements"][0]
    assert result["ok"] is True
    assert element["font"] == {"size": 22.0, "color": "#7C3AED"}
    assert element["items"][0][0]["font"] == {"size": 22.0, "color": "#7C3AED"}
    assert session.commit_count == 1


def test_get_slide_elements_reports_visible_flex_and_resizes_it():
    slide = _slide()
    slide.ui["components"].append(
        {
            "id": "cards",
            "description": "Visible card row.",
            "elements": [
                {
                    "type": "flex",
                    "name": "Cards",
                    "direction": "row",
                    "min_children": 1,
                    "max_children": 3,
                    "position": {"x": 10, "y": 20},
                    "size": {"width": 300, "height": 120},
                    "children": [
                        {
                            "type": "text",
                            "decorative": False,
                            "name": "Card title",
                            "min_length": 1,
                            "max_length": 80,
                            "runs": [{"text": "Old card"}],
                        }
                    ],
                }
            ],
        }
    )
    tools, session = _tools(slide)

    elements = _call(
        tools,
        "getSlideAtIndex",
        {"index": 0, "includeFullContent": True},
    )["result"]["slide"]["ui_summary"]["elements"]
    by_path = {element["path"]: element for element in elements}

    flex = by_path["components[2].elements[0]"]
    child = by_path["components[2].elements[0].children[0]"]
    assert flex["type"] == "flex"
    assert flex["content_editable"] is False
    assert flex["geometry_editable"] is True
    assert child["type"] == "text"
    assert child["content_editable"] is True

    result = _call(
        tools,
        "updateElement",
        {
            "index": 0,
            "elementPath": "components[2].elements[0]",
            "size": {"width": 280, "height": 100},
        },
    )

    assert result["ok"] is True
    assert slide.ui["components"][2]["elements"][0]["size"] == {
        "width": 280.0,
        "height": 100.0,
    }
    assert session.commit_count == 1


def test_update_slide_element_updates_new_chart_model_fields():
    slide = _slide()
    slide.ui["components"].append(
        {
            "id": "chart-block",
            "description": "Chart block.",
            "elements": [
                {
                    "type": "chart",
                    "decorative": False,
                    "name": "Emissions chart",
                    "chart_type": "bar",
                    "categories": ["CO2"],
                    "series": [{"name": "2024", "values": [36.4]}],
                }
            ],
        }
    )
    tools, session = _tools(slide)

    result = _call(
        tools,
        "updateElement",
        {
            "index": 0,
            "elementPath": "components[2].elements[0]",
            "chart": {
                "chartType": "line",
                "title": "GHG Emissions 2024-2025",
                "titleColor": "#102030",
                "legendColor": "#405060",
                "categories": ["CO2", "CH4", "N2O"],
                "series": [
                    {"name": "2024 Gt", "values": [36.4, 2.1, 0.8]},
                    {"name": "2025 Gt", "values": [36.7, 2.3, 0.84]},
                ],
                "dataLabels": "top",
                "legend": True,
                "xAxisTitle": "Gas",
                "yAxisTitle": "Emissions (Gt)",
            },
        },
    )

    chart = slide.ui["components"][2]["elements"][0]
    assert result["ok"] is True
    assert chart["chart_type"] == "line"
    assert chart["title"] == "GHG Emissions 2024-2025"
    assert chart["title_color"] == "#102030"
    assert chart["legend_color"] == "#405060"
    assert chart["series"][0]["values"] == [36.4, 2.1, 0.8]
    assert chart["data_labels"] == "top"
    assert chart["legend"] is True
    assert chart["x_axis_title"] == "Gas"
    assert chart["y_axis_title"] == "Emissions (Gt)"
    assert chart["colors"][:3] == ["#123456", "#234567", "#345678"]
    assert session.commit_count == 1


def test_update_slide_element_accepts_whole_table_payload():
    slide = _slide()
    slide.ui["components"].append(
        {
            "id": "table-block",
            "description": "Table block.",
            "elements": [
                {
                    "type": "table",
                    "decorative": False,
                    "name": "Emissions table",
                    "columns": [
                        {"runs": [{"text": "Old metric", "font": {"size": 12}}]},
                        {"runs": [{"text": "Old value", "font": {"size": 12}}]},
                    ],
                    "rows": [[{"runs": [{"text": "Old"}]}, {"runs": [{"text": "0"}]}]],
                    "min_columns": 2,
                    "max_columns": 3,
                    "min_rows": 1,
                    "max_rows": 4,
                }
            ],
        }
    )
    tools, session = _tools(slide)

    result = _call(
        tools,
        "updateElement",
        {
            "index": 0,
            "elementPath": "components[2].elements[0]",
            "table": {
                "headers": ["Metric", "2024 Gt", "2025 Gt"],
                "rows": [
                    ["CO2", "36.4", "36.7"],
                    ["CH4", "2.1", "2.3"],
                    ["N2O", "0.8", "0.84"],
                ],
            },
        },
    )

    table = slide.ui["components"][2]["elements"][0]
    assert result["ok"] is True
    assert [cell["runs"][0]["text"] for cell in table["columns"]] == [
        "Metric",
        "2024 Gt",
        "2025 Gt",
    ]
    assert table["rows"][2][2]["runs"][0]["text"] == "0.84"
    assert table["columns"][0]["runs"][0]["font"] == {"size": 12}
    assert session.commit_count == 1


def test_update_slide_component_scales_ui_contents():
    slide = _slide()
    tools, session = _tools(slide)

    result = _call(
        tools,
        "updateComponent",
        {
            "index": 0,
            "componentId": "hero",
            "size": {"width": 70, "height": 30},
        },
    )

    assert result["ok"] is True
    assert result["result"]["updated"] is True
    assert "size" not in slide.ui["components"][0]
    assert result["result"]["box"] == {
        "x": 0.0,
        "y": 0.0,
        "width": 70.0,
        "height": 30.0,
    }
    assert slide.ui["components"][0]["elements"][0]["size"] == {
        "width": 70.0,
        "height": 30.0,
    }
    assert session.commit_count == 1


def test_update_component_resize_scales_standalone_chart_contents():
    slide = _slide()
    slide.ui["components"] = [
        {
            "id": "line-chart",
            "description": "Line Chart",
            "position": {"x": 371, "y": 155},
            "elements": [
                {
                    "type": "chart",
                    "position": {"x": 0, "y": 0},
                    "size": {"width": 538, "height": 410},
                    "chart_type": "line",
                    "categories": ["Q1", "Q2"],
                    "series": [{"name": "Revenue", "values": [10, 20]}],
                }
            ],
        },
        {
            "id": "thank-you",
            "description": "Thank You heading",
            "position": {"x": 400, "y": 60},
            "elements": [
                {
                    "type": "text",
                    "position": {"x": 0, "y": 0},
                    "size": {"width": 480, "height": 80},
                    "runs": [{"text": "Thank You"}],
                }
            ],
        },
    ]
    untouched_heading = json.loads(json.dumps(slide.ui["components"][1]))
    tools, session = _tools(slide)

    result = _call(
        tools,
        "updateComponent",
        {
            "index": 0,
            "componentId": "line-chart",
            "action": "update",
            "position": {"x": 0, "y": 0},
            "size": {"width": 1280, "height": 720},
        },
    )

    chart_component = slide.ui["components"][0]
    chart = chart_component["elements"][0]
    assert result["ok"] is True
    assert chart_component["position"] == {"x": 0.0, "y": 0.0}
    assert "size" not in chart_component
    assert chart["position"] == {"x": 0.0, "y": 0.0}
    assert chart["size"] == {"width": 1280.0, "height": 720.0}
    assert slide.ui["components"][1] == untouched_heading
    assert session.commit_count == 1


def test_update_component_groups_components():
    slide = _slide()
    tools, session = _tools(slide)

    result = _call(
        tools,
        "updateComponent",
        {
            "index": 0,
            "componentId": "hero",
            "action": "group",
            "componentIds": ["hero", "body"],
        },
    )

    component = slide.ui["components"][0]
    assert result["ok"] is True
    assert result["result"]["updated"] is True
    assert result["result"]["action"] == "grouped"
    assert component["id"] == "hero"
    assert component["position"] == {"x": 0.0, "y": 0.0}
    assert "size" not in component
    assert len(component["elements"]) == 2
    assert [item["id"] for item in slide.ui["components"]] == ["hero"]
    assert session.commit_count == 1


def test_update_component_ungroups_component():
    slide = _slide()
    slide.ui["components"] = [
        {
            "id": "combo",
            "description": "Two element group.",
            "position": {"x": 10, "y": 20},
            "elements": [
                {
                    "type": "text",
                    "name": "Heading",
                    "position": {"x": 0, "y": 0},
                    "size": {"width": 120, "height": 30},
                    "runs": [{"text": "Heading"}],
                },
                {
                    "type": "text",
                    "name": "Body",
                    "position": {"x": 0, "y": 40},
                    "size": {"width": 180, "height": 40},
                    "runs": [{"text": "Body"}],
                },
            ],
        }
    ]
    tools, session = _tools(slide)

    result = _call(
        tools,
        "updateComponent",
        {"index": 0, "componentId": "combo", "action": "ungroup"},
    )

    assert result["ok"] is True
    assert result["result"]["updated"] is True
    assert result["result"]["action"] == "ungrouped"
    assert result["result"]["created_component_ids"] == ["combo_part_1", "combo_part_2"]
    assert [item["id"] for item in slide.ui["components"]] == [
        "combo_part_1",
        "combo_part_2",
    ]
    assert slide.ui["components"][1]["position"] == {"x": 10.0, "y": 60.0}
    assert session.commit_count == 1


def test_update_component_ungroups_container_child():
    slide = _slide()
    slide.ui["components"] = [
        {
            "id": "card",
            "description": "Container card.",
            "position": {"x": 20, "y": 30},
            "elements": [
                {
                    "type": "container",
                    "fill": {"color": "#FFFFFF"},
                    "padding": {"left": 12, "top": 8, "right": 12, "bottom": 8},
                    "position": {"x": 0, "y": 0},
                    "size": {"width": 240, "height": 120},
                    "child": {
                        "type": "text",
                        "name": "Card title",
                        "runs": [{"text": "Nested title"}],
                    },
                }
            ],
        }
    ]
    tools, session = _tools(slide)

    result = _call(
        tools,
        "updateComponent",
        {"index": 0, "componentId": "card", "action": "ungroup"},
    )

    assert result["ok"] is True
    assert result["result"]["updated"] is True
    assert result["result"]["created_component_ids"] == [
        "card_part_1",
    ]
    assert slide.ui["components"][0]["position"] == {"x": 32.0, "y": 38.0}
    assert "size" not in slide.ui["components"][0]
    assert slide.ui["components"][0]["elements"][0]["size"] == {
        "width": 216.0,
        "height": 104.0,
    }
    assert slide.ui["components"][0]["elements"][0]["type"] == "text"
    assert slide.ui["components"][0]["elements"][0]["runs"] == [
        {"text": "Nested title"}
    ]
    assert session.commit_count == 1


def test_update_component_ungroups_one_level_for_flex_group_children():
    slide = _slide()
    slide.ui["components"] = [
        {
            "id": "cards",
            "description": "Flex with grouped children.",
            "position": {"x": 10, "y": 20},
            "elements": [
                {
                    "type": "flex",
                    "direction": "row",
                    "gap": 10,
                    "position": {"x": 0, "y": 0},
                    "size": {"width": 300, "height": 100},
                    "children": [
                        {
                            "type": "group",
                            "name": "Left card",
                            "elements": [
                                {
                                    "type": "text",
                                    "name": "Left title",
                                    "position": {"x": 8, "y": 10},
                                    "size": {"width": 120, "height": 24},
                                    "runs": [{"text": "Left"}],
                                }
                            ],
                        },
                        {
                            "type": "group",
                            "name": "Right card",
                            "elements": [
                                {
                                    "type": "text",
                                    "name": "Right title",
                                    "position": {"x": 8, "y": 10},
                                    "size": {"width": 120, "height": 24},
                                    "runs": [{"text": "Right"}],
                                }
                            ],
                        },
                    ],
                }
            ],
        }
    ]
    tools, session = _tools(slide)

    result = _call(
        tools,
        "updateComponent",
        {"index": 0, "componentId": "cards", "action": "ungroup"},
    )

    assert result["ok"] is True
    assert result["result"]["updated"] is True
    assert result["result"]["created_component_ids"] == [
        "cards_part_1",
        "cards_part_2",
    ]
    assert [item["id"] for item in slide.ui["components"]] == [
        "cards_part_1",
        "cards_part_2",
    ]
    assert slide.ui["components"][0]["position"] == {"x": 10.0, "y": 20.0}
    assert "size" not in slide.ui["components"][0]
    assert slide.ui["components"][0]["elements"][0]["size"] == {
        "width": 145.0,
        "height": 100.0,
    }
    assert slide.ui["components"][1]["position"] == {"x": 165.0, "y": 20.0}
    assert slide.ui["components"][1]["elements"][0]["type"] == "group"
    assert slide.ui["components"][1]["elements"][0]["elements"] == [
        {
            "type": "text",
            "name": "Right title",
            "position": {"x": 8, "y": 10},
            "size": {"width": 120, "height": 24},
            "runs": [{"text": "Right"}],
        }
    ]
    assert session.commit_count == 1


def test_update_component_ungroups_grid_immediate_children_only():
    slide = _slide()
    feature_item = {
        "type": "flex",
        "size": {"width": 310, "height": 100.25},
        "direction": "row",
        "gap": 16,
        "children": [
            {
                "type": "container",
                "size": {"width": 48, "height": 48},
                "fill": {"color": "#9333EA", "opacity": 1},
                "child": {
                    "type": "image",
                    "size": {"width": 24, "height": 24},
                    "data": "/static/icons/bold/messenger-logo-bold.svg",
                    "name": "feature_icon",
                },
            },
            {
                "type": "flex",
                "size": {"width": 246, "height": 96.25},
                "direction": "column",
                "gap": 4,
                "children": [
                    {
                        "type": "text",
                        "size": {"width": 246, "height": 28},
                        "runs": [{"text": "Fine PM2.5"}],
                        "name": "feature_heading",
                    },
                    {
                        "type": "text",
                        "size": {"width": 246, "height": 68.25},
                        "runs": [{"text": "Tiny particles enter lungs."}],
                        "name": "feature_body",
                    },
                ],
            },
        ],
        "name": "feature_item",
    }
    slide.ui["components"] = [
        {
            "id": "feature_grid",
            "description": "Two-by-two grid of feature items.",
            "position": {"x": 96, "y": 291.75},
            "elements": [
                {
                    "type": "grid",
                    "position": {"x": 0, "y": 0},
                    "size": {"width": 674, "height": 256.5},
                    "columns": 2,
                    "rows": 2,
                    "column_gap": 54,
                    "row_gap": 56,
                    "children": [copy.deepcopy(feature_item) for _ in range(4)],
                    "name": "feature_item_grid",
                }
            ],
        }
    ]
    tools, session = _tools(slide)

    result = _call(
        tools,
        "updateComponent",
        {"index": 0, "componentId": "feature_grid", "action": "ungroup"},
    )

    assert result["ok"] is True
    assert result["result"]["created_component_ids"] == [
        "feature_grid_part_1",
        "feature_grid_part_2",
        "feature_grid_part_3",
        "feature_grid_part_4",
    ]
    assert [component["position"] for component in slide.ui["components"]] == [
        {"x": 96.0, "y": 291.75},
        {"x": 460.0, "y": 291.75},
        {"x": 96.0, "y": 448.0},
        {"x": 460.0, "y": 448.0},
    ]
    assert all("size" not in component for component in slide.ui["components"])
    assert [component["elements"][0]["size"] for component in slide.ui["components"]] == [
        {"width": 310.0, "height": 100.25},
        {"width": 310.0, "height": 100.25},
        {"width": 310.0, "height": 100.25},
        {"width": 310.0, "height": 100.25},
    ]
    assert slide.ui["components"][0]["elements"][0]["type"] == "flex"
    assert slide.ui["components"][0]["elements"][0]["children"][0]["type"] == "container"
    assert (
        slide.ui["components"][0]["elements"][0]["children"][1]["children"][0]["runs"]
        == [{"text": "Fine PM2.5"}]
    )
    assert session.commit_count == 1


def test_update_component_duplicates_component():
    slide = _slide()
    tools, session = _tools(slide)

    result = _call(
        tools,
        "updateComponent",
        {"index": 0, "componentId": "hero", "action": "duplicate"},
    )

    assert result["ok"] is True
    assert result["result"]["updated"] is True
    assert result["result"]["action"] == "duplicated"
    assert result["result"]["component_id"] == "hero_copy"
    assert [item["id"] for item in slide.ui["components"]] == [
        "hero",
        "hero_copy",
        "body",
    ]
    assert slide.ui["components"][1]["position"] == {"x": 16.0, "y": 16.0}
    assert session.commit_count == 1


def test_update_component_reorders_layer():
    slide = _slide()
    tools, session = _tools(slide)

    result = _call(
        tools,
        "updateComponent",
        {"index": 0, "componentId": "hero", "action": "bringToFront"},
    )

    assert result["ok"] is True
    assert result["result"]["updated"] is True
    assert result["result"]["action"] == "bring-to-front"
    assert [item["id"] for item in slide.ui["components"]] == ["body", "hero"]
    assert result["result"]["component_index"] == 1
    assert session.commit_count == 1


def test_delete_slide_component_removes_block_from_ui():
    slide = _slide()
    tools, _ = _tools(slide)

    result = _call(tools, "deleteComponent", {"index": 0, "componentId": "body"})

    assert result["ok"] is True
    assert result["result"]["deleted"] is True
    assert [c["id"] for c in slide.ui["components"]] == ["hero"]


def test_delete_slide_element_removes_indexed_element():
    slide = _slide()
    tools, _ = _tools(slide)

    result = _call(
        tools,
        "deleteElement",
        {"index": 0, "elementPath": "components[1].elements[0]"},
    )

    assert result["ok"] is True
    assert result["result"]["deleted"] is True
    assert slide.ui["components"][1]["elements"] == []


def test_add_slide_component_appends_block():
    slide = _slide()
    tools, _ = _tools(slide)

    component = {
        "id": "note",
        "description": "A short callout note component.",
        "position": {"x": 0, "y": 80},
        "elements": [
            {
                "type": "text",
                "decorative": False,
                "name": "Note",
                "position": {"x": 0, "y": 0},
                "size": {"width": 100, "height": 20},
                "runs": [{"text": "Added note", "font": {"size": 14}}],
            }
        ],
    }

    result = _call(
        tools,
        "addComponent",
        {"index": 0, "component": json.dumps(component)},
    )

    assert result["ok"] is True
    assert result["result"]["added"] is True
    assert [c["id"] for c in slide.ui["components"]] == ["hero", "body", "note"]


def test_add_slide_component_clamps_to_visible_stage():
    slide = _slide()
    tools, _ = _tools(slide)
    component = {
        "id": "offscreen",
        "description": "Bad geometry component.",
        "position": {"x": 1400, "y": -40},
        "elements": [
            {
                "type": "text",
                "name": "Offscreen",
                "position": {"x": 0, "y": 0},
                "size": {"width": 2000, "height": 900},
                "runs": [{"text": "Visible now"}],
            }
        ],
    }

    result = _call(
        tools,
        "addComponent",
        {"index": 0, "component": json.dumps(component)},
    )

    added = slide.ui["components"][-1]
    assert result["ok"] is True
    assert added["position"] == {"x": 0.0, "y": 0.0}
    assert "size" not in added
    assert added["elements"][0]["size"] == {"width": 1280.0, "height": 576.0}


def test_add_slide_component_expands_tiny_chart_block():
    slide = _slide()
    tools, _ = _tools(slide)
    component = {
        "id": "tiny-chart",
        "description": "A chart block with bad assistant geometry.",
        "position": {"x": 0.25, "y": 0.2},
        "elements": [
            {
                "type": "chart",
                "decorative": False,
                "name": "Model chart",
                "position": {"x": 0, "y": 0},
                "size": {"width": 0.6, "height": 0.5},
                "chart_type": "bar",
                "categories": ["GPT OSS 20B", "GPT OSS 120B"],
                "series": [{"name": "Score", "values": [20, 120]}],
            }
        ],
    }

    result = _call(
        tools,
        "addComponent",
        {"index": 0, "component": json.dumps(component)},
    )

    chart_component = slide.ui["components"][-1]
    chart = chart_component["elements"][0]
    assert result["ok"] is True
    assert chart_component["position"] == {"x": 128.0, "y": 108.0}
    assert "size" not in chart_component
    assert chart["position"] == {"x": 0, "y": 0}
    assert chart["size"] == {"width": 1024.0, "height": 460.0}
    assert chart["colors"][:3] == ["#123456", "#234567", "#345678"]
    assert chart["color"] == "#123456"
    assert chart["axis_color"] == "#111827"
    assert chart["grid_color"] == "#E5E7EB"


def test_add_slide_element_converts_data_only_chart_on_first_insert():
    slide = _slide()
    tools, session = _tools(slide)
    chart = {
        "type": "chart",
        "decorative": False,
        "name": "Goals chart",
        "title": "Goals",
        "position": {"x": 128, "y": 108},
        "size": {"width": 1024, "height": 460},
        "chart_type": "bar",
        "data": [
            {"label": "Messi", "value": "600 goals"},
            {"label": "Ronaldo", "value": 800},
        ],
    }

    result = _call(
        tools,
        "addElement",
        {"index": 0, "element": json.dumps(chart)},
    )

    added_chart = slide.ui["components"][-1]["elements"][0]
    assert result["ok"] is True
    assert added_chart["categories"] == ["Messi", "Ronaldo"]
    assert added_chart["series"] == [{"name": "Goals", "values": [600, 800]}]
    assert [
        {key: item[key] for key in ("label", "value")}
        for item in added_chart["data"]
    ] == [
        {"label": "Messi", "value": 600},
        {"label": "Ronaldo", "value": 800},
    ]
    assert session.commit_count == 1


def test_add_slide_element_accepts_object_payload_for_json_string_field():
    slide = _slide()
    tools, session = _tools(slide)
    chart = {
        "type": "chart",
        "decorative": False,
        "name": "Goals chart",
        "title": "Goals",
        "position": {"x": 128, "y": 108},
        "size": {"width": 1024, "height": 460},
        "chart_type": "bar",
        "data": [
            {"label": "Messi", "value": 600},
            {"label": "Ronaldo", "value": 800},
        ],
    }

    result = _run(
        tools.execute_tool_call(
            AssistantToolCall(
                id="call_1",
                name="addElement",
                arguments=json.dumps({"index": 0, "element": chart}),
            )
        )
    )

    added_chart = slide.ui["components"][-1]["elements"][0]
    assert result["ok"] is True
    assert result["repair"]["applied"] is True
    assert "Converted element from object" in result["repair"]["notes"][0]
    assert added_chart["categories"] == ["Messi", "Ronaldo"]
    assert added_chart["series"] == [{"name": "Goals", "values": [600, 800]}]
    assert session.commit_count == 1


def test_add_slide_element_repairs_fenced_jsonish_element_payload():
    slide = _slide()
    tools, session = _tools(slide)
    chart = """```json
{type:'chart', decorative:false, name:'Goals chart', title:'Goals',
 position:{x:128, y:108}, size:{width:1024, height:460}, chart_type:'bar',
 data:[{label:'Messi', value:600}, {label:'Ronaldo', value:800}]}
```"""

    result = _call(
        tools,
        "addElement",
        {"index": 0, "element": chart},
    )

    added_chart = slide.ui["components"][-1]["elements"][0]
    assert result["ok"] is True
    assert result["repair"]["applied"] is True
    assert any(
        "Repaired JSON string field element" in note
        for note in result["repair"]["notes"]
    )
    assert added_chart["categories"] == ["Messi", "Ronaldo"]
    assert added_chart["series"] == [{"name": "Goals", "values": [600, 800]}]
    assert session.commit_count == 1


@patch.object(PresentationChatMemoryLayer, "generate_image", new_callable=AsyncMock)
def test_add_slide_element_uses_generated_asset_for_blank_image_insert(mock_generate_image):
    mock_generate_image.return_value = "/app_data/images/nepal-flag.png"
    slide = _slide()
    tools, session = _tools(slide)
    tools.set_turn_context("User message: Can you add an image with a Nepali flag")

    generated = _call(
        tools,
        "generateAssets",
        {"assets": [{"kind": "image", "prompt": "Nepal flag"}]},
    )
    image = {
        "type": "image",
        "decorative": False,
        "name": "Nepal flag",
        "position": {"x": 128, "y": 120},
        "size": {"width": 420, "height": 280},
    }
    result = _call(
        tools,
        "addElement",
        {"index": 0, "element": json.dumps(image)},
    )

    added_image = slide.ui["components"][-1]["elements"][0]
    assert generated["ok"] is True
    assert result["ok"] is True
    assert result["repair"]["applied"] is True
    assert added_image["data"] == "/app_data/images/nepal-flag.png"
    assert added_image["prompt"] == "Nepal flag"
    assert added_image["is_icon"] is False
    assert session.commit_count == 1


def test_add_slide_element_normalizes_image_url_alias_on_insert():
    slide = _slide()
    tools, session = _tools(slide)
    image = {
        "type": "image",
        "decorative": False,
        "name": "Nepal flag",
        "image_url": "/app_data/images/nepal-flag.png",
        "position": {"x": 128, "y": 120},
        "size": {"width": 420, "height": 280},
    }

    result = _call(
        tools,
        "addElement",
        {"index": 0, "element": json.dumps(image)},
    )

    added_image = slide.ui["components"][-1]["elements"][0]
    assert result["ok"] is True
    assert added_image["data"] == "/app_data/images/nepal-flag.png"
    assert added_image["is_icon"] is False
    assert session.commit_count == 1


@patch.object(PresentationChatMemoryLayer, "generate_image", new_callable=AsyncMock)
def test_add_slide_element_replaces_prompt_like_image_data_with_generated_asset(
    mock_generate_image,
):
    mock_generate_image.return_value = "/app_data/images/nepal-flag.png"
    slide = _slide()
    tools, session = _tools(slide)
    tools.set_turn_context("User message: Can you add an image with a Nepali flag")
    _call(
        tools,
        "generateAssets",
        {"assets": [{"kind": "image", "prompt": "Nepal flag"}]},
    )
    image = {
        "type": "image",
        "decorative": False,
        "name": "Nepal flag",
        "data": "Nepali flag image",
        "position": {"x": 128, "y": 120},
        "size": {"width": 420, "height": 280},
    }

    result = _call(
        tools,
        "addElement",
        {"index": 0, "element": json.dumps(image)},
    )

    added_image = slide.ui["components"][-1]["elements"][0]
    assert result["ok"] is True
    assert result["repair"]["applied"] is True
    assert added_image["data"] == "/app_data/images/nepal-flag.png"
    assert session.commit_count == 1


def test_add_slide_element_rejects_blank_image_insert():
    slide = _slide()
    tools, session = _tools(slide)
    image = {
        "type": "image",
        "decorative": False,
        "name": "Blank image",
        "position": {"x": 128, "y": 120},
        "size": {"width": 420, "height": 280},
    }

    result = _call(
        tools,
        "addElement",
        {"index": 0, "element": json.dumps(image)},
    )

    assert result["ok"] is False
    assert "Image elements must include" in result["error"]
    assert result["recovery"]["retryable"] is True
    assert "data" in result["recovery"]["expected"]["image"]
    assert len(slide.ui["components"]) == 2
    assert session.commit_count == 0


def test_add_slide_element_rejects_removed_geometry_types():
    slide = _slide()
    tools, session = _tools(slide)

    result = _call(
        tools,
        "addElement",
        {
            "index": 0,
            "element": json.dumps(
                {
                    "type": "rectangle",
                    "position": {"x": 100, "y": 100},
                    "size": {"width": 200, "height": 80},
                    "fill": {"color": "#FF0000"},
                }
            ),
        },
    )

    assert result["ok"] is False
    assert "was removed" in result["error"]
    assert "type='vector'" in result["error"]
    assert len(slide.ui["components"]) == 2
    assert session.commit_count == 0


def test_add_free_vector_normalizes_points_into_component_coordinates():
    slide = _slide()
    tools, session = _tools(slide)

    result = _call(
        tools,
        "addElement",
        {
            "index": 0,
            "element": json.dumps(
                {
                    "type": "vector",
                    "shape": "polygon",
                    "points": [
                        {"x": 300, "y": 200},
                        {"x": 500, "y": 200},
                        {"x": 500, "y": 300},
                        {"x": 300, "y": 300},
                    ],
                    "closed": True,
                    "fill": {"color": "#FF0000"},
                }
            ),
        },
    )

    component = slide.ui["components"][-1]
    vector = component["elements"][0]
    assert result["ok"] is True
    assert component["position"] == {"x": 300.0, "y": 200.0}
    assert vector["points"] == [
        {"x": 0.0, "y": 0.0},
        {"x": 200.0, "y": 0.0},
        {"x": 200.0, "y": 100.0},
        {"x": 0.0, "y": 100.0},
    ]
    assert "position" not in vector
    assert "size" not in vector
    assert session.commit_count == 1


def test_add_slide_element_rejects_blank_chart_insert():
    slide = _slide()
    tools, session = _tools(slide)
    chart = {
        "type": "chart",
        "decorative": False,
        "name": "Blank chart",
        "position": {"x": 128, "y": 108},
        "size": {"width": 1024, "height": 460},
        "chart_type": "bar",
    }

    result = _call(
        tools,
        "addElement",
        {"index": 0, "element": json.dumps(chart)},
    )

    assert result["ok"] is False
    assert "numeric data" in result["error"]
    assert result["recovery"]["retryable"] is True
    assert "categories" in result["recovery"]["expected"]["chart"]
    assert len(slide.ui["components"]) == 2
    assert session.commit_count == 0


def test_add_slide_element_repairs_blank_chart_from_user_message_data():
    slide = _slide()
    tools, session = _tools(slide)
    tools.set_turn_context(
        "UI context: the currently selected slide is slide 16 "
        "(zero-based index 15).\n"
        "User message: Add a chart with no.of goals the messi and ronaldo "
        "have in their lifetime.\n"
        "messi 600 goals and ronaldo 800 goals"
    )
    chart = {
        "type": "chart",
        "decorative": False,
        "name": "Blank chart",
        "position": {"x": 128, "y": 108},
        "size": {"width": 1024, "height": 460},
        "chart_type": "bar",
    }

    result = _call(
        tools,
        "addElement",
        {"index": 0, "element": json.dumps(chart)},
    )

    added_chart = slide.ui["components"][-1]["elements"][0]
    assert result["ok"] is True
    assert added_chart["title"] == "Goals"
    assert added_chart["categories"] == ["Messi", "Ronaldo"]
    assert added_chart["series"] == [{"name": "Goals", "values": [600, 800]}]
    assert session.commit_count == 1


def test_add_slide_element_repairs_blank_table_from_user_message_data():
    slide = _slide()
    tools, session = _tools(slide)
    tools.set_turn_context(
        "User message: Add a table with first row with Name, Age, Department. "
        "Data: Ghanshyam, 30, QA; Sudeep, 33, AI"
    )
    table = {
        "type": "table",
        "decorative": False,
        "name": "People table",
        "position": {"x": 128, "y": 120},
        "size": {"width": 1024, "height": 410},
    }

    result = _call(
        tools,
        "addElement",
        {"index": 0, "element": json.dumps(table)},
    )

    added_table = slide.ui["components"][-1]["elements"][0]
    assert result["ok"] is True
    assert [cell["runs"][0]["text"] for cell in added_table["columns"]] == [
        "Name",
        "Age",
        "Department",
    ]
    assert [[cell["runs"][0]["text"] for cell in row] for row in added_table["rows"]] == [
        ["Ghanshyam", "30", "QA"],
        ["Sudeep", "33", "AI"],
    ]
    assert session.commit_count == 1


def test_add_slide_element_rejects_blank_table_insert():
    slide = _slide()
    tools, session = _tools(slide)
    table = {
        "type": "table",
        "decorative": False,
        "name": "Blank table",
        "position": {"x": 128, "y": 120},
        "size": {"width": 1024, "height": 410},
    }

    result = _call(
        tools,
        "addElement",
        {"index": 0, "element": json.dumps(table)},
    )

    assert result["ok"] is False
    assert "Table elements must include" in result["error"]
    assert result["recovery"]["retryable"] is True
    assert "columns" in result["recovery"]["expected"]["table"]
    assert len(slide.ui["components"]) == 2
    assert session.commit_count == 0


def test_add_slide_component_expands_tiny_table_block():
    slide = _slide()
    tools, _ = _tools(slide)
    cell = {"runs": [{"text": "Metric", "font": {"size": 12}}]}
    component = {
        "id": "tiny-table",
        "description": "A table block with bad assistant geometry.",
        "position": {"x": 0.25, "y": 0.2},
        "elements": [
            {
                "type": "table",
                "decorative": False,
                "name": "Metrics table",
                "position": {"x": 0, "y": 0},
                "size": {"width": 0.6, "height": 0.5},
                "columns": [cell, {"runs": [{"text": "Value"}]}],
                "rows": [[{"runs": [{"text": "Temperature rise"}]}, {"runs": [{"text": "0.2 C"}]}]],
                "min_columns": 2,
                "max_columns": 2,
                "min_rows": 1,
                "max_rows": 3,
            }
        ],
    }

    result = _call(
        tools,
        "addComponent",
        {"index": 0, "component": json.dumps(component)},
    )

    table_component = slide.ui["components"][-1]
    table = table_component["elements"][0]
    assert result["ok"] is True
    assert table_component["position"] == {"x": 128.0, "y": 120.0}
    assert "size" not in table_component
    assert table["position"] == {"x": 0, "y": 0}
    assert table["size"] == {"width": 1024.0, "height": 410.0}


def test_add_slide_component_normalizes_table_cell_content_aliases():
    slide = _slide()
    tools, _ = _tools(slide)
    component = {
        "id": "people-table",
        "description": "A table with people and departments.",
        "position": {"x": 128, "y": 120},
        "size": {"width": 1024, "height": 410},
        "elements": [
            {
                "type": "table",
                "decorative": False,
                "name": "People table",
                "position": {"x": 0, "y": 0},
                "size": {"width": 1024, "height": 410},
                "headers": [
                    {"content": "Name"},
                    {"value": "Age"},
                    {"text": {"text": "Department"}},
                ],
                "rows": [
                    [
                        {"content": "Ghanshyam"},
                        {"value": 30},
                        {"label": "QA"},
                    ],
                    [
                        {"text": "Sudeep"},
                        {"content": 33},
                        {"data": "AI"},
                    ],
                ],
                "min_columns": 1,
                "max_columns": 6,
                "min_rows": 1,
                "max_rows": 10,
            }
        ],
    }

    result = _call(
        tools,
        "addComponent",
        {"index": 0, "component": json.dumps(component)},
    )

    table = slide.ui["components"][-1]["elements"][0]
    assert result["ok"] is True
    assert [cell["runs"][0]["text"] for cell in table["columns"]] == [
        "Name",
        "Age",
        "Department",
    ]
    assert [[cell["runs"][0]["text"] for cell in row] for row in table["rows"]] == [
        ["Ghanshyam", "30", "QA"],
        ["Sudeep", "33", "AI"],
    ]

    elements = _call(
        tools,
        "getSlideAtIndex",
        {"index": 0, "includeFullContent": True},
    )["result"]["slide"]["ui_summary"]["elements"]
    added_table = next(element for element in elements if element["name"] == "People table")
    assert added_table["content"] == {
        "columns": ["Name", "Age", "Department"],
        "rows": [["Ghanshyam", "30", "QA"], ["Sudeep", "33", "AI"]],
    }


def test_ui_tool_reports_non_ui_slide():
    slide = _slide()
    slide.ui = None
    tools, _ = _tools(slide)

    result = _call(tools, "getSlideAtIndex", {"index": 0, "includeFullContent": True})

    assert result["ok"] is True
    assert "ui_summary" not in result["result"]["slide"]


def _template_presentation(presentation_id: uuid.UUID) -> PresentationModel:
    return PresentationModel(
        id=presentation_id,
        version=PresentationVersion.V1_STANDARD,
        content="deck",
        n_slides=0,
        language="English",
        layout={
            "name": "custom-template",
            "template_id": "template",
            "layouts": [
                {
                    "id": "thanks",
                    "description": "Thank you slide layout for chat-created slides.",
                    "components": [
                        {
                            "id": "hero",
                            "description": "Hero title component for chat save tests.",
                            "position": {"x": 0, "y": 0},
                            "size": {"width": 100, "height": 40},
                            "elements": [
                                {
                                    "type": "text",
                                    "decorative": False,
                                    "name": "Title",
                                    "max_length": 100,
                                    "min_length": 1,
                                    "runs": [
                                        {
                                            "text": "Old title",
                                            "font": {"size": 20, "family": "Inter"},
                                        }
                                    ],
                                }
                            ],
                        }
                    ],
                }
            ]
        },
    )


class _FakeSaveSlideSession:
    def __init__(self, presentation: PresentationModel):
        self.presentation = presentation
        self.slides: list[SlideModel] = []
        self.added: list = []
        self.added_all: list = []
        self.commit_count = 0

    async def get(self, model, key):
        if model is PresentationModel and key == self.presentation.id:
            return self.presentation
        return None

    async def scalars(self, *_args, **_kwargs):
        return list(self.slides)

    async def scalar(self, *_args, **_kwargs):
        return self.slides[0] if self.slides else None

    def add(self, obj):
        self.added.append(obj)
        if isinstance(obj, SlideModel) and obj not in self.slides:
            self.slides.append(obj)

    def add_all(self, values):
        self.added_all.extend(values)

    async def commit(self):
        self.commit_count += 1

    async def refresh(self, _obj):
        return None

    async def delete(self, obj):
        if isinstance(obj, SlideModel) and obj in self.slides:
            self.slides.remove(obj)


def test_save_slide_for_template_payload_persists_renderable_ui():
    presentation_id = uuid.uuid4()
    presentation = _template_presentation(presentation_id)
    session = _FakeSaveSlideSession(presentation)
    memory = PresentationChatMemoryLayer(session, presentation_id)

    with patch.object(
        memory,
        "_get_presentation_icon_weight",
        new=AsyncMock(return_value="regular"),
    ), patch(
        "services.chat.memory_layer.get_images_directory",
        return_value="/tmp",
    ), patch(
        "services.chat.memory_layer.MEM0_PRESENTATION_MEMORY_SERVICE.store_slide_edit",
        new=AsyncMock(),
    ):
        result = _run(
            memory.save_slide(
                content={"hero": {"Title": "Thank You"}},
                layout_id="thanks",
                index=0,
                replace_old_slide_at_index=False,
            )
        )

    assert result["saved"] is True
    assert len(session.slides) == 1
    saved_slide = session.slides[0]
    assert saved_slide.layout_group == "custom-template"
    assert saved_slide.layout == "thanks"
    assert saved_slide.ui["id"] == "thanks"
    title_element = saved_slide.ui["components"][0]["elements"][0]
    assert title_element["runs"][0]["text"] == "Thank You"
    assert title_element["text"] == "Thank You"


def test_chat_add_outline_refuses_more_than_max_slides():
    presentation_id = uuid.uuid4()
    presentation = _template_presentation(presentation_id)
    presentation.outlines = {
        "slides": [
            {"content": f"## Slide {index}"}
            for index in range(MAX_NUMBER_OF_SLIDES)
        ]
    }
    session = _FakeSaveSlideSession(presentation)
    memory = PresentationChatMemoryLayer(session, presentation_id)

    result = _run(memory.add_outline(content="## Extra", index=None))

    assert result["saved"] is False
    assert result["slide_count"] == MAX_NUMBER_OF_SLIDES
    assert result["max_slide_count"] == MAX_NUMBER_OF_SLIDES
    assert session.commit_count == 0


def test_chat_update_outline_trims_content_to_word_limit():
    presentation_id = uuid.uuid4()
    presentation = _template_presentation(presentation_id)
    presentation.outlines = {"slides": [{"content": "## Existing"}]}
    session = _FakeSaveSlideSession(presentation)
    memory = PresentationChatMemoryLayer(session, presentation_id)
    content = " ".join(
        f"word{i}" for i in range(MAX_OUTLINE_CONTENT_WORDS + 4)
    )

    with patch(
        "services.chat.memory_layer.MEM0_PRESENTATION_MEMORY_SERVICE.store_generated_outlines",
        new=AsyncMock(),
    ):
        result = _run(memory.update_outline(index=0, content=content))

    assert result["saved"] is True
    saved_content = presentation.outlines["slides"][0]["content"]
    assert count_outline_words(saved_content) == MAX_OUTLINE_CONTENT_WORDS
    assert f"word{MAX_OUTLINE_CONTENT_WORDS - 1}" in saved_content
    assert f"word{MAX_OUTLINE_CONTENT_WORDS}" not in saved_content


def test_chat_add_blank_slide_refuses_more_than_max_slides():
    presentation_id = uuid.uuid4()
    presentation = _template_presentation(presentation_id)
    session = _FakeSaveSlideSession(presentation)
    session.slides = [
        SlideModel(
            presentation=presentation_id,
            layout_group="custom-template",
            layout="thanks",
            index=index,
            content={},
            properties=None,
            ui={},
        )
        for index in range(MAX_NUMBER_OF_SLIDES)
    ]
    memory = PresentationChatMemoryLayer(session, presentation_id)

    result = _run(memory.add_blank_slide(index=None))

    assert result["added"] is False
    assert result["slide_count"] == MAX_NUMBER_OF_SLIDES
    assert result["max_slide_count"] == MAX_NUMBER_OF_SLIDES
    assert session.commit_count == 0


def test_chat_delete_final_slide_replaces_it_with_blank_fallback():
    presentation_id = uuid.uuid4()
    presentation = _template_presentation(presentation_id)
    presentation.n_slides = 1
    source_slide = SlideModel(
        id=uuid.uuid4(),
        presentation=presentation_id,
        layout_group="custom-template",
        layout="thanks",
        index=0,
        content={"hero": {"Title": "Thanks"}},
        properties=None,
        ui={"id": "thanks", "components": []},
    )
    session = _FakeSaveSlideSession(presentation)
    session.slides = [source_slide]
    memory = PresentationChatMemoryLayer(session, presentation_id)

    result = _run(memory.delete_slide(index=0))

    assert result["deleted"] is True
    assert result["blank_fallback"] is True
    assert result["deleted_slide_id"] == str(source_slide.id)
    assert len(session.slides) == 1
    fallback_slide = session.slides[0]
    assert fallback_slide.id != source_slide.id
    assert fallback_slide.index == 0
    assert fallback_slide.layout_group == "custom-template"
    assert fallback_slide.layout == "__blank_slide__"
    assert fallback_slide.content == {}
    assert fallback_slide.speaker_note == ""
    assert fallback_slide.ui["id"] == "__blank_slide__"
    assert fallback_slide.ui["components"] == []
    assert presentation.n_slides == 1
    assert session.commit_count == 1


def test_chat_save_slide_refuses_new_slide_at_max_slides():
    presentation_id = uuid.uuid4()
    presentation = _template_presentation(presentation_id)
    session = _FakeSaveSlideSession(presentation)
    session.slides = [
        SlideModel(
            presentation=presentation_id,
            layout_group="custom-template",
            layout="thanks",
            index=index,
            content={},
            properties=None,
            ui={},
        )
        for index in range(MAX_NUMBER_OF_SLIDES)
    ]
    memory = PresentationChatMemoryLayer(session, presentation_id)

    with patch.object(
        memory,
        "_get_presentation_icon_weight",
        new=AsyncMock(return_value="regular"),
    ), patch(
        "services.chat.memory_layer.get_images_directory",
        return_value="/tmp",
    ):
        result = _run(
            memory.save_slide(
                content={"hero": {"Title": "Extra"}},
                layout_id="thanks",
                index=MAX_NUMBER_OF_SLIDES,
                replace_old_slide_at_index=False,
            )
        )

    assert result["saved"] is False
    assert result["slide_count"] == MAX_NUMBER_OF_SLIDES
    assert result["max_slide_count"] == MAX_NUMBER_OF_SLIDES
    assert session.commit_count == 0
