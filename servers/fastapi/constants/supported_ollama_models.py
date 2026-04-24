from models.ollama_model_metadata import OllamaModelMetadata


SUPPORTED_OLLAMA_MODELS = {
    "llama3:8b": OllamaModelMetadata(
        label="Llama 3:8b",
        value="llama3:8b",
        size="4.7GB",
    ),
    "llama3:70b": OllamaModelMetadata(
        label="Llama 3:70b",
        value="llama3:70b",
        size="40GB",
    ),
    "llama3.1:8b": OllamaModelMetadata(
        label="Llama 3.1:8b",
        value="llama3.1:8b",
        size="4.9GB",
    ),
    "llama3.1:70b": OllamaModelMetadata(
        label="Llama 3.1:70b",
        value="llama3.1:70b",
        size="43GB",
    ),
    "llama3.1:405b": OllamaModelMetadata(
        label="Llama 3.1:405b",
        value="llama3.1:405b",
        size="243GB",
    ),
    "llama3.2:1b": OllamaModelMetadata(
        label="Llama 3.2:1b",
        value="llama3.2:1b",
        size="1.3GB",
    ),
    "llama3.2:3b": OllamaModelMetadata(
        label="Llama 3.2:3b",
        value="llama3.2:3b",
        size="2GB",
    ),
    "llama3.3:70b": OllamaModelMetadata(
        label="Llama 3.3:70b",
        value="llama3.3:70b",
        size="43GB",
    ),
    "llama4:16x17b": OllamaModelMetadata(
        label="Llama 4:16x17b",
        value="llama4:16x17b",
        size="67GB",
    ),
    "llama4:128x17b": OllamaModelMetadata(
        label="Llama 4:128x17b",
        value="llama4:128x17b",
        size="245GB",
    ),
}

SUPPORTED_GEMMA_MODELS = {
    "gemma3:1b": OllamaModelMetadata(
        label="Gemma 3:1b",
        value="gemma3:1b",
        size="815MB",
    ),
    "gemma3:4b": OllamaModelMetadata(
        label="Gemma 3:4b",
        value="gemma3:4b",
        size="3.3GB",
    ),
    "gemma3:12b": OllamaModelMetadata(
        label="Gemma 3:12b",
        value="gemma3:12b",
        size="8.1GB",
    ),
    "gemma3:27b": OllamaModelMetadata(
        label="Gemma 3:27b",
        value="gemma3:27b",
        size="17GB",
    ),
}

SUPPORTED_DEEPSEEK_MODELS = {
    "deepseek-r1:1.5b": OllamaModelMetadata(
        label="DeepSeek R1:1.5b",
        value="deepseek-r1:1.5b",
        size="1.1GB",
    ),
    "deepseek-r1:7b": OllamaModelMetadata(
        label="DeepSeek R1:7b",
        value="deepseek-r1:7b",
        size="4.7GB",
    ),
    "deepseek-r1:8b": OllamaModelMetadata(
        label="DeepSeek R1:8b",
        value="deepseek-r1:8b",
        size="5.2GB",
    ),
    "deepseek-r1:14b": OllamaModelMetadata(
        label="DeepSeek R1:14b",
        value="deepseek-r1:14b",
        size="9GB",
    ),
    "deepseek-r1:32b": OllamaModelMetadata(
        label="DeepSeek R1:32b",
        value="deepseek-r1:32b",
        size="20GB",
    ),
    "deepseek-r1:70b": OllamaModelMetadata(
        label="DeepSeek R1:70b",
        value="deepseek-r1:70b",
        size="43GB",
    ),
    "deepseek-r1:671b": OllamaModelMetadata(
        label="DeepSeek R1:671b",
        value="deepseek-r1:671b",
        size="404GB",
    ),
}

SUPPORTED_QWEN_MODELS = {
    "qwen3:0.6b": OllamaModelMetadata(
        label="Qwen 3:0.6b",
        value="qwen3:0.6b",
        size="523MB",
    ),
    "qwen3:1.7b": OllamaModelMetadata(
        label="Qwen 3:1.7b",
        value="qwen3:1.7b",
        size="1.4GB",
    ),
    "qwen3:4b": OllamaModelMetadata(
        label="Qwen 3:4b",
        value="qwen3:4b",
        size="2.6GB",
    ),
    "qwen3:8b": OllamaModelMetadata(
        label="Qwen 3:8b",
        value="qwen3:8b",
        size="5.2GB",
    ),
    "qwen3:14b": OllamaModelMetadata(
        label="Qwen 3:14b",
        value="qwen3:14b",
        size="9.3GB",
    ),
    "qwen3:30b": OllamaModelMetadata(
        label="Qwen 3:30b",
        value="qwen3:30b",
        size="19GB",
    ),
    "qwen3:32b": OllamaModelMetadata(
        label="Qwen 3:32b",
        value="qwen3:32b",
        size="20GB",
    ),
    "qwen3:235b": OllamaModelMetadata(
        label="Qwen 3:235b",
        value="qwen3:235b",
        size="142GB",
    ),
}

