import React, { useEffect, useMemo, useState } from 'react'
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Button } from '../ui/button';
import { ArrowUpRight, Check, CheckCircle, ChevronLeft, ChevronUp, Download, Eye, EyeOff, Info, Loader2 } from 'lucide-react';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '../ui/command';
import { DALLE_3_QUALITY_OPTIONS, GPT_IMAGE_1_5_QUALITY_OPTIONS, IMAGE_PROVIDERS, LLM_PROVIDERS } from '@/utils/providerConstants';
import { cn } from '@/lib/utils';
import { LLMConfig } from '@/types/llm_config';
import { RootState } from '@/store/store';
import { useSelector } from 'react-redux';
import { toast } from 'sonner';
import ToolTip from '../ToolTip';
import { Switch } from '../ui/switch';
import { Select, SelectItem, SelectContent, SelectValue, SelectTrigger } from '../ui/select';
import { MixpanelEvent, trackEvent } from '@/utils/mixpanel';
import { usePathname } from 'next/navigation';
import { handleSaveLLMConfig } from '@/utils/storeHelpers';
import { checkIfSelectedOllamaModelIsPulled, pullOllamaModel } from '@/utils/providerUtils';
import { getApiUrl } from '@/utils/api';
import CodexConfig, { CHATGPT_MODELS } from '../CodexConfig';

