import { setLLMConfig } from "@/store/slices/userConfig";
import { store } from "@/store/store";
import { LLMConfig } from "@/types/llm_config";
import { isSupportedCodexModel } from "@/utils/codexModels";

function isProvided(value: unknown): boolean {
  return value !== "" && value !== null && value !== undefined;
}

function parseOptionalBool(value: unknown): boolean | undefined {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }
  return undefined;
}

export const normalizeLLMConfig = (llmConfig: LLMConfig): LLMConfig => {
  const normalizedConfig: LLMConfig = { ...llmConfig };

  const parsedDisableImageGeneration = parseOptionalBool(
    (normalizedConfig as Record<string, unknown>).DISABLE_IMAGE_GENERATION
  );
  if (parsedDisableImageGeneration !== undefined) {
    normalizedConfig.DISABLE_IMAGE_GENERATION = parsedDisableImageGeneration;
  }
  const parsedWebGrounding = parseOptionalBool(
    (normalizedConfig as Record<string, unknown>).WEB_GROUNDING
  );
  if (parsedWebGrounding !== undefined) {
    normalizedConfig.WEB_GROUNDING = parsedWebGrounding;
  }
  for (const key of [
    "OPENROUTER_ALLOW_FALLBACKS",
    "OPENROUTER_REQUIRE_PARAMETERS",
    "OPENROUTER_ZDR",
  ] as const) {
    const parsed = parseOptionalBool(
      (normalizedConfig as Record<string, unknown>)[key]
    );
    if (parsed !== undefined) normalizedConfig[key] = parsed;
  }
  for (const key of ["LLM_MAX_OUTPUT_TOKENS"] as const) {
    const value = (normalizedConfig as Record<string, unknown>)[key];
    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value);
      if (Number.isInteger(parsed)) normalizedConfig[key] = parsed;
    }
  }
  const hasManualTokenLimit = isProvided(
    (normalizedConfig as Record<string, unknown>).LLM_MAX_OUTPUT_TOKENS
  );
  if (
    normalizedConfig.LLM_GENERATION_PROFILE !== "model_max" ||
    hasManualTokenLimit
  ) {
    // Profiles are no longer user-facing. Keep only the internal model-max
    // marker used by the checkbox and remove any legacy preset selection.
    (normalizedConfig as Record<string, unknown>).LLM_GENERATION_PROFILE = "";
  }
  // Reasoning budget is no longer exposed in the UI. Sending an empty value
  // removes any previously saved budget instead of leaving a hidden override.
  (normalizedConfig as Record<string, unknown>).LLM_REASONING_BUDGET_TOKENS = "";
  if (normalizedConfig.LLM_REASONING_EFFORT === "none") {
    (normalizedConfig as Record<string, unknown>).LLM_REASONING_EFFORT = "";
  }
  const providerOrder = (normalizedConfig as Record<string, unknown>)
    .OPENROUTER_PROVIDER_ORDER;
  if (typeof providerOrder === "string") {
    normalizedConfig.OPENROUTER_PROVIDER_ORDER = providerOrder
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
  }

  return normalizedConfig;
};

/**
 * Returns a user-facing validation message, or null when the config is valid.
 */
