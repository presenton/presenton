import os
from typing import Optional, Union

from fastapi import HTTPException

from utils.get_env import get_temp_directory_env
import uuid


class TempFileService:

    def __init__(self):
        self.base_dir = get_temp_directory_env() or "/tmp/presenton"
        self.cleanup_base_dir()
        os.makedirs(self.base_dir, exist_ok=True)

    def _base_dir_realpath(self) -> str:
        return os.path.realpath(self.base_dir)

    def _is_within_base_dir(self, path: str) -> bool:
        base_dir = self._base_dir_realpath()
        return path == base_dir or path.startswith(f"{base_dir}{os.sep}")

    def _assert_within_base_dir(self, path: str, detail: str):
        if not self._is_within_base_dir(path):
            raise HTTPException(status_code=400, detail=detail)

    def sanitize_upload_filename(self, file_name: Optional[str]) -> str:
        normalized_name = (file_name or "").replace("\\", "/")
        safe_name = os.path.basename(normalized_name).strip()
        if not safe_name or safe_name in {".", ".."}:
            raise HTTPException(status_code=400, detail="Invalid filename")
        return safe_name

    def resolve_temp_path(self, file_path: str, must_exist: bool = False) -> str:
        if not isinstance(file_path, str) or not file_path.strip():
            raise HTTPException(status_code=400, detail="Invalid file path")

        try:
            resolved_path = os.path.realpath(os.path.abspath(file_path))
        except OSError as exc:
            raise HTTPException(status_code=404, detail="File not found") from exc

        base_dir = self._base_dir_realpath()
        if not (
            resolved_path == base_dir
            or resolved_path.startswith(f"{base_dir}{os.sep}")
        ):
            raise HTTPException(
                status_code=400,
                detail="File path must stay within the temp directory",
            )

        if must_exist and not os.path.exists(resolved_path):
            raise HTTPException(status_code=404, detail="File not found")

        return resolved_path

    def resolve_existing_temp_paths(self, file_paths: Optional[list[str]]) -> list[str]:
        if not file_paths:
            return []
        return [
            self.resolve_temp_path(file_path, must_exist=True) for file_path in file_paths
        ]

    def create_dir_in_dir(self, base_dir: str, dir_name: Optional[str] = None) -> str:
        temp_dir_name = (
            self.sanitize_upload_filename(dir_name) if dir_name else str(uuid.uuid4())
        )
        temp_dir = os.path.join(base_dir, temp_dir_name)
        temp_dir = os.path.realpath(temp_dir)
        self._assert_within_base_dir(
            temp_dir, "Directory path must stay within the temp directory"
        )
        os.makedirs(temp_dir, exist_ok=True)
        return temp_dir

    def create_temp_dir(self, dir_name: Optional[str] = None) -> str:
        return self.create_dir_in_dir(self.base_dir, dir_name)

    def create_temp_file_path(
        self, file_path: str, dir_path: Optional[str] = None
    ) -> str:
        if dir_path is None:
            dir_path = self.base_dir

        safe_name = self.sanitize_upload_filename(file_path)
        resolved_dir = os.path.realpath(dir_path)
        self._assert_within_base_dir(
            resolved_dir, "Directory path must stay within the temp directory"
        )

        full_path = os.path.join(resolved_dir, safe_name)
        full_path = os.path.realpath(full_path)
        self._assert_within_base_dir(
            full_path, "File path must stay within the temp directory"
        )

        os.makedirs(os.path.dirname(full_path), exist_ok=True)
        return full_path

    def create_temp_file(
        self,
        file_path: str,
        content: Union[bytes, str],
        dir_path: Optional[str] = None,
    ) -> str:
        file_path = self.create_temp_file_path(file_path, dir_path)
        mode = "wb" if isinstance(content, bytes) else "w"
        with open(file_path, mode) as f:
            f.write(content)

        return file_path

    def read_temp_file(self, file_path: str, binary: bool = True) -> Union[bytes, str]:
        file_path = self.resolve_temp_path(file_path, must_exist=True)
        base_dir = self._base_dir_realpath()
        if not (file_path == base_dir or file_path.startswith(f"{base_dir}{os.sep}")):
            raise HTTPException(
                status_code=400,
                detail="File path must stay within the temp directory",
            )
        mode = "rb" if binary else "r"
        with open(file_path, mode) as f:
            return f.read()

    async def update_temp_file_from_upload(self, file_path: str, upload_file) -> None:
        if not isinstance(file_path, str) or not file_path.strip():
            raise HTTPException(status_code=400, detail="Invalid file path")

        base_dir = self._base_dir_realpath()
        normalized_path = os.path.realpath(os.path.abspath(file_path))
        if not normalized_path.startswith(base_dir):
            raise HTTPException(
                status_code=400,
                detail="File path must stay within the temp directory",
            )
        self._assert_within_base_dir(
            normalized_path, "File path must stay within the temp directory"
        )

        with open(normalized_path, "wb") as f:
            f.write(await upload_file.read())

    def cleanup_temp_file(self, file_path: str):
        try:
            file_path = self.resolve_temp_path(file_path, must_exist=True)
        except HTTPException as exc:
            if exc.status_code == 404:
                return
            raise
        os.remove(file_path)

    def _delete_dir_files(self, dir_path: str):
        dir_path = self.resolve_temp_path(dir_path, must_exist=True)
        for root, dirs, files in os.walk(dir_path, topdown=False):
            for name in files:
                os.remove(os.path.join(root, name))
            for name in dirs:
                os.rmdir(os.path.join(root, name))

    def cleanup_temp_dir(self, dir_path: str):
        try:
            dir_path = self.resolve_temp_path(dir_path, must_exist=True)
        except HTTPException as exc:
            if exc.status_code == 404:
                return
            raise
        self._delete_dir_files(dir_path)
        os.rmdir(dir_path)

    def cleanup_base_dir(self):
        self.cleanup_temp_dir(self.base_dir)


TEMP_FILE_SERVICE = TempFileService()
