import asyncio
import json
import logging
import os
from importlib import import_module
from typing import Any, Optional
from uuid import UUID


LOGGER = logging.getLogger(__name__)


class Mem0PresentationMemoryService:
    def __init__(self):
        self._enabled = self._to_bool(os.getenv("MEM0_ENABLED"), default=True)
        self._top_k = self._to_int(os.getenv("MEM0_TOP_K"), default=8)
        self._max_context_chars = self._to_int(
            os.getenv("MEM0_MAX_CONTEXT_CHARS"), default=6000
        )
        self._namespace_prefix = (
            os.getenv("MEM0_PRESENTATION_NAMESPACE_PREFIX") or "presentation"
        ).strip() or "presentation"

        self._embedder_provider = (
            os.getenv("MEM0_EMBEDDER_PROVIDER") or "fastembed"
        ).strip() or "fastembed"
        self._embedder_model = (
            os.getenv("MEM0_EMBEDDER_MODEL") or "BAAI/bge-small-en-v1.5"
        ).strip() or "BAAI/bge-small-en-v1.5"
        self._embedding_dims = self._to_int(
            os.getenv("MEM0_EMBEDDING_DIMS"),
            default=384,
        )

        app_data_dir = (os.getenv("APP_DATA_DIRECTORY") or "/tmp/presenton").strip()
        self._mem0_dir = (os.getenv("MEM0_DIR") or os.path.join(app_data_dir, "mem0")).strip()
        self._qdrant_path = (os.getenv("MEM0_QDRANT_PATH") or os.path.join(self._mem0_dir, "qdrant")).strip()
        self._history_db_path = (
            os.getenv("MEM0_HISTORY_DB_PATH")
            or os.path.join(self._mem0_dir, "history.db")
        ).strip()
        self._collection_name = (
            os.getenv("MEM0_COLLECTION_NAME") or "presenton_memories"
        ).strip() or "presenton_memories"

        self._client: Any = None
        self._attempted_client_init = False

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

    def _scope_user_id(self, presentation_id: UUID) -> str:
        return f"{self._namespace_prefix}:{presentation_id}"

    def _truncate(self, text: str, limit: int = 20000) -> str:
        if len(text) <= limit:
            return text
        return f"{text[:limit]}\n\n[TRUNCATED]"

    def _get_oss_config(self) -> dict:
        return {
            "vector_store": {
                "provider": "qdrant",
                "config": {
                    "collection_name": self._collection_name,
                    "path": self._qdrant_path,
                    "on_disk": True,
                    "embedding_model_dims": self._embedding_dims,
                },
            },
            "embedder": {
                "provider": self._embedder_provider,
                "config": {
                    "model": self._embedder_model,
                    "embedding_dims": self._embedding_dims,
                },
            },
            "history_db_path": self._history_db_path,
        }

    @staticmethod
    def _is_nonfatal_mem0_error(exc: BaseException) -> bool:
        return isinstance(exc, (Exception, SystemExit))

    async def _get_client(self):
        if not self._enabled:
            return None

        if self._client is not None:
            return self._client

        if self._attempted_client_init:
            return None

        self._attempted_client_init = True

        try:
            module = import_module("mem0")
            memory_cls = getattr(module, "Memory")

            os.makedirs(self._mem0_dir, exist_ok=True)
            os.makedirs(self._qdrant_path, exist_ok=True)

            config = self._get_oss_config()

            try:
                self._client = memory_cls.from_config(config)
            except Exception:
                # Backward compatibility across mem0 OSS versions.
                self._client = memory_cls(config)

            LOGGER.info(
                "Mem0 OSS presentation memory service initialized (qdrant_path=%s, history_db_path=%s)",
                self._qdrant_path,
                self._history_db_path,
            )
        except BaseException as exc:
            if not self._is_nonfatal_mem0_error(exc):
                raise
            LOGGER.exception("Failed to initialize Mem0 OSS Memory")
            self._client = None

        return self._client

    async def _add_message(self, presentation_id: UUID, message: str):
        client = await self._get_client()
        if client is None or not message.strip():
            return

        scoped_user_id = self._scope_user_id(presentation_id)
        payload = [{"role": "user", "content": self._truncate(message)}]

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
            await asyncio.to_thread(_add)
        except BaseException as exc:
            if not self._is_nonfatal_mem0_error(exc):
                raise
            LOGGER.exception(
                "Failed to add mem0 memory for presentation_id=%s", presentation_id
            )

    async def store_generation_context(
        self,
        presentation_id: UUID,
        system_prompt: Optional[str],
        user_prompt: Optional[str],
        extracted_document_text: Optional[str],
        source_content: Optional[str],
        instructions: Optional[str],
    ):
        if source_content:
            await self._add_message(
                presentation_id,
                "[presentation_source_prompt]\n" + source_content,
            )

        if instructions:
            await self._add_message(
                presentation_id,
                "[presentation_generation_instructions]\n" + instructions,
            )

        if system_prompt:
            await self._add_message(
                presentation_id,
                "[outline_system_prompt]\n" + system_prompt,
            )

        if user_prompt:
            await self._add_message(
                presentation_id,
                "[outline_user_prompt]\n" + user_prompt,
            )

        if extracted_document_text:
            await self._add_message(
                presentation_id,
                "[document_extracted_text]\n" + extracted_document_text,
            )

    async def store_generated_outlines(self, presentation_id: UUID, outlines: Any):
        if outlines is None:
            return

        try:
            outlines_text = (
                outlines
                if isinstance(outlines, str)
                else json.dumps(outlines, ensure_ascii=False)
            )
        except Exception:
            outlines_text = str(outlines)

        await self._add_message(
            presentation_id,
            "[generated_outlines]\n" + outlines_text,
        )

    async def store_slide_edit(
        self,
        presentation_id: UUID,
        slide_index: Optional[int],
        edit_prompt: str,
        edited_slide_content: Any,
    ):
        try:
            edited_text = (
                edited_slide_content
                if isinstance(edited_slide_content, str)
                else json.dumps(edited_slide_content, ensure_ascii=False)
            )
        except Exception:
            edited_text = str(edited_slide_content)

        index_text = f"{slide_index}" if slide_index is not None else "unknown"
        message = (
            f"[slide_edit]\n"
            f"slide_index={index_text}\n"
            f"user_edit_prompt={edit_prompt}\n"
            f"edited_slide_content={edited_text}"
        )
        await self._add_message(presentation_id, message)

    async def retrieve_context(self, presentation_id: UUID, query: str) -> str:
        client = await self._get_client()
        if client is None:
            return ""

        scoped_user_id = self._scope_user_id(presentation_id)

        def _search():
            try:
                return client.search(
                    query,
                    filters={"user_id": scoped_user_id},
                    top_k=self._top_k,
                )
            except TypeError:
                return client.search(
                    query,
                    user_id=scoped_user_id,
                    top_k=self._top_k,
                )

        try:
            response = await asyncio.to_thread(_search)
        except BaseException as exc:
            if not self._is_nonfatal_mem0_error(exc):
                raise
            LOGGER.exception(
                "Failed to search mem0 context for presentation_id=%s", presentation_id
            )
            return ""

        results = []
        if isinstance(response, dict):
            results = response.get("results") or []
        elif isinstance(response, list):
            results = response

        memories: list[str] = []
        for item in results:
            if not isinstance(item, dict):
                continue
            memory_text = item.get("memory") or item.get("text") or item.get("data")
            if not memory_text:
                continue
            normalized = str(memory_text).strip()
            if normalized:
                memories.append(normalized)

        if not memories:
            return ""

        deduped_memories = list(dict.fromkeys(memories))
        context = "\n\n".join(deduped_memories)
        return self._truncate(context, self._max_context_chars)


MEM0_PRESENTATION_MEMORY_SERVICE = Mem0PresentationMemoryService()
