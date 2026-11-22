import asyncio
import logging
from collections.abc import AsyncGenerator, AsyncIterator, Awaitable, Callable

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
        if on_error:
            try:
                await on_error()
            except Exception:
                logger.error("SSE cancellation cleanup failed")
        return
    except Exception as exc:
        logger.error("SSE stream failed after response started: exception=%s", type(exc).__name__)
        if on_error:
            try:
                await on_error()
            except Exception:
                logger.error("SSE stream error cleanup failed")
        metadata: dict[str, object] = {}
        if error_metadata:
            try:
                metadata = await error_metadata(exc)
            except Exception:
                logger.error("SSE stream error metadata lookup failed")
        payload = SSEErrorResponse.from_exception(exc, fallback_detail=error_detail).model_dump(exclude_none=True)
        yield SSEErrorResponse(**{**metadata, **payload}).to_string()
    finally:
        close = getattr(stream, "aclose", None)
        if close:
            try:
                await close()
            except Exception:
                logger.error("SSE stream close failed")
