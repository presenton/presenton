import asyncio
import uuid
from copy import deepcopy
from datetime import datetime, timezone
from unittest.mock import AsyncMock, Mock, patch

import pytest
from fastapi import BackgroundTasks, HTTPException

from api.v1.ppt.endpoints.template import (
    CreateTemplateLayoutsRequest,
    CreateTemplateRequest,
    GenerateTemplateLayoutRequest,
    GenerateTemplateBlocksRequest,
    InitTemplateRequest,
    PatchTemplateSlideLayoutRequest,
    UpdateTemplateMetadataRequest,
    _create_template_sync,
    _run_create_template_task,
    create_template_slide_layouts,
    create_template,
    delete_template,
    generate_template_layout_from_prompt,
    generate_template_blocks,
    get_template,
    init_template,
    list_templates,
    patch_template_slide_layout,
    update_template_metadata,
)
from models.sql.async_task import AsyncTaskModel
from models.sql.template_v2 import TemplateV2
from services.export_task_service import PptxToJsonDocument
from templates.v2.models.layouts import MergedComponents, RawSlideLayouts, SlideLayouts


RAW_LAYOUTS = {
    "layouts": [
        {
            "id": "slide_1",
            "description": "Full slide layout converted from PPTX slide 1.",
            "elements": [
                {
                    "type": "vector",
                    "points": [
                        {"x": 0, "y": 0},
                        {"x": 1280, "y": 0},
                        {"x": 1280, "y": 720},
                        {"x": 0, "y": 720},
                    ],
                    "closed": True,
                    "fill": {"color": "#FFFFFF"},
                },
                {
                    "type": "image",
                    "position": {"x": 100, "y": 120},
                    "size": {"width": 320, "height": 180},
                    "data": "/app_data/pptx-to-json/session/images/photo.png",
                    "decorative": True,
                    "name": "photo",
                    "is_icon": False,
                }
            ],
        }
    ]
}

TEMPLATE_LAYOUTS = {
    "layouts": [
        {
            "id": "slide_1",
            "description": "Full slide layout converted from PPTX slide 1.",
            "components": [
                {
                    "id": "photo_component",
                    "description": "Reusable image component.",
                    "position": {"x": 100, "y": 120},
                    "elements": [
                        {
                            "type": "image",
                            "position": {"x": 0, "y": 0},
                            "size": {"width": 320, "height": 180},
                            "data": "/app_data/pptx-to-json/session/images/photo.png",
                            "decorative": True,
                            "name": "photo",
                            "is_icon": False,
                        }
                    ],
                }
            ],
        }
    ]
}

GENERATED_LAYOUTS = SlideLayouts.model_validate(TEMPLATE_LAYOUTS)
MERGED_COMPONENTS = MergedComponents.model_validate(
    {
        "components": [
            {
                "id": "photo_component",
                "description": "Reusable image component.",
                "variants": TEMPLATE_LAYOUTS["layouts"][0]["components"],
            }
        ]
    }
)


def _normalized_raw_layouts(layouts=RAW_LAYOUTS):
    return RawSlideLayouts.model_validate(layouts).model_dump(
        mode="json", exclude_none=True
    )


def _two_raw_layouts():
    return {
        "layouts": [
            RAW_LAYOUTS["layouts"][0],
            {
                **RAW_LAYOUTS["layouts"][0],
                "id": "slide_2",
                "description": "Full slide layout converted from PPTX slide 2.",
            },
        ]
    }


def _two_template_layouts():
    return {
        "layouts": [
            TEMPLATE_LAYOUTS["layouts"][0],
            {
                **TEMPLATE_LAYOUTS["layouts"][0],
                "id": "slide_2",
                "description": "Full slide layout converted from PPTX slide 2.",
            },
        ]
    }


def _template_layouts_with_icon_types():
    layout = deepcopy(TEMPLATE_LAYOUTS["layouts"][0])
    layout["components"][0]["elements"] = [
        {
            "type": "image",
            "position": {"x": 0, "y": 0},
            "size": {"width": 48, "height": 48},
            "data": "/app_data/icons/one.svg",
            "decorative": False,
            "name": "primary_icon",
            "is_icon": True,
            "icon_type": "bold",
        },
        {
            "type": "image",
            "position": {"x": 64, "y": 0},
            "size": {"width": 48, "height": 48},
            "data": "/app_data/icons/two.svg",
            "decorative": False,
            "name": "secondary_icon",
            "is_icon": True,
            "icon_type": "thin",
        },
        {
            "type": "group",
            "position": {"x": 128, "y": 0},
            "size": {"width": 48, "height": 48},
            "name": "nested_icon_group",
            "children": [
                {
                    "type": "image",
                    "position": {"x": 0, "y": 0},
                    "size": {"width": 48, "height": 48},
                    "data": "/app_data/icons/three.svg",
                    "decorative": False,
                    "name": "nested_icon",
                    "is_icon": True,
                    "icon_type": "thin",
                }
            ],
        },
    ]
    return {"layouts": [layout]}


def _prompt_generated_layout():
    return {
        "id": "title_metrics_dashboard",
        "description": "Title area above a flexible dashboard of editable metrics.",
        "components": [
            {
                "id": "main_content",
                "description": "Primary editable title and metric content region.",
                "position": {"x": 80, "y": 72},
                "elements": [
                    {
                        "type": "text",
                        "decorative": False,
                        "name": "title",
                        "runs": [{"text": "Quarterly performance"}],
                        "max_length": 80,
                        "min_length": 1,
                    }
                ],
            }
        ],
    }


class _RowsResult:
    def __init__(self, rows):
        self._rows = rows

    def all(self):
        return self._rows


