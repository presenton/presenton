import asyncio
import io
import json
import os
import stat
import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest
from fastapi import HTTPException
from openai import APIError as OpenAIAPIError

from models.api_error_model import APIErrorModel
from models.image_prompt import ImagePrompt
from models.presentation_outline_model import PresentationOutlineModel, SlideOutlineModel
from models.presentation_structure_model import PresentationStructureModel
from models.sql.presentation import PresentationModel
from models.sql.slide import SlideModel
from models.sse_response import (
    SSECompleteResponse,
    SSEErrorResponse,
    SSEStatusResponse,
    SSETraceResponse,
    SSEResponse,
)
from services.chat.conversation_store import ChatConversationStore
from services.concurrent_service import ConcurrentService
from services.export_task_service import EXPORT_TASK_SERVICE
from templates import get_layout_by_name as tpl_layout_fetcher
from templates.presentation_layout import PresentationLayoutModel, SlideLayoutModel
from utils import ocr_language
from utils.datetime_utils import get_current_utc_datetime
from utils.export_utils import export_presentation
from utils.file_utils import (
    get_file_ext_or_none,
    get_file_name_with_random_uuid,
    get_original_file_name,
    replace_file_name,
    set_file_ext,
)
from utils.get_dynamic_models import (
    get_presentation_outline_model_with_n_slides,
    get_presentation_structure_model_with_n_slides,
)
from utils.image_provider import (
    get_selected_image_provider,
    is_comfyui_selected,
    is_dalle3_selected,
    is_gemini_flash_selected,
    is_gpt_image_1_5_selected,
    is_image_generation_disabled,
    is_nanobanana_pro_selected,
    is_open_webui_selected,
    is_pixabay_selected,
    is_pixels_selected,
)
from utils.llm_client_error_handler import handle_llm_client_exceptions
from utils.parsers import parse_bool_or_none
from utils.path_helpers import get_resource_path, get_writable_path

_ALL_IMAGE_PROVIDER_PREDICATES = (
    is_pixels_selected,
    is_pixabay_selected,
    is_gemini_flash_selected,
    is_nanobanana_pro_selected,
    is_dalle3_selected,
    is_gpt_image_1_5_selected,
    is_comfyui_selected,
    is_open_webui_selected,
)


def _parse_sse_frame(blob: str) -> tuple[str, dict]:
    """Parse a single SSEResponse / derivative frame (event + JSON data)."""
    text = blob.strip()
    lines = text.split("\n")
    assert len(lines) == 2
    assert lines[0].startswith("event: ")
    assert lines[1].startswith("data: ")
    event = lines[0].removeprefix("event: ")
    raw_data = lines[1].removeprefix("data: ")
    return event, json.loads(raw_data)


def _outline_layout_structure_payloads() -> tuple[dict, dict, dict]:
    layout_payload = PresentationLayoutModel(
        name="n",
        ordered=True,
        slides=[SlideLayoutModel(id="z", json_schema={"title": "t"})],
    ).model_dump(mode="json")
    structure_payload = PresentationStructureModel(slides=[0]).model_dump(mode="json")
    outline = PresentationOutlineModel(
        slides=[SlideOutlineModel(content="## Hello")]
    ).model_dump(mode="json")
    return outline, layout_payload, structure_payload


def test_get_current_utc_datetime_is_timezone_aware():
    dt = get_current_utc_datetime()
    assert dt.tzinfo is not None


@pytest.mark.parametrize(
    ("value", "expected"),
    [
        (None, None),
        ("true", True),
        ("TRUE", True),
        ("TrUe", True),
        ("false", False),
        ("FALSE", False),
        ("", False),
        ("yes", False),
        ("1", False),
        ("\tfalse\n", False),
    ],
)
def test_parse_bool_or_none(value: str | None, expected):
    assert parse_bool_or_none(value) is expected


def test_image_prompt_with_theme_formats_prompt():
    p = ImagePrompt(prompt="lake", theme_prompt="muted colors")
    assert p.get_image_prompt(with_theme=False) == "lake"
    assert p.get_image_prompt(with_theme=True) == "lake, muted colors"


@pytest.mark.parametrize(
    ("exc", "status", "substr"),
    [
        (HTTPException(status_code=418, detail="teapot"), 418, "teapot"),
        (RuntimeError("boom"), 500, "boom"),
    ],
)
def test_api_error_model_from_exception(exc: Exception, status: int, substr: str):
    model = APIErrorModel.from_exception(exc)
    assert model.status_code == status
    assert substr in model.detail


