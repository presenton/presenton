import asyncio
import uuid
from datetime import datetime
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock, patch

import pytest
from fastapi import HTTPException

from api.v1.ppt.endpoints import presentation as presentation_endpoint
from constants.presentation import MAX_NUMBER_OF_SLIDES
from models.generate_presentation_request import GeneratePresentationRequest
from models.presentation_and_path import PresentationAndPath
from models.presentation_from_template import EditPresentationRequest, SlideContentUpdate
from models.presentation_outline_model import SlideOutlineModel
from models.presentation_structure_model import PresentationStructureModel
from models.sql.presentation import PresentationModel, PresentationVersion
from models.sql.slide import SlideModel
from models.sql.template_v2 import TemplateV2
from templates.presentation_layout import PresentationLayoutModel, SlideLayoutModel
from tests.conftest import FakeAsyncSession


class FakeRequest:
    def __init__(self):
        self.headers: dict[str, str] = {}
        self.cookies: dict[str, str] = {}
        self.state = SimpleNamespace()


def _run(coro):
    return asyncio.run(coro)


def _mock_layout() -> PresentationLayoutModel:
    return PresentationLayoutModel(
        name="general",
        ordered=False,
        slides=[
            SlideLayoutModel(id="layout-1", name="Title", json_schema={"title": "title"}),
            SlideLayoutModel(id="layout-2", name="Body", json_schema={"title": "body"}),
        ],
    )


def _template_layout_payload() -> dict:
    return {
        "layouts": [
            {
                "id": "template-layout-1",
                "description": "Hero layout",
                "components": [
                    {
                        "id": "hero",
                        "description": "Hero content",
                        "elements": [
                            {
                                "type": "text",
                                "decorative": False,
                                "name": "headline",
                                "runs": [{"text": "Original headline"}],
                            }
                        ],
                    }
                ],
            }
        ]
    }


def test_generate_presentation_handler_full_flow_uses_mocked_dependencies():
    request = GeneratePresentationRequest(
        content="Create a two-slide deck about renewable energy.",
        n_slides=2,
        language="English",
        export_as="pptx",
        template="general",
    )
    presentation_id = uuid.uuid4()
    template_id = "general"
    template = TemplateV2(
        id=template_id,
        name="General",
        layouts=_template_layout_payload(),
        is_default=True,
    )
    session = FakeAsyncSession(get_results={template_id: template})

    async def fake_outline_stream(*_args, **_kwargs):
        yield '{"slides":[{"content":"## Intro"},{"content":"## Action Plan"}]}'

    get_slide_content = AsyncMock(
        side_effect=[
            {"title": "Intro", "points": ["A"]},
            {"title": "Action Plan", "points": ["B"]},
        ]
    )

    with patch.object(
        presentation_endpoint.MEM0_PRESENTATION_MEMORY_SERVICE,
        "store_generation_context",
        new=AsyncMock(),
    ), patch.object(
        presentation_endpoint.MEM0_PRESENTATION_MEMORY_SERVICE,
        "store_generated_outlines",
        new=AsyncMock(),
    ), patch.object(
        presentation_endpoint,
        "generate_ppt_outline",
        side_effect=fake_outline_stream,
    ), patch.object(
        presentation_endpoint,
        "generate_presentation_structure",
        new=AsyncMock(return_value=PresentationStructureModel(slides=[0, 1])),
    ), patch.object(
        presentation_endpoint,
        "get_slide_content_from_type_and_outline",
        get_slide_content,
    ), patch.object(
        presentation_endpoint,
        "process_slide_and_fetch_assets",
        new=AsyncMock(return_value=[]),
    ), patch.object(
        presentation_endpoint,
        "get_images_directory",
        return_value="/tmp",
    ), patch.object(
        presentation_endpoint,
        "ImageGenerationService",
        return_value=Mock(),
    ), patch.object(
        presentation_endpoint,
        "export_presentation",
        new=AsyncMock(
            return_value=PresentationAndPath(
                presentation_id=presentation_id,
                path="/tmp/generated/deck.pptx",
            )
        ),
    ), patch.object(
        presentation_endpoint.CONCURRENT_SERVICE,
        "run_task",
        new=Mock(),
    ), patch.object(
        presentation_endpoint,
        "random",
        new=Mock(randint=Mock(return_value=0)),
    ):
        response = _run(
            presentation_endpoint.generate_presentation_handler(
                request=request,
                presentation_id=presentation_id,
                async_status=None,
                sql_session=session,
            )
        )

    assert response.path.endswith(".pptx")
    assert response.edit_path == f"/presentation?id={presentation_id}"
    assert len(session.added_all) == 2
    assert all(slide.presentation == presentation_id for slide in session.added_all)
    assert all(slide.ui is not None for slide in session.added_all)
    assert get_slide_content.call_args_list[0].kwargs["slide_number"] == 1
    assert get_slide_content.call_args_list[1].kwargs["slide_number"] == 2


