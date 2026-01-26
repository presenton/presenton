from enum import Enum


class LLMProvider(Enum):
    OLLAMA = "ollama"
    OPENAI = "openai"
    GOOGLE = "google"
    VERTEX_GOOGLE = "vertex_google"
    ANTHROPIC = "anthropic"
    VERTEX_ANTHROPIC = "vertex_anthropic"
    CUSTOM = "custom"
