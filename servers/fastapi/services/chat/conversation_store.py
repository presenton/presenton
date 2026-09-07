import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from services.chat import sql_chat_history
from services.chat.chat_memory_store import CHAT_MEMORY_STORE


class ChatConversationStore:
    def __init__(self, sql_session: AsyncSession):
        self._sql = sql_session

    async def load_history(
        self,
        *,
        presentation_id: uuid.UUID,
        conversation_id: uuid.UUID,
    ) -> list[dict[str, str]]:
        messages = await sql_chat_history.load_messages(
            self._sql,
            presentation_id=presentation_id,
            conversation_id=conversation_id,
        )
        if messages:
            return messages
        legacy = await CHAT_MEMORY_STORE.load_history(
            presentation_id=presentation_id,
            conversation_id=conversation_id,
        )
        if legacy:
            await sql_chat_history.replace_messages(
                self._sql,
                presentation_id=presentation_id,
                conversation_id=conversation_id,
                messages=legacy,
            )
        return legacy

    async def append_turn(
        self,
        *,
        presentation_id: uuid.UUID,
        conversation_id: uuid.UUID,
        user_message: str,
        assistant_message: str,
        tool_calls: list[str] | None = None,
    ) -> None:
        await sql_chat_history.append_turn(
            self._sql,
            presentation_id=presentation_id,
            conversation_id=conversation_id,
            user_message=user_message,
            assistant_message=assistant_message,
            tool_calls=tool_calls,
        )
        await CHAT_MEMORY_STORE.store_chat_turn(
            presentation_id=presentation_id,
            conversation_id=conversation_id,
            user_message=user_message,
            assistant_message=assistant_message,
        )

    async def retrieve_semantic_context(
        self,
        *,
        presentation_id: uuid.UUID,
        conversation_id: uuid.UUID,
        query: str,
    ) -> str:
        return await CHAT_MEMORY_STORE.retrieve_context(
            presentation_id=presentation_id,
            conversation_id=conversation_id,
            query=query,
        )

    async def ensure_conversation_id(
        self,
        conversation_id: uuid.UUID | None,
    ) -> uuid.UUID:
        return conversation_id or uuid.uuid4()