def test_generate_presentation_handler_uses_template_layout():
    template_id = str(uuid.uuid4())
    presentation_id = uuid.uuid4()
    template = TemplateV2(
        id=template_id,
        name="Custom V2",
        layouts=_template_layout_payload(),
        assets={"fonts": {"Inter": "https://example.com/inter.css"}},
    )
    session = FakeAsyncSession(get_results={template_id: template})
    request = GeneratePresentationRequest(
        content="Create a one-slide deck about climate risk.",
        n_slides=1,
        language="English",
        export_as="pptx",
        template=f"custom-{template_id}",
    )

    async def fake_outline_stream(*_args, **_kwargs):
        yield '{"slides":[{"content":"## Climate risk"}]}'

    with patch.object(
        presentation_endpoint.MEM0_PRESENTATION_MEMORY_SERVICE,
        "store_generation_context",
        new=AsyncMock(),
    ), patch.object(
        presentation_endpoint.MEM0_PRESENTATION_MEMORY_SERVICE,
        "store_generated_outlines",
        new=AsyncMock(),
    ), patch.object(
        presentation_endpoint,
        "generate_ppt_outline",
        side_effect=fake_outline_stream,
    ), patch.object(
        presentation_endpoint,
        "generate_presentation_structure",
        new=AsyncMock(return_value=PresentationStructureModel(slides=[0])),
    ), patch.object(
        presentation_endpoint,
        "get_slide_content_from_type_and_outline",
        new=AsyncMock(return_value={"hero": {"headline": "V2 headline"}}),
    ), patch.object(
        presentation_endpoint,
        "process_slide_and_fetch_assets",
        new=AsyncMock(return_value=[]),
    ), patch.object(
        presentation_endpoint,
        "get_images_directory",
        return_value="/tmp",
    ), patch.object(
        presentation_endpoint,
        "ImageGenerationService",
        return_value=Mock(),
    ), patch.object(
        presentation_endpoint,
        "export_presentation",
        new=AsyncMock(
            return_value=PresentationAndPath(
                presentation_id=presentation_id,
                path="/tmp/generated/deck.pptx",
            )
        ),
    ), patch.object(
        presentation_endpoint.CONCURRENT_SERVICE,
        "run_task",
        new=Mock(),
    ), patch.object(
        presentation_endpoint,
        "random",
        new=Mock(randint=Mock(return_value=0)),
    ):
        _run(
            presentation_endpoint.generate_presentation_handler(
                request=request,
                presentation_id=presentation_id,
                async_status=None,
                sql_session=session,
            )
        )

    presentation = next(
        item for item in session.added if isinstance(item, PresentationModel)
    )
    slide = next(item for item in session.added_all if isinstance(item, SlideModel))
    assert presentation.version == PresentationVersion.V2_STANDARD
    assert presentation.layout == {
        **_template_layout_payload(),
        "icon_type": "bold",
        "icon_weight": "bold",
        "name": template_id,
        "template_id": template_id,
    }
    assert presentation.fonts == {"Inter": "https://example.com/inter.css"}
    assert slide.layout_group == template_id
    assert slide.ui["components"][0]["elements"][0]["runs"][0]["text"] == "V2 headline"


