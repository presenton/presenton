from typing import List

from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from constants.supported_ollama_models import get_supported_ollama_models
from models.ollama_model_metadata import OllamaModelMetadata
from models.ollama_model_status import OllamaModelStatus
from utils.ollama import list_available_ollama_models, pull_ollama_model, get_ollama_library_models

OLLAMA_ROUTER = APIRouter(prefix="/ollama", tags=["Ollama"])


@OLLAMA_ROUTER.get("/models/supported", response_model=List[OllamaModelMetadata])
async def get_supported_models():
    try:
        pulled_models = await list_available_ollama_models()
    except Exception:
        pulled_models = []

    return get_supported_ollama_models(pulled_models)
@OLLAMA_ROUTER.get("/models/available", response_model=List[OllamaModelStatus])
async def get_available_models(ollama_url: str | None = None):
    return await list_available_ollama_models(ollama_url)


@OLLAMA_ROUTER.get("/models/library")
async def get_library_models():
    return get_ollama_library_models()

@OLLAMA_ROUTER.post("/models/pull")
async def pull_model(model_name: str, ollama_url: str | None = None):
    await list_available_ollama_models(ollama_url)
    return StreamingResponse(
        pull_ollama_model(model_name, ollama_url),
        media_type="text/event-stream",
    )
