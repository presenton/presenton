import json
from unittest.mock import AsyncMock, patch

import pytest

from services.image_generation_service import ImageGenerationService


def test_comfyui_prompt_injection_uses_node_index_for_nested_nodes(tmp_path):
    service = ImageGenerationService(str(tmp_path))
    workflow = {
        "group": {
            "nodes": {
                1: {
                    "class_type": "Reroute",
                    "_meta": {"title": "Input Prompt"},
                    "inputs": {"prompt": [2, 0]},
                },
                2: {
                    "class_type": "PrimitiveNode",
                    "inputs": {"value": "old prompt"},
                },
            }
        }
    }

    service._inject_prompt_into_workflow(workflow, "new prompt")

    assert workflow["group"]["nodes"][2]["inputs"]["value"] == "new prompt"


def test_comfyui_seed_randomization_updates_common_seed_inputs(tmp_path):
    service = ImageGenerationService(str(tmp_path))
    workflow = {
        "1": {
            "class_type": "KSampler",
            "inputs": {
                "seed": 111,
                "steps": 20,
                "cfg": 8.0,
                "sampler_name": "euler",
            },
        },
        "2": {
            "class_type": "RandomNoise",
            "inputs": {
                "noise_seed": 222,
                "width": 1024,
                "height": 1024,
            },
        },
        "3": {
            "class_type": "KSamplerAdvanced",
            "inputs": {
                "noise_seed": "333",
                "start_at_step": 0,
                "end_at_step": 20,
            },
        },
        "4": {
            "class_type": "CustomSamplerWithVariations",
            "inputs": {
                "main_seed": 444,
                "variation_seed": 555,
                "seed_offset": 2,
            },
        },
    }

    with patch.object(
        service,
        "_generate_comfyui_seed",
        side_effect=[1001, 1002, 1003, 1004, 1005],
    ):
        assert service._inject_random_seeds_into_workflow(workflow) == 5

    assert workflow["1"]["inputs"]["seed"] == 1001
    assert workflow["2"]["inputs"]["noise_seed"] == 1002
    assert workflow["3"]["inputs"]["noise_seed"] == "1003"
    assert workflow["4"]["inputs"]["main_seed"] == 1004
    assert workflow["4"]["inputs"]["variation_seed"] == 1005

    assert workflow["1"]["inputs"]["steps"] == 20
    assert workflow["1"]["inputs"]["cfg"] == 8.0
    assert workflow["2"]["inputs"]["width"] == 1024
    assert workflow["4"]["inputs"]["seed_offset"] == 2


def test_comfyui_seed_randomization_updates_linked_seed_source(tmp_path):
    service = ImageGenerationService(str(tmp_path))
    workflow = {
        "1": {
            "class_type": "KSampler",
            "inputs": {
                "seed": ["99", 0],
                "steps": 20,
            },
        },
        "99": {
            "class_type": "PrimitiveNode",
            "inputs": {
                "value": 123,
            },
        },
        "100": {
            "class_type": "RandomInt",
            "inputs": {
                "min": 0,
                "max": 999,
            },
        },
    }

    with patch.object(service, "_generate_comfyui_seed", return_value=987654):
        assert service._inject_random_seeds_into_workflow(workflow) == 1

    assert workflow["1"]["inputs"]["seed"] == ["99", 0]
    assert workflow["99"]["inputs"]["value"] == 987654
    assert workflow["100"]["inputs"] == {"min": 0, "max": 999}


@pytest.mark.anyio
async def test_generate_image_comfyui_randomizes_seed_before_submit(tmp_path):
    workflow = {
        "1": {
            "class_type": "CLIPTextEncode",
            "_meta": {"title": "Input Prompt"},
            "inputs": {"text": "old prompt"},
        },
        "2": {
            "class_type": "KSampler",
            "inputs": {"seed": 123, "steps": 20},
        },
    }
    service = ImageGenerationService(str(tmp_path))
    submitted_workflow = {}

    async def fake_submit(_session, _comfyui_url, workflow_arg):
        submitted_workflow.update(workflow_arg)
        return "prompt-id"

    with patch(
        "services.image_generation_service.get_comfyui_url_env",
        return_value="http://comfy.example",
    ), patch(
        "services.image_generation_service.get_comfyui_workflow_env",
        return_value=json.dumps(workflow),
    ), patch.object(
        service, "_generate_comfyui_seed", return_value=42
    ), patch.object(
        service,
        "_submit_comfyui_workflow",
        new=AsyncMock(side_effect=fake_submit),
    ), patch.object(
        service,
        "_wait_for_comfyui_completion",
        new=AsyncMock(return_value={"prompt-id": {"outputs": {}}}),
    ), patch.object(
        service,
        "_download_comfyui_image",
        new=AsyncMock(return_value=str(tmp_path / "image.png")),
    ):
        image_path = await service.generate_image_comfyui(
            "new prompt", str(tmp_path)
        )

    assert image_path == str(tmp_path / "image.png")
    assert submitted_workflow["1"]["inputs"]["text"] == "new prompt"
    assert submitted_workflow["2"]["inputs"]["seed"] == 42
