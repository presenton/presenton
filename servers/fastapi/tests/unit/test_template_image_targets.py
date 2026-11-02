import base64
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch
import uuid

import httpx
import pytest
from openai import BadRequestError
from PIL import Image

from api.v1.ppt.endpoints.presentation import _apply_template_content_to_ui
from models.image_prompt import ImagePrompt
from models.sql.slide import SlideModel
from services.chat.memory_layer import PresentationChatMemoryLayer
from services.image_generation_service import (
    ImageGenerationService,
    _desired_image_size,
    _gemini_image_aspect_ratio,
    _openai_image_size,
)
from utils.process_slides import (
    image_target_sizes_from_template,
    process_slide_and_fetch_assets,
)


def test_image_target_sizes_match_slots_with_identical_prompts():
    layout = {
        "components": [{
            "id": "hero",
            "elements": [
                {"type": "image", "name": "wide", "decorative": False,
                 "size": {"width": 400, "height": 200}},
                {"type": "image", "name": "tall", "decorative": False,
                 "size": {"width": 100, "height": 300}},
            ],
        }],
    }
    content = {"hero": {
        "wide": {"image_prompt": "same prompt"},
        "tall": {"image_prompt": "same prompt"},
    }}

    sizes = image_target_sizes_from_template(
        layout, content, _apply_template_content_to_ui
    )

    assert sizes[(('key', 'hero'), ('key', 'wide'))] == (400, 200)
    assert sizes[(('key', 'hero'), ('key', 'tall'))] == (100, 300)
    assert "image_url" not in content["hero"]["wide"]


def test_chat_hydration_matches_repeated_image_slots():
    layout = {"components": [{"id": "gallery", "elements": [{
        "type": "grid", "name": "photos", "children": [
            {"type": "image", "name": "photo", "decorative": False,
             "size": {"width": 300, "height": 150}}
        ],
    }]}]}
    content = {"gallery": {"photos": [
        {"image_prompt": "same"}, {"image_prompt": "same"},
    ]}}

    sizes = image_target_sizes_from_template(
        layout, content, PresentationChatMemoryLayer._apply_template_content_to_ui
    )

    assert sizes[(('key', 'gallery'), ('key', 'photos'), ('index', 0))] == (300, 150)
    assert sizes[(('key', 'gallery'), ('key', 'photos'), ('index', 1))] == (300, 150)


@pytest.mark.anyio
async def test_asset_generation_receives_target_size_and_missing_size_falls_back():
    service = AsyncMock()
    service.generate_image.side_effect = [
        "https://example.com/wide.png", "https://example.com/square.png"
    ]
    slide = SlideModel(
        presentation=uuid.uuid4(), layout_group="test", layout="test", index=0,
        content={"first": {"image_prompt": "wide"}, "second": {"image_prompt": "default"}},
    )
    sizes = {(('key', 'first'),): (400, 200)}

    await process_slide_and_fetch_assets(service, slide, image_target_sizes=sizes)

    requests = [call.args[0] for call in service.generate_image.await_args_list]
    assert [request.target_size for request in requests] == [(400, 200), None]


def test_desired_image_size_for_prompt_and_log():
    assert _desired_image_size(None) == "unspecified"
    assert _desired_image_size((500, 300)) == "500x300"
    assert _desired_image_size((1017.57, 997.22)) == "1018x997"
    assert ImagePrompt(prompt="default").target_size is None


@pytest.mark.anyio
async def test_service_passes_dimensions_without_changing_ai_prompt():
    service = object.__new__(ImageGenerationService)
    service.output_directory = "/tmp"
    service.is_image_generation_disabled = False
    service.is_stock_provider_selected = lambda: False
    service.image_gen_func = AsyncMock(return_value="https://example.com/generated.png")

    with patch("services.image_generation_service.is_comfyui_selected", return_value=False):
        await service.generate_image(
            ImagePrompt(
                prompt="wide", theme_prompt="muted colors",
                target_width=400, target_height=200,
            )
        )
    assert service.image_gen_func.await_args.args == (
        "wide, muted colors",
        "/tmp",
    )
    assert service.image_gen_func.await_args.kwargs == {"target_size": (400, 200)}

    await service.generate_image(ImagePrompt(prompt="default", theme_prompt="muted colors"))
    assert service.image_gen_func.await_args.args == ("default, muted colors", "/tmp")
    assert service.image_gen_func.await_args.kwargs == {}


