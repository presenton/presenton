"""Интеграционные тесты редакторского REST: слайд-операции, editor-view/ops.

Паттерн окружения — как в test_slide_preview_endpoints.py: отдельный FastAPI
с роутерами, sqlite-движок, owner_id в ContextVar через middleware (owner-скоуп
реальных эндпоинтов повторяет прод).
"""

import asyncio
import uuid
from typing import Any

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from api.v1.auth.context import reset_current_owner_id, set_current_owner_id
from api.v1.ppt.endpoints.slide_editor import PRESENTATION_EDITOR_ROUTER
from api.v1.ppt.endpoints.slide_ops import PRESENTATION_OPS_ROUTER, SLIDES_ROUTER
from models.sql.presentation import PresentationModel, PresentationVersion
from models.sql.slide import SlideModel
from services.database import get_async_session

OWNER_ID = uuid.uuid4()
OTHER_ID = uuid.uuid4()


def _layout_payload() -> dict[str, Any]:
    """Минимальный payload шаблона презентации (как presentation.layout)."""
    return {
        "id": "general",
        "name": "General",
        "layouts": [
            {
                "id": "section_title",
                "description": "Section title slide",
                "components": [
                    {
                        "id": "title_component",
                        "position": {"x": 0, "y": 0},
                        "elements": [
                            {
                                "id": "title",
                                "type": "text",
                                "name": "title",
                                "position": {"x": 90, "y": 120},
                                "size": {"width": 1100, "height": 100},
                                "font": {"size": 52, "color": "#111111"},
                            }
                        ],
                    }
                ],
            }
        ],
    }


def _text_ui() -> dict[str, Any]:
    return {
        "id": "slide",
        "description": "Content slide",
        "components": [
            {
                "id": "bg",
                "position": {"x": 0, "y": 0},
                "elements": [
                    {
                        "type": "vector",
                        "shape": "polygon",
                        "points": [
                            {"x": 0, "y": 0},
                            {"x": 1280, "y": 0},
                            {"x": 1280, "y": 720},
                            {"x": 0, "y": 720},
                        ],
                        "closed": True,
                        "fill": {"color": "#FFFFFF"},
                        "decorative": True,
                    }
                ],
            },
            {
                "id": "content",
                "position": {"x": 0, "y": 0},
                "elements": [
                    {
                        "id": "heading",
                        "type": "text",
                        "name": "heading",
                        "position": {"x": 90, "y": 100},
                        "size": {"width": 800, "height": 80},
                        "font": {"size": 44, "color": "#000000", "bold": False},
                        "text": "Old heading",
                    },
                    {
                        "id": "body",
                        "type": "text",
                        "name": "body",
                        "position": {"x": 90, "y": 200},
                        "size": {"width": 800, "height": 200},
                        "font": {"size": 24, "color": "#333333"},
                        "text": "Old body",
                    },
                ],
            },
        ],
    }


def _build_stack(tmp_path, monkeypatch):
    monkeypatch.setenv("APP_DATA_DIRECTORY", str(tmp_path / "app-data"))
    engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'editor.db'}")
    session_maker = async_sessionmaker(engine, expire_on_commit=False)

    async def create_tables():
        async with engine.begin() as connection:
            await connection.run_sync(PresentationModel.__table__.create)
            await connection.run_sync(SlideModel.__table__.create)

    asyncio.run(create_tables())

    async def override_session():
        async with session_maker() as session:
            yield session

    app = FastAPI()

    @app.middleware("http")
    async def owner_context(request, call_next):
        token = set_current_owner_id(OWNER_ID)
        try:
            return await call_next(request)
        finally:
            reset_current_owner_id(token)

    for router in (SLIDES_ROUTER, PRESENTATION_OPS_ROUTER, PRESENTATION_EDITOR_ROUTER):
        app.include_router(router, prefix="/api/v1/ppt")
    app.dependency_overrides[get_async_session] = override_session
    return TestClient(app), engine, session_maker


@pytest.fixture
def stack(tmp_path, monkeypatch):
    return _build_stack(tmp_path, monkeypatch)


