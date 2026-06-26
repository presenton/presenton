from models.user_config import UserConfig
from utils.get_env import (
    get_anthropic_api_key_env,
    get_anthropic_model_env,
    get_comfyui_url_env,
    get_comfyui_workflow_env,
    get_custom_llm_api_key_env,
    get_custom_llm_url_env,
    get_custom_model_env,
    get_deepseek_api_key_env,
    get_deepseek_base_url_env,
    get_deepseek_model_env,
    get_dall_e_3_quality_env,
    get_disable_image_generation_env,
    get_disable_thinking_env,
    get_google_api_key_env,
    get_google_model_env,
    get_vertex_api_key_env,
    get_vertex_model_env,
    get_vertex_project_env,
    get_vertex_location_env,
    get_vertex_base_url_env,
    get_azure_openai_api_key_env,
    get_azure_openai_model_env,
    get_azure_openai_endpoint_env,
    get_azure_openai_base_url_env,
    get_azure_openai_api_version_env,
    get_azure_openai_deployment_env,
    get_bedrock_region_env,
    get_bedrock_api_key_env,
    get_bedrock_aws_access_key_id_env,
    get_bedrock_aws_secret_access_key_env,
    get_bedrock_aws_session_token_env,
    get_bedrock_profile_name_env,
    get_bedrock_model_env,
    get_fireworks_api_key_env,
    get_fireworks_model_env,
    get_fireworks_base_url_env,
    get_together_api_key_env,
    get_together_model_env,
    get_together_base_url_env,
    get_cerebras_api_key_env,
    get_cerebras_base_url_env,
    get_cerebras_model_env,
    get_litellm_base_url_env,
    get_litellm_api_key_env,
    get_litellm_model_env,
    get_lmstudio_base_url_env,
    get_lmstudio_api_key_env,
    get_lmstudio_model_env,
    get_openrouter_api_key_env,
    get_openrouter_base_url_env,
    get_openrouter_model_env,
    get_gpt_image_1_5_quality_env,
    get_llm_provider_env,
    get_ollama_model_env,
    get_ollama_url_env,
    get_openai_api_key_env,
    get_openai_model_env,
    get_pexels_api_key_env,
    get_user_config_path_env,
    get_image_provider_env,
    get_pixabay_api_key_env,
    get_extended_reasoning_env,
    get_web_grounding_env,
    get_web_search_provider_env,
    get_web_search_max_results_env,
    get_searxng_base_url_env,
    get_tavily_api_key_env,
    get_exa_api_key_env,
    get_brave_search_api_key_env,
    get_serper_api_key_env,
    get_codex_access_token_env,
    get_codex_refresh_token_env,
    get_codex_token_expires_env,
    get_codex_account_id_env,
    get_codex_username_env,
    get_codex_email_env,
    get_codex_is_pro_env,
    get_codex_model_env,
    get_open_webui_image_url_env,
    get_open_webui_image_api_key_env,
    get_openai_compat_image_base_url_env,
    get_openai_compat_image_api_key_env,
    get_openai_compat_image_model_env,
)
from utils.parsers import parse_bool_or_none
from utils.user_config_store import read_user_config_file, update_user_config_file
from utils.set_env import (
    set_anthropic_api_key_env,
    set_anthropic_model_env,
    set_comfyui_url_env,
    set_comfyui_workflow_env,
    set_custom_llm_api_key_env,
    set_custom_llm_url_env,
    set_custom_model_env,
    set_deepseek_api_key_env,
    set_deepseek_base_url_env,
    set_deepseek_model_env,
    set_dall_e_3_quality_env,
    set_disable_image_generation_env,
    set_disable_thinking_env,
    set_extended_reasoning_env,
    set_google_api_key_env,
    set_google_model_env,
    set_vertex_api_key_env,
    set_vertex_model_env,
    set_vertex_project_env,
    set_vertex_location_env,
    set_vertex_base_url_env,
    set_azure_openai_api_key_env,
    set_azure_openai_model_env,
    set_azure_openai_endpoint_env,
    set_azure_openai_base_url_env,
    set_azure_openai_api_version_env,
    set_azure_openai_deployment_env,
    set_bedrock_region_env,
    set_bedrock_api_key_env,
    set_bedrock_aws_access_key_id_env,
    set_bedrock_aws_secret_access_key_env,
    set_bedrock_aws_session_token_env,
    set_bedrock_profile_name_env,
    set_bedrock_model_env,
    set_fireworks_api_key_env,
    set_fireworks_model_env,
    set_fireworks_base_url_env,
    set_together_api_key_env,
    set_together_model_env,
    set_together_base_url_env,
    set_cerebras_api_key_env,
    set_cerebras_base_url_env,
    set_cerebras_model_env,
    set_litellm_base_url_env,
    set_litellm_api_key_env,
    set_litellm_model_env,
    set_lmstudio_base_url_env,
    set_lmstudio_api_key_env,
    set_lmstudio_model_env,
    set_openrouter_api_key_env,
    set_openrouter_base_url_env,
    set_openrouter_model_env,
    set_gpt_image_1_5_quality_env,
    set_llm_provider_env,
    set_ollama_model_env,
    set_ollama_url_env,
    set_openai_api_key_env,
    set_openai_model_env,
    set_pexels_api_key_env,
    set_image_provider_env,
    set_pixabay_api_key_env,
    set_web_grounding_env,
    set_web_search_provider_env,
    set_web_search_max_results_env,
    set_searxng_base_url_env,
    set_tavily_api_key_env,
    set_exa_api_key_env,
    set_brave_search_api_key_env,
    set_serper_api_key_env,
    set_codex_access_token_env,
    set_codex_refresh_token_env,
    set_codex_token_expires_env,
    set_codex_account_id_env,
    set_codex_username_env,
    set_codex_email_env,
    set_codex_is_pro_env,
    set_codex_model_env,
    set_open_webui_image_url_env,
    set_open_webui_image_api_key_env,
    set_openai_compat_image_base_url_env,
    set_openai_compat_image_api_key_env,
    set_openai_compat_image_model_env,
)


