"use client";

import React from "react";
import { Loader2, RotateCcw } from "lucide-react";

import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

import { ConfigurationSelects } from "../../upload/components/ConfigurationSelects";
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
      <div className="mb-[10px] flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs font-semibold tracking-[-0.12px] text-[#191919]">
            Prompt
          </span>
          <ConfigurationSelects
            config={config}
            onConfigChange={onConfigChange}
            compact
          />
        </div>
      </div>

      <div className="relative h-[69px] overflow-hidden rounded-[12px] border border-[#DBDBDB]/60 bg-white shadow-[0_4px_7px_rgba(0,0,0,0.05)]">
        <Textarea
          value={config.prompt}
          disabled={disabled}
          rows={1}
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
          className="h-[69px] min-h-[69px] resize-none border-0 bg-transparent px-6 py-[23px] pr-16 text-base font-normal leading-[22px] text-[#191919] shadow-none outline-none placeholder:text-[#8C8C8C] focus-visible:ring-0 focus-visible:ring-offset-0 disabled:cursor-not-allowed"
        />
        <button
          type="button"
          onClick={onRegenerate}
          disabled={isRegenerateDisabled}
          aria-label="Regenerate outline"
          title="Regenerate outline"
          className={cn(
            "absolute right-6 top-1/2 flex h-[21px] w-[26px] -translate-y-1/2 items-center justify-center rounded-full bg-white text-[#191919] transition hover:bg-[#F7F7FA] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7A00FF]/25",
            isRegenerateDisabled && "cursor-not-allowed opacity-70"
          )}
        >
          {isBusy ? (
            <Loader2 className="h-[18px] w-[18px] animate-spin text-[#7A5AF8]" />
          ) : (
            <RotateCcw
              aria-hidden="true"
              className="h-[18px] w-[18px]"
            />
          )}
        </button>
      </div>
    </section>
  );
};

export default OutlinePromptBar;
