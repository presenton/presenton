import { RootState } from '@/store/store';
import { IMAGE_PROVIDERS, LLM_PROVIDERS } from '@/utils/providerConstants';
import React from 'react'
import { useSelector } from 'react-redux';

const CurrentConfig = () => {
    const userConfigState = useSelector((state: RootState) => state.userConfig);
    const llmConfig = userConfigState.llm_config;
    const textProviderKey = llmConfig.LLM || "openai";
    const textProviderLabel =
        LLM_PROVIDERS[textProviderKey]?.label || textProviderKey;
    const selectedTextModel =
        textProviderKey === "openai"
            ? llmConfig.OPENAI_MODEL
            : textProviderKey === "google"
                ? llmConfig.GOOGLE_MODEL
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
    return (
        <p className="text-[10px] px-2.5 py-0.5 rounded-[50px] text-[#7A5AF8] border border-[#EDEEEF]  font-medium ">
            {textSummary} · {imageSummary}
        </p>

    )
}

export default CurrentConfig