@pytest.mark.anyio
async def test_service_passes_dimensions_to_comfyui_workflow_only():
    service = object.__new__(ImageGenerationService)
    service.output_directory = "/tmp"
    service.is_image_generation_disabled = False
    service.is_stock_provider_selected = lambda: False
    service.image_gen_func = AsyncMock(return_value="https://example.com/generated.png")

    with patch("services.image_generation_service.is_comfyui_selected", return_value=True):
        await service.generate_image(
            ImagePrompt(
                prompt="wide", theme_prompt="muted colors",
                target_width=400, target_height=200,
            )
        )

    assert service.image_gen_func.await_args.args == ("wide, muted colors", "/tmp")
    assert service.image_gen_func.await_args.kwargs == {"target_size": (400, 200)}


@pytest.mark.anyio
async def test_stock_image_search_keeps_original_query():
    service = object.__new__(ImageGenerationService)
    service.output_directory = "/tmp"
    service.is_image_generation_disabled = False
    service.is_stock_provider_selected = lambda: True
    service.image_gen_func = AsyncMock(return_value="https://example.com/photo.png")

    await service.generate_image(
        ImagePrompt(
            prompt="mountain lake", theme_prompt="muted colors",
            target_width=400, target_height=200,
        )
    )

    assert service.image_gen_func.await_args.args == ("mountain lake",)
    assert service.image_gen_func.await_args.kwargs == {}


@pytest.mark.anyio
@pytest.mark.parametrize(
    ("model", "target_size", "expected"),
    [
        ("gpt-image-2.5-flare", None, "1024x1024"),
        ("gpt-image-2.5-flare", (1200, 1100), "1024x1024"),
        ("gpt-image-2.5-flare", (1600, 900), "1536x1024"),
        ("gpt-image-2.5-flare", (900, 1600), "1024x1536"),
        ("gpt-image-2.5-sunburst", (1600, 900), "1536x1024"),
        ("gpt-image-2.5-sunburst", (900, 1600), "1024x1536"),
        ("gpt-image-2", (1600, 900), "1536x1024"),
        ("gpt-image-2", (900, 1600), "1024x1536"),
        ("custom-model", (1600, 900), "1024x1024"),
    ],
)
def test_openai_size_uses_closest_supported_shape(model, target_size, expected):
    assert _openai_image_size(model, target_size) == expected


@pytest.mark.parametrize(
    ("target_size", "expected"),
    [
        (None, None),
        ((1000, 1000), "1:1"),
        ((1600, 900), "16:9"),
        ((900, 1600), "9:16"),
        ((500, 400), "5:4"),
        ((400, 500), "4:5"),
        ((2100, 900), "21:9"),
    ],
)
def test_gemini_aspect_ratio_uses_closest_supported_shape(target_size, expected):
    assert _gemini_image_aspect_ratio(target_size) == expected


@pytest.mark.anyio
async def test_openai_provider_sends_mapped_api_size(tmp_path):
    service = ImageGenerationService(str(tmp_path))
    client = SimpleNamespace(images=SimpleNamespace(generate=AsyncMock(
        return_value=SimpleNamespace(data=[SimpleNamespace(
            b64_json=base64.b64encode(b"image").decode()
        )])
    )))
    with patch("services.image_generation_service.AsyncOpenAI", return_value=client):
        await service.generate_image_openai(
            "landscape", str(tmp_path), "gpt-image-2", "medium", (1600, 900)
        )
        assert client.images.generate.await_args.kwargs["size"] == "1536x1024"
        assert client.images.generate.await_args.kwargs["prompt"] == "landscape"
        assert client.images.generate.await_count == 1


