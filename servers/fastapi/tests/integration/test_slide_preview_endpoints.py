import asyncio
import uuid
from types import SimpleNamespace

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

import api.v1.ppt.endpoints.slide_preview as slide_preview
from api.v1.auth.context import reset_current_owner_id, set_current_owner_id
from api.v1.ppt.endpoints.slide_preview import SLIDE_PREVIEW_ROUTER
from models.sql.presentation import PresentationModel, PresentationVersion
from services.database import get_async_session

OWNER_ID = uuid.uuid4()
OTHER_ID = uuid.uuid4()
PNG_BYTES = b"\x89PNG\r\n\x1a\n"


def _build_client(tmp_path, monkeypatch):
    monkeypatch.setenv("APP_DATA_DIRECTORY", str(tmp_path / "app-data"))
    engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'preview.db'}")
    session_maker = async_sessionmaker(engine, expire_on_commit=False)

    async def create_tables():
        async with engine.begin() as connection:
            await connection.run_sync(PresentationModel.__table__.create)

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

    app.include_router(SLIDE_PREVIEW_ROUTER, prefix="/api/v1/ppt")
    app.dependency_overrides[get_async_session] = override_session
    return TestClient(app), engine, session_maker


def _seed_presentation(engine, owner_id) -> uuid.UUID:
    presentation_id = uuid.uuid4()

    async def seed():
        session_maker = async_sessionmaker(engine, expire_on_commit=False)
        async with session_maker() as session:
            session.add(
                PresentationModel(
                    id=presentation_id,
                    owner_id=owner_id,
                    version=PresentationVersion.V2_STANDARD,
                    content="Deck",
                    n_slides=2,
                    language="ru",
                    title="Deck",
                )
            )
            await session.commit()

    asyncio.run(seed())
    return presentation_id


def _fake_renderer(rendered_pngs):
    calls = []

    async def fake_render(pptx_path, font_paths_for_install, max_slides, logger):
        calls.append(pptx_path)
        return rendered_pngs

    return fake_render, calls


def _make_pngs(tmp_path, count=2):
    paths = []
    for index in range(count):
        path = tmp_path / f"rendered-{index}.png"
        path.write_bytes(PNG_BYTES)
        paths.append(str(path))
    return paths


def _owned_pptx(tmp_path, owner_id) -> str:
    exports = tmp_path / "app-data" / "exports" / "users" / str(owner_id)
    exports.mkdir(parents=True, exist_ok=True)
    pptx = exports / "deck.pptx"
    pptx.write_bytes(b"pptx")
    return f"/app_data/exports/users/{owner_id}/deck.pptx"


