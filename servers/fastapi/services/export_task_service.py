import asyncio
import base64
import json
import logging
import mimetypes
import os
import shutil
import subprocess
import tempfile
from typing import Any, Literal, Mapping
from urllib.parse import unquote, urlparse

from fastapi import HTTPException
from pydantic import BaseModel, ValidationError

from services.liteparse_service import _command_str, _snippet
from api.v1.auth.context import get_current_owner_id
from utils.asset_directory_utils import (
    get_exports_directory,
    resolve_app_path_to_filesystem,
)
from utils.get_env import get_app_data_directory_env, get_temp_directory_env
from utils.runtime_limits import (
    BoundedTextBuffer,
    log_memory,
)

LOGGER = logging.getLogger(__name__)

EXPORT_DIRECTORY_MODE = 0o755
EXPORT_FILE_MODE = 0o644


def _localize_json_image_assets(
    value: Any,
    data_uri_cache: dict[str, str] | None = None,
) -> Any:
    """Return a copy with local image sources embedded for headless rendering."""
    cache = data_uri_cache if data_uri_cache is not None else {}

    if isinstance(value, list):
        return [_localize_json_image_assets(item, cache) for item in value]
    if not isinstance(value, dict):
        return value

    localized = {
        key: _localize_json_image_assets(item, cache) for key, item in value.items()
    }
    if localized.get("type") != "image":
        return localized

    source = localized.get("data")
    if not isinstance(source, str) or not source:
        return localized

    parsed = urlparse(source)
    if parsed.scheme in ("http", "https"):
        candidate = unquote(parsed.path)
    elif not parsed.scheme and source.startswith(("/app_data/", "/static/")):
        candidate = source
    else:
        return localized

    if not candidate.startswith(("/app_data/", "/static/")):
        return localized

    resolved = resolve_app_path_to_filesystem(candidate)
    if not resolved:
        return localized

    data_uri = cache.get(resolved)
    if data_uri is None:
        try:
            with open(resolved, "rb") as asset_file:
                asset_data = asset_file.read()
        except OSError:
            return localized
        mime_type = mimetypes.guess_type(resolved)[0] or "application/octet-stream"
        encoded = base64.b64encode(asset_data).decode("ascii")
        data_uri = f"data:{mime_type};base64,{encoded}"
        cache[resolved] = data_uri

    localized["data"] = data_uri
    return localized


def _windows_hidden_subprocess_kwargs() -> dict[str, object]:
    if os.name != "nt":
        return {}
    return {"creationflags": getattr(subprocess, "CREATE_NO_WINDOW", 0)}


class PptxToHtmlDocument(BaseModel):
    slides: list[str]
    font_css: str = ""
    width: float
    height: float
    images_dir: str
    fonts_dir: str


class PptxToJsonDocument(BaseModel):
    layouts: list[dict[str, Any]]


class PresentationExportTaskResult(BaseModel):
    path: str


class HtmlToImageTaskResult(BaseModel):
    path: str


class HtmlToImagesTaskResult(BaseModel):
    paths: list[str]


class JsonToImageTaskResult(BaseModel):
    path: str