def test_slide_model_get_new_slide_branches():
    pid = uuid.uuid4()
    base = SlideModel(
        presentation=pid,
        layout_group="g",
        layout="l",
        index=2,
        content={"a": 1},
        speaker_note="n",
        properties={"x": True},
    )
    assert base.get_new_slide(pid, None).content == {"a": 1}
    assert base.get_new_slide(pid, {"b": 2}).content == {"b": 2}


def test_sse_response_frame_format():
    raw = SSEResponse(event="evt", data="{}").to_string()
    assert raw == "event: evt\ndata: {}\n\n"


def test_sse_typed_frames_encode_json_payloads():
    event, data = _parse_sse_frame(SSEStatusResponse(status="ok").to_string())
    assert event == "response"
    assert data == {"type": "status", "status": "ok"}

    event, data = _parse_sse_frame(SSETraceResponse(trace={"x": 1}).to_string())
    assert event == "response"
    assert data == {"type": "trace", "trace": {"x": 1}}

    event, data = _parse_sse_frame(SSEErrorResponse(detail="bad").to_string())
    assert event == "response"
    assert data == {"type": "error", "detail": "bad"}

    event, data = _parse_sse_frame(
        SSECompleteResponse(key="k", value={"v": 1}).to_string()
    )
    assert event == "response"
    assert data == {"type": "complete", "k": {"v": 1}}


@pytest.mark.parametrize("theme", [{}, None])
def test_presentation_model_get_new_and_typed_getters(theme):
    outline, layout_payload, structure_payload = _outline_layout_structure_payloads()
    p = PresentationModel(
        id=uuid.uuid4(),
        content="c",
        n_slides=1,
        language="English",
        title="Title",
        outlines=outline,
        layout=layout_payload,
        structure=structure_payload,
        theme=theme,
    )
    assert p.get_new_presentation().content == "c"
    assert isinstance(p.get_presentation_outline(), PresentationOutlineModel)
    assert isinstance(p.get_layout(), PresentationLayoutModel)
    assert isinstance(p.get_structure(), PresentationStructureModel)


def test_presentation_model_set_layout_updates_stored_dict():
    _, layout_payload, _ = _outline_layout_structure_payloads()
    p = PresentationModel(
        id=uuid.uuid4(),
        content="c",
        n_slides=1,
        language="English",
        title="Title",
        outlines=None,
        layout=layout_payload,
        structure=None,
    )
    refreshed_layout = PresentationLayoutModel(
        name="n3",
        ordered=False,
        slides=[SlideLayoutModel(id="q", json_schema={"title": "t3"})],
    )
    p.set_layout(refreshed_layout)
    assert p.layout["name"] == "n3"


def test_presentation_model_missing_outline_and_structure_returns_none():
    ghost = PresentationModel(
        id=uuid.uuid4(),
        content="c",
        n_slides=0,
        language="English",
        outlines=None,
        layout=None,
        structure=None,
    )
    assert ghost.get_presentation_outline() is None
    assert ghost.get_structure() is None


def test_presentation_model_set_structure_updates_slides():
    _, _, structure_payload = _outline_layout_structure_payloads()
    p = PresentationModel(
        id=uuid.uuid4(),
        content="c",
        n_slides=1,
        language="English",
        title="Title",
        outlines=None,
        layout=None,
        structure=structure_payload,
    )
    p.set_structure(PresentationStructureModel(slides=[0, 1]))
    assert p.structure["slides"] == [0, 1]


def test_chat_conversation_store_ensure_conversation_id():
    store = ChatConversationStore(sql_session=None)  # type: ignore[arg-type]
    nid = asyncio.run(store.ensure_conversation_id(None))
    assert isinstance(nid, uuid.UUID)
    cid = uuid.uuid4()
    assert asyncio.run(store.ensure_conversation_id(cid)) == cid


def test_get_resource_path_resolves_under_cwd(monkeypatch, tmp_path):
    monkeypatch.chdir(tmp_path)
    resolved = get_resource_path("static/a.txt")
    assert resolved == os.path.abspath(os.path.join(str(tmp_path), "static/a.txt"))


