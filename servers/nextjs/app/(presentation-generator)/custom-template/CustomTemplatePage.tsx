"use client";



import React, { useEffect, useCallback, useState } from "react";
import { useRouter } from "next/navigation";



import { useFileUpload } from "./hooks/useFileUpload";
import { useTemplateCreation } from "./hooks/useTemplateCreation";
import { useLayoutSaving } from "./hooks/useLayoutSaving";

import { ProcessedSlide } from "./types";
import { TAILWIND_CDN_URL } from "./constants";
import { TemplateStudioHeader } from "./components/TemplateStudioHeader";
import { TemplateCreationProgress } from "./components/TemplateCreationProgress";
import { Step2FontManagement } from "./components/steps/Step2FontManagement";
import { Step3SlidePreview } from "./components/steps/Step3SlidePreview";
import { Step4TemplateCreation } from "./components/steps/Step4TemplateCreation";
import { SaveLayoutButton } from "./components/SaveLayoutButton";
import { SaveLayoutModal } from "./components/SaveLayoutModal";
import { FileUploadSection } from "./components/FileUploadSection";

import { useFontLoader } from "../hooks/useFontLoad";
import Header from "@/app/(presentation-generator)/(dashboard)/dashboard/components/Header";





const CustomTemplatePage = () => {
    const router = useRouter();

    const [schemaEditorSlideIndex, setSchemaEditorSlideIndex] = useState<number | null>(null);
    const [schemaPreviewData, setSchemaPreviewData] = useState<Record<number, Record<string, any>>>({});

    const { selectedFile, handleFileSelect, removeFile } = useFileUpload();


    const {
        state,
        uploadedFonts,
        slides,
        setSlides,
        completedSlides,
        checkFonts,
        uploadFont,
        removeFont,
        fontUploadAndPreview,
        initTemplateCreation,
        retrySlide,
    } = useTemplateCreation();

    // Layout saving hook
    const {
        isSavingLayout,
        isModalOpen,
        openSaveModal,
        closeSaveModal,
        saveLayout,
    } = useLayoutSaving(slides);


    useEffect(() => {
        const existingScript = document.querySelector('script[src*="tailwindcss.com"]');
        if (!existingScript) {
            const script = document.createElement("script");
            script.src = TAILWIND_CDN_URL;
            script.async = true;
            document.head.appendChild(script);
        }
    }, []);


    /**
     * Step 1: Check fonts in uploaded PPTX
     */
    const handleCheckFonts = useCallback(async () => {


        if (selectedFile) {
            await checkFonts(selectedFile);
        }
    }, [selectedFile, checkFonts]);

    /**
     * Step 2: Upload fonts and generate preview
     */
    const handleFontUploadAndPreview = useCallback(async () => {
        if (selectedFile) {
            const data = await fontUploadAndPreview(selectedFile);
            if (data) {
                useFontLoader(data.fonts);
            }
        }
    }, [selectedFile, fontUploadAndPreview]);

    /**
     * Step 5: Save template with metadata
     */
    const handleSaveTemplate = useCallback(async (
        layoutName: string,
        description: string,
        template_info_id: string
    ): Promise<string | null> => {
        const id = await saveLayout(layoutName, description, template_info_id);
        if (id) {
            router.push(`/template-preview?slug=custom-${id}`);
        }
        return id;
    }, [saveLayout, router]);

    /**
     * Update a specific slide's data
     */
    const handleSlideUpdate = useCallback((index: number, updatedSlideData: Partial<ProcessedSlide>) => {
        setSlides((prevSlides) =>
            prevSlides.map((s, i) =>
                i === index
                    ? { ...s, ...updatedSlideData, modified: true }
                    : s
            )
        );
    }, [setSlides]);


    /**
     * Open schema editor for a specific slide
     */
    const handleOpenSchemaEditor = useCallback((index: number | null) => {
        setSchemaEditorSlideIndex(index);
    }, []);

    /**
     * Close schema editor
     */
    const handleCloseSchemaEditor = useCallback(() => {
        setSchemaEditorSlideIndex(null);
    }, []);

    /**
     * Save changes from schema editor
     */
    const handleSchemaEditorSave = useCallback((updatedReact: string) => {
        if (schemaEditorSlideIndex !== null) {
            setSlides(prev => prev.map((s, i) =>
                i === schemaEditorSlideIndex ? { ...s, react: updatedReact } : s
            ));
        }
        setSchemaEditorSlideIndex(null);
    }, [schemaEditorSlideIndex, setSlides]);

    /**
     * Update schema preview content (for AI fill)
     */
    const handleSchemaPreviewContent = useCallback((content: Record<string, any>) => {
        if (schemaEditorSlideIndex !== null) {
            setSchemaPreviewData(prev => ({
                ...prev,
                [schemaEditorSlideIndex]: content
            }));
        }
    }, [schemaEditorSlideIndex]);

    /**
     * Clear schema preview data for a specific slide
     */
    const handleClearSchemaPreview = useCallback((slideIndex: number) => {
        setSchemaPreviewData(prev => {
            const newData = { ...prev };
            delete newData[slideIndex];
            return newData;
        });
    }, []);



    const showFileUpload = state.step === 'file-upload';
    const showFontManager = state.step === 'font-check' || state.step === 'font-upload';
    const showPreview = state.step === 'slides-preview';
    const showSlides = state.step === 'template-creation' || state.step === 'completed';
    const isProcessingCompleted = state.step === 'completed';



    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">

            <Header />
            <TemplateStudioHeader />
            {showFileUpload ? (
                <div className="pb-24">
                    <FileUploadSection
                        selectedFile={selectedFile}
                        handleFileSelect={handleFileSelect}
                        removeFile={removeFile}
                        CheckFonts={handleCheckFonts}
                        isProcessingPptx={state.isLoading}
                        slides={[]}
                        completedSlides={0}
                    />

                </div>
            ) : (
                <div className="mx-auto min-h-[600px] px-6 pb-24">

                    <TemplateCreationProgress
                        currentStep={state.step}
                        totalSlides={state.totalSlides}
                        processedSlides={completedSlides}
                    />

                    {/* Step 2: Font Management */}
                    {showFontManager && (
                        <Step2FontManagement
                            fontsData={state.fontsData}
                            uploadedFonts={uploadedFonts}
                            uploadFont={uploadFont}
                            removeFont={removeFont}
                            onContinue={handleFontUploadAndPreview}
                            isUploading={state.isLoading}
                        />
                    )}

                    {/* Step 3: Slide Preview */}
                    {showPreview && (
                        <Step3SlidePreview
                            previewData={state.previewData}
                            onInitTemplate={initTemplateCreation}
                            isLoading={state.isLoading}
                        />
                    )}

                    {/* Step 4: Template Creation & Editing */}
                    {showSlides && slides.length > 0 && (
                        <Step4TemplateCreation
                            slides={slides}
                            setSlides={setSlides}
                            retrySlide={retrySlide}
                            onSlideUpdate={handleSlideUpdate}
                            schemaEditorSlideIndex={schemaEditorSlideIndex}
                            onOpenSchemaEditor={handleOpenSchemaEditor}
                            onCloseSchemaEditor={handleCloseSchemaEditor}
                            onSchemaEditorSave={handleSchemaEditorSave}
                            schemaPreviewData={schemaPreviewData}
                            onSchemaPreviewContent={handleSchemaPreviewContent}
                            onClearSchemaPreview={handleClearSchemaPreview}
                        />
                    )}

                    {/* Floating Save Template Button */}
                    {isProcessingCompleted && slides.some((s) => s.processed) && (
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
                        template_info_id={state.templateId || ''}
                    />
                </div>
            )}

        </div>
    );
};

export default CustomTemplatePage;
