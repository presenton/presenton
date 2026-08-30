import asyncio
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from models.sql.presentation import PresentationModel
from models.sql.slide import SlideModel
from models.sql.user import User
from services import presenton_cloud_persistence


def test_cloud_generation_is_mirrored_into_the_local_database(monkeypatch, tmp_path):
    engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'mirror.db'}")
    session_maker = async_sessionmaker(engine, expire_on_commit=False)
    monkeypatch.setattr(
        presenton_cloud_persistence,
        "async_session_maker",
        session_maker,
    )
    owner_id = uuid.uuid4()
    presentation_id = uuid.uuid4()
    slide_id = uuid.uuid4()

    async def run():
        async with engine.begin() as connection:
            await connection.run_sync(User.__table__.create)
            await connection.run_sync(PresentationModel.__table__.create)
            await connection.run_sync(SlideModel.__table__.create)

        async with session_maker() as session:
            session.add(
                User(
                    id=owner_id,
                    username="admin",
                    hashed_password="unused",
                    is_active=True,
                    is_superuser=True,
                    is_verified=True,
                )
            )
            await session.commit()

        await presenton_cloud_persistence.persist_cloud_presentation_created(
            owner_id,
            {
                "content": "Build a launch plan",
                "n_slides": 1,
                "language": "English",
                "generation_mode": "smart",
            },
            {
                "id": str(presentation_id),
                "content": "Build a launch plan",
                "n_slides": 1,
                "language": "English",
            },
        )

        async with session_maker() as session:
            created = await session.get(PresentationModel, presentation_id)
            assert created is not None
            assert created.owner_id == owner_id
            assert created.generation_mode == "smart"
            created.generation_mode = "standard"
            session.add(created)
            await session.commit()

        await presenton_cloud_persistence.persist_cloud_presentation_complete(
            owner_id,
            {
                "id": str(presentation_id),
                "content": "Build a launch plan",
                "n_slides": 1,
                "language": "English",
                "title": "Launch Plan",
                "fonts": {"Inter": "https://example.com/inter.woff2"},
                "slides": [
                    {
                        "id": str(slide_id),
                        "presentation_id": str(presentation_id),
                        "index": 0,
                        "html": "<section>Launch Plan</section>",
                    }
                ],
            },
            generation_mode="smart",
        )

        async with session_maker() as session:
            completed = await session.get(PresentationModel, presentation_id)
            slides = (
                await session.scalars(
                    select(SlideModel).where(
                        SlideModel.presentation == presentation_id
                    )
                )
            ).all()
            assert completed is not None
            assert completed.title == "Launch Plan"
            assert completed.generation_mode == "smart"
            assert completed.fonts == {"Inter": "https://example.com/inter.woff2"}
            assert len(slides) == 1
            assert slides[0].id == slide_id
            assert slides[0].owner_id == owner_id
            assert slides[0].html_content == "<section>Launch Plan</section>"

        # A Smart retry must repair an existing row that was previously saved
        # with the legacy default mode.
        async with session_maker() as session:
            completed = await session.get(PresentationModel, presentation_id)
            assert completed is not None
            completed.generation_mode = "standard"
            session.add(completed)
            await session.commit()

        await presenton_cloud_persistence.persist_cloud_presentation_created(
            owner_id,
            {
                "content": "Build a launch plan",
                "n_slides": 1,
                "generation_mode": "smart",
            },
            {"presentation_id": str(presentation_id)},
        )

        async with session_maker() as session:
            repaired = await session.get(PresentationModel, presentation_id)
            assert repaired is not None
            assert repaired.generation_mode == "smart"

        await engine.dispose()

    asyncio.run(run())
