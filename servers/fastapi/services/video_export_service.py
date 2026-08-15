"""
Turns a presentation's slides + speaker notes into a narrated MP4.

Pipeline:
1. Export the presentation to PDF using the existing export pipeline
   (utils.export_utils.export_presentation) -- this reuses the same
   headless-Chromium rendering already used for PDF/PPTX export, so slide
   visuals stay identical to what the user sees in the editor.
2. Rasterize each PDF page to a PNG (PyMuPDF) -- one image per slide.
3. For each slide, generate narration audio from its speaker_note via
   NarrationService (ComfyUI TTS). Slides with no speaker note get a short
   silent clip instead of being skipped, so slide timing stays even.
4. Build one video segment per slide (image + its narration audio, looped
   image, matched duration), then concatenate all segments with ffmpeg's
   concat demuxer into the final MP4.

Requires the `ffmpeg` and `ffprobe` binaries on PATH (or FFMPEG_BINARY /
FFPROBE_BINARY env vars pointing at them).
"""

import asyncio
import logging
import os
import shutil
import tempfile
import uuid
from typing import Optional

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from models.sql.presentation import PresentationModel
from models.sql.slide import SlideModel
from services.narration_service import NARRATION_SERVICE, NarrationGenerationError
from utils.asset_directory_utils import get_videos_directory
from utils.export_utils import export_presentation
from utils.filename_utils import safe_export_basename
from utils.video_narration_provider import is_video_narration_disabled
from utils.get_env import (
    get_ffmpeg_binary_env,
    get_ffprobe_binary_env,
    get_video_narration_max_concurrency_env,
)
from pathvalidate import sanitize_filename

LOGGER = logging.getLogger(__name__)

VIDEO_WIDTH = 1920
VIDEO_HEIGHT = 1080
VIDEO_FPS = 30
SILENT_SLIDE_DURATION_SECONDS = 2.5
END_PAD_SECONDS = 0.4
AUDIO_SAMPLE_RATE = 44100

# Shared encode settings so every per-slide segment is byte-compatible for
# concat-demuxer "-c copy" (same codec/pix_fmt/framerate/sample rate).
_VIDEO_ENCODE_ARGS = [
    "-c:v", "libx264", "-tune", "stillimage", "-pix_fmt", "yuv420p",
    "-r", str(VIDEO_FPS),
]
_AUDIO_ENCODE_ARGS = [
    "-c:a", "aac", "-ar", str(AUDIO_SAMPLE_RATE), "-ac", "2",
]


class VideoExportError(Exception):
    pass


class SlideProgressCallback:
    """Optional callback the caller can supply to report progress."""

    async def __call__(self, completed: int, total: int, message: str) -> None:  # pragma: no cover
        raise NotImplementedError