def test_default_template_name_resolves_bundled_template_without_schema_page():
    template_id = "general"
    template = TemplateV2(
        id=template_id,
        name="General",
        layouts=_template_layout_payload(),
        assets={"fonts": {"Inter": "/app_data/templates/general/inter.ttf"}},
        is_default=True,
    )
    session = FakeAsyncSession(get_results={template_id: template})

    layout_payload, layout_model, fonts = _run(
        presentation_endpoint._resolve_generation_layout("general", session)
    )

    assert layout_payload["layouts"][0]["id"] == "template-layout-1"
    assert layout_payload["name"] == template_id
    assert layout_payload["template_id"] == template_id
    assert layout_model.slides[0].id == "template-layout-1"
    assert fonts == {"Inter": "/app_data/templates/general/inter.ttf"}


def test_create_presentation_stores_current_version(fake_async_session):
    presentation = _run(
        presentation_endpoint.create_presentation(
            content="Create a short deck.",
            sql_session=fake_async_session,
        )
    )

    assert presentation.version == PresentationVersion.V2_STANDARD
    assert presentation.content == "Create a short deck."
    assert fake_async_session.added == [presentation]
    assert fake_async_session.commit_count == 1


def test_create_blank_presentation_is_template_free_and_editable():
    class BlankPresentationSession(FakeAsyncSession):
        async def refresh(self, obj):
            now = datetime.now()
            if isinstance(obj, PresentationModel):
                obj.created_at = obj.created_at or now
                obj.updated_at = obj.updated_at or now

    session = BlankPresentationSession()

    response = _run(
        presentation_endpoint.create_blank_presentation(sql_session=session)
    )

    assert session.commit_count == 1
    assert len(session.added) == 2

    presentation = next(
        item for item in session.added if isinstance(item, PresentationModel)
    )
    slide = next(item for item in session.added if isinstance(item, SlideModel))

    assert presentation.version == PresentationVersion.V2_STANDARD
    assert presentation.content == ""
    assert presentation.title == "Untitled Presentation"
    assert presentation.n_slides == 1
    assert presentation.layout is None
    assert presentation.fonts is None
    assert presentation.include_title_slide is False

    assert slide.presentation == presentation.id
    assert slide.index == 0
    assert (
        slide.layout_group
        == presentation_endpoint.BLANK_PRESENTATION_LAYOUT_GROUP
    )
    assert slide.layout == presentation_endpoint.BLANK_PRESENTATION_LAYOUT_ID
    assert slide.content == {}
    assert slide.ui == presentation_endpoint._blank_presentation_slide_ui()

    assert response.id == presentation.id
    assert response.version == PresentationVersion.V2_STANDARD
    assert response.n_slides == 1
    assert len(response.slides) == 1
    assert response.slides[0].id == slide.id


def test_blank_presentation_slide_ui_returns_an_independent_copy():
    first = presentation_endpoint._blank_presentation_slide_ui()
    second = presentation_endpoint._blank_presentation_slide_ui()

    first["elements"][0]["fill"]["color"] = "#000000"

    assert second["elements"][0]["fill"]["color"] == "#FFFFFF"


def test_create_blank_presentation_rolls_back_failed_transaction():
    class FailingCommitSession(FakeAsyncSession):
        def __init__(self):
            super().__init__()
            self.rollback_count = 0

        async def commit(self):
            self.commit_count += 1
            raise RuntimeError("database unavailable")

        async def rollback(self):
            self.rollback_count += 1

    session = FailingCommitSession()

    with pytest.raises(RuntimeError, match="database unavailable"):
        _run(
            presentation_endpoint.create_blank_presentation(
                sql_session=session
            )
        )

    assert session.commit_count == 1
    assert session.rollback_count == 1
    assert len(session.added) == 2


