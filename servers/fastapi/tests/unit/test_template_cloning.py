import asyncio
from copy import deepcopy
import shutil
import uuid

from fastapi import HTTPException
import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from api.v1.auth.assets import is_app_data_path_authorized
from api.v1.auth.context import reset_current_owner_id, set_current_owner_id
from api.v1.ppt.endpoints.template import (
    clone_template,
    UpdateTemplateMetadataRequest,
    update_template_metadata,
)
from models.sql.template_v2 import TemplateV2
from models.sql.user import User
from templates.cloning import clone_builtin_template
from templates.default_templates import _update_template_from_default


@pytest.fixture
def builtin_template(tmp_path, monkeypatch):
    monkeypatch.setenv("APP_DATA_DIRECTORY", str(tmp_path))
    monkeypatch.delenv("NEXT_PUBLIC_FAST_API", raising=False)
    template_id = str(uuid.uuid4())
    static = tmp_path / "templates" / template_id / "static"
    static.mkdir(parents=True)
    (static / "photo.svg").write_text("<svg/>")
    (static / "thumbnail.png").write_bytes(b"thumbnail")
    (static / "fonts").mkdir()
    (static / "fonts" / "font.ttf").write_bytes(b"font")
    prefix = f"/app_data/templates/{template_id}/static/"
    image = {"type": "image", "data": prefix + "photo.svg"}
    return TemplateV2(
        id=template_id,
        owner_id=None,
        name="Built-in",
        description="A bundled design",
        is_default=True,
        layouts={"layouts": [{"id": "slide_1", "components": [image]}]},
        components={"photo": image},
        merged_components={"components": [{"variants": [image]}]},
        theme={"fonts": {"textFont": {"url": prefix + "fonts/font.ttf"}}},
        assets={
            "template_id": template_id,
            "thumbnail": prefix + "thumbnail.png",
            "fonts": {"Custom Font": prefix + "fonts/font.ttf"},
            "images": [prefix + "photo.svg"],
            "external_font": "https://fonts.googleapis.com/css2?family=Inter",
        },
    )


@pytest.mark.parametrize("owned", [True, False])
def test_clone_copies_assets_and_template_fields_without_changing_builtin(
    builtin_template, fake_async_session, tmp_path, owned
):
    owner = uuid.uuid4() if owned else None
    token = set_current_owner_id(owner)
    before = deepcopy(builtin_template.model_dump())
    fake_async_session._get_results[builtin_template.id] = builtin_template
    try:
        template_id = asyncio.run(clone_template(builtin_template.id, fake_async_session))
    finally:
        reset_current_owner_id(token)

    clone = fake_async_session.added[0]
    owner_path = f"users/{owner}/" if owner else ""
    prefix = f"/app_data/pptx-to-json/{owner_path}{template_id}/"
    directory = tmp_path / "pptx-to-json" / owner_path / template_id
    assert clone.id != builtin_template.id
    assert clone.owner_id == owner
    assert clone.name == "Built-in (copy)"
    assert clone.description == builtin_template.description
    assert clone.is_default is False
    assert clone.raw_layouts is None
    assert clone.assets["template_id"] == clone.id
    assert clone.assets["thumbnail"] == prefix + "thumbnail.png"
    assert clone.assets["fonts"]["Custom Font"] == prefix + "fonts/font.ttf"
    assert clone.assets["external_font"] == builtin_template.assets["external_font"]
    assert clone.layouts["layouts"][0]["id"] == "slide_1"
    assert clone.layouts["layouts"][0]["components"][0]["data"] == prefix + "photo.svg"
    assert clone.components["photo"]["data"] == prefix + "photo.svg"
    assert clone.merged_components["components"][0]["variants"][0]["data"] == prefix + "photo.svg"
    assert clone.theme["fonts"]["textFont"]["url"] == prefix + "fonts/font.ttf"
    assert (directory / "photo.svg").read_text() == "<svg/>"
    assert (directory / "fonts" / "font.ttf").read_bytes() == b"font"
    assert (directory / "thumbnail.png").read_bytes() == b"thumbnail"
    assert fake_async_session.commit_count == 1
    assert builtin_template.model_dump() == before

    # Refreshing/removing the built-in's assets cannot change the custom copy.
    shutil.rmtree(tmp_path / "templates" / builtin_template.id)
    assert (directory / "photo.svg").read_text() == "<svg/>"
    clone.layouts["layouts"][0]["id"] = "edited"
    assert builtin_template.layouts["layouts"][0]["id"] == "slide_1"


def test_clone_rejects_custom_templates_and_missing_ids(builtin_template, fake_async_session):
    builtin_template.is_default = False
    fake_async_session._get_results[builtin_template.id] = builtin_template
    for template_id, status in ((builtin_template.id, 400), ("missing", 404)):
        with pytest.raises(HTTPException) as exc:
            asyncio.run(clone_template(template_id, fake_async_session))
        assert exc.value.status_code == status
    assert fake_async_session.added == []