class _ListSession:
    def __init__(self, rows=None):
        self.rows = rows

    async def scalar(self, *_args, **_kwargs):
        return 1

    async def execute(self, *_args, **_kwargs):
        now = datetime(2026, 6, 8, tzinfo=timezone.utc)
        rows = self.rows or [
            (
                "00000000-0000-0000-0000-000000000000",
                "Generating Template",
                "Still generating",
                {"layouts": []},
                {},
                False,
                now,
                now,
            ),
            (
                "00000000-0000-0000-0000-000000000001",
                "Quarterly Review",
                "Board deck template",
                TEMPLATE_LAYOUTS,
                {
                    "slide_image_urls": [
                        "/app_data/images/slide-1.png",
                        "/app_data/images/slide-2.png",
                    ]
                },
                False,
                now,
                now,
            ),
        ]
        return _RowsResult(
            rows
        )


class _TemplateTaskSession:
    def __init__(self, task: AsyncTaskModel):
        self.task = task
        self.added = []
        self.commit_snapshots = []

    async def get(self, _model, key):
        return self.task if key == self.task.id else None

    def add(self, obj):
        self.added.append(obj)

    async def commit(self):
        self.commit_snapshots.append(
            {
                "status": self.task.status,
                "message": self.task.message,
                "data": deepcopy(self.task.data),
                "error": deepcopy(self.task.error),
            }
        )

    async def refresh(self, _obj):
        return None


class _TemplateTaskSessionContext:
    def __init__(self, session: _TemplateTaskSession):
        self.session = session

    async def __aenter__(self):
        return self.session

    async def __aexit__(self, *_args):
        return False


def test_create_template_converts_generates_and_persists(tmp_path, fake_async_session):
    pptx_path = tmp_path / "quarterly-review.pptx"
    pptx_path.write_bytes(b"pptx")
    with patch(
        "api.v1.ppt.endpoints.template.resolve_app_path_to_filesystem",
        return_value=str(pptx_path),
    ), patch(
        "api.v1.ppt.endpoints.template.EXPORT_TASK_SERVICE.convert_pptx_to_json",
        new=AsyncMock(return_value=PptxToJsonDocument(**RAW_LAYOUTS)),
    ) as convert_mock, patch(
        "api.v1.ppt.endpoints.template.generate_template",
        new=Mock(return_value=GENERATED_LAYOUTS),
    ) as generate_mock, patch(
        "api.v1.ppt.endpoints.template.merge_similar_components",
        new=Mock(return_value=MERGED_COMPONENTS),
    ) as merge_mock, patch(
        "api.v1.ppt.endpoints.template.random.randint",
        return_value=4801,
    ) as randint_mock:
        template = asyncio.run(
            _create_template_sync(
                CreateTemplateRequest(
                    pptx_url="/app_data/uploads/quarterly-review.pptx",
                    slide_image_urls=["/app_data/images/slide-1.png"],
                    fonts={"Inter": "Inter"},
                ),
                sql_session=fake_async_session,
            )
        )

    convert_mock.assert_awaited_once_with(str(pptx_path))
    generate_mock.assert_called_once()
    raw_layouts_arg, slide_images_arg, fonts_arg = generate_mock.call_args.args
    assert len(raw_layouts_arg.layouts) == 1
    assert slide_images_arg == ["/app_data/images/slide-1.png"]
    assert fonts_arg == {"Inter": "Inter"}
    randint_mock.assert_called_once_with(1000, 9999)
    merge_mock.assert_called_once()
    merged_layouts_arg = merge_mock.call_args.args[0]
    assert merged_layouts_arg.layouts[0].id == "slide_1_4801"
    assert template.name == "quarterly-review"
    assert template.raw_layouts == _normalized_raw_layouts()
    assert template.components is None
    assert template.merged_components == MERGED_COMPONENTS.model_dump(
        mode="json", exclude_none=True
    )
    assert GENERATED_LAYOUTS.layouts[0].id == "slide_1"
    expected_layouts = {
        "layouts": [
            {
                **TEMPLATE_LAYOUTS["layouts"][0],
                "id": "slide_1_4801",
            }
        ]
    }
    assert template.layouts == expected_layouts
    assert template.assets == {
        "icon_type": "bold",
        "icon_weight": "bold",
        "fonts": {"Inter": "Inter"},
        "slide_image_urls": ["/app_data/images/slide-1.png"],
        "images": ["/app_data/pptx-to-json/session/images/photo.png"],
    }
    assert fake_async_session.added == [template]
    assert fake_async_session.commit_count == 1


def test_create_template_uses_most_common_generated_icon_type(
    tmp_path,
    fake_async_session,
):
    pptx_path = tmp_path / "icon-style.pptx"
    pptx_path.write_bytes(b"pptx")
    generated_layouts = SlideLayouts.model_validate(_template_layouts_with_icon_types())

    with patch(
        "api.v1.ppt.endpoints.template.resolve_app_path_to_filesystem",
        return_value=str(pptx_path),
    ), patch(
        "api.v1.ppt.endpoints.template.EXPORT_TASK_SERVICE.convert_pptx_to_json",
        new=AsyncMock(return_value=PptxToJsonDocument(**RAW_LAYOUTS)),
    ), patch(
        "api.v1.ppt.endpoints.template.generate_template",
        new=Mock(return_value=generated_layouts),
    ), patch(
        "api.v1.ppt.endpoints.template.merge_similar_components",
        new=Mock(return_value=MERGED_COMPONENTS),
    ), patch(
        "api.v1.ppt.endpoints.template.random.randint",
        return_value=4801,
    ):
        template = asyncio.run(
            _create_template_sync(
                CreateTemplateRequest(
                    pptx_url="/app_data/uploads/icon-style.pptx",
                    slide_image_urls=["/app_data/images/slide-1.png"],
                    icon_type="bold",
                ),
                sql_session=fake_async_session,
            )
        )

    assert template.assets["icon_type"] == "thin"
    assert template.assets["icon_weight"] == "thin"
    elements = template.layouts["layouts"][0]["components"][0]["elements"]
    assert elements[1]["icon_type"] == "thin"
    assert elements[2]["children"][0]["icon_type"] == "thin"


