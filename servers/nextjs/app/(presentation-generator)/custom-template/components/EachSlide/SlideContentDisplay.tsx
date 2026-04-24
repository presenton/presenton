'use client'

import React from "react";
import SlideContent from "../SlideContent";
import { ProcessedSlide } from "../../types";
import { RotateCcw, X, AlertCircle, ImageOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CompiledLayout } from "@/app/hooks/compileLayout";

export interface SlideContentDisplayProps {
  slide: ProcessedSlide;
  compiledLayout: CompiledLayout | null;
  previewData?: Record<string, any> | null;
  retrySlide: (slideNumber: number) => void;
  onClearPreview?: () => void;
  slideDisplayRef?: React.RefObject<HTMLDivElement>;
}

export const SlideContentDisplay: React.FC<SlideContentDisplayProps> = ({
  slide,
  compiledLayout,
  previewData,
  retrySlide,
  onClearPreview,
  slideDisplayRef,
}) => {
  // Successfully processed slide
  if (slide.processed && slide.react && !slide.processing) {
    return (
      <div className="relative flex-1">
        {/* Preview Mode Banner */}
        {previewData && (
          <div className="mb-4 flex items-center justify-between bg-[#EDE9FE] border border-[#C4B5FD] rounded-xl px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-[#7A5AF8] flex items-center justify-center">
                <span className="text-white text-xs">✨</span>
              </div>
              <span className="text-sm font-medium text-[#5B21B6]">
                Showing AI-generated preview
              </span>
            </div>
            {onClearPreview && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onClearPreview}
                className="h-8 text-[#7A5AF8] hover:text-[#5B21B6] hover:bg-[#DDD6FE]"
              >
                <X className="w-4 h-4 mr-1.5" />
                Clear
              </Button>
            )}
          </div>
        )}

        {/* Slide Content */}
        <div className="relative rounded-xl overflow-hidden border border-[#E5E7EB] bg-white shadow-sm">
          <div ref={slideDisplayRef}>
            <SlideContent
              slide={slide}
              compiledLayout={compiledLayout}
              data={previewData}
              retrySlide={retrySlide}
            />
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (slide.error) {
    const isImageTooLarge = slide.error.includes("image exceeds 5 MB maximum");

    return (
      <div className="rounded-xl border border-[#FECACA] bg-[#FEF2F2] p-6">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-full bg-[#FEE2E2] flex items-center justify-center flex-shrink-0">
            {isImageTooLarge ? (
              <ImageOff className="w-5 h-5 text-[#DC2626]" />
            ) : (
              <AlertCircle className="w-5 h-5 text-[#DC2626]" />
            )}
          </div>
          <div className="flex-1">
            <h4 className="text-base font-semibold text-[#991B1B] mb-1">
              {isImageTooLarge ? "Image Too Large" : "Conversion Failed"}
            </h4>
            <p className="text-sm text-[#B91C1C] mb-4">
              {isImageTooLarge
                ? "This slide's image exceeds the 5MB limit. Try using a smaller resolution PPTX file or compressing the images."
                : slide.error
              }
            </p>
            <button
              onClick={() => retrySlide(slide.slide_number)}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-full bg-white border border-[#FECACA] text-[#DC2626] hover:bg-[#FEE2E2] transition-all"
            >
              <RotateCcw className="w-4 h-4" />
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Loading/Processing state - Timer is now shown in parent component (NewEachSlide)
  // This just shows a skeleton placeholder
  return (
    <div className="rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] p-6 mx-auto max-w-[1280px] w-full aspect-video h-[720px]">
      <div className="animate-pulse space-y-4 w-full h-full">


        {/* Content skeleton */}
        <div className="aspect-video bg-[#E5E7EB] rounded-xl mt-4 w-full h-full" />


      </div>
    </div>
  );
};
