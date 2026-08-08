import time
from typing import Optional

from fastapi import HTTPException
from llmai import (
    BedrockClientConfig,
    DeepSeekClientConfig,
    FireworksClientConfig,
    LMStudioClientConfig,
    TogetherAIClientConfig,
)
from llmai.shared import (
    AnthropicClientConfig,
    AzureOpenAIClientConfig,
    CerebrasClientConfig,
    ChatGPTClientConfig,
    ClientConfig,
    GoogleClientConfig,
    LiteLLMClientConfig,
    OpenAIApiType,
    OpenAIClientConfig,
    OpenRouterClientConfig,
    VertexAIClientConfig,
)

from enums.llm_provider import LLMProvider
from utils.get_env import (
    get_azure_openai_api_key_env,
    get_azure_openai_api_version_env,
    get_azure_openai_base_url_env,
    get_azure_openai_deployment_env,
    get_azure_openai_endpoint_env,
    get_anthropic_api_key_env,
    get_bedrock_api_key_env,
    get_bedrock_aws_access_key_id_env,
    get_bedrock_aws_secret_access_key_env,
    get_bedrock_aws_session_token_env,
    get_bedrock_profile_name_env,
    get_bedrock_region_env,
    get_cerebras_api_key_env,
    get_cerebras_base_url_env,
    get_codex_access_token_env,
    get_codex_account_id_env,
    get_codex_refresh_token_env,
    get_codex_token_expires_env,
    get_custom_llm_api_key_env,
    get_custom_llm_url_env,
    get_deepseek_api_key_env,
    get_deepseek_base_url_env,
    get_disable_thinking_env,
    get_fireworks_api_key_env,
    get_fireworks_base_url_env,
    get_google_api_key_env,
    get_litellm_api_key_env,
    get_litellm_base_url_env,
    get_lmstudio_api_key_env,
    get_lmstudio_base_url_env,
    get_ollama_url_env,
    get_openai_api_key_env,
    get_openrouter_api_key_env,
    get_openrouter_base_url_env,
    get_together_api_key_env,
    get_together_base_url_env,
    get_vertex_api_key_env,
    get_vertex_base_url_env,
    get_vertex_location_env,
    get_vertex_project_env,
    get_web_grounding_env,
)
from utils.available_models import normalize_openai_compatible_base_url
from utils.llm_provider import get_llm_provider
from utils.parsers import parse_bool_or_none
from utils.set_env import (
    set_codex_access_token_env,
    set_codex_account_id_env,
    set_codex_refresh_token_env,
    set_codex_token_expires_env,
)


CHATGPT_AUTH_REQUIRED_HEADERS = {"X-Presenton-Auth-Action": "codex-reauth"}
CHATGPT_AUTH_REQUIRED_PREFIX = "CHATGPT_AUTH_REQUIRED:"


def enable_web_grounding() -> bool:
    return parse_bool_or_none(get_web_grounding_env()) or False


def disable_thinking() -> bool:
    return parse_bool_or_none(get_disable_thinking_env()) or False


def _get_codex_access_token() -> str:
    access_token = get_codex_access_token_env()
    if not access_token:
        raise HTTPException(
            status_code=401,
            detail=(
                f"{CHATGPT_AUTH_REQUIRED_PREFIX} ChatGPT authentication is required. "
                "Please sign in again from Settings."
            ),
            headers=CHATGPT_AUTH_REQUIRED_HEADERS,
        )

    expires_str = get_codex_token_expires_env()
    if expires_str:
        try:
            expires_ms = int(expires_str)
            now_ms = int(time.time() * 1000)
            if now_ms >= expires_ms - 60_000:
                refresh_token = get_codex_refresh_token_env()
                if not refresh_token:
                    raise HTTPException(
                        status_code=401,
                        detail=(
                            f"{CHATGPT_AUTH_REQUIRED_PREFIX} Your ChatGPT session expired. "
                            "Please sign in again from Settings."
                        ),
                        headers=CHATGPT_AUTH_REQUIRED_HEADERS,
                    )

                from utils.oauth.openai_codex import (
                    TokenSuccess,
                    get_account_id,
                    refresh_access_token,
                )
                from utils.user_config import save_codex_tokens_to_user_config

                result = refresh_access_token(refresh_token)
                if not isinstance(result, TokenSuccess):
                    raise HTTPException(
                        status_code=401,
                        detail=(
                            f"{CHATGPT_AUTH_REQUIRED_PREFIX} Your ChatGPT session expired. "
                            "Please sign in again from Settings."
                        ),
                        headers=CHATGPT_AUTH_REQUIRED_HEADERS,
                    )

                set_codex_access_token_env(result.access)
                set_codex_refresh_token_env(result.refresh)
                set_codex_token_expires_env(str(result.expires))
                account_id = get_account_id(result.access)
                if account_id:
                    set_codex_account_id_env(account_id)
                save_codex_tokens_to_user_config()
                access_token = result.access
        except (TypeError, ValueError):
            pass

    return access_token