async def _seed_deck(
    session_maker,
    *,
    owner_id: uuid.UUID,
    payload: dict[str, Any] | None = None,
    slide_count: int = 2,
    with_foreign_slide: bool = False,
) -> tuple[uuid.UUID, list[uuid.UUID]]:
    """Презентация + slide_count слайдов (плюс один чужой слайд)."""
    presentation_id = uuid.uuid4()
    slides: list[SlideModel] = []
    async with session_maker() as session:
        presentation = PresentationModel(
            id=presentation_id,
            owner_id=owner_id,
            version=PresentationVersion.V2_STANDARD,
            content="Deck prompt",
            n_slides=slide_count,
            language="ru",
            title="Deck",
            layout=payload if payload is not None else None,
        )
        session.add(presentation)
        for index in range(slide_count):
            slide = SlideModel(
                id=uuid.uuid4(),
                owner_id=owner_id,
                presentation=presentation_id,
                layout_group="general",
                layout="content" if index else "title",
                index=index,
                content={"title": f"Slide {index}"},
                speaker_note="",
                ui=_text_ui() if index else _text_ui(),
            )
            slides.append(slide)
            session.add(slide)
        if with_foreign_slide:
            session.add(
                SlideModel(
                    id=uuid.uuid4(),
                    owner_id=OTHER_ID,
                    presentation=presentation_id,
                    layout_group="general",
                    layout="content",
                    index=99,
                    content={},
                    speaker_note="",
                    ui=_text_ui(),
                )
            )
        await session.commit()
    return presentation_id, [slide.id for slide in slides]


async def _deck_rows(session_maker, presentation_id: uuid.UUID) -> list[SlideModel]:
    async with session_maker() as session:
        from sqlalchemy import select

        return list(
            (
                await session.scalars(
                    select(SlideModel)
                    .where(SlideModel.presentation == presentation_id)
                    .order_by(SlideModel.index)
                )
            ).all()
        )


# ---------------------------------------------------------------------------
# Слайд-операции
# ---------------------------------------------------------------------------
def test_duplicate_slide_inserts_after_source(stack):
    client, _, session_maker = stack
    deck_id, slide_ids = asyncio.run(_seed_deck(session_maker, owner_id=OWNER_ID))

    response = client.post(
        f"/api/v1/ppt/slides/{slide_ids[0]}/duplicate",
        json={"at_index": 1},
    )
    assert response.status_code == 200
    duplicated = response.json()
    assert duplicated["id"] != str(slide_ids[0])
    assert duplicated["content"]["title"] == "Slide 0"

    rows = asyncio.run(_deck_rows(session_maker, deck_id))
    assert [row.index for row in rows] == [0, 1, 2]
    assert str(rows[1].id) == duplicated["id"]


def test_duplicate_slide_foreign_owner_is_404(stack):
    client, _, session_maker = stack
    deck_id, _ = asyncio.run(_seed_deck(session_maker, owner_id=OWNER_ID, with_foreign_slide=True))

    async def foreign_id():
        # чужие слайды не попадают в выборку владельца — симулируем отдельным get
        async with session_maker() as session:
            from sqlalchemy import select

            return (
                await session.scalars(select(SlideModel).where(SlideModel.owner_id == OTHER_ID))
            ).first()

    foreign = asyncio.run(foreign_id())
    assert foreign is not None
    response = client.post(f"/api/v1/ppt/slides/{foreign.id}/duplicate", json={})
    assert response.status_code == 404


def test_delete_slide_renumbers(stack):
    client, _, session_maker = stack
    deck_id, slide_ids = asyncio.run(_seed_deck(session_maker, owner_id=OWNER_ID, slide_count=3))

    response = client.delete(f"/api/v1/ppt/slides/{slide_ids[0]}")
    assert response.status_code == 204

    rows = asyncio.run(_deck_rows(session_maker, deck_id))
    assert [row.index for row in rows] == [0, 1]
    assert all(str(row.id) != str(slide_ids[0]) for row in rows)


def test_delete_unknown_slide_is_404(stack):
    client, *_ = stack
    response = client.delete(f"/api/v1/ppt/slides/{uuid.uuid4()}")
    assert response.status_code == 404


