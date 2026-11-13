"""Account-scoped Codex catalog. Responses are deliberately never cached."""
from typing import Any

import httpx
from fastapi import HTTPException
from pydantic import BaseModel, ConfigDict


CODEX_MODELS_URL = "https://chatgpt.com/backend-api/codex/models"
# Reviewed against the official Codex 0.169.0 catalog protocol, not Presenton's version.
CODEX_CLIENT_VERSION = "0.169.0"
SDK_REASONING_EFFORTS = frozenset({"none", "minimal", "low", "medium", "high", "xhigh", "max"})


class CodexModel(BaseModel):
    model_config = ConfigDict(frozen=True)

    id: str
    name: str
    description: str | None = None
    context_window: int | None = None
    input_modalities: tuple[str, ...] | None = None
    supported_reasoning_levels: tuple[str, ...] = ()
    default_reasoning_level: str | None = None
    parallel_tool_calls: bool | None = None
    supports_reasoning_summary_parameter: bool | None = None


class CodexModelsResponse(BaseModel):
    models: tuple[CodexModel, ...]
    client_version: str = CODEX_CLIENT_VERSION


def auth_required() -> HTTPException:
    return HTTPException(
        status_code=401,
        detail="CHATGPT_AUTH_REQUIRED: Please sign in to ChatGPT from Settings.",
        headers={"X-Presenton-Auth-Action": "codex-reauth"},
    )


def _invalid_catalog() -> HTTPException:
    return HTTPException(status_code=502, detail="ChatGPT returned an invalid model catalog.")


def parse_catalog(payload: Any) -> tuple[CodexModel, ...]:
    if not isinstance(payload, dict) or not isinstance(payload.get("models"), list):
        raise _invalid_catalog()
    models: list[tuple[int, CodexModel]] = []
    seen: set[str] = set()
    for entry in payload["models"]:
        if not isinstance(entry, dict):
            raise _invalid_catalog()
        if entry.get("visibility") != "list":
            continue
        slug, name = entry.get("slug"), entry.get("display_name")
        if not isinstance(slug, str) or not slug.strip() or not isinstance(name, str) or not name.strip():
            raise _invalid_catalog()
        if slug in seen:
            raise _invalid_catalog()
        seen.add(slug)
        levels = entry.get("supported_reasoning_levels", [])
        if not isinstance(levels, list):
            raise _invalid_catalog()
        efforts = tuple(dict.fromkeys(
            level["effort"] for level in levels
            if isinstance(level, dict) and isinstance(level.get("effort"), str) and level["effort"]
        ))
        # An opt-in/experimental maximum is not the model's effective context.
        context = entry.get("context_window")
        if type(context) is not int or context <= 0:
            context = None
        modalities = entry.get("input_modalities")
        if not isinstance(modalities, list) or not all(isinstance(value, str) for value in modalities):
            modalities = None
        priority = entry.get("priority", 0)
        models.append((priority if type(priority) is int else 0, CodexModel(
            id=slug, name=name,
            description=entry.get("description") if isinstance(entry.get("description"), str) else None,
            context_window=context,
            input_modalities=tuple(modalities) if modalities is not None else None,
            supported_reasoning_levels=efforts,
            default_reasoning_level=entry.get("default_reasoning_level") if isinstance(entry.get("default_reasoning_level"), str) else None,
            parallel_tool_calls=entry.get("parallel_tool_calls") if type(entry.get("parallel_tool_calls")) is bool else None,
            supports_reasoning_summary_parameter=entry.get("supports_reasoning_summary_parameter") if type(entry.get("supports_reasoning_summary_parameter")) is bool else None,
        )))
    models.sort(key=lambda item: (item[0], item[1].id))
    return tuple(model for _, model in models)


def fetch_catalog(access_token: str, account_id: str | None) -> tuple[CodexModel, ...]:
    headers = {"Authorization": f"Bearer {access_token}", "User-Agent": "Presenton"}
    if account_id:
        headers["ChatGPT-Account-ID"] = account_id
    try:
        with httpx.Client(timeout=httpx.Timeout(15.0, connect=5.0), follow_redirects=False) as client:
            response = client.get(CODEX_MODELS_URL, params={"client_version": CODEX_CLIENT_VERSION}, headers=headers)
    except (httpx.TimeoutException, httpx.TransportError):
        raise HTTPException(status_code=503, detail="ChatGPT model discovery is temporarily unavailable.") from None
    if response.status_code in {401, 403}:
        raise auth_required()
    if response.status_code == 429:
        raise HTTPException(status_code=503, detail="ChatGPT model discovery is temporarily rate limited.")
    if response.status_code != 200:
        raise HTTPException(status_code=502, detail="ChatGPT model discovery failed.")
    try:
        payload = response.json()
    except ValueError:
        raise _invalid_catalog() from None
    return parse_catalog(payload)


def validate_model(models: tuple[CodexModel, ...], model: str, config: dict[str, Any]) -> CodexModel:
    metadata = next((entry for entry in models if entry.id == model), None)
    if metadata is None:
        raise HTTPException(status_code=400, detail="The selected ChatGPT model is no longer available. Choose a model in Settings.")
    effort = str(config.get("LLM_REASONING_EFFORT") or "").strip().lower()
    if effort not in {"", "default"} and (effort not in SDK_REASONING_EFFORTS or effort not in metadata.supported_reasoning_levels):
        raise HTTPException(status_code=400, detail="The selected reasoning effort is not supported by this ChatGPT model and runtime.")
    disabled = str(config.get("LLM_REASONING_MODE") or "").lower() == "disabled"
    if disabled and metadata.supported_reasoning_levels and "none" not in metadata.supported_reasoning_levels:
        raise HTTPException(status_code=400, detail="This ChatGPT model does not advertise a way to disable reasoning.")
    if str(config.get("LLM_REASONING_MODE") or "").lower() == "enabled" and not any(level != "none" for level in metadata.supported_reasoning_levels):
        raise HTTPException(status_code=400, detail="Reasoning support for this ChatGPT model is unknown.")
    if config.get("LLM_REASONING_BUDGET_TOKENS") not in (None, "", "0", 0):
        raise HTTPException(status_code=400, detail="ChatGPT uses reasoning effort, not a reasoning token budget.")
    if config.get("LLM_CONTEXT_WINDOW") not in (None, ""):
        try:
            if int(config["LLM_CONTEXT_WINDOW"]) <= 0:
                raise ValueError
        except (TypeError, ValueError):
            raise HTTPException(status_code=400, detail="LLM_CONTEXT_WINDOW must be a positive integer.") from None
    if config.get("LLM_GENERATION_PROFILE") == "model_max":
        from llmai import get_model_capabilities
        if get_model_capabilities(model, provider="chatgpt").max_output_tokens.value is None:
            raise HTTPException(status_code=400, detail="The maximum output limit for this ChatGPT model is unknown. Choose another generation profile.")
    return metadata


def capability_overrides(metadata: CodexModel) -> dict[str, dict[str, Any]]:
    """Only advertise fields that the upstream catalog actually proves."""
    override: dict[str, Any] = {}
    levels = [level for level in metadata.supported_reasoning_levels if level in SDK_REASONING_EFFORTS]
    if levels:
        override["reasoning"] = True
        override["reasoning_levels"] = levels
    if metadata.parallel_tool_calls is not None:
        override["parallel_tool_calls"] = metadata.parallel_tool_calls
    return {f"chatgpt:{metadata.id}": override}
