import asyncio
import uuid
from unittest.mock import AsyncMock, Mock

from models.sql.slide import SlideModel
from services.icon_finder_service import IconFinderService
from templates.presentation_layout import PresentationLayoutModel, SlideLayoutModel
from utils import process_slides
from utils.icon_weights import (
    extract_icon_type_from_settings,
    extract_icon_weight_from_settings,
    normalize_icon_type,
    normalize_icon_weight,
)


def test_icon_weight_settings_uses_only_icon_weight_and_fallback():
    assert extract_icon_weight_from_settings({"icon_weight": "thin"}) == "thin"
    assert extract_icon_weight_from_settings({"wrong_key": "thin"}) == "bold"
    assert extract_icon_weight_from_settings({"icon_weight": "unknown"}) == "bold"
    assert normalize_icon_weight(None) == "bold"


def test_icon_type_settings_prefer_icon_type_and_support_weight_alias():
    assert extract_icon_type_from_settings({"icon_type": "duotone"}) == "duotone"
    assert (
        extract_icon_type_from_settings({"icon_type": "bold", "icon_weight": "thin"})
        == "bold"
    )
    assert extract_icon_type_from_settings({"icon_weight": "light"}) == "light"
    assert normalize_icon_type("regular") == "regular"


def test_presentation_layout_reads_template_icon_weight():
    layout = PresentationLayoutModel(
        name="general",
        ordered=False,
        icon_weight="duotone",
        slides=[SlideLayoutModel(id="intro", json_schema={"title": "Intro"})],
    )

    assert layout.icon_weight == "duotone"


def test_presentation_layout_reads_template_icon_type():
    layout = PresentationLayoutModel(
        name="general",
        ordered=False,
        icon_type="thin",
        slides=[SlideLayoutModel(id="intro", json_schema={"title": "Intro"})],
    )

    assert layout.icon_type == "thin"
    assert layout.icon_weight == "thin"


def test_icon_finder_builds_weighted_static_urls(monkeypatch):
    service = IconFinderService()
    monkeypatch.setattr(
        "services.icon_finder_service.get_resource_path",
        lambda path: f"/app/{path}",
    )
    monkeypatch.setattr(
        "services.icon_finder_service.os.path.isfile",
        lambda path: True,
    )

    regular_url = service._icon_url_for_weight(
        "chart-line-up-bold||chart growth",
        "regular",
    )
    thin_url = service._icon_url_for_weight("chart-line-up-bold", "thin")

    assert regular_url.endswith("/static/icons/regular/chart-line-up.svg")
    assert thin_url.endswith("/static/icons/thin/chart-line-up-thin.svg")


def test_icon_finder_falls_back_to_bold_when_weighted_icon_missing(monkeypatch):
    service = IconFinderService()
    monkeypatch.setattr(
        "services.icon_finder_service.get_resource_path",
        lambda path: f"/app/{path}",
    )
    monkeypatch.setattr(
        "services.icon_finder_service.os.path.isfile",
        lambda path: False,
    )

    icon_url = service._icon_url_for_weight("chart-line-up-bold", "thin")

    assert icon_url.endswith("/static/icons/bold/chart-line-up-bold.svg")


def test_process_slide_fetches_icons_with_template_weight(monkeypatch):
    captured = {}

    async def fake_search_icons(query, k=1, weight=None):
        captured["query"] = query
        captured["weight"] = weight
        return [f"/static/icons/{weight}/checks-{weight}.svg"]

    monkeypatch.setattr(
        process_slides.ICON_FINDER_SERVICE,
        "search_icons",
        fake_search_icons,
    )

    slide = SlideModel(
        presentation=uuid.uuid4(),
        layout_group="general",
        layout="layout-1",
        index=0,
        content={
            "icon": {
                "__icon_query__": "success check",
                "__icon_url__": "/static/icons/placeholder.svg",
            }
        },
        properties=None,
    )

    assets = asyncio.run(
        process_slides.process_slide_and_fetch_assets(
            image_generation_service=Mock(),
            slide=slide,
            icon_weight="thin",
        )
    )

    assert assets == []
    assert captured == {"query": "success check", "weight": "thin"}
    assert slide.content["icon"]["__icon_url__"].endswith(
        "/static/icons/thin/checks-thin.svg"
    )