def test_get_writable_path_app_data_fallback(monkeypatch, tmp_path):
    monkeypatch.chdir(tmp_path)

    monkeypatch.delenv("APP_DATA_DIRECTORY", raising=False)
    base = tmp_path / "appdata"
    base.mkdir()
    monkeypatch.setenv("APP_DATA_DIRECTORY", str(base))
    ad_path = get_writable_path("nested/dir")
    assert os.path.abspath(ad_path).startswith(os.path.abspath(str(base)))

    monkeypatch.delenv("APP_DATA_DIRECTORY", raising=False)
    cwd_path = get_writable_path("other/dir")
    assert cwd_path.startswith(os.path.abspath(str(tmp_path)))


@pytest.mark.parametrize(
    ("env_provider", "predicate"),
    [
        ("pexels", is_pixels_selected),
        ("pixabay", is_pixabay_selected),
        ("gemini_flash", is_gemini_flash_selected),
        ("nanobanana_pro", is_nanobanana_pro_selected),
        ("dall-e-3", is_dalle3_selected),
        ("gpt-image-1.5", is_gpt_image_1_5_selected),
        ("comfyui", is_comfyui_selected),
        ("open_webui", is_open_webui_selected),
    ],
)
def test_image_provider_env_flags_exclusive(monkeypatch, env_provider: str, predicate):
    monkeypatch.setenv("IMAGE_PROVIDER", env_provider)
    assert predicate() is True
    for other in _ALL_IMAGE_PROVIDER_PREDICATES:
        if other is not predicate:
            assert other() is False


def test_get_selected_image_provider_none(monkeypatch):
    monkeypatch.delenv("IMAGE_PROVIDER", raising=False)
    assert get_selected_image_provider() is None


def test_get_selected_image_provider_invalid_env_raises(monkeypatch):
    monkeypatch.setenv("IMAGE_PROVIDER", "not-a-real-provider")
    with pytest.raises(ValueError):
        get_selected_image_provider()


def test_dynamic_outline_and_structure_factories_validate():
    long_text = "x" * 100
    OutlineCls = get_presentation_outline_model_with_n_slides(1)
    outline = OutlineCls(slides=[{"content": long_text}])

    StructureCls = get_presentation_structure_model_with_n_slides(3)
    structure = StructureCls(slides=[0, 1, 2])

    assert outline.slides[0].content == long_text
    assert structure.slides == [0, 1, 2]


@pytest.mark.parametrize(
    ("language", "code"),
    [
        ("English", "eng"),
        ("english", "eng"),
        (None, "eng"),
        ("   ", "eng"),
        ("Hausa (Hausa)", "hau"),
    ],
)
def test_presentation_language_to_ocr_resolution(language: str | None, code: str):
    assert ocr_language.presentation_language_to_ocr_code(language) == code


def test_presentation_language_invalid_code_fallback(monkeypatch):
    monkeypatch.setitem(
        ocr_language.PRESENTATION_LANGUAGE_TO_TESSERACT,
        "__bad_lang__",
        "not valid!",
    )
    assert ocr_language.presentation_language_to_ocr_code("__bad_lang__") == "eng"


def test_handle_llm_client_exceptions(monkeypatch):
    monkeypatch.setattr(
        handle_llm_client_exceptions.__globals__["traceback"],
        "print_exc",
        lambda: None,
    )
    assert (
        handle_llm_client_exceptions(HTTPException(status_code=401, detail="auth")).detail
        == "auth"
    )

    from google.genai.errors import APIError as GoogleAPIError
    from llmai.shared.errors import BaseError as LLMAIBaseError

    llmai_err = LLMAIBaseError(status_code=429, message="busy")
    assert handle_llm_client_exceptions(llmai_err).detail == "busy"

    assert "OpenAI API request failed" in handle_llm_client_exceptions(
        OpenAIAPIError(
            message="boom",
            request=httpx.Request("POST", "https://x"),
            body=None,
        )
    ).detail

    assert "Google API error" in handle_llm_client_exceptions(
        GoogleAPIError(503, {})
    ).detail

    generic = handle_llm_client_exceptions(ValueError("oops"))
    assert generic.detail.startswith("LLM API error")


def test_concurrent_service_runs_tasks(monkeypatch):
    mock_sleep = AsyncMock()
    monkeypatch.setattr(asyncio, "sleep", mock_sleep)

    svc = ConcurrentService()
    touched = []

    async def work():
        touched.append(1)

    async def runner():
        svc.run_task(None, work)
        svc.run_task(3, work)
        await asyncio.gather(*list(svc._background_tasks))

    asyncio.run(runner())
    assert len(touched) == 2
    mock_sleep.assert_awaited_once_with(3)


