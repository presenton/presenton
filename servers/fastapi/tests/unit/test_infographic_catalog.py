import asyncio
from unittest.mock import AsyncMock

import pytest

from services.chat.tools import ChatTools
from templates.v2.models.elements import Infographic, StructuralInfographicData
from utils.infographic_catalog import (
    INFOGRAPHIC_BY_TYPE,
    normalize_infographic_data,
    search_infographic_catalog,
)


def test_catalog_exposes_all_native_infographic_families():
    assert len(INFOGRAPHIC_BY_TYPE) == 26
    assert {"gantt", "timeline", "risk_matrix", "org_chart", "mind_map"} <= set(
        INFOGRAPHIC_BY_TYPE
    )

    hierarchy_matches = search_infographic_catalog(query="hierarchy")
    assert {item["type"] for item in hierarchy_matches} >= {
        "org_chart",
        "decision_tree",
        "pyramid",
    }


def test_catalog_normalizes_and_validates_structural_data():
    data = normalize_infographic_data(
        "timeline",
        {"items": [{"heading": "Discover", "description": "Research"}]},
    )
    assert data["type"] == "timeline"

    with pytest.raises(ValueError, match="exactly four items"):
        normalize_infographic_data(
            "risk_matrix",
            {"center_label": "RISK", "items": [{"heading": "Identify"}]},
        )


def test_template_model_accepts_catalog_native_structural_data():
    infographic = Infographic(
        type="infographic",
        data={
            "type": "timeline",
            "items": [{"heading": "Discover", "description": "Research"}],
        },
        colors=["FFFFFF", "102E79"],
        text_color="111111",
        decorative=False,
        name="timeline",
    )

    assert isinstance(infographic.data, StructuralInfographicData)
    assert infographic.data.type == "timeline"
    assert infographic.data.model_dump()["items"][0]["heading"] == "Discover"


def test_chat_tools_browse_and_add_native_infographics():
    memory = AsyncMock()
    memory.add_slide_ui_element.return_value = {
        "added": True,
        "index": 1,
        "slide_number": 2,
        "component_id": "timeline",
        "element_path": "components[1].elements[0]",
    }
    tools = ChatTools(memory)

    catalog = asyncio.run(
        tools._get_available_infographics(
            {"infographicType": "timeline", "query": None}
        )
    )
    result = asyncio.run(
        tools._add_infographic(
            {
                "infographicType": "timeline",
                "target": "existing_slide",
                "slideIndex": 1,
                "data": {
                    "items": [
                        {"heading": "Discover", "description": "Research"},
                        {"heading": "Launch", "description": "Release"},
                    ]
                },
                "position": None,
                "size": None,
                "colors": ["112233", "445566"],
                "textColor": "FFFFFF",
                "componentId": None,
                "insertIndex": None,
            }
        )
    )

    assert catalog["count"] == 1
    assert result["infographic_added"] is True
    inserted = memory.add_slide_ui_element.await_args.kwargs["element"]
    assert inserted["data"]["type"] == "timeline"
    assert inserted["size"] == {"width": 720, "height": 260}
    assert inserted["colors"] == ["112233", "445566"]
