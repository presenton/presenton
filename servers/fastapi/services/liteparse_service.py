import json
import logging
import os
import subprocess
from typing import Any, Dict, Mapping, Tuple


class LiteParseError(Exception):
    pass


LOGGER = logging.getLogger(__name__)
_LOG_SNIPPET_LIMIT = 600
_DEFAULT_DPI = 120
_DEFAULT_NUM_WORKERS = 1


def _snippet(value: str, limit: int = _LOG_SNIPPET_LIMIT) -> str:
    text = (value or "").strip()
    if not text:
        return "<empty>"
    if len(text) <= limit:
        return text
    return f"{text[:limit]}... [truncated {len(text) - limit} chars]"


def _command_str(parts: list[str]) -> str:
    return " ".join(json.dumps(part) for part in parts)


def _subprocess_text_kwargs() -> Mapping[str, object]:
    """Decode subprocess output consistently across platforms.

    Windows defaults to a locale-dependent code page (often cp1252), which can
    crash while decoding UTF-8 output from Node tools. Use UTF-8 and replace
    undecodable bytes to keep parsing resilient.
    """
    return {"text": True, "encoding": "utf-8", "errors": "replace"}


def _env_int(name: str, default: int, minimum: int, maximum: int) -> int:
    raw = (os.getenv(name) or "").strip()
    if not raw:
        return default

    try:
        parsed = int(raw)
    except Exception:
        LOGGER.warning(
            "[LiteParse] Invalid %s=%r, using default=%s",
            name,
            raw,
            default,
        )
        return default

    return min(max(parsed, minimum), maximum)


