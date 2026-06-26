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

  if (!normalizedConfig.LLM) {
    normalizedConfig.LLM = "openai";
  }

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

  if (!llmConfig.DISABLE_IMAGE_GENERATION && !llmConfig.IMAGE_PROVIDER) {
    return "Select an image provider, or turn off image generation.";
  }

  const llm = llmConfig.LLM;

  if (llm === "openai") {
    if (!isProvided(llmConfig.OPENAI_API_KEY)) {
      return "OpenAI API key is required.";
    }
    if (!isProvided(llmConfig.OPENAI_MODEL)) {
      return 'Text provider (OpenAI): choose a chat model on the Text Provider tab—use "Check models" after your API key, then pick a model. The model under Image Provider → Custom is only for image generation.';
    }
  } else if (llm === "deepseek") {
    if (!isProvided(llmConfig.DEEPSEEK_API_KEY)) {
      return "DeepSeek API key is required.";
    }
    if (!isProvided(llmConfig.DEEPSEEK_MODEL)) {
      return 'No DeepSeek model selected. Use "Check models" after entering your API key, then choose a model.';
    }
  } else if (llm === "google") {
    if (!isProvided(llmConfig.GOOGLE_API_KEY)) {
      return "Google API key is required.";
    }
    if (!isProvided(llmConfig.GOOGLE_MODEL)) {
      return 'No Google model selected. Use "Check models" after entering your API key, then choose a model.';
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
      return 'No Anthropic model selected. Use "Check models" after entering your API key, then choose a model.';
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
      return 'No model selected for your custom endpoint. Use "Check models" after entering the URL, then choose a model.';
    }
  } else if (llm === "litellm") {
    if (!isProvided(llmConfig.LITELLM_BASE_URL)) {
      return "LiteLLM base URL is required.";
    }
    if (!isProvided(llmConfig.LITELLM_MODEL)) {
      return 'Use "Check models" after entering the base URL, then choose a model.';
    }
  } else if (llm === "lmstudio") {
    if (!isProvided(llmConfig.LMSTUDIO_MODEL)) {
      return 'Use "Check models" to load local models from LM Studio, then choose one.';
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

export const handleSaveLLMConfig = async (llmConfig: LLMConfig) => {
  const normalizedConfig = normalizeLLMConfig(llmConfig);
  const validationError = getLLMConfigValidationError(normalizedConfig);
  if (validationError) {
    throw new Error(validationError);
  }

  // Prefer shared API routes; fallback to Electron IPC for packaged compatibility.
  if (typeof window !== "undefined" && window.electron?.setUserConfig) {
    await window.electron.setUserConfig(normalizedConfig);
  } else {
    await fetch("/api/user-config", {
      method: "POST",
      body: JSON.stringify(normalizedConfig),
    });
  }

  store.dispatch(setLLMConfig(normalizedConfig));
};

export const hasValidLLMConfig = (llmConfig: LLMConfig) =>
  getLLMConfigValidationError(llmConfig) === null;
