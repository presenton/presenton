from constants.supported_ollama_models import SUPPORTED_OLLAMA_MODELS
from constants.llm import OPENAI_URL
from enums.image_provider import ImageProvider
from enums.llm_provider import LLMProvider
from utils.available_models import (
    list_available_anthropic_models,
    list_available_google_models,
    list_available_openai_compatible_models,
    normalize_openai_compatible_base_url,
)
from utils.get_env import (
    get_azure_openai_api_key_env,
    get_azure_openai_api_version_env,
    get_azure_openai_base_url_env,
    get_azure_openai_endpoint_env,
    get_anthropic_api_key_env,
    get_anthropic_model_env,
    get_bedrock_api_key_env,
    get_bedrock_aws_access_key_id_env,
    get_bedrock_aws_secret_access_key_env,
    get_bedrock_model_env,
    get_can_change_keys_env,
    get_cerebras_api_key_env,
    get_fireworks_api_key_env,
    get_fireworks_base_url_env,
    get_fireworks_model_env,
    get_google_model_env,
    get_litellm_base_url_env,
    get_litellm_model_env,
    get_lmstudio_api_key_env,
    get_lmstudio_base_url_env,
    get_lmstudio_model_env,
    get_openai_api_key_env,
    get_openai_model_env,
    get_openrouter_api_key_env,
    get_together_api_key_env,
    get_together_base_url_env,
    get_together_model_env,
    get_pixabay_api_key_env,
    get_pexels_api_key_env,
    get_vertex_api_key_env,
    get_vertex_location_env,
    get_vertex_project_env,
    get_comfyui_url_env,
    get_comfyui_workflow_env,
)
from utils.get_env import get_google_api_key_env
from utils.get_env import get_ollama_model_env
from utils.get_env import get_custom_llm_api_key_env
from utils.get_env import get_custom_llm_url_env
from utils.get_env import get_custom_model_env
from utils.llm_provider import (
    get_llm_provider,
    is_custom_llm_selected,
    is_ollama_selected,
)
from utils.ollama import pull_ollama_model
from utils.image_provider import (
    get_selected_image_provider,
    is_image_generation_disabled,
)


def _check_image_provider_configuration() -> None:
    selected_image_provider = get_selected_image_provider()
    if not selected_image_provider:
        raise Exception("IMAGE_PROVIDER must be provided")

    if selected_image_provider == ImageProvider.PEXELS:
        pexels_api_key = get_pexels_api_key_env()
        if not pexels_api_key:
            raise Exception("PEXELS_API_KEY must be provided")

    elif selected_image_provider == ImageProvider.PIXABAY:
        pixabay_api_key = get_pixabay_api_key_env()
        if not pixabay_api_key:
            raise Exception("PIXABAY_API_KEY must be provided")

    elif (
        selected_image_provider == ImageProvider.GEMINI_FLASH
        or selected_image_provider == ImageProvider.NANOBANANA_PRO
    ):
        google_api_key = get_google_api_key_env()
        if not google_api_key:
            raise Exception("GOOGLE_API_KEY must be provided")

    elif (
        selected_image_provider == ImageProvider.DALLE3
        or selected_image_provider == ImageProvider.GPT_IMAGE_1_5
    ):
        openai_api_key = get_openai_api_key_env()
        if not openai_api_key:
            raise Exception("OPENAI_API_KEY must be provided")

    elif selected_image_provider == ImageProvider.COMFYUI:
        comfyui_url = get_comfyui_url_env()
        if not comfyui_url:
            raise Exception("COMFYUI_URL must be provided")
        workflow_json = get_comfyui_workflow_env()
        if not workflow_json:
            raise Exception("COMFYUI_WORKFLOW must be provided")