def get_user_config():
    user_config_path = get_user_config_path_env()

    existing_config = UserConfig()
    existing_config_data = {}
    try:
        if user_config_path:
            existing_config_data = read_user_config_file(user_config_path)
            existing_config = UserConfig(**existing_config_data)
    except Exception:
        print("Error while loading user config")
        pass

    return UserConfig(
        LLM=existing_config.LLM or get_llm_provider_env(),
        OPENAI_API_KEY=existing_config.OPENAI_API_KEY or get_openai_api_key_env(),
        OPENAI_MODEL=existing_config.OPENAI_MODEL or get_openai_model_env(),
        GOOGLE_API_KEY=existing_config.GOOGLE_API_KEY or get_google_api_key_env(),
        GOOGLE_MODEL=existing_config.GOOGLE_MODEL or get_google_model_env(),
        VERTEX_API_KEY=existing_config.VERTEX_API_KEY or get_vertex_api_key_env(),
        VERTEX_MODEL=existing_config.VERTEX_MODEL or get_vertex_model_env(),
        VERTEX_PROJECT=existing_config.VERTEX_PROJECT or get_vertex_project_env(),
        VERTEX_LOCATION=existing_config.VERTEX_LOCATION or get_vertex_location_env(),
        VERTEX_BASE_URL=existing_config.VERTEX_BASE_URL or get_vertex_base_url_env(),
        AZURE_OPENAI_API_KEY=existing_config.AZURE_OPENAI_API_KEY
        or get_azure_openai_api_key_env(),
        AZURE_OPENAI_MODEL=existing_config.AZURE_OPENAI_MODEL
        or get_azure_openai_model_env(),
        AZURE_OPENAI_ENDPOINT=existing_config.AZURE_OPENAI_ENDPOINT
        or get_azure_openai_endpoint_env(),
        AZURE_OPENAI_BASE_URL=existing_config.AZURE_OPENAI_BASE_URL
        or get_azure_openai_base_url_env(),
        AZURE_OPENAI_API_VERSION=existing_config.AZURE_OPENAI_API_VERSION
        or get_azure_openai_api_version_env(),
        AZURE_OPENAI_DEPLOYMENT=existing_config.AZURE_OPENAI_DEPLOYMENT
        or get_azure_openai_deployment_env(),
        BEDROCK_REGION=existing_config.BEDROCK_REGION or get_bedrock_region_env(),
        BEDROCK_API_KEY=existing_config.BEDROCK_API_KEY or get_bedrock_api_key_env(),
        BEDROCK_AWS_ACCESS_KEY_ID=existing_config.BEDROCK_AWS_ACCESS_KEY_ID
        or get_bedrock_aws_access_key_id_env(),
        BEDROCK_AWS_SECRET_ACCESS_KEY=existing_config.BEDROCK_AWS_SECRET_ACCESS_KEY
        or get_bedrock_aws_secret_access_key_env(),
        BEDROCK_AWS_SESSION_TOKEN=existing_config.BEDROCK_AWS_SESSION_TOKEN
        or get_bedrock_aws_session_token_env(),
        BEDROCK_PROFILE_NAME=existing_config.BEDROCK_PROFILE_NAME
        or get_bedrock_profile_name_env(),
        BEDROCK_MODEL=existing_config.BEDROCK_MODEL or get_bedrock_model_env(),
        OPENROUTER_API_KEY=existing_config.OPENROUTER_API_KEY or get_openrouter_api_key_env(),
        OPENROUTER_MODEL=existing_config.OPENROUTER_MODEL or get_openrouter_model_env(),
        OPENROUTER_BASE_URL=existing_config.OPENROUTER_BASE_URL or get_openrouter_base_url_env(),
        FIREWORKS_API_KEY=existing_config.FIREWORKS_API_KEY or get_fireworks_api_key_env(),
        FIREWORKS_MODEL=existing_config.FIREWORKS_MODEL or get_fireworks_model_env(),
        FIREWORKS_BASE_URL=existing_config.FIREWORKS_BASE_URL
        or get_fireworks_base_url_env(),
        TOGETHER_API_KEY=existing_config.TOGETHER_API_KEY or get_together_api_key_env(),
        TOGETHER_MODEL=existing_config.TOGETHER_MODEL or get_together_model_env(),
        TOGETHER_BASE_URL=existing_config.TOGETHER_BASE_URL or get_together_base_url_env(),
        CEREBRAS_API_KEY=existing_config.CEREBRAS_API_KEY or get_cerebras_api_key_env(),
        CEREBRAS_MODEL=existing_config.CEREBRAS_MODEL or get_cerebras_model_env(),
        CEREBRAS_BASE_URL=existing_config.CEREBRAS_BASE_URL or get_cerebras_base_url_env(),
        LITELLM_BASE_URL=existing_config.LITELLM_BASE_URL or get_litellm_base_url_env(),
        LITELLM_API_KEY=existing_config.LITELLM_API_KEY or get_litellm_api_key_env(),
        LITELLM_MODEL=existing_config.LITELLM_MODEL or get_litellm_model_env(),
        LMSTUDIO_BASE_URL=existing_config.LMSTUDIO_BASE_URL or get_lmstudio_base_url_env(),
        LMSTUDIO_API_KEY=existing_config.LMSTUDIO_API_KEY or get_lmstudio_api_key_env(),
        LMSTUDIO_MODEL=existing_config.LMSTUDIO_MODEL or get_lmstudio_model_env(),
        ANTHROPIC_API_KEY=existing_config.ANTHROPIC_API_KEY
        or get_anthropic_api_key_env(),
        ANTHROPIC_MODEL=existing_config.ANTHROPIC_MODEL or get_anthropic_model_env(),
        OLLAMA_URL=(
            existing_config.OLLAMA_URL
            if "OLLAMA_URL" in existing_config_data
            else get_ollama_url_env()
        ),
        OLLAMA_MODEL=existing_config.OLLAMA_MODEL or get_ollama_model_env(),
        CUSTOM_LLM_URL=existing_config.CUSTOM_LLM_URL or get_custom_llm_url_env(),
        CUSTOM_LLM_API_KEY=existing_config.CUSTOM_LLM_API_KEY
        or get_custom_llm_api_key_env(),
        CUSTOM_MODEL=existing_config.CUSTOM_MODEL or get_custom_model_env(),
        DEEPSEEK_BASE_URL=existing_config.DEEPSEEK_BASE_URL or get_deepseek_base_url_env(),
        DEEPSEEK_API_KEY=existing_config.DEEPSEEK_API_KEY or get_deepseek_api_key_env(),
        DEEPSEEK_MODEL=existing_config.DEEPSEEK_MODEL or get_deepseek_model_env(),
        IMAGE_PROVIDER=existing_config.IMAGE_PROVIDER or get_image_provider_env(),
        DISABLE_IMAGE_GENERATION=(
            existing_config.DISABLE_IMAGE_GENERATION
            if existing_config.DISABLE_IMAGE_GENERATION is not None
            else (parse_bool_or_none(get_disable_image_generation_env()) or False)
        ),
        PIXABAY_API_KEY=existing_config.PIXABAY_API_KEY or get_pixabay_api_key_env(),
        PEXELS_API_KEY=existing_config.PEXELS_API_KEY or get_pexels_api_key_env(),
        COMFYUI_URL=existing_config.COMFYUI_URL or get_comfyui_url_env(),
        COMFYUI_WORKFLOW=existing_config.COMFYUI_WORKFLOW or get_comfyui_workflow_env(),
        DALL_E_3_QUALITY=existing_config.DALL_E_3_QUALITY or get_dall_e_3_quality_env(),
        GPT_IMAGE_1_5_QUALITY=existing_config.GPT_IMAGE_1_5_QUALITY
        or get_gpt_image_1_5_quality_env(),
        DISABLE_THINKING=(
            existing_config.DISABLE_THINKING
            if existing_config.DISABLE_THINKING is not None
            else (parse_bool_or_none(get_disable_thinking_env()) or False)
        ),
        EXTENDED_REASONING=(
            existing_config.EXTENDED_REASONING
            if existing_config.EXTENDED_REASONING is not None
            else (parse_bool_or_none(get_extended_reasoning_env()) or False)
        ),
        WEB_GROUNDING=(
            existing_config.WEB_GROUNDING
            if existing_config.WEB_GROUNDING is not None
            else (parse_bool_or_none(get_web_grounding_env()) or False)
        ),
        WEB_SEARCH_PROVIDER=existing_config.WEB_SEARCH_PROVIDER
        or get_web_search_provider_env(),
        WEB_SEARCH_MAX_RESULTS=existing_config.WEB_SEARCH_MAX_RESULTS
        or get_web_search_max_results_env(),
        SEARXNG_BASE_URL=existing_config.SEARXNG_BASE_URL or get_searxng_base_url_env(),
        TAVILY_API_KEY=existing_config.TAVILY_API_KEY or get_tavily_api_key_env(),
        EXA_API_KEY=existing_config.EXA_API_KEY or get_exa_api_key_env(),
        BRAVE_SEARCH_API_KEY=existing_config.BRAVE_SEARCH_API_KEY
        or get_brave_search_api_key_env(),
        SERPER_API_KEY=existing_config.SERPER_API_KEY or get_serper_api_key_env(),
        CODEX_MODEL=existing_config.CODEX_MODEL or get_codex_model_env(),
        CODEX_ACCESS_TOKEN=existing_config.CODEX_ACCESS_TOKEN or get_codex_access_token_env(),
        CODEX_REFRESH_TOKEN=existing_config.CODEX_REFRESH_TOKEN or get_codex_refresh_token_env(),
        CODEX_TOKEN_EXPIRES=existing_config.CODEX_TOKEN_EXPIRES or get_codex_token_expires_env(),
        CODEX_ACCOUNT_ID=existing_config.CODEX_ACCOUNT_ID or get_codex_account_id_env(),
        CODEX_USERNAME=existing_config.CODEX_USERNAME or get_codex_username_env(),
        CODEX_EMAIL=existing_config.CODEX_EMAIL or get_codex_email_env(),
        CODEX_IS_PRO=(
            existing_config.CODEX_IS_PRO
            if existing_config.CODEX_IS_PRO is not None
            else parse_bool_or_none(get_codex_is_pro_env())
        ),
        OPEN_WEBUI_IMAGE_URL=existing_config.OPEN_WEBUI_IMAGE_URL or get_open_webui_image_url_env(),
        OPEN_WEBUI_IMAGE_API_KEY=existing_config.OPEN_WEBUI_IMAGE_API_KEY or get_open_webui_image_api_key_env(),
        OPENAI_COMPAT_IMAGE_BASE_URL=existing_config.OPENAI_COMPAT_IMAGE_BASE_URL
        or get_openai_compat_image_base_url_env(),
        OPENAI_COMPAT_IMAGE_API_KEY=existing_config.OPENAI_COMPAT_IMAGE_API_KEY
        or get_openai_compat_image_api_key_env(),
        OPENAI_COMPAT_IMAGE_MODEL=existing_config.OPENAI_COMPAT_IMAGE_MODEL
        or get_openai_compat_image_model_env(),
    )