def test_add_blank_slide(stack):
    client, _, session_maker = stack
    deck_id, _ = asyncio.run(_seed_deck(session_maker, owner_id=OWNER_ID, slide_count=1))

    response = client.post(
        f"/api/v1/ppt/presentation/{deck_id}/slides",
        json={"layout": "__blank_slide__", "at_index": 0},
    )
    assert response.status_code == 200
    added = response.json()
    assert added["layout_group"] == "blank"
    assert added["layout"] == "__blank_slide__"
    assert isinstance(added["ui"], dict)

    rows = asyncio.run(_deck_rows(session_maker, deck_id))
    assert [row.index for row in rows] == [0, 1]
    assert str(rows[0].id) == added["id"]


def test_add_slide_from_layout_catalog(stack):
    client, _, session_maker = stack
    deck_id, _ = asyncio.run(
        _seed_deck(session_maker, owner_id=OWNER_ID, payload=_layout_payload(), slide_count=1)
    )

    response = client.post(
        f"/api/v1/ppt/presentation/{deck_id}/slides",
        json={"layout": "section_title"},
    )
    assert response.status_code == 200
    added = response.json()
    assert added["layout"] == "section_title"
    assert added["layout_group"] == "general"
    assert added["ui"]["id"] == "section_title"
    assert added["content"] == {}


def test_add_slide_unknown_layout_is_422(stack):
    client, _, session_maker = stack
    deck_id, _ = asyncio.run(
        _seed_deck(session_maker, owner_id=OWNER_ID, payload=_layout_payload(), slide_count=1)
    )
    response = client.post(
        f"/api/v1/ppt/presentation/{deck_id}/slides",
        json={"layout": "missing_layout"},
    )
    assert response.status_code == 422


def test_reorder_slides(stack):
    client, _, session_maker = stack
    deck_id, slide_ids = asyncio.run(_seed_deck(session_maker, owner_id=OWNER_ID, slide_count=3))

    reversed_ids = list(reversed(slide_ids))
    response = client.patch(
        f"/api/v1/ppt/presentation/{deck_id}/slides-order",
        json={"slide_ids": [str(slide_id) for slide_id in reversed_ids]},
    )
    assert response.status_code == 200
    assert response.json() == {"ok": True, "slides": 3}

    rows = asyncio.run(_deck_rows(session_maker, deck_id))
    assert [str(row.id) for row in rows] == [str(slide_id) for slide_id in reversed_ids]


def test_reorder_slides_requires_permutation(stack):
    client, _, session_maker = stack
    deck_id, slide_ids = asyncio.run(_seed_deck(session_maker, owner_id=OWNER_ID, slide_count=3))

    response = client.patch(
        f"/api/v1/ppt/presentation/{deck_id}/slides-order",
        json={"slide_ids": [str(slide_ids[0]), str(slide_ids[1])]},
    )
    assert response.status_code == 400


def test_layout_catalog_from_template_payload(stack):
    client, _, session_maker = stack
    deck_id, _ = asyncio.run(
        _seed_deck(session_maker, owner_id=OWNER_ID, payload=_layout_payload(), slide_count=1)
    )
    response = client.get(f"/api/v1/ppt/presentation/{deck_id}/layout-catalog")
    assert response.status_code == 200
    body = response.json()
    assert body["source"] == "template"
    assert body["catalog"] == [{"code": "section_title", "description": "Section title slide"}]
    assert body["blank"] == "__blank_slide__"


def test_layout_catalog_falls_back_to_deck(stack):
    client, _, session_maker = stack
    deck_id, _ = asyncio.run(_seed_deck(session_maker, owner_id=OWNER_ID, slide_count=1))
    response = client.get(f"/api/v1/ppt/presentation/{deck_id}/layout-catalog")
    assert response.status_code == 200
    body = response.json()
    assert body["source"] == "deck"
    assert body["catalog"][0]["code"] == "title"


