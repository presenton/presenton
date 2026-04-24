/**
 * Step 2: Font Management
 * Handles font checking and uploading
 */

import React from "react";
import FontManager from "../FontManager";
import { FontData, UploadedFont } from "../../types";

interface Step2FontManagementProps {
    fontsData: FontData | null;
    uploadedFonts: UploadedFont[];
    uploadFont: (fontName: string, file: File) => string | null;
    removeFont: (fontName: string) => void;
    onContinue: () => Promise<void>;
    isUploading: boolean;
}

export const Step2FontManagement: React.FC<Step2FontManagementProps> = ({
    fontsData,
    uploadedFonts,
    uploadFont,
    removeFont,
    onContinue,
    isUploading,
}) => {
    if (!fontsData) return null;

    return (
        <FontManager
            fontsData={fontsData}
            uploadedFonts={uploadedFonts}
            uploadFont={uploadFont}
            removeFont={removeFont}
            onContinue={onContinue}
            isUploading={isUploading}
        />
    );
};

