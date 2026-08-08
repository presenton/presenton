"use client";

import {
  memo,
  type PointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { TemplateV2Layout } from "@/components/slide-editor/importing/template-v2-import";
import {
  EDITOR_STAGE_HEIGHT,
  EDITOR_STAGE_WIDTH,
} from "@/components/slide-editor/types";
import { useNearViewport } from "@/app/hooks/useNearViewport";
import { cn } from "@/lib/utils";
import { TemplateV2HtmlSlidePreview } from "../../../components/TemplateV2HtmlSlidePreview";
import { hashKey, readLayoutId } from "./templatePreviewUtils";

const SlideThumbnail = memo(function SlideThumbnail({
  active,
  fonts,
  index,
  layout,
  onSelect,
}: {
  active: boolean;
  fonts?: unknown;
  index: number;
  layout: TemplateV2Layout;
  onSelect: (index: number) => void;
}) {
  const scale = 0.082;
  const previewSlide = useMemo(() => ({ ui: layout }), [layout]);
  const { isNearViewport, ref: setViewportRoot } =
    useNearViewport<HTMLSpanElement>({
      forceActive: active,
      rootMargin: "0px 300px",
      rootSelector: "[data-template-preview-thumbnail-scroll='true']",
    });

  return (
    <button
      aria-current={active ? "true" : undefined}
      aria-label={`Slide ${index + 1}: ${readLayoutId(layout, index)}`}
      className={cn(
        "group relative shrink-0 rounded-[11px] p-[5px] text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#7A5AF8] focus-visible:ring-offset-2",
        active && "bg-[#EFEDFF]",
      )}
      onClick={() => onSelect(index)}
      title={readLayoutId(layout, index)}
      type="button"
    >
      <span
        className={cn(
          "absolute -left-2 bottom-[18px] z-10 flex h-[24.394px] w-[24.394px] items-center justify-center rounded-full border bg-white text-[12px] font-medium shadow-sm",
          active
            ? "border-[#7A5AF8] bg-[#7A5AF8] text-white shadow-[0_3px_8px_rgba(122,90,248,0.32)]"
            : "border-[#ECECEC] text-[#191919]",
        )}
      >
        {index + 1}
      </span>
      <span
        ref={setViewportRoot}
        className={cn(
          "block overflow-hidden rounded-[9.68px] border bg-white transition-all",
          active
            ? "border-[#7A5AF8] shadow-[0_0_0_2px_#D9D6FE,0_6px_14px_rgba(122,90,248,0.22)]"
            : "border-[#E7E7E7] group-hover:border-[#CFCFCF]",
        )}
        style={{
          width: EDITOR_STAGE_WIDTH * scale,
          height: EDITOR_STAGE_HEIGHT * scale,
        }}
      >
        <span
          className="pointer-events-none block"
          style={{
            width: EDITOR_STAGE_WIDTH,
            height: EDITOR_STAGE_HEIGHT,
            transform: `scale(${scale})`,
            transformOrigin: "top left",
          }}
        >
          {isNearViewport ? (
            <TemplateV2HtmlSlidePreview
              slide={previewSlide}
              fonts={fonts}
              fixedSize
            />
          ) : null}
        </span>
      </span>
    </button>
  );
});

SlideThumbnail.displayName = "SlideThumbnail";

type ThumbnailStripProps = {
  activeLayoutIndex: number;
  fonts?: unknown;
  layouts: TemplateV2Layout[];
  templateId: string;
  onSelect: (index: number) => void;
};

export function ThumbnailStrip({
  activeLayoutIndex,
  fonts,
  layouts,
  templateId,
  onSelect,
}: ThumbnailStripProps) {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef({
    active: false,
    startX: 0,
    scrollLeft: 0,
    targetIndex: null as number | null,
  });
  const ignoreClickRef = useRef(false);

  useEffect(() => {
    const scroller = scrollerRef.current;
    const activeThumbnail = scroller?.querySelector(
      `[data-slide-thumbnail-index="${activeLayoutIndex}"]`,
    );
    activeThumbnail?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "center",
    });
  }, [activeLayoutIndex, layouts.length]);

  const selectByOffset = useCallback(
    (offset: -1 | 1) => {
      const nextIndex = Math.max(
        0,
        Math.min(layouts.length - 1, activeLayoutIndex + offset),
      );
      if (nextIndex !== activeLayoutIndex) {
        onSelect(nextIndex);
      }
    },
    [activeLayoutIndex, layouts.length, onSelect],
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.isComposing ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        (event.key !== "ArrowLeft" && event.key !== "ArrowRight")
      ) {
        return;
      }

      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          Boolean(
            target.closest(
              'input, textarea, select, [contenteditable="true"], [role="textbox"], [role="combobox"]',
            ),
          ))
      ) {
        return;
      }

      event.preventDefault();
      selectByOffset(event.key === "ArrowLeft" ? -1 : 1);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectByOffset]);

  const selectThumbnail = useCallback(
    (index: number) => {
      if (ignoreClickRef.current) return;
      onSelect(index);
    },
    [onSelect],
  );

  const finishDrag = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      const didDrag = ignoreClickRef.current;
      const targetIndex = dragStateRef.current.targetIndex;
      dragStateRef.current.active = false;
      if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }

      if (!didDrag) {
        if (targetIndex !== null) {
          onSelect(targetIndex);
        }
        return;
      }

      window.setTimeout(() => {
        ignoreClickRef.current = false;
      }, 0);
    },
    [onSelect],
  );

  return (
    <div className="relative overflow-hidden bg-[#FBFBFA] px-[52px] pb-[20px] pt-0">
      <button
        aria-label="Previous slide"
        className="absolute left-[24px] top-[24%] z-20 flex h-7 w-7 items-center justify-center rounded-full border border-[#EDEEEF] bg-white text-[#101323] shadow-sm transition-colors hover:bg-[#F7F6F9] disabled:pointer-events-none disabled:opacity-35"
        disabled={activeLayoutIndex === 0}
        onClick={() => selectByOffset(-1)}
        type="button"
        title="Previous slide"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>

      <div
        ref={scrollerRef}
        data-template-preview-thumbnail-scroll="true"
        aria-label="Slide thumbnails. Use the left and right arrow keys to change slides."
        className="hide-scrollbar flex h-[84px] cursor-grab items-center gap-[12px] overflow-x-auto overflow-y-hidden pl-2 pr-[72px] active:cursor-grabbing [-webkit-overflow-scrolling:touch]"
        onPointerDown={(event) => {
          if (event.pointerType === "mouse" && event.button !== 0) return;
          const target = event.target as HTMLElement;
          const thumbnail = target.closest<HTMLElement>(
            "[data-slide-thumbnail-index]",
          );
          const targetIndex = Number(thumbnail?.dataset.slideThumbnailIndex);
          dragStateRef.current = {
            active: true,
            startX: event.clientX,
            scrollLeft: event.currentTarget.scrollLeft,
            targetIndex:
              Number.isInteger(targetIndex) && targetIndex >= 0
                ? targetIndex
                : null,
          };
          ignoreClickRef.current = false;
          event.currentTarget.setPointerCapture?.(event.pointerId);
        }}
        onPointerMove={(event) => {
          const dragState = dragStateRef.current;
          if (!dragState.active) return;

          const deltaX = event.clientX - dragState.startX;
          if (Math.abs(deltaX) <= 4) return;

          ignoreClickRef.current = true;
          event.currentTarget.scrollLeft = dragState.scrollLeft - deltaX;
          event.preventDefault();
        }}
        onPointerUp={finishDrag}
        onPointerCancel={finishDrag}
        tabIndex={0}
      >
        {layouts.map((layout, index) => {
          const layoutKey =
            readLayoutId(layout, index) || hashKey(JSON.stringify(layout));

          return (
            <div
              key={`${templateId}-${layoutKey}-${index}`}
              className="shrink-0"
              data-slide-thumbnail-index={index}
            >
              <SlideThumbnail
                active={index === activeLayoutIndex}
                fonts={fonts}
                index={index}
                layout={layout}
                onSelect={selectThumbnail}
              />
            </div>
          );
        })}
      </div>

      <button
        aria-label="Next slide"
        className="absolute right-[24px] top-[24%] z-20 flex h-7 w-7 items-center justify-center rounded-full border border-[#EDEEEF] bg-white text-[#101323] shadow-sm transition-colors hover:bg-[#F7F6F9] disabled:pointer-events-none disabled:opacity-35"
        disabled={activeLayoutIndex >= layouts.length - 1}
        onClick={() => selectByOffset(1)}
        type="button"
        title="Next slide"
      >
        <ChevronRight className="h-4 w-4" />
      </button>

      <div className="pointer-events-none absolute bottom-0 right-0 top-0 w-[72px] bg-gradient-to-r from-[#FBFBFA]/0 to-[#FBFBFA]" />
    </div>
  );
}
