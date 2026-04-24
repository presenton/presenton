import { setLLMConfig } from "@/store/slices/userConfig";
import { store } from "@/store/store";
import { LLMConfig } from "@/types/llm_config";

function isProvided(value: unknown): boolean {
  return value !== "" && value !== null && value !== undefined;
}

/**
 * Returns a user-facing validation message, or null when the config is valid.
 */
export const getLLMConfigValidationError = (
  llmConfig: LLMConfig
): string | null => {
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
      return 'No OpenAI model selected. Use "Check models" after entering your API key, then choose a model.';
    }
  } else if (llm === "google") {
    if (!isProvided(llmConfig.GOOGLE_API_KEY)) {
      return "Google API key is required.";
    }
    if (!isProvided(llmConfig.GOOGLE_MODEL)) {
      return 'No Google model selected. Use "Check models" after entering your API key, then choose a model.';
    }
  } else if (llm === "anthropic") {
    if (!isProvided(llmConfig.ANTHROPIC_API_KEY)) {
      return "Anthropic API key is required.";
    }
    if (!isProvided(llmConfig.ANTHROPIC_MODEL)) {
      return 'No Anthropic model selected. Use "Check models" after entering your API key, then choose a model.';
    }
  } else if (llm === "ollama") {
    if (!isProvided(llmConfig.OLLAMA_URL)) {
      return "Ollama server URL is required.";
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
  } else if (llm === "codex" || llm === "chatgpt") {
    if (!isProvided(llmConfig.CODEX_MODEL)) {
      return "Select a Codex model.";
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
      default:
        return "Select a valid image provider.";
    }
  }

  return null;
};

export const handleSaveLLMConfig = async (llmConfig: LLMConfig) => {
  const validationError = getLLMConfigValidationError(llmConfig);
  if (validationError) {
    throw new Error(validationError);
  }
  await fetch("/api/user-config", {
    method: "POST",
    body: JSON.stringify(llmConfig),
  });

  store.dispatch(setLLMConfig(llmConfig));
};

export const hasValidLLMConfig = (llmConfig: LLMConfig) => {
  console.log('llmConfig', llmConfig);

  const validationError = getLLMConfigValidationError(llmConfig);
  console.log('validationError', validationError);
  return validationError === null;
}
