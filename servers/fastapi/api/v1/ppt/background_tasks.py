from datetime import datetime
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models.ollama_model_status import OllamaModelStatus
from models.sql.ollama_pull_status import OllamaPullStatus
from services.database import get_container_db_async_session
from utils.ollama import pull_ollama_model


async def pull_ollama_model_background_task(model: str):
    saved_model_status = OllamaModelStatus(
        name=model,
        status="pulling",
        done=False,
    )
    log_event_count = 0

    session = await get_container_db_async_session().__anext__()

    try:
        async for event in pull_ollama_model(model):
            if "error" in event:
                saved_model_status.status = "error"
                saved_model_status.done = True
                saved_model_status.error = event["error"]
                await upsert_ollama_pull_status(session, model, saved_model_status)
                await session.close()
                return

            log_event_count += 1
            if log_event_count != 1 and log_event_count % 20 != 0:
                continue

            if "completed" in event:
                saved_model_status.downloaded = event["completed"]

            if not saved_model_status.size and "total" in event:
                saved_model_status.size = event["total"]

            if "status" in event:
                saved_model_status.status = event["status"]

                await upsert_ollama_pull_status(session, model, saved_model_status)

    except Exception as e:
        saved_model_status.status = "error"
        saved_model_status.done = True
        saved_model_status.error = str(e)
        await upsert_ollama_pull_status(session, model, saved_model_status)
        await session.close()
        raise HTTPException(
            status_code=500,
            detail=f"Failed to pull model: {e}",
        )

    saved_model_status.done = True
    saved_model_status.status = "pulled"
    saved_model_status.downloaded = saved_model_status.size
    saved_model_status.error = None

    await upsert_ollama_pull_status(session, model, saved_model_status)
    await session.close()


async def upsert_ollama_pull_status(
    session: AsyncSession, model: str, model_status: OllamaModelStatus
):
    stmt = select(OllamaPullStatus).where(OllamaPullStatus.id == model)
    result = await session.execute(stmt)
    existing_record = result.scalar_one_or_none()

    if existing_record:
        existing_record.status = model_status.model_dump(mode="json")
        existing_record.last_updated = datetime.now()
    else:
        new_record = OllamaPullStatus(
            id=model,
            status=model_status.model_dump(mode="json"),
            last_updated=datetime.now(),
        )
        session.add(new_record)

    await session.commit()
    await session.flush()
