import asyncio
import logging
import os
import shutil
from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import delete, select
from sqlmodel.ext.asyncio.session import AsyncSession

from models.sql.async_presentation_generation_status import AsyncPresentationGenerationTaskModel
from models.sql.presentation import PresentationModel
from models.sql.presentation_layout_code import PresentationLayoutCodeModel
from models.sql.template import TemplateModel
from services.database import get_async_session

logger = logging.getLogger(__name__)

_CLEANUP_INTERVAL_SECONDS = 24 * 60 * 60


def get_retention_period_days() -> Optional[int]:
    raw = os.getenv("RETENTION_PERIOD_DAYS", "0").strip()
    try:
        days = int(raw)
        return days if days > 0 else None
    except ValueError:
        logger.warning("Invalid RETENTION_PERIOD_DAYS value %r — retention disabled.", raw)
        return None


async def _delete_presentation_files(file_paths: list[str] | None) -> None:
    if not file_paths:
        return
    for path in file_paths:
        try:
            if os.path.isfile(path):
                os.remove(path)
            elif os.path.isdir(path):
                shutil.rmtree(path, ignore_errors=True)
        except Exception:
            logger.exception("Failed to delete file %s", path)


async def run_retention_cleanup(session: AsyncSession, cutoff: datetime) -> dict:
    template_ids_result = await session.exec(select(TemplateModel.id))
    protected_ids = set(template_ids_result.all())

    stale_result = await session.exec(
        select(PresentationModel).where(PresentationModel.created_at < cutoff)
    )
    stale_presentations = stale_result.all()

    presentations_deleted = 0
    files_deleted = 0

    for presentation in stale_presentations:
        if presentation.id in protected_ids:
            logger.debug("Skipping protected template presentation %s", presentation.id)
            continue

        await session.exec(
            delete(PresentationLayoutCodeModel).where(
                PresentationLayoutCodeModel.presentation == presentation.id
            )
        )

        if presentation.file_paths:
            await _delete_presentation_files(presentation.file_paths)
            files_deleted += len(presentation.file_paths)

        await session.delete(presentation)
        presentations_deleted += 1

    tasks_result = await session.exec(
        delete(AsyncPresentationGenerationTaskModel).where(
            AsyncPresentationGenerationTaskModel.created_at < cutoff
        )
    )
    tasks_deleted = getattr(tasks_result, "rowcount", 0)

    await session.commit()

    summary = {
        "presentations_deleted": presentations_deleted,
        "files_deleted": files_deleted,
        "tasks_deleted": tasks_deleted,
        "cutoff": cutoff.isoformat(),
    }
    logger.info("Retention cleanup complete: %s", summary)
    return summary


async def retention_scheduler() -> None:
    days = get_retention_period_days()
    if days is None:
        logger.info("Data retention disabled (RETENTION_PERIOD_DAYS not set or 0).")
        return

    logger.info("Data retention enabled: deleting presentations older than %d day(s).", days)

    while True:
        try:
            cutoff = datetime.now(timezone.utc) - timedelta(days=days)
            async for session in get_async_session():
                await run_retention_cleanup(session, cutoff)
        except Exception:
            logger.exception("Retention cleanup failed — will retry in 24 h.")

        await asyncio.sleep(_CLEANUP_INTERVAL_SECONDS)
