import asyncio
import json
from unittest.mock import patch

from models.presentation_outline_model import PresentationOutlineModel
from tests.mocks.llm import content_event
from tests.mocks.normalizers import normalize_payload
from utils.llm_calls import generate_presentation_outlines as outline_module


def _collect_chunks(generator) -> str:
    async def _collect():
        chunks = []
        async for chunk in generator:
            chunks.append(chunk)
        return "".join(chunks)

    return asyncio.run(_collect())


def test_outline_generation_snapshot_matches_normalized_schema(load_snapshot):
    async def fake_stream_generate_events(_client, **_kwargs):
        yield content_event('{"slides": [')
        yield content_event('{"content":"## Intro\\n- Point A\\n- Point B"},')
        yield content_event('{"content":"## Details\\n1. Item one\\n2. Item two"}')
        yield content_event("]}")

    with (
        patch.object(outline_module, "get_model", return_value="fake-model"),
        patch.object(outline_module, "get_client", return_value=object()),
        patch.object(outline_module, "get_llm_config", return_value={}),
        patch.object(
            outline_module,
            "get_generate_kwargs",
            side_effect=lambda **kwargs: kwargs,
        ),
        patch.object(
            outline_module, "stream_generate_events", side_effect=fake_stream_generate_events
        ),
    ):
        raw_json = _collect_chunks(
            outline_module.generate_ppt_outline(
                content="Build a two slide outline",
                n_slides=2,
                language="English",
            )
        )

    validated = PresentationOutlineModel.model_validate(json.loads(raw_json))
    normalized = normalize_payload(validated.model_dump(mode="json"))
    expected = load_snapshot("outline_generation.json")

    assert normalized == expected
    assert set(normalized.keys()) == {"slides"}
    assert len(normalized["slides"]) == 2
    assert all(set(slide.keys()) == {"content"} for slide in normalized["slides"])
