import json
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from models.chat import (
    ChatConversationListItem,
    ChatHistoryMessageItem,
    ChatHistoryResponse,
    ChatMessageRequest,
    ChatMessageResponse,
)
from models.sse_response import (
    SSECompleteResponse,
    SSEErrorResponse,
    SSEResponse,
    SSEStatusResponse,
    SSETraceResponse,
)
from services.chat import sql_chat_history
from services.chat import ChatTurnResult, PresentationChatService
from services.chat.conversation_store import ChatConversationStore
from services.database import get_async_session


CHAT_ROUTER = APIRouter(prefix="/chat", tags=["Chat"])


@CHAT_ROUTER.get("/conversations", response_model=list[ChatConversationListItem])
async def list_chat_conversations(
    presentation_id: uuid.UUID = Query(..., description="Presentation id"),
    sql_session: AsyncSession = Depends(get_async_session),
):
    raw = await sql_chat_history.list_conversations(
        sql_session, presentation_id=presentation_id
    )
    return [
        ChatConversationListItem(
            conversation_id=uuid.UUID(str(item["conversation_id"])),
            updated_at=item.get("updated_at"),
            last_message_preview=item.get("last_message_preview"),
        )
        for item in raw
    ]


@CHAT_ROUTER.get("/history", response_model=ChatHistoryResponse)
async def get_chat_history(
    presentation_id: uuid.UUID = Query(..., description="Presentation id"),
    conversation_id: uuid.UUID = Query(..., description="Conversation thread id"),
    sql_session: AsyncSession = Depends(get_async_session),
):
    rows = await sql_chat_history.load_messages_with_meta(
        sql_session,
        presentation_id=presentation_id,
        conversation_id=conversation_id,
    )
    if not rows:
        # Conversations created before SQL history was introduced may still
        # exist in the legacy memory store. Load and migrate them on demand so
        # a browser refresh can restore the visible chat thread.
        legacy_rows = await ChatConversationStore(sql_session).load_history(
            presentation_id=presentation_id,
            conversation_id=conversation_id,
        )
        if legacy_rows:
            await sql_session.commit()
            rows = await sql_chat_history.load_messages_with_meta(
                sql_session,
                presentation_id=presentation_id,
                conversation_id=conversation_id,
            )
    return ChatHistoryResponse(
        presentation_id=presentation_id,
        conversation_id=conversation_id,
        messages=[
            ChatHistoryMessageItem(
                role=str(message.get("role") or ""),
                content=str(message.get("content") or ""),
                created_at=message.get("created_at")
                if isinstance(message.get("created_at"), str)
                else None,
            )
            for message in rows
        ],
    )


@CHAT_ROUTER.delete("/conversation", status_code=204)
async def delete_chat_conversation(
    presentation_id: uuid.UUID = Query(..., description="Presentation id"),
    conversation_id: uuid.UUID = Query(..., description="Conversation thread id"),
    sql_session: AsyncSession = Depends(get_async_session),
):
    await sql_chat_history.delete_conversation(
        sql_session,
        presentation_id=presentation_id,
        conversation_id=conversation_id,
    )
    await sql_session.commit()


@CHAT_ROUTER.post("/message", response_model=ChatMessageResponse)
async def chat_message(
    payload: ChatMessageRequest,
    sql_session: AsyncSession = Depends(get_async_session),
):
    service = PresentationChatService(
        sql_session=sql_session,
        presentation_id=payload.presentation_id,
        conversation_id=payload.conversation_id,
    )
    result = await service.generate_reply(payload.message, payload.attachments)
    return ChatMessageResponse(
        conversation_id=result.conversation_id,
        response=result.response_text,
        tool_calls=result.tool_calls,
    )


@CHAT_ROUTER.post("/message/stream")
async def chat_message_stream(
    payload: ChatMessageRequest,
    sql_session: AsyncSession = Depends(get_async_session),
):
    service = PresentationChatService(
        sql_session=sql_session,
        presentation_id=payload.presentation_id,
        conversation_id=payload.conversation_id,
    )

    async def inner():
        try:
            async for event_type, value in service.stream_reply(
                payload.message,
                payload.attachments,
            ):
                if event_type == "chunk" and isinstance(value, str):
                    yield SSEResponse(
                        event="response",
                        data=json.dumps({"type": "chunk", "chunk": value}),
                    ).to_string()
                elif event_type == "status" and isinstance(value, str):
                    yield SSEStatusResponse(status=value).to_string()
                elif event_type == "trace" and isinstance(value, dict):
                    yield SSETraceResponse(trace=value).to_string()
                elif event_type == "complete" and isinstance(value, ChatTurnResult):
                    result = value
                    complete_payload = ChatMessageResponse(
                        conversation_id=result.conversation_id,
                        response=result.response_text,
                        tool_calls=result.tool_calls,
                    )
                    yield SSECompleteResponse(
                        key="chat",
                        value=complete_payload.model_dump(mode="json"),
                    ).to_string()
        except HTTPException as exc:
            yield SSEErrorResponse(detail=exc.detail).to_string()

    return StreamingResponse(inner(), media_type="text/event-stream")
