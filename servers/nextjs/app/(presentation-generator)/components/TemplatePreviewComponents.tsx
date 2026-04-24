"use client";
import React, { memo, useMemo } from "react";
import { Loader2 } from "lucide-react";
import { TemplateWithData } from "@/app/presentation-templates/utils";
import { CompiledLayout } from "@/app/hooks/compileLayout";




export function TemplatePreviewStage({ children }: { children: React.ReactNode }) {
    return (
        <div className="relative overflow-hidden px-5 pb-5 pt-5 h-[230px]">
            <img
                src="/card_bg.svg"
                alt=""
                className="absolute top-0 left-0 w-full h-full object-cover"
            />
            {children}
        </div>
    );
}

export const LayoutsBadge = memo(function LayoutsBadge({ count }: { count: number }) {
    return (
        <span className="text-xs font-syne absolute top-3.5 left-4 z-40 inline-flex items-center rounded-full bg-[#333333] px-3 py-1 font-semibold text-white">
            Layouts-{count}
        </span>
    );
});

export const ScaledSlidePreview = memo(function ScaledSlidePreview({
    children,
    id,
    index,
    isOutline = false,
}: {
    children: React.ReactNode;
    id: string;
    index: number;
    isOutline?: boolean;
}) {
    const PREVIEW_SCALE = isOutline ? 0.2 : 0.24;
    const SLIDE_HEIGHT = 720 * PREVIEW_SCALE;
    const SLIDE_WIDTH = 1280;
    const SLIDE_NATIVE_HEIGHT = 720;
    return (
        <div
            key={`${id}-preview-${index}`}
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

export const InbuiltTemplatePreview = memo(function InbuiltTemplatePreview({
    layouts,
    templateId,
    isOutline = false,
}: {
    layouts: TemplateWithData[];
    templateId: string;
    isOutline?: boolean;
}) {
    const previewLayouts = useMemo(() => layouts.slice(0, 2), [layouts]);
    return (
        <div className="relative z-10 flex flex-col gap-3 overflow-hidden">
            {previewLayouts.map((layout, index) => {
                const LayoutComponent = layout.component;
                return (
                    <ScaledSlidePreview key={`${templateId}-preview-${index}`} id={templateId} index={index} isOutline={isOutline}>
                        <LayoutComponent data={layout.sampleData} />
                    </ScaledSlidePreview>
                );
            })}
        </div>
    );
});

export const CustomTemplatePreview = memo(function CustomTemplatePreview({
    previewLayouts,
    loading,
    templateId,
    isOutline = false,
}: {
    previewLayouts: CompiledLayout[];
    loading: boolean;
    templateId: string;
    isOutline?: boolean;
}) {
    return (
        <div className="relative z-10 flex flex-col gap-3">
            {loading ? (
                [...Array(2)].map((_, index) => (
                    <div
                        key={`${templateId}-loading-${index}`}
                        className="relative w-full aspect-video flex items-center justify-center"
                    >
                        <Loader2 className="h-4 w-4 animate-spin text-slate-300" />
                    </div>
                ))
            ) : (
                previewLayouts.slice(0, 2).map((layout, index) => {
                    const LayoutComponent = layout.component;
                    return (
                        <ScaledSlidePreview key={`${templateId}-preview-${index}`} id={templateId} index={index} isOutline={isOutline}>
                            <LayoutComponent data={layout.sampleData} />
                        </ScaledSlidePreview>
                    );
                })
            )}
        </div>
    );
});
