import asyncio
import uuid
from unittest.mock import AsyncMock, MagicMock, patch

from api.v1.ppt.endpoints.chat import delete_chat_conversation, get_chat_history


def test_delete_chat_conversation_deletes_sql_thread_and_commits():
    presentation_id = uuid.uuid4()
    conversation_id = uuid.uuid4()
    sql_session = MagicMock()
    sql_session.commit = AsyncMock()

    with patch(
        "api.v1.ppt.endpoints.chat.sql_chat_history.delete_conversation",
        new=AsyncMock(),
    ) as delete_conversation:
        asyncio.run(
            delete_chat_conversation(
                presentation_id=presentation_id,
                conversation_id=conversation_id,
                sql_session=sql_session,
            )
        )

    delete_conversation.assert_awaited_once_with(
        sql_session,
        presentation_id=presentation_id,
        conversation_id=conversation_id,
    )
    sql_session.commit.assert_awaited_once()


def test_get_chat_history_returns_existing_sql_messages_without_migration():
    presentation_id = uuid.uuid4()
    conversation_id = uuid.uuid4()
    sql_session = MagicMock()
    sql_session.commit = AsyncMock()
    rows = [
        {
            "role": "user",
            "content": "Make the title shorter",
            "created_at": "2026-07-15T10:00:00+00:00",
        },
        {
            "role": "assistant",
            "content": "The title has been shortened.",
            "created_at": "2026-07-15T10:00:01+00:00",
        },
    ]

    with (
        patch(
            "api.v1.ppt.endpoints.chat.sql_chat_history.load_messages_with_meta",
            new=AsyncMock(return_value=rows),
        ) as load_messages,
        patch(
            "api.v1.ppt.endpoints.chat.ChatConversationStore.load_history",
            new=AsyncMock(),
        ) as load_legacy,
    ):
        response = asyncio.run(
            get_chat_history(
                presentation_id=presentation_id,
                conversation_id=conversation_id,
                sql_session=sql_session,
            )
        )

    assert [message.content for message in response.messages] == [
        "Make the title shorter",
        "The title has been shortened.",
    ]
    load_messages.assert_awaited_once()
    load_legacy.assert_not_awaited()
    sql_session.commit.assert_not_awaited()


def test_get_chat_history_migrates_and_returns_legacy_messages():
    presentation_id = uuid.uuid4()
    conversation_id = uuid.uuid4()
    sql_session = MagicMock()
    sql_session.commit = AsyncMock()
    migrated_rows = [
        {"role": "user", "content": "Use a blue theme"},
        {"role": "assistant", "content": "Applied the blue theme."},
    ]

    with (
        patch(
            "api.v1.ppt.endpoints.chat.sql_chat_history.load_messages_with_meta",
            new=AsyncMock(side_effect=[[], migrated_rows]),
        ) as load_messages,
        patch(
            "api.v1.ppt.endpoints.chat.ChatConversationStore.load_history",
            new=AsyncMock(return_value=migrated_rows),
        ) as load_legacy,
    ):
        response = asyncio.run(
            get_chat_history(
                presentation_id=presentation_id,
                conversation_id=conversation_id,
                sql_session=sql_session,
            )
        )

    assert [message.content for message in response.messages] == [
        "Use a blue theme",
        "Applied the blue theme.",
    ]
    load_legacy.assert_awaited_once_with(
        presentation_id=presentation_id,
        conversation_id=conversation_id,
    )
    assert load_messages.await_count == 2
    sql_session.commit.assert_awaited_once()