async def check_llm_and_image_provider_api_or_model_availability():
    can_change_keys = get_can_change_keys_env() != "false"
    skip_image_validation = is_image_generation_disabled()
    if not can_change_keys:
        if get_llm_provider() == LLMProvider.OPENAI:
            openai_api_key = get_openai_api_key_env()
            if not openai_api_key:
                raise Exception("OPENAI_API_KEY must be provided")
            openai_model = get_openai_model_env()
            if openai_model:
                available_models = await list_available_openai_compatible_models(
                    OPENAI_URL, openai_api_key
                )
                if openai_model not in available_models:
                    print("-" * 50)
                    print("Available models: ", available_models)
                    raise Exception(f"Model {openai_model} is not available")

        elif get_llm_provider() == LLMProvider.GOOGLE:
            google_api_key = get_google_api_key_env()
            if not google_api_key:
                raise Exception("GOOGLE_API_KEY must be provided")
            google_model = get_google_model_env()
            if google_model:
                available_models = await list_available_google_models(google_api_key)
                if google_model not in available_models:
                    print("-" * 50)
                    print("Available models: ", available_models)
                    raise Exception(f"Model {google_model} is not available")

        elif get_llm_provider() == LLMProvider.VERTEX:
            vertex_api_key = get_vertex_api_key_env()
            vertex_project = get_vertex_project_env()
            vertex_location = get_vertex_location_env()
            if not vertex_api_key and not vertex_project:
                raise Exception(
                    "Configure VERTEX_API_KEY or VERTEX_PROJECT for Vertex AI"
                )
            if vertex_api_key and (vertex_project or vertex_location):
                raise Exception(
                    "Vertex config is ambiguous. Use either VERTEX_API_KEY or "
                    "VERTEX_PROJECT/VERTEX_LOCATION, not both."
                )

        elif get_llm_provider() == LLMProvider.AZURE:
            azure_api_key = get_azure_openai_api_key_env()
            azure_endpoint = get_azure_openai_endpoint_env()
            azure_base_url = get_azure_openai_base_url_env()
            azure_api_version = get_azure_openai_api_version_env()
            if not azure_api_key:
                raise Exception("AZURE_OPENAI_API_KEY must be provided")
            if not azure_api_version:
                raise Exception("AZURE_OPENAI_API_VERSION must be provided")
            if not azure_endpoint and not azure_base_url:
                raise Exception(
                    "AZURE_OPENAI_ENDPOINT or AZURE_OPENAI_BASE_URL must be provided"
                )

        elif get_llm_provider() == LLMProvider.BEDROCK:
            bedrock_model = (get_bedrock_model_env() or "").strip()
            if not bedrock_model:
                raise Exception("BEDROCK_MODEL must be provided")
            has_api_key = bool((get_bedrock_api_key_env() or "").strip())
            has_access_key = bool((get_bedrock_aws_access_key_id_env() or "").strip())
            has_secret_key = bool((get_bedrock_aws_secret_access_key_env() or "").strip())
            if not has_api_key and not (has_access_key and has_secret_key):
                raise Exception(
                    "Set BEDROCK_API_KEY, or set BEDROCK_AWS_ACCESS_KEY_ID and "
                    "BEDROCK_AWS_SECRET_ACCESS_KEY"
                )

        elif get_llm_provider() == LLMProvider.OPENROUTER:
            if not get_openrouter_api_key_env():
                raise Exception("OPENROUTER_API_KEY must be provided")

        elif get_llm_provider() == LLMProvider.FIREWORKS:
            fireworks_api_key = (get_fireworks_api_key_env() or "").strip()
            fireworks_model = (get_fireworks_model_env() or "").strip()
            if not fireworks_api_key:
                raise Exception("FIREWORKS_API_KEY must be provided")
            if not fireworks_model:
                raise Exception("FIREWORKS_MODEL must be provided")
            fireworks_base_url = normalize_openai_compatible_base_url(
                get_fireworks_base_url_env() or "https://api.fireworks.ai/inference/v1"
            )
            available_models = await list_available_openai_compatible_models(
                fireworks_base_url, fireworks_api_key
            )
            print("-" * 50)
            print("Available models: ", available_models)
            if fireworks_model not in available_models:
                raise Exception(f"Model {fireworks_model} is not available")

        elif get_llm_provider() == LLMProvider.TOGETHER:
            together_api_key = (get_together_api_key_env() or "").strip()
            together_model = (get_together_model_env() or "").strip()
            if not together_api_key:
                raise Exception("TOGETHER_API_KEY must be provided")
            if not together_model:
                raise Exception("TOGETHER_MODEL must be provided")
            together_base_url = normalize_openai_compatible_base_url(
                get_together_base_url_env() or "https://api.together.ai/v1"
            )
            available_models = await list_available_openai_compatible_models(
                together_base_url, together_api_key
            )
            print("-" * 50)
            print("Available models: ", available_models)
            if together_model not in available_models:
                raise Exception(f"Model {together_model} is not available")

        elif get_llm_provider() == LLMProvider.CEREBRAS:
            if not get_cerebras_api_key_env():
                raise Exception("CEREBRAS_API_KEY must be provided")

        elif get_llm_provider() == LLMProvider.LITELLM:
            if not (get_litellm_base_url_env() or "").strip():
                raise Exception("LITELLM_BASE_URL must be provided")
            if not (get_litellm_model_env() or "").strip():
                raise Exception("LITELLM_MODEL must be provided")

        elif get_llm_provider() == LLMProvider.LMSTUDIO:
            lmstudio_model = (get_lmstudio_model_env() or "").strip()
            if not lmstudio_model:
                raise Exception("LMSTUDIO_MODEL must be provided")
            lmstudio_base_url = normalize_openai_compatible_base_url(
                get_lmstudio_base_url_env() or "http://localhost:1234/v1"
            )
            available_models = await list_available_openai_compatible_models(
                lmstudio_base_url, get_lmstudio_api_key_env() or ""
            )
            print("-" * 50)
            print("Available models: ", available_models)
            if lmstudio_model not in available_models:
                raise Exception(f"Model {lmstudio_model} is not available")

        elif get_llm_provider() == LLMProvider.ANTHROPIC:
            anthropic_api_key = get_anthropic_api_key_env()
            if not anthropic_api_key:
                raise Exception("ANTHROPIC_API_KEY must be provided")
            anthropic_model = get_anthropic_model_env()
            if anthropic_model:
                available_models = await list_available_anthropic_models(
                    anthropic_api_key
                )
                if anthropic_model not in available_models:
                    print("-" * 50)
                    print("Available models: ", available_models)
                    raise Exception(f"Model {anthropic_model} is not available")

        elif is_ollama_selected():
            ollama_model = get_ollama_model_env()
            if not ollama_model:
                raise Exception("OLLAMA_MODEL must be provided")

            if ollama_model not in SUPPORTED_OLLAMA_MODELS:
                raise Exception(f"Model {ollama_model} is not supported")

            print("-" * 50)
            print("Pulling model: ", ollama_model)
            async for event in pull_ollama_model(ollama_model):
                print(event)
            print("Pulled model: ", ollama_model)
            print("-" * 50)

        elif is_custom_llm_selected():
            custom_model = get_custom_model_env()
            custom_llm_url = get_custom_llm_url_env()
            if not custom_model:
                raise Exception("CUSTOM_MODEL must be provided")
            if not custom_llm_url:
                raise Exception("CUSTOM_LLM_URL must be provided")
            available_models = await list_available_openai_compatible_models(
                custom_llm_url, get_custom_llm_api_key_env() or "null"
            )
            print("-" * 50)
            print("Available models: ", available_models)
            if custom_model not in available_models:
                raise Exception(f"Model {custom_model} is not available")

        if not skip_image_validation:
            _check_image_provider_configuration()
