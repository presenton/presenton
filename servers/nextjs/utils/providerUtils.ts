import { LLMConfig } from "@/types/llm_config";

export interface OllamaModel {
  label: string;
  value: string;
  size: string;
}

export interface DownloadingModel {
  name: string;
  size: number | null;
  downloaded: number | null;
  status: string;
  done: boolean;
}

export interface OllamaModelsResult {
  models: OllamaModel[];
  updatedConfig?: LLMConfig;
}

/**
 * Updates LLM configuration based on field changes
 */
export const updateLLMConfig = (
  currentConfig: LLMConfig,
  field: string,
  value: string | boolean
): LLMConfig => {
  const fieldMappings: Record<string, keyof LLMConfig> = {
    openai_api_key: "OPENAI_API_KEY",
    openai_model: "OPENAI_MODEL",
    google_api_key: "GOOGLE_API_KEY",
    google_model: "GOOGLE_MODEL",
    anthropic_api_key: "ANTHROPIC_API_KEY",
    anthropic_model: "ANTHROPIC_MODEL",
    ollama_url: "OLLAMA_URL",
    ollama_model: "OLLAMA_MODEL",
    custom_llm_url: "CUSTOM_LLM_URL",
    custom_llm_api_key: "CUSTOM_LLM_API_KEY",
    custom_model: "CUSTOM_MODEL",
    pexels_api_key: "PEXELS_API_KEY",
    pixabay_api_key: "PIXABAY_API_KEY",
    image_provider: "IMAGE_PROVIDER",
    disable_image_generation: "DISABLE_IMAGE_GENERATION",
    use_custom_url: "USE_CUSTOM_URL",
    tool_calls: "TOOL_CALLS",
    disable_thinking: "DISABLE_THINKING",
    extended_reasoning: "EXTENDED_REASONING",
    web_grounding: "WEB_GROUNDING",
    comfyui_url: "COMFYUI_URL",
    comfyui_workflow: "COMFYUI_WORKFLOW",
    dall_e_3_quality: "DALL_E_3_QUALITY",
    gpt_image_1_5_quality: "GPT_IMAGE_1_5_QUALITY",
  };

  const configKey = fieldMappings[field];
  if (configKey) {
    return { ...currentConfig, [configKey]: value };
  }

  return currentConfig;
};

/**
 * Changes the provider and sets appropriate defaults
 */
export const changeProvider = (
  currentConfig: LLMConfig,
  provider: string
): LLMConfig => {
  const newConfig = { ...currentConfig, LLM: provider };

  // Auto Select appropriate image provider based on the text models
  if (provider === "openai") {
    newConfig.IMAGE_PROVIDER = "gpt-image-1.5";
  } else if (provider === "google") {
    newConfig.IMAGE_PROVIDER = "gemini_flash";
  } else {
    newConfig.IMAGE_PROVIDER = "pexels"; // default for ollama and custom
  }

  return newConfig;
};


export const checkIfSelectedOllamaModelIsPulled = async (ollamaModel: string) => {
  try {
    const response = await fetch('/api/v1/ppt/ollama/models/available');
    const models = await response.json();
    const pulledModels = models.map((model: any) => model.name);
    return pulledModels.includes(ollamaModel);
  } catch (error) {
    console.error('Error checking if selected Ollama model is pulled:', error);
    return false;
  }
}


/**
 * Resets downloading model state
 */
export const resetDownloadingModel = (): DownloadingModel => ({
  name: "",
  size: null,
  downloaded: null,
  status: "",
  done: false,
});

/**
 * Pulls Ollama model with progress tracking
 * Returns a promise that resolves with the final downloading model state
 */
export const pullOllamaModel = async (
  model: string,
  onProgress?: (model: DownloadingModel) => void
): Promise<DownloadingModel> => {
  return new Promise((resolve, reject) => {
    const interval = setInterval(async () => {
      try {
        const response = await fetch(
          `/api/v1/ppt/ollama/model/pull?model=${model}`
        );
        if (response.status === 200) {
          const data = await response.json();
          if (data.done && data.status !== "error") {
            clearInterval(interval);
            onProgress?.(data);
            resolve(data);
          } else if (data.status === "error") {
            clearInterval(interval);
            const resetData = resetDownloadingModel();
            onProgress?.(resetData);
            reject(new Error("Error occurred while pulling model"));
          } else {
            onProgress?.(data);
          }
        } else {
          clearInterval(interval);
          const resetData = resetDownloadingModel();
          onProgress?.(resetData);
          if (response.status === 403) {
            reject(new Error("Request to Ollama Not Authorized"));
          }
          reject(new Error("Error occurred while pulling model"));
        }
      } catch (error) {
        clearInterval(interval);
        const resetData = resetDownloadingModel();
        onProgress?.(resetData);
        reject(error);
      }
    }, 1000);
  });
};