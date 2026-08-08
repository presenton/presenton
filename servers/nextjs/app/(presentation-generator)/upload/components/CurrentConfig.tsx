import { RootState } from '@/store/store';
import { IMAGE_PROVIDERS, LLM_PROVIDERS, WEB_SEARCH_PROVIDERS } from '@/utils/providerConstants';
import React from 'react'
import { useSelector } from 'react-redux';

const CurrentConfig = ({ webSearchEnabled }: { webSearchEnabled: boolean }) => {
    const userConfigState = useSelector((state: RootState) => state.userConfig);
    const llmConfig = userConfigState.llm_config;
    const textProviderKey = llmConfig.LLM || "openai";
    const textProviderLabel =
        LLM_PROVIDERS[textProviderKey]?.label || textProviderKey;
    const selectedTextModel =
        textProviderKey === "openai"
            ? llmConfig.OPENAI_MODEL
            : textProviderKey === "deepseek"
                ? llmConfig.DEEPSEEK_MODEL
            : textProviderKey === "google"
                ? llmConfig.GOOGLE_MODEL
                : textProviderKey === "vertex"
                    ? llmConfig.VERTEX_MODEL
                    : textProviderKey === "azure"
                        ? llmConfig.AZURE_OPENAI_MODEL
                        : textProviderKey === "bedrock"
                            ? llmConfig.BEDROCK_MODEL
                        : textProviderKey === "openrouter"
                            ? llmConfig.OPENROUTER_MODEL
                            : textProviderKey === "fireworks"
                                ? llmConfig.FIREWORKS_MODEL
                                : textProviderKey === "together"
                                    ? llmConfig.TOGETHER_MODEL
                            : textProviderKey === "cerebras"
                                ? llmConfig.CEREBRAS_MODEL
                                : textProviderKey === "litellm"
                                    ? llmConfig.LITELLM_MODEL
                                : textProviderKey === "lmstudio"
                                    ? llmConfig.LMSTUDIO_MODEL
                                : textProviderKey === "anthropic"
                                    ? llmConfig.ANTHROPIC_MODEL
                                    : textProviderKey === "ollama"
                                        ? llmConfig.OLLAMA_MODEL
                                        : textProviderKey === "custom"
                                            ? llmConfig.CUSTOM_MODEL
                                            : textProviderKey === "codex"
                                                ? llmConfig.CODEX_MODEL
                                                : "";
    const textSummary = selectedTextModel
        ? `${textProviderLabel} (${selectedTextModel})`
        : textProviderLabel;

    const imageSummary = llmConfig.DISABLE_IMAGE_GENERATION
        ? "Image generation disabled"
        : llmConfig.IMAGE_PROVIDER
            ? IMAGE_PROVIDERS[llmConfig.IMAGE_PROVIDER]?.label || llmConfig.IMAGE_PROVIDER
            : "No image provider";
    const webSearchProviderKey = (llmConfig.WEB_SEARCH_PROVIDER || "auto").toLowerCase();
    const webSearchProvider =
        WEB_SEARCH_PROVIDERS[webSearchProviderKey]?.label || webSearchProviderKey;
    const webSearchSummary = `Web: ${webSearchProvider} (${webSearchEnabled ? "On" : "Off"})`;

    return (
        <p className="rounded-[50px] border border-[#EDEEEF] px-2.5 py-0.5 text-[10px] font-medium text-[#7A5AF8] min-[1800px]:px-3 min-[1800px]:py-1 min-[1800px]:text-[11px] min-[2200px]:px-4 min-[2200px]:text-xs">
            {textSummary} · {imageSummary} · {webSearchSummary}
        </p>

    )
}

export default CurrentConfig
