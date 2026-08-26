import os
import uuid

import pytest
from fastapi import HTTPException

from api.v1.auth.assets import is_app_data_path_authorized
from api.v1.auth.context import (
    reset_current_owner_id,
    reset_current_owner_is_admin,
    set_current_owner_id,
    set_current_owner_is_admin,
)
from services.export_task_service import ExportTaskService
from utils.asset_directory_utils import resolve_app_path_to_filesystem


def test_browser_asset_paths_are_owner_scoped_and_traversal_safe():
    owner_id = uuid.uuid4()
    other_id = uuid.uuid4()

    assert is_app_data_path_authorized(
        f"/app_data/images/users/{owner_id}/slide.png",
        user_id=owner_id,
        is_admin=False,
    )
    assert not is_app_data_path_authorized(
        f"/app_data/images/users/{other_id}/slide.png",
        user_id=owner_id,
        is_admin=False,
    )
    assert not is_app_data_path_authorized(
        "/app_data/images/%252e%252e/userConfig.json",
        user_id=owner_id,
        is_admin=True,
    )
    assert not is_app_data_path_authorized(
        "/app_data/images/%2525252525252525252e%2525252525252525252e"
        "/userConfig.json",
        user_id=owner_id,
        is_admin=True,
    )
    assert not is_app_data_path_authorized(
        "/app_data/images/legacy.png",
        user_id=owner_id,
        is_admin=False,
    )
    assert is_app_data_path_authorized(
        "/app_data/images/legacy.png",
        user_id=owner_id,
        is_admin=True,
    )


def test_server_side_file_resolution_rejects_other_users_and_symlink_escape(
    monkeypatch, tmp_path
):
    app_data = tmp_path / "app_data"
    owner_id = uuid.uuid4()
    other_id = uuid.uuid4()
    own_file = app_data / "uploads" / "users" / str(owner_id) / "own.pptx"
    other_file = app_data / "uploads" / "users" / str(other_id) / "secret.pptx"
    own_file.parent.mkdir(parents=True)
    other_file.parent.mkdir(parents=True)
    own_file.write_bytes(b"own")
    other_file.write_bytes(b"secret")
    monkeypatch.setenv("APP_DATA_DIRECTORY", str(app_data))

    owner_token = set_current_owner_id(owner_id)
    admin_token = set_current_owner_is_admin(False)
    try:
        assert resolve_app_path_to_filesystem(
            f"/app_data/uploads/users/{owner_id}/own.pptx"
        ) == os.path.realpath(own_file)
        assert (
            resolve_app_path_to_filesystem(
                f"/app_data/uploads/users/{other_id}/secret.pptx"
            )
            is None
        )
        assert (
            resolve_app_path_to_filesystem(
                "/app_data/uploads/users/"
                f"{owner_id}/../../{other_id}/secret.pptx"
            )
            is None
        )
    finally:
        reset_current_owner_is_admin(admin_token)
        reset_current_owner_id(owner_token)


def test_conversion_artifacts_are_moved_into_the_owner_namespace(
    monkeypatch, tmp_path
):
    app_data = tmp_path / "app_data"
    owner_id = uuid.uuid4()
    source_dir = app_data / "pptx-to-json" / "session-1"
    output_path = source_dir / "presentation.json"
    image_path = source_dir / "images" / "slide.png"
    image_path.parent.mkdir(parents=True)
    output_path.write_text("{}", encoding="utf-8")
    image_path.write_bytes(b"image")
    monkeypatch.setenv("APP_DATA_DIRECTORY", str(app_data))

    owner_token = set_current_owner_id(owner_id)
    try:
        rewritten = ExportTaskService._scope_conversion_artifacts(
            str(output_path),
            {
                "layouts": [
                    {
                        "image": "/app_data/pptx-to-json/session-1/images/slide.png"
                    }
                ]
            },
            "pptx-to-json",
        )
    finally:
        reset_current_owner_id(owner_token)

    target_dir = (
        app_data / "pptx-to-json" / "users" / str(owner_id) / "session-1"
    )
    assert not source_dir.exists()
    assert (target_dir / "images" / "slide.png").is_file()
    assert rewritten["layouts"][0]["image"] == (
        f"/app_data/pptx-to-json/users/{owner_id}/session-1/images/slide.png"
    )


def test_conversion_relative_assets_are_absolutized_before_owner_scoping(
    monkeypatch, tmp_path
):
    app_data = tmp_path / "app_data"
    source_dir = app_data / "pptx-to-json" / "session-1"
    output_path = source_dir / "presentation.json"
    image_path = source_dir / "images" / "slide.png"
    image_path.parent.mkdir(parents=True)
    output_path.write_text("{}", encoding="utf-8")
    image_path.write_bytes(b"image")
    monkeypatch.setenv("APP_DATA_DIRECTORY", str(app_data))

    rewritten = ExportTaskService._absolutize_conversion_asset_urls(
        str(output_path),
        {
            "layouts": [
                {
                    "elements": [
                        {"type": "image", "data": "images/slide.png"},
                        {"type": "image", "data": "images/../../secret.png"},
                    ]
                }
            ]
        },
        "pptx-to-json",
    )

    elements = rewritten["layouts"][0]["elements"]
    assert elements[0]["data"] == (
        "/app_data/pptx-to-json/session-1/images/slide.png"
    )
    assert elements[1]["data"] == "images/../../secret.png"


def test_conversion_artifacts_cannot_move_an_unrelated_app_data_directory(
    monkeypatch, tmp_path
):
    app_data = tmp_path / "app_data"
    owner_id = uuid.uuid4()
    unrelated_dir = app_data / "uploads" / "users" / str(uuid.uuid4())
    output_path = unrelated_dir / "presentation.json"
    unrelated_dir.mkdir(parents=True)
    output_path.write_text("{}", encoding="utf-8")
    monkeypatch.setenv("APP_DATA_DIRECTORY", str(app_data))

    owner_token = set_current_owner_id(owner_id)
    try:
        with pytest.raises(HTTPException, match="outside its asset directory"):
            ExportTaskService._scope_conversion_artifacts(
                str(output_path),
                {},
                "pptx-to-json",
            )
    finally:
        reset_current_owner_id(owner_token)

    assert output_path.is_file()


def test_export_cannot_move_another_users_file(monkeypatch, tmp_path):
    app_data = tmp_path / "app_data"
    owner_id = uuid.uuid4()
    other_id = uuid.uuid4()
    other_export = (
        app_data / "exports" / "users" / str(other_id) / "private.pptx"
    )
    other_export.parent.mkdir(parents=True)
    other_export.write_bytes(b"private")
    monkeypatch.setenv("APP_DATA_DIRECTORY", str(app_data))

    owner_token = set_current_owner_id(owner_id)
    try:
        with pytest.raises(HTTPException, match="outside its asset directory"):
            ExportTaskService._move_export_to_owner(str(other_export))
    finally:
        reset_current_owner_id(owner_token)

    assert other_export.read_bytes() == b"private"
