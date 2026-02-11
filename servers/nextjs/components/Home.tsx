"use client";
import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Download, CheckCircle } from "lucide-react";
import { useSelector } from "react-redux";
import { RootState } from "@/store/store";
import { handleSaveLLMConfig } from "@/utils/storeHelpers";
import LLMProviderSelection from "./LLMSelection";
import {
  checkIfSelectedOllamaModelIsPulled,
  pullOllamaModel,
} from "@/utils/providerUtils";
import { LLMConfig } from "@/types/llm_config";
import { trackEvent, MixpanelEvent } from "@/utils/mixpanel";
import { usePathname } from "next/navigation";

// Button state interface
interface ButtonState {
  isLoading: boolean;
  isDisabled: boolean;
  text: string;
  showProgress: boolean;
  progressPercentage?: number;
  status?: string;
}

export default function Home() {
  const router = useRouter();
  const pathname = usePathname();
  const config = useSelector((state: RootState) => state.userConfig);
  const [llmConfig, setLlmConfig] = useState<LLMConfig>(config.llm_config);

  const [downloadingModel, setDownloadingModel] = useState<{
    name: string;
    size: number | null;
    downloaded: number | null;
    status: string;
    done: boolean;
  } | null>(null);
  const [showDownloadModal, setShowDownloadModal] = useState<boolean>(false);
  const [buttonState, setButtonState] = useState<ButtonState>({
    isLoading: false,
    isDisabled: false,
    text: "Save Configuration",
    showProgress: false
  });

  const canChangeKeys = config.can_change_keys;
  const downloadProgress = useMemo(() => {
    if (downloadingModel && downloadingModel.downloaded !== null && downloadingModel.size !== null) {
      return Math.round((downloadingModel.downloaded / downloadingModel.size) * 100);
    }
    return 0;
  }, [downloadingModel?.downloaded, downloadingModel?.size]);

  const handleSaveConfig = async () => {
    trackEvent(MixpanelEvent.Home_SaveConfiguration_Button_Clicked, { pathname });
    try {
      setButtonState(prev => ({
        ...prev,
        isLoading: true,
        isDisabled: true,
        text: "Saving Configuration..."
      }));
      // API: save config
      trackEvent(MixpanelEvent.Home_SaveConfiguration_API_Call);
      // API CALL: save config
      await handleSaveLLMConfig(llmConfig);

      if (llmConfig.LLM === "ollama" && llmConfig.OLLAMA_MODEL) {
        // API: check model pulled
        trackEvent(MixpanelEvent.Home_CheckOllamaModelPulled_API_Call);
        const isPulled = await checkIfSelectedOllamaModelIsPulled(llmConfig.OLLAMA_MODEL);
        if (!isPulled) {
          setShowDownloadModal(true);
          // API: download model
          trackEvent(MixpanelEvent.Home_DownloadOllamaModel_API_Call);
          await handleModelDownload();
        }
      }
      toast.info("Configuration saved successfully");
      setButtonState(prev => ({
        ...prev,
        isLoading: false,
        isDisabled: false,
        text: "Save Configuration"
      }));
      // Track navigation from -> to
      trackEvent(MixpanelEvent.Navigation, { from: pathname, to: "/upload" });
      router.push("/upload");
    } catch (error) {
      toast.info(error instanceof Error ? error.message : "Failed to save configuration");
      setButtonState(prev => ({
        ...prev,
        isLoading: false,
        isDisabled: false,
        text: "Save Configuration"
      }));
    }
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


  useEffect(() => {
    if (downloadingModel && downloadingModel.downloaded !== null && downloadingModel.size !== null) {
      const percentage = Math.round(((downloadingModel.downloaded / downloadingModel.size) * 100));
      setButtonState({
        isLoading: true,
        isDisabled: true,
        text: `Downloading Model (${percentage}%)`,
        showProgress: true,
        progressPercentage: percentage,
        status: downloadingModel.status
      });
    }

    if (downloadingModel && downloadingModel.done) {
      setTimeout(() => {
        setShowDownloadModal(false);
        setDownloadingModel(null);
        toast.info("Model downloaded successfully!");
      }, 2000);
    }
  }, [downloadingModel]);

  useEffect(() => {
    if (!canChangeKeys) {
      router.push("/upload");
    }
  }, [canChangeKeys, router]);

  if (!canChangeKeys) {
    return null;
  }

  return (
    <div className="h-screen bg-gradient-to-b font-instrument_sans from-gray-50 to-white flex flex-col overflow-hidden">
      <main className="flex-1 container mx-auto px-4 max-w-3xl overflow-hidden flex flex-col">
        {/* Branding Header */}
        <div className="text-center mb-6 mt-8 flex-shrink-0">
          <div className="flex items-center justify-center gap-3 mb-3">
            <div className="p-3 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 shadow-lg">
              <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
              </svg>
            </div>
          </div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-2">
            Presentation Agent
          </h1>
          <p className="text-gray-600 text-base">
            AI-powered presentation generator for professionals
          </p>
        </div>

        {/* Main Configuration Card */}
        <div className="flex-1 overflow-hidden">
          <LLMProviderSelection
            initialLLMConfig={llmConfig}
            onConfigChange={setLlmConfig}
            buttonState={buttonState}
            setButtonState={setButtonState}
          />
        </div>
      </main>

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

      {/* Fixed Bottom Button */}
      <div className="flex-shrink-0 bg-gradient-to-t from-white to-gray-50/50 border-t border-gray-200 p-6">
        <div className="container mx-auto max-w-3xl">
          <button
            onClick={handleSaveConfig}
            disabled={buttonState.isDisabled}
            className={`w-full font-bold py-4 px-6 rounded-xl transition-all duration-300 shadow-lg ${buttonState.isDisabled
              ? "bg-gray-400 cursor-not-allowed opacity-60"
              : "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 hover:shadow-xl hover:scale-[1.02] focus:ring-4 focus:ring-blue-300"
              } text-white text-base`}
          >
            {buttonState.isLoading ? (
              <div className="flex items-center justify-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>{buttonState.text}</span>
              </div>
            ) : (
              buttonState.text
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
