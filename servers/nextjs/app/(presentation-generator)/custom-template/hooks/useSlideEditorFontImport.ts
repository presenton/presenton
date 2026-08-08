import { useCallback, useState } from "react";
import { notify } from "@/components/ui/sonner";
import { getHeaderForFormData } from "@/app/(presentation-generator)/services/api/header";
import { ApiResponseHandler } from "@/app/(presentation-generator)/services/api/api-error-handler";
import { getApiUrl, resolveBackendAssetUrl } from "@/utils/api";
import type {
    FontData,
    FontUploadPreviewResponse,
    UploadedFont,
} from "../types";

const VALID_FONT_EXTENSIONS = [".ttf", ".otf", ".woff", ".woff2", ".eot"];
const MAX_FONT_SIZE_BYTES = 10 * 1024 * 1024;

export type PreparedSlideEditorImport = FontUploadPreviewResponse;

export function useSlideEditorFontImport() {
    const [file, setFile] = useState<File | null>(null);
    const [fontsData, setFontsData] = useState<FontData | null>(null);
    const [uploadedFonts, setUploadedFonts] = useState<UploadedFont[]>([]);
    const [isCheckingFonts, setIsCheckingFonts] = useState(false);
    const [isPreparingImport, setIsPreparingImport] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const reset = useCallback(() => {
        setFile(null);
        setFontsData(null);
        setUploadedFonts([]);
        setIsCheckingFonts(false);
        setIsPreparingImport(false);
        setError(null);
    }, []);

    const checkFonts = useCallback(async (pptxFile: File) => {
        setFile(pptxFile);
        setFontsData(null);
        setUploadedFonts([]);
        setIsCheckingFonts(true);
        setError(null);

        try {
            const formData = new FormData();
            formData.append("pptx_file", pptxFile);

            const response = await fetch(getApiUrl("/api/v1/ppt/fonts/check"), {
                method: "POST",
                headers: getHeaderForFormData(),
                body: formData,
            });

            const data = (await ApiResponseHandler.handleResponse(
                response,
                "Failed to check fonts in the presentation"
            )) as FontData;

            setFontsData(data);
            return data;
        } catch (caughtError) {
            const message =
                caughtError instanceof Error
                    ? caughtError.message
                    : "Font check failed.";
            setError(message);
            notify.error("Font check failed", message);
            return null;
        } finally {
            setIsCheckingFonts(false);
        }
    }, []);

    const uploadFont = useCallback((fontName: string, fontFile: File) => {
        const existingFont = uploadedFonts.find(
            (uploaded) => uploaded.fontName === fontName
        );
        if (existingFont) {
            notify.warning(
                "Font already added",
                `Font "${fontName}" is already in your upload list.`
            );
            return fontName;
        }

        const fileExtension = fontFile.name
            .toLowerCase()
            .slice(fontFile.name.lastIndexOf("."));

        if (!VALID_FONT_EXTENSIONS.includes(fileExtension)) {
            notify.error(
                "Invalid font file",
                "Please upload .ttf, .otf, .woff, .woff2, or .eot files."
            );
            return null;
        }

        if (fontFile.size > MAX_FONT_SIZE_BYTES) {
            notify.error("File too large", "Font file size must be less than 10MB.");
            return null;
        }

        setUploadedFonts((current) => [
            ...current,
            {
                fontName,
                fontUrl: "",
                fontPath: "",
                file: fontFile,
            },
        ]);
        notify.success("Font added", `Font "${fontName}" was added successfully.`);
        return fontName;
    }, [uploadedFonts]);

    const removeFont = useCallback((fontName: string) => {
        setUploadedFonts((current) =>
            current.filter((font) => font.fontName !== fontName)
        );
        notify.info("Font removed", "The font was removed from your upload list.");
    }, []);

    const prepareImport = useCallback(async (): Promise<PreparedSlideEditorImport | null> => {
        if (!file) {
            notify.error("No PPTX selected", "Please choose a PPTX file first.");
            return null;
        }

        setIsPreparingImport(true);
        setError(null);

        try {
            const formData = new FormData();
            formData.append("pptx_file", file);
            uploadedFonts.forEach((font) => {
                formData.append("font_files", font.file);
                formData.append("original_font_names", font.fontName);
            });

            const response = await fetch(
                getApiUrl("/api/v1/ppt/template/fonts-upload-and-slides-preview"),
                {
                    method: "POST",
                    headers: getHeaderForFormData(),
                    body: formData,
                }
            );

            const data = (await ApiResponseHandler.handleResponse(
                response,
                "Failed to prepare fonts for the slide editor"
            )) as FontUploadPreviewResponse;

            return {
                ...data,
                fonts: normalizeFontUrls(data.fonts ?? {}),
            };
        } catch (caughtError) {
            const message =
                caughtError instanceof Error
                    ? caughtError.message
                    : "Could not prepare this PPTX for the slide editor.";
            setError(message);
            notify.error("Font preparation failed", message);
            return null;
        } finally {
            setIsPreparingImport(false);
        }
    }, [file, uploadedFonts]);

    return {
        file,
        fontsData,
        uploadedFonts,
        isCheckingFonts,
        isPreparingImport,
        error,
        checkFonts,
        uploadFont,
        removeFont,
        prepareImport,
        reset,
    };
}

function normalizeFontUrls(fonts: Record<string, string>) {
    return Object.fromEntries(
        Object.entries(fonts)
            .filter(([name, url]) => name.trim() && url.trim())
            .map(([name, url]) => [name, resolveBackendAssetUrl(url)])
    );
}
