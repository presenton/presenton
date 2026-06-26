import asyncio

import pytest
from fastapi import HTTPException

from api.v1.ppt.endpoints import anthropic as anthropic_endpoint
from api.v1.ppt.endpoints import google as google_endpoint
from api.v1.ppt.endpoints import openai as openai_endpoint
from utils.available_models import ModelAvailabilityError


def test_model_availability_error_maps_provider_client_errors_to_bad_request():
    error = ModelAvailabilityError(
        "OpenAI-compatible provider",
        "Incorrect API key provided.",
        provider_status_code=401,
    )

    assert error.status_code == 400
    assert "Incorrect API key provided." in str(error)


def test_model_availability_error_keeps_provider_server_errors_internal():
    error = ModelAvailabilityError(
        "OpenAI-compatible provider",
        "Provider unavailable.",
        provider_status_code=503,
    )

    assert error.status_code == 500


@pytest.mark.parametrize(
    ("endpoint_module", "list_function_name", "args"),
    [
        (
            openai_endpoint,
            "list_available_openai_compatible_models",
            ("https://api.openai.com/v1", "bad-key"),
        ),
        (google_endpoint, "list_available_google_models", ("bad-key",)),
        (anthropic_endpoint, "list_available_anthropic_models", ("bad-key",)),
    ],
)
def test_model_availability_endpoints_return_400_for_provider_validation_errors(
    monkeypatch, endpoint_module, list_function_name, args
):
    async def fail_model_validation(*_args):
        raise ModelAvailabilityError(
            "Provider",
            "Invalid API key.",
            provider_status_code=401,
        )

    monkeypatch.setattr(endpoint_module, list_function_name, fail_model_validation)

    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(endpoint_module.get_available_models(*args))

    assert exc_info.value.status_code == 400
    assert exc_info.value.detail == "Provider model validation failed: Invalid API key."