def test_create_template_caps_raw_layouts_to_preview_images(tmp_path, fake_async_session):
    pptx_path = tmp_path / "slidesgo.pptx"
    pptx_path.write_bytes(b"pptx")
    raw_layouts = {
        "layouts": [
            RAW_LAYOUTS["layouts"][0],
            {
                **RAW_LAYOUTS["layouts"][0],
                "id": "slide_2",
                "description": "Full slide layout converted from PPTX slide 2.",
            },
        ]
    }
    with patch(
        "api.v1.ppt.endpoints.template.resolve_app_path_to_filesystem",
        return_value=str(pptx_path),
    ), patch(
        "api.v1.ppt.endpoints.template.EXPORT_TASK_SERVICE.convert_pptx_to_json",
        new=AsyncMock(return_value=PptxToJsonDocument(**raw_layouts)),
    ), patch(
        "api.v1.ppt.endpoints.template.generate_template",
        new=Mock(return_value=GENERATED_LAYOUTS),
    ) as generate_mock, patch(
        "api.v1.ppt.endpoints.template.merge_similar_components",
        new=Mock(return_value=MERGED_COMPONENTS),
    ), patch(
        "api.v1.ppt.endpoints.template.random.randint",
        return_value=4801,
    ):
        template = asyncio.run(
            _create_template_sync(
                CreateTemplateRequest(
                    pptx_url="/app_data/uploads/slidesgo.pptx",
                    slide_image_urls=["/app_data/images/slide-1.png"],
                ),
                sql_session=fake_async_session,
            )
        )

    raw_layouts_arg = generate_mock.call_args.args[0]
    assert [layout.id for layout in raw_layouts_arg.layouts] == ["slide_1"]
    assert template.raw_layouts == _normalized_raw_layouts()
    assert template.assets["slide_image_urls"] == ["/app_data/images/slide-1.png"]


def test_create_template_persists_when_component_dedup_fails(
    tmp_path,
    fake_async_session,
):
    pptx_path = tmp_path / "dedup-fails.pptx"
    pptx_path.write_bytes(b"pptx")
    with patch(
        "api.v1.ppt.endpoints.template.resolve_app_path_to_filesystem",
        return_value=str(pptx_path),
    ), patch(
        "api.v1.ppt.endpoints.template.EXPORT_TASK_SERVICE.convert_pptx_to_json",
        new=AsyncMock(return_value=PptxToJsonDocument(**RAW_LAYOUTS)),
    ), patch(
        "api.v1.ppt.endpoints.template.generate_template",
        new=Mock(return_value=GENERATED_LAYOUTS),
    ), patch(
        "api.v1.ppt.endpoints.template.merge_similar_components",
        new=Mock(side_effect=ValueError("bad clusters")),
    ), patch(
        "api.v1.ppt.endpoints.template.random.randint",
        return_value=4801,
    ):
        template = asyncio.run(
            _create_template_sync(
                CreateTemplateRequest(
                    pptx_url="/app_data/uploads/dedup-fails.pptx",
                    slide_image_urls=["/app_data/images/slide-1.png"],
                ),
                sql_session=fake_async_session,
            )
        )

    assert template.merged_components == {"components": []}
    assert template.layouts["layouts"][0]["id"] == "slide_1_4801"
    assert fake_async_session.commit_count == 1


def test_create_template_requires_slide_images(fake_async_session):
    with pytest.raises(HTTPException) as exc:
        asyncio.run(
            _create_template_sync(
                CreateTemplateRequest(
                    pptx_url="/app_data/uploads/template.pptx",
                    slide_image_urls=[],
                ),
                sql_session=fake_async_session,
            )
        )

    assert exc.value.status_code == 400
    assert exc.value.detail == "At least one slide image is required"


def test_create_template_async_enqueues_task(fake_async_session):
    background_tasks = BackgroundTasks()

    task = asyncio.run(
        create_template(
            background_tasks=background_tasks,
            request=CreateTemplateRequest(
                pptx_url="/app_data/uploads/template.pptx",
                slide_image_urls=["/app_data/images/slide-1.png"],
            ),
            sql_session=fake_async_session,
        )
    )

    assert task.type == "template.create"
    assert task.status == "pending"
    assert task.message == "Queued for template creation"
    assert task.data == {
        "created_layouts": 0,
        "remaining_layouts": 1,
        "slide_layout_statuses": [{"index": 0, "status": "pending"}],
        "name": "template",
        "thumbnail": "/app_data/images/slide-1.png",
    }
    assert fake_async_session.added == [task]
    assert fake_async_session.commit_count == 1
    assert len(background_tasks.tasks) == 1


