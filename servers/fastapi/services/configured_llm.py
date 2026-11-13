"""Resolve credentials, catalog metadata, model and client from one snapshot."""
import os
from dataclasses import dataclass, field
from types import MappingProxyType
from typing import Any, Mapping

from llmai import get_client
from llmai.chatgpt.client import ChatGPTClient
from openai import Omit

from services import codex_credentials
from services.codex_models import CodexModel, capability_overrides, fetch_catalog, validate_model
from utils.get_env import use_environment_snapshot
from utils.llm_config import get_extra_body, get_llm_config
from utils.llm_provider import get_model


@dataclass(frozen=True)
class ResolvedLLM:
    client: Any = field(repr=False)
    model: str
    metadata: CodexModel | None
    context_window: int | None
    client_config: Any = field(repr=False)


class CatalogChatGPTClient(ChatGPTClient):
    """Adapt only catalog-proven wire capabilities in the pinned SDK transport."""
    def __init__(self, *, config, metadata: CodexModel):
        self._catalog_metadata = metadata
        super().__init__(config=config)

    def _responses_request_kwargs(self, **kwargs):
        request = super()._responses_request_kwargs(**kwargs)
        if self._catalog_metadata.parallel_tool_calls is not None:
            request["extra_body"] = {
                **(request.get("extra_body") or {}),
                "parallel_tool_calls": self._catalog_metadata.parallel_tool_calls,
            }
        if self._catalog_metadata.supports_reasoning_summary_parameter is False:
            reasoning = request.get("reasoning")
            if isinstance(reasoning, dict):
                reasoning = {key: value for key, value in reasoning.items() if key != "summary"}
                request["reasoning"] = reasoning or Omit()
        return request


def _environment(config: Mapping[str, Any]) -> Mapping[str, str]:
    values = dict(os.environ)
    from models.user_config import UserConfig
    # The persisted provider object is authoritative. Removed overrides must not
    # reappear through process env left behind by a previous request.
    for key in UserConfig.model_fields:
        values.pop(key, None)
    for key, value in config.items():
        if key.startswith("_"):
            continue
        if value is None:
            values.pop(key, None)
        elif isinstance(value, bool):
            values[key] = str(value).lower()
        else:
            values[key] = str(value)
    return MappingProxyType(values)


def discover_models():
    credentials = codex_credentials.refresh_credentials()
    models = fetch_catalog(credentials.access_token, credentials.account_id)
    codex_credentials.ensure_current(credentials)
    return models


def validate_codex_configuration(config: dict[str, Any], *, credentials=None) -> CodexModel:
    credentials = credentials or codex_credentials.refresh_credentials()
    model = str(config.get("CODEX_MODEL") or "")
    metadata = validate_model(fetch_catalog(credentials.access_token, credentials.account_id), model, config)
    codex_credentials.ensure_current(credentials)
    # Validate the exact same generation settings before any persistence occurs.
    with use_environment_snapshot(_environment({**config, **{
        key: credentials.config.get(key) for key in codex_credentials.CREDENTIAL_FIELDS
    }})):
        try:
            sdk_config = get_llm_config()
            sdk_config.generation.capability_overrides = capability_overrides(metadata)
            from llmai.shared.generation import prepare_generation
            prepare_generation(model=model, provider="chatgpt", defaults=sdk_config.generation)
        except ValueError:
            from fastapi import HTTPException
            raise HTTPException(status_code=400, detail="Invalid ChatGPT generation settings.") from None
    return metadata


def resolve_configured_llm(
    *, use_openai_responses_api: bool = False,
    client_factory=None, config_factory=None, model_factory=None,
) -> ResolvedLLM:
    # Other providers retain their existing env contract, captured once. Codex
    # reads its authoritative DB config together with the credential revision.
    effective = MappingProxyType(dict(os.environ))
    metadata = None
    credentials = None
    if effective.get("LLM") in {"codex", "chatgpt"}:
        credentials = codex_credentials.refresh_credentials()
        snapshot = dict(credentials.config)
        effective = _environment(snapshot)
        # An account/provider switch while refresh was in flight starts a new
        # operation; no token from the old account is attached to the new config.
        if effective.get("LLM") not in {"codex", "chatgpt"}:
            from fastapi import HTTPException
            raise HTTPException(status_code=409, detail="Provider configuration changed. Retry the operation.")
        metadata = validate_model(
            fetch_catalog(credentials.access_token, credentials.account_id),
            str(snapshot.get("CODEX_MODEL") or ""), snapshot,
        )
        codex_credentials.ensure_current(credentials)
    with use_environment_snapshot(effective):
        model = (model_factory or get_model)()
        build_config = config_factory or get_llm_config
        config = build_config(use_openai_responses_api=True) if use_openai_responses_api else build_config()
        if metadata is not None:
            config.generation.capability_overrides = capability_overrides(metadata)
        client = CatalogChatGPTClient(config=config, metadata=metadata) if metadata is not None and (client_factory is None or client_factory is get_client) else (client_factory or get_client)(config=config)
        extra_bodies = {uses_tools: get_extra_body(uses_tool_choice=uses_tools) for uses_tools in (False, True)}
    # Consumers retain the context override captured with this client, rather
    # than rereading mutable process environment after awaiting other work.
    client._presenton_model_metadata = metadata
    client._presenton_context_window_override = effective.get("LLM_CONTEXT_WINDOW")
    client._presenton_extra_bodies = extra_bodies
    client._presenton_environment = effective
    return ResolvedLLM(client, model, metadata, metadata.context_window if metadata else None, config)
