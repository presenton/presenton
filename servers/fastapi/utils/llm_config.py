import time
from typing import Optional

from fastapi import HTTPException
from llmai.shared import (
    AnthropicClientConfig,
    ChatGPTClientConfig,
    ClientConfig,
    GoogleClientConfig,
    OpenAIApiType,
    OpenAIClientConfig,
)

from enums.llm_provider import LLMProvider
from utils.get_env import (
    get_anthropic_api_key_env,
    get_codex_access_token_env,
    get_codex_account_id_env,
    get_codex_refresh_token_env,
    get_codex_token_expires_env,
    get_custom_llm_api_key_env,
    get_custom_llm_url_env,
    get_disable_thinking_env,
    get_google_api_key_env,
    get_ollama_url_env,
    get_openai_api_key_env,
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


def enable_web_grounding() -> bool:
    return parse_bool_or_none(get_web_grounding_env()) or False


def disable_thinking() -> bool:
    return parse_bool_or_none(get_disable_thinking_env()) or False


def _get_codex_access_token() -> str:
    access_token = get_codex_access_token_env()
    if not access_token:
        raise HTTPException(
            status_code=400,
            detail=(
                "Codex OAuth access token is not set. Please authenticate via "
                "/api/v1/ppt/codex/auth/initiate"
            ),
        )

    expires_str = get_codex_token_expires_env()
    if expires_str:
        try:
            expires_ms = int(expires_str)
            now_ms = int(time.time() * 1000)
            if now_ms >= expires_ms - 60_000:
                refresh_token = get_codex_refresh_token_env()
                if refresh_token:
                    from utils.oauth.openai_codex import (
                        TokenSuccess,
                        get_account_id,
                        refresh_access_token,
                    )

                    result = refresh_access_token(refresh_token)
                    if isinstance(result, TokenSuccess):
                        set_codex_access_token_env(result.access)
                        set_codex_refresh_token_env(result.refresh)
                        set_codex_token_expires_env(str(result.expires))
                        account_id = get_account_id(result.access)
                        if account_id:
                            set_codex_account_id_env(account_id)
                        access_token = result.access
        except (TypeError, ValueError):
            pass

    return access_token


def get_llm_config() -> ClientConfig:
    llm_provider = get_llm_provider()

    match llm_provider:
        case LLMProvider.OPENAI:
            api_key = get_openai_api_key_env()
            if not api_key:
                raise HTTPException(status_code=400, detail="OpenAI API Key is not set")
            return OpenAIClientConfig(
                api_key=api_key,
                api_type=OpenAIApiType.RESPONSES,
            )
        case LLMProvider.GOOGLE:
            api_key = get_google_api_key_env()
            if not api_key:
                raise HTTPException(status_code=400, detail="Google API Key is not set")
            return GoogleClientConfig(api_key=api_key)
        case LLMProvider.ANTHROPIC:
            api_key = get_anthropic_api_key_env()
            if not api_key:
                raise HTTPException(
                    status_code=400,
                    detail="Anthropic API Key is not set",
                )
            return AnthropicClientConfig(api_key=api_key)
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
                    "LLM Provider must be either openai, google, anthropic, "
                    "ollama, custom, or codex"
                ),
            )


def get_extra_body() -> Optional[dict]:
    if get_llm_provider() == LLMProvider.CUSTOM and disable_thinking():
        return {"enable_thinking": False}
    return None
