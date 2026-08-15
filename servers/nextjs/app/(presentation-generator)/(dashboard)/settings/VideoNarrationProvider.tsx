"use client";

import React, { useCallback, useEffect } from "react";
import { Check } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

import { LLMConfig } from "@/types/llm_config";
import { TTS_PROVIDERS } from "@/utils/providerConstants";
import { MixpanelEvent, trackEvent } from "@/utils/mixpanel";

const VideoNarrationProvider = ({
  llmConfig,
  setLlmConfig,
}: {
  llmConfig: LLMConfig;
  setLlmConfig: React.Dispatch<React.SetStateAction<LLMConfig>>;
}) => {
  const isNarrationDisabled = llmConfig.DISABLE_VIDEO_NARRATION ?? false;
  const selectedProviderKey = llmConfig.VIDEO_NARRATION_PROVIDER || "";

  const update = useCallback(
    (field: keyof LLMConfig, value: string | boolean) => {
      setLlmConfig((current) => ({ ...current, [field]: value }));
    },
    [setLlmConfig]
  );

  // ComfyUI is currently the only TTS provider -- default it selected once
  // narration is turned on, so the setup fields show immediately instead
  // of requiring an extra click on a one-item grid.
  useEffect(() => {
    if (!isNarrationDisabled && !selectedProviderKey) {
      update("VIDEO_NARRATION_PROVIDER", "comfyui");
    }
  }, [isNarrationDisabled, selectedProviderKey, update]);

  const handleToggle = (checked: boolean) => {
    trackEvent(MixpanelEvent.Settings_Provider_Selected, {
      section: "video_narration",
      enabled: checked,
      provider: checked ? selectedProviderKey || "comfyui" : "disabled",
    });
    update("DISABLE_VIDEO_NARRATION", !checked);
  };

  const handleSelectProvider = (providerKey: string) => {
    trackEvent(MixpanelEvent.Settings_Provider_Selected, {
      section: "video_narration",
      provider: providerKey,
    });
    update("VIDEO_NARRATION_PROVIDER", providerKey);
  };

  const selectedProvider = TTS_PROVIDERS[selectedProviderKey];

  return (
    <div className="space-y-6 rounded-[12px] bg-[#F9F8F8] p-7">
      <div className="mb-4 rounded-[12px] bg-white p-10 pt-5">
        <div className="flex items-center justify-end">
          <Switch
            checked={!isNarrationDisabled}
            className="data-[state=checked]:bg-[#4791FF] data-[state=unchecked]:bg-gray-400"
            onCheckedChange={handleToggle}
          />
        </div>

        <div className="max-w-[290px] pb-[50px]">
          <div
            className="flex h-[60px] w-[60px] items-center justify-center rounded-[4px] px-[13.5px] py-[14.2px]"
            style={{ backgroundColor: "#F4F3FF" }}
          >
            <img
              src="/providers/comfyui-color.svg"
              className="h-full w-full object-cover"
              alt="video-narration"
            />
          </div>
          <h3 className="py-2.5 text-xl font-normal text-[#191919]">
            Video Narration Settings
          </h3>
          <p className="text-sm text-gray-500">
            Choosing how slide notes become speech
          </p>
        </div>

        {!isNarrationDisabled && (
          <>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              Select TTS Provider
            </label>
            <div className="grid w-full grid-cols-2 gap-3 sm:grid-cols-3">
              {Object.values(TTS_PROVIDERS).map((provider) => {
                const isSelected = selectedProviderKey === provider.value;
                return (
                  <button
                    key={provider.value}
                    type="button"
                    onClick={() => handleSelectProvider(provider.value)}
                    className={cn(
                      "relative flex flex-col items-center gap-2 rounded-xl border p-4 transition-colors",
                      isSelected
                        ? "border-[#5146E5] bg-[#F4F3FF]"
                        : "border-gray-200 bg-white hover:border-gray-300"
                    )}
                  >
                    {isSelected && (
                      <Check className="absolute right-2 top-2 h-4 w-4 text-[#5146E5]" />
                    )}
                    <div className="flex h-10 w-10 items-center justify-center rounded-md bg-white">
                      {provider.icon ? (
                        <img
                          src={provider.icon}
                          alt={provider.label}
                          className="h-6 w-6 object-contain"
                        />
                      ) : null}
                    </div>
                    <span className="text-sm font-medium text-gray-900">
                      {provider.label}
                    </span>
                  </button>
                );
              })}
            </div>

            {selectedProvider?.value === "comfyui" && (
              <div className="mt-6 rounded-[12px] bg-[#F9F8F8] p-6">
                <h4 className="text-base font-medium text-[#191919]">
                  ComfyUI setup
                </h4>
                <p className="mb-4 text-sm text-gray-500">
                  Configure the selected TTS provider before continuing.
                </p>

                <div className="space-y-4">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">
                      ComfyUI Server URL
                    </label>
                    <input
                      type="text"
                      placeholder="Defaults to your Image Provider's ComfyUI URL if left blank"
                      className="h-12 w-full rounded-lg border border-gray-300 px-4 text-sm text-[#191919] outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                      value={llmConfig.COMFYUI_TTS_URL || ""}
                      onChange={(event) =>
                        update("COMFYUI_TTS_URL", event.target.value)
                      }
                    />
                    <p className="mt-2 flex items-center gap-2 text-sm text-gray-500">
                      <span className="block h-1 w-1 rounded-full bg-gray-400"></span>
                      Use your machine IP address (not localhost) when
                      running in Docker
                    </p>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">
                      Workflow JSON
                    </label>
                    <textarea
                      placeholder={`Paste your ComfyUI TTS workflow JSON here (export via "Export (API)" in ComfyUI)`}
                      className="w-full rounded-lg border border-gray-300 px-4 py-2.5 font-mono text-xs outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                      rows={6}
                      value={llmConfig.COMFYUI_TTS_WORKFLOW || ""}
                      onChange={(event) =>
                        update("COMFYUI_TTS_WORKFLOW", event.target.value)
                      }
                    />
                    <p className="mt-2 text-sm text-gray-500">
                      The text node that receives each slide&apos;s speaker
                      note must be titled &quot;Input Prompt&quot;.
                    </p>
                  </div>

                  <div className="rounded-lg border border-[#D9D6FE] bg-[#F4F3FF] p-3 text-xs text-[#5146E5]">
                    Slides without a speaker note are exported as silent
                    slides — video export still works either way.
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default VideoNarrationProvider;
