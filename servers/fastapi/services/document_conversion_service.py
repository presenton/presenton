import os
import subprocess
import logging
from pathlib import Path
from typing import Dict, List


class DocumentConversionError(Exception):
    pass


LOGGER = logging.getLogger(__name__)
_LOG_SNIPPET_LIMIT = 600


def _snippet(value: str, limit: int = _LOG_SNIPPET_LIMIT) -> str:
    text = (value or "").strip()
    if not text:
        return "<empty>"
    if len(text) <= limit:
        return text
    return f"{text[:limit]}... [truncated {len(text) - limit} chars]"


def _command_str(parts: list[str]) -> str:
    return " ".join(repr(part) for part in parts)


def _windows_hidden_subprocess_kwargs() -> Dict[str, object]:
    if os.name != "nt":
        return {}

    startupinfo = subprocess.STARTUPINFO()
    startupinfo.dwFlags |= subprocess.STARTF_USESHOWWINDOW
    return {
        "creationflags": getattr(subprocess, "CREATE_NO_WINDOW", 0),
        "startupinfo": startupinfo,
    }


class DocumentConversionService:
    def __init__(self):
        self.soffice_binary = self._resolve_soffice_binary()
        self.imagemagick_binary = self._resolve_imagemagick_binary()

    @staticmethod
    def _resolve_soffice_binary() -> str:
        configured = (os.getenv("SOFFICE_PATH") or "").strip()
        if configured:
            return configured
        return "soffice.exe" if os.name == "nt" else "soffice"

    @staticmethod
    def _can_execute(command: str, args: List[str]) -> bool:
        try:
            result = subprocess.run(
                [command, *args],
                capture_output=True,
                text=True,
                encoding="utf-8",
                errors="replace",
                timeout=10,
                check=False,
                **_windows_hidden_subprocess_kwargs(),
            )
            return result.returncode == 0
        except Exception:
            return False

    def _resolve_imagemagick_binary(self) -> str:
        configured = (os.getenv("IMAGEMAGICK_BINARY") or "").strip()
        if configured:
            return configured

        for candidate in ["magick", "convert"]:
            if self._can_execute(candidate, ["-version"]):
                return candidate

        return "magick" if os.name == "nt" else "convert"

    def convert_office_to_pdf(
        self,
        file_path: str,
        output_dir: str,
        timeout_seconds: int = 180,
    ) -> str:
        Path(output_dir).mkdir(parents=True, exist_ok=True)

        existing_pdfs = {
            p.name for p in Path(output_dir).glob("*.pdf") if p.is_file()
        }

        try:
            command = [
                self.soffice_binary,
                "--headless",
                "--convert-to",
                "pdf",
                "--outdir",
                output_dir,
                file_path,
            ]
            LOGGER.info(
                "[DocumentConversion] LibreOffice conversion start input=%s output_dir=%s",
                file_path,
                output_dir,
            )
            subprocess.run(
                command,
                check=True,
                capture_output=True,
                text=True,
                encoding="utf-8",
                errors="replace",
                timeout=timeout_seconds,
                **_windows_hidden_subprocess_kwargs(),
            )
            LOGGER.info(
                "[DocumentConversion] LibreOffice conversion complete input=%s",
                file_path,
            )
        except subprocess.TimeoutExpired as exc:
            LOGGER.error(
                "[DocumentConversion] LibreOffice timed out command=%s",
                _command_str(exc.cmd if isinstance(exc.cmd, list) else [str(exc.cmd)]),
            )
            raise DocumentConversionError(
                f"LibreOffice conversion timed out for {os.path.basename(file_path)}"
            ) from exc
        except subprocess.CalledProcessError as exc:
            stderr = (exc.stderr or "").strip()
            stdout = (exc.stdout or "").strip()
            details = stderr or stdout or str(exc)
            LOGGER.error(
                "[DocumentConversion] LibreOffice failed code=%s command=%s stderr=%s stdout=%s",
                exc.returncode,
                _command_str(exc.cmd if isinstance(exc.cmd, list) else [str(exc.cmd)]),
                _snippet(stderr),
                _snippet(stdout),
            )
            raise DocumentConversionError(
                f"LibreOffice conversion failed for {os.path.basename(file_path)}: {details} "
                f"(stderr={_snippet(stderr)}; stdout={_snippet(stdout)})"
            ) from exc
        except Exception as exc:
            LOGGER.exception("[DocumentConversion] LibreOffice conversion unexpected error")
            raise DocumentConversionError(
                f"LibreOffice conversion failed for {os.path.basename(file_path)}: {exc}"
            ) from exc

        expected_pdf = Path(output_dir) / f"{Path(file_path).stem}.pdf"
        if expected_pdf.is_file():
            return str(expected_pdf)

        generated_pdfs = [
            p
            for p in Path(output_dir).glob("*.pdf")
            if p.is_file() and p.name not in existing_pdfs
        ]
        if generated_pdfs:
            newest = max(generated_pdfs, key=lambda p: p.stat().st_mtime)
            return str(newest)

        raise DocumentConversionError(
            f"LibreOffice did not create a PDF for {os.path.basename(file_path)}"
        )

    def convert_image_to_png(
        self,
        file_path: str,
        output_dir: str,
        timeout_seconds: int = 120,
    ) -> str:
        Path(output_dir).mkdir(parents=True, exist_ok=True)

        output_path = Path(output_dir) / f"{Path(file_path).stem}_converted.png"

        command = [self.imagemagick_binary, file_path, str(output_path)]

        try:
            LOGGER.info(
                "[DocumentConversion] ImageMagick conversion start input=%s output=%s command=%s",
                file_path,
                output_path,
                _command_str(command),
            )
            subprocess.run(
                command,
                check=True,
                capture_output=True,
                text=True,
                encoding="utf-8",
                errors="replace",
                timeout=timeout_seconds,
                **_windows_hidden_subprocess_kwargs(),
            )
            LOGGER.info(
                "[DocumentConversion] ImageMagick conversion complete output=%s",
                output_path,
            )
        except subprocess.TimeoutExpired as exc:
            LOGGER.error(
                "[DocumentConversion] ImageMagick timed out command=%s",
                _command_str(exc.cmd if isinstance(exc.cmd, list) else [str(exc.cmd)]),
            )
            raise DocumentConversionError(
                f"ImageMagick conversion timed out for {os.path.basename(file_path)}"
            ) from exc
        except subprocess.CalledProcessError as exc:
            stderr = (exc.stderr or "").strip()
            stdout = (exc.stdout or "").strip()
            details = stderr or stdout or str(exc)
            LOGGER.error(
                "[DocumentConversion] ImageMagick failed code=%s command=%s stderr=%s stdout=%s",
                exc.returncode,
                _command_str(exc.cmd if isinstance(exc.cmd, list) else [str(exc.cmd)]),
                _snippet(stderr),
                _snippet(stdout),
            )
            raise DocumentConversionError(
                f"ImageMagick conversion failed for {os.path.basename(file_path)}: {details} "
                f"(stderr={_snippet(stderr)}; stdout={_snippet(stdout)})"
            ) from exc
        except Exception as exc:
            LOGGER.exception("[DocumentConversion] ImageMagick conversion unexpected error")
            raise DocumentConversionError(
                f"ImageMagick conversion failed for {os.path.basename(file_path)}: {exc}"
            ) from exc

        if not output_path.is_file():
            raise DocumentConversionError(
                f"ImageMagick did not create a PNG for {os.path.basename(file_path)}"
            )

        return str(output_path)