def test_create_template_async_task_updates_slide_status_before_batch_completes(
    tmp_path,
):
    pptx_path = tmp_path / "template.pptx"
    pptx_path.write_bytes(b"pptx")
    task = AsyncTaskModel(
        id="task-template-create",
        type="template.create",
        status="pending",
    )
    session = _TemplateTaskSession(task)
    generated_layouts = _two_template_layouts()["layouts"]
    generation_max_tokens = []

    def fake_generate_slide_layout(
        _raw_layout, index, _slide_image_url, _fonts, *, max_tokens=None
    ):
        generation_max_tokens.append(max_tokens)
        return generated_layouts[index]

    with patch(
        "api.v1.ppt.endpoints.template.async_session_maker",
        new=lambda: _TemplateTaskSessionContext(session),
    ), patch(
        "api.v1.ppt.endpoints.template.resolve_app_path_to_filesystem",
        return_value=str(pptx_path),
    ), patch(
        "api.v1.ppt.endpoints.template.EXPORT_TASK_SERVICE.convert_pptx_to_json",
        new=AsyncMock(return_value=PptxToJsonDocument(**_two_raw_layouts())),
    ), patch(
        "api.v1.ppt.endpoints.template.generate_slide_layout",
        new=Mock(side_effect=fake_generate_slide_layout),
    ), patch(
        "api.v1.ppt.endpoints.template.merge_similar_components",
        new=Mock(return_value=MERGED_COMPONENTS),
    ), patch(
        "api.v1.ppt.endpoints.template.random.randint",
        side_effect=[4801, 4802],
    ):
        asyncio.run(
            _run_create_template_task(
                task.id,
                CreateTemplateRequest(
                    pptx_url="/app_data/uploads/template.pptx",
                    slide_image_urls=[
                        "/app_data/images/slide-1.png",
                        "/app_data/images/slide-2.png",
                    ],
                ),
            )
        )

    in_progress_slide_snapshot = next(
        snapshot
        for snapshot in session.commit_snapshots
        if snapshot["status"] == "pending"
        and snapshot["data"]
        and snapshot["data"]["created_layouts"] == 1
    )
    slide_statuses = in_progress_slide_snapshot["data"]["slide_layout_statuses"]
    assert in_progress_slide_snapshot["message"] == "Generating slide layouts"
    assert in_progress_slide_snapshot["data"]["remaining_layouts"] == 1
    assert sum(status["status"] == "completed" for status in slide_statuses) == 1
    assert sum(status["status"] == "pending" for status in slide_statuses) == 1

    assert task.status == "completed"
    assert task.message == "Template creation completed"
    assert generation_max_tokens == [16000, 16000]
    assert task.data["slide_layout_statuses"] == [
        {"index": 0, "status": "completed"},
        {"index": 1, "status": "completed"},
    ]
    persisted_template = next(obj for obj in session.added if isinstance(obj, TemplateV2))
    assert persisted_template.layouts["layouts"][0]["id"] == "slide_1_4801"
    assert persisted_template.layouts["layouts"][1]["id"] == "slide_2_4802"


def test_template_request_ids_accept_non_uuid_strings():
    layouts_request = CreateTemplateLayoutsRequest.model_validate(
        {"id": "general-template", "indices": [0]}
    )
    blocks_request = GenerateTemplateBlocksRequest.model_validate(
        {"template_id": "sales-template"}
    )

    assert layouts_request.template_id == "general-template"
    assert blocks_request.template_id == "sales-template"


def test_init_template_persists_assets_without_layouts(tmp_path, fake_async_session):
    pptx_path = tmp_path / "quarterly-review.pptx"
    pptx_path.write_bytes(b"pptx")
    with patch(
        "api.v1.ppt.endpoints.template.resolve_app_path_to_filesystem",
        return_value=str(pptx_path),
    ), patch(
        "api.v1.ppt.endpoints.template.EXPORT_TASK_SERVICE.convert_pptx_to_json",
        new=AsyncMock(return_value=PptxToJsonDocument(**RAW_LAYOUTS)),
    ) as convert_mock:
        template_id = asyncio.run(
            init_template(
                InitTemplateRequest(
                    pptx_url="/app_data/uploads/quarterly-review.pptx",
                    slide_image_urls=["/app_data/images/slide-1.png"],
                    fonts={"Inter": "https://example.com/inter.css"},
                    name="Quarterly Review",
                    description="Board deck template",
                ),
                sql_session=fake_async_session,
            )
        )

    assert isinstance(template_id, str)
    convert_mock.assert_awaited_once_with(str(pptx_path))
    template = fake_async_session.added[0]
    assert template.name == "Quarterly Review"
    assert template.description == "Board deck template"
    assert template.raw_layouts == _normalized_raw_layouts()
    assert template.layouts is None
    assert template.assets == {
        "pptx_url": "/app_data/uploads/quarterly-review.pptx",
        "icon_type": "bold",
        "icon_weight": "bold",
        "fonts": {"Inter": "https://example.com/inter.css"},
        "slide_image_urls": ["/app_data/images/slide-1.png"],
        "images": ["/app_data/pptx-to-json/session/images/photo.png"],
        "layout_indexes": [],
    }
    assert fake_async_session.commit_count == 1


def test_list_templates_returns_paginated_summary():
    response = asyncio.run(
        list_templates(page=1, page_size=20, sql_session=_ListSession())
    )

    assert response.total == 1
    assert response.page == 1
    assert response.page_size == 20
    assert len(response.items) == 1
    assert response.items[0].id == "00000000-0000-0000-0000-000000000001"
    assert response.items[0].name == "Quarterly Review"
    assert response.items[0].description == "Board deck template"
    assert response.items[0].layout_count == 1
    assert response.items[0].thumbnail == "/app_data/images/slide-1.png"
    assert response.items[0].is_default is False


def test_list_templates_filters_by_default_flag():
    now = datetime(2026, 6, 8, tzinfo=timezone.utc)
    rows = [
        (
            "default-template",
            "Dynamic",
            "Built-in template",
            TEMPLATE_LAYOUTS,
            {},
            True,
            now,
            now,
        ),
        (
            "custom-template",
            "Quarterly Review",
            "Board deck template",
            TEMPLATE_LAYOUTS,
            {},
            False,
            now,
            now,
        ),
    ]

    default_response = asyncio.run(
        list_templates(
            page=1,
            page_size=20,
            default=True,
            sql_session=_ListSession(rows=rows),
        )
    )
    custom_response = asyncio.run(
        list_templates(
            page=1,
            page_size=20,
            default=False,
            sql_session=_ListSession(rows=rows),
        )
    )

    assert [item.id for item in default_response.items] == ["default-template"]
    assert default_response.total == 1
    assert default_response.items[0].is_default is True
    assert [item.id for item in custom_response.items] == ["custom-template"]
    assert custom_response.total == 1
    assert custom_response.items[0].is_default is False


