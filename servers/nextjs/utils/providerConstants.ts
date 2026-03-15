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
}

export interface LLMProviderOption {
  value: string;
  label: string;
  description?: string;
  model_value?: string;
  model_label?: string;
  url?: string;
  icon?: string;
}

export const IMAGE_PROVIDERS: Record<string, ImageProviderOption> = {
  pexels: {
    value: "pexels",
    label: "Pexels",
    description: "Free stock photo and video platform",
    icon: "/icons/pexels.png",
    requiresApiKey: true,
    apiKeyField: "PEXELS_API_KEY",
    apiKeyFieldLabel: "Pexels API Key",
  },
  pixabay: {
    value: "pixabay",
    label: "Pixabay",
    description: "Free images and videos",
    icon: "/icons/pixabay.png",
    requiresApiKey: true,
    apiKeyField: "PIXABAY_API_KEY",
    apiKeyFieldLabel: "Pixabay API Key",
  },
  "dall-e-3": {
    value: "dall-e-3",
    label: "DALL-E 3",
    description: "OpenAI's image generation model",
    icon: "/icons/dall-e.png",
    requiresApiKey: true,
    apiKeyField: "OPENAI_API_KEY",
    apiKeyFieldLabel: "OpenAI API Key",
  },
  "gpt-image-1.5": {
    value: "gpt-image-1.5",
    label: "GPT Image 1.5",
    description: "OpenAI's image generation model",
    icon: "/icons/gpt.png",
    requiresApiKey: true,
    apiKeyField: "OPENAI_API_KEY",
    apiKeyFieldLabel: "OpenAI API Key",
  },
  gemini_flash: {
    value: "gemini_flash",
    label: "Gemini Flash",
    description: "Google's fast image generation model",
    icon: "/icons/google.png",
    requiresApiKey: true,
    apiKeyField: "GOOGLE_API_KEY",
    apiKeyFieldLabel: "Google API Key",
  },
  nanobanana_pro: {
    value: "nanobanana_pro",
    label: "NanoBanana Pro",
    description: "Google's advanced image generation model",
    icon: "/icons/google.png",
    requiresApiKey: true,
    apiKeyField: "GOOGLE_API_KEY",
    apiKeyFieldLabel: "Google API Key",
  },
  comfyui: {
    value: "comfyui",
    label: "ComfyUI",
    description: "Use your local ComfyUI server with custom workflows",
    icon: "/icons/comfyui.png",
    requiresApiKey: false,
    apiKeyField: "COMFYUI_URL",
    apiKeyFieldLabel: "ComfyUI Server URL",
  },
  ollama_flux: {
    value: "ollama_flux",
    label: "Ollama x/flux-klein:9b",
    description: "Use your local Ollama with x/flux-klein:9b",
    icon: "/icons/ollama.png",
    requiresApiKey: false,
    apiKeyField: "",
    apiKeyFieldLabel: "",
  },
};

export const LLM_PROVIDERS: Record<string, LLMProviderOption> = {
  openai: {
    value: "openai",
    label: "OpenAI",
    description: "OpenAI's latest text generation model",
    url: "https://api.openai.com/v1",
    icon: "/icons/openai.png",
  },
  google: {
    value: "google",
    label: "Google",
    description: "Google's primary text generation model",
    url: "https://api.google.com/v1",
    icon: "/icons/google.png",
  },
  anthropic: {
    value: "anthropic",
    label: "Anthropic",
    description: "Anthropic's Claude models",
    url: "https://api.anthropic.com/v1",
    icon: "/icons/anthropic.png",
  },
  ollama: {
    value: "ollama",
    label: "Ollama",
    description: "Ollama's primary text generation model",
    icon: "/icons/ollama.png",
  },
  custom: {
    value: "custom",
    label: "Custom",
    description: "Custom LLM",
    icon: "/icons/custom.png",
  },
  codex: {
    value: "codex",
    label: "ChatGPT",
    description: "ChatGPT Plus/Pro via OAuth",
    icon: "/icons/chatgpt.png",
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