def update_env_with_user_config():
    user_config = get_user_config()
    if user_config.LLM:
        set_llm_provider_env(user_config.LLM)
    if user_config.OPENAI_API_KEY:
        set_openai_api_key_env(user_config.OPENAI_API_KEY)
    if user_config.OPENAI_MODEL:
        set_openai_model_env(user_config.OPENAI_MODEL)
    if user_config.GOOGLE_API_KEY:
        set_google_api_key_env(user_config.GOOGLE_API_KEY)
    if user_config.GOOGLE_MODEL:
        set_google_model_env(user_config.GOOGLE_MODEL)
    if user_config.VERTEX_API_KEY:
        set_vertex_api_key_env(user_config.VERTEX_API_KEY)
    if user_config.VERTEX_MODEL:
        set_vertex_model_env(user_config.VERTEX_MODEL)
    if user_config.VERTEX_PROJECT:
        set_vertex_project_env(user_config.VERTEX_PROJECT)
    if user_config.VERTEX_LOCATION:
        set_vertex_location_env(user_config.VERTEX_LOCATION)
    if user_config.VERTEX_BASE_URL:
        set_vertex_base_url_env(user_config.VERTEX_BASE_URL)
    if user_config.AZURE_OPENAI_API_KEY:
        set_azure_openai_api_key_env(user_config.AZURE_OPENAI_API_KEY)
    if user_config.AZURE_OPENAI_MODEL:
        set_azure_openai_model_env(user_config.AZURE_OPENAI_MODEL)
    if user_config.AZURE_OPENAI_ENDPOINT:
        set_azure_openai_endpoint_env(user_config.AZURE_OPENAI_ENDPOINT)
    if user_config.AZURE_OPENAI_BASE_URL:
        set_azure_openai_base_url_env(user_config.AZURE_OPENAI_BASE_URL)
    if user_config.AZURE_OPENAI_API_VERSION:
        set_azure_openai_api_version_env(user_config.AZURE_OPENAI_API_VERSION)
    if user_config.AZURE_OPENAI_DEPLOYMENT:
        set_azure_openai_deployment_env(user_config.AZURE_OPENAI_DEPLOYMENT)
    if user_config.BEDROCK_REGION:
        set_bedrock_region_env(user_config.BEDROCK_REGION)
    if user_config.BEDROCK_API_KEY:
        set_bedrock_api_key_env(user_config.BEDROCK_API_KEY)
    if user_config.BEDROCK_AWS_ACCESS_KEY_ID:
        set_bedrock_aws_access_key_id_env(user_config.BEDROCK_AWS_ACCESS_KEY_ID)
    if user_config.BEDROCK_AWS_SECRET_ACCESS_KEY:
        set_bedrock_aws_secret_access_key_env(user_config.BEDROCK_AWS_SECRET_ACCESS_KEY)
    if user_config.BEDROCK_AWS_SESSION_TOKEN:
        set_bedrock_aws_session_token_env(user_config.BEDROCK_AWS_SESSION_TOKEN)
    if user_config.BEDROCK_PROFILE_NAME:
        set_bedrock_profile_name_env(user_config.BEDROCK_PROFILE_NAME)
    if user_config.BEDROCK_MODEL:
        set_bedrock_model_env(user_config.BEDROCK_MODEL)
    if user_config.OPENROUTER_API_KEY:
        set_openrouter_api_key_env(user_config.OPENROUTER_API_KEY)
    if user_config.OPENROUTER_MODEL:
        set_openrouter_model_env(user_config.OPENROUTER_MODEL)
    if user_config.OPENROUTER_BASE_URL:
        set_openrouter_base_url_env(user_config.OPENROUTER_BASE_URL)
    if user_config.FIREWORKS_API_KEY:
        set_fireworks_api_key_env(user_config.FIREWORKS_API_KEY)
    if user_config.FIREWORKS_MODEL:
        set_fireworks_model_env(user_config.FIREWORKS_MODEL)
    if user_config.FIREWORKS_BASE_URL:
        set_fireworks_base_url_env(user_config.FIREWORKS_BASE_URL)
    if user_config.TOGETHER_API_KEY:
        set_together_api_key_env(user_config.TOGETHER_API_KEY)
    if user_config.TOGETHER_MODEL:
        set_together_model_env(user_config.TOGETHER_MODEL)
    if user_config.TOGETHER_BASE_URL:
        set_together_base_url_env(user_config.TOGETHER_BASE_URL)
    if user_config.CEREBRAS_API_KEY:
        set_cerebras_api_key_env(user_config.CEREBRAS_API_KEY)
    if user_config.CEREBRAS_MODEL:
        set_cerebras_model_env(user_config.CEREBRAS_MODEL)
    if user_config.CEREBRAS_BASE_URL:
        set_cerebras_base_url_env(user_config.CEREBRAS_BASE_URL)
    if user_config.LITELLM_BASE_URL:
        set_litellm_base_url_env(user_config.LITELLM_BASE_URL)
    if user_config.LITELLM_API_KEY:
        set_litellm_api_key_env(user_config.LITELLM_API_KEY)
    if user_config.LITELLM_MODEL:
        set_litellm_model_env(user_config.LITELLM_MODEL)
    if user_config.LMSTUDIO_BASE_URL:
        set_lmstudio_base_url_env(user_config.LMSTUDIO_BASE_URL)
    if user_config.LMSTUDIO_API_KEY:
        set_lmstudio_api_key_env(user_config.LMSTUDIO_API_KEY)
    if user_config.LMSTUDIO_MODEL:
        set_lmstudio_model_env(user_config.LMSTUDIO_MODEL)
    if user_config.ANTHROPIC_API_KEY:
        set_anthropic_api_key_env(user_config.ANTHROPIC_API_KEY)
    if user_config.ANTHROPIC_MODEL:
        set_anthropic_model_env(user_config.ANTHROPIC_MODEL)
    if user_config.OLLAMA_URL is not None:
        set_ollama_url_env(user_config.OLLAMA_URL)
    if user_config.OLLAMA_MODEL:
        set_ollama_model_env(user_config.OLLAMA_MODEL)
    if user_config.CUSTOM_LLM_URL:
        set_custom_llm_url_env(user_config.CUSTOM_LLM_URL)
    if user_config.CUSTOM_LLM_API_KEY:
        set_custom_llm_api_key_env(user_config.CUSTOM_LLM_API_KEY)
    if user_config.CUSTOM_MODEL:
        set_custom_model_env(user_config.CUSTOM_MODEL)
    if user_config.DEEPSEEK_BASE_URL:
        set_deepseek_base_url_env(user_config.DEEPSEEK_BASE_URL)
    if user_config.DEEPSEEK_API_KEY:
        set_deepseek_api_key_env(user_config.DEEPSEEK_API_KEY)
    if user_config.DEEPSEEK_MODEL:
        set_deepseek_model_env(user_config.DEEPSEEK_MODEL)
    if user_config.DISABLE_IMAGE_GENERATION is not None:
        set_disable_image_generation_env(str(user_config.DISABLE_IMAGE_GENERATION))
    if user_config.IMAGE_PROVIDER:
        set_image_provider_env(user_config.IMAGE_PROVIDER)
    if user_config.PIXABAY_API_KEY:
        set_pixabay_api_key_env(user_config.PIXABAY_API_KEY)
    if user_config.PEXELS_API_KEY:
        set_pexels_api_key_env(user_config.PEXELS_API_KEY)
    if user_config.COMFYUI_URL:
        set_comfyui_url_env(user_config.COMFYUI_URL)
    if user_config.COMFYUI_WORKFLOW:
        set_comfyui_workflow_env(user_config.COMFYUI_WORKFLOW)
    if user_config.DALL_E_3_QUALITY:
        set_dall_e_3_quality_env(user_config.DALL_E_3_QUALITY)
    if user_config.GPT_IMAGE_1_5_QUALITY:
        set_gpt_image_1_5_quality_env(user_config.GPT_IMAGE_1_5_QUALITY)
    if user_config.DISABLE_THINKING is not None:
        set_disable_thinking_env(str(user_config.DISABLE_THINKING))
    if user_config.EXTENDED_REASONING is not None:
        set_extended_reasoning_env(str(user_config.EXTENDED_REASONING))
    if user_config.WEB_GROUNDING is not None:
        set_web_grounding_env(str(user_config.WEB_GROUNDING))
    if user_config.WEB_SEARCH_PROVIDER:
        set_web_search_provider_env(user_config.WEB_SEARCH_PROVIDER)
    if user_config.WEB_SEARCH_MAX_RESULTS:
        set_web_search_max_results_env(user_config.WEB_SEARCH_MAX_RESULTS)
    if user_config.SEARXNG_BASE_URL:
        set_searxng_base_url_env(user_config.SEARXNG_BASE_URL)
    if user_config.TAVILY_API_KEY:
        set_tavily_api_key_env(user_config.TAVILY_API_KEY)
    if user_config.EXA_API_KEY:
        set_exa_api_key_env(user_config.EXA_API_KEY)
    if user_config.BRAVE_SEARCH_API_KEY:
        set_brave_search_api_key_env(user_config.BRAVE_SEARCH_API_KEY)
    if user_config.SERPER_API_KEY:
        set_serper_api_key_env(user_config.SERPER_API_KEY)
    if user_config.CODEX_MODEL:
        set_codex_model_env(user_config.CODEX_MODEL)
    if user_config.CODEX_ACCESS_TOKEN:
        set_codex_access_token_env(user_config.CODEX_ACCESS_TOKEN)
    if user_config.CODEX_REFRESH_TOKEN:
        set_codex_refresh_token_env(user_config.CODEX_REFRESH_TOKEN)
    if user_config.CODEX_TOKEN_EXPIRES:
        set_codex_token_expires_env(user_config.CODEX_TOKEN_EXPIRES)
    if user_config.CODEX_ACCOUNT_ID:
        set_codex_account_id_env(user_config.CODEX_ACCOUNT_ID)
    if user_config.CODEX_USERNAME:
        set_codex_username_env(user_config.CODEX_USERNAME)
    if user_config.CODEX_EMAIL:
        set_codex_email_env(user_config.CODEX_EMAIL)
    if user_config.CODEX_IS_PRO is not None:
        set_codex_is_pro_env(str(user_config.CODEX_IS_PRO))
    if user_config.OPEN_WEBUI_IMAGE_URL:
        set_open_webui_image_url_env(user_config.OPEN_WEBUI_IMAGE_URL)
    if user_config.OPEN_WEBUI_IMAGE_API_KEY:
        set_open_webui_image_api_key_env(user_config.OPEN_WEBUI_IMAGE_API_KEY)
    if user_config.OPENAI_COMPAT_IMAGE_BASE_URL:
        set_openai_compat_image_base_url_env(user_config.OPENAI_COMPAT_IMAGE_BASE_URL)
    if user_config.OPENAI_COMPAT_IMAGE_API_KEY:
        set_openai_compat_image_api_key_env(user_config.OPENAI_COMPAT_IMAGE_API_KEY)
    if user_config.OPENAI_COMPAT_IMAGE_MODEL:
        set_openai_compat_image_model_env(user_config.OPENAI_COMPAT_IMAGE_MODEL)


def save_codex_tokens_to_user_config() -> None:
    """
    Write the current in-memory Codex OAuth token env vars back to userConfig.json
    so they survive container restarts.  Called after a successful token exchange
    and on logout (where the env vars have already been cleared to "").
    """
    user_config_path = get_user_config_path_env()
    if not user_config_path:
        return

    def merge_codex_tokens(existing: dict) -> dict:
        existing["CODEX_ACCESS_TOKEN"] = get_codex_access_token_env()
        existing["CODEX_REFRESH_TOKEN"] = get_codex_refresh_token_env()
        existing["CODEX_TOKEN_EXPIRES"] = get_codex_token_expires_env()
        existing["CODEX_ACCOUNT_ID"] = get_codex_account_id_env()
        existing["CODEX_USERNAME"] = get_codex_username_env()
        existing["CODEX_EMAIL"] = get_codex_email_env()
        existing["CODEX_IS_PRO"] = parse_bool_or_none(get_codex_is_pro_env())
        return existing

    try:
        update_user_config_file(user_config_path, merge_codex_tokens)
    except Exception as error:
        print(f"Error while saving Codex tokens to user config: {error}")
