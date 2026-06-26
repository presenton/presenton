import { getApiUrl } from "@/utils/api";
import { LLMConfig } from "@/types/llm_config";

const LOCALHOST_OLLAMA_URL = "http://localhost:11434";
const DOCKER_HOST_OLLAMA_URL = "http://host.docker.internal:11434";
const OLLAMA_MODELS_CACHE_TTL_MS = 30_000;

type OllamaModelsCacheEntry = {
  expiresAt: number;
  promise: Promise<AvailableOllamaModel[]>;
};

let ollamaLibraryModelsPromise: Promise<OllamaLibraryModel[]> | null = null;
const ollamaModelsCache = new Map<string, OllamaModelsCacheEntry>();

export interface OllamaModel {
  label: string;
  value: string;
  size: string;
}

export interface AvailableOllamaModel {
  name: string;
  parameters: string | null;
  size: number | null;
}

export interface OllamaLibraryModel {
  name: string;
  description: string;
  parameters: string;
  size: string;
}

export interface OllamaPullProgressEvent {
  type: "status" | "progress" | "complete" | "error";
  status?: string;
  total?: number;
  completed?: number;
  progress?: number;
  model?: string;
  detail?: string;
}

export interface OllamaModelsResult {
  models: OllamaModel[];
  updatedConfig?: LLMConfig;
}

export interface ReachableOllamaModelsResult {
  models: AvailableOllamaModel[];
  resolvedUrl: string;
  usedFallback: boolean;
}

function isElectronRuntime(): boolean {
  return typeof window !== "undefined" && !!window.electron;
}

function normalizeOllamaUrl(url?: string): string {
  return (url || "").trim().replace(/\/+$/, "");
}

function getOllamaModelsCacheKey(ollamaUrl?: string): string {
  return normalizeOllamaUrl(ollamaUrl) || "__default__";
}

export function clearOllamaModelsCache(ollamaUrl?: string) {
  if (ollamaUrl === undefined) {
    ollamaModelsCache.clear();
    return;
  }
  ollamaModelsCache.delete(getOllamaModelsCacheKey(ollamaUrl));
}

export function getDefaultOllamaUrl(): string {
  return isElectronRuntime() ? LOCALHOST_OLLAMA_URL : DOCKER_HOST_OLLAMA_URL;
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
    deepseek_api_key: "DEEPSEEK_API_KEY",
    deepseek_model: "DEEPSEEK_MODEL",
    deepseek_base_url: "DEEPSEEK_BASE_URL",
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
    custom_llm_url: "CUSTOM_LLM_URL",
    custom_llm_api_key: "CUSTOM_LLM_API_KEY",
    custom_model: "CUSTOM_MODEL",
    pexels_api_key: "PEXELS_API_KEY",
    pixabay_api_key: "PIXABAY_API_KEY",
    image_provider: "IMAGE_PROVIDER",
    disable_image_generation: "DISABLE_IMAGE_GENERATION",
    disable_thinking: "DISABLE_THINKING",
    extended_reasoning: "EXTENDED_REASONING",
    web_grounding: "WEB_GROUNDING",
    web_search_provider: "WEB_SEARCH_PROVIDER",
    web_search_max_results: "WEB_SEARCH_MAX_RESULTS",
    searxng_base_url: "SEARXNG_BASE_URL",
    tavily_api_key: "TAVILY_API_KEY",
    exa_api_key: "EXA_API_KEY",
    brave_search_api_key: "BRAVE_SEARCH_API_KEY",
    serper_api_key: "SERPER_API_KEY",
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

  if (provider === "ollama" && !newConfig.OLLAMA_URL?.trim()) {
    newConfig.OLLAMA_URL = getDefaultOllamaUrl();
  }

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


function getOllamaApiUrl(
  path: string,
  params: Record<string, string | undefined>
): string {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value?.trim()) searchParams.set(key, value.trim());
  });
  const query = searchParams.toString();
  return getApiUrl(query ? `${path}?${query}` : path);
}

export const isOllamaModelAvailable = async (
  ollamaModel: string,
  ollamaUrl?: string
): Promise<boolean> => {
  const { models } = await getReachableOllamaModels(ollamaUrl);
  return models.some((model) => model.name === ollamaModel);
};

const fetchAvailableOllamaModels = async (
  ollamaUrl?: string
): Promise<AvailableOllamaModel[]> => {
  const normalizedUrl = normalizeOllamaUrl(ollamaUrl);
  const response = await fetch(
    getOllamaApiUrl("/api/v1/ppt/ollama/models/available", {
      ollama_url: normalizedUrl,
    })
  );
  if (!response.ok) {
    throw new Error(await getApiErrorMessage(response, "Could not list Ollama models"));
  }
  const models: unknown = await response.json();
  if (!Array.isArray(models)) {
    throw new Error("Ollama returned an invalid model list");
  }
  return models.flatMap((model) => {
    if (!model || typeof model !== "object" || !("name" in model)) return [];
    const name = (model as { name?: unknown }).name;
    const parameters = (model as { parameters?: unknown }).parameters;
    const size = (model as { size?: unknown }).size;
    if (typeof name !== "string") return [];
    return [
      {
        name,
        parameters:
          typeof parameters === "string" &&
          parameters.trim() &&
          parameters.trim().toLowerCase() !== "unknown"
            ? parameters
            : null,
        size: typeof size === "number" ? size : null,
      },
    ];
  });
};

