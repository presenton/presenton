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
    SSEStatusResponse,
    SSETraceResponse,
    SSEResponse,
)
from services.chat import ChatTurnResult, PresentationChatService
from services.chat import sql_chat_history
from services.database import get_async_session

CHAT_ROUTER = APIRouter(prefix="/chat", tags=["Chat"])


def _resolve_chat_mode(message: str) -> str:
    if "UI context: the user is editing the outline draft" in message:
        return "outline"
    return "presentation"


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
    return ChatHistoryResponse(
        presentation_id=presentation_id,
        conversation_id=conversation_id,
        messages=[
            ChatHistoryMessageItem(
                role=str(m.get("role") or ""),
                content=str(m.get("content") or ""),
                created_at=m.get("created_at")
                if isinstance(m.get("created_at"), str)
                else None,
            )
            for m in rows
        ],
    )


@CHAT_ROUTER.post("/message", response_model=ChatMessageResponse)
async def chat_message(
    payload: ChatMessageRequest,
    sql_session: AsyncSession = Depends(get_async_session),
):
    service = PresentationChatService(
        sql_session=sql_session,
        presentation_id=payload.presentation_id,
        conversation_id=payload.conversation_id,
        chat_mode=_resolve_chat_mode(payload.message),
    )
    result = await service.generate_reply(payload.message)
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
        chat_mode=_resolve_chat_mode(payload.message),
    )

    async def inner():
        try:
            async for event_type, value in service.stream_reply(payload.message):
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
