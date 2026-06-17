import os


def _is_truthy(value: str | None) -> bool:
    if value is None:
        return False
    return value.strip().lower() in {"1", "true", "yes", "on"}


def get_can_change_keys_env():
    return os.getenv("CAN_CHANGE_KEYS")


def get_database_url_env():
    return os.getenv("DATABASE_URL")


def get_app_data_directory_env():
    return os.getenv("APP_DATA_DIRECTORY")


def get_fastapi_public_base_url() -> str | None:
    """
    Public origin where FastAPI serves /app_data and /static (no trailing slash).

    Uses NEXT_PUBLIC_FAST_API (same value Electron and the export runtime inject for the UI).
    When unset, callers keep path-only URLs for same-origin / reverse-proxy setups (e.g. Docker).
    """
    v = (os.getenv("NEXT_PUBLIC_FAST_API") or "").strip().rstrip("/")
    return v or None


def get_temp_directory_env():
    return os.getenv("TEMP_DIRECTORY")


def get_user_config_path_env():
    return os.getenv("USER_CONFIG_PATH")


def get_disable_auth_env():
    return os.getenv("DISABLE_AUTH")


def is_disable_auth_enabled():
    return _is_truthy(get_disable_auth_env())


def get_llm_provider_env():
    return os.getenv("LLM")


def get_anthropic_api_key_env():
    return os.getenv("ANTHROPIC_API_KEY")


def get_anthropic_model_env():
    return os.getenv("ANTHROPIC_MODEL")


def get_ollama_url_env():
    return os.getenv("OLLAMA_URL")


def get_custom_llm_url_env():
    return os.getenv("CUSTOM_LLM_URL")


def get_openai_api_key_env():
    return os.getenv("OPENAI_API_KEY")


def get_openai_model_env():
    return os.getenv("OPENAI_MODEL")


def get_google_api_key_env():
    return os.getenv("GOOGLE_API_KEY")


def get_google_model_env():
    return os.getenv("GOOGLE_MODEL")


def get_vertex_api_key_env():
    return os.getenv("VERTEX_API_KEY")


def get_vertex_model_env():
    return os.getenv("VERTEX_MODEL")


def get_vertex_project_env():
    return os.getenv("VERTEX_PROJECT")


def get_vertex_location_env():
    return os.getenv("VERTEX_LOCATION")


def get_vertex_base_url_env():
    return os.getenv("VERTEX_BASE_URL")


def get_azure_openai_api_key_env():
    return os.getenv("AZURE_OPENAI_API_KEY")


def get_azure_openai_model_env():
    return os.getenv("AZURE_OPENAI_MODEL")


def get_azure_openai_endpoint_env():
    return os.getenv("AZURE_OPENAI_ENDPOINT")


def get_azure_openai_base_url_env():
    return os.getenv("AZURE_OPENAI_BASE_URL")


def get_azure_openai_api_version_env():
    return os.getenv("AZURE_OPENAI_API_VERSION")


def get_azure_openai_deployment_env():
    return os.getenv("AZURE_OPENAI_DEPLOYMENT")


def get_bedrock_region_env():
    return os.getenv("BEDROCK_REGION")


def get_bedrock_api_key_env():
    return os.getenv("BEDROCK_API_KEY")


def get_bedrock_aws_access_key_id_env():
    return os.getenv("BEDROCK_AWS_ACCESS_KEY_ID")


def get_bedrock_aws_secret_access_key_env():
    return os.getenv("BEDROCK_AWS_SECRET_ACCESS_KEY")


def get_bedrock_aws_session_token_env():
    return os.getenv("BEDROCK_AWS_SESSION_TOKEN")


def get_bedrock_profile_name_env():
    return os.getenv("BEDROCK_PROFILE_NAME")


def get_bedrock_model_env():
    return os.getenv("BEDROCK_MODEL")


def get_openrouter_api_key_env():
    return os.getenv("OPENROUTER_API_KEY")


def get_openrouter_model_env():
    return os.getenv("OPENROUTER_MODEL")


def get_openrouter_base_url_env():
    return os.getenv("OPENROUTER_BASE_URL")


def get_fireworks_api_key_env():
    return os.getenv("FIREWORKS_API_KEY")


def get_fireworks_model_env():
    return os.getenv("FIREWORKS_MODEL")


def get_fireworks_base_url_env():
    return os.getenv("FIREWORKS_BASE_URL")


def get_together_api_key_env():
    return os.getenv("TOGETHER_API_KEY")


def get_together_model_env():
    return os.getenv("TOGETHER_MODEL")


def get_together_base_url_env():
    return os.getenv("TOGETHER_BASE_URL")