export const getAvailableOllamaModels = async (
  ollamaUrl?: string
): Promise<AvailableOllamaModel[]> => {
  const cacheKey = getOllamaModelsCacheKey(ollamaUrl);
  const now = Date.now();
  const cached = ollamaModelsCache.get(cacheKey);

  if (cached && cached.expiresAt > now) {
    return cached.promise;
  }

  const promise = fetchAvailableOllamaModels(ollamaUrl);
  ollamaModelsCache.set(cacheKey, {
    expiresAt: now + OLLAMA_MODELS_CACHE_TTL_MS,
    promise,
  });

  try {
    return await promise;
  } catch (error) {
    ollamaModelsCache.delete(cacheKey);
    throw error;
  }
};

export const getReachableOllamaModels = async (
  ollamaUrl?: string
): Promise<ReachableOllamaModelsResult> => {
  const preferredUrl = normalizeOllamaUrl(ollamaUrl) || getDefaultOllamaUrl();

  try {
    const models = await getAvailableOllamaModels(preferredUrl);
    return { models, resolvedUrl: preferredUrl, usedFallback: false };
  } catch (error) {
    const shouldTryLocalFallback =
      !isElectronRuntime() && preferredUrl === DOCKER_HOST_OLLAMA_URL;
    if (!shouldTryLocalFallback) {
      throw error;
    }
    const models = await getAvailableOllamaModels(LOCALHOST_OLLAMA_URL);
    return {
      models,
      resolvedUrl: LOCALHOST_OLLAMA_URL,
      usedFallback: true,
    };
  }
};

async function getApiErrorMessage(
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
  }
  return fallback;
}

export const getOllamaLibraryModels = async (): Promise<OllamaLibraryModel[]> => {
  if (ollamaLibraryModelsPromise) {
    return ollamaLibraryModelsPromise;
  }

  ollamaLibraryModelsPromise = fetchOllamaLibraryModels();
  try {
    return await ollamaLibraryModelsPromise;
  } catch (error) {
    ollamaLibraryModelsPromise = null;
    throw error;
  }
};

const fetchOllamaLibraryModels = async (): Promise<OllamaLibraryModel[]> => {
  const response = await fetch(
    getApiUrl("/api/v1/ppt/ollama/models/library")
  );
  if (!response.ok) {
    throw new Error(await getApiErrorMessage(response, "Could not fetch Ollama library models"));
  }
  const models: unknown = await response.json();
  if (!Array.isArray(models)) {
    throw new Error("Invalid library model list");
  }
  return models.flatMap((model) => {
    if (!model || typeof model !== "object" || !("name" in model)) return [];
    const name = (model as { name?: unknown }).name;
    const description = (model as { description?: unknown }).description;
    const parameters = (model as { parameters?: unknown }).parameters;
    const size = (model as { size?: unknown }).size;
    if (typeof name !== "string") return [];
    return [{
      name,
      description: typeof description === "string" ? description : "",
      parameters:
        typeof parameters === "string" &&
        parameters.trim() &&
        parameters.trim().toLowerCase() !== "unknown"
          ? parameters
          : "",
      size: typeof size === "string" ? size : "",
    }];
  });
};

export const pullOllamaModel = async (
  modelName: string,
  ollamaUrl: string,
  onEvent: (event: OllamaPullProgressEvent) => void,
  signal?: AbortSignal
): Promise<void> => {
  const params = new URLSearchParams();
  params.set("model_name", modelName.trim());
  if (ollamaUrl.trim()) params.set("ollama_url", ollamaUrl.trim());

  const response = await fetch(
    getApiUrl(`/api/v1/ppt/ollama/models/pull?${params.toString()}`),
    { method: "POST", signal }
  );

  if (!response.ok) {
    const msg = await getApiErrorMessage(response, "Failed to pull model");
    onEvent({ type: "error", detail: msg });
    return;
  }

  const reader = response.body?.getReader();
  if (!reader) {
    onEvent({ type: "error", detail: "No response stream" });
    return;
  }

  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      let currentEvent = "";
      for (const line of lines) {
        if (line.startsWith("event: ")) {
          currentEvent = line.slice(7).trim();
        } else if (line.startsWith("data: ")) {
          const dataStr = line.slice(6);
          try {
            const data = JSON.parse(dataStr) as OllamaPullProgressEvent;
            if (currentEvent === "error" || data.type === "error") {
              onEvent({ type: "error", detail: data.detail || "Pull failed" });
              return;
            }
            onEvent(data);
            if (data.type === "complete") {
              clearOllamaModelsCache(ollamaUrl);
              return;
            }
          } catch {
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
};