def test_export_includes_optional_fastapi_param():
    async def runner():
        fake_result = MagicMock(path="/exports/deck.pdf")
        dummy = uuid.uuid4()
        mock_pdf = AsyncMock(return_value=fake_result)
        with patch.dict(
            os.environ,
            {
                "NEXT_PUBLIC_URL": "https://next.example",
                "NEXT_PUBLIC_FAST_API": "https://fast.example",
            },
            clear=False,
        ), patch.object(EXPORT_TASK_SERVICE, "export_from_url", mock_pdf):
            await export_presentation(
                dummy,
                title="safe",
                export_as="pdf",
                cookie_header="presenton_session=abc; theme=dark",
            )

        pdf_call = mock_pdf.await_args.kwargs
        assert "pdf-maker" in pdf_call["url"]
        assert (
            "#exportCookie=presenton_session%3Dabc%3B+theme%3Ddark"
            in pdf_call["url"]
        )
        assert pdf_call["fastapi_url"] == "https://fast.example"
        assert pdf_call["cookie_header"] == "presenton_session=abc; theme=dark"

        mock_pptx = AsyncMock(return_value=fake_result)
        with patch.dict(
            os.environ, {"NEXT_PUBLIC_FAST_API": ""}, clear=False
        ), patch.object(EXPORT_TASK_SERVICE, "export_from_url", mock_pptx):
            await export_presentation(dummy, title="two", export_as="pptx")
        pptx_call = mock_pptx.await_args.kwargs
        assert "#" not in pptx_call["url"]
        assert pptx_call["fastapi_url"] is None

    asyncio.run(runner())


def test_export_task_output_permissions_are_readable(tmp_path):
    export_dir = tmp_path / "exports"
    export_dir.mkdir(mode=0o700)
    output_path = export_dir / "deck.pptx"
    output_path.write_bytes(b"pptx")
    os.chmod(export_dir, 0o700)
    os.chmod(output_path, 0o600)

    EXPORT_TASK_SERVICE._ensure_output_readable(str(output_path))

    assert stat.S_IMODE(export_dir.stat().st_mode) == 0o755
    assert stat.S_IMODE(output_path.stat().st_mode) == 0o644


def test_replace_and_extension_helpers():
    assert replace_file_name("deck.pptx", "outline") == "outline.pptx"
    assert replace_file_name("readme", "out") == "out"
    replaced = replace_file_name("note.txt", "fixed")
    assert replaced == "fixed.txt"
    randomized = replace_file_name("note.txt", f"note----{uuid.uuid4()}")
    assert randomized.endswith(".txt") and "----" in randomized
    assert (
        get_original_file_name(os.path.join("ignored", randomized)) == "note.txt"
    )


def test_get_file_ext_or_none():
    assert get_file_ext_or_none("photo.PNG") == ".PNG"
    assert get_file_ext_or_none("readme") == ""


def test_get_file_ext_or_none_truncated_extension_tuple(monkeypatch):
    monkeypatch.setattr(os.path, "splitext", lambda _: ("base",))
    assert get_file_ext_or_none("base") is None


def test_set_file_ext_monkey_patch():
    assert set_file_ext("/tmp/with.txt", ".md").endswith(".md")
    assert set_file_ext("/tmp/plain", ".md").endswith(".md")


def test_get_file_name_with_random_uuid_variants():
    from starlette.datastructures import UploadFile as StarletteUploadFile

    upload_like = StarletteUploadFile(filename="slide.png", file=io.BytesIO(b"x"))
    out_upload = get_file_name_with_random_uuid(upload_like)
    assert out_upload.endswith(".png") and "----" in out_upload

    disk_path_out = get_file_name_with_random_uuid("/tmp/report.pdf")
    assert disk_path_out.endswith(".pdf") and "----" in disk_path_out

    assert "----" in get_file_name_with_random_uuid(io.BytesIO(b"z"))


