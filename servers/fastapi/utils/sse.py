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
        yield SSEErrorResponse(detail=str(detail)).to_string()
