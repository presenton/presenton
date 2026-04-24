

import React from "react";
import { ProcessedSlide } from "../../types";
import { SchemaHighlightProvider } from "../SchemaHighlightContext";
import { SlidesList } from "./SlidesList";
import { SchemaEditorPanel } from "../SchemaEditorPanel";

interface Step4TemplateCreationProps {
  slides: ProcessedSlide[];
  setSlides: React.Dispatch<React.SetStateAction<ProcessedSlide[]>>;
  retrySlide: (index: number) => void;
  onSlideUpdate: (index: number, updatedSlideData: Partial<ProcessedSlide>) => void;

  // Schema editor state
  schemaEditorSlideIndex: number | null;
  onOpenSchemaEditor: (index: number | null) => void;
  onCloseSchemaEditor: () => void;
  onSchemaEditorSave: (updatedReact: string) => void;

  // Schema preview state
  schemaPreviewData: Record<number, Record<string, any>>;
  onSchemaPreviewContent: (content: Record<string, any>) => void;
  onClearSchemaPreview: (slideIndex: number) => void;
}

export const Step4TemplateCreation: React.FC<Step4TemplateCreationProps> = ({
  slides,
  setSlides,
  retrySlide,
  onSlideUpdate,
  schemaEditorSlideIndex,
  onOpenSchemaEditor,
  onCloseSchemaEditor,
  onSchemaEditorSave,
  schemaPreviewData,
  onSchemaPreviewContent,
  onClearSchemaPreview,
}) => {
  const schemaEditorSlide = schemaEditorSlideIndex !== null ? slides[schemaEditorSlideIndex] : null;
  const isSchemaEditorOpen = schemaEditorSlideIndex !== null;

  return (
    <SchemaHighlightProvider>
      <div className="mt-8 mx-auto">
        <div className="transition-all duration-300 flex-1">
          <div className="flex items-stretch gap-2">
            {/* Slides List */}
            <SlidesList
              slides={slides}
              setSlides={setSlides}
              retrySlide={retrySlide}
              onSlideUpdate={onSlideUpdate}
              onOpenSchemaEditor={onOpenSchemaEditor}
              schemaEditorSlideIndex={schemaEditorSlideIndex}
              schemaPreviewData={schemaPreviewData}
              onClearSchemaPreview={onClearSchemaPreview}
              isSchemaEditorOpen={isSchemaEditorOpen}
            />

            {/* Schema Editor Panel (Right Sidebar) */}
            {isSchemaEditorOpen && schemaEditorSlide && (
              <div className="w-[520px] sticky top-20 self-start">
                <div className="bg-white rounded-2xl border border-gray-200 shadow-lg overflow-hidden">
                  <SchemaEditorPanel
                    slide={schemaEditorSlide}
                    slideIndex={schemaEditorSlideIndex}
                    onSave={onSchemaEditorSave}
                    onCancel={onCloseSchemaEditor}
                    onFillContent={onSchemaPreviewContent}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </SchemaHighlightProvider>
  );
};

