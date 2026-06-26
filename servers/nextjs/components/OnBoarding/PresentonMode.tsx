import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../ui/collapsible';
import { Button } from '../ui/button';
import { ArrowUpRight, Blocks, Check, ChevronDown, ChevronLeft, ChevronUp, Eye, EyeOff, Info, Laptop, Loader2, Search } from 'lucide-react';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '../ui/command';
import { DALLE_3_QUALITY_OPTIONS, GPT_IMAGE_1_5_QUALITY_OPTIONS, IMAGE_PROVIDERS, LLM_PROVIDERS, WEB_SEARCH_PROVIDERS } from '@/utils/providerConstants';
import { cn } from '@/lib/utils';
import { LLMConfig } from '@/types/llm_config';
import { RootState } from '@/store/store';
import { useSelector } from 'react-redux';
import { notify } from '@/components/ui/sonner';
import ToolTip from '../ToolTip';
import { Switch } from '../ui/switch';
import { Select, SelectItem, SelectContent, SelectValue, SelectTrigger } from '../ui/select';
import { MixpanelEvent, trackEvent } from '@/utils/mixpanel';
import { usePathname } from 'next/navigation';
import { getLLMConfigValidationError, handleSaveLLMConfig } from '@/utils/storeHelpers';
import { getDefaultOllamaUrl, isOllamaModelAvailable } from '@/utils/providerUtils';
import { getApiErrorMessage, getApiUrl } from '@/utils/api';
import CodexConfig from '../CodexConfig';
import { CODEX_MODELS } from '@/utils/codexModels';
import VertexAzureManualFields from '@/components/VertexAzureManualFields';
import BedrockManualFields from '@/components/BedrockManualFields';
import OpenAICompatibleImageFields from '@/components/OpenAICompatibleImageFields';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import Image from 'next/image';
import OllamaConfig from '../OllamaConfig';

const MANUAL_MODEL_PROVIDERS = new Set(["vertex", "azure", "bedrock"]);
const LOCAL_PROVIDERS = ["ollama", "lmstudio"];
const OTHER_PROVIDERS = Object.values(LLM_PROVIDERS).filter(
    (provider) => provider.value !== "codex" && !LOCAL_PROVIDERS.includes(provider.value)
);
const OTHER_PROVIDER_VALUES = new Set(OTHER_PROVIDERS.map((provider) => provider.value));
type TextProviderTab = "chatgpt" | "local" | "other";

const getTextProviderTab = (provider?: string): TextProviderTab => {
    if (provider === "codex" || provider === "chatgpt") return "chatgpt";
    if (LOCAL_PROVIDERS.includes(provider || "")) return "local";
    return "other";
};

const WEB_SEARCH_PROVIDER_OPTIONS = [
    WEB_SEARCH_PROVIDERS.auto,
    WEB_SEARCH_PROVIDERS.searxng,
    WEB_SEARCH_PROVIDERS.tavily,
    WEB_SEARCH_PROVIDERS.exa,
    WEB_SEARCH_PROVIDERS.brave,
];

