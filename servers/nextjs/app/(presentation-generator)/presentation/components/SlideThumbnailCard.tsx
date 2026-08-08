import React, { forwardRef, memo, useCallback } from "react";
import type { Slide } from "../../types/slide";
import { useNearViewport } from "@/app/hooks/useNearViewport";
import { V1ContentRender } from "../../components/V1ContentRender";
import {
  shouldRenderTemplateV2HtmlPreview,
  TemplateV2HtmlSlidePreview,
} from "../../components/TemplateV2HtmlSlidePreview";

interface SlideThumbnailCardProps extends React.HTMLAttributes<HTMLDivElement> {
  slide: Slide;
  index: number;
  selected: boolean;
  fonts?: unknown;
  presentationVersion?: unknown;
}

const SCALE = 0.061;

const SlideThumbnailCardComponent = forwardRef<
  HTMLDivElement,
  SlideThumbnailCardProps
>(
  (
    {
      slide,
      index,
      selected,
      fonts,
      presentationVersion,
      className = "",
      style,
      ...props
    },
    ref
  ) => {
    const { isNearViewport, ref: setViewportRoot } =
      useNearViewport<HTMLDivElement>({
        forceActive: selected,
        rootMargin: "72px 0px",
        rootSelector: "[data-slide-thumbnail-scroll-container='true']",
      });
    const setRootRef = useCallback(
      (node: HTMLDivElement | null) => {
        setViewportRoot(node);
        if (typeof ref === "function") {
          ref(node);
        } else if (ref) {
          ref.current = node;
        }
      },
      [ref, setViewportRoot],
    );
    const useTemplateV2HtmlPreview = shouldRenderTemplateV2HtmlPreview(
      slide,
      presentationVersion
    );

    return (
      <div
        ref={setRootRef}
        data-slide-thumbnail-active={isNearViewport ? "true" : "false"}
        style={{
          backgroundColor: "var(--card-color, #ffffff)",
          borderColor: selected ? "#5141e5" : "var(--stroke, #e5e7eb)",
          ...style,
        }}
        className={`cursor-pointer border relative p-1.5 rounded-[12px] overflow-hidden transition-all duration-200 ${
          selected ? "border-[#BDB4FE]" : "border-[#EDEEEF]"
        } ${className}`}
        {...props}
      >
        <p className="pointer-events-none absolute -left-1 top-1/2 z-50 flex h-[18px] min-w-[18px] -translate-y-1/2 items-center justify-center rounded-full border border-[#EDEEEF] bg-white px-1 text-[10px] font-medium text-[#191919] shadow-sm">
          {index + 1}
        </p>

        <div
          className="relative"
          style={{ height: `${720 * SCALE}px`, overflow: "hidden" }}
        >
          {!isNearViewport ? (
            <div
              className="absolute inset-0 rounded-[10px] bg-white"
              aria-hidden="true"
            />
          ) : useTemplateV2HtmlPreview ? (
            <TemplateV2HtmlSlidePreview
              slide={slide}
              fonts={fonts}
              className="pointer-events-none rounded-[10px]"
            />
          ) : (
            <div
              className="absolute top-0 left-0 rounded-[10px] overflow-hidden pointer-events-none"
              style={{
                width: 1280,
                height: 720,
                transformOrigin: "top left",
                transform: `scale(${SCALE})`,
              }}
            >
              <V1ContentRender
                slide={slide}
                isEditMode={false}
                fonts={fonts}
              />
            </div>
          )}
        </div>
      </div>
    );
  }
);

SlideThumbnailCardComponent.displayName = "SlideThumbnailCard";

export const SlideThumbnailCard = memo(
  SlideThumbnailCardComponent,
  (previous, next) =>
    previous.slide === next.slide &&
    previous.index === next.index &&
    previous.selected === next.selected &&
    previous.fonts === next.fonts &&
    previous.presentationVersion === next.presentationVersion &&
    previous.className === next.className &&
    previous.style === next.style
);

SlideThumbnailCard.displayName = "Memo(SlideThumbnailCard)";
