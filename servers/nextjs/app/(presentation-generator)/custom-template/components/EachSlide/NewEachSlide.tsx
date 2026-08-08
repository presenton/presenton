'use client'

import React, { useRef, useState, useMemo, useEffect } from "react";
import { useCompiledLayout } from "../../hooks/useCompiledLayout";
import { useSlideUndoRedo } from "../../hooks/useSlideUndoRedo";
import { EachSlideProps } from "../../types";
import { SlideContentDisplay } from "./SlideContentDisplay";
import {
  Trash2,
  Loader2,
  RotateCcw,
  Edit,
  Undo,
  Redo
} from "lucide-react";
import Timer from "../Timer";

import ToolTip from "@/components/ToolTip";
import SlideErrorBoundary from "@/app/(presentation-generator)/components/SlideErrorBoundary";
// import { CodeEditor } from "./CodeEditor";
// import SlideSelectionEditor from "./SlideSelectionEditor";
import SchemaElementHighlighter from "../SchemaElementHighlighter";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";


const EachSlide: React.FC<EachSlideProps> = ({
  slide,
  templateFonts,
  index,
  retrySlide,
  setSlides,
  onOpenSchemaEditor,
  isSchemaEditorOpen = false,
  schemaPreviewData,
  onClearSchemaPreview,
}) => {
  const [localPreviewData, setLocalPreviewData] = useState<Record<string, any> | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  // Use schema preview data from parent if available, otherwise use local
  const previewData = schemaPreviewData ?? localPreviewData;
  const setPreviewData = setLocalPreviewData;
  const slideDisplayRef = useRef<HTMLDivElement>(null);

  // Compile layout once and share with child components
  const compiledLayout = useCompiledLayout(slide.react);

  // Auto-retry once if compilation fails
  const hasAutoRetriedCompile = useRef(false);

  useEffect(() => {
    // Reset the flag when compilation succeeds
    if (compiledLayout) {
      hasAutoRetriedCompile.current = false;
    }
  }, [compiledLayout]);

  useEffect(() => {
    if (
      slide.react &&
      slide.processed &&
      !slide.processing &&
      !compiledLayout &&
      !hasAutoRetriedCompile.current
    ) {
      hasAutoRetriedCompile.current = true;
      retrySlide(index);
    }
  }, [slide.react, slide.processed, slide.processing, compiledLayout, index, retrySlide]);

  // Get sample data for schema-element highlighting
  const sampleData = useMemo(() => {
    if (previewData) return previewData;
    if (compiledLayout?.sampleData && Object.keys(compiledLayout.sampleData).length > 0) {
      return compiledLayout.sampleData;
    }
    try {
      return compiledLayout?.schema?.parse({}) ?? null;
    } catch {
      return null;
    }
  }, [compiledLayout, previewData]);

  // Undo/Redo functionality for this slide
  const {
    undo,
    redo,
    canUndo,
    canRedo,
  } = useSlideUndoRedo(slide, setSlides, index);

  // Handle retry slide
  const handleRetrySlide = () => {
    retrySlide(index);
  };

  // Clear preview data - clears both local and parent state
  const handleClearPreview = () => {
    setPreviewData(null);
    onClearSchemaPreview?.();
  };



  // Handle delete slide
  const handleDeleteSlide = () => {
    setIsDeleteDialogOpen(true);
  };

  const confirmDeleteSlide = () => {
    setSlides(prev => prev.filter((_, i) => i !== index));
    setIsDeleteDialogOpen(false);
  };

  const hasReactLayout = Boolean(slide.react && compiledLayout);
  const hasV2Layout = Boolean(slide.v2Layout);
  const isSlideReady = slide.processed && !slide.processing && (hasReactLayout || hasV2Layout);
  const supportsReactEditing = hasReactLayout;
  const isSlideProcessing = slide.processing;
  const hasError = !!slide.error;

  return (
    <>
      <div className="group max-w-[1440px] mx-auto relative bg-white rounded-2xl border border-[#E5E7EB] overflow-hidden transition-all duration-300 hover:shadow-lg hover:border-[#D1D5DB]">
      {/* Slide Header */}
      <div className="px-5 py-4 border-b border-[#F3F4F6] bg-gradient-to-r from-[#FAFAFA] to-white">
        <div className="flex items-center justify-between">
          {/* Left: Slide Info */}
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#EBE9FE] text-[#7A5AF8] font-semibold text-sm">
              {index + 1}
            </div>
            <div>
              <h3 className="text-base font-semibold text-[#111827] tracking-tight">
                {compiledLayout?.layoutId || slide.layout_name || slide.v2Layout?.id || `Slide ${index + 1}`}
              </h3>
              {(compiledLayout?.layoutDescription || slide.layout_description) && (
                <p className="text-sm text-[#6B7280] mt-0.5 line-clamp-1 max-w-[300px]">
                  {compiledLayout?.layoutDescription || slide.layout_description}
                </p>
              )}
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-1.5">
            {/* Primary Actions Group */}
            <div className="flex items-center bg-gray-50/80 rounded-lg p-1 gap-0.5">
              {/* Schema Button */}
              <ToolTip content="Edit content schema">
                <button
                  onClick={() => {
                    if (isSchemaEditorOpen) {
                      onOpenSchemaEditor?.(null);
                    } else {
                      onOpenSchemaEditor?.(index);
                    }
                  }}
                  disabled={!supportsReactEditing}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed ${isSchemaEditorOpen
                    ? "bg-emerald-100 text-emerald-700"
                    : "text-gray-600 hover:bg-white hover:text-emerald-600 hover:shadow-sm"
                    }`}
                >
                  <Edit className="w-3.5 h-3.5" />
                  <span>Schema</span>
                </button>
              </ToolTip>

            </div>

            {/* Separator */}
            <div className="w-px h-6 bg-gray-200 mx-1" />

            {/* Undo/Redo Group */}
            <div className="flex items-center bg-gray-50/80 rounded-lg p-1 gap-0.5">
              <ToolTip content={canUndo ? "Undo (Ctrl+Z)" : "Nothing to undo"}>
                <button
                  onClick={undo}
                  disabled={!canUndo || !supportsReactEditing}
                  className={`
                    inline-flex items-center justify-center w-8 h-8
                    rounded-md transition-all duration-150
                    ${!canUndo || !supportsReactEditing
                      ? "opacity-40 cursor-not-allowed text-gray-400"
                      : "text-gray-600 hover:bg-white hover:text-amber-600 hover:shadow-sm"
                    }
                  `}
                >
                  <Undo className="w-4 h-4" />
                </button>
              </ToolTip>
              <ToolTip content={canRedo ? "Redo (Ctrl+Shift+Z)" : "Nothing to redo"}>
                <button
                  onClick={redo}
                  disabled={!canRedo || !supportsReactEditing}
                  className={`
                    inline-flex items-center justify-center w-8 h-8
                    rounded-md transition-all duration-150
                    ${!canRedo || !supportsReactEditing
                      ? "opacity-40 cursor-not-allowed text-gray-400"
                      : "text-gray-600 hover:bg-white hover:text-amber-600 hover:shadow-sm"
                    }
                  `}
                >
                  <Redo className="w-4 h-4" />
                </button>
              </ToolTip>
            </div>

            {/* Separator */}
            <div className="w-px h-6 bg-gray-200 mx-1" />

            {/* Re-Construct Button */}
            <ToolTip content="Re-Design this slide">
              <button
                onClick={handleRetrySlide}
                disabled={!isSlideReady}
                className={`
                      inline-flex items-center gap-2 px-4 py-2 text-sm font-medium
                      rounded-full transition-all duration-200
                      ${!isSlideReady
                    ? "opacity-40 cursor-not-allowed bg-gradient-to-r from-[#F3F4F6] to-[#E5E7EB] text-[#9CA3AF]"
                    : "text-[#111827] shadow-sm hover:shadow-md"
                  }
                    `}
                style={isSlideReady ? {
                  background: 'linear-gradient(135deg, #D5CAFC 0%, #E3D2EB 35%, #F4DCD3 70%, #FDE4C2 100%)',
                } : undefined}
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Re-Construct
              </button>

            </ToolTip>

            {/* Delete Button */}
            <ToolTip content="Delete slide">
              <button
                onClick={handleDeleteSlide}
                disabled={!isSlideReady}
                className={`
                  p-1.5 rounded-lg border transition-all duration-150
                  ${!isSlideReady
                    ? "opacity-40 cursor-not-allowed bg-gray-50 border-gray-200 text-gray-400"
                    : "bg-white border-gray-200 text-gray-400 hover:bg-red-50 hover:border-red-200 hover:text-red-500"
                  }
                `}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </ToolTip>
          </div>
        </div>

        {/* Processing Timer - Only show here, not in SlideContentDisplay */}
        {isSlideProcessing && (
          <div className="mt-4">
            <div className="flex items-center gap-2 mb-2">
              <Loader2 className="w-4 h-4 animate-spin text-[#7A5AF8]" />
              <span className="text-sm font-medium text-[#7A5AF8]">Generating slide layout...</span>
            </div>
            <Timer duration={120} />
          </div>
        )}
      </div>

      {/* Slide Content */}
      <div className="p-4">
        <SlideErrorBoundary
          label={`Slide ${index + 1}`}
          resetKey={`${slide.processing}:${slide.processed}:${slide.react}`}
        >
          <div className="relative">
            <SlideContentDisplay
              slide={slide}
              templateFonts={templateFonts}
              compiledLayout={compiledLayout}
              previewData={previewData}
              retrySlide={handleRetrySlide}
              onClearPreview={handleClearPreview}
              slideDisplayRef={slideDisplayRef}
            />
            {/* Schema-Element Highlighting Overlay - active when schema editor is open */}
            {isSchemaEditorOpen && supportsReactEditing && (
              <SchemaElementHighlighter
                containerRef={slideDisplayRef}
                sampleData={sampleData}
                isActive={isSchemaEditorOpen}
              />
            )}
          </div>
        </SlideErrorBoundary>
      </div>

      {/* Status Indicator */}
      {hasError && (
        <div className="absolute top-3 right-3">
          <div className="w-3 h-3 rounded-full bg-[#EF4444] animate-pulse" />
        </div>
      )}
      </div>

      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="w-[calc(100vw-32px)] max-w-[432px] gap-0 rounded-[24px] border-0 bg-white p-0 font-syne shadow-[0_24px_80px_rgba(15,23,42,0.18)] [&>button]:hidden">
          <DialogHeader className="px-7 pb-6 pt-7 text-left">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#FEF3F2]">
              <Trash2 className="h-5 w-5 text-[#D92D20]" />
            </div>
            <DialogTitle className="text-xl font-semibold leading-7 text-[#101323]">
              Delete slide {index + 1}?
            </DialogTitle>
            <DialogDescription className="pt-1 text-sm leading-6 text-[#667085]">
              This slide will be permanently removed from the template. This
              action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-row border-t border-[#EAECF0] p-4 sm:justify-end sm:space-x-0">
            <button
              type="button"
              className="h-10 rounded-full border border-[#E1E1E5] px-5 text-xs font-semibold text-[#344054] transition hover:bg-[#F9FAFB]"
              onClick={() => setIsDeleteDialogOpen(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-[#D92D20] px-5 text-xs font-semibold text-white transition hover:bg-[#B42318]"
              onClick={confirmDeleteSlide}
            >
              <Trash2 className="h-4 w-4" />
              Delete slide
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default EachSlide;
