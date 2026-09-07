import time

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
    GenerationDefaults,
    GenerationProfile,
    GoogleClientConfig,
    LiteLLMClientConfig,
    OpenAIApiType,
    OpenAIClientConfig,
    OpenRouterClientConfig,
    ReasoningConfig,
    ReasoningEffortValue,
    VertexAIClientConfig,
)

from enums.llm_provider import LLMProvider
from utils.available_models import normalize_openai_compatible_base_url
from utils.get_env import (
    get_anthropic_api_key_env,
    get_azure_openai_api_key_env,
    get_azure_openai_api_version_env,
    get_azure_openai_base_url_env,
    get_azure_openai_deployment_env,
    get_azure_openai_endpoint_env,
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
    get_extended_reasoning_env,
    get_fireworks_api_key_env,
    get_fireworks_base_url_env,
    get_google_api_key_env,
    get_litellm_api_key_env,
    get_litellm_base_url_env,
    get_llm_generation_profile_env,
    get_llm_max_output_tokens_env,
    get_llm_reasoning_budget_tokens_env,
    get_llm_reasoning_effort_env,
    get_llm_reasoning_mode_env,
    get_llm_structured_outputs_env,
    get_lmstudio_api_key_env,
    get_lmstudio_base_url_env,
    get_ollama_url_env,
    get_openai_api_key_env,
    get_openrouter_allow_fallbacks_env,
    get_openrouter_api_key_env,
    get_openrouter_base_url_env,
    get_openrouter_data_collection_env,
    get_openrouter_provider_order_env,
    get_openrouter_require_parameters_env,
    get_openrouter_zdr_env,
    get_together_api_key_env,
    get_together_base_url_env,
    get_vertex_api_key_env,
    get_vertex_base_url_env,
    get_vertex_location_env,
    get_vertex_project_env,
    get_web_grounding_env,
)
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


def llm_structured_outputs_enabled() -> bool:
    """Whether LLM requests may send ``response_format`` (structured outputs).

    Some OpenAI-compatible providers/models (e.g. b.ai) reject
    ``response_format`` with ``{"type": "json_schema"}`` (HTTP 400, code
    400001) while accepting the same prompt without it. Set
    ``LLM_STRUCTURED_OUTPUTS=false`` to omit ``response_format`` from every
    generation request; the engine then parses JSON from the model's text
    response (with schema-validation repair retries). Defaults to enabled;
    only explicit falsey values (``0``/``false``/``no``/``off``) disable it.
    """
    value = (get_llm_structured_outputs_env() or "").strip().lower()
    return value not in {"0", "false", "no", "off"}


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


def _optional_int(value: str | None) -> int | None:
    if value is None or not value.strip():
        return None
    try:
        return int(value)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid integer value: {value}")


def has_explicit_reasoning_settings() -> bool:
    return any(
        value is not None and value.strip() != ""
        for value in (
            get_llm_reasoning_mode_env(),
            get_llm_reasoning_effort_env(),
            get_llm_reasoning_budget_tokens_env(),
        )
    )


def get_generation_defaults() -> GenerationDefaults:
    profile_value = (get_llm_generation_profile_env() or "balanced").strip()
    try:
        profile = GenerationProfile(profile_value)
    except ValueError as error:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid LLM_GENERATION_PROFILE: {profile_value}",
        ) from error

    reasoning = ReasoningConfig()
    mode = (get_llm_reasoning_mode_env() or "").strip().lower()
    effort = (get_llm_reasoning_effort_env() or "").strip().lower()
    budget = _optional_int(get_llm_reasoning_budget_tokens_env())

    if mode == "enabled":
        reasoning.enabled = True
    elif mode == "disabled":
        reasoning.enabled = False
    elif mode not in {"", "auto"}:
        raise HTTPException(status_code=400, detail=f"Invalid LLM_REASONING_MODE: {mode}")

    if effort not in {"", "default"}:
        try:
            reasoning.effort = ReasoningEffortValue(effort)
        except ValueError as error:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid LLM_REASONING_EFFORT: {effort}",
            ) from error
    if budget is not None:
        if budget < 0:
            raise HTTPException(
                status_code=400,
                detail="LLM_REASONING_BUDGET_TOKENS cannot be negative",
            )
        reasoning.budget_tokens = budget

    if not has_explicit_reasoning_settings():
        if parse_bool_or_none(get_disable_thinking_env()) is True:
            reasoning.enabled = False
        elif parse_bool_or_none(get_extended_reasoning_env()) is True:
            reasoning.enabled = True
            reasoning.effort = ReasoningEffortValue.HIGH

    max_output_tokens = _optional_int(get_llm_max_output_tokens_env())
    if max_output_tokens is not None and max_output_tokens <= 0:
        raise HTTPException(
            status_code=400,
            detail="LLM_MAX_OUTPUT_TOKENS must be greater than zero",
        )
    return GenerationDefaults(
        profile=profile,
        max_output_tokens=max_output_tokens,
        reasoning=reasoning,
    )


def _get_llm_config(*, use_openai_responses_api: bool = False) -> ClientConfig:
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
                api_type=OpenAIApiType.RESPONSES,
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
            base_url = normalize_openai_compatible_base_url(get_litellm_base_url_env() or "")
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


def get_llm_config(*, use_openai_responses_api: bool = False) -> ClientConfig:
    config = _get_llm_config(use_openai_responses_api=use_openai_responses_api)
    config.generation = get_generation_defaults()
    return config


def get_extra_body(*, uses_tool_choice: bool = False) -> dict | None:
    llm_provider = get_llm_provider()
    extra_body: dict = {}
    use_legacy_disable = disable_thinking() and not has_explicit_reasoning_settings()
    if llm_provider == LLMProvider.DEEPSEEK and (use_legacy_disable or uses_tool_choice):
        extra_body["thinking"] = {"type": "disabled"}
    if llm_provider == LLMProvider.CUSTOM and use_legacy_disable:
        extra_body["enable_thinking"] = False
    if llm_provider == LLMProvider.OPENROUTER:
        provider: dict = {}
        order = [
            item.strip()
            for item in (get_openrouter_provider_order_env() or "").split(",")
            if item.strip()
        ]
        if order:
            provider["order"] = order
        allow_fallbacks = parse_bool_or_none(get_openrouter_allow_fallbacks_env())
        if allow_fallbacks is not None:
            provider["allow_fallbacks"] = allow_fallbacks
        require_parameters = parse_bool_or_none(get_openrouter_require_parameters_env())
        if require_parameters is not None:
            provider["require_parameters"] = require_parameters
        data_collection = (get_openrouter_data_collection_env() or "").strip()
        if data_collection in {"allow", "deny"}:
            provider["data_collection"] = data_collection
        zdr = parse_bool_or_none(get_openrouter_zdr_env())
        if zdr is not None:
            provider["zdr"] = zdr
        if provider:
            extra_body["provider"] = provider
    return extra_body or None
