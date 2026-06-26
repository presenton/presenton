from enum import Enum


class LLMProvider(Enum):
    OLLAMA = "ollama"
    DEEPSEEK = "deepseek"
    OPENAI = "openai"
    GOOGLE = "google"
    VERTEX = "vertex"
    AZURE = "azure"
    BEDROCK = "bedrock"
    OPENROUTER = "openrouter"
    FIREWORKS = "fireworks"
    TOGETHER = "together"
    CEREBRAS = "cerebras"
    ANTHROPIC = "anthropic"
    LITELLM = "litellm"
    LMSTUDIO = "lmstudio"
    CUSTOM = "custom"
    CODEX = "codex"
