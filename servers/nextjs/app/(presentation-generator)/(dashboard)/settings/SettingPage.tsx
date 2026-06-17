"use client";
import React, { useState, useEffect, useCallback } from "react";
import { Loader2, ChevronRight } from "lucide-react";
import { notify } from "@/components/ui/sonner";
import { RootState } from "@/store/store";
import { useSelector } from "react-redux";
import {
  getLLMConfigValidationError,
  handleSaveLLMConfig,
} from "@/utils/storeHelpers";
import { isOllamaModelAvailable } from "@/utils/providerUtils";
import { useRouter, usePathname } from "next/navigation";
import { LLMConfig } from "@/types/llm_config";
import { trackEvent, MixpanelEvent } from "@/utils/mixpanel";
import SettingSideBar, { SettingsSection } from "./SettingSideBar";
import TextProvider from "./TextProvider";
import ImageProvider from "./ImageProvider";
import WebSearchProvider from "./WebSearchProvider";
import PrivacySettings from "./PrivacySettings";
import {
  IMAGE_PROVIDERS,
  LLM_PROVIDERS,
  WEB_SEARCH_PROVIDERS,
} from "@/utils/providerConstants";
import { ImagesApi } from "@/app/(presentation-generator)/services/api/images";
import { getApiUrl } from "@/utils/api";
import LogoutButton from "@/components/Auth/LogoutButton";

const STOCK_IMAGE_PROVIDERS = new Set(["pexels", "pixabay"]);

// Button state interface
interface ButtonState {
  isLoading: boolean;
  isDisabled: boolean;
  text: string;
  showProgress: boolean;
  progressPercentage?: number;
  status?: string;
}

