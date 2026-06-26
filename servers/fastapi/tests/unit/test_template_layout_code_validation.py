from __future__ import annotations

import asyncio
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

import pytest
from fastapi import HTTPException

from models.sql.presentation_layout_code import PresentationLayoutCodeModel
from models.sql.template import TemplateModel
from models.sql.template_create_info import TemplateCreateInfoModel
from templates import handler as template_handler
from templates.layout_code_validation import (
    LayoutCodeValidationError,
    ValidatedLayoutCode,
)


@dataclass
class _ScalarResult:
    value: Any

    def scalars(self):
        return self

    def all(self):
        return []


class _TemplateSession:
    def __init__(
        self,
        *,
        template_info: TemplateCreateInfoModel | None = None,
        template: TemplateModel | None = None,
        layout: PresentationLayoutCodeModel | None = None,
    ) -> None:
        self.template_info = template_info
        self.template = template
        self.layout = layout
        self.added: list[Any] = []
        self.added_all: list[Any] = []
        self.execute_count = 0
        self.commit_count = 0

    async def get(self, model: Any, key: Any):
        if model is TemplateCreateInfoModel:
            return self.template_info
        if model is TemplateModel:
            return self.template
        return None

    async def scalar(self, *_args: Any, **_kwargs: Any):
        return self.layout

    async def execute(self, *_args: Any, **_kwargs: Any):
        self.execute_count += 1
        return _ScalarResult(self.layout)

    def add(self, obj: Any) -> None:
        self.added.append(obj)

    def add_all(self, objs: list[Any]) -> None:
        self.added_all.extend(list(objs))

    async def commit(self) -> None:
        self.commit_count += 1

    async def refresh(self, _obj: Any) -> None:
        if getattr(_obj, "created_at", None) is None:
            _obj.created_at = datetime.now(timezone.utc)
        return None


def _validated(code: str = "validated-code") -> ValidatedLayoutCode:
    return ValidatedLayoutCode(
        layout_code=code,
        layout_id="validated-layout",
        layout_name="Validated Layout",
        layout_description="Validated layout description",
        schema_json_value={"type": "object"},
    )


async def _invalid_validator(_code: str):
    raise LayoutCodeValidationError("Unexpected token", line=2, column=5)


async def _valid_validator(code: str):
    return _validated(f"normalized:{code}")


def test_save_template_rejects_invalid_layout_before_commit(monkeypatch):
    template_info_id = uuid.uuid4()
    session = _TemplateSession(
        template_info=TemplateCreateInfoModel(
            id=template_info_id,
            fonts={},
            pptx_url="/tmp/test.pptx",
            slide_htmls=["<div />"],
            slide_image_urls=["/tmp/test.png"],
        )
    )
    monkeypatch.setattr(template_handler, "validate_layout_code", _invalid_validator)

    request = template_handler.SaveTemplateRequest(
        template_info_id=template_info_id,
        name="Template",
        layouts=[
            template_handler.SaveTemplateLayoutData(
                layout_id="one",
                layout_name="One",
                layout_code="broken",
            )
        ],
    )

    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(template_handler.save_template(request, session))

    assert exc_info.value.status_code == 400
    assert session.commit_count == 0
    assert session.added == []
    assert session.added_all == []


def test_update_template_rejects_invalid_layout_before_delete(monkeypatch):
    template_id = uuid.uuid4()
    session = _TemplateSession(template=TemplateModel(id=template_id, name="Template"))
    monkeypatch.setattr(template_handler, "validate_layout_code", _invalid_validator)

    request = template_handler.UpdateTemplateRequest(
        id=template_id,
        layouts=[
            template_handler.SaveTemplateLayoutData(
                layout_id="one",
                layout_name="One",
                layout_code="broken",
            )
        ],
    )

    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(template_handler.update_template(request, session))

    assert exc_info.value.status_code == 400
    assert session.execute_count == 0
    assert session.commit_count == 0
    assert session.added_all == []