export const getLLMConfigValidationError = (
  inputConfig: LLMConfig
): string | null => {
  const llmConfig = normalizeLLMConfig(inputConfig);

  if (!llmConfig.LLM) {
    return "Select a text provider.";
  }

  const llm = llmConfig.LLM;
  if (llm === "presenton") {
    return null;
  }

  const maxOutputTokens = (llmConfig as Record<string, unknown>)
    .LLM_MAX_OUTPUT_TOKENS;
  if (
    isProvided(maxOutputTokens) &&
    (typeof maxOutputTokens !== "number" ||
      !Number.isInteger(maxOutputTokens) ||
      maxOutputTokens <= 0)
  ) {
    return "Max output tokens must be a whole number greater than zero.";
  }

  if (!llmConfig.DISABLE_IMAGE_GENERATION && !llmConfig.IMAGE_PROVIDER) {
    return "Select an image provider, or turn off image generation.";
  }

  if (llm === "openai") {
    if (!isProvided(llmConfig.OPENAI_API_KEY)) {
      return "OpenAI API key is required.";
    }
    if (!isProvided(llmConfig.OPENAI_MODEL)) {
      return "Enter or select an OpenAI chat model ID on the Text Provider tab.";
    }
  } else if (llm === "deepseek") {
    if (!isProvided(llmConfig.DEEPSEEK_API_KEY)) {
      return "DeepSeek API key is required.";
    }
    if (!isProvided(llmConfig.DEEPSEEK_MODEL)) {
      return "Enter or select a DeepSeek model ID.";
    }
  } else if (llm === "google") {
    if (!isProvided(llmConfig.GOOGLE_API_KEY)) {
      return "Google API key is required.";
    }
    if (!isProvided(llmConfig.GOOGLE_MODEL)) {
      return "Enter or select a Google model ID.";
    }
  } else if (llm === "vertex") {
    const hasApiKey = isProvided(llmConfig.VERTEX_API_KEY);
    const hasProject = isProvided(llmConfig.VERTEX_PROJECT);
    const hasLocation = isProvided(llmConfig.VERTEX_LOCATION);
    if (!hasApiKey && !hasProject) {
      return "Vertex AI requires either a Vertex API key or a GCP project.";
    }
    if (hasApiKey && (hasProject || hasLocation)) {
      return "Use either Vertex API key mode or project/location mode, not both.";
    }
    if (!isProvided(llmConfig.VERTEX_MODEL)) {
      return "Vertex model is required.";
    }
  } else if (llm === "azure") {
    if (!isProvided(llmConfig.AZURE_OPENAI_API_KEY)) {
      return "Azure OpenAI API key is required.";
    }

    if (!isProvided(llmConfig.AZURE_OPENAI_ENDPOINT)) {
      return "Azure endpoint is required.";
    }

    if (!isProvided(llmConfig.AZURE_OPENAI_API_VERSION)) {
      return "Azure OpenAI API version is required.";
    }

    if (!isProvided(llmConfig.AZURE_OPENAI_MODEL)) {
      return "Azure model name is required.";
    }
  } else if (llm === "bedrock") {
    if (!isProvided(llmConfig.BEDROCK_MODEL)) {
      return "Bedrock model is required.";
    }
    const hasApiKey = isProvided(llmConfig.BEDROCK_API_KEY);
    const hasAwsAccess = isProvided(llmConfig.BEDROCK_AWS_ACCESS_KEY_ID);
    const hasAwsSecret = isProvided(llmConfig.BEDROCK_AWS_SECRET_ACCESS_KEY);
    if (!hasApiKey && !(hasAwsAccess && hasAwsSecret)) {
      return "Provide Bedrock API key, or AWS access key ID + secret key.";
    }
  } else if (llm === "openrouter") {
    if (!isProvided(llmConfig.OPENROUTER_API_KEY)) {
      return "OpenRouter API key is required.";
    }
    if (!isProvided(llmConfig.OPENROUTER_MODEL)) {
      return "Select or enter an OpenRouter model id.";
    }
  } else if (llm === "conifer") {
    if (!isProvided(llmConfig.CONIFER_API_KEY)) {
      return "Conifer API key is required.";
    }
    if (!isProvided(llmConfig.CONIFER_MODEL)) {
      return "Select or enter a Conifer model id.";
    }
  } else if (llm === "cerebras") {
    if (!isProvided(llmConfig.CEREBRAS_API_KEY)) {
      return "Cerebras API key is required.";
    }
    if (!isProvided(llmConfig.CEREBRAS_MODEL)) {
      return "Select or enter a Cerebras model id.";
    }
  } else if (llm === "fireworks") {
    if (!isProvided(llmConfig.FIREWORKS_API_KEY)) {
      return "Fireworks API key is required.";
    }
    if (!isProvided(llmConfig.FIREWORKS_MODEL)) {
      return "Select or enter a Fireworks model id.";
    }
  } else if (llm === "together") {
    if (!isProvided(llmConfig.TOGETHER_API_KEY)) {
      return "Together API key is required.";
    }
    if (!isProvided(llmConfig.TOGETHER_MODEL)) {
      return "Select or enter a Together model id.";
    }
  } else if (llm === "anthropic") {
    if (!isProvided(llmConfig.ANTHROPIC_API_KEY)) {
      return "Anthropic API key is required.";
    }
    if (!isProvided(llmConfig.ANTHROPIC_MODEL)) {
      return "Enter or select an Anthropic model ID.";
    }
  } else if (llm === "ollama") {
    if (!isProvided(llmConfig.OLLAMA_URL?.trim())) {
      return 'Ollama URL is required. Enter your Ollama server URL, or click "Check models" to fill the reachable default.';
    }
    if (!isProvided(llmConfig.OLLAMA_MODEL)) {
      return "Select an Ollama model. If none appear, confirm Ollama is running and reachable.";
    }
  } else if (llm === "custom") {
    if (!isProvided(llmConfig.CUSTOM_LLM_URL)) {
      return "Enter your custom LLM endpoint URL (OpenAI-compatible).";
    }
    if (!isProvided(llmConfig.CUSTOM_MODEL)) {
      return "Enter a model ID or alias for your custom endpoint.";
    }
  } else if (llm === "litellm") {
    if (!isProvided(llmConfig.LITELLM_BASE_URL)) {
      return "LiteLLM base URL is required.";
    }
    if (!isProvided(llmConfig.LITELLM_MODEL)) {
      return "Enter or select a LiteLLM model ID or alias.";
    }
  } else if (llm === "lmstudio") {
    if (!isProvided(llmConfig.LMSTUDIO_MODEL)) {
      return "Enter or select an LM Studio model ID.";
    }
  } else if (llm === "codex" || llm === "chatgpt") {
    if (!isProvided(llmConfig.CODEX_MODEL)) {
      return "Select a Codex model.";
    }
    if (!isSupportedCodexModel(llmConfig.CODEX_MODEL)) {
      return "Select a supported Codex model.";
    }
  } else {
    return "Unsupported or unknown text provider.";
  }

  if (!llmConfig.DISABLE_IMAGE_GENERATION) {
    switch (llmConfig.IMAGE_PROVIDER) {
      case "pexels":
        if (!isProvided(llmConfig.PEXELS_API_KEY)) {
          return "Pexels API key is required.";
        }
        break;
      case "pixabay":
        if (!isProvided(llmConfig.PIXABAY_API_KEY)) {
          return "Pixabay API key is required.";
        }
        break;
      case "dall-e-3":
        if (!isProvided(llmConfig.OPENAI_API_KEY)) {
          return "OpenAI API key is required for DALL·E 3.";
        }
        break;
      case "gpt-image-1.5":
        if (!isProvided(llmConfig.OPENAI_API_KEY)) {
          return "OpenAI API key is required for GPT Image 1.5.";
        }
        break;
      case "gemini_flash":
        if (!isProvided(llmConfig.GOOGLE_API_KEY)) {
          return "Google API key is required for Gemini Flash image generation.";
        }
        break;
      case "nanobanana_pro":
        if (!isProvided(llmConfig.GOOGLE_API_KEY)) {
          return "Google API key is required for NanoBanana Pro.";
        }
        break;
      case "comfyui":
        if (!isProvided(llmConfig.COMFYUI_URL)) {
          return "ComfyUI server URL is required.";
        }
        break;
      case "open_webui":
        if (!isProvided(llmConfig.OPEN_WEBUI_IMAGE_URL)) {
          return "Open WebUI URL is required.";
        }
        break;
      case "openai_compatible":
        if (
          !isProvided(llmConfig.OPENAI_COMPAT_IMAGE_BASE_URL?.trim()) ||
          !isProvided(llmConfig.OPENAI_COMPAT_IMAGE_API_KEY?.trim()) ||
          !isProvided(llmConfig.OPENAI_COMPAT_IMAGE_MODEL?.trim())
        ) {
          return "OpenAI-compatible image API requires base URL, API key, and model.";
        }
        break;
      default:
        return "Select a valid image provider.";
    }
  }

  if (llmConfig.WEB_GROUNDING) {
    if (!isProvided(llmConfig.WEB_SEARCH_PROVIDER)) {
      return "Select a web search provider, or turn off web search.";
    }
    switch (llmConfig.WEB_SEARCH_PROVIDER) {
      case "searxng":
        if (!isProvided(llmConfig.SEARXNG_BASE_URL)) {
          return "SearXNG base URL is required.";
        }
        break;
      case "tavily":
        if (!isProvided(llmConfig.TAVILY_API_KEY)) {
          return "Tavily API key is required.";
        }
        break;
      case "exa":
        if (!isProvided(llmConfig.EXA_API_KEY)) {
          return "Exa API key is required.";
        }
        break;
      case "brave":
        if (!isProvided(llmConfig.BRAVE_SEARCH_API_KEY)) {
          return "Brave Search API key is required.";
        }
        break;
      case "auto":
        break;
      default:
        return "Select a valid web search provider.";
    }
  }

  return null;
};

