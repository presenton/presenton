import logging

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from enums.async_task_status import AsyncTaskStatus
from models.sql.async_task import AsyncTaskModel
from utils.datetime_utils import get_current_utc_datetime


LOGGER = logging.getLogger(__name__)

INTERRUPTED_TASK_ERROR = {
    "status_code": 503,
    "detail": (
        "The server restarted before this background task completed. "
        "Please start a new job."
    ),
}


async def fail_interrupted_async_tasks(session: AsyncSession) -> int:
    """Fail in-process jobs left pending by an earlier server process.

    Presentation and template jobs currently run as FastAPI background tasks.
    They cannot survive a process/container restart, so leaving their database
    rows pending makes polling clients wait forever for work that no longer
    exists.
    """
    result = await session.execute(
        select(AsyncTaskModel).where(
            AsyncTaskModel.status == AsyncTaskStatus.PENDING
        )
    )
    interrupted_tasks = list(result.scalars().all())
    if not interrupted_tasks:
        return 0

    interrupted_at = get_current_utc_datetime()
    for task in interrupted_tasks:
        task.status = AsyncTaskStatus.ERROR
        task.message = "Background task interrupted by server restart"
        task.error = dict(INTERRUPTED_TASK_ERROR)
        task.updated_at = interrupted_at
        session.add(task)

    await session.commit()
    LOGGER.warning(
        "Marked %d interrupted background task(s) as failed",
        len(interrupted_tasks),
    )
    return len(interrupted_tasks)
