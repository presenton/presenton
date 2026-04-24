import asyncio
import json
import os
import shutil
import subprocess
import tempfile
from typing import Mapping

from fastapi import HTTPException
from pydantic import BaseModel

from services.liteparse_service import _snippet, _subprocess_text_kwargs
from utils.asset_directory_utils import resolve_app_path_to_filesystem
from utils.get_env import get_app_data_directory_env, get_temp_directory_env


class PptxToHtmlDocument(BaseModel):
    slides: list[str]
    font_css: str = ""
    width: float
    height: float
    images_dir: str
    fonts_dir: str


class ExportTaskService:
    def __init__(self, timeout_seconds: int = 300):
        self.timeout_seconds = timeout_seconds
        self.node_binary = os.getenv("LITEPARSE_NODE_BINARY", "node")
        self.export_dir = self._resolve_export_dir()
        self.entrypoint_path = self._resolve_entrypoint_path(self.export_dir)
        self.converter_path = self._resolve_converter_path(self.export_dir)

    @staticmethod
    def _resolve_export_dir() -> str:
        configured = (os.getenv("EXPORT_RUNTIME_DIR") or "").strip()
        if configured:
            return configured

        package_root = (os.getenv("EXPORT_PACKAGE_ROOT") or "").strip()
        if package_root:
            return package_root

        cwd = os.path.abspath(".")
        service_dir = os.path.dirname(__file__)
        candidates = [
            os.path.abspath(os.path.join(cwd, "..", "..", "presentation-export")),
            os.path.abspath(os.path.join(cwd, "..", "presentation-export")),
            os.path.abspath(os.path.join(service_dir, "..", "..", "..", "presentation-export")),
            os.path.abspath(os.path.join(service_dir, "..", "..", "..", "..", "presentation-export")),
        ]

        for candidate in candidates:
            if os.path.isfile(os.path.join(candidate, "index.cjs")) or os.path.isfile(
                os.path.join(candidate, "index.js")
            ):
                return candidate

        return candidates[0]

    @staticmethod
    def _resolve_entrypoint_path(export_dir: str) -> str:
        index_cjs = os.path.join(export_dir, "index.cjs")
        if os.path.isfile(index_cjs):
            return index_cjs

        index_js = os.path.join(export_dir, "index.js")
        if os.path.isfile(index_js):
            shutil.copyfile(index_js, index_cjs)
            return index_cjs

        return index_cjs

    @staticmethod
    def _resolve_converter_path(export_dir: str) -> str:
        py_dir = os.path.join(export_dir, "py")
        extension = ".exe" if os.name == "nt" else ""
        platform_name = sys_platform()
        arch_name = sys_arch()
        candidates = [
            os.path.join(py_dir, f"convert-{platform_name}-{arch_name}{extension}"),
            os.path.join(py_dir, f"convert-{platform_name}{extension}"),
            os.path.join(py_dir, f"convert{extension}"),
            os.path.join(py_dir, "convert"),
        ]
        for candidate in candidates:
            if candidate and os.path.isfile(candidate):
                return candidate
        return candidates[1]

    def _build_node_env(self) -> Mapping[str, str]:
        env = os.environ.copy()

        app_data_directory = get_app_data_directory_env()
        if not app_data_directory:
            raise HTTPException(
                status_code=500,
                detail="APP_DATA_DIRECTORY must be set for PPTX-to-HTML export",
            )
        env["APP_DATA_DIRECTORY"] = app_data_directory

        temp_directory = get_temp_directory_env() or os.path.join(
            tempfile.gettempdir(), "presenton"
        )
        os.makedirs(temp_directory, exist_ok=True)
        env["TEMP_DIRECTORY"] = temp_directory

        fastapi_public_url = (os.getenv("FASTAPI_PUBLIC_URL") or "").strip()
        if not fastapi_public_url:
            raise HTTPException(
                status_code=500,
                detail="FASTAPI_PUBLIC_URL must be set for PPTX-to-HTML export",
            )
        env["ASSETS_BASE_URL"] = f"{fastapi_public_url.rstrip('/')}/app_data"
        env["BUILT_PYTHON_MODULE_PATH"] = self.converter_path

        return env

    def _ensure_runtime_ready(self) -> None:
        if not os.path.isfile(self.entrypoint_path):
            raise HTTPException(
                status_code=500,
                detail=f"Export runtime not found at {self.entrypoint_path}",
            )
        if not os.path.isfile(self.converter_path):
            raise HTTPException(
                status_code=500,
                detail=f"Export converter binary not found at {self.converter_path}",
            )

    @staticmethod
    def _resolve_output_path(response_data: dict) -> str:
        path_value = response_data.get("path")
        if isinstance(path_value, str):
            resolved = resolve_app_path_to_filesystem(path_value) or path_value
            if os.path.isfile(resolved):
                return resolved

        url_value = response_data.get("url")
        if isinstance(url_value, str):
            resolved = resolve_app_path_to_filesystem(url_value)
            if resolved and os.path.isfile(resolved):
                return resolved

        raise HTTPException(
            status_code=500,
            detail="PPTX-to-HTML task completed without a valid output path",
        )

    async def convert_pptx_to_html(
        self, pptx_path: str, get_fonts: bool = False
    ) -> PptxToHtmlDocument:
        self._ensure_runtime_ready()
        if not os.path.isfile(pptx_path):
            raise HTTPException(status_code=400, detail=f"PPTX not found: {pptx_path}")

        temp_root = get_temp_directory_env() or os.path.join(tempfile.gettempdir(), "presenton")
        os.makedirs(temp_root, exist_ok=True)
        temp_dir = tempfile.mkdtemp(prefix="export-task-", dir=temp_root)
        task_path = os.path.join(temp_dir, "export_task.json")
        response_path = os.path.join(temp_dir, "export_task.response.json")

        try:
            with open(task_path, "w", encoding="utf-8") as task_file:
                json.dump(
                    {
                        "type": "pptx-to-html",
                        "pptx_path": pptx_path,
                        "get_fonts": get_fonts,
                    },
                    task_file,
                )

            result = await asyncio.to_thread(
                subprocess.run,
                [self.node_binary, self.entrypoint_path, task_path],
                cwd=self.export_dir,
                capture_output=True,
                timeout=self.timeout_seconds,
                env=dict(self._build_node_env()),
                **_subprocess_text_kwargs(),
            )

            if result.returncode != 0:
                raise HTTPException(
                    status_code=500,
                    detail=(
                        "PPTX-to-HTML export task failed. "
                        f"stderr={_snippet(result.stderr)} stdout={_snippet(result.stdout)}"
                    ),
                )

            if not os.path.isfile(response_path):
                raise HTTPException(
                    status_code=500,
                    detail="PPTX-to-HTML export task did not produce a response file",
                )

            with open(response_path, "r", encoding="utf-8") as response_file:
                response_data = json.load(response_file)

            output_path = self._resolve_output_path(response_data)
            with open(output_path, "r", encoding="utf-8") as output_file:
                output_data = json.load(output_file)

            return PptxToHtmlDocument(**output_data)
        except subprocess.TimeoutExpired as exc:
            raise HTTPException(
                status_code=500,
                detail=f"PPTX-to-HTML export timed out after {self.timeout_seconds} seconds",
            ) from exc
        except json.JSONDecodeError as exc:
            raise HTTPException(
                status_code=500,
                detail="PPTX-to-HTML export produced invalid JSON output",
            ) from exc
        except OSError as exc:
            raise HTTPException(
                status_code=500,
                detail=f"Failed to run PPTX-to-HTML export task: {exc}",
            ) from exc
        finally:
            shutil.rmtree(temp_dir, ignore_errors=True)


def sys_platform() -> str:
    if os.name == "nt":
        return "win32"
    return os.sys.platform


def sys_arch() -> str:
    machine = (os.environ.get("PROCESSOR_ARCHITECTURE") or "").lower()
    if not machine and hasattr(os, "uname"):
        machine = os.uname().machine.lower()

    arch_map = {
        "x86_64": "x64",
        "amd64": "x64",
        "x64": "x64",
        "aarch64": "arm64",
        "arm64": "arm64",
    }
    return arch_map.get(machine, machine or "x64")


EXPORT_TASK_SERVICE = ExportTaskService()
