import asyncio
from datetime import datetime, timezone
import logging
import os
from typing import Any, Optional
from uuid import UUID

from services.mem0_oss_memory import (
    get_shared_mem0_client,
    run_shared_mem0_operation,
)

LOGGER = logging.getLogger(__name__)
CHAT_TURN_TAG = "[chat_turn]"
DEFAULT_MAX_STORED_TURNS = 20


class ChatMemoryStore:
    def __init__(self):
        self._enabled = self._to_bool(os.getenv("MEM0_ENABLED"), default=True)
        self._runtime_enabled = True
        self._top_k = self._to_int(os.getenv("MEM0_TOP_K"), default=8)
        self._max_context_chars = self._to_int(
            os.getenv("MEM0_MAX_CONTEXT_CHARS"), default=6000
        )
        self._max_stored_turns = self._to_int(
            os.getenv("CHAT_MAX_STORED_TURNS"), default=DEFAULT_MAX_STORED_TURNS
        )
        self._namespace_prefix = (
            os.getenv("MEM0_CHAT_NAMESPACE_PREFIX")
            or os.getenv("MEM0_PRESENTATION_NAMESPACE_PREFIX")
            or "presentation"
        ).strip() or "presentation"

    @staticmethod
    def _to_bool(value: Optional[str], default: bool = False) -> bool:
        if value is None:
            return default
        return str(value).strip().lower() in {"1", "true", "yes", "on"}

    @staticmethod
    def _to_int(value: Optional[str], default: int) -> int:
        try:
            parsed = int(value) if value is not None else default
            return max(1, parsed)
        except Exception:
            return default

    @staticmethod
    def _normalize(value: str) -> str:
        return " ".join((value or "").split())

    @staticmethod
    def _is_nonfatal_mem0_error(exc: BaseException) -> bool:
        return isinstance(exc, (Exception, SystemExit))

    def _scope_user_id(self, presentation_id: UUID, conversation_id: UUID) -> str:
        return (
            f"{self._namespace_prefix}:{presentation_id}:"
            f"conversation:{conversation_id}"
        )

    def _truncate(self, text: str, limit: int = 20000) -> str:
        if len(text) <= limit:
            return text
        return f"{text[:limit]}\n\n[TRUNCATED]"

    async def _get_client(self):
        if not self._enabled or not self._runtime_enabled:
            return None
        return get_shared_mem0_client()

    def _disable_runtime(self, reason: str, *, exc: BaseException | None = None) -> None:
        if not self._runtime_enabled:
            return
        self._runtime_enabled = False
        if exc is None:
            LOGGER.warning("Mem0 chat memory disabled for this process: %s", reason)
            return
        LOGGER.exception(
            "Mem0 chat memory disabled for this process: %s",
            reason,
            exc_info=exc,
        )

    def _build_turn_payload(self, *, user_text: str, assistant_text: str) -> str:
        memory_lines = [
            CHAT_TURN_TAG,
            f"turn_created_at={datetime.now(timezone.utc).isoformat()}",
        ]
        if user_text:
            memory_lines.append(f"user={user_text}")
        if assistant_text:
            memory_lines.append(f"assistant={assistant_text}")
        return "\n".join(memory_lines)

    @staticmethod
    def _extract_text_field(item: dict[str, Any]) -> str:
        memory_text = item.get("memory") or item.get("text") or item.get("data")
        return str(memory_text).strip() if memory_text is not None else ""

    def _collect_results(self, response: Any) -> list[dict[str, Any]]:
        if isinstance(response, dict):
            raw_results = (
                response.get("results")
                or response.get("memories")
                or response.get("items")
                or []
            )
            if isinstance(raw_results, list):
                return [item for item in raw_results if isinstance(item, dict)]
            return []
        if isinstance(response, list):
            return [item for item in response if isinstance(item, dict)]
        return []

    @staticmethod
    def _safe_parse_datetime(raw_value: Any) -> datetime | None:
        if not isinstance(raw_value, str) or not raw_value.strip():
            return None
        value = raw_value.strip().replace("Z", "+00:00")
        try:
            parsed = datetime.fromisoformat(value)
            if parsed.tzinfo is None:
                return parsed.replace(tzinfo=timezone.utc)
            return parsed
        except Exception:
            return None

    @staticmethod
    def _extract_chat_turn_fields(text: str) -> tuple[str | None, str | None, datetime | None]:
        if CHAT_TURN_TAG not in text:
            return None, None, None

        user_text: str | None = None
        assistant_text: str | None = None
        turn_created_at: datetime | None = None
        for line in text.splitlines():
            if line.startswith("user="):
                user_text = line[len("user=") :].strip()
            elif line.startswith("assistant="):
                assistant_text = line[len("assistant=") :].strip()
            elif line.startswith("turn_created_at="):
                turn_created_at = ChatMemoryStore._safe_parse_datetime(
                    line[len("turn_created_at=") :].strip()
                )
        return user_text, assistant_text, turn_created_at

    async def store_chat_turn(
        self,
        *,
        presentation_id: UUID,
        conversation_id: UUID,
        user_message: str,
        assistant_message: str,
    ) -> None:
        client = await self._get_client()
        if client is None:
            return

        user_text = self._normalize(user_message)
        assistant_text = self._normalize(assistant_message)
        if not user_text and not assistant_text:
            return

        payload = [
            {
                "role": "user",
                "content": self._truncate(
                    self._build_turn_payload(
                        user_text=user_text,
                        assistant_text=assistant_text,
                    )
                ),
            }
        ]
        scoped_user_id = self._scope_user_id(presentation_id, conversation_id)

        def _add():
            try:
                return client.add(payload, user_id=scoped_user_id, infer=False)
            except TypeError:
                return client.add(
                    messages=payload,
                    user_id=scoped_user_id,
                    infer=False,
                )

        try:
            await asyncio.to_thread(run_shared_mem0_operation, _add)
        except BaseException as exc:
            if not self._is_nonfatal_mem0_error(exc):
                raise
            if isinstance(exc, SystemExit):
                self._disable_runtime("mem0 runtime failed while storing chat turns", exc=exc)
                return
            LOGGER.exception(
                (
                    "Failed to add chat mem0 memory "
                    "(presentation_id=%s, conversation_id=%s)"
                ),
                presentation_id,
                conversation_id,
            )

    async def retrieve_context(
        self,
        *,
        presentation_id: UUID,
        conversation_id: UUID,
        query: str,
    ) -> str:
        client = await self._get_client()
        if client is None:
            return ""

        trimmed_query = (query or "").strip()
        if not trimmed_query:
            return ""

        scoped_user_id = self._scope_user_id(presentation_id, conversation_id)

        def _search():
            try:
                return client.search(
                    trimmed_query,
                    filters={"user_id": scoped_user_id},
                    top_k=self._top_k,
                )
            except TypeError:
                return client.search(
                    trimmed_query,
                    user_id=scoped_user_id,
                    top_k=self._top_k,
                )

        try:
            response = await asyncio.to_thread(run_shared_mem0_operation, _search)
        except BaseException as exc:
            if not self._is_nonfatal_mem0_error(exc):
                raise
            if isinstance(exc, SystemExit):
                self._disable_runtime(
                    "mem0 runtime failed while searching chat memory",
                    exc=exc,
                )
                return ""
            LOGGER.exception(
                (
                    "Failed to search chat mem0 memory "
                    "(presentation_id=%s, conversation_id=%s)"
                ),
                presentation_id,
                conversation_id,
            )
            return ""

        results = self._collect_results(response)
        memories: list[str] = []
        for item in results:
            normalized = self._extract_text_field(item)
            if normalized:
                memories.append(normalized)

        if not memories:
            return ""

        deduped = list(dict.fromkeys(memories))
        return self._truncate("\n\n".join(deduped), self._max_context_chars)

    async def load_history(
        self,
        *,
        presentation_id: UUID,
        conversation_id: UUID,
    ) -> list[dict[str, str]]:
        client = await self._get_client()
        if client is None:
            return []

        scoped_user_id = self._scope_user_id(presentation_id, conversation_id)

        def _get_all():
            try:
                return client.get_all(
                    filters={"user_id": scoped_user_id},
                    limit=max(10, self._max_stored_turns * 4),
                )
            except TypeError:
                try:
                    return client.get_all(
                        user_id=scoped_user_id,
                        limit=max(10, self._max_stored_turns * 4),
                    )
                except TypeError:
                    try:
                        return client.get_all(filters={"user_id": scoped_user_id})
                    except TypeError:
                        return client.get_all(user_id=scoped_user_id)

        try:
            response = await asyncio.to_thread(run_shared_mem0_operation, _get_all)
        except BaseException as exc:
            if not self._is_nonfatal_mem0_error(exc):
                raise
            if isinstance(exc, SystemExit):
                self._disable_runtime("mem0 runtime failed while loading chat history", exc=exc)
                return []
            LOGGER.exception(
                (
                    "Failed to load chat mem0 history "
                    "(presentation_id=%s, conversation_id=%s)"
                ),
                presentation_id,
                conversation_id,
            )
            return []

        results = self._collect_results(response)
        ordered_turns: list[tuple[datetime, str, str]] = []
        for index, item in enumerate(results):
            text_value = self._extract_text_field(item)
            if not text_value:
                continue
            user_text, assistant_text, embedded_timestamp = self._extract_chat_turn_fields(
                text_value
            )
            if not user_text and not assistant_text:
                continue

            item_created_at = (
                self._safe_parse_datetime(item.get("created_at"))
                or self._safe_parse_datetime(item.get("updated_at"))
                or self._safe_parse_datetime(item.get("event_at"))
            )
            timestamp = embedded_timestamp or item_created_at or datetime.fromtimestamp(
                index, tz=timezone.utc
            )
            ordered_turns.append((timestamp, user_text or "", assistant_text or ""))

        ordered_turns.sort(key=lambda turn: turn[0])
        recent_turns = ordered_turns[-self._max_stored_turns :]

        history: list[dict[str, str]] = []
        for _, user_text, assistant_text in recent_turns:
            if user_text:
                history.append({"role": "user", "content": user_text})
            if assistant_text:
                history.append({"role": "assistant", "content": assistant_text})
        return history


CHAT_MEMORY_STORE = ChatMemoryStore()
