from typing import Literal

from pydantic import BaseModel, Field


class UserConfig(BaseModel):
    LLM: str | None = None

    # OpenAI
    OPENAI_API_KEY: str | None = None
    OPENAI_MODEL: str | None = None

    # Google
    GOOGLE_API_KEY: str | None = None
    GOOGLE_MODEL: str | None = None

    # Vertex AI
    VERTEX_API_KEY: str | None = None
    VERTEX_MODEL: str | None = None
    VERTEX_PROJECT: str | None = None
    VERTEX_LOCATION: str | None = None
    VERTEX_BASE_URL: str | None = None

    # Azure OpenAI
    AZURE_OPENAI_API_KEY: str | None = None
    AZURE_OPENAI_MODEL: str | None = None
    AZURE_OPENAI_ENDPOINT: str | None = None
    AZURE_OPENAI_BASE_URL: str | None = None
    AZURE_OPENAI_API_VERSION: str | None = None
    AZURE_OPENAI_DEPLOYMENT: str | None = None

    # Amazon Bedrock
    BEDROCK_REGION: str | None = None
    BEDROCK_API_KEY: str | None = None
    BEDROCK_AWS_ACCESS_KEY_ID: str | None = None
    BEDROCK_AWS_SECRET_ACCESS_KEY: str | None = None
    BEDROCK_AWS_SESSION_TOKEN: str | None = None
    BEDROCK_PROFILE_NAME: str | None = None
    BEDROCK_MODEL: str | None = None

    # OpenRouter
    OPENROUTER_API_KEY: str | None = None
    OPENROUTER_MODEL: str | None = None
    OPENROUTER_BASE_URL: str | None = None
    OPENROUTER_PROVIDER_ORDER: list[str] = Field(default_factory=list)
    OPENROUTER_ALLOW_FALLBACKS: bool | None = None
    OPENROUTER_REQUIRE_PARAMETERS: bool | None = None
    OPENROUTER_DATA_COLLECTION: Literal["allow", "deny"] | None = None
    OPENROUTER_ZDR: bool | None = None

    # Fireworks
    FIREWORKS_API_KEY: str | None = None
    FIREWORKS_MODEL: str | None = None
    FIREWORKS_BASE_URL: str | None = None

    # Together AI
    TOGETHER_API_KEY: str | None = None
    TOGETHER_MODEL: str | None = None
    TOGETHER_BASE_URL: str | None = None

    # Cerebras
    CEREBRAS_API_KEY: str | None = None
    CEREBRAS_MODEL: str | None = None
    CEREBRAS_BASE_URL: str | None = None

    # LiteLLM (OpenAI-compatible gateway / proxy)
    LITELLM_BASE_URL: str | None = None
    LITELLM_API_KEY: str | None = None
    LITELLM_MODEL: str | None = None

    # LM Studio (local OpenAI-compatible server)
    LMSTUDIO_BASE_URL: str | None = None
    LMSTUDIO_API_KEY: str | None = None
    LMSTUDIO_MODEL: str | None = None

    # Anthropic
    ANTHROPIC_API_KEY: str | None = None
    ANTHROPIC_MODEL: str | None = None

    # Ollama
    OLLAMA_URL: str | None = None
    OLLAMA_MODEL: str | None = None

    # Custom LLM
    CUSTOM_LLM_URL: str | None = None
    CUSTOM_LLM_API_KEY: str | None = None
    CUSTOM_MODEL: str | None = None

    # DeepSeek
    DEEPSEEK_BASE_URL: str | None = None
    DEEPSEEK_API_KEY: str | None = None
    DEEPSEEK_MODEL: str | None = None

    # Image Provider
    DISABLE_IMAGE_GENERATION: bool | None = None
    IMAGE_PROVIDER: str | None = None
    PEXELS_API_KEY: str | None = None
    PIXABAY_API_KEY: str | None = None

    # ComfyUI
    COMFYUI_URL: str | None = None
    COMFYUI_WORKFLOW: str | None = None

    # Open WebUI Image Provider
    OPEN_WEBUI_IMAGE_URL: str | None = None
    OPEN_WEBUI_IMAGE_API_KEY: str | None = None

    # OpenAI Compatible Image Provider
    OPENAI_COMPAT_IMAGE_BASE_URL: str | None = None
    OPENAI_COMPAT_IMAGE_API_KEY: str | None = None
    OPENAI_COMPAT_IMAGE_MODEL: str | None = None

    # Dalle 3 Quality
    DALL_E_3_QUALITY: str | None = None
    # Gpt Image 1.5 Quality
    GPT_IMAGE_1_5_QUALITY: str | None = None

    # Reasoning
    DISABLE_THINKING: bool | None = None
    EXTENDED_REASONING: bool | None = None

    # Optional generation overrides
    LLM_GENERATION_PROFILE: Literal["fast", "balanced", "deep", "model_max"] | None = None
    LLM_MAX_OUTPUT_TOKENS: int | None = Field(default=None, gt=0)
    LLM_REASONING_MODE: Literal["auto", "enabled", "disabled"] | None = None
    LLM_REASONING_EFFORT: (
        Literal["default", "none", "minimal", "low", "medium", "high", "xhigh", "max"] | None
    ) = None
    LLM_REASONING_BUDGET_TOKENS: int | None = Field(default=None, ge=0)

    # Web Search
    WEB_GROUNDING: bool | None = None
    WEB_SEARCH_PROVIDER: str | None = None
    WEB_SEARCH_MAX_RESULTS: str | None = None
    SEARXNG_BASE_URL: str | None = None
    TAVILY_API_KEY: str | None = None
    EXA_API_KEY: str | None = None
    BRAVE_SEARCH_API_KEY: str | None = None
    SERPER_API_KEY: str | None = None

    # Codex OAuth (ChatGPT)
    CODEX_MODEL: str | None = None
    CODEX_ACCESS_TOKEN: str | None = None
    CODEX_REFRESH_TOKEN: str | None = None
    CODEX_TOKEN_EXPIRES: str | None = None
    CODEX_ACCOUNT_ID: str | None = None
    CODEX_USERNAME: str | None = None
    CODEX_EMAIL: str | None = None
    CODEX_IS_PRO: bool | None = None