def test_get_template_returns_layouts_components_and_fonts(fake_async_session):
    template_id = str(uuid.uuid4())
    template = TemplateV2(
        id=template_id,
        name="Customer Brand",
        description="User-generated customer template",
        layouts=TEMPLATE_LAYOUTS,
        merged_components={"components": [{"id": "hero"}]},
        assets={
            "thumbnail": "/app_data/images/customer-template.png",
            "fonts": {"Inter": "https://example.com/inter.css"},
        },
        is_default=False,
    )
    fake_async_session._get_results[template_id] = template

    response = asyncio.run(
        get_template(template_id, sql_session=fake_async_session)
    )

    assert response.id == template_id
    assert response.name == "Customer Brand"
    assert response.is_default is False
    assert response.layouts == TEMPLATE_LAYOUTS
    assert response.merged_components == {"components": [{"id": "hero"}]}
    assert response.fonts == {"Inter": "https://example.com/inter.css"}
    assert not hasattr(response, "raw_layouts")
    assert not hasattr(response, "components")
    assert not hasattr(response, "assets")
    assert not hasattr(response, "layout_schema")


def test_create_template_slide_layouts_returns_generated_layout(
    fake_async_session,
):
    template_id = str(uuid.uuid4())
    template = TemplateV2(
        name="Custom",
        raw_layouts=RAW_LAYOUTS,
        layouts=TEMPLATE_LAYOUTS,
        assets={
            "fonts": {"Inter": "https://example.com/inter.css"},
            "slide_image_urls": ["/app_data/images/slide-1.png"],
        },
    )
    fake_async_session._get_results[template_id] = template
    request = CreateTemplateLayoutsRequest.model_validate(
        {"id": str(template_id), "indices": [0]}
    )

    with patch(
        "api.v1.ppt.endpoints.template.generate_slide_layout",
        new=Mock(return_value=GENERATED_LAYOUTS.layouts[0]),
    ) as generate_mock, patch(
        "api.v1.ppt.endpoints.template.random.randint",
        return_value=4801,
    ):
        response = asyncio.run(
            create_template_slide_layouts(
                request,
                sql_session=fake_async_session,
            )
        )

    generate_mock.assert_called_once()
    source_layout, slide_index, slide_image_url, fonts = generate_mock.call_args.args
    assert source_layout.id == "slide_1"
    assert slide_index == 0
    assert slide_image_url == "/app_data/images/slide-1.png"
    assert fonts == {"Inter": "https://example.com/inter.css"}
    assert generate_mock.call_args.kwargs == {"max_tokens": 16000}
    assert response.layouts[0].index == 0
    response_layout = response.layouts[0].layout.model_dump(
        mode="json", exclude_none=True
    )
    assert response_layout == {
        **TEMPLATE_LAYOUTS["layouts"][0],
        "id": "slide_1_4801",
    }


def test_create_template_slide_layouts_rejects_invalid_index(
    fake_async_session,
):
    template_id = str(uuid.uuid4())
    fake_async_session._get_results[template_id] = TemplateV2(
        name="Custom",
        raw_layouts=RAW_LAYOUTS,
        layouts=TEMPLATE_LAYOUTS,
        assets={"slide_image_urls": ["/app_data/images/slide-1.png"]},
    )

    with pytest.raises(HTTPException) as exc:
        asyncio.run(
            create_template_slide_layouts(
                CreateTemplateLayoutsRequest(
                    template_id=template_id,
                    indices=[1],
                ),
                sql_session=fake_async_session,
            )
        )

    assert exc.value.status_code == 400
    assert exc.value.detail == "Invalid slide index"


def test_create_template_slide_layouts_requires_slide_image(
    fake_async_session,
):
    template_id = str(uuid.uuid4())
    fake_async_session._get_results[template_id] = TemplateV2(
        name="Custom",
        raw_layouts=RAW_LAYOUTS,
        layouts=TEMPLATE_LAYOUTS,
        assets={"slide_image_urls": []},
    )

    with pytest.raises(HTTPException) as exc:
        asyncio.run(
            create_template_slide_layouts(
                CreateTemplateLayoutsRequest(
                    template_id=template_id,
                    indices=[0],
                ),
                sql_session=fake_async_session,
            )
        )

    assert exc.value.status_code == 400
    assert (
        exc.value.detail == "Slide image URL is unavailable for requested slide index"
    )


def test_create_template_slide_layouts_preserves_image_url_indexes(
    fake_async_session,
):
    template_id = str(uuid.uuid4())
    raw_layouts = {
        "layouts": [
            RAW_LAYOUTS["layouts"][0],
            {
                **RAW_LAYOUTS["layouts"][0],
                "id": "slide_2",
                "description": "Full slide layout converted from PPTX slide 2.",
            },
        ]
    }
    fake_async_session._get_results[template_id] = TemplateV2(
        name="Custom",
        raw_layouts=raw_layouts,
        layouts=TEMPLATE_LAYOUTS,
        assets={"slide_image_urls": ["", "/app_data/images/slide-2.png"]},
    )

    with patch(
        "api.v1.ppt.endpoints.template.generate_slide_layout",
        new=Mock(return_value=GENERATED_LAYOUTS.layouts[0]),
    ) as generate_mock:
        asyncio.run(
            create_template_slide_layouts(
                CreateTemplateLayoutsRequest(
                    template_id=template_id,
                    indices=[1],
                ),
                sql_session=fake_async_session,
            )
        )

    source_layout, slide_index, slide_image_url, _fonts = generate_mock.call_args.args
    assert source_layout.id == "slide_2"
    assert slide_index == 1
    assert slide_image_url == "/app_data/images/slide-2.png"
    assert generate_mock.call_args.kwargs == {"max_tokens": 16000}


def test_create_template_slide_layouts_returns_404_for_missing_template(
    fake_async_session,
):
    with pytest.raises(HTTPException) as exc:
        asyncio.run(
            create_template_slide_layouts(
                CreateTemplateLayoutsRequest(
                    template_id=str(uuid.uuid4()),
                    indices=[0],
                ),
                sql_session=fake_async_session,
            )
        )

    assert exc.value.status_code == 404
    assert exc.value.detail == "Template not found"


