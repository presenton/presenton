import { readUserConfigFile } from "@/lib/user-config-store";
import { LLMConfig } from "@/types/llm_config";
import { hasValidLLMConfig, normalizeLLMConfig } from "@/utils/storeHelpers";


export const REDACTED_SECRET_PLACEHOLDER = "__configured__";

// Match credential fields, not every field containing the word "token".
// Numeric settings such as LLM_MAX_OUTPUT_TOKENS must remain visible or the
// client-side config validator will reject an otherwise valid shared config.
const SECRET_FIELD =
  /(?:API_KEY|ACCESS_KEY_ID|SECRET_ACCESS_KEY|SESSION_TOKEN|ACCESS_TOKEN|REFRESH_TOKEN|PASSWORD)$/i;

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
