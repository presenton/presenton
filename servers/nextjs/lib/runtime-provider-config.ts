import { readUserConfigFile } from "@/lib/user-config-store";
import { LLMConfig } from "@/types/llm_config";
import { hasValidLLMConfig, normalizeLLMConfig } from "@/utils/storeHelpers";


export const REDACTED_SECRET_PLACEHOLDER = "__configured__";

// Match credential fields, not every field containing the word "token".
// Numeric settings such as LLM_MAX_OUTPUT_TOKENS must remain visible or the
// client-side config validator will reject an otherwise valid shared config.
const SECRET_FIELD =
  /(?:API_KEY|ACCESS_KEY_ID|SECRET_ACCESS_KEY|SESSION_TOKEN|ACCESS_TOKEN|REFRESH_TOKEN|PASSWORD)$/i;

// Keep in sync with scripts/user-config-env.cjs USER_CONFIG_ENV_KEYS.
const PROVIDER_ENV_KEYS = [
  "LLM",
  "OPENAI_API_KEY",
  "OPENAI_MODEL",
  "DEEPSEEK_API_KEY",
  "DEEPSEEK_MODEL",
  "DEEPSEEK_BASE_URL",
  "GOOGLE_API_KEY",
  "GOOGLE_MODEL",
  "VERTEX_API_KEY",
  "VERTEX_MODEL",
  "VERTEX_PROJECT",
  "VERTEX_LOCATION",
  "VERTEX_BASE_URL",
  "AZURE_OPENAI_API_KEY",
  "AZURE_OPENAI_MODEL",
  "AZURE_OPENAI_ENDPOINT",
  "AZURE_OPENAI_BASE_URL",
  "AZURE_OPENAI_API_VERSION",
  "AZURE_OPENAI_DEPLOYMENT",
  "BEDROCK_REGION",
  "BEDROCK_API_KEY",
  "BEDROCK_AWS_ACCESS_KEY_ID",
  "BEDROCK_AWS_SECRET_ACCESS_KEY",
  "BEDROCK_AWS_SESSION_TOKEN",
  "BEDROCK_PROFILE_NAME",
  "BEDROCK_MODEL",
  "OPENROUTER_API_KEY",
  "OPENROUTER_MODEL",
  "OPENROUTER_BASE_URL",
  "OPENROUTER_PROVIDER_ORDER",
  "OPENROUTER_ALLOW_FALLBACKS",
  "OPENROUTER_REQUIRE_PARAMETERS",
  "OPENROUTER_DATA_COLLECTION",
  "OPENROUTER_ZDR",
  "FIREWORKS_API_KEY",
  "FIREWORKS_MODEL",
  "FIREWORKS_BASE_URL",
  "TOGETHER_API_KEY",
  "TOGETHER_MODEL",
  "TOGETHER_BASE_URL",
  "CEREBRAS_API_KEY",
  "CEREBRAS_MODEL",
  "CEREBRAS_BASE_URL",
  "OLLAMA_URL",
  "OLLAMA_MODEL",
  "ANTHROPIC_API_KEY",
  "ANTHROPIC_MODEL",
  "CUSTOM_LLM_URL",
  "CUSTOM_LLM_API_KEY",
  "CUSTOM_MODEL",
  "LITELLM_BASE_URL",
  "LITELLM_API_KEY",
  "LITELLM_MODEL",
  "LMSTUDIO_BASE_URL",
  "LMSTUDIO_API_KEY",
  "LMSTUDIO_MODEL",
  "PEXELS_API_KEY",
  "PIXABAY_API_KEY",
  "IMAGE_PROVIDER",
  "DISABLE_IMAGE_GENERATION",
  "DISABLE_THINKING",
  "EXTENDED_REASONING",
  "LLM_GENERATION_PROFILE",
  "LLM_MAX_OUTPUT_TOKENS",
  "LLM_REASONING_MODE",
  "LLM_REASONING_EFFORT",
  "LLM_REASONING_BUDGET_TOKENS",
  "WEB_GROUNDING",
  "WEB_SEARCH_PROVIDER",
  "WEB_SEARCH_MAX_RESULTS",
  "SEARXNG_BASE_URL",
  "TAVILY_API_KEY",
  "EXA_API_KEY",
  "BRAVE_SEARCH_API_KEY",
  "SERPER_API_KEY",
  "COMFYUI_URL",
  "COMFYUI_WORKFLOW",
  "OPEN_WEBUI_IMAGE_URL",
  "OPEN_WEBUI_IMAGE_API_KEY",
  "OPENAI_COMPAT_IMAGE_BASE_URL",
  "OPENAI_COMPAT_IMAGE_API_KEY",
  "OPENAI_COMPAT_IMAGE_MODEL",
  "DALL_E_3_QUALITY",
  "GPT_IMAGE_1_5_QUALITY",
  "CODEX_MODEL",
] as const;

const BOOLEAN_ENV_KEYS = new Set([
  "DISABLE_IMAGE_GENERATION",
  "DISABLE_THINKING",
  "EXTENDED_REASONING",
  "OPENROUTER_ALLOW_FALLBACKS",
  "OPENROUTER_REQUIRE_PARAMETERS",
  "OPENROUTER_ZDR",
  "WEB_GROUNDING",
]);

export type RuntimeProviderConfig = {
  configured: boolean;
  config: LLMConfig;
};

function parseBooleanLike(value: string): boolean | undefined {
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return undefined;
}

/** Overlay container env onto file config (SaaS / CAN_CHANGE_KEYS=false). */
function mergeProviderEnv(fileConfig: LLMConfig): LLMConfig {
  const overlay: Record<string, unknown> = {};
  for (const key of PROVIDER_ENV_KEYS) {
    const raw = process.env[key];
    if (raw === undefined || raw === "") continue;
    if (BOOLEAN_ENV_KEYS.has(key)) {
      const parsed = parseBooleanLike(raw);
      if (parsed !== undefined) overlay[key] = parsed;
      continue;
    }
    if (key === "LLM_MAX_OUTPUT_TOKENS" || key === "LLM_REASONING_BUDGET_TOKENS") {
      const parsed = Number(raw);
      if (Number.isInteger(parsed)) overlay[key] = parsed;
      continue;
    }
    if (key === "OPENROUTER_PROVIDER_ORDER") {
      overlay[key] = raw
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);
      continue;
    }
    overlay[key] = raw;
  }
  return { ...fileConfig, ...overlay } as LLMConfig;
}

/**
 * Return enough of the administrator-managed provider configuration for a
 * regular user to run the app without exposing shared credentials.
 *
 * SaaS (CAN_CHANGE_KEYS=false) configures providers via container env. Merge
 * those env values so /api/runtime-config reports configured=true even when
 * userConfig.json still only holds auth bootstrap fields.
 */
export function readRuntimeProviderConfig(): RuntimeProviderConfig {
  const configPath = process.env.USER_CONFIG_PATH;
  const fileConfig = configPath
    ? (readUserConfigFile<LLMConfig>(configPath) || {})
    : {};
  const full = normalizeLLMConfig(mergeProviderEnv(fileConfig));
  if (!hasValidLLMConfig(full) && !configPath) {
    return { configured: false, config: {} };
  }

  const config = Object.fromEntries(
    Object.entries(full).map(([key, value]) => [
      key,
      SECRET_FIELD.test(key) && value
        ? REDACTED_SECRET_PLACEHOLDER
        : value,
    ])
  ) as LLMConfig;

  return {
    configured: hasValidLLMConfig(full),
    config,
  };
}