def test_save_slide_layout_rejects_invalid_code_without_replacing_existing(
    monkeypatch,
):
    template_id = uuid.uuid4()
    layout = PresentationLayoutCodeModel(
        presentation=template_id,
        layout_id="existing",
        layout_name="Existing",
        layout_code="previous-valid-code",
    )
    session = _TemplateSession(
        template=TemplateModel(id=template_id, name="Template"),
        layout=layout,
    )
    monkeypatch.setattr(template_handler, "validate_layout_code", _invalid_validator)

    request = template_handler.SaveSlideLayoutRequest(
        template_id=template_id,
        layout_id="existing",
        layout_code="broken",
    )

    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(template_handler.save_slide_layout(request, session))

    assert exc_info.value.status_code == 400
    assert layout.layout_code == "previous-valid-code"
    assert session.commit_count == 0


def test_save_template_persists_normalized_validated_code(monkeypatch):
    template_info_id = uuid.uuid4()
    session = _TemplateSession(
        template_info=TemplateCreateInfoModel(
            id=template_info_id,
            fonts={"Inter": "/fonts/Inter.ttf"},
            pptx_url="/tmp/test.pptx",
            slide_htmls=["<div />"],
            slide_image_urls=["/tmp/test.png"],
        )
    )
    monkeypatch.setattr(template_handler, "validate_layout_code", _valid_validator)

    request = template_handler.SaveTemplateRequest(
        template_info_id=template_info_id,
        name="Template",
        layouts=[
            template_handler.SaveTemplateLayoutData(
                layout_id="one",
                layout_name="One",
                layout_code="raw-code",
            )
        ],
    )

    response = asyncio.run(template_handler.save_template(request, session))

    assert response.name == "Template"
    assert session.commit_count == 1
    assert len(session.added_all) == 1
    saved_layout = session.added_all[0]
    assert saved_layout.layout_code == "normalized:raw-code"
    assert saved_layout.layout_id == "validated-layout"
    assert saved_layout.layout_name == "Validated Layout"


def test_generated_layout_retries_until_repair_succeeds(monkeypatch):
    calls: list[str] = []

    async def retry_call(user_text: str) -> str:
        calls.append(user_text)
        if len(calls) < 3:
            return "still-bad-code"
        return "fixed-code"

    async def validate(code: str) -> ValidatedLayoutCode:
        if code == "bad-code":
            raise LayoutCodeValidationError("Bad JSX", line=3, column=9)
        if code == "still-bad-code":
            raise LayoutCodeValidationError("Missing Schema", line=1, column=1)
        return _validated(code)

    monkeypatch.setattr(template_handler, "validate_layout_code", validate)

    result = asyncio.run(
        template_handler._validate_provider_layout_code_or_retry(
            code="bad-code",
            retry_call=retry_call,
            original_user_text="original prompt",
            normalize_code=lambda value: value,
        )
    )

    assert result.layout_code == "fixed-code"
    assert len(calls) == 3
    assert "Bad JSX at 3:9" in calls[0]
    assert "bad-code" in calls[0]
    assert "Missing Schema at 1:1" in calls[2]
    assert "still-bad-code" in calls[2]


def test_generated_layout_returns_502_when_repair_is_still_invalid(monkeypatch):
    calls: list[str] = []

    async def retry_call(user_text: str) -> str:
        calls.append(user_text)
        return "still-bad-code"

    async def validate(_code: str) -> ValidatedLayoutCode:
        raise LayoutCodeValidationError("Missing Schema", line=1, column=1)

    monkeypatch.setattr(template_handler, "validate_layout_code", validate)

    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(
            template_handler._validate_provider_layout_code_or_retry(
                code="bad-code",
                retry_call=retry_call,
                original_user_text="original prompt",
                normalize_code=lambda value: value,
            )
        )

    assert exc_info.value.status_code == 502
    assert len(calls) == template_handler.LAYOUT_CODE_REPAIR_ATTEMPTS
    assert "invalid layout code after 3 repair attempts" in str(exc_info.value.detail)