def test_blank_presentation_route_is_additive():
    routes = {
        (route.path, method)
        for route in presentation_endpoint.PRESENTATION_ROUTER.routes
        for method in getattr(route, "methods", set())
    }

    assert ("/presentation/create/blank", "POST") in routes
    assert ("/presentation/create", "POST") in routes
    assert ("/presentation/prepare", "POST") in routes


def test_check_api_request_accepts_custom_prefixed_template_id():
    template_id = "general-template"
    template = TemplateV2(
        id=template_id,
        name="Custom V2",
        layouts=_template_layout_payload(),
    )
    session = FakeAsyncSession(get_results={template_id: template})
    request = GeneratePresentationRequest(
        content="Create a deck.",
        n_slides=1,
        template=f"custom-{template_id}",
    )

    _run(presentation_endpoint.check_if_api_request_is_valid(request, session))

    assert request.template == template_id


def test_check_api_request_rejects_missing_custom_prefixed_template_id(
    fake_async_session,
):
    request = GeneratePresentationRequest(
        content="Create a deck.",
        n_slides=1,
        template=f"custom-{uuid.uuid4()}",
    )

    with pytest.raises(HTTPException) as exc:
        _run(
            presentation_endpoint.check_if_api_request_is_valid(
                request,
                fake_async_session,
            )
        )

    assert exc.value.status_code == 400
    assert exc.value.detail == "Template not found. Please use a valid template."


def test_prepare_presentation_preserves_payload_icon_weight():
    presentation_id = uuid.uuid4()
    template_id = str(uuid.uuid4())
    presentation = PresentationModel(
        id=presentation_id,
        version=PresentationVersion.V1_STANDARD,
        content="deck",
        n_slides=1,
        language="English",
        tone="default",
        verbosity="standard",
        instructions=None,
    )
    template = TemplateV2(
        id=template_id,
        name="Swift",
        layouts=_template_layout_payload(),
        assets={"icon_type": "thin", "icon_weight": "thin"},
    )
    session = FakeAsyncSession(
        get_results={presentation_id: presentation, template_id: template}
    )

    with patch.object(
        presentation_endpoint,
        "generate_presentation_structure",
        new=AsyncMock(return_value=PresentationStructureModel(slides=[0])),
    ), patch.object(
        presentation_endpoint.MEM0_PRESENTATION_MEMORY_SERVICE,
        "store_generated_outlines",
        new=AsyncMock(),
    ):
        response = _run(
            presentation_endpoint.prepare_presentation(
                presentation_id=presentation_id,
                outlines=[SlideOutlineModel(content="## Causes")],
                layout=template_id,
                sql_session=session,
            )
        )

    assert response.presentation_id == presentation_id
    assert not hasattr(response, "layout")
    assert not hasattr(response, "structure")
    assert not hasattr(response, "theme")
    assert presentation.layout["icon_weight"] == "thin"
    assert presentation.layout["icon_type"] == "thin"
    stream_layout = presentation_endpoint._get_presentation_stream_layout(presentation)
    assert stream_layout.icon_weight == "thin"
    assert stream_layout.icon_type == "thin"
    assert presentation.language == ""


