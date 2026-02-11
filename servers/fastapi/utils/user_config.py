import os
import json

from models.user_config import UserConfig
from utils.get_env import (
    get_anthropic_api_key_env,
    get_anthropic_model_env,
    get_comfyui_url_env,
    get_comfyui_workflow_env,
    get_custom_llm_api_key_env,
    get_custom_llm_url_env,
    get_custom_model_env,
    get_dall_e_3_quality_env,
    get_disable_image_generation_env,
    get_disable_thinking_env,
    get_google_api_key_env,
    get_google_model_env,
    get_gpt_image_1_5_quality_env,
    get_llm_provider_env,
    get_ollama_model_env,
    get_ollama_url_env,
    get_openai_api_key_env,
    get_openai_model_env,
    get_pexels_api_key_env,
    get_tool_calls_env,
    get_user_config_path_env,
    get_image_provider_env,
    get_pixabay_api_key_env,
    get_extended_reasoning_env,
    get_web_grounding_env,
)
from utils.parsers import parse_bool_or_none
from utils.set_env import (
    set_anthropic_api_key_env,
    set_anthropic_model_env,
    set_comfyui_url_env,
    set_comfyui_workflow_env,
    set_custom_llm_api_key_env,
    set_custom_llm_url_env,
    set_custom_model_env,
    set_dall_e_3_quality_env,
    set_disable_image_generation_env,
    set_disable_thinking_env,
    set_extended_reasoning_env,
    set_google_api_key_env,
    set_google_model_env,
    set_gpt_image_1_5_quality_env,
    set_llm_provider_env,
    set_ollama_model_env,
    set_ollama_url_env,
    set_openai_api_key_env,
    set_openai_model_env,
    set_pexels_api_key_env,
    set_image_provider_env,
    set_pixabay_api_key_env,
    set_tool_calls_env,
    set_web_grounding_env,
)


def get_user_config():
    user_config_path = get_user_config_path_env()

    existing_config = UserConfig()
    try:
        if os.path.exists(user_config_path):
            with open(user_config_path, "r") as f:
                existing_config = UserConfig(**json.load(f))
    except Exception:
        print("Error while loading user config")
        pass

    return UserConfig(
        LLM=existing_config.LLM or get_llm_provider_env(),
        OPENAI_API_KEY=existing_config.OPENAI_API_KEY or get_openai_api_key_env(),
        OPENAI_MODEL=existing_config.OPENAI_MODEL or get_openai_model_env(),
        GOOGLE_API_KEY=existing_config.GOOGLE_API_KEY or get_google_api_key_env(),
        GOOGLE_MODEL=existing_config.GOOGLE_MODEL or get_google_model_env(),
        ANTHROPIC_API_KEY=existing_config.ANTHROPIC_API_KEY
        or get_anthropic_api_key_env(),
        ANTHROPIC_MODEL=existing_config.ANTHROPIC_MODEL or get_anthropic_model_env(),
        OLLAMA_URL=existing_config.OLLAMA_URL or get_ollama_url_env(),
        OLLAMA_MODEL=existing_config.OLLAMA_MODEL or get_ollama_model_env(),
        CUSTOM_LLM_URL=existing_config.CUSTOM_LLM_URL or get_custom_llm_url_env(),
        CUSTOM_LLM_API_KEY=existing_config.CUSTOM_LLM_API_KEY
        or get_custom_llm_api_key_env(),
        CUSTOM_MODEL=existing_config.CUSTOM_MODEL or get_custom_model_env(),
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
        TOOL_CALLS=(
            existing_config.TOOL_CALLS
            if existing_config.TOOL_CALLS is not None
            else (parse_bool_or_none(get_tool_calls_env()) or False)
        ),
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
    if user_config.ANTHROPIC_API_KEY:
        set_anthropic_api_key_env(user_config.ANTHROPIC_API_KEY)
    if user_config.ANTHROPIC_MODEL:
        set_anthropic_model_env(user_config.ANTHROPIC_MODEL)
    if user_config.OLLAMA_URL:
        set_ollama_url_env(user_config.OLLAMA_URL)
    if user_config.OLLAMA_MODEL:
        set_ollama_model_env(user_config.OLLAMA_MODEL)
    if user_config.CUSTOM_LLM_URL:
        set_custom_llm_url_env(user_config.CUSTOM_LLM_URL)
    if user_config.CUSTOM_LLM_API_KEY:
        set_custom_llm_api_key_env(user_config.CUSTOM_LLM_API_KEY)
    if user_config.CUSTOM_MODEL:
        set_custom_model_env(user_config.CUSTOM_MODEL)
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
    if user_config.TOOL_CALLS is not None:
        set_tool_calls_env(str(user_config.TOOL_CALLS))
    if user_config.DISABLE_THINKING is not None:
        set_disable_thinking_env(str(user_config.DISABLE_THINKING))
    if user_config.EXTENDED_REASONING is not None:
        set_extended_reasoning_env(str(user_config.EXTENDED_REASONING))
    if user_config.WEB_GROUNDING is not None:
        set_web_grounding_env(str(user_config.WEB_GROUNDING))
