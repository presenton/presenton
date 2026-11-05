from typing import Annotated, List
from fastapi import APIRouter, Body

from utils.provider_errors import normalize_provider_error

from utils.available_models import (
    list_available_openai_compatible_models,
)

OPENAI_ROUTER = APIRouter(prefix="/openai", tags=["OpenAI"])


@OPENAI_ROUTER.post("/models/available", response_model=List[str])
async def get_available_models(
    url: Annotated[str, Body()],
    api_key: Annotated[str, Body()],
):
    try:
        return await list_available_openai_compatible_models(url, api_key)
    except Exception as e:
        raise normalize_provider_error(e, provider="OpenAI-compatible provider") from e