SUPPORTED_GPT_OSS_MODELS = {
    "gpt-oss:20b": OllamaModelMetadata(
        label="GPT-OSS 20b",
        value="gpt-oss:20b",
        size="14GB",
    ),
    "gpt-oss:120b": OllamaModelMetadata(
        label="GPT-OSS 120b",
        value="gpt-oss:120b",
        size="65GB",
    ),
}

SUPPORTED_GEMMA4_MODELS = {
    "gemma4:latest": OllamaModelMetadata(
        label="Gemma 4:latest",
        value="gemma4:latest",
        size="9.6GB",
    ),
    "gemma4:e2b": OllamaModelMetadata(
        label="Gemma 4:e2b",
        value="gemma4:e2b",
        size="7.2GB",
    ),
    "gemma4:e4b": OllamaModelMetadata(
        label="Gemma 4:e4b",
        value="gemma4:e4b",
        size="9.6GB",
    ),
    "gemma4:26b": OllamaModelMetadata(
        label="Gemma 4:26b",
        value="gemma4:26b",
        size="18GB",
    ),
    "gemma4:31b": OllamaModelMetadata(
        label="Gemma 4:31b",
        value="gemma4:31b",
        size="20GB",
    ),

    # e2b variants
    "gemma4:e2b-it-q4_K_M": OllamaModelMetadata(
        label="Gemma 4:e2b-it-q4_K_M",
        value="gemma4:e2b-it-q4_K_M",
        size="7.2GB",
    ),
    "gemma4:e2b-it-q8_0": OllamaModelMetadata(
        label="Gemma 4:e2b-it-q8_0",
        value="gemma4:e2b-it-q8_0",
        size="8.1GB",
    ),
    "gemma4:e2b-it-bf16": OllamaModelMetadata(
        label="Gemma 4:e2b-it-bf16",
        value="gemma4:e2b-it-bf16",
        size="10GB",
    ),

    # e4b variants
    "gemma4:e4b-it-q4_K_M": OllamaModelMetadata(
        label="Gemma 4:e4b-it-q4_K_M",
        value="gemma4:e4b-it-q4_K_M",
        size="9.6GB",
    ),
    "gemma4:e4b-it-q8_0": OllamaModelMetadata(
        label="Gemma 4:e4b-it-q8_0",
        value="gemma4:e4b-it-q8_0",
        size="12GB",
    ),
    "gemma4:e4b-it-bf16": OllamaModelMetadata(
        label="Gemma 4:e4b-it-bf16",
        value="gemma4:e4b-it-bf16",
        size="16GB",
    ),

    # 26b variants
    "gemma4:26b-a4b-it-q4_K_M": OllamaModelMetadata(
        label="Gemma 4:26b-a4b-it-q4_K_M",
        value="gemma4:26b-a4b-it-q4_K_M",
        size="18GB",
    ),
    "gemma4:26b-a4b-it-q8_0": OllamaModelMetadata(
        label="Gemma 4:26b-a4b-it-q8_0",
        value="gemma4:26b-a4b-it-q8_0",
        size="28GB",
    ),

    # 31b variants
    "gemma4:31b-it-q4_K_M": OllamaModelMetadata(
        label="Gemma 4:31b-it-q4_K_M",
        value="gemma4:31b-it-q4_K_M",
        size="20GB",
    ),
    "gemma4:31b-it-q8_0": OllamaModelMetadata(
        label="Gemma 4:31b-it-q8_0",
        value="gemma4:31b-it-q8_0",
        size="34GB",
    ),
    "gemma4:31b-it-bf16": OllamaModelMetadata(
        label="Gemma 4:31b-it-bf16",
        value="gemma4:31b-it-bf16",
        size="63GB",
    )
}

SUPPORTED_QWEN35_MODELS = {
    "qwen3.5:latest": OllamaModelMetadata(
        label="Qwen 3.5:latest",
        value="qwen3.5:latest",
        size="6.6GB",
    ),
    "qwen3.5:2b": OllamaModelMetadata(
        label="Qwen 3.5:2b",
        value="qwen3.5:2b",
        size="2.7GB",
    ),
    "qwen3.5:4b": OllamaModelMetadata(
        label="Qwen 3.5:4b",
        value="qwen3.5:4b",
        size="3.4GB",
    ),
    "qwen3.5:9b": OllamaModelMetadata(
        label="Qwen 3.5:9b",
        value="qwen3.5:9b",
        size="6.6GB",
    ),
    "qwen3.5:27b": OllamaModelMetadata(
        label="Qwen 3.5:27b",
        value="qwen3.5:27b",
        size="17GB",
    ),
    "qwen3.5:35b": OllamaModelMetadata(
        label="Qwen 3.5:35b",
        value="qwen3.5:35b",
        size="24GB",
    ),
    "qwen3.5:122b": OllamaModelMetadata(
        label="Qwen 3.5:122b",
        value="qwen3.5:122b",
        size="81GB",
    )
}

SUPPORTED_OLLAMA_MODELS = {
    **SUPPORTED_OLLAMA_MODELS,
    **SUPPORTED_GEMMA_MODELS,
    **SUPPORTED_DEEPSEEK_MODELS,
    **SUPPORTED_QWEN_MODELS,
    **SUPPORTED_GPT_OSS_MODELS,
    **SUPPORTED_GEMMA4_MODELS,
    **SUPPORTED_QWEN35_MODELS,
}