class VideoExportService:
    def __init__(self) -> None:
        self.ffmpeg = get_ffmpeg_binary_env()
        self.ffprobe = get_ffprobe_binary_env()

    async def export_presentation_video(
        self,
        presentation_id: uuid.UUID,
        sql_session: AsyncSession,
        on_progress: Optional[SlideProgressCallback] = None,
        cookie_header: Optional[str] = None,
    ) -> str:
        presentation = await sql_session.get(PresentationModel, presentation_id)
        if not presentation:
            raise HTTPException(status_code=404, detail="Presentation not found")

        slides_result = await sql_session.scalars(
            select(SlideModel)
            .where(SlideModel.presentation == presentation_id)
            .order_by(SlideModel.index)
        )
        slides = list(slides_result)
        if not slides:
            raise HTTPException(
                status_code=400, detail="Presentation has no slides to export"
            )

        title = (presentation.title or "").strip() or str(presentation_id)
        safe_title = safe_export_basename(sanitize_filename(title))

        work_dir = tempfile.mkdtemp(prefix="presenton-video-")
        try:
            await self._report(on_progress, 0, len(slides), "Exporting slides to PDF")
            pdf_path = await self._export_pdf(presentation_id, title, cookie_header)

            await self._report(on_progress, 0, len(slides), "Rendering slide images")
            image_paths = self._rasterize_pdf(pdf_path, work_dir)
            if len(image_paths) != len(slides):
                raise VideoExportError(
                    f"Rendered {len(image_paths)} slide images but presentation "
                    f"has {len(slides)} slides; export may be out of sync."
                )

            narration_paths = await self._generate_all_narrations(
                slides, work_dir, on_progress
            )

            await self._report(
                on_progress, len(slides), len(slides), "Assembling video"
            )
            segment_paths = await self._build_segments(
                image_paths, narration_paths, work_dir
            )
            final_path = await self._concat_segments(segment_paths, work_dir)

            output_directory = get_videos_directory()
            output_path = os.path.join(
                output_directory, f"{safe_title}-{uuid.uuid4().hex[:8]}.mp4"
            )
            shutil.move(final_path, output_path)

            await self._report(
                on_progress, len(slides), len(slides), "Video export complete"
            )
            return output_path
        finally:
            shutil.rmtree(work_dir, ignore_errors=True)

    # -- step 1: PDF export --------------------------------------------------

    async def _export_pdf(
        self,
        presentation_id: uuid.UUID,
        title: str,
        cookie_header: Optional[str],
    ) -> str:
        result = await export_presentation(
            presentation_id=presentation_id,
            title=title,
            export_as="pdf",
            cookie_header=cookie_header,
        )
        return result.path

    # -- step 2: rasterize PDF pages ------------------------------------------

    def _rasterize_pdf(self, pdf_path: str, work_dir: str) -> list[str]:
        try:
            import fitz  # PyMuPDF
        except ImportError as exc:
            raise VideoExportError(
                "PyMuPDF (pymupdf) is required to rasterize slides for video "
                "export. Install it with `uv add pymupdf` in servers/fastapi."
            ) from exc

        images_dir = os.path.join(work_dir, "slides")
        os.makedirs(images_dir, exist_ok=True)

        image_paths: list[str] = []
        doc = fitz.open(pdf_path)
        try:
            for page_index, page in enumerate(doc):
                zoom_x = VIDEO_WIDTH / page.rect.width
                zoom_y = VIDEO_HEIGHT / page.rect.height
                zoom = min(zoom_x, zoom_y)
                matrix = fitz.Matrix(zoom, zoom)
                pixmap = page.get_pixmap(matrix=matrix)
                image_path = os.path.join(images_dir, f"slide_{page_index:04d}.png")
                pixmap.save(image_path)
                image_paths.append(image_path)
        finally:
            doc.close()

        return image_paths

    # -- step 3: narration -----------------------------------------------------

    async def _generate_all_narrations(
        self,
        slides: list[SlideModel],
        work_dir: str,
        on_progress: Optional[SlideProgressCallback],
    ) -> list[Optional[str]]:
        audio_dir = os.path.join(work_dir, "audio")
        os.makedirs(audio_dir, exist_ok=True)

        semaphore = asyncio.Semaphore(get_video_narration_max_concurrency_env())
        results: list[Optional[str]] = [None] * len(slides)
        completed = 0
        lock = asyncio.Lock()
        narration_disabled = is_video_narration_disabled()

        async def worker(index: int, slide: SlideModel) -> None:
            nonlocal completed
            note = (slide.speaker_note or "").strip()
            async with semaphore:
                if note and not narration_disabled:
                    try:
                        path = await NARRATION_SERVICE.generate_narration_comfyui(
                            note, audio_dir
                        )
                        results[index] = path
                    except NarrationGenerationError as exc:
                        LOGGER.warning(
                            "Narration failed for slide %s, falling back to "
                            "silence: %s",
                            index,
                            exc,
                        )
                        results[index] = None
                else:
                    results[index] = None
            async with lock:
                completed += 1
                step_message = (
                    f"Rendering silent slide {completed}/{len(slides)} "
                    "(narration disabled)"
                    if narration_disabled
                    else f"Generated narration for slide {completed}/{len(slides)}"
                )
                await self._report(on_progress, completed, len(slides), step_message)

        await asyncio.gather(
            *(worker(i, slide) for i, slide in enumerate(slides))
        )
        return results

    # -- step 4: per-slide video segments ---------------------------------------

    async def _build_segments(
        self,
        image_paths: list[str],
        narration_paths: list[Optional[str]],
        work_dir: str,
    ) -> list[str]:
        segments_dir = os.path.join(work_dir, "segments")
        os.makedirs(segments_dir, exist_ok=True)

        segment_paths = []
        for i, (image_path, audio_path) in enumerate(
            zip(image_paths, narration_paths)
        ):
            segment_path = os.path.join(segments_dir, f"segment_{i:04d}.mp4")
            if audio_path:
                await self._build_narrated_segment(
                    image_path, audio_path, segment_path
                )
            else:
                await self._build_silent_segment(image_path, segment_path)
            segment_paths.append(segment_path)
        return segment_paths

    async def _build_narrated_segment(
        self, image_path: str, audio_path: str, output_path: str
    ) -> None:
        command = [
            self.ffmpeg, "-y",
            "-loop", "1", "-i", image_path,
            "-i", audio_path,
            "-filter_complex", f"[1:a]apad=pad_dur={END_PAD_SECONDS}[a]",
            "-map", "0:v", "-map", "[a]",
            *_VIDEO_ENCODE_ARGS,
            *_AUDIO_ENCODE_ARGS,
            "-shortest",
            output_path,
        ]
        await self._run(command)

    async def _build_silent_segment(self, image_path: str, output_path: str) -> None:
        command = [
            self.ffmpeg, "-y",
            "-loop", "1", "-i", image_path,
            "-f", "lavfi", "-i", f"anullsrc=r={AUDIO_SAMPLE_RATE}:cl=stereo",
            *_VIDEO_ENCODE_ARGS,
            *_AUDIO_ENCODE_ARGS,
            "-t", str(SILENT_SLIDE_DURATION_SECONDS),
            output_path,
        ]
        await self._run(command)

    # -- step 5: concat -----------------------------------------------------------

    async def _concat_segments(self, segment_paths: list[str], work_dir: str) -> str:
        list_path = os.path.join(work_dir, "concat_list.txt")
        with open(list_path, "w", encoding="utf-8") as f:
            for path in segment_paths:
                escaped = path.replace("'", "'\\''")
                f.write(f"file '{escaped}'\n")

        output_path = os.path.join(work_dir, "final.mp4")
        command = [
            self.ffmpeg, "-y",
            "-f", "concat", "-safe", "0", "-i", list_path,
            "-c", "copy",
            output_path,
        ]
        await self._run(command)
        return output_path

    # -- subprocess helper ----------------------------------------------------------

    async def _run(self, command: list[str], timeout: int = 600) -> None:
        LOGGER.info("[video_export] running: %s", " ".join(command))
        process = await asyncio.create_subprocess_exec(
            *command,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        try:
            stdout, stderr = await asyncio.wait_for(
                process.communicate(), timeout=timeout
            )
        except asyncio.TimeoutError as exc:
            process.kill()
            await process.wait()
            raise VideoExportError(
                f"Command timed out after {timeout}s: {' '.join(command)}"
            ) from exc

        if process.returncode != 0:
            raise VideoExportError(
                f"Command failed (code {process.returncode}): {' '.join(command)}\n"
                f"{stderr.decode(errors='ignore')[-4000:]}"
            )

    async def _report(
        self,
        on_progress: Optional[SlideProgressCallback],
        completed: int,
        total: int,
        message: str,
    ) -> None:
        if on_progress is not None:
            await on_progress(completed, total, message)


VIDEO_EXPORT_SERVICE = VideoExportService()
