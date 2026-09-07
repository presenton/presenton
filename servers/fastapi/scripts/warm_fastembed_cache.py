"""Pre-download FastEmbed / Hugging Face weights at Docker image build time.

Icon search uses AllMiniLML6V2 into ``fastembed_cache`` under the package tree.
Mem0 OSS defaults to ``BAAI/bge-small-en-v1.5`` via Hugging Face Hub under
``HF_HOME`` (default ``~/.cache/huggingface``).
"""

import os
import sys
from pathlib import Path

FASTAPI_ROOT = Path(__file__).resolve().parents[1]
if str(FASTAPI_ROOT) not in sys.path:
    sys.path.insert(0, str(FASTAPI_ROOT))


# noqa нужен: скрипт сначала добавляет корень пакета в sys.path, иначе импорт services не резолвится.
from services.icon_finder_service import ICON_FINDER_SERVICE  # noqa: E402


def _warm_mem0_default_fastembed() -> None:
    provider = (os.getenv("MEM0_EMBEDDER_PROVIDER") or "fastembed").strip() or "fastembed"
    if provider != "fastembed":
        print(f"Skipping Mem0 embedder warmup (MEM0_EMBEDDER_PROVIDER={provider!r}, not fastembed)")
        return
    model = (os.getenv("MEM0_EMBEDDER_MODEL") or "BAAI/bge-small-en-v1.5").strip() or (
        "BAAI/bge-small-en-v1.5"
    )
    from fastembed import TextEmbedding

    embedder = TextEmbedding(model_name=model)
    next(embedder.embed(["warmup"]))
    print(f"Mem0 default fastembed model warmed: {model}")


def main() -> None:
    if not ICON_FINDER_SERVICE.ensure_initialized():
        raise RuntimeError("Failed to prepare fastembed cache for icon search")

    print(f"Fastembed cache prepared at {ICON_FINDER_SERVICE.cache_directory}")
    _warm_mem0_default_fastembed()


if __name__ == "__main__":
    main()
