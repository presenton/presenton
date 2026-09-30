import asyncio
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from api.v1.auth.context import reset_current_owner_id, set_current_owner_id
from models.sql.key_value import KeyValueSqlModel
from services.chat.memory_layer import (
    THEMES_STORAGE_KEY,
    PresentationChatMemoryLayer,
)


def _layer(session) -> PresentationChatMemoryLayer:
    return PresentationChatMemoryLayer(
        sql_session=session,
        presentation_id=uuid.uuid4(),
    )


def _theme(theme_id: str) -> dict:
    return {
        "id": theme_id,
        "name": theme_id.title(),
        "description": "Custom theme",
        "user": "local",
        "data": {"colors": {"background": "#101010", "primary": "#ffffff"}},
    }


async def _create_tables(engine) -> None:
    async with engine.begin() as connection:
        await connection.run_sync(KeyValueSqlModel.__table__.create)


def test_chat_custom_themes_are_scoped_to_the_current_owner():
    async def run():
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        session_maker = async_sessionmaker(engine, expire_on_commit=False)
        await _create_tables(engine)

        first, second = uuid.uuid4(), uuid.uuid4()
        first_token = set_current_owner_id(first)
        try:
            async with session_maker() as session:
                await _layer(session)._upsert_custom_theme_in_store(
                    _theme("owner-a")
                )
                await session.commit()
                rows = (await session.scalars(select(KeyValueSqlModel))).all()
                assert [row.key for row in rows] == [
                    f"{THEMES_STORAGE_KEY}:{first}"
                ]
        finally:
            reset_current_owner_id(first_token)

        second_token = set_current_owner_id(second)
        try:
            async with session_maker() as session:
                second_themes = await _layer(session)._get_chat_available_themes()
                assert "owner-a" not in {theme["id"] for theme in second_themes}
        finally:
            reset_current_owner_id(second_token)

        first_token = set_current_owner_id(first)
        try:
            async with session_maker() as session:
                first_themes = await _layer(session)._get_chat_available_themes()
                assert "owner-a" in {theme["id"] for theme in first_themes}
        finally:
            reset_current_owner_id(first_token)
            await engine.dispose()

    asyncio.run(run())


def test_chat_sees_themes_created_through_the_theme_endpoints():
    async def run():
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        session_maker = async_sessionmaker(engine, expire_on_commit=False)
        await _create_tables(engine)

        owner = uuid.uuid4()
        token = set_current_owner_id(owner)
        try:
            async with session_maker() as session:
                session.add(
                    KeyValueSqlModel(
                        key=f"{THEMES_STORAGE_KEY}:{owner}",
                        value={"themes": [_theme("editor-theme")]},
                    )
                )
                await session.commit()

            async with session_maker() as session:
                themes = await _layer(session)._get_chat_available_themes()
                assert "editor-theme" in {theme["id"] for theme in themes}
        finally:
            reset_current_owner_id(token)
            await engine.dispose()

    asyncio.run(run())