class LiteParseService:
    def __init__(self, timeout_seconds: int = 180):
        self.timeout_seconds = timeout_seconds
        self.node_binary = os.getenv("LITEPARSE_NODE_BINARY", "node")
        self.dpi = _env_int("LITEPARSE_DPI", _DEFAULT_DPI, minimum=72, maximum=600)
        self.num_workers = _env_int(
            "LITEPARSE_NUM_WORKERS",
            _DEFAULT_NUM_WORKERS,
            minimum=1,
            maximum=64,
        )
        self.runner_path = os.getenv("LITEPARSE_RUNNER_PATH", self._resolve_runner_path())
        self.runner_dir = os.path.dirname(self.runner_path)
        self._npm_project_root = self._resolve_npm_project_root()

    def _build_node_env(self) -> Dict[str, str]:
        """Build environment for Node subprocesses."""
        env = os.environ.copy()

        # LiteParse checks ImageMagick availability with `which magick`.
        # On macOS app launches, PATH often excludes Homebrew bins, even when
        # IMAGEMAGICK_BINARY is configured to an absolute executable path.
        path_entries = [p for p in (env.get("PATH") or "").split(os.pathsep) if p]
        additional_entries = []

        imagemagick_binary = (env.get("IMAGEMAGICK_BINARY") or "").strip()
        if imagemagick_binary:
            magick_dir = os.path.dirname(imagemagick_binary)
            if magick_dir:
                additional_entries.append(magick_dir)

        soffice_binary = (env.get("SOFFICE_PATH") or "").strip()
        if soffice_binary:
            soffice_dir = os.path.dirname(soffice_binary)
            if soffice_dir:
                additional_entries.append(soffice_dir)

        if os.name != "nt":
            additional_entries.extend([
                "/opt/homebrew/bin",
                "/usr/local/bin",
                "/opt/local/bin",
                "/usr/bin",
                "/bin",
            ])

        deduped_additional_entries = []
        for entry in additional_entries:
            normalized = entry.strip()
            if not normalized or not os.path.isdir(normalized):
                continue
            if normalized in path_entries or normalized in deduped_additional_entries:
                continue
            deduped_additional_entries.append(normalized)

        if deduped_additional_entries:
            env["PATH"] = os.pathsep.join(deduped_additional_entries + path_entries)

        return env

    def _resolve_npm_project_root(self) -> str:
        """Directory whose node_modules contains @llamaindex/liteparse."""
        candidates = [
            self.runner_dir,
            os.path.abspath(os.path.join(self.runner_dir, "..")),
            os.path.abspath(os.path.join(os.getcwd(), "..", "..", "document-extraction-liteparse")),
            os.path.abspath(os.path.join(os.getcwd(), "..", "..")),
            "/app/document-extraction-liteparse",
            "/app",
        ]

        fallback = candidates[0]
        for candidate in candidates:
            if os.path.isdir(candidate):
                fallback = candidate
            local_nm = os.path.join(candidate, "node_modules", "@llamaindex", "liteparse")
            if os.path.isdir(local_nm):
                return candidate

        return fallback

    @staticmethod
    def _resolve_runner_path() -> str:
        cwd = os.path.abspath(".")
        service_dir = os.path.dirname(__file__)
        candidates = [
            # Dedicated Docker runtime path
            "/app/document-extraction-liteparse/liteparse_runner.mjs",
            # servers/fastapi (repo root layout) → resources/...
            os.path.abspath(
                os.path.join(
                    cwd,
                    "..",
                    "..",
                    "resources",
                    "document-extraction",
                    "liteparse_runner.mjs",
                )
            ),
            # services/liteparse_service.py → resources/...
            os.path.abspath(
                os.path.join(
                    service_dir,
                    "..",
                    "..",
                    "..",
                    "resources",
                    "document-extraction",
                    "liteparse_runner.mjs",
                )
            ),
            # PyInstaller bundle layout
            os.path.abspath(
                os.path.join(
                    cwd, "..", "..", "app", "resources", "document-extraction", "liteparse_runner.mjs"
                )
            ),
        ]
        for path in candidates:
            if os.path.isfile(path):
                return path
        return candidates[0]

    def check_runtime_ready(self) -> Tuple[bool, str]:
        if not os.path.isfile(self.runner_path):
            return False, f"LiteParse runner not found at: {self.runner_path}"

        try:
            subprocess.run(
                [self.node_binary, "--version"],
                cwd=self.runner_dir,
                check=True,
                capture_output=True,
                timeout=10,
                env=self._build_node_env(),
                **_subprocess_text_kwargs(),
            )
        except Exception as exc:
            return False, f"Node.js runtime is unavailable: {exc}"

        liteparse_dir = os.path.join(
            self._npm_project_root, "node_modules", "@llamaindex", "liteparse"
        )
        if not os.path.isdir(liteparse_dir):
            return (
                False,
                f"LiteParse npm package missing at {liteparse_dir}. Install @llamaindex/liteparse in the runtime project root.",
            )

        # @llamaindex/liteparse is ESM-only; require.resolve() fails. Use dynamic import.
        try:
            subprocess.run(
                [
                    self.node_binary,
                    "--input-type=module",
                    "-e",
                    "import '@llamaindex/liteparse'",
                ],
                cwd=self._npm_project_root,
                check=True,
                capture_output=True,
                timeout=20,
                env=self._build_node_env(),
                **_subprocess_text_kwargs(),
            )
        except Exception as exc:
            return False, f"LiteParse dependency is unavailable: {exc}"

        return True, "ok"

    def parse_to_markdown(
        self,
        file_path: str,
        ocr_enabled: bool = True,
        ocr_language: str = "eng",
    ) -> str:
        result = self.parse(
            file_path=file_path,
            ocr_enabled=ocr_enabled,
            ocr_language=ocr_language,
        )
        return str(result.get("text") or "")

    def parse(
        self,
        file_path: str,
        ocr_enabled: bool = True,
        ocr_language: str = "eng",
    ) -> Dict[str, Any]:
        is_ready, reason = self.check_runtime_ready()
        if not is_ready:
            raise LiteParseError(reason)

        command = [
            self.node_binary,
            self.runner_path,
            "--file",
            file_path,
            "--ocr-enabled",
            "true" if ocr_enabled else "false",
            "--ocr-language",
            ocr_language,
            "--dpi",
            str(self.dpi),
            "--num-workers",
            str(self.num_workers),
        ]
        ocr_server = (os.getenv("LITEPARSE_OCR_SERVER_URL") or "").strip()
        if ocr_server:
            command.extend(["--ocr-server-url", ocr_server])
        tessdata = (os.getenv("LITEPARSE_TESSDATA_PATH") or "").strip()
        if tessdata:
            command.extend(["--tessdata-path", tessdata])

        LOGGER.info(
            "[LiteParse] Parsing file=%s ocr_enabled=%s ocr_language=%s dpi=%s num_workers=%s",
            file_path,
            ocr_enabled,
            ocr_language,
            self.dpi,
            self.num_workers,
        )

        process = subprocess.run(
            command,
            cwd=self._npm_project_root,
            capture_output=True,
            timeout=self.timeout_seconds,
            env=self._build_node_env(),
            **_subprocess_text_kwargs(),
        )
        LOGGER.info(
            "[LiteParse] Command finished returncode=%s command=%s",
            process.returncode,
            _command_str(command),
        )

        payload: Dict[str, Any]
        try:
            payload = self._decode_runner_output(process.stdout)
        except LiteParseError as exc:
            raise LiteParseError(
                f"{exc}; returncode={process.returncode}; "
                f"stderr={_snippet(process.stderr)}; stdout={_snippet(process.stdout)}"
            ) from exc

        if process.returncode != 0:
            message = payload.get("error") or process.stderr.strip() or "Unknown error"
            LOGGER.error(
                "[LiteParse] Parse failed returncode=%s stderr=%s stdout=%s",
                process.returncode,
                _snippet(process.stderr),
                _snippet(process.stdout),
            )
            raise LiteParseError(message)

        if not payload.get("ok"):
            LOGGER.error(
                "[LiteParse] Runner returned not-ok payload=%s",
                _snippet(json.dumps(payload)),
            )
            raise LiteParseError(payload.get("error") or "LiteParse parse failed")

        return payload

    @staticmethod
    def _decode_runner_output(stdout: str) -> Dict[str, Any]:
        raw = (stdout or "").lstrip("\ufeff").strip()
        if not raw:
            raise LiteParseError("LiteParse runner returned empty output")

        # Prefer the last line that parses as JSON (handles stray log lines before our payload).
        lines = [line.strip() for line in raw.splitlines() if line.strip()]
        for line in reversed(lines):
            try:
                parsed = json.loads(line)
                if isinstance(parsed, dict):
                    return parsed
            except json.JSONDecodeError:
                continue

        # Single blob without newlines (entire stdout is one JSON object).
        try:
            parsed = json.loads(raw)
            if isinstance(parsed, dict):
                return parsed
        except json.JSONDecodeError:
            pass

        raise LiteParseError("LiteParse runner returned invalid JSON output")
