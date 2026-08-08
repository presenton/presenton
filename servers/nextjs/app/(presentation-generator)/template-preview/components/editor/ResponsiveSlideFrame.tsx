"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Sparkles } from "lucide-react";
import { TemplateV2KonvaSlide } from "@/components/slide-editor/surface/TemplateV2KonvaSlide";
import type { TemplateV2Layout } from "@/components/slide-editor/importing/template-v2-import";
import {
  EDITOR_STAGE_HEIGHT,
  EDITOR_STAGE_WIDTH,
} from "@/components/slide-editor/types";
import {
  type HistoryAvailability,
  type HistoryCommand,
  readLayoutId,
} from "./templatePreviewUtils";

type ResponsiveSlideFrameProps = {
  activeLayoutIndex: number;
  canEdit: boolean;
  fonts?: unknown;
  historyCommand: HistoryCommand | null;
  isGenerating: boolean;
  layout: TemplateV2Layout;
  promptOverlay?: ReactNode;
  onHistoryAvailabilityChange: (availability: HistoryAvailability) => void;
  onLayoutChange: (layout: TemplateV2Layout) => void;
};

export function ResponsiveSlideFrame({
  activeLayoutIndex,
  canEdit,
  fonts,
  historyCommand,
  isGenerating,
  layout,
  promptOverlay,
  onHistoryAvailabilityChange,
  onLayoutChange,
}: ResponsiveSlideFrameProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(0.82);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || typeof ResizeObserver === "undefined") return;

    const resize = () => {
      const rect = container.getBoundingClientRect();
      const widthScale = (rect.width - 64) / EDITOR_STAGE_WIDTH;
      const heightScale = (rect.height - 24) / EDITOR_STAGE_HEIGHT;
      const nextScale = Math.min(
        1,
        Math.max(0.42, Math.min(widthScale, heightScale)),
      );
      setScale(Number.isFinite(nextScale) ? nextScale : 0.82);
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={containerRef}
      className="flex min-h-[320px] flex-1 items-start justify-center px-[21px] pb-5 pt-[28px]"
    >
      <div
        className="relative overflow-visible rounded-[8.944px] border border-[#EDEEEF] bg-white shadow-[0_0_12.522px_rgba(0,0,0,0.14)]"
        style={{
          width: EDITOR_STAGE_WIDTH * scale,
          height: EDITOR_STAGE_HEIGHT * scale,
        }}
      >
        <div
          className="relative"
          style={{
            width: EDITOR_STAGE_WIDTH,
            height: EDITOR_STAGE_HEIGHT,
            transform: `scale(${scale})`,
            transformOrigin: "top left",
          }}
        >
          <TemplateV2KonvaSlide
            key={`active-${activeLayoutIndex}`}
            layout={layout}
            isEditMode={canEdit}
            slideId={readLayoutId(layout, activeLayoutIndex)}
            slideIndex={activeLayoutIndex}
            renderIndex={activeLayoutIndex}
            fonts={fonts}
            displayScale={scale}
            historyCommand={historyCommand}
            onHistoryAvailabilityChange={onHistoryAvailabilityChange}
            onLayoutChange={onLayoutChange}
          />
          {promptOverlay}
        </div>
        {isGenerating ? (
          <div className="absolute inset-0 z-20 flex items-end justify-center rounded-[8.944px] bg-white pb-[28px]">
            <div className="flex h-[32px] items-center gap-[6px] rounded-full bg-white px-[12px] text-[12px] font-normal text-[#666666] shadow-[0_8px_24px_rgba(122,90,248,0.18)]">
              <Sparkles className="h-[14px] w-[14px] text-[#7A5AF8]" />
              Generating slides...
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