def test_prepare_presentation_clears_stale_language_for_reviewed_outlines():
    presentation_id = uuid.uuid4()
    template_id = str(uuid.uuid4())
    presentation = PresentationModel(
        id=presentation_id,
        content="global warming deck",
        n_slides=1,
        language="Spanish (Español)",
        tone="default",
        verbosity="standard",
        instructions=None,
    )
    template = TemplateV2(
        id=template_id,
        name="Swift",
        layouts=_template_layout_payload(),
    )
    session = FakeAsyncSession(
        get_results={presentation_id: presentation, template_id: template}
    )

    with patch.object(
        presentation_endpoint,
        "generate_presentation_structure",
        new=AsyncMock(return_value=PresentationStructureModel(slides=[0])),
    ), patch.object(
        presentation_endpoint.MEM0_PRESENTATION_MEMORY_SERVICE,
        "store_generated_outlines",
        new=AsyncMock(),
    ):
        response = _run(
            presentation_endpoint.prepare_presentation(
                presentation_id=presentation_id,
                outlines=[SlideOutlineModel(content="## 全球变暖的原因")],
                layout=template_id,
                sql_session=session,
            )
        )

    assert response.presentation_id == presentation_id
    assert presentation.language == ""


def test_prepare_presentation_rejects_too_many_outlines():
    presentation_id = uuid.uuid4()
    presentation = PresentationModel(
        id=presentation_id,
        content="deck",
        n_slides=MAX_NUMBER_OF_SLIDES,
        language="English",
        tone="default",
        verbosity="standard",
        instructions=None,
    )
    session = FakeAsyncSession(get_results={presentation_id: presentation})

    with pytest.raises(HTTPException) as exc_info:
        _run(
            presentation_endpoint.prepare_presentation(
                presentation_id=presentation_id,
                outlines=[
                    SlideOutlineModel(content=f"## Slide {index}")
                    for index in range(MAX_NUMBER_OF_SLIDES + 1)
                ],
                layout=_mock_layout(),
                sql_session=session,
            )
        )

    assert exc_info.value.status_code == 400
    assert (
        exc_info.value.detail
        == f"Number of outlines cannot be greater than {MAX_NUMBER_OF_SLIDES}"
    )


def test_check_api_request_rejects_too_many_slides_markdown(fake_async_session):
    request = GeneratePresentationRequest(
        content="",
        slides_markdown=[
            f"## Slide {index}" for index in range(MAX_NUMBER_OF_SLIDES + 1)
        ],
        export_as="pdf",
        template="general",
    )

    with pytest.raises(HTTPException) as exc_info:
        _run(
            presentation_endpoint.check_if_api_request_is_valid(
                request=request,
                sql_session=fake_async_session,
            )
        )

    assert exc_info.value.status_code == 400
    assert (
        exc_info.value.detail
        == f"Number of slides cannot be greater than {MAX_NUMBER_OF_SLIDES}"
    )


def test_prepare_presentation_accepts_template_layout_id():
    presentation_id = uuid.uuid4()
    template_id = "strategy-template"
    presentation = PresentationModel(
        id=presentation_id,
        version=PresentationVersion.V2_STANDARD,
        content="deck",
        n_slides=1,
        language="English",
        tone="default",
        verbosity="standard",
        instructions=None,
    )
    template_layouts = {
        "layouts": [
            {
                "id": "template-layout-1",
                "description": "Hero layout",
                "components": [
                    {
                        "id": "hero",
                        "description": "Hero content",
                        "elements": [
                            {
                                "type": "text",
                                "decorative": False,
                                "name": "headline",
                            }
                        ],
                    }
                ],
            }
        ]
    }
    template = TemplateV2(
        id=template_id,
        name="Custom V2",
        layouts=template_layouts,
        assets={"fonts": {"Inter": "https://example.com/inter.css"}},
    )
    session = FakeAsyncSession(
        get_results={presentation_id: presentation, template_id: template}
    )
    generate_structure = AsyncMock(
        return_value=PresentationStructureModel(slides=[0])
    )

    with patch.object(
        presentation_endpoint,
        "generate_presentation_structure",
        new=generate_structure,
    ), patch.object(
        presentation_endpoint.MEM0_PRESENTATION_MEMORY_SERVICE,
        "store_generated_outlines",
        new=AsyncMock(),
    ):
        response = _run(
            presentation_endpoint.prepare_presentation(
                presentation_id=presentation_id,
                outlines=[SlideOutlineModel(content="## Causes")],
                layout=str(template_id),
                sql_session=session,
            )
        )

    assert response.presentation_id == presentation_id
    assert presentation.layout == {
        **template_layouts,
        "icon_type": "bold",
        "icon_weight": "bold",
        "name": template_id,
        "template_id": template_id,
    }
    assert presentation.structure == {"slides": [0]}
    assert presentation.fonts == {"Inter": "https://example.com/inter.css"}
    structure_layout = generate_structure.await_args.kwargs["presentation_layout"]
    assert structure_layout.name == template_id
    assert structure_layout.slides[0].id == "template-layout-1"