def get_cerebras_api_key_env():
    return os.getenv("CEREBRAS_API_KEY")


def get_cerebras_model_env():
    return os.getenv("CEREBRAS_MODEL")


def get_cerebras_base_url_env():
    return os.getenv("CEREBRAS_BASE_URL")


def get_litellm_base_url_env():
    return os.getenv("LITELLM_BASE_URL")


def get_litellm_api_key_env():
    return os.getenv("LITELLM_API_KEY")


def get_litellm_model_env():
    return os.getenv("LITELLM_MODEL")


def get_lmstudio_base_url_env():
    return os.getenv("LMSTUDIO_BASE_URL")


def get_lmstudio_api_key_env():
    return os.getenv("LMSTUDIO_API_KEY")


def get_lmstudio_model_env():
    return os.getenv("LMSTUDIO_MODEL")


def get_custom_llm_api_key_env():
    return os.getenv("CUSTOM_LLM_API_KEY")


def get_ollama_model_env():
    return os.getenv("OLLAMA_MODEL")


def get_custom_model_env():
    return os.getenv("CUSTOM_MODEL")


def get_pexels_api_key_env():
    return os.getenv("PEXELS_API_KEY")


def get_disable_image_generation_env():
    return os.getenv("DISABLE_IMAGE_GENERATION")


def get_image_provider_env():
    return os.getenv("IMAGE_PROVIDER")


def get_pixabay_api_key_env():
    return os.getenv("PIXABAY_API_KEY")


def get_disable_thinking_env():
    return os.getenv("DISABLE_THINKING")


def get_extended_reasoning_env():
    return os.getenv("EXTENDED_REASONING")


def get_web_grounding_env():
    return os.getenv("WEB_GROUNDING")


def get_web_search_provider_env():
    return os.getenv("WEB_SEARCH_PROVIDER")


def get_web_search_max_results_env():
    return os.getenv("WEB_SEARCH_MAX_RESULTS")


def get_searxng_base_url_env():
    return os.getenv("SEARXNG_BASE_URL")


def get_tavily_api_key_env():
    return os.getenv("TAVILY_API_KEY")


def get_exa_api_key_env():
    return os.getenv("EXA_API_KEY")


def get_brave_search_api_key_env():
    return os.getenv("BRAVE_SEARCH_API_KEY")


def get_serper_api_key_env():
    return os.getenv("SERPER_API_KEY")


def get_comfyui_url_env():
    return os.getenv("COMFYUI_URL")


def get_comfyui_workflow_env():
    return os.getenv("COMFYUI_WORKFLOW")


# Dalle 3 Quality
def get_dall_e_3_quality_env():
    return os.getenv("DALL_E_3_QUALITY")


# Gpt Image 1.5 Quality
def get_gpt_image_1_5_quality_env():
    return os.getenv("GPT_IMAGE_1_5_QUALITY")


# Codex OAuth
def get_codex_access_token_env():
    return os.getenv("CODEX_ACCESS_TOKEN")


def get_codex_refresh_token_env():
    return os.getenv("CODEX_REFRESH_TOKEN")


def get_codex_token_expires_env():
    return os.getenv("CODEX_TOKEN_EXPIRES")


def get_codex_account_id_env():
    return os.getenv("CODEX_ACCOUNT_ID")


def get_codex_username_env():
    return os.getenv("CODEX_USERNAME")


def get_codex_email_env():
    return os.getenv("CODEX_EMAIL")


def get_codex_is_pro_env():
    return os.getenv("CODEX_IS_PRO")


def get_codex_model_env():
    return os.getenv("CODEX_MODEL")


def get_migrate_database_on_startup_env():
    return os.getenv("MIGRATE_DATABASE_ON_STARTUP")


def get_sentry_dsn_env():
    return os.getenv("SENTRY_DSN")


def get_sentry_traces_sample_rate_env():
    return os.getenv("SENTRY_TRACES_SAMPLE_RATE")


def get_sentry_send_default_pii_env():
    return os.getenv("SENTRY_SEND_DEFAULT_PII")


# Open WebUI Image Provider
def get_open_webui_image_url_env():
    return os.getenv("OPEN_WEBUI_IMAGE_URL")


def get_open_webui_image_api_key_env():
    return os.getenv("OPEN_WEBUI_IMAGE_API_KEY")


# OpenAI Compatible Image Provider
def get_openai_compat_image_base_url_env():
    return os.getenv("OPENAI_COMPAT_IMAGE_BASE_URL")


def get_openai_compat_image_api_key_env():
    return os.getenv("OPENAI_COMPAT_IMAGE_API_KEY")


def get_openai_compat_image_model_env():
    return os.getenv("OPENAI_COMPAT_IMAGE_MODEL")
