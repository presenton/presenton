import os


def set_temp_directory_env(value):
    os.environ["TEMP_DIRECTORY"] = value


def set_user_config_path_env(value):
    os.environ["USER_CONFIG_PATH"] = value


def set_llm_provider_env(value):
    os.environ["LLM"] = value


def set_ollama_url_env(value):
    os.environ["OLLAMA_URL"] = value


def set_custom_llm_url_env(value):
    os.environ["CUSTOM_LLM_URL"] = value


def set_openai_api_key_env(value):
    os.environ["OPENAI_API_KEY"] = value


def set_openai_model_env(value):
    os.environ["OPENAI_MODEL"] = value


def set_google_api_key_env(value):
    os.environ["GOOGLE_API_KEY"] = value


def set_google_model_env(value):
    os.environ["GOOGLE_MODEL"] = value


def set_anthropic_api_key_env(value):
    os.environ["ANTHROPIC_API_KEY"] = value


def set_anthropic_model_env(value):
    os.environ["ANTHROPIC_MODEL"] = value


def set_custom_llm_api_key_env(value):
    os.environ["CUSTOM_LLM_API_KEY"] = value


def set_ollama_model_env(value):
    os.environ["OLLAMA_MODEL"] = value


def set_custom_model_env(value):
    os.environ["CUSTOM_MODEL"] = value


def set_pexels_api_key_env(value):
    os.environ["PEXELS_API_KEY"] = value


def set_image_provider_env(value):
    os.environ["IMAGE_PROVIDER"] = value


def set_pixabay_api_key_env(value):
    os.environ["PIXABAY_API_KEY"] = value


def set_disable_image_generation_env(value):
    os.environ["DISABLE_IMAGE_GENERATION"] = value


def set_tool_calls_env(value):
    os.environ["TOOL_CALLS"] = value


def set_disable_thinking_env(value):
    os.environ["DISABLE_THINKING"] = value


def set_extended_reasoning_env(value):
    os.environ["EXTENDED_REASONING"] = value


def set_web_grounding_env(value):
    os.environ["WEB_GROUNDING"] = value


def set_comfyui_url_env(value):
    os.environ["COMFYUI_URL"] = value


def set_comfyui_workflow_env(value):
    os.environ["COMFYUI_WORKFLOW"] = value


def set_dall_e_3_quality_env(value):
    os.environ["DALL_E_3_QUALITY"] = value


def set_gpt_image_1_5_quality_env(value):
    os.environ["GPT_IMAGE_1_5_QUALITY"] = value
