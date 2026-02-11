import { setLLMConfig } from "@/store/slices/userConfig";
import { store } from "@/store/store";
import { LLMConfig } from "@/types/llm_config";

export const handleSaveLLMConfig = async (llmConfig: LLMConfig) => {
  if (!hasValidLLMConfig(llmConfig)) {
    throw new Error("Provided configuration is not valid");
  }
  await fetch("/api/user-config", {
    method: "POST",
    body: JSON.stringify(llmConfig),
  });

  store.dispatch(setLLMConfig(llmConfig));
};

export const hasValidLLMConfig = (llmConfig: LLMConfig) => {
  if (!llmConfig.LLM) return false;
  if (!llmConfig.DISABLE_IMAGE_GENERATION && !llmConfig.IMAGE_PROVIDER)
    return false;

  const isOpenAIConfigValid =
    llmConfig.OPENAI_MODEL !== "" &&
    llmConfig.OPENAI_MODEL !== null &&
    llmConfig.OPENAI_MODEL !== undefined &&
    llmConfig.OPENAI_API_KEY !== "" &&
    llmConfig.OPENAI_API_KEY !== null &&
    llmConfig.OPENAI_API_KEY !== undefined;

  const isGoogleConfigValid =
    llmConfig.GOOGLE_MODEL !== "" &&
    llmConfig.GOOGLE_MODEL !== null &&
    llmConfig.GOOGLE_MODEL !== undefined &&
    llmConfig.GOOGLE_API_KEY !== "" &&
    llmConfig.GOOGLE_API_KEY !== null &&
    llmConfig.GOOGLE_API_KEY !== undefined;

  const isAnthropicConfigValid =
    llmConfig.ANTHROPIC_MODEL !== "" &&
    llmConfig.ANTHROPIC_MODEL !== null &&
    llmConfig.ANTHROPIC_MODEL !== undefined &&
    llmConfig.ANTHROPIC_API_KEY !== "" &&
    llmConfig.ANTHROPIC_API_KEY !== null &&
    llmConfig.ANTHROPIC_API_KEY !== undefined;

  const isOllamaConfigValid =
    llmConfig.OLLAMA_MODEL !== "" &&
    llmConfig.OLLAMA_MODEL !== null &&
    llmConfig.OLLAMA_MODEL !== undefined &&
    llmConfig.OLLAMA_URL !== "" &&
    llmConfig.OLLAMA_URL !== null &&
    llmConfig.OLLAMA_URL !== undefined;

  const isCustomConfigValid =
    llmConfig.CUSTOM_LLM_URL !== "" &&
    llmConfig.CUSTOM_LLM_URL !== null &&
    llmConfig.CUSTOM_LLM_URL !== undefined &&
    llmConfig.CUSTOM_MODEL !== "" &&
    llmConfig.CUSTOM_MODEL !== null &&
    llmConfig.CUSTOM_MODEL !== undefined;

  const shouldValidateImages = !llmConfig.DISABLE_IMAGE_GENERATION;

  const isImageConfigValid = () => {
    if (!shouldValidateImages) {
      return true;
    }
    switch (llmConfig.IMAGE_PROVIDER) {
      case "pexels":
        return llmConfig.PEXELS_API_KEY && llmConfig.PEXELS_API_KEY !== "";
      case "pixabay":
        return llmConfig.PIXABAY_API_KEY && llmConfig.PIXABAY_API_KEY !== "";
      case "dall-e-3":
        return llmConfig.OPENAI_API_KEY && llmConfig.OPENAI_API_KEY !== "";
      case "gpt-image-1.5":
        return llmConfig.OPENAI_API_KEY && llmConfig.OPENAI_API_KEY !== "";
      case "gemini_flash":
        return llmConfig.GOOGLE_API_KEY && llmConfig.GOOGLE_API_KEY !== "";
      case "nanobanana_pro":
        return llmConfig.GOOGLE_API_KEY && llmConfig.GOOGLE_API_KEY !== "";
      case "comfyui":
        return llmConfig.COMFYUI_URL && llmConfig.COMFYUI_URL !== "";
      default:
        return false;
    }
  };

  const isLLMConfigValid =
    llmConfig.LLM === "openai"
      ? isOpenAIConfigValid
      : llmConfig.LLM === "google"
      ? isGoogleConfigValid
      : llmConfig.LLM === "anthropic"
      ? isAnthropicConfigValid
      : llmConfig.LLM === "ollama"
      ? isOllamaConfigValid
      : llmConfig.LLM === "custom"
      ? isCustomConfigValid
      : false;

  return isLLMConfigValid && isImageConfigValid();
};
