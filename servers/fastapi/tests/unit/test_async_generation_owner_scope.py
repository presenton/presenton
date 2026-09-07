"""BackgroundTasks must still see the owner contextvar.

`SessionAuthMiddleware` sets the owner contextvar and resets it in a `finally`
block that runs *before* Starlette executes BackgroundTasks. Despite that
ordering, background tasks do observe the owner, because the reset applies to
the middleware's own context while the task chain runs in a copy branched off
before the reset.

`POST /api/v1/ppt/presentation/generate/async` depends on this: the
`PresentationModel` row is created inside its background task, and
`_stamp_new_owned_rows` fills `owner_id` from that contextvar. If the ordering
above is ever "fixed" -- e.g. by moving `set_current_owner_id` or replacing the
middleware -- async generations would silently be stored with `owner_id = NULL`,
making them invisible to their author while the synchronous endpoint keeps
working.
"""

import asyncio
import uuid

import pytest
from fastapi import BackgroundTasks, FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from api import middlewares
from api.middlewares import SessionAuthMiddleware
from api.v1.auth.principal import AuthPrincipal
from models.sql.presentation import PresentationModel, PresentationVersion
from models.sql.user import User


def _same_uuid(stored: object, expected: uuid.UUID) -> bool:
    """SQLite stores Uuid columns as dash-less hex, Postgres as text."""
    return str(stored).replace("-", "").lower() == expected.hex


@pytest.fixture
def owner_id() -> uuid.UUID:
    return uuid.uuid4()


@pytest.fixture
def app_and_engine(monkeypatch, tmp_path, owner_id):
    engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'owner.db'}")
    session_maker = async_sessionmaker(engine, expire_on_commit=False)

    async def prepare() -> None:
        async with engine.begin() as connection:
            await connection.run_sync(User.__table__.create)
            await connection.run_sync(PresentationModel.__table__.create)
        async with session_maker() as session:
            # The middleware refuses requests until at least one user exists.
            session.add(
                User(
                    id=owner_id,
                    username="tg_42",
                    hashed_password="unused-in-this-test",
                    is_active=True,
                    is_verified=True,
                    is_superuser=False,
                    auth_version=1,
                )
            )
            await session.commit()

    asyncio.run(prepare())

    monkeypatch.setattr(middlewares, "async_session_maker", session_maker)
    monkeypatch.setattr(middlewares, "is_disable_auth_enabled", lambda: False)

    async def fake_principal(request, session):
        principal = AuthPrincipal(user_id=owner_id, username="tg_42", is_admin=False, method="jwt")
        return principal, await session.get(User, owner_id)

    monkeypatch.setattr(middlewares, "resolve_request_principal", fake_principal)
    monkeypatch.setattr(
        middlewares,
        "maybe_proxy_presenton_cloud_request",
        lambda *args, **kwargs: _none(),
    )

    created: dict[str, uuid.UUID] = {}

    async def create_presentation_in_background() -> None:
        # Mirrors generate_presentation_handler: opens its own session and
        # creates the row after the response has been returned.
        async with session_maker() as session:
            presentation = PresentationModel(
                id=uuid.uuid4(),
                version=PresentationVersion.V2_STANDARD,
                content="regression",
                n_slides=1,
                language="English",
                title="regression",
            )
            session.add(presentation)
            await session.commit()
            created["presentation_id"] = presentation.id

    app = FastAPI()

    @app.post("/api/v1/ppt/presentation/generate/async")
    async def generate_async(background_tasks: BackgroundTasks):
        background_tasks.add_task(create_presentation_in_background)
        return {"queued": True}

    app.add_middleware(SessionAuthMiddleware)
    return app, engine, created


async def _none():
    return None


def test_background_generation_stamps_owner_id(app_and_engine, owner_id):
    app, engine, created = app_and_engine

    with TestClient(app) as client:
        response = client.post("/api/v1/ppt/presentation/generate/async")

    assert response.status_code == 200, response.text
    presentation_id = created.get("presentation_id")
    assert presentation_id is not None, "background task did not run"

    async def read_owner_id():
        # Raw SQL on purpose: an ORM select would be filtered by
        # _scope_owned_selects, which cannot distinguish "owner_id is NULL"
        # from "row belongs to somebody else".
        async with engine.connect() as connection:
            return (
                await connection.execute(
                    text("SELECT owner_id FROM presentations WHERE id = :pid"),
                    {"pid": presentation_id.hex},
                )
            ).scalar()

    stored_owner_id = asyncio.run(read_owner_id())

    assert stored_owner_id is not None, (
        "owner_id was not stamped: the owner contextvar did not reach the "
        "background task, so async generations are invisible to their author"
    )
    assert _same_uuid(stored_owner_id, owner_id)
