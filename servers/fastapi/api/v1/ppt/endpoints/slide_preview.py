"""Превью слайдов презентации в PNG для Telegram Mini App (задача P3).

Mini App не тянет тяжёлый рантайм редактора, поэтому слайды рендерятся на
бэкенде существующим пайплайном: PPTX -> JSON -> PNG через EXPORT_TASK_SERVICE.
Готовые картинки лежат в /app_data/exports/ владельца и отдаются nginx с
проверкой сессионной куки.
"""

import asyncio
import logging
import os
import shutil
import uuid

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from api.v1.ppt.endpoints.presentation import _build_export_cookie_header
from models.sql.presentation import PresentationModel
from services.database import get_async_session
from templates.fonts_and_slides_preview import (
    _preview_dimensions_from_pptx,
    render_pptx_slides_to_images,
)
from utils.asset_directory_utils import (
    get_exports_directory,
    resolve_app_path_to_filesystem,
)
from utils.export_utils import export_presentation
from utils.get_env import get_app_data_directory_env

LOGGER = logging.getLogger(__name__)

SLIDE_PREVIEW_ROUTER = APIRouter(prefix="/presentation", tags=["Presentation"])


class SlidePreviewRequest(BaseModel):
    # Путь на PPTX из завершённой задачи генерации (data.path). Без него
    # экспортируем свежий PPTX сами — это запуск headless Chromium, медленнее.
    pptx_path: str | None = None
    # refresh=true — всегда собираем свежий PPTX из текущего состояния деки
    # и перерендериваем PNG (правки через editor-ops не трогают старый файл
    # экспорта, поэтому кэш по mtime был бы устаревшим). Используется Mini App
    # после правок; платный экспорт файла при этом не запускается.
    refresh: bool = False


class SlidePreviewResponse(BaseModel):
    slides: list[str]
    width: int
    height: int


def _resolve_owned_pptx(pptx_path: str) -> str:
    if not pptx_path.lower().endswith(".pptx"):
        raise HTTPException(status_code=422, detail="Slide preview requires a .pptx export")
    # resolve_app_path_to_filesystem сам проверяет владельца app_data-пути:
    # чужой, несуществующий или ведущий вне app_data путь вернёт None.
    resolved = resolve_app_path_to_filesystem(pptx_path)
    if resolved is None:
        raise HTTPException(status_code=403, detail="PPTX path is not accessible")
    return resolved


def _preview_directory(presentation_id: uuid.UUID) -> str:
    directory = os.path.join(get_exports_directory(), "previews", str(presentation_id))
    os.makedirs(directory, exist_ok=True)
    return directory


# In-flight дедупликация рендера: параллельные POST /preview по одной деке
# дожидаются идущего рендера, а не запускают параллельный Chromium (Node+
# Puppeteer). Без этого ручные обновления и поллинг штамповали по несколько
# рендеров одновременно — шторм CPU на VPS тормозил одновременные генерации.
_PREVIEW_RENDER_LOCKS: dict[uuid.UUID, asyncio.Lock] = {}
_PREVIEW_LOCKS_GUARD = asyncio.Lock()


async def _preview_render_lock(presentation_id: uuid.UUID) -> asyncio.Lock:
    """Общий lock рендера превью на деку (одна запись — много ждунов).

    Записи в словаре не чистим: их число ограничено числом дек, а попытка
    «удалить свободный lock» гоняется с ждуном, взявшим его из словаря.
    """
    async with _PREVIEW_LOCKS_GUARD:
        lock = _PREVIEW_RENDER_LOCKS.get(presentation_id)
        if lock is None:
            lock = asyncio.Lock()
            _PREVIEW_RENDER_LOCKS[presentation_id] = lock
        return lock


def _cached_previews(directory: str, pptx_fs_path: str) -> list[str] | None:
    """Готовые PNG, если PPTX не новее их — рендер это запуск Chromium."""
    try:
        names = sorted(
            name
            for name in os.listdir(directory)
            if name.startswith("slide-") and name.endswith(".png")
        )
        if not names:
            return None
        newest_png = max(os.path.getmtime(os.path.join(directory, n)) for n in names)
        if os.path.getmtime(pptx_fs_path) > newest_png:
            return None
    except OSError:
        return None
    return [os.path.join(directory, name) for name in names]


def _to_app_data_url(fs_path: str) -> str:
    app_data = get_app_data_directory_env()
    relative = os.path.relpath(fs_path, app_data)
    return "/app_data/" + relative.replace(os.sep, "/")


@SLIDE_PREVIEW_ROUTER.post("/{id}/preview", response_model=SlidePreviewResponse)
async def render_slide_previews(
    id: uuid.UUID,
    request: Request,
    body: SlidePreviewRequest | None = None,
    sql_session: AsyncSession = Depends(get_async_session),
):
    presentation = await sql_session.get(PresentationModel, id)
    if presentation is None:
        raise HTTPException(status_code=404, detail="Presentation not found")

    # параллельные вызовы по одной деке — один рендер (см. комментарий выше)
    render_lock = await _preview_render_lock(id)
    async with render_lock:
        if body and body.pptx_path and not body.refresh:
            pptx_fs_path = _resolve_owned_pptx(body.pptx_path)
        else:
            exported = await export_presentation(
                presentation.id,
                presentation.title or str(uuid.uuid4()),
                "pptx",
                cookie_header=_build_export_cookie_header(request),
            )
            pptx_fs_path = exported.path

        preview_dir = _preview_directory(presentation.id)
        png_paths = None if body and body.refresh else _cached_previews(preview_dir, pptx_fs_path)
        if png_paths is None:
            # Число слайдов могло уменьшиться — старые файлы удаляем до рендера.
            for stale in os.listdir(preview_dir):
                if stale.endswith(".png"):
                    os.remove(os.path.join(preview_dir, stale))
            # ponytail: кастомные шрифты в превью не подтягиваем (пустой список);
            # добавить font_paths_for_install, когда попросит разработчик Mini App.
            rendered = await render_pptx_slides_to_images(
                pptx_fs_path,
                font_paths_for_install=[],
                max_slides=None,
                logger=LOGGER,
            )
            png_paths = []
            for index, source in enumerate(rendered, start=1):
                destination = os.path.join(preview_dir, f"slide-{index}.png")
                shutil.copyfile(source, destination)
                os.chmod(destination, 0o644)
                png_paths.append(destination)

    width, height = await asyncio.to_thread(_preview_dimensions_from_pptx, pptx_fs_path)
    return SlidePreviewResponse(
        slides=[_to_app_data_url(path) for path in png_paths],
        width=width,
        height=height,
    )
