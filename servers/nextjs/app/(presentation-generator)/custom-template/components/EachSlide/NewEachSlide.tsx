'use client'

import React, { useRef, useState, useMemo, useEffect } from "react";
import { useCompiledLayout } from "../../hooks/useCompiledLayout";
import { useSlideUndoRedo } from "../../hooks/useSlideUndoRedo";
import { EachSlideProps } from "../../types";
import { SlideContentDisplay } from "./SlideContentDisplay";
import { useSlideEdit } from "../../hooks/useSlideEdit";
import {
  Trash2,
  X,
  Check,
  Loader2,
  RotateCcw,
  Sparkles,
  Edit,
  Code,
  MousePointer2,
  Undo,
  Redo
} from "lucide-react";
import Timer from "../Timer";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

import ToolTip from "@/components/ToolTip";
// import { CodeEditor } from "./CodeEditor";
// import SlideSelectionEditor from "./SlideSelectionEditor";
import SchemaElementHighlighter from "../SchemaElementHighlighter";


const EachSlide: React.FC<EachSlideProps> = ({
  slide,
  index,
  retrySlide,
  setSlides,
  onSlideUpdate,
  isProcessing,
  onOpenSchemaEditor,
  isSchemaEditorOpen = false,
  schemaPreviewData,
  onClearSchemaPreview,
}) => {
  const [localPreviewData, setLocalPreviewData] = useState<Record<string, any> | null>(null);

  // Use schema preview data from parent if available, otherwise use local
  const previewData = schemaPreviewData ?? localPreviewData;
  const setPreviewData = setLocalPreviewData;
  const [isEditPromptOpen, setIsEditPromptOpen] = useState(false);
  const slideDisplayRef = useRef<HTMLDivElement>(null);
  const [showCodeEditor, setShowCodeEditor] = useState(false);
  const [isSelectionEditMode, setIsSelectionEditMode] = useState(false);

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
      console.log(`Auto-retrying slide ${index + 1} after compile failure...`);
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

  const {
    isUpdating,
    prompt,
    setPrompt,
    handleSave,
    handleEditClick,
    handleCancelEdit,
  } = useSlideEdit(slide, index, onSlideUpdate, setSlides);

  // Handle retry slide
  const handleRetrySlide = () => {
    retrySlide(index);
  };

  const closeEditPrompt = () => {
    setIsEditPromptOpen(false);
    handleCancelEdit();
  };

  const submitEditPrompt = async () => {

    if (isUpdating) return;

    await handleSave();
    setIsEditPromptOpen(false);
    setPrompt("");

  };

  // Clear preview data - clears both local and parent state
  const handleClearPreview = () => {
    setPreviewData(null);
    onClearSchemaPreview?.();
  };



  // Handle delete slide
  const handleDeleteSlide = () => {
    // warmin
    const confirmed = window.confirm(
      `Are you sure you want to delete slide ${index + 1}? This action cannot be undone.`
    );
    if (!confirmed) return;
    setSlides(prev => prev.filter((_, i) => i !== index));
  };

  // Handle selection edit update
  const handleSelectionUpdate = (updatedHtml: string) => {
    // Update the slide's html content via parent callback or directly
    setSlides(prev => prev.map((s, i) => i === index ? { ...s, react: updatedHtml } : s));
  };

  const isSlideReady = slide.processed && !slide.processing;
  const isSlideProcessing = slide.processing;
  const hasError = !!slide.error;

  return (
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
                {compiledLayout?.layoutId || `Slide ${index + 1}`}
              </h3>
              {compiledLayout?.layoutDescription && (
                <p className="text-sm text-[#6B7280] mt-0.5 line-clamp-1 max-w-[300px]">
                  {compiledLayout.layoutDescription}
                </p>
              )}
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-1.5">
            {/* Primary Actions Group */}
            <div className="flex items-center bg-gray-50/80 rounded-lg p-1 gap-0.5">
              {/* AI Edit Button */}
              <Popover
                open={isEditPromptOpen}
                onOpenChange={(open) => {
                  setIsEditPromptOpen(open);
                  if (open) handleEditClick();
                  else handleCancelEdit();
                }}
              >
                <PopoverTrigger asChild>
                  <button
                    disabled={!isSlideReady}
                    className={`
                      inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium
                      rounded-md transition-all duration-150
                      ${!isSlideReady
                        ? "opacity-40 cursor-not-allowed text-gray-400"
                        : "text-gray-600 hover:bg-white hover:text-violet-600 hover:shadow-sm"
                      }
                    `}
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>AI Edit</span>
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  align="end"
                  side="bottom"
                  sideOffset={8}
                  className="w-[380px] p-0 rounded-xl border border-gray-200 shadow-2xl bg-white"
                >
                  <div className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-sm">
                          <Sparkles className="w-3.5 h-3.5 text-white" />
                        </div>
                        <div>
                          <span className="text-sm font-semibold text-gray-800">AI Edit</span>
                          <p className="text-[10px] text-gray-400">Apply AI edits & tweaks</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={closeEditPrompt}
                        disabled={isUpdating}
                        className="p-1 rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <textarea
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      rows={3}
                      autoFocus
                      placeholder="What changes would you like? e.g., 'Make the title larger' or 'Change colors to blue theme'"
                      disabled={isUpdating}
                      className="w-full px-3 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-sm text-gray-800 placeholder:text-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400 focus:bg-white transition-all"
                    />

                    <div className="flex justify-end mt-3">
                      <button
                        type="button"
                        onClick={submitEditPrompt}
                        disabled={isUpdating || !prompt.trim()}
                        className={`
                          inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg transition-all
                          ${isUpdating || !prompt.trim()
                            ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                            : "bg-gradient-to-r from-violet-500 to-purple-600 text-white hover:from-violet-600 hover:to-purple-700 shadow-sm hover:shadow-md"
                          }
                        `}
                      >
                        {isUpdating ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            Applying...
                          </>
                        ) : (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            Apply
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>

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
                  disabled={!isSlideReady}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed ${isSchemaEditorOpen
                    ? "bg-emerald-100 text-emerald-700"
                    : "text-gray-600 hover:bg-white hover:text-emerald-600 hover:shadow-sm"
                    }`}
                >
                  <Edit className="w-3.5 h-3.5" />
                  <span>Schema</span>
                </button>
              </ToolTip>

              {/* Code Button */}
              {/* <ToolTip content="Edit source code">
                <button
                  onClick={() => setShowCodeEditor(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md text-gray-600 hover:bg-white hover:text-blue-600 hover:shadow-sm transition-all duration-150"
                >
                  <Code className="w-3.5 h-3.5" />
                  <span>Code</span>
                </button>
              </ToolTip> */}

              {/* Select Edit Button */}
              {/* <ToolTip content={isSelectionEditMode ? "Exit selection mode" : "Click elements to edit"}>
                <button
                  onClick={() => setIsSelectionEditMode(!isSelectionEditMode)}
                  disabled={!isSlideReady}
                  className={`
                    inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium
                    rounded-md transition-all duration-150
                    ${isSelectionEditMode
                      ? "bg-indigo-100 text-indigo-700"
                      : "text-gray-600 hover:bg-white hover:text-indigo-600 hover:shadow-sm"
                    }
                    disabled:opacity-40 disabled:cursor-not-allowed
                  `}
                >
                  <MousePointer2 className="w-3.5 h-3.5" />
                  <span>{isSelectionEditMode ? "Exit" : "Select"}</span>
                </button>
              </ToolTip> */}
            </div>

            {/* Separator */}
            <div className="w-px h-6 bg-gray-200 mx-1" />

            {/* Undo/Redo Group */}
            <div className="flex items-center bg-gray-50/80 rounded-lg p-1 gap-0.5">
              <ToolTip content={canUndo ? "Undo (Ctrl+Z)" : "Nothing to undo"}>
                <button
                  onClick={undo}
                  disabled={!canUndo || !isSlideReady}
                  className={`
                    inline-flex items-center justify-center w-8 h-8
                    rounded-md transition-all duration-150
                    ${!canUndo || !isSlideReady
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
                  disabled={!canRedo || !isSlideReady}
                  className={`
                    inline-flex items-center justify-center w-8 h-8
                    rounded-md transition-all duration-150
                    ${!canRedo || !isSlideReady
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
        {/* Selection Edit Mode Banner */}
        {isSelectionEditMode && slide.processed && !slide.processing && (
          <div className="mb-4 flex items-center justify-between bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-indigo-500 flex items-center justify-center">
                <MousePointer2 className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="text-sm font-medium text-indigo-700">
                Selection Edit Mode — Click on any element to edit with AI
              </span>
            </div>
            <button
              onClick={() => setIsSelectionEditMode(false)}
              className="h-8 px-3 text-sm font-medium text-indigo-600 hover:text-indigo-800 hover:bg-indigo-100 rounded-md transition-colors"
            >
              Exit
            </button>
          </div>
        )}
        <div className="relative">
          <SlideContentDisplay
            slide={slide}
            compiledLayout={compiledLayout}
            previewData={previewData}
            retrySlide={handleRetrySlide}
            onClearPreview={handleClearPreview}
            slideDisplayRef={slideDisplayRef}
          />
          {/* Schema-Element Highlighting Overlay - active when schema editor is open */}
          {isSchemaEditorOpen && slide.processed && !slide.processing && (
            <SchemaElementHighlighter
              containerRef={slideDisplayRef}
              sampleData={sampleData}
              isActive={isSchemaEditorOpen}
            />
          )}
          {/* Selection Editor Overlay */}
          {/* {isSelectionEditMode && slide.processed && !slide.processing && (
            <SlideSelectionEditor
              containerRef={slideDisplayRef}
              slide={slide}
              onSlideUpdate={handleSelectionUpdate}
            />
          )} */}
        </div>
      </div>


      {/* Status Indicator */}
      {hasError && (
        <div className="absolute top-3 right-3">
          <div className="w-3 h-3 rounded-full bg-[#EF4444] animate-pulse" />
        </div>
      )}
    </div>
  );
};

export default EachSlide;
