"use client";

import React from "react";
import { Loader2, RefreshCw } from "lucide-react";

import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

import { ConfigurationSelects } from "../../upload/components/ConfigurationSelects";
import CurrentConfig from "../../upload/components/CurrentConfig";
import { PresentationConfig } from "../../upload/type";

interface OutlinePromptBarProps {
  config: PresentationConfig;
  disabled?: boolean;
  isBusy: boolean;
  regenerateDisabled?: boolean;
  onConfigChange: (key: keyof PresentationConfig, value: unknown) => void;
  onRegenerate: () => void;
}

const OutlinePromptBar: React.FC<OutlinePromptBarProps> = ({
  config,
  disabled = false,
  isBusy,
  regenerateDisabled = false,
  onConfigChange,
  onRegenerate,
}) => {
  const isRegenerateDisabled = disabled || isBusy || regenerateDisabled;

  return (
    <section className="w-full font-syne">
      <div className="mb-5 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <span className="text-sm font-semibold text-[#191919]">Prompt</span>
          <ConfigurationSelects
            config={config}
            onConfigChange={onConfigChange}
          />
        </div>
        <div className="flex justify-start xl:justify-end">
          <CurrentConfig webSearchEnabled={config.webSearch} />
        </div>
      </div>

      <div
        className="relative rounded-[14px] border border-[#E4E5E8] bg-white shadow-[0_4px_14px_rgba(0,0,0,0.04)]"
      >
        <Textarea
          value={config.prompt}
          disabled={disabled}
          rows={2}
          onChange={(event) => onConfigChange("prompt", event.target.value)}
          onKeyDown={(event) => {
            if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
              event.preventDefault();
              if (isRegenerateDisabled) {
                return;
              }
              onRegenerate();
            }
          }}
          placeholder="Describe the presentation you want to generate"
          className="min-h-[88px] resize-none border-0 bg-transparent py-5 pl-6 pr-16 text-base font-medium leading-6 text-[#191919] shadow-none outline-none placeholder:text-[#8C8C8C] focus-visible:ring-0 focus-visible:ring-offset-0 disabled:cursor-not-allowed sm:pr-44"
        />
        <button
          type="button"
          onClick={onRegenerate}
          disabled={isRegenerateDisabled}
          aria-label="Regenerate outline"
          title="Regenerate outline"
          className={cn(
            "absolute right-5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center gap-2 rounded-full px-0 text-xs font-semibold text-[#191919] transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7A00FF]/25 sm:w-auto sm:px-4",
            isRegenerateDisabled && "cursor-not-allowed opacity-70"
          )}
          style={{
            background:
              "linear-gradient(270deg, #D5CAFC 2.4%, #E3D2EB 27.88%, #F4DCD3 69.23%, #FDE4C2 100%)",
          }}
        >
          {isBusy ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="hidden sm:inline">Regenerating</span>
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4" />
              <span className="hidden sm:inline">Regenerate</span>
            </>
          )}
        </button>
      </div>
    </section>
  );
};

export default OutlinePromptBar;
