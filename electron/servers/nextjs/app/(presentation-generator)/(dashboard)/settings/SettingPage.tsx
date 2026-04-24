"use client";
import React, { useState, useEffect } from "react";
import { Loader2, Download, CheckCircle, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { notify } from "@/components/ui/sonner";
import { RootState } from "@/store/store";
import { useSelector } from "react-redux";
import {
  getLLMConfigValidationError,
  handleSaveLLMConfig,
} from "@/utils/storeHelpers";
import {
  checkIfSelectedOllamaModelIsPulled,
  pullOllamaModel,
} from "@/utils/providerUtils";
import { useRouter, usePathname } from "next/navigation";
import { LLMConfig } from "@/types/llm_config";
import { trackEvent, MixpanelEvent } from "@/utils/mixpanel";
import SettingSideBar from "./SettingSideBar";
import TextProvider from "./TextProvider";
import ImageProvider from "./ImageProvider";
import PrivacySettings from "./PrivacySettings";
import { IMAGE_PROVIDERS, LLM_PROVIDERS } from "@/utils/providerConstants";
import { ImagesApi } from "@/app/(presentation-generator)/services/api/images";
import { getApiUrl } from "@/utils/api";
import { toast } from "sonner";

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
  const [mode, setMode] = useState<'nanobanana' | 'presenton'>('presenton')
  const [selectedProvider, setSelectedProvider] = useState<'text-provider' | 'image-provider' | 'privacy'>('text-provider')
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

  const [downloadingModel, setDownloadingModel] = useState<{
    name: string;
    size: number | null;
    downloaded: number | null;
    status: string;
    done: boolean;
  } | null>(null);
  const [showDownloadModal, setShowDownloadModal] = useState<boolean>(false);
  const downloadAbortRef = React.useRef<AbortController | null>(null);

  const downloadProgress = React.useMemo(() => {
    if (
      downloadingModel &&
      downloadingModel.downloaded !== null &&
      downloadingModel.size !== null
    ) {
      return Math.round(
        (downloadingModel.downloaded / downloadingModel.size) * 100
      );
    }
    return 0;
  }, [downloadingModel?.downloaded, downloadingModel?.size]);

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
        toast.error("Please sign in to ChatGPT to continue");
        return;
      }
    }
    trackEvent(MixpanelEvent.Settings_SaveConfiguration_Button_Clicked, { pathname });
    const validationError = getLLMConfigValidationError(llmConfig);
    if (validationError) {
      notify.error("Cannot save settings", validationError);
      return;
    }

    const providerReady = await ensureSelectedStockProviderReady();
    if (!providerReady) {
      return;
    }

    try {
      setButtonState(prev => ({
        ...prev,
        isLoading: true,
        isDisabled: true,
        text: "Saving Configuration...",
      }));
      trackEvent(MixpanelEvent.Settings_SaveConfiguration_API_Call);
      await handleSaveLLMConfig(llmConfig);
      if (llmConfig.LLM === "ollama" && llmConfig.OLLAMA_MODEL) {
        trackEvent(MixpanelEvent.Settings_CheckOllamaModelPulled_API_Call);
        const isPulled = await checkIfSelectedOllamaModelIsPulled(
          llmConfig.OLLAMA_MODEL
        );
        if (!isPulled) {
          setShowDownloadModal(true);
          setDownloadingModel({
            name: llmConfig.OLLAMA_MODEL || "",
            size: null,
            downloaded: null,
            status: "pulling",
            done: false,
          });
          trackEvent(MixpanelEvent.Settings_DownloadOllamaModel_API_Call);
          const downloadOutcome = await handleModelDownload();
          if (downloadOutcome === "cancelled") {
            return;
          }
        }
      }
      notify.info(
        "Settings saved",
        "Your configuration was saved successfully."
      );
      setButtonState(prev => ({
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
      setButtonState(prev => ({
        ...prev,
        isLoading: false,
        isDisabled: false,
        text: "Save Configuration",
      }));
    }
  };

  const handleModelDownload = async (): Promise<"completed" | "cancelled"> => {
    const ac = new AbortController();
    downloadAbortRef.current = ac;
    try {
      await pullOllamaModel(
        llmConfig.OLLAMA_MODEL!,
        setDownloadingModel,
        ac.signal
      );
      return "completed";
    } catch (e) {
      const aborted = e instanceof Error && e.name === "AbortError";
      if (aborted) {
        setDownloadingModel(null);
        setShowDownloadModal(false);
        setButtonState({
          isLoading: false,
          isDisabled: false,
          text: "Save Configuration",
          showProgress: false,
        });
        notify.info(
          "Download cancelled",
          "The Ollama model download was stopped. Your settings are already saved—you can save again to retry the download."
        );
        return "cancelled";
      }
      setDownloadingModel(null);
      setShowDownloadModal(false);
      throw e;
    } finally {
      downloadAbortRef.current = null;
    }
  };

  useEffect(() => {
    if (
      downloadingModel &&
      downloadingModel.downloaded !== null &&
      downloadingModel.size !== null
    ) {
      const percentage = Math.round(
        (downloadingModel.downloaded / downloadingModel.size) * 100
      );
      setButtonState({
        isLoading: true,
        isDisabled: true,
        text: `Downloading Model (${percentage}%)`,
        showProgress: true,
        progressPercentage: percentage,
        status: downloadingModel.status,
      });
    }

    if (downloadingModel && downloadingModel.done) {
      setTimeout(() => {
        setShowDownloadModal(false);
        setDownloadingModel(null);
        notify.success(
          "Model ready",
          "The Ollama model finished downloading successfully."
        );
      }, 2000);
    }
  }, [downloadingModel]);

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


  useEffect(() => {

    if (llmConfig.LLM === "codex" && !llmConfig.CODEX_MODEL || llmConfig.LLM === "openai" && !llmConfig.OPENAI_MODEL || llmConfig.LLM === "google" && !llmConfig.GOOGLE_MODEL || llmConfig.LLM === "anthropic" && !llmConfig.ANTHROPIC_MODEL || llmConfig.LLM === "ollama" && !llmConfig.OLLAMA_MODEL || llmConfig.LLM === "custom" && !llmConfig.CUSTOM_MODEL) {
      notify.error("Cannot save settings", "Please select a model for the selected provider");

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
      <div
        className='fixed z-0 bottom-[-14.5rem] left-0 w-full h-full'
        style={{
          height: "341px",
          borderRadius: '1440px',
          background: 'radial-gradient(5.92% 104.69% at 50% 100%, rgba(122, 90, 248, 0.00) 0%, rgba(255, 255, 255, 0.00) 100%), radial-gradient(50% 50% at 50% 50%, rgba(122, 90, 248, 0.80) 0%, rgba(122, 90, 248, 0.00) 100%)',
        }}
      />

      <main className="w-full mx-auto gap-6   overflow-hidden flex ">
        <SettingSideBar mode={mode} setMode={setMode} selectedProvider={selectedProvider} setSelectedProvider={setSelectedProvider} />
        <div className="w-full">
          <div className="sticky top-0 right-0 z-50 py-[28px]   backdrop-blur mb-4 ">
            <div className="flex  gap-3 items-center ">
              <h3 className=" text-[28px] tracking-[-0.84px] font-unbounded font-normal text-black flex items-center gap-2">
                Settings
              </h3>
              <p className="text-[10px] px-2.5 py-0.5 rounded-[50px] text-[#7A5AF8] border border-[#EDEEEF]  font-medium ">
                {textSummary} · {imageSummary}
              </p>

            </div>
          </div>

          {mode === 'nanobanana' && <div className=" w-full bg-[#F9F8F8] p-7 rounded-[20px]">
            <h4>Nano Banana</h4>
          </div>}
          {mode === 'presenton' && selectedProvider === 'text-provider' && <TextProvider


            onInputChange={(value, field) => {
              setLlmConfig(prev => ({
                ...prev,
                [field]: value
              }));
            }}
            llmConfig={llmConfig}
          />}
          {mode === 'presenton' && selectedProvider === 'image-provider' && <ImageProvider llmConfig={llmConfig} setLlmConfig={setLlmConfig} />}
          {selectedProvider === 'privacy' && <PrivacySettings />}

        </div>
      </main>

      {/* Fixed Bottom Button */}
      <div className=" mx-auto fixed bottom-20 right-5 ">
        <button
          onClick={handleSaveConfig}
          disabled={buttonState.isDisabled}
          style={{
            background: "linear-gradient(270deg, #D5CAFC 2.4%, #E3D2EB 27.88%, #F4DCD3 69.23%, #FDE4C2 100%)",
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
                {downloadingModel.done
                  ? "Download Complete!"
                  : "Downloading Model"}
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
              {downloadingModel.status &&
                downloadingModel.status !== "pulled" && (
                  <div className="text-xs text-gray-500">
                    {downloadingModel.status === "downloading" &&
                      "Downloading model files..."}
                    {downloadingModel.status === "verifying" &&
                      "Verifying model integrity..."}
                    {downloadingModel.status === "pulling" &&
                      "Pulling model from registry..."}
                  </div>
                )}

              {/* Download Info */}
              {downloadingModel.downloaded && downloadingModel.size && (
                <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                  <div className="flex justify-between text-xs text-gray-600">
                    <span>
                      Downloaded:{" "}
                      {(downloadingModel.downloaded / 1024 / 1024).toFixed(1)}{" "}
                      MB
                    </span>
                    <span>
                      Total: {(downloadingModel.size / 1024 / 1024).toFixed(1)}{" "}
                      MB
                    </span>
                  </div>
                </div>
              )}

              {!downloadingModel.done && (
                <div className="mt-6 flex justify-center">
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-lg border-gray-300 text-gray-800 hover:bg-gray-50"
                    onClick={() => downloadAbortRef.current?.abort()}
                  >
                    Cancel download
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SettingsPage;
