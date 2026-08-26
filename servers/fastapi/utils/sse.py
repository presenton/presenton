import asyncio
import logging
from collections.abc import AsyncGenerator, AsyncIterator, Awaitable, Callable

from fastapi import HTTPException

from models.sse_response import SSEErrorResponse


async def safe_sse_stream(
    stream: AsyncIterator[str],
    *,
    logger: logging.Logger,
    error_detail: str,
    on_error: Callable[[], Awaitable[None]] | None = None,
    error_metadata: Callable[[Exception], Awaitable[dict[str, object]]] | None = None,
) -> AsyncGenerator[str, None]:
    try:
        async for chunk in stream:
            yield chunk
    except asyncio.CancelledError:
        logger.info("SSE stream cancelled by client")
        return
    except Exception as exc:
        logger.exception("SSE stream failed after response started")
        if on_error:
            try:
                await on_error()
            except Exception:
                logger.exception("SSE stream error cleanup failed")
        detail = exc.detail if isinstance(exc, HTTPException) else error_detail
        metadata: dict[str, object] = {}
        if error_metadata:
            try:
                metadata = await error_metadata(exc)
            except Exception:
                logger.exception("SSE stream error metadata lookup failed")
        yield SSEErrorResponse(detail=str(detail), **metadata).to_string()
