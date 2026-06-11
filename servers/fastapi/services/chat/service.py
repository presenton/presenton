import asyncio
import json
import logging
import uuid
from collections.abc import AsyncGenerator
from dataclasses import dataclass
from typing import Any, Literal

import dirtyjson  # type: ignore[import-untyped]
from fastapi import HTTPException
from llmai import get_client  # type: ignore[import-not-found]
from llmai.shared import (  # type: ignore[import-not-found]
    AssistantMessage,
    Message,
    SystemMessage,
    TextContentPart,
    ToolResponseMessage,
    UserMessage,
)
from sqlalchemy.ext.asyncio import AsyncSession

from models.sql.presentation import PresentationModel
from services.chat.conversation_store import ChatConversationStore
from services.chat.presentation_context_store import PresentationContextStore
from services.chat.prompts import build_system_prompt
from services.chat.llm_tools import build_chat_llm_tools
from services.chat.tools import ChatTools
from utils.llm_client_error_handler import handle_llm_client_exceptions
from utils.llm_config import get_llm_config
from utils.llm_provider import get_model
from utils.web_search import should_use_native_web_search
from utils.llm_utils import (
    extract_text,
    get_generate_kwargs,
    stream_generate_events,
)

LOGGER = logging.getLogger(__name__)
MAX_TOOL_ROUNDS = 40


@dataclass(frozen=True)
class ChatTurnResult:
    conversation_id: uuid.UUID
    response_text: str
    tool_calls: list[str]


ChatStreamEventType = Literal["chunk", "complete", "status", "trace"]
ChatStreamEventValue = str | ChatTurnResult | dict[str, Any]


