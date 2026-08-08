"use client";
/* eslint-disable @next/next/no-img-element */
import React, { memo } from "react";
import { cn } from "@/lib/utils";

export function TemplatePreviewStage({
  children,
  selectionPage = false,
}: {
  children: React.ReactNode;
  selectionPage?: boolean;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden bg-[#F8FBFB]",
        selectionPage ? "h-[249px] px-[34px] py-5" : "p-5"
      )}
    >
      <img
        src="/card_bg.svg"
        alt=""
        className="absolute left-0 top-0 h-full w-full object-cover"
      />
      {children}
    </div>
  );
}

export const LayoutsBadge = memo(function LayoutsBadge({
  count,
  selectionPage = false,
}: {
  count: number;
  selectionPage?: boolean;
}) {
    return (
      <span
        className={cn(
          "absolute z-40 inline-flex items-center rounded-full font-syne text-xs text-white",
          selectionPage
            ? "left-2 top-2 bg-[rgba(58,58,58,0.96)] px-2.5 py-1 font-medium"
            : "left-4 top-3.5 bg-[#333333] px-3 py-1 font-semibold"
        )}
      >
        Layouts-{count}
      </span>
    );
});

export const ScaledSlidePreview = memo(function ScaledSlidePreview({
    children,
    isOutline = false,
}: {
    children: React.ReactNode;
    index: number;
    isOutline?: boolean;
}) {
    const PREVIEW_SCALE = isOutline ? 0.2 : 0.24;
    const SLIDE_HEIGHT = 720 * PREVIEW_SCALE;
    const SLIDE_WIDTH = 1280;
    const SLIDE_NATIVE_HEIGHT = 720;
    return (
        <div
            className="relative"
            style={{ height: `${SLIDE_HEIGHT}px`, overflow: "hidden" }}
        >
            <div
                className={`absolute top-0 ${isOutline ? "left-0" : "left-8"} pointer-events-none`}
                style={{
                    width: SLIDE_WIDTH,
                    height: SLIDE_NATIVE_HEIGHT,
                    transformOrigin: "top left",
                    transform: `scale(${PREVIEW_SCALE})`,
                }}
            >
                {children}
            </div>
        </div>
    );
});