def test_process_slide_fetches_every_template_image_and_icon(monkeypatch):
    icon_queries = []

    async def fake_search_icons(query, k=1, weight=None):
        icon_queries.append(query)
        return [f"/static/icons/{query.replace(' ', '-')}.svg"]

    monkeypatch.setattr(
        process_slides.ICON_FINDER_SERVICE,
        "search_icons",
        fake_search_icons,
    )
    image_generation_service = Mock()
    image_generation_service.generate_image = AsyncMock(
        side_effect=[
            "/static/generated/market.png",
            "/static/generated/team.png",
        ]
    )
    slide = SlideModel(
        presentation=uuid.uuid4(),
        layout_group="template-id",
        layout="layout-1",
        index=0,
        content={
            "hero": {"image_prompt": "market dashboard"},
            "cards": [
                {"image_prompt": "collaborative team"},
                {"icon_query": "growth chart"},
                {"icon_query": "customer support"},
            ],
        },
        properties=None,
    )

    assets = asyncio.run(
        process_slides.process_slide_and_fetch_assets(
            image_generation_service=image_generation_service,
            slide=slide,
            icon_weight="regular",
        )
    )

    assert assets == []
    assert [
        call.args[0].prompt
        for call in image_generation_service.generate_image.await_args_list
    ] == ["market dashboard", "collaborative team"]
    assert icon_queries == ["growth chart", "customer support"]
    assert slide.content["hero"]["image_url"].endswith(
        "/static/generated/market.png"
    )
    assert slide.content["cards"][0]["image_url"].endswith(
        "/static/generated/team.png"
    )
    assert slide.content["cards"][1]["icon_url"].endswith(
        "/static/icons/growth-chart.svg"
    )
    assert slide.content["cards"][2]["icon_url"].endswith(
        "/static/icons/customer-support.svg"
    )
    assert "__image_url__" not in slide.content["hero"]
    assert "__image_url__" not in slide.content["cards"][0]
    assert "__icon_url__" not in slide.content["cards"][1]
    assert "__icon_url__" not in slide.content["cards"][2]


def test_process_slide_fetches_template_raw_schema_icon_query(monkeypatch):
    captured = {}

    async def fake_search_icons(query, k=1, weight=None):
        captured["query"] = query
        captured["weight"] = weight
        return ["/static/icons/regular/trend-up.svg"]

    monkeypatch.setattr(
        process_slides.ICON_FINDER_SERVICE,
        "search_icons",
        fake_search_icons,
    )
    image_generation_service = Mock()
    image_generation_service.generate_image = AsyncMock()
    slide = SlideModel(
        presentation=uuid.uuid4(),
        layout_group="template-id",
        layout="layout-1",
        index=0,
        content={"status_icon": {"query": "growth chart"}},
        ui={},
        properties=None,
    )

    assets = asyncio.run(
        process_slides.process_slide_and_fetch_assets(
            image_generation_service=image_generation_service,
            slide=slide,
            icon_weight="regular",
        )
    )

    assert assets == []
    image_generation_service.generate_image.assert_not_awaited()
    assert captured == {"query": "growth chart", "weight": "regular"}
    assert slide.content["status_icon"] == {
        "query": "growth chart",
        "icon_url": "/static/icons/regular/trend-up.svg",
    }


def test_process_slide_adds_template_raw_schema_icon_placeholder():
    slide = SlideModel(
        presentation=uuid.uuid4(),
        layout_group="template-id",
        layout="layout-1",
        index=0,
        content={"status_icon": {"query": "growth chart"}},
        ui={},
        properties=None,
    )

    process_slides.process_slide_add_placeholder_assets(slide)

    assert slide.content["status_icon"] == {
        "query": "growth chart",
        "icon_url": "/static/icons/placeholder.svg",
    }


def test_process_template_edit_reuses_assets_with_clean_url_fields(monkeypatch):
    search_icons = AsyncMock()
    monkeypatch.setattr(
        process_slides.ICON_FINDER_SERVICE,
        "search_icons",
        search_icons,
    )
    image_generation_service = Mock()
    image_generation_service.generate_image = AsyncMock()
    old_content = {
        "hero": {
            "image_prompt": "market dashboard",
            "__image_url__": "/static/generated/market.png",
        },
        "badge": {
            "icon_query": "growth chart",
            "__icon_url__": "/static/icons/growth-chart.svg",
        },
    }
    new_content = {
        "hero": {"image_prompt": "market dashboard"},
        "badge": {"icon_query": "growth chart"},
    }

    assets = asyncio.run(
        process_slides.process_old_and_new_slides_and_fetch_assets(
            image_generation_service=image_generation_service,
            old_slide_content=old_content,
            new_slide_content=new_content,
            use_template_asset_fields=True,
        )
    )

    assert assets == []
    image_generation_service.generate_image.assert_not_awaited()
    search_icons.assert_not_awaited()
    assert new_content["hero"] == {
        "image_prompt": "market dashboard",
        "image_url": "/static/generated/market.png",
    }
    assert new_content["badge"] == {
        "icon_query": "growth chart",
        "icon_url": "/static/icons/growth-chart.svg",
    }


def test_template_placeholders_use_clean_url_fields():
    slide = SlideModel(
        presentation=uuid.uuid4(),
        layout_group="template-id",
        layout="layout-1",
        index=0,
        content={
            "hero": {
                "image_prompt": "market dashboard",
                "__image_url__": "/old-image.png",
            },
            "badge": {
                "icon_query": "growth chart",
                "__icon_url__": "/old-icon.svg",
            },
        },
        properties=None,
    )

    process_slides.process_slide_add_placeholder_assets(slide)

    assert slide.content["hero"]["image_url"].endswith(
        "/static/images/placeholder.jpg"
    )
    assert slide.content["badge"]["icon_url"].endswith(
        "/static/icons/placeholder.svg"
    )
    assert "__image_url__" not in slide.content["hero"]
    assert "__icon_url__" not in slide.content["badge"]