def test_get_presentation_preserves_template_detail_payload():
    presentation_id = uuid.uuid4()
    now = datetime.now()
    template_layouts = {
        "layouts": [
            {
                "id": "slide_1",
                "description": "Full slide layout converted from PPTX slide 1.",
                "components": [],
            }
        ]
    }
    template_components = {
        "cluster_count": 1,
        "component_count": 1,
        "components": [
            {
                "id": "hero",
                "description": "Reusable hero content component.",
                "position": {"x": 24, "y": 32},
                "size": {"width": 640, "height": 200},
                "elements": [
                    {
                        "type": "text",
                        "position": {"x": 0, "y": 0},
                        "size": {"width": 640, "height": 80},
                        "runs": [{"text": "Hero"}],
                    }
                ],
            }
        ],
    }
    structure = {"slides": [0]}
    presentation = PresentationModel(
        id=presentation_id,
        version=PresentationVersion.V2_STANDARD,
        content="deck",
        n_slides=1,
        language="English",
        title="Deck",
        layout=template_layouts,
        structure=structure,
        tone="default",
        verbosity="standard",
        instructions=None,
        fonts={
            "Inter": "https://example.com/inter.css",
            "Brand Sans": "/app_data/fonts/brand-sans.ttf",
        },
        created_at=now,
        updated_at=now,
    )
    template = TemplateV2(
        id=str(uuid.uuid4()),
        name="presentation",
        layouts=template_layouts,
        assets={
            "fonts": {
                "Inter": "https://example.com/inter.css",
                "Brand Sans": "/app_data/fonts/brand-sans.ttf",
            }
        },
        components=template_components,
        merged_components=template_components,
    )
    slides = [
        SlideModel(
            presentation=presentation_id,
            layout_group=template.id,
            layout="slide_1",
            index=0,
            content={},
        )
    ]

    class _TemplateComponentSession(FakeAsyncSession):
        async def scalars(self, *_args, **_kwargs):
            return slides

        async def execute(self, *_args, **_kwargs):
            class _RowsResult:
                def all(self):
                    return [(template.id, template.layouts, template.components)]

            return _RowsResult()

    session = _TemplateComponentSession(
        get_results={presentation_id: presentation, template.id: template}
    )

    response = _run(
        presentation_endpoint.get_presentation(
            id=presentation_id,
            request=FakeRequest(),
            sql_session=session,
        )
    )

    assert response.version == PresentationVersion.V2_STANDARD
    assert not hasattr(response, "layout")
    assert not hasattr(response, "structure")
    assert not hasattr(response, "theme")
    assert not hasattr(response, "components")
    assert not hasattr(response, "merged_components")
    assert response.fonts == {
        "Inter": "https://example.com/inter.css",
        "Brand Sans": "/app_data/fonts/brand-sans.ttf",
    }


