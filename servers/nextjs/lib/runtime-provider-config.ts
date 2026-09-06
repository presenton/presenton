import { readUserConfigFile } from "@/lib/user-config-store";
import { LLMConfig } from "@/types/llm_config";
import { hasValidLLMConfig, normalizeLLMConfig } from "@/utils/storeHelpers";


export const REDACTED_SECRET_PLACEHOLDER = "__configured__";

// Fail closed: new server settings must not silently become client fields.
const PUBLIC_TEXT_FIELDS = [
  "LLM",
  "OPENAI_MODEL",
  "DEEPSEEK_MODEL",
  "GOOGLE_MODEL",
  "VERTEX_MODEL",
  "AZURE_OPENAI_MODEL",
  "AZURE_OPENAI_API_VERSION",
  "AZURE_OPENAI_DEPLOYMENT",
  "BEDROCK_MODEL",
  "BEDROCK_REGION",
  "OPENROUTER_MODEL",
  "CEREBRAS_MODEL",
  "FIREWORKS_MODEL",
  "TOGETHER_MODEL",
  "ANTHROPIC_MODEL",
  "LITELLM_MODEL",
  "LMSTUDIO_MODEL",
  "OLLAMA_MODEL",
  "CUSTOM_MODEL",
  "CODEX_MODEL",
  "IMAGE_PROVIDER",
  "OPENAI_COMPAT_IMAGE_MODEL",
  "DALL_E_3_QUALITY",
  "GPT_IMAGE_1_5_QUALITY",
  "LLM_GENERATION_PROFILE",
  "LLM_REASONING_MODE",
  "LLM_REASONING_EFFORT",
  "WEB_SEARCH_PROVIDER",
  "WEB_SEARCH_MAX_RESULTS",
  "OPENROUTER_DATA_COLLECTION",
  "DISABLE_ANONYMOUS_TRACKING"
] as const;
const PUBLIC_BOOL_FIELDS = [
  "DISABLE_IMAGE_GENERATION",
  "DISABLE_THINKING",
  "EXTENDED_REASONING",
  "WEB_GROUNDING",
  "OPENROUTER_ALLOW_FALLBACKS",
  "OPENROUTER_REQUIRE_PARAMETERS",
  "OPENROUTER_ZDR",
  "CODEX_IS_PRO"
] as const;
const SERVER_PRESENCE_FIELDS = [
  "OPENAI_API_KEY",
  "DEEPSEEK_API_KEY",
  "GOOGLE_API_KEY",
  "VERTEX_API_KEY",
  "VERTEX_PROJECT",
  "VERTEX_LOCATION",
  "AZURE_OPENAI_API_KEY",
  "BEDROCK_API_KEY",
  "BEDROCK_AWS_ACCESS_KEY_ID",
  "BEDROCK_AWS_SECRET_ACCESS_KEY",
  "BEDROCK_AWS_SESSION_TOKEN",
  "OPENROUTER_API_KEY",
  "CEREBRAS_API_KEY",
  "FIREWORKS_API_KEY",
  "TOGETHER_API_KEY",
  "ANTHROPIC_API_KEY",
  "LITELLM_API_KEY",
  "LMSTUDIO_API_KEY",
  "CUSTOM_LLM_API_KEY",
  "PEXELS_API_KEY",
  "PIXABAY_API_KEY",
  "OPEN_WEBUI_IMAGE_API_KEY",
  "OPENAI_COMPAT_IMAGE_API_KEY",
  "TAVILY_API_KEY",
  "EXA_API_KEY",
  "BRAVE_SEARCH_API_KEY",
  "SERPER_API_KEY",
  "CODEX_ACCESS_TOKEN",
  "CODEX_REFRESH_TOKEN"
] as const;
const SERVER_ENDPOINT_FIELDS = [
  "DEEPSEEK_BASE_URL",
  "VERTEX_BASE_URL",
  "AZURE_OPENAI_ENDPOINT",
  "AZURE_OPENAI_BASE_URL",
  "OPENROUTER_BASE_URL",
  "CEREBRAS_BASE_URL",
  "FIREWORKS_BASE_URL",
  "TOGETHER_BASE_URL",
  "LITELLM_BASE_URL",
  "LMSTUDIO_BASE_URL",
  "OLLAMA_URL",
  "CUSTOM_LLM_URL",
  "COMFYUI_URL",
  "OPEN_WEBUI_IMAGE_URL",
  "OPENAI_COMPAT_IMAGE_BASE_URL",
  "SEARXNG_BASE_URL"
] as const;

export function publicProviderConfig(full: LLMConfig): LLMConfig {
  const input = full as Record<string, unknown>;
  const output: Record<string, unknown> = {};
  for (const key of PUBLIC_TEXT_FIELDS) {
    const value = input[key];
    if (typeof value === 'string' && value.length <= 512) output[key] = value;
  }
  for (const key of PUBLIC_BOOL_FIELDS) {
    if (typeof input[key] === 'boolean') output[key] = input[key];
  }
  const limit = input.LLM_MAX_OUTPUT_TOKENS;
  if (typeof limit === 'number' && Number.isSafeInteger(limit) && limit > 0) output.LLM_MAX_OUTPUT_TOKENS = limit;
  for (const key of SERVER_PRESENCE_FIELDS) {
    if (typeof input[key] === 'string' && input[key]) output[key] = REDACTED_SECRET_PLACEHOLDER;
  }
  // URLs and workflows can embed credentials. UI receives presence, not contents.
  for (const key of SERVER_ENDPOINT_FIELDS) {
    if (typeof input[key] === 'string' && input[key]) output[key] = 'https://server-managed.invalid';
  }
  if (typeof input.COMFYUI_WORKFLOW === 'string' && input.COMFYUI_WORKFLOW) output.COMFYUI_WORKFLOW = '{}';
  return output as LLMConfig;
}

export type RuntimeProviderConfig = {
  configured: boolean;
  config: LLMConfig;
};

/**
 * Return enough of the administrator-managed provider configuration for a
 * regular user to run the app without exposing shared credentials.
 */
export function readRuntimeProviderConfig(): RuntimeProviderConfig {
  const path = process.env.USER_CONFIG_PATH;
  if (!path) {
    return { configured: false, config: {} };
  }

  const full = normalizeLLMConfig(
    readUserConfigFile<LLMConfig>(path) || {}
  );
  const config = publicProviderConfig(full);

  return {
    configured: hasValidLLMConfig(full),
    config,
  };
}
