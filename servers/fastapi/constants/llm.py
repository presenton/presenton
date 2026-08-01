OPENAI_URL = "https://api.openai.com/v1"

# Default models
DEFAULT_OPENAI_MODEL = "gpt-4.1"
DEFAULT_DEEPSEEK_MODEL = "deepseek-chat"
DEFAULT_GOOGLE_MODEL = "models/gemini-2.5-flash"
DEFAULT_VERTEX_MODEL = "gemini-2.5-flash"
DEFAULT_AZURE_MODEL = "gpt-4.1"
DEFAULT_BEDROCK_MODEL = "us.anthropic.claude-3-5-haiku-20241022-v1:0"
DEFAULT_OPENROUTER_MODEL = "openai/gpt-4o"
ORCAROUTER_URL = "https://api.orcarouter.ai/v1"
# Pinned rather than the "orcarouter/auto" router: presentation generation
# depends on strict json_schema structured output, and the auto router may pick
# an upstream that does not honour it.
DEFAULT_ORCAROUTER_MODEL = "openai/gpt-5.5"
DEFAULT_FIREWORKS_MODEL = "accounts/fireworks/models/llama-v3p1-8b-instruct"
DEFAULT_TOGETHER_MODEL = "openai/gpt-oss-20b"
DEFAULT_CEREBRAS_MODEL = "llama-3.3-70b"
DEFAULT_ANTHROPIC_MODEL = "claude-sonnet-4-20250514"
DEFAULT_LITELLM_MODEL = "gpt-4.1"
DEFAULT_LMSTUDIO_MODEL = "openai/gpt-oss-20b"
SUPPORTED_CODEX_MODELS = {
    "gpt-5.6-sol",
    "gpt-5.6-terra",
    "gpt-5.6-luna",
    "gpt-5.5",
    "gpt-5.4",
    "gpt-5.4-mini",
    "gpt-5.3-codex-spark",
}
DEFAULT_CODEX_MODEL = "gpt-5.6-luna"