def test_generate_template_blocks_clusters_and_persists(fake_async_session):
    template_id = str(uuid.uuid4())
    template = TemplateV2(
        name="Custom",
        layouts=TEMPLATE_LAYOUTS,
        raw_layouts=RAW_LAYOUTS,
    )
    fake_async_session._get_results[template_id] = template

    with patch(
        "api.v1.ppt.endpoints.template.merge_similar_components",
        new=Mock(return_value=MERGED_COMPONENTS),
    ) as merge_mock:
        response = asyncio.run(
            generate_template_blocks(
                GenerateTemplateBlocksRequest.model_validate(
                    {"id": str(template_id)}
                ),
                sql_session=fake_async_session,
            )
        )

    merge_mock.assert_called_once()
    layouts_arg = merge_mock.call_args.args[0]
    assert layouts_arg.layouts[0].id == "slide_1"
    assert response == template
    assert template.merged_components == MERGED_COMPONENTS.model_dump(
        mode="json", exclude_none=True
    )
    assert fake_async_session.commit_count == 1


def test_generate_template_blocks_requires_layouts(fake_async_session):
    template_id = str(uuid.uuid4())
    fake_async_session._get_results[template_id] = TemplateV2(
        name="Custom",
        layouts=None,
        raw_layouts=RAW_LAYOUTS,
    )

    with pytest.raises(HTTPException) as exc:
        asyncio.run(
            generate_template_blocks(
                GenerateTemplateBlocksRequest(template_id=template_id),
                sql_session=fake_async_session,
            )
        )

    assert exc.value.status_code == 400
    assert exc.value.detail == "Template layouts are unavailable"
    assert fake_async_session.commit_count == 0


def test_generate_template_layout_request_normalizes_values():
    request = GenerateTemplateLayoutRequest(
        template_id="  template-one  ",
        prompt="  Create a title and metrics dashboard.  ",
    )

    assert request.template_id == "template-one"
    assert request.prompt == "Create a title and metrics dashboard."


def test_generate_template_layout_from_prompt_returns_draft(
    fake_async_session,
):
    template_id = str(uuid.uuid4())
    template = TemplateV2(
        id=template_id,
        name="Custom",
        description="A clean editorial template.",
        layouts=TEMPLATE_LAYOUTS,
        merged_components=MERGED_COMPONENTS.model_dump(
            mode="json", exclude_none=True
        ),
        assets={"fonts": {"Inter": "/app_data/fonts/inter.woff2"}},
    )
    fake_async_session._get_results[template_id] = template
    generated_layout = SlideLayouts.model_validate(
        {"layouts": [_prompt_generated_layout()]}
    ).layouts[0]

    with patch(
        "api.v1.ppt.endpoints.template.generate_prompted_slide_layout",
        new=Mock(return_value=generated_layout),
    ) as generate_mock:
        response = asyncio.run(
            generate_template_layout_from_prompt(
                request=GenerateTemplateLayoutRequest(
                    template_id=template_id,
                    prompt="Create a metrics dashboard.",
                ),
                sql_session=fake_async_session,
            )
        )

    assert response.layout == generated_layout
    assert response.response == (
        "Created the title metrics dashboard template layout."
    )
    generate_mock.assert_called_once()
    (
        prompt_arg,
        layouts_arg,
        merged_components_arg,
        name_arg,
        description_arg,
        fonts_arg,
    ) = generate_mock.call_args.args
    assert prompt_arg == "Create a metrics dashboard."
    assert layouts_arg == GENERATED_LAYOUTS
    assert merged_components_arg == MERGED_COMPONENTS
    assert name_arg == "Custom"
    assert description_arg == "A clean editorial template."
    assert fonts_arg == {"Inter": "/app_data/fonts/inter.woff2"}
    assert fake_async_session.commit_count == 0


def test_generate_template_layout_from_prompt_requires_layouts(
    fake_async_session,
):
    template_id = str(uuid.uuid4())
    fake_async_session._get_results[template_id] = TemplateV2(
        id=template_id,
        name="Custom",
        layouts=None,
    )

    with pytest.raises(HTTPException) as exc:
        asyncio.run(
            generate_template_layout_from_prompt(
                request=GenerateTemplateLayoutRequest(
                    template_id=template_id,
                    prompt="Create a metrics dashboard.",
                ),
                sql_session=fake_async_session,
            )
        )

    assert exc.value.status_code == 400
    assert exc.value.detail == "Template layouts are unavailable"
    assert fake_async_session.commit_count == 0


def test_patch_template_slide_layout_updates_stored_layouts(fake_async_session):
    template_id = str(uuid.uuid4())
    template = TemplateV2(
        name="Custom",
        layouts=_two_template_layouts(),
        raw_layouts=RAW_LAYOUTS,
    )
    fake_async_session._get_results[template_id] = template
    patched_layout = {
        **TEMPLATE_LAYOUTS["layouts"][0],
        "id": "slide_2_updated",
        "description": "Updated full slide layout converted from PPTX slide 2.",
    }

    response = asyncio.run(
        patch_template_slide_layout(
            template_id,
            PatchTemplateSlideLayoutRequest(
                index=1,
                layout=patched_layout,
            ),
            sql_session=fake_async_session,
        )
    )

    assert response == template
    assert template.layouts["layouts"][0]["id"] == "slide_1"
    assert template.layouts["layouts"][1] == patched_layout
    assert template.assets == {"layout_indexes": [0, 1]}
    assert fake_async_session.commit_count == 1


def test_patch_template_slide_layout_updates_icon_type_from_layouts(
    fake_async_session,
):
    template_id = str(uuid.uuid4())
    template = TemplateV2(
        name="Custom",
        layouts=TEMPLATE_LAYOUTS,
        raw_layouts=RAW_LAYOUTS,
        assets={"icon_type": "bold", "icon_weight": "bold"},
    )
    fake_async_session._get_results[template_id] = template
    patched_layout = _template_layouts_with_icon_types()["layouts"][0]

    response = asyncio.run(
        patch_template_slide_layout(
            template_id,
            PatchTemplateSlideLayoutRequest(
                index=0,
                layout=patched_layout,
            ),
            sql_session=fake_async_session,
        )
    )

    assert response == template
    assert template.assets == {
        "icon_type": "thin",
        "icon_weight": "thin",
        "layout_indexes": [0],
    }
    assert fake_async_session.commit_count == 1


