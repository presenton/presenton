from fastapi import HTTPException
from google import genai
from openai import OpenAI

from constants.llm import (
    DEFAULT_ANTHROPIC_MODEL,
    DEFAULT_AZURE_MODEL,
    DEFAULT_BEDROCK_MODEL,
    DEFAULT_CEREBRAS_MODEL,
    DEFAULT_CODEX_MODEL,
    DEFAULT_DEEPSEEK_MODEL,
    DEFAULT_FIREWORKS_MODEL,
    DEFAULT_LITELLM_MODEL,
    DEFAULT_GOOGLE_MODEL,
    DEFAULT_LMSTUDIO_MODEL,
    DEFAULT_OPENAI_MODEL,
    DEFAULT_OPENROUTER_MODEL,
    DEFAULT_TOGETHER_MODEL,
    DEFAULT_VERTEX_MODEL,
    SUPPORTED_CODEX_MODELS,
)
from enums.llm_provider import LLMProvider
from utils.get_env import (
    get_azure_openai_deployment_env,
    get_azure_openai_model_env,
    get_anthropic_model_env,
    get_bedrock_model_env,
    get_codex_model_env,
    get_custom_model_env,
    get_deepseek_model_env,
    get_fireworks_model_env,
    get_google_api_key_env,
    get_google_model_env,
    get_litellm_model_env,
    get_lmstudio_model_env,
    get_llm_provider_env,
    get_ollama_model_env,
    get_openai_api_key_env,
    get_openai_model_env,
    get_cerebras_model_env,
    get_openrouter_model_env,
    get_together_model_env,
    get_vertex_model_env,
)


def get_llm_provider():
    try:
        return LLMProvider(get_llm_provider_env())
    except:
        raise HTTPException(
            status_code=500,
            detail=(
                "Invalid LLM provider. Please select one of: "
                "openai, deepseek, google, vertex, azure, bedrock, openrouter, "
                "fireworks, together, cerebras, anthropic, litellm, "
                "lmstudio, ollama, custom, codex"
            ),
        )


def is_openai_selected():
    return get_llm_provider() == LLMProvider.OPENAI


def is_deepseek_selected():
    return get_llm_provider() == LLMProvider.DEEPSEEK


def is_google_selected():
    return get_llm_provider() == LLMProvider.GOOGLE


def is_anthropic_selected():
    return get_llm_provider() == LLMProvider.ANTHROPIC


def is_vertex_selected():
    return get_llm_provider() == LLMProvider.VERTEX


def is_azure_selected():
    return get_llm_provider() == LLMProvider.AZURE


def is_bedrock_selected():
    return get_llm_provider() == LLMProvider.BEDROCK


def is_ollama_selected():
    return get_llm_provider() == LLMProvider.OLLAMA


def is_custom_llm_selected():
    return get_llm_provider() == LLMProvider.CUSTOM


def is_cerebras_selected():
    return get_llm_provider() == LLMProvider.CEREBRAS


def is_openrouter_selected():
    return get_llm_provider() == LLMProvider.OPENROUTER


def is_fireworks_selected():
    return get_llm_provider() == LLMProvider.FIREWORKS


def is_together_selected():
    return get_llm_provider() == LLMProvider.TOGETHER


def is_codex_selected():
    return get_llm_provider() == LLMProvider.CODEX


def is_litellm_selected():
    return get_llm_provider() == LLMProvider.LITELLM


def is_lmstudio_selected():
    return get_llm_provider() == LLMProvider.LMSTUDIO


def get_model():
    selected_llm = get_llm_provider()
    if selected_llm == LLMProvider.OPENAI:
        return get_openai_model_env() or DEFAULT_OPENAI_MODEL
    elif selected_llm == LLMProvider.DEEPSEEK:
        return get_deepseek_model_env() or DEFAULT_DEEPSEEK_MODEL
    elif selected_llm == LLMProvider.GOOGLE:
        return get_google_model_env() or DEFAULT_GOOGLE_MODEL
    elif selected_llm == LLMProvider.VERTEX:
        return get_vertex_model_env() or DEFAULT_VERTEX_MODEL
    elif selected_llm == LLMProvider.AZURE:
        return (
            get_azure_openai_model_env()
            or get_azure_openai_deployment_env()
            or DEFAULT_AZURE_MODEL
        )
    elif selected_llm == LLMProvider.BEDROCK:
        return get_bedrock_model_env() or DEFAULT_BEDROCK_MODEL
    elif selected_llm == LLMProvider.OPENROUTER:
        return get_openrouter_model_env() or DEFAULT_OPENROUTER_MODEL
    elif selected_llm == LLMProvider.FIREWORKS:
        return get_fireworks_model_env() or DEFAULT_FIREWORKS_MODEL
    elif selected_llm == LLMProvider.TOGETHER:
        return get_together_model_env() or DEFAULT_TOGETHER_MODEL
    elif selected_llm == LLMProvider.CEREBRAS:
        return get_cerebras_model_env() or DEFAULT_CEREBRAS_MODEL
    elif selected_llm == LLMProvider.ANTHROPIC:
        return get_anthropic_model_env() or DEFAULT_ANTHROPIC_MODEL
    elif selected_llm == LLMProvider.OLLAMA:
        return get_ollama_model_env()
    elif selected_llm == LLMProvider.CUSTOM:
        return get_custom_model_env()
    elif selected_llm == LLMProvider.LITELLM:
        return get_litellm_model_env() or DEFAULT_LITELLM_MODEL
    elif selected_llm == LLMProvider.LMSTUDIO:
        return get_lmstudio_model_env() or DEFAULT_LMSTUDIO_MODEL
    elif selected_llm == LLMProvider.CODEX:
        codex_model = get_codex_model_env()
        return codex_model if codex_model in SUPPORTED_CODEX_MODELS else DEFAULT_CODEX_MODEL
    else:
        raise HTTPException(
            status_code=500,
            detail=(
                "Invalid LLM provider. Please select one of: "
                "openai, deepseek, google, vertex, azure, bedrock, openrouter, "
                "fireworks, together, cerebras, anthropic, litellm, "
                "lmstudio, ollama, custom, codex"
            ),
        )


def get_google_llm_client() -> genai.Client:
    """Google GenAI client for tests and direct API use (uses GOOGLE_API_KEY from env)."""
    if not get_google_api_key_env():
        raise HTTPException(status_code=400, detail="Google API Key is not set")
    return genai.Client()


def get_llm_client() -> OpenAI:
    """OpenAI client for tests and direct API use (uses OPENAI_API_KEY from env)."""
    if not get_openai_api_key_env():
        raise HTTPException(status_code=400, detail="OpenAI API Key is not set")
    return OpenAI()


def get_large_model() -> str:
    """Resolved model name for the configured LLM provider (same as runtime `get_model`)."""
    return get_model()
