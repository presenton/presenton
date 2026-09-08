"""Single shared mem0 OSS ``Memory`` client for the process.

All callers (presentation context, chat turns) use the same on-disk Qdrant/SQLite
and distinguish data via mem0 ``user_id``:

- Deck-level (no chat thread): ``{namespace}:{presentation_id}``
- Chat thread: ``{namespace}:{presentation_id}:conversation:{conversation_id}``

The chat flow calls ``ensure_conversation_id`` before the first turn, so a
``conversation_id`` exists before any mem0 write for that thread.
"""

from __future__ import annotations

import logging
import os
import threading
from collections.abc import Callable
from importlib import import_module
from typing import Any, Optional, TypeVar

LOGGER = logging.getLogger(__name__)

_memory_init_lock = threading.Lock()
_memory_operation_lock = threading.RLock()
_shared_client: Any | None = None
_init_attempted = False

_T = TypeVar("_T")


def run_shared_mem0_operation(operation: Callable[[], _T]) -> _T:
    """Serialize access to the process-wide local Qdrant/SQLite client.

    Qdrant local mode keeps one SQLite connection on the shared Memory client.
    The connection permits use from worker threads, but concurrent operations on
    that same connection can fail during commit. Keep the blocking work in the
    caller's worker thread while ensuring only one operation touches the client
    at a time.
    """
    with _memory_operation_lock:
        return operation()


def _to_bool(value: Optional[str], default: bool = False) -> bool:
    if value is None:
        return default
    return str(value).strip().lower() in {"1", "true", "yes", "on"}


def _to_int(value: Optional[str], default: int) -> int:
    try:
        parsed = int(value) if value is not None else default
        return max(1, parsed)
    except Exception:
        return default


def _spacy_model_name() -> str:
    return (os.getenv("MEM0_SPACY_MODEL") or "en_core_web_sm").strip() or "en_core_web_sm"


def _spacy_model_available() -> bool:
    if not _to_bool(os.getenv("MEM0_REQUIRE_SPACY_MODEL"), default=True):
        return True

    model = _spacy_model_name()
    try:
        import spacy  # type: ignore[import-untyped]

        spacy.load(model)
        return True
    except Exception:
        LOGGER.warning(
            "Mem0 disabled: spaCy model '%s' is unavailable. Install it via `python -m spacy download %s` or set MEM0_REQUIRE_SPACY_MODEL=false.",
            model,
            model,
        )
        return False


def _normalize_openai_base_url(value: Optional[str]) -> Optional[str]:
    if not value:
        return None

    normalized = value.strip().rstrip("/")
    if normalized.endswith("/v1"):
        return normalized
    return f"{normalized}/v1"


def _oss_config_from_env() -> tuple[str, str, str, str, int, dict[str, Any]]:
    """Return (mem0_dir, qdrant_path, history_db, collection, dims, from_config_dict)."""
    app_data_dir = (os.getenv("APP_DATA_DIRECTORY") or "/tmp/presenton").strip()
    mem0_dir = (os.getenv("MEM0_DIR") or os.path.join(app_data_dir, "mem0")).strip()
    qdrant_path = (
        os.getenv("MEM0_QDRANT_PATH") or os.path.join(mem0_dir, "qdrant")
    ).strip()
    history_db_path = (
        os.getenv("MEM0_HISTORY_DB_PATH") or os.path.join(mem0_dir, "history.db")
    ).strip()
    collection = (
        os.getenv("MEM0_COLLECTION_NAME") or "presenton_memories"
    ).strip() or "presenton_memories"
    embedder = (os.getenv("MEM0_EMBEDDER_PROVIDER") or "fastembed").strip() or "fastembed"
    model = (
        os.getenv("MEM0_EMBEDDER_MODEL") or "BAAI/bge-small-en-v1.5"
    ).strip() or "BAAI/bge-small-en-v1.5"
    dims = _to_int(os.getenv("MEM0_EMBEDDING_DIMS"), default=384)
    llm_model = (
        os.getenv("MEM0_LLM_MODEL")
        or os.getenv("OLLAMA_MODEL")
        or "llama3.1:latest"
    ).strip() or "llama3.1:latest"
    llm_api_key = (
        os.getenv("MEM0_LLM_API_KEY")
        or os.getenv("OPENAI_API_KEY")
        or "ollama"
    ).strip() or "ollama"
    llm_base_url = _normalize_openai_base_url(
        os.getenv("MEM0_LLM_BASE_URL")
        or os.getenv("OLLAMA_URL")
        or "http://host.docker.internal:11434"
    )
    config: dict[str, Any] = {
        "llm": {
            "provider": "openai",
            "config": {
                "model": llm_model,
                "temperature": 0.1,
                "max_tokens": 2000,
                "api_key": llm_api_key,
                "openai_base_url": llm_base_url,
            },
        },
        "vector_store": {
            "provider": "qdrant",
            "config": {
                "collection_name": collection,
                "path": qdrant_path,
                "on_disk": True,
                "embedding_model_dims": dims,
            },
        },
        "embedder": {
            "provider": embedder,
            "config": {
                "model": model,
                "embedding_dims": dims,
            },
        },
        "history_db_path": history_db_path,
    }
    return mem0_dir, qdrant_path, history_db_path, collection, dims, config


def memory_from_config(config: dict[str, Any], *, telemetry_base: str) -> Any:
    """Construct ``mem0.Memory``. Caller must hold ``_memory_init_lock`` if used with shared state."""
    os.makedirs(telemetry_base, exist_ok=True)
    import mem0.memory.main as mem0_main  # type: ignore[import-untyped]

    mem0_main.mem0_dir = telemetry_base
    memory_cls = getattr(import_module("mem0"), "Memory")
    return memory_cls.from_config(config)


def get_shared_mem0_client() -> Any | None:
    """Return the process-wide mem0 client, or ``None`` if disabled or init failed."""
    global _shared_client, _init_attempted

    if not _to_bool(os.getenv("MEM0_ENABLED"), default=True):
        return None
    if _shared_client is not None:
        return _shared_client
    if _init_attempted:
        return None

    with _memory_init_lock:
        if _shared_client is not None:
            return _shared_client
        if _init_attempted:
            return None
        if not _spacy_model_available():
            _init_attempted = True
            return None
        _init_attempted = True
        try:
            mem0_dir, qdrant_path, history_db, collection, dims, config = (
                _oss_config_from_env()
            )
            os.makedirs(mem0_dir, exist_ok=True)
            os.makedirs(qdrant_path, exist_ok=True)
            telemetry_base = os.path.join(mem0_dir, "telemetry", "oss")
            _shared_client = memory_from_config(
                config,
                telemetry_base=telemetry_base,
            )
            LOGGER.info(
                "Mem0 OSS shared memory initialized (qdrant_path=%s, history_db_path=%s, collection=%s, dims=%s)",
                qdrant_path,
                history_db,
                collection,
                dims,
            )
        except BaseException as exc:
            # fastembed / onnxruntime: incomplete cache under /tmp (common in fresh containers).
            err = str(exc)
            if "NoSuchFile" in type(exc).__name__ or "NO_SUCHFILE" in err:
                LOGGER.warning(
                    "Mem0 OSS disabled: embedding model file missing (%s). "
                    "Pre-download fastembed models, point FASTEMBED_CACHE at them, or set MEM0_ENABLED=false.",
                    err[:400],
                )
            else:
                LOGGER.exception("Failed to initialize shared Mem0 OSS Memory")
            _shared_client = None

    return _shared_client