def get_llm_config(*, use_openai_responses_api: bool = False) -> ClientConfig:
    llm_provider = get_llm_provider()

    match llm_provider:
        case LLMProvider.OPENAI:
            api_key = get_openai_api_key_env()
            if not api_key:
                raise HTTPException(status_code=400, detail="OpenAI API Key is not set")
            return OpenAIClientConfig(
                api_key=api_key,
                api_type=(
                    OpenAIApiType.RESPONSES
                    if use_openai_responses_api
                    else OpenAIApiType.COMPLETIONS
                ),
            )
        case LLMProvider.DEEPSEEK:
            api_key = get_deepseek_api_key_env()
            if not api_key:
                raise HTTPException(status_code=400, detail="DeepSeek API Key is not set")
            base_url = get_deepseek_base_url_env()
            return DeepSeekClientConfig(
                api_key=api_key,
                base_url=base_url or None,
            )
        case LLMProvider.GOOGLE:
            api_key = get_google_api_key_env()
            if not api_key:
                raise HTTPException(status_code=400, detail="Google API Key is not set")
            return GoogleClientConfig(api_key=api_key)
        case LLMProvider.VERTEX:
            api_key = get_vertex_api_key_env()
            project = get_vertex_project_env()
            location = get_vertex_location_env()
            base_url = get_vertex_base_url_env()

            if api_key and (project or location):
                raise HTTPException(
                    status_code=400,
                    detail=(
                        "Vertex configuration is ambiguous. Configure either "
                        "VERTEX_API_KEY or VERTEX_PROJECT/VERTEX_LOCATION, not both."
                    ),
                )

            if api_key:
                return VertexAIClientConfig(
                    api_key=api_key,
                    base_url=base_url or None,
                )

            if not project:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        "Vertex configuration is incomplete. Set VERTEX_API_KEY "
                        "or VERTEX_PROJECT (optionally with VERTEX_LOCATION)."
                    ),
                )

            return VertexAIClientConfig(
                project=project,
                location=location or None,
                base_url=base_url or None,
            )
        case LLMProvider.AZURE:
            api_key = get_azure_openai_api_key_env()
            api_version = get_azure_openai_api_version_env()
            endpoint = get_azure_openai_endpoint_env()
            base_url = get_azure_openai_base_url_env()
            deployment = get_azure_openai_deployment_env()

            if not api_key:
                raise HTTPException(
                    status_code=400,
                    detail="Azure OpenAI API Key is not set",
                )
            if not api_version:
                raise HTTPException(
                    status_code=400,
                    detail="Azure OpenAI API Version is not set",
                )
            if not endpoint and not base_url:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        "Azure OpenAI endpoint is not set. "
                        "Configure AZURE_OPENAI_ENDPOINT or AZURE_OPENAI_BASE_URL."
                    ),
                )

            return AzureOpenAIClientConfig(
                api_key=api_key,
                api_version=api_version,
                endpoint=endpoint or None,
                base_url=base_url or None,
                deployment=deployment or None,
            )
        case LLMProvider.BEDROCK:
            region = (get_bedrock_region_env() or "us-east-1").strip()
            api_key = (get_bedrock_api_key_env() or "").strip()
            aws_access_key_id = (get_bedrock_aws_access_key_id_env() or "").strip()
            aws_secret_access_key = (get_bedrock_aws_secret_access_key_env() or "").strip()
            aws_session_token = (get_bedrock_aws_session_token_env() or "").strip()
            profile_name = (get_bedrock_profile_name_env() or "").strip()

            kwargs = {
                "region": region,
                "api_key": api_key or None,
                "aws_access_key_id": aws_access_key_id or None,
                "aws_secret_access_key": aws_secret_access_key or None,
                "aws_session_token": aws_session_token or None,
                "profile_name": profile_name or None,
            }
            if not kwargs["api_key"] and not (
                kwargs["aws_access_key_id"] and kwargs["aws_secret_access_key"]
            ):
                raise HTTPException(
                    status_code=400,
                    detail=(
                        "Bedrock auth is incomplete. Set BEDROCK_API_KEY, or "
                        "set BEDROCK_AWS_ACCESS_KEY_ID and "
                        "BEDROCK_AWS_SECRET_ACCESS_KEY."
                    ),
                )
            return BedrockClientConfig(**kwargs)
        case LLMProvider.ANTHROPIC:
            api_key = get_anthropic_api_key_env()
            if not api_key:
                raise HTTPException(
                    status_code=400,
                    detail="Anthropic API Key is not set",
                )
            return AnthropicClientConfig(api_key=api_key)
        case LLMProvider.OPENROUTER:
            api_key = get_openrouter_api_key_env()
            if not api_key:
                raise HTTPException(
                    status_code=400,
                    detail="OpenRouter API Key is not set",
                )
            base_url = get_openrouter_base_url_env()
            return OpenRouterClientConfig(
                api_key=api_key,
                base_url=base_url or None,
            )
        case LLMProvider.FIREWORKS:
            api_key = (get_fireworks_api_key_env() or "").strip()
            if not api_key:
                raise HTTPException(
                    status_code=400,
                    detail="Fireworks API Key is not set",
                )
            base_url = (get_fireworks_base_url_env() or "").strip()
            return FireworksClientConfig(
                api_key=api_key,
                base_url=base_url or None,
            )
        case LLMProvider.TOGETHER:
            api_key = (get_together_api_key_env() or "").strip()
            if not api_key:
                raise HTTPException(
                    status_code=400,
                    detail="Together API Key is not set",
                )
            base_url = (get_together_base_url_env() or "").strip()
            return TogetherAIClientConfig(
                api_key=api_key,
                base_url=base_url or None,
            )
        case LLMProvider.CEREBRAS:
            api_key = get_cerebras_api_key_env()
            if not api_key:
                raise HTTPException(
                    status_code=400,
                    detail="Cerebras API Key is not set",
                )
            base_url = get_cerebras_base_url_env()
            return CerebrasClientConfig(
                api_key=api_key,
                base_url=base_url or None,
            )
        case LLMProvider.LITELLM:
            base_url = normalize_openai_compatible_base_url(
                get_litellm_base_url_env() or ""
            )
            if not base_url:
                raise HTTPException(
                    status_code=400,
                    detail="LiteLLM base URL is not set (LITELLM_BASE_URL).",
                )
            lk = (get_litellm_api_key_env() or "").strip()
            return LiteLLMClientConfig(
                base_url=base_url,
                api_key=lk if lk else None,
            )
        case LLMProvider.LMSTUDIO:
            base_url = (get_lmstudio_base_url_env() or "").strip()
            lk = (get_lmstudio_api_key_env() or "").strip()
            kwargs: dict = {"base_url": base_url or None}
            if lk:
                kwargs["api_key"] = lk
            return LMStudioClientConfig(**kwargs)
        case LLMProvider.OLLAMA:
            return OpenAIClientConfig(
                base_url=(get_ollama_url_env() or "http://localhost:11434") + "/v1",
                api_key="ollama",
            )
        case LLMProvider.CUSTOM:
            base_url = get_custom_llm_url_env()
            if not base_url:
                raise HTTPException(
                    status_code=400,
                    detail="Custom LLM URL is not set",
                )
            return OpenAIClientConfig(
                base_url=base_url,
                api_key=get_custom_llm_api_key_env() or "null",
            )
        case LLMProvider.CODEX:
            return ChatGPTClientConfig(
                access_token=_get_codex_access_token(),
                account_id=get_codex_account_id_env() or None,
            )
        case _:
            raise HTTPException(
                status_code=400,
                detail=(
                    "LLM Provider must be either openai, deepseek, google, vertex, azure, "
                    "bedrock, openrouter, fireworks, together, cerebras, "
                    "anthropic, litellm, lmstudio, ollama, custom, or codex"
                ),
            )


def get_extra_body(*, uses_tool_choice: bool = False) -> Optional[dict]:
    llm_provider = get_llm_provider()
    if llm_provider == LLMProvider.DEEPSEEK and (
        disable_thinking() or uses_tool_choice
    ):
        return {"thinking": {"type": "disabled"}}
    if llm_provider == LLMProvider.CUSTOM and disable_thinking():
        return {"enable_thinking": False}
    return None
