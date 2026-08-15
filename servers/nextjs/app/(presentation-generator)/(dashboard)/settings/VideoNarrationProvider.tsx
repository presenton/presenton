"use client";

import React, { useCallback } from "react";
import { Mic } from "lucide-react";
import { Switch } from "@/components/ui/switch";

import { LLMConfig } from "@/types/llm_config";
import { MixpanelEvent, trackEvent } from "@/utils/mixpanel";

const VideoNarrationProvider = ({
  llmConfig,
  setLlmConfig,
}: {
  llmConfig: LLMConfig;
  setLlmConfig: React.Dispatch<React.SetStateAction<LLMConfig>>;
}) => {
  const isNarrationDisabled = llmConfig.DISABLE_VIDEO_NARRATION ?? false;

  const update = useCallback(
    (field: keyof LLMConfig, value: string | boolean) => {
      setLlmConfig((current) => ({ ...current, [field]: value }));
    },
    [setLlmConfig]
  );

  const handleToggle = (checked: boolean) => {
    trackEvent(MixpanelEvent.Settings_Provider_Selected, {
      section: "video_narration",
      enabled: checked,
      provider: checked ? "comfyui" : "disabled",
    });
    update("DISABLE_VIDEO_NARRATION", !checked);
  };

  return (
    <div className="space-y-6 rounded-[12px] bg-[#F9F8F8] p-7">
      <div className="mb-4 rounded-[12px] bg-white p-10 pt-5">
        <div className="mb-6 flex justify-end">
          <Switch
            checked={!isNarrationDisabled}
            className="data-[state=checked]:bg-[#4791FF] data-[state=unchecked]:bg-gray-400"
            onCheckedChange={handleToggle}
          />
        </div>
        <div className="flex flex-col items-start justify-between gap-8 lg:flex-row lg:gap-10">
          <div className="max-w-[300px] shrink-0 pb-2 lg:pb-[20px]">
            <div className="flex h-[60px] w-[60px] items-center justify-center rounded-[4px] bg-[#F4F3FF]">
              <Mic className="h-7 w-7 text-[#5146E5]" />
            </div>
            <h3 className="py-2.5 text-xl font-normal text-[#191919]">
              Video Narration Settings
            </h3>
            <p className="text-sm text-gray-500">
              Turn slide speaker notes into narration for video export, using
              your own ComfyUI TTS workflow. Leave this off if you don't want
              video export to generate speech.
            </p>
          </div>

          {!isNarrationDisabled && (
            <div className="w-full max-w-[720px] space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  ComfyUI TTS Server URL
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
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  TTS Workflow JSON
                </label>
                <textarea
                  placeholder={`Paste your ComfyUI TTS workflow JSON here (export via "Export (API)" in ComfyUI). The text node to receive each slide's speaker note must be titled "Input Text".`}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 font-mono text-xs outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                  rows={4}
                  value={llmConfig.COMFYUI_TTS_WORKFLOW || ""}
                  onChange={(event) =>
                    update("COMFYUI_TTS_WORKFLOW", event.target.value)
                  }
                />
              </div>

              <div className="rounded-lg border border-[#D9D6FE] bg-[#F4F3FF] p-3 text-xs text-[#5146E5]">
                Slides without a speaker note, or with narration turned off,
                are exported as silent slides — video export still works
                either way.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VideoNarrationProvider;