def test_stream_presentation_uses_template_schema_for_content_generation():
    presentation_id = uuid.uuid4()
    now = datetime.now()
    template_layouts = {
        "layouts": [
            {
                "id": "template-layout-1",
                "description": "Hero layout",
                "components": [
                    {
                        "id": "hero",
                        "description": "Hero content",
                        "elements": [
                            {
                                "type": "text",
                                "decorative": False,
                                "name": "headline",
                                "min_length": 2,
                                "max_length": 32,
                            }
                        ],
                    }
                ],
            }
        ]
    }
    presentation = PresentationModel(
        id=presentation_id,
        version=PresentationVersion.V2_STANDARD,
        content="deck",
        n_slides=1,
        language="English",
        title="Deck",
        outlines={"slides": [{"content": "## Causes"}]},
        layout=template_layouts,
        structure={"slides": [0]},
        tone="default",
        verbosity="standard",
        instructions=None,
        created_at=now,
        updated_at=now,
    )
    session = FakeAsyncSession(get_results={presentation_id: presentation})
    generated_layouts: list[SlideLayoutModel] = []
    generated_slide_numbers: list[int] = []

    async def fake_slide_content(slide_layout, *_args, **kwargs):
        generated_layouts.append(slide_layout)
        generated_slide_numbers.append(kwargs["slide_number"])
        return {
            "hero": {"headline": "Causes"},
            "__speaker_note__": "Speaker note for this generated slide.",
        }

    async def consume_stream():
        response = await presentation_endpoint.stream_presentation(
            id=presentation_id,
            sql_session=session,
        )
        chunks = []
        async for chunk in response.body_iterator:
            chunks.append(chunk)
        return chunks

    with patch.object(
        presentation_endpoint,
        "get_slide_content_from_type_and_outline",
        new=fake_slide_content,
    ), patch.object(
        presentation_endpoint,
        "process_slide_and_fetch_assets",
        new=AsyncMock(return_value=[]),
    ), patch.object(
        presentation_endpoint,
        "get_images_directory",
        return_value="/tmp",
    ), patch.object(
        presentation_endpoint,
        "ImageGenerationService",
        return_value=Mock(),
    ):
        chunks = _run(consume_stream())

    assert chunks
    assert len(generated_layouts) == 1
    assert generated_slide_numbers == [1]
    generated_layout = generated_layouts[0]
    assert generated_layout.id == "template-layout-1"
    assert generated_layout.name == "template-layout-1"
    assert generated_layout.description == "Hero layout"
    assert generated_layout.json_schema["title"] == "template-layout-1"
    assert generated_layout.json_schema["properties"]["hero"] == {
        "type": "object",
        "additionalProperties": False,
        "properties": {
            "headline": {
                "type": "string",
                "minLength": 2,
                "maxLength": 32,
            }
        },
        "required": ["headline"],
    }
    generated_slides = [
        item for item in session.added_all if isinstance(item, SlideModel)
    ]
    assert len(generated_slides) == 1
    assert (
        generated_slides[0].ui["components"][0]["elements"][0]["runs"][0]["text"]
        == "Causes"
    )
    assert template_layouts["layouts"][0]["components"][0]["elements"][0].get(
        "runs"
    ) is None


def test_generate_presentation_sync_rejects_invalid_slide_count(fake_async_session):
    request = GeneratePresentationRequest(
        content="deck",
        n_slides=0,
        language="English",
        export_as="pdf",
        template="general",
    )

    with pytest.raises(HTTPException) as exc:
        _run(
            presentation_endpoint.generate_presentation_sync(
                request_http=Mock(cookies={}),
                request=request,
                sql_session=fake_async_session,
            )
        )

    assert exc.value.status_code == 400
    assert "Number of slides must be greater than 0" in exc.value.detail