/** Codex is selected but no model chosen - block navigation away from Settings. */
export function isCodexMissingSelectedModel(llmConfig: LLMConfig): boolean {
  return llmConfig.LLM === "codex" && !isProvided(llmConfig.CODEX_MODEL);
}

/**
 * While on Settings with Codex selected and no model (e.g. after sign-out),
 * block leaving for non-Settings destinations.
 */
export function shouldBlockCodexOutboundNav(
  llmConfig: LLMConfig,
  destinationPath: string,
  currentPathname: string | null
): boolean {
  if (!isCodexMissingSelectedModel(llmConfig)) return false;
  const onSettings =
    currentPathname === "/settings" ||
    (currentPathname?.startsWith("/settings/") ?? false);
  if (!onSettings) return false;
  const path = destinationPath.split("?")[0] || "";
  if (path === "/settings" || path.startsWith("/settings/")) return false;
  return true;
}

/** Keep Redux in sync when Codex signs out so guards observe cleared CODEX_MODEL. */
export function syncStoreAfterCodexSignOut(): void {
  const prev = store.getState().userConfig.llm_config;
  store.dispatch(
    setLLMConfig({
      ...prev,
      LLM: "codex",
      CODEX_MODEL: "",
      CODEX_ACCESS_TOKEN: "",
      CODEX_REFRESH_TOKEN: "",
      CODEX_TOKEN_EXPIRES: "",
      CODEX_ACCOUNT_ID: "",
      CODEX_USERNAME: "",
      CODEX_EMAIL: "",
      CODEX_IS_PRO: false,
    })
  );
}

/** Clear the stale cloud selection immediately after Presenton is disconnected. */
export function syncStoreAfterPresentonDisconnect(): void {
  const prev = store.getState().userConfig.llm_config;
  store.dispatch(
    setLLMConfig({
      ...prev,
      LLM: "",
    })
  );
}

export const handleSaveLLMConfig = async (llmConfig: LLMConfig) => {
  const normalizedConfig = normalizeLLMConfig(llmConfig);
  const validationError = getLLMConfigValidationError(normalizedConfig);
  if (validationError) {
    throw new Error(validationError);
  }

  const response = await fetch("/api/user-config", {
    method: "POST",
    body: JSON.stringify(normalizedConfig),
  });
  if (!response.ok) {
    throw new Error(`Unable to save user configuration (${response.status})`);
  }

  store.dispatch(setLLMConfig(normalizedConfig));
};

export const hasValidLLMConfig = (llmConfig: LLMConfig) =>
  getLLMConfigValidationError(llmConfig) === null;