const SettingsPage = () => {
  const router = useRouter();
  const pathname = usePathname();
  const [selectedProvider, setSelectedProvider] = useState<SettingsSection>("text-provider");
  const userConfigState = useSelector((state: RootState) => state.userConfig);
  const [llmConfig, setLlmConfig] = useState<LLMConfig>(
    userConfigState.llm_config
  );
  const canChangeKeys = userConfigState.can_change_keys;
  const [buttonState, setButtonState] = useState<ButtonState>({
    isLoading: false,
    isDisabled: false,
    text: "Save Configuration",
    showProgress: false,
  });

  const handleTextProviderInputChange = useCallback(
    (value: string | boolean, field: string) => {
      setLlmConfig((prev) => ({
        ...prev,
        [field]: value,
      }));
    },
    []
  );

  const selectSettingsSection = (section: SettingsSection) => {
    trackEvent(MixpanelEvent.Settings_Tab_Switched, {
      from_section: selectedProvider,
      to_section: section,
    });
    setSelectedProvider(section);
  };

  useEffect(() => {
    trackEvent(MixpanelEvent.Settings_Section_Entered, {
      section: selectedProvider,
      image_generation_enabled: !llmConfig.DISABLE_IMAGE_GENERATION,
      web_search_enabled: !!llmConfig.WEB_GROUNDING,
    });
  }, [selectedProvider, llmConfig.DISABLE_IMAGE_GENERATION, llmConfig.WEB_GROUNDING]);

  const ensureSelectedStockProviderReady = async (): Promise<boolean> => {
    if (llmConfig.DISABLE_IMAGE_GENERATION) {
      return true;
    }

    const provider = (llmConfig.IMAGE_PROVIDER || "").toLowerCase();
    if (!STOCK_IMAGE_PROVIDERS.has(provider)) {
      return true;
    }

    const providerApiKey =
      provider === "pexels" ? llmConfig.PEXELS_API_KEY : llmConfig.PIXABAY_API_KEY;

    try {
      await ImagesApi.searchStockImages("business", 1, {
        provider,
        apiKey: providerApiKey,
        strictApiKey: true,
      });
      return true;
    } catch (error: any) {
      notify.error(
        "Cannot save settings",
        error?.message ||
        `Unable to reach ${provider} with the provided API key. Please verify your settings and try again.`
      );
      return false;
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

    if (llmConfig.LLM === 'codex') {
      const isAuthenticated = await checkCurrentAuthStatus();
      if (!isAuthenticated) {
        notify.error("Sign in required", "Please sign in to ChatGPT to continue.");
        return;
      }
    }
    trackEvent(MixpanelEvent.Settings_SaveConfiguration_Button_Clicked, {
      pathname,
    });
    const validationError = getLLMConfigValidationError(llmConfig);
    if (validationError) {
      notify.warning("Cannot save settings", validationError);
      if (
        selectedProvider === "image-provider" &&
        llmConfig.LLM === "openai" &&
        !String(llmConfig.OPENAI_MODEL || "").trim()
      ) {
        setSelectedProvider("text-provider");
      }
      return;
    }

    const providerReady = await ensureSelectedStockProviderReady();
    if (!providerReady) {
      return;
    }

    try {
      setButtonState((prev) => ({
        ...prev,
        isLoading: true,
        isDisabled: true,
        text: "Saving Configuration...",
      }));
      trackEvent(MixpanelEvent.Settings_SaveConfiguration_API_Call);
      if (
        llmConfig.LLM === "ollama" &&
        llmConfig.OLLAMA_MODEL &&
        !(await isOllamaModelAvailable(
          llmConfig.OLLAMA_MODEL,
          llmConfig.OLLAMA_URL
        ))
      ) {
        throw new Error(
          `The selected model "${llmConfig.OLLAMA_MODEL}" is not available at ${llmConfig.OLLAMA_URL}. Check models and select an available model.`
        );
      }
      await handleSaveLLMConfig(llmConfig);
      notify.success(
        "Settings saved",
        "Your configuration was saved successfully."
      );
      setButtonState((prev) => ({
        ...prev,
        isLoading: false,
        isDisabled: false,
        text: "Save Configuration",
      }));
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Something went wrong while saving.";
      notify.error("Could not save settings", message);
      setButtonState((prev) => ({
        ...prev,
        isLoading: false,
        isDisabled: false,
        text: "Save Configuration",
      }));
    }
  };

  useEffect(() => {
    if (!canChangeKeys) {
      router.push("/dashboard");
    }
  }, [canChangeKeys, router]);

  if (!canChangeKeys) {
    return null;
  }

  const textProviderKey = llmConfig.LLM || "openai";
  const textProviderLabel =
    LLM_PROVIDERS[textProviderKey]?.label || textProviderKey;
  const selectedTextModel =
    textProviderKey === "openai"
      ? llmConfig.OPENAI_MODEL
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
      ? IMAGE_PROVIDERS[llmConfig.IMAGE_PROVIDER]?.label ||
      llmConfig.IMAGE_PROVIDER
      : "No image provider";
  const webSearchProviderKey = (llmConfig.WEB_SEARCH_PROVIDER || "").toLowerCase();
  const webSearchSummary = llmConfig.WEB_GROUNDING
    ? `Web: ${WEB_SEARCH_PROVIDERS[webSearchProviderKey]?.label || "No provider"}`
    : "Web search disabled";


  useEffect(() => {

    if (
      (llmConfig.LLM === "codex" && !llmConfig.CODEX_MODEL) ||
      (llmConfig.LLM === "openai" && !llmConfig.OPENAI_MODEL) ||
      (llmConfig.LLM === "google" && !llmConfig.GOOGLE_MODEL) ||
      (llmConfig.LLM === "vertex" && !llmConfig.VERTEX_MODEL) ||
      (llmConfig.LLM === "azure" && !llmConfig.AZURE_OPENAI_MODEL) ||
      (llmConfig.LLM === "bedrock" && !llmConfig.BEDROCK_MODEL) ||
      (llmConfig.LLM === "openrouter" && !llmConfig.OPENROUTER_MODEL) ||
      (llmConfig.LLM === "fireworks" && !llmConfig.FIREWORKS_MODEL) ||
      (llmConfig.LLM === "together" && !llmConfig.TOGETHER_MODEL) ||
      (llmConfig.LLM === "cerebras" && !llmConfig.CEREBRAS_MODEL) ||
      (llmConfig.LLM === "litellm" && !llmConfig.LITELLM_MODEL) ||
      (llmConfig.LLM === "lmstudio" && !llmConfig.LMSTUDIO_MODEL) ||
      (llmConfig.LLM === "anthropic" && !llmConfig.ANTHROPIC_MODEL) ||
      (llmConfig.LLM === "ollama" && !llmConfig.OLLAMA_MODEL) ||
      (llmConfig.LLM === "custom" && !llmConfig.CUSTOM_MODEL)
    ) {
      const currentUrl = window.location.href;

      const handleBeforeUnload = (e: BeforeUnloadEvent) => {
        console.log("beforeunload");
        e.preventDefault();
        e.returnValue = "";
      };

      const handleClick = (e: MouseEvent) => {


        const target = e.target as HTMLElement | null;
        const link = target?.closest("a");

        if (!link) return;

        const href = link.getAttribute("href");
        const targetAttr = link.getAttribute("target");

        if (
          href &&
          href !== "#" &&
          !href.startsWith("javascript:") &&
          targetAttr !== "_blank"
        ) {

          // notify.error("Cannot save settings", "Please select a model for the selected provider");
          e.preventDefault();
          window.history.pushState(null, "", pathname);
        }
      };

      const handlePopState = () => {
        console.log("popstate");
        window.history.pushState(null, "", pathname);
      };

      window.addEventListener("beforeunload", handleBeforeUnload);
      window.addEventListener("popstate", handlePopState);
      document.addEventListener("click", handleClick, true);

      // keep current page in history
      window.history.pushState(null, "", currentUrl);

      return () => {
        window.removeEventListener("beforeunload", handleBeforeUnload);
        window.removeEventListener("popstate", handlePopState);
        document.removeEventListener("click", handleClick, true);
      };
    }

  }, [llmConfig, pathname]);



  return (
    <div className="h-screen font-syne flex flex-col overflow-hidden relative">
      <main className="w-full mx-auto gap-6   overflow-hidden flex ">
        <SettingSideBar
          selectedProvider={selectedProvider}
          setSelectedProvider={selectSettingsSection}
        />
        <div className="w-full">
          <div className="sticky top-0 right-0 z-50 py-[28px]   backdrop-blur mb-4 ">
            <div className="flex  gap-3 items-center ">
              <h3 className=" text-[28px] tracking-[-0.84px] font-unbounded font-normal text-black flex items-center gap-2">
                Settings
              </h3>
              <p className="text-[10px] px-2.5 py-0.5 rounded-[50px] text-[#7A5AF8] border border-[#EDEEEF]  font-medium ">
                {textSummary} · {imageSummary} · {webSearchSummary}
              </p>
            </div>
          </div>

          {selectedProvider === 'text-provider' && <TextProvider
            onInputChange={handleTextProviderInputChange}
            llmConfig={llmConfig}
          />}
          {selectedProvider === 'image-provider' && <ImageProvider llmConfig={llmConfig} setLlmConfig={setLlmConfig} />}
          {selectedProvider === 'web-search-provider' && <WebSearchProvider llmConfig={llmConfig} setLlmConfig={setLlmConfig} />}
          {selectedProvider === 'privacy' && <PrivacySettings />}
          {selectedProvider === "session" && (
            <div className="w-full max-w-lg space-y-5 rounded-[20px] border border-[#EDEEEF] bg-white p-7">
              <div>
                <h4 className="font-unbounded text-lg font-normal text-black">Sign out</h4>
                <p className="mt-2 font-syne text-sm leading-relaxed text-[#494A4D]">
                  End your session on this deployment. You will need to sign in again to use the app and access the API.
                </p>
              </div>
              <LogoutButton
                label="Sign out"
                className="inline-flex w-full items-center justify-center gap-2 rounded-[58px] border border-[#EDEEEF] bg-[#7C51F8] px-5 py-3 font-syne text-xs font-semibold text-white transition hover:bg-[#6d46e6] disabled:cursor-not-allowed disabled:opacity-60"
              />
            </div>
          )}

        </div>
      </main>

      {/* Fixed Bottom Button — hidden on Sign out; nothing to save there */}
      {selectedProvider !== "session" ? (
        <div className=" mx-auto fixed bottom-20 right-5 ">
          <button
            onClick={handleSaveConfig}
            disabled={buttonState.isDisabled}
            style={{
              background:
                "linear-gradient(270deg, #D5CAFC 2.4%, #E3D2EB 27.88%, #F4DCD3 69.23%, #FDE4C2 100%)",
              color: "#101323",
            }}
            className={`w-full font-syne font-semibold flex items-center justify-center gap-2 py-3 px-5 rounded-[58px] transition-all duration-500 ${buttonState.isDisabled
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
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      ) : null}

    </div>
  );
};

export default SettingsPage;
