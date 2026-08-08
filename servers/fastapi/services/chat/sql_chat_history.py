"""Persist presentation chat threads in SQL rows."""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy import delete as sa_delete
from sqlalchemy import func
from sqlalchemy.sql.elements import ColumnElement
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from models.sql.chat_history_message import ChatHistoryMessageModel
from utils.datetime_utils import get_current_utc_datetime
from api.v1.auth.context import get_current_owner_id


def _compact_preview(content: str) -> str:
    preview = content.strip()
    if len(preview) > 200:
        return f"{preview[:200]}…"
    return preview


def _serialize_created_at(value: Any) -> str | None:
    if value is None:
        return None
    if hasattr(value, "isoformat"):
        try:
            return value.isoformat()
        except Exception:
            return None
    if isinstance(value, str) and value.strip():
        return value.strip()
    return None


def _parse_created_at(value: Any) -> datetime | None:
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    if not isinstance(value, str) or not value.strip():
        return None
    normalized = value.strip().replace("Z", "+00:00")
    try:
        parsed = datetime.fromisoformat(normalized)
    except ValueError:
        return None
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)


def _resource_filter(
    *,
    presentation_id: uuid.UUID | None = None,
    template_id: str | None = None,
) -> ColumnElement[bool]:
    if (presentation_id is None) == (template_id is None):
        raise ValueError("Exactly one chat resource id is required.")
    if presentation_id is not None:
        return ChatHistoryMessageModel.presentation_id == presentation_id
    return ChatHistoryMessageModel.template_v2_id == template_id


async def load_messages(
    session: AsyncSession,
    *,
    presentation_id: uuid.UUID | None = None,
    template_id: str | None = None,
    conversation_id: uuid.UUID,
) -> list[dict[str, str]]:
    rows = await load_messages_with_meta(
        session,
        presentation_id=presentation_id,
        template_id=template_id,
        conversation_id=conversation_id,
    )
    return [
        {"role": row["role"], "content": row["content"]}
        for row in rows
        if isinstance(row.get("role"), str) and isinstance(row.get("content"), str)
    ]


async def load_messages_with_meta(
    session: AsyncSession,
    *,
    presentation_id: uuid.UUID | None = None,
    template_id: str | None = None,
    conversation_id: uuid.UUID,
) -> list[dict[str, Any]]:
    resource_clause = _resource_filter(
        presentation_id=presentation_id,
        template_id=template_id,
    )
    rows = list(
        (
            await session.scalars(
                select(ChatHistoryMessageModel)
                .where(
                    resource_clause,
                    ChatHistoryMessageModel.conversation_id == conversation_id,
                )
                .order_by(ChatHistoryMessageModel.position.asc())
            )
        ).all()
    )
    out: list[dict[str, Any]] = []
    for row in rows:
        entry: dict[str, Any] = {
            "role": row.role,
            "content": row.content,
        }
        created = _serialize_created_at(row.created_at)
        if created:
            entry["created_at"] = created
        out.append(entry)
    return out


async def replace_messages(
    session: AsyncSession,
    *,
    presentation_id: uuid.UUID | None = None,
    template_id: str | None = None,
    conversation_id: uuid.UUID,
    messages: list[dict[str, str]],
) -> None:
    resource_clause = _resource_filter(
        presentation_id=presentation_id,
        template_id=template_id,
    )
    await session.execute(
        sa_delete(ChatHistoryMessageModel).where(
            resource_clause,
            ChatHistoryMessageModel.conversation_id == conversation_id,
            ChatHistoryMessageModel.owner_id == get_current_owner_id(),
        )
    )

    next_position = 1
    base_time = get_current_utc_datetime()
    for index, message in enumerate(messages):
        role = message.get("role")
        content = message.get("content")
        if role not in ("user", "assistant"):
            continue
        if not isinstance(content, str) or not content.strip():
            continue

        created_at = _parse_created_at(message.get("created_at")) or (
            base_time + timedelta(microseconds=index)
        )
        session.add(
            ChatHistoryMessageModel(
                presentation_id=presentation_id,
                template_v2_id=template_id,
                conversation_id=conversation_id,
                position=next_position,
                role=role,
                content=content,
                created_at=created_at,
            )
        )
        next_position += 1
    await session.flush()


async def delete_conversation(
    session: AsyncSession,
    *,
    presentation_id: uuid.UUID | None = None,
    template_id: str | None = None,
    conversation_id: uuid.UUID,
) -> None:
    resource_clause = _resource_filter(
        presentation_id=presentation_id,
        template_id=template_id,
    )
    await session.execute(
        sa_delete(ChatHistoryMessageModel).where(
            resource_clause,
            ChatHistoryMessageModel.conversation_id == conversation_id,
            ChatHistoryMessageModel.owner_id == get_current_owner_id(),
        )
    )
    await session.flush()


async def append_turn(
    session: AsyncSession,
    *,
    presentation_id: uuid.UUID | None = None,
    template_id: str | None = None,
    conversation_id: uuid.UUID,
    user_message: str,
    assistant_message: str,
    tool_calls: list[str] | None = None,
) -> None:
    resource_clause = _resource_filter(
        presentation_id=presentation_id,
        template_id=template_id,
    )
    max_position = await session.scalar(
        select(func.max(ChatHistoryMessageModel.position)).where(
            resource_clause,
            ChatHistoryMessageModel.conversation_id == conversation_id,
        )
    )
    next_position = int(max_position or 0) + 1
    now = get_current_utc_datetime()

    session.add(
        ChatHistoryMessageModel(
            presentation_id=presentation_id,
            template_v2_id=template_id,
            conversation_id=conversation_id,
            position=next_position,
            role="user",
            content=user_message,
            created_at=now,
        )
    )
    session.add(
        ChatHistoryMessageModel(
            presentation_id=presentation_id,
            template_v2_id=template_id,
            conversation_id=conversation_id,
            position=next_position + 1,
            role="assistant",
            content=assistant_message,
            created_at=now + timedelta(microseconds=1),
            tool_calls=tool_calls or None,
        )
    )
    await session.flush()


async def list_conversations(
    session: AsyncSession,
    *,
    presentation_id: uuid.UUID | None = None,
    template_id: str | None = None,
) -> list[dict[str, Any]]:
    resource_clause = _resource_filter(
        presentation_id=presentation_id,
        template_id=template_id,
    )
    rows = list(
        (
            await session.scalars(
                select(ChatHistoryMessageModel)
                .where(resource_clause)
                .order_by(
                    ChatHistoryMessageModel.created_at.desc(),
                    ChatHistoryMessageModel.position.desc(),
                )
            )
        ).all()
    )

    summary_by_conversation: dict[str, dict[str, Any]] = {}
    for row in rows:
        conversation_key = str(row.conversation_id)
        if conversation_key in summary_by_conversation:
            continue
        summary_by_conversation[conversation_key] = {
            "conversation_id": conversation_key,
            "updated_at": _serialize_created_at(row.created_at),
            "last_message_preview": _compact_preview(row.content),
        }

    summaries = list(summary_by_conversation.values())
    summaries.sort(key=lambda item: item.get("updated_at") or "", reverse=True)
    return summaries
