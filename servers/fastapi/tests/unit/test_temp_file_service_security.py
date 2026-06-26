import os

import pytest
from fastapi import HTTPException

from services.temp_file_service import TEMP_FILE_SERVICE


@pytest.fixture
def managed_temp_dir(tmp_path, monkeypatch):
    managed_dir = tmp_path / "presenton-temp"
    managed_dir.mkdir()
    monkeypatch.setattr(TEMP_FILE_SERVICE, "base_dir", str(managed_dir))
    return managed_dir


def test_create_temp_file_path_uses_safe_basename(managed_temp_dir):
    upload_dir = TEMP_FILE_SERVICE.create_temp_dir("upload-case")

    created_path = TEMP_FILE_SERVICE.create_temp_file_path(
        "../../etc/passwd", upload_dir
    )

    assert created_path == os.path.join(upload_dir, "passwd")
    assert os.path.commonpath([created_path, str(managed_temp_dir)]) == str(
        managed_temp_dir
    )


def test_resolve_temp_path_rejects_paths_outside_managed_temp_dir(
    managed_temp_dir, tmp_path
):
    outside_file = tmp_path / "outside.txt"
    outside_file.write_text("secret", encoding="utf-8")

    with pytest.raises(HTTPException) as exc:
        TEMP_FILE_SERVICE.resolve_temp_path(str(outside_file), must_exist=True)

    assert exc.value.status_code == 400
    assert "temp directory" in exc.value.detail


def test_resolve_temp_path_rejects_symlink_escape(managed_temp_dir, tmp_path):
    outside_file = tmp_path / "outside.txt"
    outside_file.write_text("secret", encoding="utf-8")
    symlink_path = managed_temp_dir / "linked-secret.txt"

    try:
        symlink_path.symlink_to(outside_file)
    except OSError:
        pytest.skip("symlinks are not available on this platform")

    with pytest.raises(HTTPException) as exc:
        TEMP_FILE_SERVICE.resolve_temp_path(str(symlink_path), must_exist=True)

    assert exc.value.status_code == 400
    assert "temp directory" in exc.value.detail


def test_resolve_temp_path_accepts_symlinked_parent_of_managed_dir(
    managed_temp_dir, tmp_path, monkeypatch
):
    linked_parent = tmp_path / "linked-parent"

    try:
        linked_parent.symlink_to(managed_temp_dir.parent, target_is_directory=True)
    except OSError:
        pytest.skip("symlinks are not available on this platform")

    linked_managed_dir = linked_parent / managed_temp_dir.name
    temp_file = managed_temp_dir / "inside.txt"
    temp_file.write_text("content", encoding="utf-8")
    monkeypatch.setattr(TEMP_FILE_SERVICE, "base_dir", str(linked_managed_dir))

    assert TEMP_FILE_SERVICE.resolve_temp_path(
        str(linked_managed_dir / temp_file.name), must_exist=True
    ) == str(temp_file)


def test_resolve_temp_path_requires_existing_path(managed_temp_dir):
    missing_file = managed_temp_dir / "missing.txt"

    with pytest.raises(HTTPException) as exc:
        TEMP_FILE_SERVICE.resolve_temp_path(str(missing_file), must_exist=True)

    assert exc.value.status_code == 404
