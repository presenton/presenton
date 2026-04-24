from fastapi import HTTPException
from google import genai
from openai import OpenAI

from constants.llm import (
    DEFAULT_ANTHROPIC_MODEL,
    DEFAULT_CODEX_MODEL,
    DEFAULT_GOOGLE_MODEL,
    DEFAULT_OPENAI_MODEL,
)
from enums.llm_provider import LLMProvider
from utils.get_env import (
    get_anthropic_model_env,
    get_codex_model_env,
    get_custom_model_env,
    get_google_api_key_env,
    get_google_model_env,
    get_llm_provider_env,
    get_ollama_model_env,
    get_openai_api_key_env,
    get_openai_model_env,
)


def get_llm_provider():
    try:
        return LLMProvider(get_llm_provider_env())
    except:
        raise HTTPException(
            status_code=500,
            detail=f"Invalid LLM provider. Please select one of: openai, google, anthropic, ollama, custom, codex",
        )


def is_openai_selected():
    return get_llm_provider() == LLMProvider.OPENAI


def is_google_selected():
    return get_llm_provider() == LLMProvider.GOOGLE


def is_anthropic_selected():
    return get_llm_provider() == LLMProvider.ANTHROPIC


def is_ollama_selected():
    return get_llm_provider() == LLMProvider.OLLAMA


def is_custom_llm_selected():
    return get_llm_provider() == LLMProvider.CUSTOM


def is_codex_selected():
    return get_llm_provider() == LLMProvider.CODEX


def get_model():
    selected_llm = get_llm_provider()
    if selected_llm == LLMProvider.OPENAI:
        return get_openai_model_env() or DEFAULT_OPENAI_MODEL
    elif selected_llm == LLMProvider.GOOGLE:
        return get_google_model_env() or DEFAULT_GOOGLE_MODEL
    elif selected_llm == LLMProvider.ANTHROPIC:
        return get_anthropic_model_env() or DEFAULT_ANTHROPIC_MODEL
    elif selected_llm == LLMProvider.OLLAMA:
        return get_ollama_model_env()
    elif selected_llm == LLMProvider.CUSTOM:
        return get_custom_model_env()
    elif selected_llm == LLMProvider.CODEX:
        return get_codex_model_env() or DEFAULT_CODEX_MODEL
    else:
        raise HTTPException(
            status_code=500,
            detail=f"Invalid LLM provider. Please select one of: openai, google, anthropic, ollama, custom, codex",
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