def test_generate_presentation_handler_rejects_invalid_llm_json(fake_async_session):
    request = GeneratePresentationRequest(
        content="Generate a small deck",
        n_slides=2,
        language="English",
        export_as="pdf",
        template="general",
    )

    async def fake_outline_stream(*_args, **_kwargs):
        yield "{invalid-json"

    with patch.object(
        presentation_endpoint.MEM0_PRESENTATION_MEMORY_SERVICE,
        "store_generation_context",
        new=AsyncMock(),
    ), patch.object(
        presentation_endpoint,
        "generate_ppt_outline",
        side_effect=fake_outline_stream,
    ), patch.object(
        presentation_endpoint.CONCURRENT_SERVICE,
        "run_task",
        new=Mock(),
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

    assert exc.value.status_code == 400
    assert "Failed to generate presentation outlines" in exc.value.detail


class _SlidesAsyncSession(FakeAsyncSession):
    def __init__(self, *args, slides: list[SlideModel], **kwargs):
        super().__init__(*args, **kwargs)
        self._slides = slides

    async def scalars(self, *_args, **_kwargs):
        return self._slides


async def _fake_export_presentation(presentation_id, *_args, **_kwargs):
    return PresentationAndPath(
        presentation_id=presentation_id,
        path="/tmp/generated/deck.pptx",
    )


def test_edit_presentation_hydrates_template_slide_ui():
    presentation_id = uuid.uuid4()
    template_id = str(uuid.uuid4())
    layout_payload = _template_layout_payload()
    presentation = PresentationModel(
        id=presentation_id,
        version=PresentationVersion.V2_STANDARD,
        content="deck",
        n_slides=1,
        language="English",
        layout=layout_payload,
        tone="default",
        verbosity="standard",
        instructions=None,
    )
    slide = SlideModel(
        presentation=presentation_id,
        layout_group=template_id,
        layout="template-layout-1",
        index=0,
        content={"hero": {"headline": "Old headline"}},
        ui=layout_payload["layouts"][0],
    )
    session = _SlidesAsyncSession(
        get_results={presentation_id: presentation},
        slides=[slide],
    )
    request = EditPresentationRequest(
        presentation_id=presentation_id,
        slides=[
            SlideContentUpdate(
                index=0,
                content={"hero": {"headline": "Updated headline"}},
            )
        ],
    )

    with patch.object(
        presentation_endpoint,
        "export_presentation",
        new=_fake_export_presentation,
    ):
        _run(
            presentation_endpoint.edit_presentation_with_new_content(
                request_http=FakeRequest(),
                data=request,
                sql_session=session,
            )
        )

    new_slide = next(item for item in session.added_all if isinstance(item, SlideModel))
    title_element = new_slide.ui["components"][0]["elements"][0]
    assert title_element["runs"][0]["text"] == "Updated headline"


def test_derive_presentation_hydrates_template_slide_ui():
    presentation_id = uuid.uuid4()
    template_id = str(uuid.uuid4())
    layout_payload = _template_layout_payload()
    presentation = PresentationModel(
        id=presentation_id,
        version=PresentationVersion.V2_STANDARD,
        content="deck",
        n_slides=1,
        language="English",
        layout=layout_payload,
        tone="default",
        verbosity="standard",
        instructions=None,
    )
    slide = SlideModel(
        presentation=presentation_id,
        layout_group=template_id,
        layout="template-layout-1",
        index=0,
        content={"hero": {"headline": "Old headline"}},
        ui=layout_payload["layouts"][0],
    )
    session = _SlidesAsyncSession(
        get_results={presentation_id: presentation},
        slides=[slide],
    )
    request = EditPresentationRequest(
        presentation_id=presentation_id,
        slides=[
            SlideContentUpdate(
                index=0,
                content={"hero": {"headline": "Derived headline"}},
            )
        ],
    )

    with patch.object(
        presentation_endpoint,
        "export_presentation",
        new=_fake_export_presentation,
    ):
        _run(
            presentation_endpoint.derive_presentation_from_existing_one(
                request_http=FakeRequest(),
                data=request,
                sql_session=session,
            )
        )

    new_presentation = next(
        item for item in session.added if isinstance(item, PresentationModel)
    )
    new_slide = next(item for item in session.added_all if isinstance(item, SlideModel))
    title_element = new_slide.ui["components"][0]["elements"][0]
    assert new_presentation.version == PresentationVersion.V2_STANDARD
    assert new_slide.presentation == new_presentation.id
    assert title_element["runs"][0]["text"] == "Derived headline"