def test_patch_template_slide_layout_merges_out_of_order_init_saves(
    fake_async_session,
):
    template_id = str(uuid.uuid4())
    raw_layouts = {
        "layouts": [
            RAW_LAYOUTS["layouts"][0],
            {
                **RAW_LAYOUTS["layouts"][0],
                "id": "slide_2",
                "description": "Full slide layout converted from PPTX slide 2.",
            },
        ]
    }
    template = TemplateV2(
        name="Custom",
        raw_layouts=raw_layouts,
        layouts=None,
        assets={"layout_indexes": []},
    )
    fake_async_session._get_results[template_id] = template
    second_layout = {
        **TEMPLATE_LAYOUTS["layouts"][0],
        "id": "slide_2",
        "description": "Full slide layout converted from PPTX slide 2.",
    }

    asyncio.run(
        patch_template_slide_layout(
            template_id,
            PatchTemplateSlideLayoutRequest(
                layouts=[{"index": 1, "layout": second_layout}],
            ),
            sql_session=fake_async_session,
        )
    )
    asyncio.run(
        patch_template_slide_layout(
            template_id,
            PatchTemplateSlideLayoutRequest(
                layouts=[{"index": 0, "layout": TEMPLATE_LAYOUTS["layouts"][0]}],
            ),
            sql_session=fake_async_session,
        )
    )

    assert template.assets == {"layout_indexes": [0, 1]}
    assert template.layouts["layouts"][0]["id"] == "slide_1"
    assert template.layouts["layouts"][1]["id"] == "slide_2"
    assert fake_async_session.commit_count == 2


def test_patch_template_slide_layout_rejects_invalid_index(fake_async_session):
    template_id = str(uuid.uuid4())
    fake_async_session._get_results[template_id] = TemplateV2(
        name="Custom",
        layouts=TEMPLATE_LAYOUTS,
        raw_layouts=RAW_LAYOUTS,
    )

    with pytest.raises(HTTPException) as exc:
        asyncio.run(
            patch_template_slide_layout(
                template_id,
                PatchTemplateSlideLayoutRequest(
                    index=1,
                    layout=TEMPLATE_LAYOUTS["layouts"][0],
                ),
                sql_session=fake_async_session,
            )
        )

    assert exc.value.status_code == 400
    assert exc.value.detail == "Invalid slide index"
    assert fake_async_session.commit_count == 0


def test_patch_template_slide_layout_rejects_duplicate_layout_ids(
    fake_async_session,
):
    template_id = str(uuid.uuid4())
    fake_async_session._get_results[template_id] = TemplateV2(
        name="Custom",
        layouts=_two_template_layouts(),
        raw_layouts=RAW_LAYOUTS,
    )
    duplicate_layout = {
        **TEMPLATE_LAYOUTS["layouts"][0],
        "id": "slide_1",
        "description": "Duplicate ID full slide layout converted from PPTX slide 2.",
    }

    with pytest.raises(HTTPException) as exc:
        asyncio.run(
            patch_template_slide_layout(
                template_id,
                PatchTemplateSlideLayoutRequest(
                    index=1,
                    layout=duplicate_layout,
                ),
                sql_session=fake_async_session,
            )
        )

    assert exc.value.status_code == 400
    assert exc.value.detail == "Patched template layouts are invalid"
    assert fake_async_session.commit_count == 0


def test_get_template_returns_template(fake_async_session):
    template_id = str(uuid.uuid4())
    template = TemplateV2(id=template_id, name="Custom", layouts=RAW_LAYOUTS)
    fake_async_session._get_results[template_id] = template

    response = asyncio.run(
        get_template(template_id, sql_session=fake_async_session)
    )

    assert response.id == template.id
    assert response.name == template.name
    assert response.layouts == template.layouts
    assert response.fonts == {}


def test_update_template_metadata_updates_name_and_description(fake_async_session):
    template_id = str(uuid.uuid4())
    template = TemplateV2(name="Custom", description=None, layouts=RAW_LAYOUTS)
    fake_async_session._get_results[template_id] = template

    response = asyncio.run(
        update_template_metadata(
            template_id,
            UpdateTemplateMetadataRequest(
                name="  Sales Template  ",
                description="  Quarterly report deck  ",
            ),
            sql_session=fake_async_session,
        )
    )

    assert response == template
    assert template.name == "Sales Template"
    assert template.description == "Quarterly report deck"
    assert fake_async_session.added == [template]
    assert fake_async_session.commit_count == 1


def test_update_template_metadata_updates_icon_type(fake_async_session):
    template_id = str(uuid.uuid4())
    template = TemplateV2(
        name="Custom",
        layouts=RAW_LAYOUTS,
        assets={"fonts": {}, "icon_type": "bold", "icon_weight": "bold"},
    )
    fake_async_session._get_results[template_id] = template

    response = asyncio.run(
        update_template_metadata(
            template_id,
            UpdateTemplateMetadataRequest(icon_type="thin"),
            sql_session=fake_async_session,
        )
    )

    assert response == template
    assert template.assets["icon_type"] == "thin"
    assert template.assets["icon_weight"] == "thin"
    assert fake_async_session.added == [template]
    assert fake_async_session.commit_count == 1


