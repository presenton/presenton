from fastapi import APIRouter
from llmai import GenerationDefaults, GenerationProfile, get_model_capabilities
from llmai.shared.generation import prepare_generation
from pydantic import BaseModel, Field


GENERATION_ROUTER = APIRouter(prefix="/generation", tags=["Generation"])

PROVIDER_ALIASES = {
    "codex": "chatgpt",
    "custom": "openai",
    "ollama": "openai",
    "together": "togetherai",
}


class GenerationDefaultsRequest(BaseModel):
    provider: str = Field(min_length=1, max_length=40)
    model: str = Field(default="", max_length=300)


class GenerationTokenDefaults(BaseModel):
    default_max_output_tokens: int
    model_max_output_tokens: int


def resolve_generation_token_defaults(
    provider: str,
    model: str,
) -> GenerationTokenDefaults:
    provider_key = provider.strip().lower()
    normalized_provider = PROVIDER_ALIASES.get(provider_key, provider_key)
    normalized_model = model.strip() or "unknown-model"
    capabilities = get_model_capabilities(
        normalized_model,
        provider=normalized_provider,
    )

    def resolve(profile: GenerationProfile) -> int:
        prepared = prepare_generation(
            model=normalized_model,
            provider=normalized_provider,
            defaults=GenerationDefaults(profile=profile),
            capabilities=capabilities,
        )
        return prepared.max_output_tokens

    return GenerationTokenDefaults(
        default_max_output_tokens=resolve(GenerationProfile.BALANCED),
        model_max_output_tokens=resolve(GenerationProfile.MODEL_MAX),
    )


@GENERATION_ROUTER.post("/defaults", response_model=GenerationTokenDefaults)
def get_generation_token_defaults(
    request: GenerationDefaultsRequest,
) -> GenerationTokenDefaults:
    return resolve_generation_token_defaults(request.provider, request.model)
