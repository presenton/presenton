import { getApiUrl } from "@/utils/api";
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
  error?: string | null;
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
    vertex_api_key: "VERTEX_API_KEY",
    vertex_model: "VERTEX_MODEL",
    vertex_project: "VERTEX_PROJECT",
    vertex_location: "VERTEX_LOCATION",
    vertex_base_url: "VERTEX_BASE_URL",
    azure_openai_api_key: "AZURE_OPENAI_API_KEY",
    azure_openai_model: "AZURE_OPENAI_MODEL",
    azure_openai_endpoint: "AZURE_OPENAI_ENDPOINT",
    azure_openai_base_url: "AZURE_OPENAI_BASE_URL",
    azure_openai_api_version: "AZURE_OPENAI_API_VERSION",
    azure_openai_deployment: "AZURE_OPENAI_DEPLOYMENT",
    bedrock_region: "BEDROCK_REGION",
    bedrock_api_key: "BEDROCK_API_KEY",
    bedrock_aws_access_key_id: "BEDROCK_AWS_ACCESS_KEY_ID",
    bedrock_aws_secret_access_key: "BEDROCK_AWS_SECRET_ACCESS_KEY",
    bedrock_aws_session_token: "BEDROCK_AWS_SESSION_TOKEN",
    bedrock_profile_name: "BEDROCK_PROFILE_NAME",
    bedrock_model: "BEDROCK_MODEL",
    openrouter_api_key: "OPENROUTER_API_KEY",
    openrouter_model: "OPENROUTER_MODEL",
    openrouter_base_url: "OPENROUTER_BASE_URL",
    fireworks_api_key: "FIREWORKS_API_KEY",
    fireworks_model: "FIREWORKS_MODEL",
    fireworks_base_url: "FIREWORKS_BASE_URL",
    together_api_key: "TOGETHER_API_KEY",
    together_model: "TOGETHER_MODEL",
    together_base_url: "TOGETHER_BASE_URL",
    cerebras_api_key: "CEREBRAS_API_KEY",
    cerebras_model: "CEREBRAS_MODEL",
    cerebras_base_url: "CEREBRAS_BASE_URL",
    litellm_base_url: "LITELLM_BASE_URL",
    litellm_api_key: "LITELLM_API_KEY",
    litellm_model: "LITELLM_MODEL",
    lmstudio_base_url: "LMSTUDIO_BASE_URL",
    lmstudio_api_key: "LMSTUDIO_API_KEY",
    lmstudio_model: "LMSTUDIO_MODEL",
    anthropic_api_key: "ANTHROPIC_API_KEY",
    anthropic_model: "ANTHROPIC_MODEL",
    ollama_url: "OLLAMA_URL",
    ollama_model: "OLLAMA_MODEL",
    rodiumai_api_key: "RODIUMAI_API_KEY",
    rodiumai_model: "RODIUMAI_MODEL",
    rodiumai_base_url: "RODIUMAI_BASE_URL",
    custom_llm_url: "CUSTOM_LLM_URL",
    custom_llm_api_key: "CUSTOM_LLM_API_KEY",
    custom_model: "CUSTOM_MODEL",
    pexels_api_key: "PEXELS_API_KEY",
    pixabay_api_key: "PIXABAY_API_KEY",
    image_provider: "IMAGE_PROVIDER",
    disable_image_generation: "DISABLE_IMAGE_GENERATION",
    use_custom_url: "USE_CUSTOM_URL",
    disable_thinking: "DISABLE_THINKING",
    extended_reasoning: "EXTENDED_REASONING",
    web_grounding: "WEB_GROUNDING",
    comfyui_url: "COMFYUI_URL",
    comfyui_workflow: "COMFYUI_WORKFLOW",
    dall_e_3_quality: "DALL_E_3_QUALITY",
    gpt_image_1_5_quality: "GPT_IMAGE_1_5_QUALITY",
    open_webui_image_url: "OPEN_WEBUI_IMAGE_URL",
    open_webui_image_api_key: "OPEN_WEBUI_IMAGE_API_KEY",
    openai_compat_image_base_url: "OPENAI_COMPAT_IMAGE_BASE_URL",
    openai_compat_image_api_key: "OPENAI_COMPAT_IMAGE_API_KEY",
    openai_compat_image_model: "OPENAI_COMPAT_IMAGE_MODEL",
    codex_model: "CODEX_MODEL",
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
    newConfig.IMAGE_PROVIDER = "pexels";
  }

  return newConfig;
};