def test_update_template_metadata_rejects_blank_name(fake_async_session):
    template_id = str(uuid.uuid4())
    template = TemplateV2(name="Custom", layouts=RAW_LAYOUTS)
    fake_async_session._get_results[template_id] = template

    with pytest.raises(HTTPException) as exc:
        asyncio.run(
            update_template_metadata(
                template_id,
                UpdateTemplateMetadataRequest(name="   "),
                sql_session=fake_async_session,
            )
        )

    assert exc.value.status_code == 400
    assert exc.value.detail == "Template name is required"
    assert template.name == "Custom"
    assert fake_async_session.commit_count == 0


def test_update_template_replaces_full_layout_collection(fake_async_session):
    template_id = str(uuid.uuid4())
    template = TemplateV2(
        id=template_id,
        name="Custom",
        layouts=_two_template_layouts(),
        raw_layouts=_two_raw_layouts(),
        assets={"layout_indexes": [0, 1], "thumbnail": "old.png"},
    )
    fake_async_session._get_results[template_id] = template
    replacement_layout = deepcopy(TEMPLATE_LAYOUTS["layouts"][0])
    replacement_layout["id"] = "replacement-layout"

    response = asyncio.run(
        update_template_metadata(
            template_id,
            UpdateTemplateMetadataRequest(
                id=template_id,
                name="  Updated Template  ",
                layouts={"layouts": [replacement_layout]},
            ),
            sql_session=fake_async_session,
        )
    )

    assert response == template
    assert template.name == "Updated Template"
    assert template.layouts == {"layouts": [replacement_layout]}
    assert template.assets == {
        "layout_indexes": [0],
        "thumbnail": "old.png",
    }
    assert fake_async_session.added == [template]
    assert fake_async_session.commit_count == 1


def test_update_template_preserves_text_font_and_spacing_changes(fake_async_session):
    template_id = str(uuid.uuid4())
    template = TemplateV2(
        id=template_id,
        name="Custom",
        layouts=TEMPLATE_LAYOUTS,
    )
    fake_async_session._get_results[template_id] = template
    replacement_layout = deepcopy(TEMPLATE_LAYOUTS["layouts"][0])
    replacement_layout["components"][0]["elements"] = [
        {
            "type": "text",
            "position": {"x": 0, "y": 0},
            "size": {"width": 480, "height": 100},
            "font": {
                "family": "Montserrat",
                "size": 42,
                "color": "#112233",
                "bold": True,
                "italic": True,
                "underline": True,
                "line_height": 1.35,
                "letter_spacing": 2.5,
            },
            "runs": [
                {
                    "text": "Styled heading",
                    "font": {
                        "family": "Montserrat",
                        "size": 42,
                        "underline": True,
                        "line_height": 1.35,
                        "letter_spacing": 2.5,
                    },
                }
            ],
            "decorative": False,
            "name": "heading",
            "min_length": 4,
            "max_length": 30,
        }
    ]

    asyncio.run(
        update_template_metadata(
            template_id,
            UpdateTemplateMetadataRequest(
                id=template_id,
                layouts={"layouts": [replacement_layout]},
            ),
            sql_session=fake_async_session,
        )
    )

    saved_text = template.layouts["layouts"][0]["components"][0]["elements"][0]
    replacement_text = replacement_layout["components"][0]["elements"][0]
    assert saved_text["font"] == replacement_text["font"]
    assert saved_text["runs"][0]["font"] == replacement_text["runs"][0]["font"]


def test_update_template_updates_response_assets_and_components(fake_async_session):
    template_id = str(uuid.uuid4())
    template = TemplateV2(
        id=template_id,
        name="Custom",
        layouts=TEMPLATE_LAYOUTS,
        assets={"thumbnail": "old.png", "fonts": {"Old": "old.woff2"}},
    )
    fake_async_session._get_results[template_id] = template

    asyncio.run(
        update_template_metadata(
            template_id,
            UpdateTemplateMetadataRequest(
                id=template_id,
                thumbnail="new.png",
                fonts={"Inter": "inter.woff2"},
                merged_components=MERGED_COMPONENTS.model_dump(
                    mode="json", exclude_none=True
                ),
            ),
            sql_session=fake_async_session,
        )
    )

    assert template.assets == {
        "thumbnail": "new.png",
        "fonts": {"Inter": "inter.woff2"},
    }
    assert template.merged_components == MERGED_COMPONENTS.model_dump(
        mode="json", exclude_none=True
    )
    assert fake_async_session.commit_count == 1


def test_update_template_rejects_path_body_id_mismatch(fake_async_session):
    with pytest.raises(HTTPException) as exc:
        asyncio.run(
            update_template_metadata(
                "template-one",
                UpdateTemplateMetadataRequest(id="template-two"),
                sql_session=fake_async_session,
            )
        )

    assert exc.value.status_code == 400
    assert exc.value.detail == "Template ID in path does not match request body ID"
    assert fake_async_session.commit_count == 0


def test_update_template_id_only_does_not_write(fake_async_session):
    template_id = str(uuid.uuid4())
    template = TemplateV2(id=template_id, name="Custom", layouts=TEMPLATE_LAYOUTS)
    fake_async_session._get_results[template_id] = template

    response = asyncio.run(
        update_template_metadata(
            template_id,
            UpdateTemplateMetadataRequest(id=template_id),
            sql_session=fake_async_session,
        )
    )

    assert response == template
    assert fake_async_session.added == []
    assert fake_async_session.commit_count == 0


def test_delete_template_deletes_template(fake_async_session):
    template_id = str(uuid.uuid4())
    template = TemplateV2(name="Custom", layouts=RAW_LAYOUTS)
    fake_async_session._get_results[template_id] = template

    response = asyncio.run(
        delete_template(template_id, sql_session=fake_async_session)
    )

    assert response.status_code == 204
    assert fake_async_session.deleted == [template]
    assert fake_async_session.commit_count == 1


def test_get_template_returns_404_for_missing_template(fake_async_session):
    with pytest.raises(HTTPException) as exc:
        asyncio.run(get_template("missing-template", sql_session=fake_async_session))

    assert exc.value.status_code == 404
    assert exc.value.detail == "Template not found"
