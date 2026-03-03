"use client";

import React, { useEffect } from "react";
import FontManager from "./components/FontManager";
import Header from "../dashboard/components/Header";
import { useLayout } from "../context/LayoutContext";
import { useCustomLayout } from "./hooks/useCustomLayout";
import { useFontManagement } from "./hooks/useFontManagement";
import { useFileUpload } from "./hooks/useFileUpload";
import { useSlideProcessing } from "./hooks/useSlideProcessing";
import { useLayoutSaving } from "./hooks/useLayoutSaving";
import { useAPIKeyCheck } from "./hooks/useAPIKeyCheck";
import { useRouter, usePathname } from "next/navigation";
import { LoadingSpinner } from "./components/LoadingSpinner";
import { FileUploadSection } from "./components/FileUploadSection";
import { SaveLayoutButton } from "./components/SaveLayoutButton";
import { SaveLayoutModal } from "./components/SaveLayoutModal";
import EachSlide from "./components/EachSlide/NewEachSlide";
import { APIKeyWarning } from "./components/APIKeyWarning";
import { trackEvent, MixpanelEvent } from "@/utils/mixpanel";

const CustomTemplatePage = () => {
  const router = useRouter();
  const pathname = usePathname();
  const { refetch } = useLayout();
  
  // Custom hooks for different concerns
  const { hasRequiredKey, isRequiredKeyLoading } = useAPIKeyCheck();
  const { selectedFile, handleFileSelect, removeFile } = useFileUpload();
  const { slides, setSlides, completedSlides } = useCustomLayout();
  const { fontsData, UploadedFonts, uploadFont, removeFont, getAllUnsupportedFonts, setFontsData } = useFontManagement();
  const { isProcessingPptx, processFile, retrySlide,processSlideToHtml } = useSlideProcessing(
    selectedFile,
    slides,
    setSlides,
    setFontsData
  );
  const { isSavingLayout, isModalOpen, openSaveModal, closeSaveModal, saveLayout } = useLayoutSaving(
    slides,
    UploadedFonts,
    fontsData,
    refetch,
    setSlides
  );

  const handleSaveTemplate = async (layoutName: string, description: string): Promise<string | null> => {
    trackEvent(MixpanelEvent.CustomTemplate_Save_Templates_API_Call);
    const id = await saveLayout(layoutName, description);
    if (id) {
      router.push(`/template-preview/custom-${id}`);
    }
    return id;
  };

  const handleProcessSlideToHtml = (slide: any) => {
    processSlideToHtml(slide,0)
  }

  // Handle slide updates
  const handleSlideUpdate = (index: number, updatedSlideData: any) => {
    setSlides((prevSlides) =>
      prevSlides.map((s, i) =>
        i === index
          ? {
              ...s,
              ...updatedSlideData,
              modified: true,
            }
          : s
      )
    );
  };
 useEffect(() => {
    const existingScript = document.querySelector(
      'script[src*="tailwindcss.com"]'
    );
    if (!existingScript) {
      const script = document.createElement("script");
      script.src = "https://cdn.tailwindcss.com";
      script.async = true;
      document.head.appendChild(script);
    }
  }, []);

  // Loading state
  if (isRequiredKeyLoading) {
    return <LoadingSpinner message="Checking API Key..." />;
  }

  // Anthropic key warning
  if (!hasRequiredKey) {
    return <APIKeyWarning />;
 

  }
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <Header />
      <div className="max-w-[1440px] aspect-video mx-auto px-6">
        {/* Header */}
        <div className="text-center space-y-2 my-6">
          <h1 className="text-4xl font-bold text-gray-900">
            Custom Template Processor
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Upload your PDF or PPTX file to extract slides and convert them to
            a template which you can use to generate AI presentations.
          </p>
          <div className="max-w-2xl mx-auto mt-2">
            <div className="inline-block rounded border border-orange-200 bg-orange-50 px-3 py-2 text-sm text-orange-700">
              AI template generation can take around 5 minutes per slide.
            </div>
          </div>
        </div>
       

        {/* File Upload Section */}
        <FileUploadSection
          selectedFile={selectedFile}
          handleFileSelect={handleFileSelect}
          removeFile={removeFile}
          processFile={processFile}
          isProcessingPptx={isProcessingPptx}
          slides={slides}
          completedSlides={completedSlides}
        />

        {/* Global Font Management */}
        {fontsData && (
          <FontManager
            fontsData={fontsData}
            UploadedFonts={UploadedFonts}
            uploadFont={uploadFont}
            removeFont={removeFont}
            getAllUnsupportedFonts={getAllUnsupportedFonts}
            processSlideToHtml={()=>handleProcessSlideToHtml(slides[0])}
          />
        )}

        {/* Slides Section */}
        {slides.length > 0 && (
          <div className="space-y-6 mt-10">
            {slides.map((slide, index) => (
              <EachSlide
                key={index}
                slide={slide}
                index={index}
                isProcessing={slides.some((s) => s.processing)}
                retrySlide={retrySlide}
                setSlides={setSlides}
                onSlideUpdate={(updatedSlideData) =>
                  handleSlideUpdate(index, updatedSlideData)
                }
              />
            ))}
          </div>
        )}

        {/* Floating Save Template Button */}
        {slides.length > 0 && slides.some((s) => s.processed) && (
          <SaveLayoutButton
            onSave={openSaveModal}
            isSaving={isSavingLayout}
            isProcessing={slides.some((s) => s.processing)}
          />
        )}

        {/* Save Template Modal */}
        <SaveLayoutModal
          isOpen={isModalOpen}
          onClose={closeSaveModal}
          onSave={handleSaveTemplate}
          isSaving={isSavingLayout}
        />
      </div>
    </div>
  );
};

export default CustomTemplatePage;