export const checkIfSelectedOllamaModelIsPulled = async (ollamaModel: string) => {
  try {
    const response = await fetch(getApiUrl('/api/v1/ppt/ollama/models/available'));
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

function abortPullError(): Error {
  const err = new Error("Download cancelled");
  err.name = "AbortError";
  return err;
}

function isAbortError(e: unknown): boolean {
  return e instanceof Error && e.name === "AbortError";
}

async function getPullErrorMessage(
  response: Response,
  fallback: string
): Promise<string> {
  try {
    const body = await response.json();
    if (typeof body?.detail === "string" && body.detail.trim()) {
      return body.detail;
    }
    if (typeof body?.error === "string" && body.error.trim()) {
      return body.error;
    }
  } catch {
    // Ignore parse errors and use fallback.
  }
  return fallback;
}

/**
 * Pulls Ollama model with progress tracking.
 * Pass an AbortSignal to stop polling (e.g. user cancels download).
 */
export const pullOllamaModel = async (
  model: string,
  onProgress?: (model: DownloadingModel) => void,
  signal?: AbortSignal
): Promise<DownloadingModel> => {
  return new Promise((resolve, reject) => {
    let interval: ReturnType<typeof setInterval> | null = null;
    let settled = false;
    let polling = false;

    const cleanup = () => {
      if (interval !== null) {
        clearInterval(interval);
        interval = null;
      }
      signal?.removeEventListener("abort", onAbort);
    };

    const onAbort = () => {
      if (settled) return;
      settled = true;
      cleanup();
      onProgress?.(resetDownloadingModel());
      reject(abortPullError());
    };

    if (signal?.aborted) {
      onAbort();
      return;
    }
    signal?.addEventListener("abort", onAbort);

    const pollOnce = async () => {
      if (settled || polling) {
        return;
      }

      if (signal?.aborted) {
        onAbort();
        return;
      }

      polling = true;
      try {
        const response = await fetch(
          getApiUrl(`/api/v1/ppt/ollama/model/pull?model=${model}`)
        );
        if (settled) return;
        if (response.status === 200) {
          const data = await response.json();
          if (data.done && data.status !== "error") {
            if (settled) return;
            settled = true;
            cleanup();
            onProgress?.(data);
            resolve(data);
          } else if (data.status === "error" || data.error) {
            if (settled) return;
            settled = true;
            cleanup();
            onProgress?.(resetDownloadingModel());
            reject(new Error(data.error || "Error occurred while pulling model"));
          } else {
            onProgress?.(data);
          }
        } else {
          if (settled) return;
          settled = true;
          cleanup();
          onProgress?.(resetDownloadingModel());
          if (response.status === 403) {
            reject(new Error("Request to Ollama Not Authorized"));
          } else {
            const errorMessage = await getPullErrorMessage(
              response,
              "Error occurred while pulling model"
            );
            reject(new Error(errorMessage));
          }
        }
      } catch (error) {
        if (settled) return;
        if (isAbortError(error)) {
          return;
        }
        settled = true;
        cleanup();
        onProgress?.(resetDownloadingModel());
        reject(error);
      } finally {
        polling = false;
      }
    };

    void pollOnce();
    interval = setInterval(() => {
      void pollOnce();
    }, 1000);
  });
};