# ---------------------------------------------------------------------------
# editor-view / editor-ops
# ---------------------------------------------------------------------------
def test_editor_view_lists_elements(stack):
    client, _, session_maker = stack
    deck_id, slide_ids = asyncio.run(_seed_deck(session_maker, owner_id=OWNER_ID))
    response = client.get(
        f"/api/v1/ppt/presentation/{deck_id}/editor-view",
        params={"slide_id": str(slide_ids[0])},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["editable"] is True
    assert body["width"] == 1280
    texts = [element for element in body["elements"] if element["type"] == "text"]
    assert any(element["text"] == "Old heading" for element in texts)
    assert any(element["decorative"] is True for element in body["elements"])


def test_editor_view_foreign_slide_is_404(stack):
    client, _, session_maker = stack
    deck_id, _ = asyncio.run(_seed_deck(session_maker, owner_id=OWNER_ID))
    response = client.get(
        f"/api/v1/ppt/presentation/{deck_id}/editor-view",
        params={"slide_id": str(uuid.uuid4())},
    )
    assert response.status_code == 404


def _heading_path(body: dict[str, Any]) -> str:
    for element in body["elements"]:
        if element.get("name") == "heading":
            return element["path"]
    raise AssertionError("heading element not found in editor view")


def test_editor_ops_set_text_move_resize_and_style(stack):
    client, _, session_maker = stack
    deck_id, slide_ids = asyncio.run(_seed_deck(session_maker, owner_id=OWNER_ID))
    view = client.get(
        f"/api/v1/ppt/presentation/{deck_id}/editor-view",
        params={"slide_id": str(slide_ids[0])},
    ).json()
    path = _heading_path(view)

    response = client.patch(
        f"/api/v1/ppt/presentation/{deck_id}/editor-ops",
        json={
            "slide_id": str(slide_ids[0]),
            "ops": [
                {"op": "set_text", "element_path": path, "text": "New heading"},
                {"op": "move", "element_path": path, "position": {"x": 150, "y": 160}},
                {"op": "resize", "element_path": path, "size": {"width": 900, "height": 90}},
                {
                    "op": "set_style",
                    "element_path": path,
                    "patch": {"font": {"bold": True, "color": "#FF0000"}},
                },
            ],
        },
    )
    assert response.status_code == 200
    body = response.json()
    updated = next(element for element in body["elements"] if element["name"] == "heading")
    assert updated["text"] == "New heading"
    assert updated["rect"]["x"] == 150
    assert updated["rect"]["y"] == 160
    assert updated["rect"]["width"] == 900
    assert updated["font"]["bold"] is True
    assert updated["font"]["color"] == "#FF0000"


def test_editor_ops_are_atomic_on_error(stack):
    client, _, session_maker = stack
    deck_id, slide_ids = asyncio.run(_seed_deck(session_maker, owner_id=OWNER_ID))
    view = client.get(
        f"/api/v1/ppt/presentation/{deck_id}/editor-view",
        params={"slide_id": str(slide_ids[0])},
    ).json()
    path = _heading_path(view)

    response = client.patch(
        f"/api/v1/ppt/presentation/{deck_id}/editor-ops",
        json={
            "slide_id": str(slide_ids[0]),
            "ops": [
                {"op": "set_text", "element_path": path, "text": "Should not persist"},
                {"op": "unknown_op", "element_path": path},
            ],
        },
    )
    assert response.status_code == 400

    view = client.get(
        f"/api/v1/ppt/presentation/{deck_id}/editor-view",
        params={"slide_id": str(slide_ids[0])},
    ).json()
    updated = next(element for element in view["elements"] if element["name"] == "heading")
    assert updated["text"] == "Old heading"


def test_editor_ops_reject_decorative_delete_and_bad_color(stack):
    client, _, session_maker = stack
    deck_id, slide_ids = asyncio.run(_seed_deck(session_maker, owner_id=OWNER_ID))
    view = client.get(
        f"/api/v1/ppt/presentation/{deck_id}/editor-view",
        params={"slide_id": str(slide_ids[0])},
    ).json()
    decorative = next(element for element in view["elements"] if element["decorative"] is True)

    response = client.patch(
        f"/api/v1/ppt/presentation/{deck_id}/editor-ops",
        json={
            "slide_id": str(slide_ids[0]),
            "ops": [{"op": "delete", "element_path": decorative["path"]}],
        },
    )
    assert response.status_code == 400

    heading = _heading_path(view)
    response = client.patch(
        f"/api/v1/ppt/presentation/{deck_id}/editor-ops",
        json={
            "slide_id": str(slide_ids[0]),
            "ops": [
                {
                    "op": "set_style",
                    "element_path": heading,
                    "patch": {"font": {"color": "red"}},
                }
            ],
        },
    )
    assert response.status_code == 400


def test_editor_ops_duplicate_delete_and_reorder(stack):
    client, _, session_maker = stack
    deck_id, slide_ids = asyncio.run(_seed_deck(session_maker, owner_id=OWNER_ID))
    view = client.get(
        f"/api/v1/ppt/presentation/{deck_id}/editor-view",
        params={"slide_id": str(slide_ids[0])},
    ).json()
    body_path = next(element["path"] for element in view["elements"] if element["name"] == "body")

    response = client.patch(
        f"/api/v1/ppt/presentation/{deck_id}/editor-ops",
        json={
            "slide_id": str(slide_ids[0]),
            "ops": [
                {"op": "duplicate", "element_path": body_path},
            ],
        },
    )
    assert response.status_code == 200
    body = response.json()
    bodies = [element for element in body["elements"] if element.get("name") == "body"]
    assert len(bodies) == 2
    # копия получает id "<original>_copy"
    duplicated = next(element for element in body["elements"] if element.get("id") == "body_copy")
    duplicated_path = duplicated["path"]

    response = client.patch(
        f"/api/v1/ppt/presentation/{deck_id}/editor-ops",
        json={
            "slide_id": str(slide_ids[0]),
            "ops": [
                {"op": "reorder_element", "element_path": duplicated_path, "direction": "back"},
            ],
        },
    )
    assert response.status_code == 200
    body = response.json()
    bodies = [element for element in body["elements"] if element.get("name") == "body"]
    # back = первый в списке элементов контейнера
    assert bodies[0]["id"] == "body_copy"

    response = client.patch(
        f"/api/v1/ppt/presentation/{deck_id}/editor-ops",
        json={
            "slide_id": str(slide_ids[0]),
            "ops": [{"op": "delete", "element_path": bodies[0]["path"]}],
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert len([element for element in body["elements"] if element.get("name") == "body"]) == 1


def test_editor_state_replaces_ui(stack):
    client, _, session_maker = stack
    deck_id, slide_ids = asyncio.run(_seed_deck(session_maker, owner_id=OWNER_ID))
    replacement = {
        "id": "custom",
        "description": "Восстановленный снимок",
        "components": [
            {
                "id": "content",
                "position": {"x": 0, "y": 0},
                "elements": [
                    {
                        "id": "restored",
                        "type": "text",
                        "name": "heading",
                        "position": {"x": 10, "y": 10},
                        "size": {"width": 500, "height": 60},
                        "font": {"size": 40},
                        "text": "Откат",
                    }
                ],
            }
        ],
    }
    response = client.patch(
        f"/api/v1/ppt/presentation/{deck_id}/editor-state",
        json={"slide_id": str(slide_ids[0]), "ui": replacement},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["editable"] is True
    headings = [element for element in body["elements"] if element.get("name") == "heading"]
    assert headings and headings[0]["text"] == "Откат"
    assert body["ui"] is not None


def test_editor_state_rejects_malformed_ui(stack):
    client, _, session_maker = stack
    deck_id, slide_ids = asyncio.run(_seed_deck(session_maker, owner_id=OWNER_ID))
    response = client.patch(
        f"/api/v1/ppt/presentation/{deck_id}/editor-state",
        json={"slide_id": str(slide_ids[0]), "ui": {"content": {"title": "x"}}},
    )
    assert response.status_code == 422


def test_editor_ops_add_element_over_http(stack):
    client, _, session_maker = stack
    deck_id, slide_ids = asyncio.run(_seed_deck(session_maker, owner_id=OWNER_ID))
    response = client.patch(
        f"/api/v1/ppt/presentation/{deck_id}/editor-ops",
        json={
            "slide_id": str(slide_ids[0]),
            "ops": [
                {
                    "op": "add_element",
                    "type": "text",
                    "rect": {"x": 120, "y": 90, "width": 420, "height": 110},
                }
            ],
        },
    )
    assert response.status_code == 200
    body = response.json()
    added = [element for element in body["elements"] if element.get("name") == "text_added"]
    assert len(added) == 1
    assert added[0]["rect"] == {"x": 120, "y": 90, "width": 420, "height": 110}
    assert body["ui"] is not None