class PresentationChatService:
    def __init__(
        self,
        sql_session: AsyncSession,
        presentation_id: uuid.UUID,
        conversation_id: uuid.UUID | None,
    ):
        self._sql_session = sql_session
        self._presentation_id = presentation_id
        self._conversation_id = conversation_id

        self._conversation_store = ChatConversationStore(sql_session)
        self._memory = PresentationContextStore(sql_session, presentation_id)
        self._tools = ChatTools(self._memory)

    async def generate_reply(self, user_message: str) -> ChatTurnResult:
        conversation_id, messages = await self._prepare_turn_context(user_message)
        response_text, tool_calls = await self._run_llm_with_tools(messages)
        return await self._persist_turn(
            conversation_id=conversation_id,
            user_message=user_message,
            response_text=response_text,
            tool_calls=tool_calls,
        )

    async def stream_reply(
        self, user_message: str
    ) -> AsyncGenerator[tuple[ChatStreamEventType, ChatStreamEventValue], None]:
        yield "status", "Reading deck context"
        conversation_id, messages = await self._prepare_turn_context(user_message)

        client = get_client(
            config=get_llm_config(
                use_openai_responses_api=should_use_native_web_search()
            )
        )
        model = get_model()
        tools = build_chat_llm_tools(self._tools.get_tool_definitions())

        called_tools: list[str] = []
        last_tool_results: list[dict[str, Any]] = []
        response_text: str | None = None

        for round_index in range(MAX_TOOL_ROUNDS):
            completion_chunk: Any | None = None
            round_content_chunks: list[str] = []
            thinking_chunks: list[str] = []

            try:
                async for event in stream_generate_events(
                    client,
                    **get_generate_kwargs(
                        model=model,
                        messages=messages,
                        tools=tools,
                        stream=True,
                    ),
                ):
                    event_type = getattr(event, "type", None)
                    if event_type == "content":
                        chunk = getattr(event, "chunk", None)
                        if chunk:
                            round_content_chunks.append(chunk)
                            yield "chunk", chunk
                    elif event_type == "thinking":
                        thinking_text = self._event_text(event)
                        if thinking_text:
                            thinking_chunks.append(thinking_text)
                    elif event_type == "completion":
                        completion_chunk = event
            except Exception as exc:
                raise handle_llm_client_exceptions(exc)

            thinking_summary = self._summarize_model_note(thinking_chunks)
            if thinking_summary:
                yield "trace", {
                    "kind": "model_note",
                    "round": round_index + 1,
                    "status": "info",
                    "message": thinking_summary,
                }

            completion_tool_calls = list(
                getattr(completion_chunk, "tool_calls", []) or []
            )
            if completion_tool_calls:
                tool_names = [tool_call.name for tool_call in completion_tool_calls]
                called_tools.extend(tool_names)
                yield "trace", {
                    "kind": "tool_plan",
                    "round": round_index + 1,
                    "tools": tool_names,
                    "message": f"Using tools: {', '.join(tool_names)}",
                }
                messages = (
                    list(getattr(completion_chunk, "messages", []) or [])
                    if getattr(completion_chunk, "messages", None)
                    else list(messages)
                )

                last_tool_results = []
                for tool_call in completion_tool_calls:
                    tool_focus = self._tool_focus_from_arguments(
                        tool_name=tool_call.name,
                        arguments=tool_call.arguments,
                    )
                    start_trace: dict[str, Any] = {
                        "kind": "tool_call",
                        "round": round_index + 1,
                        "tool": tool_call.name,
                        "status": "start",
                        "message": self._tool_start_message(tool_call.name),
                    }
                    if tool_focus:
                        start_trace.update(tool_focus)
                    yield "trace", start_trace
                    tool_result = await self._tools.execute_tool_call(tool_call)
                    last_tool_results.append(tool_result)
                    resolved_tool_focus = self._tool_focus_from_result(
                        tool_name=tool_call.name,
                        tool_result=tool_result,
                    )
                    complete_trace: dict[str, Any] = {
                        "kind": "tool_call",
                        "round": round_index + 1,
                        "tool": tool_call.name,
                        "status": "success" if tool_result.get("ok") else "error",
                        "message": self._summarize_tool_result(
                            tool_call.name, tool_result
                        ),
                    }
                    if resolved_tool_focus:
                        complete_trace.update(resolved_tool_focus)
                    yield "trace", complete_trace
                    tool_response_content = json.dumps(tool_result, ensure_ascii=False)
                    messages.append(
                        ToolResponseMessage(
                            id=tool_call.id,
                            content=[TextContentPart(text=tool_response_content)],
                        )
                    )
                continue

            response_text = "".join(round_content_chunks)
            if not response_text and completion_chunk:
                response_text = extract_text(getattr(completion_chunk, "content", None))
            if not response_text:
                response_text = "I could not generate a response for that request."

            if not round_content_chunks:
                yield "chunk", response_text
            break
        else:
            LOGGER.warning("Max tool rounds reached in chat stream flow")
            yield "trace", {
                "kind": "limit",
                "message": (
                    "Reached tool-call limit before final answer; "
                    "attempting best-effort summary."
                ),
            }
            yield "status", "Finalizing response"
            response_text = await self._try_final_response_without_tools(
                client=client,
                model=model,
                messages=messages,
            )
            if not response_text:
                response_text = self._build_tool_limit_fallback(last_tool_results)
            yield "chunk", response_text

        final_response_text = response_text or "I could not generate a response for that request."
        if response_text is None:
            yield "chunk", final_response_text

        yield "status", "Saving chat"
        result = await self._persist_turn(
            conversation_id=conversation_id,
            user_message=user_message,
            response_text=final_response_text,
            tool_calls=called_tools,
        )
        yield "complete", result

    async def _prepare_turn_context(
        self, user_message: str
    ) -> tuple[uuid.UUID, list[Message]]:
        if not (user_message or "").strip():
            raise HTTPException(status_code=400, detail="Message is required")

        presentation = await self._sql_session.get(PresentationModel, self._presentation_id)
        if not presentation:
            raise HTTPException(status_code=404, detail="Presentation not found")

        conversation_id = await self._conversation_store.ensure_conversation_id(
            self._conversation_id
        )
        history = await self._conversation_store.load_history(
            presentation_id=self._presentation_id,
            conversation_id=conversation_id,
        )
        history_messages = self._convert_history_to_messages(history)

        normalized_user_message = self._strip_ui_context_prefix(user_message)
        memory_query = normalized_user_message or user_message
        presentation_memory = await self._memory.retrieve_context(memory_query)
        chat_memory = await self._conversation_store.retrieve_semantic_context(
            presentation_id=self._presentation_id,
            conversation_id=conversation_id,
            query=memory_query,
        )
        messages: list[Message] = [
            SystemMessage(
                content=build_system_prompt(
                    presentation_memory_context=presentation_memory,
                    chat_memory_context=chat_memory,
                )
            ),
            *history_messages,
            UserMessage(content=user_message),
        ]
        return conversation_id, messages

    async def _persist_turn(
        self,
        *,
        conversation_id: uuid.UUID,
        user_message: str,
        response_text: str,
        tool_calls: list[str],
    ) -> ChatTurnResult:
        await self._conversation_store.append_turn(
            presentation_id=self._presentation_id,
            conversation_id=conversation_id,
            user_message=self._strip_ui_context_prefix(user_message) or user_message,
            assistant_message=response_text,
            tool_calls=tool_calls,
        )
        await self._sql_session.commit()

        return ChatTurnResult(
            conversation_id=conversation_id,
            response_text=response_text,
            tool_calls=tool_calls,
        )

    async def _run_llm_with_tools(self, messages: list[Message]) -> tuple[str, list[str]]:
        client = get_client(
            config=get_llm_config(
                use_openai_responses_api=should_use_native_web_search()
            )
        )
        model = get_model()
        tools = build_chat_llm_tools(self._tools.get_tool_definitions())

        called_tools: list[str] = []
        last_tool_results: list[dict[str, Any]] = []

        for _ in range(MAX_TOOL_ROUNDS):
            try:
                response = await asyncio.to_thread(
                    client.generate,
                    **get_generate_kwargs(
                        model=model,
                        messages=messages,
                        tools=tools,
                    ),
                )
            except Exception as exc:
                raise handle_llm_client_exceptions(exc)

            if not response.tool_calls:
                response_text = extract_text(response.content) or (
                    "I could not generate a response for that request."
                )
                return response_text, called_tools

            called_tools.extend([tool_call.name for tool_call in response.tool_calls])
            messages = list(response.messages) if response.messages else list(messages)

            last_tool_results = []
            for tool_call in response.tool_calls:
                tool_result = await self._tools.execute_tool_call(tool_call)
                last_tool_results.append(tool_result)
                tool_response_content = json.dumps(tool_result, ensure_ascii=False)
                messages.append(
                    ToolResponseMessage(
                        id=tool_call.id,
                        content=[TextContentPart(text=tool_response_content)],
                    )
                )

        LOGGER.warning("Max tool rounds reached in chat flow")
        final_response = await self._try_final_response_without_tools(
            client=client,
            model=model,
            messages=messages,
        )
        if final_response:
            return final_response, called_tools

        return self._build_tool_limit_fallback(last_tool_results), called_tools

    async def _try_final_response_without_tools(
        self,
        *,
        client: Any,
        model: str,
        messages: list[Message],
    ) -> str | None:
        try:
            response = await asyncio.to_thread(
                client.generate,
                **get_generate_kwargs(
                    model=model,
                    messages=messages,
                ),
            )
        except Exception:
            LOGGER.warning("Final no-tool synthesis call failed", exc_info=True)
            return None

        return extract_text(response.content)

    @staticmethod
    def _summarize_model_note(chunks: list[str]) -> str:
        text = "".join(chunks).strip()
        if not text or text in {"{}", "[]"}:
            return ""

        compact = " ".join(text.split())
        if compact.lower() in {"start", "end"}:
            return ""
        if len(compact) > 600:
            return f"{compact[:600].rstrip()}..."
        return compact

    @staticmethod
    def _event_text(event: Any) -> str:
        for attr in ("chunk", "delta", "text", "content"):
            value = getattr(event, attr, None)
            if isinstance(value, str):
                return value
        return ""

    @staticmethod
    def _strip_ui_context_prefix(user_message: str) -> str:
        marker = "\nUser message:"
        if not user_message.startswith("UI context:"):
            return user_message
        marker_index = user_message.find(marker)
        if marker_index == -1:
            return user_message
        return user_message[marker_index + len(marker) :].lstrip()

    @staticmethod
    def _tool_focus_from_arguments(
        *,
        tool_name: str,
        arguments: str | None,
    ) -> dict[str, Any] | None:
        if tool_name not in {"getSlideAtIndex", "saveSlide", "deleteSlide"}:
            return None

        parsed_args: dict[str, Any]
        try:
            parsed_args = dirtyjson.loads(arguments or "{}")
        except Exception:
            try:
                parsed_args = json.loads(arguments or "{}")
            except Exception:
                return None
        if not isinstance(parsed_args, dict):
            return None

        focus_payload: dict[str, Any] = {}
        index = parsed_args.get("index")
        if isinstance(index, int):
            normalized_index = max(0, index)
            focus_payload["slide_index"] = normalized_index
            focus_payload["slide_number"] = normalized_index + 1

        target_slide_indices = PresentationChatService._extract_target_slide_indices(
            parsed_args
        )
        if target_slide_indices:
            focus_payload["target_slide_indices"] = target_slide_indices
            focus_payload["target_slide_numbers"] = [
                index + 1 for index in target_slide_indices
            ]

        return focus_payload or None

    @staticmethod
    def _tool_focus_from_result(
        *,
        tool_name: str,
        tool_result: dict[str, Any],
    ) -> dict[str, Any] | None:
        if tool_name not in {"getSlideAtIndex", "saveSlide", "deleteSlide"}:
            return None
        if not tool_result.get("ok"):
            return None

        result = tool_result.get("result")
        if not isinstance(result, dict):
            return None

        focus_payload: dict[str, Any] = {}
        index: int | None = None
        resolved_index = result.get("resolved_index")
        if isinstance(resolved_index, int):
            index = resolved_index
        else:
            direct_index = result.get("index")
            if isinstance(direct_index, int):
                index = direct_index
            else:
                slide = result.get("slide")
                if isinstance(slide, dict) and isinstance(slide.get("index"), int):
                    index = slide["index"]

        if index is not None:
            normalized_index = max(0, index)
            focus_payload["slide_index"] = normalized_index
            focus_payload["slide_number"] = normalized_index + 1

        target_slide_indices = PresentationChatService._extract_target_slide_indices(
            result
        )
        if target_slide_indices:
            focus_payload["target_slide_indices"] = target_slide_indices
            focus_payload["target_slide_numbers"] = [
                index + 1 for index in target_slide_indices
            ]

        return focus_payload or None

    @staticmethod
    def _extract_target_slide_indices(payload: dict[str, Any]) -> list[int]:
        raw_candidates = []
        for key in (
            "target_slide_indices",
            "targetSlideIndices",
            "target_indices",
            "targetIndices",
            "slide_indices",
            "slideIndices",
            "indices",
        ):
            value = payload.get(key)
            if isinstance(value, list):
                raw_candidates.extend(value)

        normalized_indices: list[int] = []
        seen_indices: set[int] = set()
        for candidate in raw_candidates:
            if not isinstance(candidate, int):
                continue
            normalized_index = max(0, candidate)
            if normalized_index in seen_indices:
                continue
            seen_indices.add(normalized_index)
            normalized_indices.append(normalized_index)
        return normalized_indices

    @staticmethod
    def _tool_start_message(tool_name: str) -> str:
        labels = {
            "getPresentationOutline": "Reading the presentation outline",
            "searchSlides": "Searching relevant slides",
            "getSlideAtIndex": "Opening the requested slide",
            "getPresentationThemeCatalog": "Checking available themes",
            "getAvailableLayouts": "Checking available layouts",
            "getContentSchemaFromLayoutId": "Checking the layout schema",
            "generateAssets": "Generating slide assets",
            "saveSlide": "Saving the slide",
            "deleteSlide": "Deleting the slide",
            "setPresentationTheme": "Applying presentation theme",
        }
        return labels.get(tool_name, f"Running {tool_name}")

    @staticmethod
    def _build_tool_limit_fallback(last_tool_results: list[dict[str, Any]]) -> str:
        for entry in reversed(last_tool_results):
            if not isinstance(entry, dict):
                continue
            if not entry.get("ok"):
                continue
            result = entry.get("result")
            if not isinstance(result, dict):
                continue
            message = result.get("message")
            if isinstance(message, str) and message.strip():
                return message.strip()

        return (
            "I completed several tool operations but could not finalize the response "
            "within the tool limit. Please ask a follow-up and I will continue."
        )

    @staticmethod
    def _summarize_tool_result(tool_name: str, tool_result: dict[str, Any]) -> str:
        if not tool_result.get("ok"):
            error = tool_result.get("error")
            if isinstance(error, str) and error.strip():
                return f"{tool_name} failed: {error.strip()}"
            return f"{tool_name} failed."

        result = tool_result.get("result")
        if isinstance(result, dict):
            message = result.get("message")
            if isinstance(message, str) and message.strip():
                return message.strip()

            note = result.get("note")
            if isinstance(note, str) and note.strip():
                return note.strip()

            count = result.get("count")
            if isinstance(count, int):
                return f"{tool_name} returned {count} result(s)."

            found = result.get("found")
            if isinstance(found, bool):
                return (
                    f"{tool_name} found requested data."
                    if found
                    else f"{tool_name} did not find matching data."
                )

        return f"{tool_name} completed."

    @staticmethod
    def _convert_history_to_messages(history: list[dict[str, str]]) -> list[Message]:
        messages: list[Message] = []
        for item in history:
            role = item.get("role")
            content = item.get("content")
            if not content:
                continue
            if role == "user":
                content = PresentationChatService._strip_ui_context_prefix(content)
                messages.append(UserMessage(content=content))
            elif role == "assistant":
                messages.append(AssistantMessage(content=[content]))
        return messages
