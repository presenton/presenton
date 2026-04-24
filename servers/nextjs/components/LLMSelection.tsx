"use client";
import { useState, useEffect } from "react";
import OpenAIConfig from "./OpenAIConfig";
import GoogleConfig from "./GoogleConfig";
import AnthropicConfig from "./AnthropicConfig";
import OllamaConfig from "./OllamaConfig";
import CustomConfig from "./CustomConfig";
import CodexConfig from "./CodexConfig";
import {
  updateLLMConfig,
  changeProvider as changeProviderUtil,
} from "@/utils/providerUtils";
import { LLMConfig } from "@/types/llm_config";
import ImageSelectionConfig from "./ImageSelectionConfig";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";




// Button state interface
interface ButtonState {
  isLoading: boolean;
  isDisabled: boolean;
  text: string;
  showProgress: boolean;
  progressPercentage?: number;
  status?: string;
}

interface LLMProviderSelectionProps {
  initialLLMConfig: LLMConfig;
  onConfigChange: (config: LLMConfig) => void;
  buttonState: ButtonState;
  setButtonState: (
    state: ButtonState | ((prev: ButtonState) => ButtonState)
  ) => void;
}


export default function LLMProviderSelection({
  initialLLMConfig,
  onConfigChange,
  setButtonState,
}: LLMProviderSelectionProps) {
  const [llmConfig, setLlmConfig] = useState<LLMConfig>(initialLLMConfig);
  const [openImageProviderSelect, setOpenImageProviderSelect] = useState(false);
  const isImageGenerationDisabled = llmConfig.DISABLE_IMAGE_GENERATION ?? false;
  useEffect(() => {
    onConfigChange(llmConfig);
  }, [llmConfig]);

  useEffect(() => {
    const needsModelSelection =
      (llmConfig.LLM === "openai" && !llmConfig.OPENAI_MODEL) ||
      (llmConfig.LLM === "google" && !llmConfig.GOOGLE_MODEL) ||
      (llmConfig.LLM === "ollama" && !llmConfig.OLLAMA_MODEL) ||
      (llmConfig.LLM === "custom" && !llmConfig.CUSTOM_MODEL) ||
      (llmConfig.LLM === "anthropic" && !llmConfig.ANTHROPIC_MODEL) ||
      (llmConfig.LLM === "codex" && !llmConfig.CODEX_MODEL);

    const needsProviderApiKey =
      (llmConfig.LLM === "openai" && !llmConfig.OPENAI_API_KEY) ||
      (llmConfig.LLM === "google" && !llmConfig.GOOGLE_API_KEY) ||
      (llmConfig.LLM === "anthropic" && !llmConfig.ANTHROPIC_API_KEY);

    const needsImageProviderApiKey =
      !llmConfig.DISABLE_IMAGE_GENERATION &&
      ((llmConfig.IMAGE_PROVIDER === "dall-e-3" && !llmConfig.OPENAI_API_KEY) ||
        (llmConfig.IMAGE_PROVIDER === "gpt-image-1.5" &&
          !llmConfig.OPENAI_API_KEY) ||
        (llmConfig.IMAGE_PROVIDER === "gemini_flash" &&
          !llmConfig.GOOGLE_API_KEY) ||
        (llmConfig.IMAGE_PROVIDER === "nanobanana_pro" &&
          !llmConfig.GOOGLE_API_KEY) ||
        (llmConfig.IMAGE_PROVIDER === "pexels" && !llmConfig.PEXELS_API_KEY) ||
        (llmConfig.IMAGE_PROVIDER === "pixabay" && !llmConfig.PIXABAY_API_KEY));

    const needsApiKey = needsProviderApiKey || needsImageProviderApiKey;

    const needsOllamaUrl = llmConfig.LLM === "ollama" && !llmConfig.OLLAMA_URL;

    const needsComfyUIConfig =
      !llmConfig.DISABLE_IMAGE_GENERATION &&
      llmConfig.IMAGE_PROVIDER === "comfyui" &&
      (!llmConfig.COMFYUI_URL || !llmConfig.COMFYUI_WORKFLOW);

    setButtonState({
      isLoading: false,
      isDisabled:
        needsModelSelection ||
        needsApiKey ||
        needsOllamaUrl ||
        needsComfyUIConfig,
      text: needsModelSelection
        ? "Please Select a Model"
        : needsApiKey
          ? "Please Enter API Key"
          : needsOllamaUrl
            ? "Please Enter Ollama URL"
            : needsComfyUIConfig
              ? "Please Configure ComfyUI"
              : "Save Configuration",
      showProgress: false,
    });
  }, [llmConfig]);

  const input_field_changed = (new_value: string | boolean, field: string) => {
    const updatedConfig = updateLLMConfig(llmConfig, field, new_value);
    setLlmConfig(updatedConfig);
  };

  const getApiKeyValue = (field?: string) => {
    switch (field) {
      case "OPENAI_API_KEY":
        return llmConfig.OPENAI_API_KEY || "";
      case "GOOGLE_API_KEY":
        return llmConfig.GOOGLE_API_KEY || "";
      case "ANTHROPIC_API_KEY":
        return llmConfig.ANTHROPIC_API_KEY || "";
      case "PEXELS_API_KEY":
        return llmConfig.PEXELS_API_KEY || "";
      case "PIXABAY_API_KEY":
        return llmConfig.PIXABAY_API_KEY || "";
      default:
        return "";
    }
  };

  const handleApiKeyInputChange = (field: string | undefined, value: string) => {
    switch (field) {
      case "OPENAI_API_KEY":
        input_field_changed(value, "openai_api_key");
        break;
      case "GOOGLE_API_KEY":
        input_field_changed(value, "google_api_key");
        break;
      case "ANTHROPIC_API_KEY":
        input_field_changed(value, "anthropic_api_key");
        break;
      case "PEXELS_API_KEY":
        input_field_changed(value, "pexels_api_key");
        break;
      case "PIXABAY_API_KEY":
        input_field_changed(value, "pixabay_api_key");
        break;
      default:
        break;
    }
  };

  const handleProviderChange = (provider: string) => {
    const newConfig = changeProviderUtil(llmConfig, provider);
    setLlmConfig(newConfig);
  };

  useEffect(() => {
    if (!llmConfig.USE_CUSTOM_URL) {
      setLlmConfig({ ...llmConfig, OLLAMA_URL: "http://localhost:11434" });
    } else {
      if (!llmConfig.OLLAMA_URL) {
        setLlmConfig({ ...llmConfig, OLLAMA_URL: "http://localhost:11434" });
      }
    }
  }, [llmConfig.USE_CUSTOM_URL]);

  useEffect(() => {
    setLlmConfig((prevConfig) => {
      const updates: Partial<LLMConfig> = {};

      if (!prevConfig.DISABLE_IMAGE_GENERATION && !prevConfig.IMAGE_PROVIDER) {
        if (prevConfig.LLM === "openai") {
          updates.IMAGE_PROVIDER = "gpt-image-1.5";
        } else if (prevConfig.LLM === "google") {
          updates.IMAGE_PROVIDER = "gemini_flash";
        } else {
          updates.IMAGE_PROVIDER = "pexels";
        }
      }

      if (!prevConfig.OLLAMA_URL) {
        updates.OLLAMA_URL = "http://localhost:11434";
      }

      if (Object.keys(updates).length === 0) {
        return prevConfig;
      }

      return { ...prevConfig, ...updates };
    });
  }, []);

  useEffect(() => {
    setLlmConfig((prevConfig) => {
      const updates: Partial<LLMConfig> = {};

      if (
        prevConfig.IMAGE_PROVIDER === "dall-e-3" &&
        !prevConfig.DALL_E_3_QUALITY
      ) {
        updates.DALL_E_3_QUALITY = "standard";
      }

      if (
        prevConfig.IMAGE_PROVIDER === "gpt-image-1.5" &&
        !prevConfig.GPT_IMAGE_1_5_QUALITY
      ) {
        updates.GPT_IMAGE_1_5_QUALITY = "medium";
      }

      if (Object.keys(updates).length === 0) {
        return prevConfig;
      }

      return { ...prevConfig, ...updates };
    });
  }, [llmConfig.IMAGE_PROVIDER]);



  return (
    <div className="h-full flex flex-col mt-10">
      {/* Provider Selection - Fixed Header */}
      <div className="p-2 rounded-2xl border border-gray-200">
        <Tabs
          value={llmConfig.LLM || "openai"}
          onValueChange={handleProviderChange}
          className="w-full"
        >
          <TabsList className="grid w-full grid-cols-6 bg-transparent h-10">
            <TabsTrigger value="openai">OpenAI</TabsTrigger>
            <TabsTrigger value="google">Google</TabsTrigger>
            <TabsTrigger value="anthropic">Anthropic</TabsTrigger>
            <TabsTrigger value="ollama">Ollama</TabsTrigger>
            <TabsTrigger value="custom">Custom</TabsTrigger>
            <TabsTrigger value="codex">ChatGPT</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-6 pt-0 custom_scrollbar">
        <Tabs
          value={llmConfig.LLM || "openai"}
          onValueChange={handleProviderChange}
          className="w-full"
        >
          {/* OpenAI Content */}
          <TabsContent value="openai" className="mt-6">
            <OpenAIConfig
              llmConfig={llmConfig}
              openaiApiKey={llmConfig.OPENAI_API_KEY || ""}
              openaiModel={llmConfig.OPENAI_MODEL || ""}
              webGrounding={llmConfig.WEB_GROUNDING || false}
              onInputChange={input_field_changed}
            />
          </TabsContent>

          {/* Google Content */}
          <TabsContent value="google" className="mt-6">
            <GoogleConfig
              googleApiKey={llmConfig.GOOGLE_API_KEY || ""}
              googleModel={llmConfig.GOOGLE_MODEL || ""}
              webGrounding={llmConfig.WEB_GROUNDING || false}
              onInputChange={input_field_changed}
            />
          </TabsContent>

          {/* Anthropic Content */}
          <TabsContent value="anthropic" className="mt-6">
            <AnthropicConfig
              anthropicApiKey={llmConfig.ANTHROPIC_API_KEY || ""}
              anthropicModel={llmConfig.ANTHROPIC_MODEL || ""}
              extendedReasoning={llmConfig.EXTENDED_REASONING || false}
              webGrounding={llmConfig.WEB_GROUNDING || false}
              onInputChange={input_field_changed}
            />
          </TabsContent>

          {/* Ollama Content */}
          <TabsContent value="ollama" className="mt-6">
            <OllamaConfig
              ollamaModel={llmConfig.OLLAMA_MODEL || ""}
              ollamaUrl={llmConfig.OLLAMA_URL || ""}
              useCustomUrl={llmConfig.USE_CUSTOM_URL || false}
              onInputChange={input_field_changed}
            />
          </TabsContent>

          {/* Custom Content */}
          <TabsContent value="custom" className="mt-6">
            <CustomConfig
              customLlmUrl={llmConfig.CUSTOM_LLM_URL || ""}
              customLlmApiKey={llmConfig.CUSTOM_LLM_API_KEY || ""}
              customModel={llmConfig.CUSTOM_MODEL || ""}
              disableThinking={llmConfig.DISABLE_THINKING || false}
              onInputChange={input_field_changed}
            />
          </TabsContent>

          {/* ChatGPT / Codex Content */}
          <TabsContent value="codex" className="mt-6">
            <CodexConfig
              codexModel={llmConfig.CODEX_MODEL || ""}
              onInputChange={input_field_changed}
            />
          </TabsContent>
        </Tabs>

        {/* Image Generation Toggle */}
        <ImageSelectionConfig
          isImageGenerationDisabled={isImageGenerationDisabled}
          openImageProviderSelect={openImageProviderSelect}
          setOpenImageProviderSelect={setOpenImageProviderSelect}
          llmConfig={llmConfig}
          input_field_changed={input_field_changed}
          getApiKeyValue={getApiKeyValue}
          handleApiKeyInputChange={handleApiKeyInputChange}
        />
        {/* <div className="my-8">
          <div className="flex items-center justify-between mb-4 bg-green-50 p-2 rounded-sm">
            <label className="text-sm font-medium text-gray-700">
              Disable Image Generation
            </label>
            <Switch
              checked={isImageGenerationDisabled}
              onCheckedChange={(checked) => {
                input_field_changed(checked, "disable_image_generation");
                if (checked) {
                  setOpenImageProviderSelect(false);
                }
              }}
            />
          </div>
          <p className="text-sm text-gray-500 flex items-center gap-2">
            <span className="block w-1 h-1 rounded-full bg-gray-400"></span>
            When enabled, slides will not include automatically generated
            images.
          </p>
        </div> */}



        {/* Model Information */}
        {/* <div className="mb-8 p-4 bg-blue-50 rounded-lg border border-blue-100">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-500 mt-0.5" />
            <div>
              <h3 className="text-sm font-medium text-blue-900 mb-1">
                Selected Models
              </h3>
              <p className="text-sm text-blue-700">
                Using{" "}
                {llmConfig.LLM === "ollama"
                  ? llmConfig.OLLAMA_MODEL ?? "xxxxx"
                  : llmConfig.LLM === "custom"
                  ? llmConfig.CUSTOM_MODEL ?? "xxxxx"
                  : llmConfig.LLM === "anthropic"
                  ? llmConfig.ANTHROPIC_MODEL ?? "xxxxx"
                  : llmConfig.LLM === "google"
                  ? llmConfig.GOOGLE_MODEL ?? "xxxxx"
                  : llmConfig.LLM === "openai"
                  ? llmConfig.OPENAI_MODEL ?? "xxxxx"
                  : llmConfig.LLM === "codex"
                  ? llmConfig.CODEX_MODEL ?? "xxxxx"
                  : "xxxxx"}{" "}
                for text generation{" "}
                {isImageGenerationDisabled ? (
                  "and image generation is disabled."
                ) : (
                  <>
                    and{" "}
                    {llmConfig.IMAGE_PROVIDER &&
                      IMAGE_PROVIDERS[llmConfig.IMAGE_PROVIDER]
                      ? IMAGE_PROVIDERS[llmConfig.IMAGE_PROVIDER].label
                      : "xxxxx"}{" "}
                    for images
                  </>
                )}
              </p>
            </div>
          </div>
        </div> */}
        {/* <button
          onClick={handleSaveConfig}
          disabled={buttonState.isDisabled}
          style={{
            background: "linear-gradient(270deg, #D5CAFC 2.4%, #E3D2EB 27.88%, #F4DCD3 69.23%, #FDE4C2 100%)",
            color: "#101323",
          }}
          className={`w-full font-semibold py-3 px-4 rounded-lg transition-all duration-500 ${buttonState.isDisabled
            ? "bg-gray-400 cursor-not-allowed"
            : "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 focus:ring-4 focus:ring-blue-200"
            } text-white`}
        >
          {buttonState.isLoading ? (
            <div className="flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              {buttonState.text}
            </div>
          ) : (
            buttonState.text
          )}
        </button> */}
      </div>
    </div>
  );
}