def test_clone_uses_the_configured_asset_origin(builtin_template, fake_async_session, monkeypatch):
    monkeypatch.setenv("NEXT_PUBLIC_FAST_API", "http://127.0.0.1:8000")
    template_id = asyncio.run(clone_builtin_template(builtin_template, fake_async_session))
    assert fake_async_session.added[0].assets["thumbnail"] == (
        f"http://127.0.0.1:8000/app_data/pptx-to-json/{template_id}/thumbnail.png"
    )


def test_clone_reports_copy_failure_without_exposing_server_paths(
    builtin_template, fake_async_session, tmp_path
):
    shutil.rmtree(tmp_path / "templates")
    fake_async_session._get_results[builtin_template.id] = builtin_template
    with pytest.raises(HTTPException) as exc:
        asyncio.run(clone_template(builtin_template.id, fake_async_session))
    assert exc.value.status_code == 500
    assert str(tmp_path) not in exc.value.detail
    assert fake_async_session.added == []


@pytest.mark.parametrize("template_id", ["", ".", "..", "../private", "parent\\private"])
def test_clone_rejects_unsafe_source_paths(builtin_template, fake_async_session, template_id):
    builtin_template.id = template_id
    with pytest.raises(HTTPException) as exc:
        asyncio.run(clone_builtin_template(builtin_template, fake_async_session))
    assert exc.value.status_code == 400
    assert fake_async_session.added == []


@pytest.mark.parametrize("failure", ["copy", "commit", "symlink"])
def test_clone_failure_cleans_up_assets(
    builtin_template, fake_async_session, tmp_path, monkeypatch, failure
):
    if failure == "commit":
        async def fail_commit():
            raise RuntimeError("database unavailable")
        monkeypatch.setattr(fake_async_session, "commit", fail_commit)
        expected_error = RuntimeError
    else:
        static = tmp_path / "templates" / builtin_template.id / "static"
        if failure == "copy":
            def fail_copy(source, destination):
                destination.mkdir()
                (destination / "partial").write_text("partial")
                raise OSError("disk full")
            monkeypatch.setattr("templates.cloning._copy_assets", fail_copy)
        else:
            private = tmp_path / "userConfig.json"
            private.write_text('{"secret": "private"}')
            (static / "private.json").symlink_to(private)
        expected_error = OSError
    with pytest.raises(expected_error):
        asyncio.run(clone_builtin_template(builtin_template, fake_async_session))
    assert list((tmp_path / "pptx-to-json").iterdir()) == []


def test_persisted_copy_is_editable_private_and_survives_default_refresh(
    builtin_template, tmp_path
):
    async def run():
        engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'templates.db'}")
        sessions = async_sessionmaker(engine, expire_on_commit=False)
        async with engine.begin() as connection:
            await connection.run_sync(User.__table__.create)
            await connection.run_sync(TemplateV2.__table__.create)
        owner, other = uuid.uuid4(), uuid.uuid4()
        async with sessions() as session:
            session.add_all([
                User(id=owner, username="owner", hashed_password="unused"),
                User(id=other, username="other", hashed_password="unused"),
                builtin_template,
            ])
            await session.commit()

        token = set_current_owner_id(owner)
        try:
            async with sessions() as session:
                template_id = await clone_template(builtin_template.id, session)
            async with sessions() as session:
                edited = await update_template_metadata(
                    template_id,
                    UpdateTemplateMetadataRequest(name="My custom template"),
                    session,
                )
                thumbnail = edited.assets["thumbnail"]
                assert edited.owner_id == owner
                assert is_app_data_path_authorized(thumbnail, user_id=owner, is_admin=False)
                assert not is_app_data_path_authorized(thumbnail, user_id=other, is_admin=False)
        finally:
            reset_current_owner_id(token)

        # Reapply shipped defaults as startup does, then read the copy in a new session.
        async with sessions() as session:
            default = await session.get(TemplateV2, builtin_template.id)
            _update_template_from_default(default, builtin_template)
            await session.commit()
        token = set_current_owner_id(owner)
        try:
            async with sessions() as session:
                assert (await session.get(TemplateV2, template_id)).name == "My custom template"
        finally:
            reset_current_owner_id(token)
        token = set_current_owner_id(other)
        try:
            async with sessions() as session:
                assert await session.get(TemplateV2, template_id) is None
                assert [t.id for t in (await session.scalars(select(TemplateV2))).all()] == [builtin_template.id]
                with pytest.raises(HTTPException) as exc:
                    await update_template_metadata(
                        template_id, UpdateTemplateMetadataRequest(name="Not mine"), session
                    )
                assert exc.value.status_code == 404
        finally:
            reset_current_owner_id(token)
            await engine.dispose()

    asyncio.run(run())
