"""Квоты на генерацию презентаций по пользователям (P4).

LLM-ключи общие для всех (`ProviderSettings` — синглтон), а регистрация через
Telegram открыта всем — без квот один пользователь выжжет бюджет.

Считаем запуски генерации (строки `generation_usage`) за скользящие 24 часа.
Неудачные генерации тоже жгут бюджет, поэтому учитываются старты.
Не ограничиваем: суперпользователей и режим `DISABLE_AUTH` (owner отсутствует).
"""

from datetime import UTC, datetime, timedelta

from fastapi import HTTPException
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from api.v1.auth.context import get_current_owner_id
from models.sql.generation_usage import GenerationUsageModel
from models.sql.user import User
from utils.get_env import get_generation_quota_per_day_env

QUOTA_PERIOD = timedelta(hours=24)
DEFAULT_QUOTA_PER_DAY = 10


def _default_limit() -> int:
    raw = get_generation_quota_per_day_env()
    if raw is None:
        return DEFAULT_QUOTA_PER_DAY
    try:
        return int(raw)
    except ValueError:
        return DEFAULT_QUOTA_PER_DAY


class QuotaStatus(BaseModel):
    limit: int
    used: int
    # None = безлимит (limit <= 0).
    remaining: int | None
    period_hours: int
    # Секунды до освобождения ближайшего слота; None, если лимит не исчерпан.
    resets_in_seconds: int | None


def _as_utc(value: datetime) -> datetime:
    # SQLite не хранит таймзону — читаемые naive datetime трактуем как UTC.
    return value if value.tzinfo is not None else value.replace(tzinfo=UTC)


async def quota_for_user(session: AsyncSession, user: User) -> QuotaStatus:
    limit = user.generation_limit if user.generation_limit is not None else _default_limit()
    now = datetime.now(UTC)
    since = now - QUOTA_PERIOD

    # GenerationUsageModel в _STRICT_OWNER_MODELS — запросы сами скоупятся
    # по текущему owner-у (для admin-endpoint лимит читаем, а счётчик считаем
    # только в контексте самого пользователя).
    used = int(
        await session.scalar(
            select(func.count())
            .select_from(GenerationUsageModel)
            .where(GenerationUsageModel.created_at > since)
        )
        or 0
    )

    if limit <= 0:
        return QuotaStatus(
            limit=limit,
            used=used,
            remaining=None,
            period_hours=int(QUOTA_PERIOD.total_seconds() // 3600),
            resets_in_seconds=None,
        )

    remaining = max(0, limit - used)
    resets_in_seconds: int | None = None
    if remaining == 0:
        oldest_at = await session.scalar(
            select(func.min(GenerationUsageModel.created_at)).where(
                GenerationUsageModel.created_at > since
            )
        )
        if oldest_at is not None:
            resets_at = _as_utc(oldest_at) + QUOTA_PERIOD
            resets_in_seconds = max(0, int((resets_at - now).total_seconds()))

    return QuotaStatus(
        limit=limit,
        used=used,
        remaining=remaining,
        period_hours=int(QUOTA_PERIOD.total_seconds() // 3600),
        resets_in_seconds=resets_in_seconds,
    )


async def enforce_generation_quota(session: AsyncSession) -> None:
    """429, если лимит исчерпан; иначе фиксирует запуск генерации.

    Вызывается до старта генерации (в `check_if_api_request_is_valid`,
    покрывает sync и async эндпоинты).
    """
    owner_id = get_current_owner_id()
    if owner_id is None:
        return  # DISABLE_AUTH — однопользовательский режим
    user = await session.get(User, owner_id)
    if user is None or user.is_superuser:
        return

    status = await quota_for_user(session, user)
    if status.remaining is not None and status.remaining <= 0:
        raise HTTPException(
            status_code=429,
            detail="Generation quota exceeded, try again later",
            headers={"Retry-After": str(status.resets_in_seconds or 3600)},
        )

    session.add(GenerationUsageModel())
    # Коммитим сразу: запуск генерации учтён, даже если она упадёт дальше.
    await session.commit()