class ExportTaskService:
    def __init__(self, timeout_seconds: int = 300):
        self.timeout_seconds = timeout_seconds
        self.node_binary = os.getenv("LITEPARSE_NODE_BINARY", "node")
        self.export_dir = self._resolve_export_dir()
        self.entrypoint_path = self._resolve_entrypoint_path(self.export_dir)

    @staticmethod
    def _resolve_export_dir() -> str:
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
            if os.path.isfile(os.path.join(candidate, "runner.mjs")):
                return candidate

        return candidates[0]

    @staticmethod
    def _resolve_entrypoint_path(export_dir: str) -> str:
        return os.path.join(export_dir, "runner.mjs")

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
        owner_id = get_current_owner_id()
        if owner_id is not None:
            temp_directory = os.path.join(temp_directory, str(owner_id))
        os.makedirs(temp_directory, exist_ok=True)
        env["TEMP_DIRECTORY"] = temp_directory

        puppeteer_temp_directory = (
            env.get("PUPPETEER_TMP_DIR") or os.path.join(temp_directory, "puppeteer")
        )
        os.makedirs(puppeteer_temp_directory, exist_ok=True)
        env["PUPPETEER_TMP_DIR"] = puppeteer_temp_directory

        puppeteer_cache_directory = env.get("PUPPETEER_CACHE_DIR") or os.path.join(
            temp_directory, "puppeteer-cache"
        )
        os.makedirs(puppeteer_cache_directory, exist_ok=True)
        env["PUPPETEER_CACHE_DIR"] = puppeteer_cache_directory

        if env.get("PRESENTON_ELECTRON", "").lower() == "true":
            chromium_executable = (env.get("PUPPETEER_EXECUTABLE_PATH") or "").strip()
            if not chromium_executable or not os.path.isfile(chromium_executable):
                raise HTTPException(
                    status_code=500,
                    detail=(
                        "The pinned Electron Chromium runtime is unavailable. "
                        "Refusing to download or launch a different browser version."
                    ),
                )

        # The export runtime consumes app-data paths relative to the page it is
        # rendering. Docker intentionally leaves NEXT_PUBLIC_FAST_API unset so
        # nginx remains the public origin; Electron supplies its dynamic origin.
        env["ASSETS_BASE_URL"] = "/app_data"
        return env

    def _ensure_runtime_ready(self) -> None:
        if not os.path.isfile(self.entrypoint_path):
            raise HTTPException(
                status_code=500,
                detail=f"Export runtime not found at {self.entrypoint_path}",
            )
        package_entrypoint = os.path.join(
            self.export_dir,
            "node_modules",
            "@presenton",
            "export-core",
            "dist",
            "index.js",
        )
        if not os.path.isfile(package_entrypoint):
            raise HTTPException(
                status_code=500,
                detail=f"Export package not found at {package_entrypoint}",
            )

    @staticmethod
    def _resolve_output_path(response_data: dict) -> str:
        for path_key in ("path", "file_path"):
            path_value = response_data.get(path_key)
            if isinstance(path_value, str):
                resolved = ExportTaskService._resolve_trusted_runtime_path(path_value)
                if resolved:
                    return resolved

        url_value = response_data.get("url")
        if isinstance(url_value, str):
            resolved = ExportTaskService._resolve_trusted_runtime_path(url_value)
            if resolved:
                return resolved

        raise HTTPException(
            status_code=500,
            detail="PPTX-to-HTML task completed without a valid output path",
        )

    @staticmethod
    def _resolve_trusted_runtime_path(path_or_url: str) -> str | None:
        parsed = urlparse(path_or_url)
        candidate = unquote(parsed.path) if parsed.scheme else path_or_url
        if parsed.scheme == "file" and os.name == "nt" and candidate.startswith("/"):
            candidate = candidate[1:]

        allowed_roots = [
            get_app_data_directory_env(),
            get_temp_directory_env() or os.path.join(tempfile.gettempdir(), "presenton"),
        ]
        try:
            resolved = os.path.realpath(os.path.abspath(candidate))
            for root in allowed_roots:
                if not root:
                    continue
                resolved_root = os.path.realpath(root)
                if (
                    os.path.commonpath([resolved, resolved_root]) == resolved_root
                    and os.path.isfile(resolved)
                ):
                    return resolved
        except (OSError, ValueError):
            return None
        return None

    @staticmethod
    def _ensure_output_readable(output_path: str) -> None:
        try:
            os.chmod(os.path.dirname(output_path), EXPORT_DIRECTORY_MODE)
            os.chmod(output_path, EXPORT_FILE_MODE)
        except OSError as exc:
            raise HTTPException(
                status_code=500,
                detail=f"Export completed but output permissions could not be updated: {exc}",
            ) from exc

    @staticmethod
    def _create_task_paths() -> tuple[str, str, str]:
        temp_root = get_temp_directory_env() or os.path.join(
            tempfile.gettempdir(), "presenton"
        )
        owner_id = get_current_owner_id()
        if owner_id is not None:
            temp_root = os.path.join(temp_root, str(owner_id))
        os.makedirs(temp_root, exist_ok=True)
        temp_dir = tempfile.mkdtemp(prefix="export-task-", dir=temp_root)
        task_path = os.path.join(temp_dir, "export_task.json")
        response_path = os.path.join(temp_dir, "export_task.response.json")
        return temp_dir, task_path, response_path

    async def _run_task(self, task_payload: dict, response_error_detail: str) -> dict:
        return await self._run_task_locked(task_payload, response_error_detail)

    async def _run_task_locked(self, task_payload: dict, response_error_detail: str) -> dict:
        self._ensure_runtime_ready()
        temp_dir, task_path, response_path = self._create_task_paths()

        try:
            with open(task_path, "w", encoding="utf-8") as task_file:
                json.dump(task_payload, task_file)

            log_memory(
                LOGGER,
                "export_task.spawn",
                task_type=task_payload.get("type"),
            )
            result = await self._run_bounded_child(
                [self.node_binary, self.entrypoint_path, task_path],
                cwd=self.export_dir,
                timeout=self.timeout_seconds,
                env=dict(self._build_node_env()),
            )
            log_memory(
                LOGGER,
                "export_task.exit",
                task_type=task_payload.get("type"),
                returncode=result["returncode"],
            )

            if result["returncode"] != 0:
                raise HTTPException(
                    status_code=500,
                    detail=(
                        "Export task failed. "
                        f"returncode={result['returncode']} "
                        f"stderr={_snippet(result['stderr'])} stdout={_snippet(result['stdout'])}"
                    ),
                )

            if not os.path.isfile(response_path):
                raise HTTPException(
                    status_code=500,
                    detail=response_error_detail,
                )

            with open(response_path, "r", encoding="utf-8") as response_file:
                return json.load(response_file)
        except json.JSONDecodeError as exc:
            raise HTTPException(
                status_code=500,
                detail="Export task produced invalid JSON output",
            ) from exc
        except OSError as exc:
            raise HTTPException(
                status_code=500,
                detail=f"Failed to run export task: {exc}",
            ) from exc
        finally:
            shutil.rmtree(temp_dir, ignore_errors=True)

    async def _run_bounded_child(
        self,
        command: list[str],
        *,
        cwd: str,
        env: dict[str, str],
        timeout: int,
    ) -> dict[str, str | int]:
        stdout_tail = BoundedTextBuffer()
        stderr_tail = BoundedTextBuffer()
        process = await asyncio.create_subprocess_exec(
            *command,
            cwd=cwd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            env=env,
            **_windows_hidden_subprocess_kwargs(),
        )

        LOGGER.info(
            "[export_runtime] child started pid=%s command=%s",
            process.pid,
            _command_str(command),
        )

        async def drain(
            stream: asyncio.StreamReader | None,
            tail: BoundedTextBuffer,
            label: str,
        ) -> None:
            if stream is None:
                return
            while True:
                chunk = await stream.read(65536)
                if not chunk:
                    break
                tail.append(chunk)
                LOGGER.debug("[export_runtime] %s chunk=%s bytes", label, len(chunk))

        stdout_task = asyncio.create_task(drain(process.stdout, stdout_tail, "stdout"))
        stderr_task = asyncio.create_task(drain(process.stderr, stderr_tail, "stderr"))
        try:
            await asyncio.wait_for(
                asyncio.gather(process.wait(), stdout_task, stderr_task),
                timeout=timeout,
            )
        except asyncio.TimeoutError as exc:
            process.kill()
            await process.wait()
            await asyncio.gather(stdout_task, stderr_task, return_exceptions=True)
            raise HTTPException(
                status_code=500,
                detail=f"Export task timed out after {timeout} seconds",
            ) from exc

        LOGGER.info(
            "[export_runtime] child exited pid=%s returncode=%s",
            process.pid,
            process.returncode,
        )
        return {
            "returncode": process.returncode if process.returncode is not None else -1,
            "stdout": stdout_tail.get(),
            "stderr": stderr_tail.get(),
        }

    async def export_from_url(
        self,
        url: str,
        title: str,
        export_as: Literal["pdf", "pptx"],
        fastapi_url: str | None = None,
        cookie_header: str | None = None,
    ) -> PresentationExportTaskResult:
        log_url = url.split("#", 1)[0] if "#" in url else url
        LOGGER.info(
            "[export_runtime] export_from_url url=%s format=%s cookie_header=%s",
            log_url,
            export_as,
            "set" if cookie_header else "empty",
        )
        response_data = await self._run_task(
            {
                "type": "export",
                "url": url,
                "format": export_as,
                "title": title,
                "fastapiUrl": fastapi_url or None,
                "cookieHeader": cookie_header or None,
            },
            "Export task did not produce a response file",
        )

        output_path = self._resolve_output_path(response_data)
        output_path = self._move_export_to_owner(output_path)
        self._ensure_output_readable(output_path)

        return PresentationExportTaskResult(
            path=output_path,
        )

    async def convert_pptx_to_html(
        self, pptx_path: str, get_fonts: bool = False
    ) -> PptxToHtmlDocument:
        if not os.path.isfile(pptx_path):
            raise HTTPException(status_code=400, detail=f"PPTX not found: {pptx_path}")

        try:
            response_data = await self._run_task(
                {
                    "type": "pptx-to-html",
                    "pptx_path": pptx_path,
                    "get_fonts": get_fonts,
                },
                "PPTX-to-HTML export task did not produce a response file",
            )

            output_path = self._resolve_output_path(response_data)
            with open(output_path, "r", encoding="utf-8") as output_file:
                output_data = json.load(output_file)

            # export-core intentionally writes slide asset references relative to
            # presentation.json (for example, images/slide.png). Preserve that
            # relationship after the conversion directory is owner-scoped by
            # resolving the manifest's asset directories before it is moved.
            artifact_dir = os.path.realpath(os.path.dirname(output_path))
            for directory_key in ("images_dir", "fonts_dir"):
                directory = output_data.get(directory_key)
                if not isinstance(directory, str) or not directory:
                    continue
                resolved_directory = os.path.realpath(
                    directory
                    if os.path.isabs(directory)
                    else os.path.join(artifact_dir, directory)
                )
                try:
                    is_artifact_directory = (
                        os.path.commonpath([resolved_directory, artifact_dir])
                        == artifact_dir
                    )
                except ValueError:
                    is_artifact_directory = False
                if not is_artifact_directory:
                    raise HTTPException(
                        status_code=500,
                        detail=(
                            "PPTX-to-HTML export returned an asset directory "
                            "outside its conversion directory"
                        ),
                    )
                output_data[directory_key] = resolved_directory

            output_data = self._scope_conversion_artifacts(
                output_path,
                output_data,
                "pptx-to-html",
            )

            return PptxToHtmlDocument(**output_data)
        except json.JSONDecodeError as exc:
            raise HTTPException(
                status_code=500,
                detail="PPTX-to-HTML export produced invalid JSON output",
            ) from exc

    async def render_html_to_image(
        self,
        html: str,
        width: int,
        height: int,
    ) -> HtmlToImageTaskResult:
        if width <= 0 or height <= 0:
            raise HTTPException(
                status_code=400,
                detail="HTML-to-image dimensions must be positive",
            )

        response_data = await self._run_task(
            {
                "type": "html-to-image",
                "html": html,
                "width": width,
                "height": height,
            },
            "HTML-to-image export task did not produce a response file",
        )

        output_path = self._resolve_output_path(response_data)
        self._ensure_output_readable(output_path)

        return HtmlToImageTaskResult(path=output_path)

    async def render_json_to_image(
        self,
        data: list[dict[str, Any]],
        width: int,
        height: int,
        fonts: Mapping[str, str] | None = None,
    ) -> JsonToImageTaskResult:
        if width <= 0 or height <= 0:
            raise HTTPException(
                status_code=400,
                detail="JSON-to-image dimensions must be positive",
            )

        task_payload: dict[str, Any] = {
            "type": "json-to-image",
            "data": _localize_json_image_assets(data),
            "width": width,
            "height": height,
        }
        if fonts:
            task_payload["fonts"] = dict(fonts)

        response_data = await self._run_task(
            task_payload,
            "JSON-to-image export task did not produce a response file",
        )

        output_path = self._resolve_output_path(response_data)
        self._ensure_output_readable(output_path)

        return JsonToImageTaskResult(path=output_path)

    async def render_htmls_to_images(
        self,
        htmls: list[str],
        width: int,
        height: int,
    ) -> HtmlToImagesTaskResult:
        if not htmls:
            raise HTTPException(
                status_code=400,
                detail="At least one HTML document is required",
            )
        if width <= 0 or height <= 0:
            raise HTTPException(
                status_code=400,
                detail="HTML-to-image dimensions must be positive",
            )

        try:
            response_data = await self._run_task(
                {
                    "type": "html-to-images",
                    "htmls": htmls,
                    "width": width,
                    "height": height,
                },
                "HTML-to-images export task did not produce a response file",
            )
        except HTTPException as exc:
            if "Invalid task type" in str(exc.detail):
                LOGGER.warning(
                    "[export_runtime] html-to-images is unavailable; "
                    "falling back to one task per HTML document"
                )
            elif exc.status_code == 500:
                LOGGER.warning(
                    "[export_runtime] html-to-images failed; "
                    "falling back to one task per HTML document. detail=%s",
                    exc.detail,
                )
            else:
                raise
            results = [
                await self.render_html_to_image(html, width, height) for html in htmls
            ]
            return HtmlToImagesTaskResult(paths=[result.path for result in results])

        raw_paths = response_data.get("file_paths")
        if not isinstance(raw_paths, list) or len(raw_paths) != len(htmls):
            raise HTTPException(
                status_code=500,
                detail="HTML-to-images export task produced invalid output",
            )

        output_paths = [
            self._resolve_output_path({"file_path": raw_path}) for raw_path in raw_paths
        ]
        for output_path in output_paths:
            self._ensure_output_readable(output_path)

        return HtmlToImagesTaskResult(paths=output_paths)

    async def convert_pptx_to_json(self, pptx_path: str) -> PptxToJsonDocument:
        if not os.path.isfile(pptx_path):
            raise HTTPException(status_code=400, detail=f"PPTX not found: {pptx_path}")

        task_payload: dict[str, Any] = {
            "type": "pptx-to-json",
            "pptx_path": pptx_path,
        }

        try:
            response_data = await self._run_task(
                task_payload,
                "PPTX-to-JSON export task did not produce a response file",
            )

            output_path = self._resolve_output_path(response_data)
            with open(output_path, "r", encoding="utf-8") as output_file:
                output_data = json.load(output_file)
            output_data = self._scope_conversion_artifacts(
                output_path,
                output_data,
                "pptx-to-json",
            )

            return PptxToJsonDocument(**output_data)
        except json.JSONDecodeError as exc:
            raise HTTPException(
                status_code=500,
                detail="PPTX-to-JSON export produced invalid JSON output",
            ) from exc
        except ValidationError as exc:
            raise HTTPException(
                status_code=500,
                detail="PPTX-to-JSON export produced invalid output",
            ) from exc

    @staticmethod
    def _move_export_to_owner(output_path: str) -> str:
        if get_current_owner_id() is None:
            return output_path
        destination_dir = get_exports_directory()
        app_data = get_app_data_directory_env()
        if not app_data:
            raise HTTPException(
                status_code=500,
                detail="APP_DATA_DIRECTORY is required for exported files",
            )
        exports_root = os.path.realpath(os.path.join(app_data, "exports"))
        resolved_output = os.path.realpath(output_path)
        resolved_destination_dir = os.path.realpath(destination_dir)
        source_parent = os.path.dirname(resolved_output)
        try:
            relative_source = os.path.relpath(resolved_output, exports_root)
            source_is_export = (
                os.path.commonpath([resolved_output, exports_root]) == exports_root
                and relative_source.split(os.sep, 1)[0] != "users"
            )
        except ValueError:
            source_is_export = False
        if not source_is_export and source_parent != resolved_destination_dir:
            raise HTTPException(
                status_code=500,
                detail="Export task returned an output outside its asset directory",
            )
        destination = os.path.join(destination_dir, os.path.basename(output_path))
        os.makedirs(destination_dir, exist_ok=True)
        if resolved_output != os.path.realpath(destination):
            os.replace(output_path, destination)
        return destination

    @staticmethod
    def _scope_conversion_artifacts(
        output_path: str,
        output_data: Any,
        root_name: Literal["pptx-to-html", "pptx-to-json"],
    ) -> Any:
        owner_id = get_current_owner_id()
        if owner_id is None:
            return output_data

        source_dir = os.path.realpath(os.path.dirname(output_path))
        session_id = os.path.basename(source_dir)
        app_data = get_app_data_directory_env()
        if not app_data:
            raise HTTPException(
                status_code=500,
                detail="APP_DATA_DIRECTORY is required for conversion artifacts",
            )
        source_root = os.path.realpath(os.path.join(app_data, root_name))
        owner_root = os.path.realpath(
            os.path.join(source_root, "users", str(owner_id))
        )
        source_parent = os.path.dirname(source_dir)
        if source_parent not in {source_root, owner_root} or session_id == "users":
            raise HTTPException(
                status_code=500,
                detail="Conversion task returned an output outside its asset directory",
            )
        target_dir = os.path.join(
            owner_root,
            session_id,
        )
        os.makedirs(os.path.dirname(target_dir), exist_ok=True)
        if os.path.realpath(target_dir) != source_dir:
            shutil.move(source_dir, target_dir)

        source_url = f"/app_data/{root_name}/{session_id}"
        target_url = (
            f"/app_data/{root_name}/users/{owner_id}/{session_id}"
        )

        def rewrite(value: Any) -> Any:
            if isinstance(value, str):
                return value.replace(source_dir, target_dir).replace(
                    source_url,
                    target_url,
                )
            if isinstance(value, list):
                return [rewrite(item) for item in value]
            if isinstance(value, dict):
                return {key: rewrite(item) for key, item in value.items()}
            return value

        return rewrite(output_data)

EXPORT_TASK_SERVICE = ExportTaskService()
