export interface ModelOption {
  value: string;
  label: string;
  description?: string;
  icon?: string;
  size: string;
}

export interface ImageProviderOption {
  value: string;
  label: string;
  description?: string;
  icon?: string;
  requiresApiKey?: boolean;
  apiKeyField?: string;
  apiKeyFieldLabel?: string;
  getApiKeyUrl?: string;
}

export interface LLMProviderOption {
  value: string;
  label: string;
  description?: string;
  model_value?: string;
  model_label?: string;
  url?: string;
  icon?: string;
  getApiKeyUrl?: string;
}

export interface WebSearchProviderOption {
  value: string;
  label: string;
  description: string;
  icon?: string;
  apiKeyField?: string;
  apiKeyLabel?: string;
  urlField?: string;
  urlLabel?: string;
}

export const WEB_SEARCH_PROVIDERS: Record<string, WebSearchProviderOption> = {
  auto: {
    value: "auto",
    label: "Default (Model)",
    description:
      "Use model-native web grounding when available. Otherwise web search stays off until you choose an external provider.",
    icon: "/providers/model-search.svg",
  },
  searxng: {
    value: "searxng",
    label: "SearXNG",
    description: "Use a self-hosted SearXNG instance.",
    icon: "/providers/searxng.svg",
    urlField: "SEARXNG_BASE_URL",
    urlLabel: "SearXNG base URL",
  },
  tavily: {
    value: "tavily",
    label: "Tavily",
    description: "Search API optimized for AI applications.",
    icon: "/providers/tavily.png",
    apiKeyField: "TAVILY_API_KEY",
    apiKeyLabel: "Tavily API key",
  },
  exa: {
    value: "exa",
    label: "Exa",
    description: "AI-native web search with extracted result highlights.",
    icon: "/providers/exa.png",
    apiKeyField: "EXA_API_KEY",
    apiKeyLabel: "Exa API key",
  },
  brave: {
    value: "brave",
    label: "Brave",
    description: "Brave Search API for web search results.",
    icon: "/providers/brave.svg",
    apiKeyField: "BRAVE_SEARCH_API_KEY",
    apiKeyLabel: "Brave Search API key",
  },
  // serper: {
  //   value: "serper",
  //   label: "Serper",
  //   description: "Google search results via Serper.",
  //   apiKeyField: "SERPER_API_KEY",
  //   apiKeyLabel: "Serper API key",
  // },
};

export const IMAGE_PROVIDERS: Record<string, ImageProviderOption> = {
  pexels: {
    value: "pexels",
    label: "Pexels",
    description: "Free stock photo and video platform",
    icon: "/providers/pexel.png",
    requiresApiKey: true,
    apiKeyField: "PEXELS_API_KEY",
    apiKeyFieldLabel: "Pexels API Key",
    getApiKeyUrl: "https://docs.presenton.ai/help/get-api-keys/get-pexels-api-key",
  },
  pixabay: {
    value: "pixabay",
    label: "Pixabay",
    description: "Free images and videos",
    icon: "/providers/pixabay.png",
    requiresApiKey: true,
    apiKeyField: "PIXABAY_API_KEY",
    apiKeyFieldLabel: "Pixabay API Key",
    getApiKeyUrl: "https://docs.presenton.ai/help/get-api-keys/get-pixabay-api-key",
  },
  "dall-e-3": {
    value: "dall-e-3",
    label: "DALL-E 3",
    description: "OpenAI's image generation model",
    icon: "/providers/openai.png",
    requiresApiKey: true,
    apiKeyField: "OPENAI_API_KEY",
    apiKeyFieldLabel: "OpenAI API Key",
    getApiKeyUrl: "https://www.google.com/search?q=how+to+get+openai+api+key&ie=UTF-8",
  },
  "gpt-image-1.5": {
    value: "gpt-image-1.5",
    label: "GPT Image 1.5",
    description: "OpenAI's image generation model",
    icon: "/providers/openai.png",
    requiresApiKey: true,
    apiKeyField: "OPENAI_API_KEY",
    apiKeyFieldLabel: "OpenAI API Key",
    getApiKeyUrl: "https://www.google.com/search?q=how+to+get+openai+api+key&ie=UTF-8",
  },
  gemini_flash: {
    value: "gemini_flash",
    label: "Gemini Flash",
    description: "Google's fast image generation model",
    icon: "/providers/gemini-color.svg",
    requiresApiKey: true,
    apiKeyField: "GOOGLE_API_KEY",
    apiKeyFieldLabel: "Google API Key",
    getApiKeyUrl: "https://www.google.com/search?q=how+to+get+google+AI+studio+api+key&sxsrf=ANbL-n5_hUGaEiG9v6k9VxZWyv0mqO0Jew%3A1776339625724",
  },
  nanobanana_pro: {
    value: "nanobanana_pro",
    label: "NanoBanana Pro",
    description: "Google's advanced image generation model",
    icon: "/providers/gemini-color.svg",
    requiresApiKey: true,
    apiKeyField: "GOOGLE_API_KEY",
    apiKeyFieldLabel: "Google API Key",
    getApiKeyUrl: "https://www.google.com/search?q=how+to+get+google+AI+studio+api+key&sxsrf=ANbL-n5_hUGaEiG9v6k9VxZWyv0mqO0Jew%3A1776339625724",
  },
  comfyui: {
    value: "comfyui",
    label: "ComfyUI",
    description: "Use your local ComfyUI server with custom workflows",
    icon: "/providers/comfyui-color.svg",
    requiresApiKey: false,
    apiKeyField: "COMFYUI_URL",
    apiKeyFieldLabel: "ComfyUI Server URL",
  },
  open_webui: {
    value: "open_webui",
    label: "Open WebUI",
    description: "Use your Open WebUI server for image generation",
    icon: "/providers/open-webui.png",
    requiresApiKey: false,
    apiKeyField: "OPEN_WEBUI_IMAGE_URL",
    apiKeyFieldLabel: "Open WebUI URL",
  },
  openai_compatible: {
    value: "openai_compatible",
    label: "Custom",
    description:
      "OpenAI-compatible /v1/images endpoint (LiteLLM, Azure, vLLM, etc.)",
    icon: "/providers/custom.svg",
    requiresApiKey: false,
    apiKeyField: "OPENAI_COMPAT_IMAGE_BASE_URL",
    apiKeyFieldLabel: "OpenAI-compatible base URL",
  },
};

