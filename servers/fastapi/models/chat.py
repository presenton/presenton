import uuid
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class ChatAttachment(BaseModel):
    type: Literal["document"] = "document"
    name: str = Field(min_length=1, max_length=255)
    file_path: str = Field(min_length=1, max_length=4000)
    mime_type: str | None = Field(default=None, max_length=255)

    model_config = ConfigDict(extra="forbid")


class ChatMessageRequest(BaseModel):
    presentation_id: uuid.UUID
    presentation_type: Literal["standard", "smart"] = "standard"
    message: str = Field(min_length=1, max_length=8000)
    conversation_id: uuid.UUID | None = None
    attachments: list[ChatAttachment] = Field(default_factory=list, max_length=8)

    model_config = ConfigDict(extra="forbid")


class ChatMessageResponse(BaseModel):
    conversation_id: uuid.UUID
    response: str
    tool_calls: list[str] = Field(default_factory=list)
    model_config = ConfigDict(extra="forbid")


class ChatHistoryMessageItem(BaseModel):
    role: str
    content: str
    created_at: str | None = None

    model_config = ConfigDict(extra="forbid")


class ChatHistoryResponse(BaseModel):
    presentation_id: uuid.UUID
    conversation_id: uuid.UUID
    messages: list[ChatHistoryMessageItem]

    model_config = ConfigDict(extra="forbid")


class ChatConversationListItem(BaseModel):
    conversation_id: uuid.UUID
    updated_at: str | None = None
    last_message_preview: str | None = None

    model_config = ConfigDict(extra="forbid")