@pytest.mark.anyio
async def test_openai_provider_retries_square_if_supported_size_is_rejected(tmp_path):
    rejected_size = BadRequestError(
        "Unsupported size",
        response=httpx.Response(
            400, request=httpx.Request("POST", "https://example.com/images/generations")
        ),
        body=None,
    )
    result = SimpleNamespace(
        data=[SimpleNamespace(b64_json=base64.b64encode(b"image").decode())]
    )
    client = SimpleNamespace(
        images=SimpleNamespace(generate=AsyncMock(side_effect=[rejected_size, result]))
    )
    service = ImageGenerationService(str(tmp_path))

    with patch("services.image_generation_service.AsyncOpenAI", return_value=client):
        await service.generate_image_openai(
            "landscape", str(tmp_path), "gpt-image-2.5-flare", "medium", (1600, 900)
        )

    assert [call.kwargs["size"] for call in client.images.generate.await_args_list] == [
        "1536x1024", "1024x1024"
    ]


@pytest.mark.anyio
async def test_openai_compatible_known_model_sends_mapped_size(tmp_path):
    service = ImageGenerationService(str(tmp_path))
    result = SimpleNamespace(data=[SimpleNamespace(
        b64_json=base64.b64encode(b"image").decode(), url=None
    )])
    client = SimpleNamespace(images=SimpleNamespace(generate=AsyncMock(return_value=result)))

    with patch(
        "services.image_generation_service.get_openai_compat_image_base_url_env",
        return_value="https://example.com/v1",
    ), patch(
        "services.image_generation_service.get_openai_compat_image_api_key_env",
        return_value="test-key",
    ), patch(
        "services.image_generation_service.get_openai_compat_image_model_env",
        return_value="gpt-image-2.5-flare",
    ), patch("services.image_generation_service.AsyncOpenAI", return_value=client):
        await service.generate_image_openai_compatible(
            "landscape", str(tmp_path), (1600, 900)
        )

    assert client.images.generate.await_args.kwargs["size"] == "1536x1024"


@pytest.mark.anyio
@pytest.mark.parametrize(
    ("provider_method", "model"),
    [
        ("generate_image_gemini_flash", "gemini-3.1-flash-image"),
        ("generate_image_nanobanana_pro", "gemini-3-pro-image"),
    ],
)
async def test_gemini_provider_sends_mapped_aspect_ratio(
    tmp_path, provider_method, model
):
    service = ImageGenerationService(str(tmp_path))
    image = SimpleNamespace(save=lambda path: Path(path).write_bytes(b"image"))
    part = SimpleNamespace(
        inline_data=SimpleNamespace(mime_type="image/png"),
        as_image=lambda: image,
    )
    response = SimpleNamespace(parts=[part])
    client = SimpleNamespace(models=SimpleNamespace(generate_content=object()))

    with patch("services.image_generation_service.genai.Client", return_value=client), patch(
        "services.image_generation_service.asyncio.to_thread",
        new=AsyncMock(return_value=response),
    ) as thread:
        await getattr(service, provider_method)(
            "landscape", str(tmp_path), (1600, 900)
        )

    kwargs = thread.await_args.kwargs
    assert kwargs["model"] == model
    assert kwargs["contents"] == "landscape"
    assert kwargs["config"].image_config.aspect_ratio == "16:9"


@pytest.mark.anyio
async def test_generated_image_is_not_resized_after_provider_returns(tmp_path):
    image_path = tmp_path / "generated.png"
    Image.new("RGB", (1024, 1024), "red").save(image_path)
    service = object.__new__(ImageGenerationService)
    service.output_directory = str(tmp_path)
    service.is_image_generation_disabled = False
    service.is_stock_provider_selected = lambda: False
    service.image_gen_func = AsyncMock(return_value=str(image_path))

    await service.generate_image(
        ImagePrompt(prompt="banner", target_width=400, target_height=200)
    )

    with Image.open(image_path) as result:
        assert result.size == (1024, 1024)
