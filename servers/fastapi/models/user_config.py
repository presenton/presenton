from typing import Optional
from pydantic import BaseModel


class UserConfig(BaseModel):
    LLM: Optional[str] = None

    # OpenAI
    OPENAI_API_KEY: Optional[str] = None
    OPENAI_MODEL: Optional[str] = None

    # Google
    GOOGLE_API_KEY: Optional[str] = None
    GOOGLE_MODEL: Optional[str] = None

    # Vertex AI
    VERTEX_API_KEY: Optional[str] = None
    VERTEX_MODEL: Optional[str] = None
    VERTEX_PROJECT: Optional[str] = None
    VERTEX_LOCATION: Optional[str] = None
    VERTEX_BASE_URL: Optional[str] = None

    # Azure OpenAI
    AZURE_OPENAI_API_KEY: Optional[str] = None
    AZURE_OPENAI_MODEL: Optional[str] = None
    AZURE_OPENAI_ENDPOINT: Optional[str] = None
    AZURE_OPENAI_BASE_URL: Optional[str] = None
    AZURE_OPENAI_API_VERSION: Optional[str] = None
    AZURE_OPENAI_DEPLOYMENT: Optional[str] = None

    # Amazon Bedrock
    BEDROCK_REGION: Optional[str] = None
    BEDROCK_API_KEY: Optional[str] = None
    BEDROCK_AWS_ACCESS_KEY_ID: Optional[str] = None
    BEDROCK_AWS_SECRET_ACCESS_KEY: Optional[str] = None
    BEDROCK_AWS_SESSION_TOKEN: Optional[str] = None
    BEDROCK_PROFILE_NAME: Optional[str] = None
    BEDROCK_MODEL: Optional[str] = None

    # OpenRouter
    OPENROUTER_API_KEY: Optional[str] = None
    OPENROUTER_MODEL: Optional[str] = None
    OPENROUTER_BASE_URL: Optional[str] = None

    # Fireworks
    FIREWORKS_API_KEY: Optional[str] = None
    FIREWORKS_MODEL: Optional[str] = None
    FIREWORKS_BASE_URL: Optional[str] = None

    # Together AI
    TOGETHER_API_KEY: Optional[str] = None
    TOGETHER_MODEL: Optional[str] = None
    TOGETHER_BASE_URL: Optional[str] = None

    # Cerebras
    CEREBRAS_API_KEY: Optional[str] = None
    CEREBRAS_MODEL: Optional[str] = None
    CEREBRAS_BASE_URL: Optional[str] = None

    # LiteLLM (OpenAI-compatible gateway / proxy)
    LITELLM_BASE_URL: Optional[str] = None
    LITELLM_API_KEY: Optional[str] = None
    LITELLM_MODEL: Optional[str] = None

    # LM Studio (local OpenAI-compatible server)
    LMSTUDIO_BASE_URL: Optional[str] = None
    LMSTUDIO_API_KEY: Optional[str] = None
    LMSTUDIO_MODEL: Optional[str] = None

    # Anthropic
    ANTHROPIC_API_KEY: Optional[str] = None
    ANTHROPIC_MODEL: Optional[str] = None

    # Ollama
    OLLAMA_URL: Optional[str] = None
    OLLAMA_MODEL: Optional[str] = None

    # Custom LLM
    CUSTOM_LLM_URL: Optional[str] = None
    CUSTOM_LLM_API_KEY: Optional[str] = None
    CUSTOM_MODEL: Optional[str] = None

    # Image Provider
    DISABLE_IMAGE_GENERATION: Optional[bool] = None
    IMAGE_PROVIDER: Optional[str] = None
    PEXELS_API_KEY: Optional[str] = None
    PIXABAY_API_KEY: Optional[str] = None

    # ComfyUI
    COMFYUI_URL: Optional[str] = None
    COMFYUI_WORKFLOW: Optional[str] = None

    # Open WebUI Image Provider
    OPEN_WEBUI_IMAGE_URL: Optional[str] = None
    OPEN_WEBUI_IMAGE_API_KEY: Optional[str] = None

    # OpenAI Compatible Image Provider
    OPENAI_COMPAT_IMAGE_BASE_URL: Optional[str] = None
    OPENAI_COMPAT_IMAGE_API_KEY: Optional[str] = None
    OPENAI_COMPAT_IMAGE_MODEL: Optional[str] = None

    # Dalle 3 Quality
    DALL_E_3_QUALITY: Optional[str] = None
    # Gpt Image 1.5 Quality
    GPT_IMAGE_1_5_QUALITY: Optional[str] = None

    # Reasoning
    DISABLE_THINKING: Optional[bool] = None
    EXTENDED_REASONING: Optional[bool] = None

    # Web Search
    WEB_GROUNDING: Optional[bool] = None
    WEB_SEARCH_PROVIDER: Optional[str] = None
    WEB_SEARCH_MAX_RESULTS: Optional[str] = None
    SEARXNG_BASE_URL: Optional[str] = None
    TAVILY_API_KEY: Optional[str] = None
    EXA_API_KEY: Optional[str] = None
    BRAVE_SEARCH_API_KEY: Optional[str] = None
    SERPER_API_KEY: Optional[str] = None

    # Codex OAuth (ChatGPT)
    CODEX_MODEL: Optional[str] = None
    CODEX_ACCESS_TOKEN: Optional[str] = None
    CODEX_REFRESH_TOKEN: Optional[str] = None
    CODEX_TOKEN_EXPIRES: Optional[str] = None
    CODEX_ACCOUNT_ID: Optional[str] = None
    CODEX_USERNAME: Optional[str] = None
    CODEX_EMAIL: Optional[str] = None
    CODEX_IS_PRO: Optional[bool] = None
