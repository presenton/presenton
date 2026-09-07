import asyncio
import uuid
from unittest.mock import AsyncMock, Mock, patch

import pytest
from fastapi import HTTPException

from api.v1.ppt.endpoints import presentation as presentation_endpoint
from models.generate_presentation_request import GeneratePresentationRequest
from utils.llm_calls.generate_presentation_outlines import get_user_prompt


def _run(coro):
    return asyncio.run(coro)


def test_empty_input_is_rejected_during_request_validation(fake_async_session):
    request = GeneratePresentationRequest(
        content="",
        n_slides=3,
        language="English",
        export_as="pptx",
        template="general",
    )

    with pytest.raises(HTTPException) as exc:
        _run(
            presentation_endpoint.check_if_api_request_is_valid(
                request=request,
                sql_session=fake_async_session,
            )
        )

    assert exc.value.status_code == 400
    assert "Either content or slides markdown or files is required" in exc.value.detail


def test_large_input_generates_prompt_without_randomness():
    large_content = "Revenue growth trend. " * 5000
    prompt = get_user_prompt(
        content=large_content,
        n_slides=10,
        language="English",
        additional_context="ctx",
        tone="professional",
        instructions="focus on enterprise accounts",
    )

    assert "Number of Slides: 10" in prompt
    assert "Language: English" in prompt
    assert "focus on enterprise accounts" in prompt
    assert large_content[:120] in prompt


def test_invalid_llm_payload_raises_structured_http_error(fake_async_session):
    request = GeneratePresentationRequest(
        content="Generate slides from this text",
        n_slides=2,
        language="English",
        export_as="pdf",
        template="general",
    )

    async def failing_outline_stream(*_args, **_kwargs):
        yield HTTPException(status_code=408, detail="LLM timed out")

    with (
        patch.object(
            presentation_endpoint.MEM0_PRESENTATION_MEMORY_SERVICE,
            "store_generation_context",
            new=AsyncMock(),
        ),
        patch.object(
            presentation_endpoint,
            "generate_ppt_outline",
            side_effect=failing_outline_stream,
        ),
        patch.object(
            presentation_endpoint.CONCURRENT_SERVICE,
            "run_task",
            new=Mock(),
        ),
    ):
        with pytest.raises(HTTPException) as exc:
            _run(
                presentation_endpoint.generate_presentation_handler(
                    request=request,
                    presentation_id=uuid.uuid4(),
                    async_status=None,
                    sql_session=fake_async_session,
                )
            )

    assert exc.value.status_code == 408
    assert exc.value.detail == "LLM timed out"