const PresentonMode = ({
    providerStep,
    setStep,
    setProviderStep,
}: {
    providerStep: number,
    setStep: (step: number) => void,
    setProviderStep: (step: number) => void,
}) => {
    const pathname = usePathname();
    const userConfigState = useSelector((state: RootState) => state.userConfig);
    const [openProviderSelect, setOpenProviderSelect] = useState(false);
    const [textProviderTab, setTextProviderTab] = useState<TextProviderTab>("chatgpt");
    const [chatGptAuthenticated, setChatGptAuthenticated] = useState(false);

    const [showApiKey, setShowApiKey] = useState(false);
    const [deepseekAdvancedOpen, setDeepseekAdvancedOpen] = useState(() =>
        !!(userConfigState.llm_config.DEEPSEEK_BASE_URL || '').trim()
    );
    const [availableModels, setAvailableModels] = useState<string[]>([]);
    const [openModelSelect, setOpenModelSelect] = useState(false);
    const [modelsLoading, setModelsLoading] = useState(false);
    const [modelsChecked, setModelsChecked] = useState(false);
    const [savingConfig, setSavingConfig] = useState(false);
    const [llmConfig, setLlmConfig] = useState<LLMConfig>(
        userConfigState.llm_config
    );
    const llmConfigRef = useRef(llmConfig);
    const isManualModelProvider = MANUAL_MODEL_PROVIDERS.has(llmConfig.LLM || "");
    const isActiveNonChatProvider =
        (textProviderTab === "local" && LOCAL_PROVIDERS.includes(llmConfig.LLM || "")) ||
        (textProviderTab === "other" && OTHER_PROVIDER_VALUES.has(llmConfig.LLM || ""));

    const handleProviderChange = (provider: string) => {
        trackEvent(MixpanelEvent.Onboarding_Text_Provider_Selected, {
            provider,
            provider_label: LLM_PROVIDERS[provider]?.label || provider,
            provider_group: LOCAL_PROVIDERS.includes(provider) ? "local" : "other",
            text_provider_tab: textProviderTab,
            selection_source: "provider_control",
        });
        setLlmConfig(prev => ({
            ...prev,
            LLM: provider,
            ...(provider === "ollama" && !prev.OLLAMA_URL?.trim()
                ? { OLLAMA_URL: getDefaultOllamaUrl() }
                : {}),
        }));
        setOpenProviderSelect(false);
        setAvailableModels([]);
        setModelsChecked(false);
        if (currentModelField) {
            setLlmConfig(prev => ({
                ...prev,
                [currentModelField]: ''
            }));
        }
    };

    const currentModelField = useMemo(() => {
        switch (llmConfig.LLM) {
            case 'openai':
                return 'OPENAI_MODEL';
            case 'deepseek':
                return 'DEEPSEEK_MODEL';
            case 'google':
                return 'GOOGLE_MODEL';
            case 'vertex':
                return 'VERTEX_MODEL';
            case 'azure':
                return 'AZURE_OPENAI_MODEL';
            case 'bedrock':
                return 'BEDROCK_MODEL';
            case 'openrouter':
                return 'OPENROUTER_MODEL';
            case 'fireworks':
                return 'FIREWORKS_MODEL';
            case 'together':
                return 'TOGETHER_MODEL';
            case 'cerebras':
                return 'CEREBRAS_MODEL';
            case 'anthropic':
                return 'ANTHROPIC_MODEL';
            case 'ollama':
                return 'OLLAMA_MODEL';
            case 'custom':
                return 'CUSTOM_MODEL';
            case 'litellm':
                return 'LITELLM_MODEL';
            case 'lmstudio':
                return 'LMSTUDIO_MODEL';
            default:
                return '';
        }
    }, [llmConfig.LLM]);
    const currentApiKeyField = useMemo(() => {
        switch (llmConfig.LLM) {
            case 'openai':
                return 'OPENAI_API_KEY';
            case 'deepseek':
                return 'DEEPSEEK_API_KEY';
            case 'google':
                return 'GOOGLE_API_KEY';
            case 'vertex':
                return 'VERTEX_API_KEY';
            case 'azure':
                return 'AZURE_OPENAI_API_KEY';
            case 'bedrock':
                return 'BEDROCK_API_KEY';
            case 'openrouter':
                return 'OPENROUTER_API_KEY';
            case 'fireworks':
                return 'FIREWORKS_API_KEY';
            case 'together':
                return 'TOGETHER_API_KEY';
            case 'cerebras':
                return 'CEREBRAS_API_KEY';
            case 'anthropic':
                return 'ANTHROPIC_API_KEY';
            case 'custom':
                return 'CUSTOM_LLM_API_KEY';
            case 'litellm':
                return 'LITELLM_API_KEY';
            case 'lmstudio':
                return 'LMSTUDIO_API_KEY';
            default:
                return '';
        }
    }, [llmConfig.LLM]);



    const getFieldValue = (field?: string) => {
        if (!field) return "";
        return (llmConfig as Record<string, string | undefined>)[field] || "";
    };

    const currentApiKey = currentApiKeyField ? ((llmConfig as Record<string, unknown>)[currentApiKeyField] as string || '') : '';
    const currentModel = currentModelField ? ((llmConfig as Record<string, unknown>)[currentModelField] as string || '') : '';
    const currentDeepseekBaseUrl = (llmConfig.DEEPSEEK_BASE_URL || '').trim();
    const currentLitellmUrl = (llmConfig.LITELLM_BASE_URL || '').trim();
    const currentLmStudioUrl = (llmConfig.LMSTUDIO_BASE_URL || '').trim();
    const currentFireworksUrl = (llmConfig.FIREWORKS_BASE_URL || '').trim();
    const currentTogetherUrl = (llmConfig.TOGETHER_BASE_URL || '').trim();
    const currentOllamaUrl = llmConfig.OLLAMA_URL || '';
    const providerApiKeyLabel =
        llmConfig.LLM === 'custom'
            ? 'Custom LLM API Key'
            : llmConfig.LLM === 'deepseek'
                ? 'DeepSeek API Key'
            : llmConfig.LLM === 'vertex'
                ? 'Vertex API Key'
                : llmConfig.LLM === 'azure'
                    ? 'Azure OpenAI API Key'
                    : llmConfig.LLM === 'bedrock'
                        ? 'Bedrock API Key (optional)'
                    : llmConfig.LLM === 'openrouter'
                        ? 'OpenRouter API Key'
                        : llmConfig.LLM === 'fireworks'
                            ? 'Fireworks API Key'
                            : llmConfig.LLM === 'together'
                                ? 'Together API Key'
                        : llmConfig.LLM === 'cerebras'
                            ? 'Cerebras API Key'
                            : llmConfig.LLM === 'litellm'
                                ? 'LiteLLM API key (optional)'
                                : llmConfig.LLM === 'lmstudio'
                                    ? 'LM Studio API key (optional)'
                                : `${llmConfig.LLM} API Key`;

    useEffect(() => {
        if (currentDeepseekBaseUrl) setDeepseekAdvancedOpen(true);
    }, [currentDeepseekBaseUrl]);

    const getSelectedTextModel = (config: LLMConfig): string => {
        switch (config.LLM) {
            case 'openai':
                return config.OPENAI_MODEL || '';
            case 'deepseek':
                return config.DEEPSEEK_MODEL || '';
            case 'google':
                return config.GOOGLE_MODEL || '';
            case 'vertex':
                return config.VERTEX_MODEL || '';
            case 'azure':
                return config.AZURE_OPENAI_MODEL || '';
            case 'bedrock':
                return config.BEDROCK_MODEL || '';
            case 'openrouter':
                return config.OPENROUTER_MODEL || '';
            case 'fireworks':
                return config.FIREWORKS_MODEL || '';
            case 'together':
                return config.TOGETHER_MODEL || '';
            case 'cerebras':
                return config.CEREBRAS_MODEL || '';
            case 'anthropic':
                return config.ANTHROPIC_MODEL || '';
            case 'ollama':
                return config.OLLAMA_MODEL || '';
            case 'custom':
                return config.CUSTOM_MODEL || '';
            case 'litellm':
                return config.LITELLM_MODEL || '';
            case 'lmstudio':
                return config.LMSTUDIO_MODEL || '';
            case 'chatgpt':
            case 'codex':
                return config.CODEX_MODEL || '';
            default:
                return '';
        }
    };

    const getSelectedImageQuality = (config: LLMConfig): string => {
        if (config.IMAGE_PROVIDER === 'dall-e-3') return config.DALL_E_3_QUALITY || '';
        if (config.IMAGE_PROVIDER === 'gpt-image-1.5') return config.GPT_IMAGE_1_5_QUALITY || '';
        return '';
    };

    const handleTextProviderTabChange = (tab: string) => {
        const nextTab = tab as TextProviderTab;
        const nextProvider =
            nextTab === "chatgpt"
                ? "codex"
                : nextTab === "local"
                    ? "ollama"
                    : OTHER_PROVIDERS[0].value;
        const providerMatchesTab =
            (nextTab === "chatgpt" && (llmConfig.LLM === "codex" || llmConfig.LLM === "chatgpt")) ||
            (nextTab === "local" && LOCAL_PROVIDERS.includes(llmConfig.LLM || "")) ||
            (nextTab === "other" && OTHER_PROVIDER_VALUES.has(llmConfig.LLM || ""));

        trackEvent(MixpanelEvent.Onboarding_Text_Provider_Tab_Selected, {
            tab: nextTab,
            previous_tab: textProviderTab,
        });
        if (!providerMatchesTab) {
            trackEvent(MixpanelEvent.Onboarding_Text_Provider_Selected, {
                provider: nextProvider,
                provider_label: LLM_PROVIDERS[nextProvider]?.label || nextProvider,
                provider_group: nextTab,
                text_provider_tab: nextTab,
                selection_source: "tab_default",
            });
        }
        setTextProviderTab(nextTab);
    };

    const fetchAvailableModels = async () => {
        if (isManualModelProvider) return;
        if (llmConfig.LLM === 'openai' && !currentApiKey) return;
        if (llmConfig.LLM === 'deepseek' && !currentApiKey) return;
        if (llmConfig.LLM === 'google' && !currentApiKey) return;
        if (llmConfig.LLM === 'anthropic' && !currentApiKey) return;
        if (llmConfig.LLM === 'openrouter' && !currentApiKey) return;
        if (llmConfig.LLM === 'fireworks' && !currentApiKey) return;
        if (llmConfig.LLM === 'together' && !currentApiKey) return;
        if (llmConfig.LLM === 'cerebras' && !currentApiKey) return;
        if (llmConfig.LLM === 'custom' && !llmConfig.CUSTOM_LLM_URL) return;
        if (llmConfig.LLM === 'litellm' && !currentLitellmUrl) return;
        setModelsLoading(true);
        try {
            let response: Response;
            if (llmConfig.LLM === 'google') {
                response = await fetch(getApiUrl('/api/v1/ppt/google/models/available'), {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        api_key: currentApiKey
                    }),
                });
            } else if (llmConfig.LLM === 'anthropic') {
                response = await fetch(getApiUrl('/api/v1/ppt/anthropic/models/available'), {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        api_key: currentApiKey
                    }),
                });
            } else {
                const openAiCompatibleUrl =
                    llmConfig.LLM === 'custom'
                        ? llmConfig.CUSTOM_LLM_URL
                        : llmConfig.LLM === 'deepseek'
                            ? currentDeepseekBaseUrl || LLM_PROVIDERS[llmConfig.LLM!]?.url || ''
                        : llmConfig.LLM === 'litellm'
                            ? currentLitellmUrl
                            : llmConfig.LLM === 'lmstudio'
                                ? currentLmStudioUrl || LLM_PROVIDERS[llmConfig.LLM!]?.url || ''
                            : llmConfig.LLM === 'fireworks'
                                ? currentFireworksUrl || LLM_PROVIDERS[llmConfig.LLM!]?.url || ''
                                : llmConfig.LLM === 'together'
                                    ? currentTogetherUrl || LLM_PROVIDERS[llmConfig.LLM!]?.url || ''
                            : LLM_PROVIDERS[llmConfig.LLM!]?.url || '';
                response = await fetch(getApiUrl('/api/v1/ppt/openai/models/available'), {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        url: openAiCompatibleUrl,
                        api_key: currentApiKey
                    }),
                });
            }

            if (response.ok) {
                const data = await response.json();
                const normalizedModels: string[] = Array.isArray(data) ? data : [];

                setAvailableModels(normalizedModels);
                setModelsChecked(true);

                if (normalizedModels.length > 0 && currentModelField) {
                    if (llmConfig[currentModelField] && normalizedModels.includes(llmConfig[currentModelField])) {
                        setLlmConfig(prev => ({
                            ...prev,
                            [currentModelField]: llmConfig[currentModelField]
                        }));
                        return;
                    }

                    const preferredDefault =
                        llmConfig.LLM === 'openai'
                            ? 'gpt-4.1'
                            : llmConfig.LLM === 'deepseek'
                                ? 'deepseek-chat'
                            : llmConfig.LLM === 'google'
                                ? 'models/gemini-2.5-flash'
                                : llmConfig.LLM === 'anthropic'
                                    ? 'claude-sonnet-4-20250514'
                                    : llmConfig.LLM === 'openrouter'
                                        ? 'openai/gpt-4o'
                                        : llmConfig.LLM === 'fireworks'
                                            ? 'accounts/fireworks/models/llama-v3p1-8b-instruct'
                                            : llmConfig.LLM === 'together'
                                                ? 'openai/gpt-oss-20b'
                                        : llmConfig.LLM === 'cerebras'
                                            ? 'llama-3.3-70b'
                                            : llmConfig.LLM === 'litellm'
                                                ? 'gpt-4.1'
                                            : llmConfig.LLM === 'lmstudio'
                                                ? 'openai/gpt-oss-20b'
                                                : normalizedModels[0];

                    const nextModel = normalizedModels.includes(preferredDefault) ? preferredDefault : normalizedModels[0];
                    setLlmConfig(prev => ({
                        ...prev,
                        [currentModelField]: nextModel
                    }));
                }
            } else {
                const message = await getApiErrorMessage(
                    response,
                    `The server could not list ${LLM_PROVIDERS[llmConfig.LLM!]?.label} models. Check your API key or endpoint and try again.`
                );
                console.error('Failed to fetch models');
                setAvailableModels([]);
                setModelsChecked(true);
                notify.error("Could not load models", message);
            }
        } catch (error) {
            console.error('Error fetching models:', error);
            notify.error(
                llmConfig.LLM === "ollama" ? "Could not connect to Ollama" : "Could not load models",
                error instanceof Error
                    ? error.message
                    : "The server could not list models. Check your API key or endpoint and try again."
            );
            setAvailableModels([]);
            setModelsChecked(true);
            if (llmConfig.LLM === "ollama") {
                setLlmConfig(prev => ({ ...prev, OLLAMA_MODEL: "" }));
            }
        } finally {
            setModelsLoading(false);
        }
    };

    const renderQualitySelector = (llmConfig: LLMConfig) => {
        if (llmConfig.IMAGE_PROVIDER === "dall-e-3") {
            return (
                <div className="w-full ">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        DALL·E 3 Image Quality
                    </label>
                    <div className="">
                        <Select value={llmConfig.DALL_E_3_QUALITY || 'standard'} onValueChange={(value) => {
                            trackEvent(MixpanelEvent.Onboarding_Image_Quality_Selected, {
                                image_provider: "dall-e-3",
                                quality: value,
                            });
                            setLlmConfig((prev) => ({
                                ...prev,
                                DALL_E_3_QUALITY: value
                            }));
                        }}>
                            <SelectTrigger className="w-full h-12 px-4 py-4 outline-none border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors hover:border-gray-400 justify-between">
                                <SelectValue placeholder="Select a quality" />
                            </SelectTrigger>
                            <SelectContent>
                                {DALLE_3_QUALITY_OPTIONS.map((option) => (
                                    <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                    </div>
                </div>
            );
        }

        if (llmConfig.IMAGE_PROVIDER === "gpt-image-1.5") {
            return (
                <div className="w-full">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        GPT Image 1.5 Quality
                    </label>
                    <div className="">
                        <Select
                            value={llmConfig.GPT_IMAGE_1_5_QUALITY || 'low'}
                            onValueChange={(value) => {
                                trackEvent(MixpanelEvent.Onboarding_Image_Quality_Selected, {
                                    image_provider: "gpt-image-1.5",
                                    quality: value,
                                });
                                setLlmConfig((prev) => ({
                                    ...prev,
                                    GPT_IMAGE_1_5_QUALITY: value
                                }));
                            }}
                        >
                            <SelectTrigger

                                className="w-full h-12 px-4 py-4 outline-none border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors hover:border-gray-400 justify-between">
                                <SelectValue placeholder="Select a quality" />
                            </SelectTrigger>
                            <SelectContent>
                                {GPT_IMAGE_1_5_QUALITY_OPTIONS.map((option) => (
                                    <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                    </div>
                </div>
            );
        }

        return null;
    };

    const renderSelectedImageProviderConfig = () => {
        if (!llmConfig.IMAGE_PROVIDER || !IMAGE_PROVIDERS[llmConfig.IMAGE_PROVIDER]) return null;

        const provider = IMAGE_PROVIDERS[llmConfig.IMAGE_PROVIDER];

        return (
            <div className="col-span-full rounded-[10px] border border-[#EDEEEF] bg-[#FBFBFD] p-4 shadow-[0_12px_28px_rgba(16,19,35,0.04)]">
                <div className="mb-4 flex items-start justify-between gap-3">
                    <div>
                        <p className="text-sm font-semibold text-[#191919]">{provider.label} setup</p>
                        <p className="mt-1 text-xs leading-5 text-gray-500">
                            Configure the selected image provider before continuing.
                        </p>
                    </div>
                    {provider.getApiKeyUrl && (
                        <a
                            href={provider.getApiKeyUrl}
                            target="_blank"
                            className="flex shrink-0 items-center gap-1 rounded-full border border-[#EDEEEF] bg-white px-3 py-1.5 text-xs font-medium text-[#666666] transition-colors hover:border-[#D9D6FE] hover:text-[#7A5AF8]"
                        >
                            Get API Key <ArrowUpRight className="h-3.5 w-3.5" />
                        </a>
                    )}
                </div>

                <div className="space-y-4">
                    {provider.value === "openai_compatible" ? (
                        <OpenAICompatibleImageFields
                            layout="stacked"
                            baseUrl={llmConfig.OPENAI_COMPAT_IMAGE_BASE_URL || ""}
                            apiKey={llmConfig.OPENAI_COMPAT_IMAGE_API_KEY || ""}
                            model={llmConfig.OPENAI_COMPAT_IMAGE_MODEL || ""}
                            onBaseUrlChange={(v) =>
                                setLlmConfig((prev) => ({
                                    ...prev,
                                    OPENAI_COMPAT_IMAGE_BASE_URL: v,
                                }))
                            }
                            onApiKeyChange={(v) =>
                                setLlmConfig((prev) => ({
                                    ...prev,
                                    OPENAI_COMPAT_IMAGE_API_KEY: v,
                                }))
                            }
                            onModelChange={(v) =>
                                setLlmConfig((prev) => ({
                                    ...prev,
                                    OPENAI_COMPAT_IMAGE_MODEL: v,
                                }))
                            }
                        />
                    ) : provider.value === "comfyui" ? (
                        <>
                            <div>
                                <label className="mb-2 block text-sm font-medium text-gray-700">
                                    ComfyUI Server URL
                                </label>
                                <input
                                    type="text"
                                    placeholder="http://192.168.1.7:8188"
                                    className="h-12 w-full rounded-lg border border-gray-300 px-4 py-2.5 outline-none transition-colors focus:border-[#7A5AF8] focus:ring-2 focus:ring-[#7A5AF8]/20"
                                    value={llmConfig.COMFYUI_URL || ""}
                                    onChange={(e) => {
                                        setLlmConfig(prev => ({
                                            ...prev,
                                            COMFYUI_URL: e.target.value
                                        }));
                                    }}
                                />
                            </div>
                            <div>
                                <label className="mb-2 block text-sm font-medium text-gray-700">
                                    Workflow JSON
                                </label>
                                <textarea
                                    placeholder='Paste your ComfyUI workflow JSON here (export via "Export (API)" in ComfyUI)'
                                    className="w-full rounded-lg border border-gray-300 px-4 py-2.5 font-mono text-xs outline-none transition-colors focus:border-[#7A5AF8] focus:ring-2 focus:ring-[#7A5AF8]/20"
                                    rows={3}
                                    value={llmConfig.COMFYUI_WORKFLOW || ""}
                                    onChange={(e) => {
                                        setLlmConfig((prev) => ({
                                            ...prev,
                                            COMFYUI_WORKFLOW: e.target.value
                                        }));
                                    }}
                                />
                            </div>
                        </>
                    ) : provider.value === "open_webui" ? (
                        <>
                            <div>
                                <label className="mb-2 block text-sm font-medium text-gray-700">
                                    Open WebUI URL
                                </label>
                                <input
                                    type="text"
                                    placeholder="http://localhost:3000/api/v1"
                                    className="h-12 w-full rounded-lg border border-gray-300 px-4 py-2.5 outline-none transition-colors focus:border-[#7A5AF8] focus:ring-2 focus:ring-[#7A5AF8]/20"
                                    value={llmConfig.OPEN_WEBUI_IMAGE_URL || ""}
                                    onChange={(e) => {
                                        setLlmConfig(prev => ({
                                            ...prev,
                                            OPEN_WEBUI_IMAGE_URL: e.target.value
                                        }));
                                    }}
                                />
                            </div>
                            <div>
                                <label className="mb-2 block text-sm font-medium text-gray-700">
                                    API Key (optional)
                                </label>
                                <div className="relative">
                                    <input
                                        type={showApiKey ? "text" : "password"}
                                        placeholder="API key"
                                        className="h-12 w-full rounded-lg border border-gray-300 px-4 py-2.5 pr-12 outline-none transition-colors focus:border-[#7A5AF8] focus:ring-2 focus:ring-[#7A5AF8]/20"
                                        value={llmConfig.OPEN_WEBUI_IMAGE_API_KEY || ""}
                                        onChange={(e) => {
                                            setLlmConfig(prev => ({
                                                ...prev,
                                                OPEN_WEBUI_IMAGE_API_KEY: e.target.value
                                            }));
                                        }}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowApiKey((prev) => !prev)}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer bg-white px-2 py-1"
                                    >
                                        {showApiKey ? <Eye className="h-4 w-4 text-gray-500" /> : <EyeOff className="h-4 w-4 text-gray-500" />}
                                    </button>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div>
                            <label className="mb-2 block text-sm font-medium text-gray-700">
                                {provider.apiKeyFieldLabel}
                            </label>
                            <div className="relative">
                                <input
                                    type={showApiKey ? "text" : "password"}
                                    placeholder={`Enter your ${provider.apiKeyFieldLabel}`}
                                    className="h-12 w-full rounded-lg border border-gray-300 px-4 py-2.5 pr-12 outline-none transition-colors focus:border-[#7A5AF8] focus:ring-2 focus:ring-[#7A5AF8]/20"
                                    value={getFieldValue(provider.apiKeyField)}
                                    onChange={(e) => {
                                        setLlmConfig((prev) => ({
                                            ...prev,
                                            [provider.apiKeyField as keyof LLMConfig]: e.target.value
                                        }));
                                    }}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowApiKey((prev) => !prev)}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer bg-white px-2 py-1"
                                >
                                    {showApiKey ? <Eye className="h-4 w-4 text-gray-500" /> : <EyeOff className="h-4 w-4 text-gray-500" />}
                                </button>
                            </div>
                        </div>
                    )}

                    {renderQualitySelector(llmConfig)}
                </div>
            </div>
        );
    };

    const checkCurrentAuthStatus = async () => {
        try {
            const res = await fetch(getApiUrl("/api/v1/ppt/codex/auth/status"));
            if (!res.ok) {
                return false;
            }
            const data = await res.json();
            if (data.status === "authenticated") {
                return true;
            } else {
                return false;
            }
        } catch {
            return false;
        }
    };
    const handleSaveConfig = async () => {
        try {
            if (llmConfig.LLM === 'codex') {
                const isAuthenticated = await checkCurrentAuthStatus();
                if (!isAuthenticated) {
                    trackEvent(MixpanelEvent.Onboarding_Validation_Failed, {
                        step_name: "text_provider",
                        provider: "codex",
                        validation_error: "Please sign in to ChatGPT to continue.",
                    });
                    notify.error("Sign in required", "Please sign in to ChatGPT to continue.");
                    return;
                }
            }
            const validationError = getLLMConfigValidationError(llmConfig);
            if (validationError) {
                trackEvent(MixpanelEvent.Onboarding_Validation_Failed, {
                    step_name: "web_search",
                    web_search_enabled: !!llmConfig.WEB_GROUNDING,
                    web_search_provider: llmConfig.WEB_SEARCH_PROVIDER || "auto",
                    validation_error: validationError,
                });
                notify.warning("Cannot save yet", validationError);
                return;
            }
            setSavingConfig(true);

            if (
                llmConfig.LLM === "ollama" &&
                llmConfig.OLLAMA_MODEL &&
                !(await isOllamaModelAvailable(llmConfig.OLLAMA_MODEL, currentOllamaUrl))
            ) {
                throw new Error(
                    `The selected model "${llmConfig.OLLAMA_MODEL}" is not available at ${currentOllamaUrl || "the default Ollama URL"}. Check models and select an available model.`
                );
            }
            await handleSaveLLMConfig(llmConfig);
            trackEvent(MixpanelEvent.Onboarding_Configuration_Saved, {
                text_provider: llmConfig.LLM || "",
                text_provider_tab: getTextProviderTab(llmConfig.LLM),
                image_generation_enabled: !llmConfig.DISABLE_IMAGE_GENERATION,
                image_step_skipped: !!llmConfig.DISABLE_IMAGE_GENERATION,
                image_provider: llmConfig.DISABLE_IMAGE_GENERATION ? "disabled" : llmConfig.IMAGE_PROVIDER || "",
                web_search_enabled: !!llmConfig.WEB_GROUNDING,
                web_search_step_skipped: !llmConfig.WEB_GROUNDING,
                web_search_provider: llmConfig.WEB_GROUNDING ? llmConfig.WEB_SEARCH_PROVIDER || "auto" : "disabled",
            });

            const textProvider = llmConfig.LLM || '';
            const textModel = getSelectedTextModel(llmConfig);
            const imageGenerationEnabled = !llmConfig.DISABLE_IMAGE_GENERATION;
            const imageProvider = imageGenerationEnabled ? (llmConfig.IMAGE_PROVIDER || '') : 'disabled';

            trackEvent(MixpanelEvent.Onboarding_Providers_Models_Selected, {
                pathname,
                text_provider: textProvider,
                text_provider_label: LLM_PROVIDERS[textProvider]?.label || textProvider || '',
                text_provider_tab: getTextProviderTab(textProvider),
                text_model: textModel,
                uses_chatgpt_login: textProvider === 'chatgpt' || textProvider === 'codex',
                image_generation_enabled: imageGenerationEnabled,
                image_step_skipped: !imageGenerationEnabled,
                image_provider: imageProvider,
                image_provider_label: imageGenerationEnabled
                    ? (IMAGE_PROVIDERS[imageProvider]?.label || imageProvider || '')
                    : 'Image generation disabled',
                image_quality: imageGenerationEnabled ? getSelectedImageQuality(llmConfig) : '',
                web_search_enabled: !!llmConfig.WEB_GROUNDING,
                web_search_step_skipped: !llmConfig.WEB_GROUNDING,
                web_search_provider: llmConfig.WEB_GROUNDING ? (llmConfig.WEB_SEARCH_PROVIDER || "auto") : "disabled",
            });

            notify.success("Configuration saved", "Your configuration was saved successfully.");
            trackEvent(MixpanelEvent.Onboarding_Step_Continued, {
                from_step: "web_search",
                to_step: "finish",
                web_search_enabled: !!llmConfig.WEB_GROUNDING,
                web_search_step_skipped: !llmConfig.WEB_GROUNDING,
                web_search_provider: llmConfig.WEB_GROUNDING ? llmConfig.WEB_SEARCH_PROVIDER || "auto" : "disabled",
            });
            setStep(3)
            // router.push("/upload");
        } catch (error) {
            notify.error("Could not save configuration", error instanceof Error ? error.message : "Failed to save configuration");

        }
        finally {
            setSavingConfig(false);
        }
    };

    const validateTextProvider = async () => {
        if (llmConfig.LLM === 'codex') {
            const isAuthenticated = await checkCurrentAuthStatus();
            if (!isAuthenticated) {
                notify.error("Sign in required", "Please sign in to ChatGPT to continue.");
                return false;
            }
        }
        const validationError = getLLMConfigValidationError({
            ...llmConfig,
            DISABLE_IMAGE_GENERATION: true,
            WEB_GROUNDING: false,
        });
        if (validationError) {
            trackEvent(MixpanelEvent.Onboarding_Validation_Failed, {
                step_name: "text_provider",
                provider: llmConfig.LLM || "",
                validation_error: validationError,
            });
            notify.warning("Cannot continue yet", validationError);
            return false;
        }
        return true;
    };

    const handleContinue = async () => {
        if (providerStep === 1) {
            if (await validateTextProvider()) {
                trackEvent(MixpanelEvent.Onboarding_Step_Continued, {
                    from_step: "text_provider",
                    to_step: "image_provider",
                    provider: llmConfig.LLM || "",
                    text_provider_tab: getTextProviderTab(llmConfig.LLM),
                });
                setProviderStep(2);
            }
            return;
        }
        if (providerStep === 2) {
            const validationError = getLLMConfigValidationError({ ...llmConfig, WEB_GROUNDING: false });
            if (validationError) {
                trackEvent(MixpanelEvent.Onboarding_Validation_Failed, {
                    step_name: "image_provider",
                    image_generation_enabled: !llmConfig.DISABLE_IMAGE_GENERATION,
                    image_step_skipped: !!llmConfig.DISABLE_IMAGE_GENERATION,
                    image_provider: llmConfig.IMAGE_PROVIDER || "",
                    validation_error: validationError,
                });
                notify.warning("Cannot continue yet", validationError);
                return;
            }
            trackEvent(MixpanelEvent.Onboarding_Step_Continued, {
                from_step: "image_provider",
                to_step: "web_search",
                image_generation_enabled: !llmConfig.DISABLE_IMAGE_GENERATION,
                image_step_skipped: !!llmConfig.DISABLE_IMAGE_GENERATION,
                image_provider: llmConfig.DISABLE_IMAGE_GENERATION ? "disabled" : llmConfig.IMAGE_PROVIDER || "",
            });
            setProviderStep(3);
            return;
        }
        await handleSaveConfig();
    };

    const handleBack = () => {
        trackEvent(MixpanelEvent.Onboarding_Back_Clicked, {
            from_step: providerStep === 1 ? "text_provider" : providerStep === 2 ? "image_provider" : "web_search",
            to_step: providerStep === 1 ? "text_provider" : providerStep === 2 ? "text_provider" : "image_provider",
            source: "footer_button",
        });
        if (providerStep > 1) {
            setProviderStep(providerStep - 1);
        }
    };

    const selectedWebProvider = WEB_SEARCH_PROVIDER_OPTIONS.find(
        (provider) => provider.value === llmConfig.WEB_SEARCH_PROVIDER
    );

    const renderSelectedWebSearchProviderConfig = () => {
        if (!selectedWebProvider) return null;

        return (
            <div className="col-span-full rounded-[10px] border border-[#EDEEEF] bg-[#FBFBFD] p-4 shadow-[0_12px_28px_rgba(16,19,35,0.04)]">
                <div className="mb-4">
                    <p className="text-sm font-semibold text-[#191919]">{selectedWebProvider.label} setup</p>
                    <p className="mt-1 text-xs leading-5 text-gray-500">
                        {selectedWebProvider.description}
                    </p>
                </div>

                <div className="space-y-4">
                    {selectedWebProvider.value === "auto" && (
                        <div className="rounded-lg border border-[#D9D6FE] bg-[#F4F3FF] p-3 text-xs leading-5 text-[#5146E5]">
                            Presenton will use model-native web grounding when available. If the selected text model does not support it, web search stays off until you choose an external provider.
                        </div>
                    )}

                    {selectedWebProvider.urlField && (
                        <div>
                            <label className="mb-2 block text-sm font-medium text-gray-700">
                                {selectedWebProvider.urlLabel}
                            </label>
                            <input
                                type="url"
                                value={getFieldValue(selectedWebProvider.urlField)}
                                onChange={(event) => setLlmConfig(prev => ({ ...prev, [selectedWebProvider.urlField!]: event.target.value }))}
                                className="h-12 w-full rounded-lg border border-gray-300 px-4 outline-none transition-colors focus:border-[#7A5AF8] focus:ring-2 focus:ring-[#7A5AF8]/20"
                                placeholder="https://search.example.com"
                            />
                        </div>
                    )}

                    {selectedWebProvider.apiKeyField && (
                        <div>
                            <label className="mb-2 block text-sm font-medium text-gray-700">
                                {selectedWebProvider.apiKeyLabel}
                            </label>
                            <div className="relative">
                                <input
                                    type={showApiKey ? "text" : "password"}
                                    value={getFieldValue(selectedWebProvider.apiKeyField)}
                                    onChange={(event) => setLlmConfig(prev => ({ ...prev, [selectedWebProvider.apiKeyField!]: event.target.value }))}
                                    className="h-12 w-full rounded-lg border border-gray-300 px-4 pr-12 outline-none transition-colors focus:border-[#7A5AF8] focus:ring-2 focus:ring-[#7A5AF8]/20"
                                    placeholder={`Enter your ${selectedWebProvider.apiKeyLabel}`}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowApiKey(prev => !prev)}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer bg-white px-2 py-1"
                                >
                                    {showApiKey ? <Eye className="h-4 w-4 text-gray-500" /> : <EyeOff className="h-4 w-4 text-gray-500" />}
                                </button>
                            </div>
                        </div>
                    )}

                    {selectedWebProvider.value !== "auto" && (
                        <div>
                            <label className="mb-2 block text-sm font-medium text-gray-700">
                                Maximum results
                            </label>
                            <input
                                type="number"
                                min={1}
                                max={10}
                                value={llmConfig.WEB_SEARCH_MAX_RESULTS || "5"}
                                onChange={(event) => setLlmConfig(prev => ({ ...prev, WEB_SEARCH_MAX_RESULTS: event.target.value }))}
                                className="h-12 w-full rounded-lg border border-gray-300 px-4 outline-none transition-colors focus:border-[#7A5AF8] focus:ring-2 focus:ring-[#7A5AF8]/20"
                            />
                        </div>
                    )}
                </div>
            </div>
        );
    };

    useEffect(() => {
        llmConfigRef.current = llmConfig;
    }, [llmConfig]);

    useEffect(() => {
        const config = llmConfigRef.current;
        const stepName =
            providerStep === 1
                ? "text_provider"
                : providerStep === 2
                    ? "image_provider"
                    : "web_search";
        const stepProps =
            providerStep === 1
                ? {
                    text_provider_tab: getTextProviderTab(config.LLM),
                    provider: config.LLM || "",
                }
                : providerStep === 2
                    ? {
                        image_generation_enabled: !config.DISABLE_IMAGE_GENERATION,
                        image_step_skipped: !!config.DISABLE_IMAGE_GENERATION,
                        image_provider: config.DISABLE_IMAGE_GENERATION ? "disabled" : config.IMAGE_PROVIDER || "",
                    }
                    : {
                        web_search_enabled: !!config.WEB_GROUNDING,
                        web_search_step_skipped: !config.WEB_GROUNDING,
                        web_search_provider: config.WEB_GROUNDING ? config.WEB_SEARCH_PROVIDER || "auto" : "disabled",
                    };

        trackEvent(MixpanelEvent.Onboarding_Step_Viewed, {
            step_name: stepName,
            step_number: providerStep,
            ...stepProps,
        });
    }, [providerStep]);

    useEffect(() => {
        const nextProvider =
            textProviderTab === "chatgpt"
                ? "codex"
                : textProviderTab === "local"
                    ? "ollama"
                    : OTHER_PROVIDERS[0].value;

        const providerMatchesTab =
            (textProviderTab === "chatgpt" && llmConfig.LLM === "codex") ||
            (textProviderTab === "local" && LOCAL_PROVIDERS.includes(llmConfig.LLM || "")) ||
            (textProviderTab === "other" && OTHER_PROVIDER_VALUES.has(llmConfig.LLM || ""));

        if (!providerMatchesTab) {
            setLlmConfig(prev => ({
                ...prev,
                LLM: nextProvider,
            }));
            setAvailableModels([]);
            setModelsChecked(false);
        }
    }, [textProviderTab, llmConfig.LLM]);

    const imageProviderRows = Object.values(IMAGE_PROVIDERS).reduce(
        (rows, provider, index) => {
            if (index % 3 === 0) rows.push([]);
            rows[rows.length - 1].push(provider);
            return rows;
        },
        [] as Array<Array<(typeof IMAGE_PROVIDERS)[keyof typeof IMAGE_PROVIDERS]>>
    );

    const webSearchProviderRows = WEB_SEARCH_PROVIDER_OPTIONS.reduce(
        (rows, provider, index) => {
            if (index % 3 === 0) rows.push([]);
            rows[rows.length - 1].push(provider);
            return rows;
        },
        [] as Array<Array<(typeof WEB_SEARCH_PROVIDER_OPTIONS)[number]>>
    );

    return (
        <div className='w-full max-w-[660px] font-syne pb-10'>
            <p className='px-2.5 py-0.5 w-fit text-[#7A5AF8] rounded-[50px]  border border-[#EDEEEF] text-[10px] font-medium mb-5 font-syne'>PRESENTON</p>
            <div className=''>

                <h2 className='mb-4 text-black text-[26px] font-normal font-unbounded '>
                    {providerStep === 1 ? "Choose your text provider" : providerStep === 2 ? "Choose your image provider" : "Configure web search"}
                </h2>
                <p className='text-[#000000CC] text-xl font-normal font-syne'>
                    {providerStep === 1
                        ? "Start with ChatGPT, run a local model, or connect another AI provider."
                        : providerStep === 2
                            ? "Choose how Presenton creates visuals, or continue without image generation."
                            : "Add current web context to presentations, or continue with web search disabled."}
                </p>
            </div>
            <div className='flex items-center gap-2 bg-[#F0F3F9B2] rounded-[8px]  px-6 py-2.5 my-[54px]'>
                <Info className='w-4 h-4 fill-[#003399] stroke-white' />
                <p className='text-sm text-[#5F6062] font-medium'>Runs locally on your device. Your API keys and generation setup stay on your machine.</p>
            </div>

            {providerStep === 1 && <>
            {/* Text Provider */}
            <div className='p-3 border border-[#EDEEEF] rounded-[11px] bg-white '>
                <div className="flex items-center gap-[24.3px]  mb-[42px]">
                    <div className='w-[74px] h-[74px] rounded-[4px] pt-[16.8px] pr-[17.15px] pb-[17.2px] pl-[16.85px] flex items-center justify-center'
                        style={{ backgroundColor: '#4C55541A' }}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40" fill="none">
                            <path d="M20 6.6665V33.3332" stroke="#4C5554" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            <path d="M6.66666 11.6665V8.33317C6.66666 7.89114 6.84225 7.46722 7.15481 7.15466C7.46737 6.8421 7.8913 6.6665 8.33332 6.6665H31.6667C32.1087 6.6665 32.5326 6.8421 32.8452 7.15466C33.1577 7.46722 33.3333 7.89114 33.3333 8.33317V11.6665" stroke="#4C5554" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            <path d="M15 33.3335H25" stroke="#4C5554" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                    </div>
                    <div className='w-full'>

                        <h3 className="text-xl font-normal text-[#191919] pb-1.5">Text Generation Settings</h3>
                        <p className=" text-sm  text-gray-500">
                            Choosing where text content comes from
                        </p>
                    </div>
                </div>
                <Tabs
                    value={textProviderTab}
                    onValueChange={handleTextProviderTabChange}
                    className="w-full"
                >
                    <TabsList className="grid h-14 w-full grid-cols-3 rounded-[10px] border border-[#EDEEEF] bg-[#F6F6F9] p-1 shadow-inner shadow-black/[0.02]">
                        <TabsTrigger value="chatgpt" className="h-12 gap-2 rounded-[8px] border border-transparent px-4 text-sm font-semibold text-[#5F6062] transition-all hover:text-[#191919] data-[state=active]:border-[#D9D6FE] data-[state=active]:bg-white data-[state=active]:text-[#191919] data-[state=active]:shadow-[0_8px_24px_rgba(16,19,35,0.08)]">
                            <Image src="/providers/openai.png" alt="" width={16} height={16} className="object-contain" />
                            ChatGPT
                        </TabsTrigger>
                        <TabsTrigger value="local" className="h-12 gap-2 rounded-[8px] border border-transparent px-4 text-sm font-semibold text-[#5F6062] transition-all hover:text-[#191919] data-[state=active]:border-[#D9D6FE] data-[state=active]:bg-white data-[state=active]:text-[#191919] data-[state=active]:shadow-[0_8px_24px_rgba(16,19,35,0.08)]">
                            <Laptop className="h-4 w-4" />
                            Local
                        </TabsTrigger>
                        <TabsTrigger value="other" className="h-12 gap-2 rounded-[8px] border border-transparent px-4 text-sm font-semibold text-[#5F6062] transition-all hover:text-[#191919] data-[state=active]:border-[#D9D6FE] data-[state=active]:bg-white data-[state=active]:text-[#191919] data-[state=active]:shadow-[0_8px_24px_rgba(16,19,35,0.08)]">
                            <Blocks className="h-4 w-4" />
                            AI Providers
                        </TabsTrigger>
                    </TabsList>
                    <p className="mt-3 text-xs leading-relaxed text-gray-500">
                        {textProviderTab === "chatgpt"
                            ? "Connect your ChatGPT account and choose a supported model."
                            : textProviderTab === "local"
                                ? "Run models on your machine with Ollama or LM Studio."
                                : "Connect hosted AI providers using an API key or custom endpoint."}
                    </p>
                    <TabsContent value="chatgpt" className="mt-6">
                        <CodexConfig
                            codexModel={llmConfig.CODEX_MODEL || ''}
                            onInputChange={(value, field) => {
                                const normalizedField = field === 'codex_model' ? 'CODEX_MODEL' : field;
                                setLlmConfig(prev => ({
                                    ...prev,
                                    [normalizedField]: value
                                }));
                            }}
                            onAuthStatusChange={setChatGptAuthenticated}
                        />
                        {chatGptAuthenticated && (llmConfig.LLM === "codex" || llmConfig.LLM === "chatgpt") && (
                            <div className="mt-5">
                                <label className="mb-2 block text-sm font-medium text-gray-700">ChatGPT model</label>
                                <Select
                                    value={llmConfig.CODEX_MODEL || ""}
                                    onValueChange={(value) => {
                                        trackEvent(MixpanelEvent.Onboarding_Text_Model_Selected, {
                                            provider: "codex",
                                            model: value,
                                            text_provider_tab: textProviderTab,
                                        });
                                        setLlmConfig(prev => ({ ...prev, CODEX_MODEL: value }));
                                    }}
                                >
                                    <SelectTrigger className="h-12 w-full rounded-lg border-gray-300">
                                        <SelectValue placeholder="Select a model" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {CODEX_MODELS.map((model) => (
                                            <SelectItem key={model.id} value={model.id}>{model.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}
                    </TabsContent>
                    <TabsContent value="local" className="mt-6">
                        <div className="grid grid-cols-2 gap-3">
                            {LOCAL_PROVIDERS.map((value) => {
                                const provider = LLM_PROVIDERS[value];
                                return (
                                    <button
                                        type="button"
                                        key={value}
                                        onClick={() => handleProviderChange(value)}
                                        className={cn(
                                            "flex items-center gap-3 rounded-xl border p-4 text-left transition-colors hover:bg-[#F7F6F9]",
                                            llmConfig.LLM === value ? "border-[#7A5AF8] bg-[#F4F3FF]" : "border-[#EDEEEF]"
                                        )}
                                    >
                                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-white border border-[#EDEEEF]">
                                            {provider.icon ? <img src={provider.icon} alt="" className="h-7 w-7 object-contain" /> : <span className="font-semibold">LM</span>}
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium text-[#191919]">{provider.label}</p>
                                            <p className="mt-1 text-xs text-[#777]">{provider.description}</p>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </TabsContent>
                    <TabsContent value="other" className="mt-6">
                <div className="flex w-full max-w-[300px] flex-col items-start gap-4">
                    <div className="flex w-full flex-col justify-start">

                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Select Text Provider
                        </label>
                        <Popover
                            open={openProviderSelect}
                            onOpenChange={setOpenProviderSelect}
                        >
                            <PopoverTrigger asChild>
                                <Button
                                    variant="outline"
                                    role="combobox"
                                    aria-expanded={openProviderSelect}
                                    className="flex h-12 w-full px-4 py-4 outline-none border border-[#E8E8E9] rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors hover:border-gray-400 justify-between"
                                >
                                    <div className="flex gap-3 items-center">
                                        <span className="text-sm font-medium text-gray-900">
                                            {llmConfig.LLM && OTHER_PROVIDER_VALUES.has(llmConfig.LLM)
                                                ? LLM_PROVIDERS[llmConfig.LLM]
                                                    ?.label || llmConfig.LLM
                                                : "Select text provider"}
                                        </span>
                                    </div>
                                    <ChevronUp className="w-4 h-4 text-gray-500" />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent
                                className="p-0 w-full "
                                align="end"

                            >
                                <Command>
                                    <CommandInput placeholder="Search provider..." />
                                    <CommandList className='hide-scrollbar'>
                                        <CommandEmpty>No provider found.</CommandEmpty>
                                        <CommandGroup >
                                            {OTHER_PROVIDERS.map(
                                                (provider, index) => (
                                                    <CommandItem
                                                        key={index}
                                                        value={provider.value}
                                                        onSelect={() => handleProviderChange(provider.value)}
                                                    >
                                                        <Check
                                                            className={cn(
                                                                "mr-2 h-4 w-4",
                                                                llmConfig.LLM === provider.value
                                                                    ? "opacity-100"
                                                                    : "opacity-0"
                                                            )}
                                                        />
                                                        <div className="flex gap-3 items-center">
                                                            <div className="flex flex-col space-y-1 flex-1">
                                                                <div className="flex items-center justify-between gap-2">
                                                                    <span className="text-sm font-medium text-gray-900 capitalize">
                                                                        {provider.label}
                                                                    </span>
                                                                </div>
                                                                <span className="text-xs text-gray-600 leading-relaxed">
                                                                    {provider.description}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </CommandItem>
                                                )
                                            )}
                                        </CommandGroup>
                                    </CommandList>
                                </Command>
                            </PopoverContent>
                        </Popover>
                    </div>
                </div>
                    </TabsContent>
                </Tabs>
                {isActiveNonChatProvider && (
                <div className="mt-6 flex w-full max-w-[300px] flex-col items-start gap-4">
                    <div className="relative flex w-full flex-col justify-end items-start">
                        <div className="flex flex-col justify-start w-full ">
                            {llmConfig.LLM === 'ollama' ? (
                                <OllamaConfig
                                    ollamaModel={llmConfig.OLLAMA_MODEL || ""}
                                    ollamaUrl={currentOllamaUrl}
                                    onInputChange={(value, field) => {
                                        const normalizedField =
                                            field === "ollama_url"
                                                ? "OLLAMA_URL"
                                                : field === "ollama_model"
                                                    ? "OLLAMA_MODEL"
                                                    : field;
                                        if (typeof value !== "string") return;
                                        setLlmConfig((prev) => ({
                                            ...prev,
                                            [normalizedField]: value,
                                        }));
                                    }}
                                />
                            ) : llmConfig.LLM === 'bedrock' ? (
                                <BedrockManualFields
                                    llmConfig={llmConfig}
                                    onPatch={(patch) => {
                                        setLlmConfig((prev) => ({ ...prev, ...patch }));
                                    }}
                                />
                            ) : (
                                <>
                                    <div className='flex items-center justify-between mb-2'>

                                        <label className="block text-sm font-medium capitalize text-gray-700 ">
                                            {providerApiKeyLabel}
                                        </label>
                                        {llmConfig.LLM && LLM_PROVIDERS[llmConfig.LLM!]?.getApiKeyUrl && <a href={LLM_PROVIDERS[llmConfig.LLM!]?.getApiKeyUrl || ""} target='_blank' className='text-[#666666] text-xs font-normal flex items-center gap-1'>Get API Key <ArrowUpRight className='w-3.5 h-3.5' /></a>}
                                    </div>

                                    <div className="relative">
                                        <input
                                            type={showApiKey ? 'text' : 'password'}
                                            value={currentApiKey}
                                            onChange={(e) => setLlmConfig(prev => ({
                                                ...prev,
                                                [currentApiKeyField]: e.target.value
                                            }))}
                                            className="w-full px-2 py-3 outline-none border  border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
                                            placeholder={`Enter your ${providerApiKeyLabel}`}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowApiKey((prev) => !prev)}
                                            className='absolute right-2 top-1/2 -translate-y-1/2 bg-white px-2 py-1 cursor-pointer'
                                        >
                                            {showApiKey ? <Eye className='w-4 h-4 text-gray-500' /> : <EyeOff className='w-4 h-4 text-gray-500' />}
                                        </button>
                                    </div>
                                </>
                            )}
                            {llmConfig.LLM === 'custom' && (
                                <input
                                    type="text"
                                    value={llmConfig.CUSTOM_LLM_URL}
                                    onChange={(e) => setLlmConfig(prev => ({
                                        ...prev,
                                        CUSTOM_LLM_URL: e.target.value
                                    }))}
                                    className="w-full mt-2 px-2 py-3 outline-none border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
                                    placeholder="OpenAI-compatible URL"
                                />
                            )}
                            {llmConfig.LLM === 'deepseek' && (
                                <Collapsible
                                    open={deepseekAdvancedOpen}
                                    onOpenChange={setDeepseekAdvancedOpen}
                                    className="mt-3"
                                >
                                    <CollapsibleTrigger asChild>
                                        <button
                                            type="button"
                                            className="flex w-full min-w-0 items-center justify-between gap-2 rounded-lg border border-gray-200 bg-[#F9F9FA] px-3 py-2.5 text-left text-sm font-medium text-gray-800 transition-colors hover:bg-gray-100"
                                        >
                                            <span>Advanced settings</span>
                                            <ChevronDown
                                                className={cn(
                                                    "h-4 w-4 shrink-0 text-gray-600 transition-transform duration-200",
                                                    deepseekAdvancedOpen && "rotate-180"
                                                )}
                                                aria-hidden
                                            />
                                        </button>
                                    </CollapsibleTrigger>
                                    <CollapsibleContent className="space-y-3 overflow-hidden">
                                        <div className="space-y-1.5 border-t border-gray-100 pt-3">
                                            <label className="block text-sm font-medium text-gray-700">
                                                DeepSeek base URL (optional)
                                            </label>
                                            <input
                                                type="text"
                                                value={llmConfig.DEEPSEEK_BASE_URL || ''}
                                                onChange={(e) => setLlmConfig(prev => ({
                                                    ...prev,
                                                    DEEPSEEK_BASE_URL: e.target.value
                                                }))}
                                                className="w-full px-2 py-3 outline-none border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
                                                placeholder="https://api.deepseek.com/v1"
                                            />
                                        </div>
                                    </CollapsibleContent>
                                </Collapsible>
                            )}
                            {llmConfig.LLM === 'litellm' && (
                                <>
                                    <label className="mt-3 block text-sm font-medium text-gray-700 mb-2">
                                        LiteLLM base URL
                                    </label>
                                    <input
                                        type="text"
                                        value={llmConfig.LITELLM_BASE_URL || ''}
                                        onChange={(e) => setLlmConfig(prev => ({
                                            ...prev,
                                            LITELLM_BASE_URL: e.target.value
                                        }))}
                                        className="w-full px-2 py-3 outline-none border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
                                        placeholder="e.g. http://host.docker.internal:4000/v1"
                                    />
                                    <p className="mt-1.5 text-xs text-gray-500">
                                        OpenAI-compatible root (usually ends with /v1); /v1 is added if omitted. API key above is optional for local proxies with no auth.
                                    </p>
                                </>
                            )}
                            {llmConfig.LLM === 'lmstudio' && (
                                <>
                                    <label className="mt-3 block text-sm font-medium text-gray-700 mb-2">
                                        LM Studio base URL
                                    </label>
                                    <input
                                        type="text"
                                        value={llmConfig.LMSTUDIO_BASE_URL || ''}
                                        onChange={(e) => setLlmConfig(prev => ({
                                            ...prev,
                                            LMSTUDIO_BASE_URL: e.target.value
                                        }))}
                                        className="w-full px-2 py-3 outline-none border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
                                        placeholder="http://localhost:1234/v1"
                                    />
                                    <p className="mt-1.5 text-xs text-gray-500">
                                        Defaults to localhost:1234/v1, and /v1 is added automatically when omitted.
                                    </p>
                                </>
                            )}
                            {llmConfig.LLM === 'fireworks' && (
                                <>
                                    <label className="mt-3 block text-sm font-medium text-gray-700 mb-2">
                                        Fireworks base URL (optional)
                                    </label>
                                    <input
                                        type="text"
                                        value={llmConfig.FIREWORKS_BASE_URL || ''}
                                        onChange={(e) => setLlmConfig(prev => ({
                                            ...prev,
                                            FIREWORKS_BASE_URL: e.target.value
                                        }))}
                                        className="w-full px-2 py-3 outline-none border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
                                        placeholder="https://api.fireworks.ai/inference/v1"
                                    />
                                </>
                            )}
                            {llmConfig.LLM === 'together' && (
                                <>
                                    <label className="mt-3 block text-sm font-medium text-gray-700 mb-2">
                                        Together base URL (optional)
                                    </label>
                                    <input
                                        type="text"
                                        value={llmConfig.TOGETHER_BASE_URL || ''}
                                        onChange={(e) => setLlmConfig(prev => ({
                                            ...prev,
                                            TOGETHER_BASE_URL: e.target.value
                                        }))}
                                        className="w-full px-2 py-3 outline-none border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
                                        placeholder="https://api.together.ai/v1"
                                    />
                                </>
                            )}
                            {(llmConfig.LLM === 'vertex' || llmConfig.LLM === 'azure') && (
                                <VertexAzureManualFields
                                    key={llmConfig.LLM}
                                    provider={llmConfig.LLM === 'vertex' ? 'vertex' : 'azure'}
                                    llmConfig={llmConfig}
                                    onPatch={(patch) => {
                                        setLlmConfig((prev) => ({ ...prev, ...patch }));
                                    }}
                                />
                            )}
                        </div>


                        {!isManualModelProvider && llmConfig.LLM !== 'chatgpt' && llmConfig.LLM !== 'codex' && llmConfig.LLM !== 'ollama' && (!modelsChecked || availableModels.length === 0) && (

                            <button
                                onClick={fetchAvailableModels}
                                disabled={
                                    modelsLoading ||
                                    (llmConfig.LLM === 'openai' && !currentApiKey) ||
                                    (llmConfig.LLM === 'deepseek' && !currentApiKey) ||
                                    (llmConfig.LLM === 'google' && !currentApiKey) ||
                                    (llmConfig.LLM === 'anthropic' && !currentApiKey) ||
                                    (llmConfig.LLM === 'openrouter' && !currentApiKey) ||
                                    (llmConfig.LLM === 'fireworks' && !currentApiKey) ||
                                    (llmConfig.LLM === 'together' && !currentApiKey) ||
                                    (llmConfig.LLM === 'cerebras' && !currentApiKey) ||
                                    (llmConfig.LLM === 'custom' && !llmConfig.CUSTOM_LLM_URL) ||
                                    (llmConfig.LLM === 'litellm' && !currentLitellmUrl)
                                }
                                className={`mt-4 py-2.5 bg-[#EDEEEF] disabled:opacity-50 disabled:cursor-not-allowed px-3.5 w-full  rounded-[48px] text-xs font-semibold text-[#101323] transition-all duration-200 border ${modelsLoading
                                    ? " border-gray-300 cursor-not-allowed text-gray-500"
                                    : " border-[#EDEEEF] text-[#101323] hover:bg-[#EDEEEF]/90 focus:ring-2 focus:ring-blue-500/20"
                                    }`}
                            >
                                {modelsLoading ? (
                                    <span className="flex items-center justify-center gap-2">
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Checking for models...
                                    </span>
                                ) : (
                                    "Validate & Load Models"
                                )}
                            </button>
                        )}
                    </div>

                </div>
                )}
                <div className="mt-4 flex w-full max-w-[222px] items-start gap-4">


                    {/* Model Selection - only show if models are available */}
                    {isActiveNonChatProvider && !isManualModelProvider && llmConfig.LLM !== 'ollama' && modelsChecked && availableModels.length > 0 && (
                        <div className="w-full">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    {`Select ${LLM_PROVIDERS[llmConfig.LLM!]?.label} Model`}
                                </label>
                                <div className="w-full">
                                    <Popover
                                        open={openModelSelect}
                                        onOpenChange={(open) => {
                                            setOpenModelSelect(open);
                                            if (open && llmConfig.LLM === "ollama") {
                                                void fetchAvailableModels();
                                            }
                                        }}
                                    >
                                        <PopoverTrigger asChild>
                                            <Button
                                                variant="outline"
                                                role="combobox"
                                                aria-expanded={openModelSelect}
                                                className="w-full h-12 px-4 py-4 outline-none border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors hover:border-gray-400 justify-between"
                                            >
                                                <span className="text-sm truncate font-medium text-gray-900">
                                                    {
                                                        currentModel
                                                            ? availableModels.find(model => model === currentModel) || currentModel
                                                            :
                                                            "Select a model"
                                                    }
                                                </span>

                                                <ChevronUp className="w-4 h-4 text-gray-500" />
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent
                                            className="p-0"
                                            align="start"
                                            style={{ width: "var(--radix-popover-trigger-width)" }}
                                        >
                                            <Command>
                                                <CommandInput placeholder="Search models..." />
                                                <CommandList>
                                                    <CommandEmpty>No model found.</CommandEmpty>
                                                    <CommandGroup>
                                                        {availableModels.map((model, index) => (
                                                            <CommandItem
                                                                key={index}
                                                                value={model}
                                                                onSelect={(value) => {
                                                                    if (currentModelField) {
                                                                        trackEvent(MixpanelEvent.Onboarding_Text_Model_Selected, {
                                                                            provider: llmConfig.LLM || "",
                                                                            model: value,
                                                                            text_provider_tab: textProviderTab,
                                                                        });
                                                                        setLlmConfig(prev => ({
                                                                            ...prev,
                                                                            [currentModelField]: value
                                                                        }));
                                                                    }
                                                                    setOpenModelSelect(false);
                                                                }}
                                                            >
                                                                <Check
                                                                    className={cn(
                                                                        "mr-2 h-4 w-4",
                                                                        currentModel === model
                                                                            ? "opacity-100"
                                                                            : "opacity-0"
                                                                    )}
                                                                />
                                                                <div className="flex gap-3 items-center">
                                                                    <div className="flex flex-col space-y-1 flex-1">
                                                                        <div className="flex items-center justify-between gap-2">
                                                                            <span className="text-sm font-medium text-gray-900">
                                                                                {model}
                                                                            </span>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </CommandItem>
                                                        ))}
                                                    </CommandGroup>
                                                </CommandList>
                                            </Command>
                                        </PopoverContent>
                                    </Popover>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
            </>}
            {providerStep === 2 && <>
            {/* Image Provider */}
            <div className={`p-3 border border-[#EDEEEF] rounded-[11px] relative mt-5 bg-white ${llmConfig.DISABLE_IMAGE_GENERATION ? "bg-[#F9FAFB]" : ""}`}>
                <ToolTip content="Enable/Disable Image Generation" className='flex justify-end items-center absolute top-3 right-3'>
                    <div className='flex justify-end items-center'>
                        <Switch
                            checked={!llmConfig.DISABLE_IMAGE_GENERATION}
                            className='data-[state=checked]:bg-[#4791FF] h-[22px] w-[36px] data-[state=unchecked]:bg-[#E2E0E1]'
                            onCheckedChange={(checked) => {
                                trackEvent(MixpanelEvent.Onboarding_Image_Generation_Toggled, {
                                    enabled: checked,
                                    image_step_skipped: !checked,
                                });
                                setLlmConfig(prev => ({
                                    ...prev,
                                    DISABLE_IMAGE_GENERATION: !checked
                                }));
                            }}
                        />
                    </div>

                </ToolTip>
                <div className={` flex items-center gap-6 ${llmConfig.DISABLE_IMAGE_GENERATION ? "" : "mb-[42px]"}`}>
                    <div className='w-[74px] h-[74px] px-[13.5px] py-[14.2px] rounded-[4px] flex items-center justify-center'
                        style={{ backgroundColor: '#F4F3FF' }}
                    >
                        <img src="/image-markup.svg" className='w-full h-full object-cover' alt='image-markup' />
                    </div>
                    <div>

                        <h3 className="text-xl font-normal text-[#191919] ">Image Generation Settings</h3>
                        <p className=" text-sm  text-gray-500">
                            Choosing where images come from
                        </p>
                    </div>
                </div>
                {!llmConfig.DISABLE_IMAGE_GENERATION && (
                    <div className='flex flex-col gap-4'>
                        {/* Image Provider Selection */}
                        <div className="w-full">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Select Image Provider
                            </label>
                            <div className="grid w-full grid-cols-2 gap-3 sm:grid-cols-3">
                                {imageProviderRows.map((row, rowIndex) => (
                                    <React.Fragment key={`image-provider-row-${rowIndex}`}>
                                        {row.map((provider) => (
                                            <button
                                                type="button"
                                                key={provider.value}
                                                onClick={() => {
                                                    trackEvent(MixpanelEvent.Onboarding_Image_Provider_Selected, {
                                                        image_provider: provider.value,
                                                        image_provider_label: provider.label,
                                                    });
                                                    setLlmConfig(prev => ({ ...prev, IMAGE_PROVIDER: provider.value }));
                                                }}
                                                className={cn(
                                                    "group flex min-h-24 flex-col items-center justify-center gap-2 rounded-[10px] border p-3 text-center transition-all hover:border-[#D9D6FE] hover:bg-[#F7F6F9]",
                                                    llmConfig.IMAGE_PROVIDER === provider.value
                                                        ? "border-[#7A5AF8] bg-[#F4F3FF] shadow-[0_10px_24px_rgba(122,90,248,0.12)]"
                                                        : "border-[#EDEEEF] bg-white"
                                                )}
                                            >
                                                <span
                                                    className={cn(
                                                        "flex h-10 w-10 items-center justify-center rounded-lg border bg-white transition-colors",
                                                        llmConfig.IMAGE_PROVIDER === provider.value
                                                            ? "border-[#D9D6FE]"
                                                            : "border-[#EDEEEF] group-hover:border-[#D9D6FE]"
                                                    )}
                                                >
                                                    {provider.icon
                                                        ? <img src={provider.icon} alt="" className="h-7 w-7 object-contain" />
                                                        : <span className="text-sm font-semibold">{provider.label.slice(0, 1)}</span>}
                                                </span>
                                                <span className="text-xs font-semibold text-[#191919]">{provider.label}</span>
                                            </button>
                                        ))}
                                        {row.some((provider) => provider.value === llmConfig.IMAGE_PROVIDER) && renderSelectedImageProviderConfig()}
                                    </React.Fragment>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>
            </>}

            {providerStep === 3 && (
                <div className={`relative rounded-[11px] border border-[#EDEEEF] p-3 ${llmConfig.WEB_GROUNDING ? "bg-white" : "bg-[#F9FAFB]"}`}>
                    <ToolTip content="Enable/Disable Web Search" className='absolute right-3 top-3 flex items-center justify-end'>
                        <div className='flex items-center justify-end'>
                            <Switch
                                checked={!!llmConfig.WEB_GROUNDING}
                                className='data-[state=checked]:bg-[#4791FF] h-[22px] w-[36px] data-[state=unchecked]:bg-[#E2E0E1]'
                                onCheckedChange={(checked) => {
                                    trackEvent(MixpanelEvent.Onboarding_Web_Search_Toggled, {
                                        enabled: checked,
                                        web_search_step_skipped: !checked,
                                    });
                                    setLlmConfig(prev => ({
                                        ...prev,
                                        WEB_GROUNDING: checked,
                                    }));
                                }}
                            />
                        </div>
                    </ToolTip>
                    <div className="mb-[42px] flex items-center gap-6">
                        <div className='flex h-[74px] w-[74px] items-center justify-center rounded-[4px] bg-[#F4F3FF]'>
                            <Search className="h-9 w-9 text-[#5146E5]" />
                        </div>
                        <div>
                            <h3 className="text-xl font-normal text-[#191919]">Web Search Settings</h3>
                            <p className="text-sm text-gray-500">Bring current information into generated presentations</p>
                        </div>
                    </div>
                    {llmConfig.WEB_GROUNDING && <div className="space-y-4">
                            <div>
                                <label className="mb-2 block text-sm font-medium text-gray-700">Select Web Search Provider</label>
                                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                                    {webSearchProviderRows.map((row, rowIndex) => (
                                        <React.Fragment key={`web-search-provider-row-${rowIndex}`}>
                                            {row.map((provider) => (
                                                <button
                                                    type="button"
                                                    key={provider.value}
                                                    onClick={() => {
                                                        trackEvent(MixpanelEvent.Onboarding_Web_Search_Provider_Selected, {
                                                            web_search_provider: provider.value,
                                                            web_search_provider_label: provider.label,
                                                        });
                                                        setLlmConfig(prev => ({
                                                            ...prev,
                                                            WEB_GROUNDING: true,
                                                            WEB_SEARCH_PROVIDER: provider.value,
                                                        }));
                                                    }}
                                                    className={cn(
                                                        "group flex min-h-32 flex-col items-center justify-center gap-2 rounded-[10px] border p-3 text-center transition-all hover:border-[#D9D6FE] hover:bg-[#F7F6F9]",
                                                        selectedWebProvider?.value === provider.value
                                                            ? "border-[#7A5AF8] bg-[#F4F3FF] shadow-[0_10px_24px_rgba(122,90,248,0.12)]"
                                                            : "border-[#EDEEEF] bg-white"
                                                    )}
                                                >
                                                    <span
                                                        className={cn(
                                                            "flex h-10 w-10 items-center justify-center rounded-lg border bg-white transition-colors",
                                                            selectedWebProvider?.value === provider.value
                                                                ? "border-[#D9D6FE]"
                                                                : "border-[#EDEEEF] group-hover:border-[#D9D6FE]"
                                                        )}
                                                    >
                                                        {provider.icon && <img src={provider.icon} alt="" className="h-7 w-7 object-contain" />}
                                                    </span>
                                                    <span className="text-xs font-semibold text-[#191919]">{provider.label}</span>
                                                    <span className="line-clamp-2 text-[10px] leading-4 text-gray-500">{provider.description}</span>
                                                </button>
                                            ))}
                                            {row.some((provider) => provider.value === selectedWebProvider?.value) && renderSelectedWebSearchProviderConfig()}
                                        </React.Fragment>
                                    ))}
                                </div>
                            </div>
                        </div>}
                </div>
            )}

            <div className='fixed bottom-16 mr-8  max-w-[1440px]  right-16 flex justify-end items-center gap-2.5 '>
                {providerStep > 1 && (
                    <button
                        onClick={handleBack}
                        className='border border-[#EDEEEF] rounded-[53px] px-4 py-1 h-[36px]'>
                        <ChevronLeft className='w-4 h-4 text-gray-500' />
                    </button>
                )}
                <button

                    disabled={savingConfig}
                    onClick={handleContinue}
                    className='border font-syne border-[#EDEEEF] bg-[#7C51F8]  rounded-[58px] px-5 py-2.5 text-white text-xs  font-semibold'>
                    {providerStep === 1
                        ? "Continue to image provider"
                        : providerStep === 2
                            ? llmConfig.DISABLE_IMAGE_GENERATION ? "Disable image generation & Continue" : "Continue to web search"
                            : llmConfig.WEB_GROUNDING ? "Save & Finish" : "Disable web search & Finish"}
                </button>
            </div>
        </div>
    )
}

export default PresentonMode
