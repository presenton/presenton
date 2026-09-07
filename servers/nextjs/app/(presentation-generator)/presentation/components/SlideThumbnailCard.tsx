import React, { forwardRef, memo, useCallback } from "react";
import type { Slide } from "../../types/slide";
import { useNearViewport } from "@/app/hooks/useNearViewport";
import { V1ContentRender } from "../../components/V1ContentRender";
import SmartHtmlSlide from "../../components/SmartHtmlSlide";
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

const THUMBNAIL_WIDTH = 110;
const SCALE = THUMBNAIL_WIDTH / 1280;

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
        data-slide-thumbnail-index={index}
        aria-current={selected ? "true" : undefined}
        style={style}
        className={`relative flex h-[62px] w-full cursor-pointer items-start justify-between transition-opacity duration-200 ${className}`}
        {...props}
      >
        <p
          className={`pointer-events-none shrink-0 whitespace-nowrap text-[12px] leading-normal ${
            selected
              ? "font-semibold text-[#2563EB]"
              : "font-normal text-[#333333]"
          }`}
        >
          {index + 1}
        </p>

        <div
          className={`relative h-[62px] w-[110px] shrink-0 overflow-hidden rounded-[4px] bg-white transition-[border-color,box-shadow] duration-200 ${
            selected
              ? "border-2 border-[#2563EB] shadow-[0_0_0_3px_rgba(37, 99, 235,0.16)]"
              : "border border-[#EDEEEF]"
          }`}
        >
          {!isNearViewport ? (
            <div
              className="absolute inset-0 bg-white"
              aria-hidden="true"
            />
          ) : typeof slide.html_content === "string" && slide.html_content.trim() ? (
            <div
              className="absolute left-0 top-0 pointer-events-none"
              style={{
                width: 1280,
                height: 720,
                transformOrigin: "top left",
                transform: `scale(${SCALE})`,
              }}
            >
              <SmartHtmlSlide
                fixedSize
                fonts={fonts}
                html={slide.html_content}
                title={`Slide ${index + 1} thumbnail`}
              />
            </div>
          ) : useTemplateV2HtmlPreview ? (
            <div
              className="pointer-events-none absolute left-0 top-0"
              style={{
                width: 1280,
                height: 720,
                transformOrigin: "top left",
                transform: `scale(${SCALE})`,
              }}
            >
              <TemplateV2HtmlSlidePreview
                slide={slide}
                fonts={fonts}
                fixedSize
                className="pointer-events-none"
              />
            </div>
          ) : (
            <div
              className="pointer-events-none absolute left-0 top-0 overflow-hidden"
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