def test_presentation_layout_model_surface():
    layout = PresentationLayoutModel(
        name="demo",
        slides=[
            SlideLayoutModel(id="sid", json_schema={"title": "From schema"}, description="d"),
        ],
    )
    assert "From schema" in layout.to_string()
    with_schema = layout.to_string(with_schema=True)
    assert '"title": "From schema"' in with_schema
    assert layout.to_presentation_structure().slides == [0]
    assert layout.get_slide_layout_index("sid") == 0
    with pytest.raises(HTTPException):
        layout.get_slide_layout_index("missing")


def _make_aio_layout_session(resp: AsyncMock):
    sess = MagicMock()
    getter = MagicMock()
    getter.__aenter__ = AsyncMock(return_value=resp)
    getter.__aexit__ = AsyncMock(return_value=None)
    sess.get = MagicMock(return_value=getter)
    sess.__aenter__ = AsyncMock(return_value=sess)
    sess.__aexit__ = AsyncMock(return_value=None)
    return sess


def test_get_layout_by_name_returns_model():
    resp = AsyncMock()
    resp.status = 200
    resp.json = AsyncMock(
        return_value={
            "name": "grp",
            "ordered": False,
            "slides": [{"id": "layout", "json_schema": {"title": "t"}}],
        }
    )

    async def runner():
        with patch(
            "utils.internal_http.get_configured_auth_username",
            return_value="",
        ), patch(
            "utils.internal_http.create_session_token",
            return_value="cookie",
        ), patch(
            "templates.get_layout_by_name.aiohttp.ClientSession",
            return_value=_make_aio_layout_session(resp),
        ):
            layout = await tpl_layout_fetcher.get_layout_by_name("deck")
            assert isinstance(layout, PresentationLayoutModel)

    asyncio.run(runner())


def test_get_layout_by_name_raises_on_http_failure():
    resp = AsyncMock()
    resp.status = 500
    resp.text = AsyncMock(return_value="down")

    async def runner():
        with patch(
            "utils.internal_http.get_configured_auth_username",
            return_value="",
        ), patch(
            "templates.get_layout_by_name.aiohttp.ClientSession",
            return_value=_make_aio_layout_session(resp),
        ):
            with pytest.raises(HTTPException):
                await tpl_layout_fetcher.get_layout_by_name("missing")

    asyncio.run(runner())


def test_get_layout_by_name_attach_auth_cookie(monkeypatch):
    resp = AsyncMock()
    resp.status = 200
    resp.json = AsyncMock(
        return_value={
            "name": "grp",
            "ordered": False,
            "slides": [{"id": "layout", "json_schema": {"title": "t"}}],
        }
    )

    captured: dict[str, str | None] = {}

    monkeypatch.setattr(
        "utils.internal_http.get_configured_auth_username", lambda: "user"
    )
    monkeypatch.setattr(
        "utils.internal_http.create_session_token", lambda _u: "tok123"
    )
    monkeypatch.setattr("utils.internal_http.SESSION_COOKIE_NAME", "sess")

    def capture_session(*_a, **_k):
        sess = MagicMock()

        def _get(url, *, headers=None, **_kw):
            captured.update(headers or {})
            inner = MagicMock()
            inner.__aenter__ = AsyncMock(return_value=resp)
            inner.__aexit__ = AsyncMock(return_value=None)
            return inner

        sess.get = MagicMock(side_effect=_get)
        sess.__aenter__ = AsyncMock(return_value=sess)
        sess.__aexit__ = AsyncMock(return_value=None)
        return sess

    async def runner():
        with patch("templates.get_layout_by_name.aiohttp.ClientSession", side_effect=capture_session):
            layout = await tpl_layout_fetcher.get_layout_by_name("deck")
            assert isinstance(layout, PresentationLayoutModel)

    asyncio.run(runner())
    cookie = captured.get("Cookie", "")
    assert "sess=tok123" in cookie


@pytest.mark.parametrize(
    "raw",
    ["true", "TRUE", "TrUe"],
)
def test_is_image_generation_disabled_truthy(monkeypatch, raw: str):
    monkeypatch.setenv("DISABLE_IMAGE_GENERATION", raw)
    assert is_image_generation_disabled() is True


@pytest.mark.parametrize(
    "raw",
    [None, "", "false", "0", "maybe"],
)
def test_is_image_generation_disabled_falsey(monkeypatch, raw: str | None):
    if raw is None:
        monkeypatch.delenv("DISABLE_IMAGE_GENERATION", raising=False)
    else:
        monkeypatch.setenv("DISABLE_IMAGE_GENERATION", raw)
    assert is_image_generation_disabled() is False
