const VALID_LLM_PROVIDERS = new Set([
  "ollama",
  "openai",
  "deepseek",
  "google",
  "vertex",
  "azure",
  "bedrock",
  "openrouter",
  "fireworks",
  "together",
  "cerebras",
  "anthropic",
  "litellm",
  "lmstudio",
  "custom",
  "codex",
]);

const USER_CONFIG_ENV_KEYS = [
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
  "WEB_GROUNDING",
  "WEB_SEARCH_PROVIDER",
  "WEB_SEARCH_MAX_RESULTS",
  "SEARXNG_BASE_URL",
  "TAVILY_API_KEY",
  "EXA_API_KEY",
  "BRAVE_SEARCH_API_KEY",
  "SERPER_API_KEY",
  "USE_CUSTOM_URL",
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
  "CODEX_ACCESS_TOKEN",
  "CODEX_REFRESH_TOKEN",
  "CODEX_TOKEN_EXPIRES",
  "CODEX_ACCOUNT_ID",
  "CODEX_USERNAME",
  "CODEX_EMAIL",
  "CODEX_IS_PRO",
  "DISABLE_ANONYMOUS_TRACKING",
];

const BOOLEAN_CONFIG_KEYS = new Set([
  "DISABLE_IMAGE_GENERATION",
  "DISABLE_THINKING",
  "EXTENDED_REASONING",
  "WEB_GROUNDING",
  "USE_CUSTOM_URL",
  "CODEX_IS_PRO",
]);

const envValue = (env, key) => {
  const value = env[key];
  return value === undefined || value === "" ? undefined : value;
};

const parseBooleanLike = (value) => {
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
};

const readUserConfigEnv = (env) => {
  const config = {};
  for (const key of USER_CONFIG_ENV_KEYS) {
    const value = envValue(env, key);
    if (value !== undefined) {
      config[key] = value;
    }
  }
  return config;
};

const normalizeConfigTypes = (config) => {
  for (const key of BOOLEAN_CONFIG_KEYS) {
    const parsedValue = parseBooleanLike(config[key]);
    if (parsedValue !== undefined) {
      config[key] = parsedValue;
    }
  }
  return config;
};

const normalizeImageConfig = (config) => {
  if (config.DISABLE_IMAGE_GENERATION || config.IMAGE_PROVIDER) {
    return config;
  }

  if (
    config.OPENAI_COMPAT_IMAGE_BASE_URL &&
    config.OPENAI_COMPAT_IMAGE_API_KEY &&
    config.OPENAI_COMPAT_IMAGE_MODEL
  ) {
    config.IMAGE_PROVIDER = "openai_compatible";
  } else if (config.OPEN_WEBUI_IMAGE_URL) {
    config.IMAGE_PROVIDER = "open_webui";
  } else if (config.COMFYUI_URL) {
    config.IMAGE_PROVIDER = "comfyui";
  } else if (config.PEXELS_API_KEY) {
    config.IMAGE_PROVIDER = "pexels";
  } else if (config.PIXABAY_API_KEY) {
    config.IMAGE_PROVIDER = "pixabay";
  } else if (config.LLM === "openai" && config.OPENAI_API_KEY) {
    config.IMAGE_PROVIDER = "gpt-image-1.5";
    config.GPT_IMAGE_1_5_QUALITY = config.GPT_IMAGE_1_5_QUALITY || "medium";
  } else if (config.LLM === "google" && config.GOOGLE_API_KEY) {
    config.IMAGE_PROVIDER = "gemini_flash";
  } else {
    config.DISABLE_IMAGE_GENERATION = true;
  }

  return config;
};

const sanitizeExistingConfig = (existingConfig) => {
  const config = { ...existingConfig };
  if (config.LLM && !VALID_LLM_PROVIDERS.has(config.LLM)) {
    delete config.LLM;
  }
  return config;
};

const buildUserConfigFromEnv = (existingConfig = {}, env = process.env) =>
  normalizeImageConfig(
    normalizeConfigTypes({
      ...sanitizeExistingConfig(existingConfig),
      ...readUserConfigEnv(env),
    })
  );

export {
  buildUserConfigFromEnv,
  parseBooleanLike,
  readUserConfigEnv,
  USER_CONFIG_ENV_KEYS,
  VALID_LLM_PROVIDERS,
};
