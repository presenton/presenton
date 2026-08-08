/**
 * Step 3: Slide Preview
 * Displays preview of slides with uploaded fonts
 */

import React from "react";
import { SlidePreviewSection } from "../SlidePreviewSection";
import { FontUploadPreviewResponse, TemplateCreationMetadata } from "../../types";

interface Step3SlidePreviewProps {
    previewData: FontUploadPreviewResponse | null;
    onInitTemplate: (metadata?: TemplateCreationMetadata) => void;
    isLoading: boolean;
    defaultTemplateName: string;
    requiresTemplateMetadata?: boolean;
}

export const Step3SlidePreview: React.FC<Step3SlidePreviewProps> = ({
    previewData,
    onInitTemplate,
    isLoading,
    defaultTemplateName,
    requiresTemplateMetadata,
}) => {
    if (!previewData) return null;

    return (
        <SlidePreviewSection
            previewData={previewData}
            onInitTemplate={onInitTemplate}
            isLoading={isLoading}
            defaultTemplateName={defaultTemplateName}
            requiresTemplateMetadata={requiresTemplateMetadata}
        />
    );
};