def test_preview_renders_pngs_and_caches_them(monkeypatch, tmp_path):
    client, engine, _ = _build_client(tmp_path, monkeypatch)
    presentation_id = _seed_presentation(engine, OWNER_ID)
    pptx_path = _owned_pptx(tmp_path, OWNER_ID)
    fake_render, calls = _fake_renderer(_make_pngs(tmp_path))
    monkeypatch.setattr(slide_preview, "render_pptx_slides_to_images", fake_render)
    monkeypatch.setattr(slide_preview, "_preview_dimensions_from_pptx", lambda _path: (1280, 720))

    response = client.post(
        f"/api/v1/ppt/presentation/{presentation_id}/preview",
        json={"pptx_path": pptx_path},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["width"] == 1280
    assert payload["height"] == 720
    expected_prefix = f"/app_data/exports/users/{OWNER_ID}/previews/{presentation_id}/"
    assert payload["slides"] == [
        f"{expected_prefix}slide-1.png",
        f"{expected_prefix}slide-2.png",
    ]
    preview_dir = (
        tmp_path
        / "app-data"
        / "exports"
        / "users"
        / str(OWNER_ID)
        / "previews"
        / str(presentation_id)
    )
    assert (preview_dir / "slide-1.png").read_bytes() == PNG_BYTES

    cached = client.post(
        f"/api/v1/ppt/presentation/{presentation_id}/preview",
        json={"pptx_path": pptx_path},
    )
    assert cached.status_code == 200
    # Повторный запрос по тому же PPTX не запускает Chromium повторно.
    assert len(calls) == 1

    asyncio.run(engine.dispose())


def test_preview_without_pptx_path_exports_first(monkeypatch, tmp_path):
    client, engine, _ = _build_client(tmp_path, monkeypatch)
    presentation_id = _seed_presentation(engine, OWNER_ID)
    exports = tmp_path / "app-data" / "exports" / "users" / str(OWNER_ID)
    exports.mkdir(parents=True, exist_ok=True)
    exported_pptx = exports / "Deck.pptx"
    exported_pptx.write_bytes(b"pptx")
    export_calls = []

    async def fake_export(presentation_id_arg, title, export_as, cookie_header=None):
        export_calls.append(export_as)
        return SimpleNamespace(path=str(exported_pptx))

    monkeypatch.setattr(slide_preview, "export_presentation", fake_export)
    fake_render, _ = _fake_renderer(_make_pngs(tmp_path))
    monkeypatch.setattr(slide_preview, "render_pptx_slides_to_images", fake_render)
    monkeypatch.setattr(slide_preview, "_preview_dimensions_from_pptx", lambda _path: (1280, 720))

    response = client.post(f"/api/v1/ppt/presentation/{presentation_id}/preview")

    assert response.status_code == 200
    assert export_calls == ["pptx"]
    asyncio.run(engine.dispose())


def test_foreign_pptx_path_is_forbidden(monkeypatch, tmp_path):
    client, engine, _ = _build_client(tmp_path, monkeypatch)
    presentation_id = _seed_presentation(engine, OWNER_ID)
    foreign_pptx = _owned_pptx(tmp_path, OTHER_ID)

    response = client.post(
        f"/api/v1/ppt/presentation/{presentation_id}/preview",
        json={"pptx_path": foreign_pptx},
    )

    assert response.status_code == 403
    asyncio.run(engine.dispose())


def test_non_pptx_path_is_rejected(monkeypatch, tmp_path):
    client, engine, _ = _build_client(tmp_path, monkeypatch)
    presentation_id = _seed_presentation(engine, OWNER_ID)

    response = client.post(
        f"/api/v1/ppt/presentation/{presentation_id}/preview",
        json={"pptx_path": f"/app_data/exports/users/{OWNER_ID}/deck.pdf"},
    )

    assert response.status_code == 422
    asyncio.run(engine.dispose())


def test_preview_refresh_render_ignores_cache(monkeypatch, tmp_path):
    """refresh=true собирает свежий PPTX и перерендеривает даже при готовом кэше."""
    client, engine, _ = _build_client(tmp_path, monkeypatch)
    presentation_id = _seed_presentation(engine, OWNER_ID)
    pptx_path = _owned_pptx(tmp_path, OWNER_ID)
    fake_render, render_calls = _fake_renderer(_make_pngs(tmp_path, count=2))
    monkeypatch.setattr(slide_preview, "render_pptx_slides_to_images", fake_render)
    monkeypatch.setattr(slide_preview, "_preview_dimensions_from_pptx", lambda _path: (1280, 720))

    # прогреть кэш обычным запросом
    first = client.post(
        f"/api/v1/ppt/presentation/{presentation_id}/preview",
        json={"pptx_path": pptx_path},
    )
    assert first.status_code == 200

    export_calls = []

    async def fake_export(presentation_id_arg, title, export_as, cookie_header=None):
        export_calls.append(export_as)
        return SimpleNamespace(path=_owned_pptx(tmp_path, OWNER_ID))

    monkeypatch.setattr(slide_preview, "export_presentation", fake_export)

    refreshed = client.post(
        f"/api/v1/ppt/presentation/{presentation_id}/preview",
        json={"pptx_path": pptx_path, "refresh": True},
    )
    assert refreshed.status_code == 200
    # refresh=True: экспорт запускается заново, кэш игнорируется
    assert export_calls == ["pptx"]
    assert len(render_calls) == 2
    asyncio.run(engine.dispose())


def test_foreign_presentation_is_not_found(monkeypatch, tmp_path):
    client, engine, _ = _build_client(tmp_path, monkeypatch)
    foreign_id = _seed_presentation(engine, OTHER_ID)
    pptx_path = _owned_pptx(tmp_path, OWNER_ID)

    response = client.post(
        f"/api/v1/ppt/presentation/{foreign_id}/preview",
        json={"pptx_path": pptx_path},
    )

    assert response.status_code == 404
    assert (
        client.post(
            f"/api/v1/ppt/presentation/{uuid.uuid4()}/preview",
            json={"pptx_path": pptx_path},
        ).status_code
        == 404
    )
    asyncio.run(engine.dispose())


def test_preview_render_lock_is_shared_per_presentation():
    """In-flight дедупликация: второй /preview по той же деке ждёт рендер,
    по другой деке — рендерит независимо (не терпит общий lock)."""

    async def scenario():
        first = uuid.uuid4()
        second = uuid.uuid4()

        lock_a1 = await slide_preview._preview_render_lock(first)
        lock_a2 = await slide_preview._preview_render_lock(first)
        lock_b = await slide_preview._preview_render_lock(second)
        assert lock_a1 is lock_a2
        assert lock_b is not lock_a1

        entered = asyncio.Event()

        async def second_call():
            async with lock_a2:
                entered.set()

        async with lock_a1:
            task = asyncio.create_task(second_call())
            await asyncio.sleep(0.01)
            # первый ещё рендерит — второй ждёт, не запуская параллельный рендер
            assert not entered.is_set()
        await asyncio.wait_for(task, 1)
        assert entered.is_set()

    asyncio.run(scenario())