export const LLM_PROVIDERS: Record<string, LLMProviderOption> = {
  codex: {
    value: "codex",
    label: "ChatGPT",
    description: "ChatGPT Plus/Pro via OAuth",
    icon: "/providers/openai.png",
  },
  openai: {
    value: "openai",
    label: "OpenAI",
    description: "OpenAI's latest text generation model",
    url: "https://api.openai.com/v1",
    icon: "/providers/openai.png",
    getApiKeyUrl: "https://www.google.com/search?q=how+to+get+openai+api+key&ie=UTF-8",
  },
  google: {
    value: "google",
    label: "Google",
    description: "Google's primary text generation model",
    url: "https://api.google.com/v1",
    icon: "/providers/gemini-color.svg",
    getApiKeyUrl: "https://www.google.com/search?q=how+to+get+google+AI+studio+api+key&sxsrf=ANbL-n5_hUGaEiG9v6k9VxZWyv0mqO0Jew%3A1776339625724",
  },
  vertex: {
    value: "vertex",
    label: "Vertex AI",
    description: "Google Vertex AI models",
    icon: "/providers/gemini-color.svg",
    getApiKeyUrl: "https://www.google.com/search?q=how+to+get+vertex+ai+api+key",
  },
  azure: {
    value: "azure",
    label: "Azure OpenAI",
    description: "Azure-hosted OpenAI deployments",
    icon: "/providers/openai.png",
    getApiKeyUrl: "https://www.google.com/search?q=azure+openai+api+key",
  },
  bedrock: {
    value: "bedrock",
    label: "Amazon Bedrock",
    description: "AWS Bedrock foundation models",
    icon: "/providers/custom.svg",
  },
  openrouter: {
    value: "openrouter",
    label: "OpenRouter",
    description: "Many models through OpenRouter’s OpenAI-compatible API",
    url: "https://openrouter.ai/api/v1",
    icon: "/providers/openai.png",
    getApiKeyUrl: "https://openrouter.ai/keys",
  },
  cerebras: {
    value: "cerebras",
    label: "Cerebras",
    description: "Cerebras Cloud via OpenAI-compatible API",
    url: "https://api.cerebras.ai/v1",
    icon: "/providers/openai.png",
    getApiKeyUrl: "https://inference-docs.cerebras.ai",
  },
  litellm: {
    value: "litellm",
    label: "LiteLLM",
    description: "OpenAI-compatible LiteLLM proxy or gateway",
    icon: "/providers/openai.png",
  },
  fireworks: {
    value: "fireworks",
    label: "Fireworks",
    description: "Fireworks AI via OpenAI-compatible API",
    url: "https://api.fireworks.ai/inference/v1",
    icon: "/providers/openai.png",
    getApiKeyUrl: "https://fireworks.ai/account/api-keys",
  },
  together: {
    value: "together",
    label: "Together AI",
    description: "Together AI via OpenAI-compatible API",
    url: "https://api.together.ai/v1",
    icon: "/providers/openai.png",
    getApiKeyUrl: "https://api.together.xyz/settings/api-keys",
  },
  lmstudio: {
    value: "lmstudio",
    label: "LM Studio",
    description: "Local LM Studio OpenAI-compatible server",
    url: "http://localhost:1234/v1",
    icon: "/providers/lm-studio.svg",
  },
  anthropic: {
    value: "anthropic",
    label: "Anthropic",
    description: "Anthropic's Claude models",
    url: "https://api.anthropic.com/v1",
    icon: "/providers/claude-color.svg",
    getApiKeyUrl: "https://www.google.com/search?q=how+to+get+anthropic+api+key&sxsrf=ANbL-n7lsueZQ88L56HhqC1ch2PGD0rbNQ%3A1776339632265",
  },
  ollama: {
    value: "ollama",
    label: "Ollama",
    description: "Ollama's primary text generation model",
    icon: "/providers/ollama.svg",
  },
  custom: {
    value: "custom",
    label: "Custom",
    description: "OpenAI-compatible LLM",
    icon: "/providers/custom.svg",
  },

};

export const DALLE_3_QUALITY_OPTIONS = [
  {
    label: "Standard",
    value: "standard",
    description: "Faster generation with lower cost",
  },
  {
    label: "HD",
    value: "hd",
    description: "Higher quality images with increased cost",
  },
];

export const GPT_IMAGE_1_5_QUALITY_OPTIONS = [
  {
    label: "Low",
    value: "low",
    description: "Fastest and most cost-effective",
  },
  {
    label: "Medium",
    value: "medium",
    description: "Balanced quality and speed",
  },
  {
    label: "High",
    value: "high",
    description: "Best quality with longer generation time",
  },
];
