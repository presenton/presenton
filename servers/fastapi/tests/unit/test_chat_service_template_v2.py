import asyncio
import uuid

from llmai.shared import AssistantMessage, AssistantToolCall, SystemMessage, UserMessage

from models.chat import ChatAttachment, ChatMessageRequest
from models.sql.presentation import PresentationModel, PresentationVersion
from services.chat.memory_layer import PresentationChatMemoryLayer
from services.chat.service import PresentationChatService
from services.temp_file_service import TEMP_FILE_SERVICE


def test_append_sanitized_assistant_tool_turn_drops_provider_response_state():
    messages = [
        SystemMessage(content="system"),
        UserMessage(content="change the slide"),
    ]
    tool_call = AssistantToolCall(
        id="call_123",
        name="saveSlide",
        arguments='{"index":0}',
    )

    updated = PresentationChatService._append_sanitized_assistant_tool_turn(
        messages,
        content=["I will save it."],
        tool_calls=[tool_call],
    )

    assistant_turn = updated[-1]
    assert isinstance(assistant_turn, AssistantMessage)
    assert assistant_turn.id is None
    assert assistant_turn.thinking is None
    assert assistant_turn.content == ["I will save it."]
    assert assistant_turn.tool_calls == [tool_call]
    assert updated[:-1] == messages


def test_chat_request_accepts_document_attachments():
    presentation_id = uuid.uuid4()
    payload = ChatMessageRequest(
        presentation_id=presentation_id,
        message="Read the attached PDF and add slides from it.",
        attachments=[
            ChatAttachment(
                name="brief.pdf",
                file_path="/tmp/presenton/upload/brief.pdf",
                mime_type="application/pdf",
            )
        ],
    )

    assert payload.presentation_id == presentation_id
    assert payload.attachments[0].type == "document"
    assert payload.attachments[0].name == "brief.pdf"


def test_chat_attachment_intent_parses_document_content_requests():
    attachment = ChatAttachment(name="brief.pdf", file_path="/tmp/presenton/brief.pdf")

    assert PresentationChatService._should_parse_attachments(
        "Read this PDF and add new slides from it.",
        [attachment],
    )
    assert PresentationChatService._should_parse_attachments(
        "Use the attached document.",
        [attachment],
    )
    assert PresentationChatService._should_parse_attachments("", [attachment])


def test_chat_attachment_intent_skips_direct_file_placement_requests():
    attachment = ChatAttachment(name="brief.pdf", file_path="/tmp/presenton/brief.pdf")

    assert not PresentationChatService._should_parse_attachments(
        "Place it somewhere on slide 2.",
        [attachment],
    )


def test_chat_attachment_context_is_inserted_before_user_message():
    message = (
        "UI context: selected slide is slide 1.\n"
        "UI context: selected element is title.\n"
        "User message: Add new slides from the PDF."
    )

    composed = PresentationChatService._compose_user_message_for_model(
        message,
        "UI context: parsed document content.",
    )

    assert "parsed document content.\nUser message: Add new slides" in composed
    assert composed.startswith("UI context: selected slide")


def test_chat_memory_resolves_template_layout_schemas():
    presentation_id = uuid.uuid4()
    template_layout = {
        "layouts": [
            {
                "id": "intro",
                "description": "Intro slide.",
                "components": [
                    {
                        "id": "hero",
                        "description": "Hero image component.",
                        "elements": [
                            {
                                "type": "image",
                                "decorative": False,
                                "name": "photo",
                                "data": "/app_data/images/photo.png",
                                "is_icon": False,
                            }
                        ],
                    }
                ],
            }
        ]
    }
    presentation = PresentationModel(
        id=presentation_id,
        version=PresentationVersion.V1_STANDARD,
        content="deck",
        n_slides=1,
        language="English",
        title="Deck",
        layout=template_layout,
    )
    memory = PresentationChatMemoryLayer(
        _FakeSession(presentation),
        presentation_id,
    )

    layouts = asyncio.run(memory.get_available_layouts())
    schema = asyncio.run(memory.get_content_schema_from_layout_id("intro"))

    assert layouts == [
        {
            "id": "intro",
            "name": "intro",
            "description": "Intro slide.",
        }
    ]
    assert schema is not None
    assert schema["required"] == ["hero"]
    assert schema["properties"]["hero"]["required"] == ["photo"]


def test_chat_memory_reads_presentation_source_documents():
    presentation_id = uuid.uuid4()
    temp_dir = TEMP_FILE_SERVICE.create_temp_dir(str(uuid.uuid4()))
    source_path = TEMP_FILE_SERVICE.create_temp_file(
        "source.txt",
        "Detector efficiency improved after calibration.",
        temp_dir,
    )
    presentation = PresentationModel(
        id=presentation_id,
        version=PresentationVersion.V1_STANDARD,
        content="deck",
        n_slides=1,
        language="English",
        title="Deck",
        file_paths=[source_path],
    )
    memory = PresentationChatMemoryLayer(
        _FakeSession(presentation),
        presentation_id,
    )

    result = asyncio.run(memory.read_source_documents())

    assert result["found"] is True
    assert result["source"] == "uploaded_files"
    assert result["documents"][0]["name"] == "source.txt"
    assert "Detector efficiency improved" in result["documents"][0]["content"]


class _FakeSession:
    def __init__(self, presentation: PresentationModel):
        self._presentation = presentation

    async def get(self, model, object_id):
        if model is PresentationModel and object_id == self._presentation.id:
            return self._presentation
        return None
