/**
 * Slides List Component
 * Renders the grid of slides being edited
 */

import React from "react";
import { ProcessedSlide } from "../../types";
import SlideErrorBoundary from "@/app/(presentation-generator)/components/SlideErrorBoundary";
import EachSlide from "../EachSlide/NewEachSlide";

interface SlidesListProps {
  slides: ProcessedSlide[];
  setSlides: React.Dispatch<React.SetStateAction<ProcessedSlide[]>>;
  retrySlide: (index: number) => void;
  onSlideUpdate: (index: number, updatedSlideData: Partial<ProcessedSlide>) => void;
  onOpenSchemaEditor: (index: number | null) => void;
  schemaEditorSlideIndex: number | null;
  schemaPreviewData: Record<number, Record<string, any>>;
  onClearSchemaPreview: (slideIndex: number) => void;
  isSchemaEditorOpen: boolean;
}

export const SlidesList: React.FC<SlidesListProps> = ({
  slides,
  setSlides,
  retrySlide,
  onSlideUpdate,
  onOpenSchemaEditor,
  schemaEditorSlideIndex,
  schemaPreviewData,
  onClearSchemaPreview,
  isSchemaEditorOpen,
}) => {
  const containerWidth = isSchemaEditorOpen ? 'w-[calc(100%-540px)]' : 'w-full';

  return (
    <div className={`space-y-5 w-full p-5 rounded-2xl ${containerWidth}`}>
      {slides.map((slide, index) => (
        <SlideErrorBoundary
          key={index}
          label={`Slide ${index + 1}`}
        >
          <EachSlide
            key={index}
            slide={slide}
            index={index}
            isProcessing={slides.some((s) => s.processing)}
            retrySlide={retrySlide}
            setSlides={setSlides}
            onSlideUpdate={(updatedSlideData) =>
              onSlideUpdate(index, updatedSlideData)
            }
            onOpenSchemaEditor={onOpenSchemaEditor}
            isSchemaEditorOpen={schemaEditorSlideIndex === index}
            schemaPreviewData={schemaPreviewData[index] ?? null}
            onClearSchemaPreview={() => onClearSchemaPreview(index)}
          />
        </SlideErrorBoundary>
      ))}
    </div>
  );
};

