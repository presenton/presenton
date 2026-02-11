export interface LLMConfig {
  LLM?: string;

  // OpenAI
  OPENAI_API_KEY?: string;
  OPENAI_MODEL?: string;

  // Google
  GOOGLE_API_KEY?: string;
  GOOGLE_MODEL?: string;

  // Anthropic
  ANTHROPIC_API_KEY?: string;
  ANTHROPIC_MODEL?: string;

  // Ollama
  OLLAMA_URL?: string;
  OLLAMA_MODEL?: string;

  // Custom LLM
  CUSTOM_LLM_URL?: string;
  CUSTOM_LLM_API_KEY?: string;
  CUSTOM_MODEL?: string;

  // Image providers
  DISABLE_IMAGE_GENERATION?: boolean;
  IMAGE_PROVIDER?: string;
  PEXELS_API_KEY?: string;
  PIXABAY_API_KEY?: string;

  // ComfyUI
  COMFYUI_URL?: string;
  COMFYUI_WORKFLOW?: string;

  // Dalle 3 Quality
  DALL_E_3_QUALITY?: string;
  // GPT Image 1.5 Quality
  GPT_IMAGE_1_5_QUALITY?: string;

  // Other Configs
  TOOL_CALLS?: boolean;
  DISABLE_THINKING?: boolean;
  EXTENDED_REASONING?: boolean;
  WEB_GROUNDING?: boolean;

  // Only used in UI settings
  USE_CUSTOM_URL?: boolean;
}