const PresentonMode = ({ currentStep, setStep }: { currentStep: number, setStep: (step: number) => void }) => {
    const pathname = usePathname();
    const [openProviderSelect, setOpenProviderSelect] = useState(false);
    const [openImageProviderSelect, setOpenImageProviderSelect] = useState(false);
    const userConfigState = useSelector((state: RootState) => state.userConfig);

    const [showApiKey, setShowApiKey] = useState(false);
    const [availableModels, setAvailableModels] = useState<string[]>([]);
    const [openModelSelect, setOpenModelSelect] = useState(false);
    const [modelsLoading, setModelsLoading] = useState(false);
    const [modelsChecked, setModelsChecked] = useState(false);
    const [showDownloadModal, setShowDownloadModal] = useState(false);
    const [savingConfig, setSavingConfig] = useState(false);
    const [llmConfig, setLlmConfig] = useState<LLMConfig>(
        userConfigState.llm_config
    );
    const [downloadingModel, setDownloadingModel] = useState<{
        name: string;
        size: number | null;
        downloaded: number | null;
        status: string;
        done: boolean;
    } | null>(null);

    const handleProviderChange = (provider: string) => {
        setLlmConfig(prev => ({
            ...prev,
            LLM: provider
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
            case 'google':
                return 'GOOGLE_MODEL';
            case 'anthropic':
                return 'ANTHROPIC_MODEL';
            case 'ollama':
                return 'OLLAMA_MODEL';
            case 'custom':
                return 'CUSTOM_MODEL';
            default:
                return '';
        }
    }, [llmConfig.LLM]);
    const currentApiKeyField = useMemo(() => {
        switch (llmConfig.LLM) {
            case 'openai':
                return 'OPENAI_API_KEY';
            case 'google':
                return 'GOOGLE_API_KEY';
            case 'anthropic':
                return 'ANTHROPIC_API_KEY';
            case 'custom':
                return 'CUSTOM_LLM_API_KEY';
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
    const currentOllamaUrl = llmConfig.OLLAMA_URL || '';
    const useCustomOllamaUrl = !!llmConfig.USE_CUSTOM_URL;

    const getSelectedTextModel = (config: LLMConfig): string => {
        switch (config.LLM) {
            case 'openai':
                return config.OPENAI_MODEL || '';
            case 'google':
                return config.GOOGLE_MODEL || '';
            case 'anthropic':
                return config.ANTHROPIC_MODEL || '';
            case 'ollama':
                return config.OLLAMA_MODEL || '';
            case 'custom':
                return config.CUSTOM_MODEL || '';
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

    const fetchAvailableModels = async () => {
        if (llmConfig.LLM === 'openai' && !currentApiKey) return;
        if (llmConfig.LLM === 'google' && !currentApiKey) return;
        if (llmConfig.LLM === 'anthropic' && !currentApiKey) return;
        if (llmConfig.LLM === 'custom' && !llmConfig.CUSTOM_LLM_URL) return;
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
            } else if (llmConfig.LLM === 'ollama') {
                response = await fetch(getApiUrl('/api/v1/ppt/ollama/models/supported'));
            } else {
                response = await fetch(getApiUrl('/api/v1/ppt/openai/models/available'), {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        url: llmConfig.LLM === 'custom' ? llmConfig.CUSTOM_LLM_URL : LLM_PROVIDERS[llmConfig.LLM!]?.url || '',
                        api_key: currentApiKey
                    }),
                });
            }

            if (response.ok) {
                const data = await response.json();
                const normalizedModels: string[] = llmConfig.LLM === 'ollama'
                    ? Array.isArray(data)
                        ? data.map((model: { value?: string; label?: string }) => model.value || model.label || '').filter(Boolean)
                        : []
                    : Array.isArray(data)
                        ? data
                        : [];

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
                            : llmConfig.LLM === 'google'
                                ? 'models/gemini-2.5-flash'
                                : llmConfig.LLM === 'anthropic'
                                    ? 'claude-sonnet-4-20250514'
                                    : normalizedModels[0];

                    const nextModel = normalizedModels.includes(preferredDefault) ? preferredDefault : normalizedModels[0];
                    setLlmConfig(prev => ({
                        ...prev,
                        [currentModelField]: nextModel
                    }));
                }
            } else {
                console.error('Failed to fetch models');
                setAvailableModels([]);
                setModelsChecked(true);
                toast.error(`Failed to fetch ${LLM_PROVIDERS[llmConfig.LLM!]?.label} models`);
            }
        } catch (error) {
            console.error('Error fetching models:', error);
            toast.error('Error fetching models');
            setAvailableModels([]);
            setModelsChecked(true);
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
                        <Select value={llmConfig.DALL_E_3_QUALITY || 'standard'} onValueChange={(value) => setLlmConfig((prev) => ({
                            ...prev,
                            DALL_E_3_QUALITY: value
                        }))}>
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
                            onValueChange={(value) => setLlmConfig((prev) => ({
                                ...prev,
                                GPT_IMAGE_1_5_QUALITY: value
                            }))}
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
    const handleModelDownload = async () => {
        try {
            await pullOllamaModel(llmConfig.OLLAMA_MODEL!, setDownloadingModel);
        }
        finally {
            setDownloadingModel(null);
            setShowDownloadModal(false);
        }
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
                    toast.error("Please sign in to ChatGPT to continue");
                    return;
                }
            }
            setSavingConfig(true);
            await handleSaveLLMConfig(llmConfig);

            if (llmConfig.LLM === "ollama" && llmConfig.OLLAMA_MODEL) {
                const isPulled = await checkIfSelectedOllamaModelIsPulled(llmConfig.OLLAMA_MODEL);
                if (!isPulled) {
                    setShowDownloadModal(true);
                    await handleModelDownload();
                }
            }

            const textProvider = llmConfig.LLM || '';
            const textModel = getSelectedTextModel(llmConfig);
            const imageGenerationEnabled = !llmConfig.DISABLE_IMAGE_GENERATION;
            const imageProvider = imageGenerationEnabled ? (llmConfig.IMAGE_PROVIDER || '') : 'disabled';

            trackEvent(MixpanelEvent.Onboarding_Providers_Models_Selected, {
                pathname,
                text_provider: textProvider,
                text_provider_label: LLM_PROVIDERS[textProvider]?.label || textProvider || '',
                text_model: textModel,
                uses_chatgpt_login: textProvider === 'codex',
                image_generation_enabled: imageGenerationEnabled,
                image_provider: imageProvider,
                image_provider_label: imageGenerationEnabled
                    ? (IMAGE_PROVIDERS[imageProvider]?.label || imageProvider || '')
                    : 'Image generation disabled',
                image_quality: imageGenerationEnabled ? getSelectedImageQuality(llmConfig) : ''
            });

            toast.info("Configuration saved successfully");
            setStep(3)
            // router.push("/upload");
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to save configuration");

        }
        finally {
            setSavingConfig(false);
        }
    };

    const downloadProgress = useMemo(() => {
        if (downloadingModel && downloadingModel.downloaded !== null && downloadingModel.size !== null) {
            return Math.round((downloadingModel.downloaded / downloadingModel.size) * 100);
        }
        return 0;
    }, [downloadingModel?.downloaded, downloadingModel?.size]);

    useEffect(() => {
        if (llmConfig.LLM === 'ollama' && !modelsChecked && !modelsLoading) {
            void fetchAvailableModels();
        }
    }, [llmConfig.LLM, modelsChecked, modelsLoading]);

    return (
        <div className='w-full max-w-[660px] font-syne pb-10'>
            <p className='px-2.5 py-0.5 w-fit text-[#7A5AF8] rounded-[50px]  border border-[#EDEEEF] text-[10px] font-medium mb-5 font-syne'>PRESENTON</p>
            <div className=''>

                <h2 className='mb-4 text-black text-[26px] font-normal font-unbounded '>Choose your content providers</h2>
                <p className='text-[#000000CC] text-xl font-normal font-syne'>Select the AI engines that will generate your slide text and visuals.</p>
            </div>
            <div className='flex items-center gap-2 bg-[#F0F3F9B2] rounded-[8px]  px-6 py-2.5 my-[54px]'>
                <Info className='w-4 h-4 fill-[#003399] stroke-white' />
                <p className='text-sm text-[#5F6062] font-medium'>Runs locally on your device. Your API keys and generation setup stay on your machine.</p>
            </div>

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
                <CodexConfig
                    codexModel={llmConfig.CODEX_MODEL || ''}
                    onInputChange={(value, field) => {
                        const normalizedField = field === 'codex_model' ? 'CODEX_MODEL' : field;
                        setLlmConfig(prev => ({
                            ...prev,
                            [normalizedField]: value
                        }));
                    }}
                />
                <div className='flex items-center gap-2.5 my-[30px]'>
                    <div className='w-full h-[1px] bg-[#E1E1E5]' />
                    <p className='text-xs font-normal text-[#999999]'>OR</p>
                    <div className='w-full h-[1px] bg-[#E1E1E5]' />
                </div>
                <div className='flex flex-col items-start gap-4 '>
                    <div className="flex flex-col justify-start w-full ">

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
                                    className=" h-12 px-4 py-4 outline-none border border-[#E8E8E9] rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors hover:border-gray-400 justify-between"
                                >
                                    <div className="flex gap-3 items-center">
                                        <span className="text-sm font-medium text-gray-900">
                                            {llmConfig.LLM
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
                                            {Object.values(LLM_PROVIDERS).map(
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
                    <div className="relative flex flex-col justify-end  items-end  w-full ">
                        <div className="flex flex-col justify-start w-full ">
                            {llmConfig.LLM === 'ollama' ? (
                                <>
                                    {!useCustomOllamaUrl ? (
                                        <button
                                            type="button"
                                            onClick={() => setLlmConfig(prev => ({
                                                ...prev,
                                                USE_CUSTOM_URL: true,
                                                OLLAMA_URL: prev.OLLAMA_URL || 'http://localhost:11434'
                                            }))}
                                            className="py-2.5 bg-[#EDEEEF] px-3.5 w-fit rounded-[48px] text-xs font-semibold text-[#101323] transition-all duration-200 border border-[#EDEEEF] hover:bg-[#E8F0FF]/90 focus:ring-2 focus:ring-blue-500/20"
                                        >
                                            Use Ollama URL
                                        </button>
                                    ) : (
                                        <>
                                            <label className="block text-sm font-medium capitalize text-gray-700 mb-2">
                                                Ollama URL
                                            </label>
                                            <div className="relative">
                                                <input
                                                    type="text"
                                                    value={currentOllamaUrl}
                                                    onChange={(e) => setLlmConfig(prev => ({
                                                        ...prev,
                                                        OLLAMA_URL: e.target.value
                                                    }))}
                                                    className="w-full px-2 py-3 outline-none border  border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
                                                    placeholder="http://localhost:11434"
                                                />
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => setLlmConfig(prev => ({
                                                    ...prev,
                                                    USE_CUSTOM_URL: false,
                                                    OLLAMA_URL: 'http://localhost:11434'
                                                }))}
                                                className="mt-2 text-xs font-medium text-[#4B5563] underline underline-offset-2"
                                            >
                                                Use default Ollama URL
                                            </button>
                                        </>
                                    )}
                                </>
                            ) : llmConfig.LLM === 'codex' || llmConfig.LLM === 'chatgpt' ? (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Select GPT Model
                                    </label>
                                    <Popover open={openModelSelect} onOpenChange={setOpenModelSelect}>
                                        <PopoverTrigger asChild>
                                            <Button
                                                variant="outline"
                                                role="combobox"
                                                aria-expanded={openModelSelect}
                                                className="w-full h-12 px-3 outline-none border border-gray-300 rounded-lg hover:border-gray-400 justify-between"
                                            >
                                                <span className="text-sm text-gray-900">
                                                    {llmConfig.CODEX_MODEL
                                                        ? (CHATGPT_MODELS.find((m) => m.id === llmConfig.CODEX_MODEL)?.name ?? llmConfig.CODEX_MODEL)
                                                        : "Select a model"}
                                                </span>
                                                <ChevronUp className="w-4 h-4 text-gray-400" />
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent
                                            className="p-0"
                                            align="start"
                                            style={{ width: "var(--radix-popover-trigger-width)" }}
                                        >
                                            <Command>
                                                <CommandInput placeholder="Search models…" />
                                                <CommandList>
                                                    <CommandEmpty>No model found.</CommandEmpty>
                                                    <CommandGroup>
                                                        {CHATGPT_MODELS.map((model) => (
                                                            <CommandItem
                                                                key={model.id}
                                                                value={model.id}
                                                                onSelect={(value) => {
                                                                    setLlmConfig(prev => ({
                                                                        ...prev,
                                                                        CODEX_MODEL: value
                                                                    }));
                                                                    setOpenModelSelect(false);
                                                                }}
                                                            >
                                                                <Check
                                                                    className={cn(
                                                                        "mr-2 h-4 w-4",
                                                                        llmConfig.CODEX_MODEL === model.id ? "opacity-100" : "opacity-0"
                                                                    )}
                                                                />
                                                                <span className="text-sm text-gray-900">
                                                                    {model.name}
                                                                </span>
                                                            </CommandItem>
                                                        ))}
                                                    </CommandGroup>
                                                </CommandList>
                                            </Command>
                                        </PopoverContent>
                                    </Popover>
                                </div>
                            ) : (
                                <>
                                    <div className='flex items-center justify-between mb-2'>

                                        <label className="block text-sm font-medium capitalize text-gray-700 ">
                                            {llmConfig.LLM === 'custom' ? 'Custom LLM API Key' : `${llmConfig.LLM} API Key`}
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
                                            placeholder={`Enter your ${llmConfig.LLM} API key`}
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


                        </div>


                        {llmConfig.LLM !== 'ollama' && llmConfig.LLM !== 'codex' && llmConfig.LLM !== 'chatgpt' && (!modelsChecked || (modelsChecked && availableModels.length === 0)) && (

                            <button
                                onClick={fetchAvailableModels}
                                disabled={
                                    modelsLoading ||
                                    (llmConfig.LLM === 'openai' && !currentApiKey) ||
                                    (llmConfig.LLM === 'google' && !currentApiKey) ||
                                    (llmConfig.LLM === 'anthropic' && !currentApiKey) ||
                                    (llmConfig.LLM === 'custom' && !llmConfig.CUSTOM_LLM_URL)
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
                <div className='flex items-start gap-4 mt-4'>


                    {/* Model Selection - only show if models are available */}
                    {llmConfig.LLM !== 'codex' && modelsChecked && availableModels.length > 0 && (
                        <div className="w-full">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    {llmConfig.LLM === 'ollama' ? 'Choose a supported model' : `Select ${LLM_PROVIDERS[llmConfig.LLM!]?.label} Model`}
                                </label>
                                <div className="w-full">
                                    <Popover
                                        open={openModelSelect}
                                        onOpenChange={setOpenModelSelect}
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
            {/* Image Provider */}
            <div className={`p-3 border border-[#EDEEEF] rounded-[11px] relative mt-5 bg-white ${llmConfig.DISABLE_IMAGE_GENERATION ? "bg-[#F9FAFB]" : ""}`}>
                <ToolTip content="Enable/Disable Image Generation" className='flex justify-end items-center absolute top-3 right-3'>
                    <div className='flex justify-end items-center'>
                        <Switch
                            checked={!llmConfig.DISABLE_IMAGE_GENERATION}
                            className='data-[state=checked]:bg-[#4791FF] h-[22px] w-[36px] data-[state=unchecked]:bg-[#E2E0E1]'
                            onCheckedChange={(checked) => setLlmConfig(prev => ({
                                ...prev,
                                DISABLE_IMAGE_GENERATION: !checked
                            }))}
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
                            <div className="w-full">
                                <Popover
                                    open={openImageProviderSelect}
                                    onOpenChange={setOpenImageProviderSelect}

                                >
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="outline"
                                            role="combobox"
                                            aria-expanded={openImageProviderSelect}
                                            className=" w-full h-12 px-4 py-4 outline-none border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors hover:border-gray-400 justify-between"
                                        >
                                            <div className="flex gap-3 items-center">
                                                <span className="text-sm font-medium capitalize text-gray-900">
                                                    {llmConfig.IMAGE_PROVIDER
                                                        ? IMAGE_PROVIDERS[llmConfig.IMAGE_PROVIDER]
                                                            ?.label || llmConfig.IMAGE_PROVIDER
                                                        : 'Select Image Provider'}
                                                </span>
                                            </div>
                                            <ChevronUp className="w-4 h-4 text-gray-500" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent
                                        className="p-0 w-full"
                                        align="start"

                                    >
                                        <Command>
                                            <CommandInput placeholder="Search provider..." />
                                            <CommandList>
                                                <CommandEmpty>No provider found.</CommandEmpty>
                                                <CommandGroup>
                                                    {Object.values(IMAGE_PROVIDERS).map(
                                                        (provider, index) => (
                                                            <CommandItem
                                                                key={index}
                                                                value={provider.value}
                                                                onSelect={(value) => {
                                                                    setLlmConfig(prev => ({
                                                                        ...prev,
                                                                        IMAGE_PROVIDER: value
                                                                    }));
                                                                    setOpenImageProviderSelect(false);
                                                                }}
                                                            >
                                                                <Check
                                                                    className={cn(
                                                                        "mr-2 h-4 w-4",
                                                                        llmConfig.IMAGE_PROVIDER === provider.value
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



                        {/* Dynamic API Key Input for Image Provider */}
                        {llmConfig.IMAGE_PROVIDER &&
                            IMAGE_PROVIDERS[llmConfig.IMAGE_PROVIDER] &&
                            (() => {
                                const provider = IMAGE_PROVIDERS[llmConfig.IMAGE_PROVIDER];



                                // Show ComfyUI configuration
                                if (provider.value === "comfyui") {
                                    return (
                                        <div className=" space-y-4 w-full">
                                            <div className=''>
                                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                                    ComfyUI Server URL
                                                </label>
                                                <div className="relative">
                                                    <input
                                                        type="text"
                                                        placeholder="http://192.168.1.7:8188"
                                                        className="w-full px-4 py-2.5 outline-none border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
                                                        value={llmConfig.COMFYUI_URL || ""}
                                                        onChange={(e) => {
                                                            setLlmConfig(prev => ({
                                                                ...prev,
                                                                COMFYUI_URL: e.target.value
                                                            }));
                                                        }}
                                                    />
                                                </div>

                                            </div>

                                        </div>
                                    );
                                }

                                // Show API key input for other providers
                                return (
                                    <div className="w-full ">
                                        <div className='flex items-center justify-between mb-2'>

                                            <label className="block text-sm font-medium text-gray-700">
                                                {provider.apiKeyFieldLabel}
                                            </label>
                                            {provider.getApiKeyUrl && <a href={provider.getApiKeyUrl || ""} target='_blank' className='text-[#666666] text-xs font-normal flex items-center gap-1'>Get API Key <ArrowUpRight className='w-3.5 h-3.5' /></a>}
                                        </div>
                                        <div className="relative">
                                            <input
                                                type={showApiKey ? 'text' : 'password'}
                                                placeholder={`Enter your ${provider.apiKeyFieldLabel}`}
                                                className="w-full px-4 py-2.5 h-12 outline-none border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
                                                value={getFieldValue(provider.apiKeyField)}
                                                onChange={(e) => {
                                                    setLlmConfig((prev) => ({
                                                        ...prev,
                                                        [provider.apiKeyField as keyof LLMConfig]: e.target.value
                                                    }))
                                                }

                                                }
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowApiKey((prev) => !prev)}
                                                className='absolute right-2 top-1/2 -translate-y-1/2 bg-white px-2 py-1 cursor-pointer'
                                            >
                                                {showApiKey ? <Eye className='w-4 h-4 text-gray-500' /> : <EyeOff className='w-4 h-4 text-gray-500' />}
                                            </button>
                                        </div>

                                    </div>
                                );
                            })()}

                    </div>
                )}
                {!llmConfig.DISABLE_IMAGE_GENERATION && <div className='flex flex-col justify-end items-center mt-[18px]'>
                    <div className='w-full flex items-center gap-4'>

                        {renderQualitySelector(llmConfig)}
                    </div>
                    {llmConfig.IMAGE_PROVIDER === "comfyui" && <div className='w-full'>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Workflow JSON
                        </label>
                        <div className="relative">
                            <textarea
                                placeholder='Paste your ComfyUI workflow JSON here (export via "Export (API)" in ComfyUI)'
                                className="w-full px-4 py-2.5 outline-none border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors font-mono text-xs"
                                rows={3}
                                value={llmConfig.COMFYUI_WORKFLOW || ""}
                                onChange={(e) => {
                                    setLlmConfig((prev) => ({
                                        ...prev,
                                        COMFYUI_WORKFLOW: e.target.value
                                    }))
                                }}
                            />
                        </div>

                    </div>}
                </div>}
            </div>

            <div className='fixed bottom-16 mr-8  max-w-[1440px]  right-16 flex justify-end items-center gap-2.5 '>
                <button
                    disabled={currentStep === 1}
                    onClick={() => {
                        setStep(currentStep - 1);
                    }}
                    className='border border-[#EDEEEF] rounded-[53px] px-4 py-1 h-[36px]'>
                    <ChevronLeft className='w-4 h-4 text-gray-500' />
                </button>
                <button

                    disabled={savingConfig}
                    onClick={handleSaveConfig}
                    className='border font-syne border-[#EDEEEF] bg-[#7C51F8]  rounded-[58px] px-5 py-2.5 text-white text-xs  font-semibold'>
                    Continue to Finish
                </button>
            </div>
            {/* Download Progress Modal */}
            {showDownloadModal && downloadingModel && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white/95 backdrop-blur-md rounded-xl shadow-2xl max-w-md w-full p-6 relative">
                        {/* Modal Content */}
                        <div className="text-center">
                            {/* Icon */}
                            <div className="mb-4">
                                {downloadingModel.done ? (
                                    <CheckCircle className="w-12 h-12 text-green-600 mx-auto" />
                                ) : (
                                    <Download className="w-12 h-12 text-blue-600 mx-auto animate-pulse" />
                                )}
                            </div>

                            {/* Title */}
                            <h3 className="text-lg font-semibold text-gray-900 mb-2">
                                {downloadingModel.done ? "Download Complete!" : "Downloading Model"}
                            </h3>

                            {/* Model Name */}
                            <p className="text-sm text-gray-600 mb-6">
                                {llmConfig.OLLAMA_MODEL}
                            </p>

                            {/* Progress Bar */}
                            {downloadProgress > 0 && (
                                <div className="mb-4">
                                    <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                                        <div
                                            className="bg-blue-600 h-3 rounded-full transition-all duration-300 ease-out"
                                            style={{ width: `${downloadProgress}%` }}
                                        />
                                    </div>
                                    <p className="text-sm text-gray-600 mt-2">
                                        {downloadProgress}% Complete
                                    </p>
                                </div>
                            )}

                            {/* Status */}
                            {downloadingModel.status && (
                                <div className="flex items-center justify-center gap-2 mb-4">
                                    <CheckCircle className="w-4 h-4 text-green-600" />
                                    <span className="text-sm font-medium text-green-700 capitalize">
                                        {downloadingModel.status}
                                    </span>
                                </div>
                            )}

                            {/* Status Message */}
                            {downloadingModel.status && downloadingModel.status !== "pulled" && (
                                <div className="text-xs text-gray-500">
                                    {downloadingModel.status === "downloading" && "Downloading model files..."}
                                    {downloadingModel.status === "verifying" && "Verifying model integrity..."}
                                    {downloadingModel.status === "pulling" && "Pulling model from registry..."}
                                </div>
                            )}

                            {/* Download Info */}
                            {downloadingModel.downloaded && downloadingModel.size && (
                                <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                                    <div className="flex justify-between text-xs text-gray-600">
                                        <span>Downloaded: {(downloadingModel.downloaded / 1024 / 1024).toFixed(1)} MB</span>
                                        <span>Total: {(downloadingModel.size / 1024 / 1024).toFixed(1)} MB</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

export default PresentonMode
