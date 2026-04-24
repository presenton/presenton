import React, { useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Upload,
  CheckCircle2,
  AlertTriangle,
  X,
  Loader2,
  Type,
  ChevronRight,
  FileType,
  Info,
} from "lucide-react";
import { FontManagerProps, FontItem } from "../types";

const FontManager: React.FC<FontManagerProps> = ({
  fontsData,
  uploadedFonts,
  uploadFont,
  removeFont,
  onContinue,
  isUploading = false,
}) => {
  const fileInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});

  // Get fonts that still need to be uploaded (unavailable fonts not yet uploaded)
  const fontsNeedingUpload = fontsData.unavailable_fonts.filter(
    (font) => !uploadedFonts.some((uploaded) => uploaded.fontName === font.name)
  );

  const allFontsUploaded = fontsNeedingUpload.length === 0;
  const hasAvailableFonts = fontsData.available_fonts.length > 0;
  const hasUploadedFonts = uploadedFonts.length > 0;

  const handleFontUpload = (fontName: string, file: File) => {
    if (!file) return;

    const result = uploadFont(fontName, file);

    if (result && fileInputRefs.current[fontName]) {
      fileInputRefs.current[fontName]!.value = "";
    }
  };

  const handleFileInputChange = (
    fontName: string,
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (file) {
      handleFontUpload(fontName, file);
    }
  };

  return (
    <div className="my-8 max-w-[900px] mx-auto">
      <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-sm overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 border-b border-[#F3F4F6] bg-[#FAFAFA]">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-[#EBE9FE] flex items-center justify-center">
              <Type className="w-6 h-6 text-[#7A5AF8]" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-[#111827]">Font Management</h2>
              <p className="text-sm text-[#6B7280] mt-0.5">
                {allFontsUploaded
                  ? "All fonts are ready! You can proceed to preview."
                  : "Upload missing fonts to ensure your presentation displays correctly."}
              </p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Available Fonts */}
          {hasAvailableFonts && (
            <div className="p-4 bg-[#F0FDF4] rounded-xl border border-[#BBF7D0]">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle2 className="w-5 h-5 text-[#16A34A]" />
                <h4 className="text-sm font-semibold text-[#166534]">
                  Available Fonts ({fontsData.available_fonts.length})
                </h4>
              </div>
              <div className="flex flex-wrap gap-2">
                {fontsData.available_fonts.map((font, index) => (
                  <span
                    key={index}
                    className="px-3 py-1.5 bg-white border border-[#D1FAE5] rounded-full text-xs font-medium text-[#166534] shadow-sm"
                  >
                    {font.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Fonts Needing Upload */}
          {fontsNeedingUpload.length > 0 && (
            <div className="p-4 bg-[#FFFBEB] rounded-xl border border-[#FDE68A]">
              <div className="flex items-center gap-2 mb-4">
                <AlertTriangle className="w-5 h-5 text-[#D97706]" />
                <h4 className="text-sm font-semibold text-[#92400E]">
                  Missing Fonts ({fontsNeedingUpload.length})
                </h4>
              </div>

              <div className="space-y-3">
                {fontsNeedingUpload.map((font, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-4 bg-white rounded-xl border border-[#FDE68A] shadow-sm"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-[#FEF3C7] flex items-center justify-center">
                        <FileType className="w-5 h-5 text-[#D97706]" />
                      </div>
                      <div>
                        <span className="text-sm font-semibold text-[#111827] block">
                          {font.name}
                        </span>
                        <span className="text-xs text-[#6B7280]">
                          .ttf, .otf, .woff, .woff2
                        </span>
                      </div>
                    </div>
                    <div>
                      <input
                        ref={(el) => {
                          fileInputRefs.current[font.name] = el;
                        }}
                        type="file"
                        accept=".ttf,.otf,.woff,.woff2,.eot"
                        onChange={(e) => handleFileInputChange(font.name, e)}
                        className="hidden"
                        id={`font-upload-${index}`}
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => fileInputRefs.current[font.name]?.click()}
                        className="rounded-full px-4 h-9 text-sm font-medium transition-all text-[#D97706] border-[#D97706] hover:bg-[#FFFBEB] hover:border-[#D97706]"
                      >
                        <Upload className="w-4 h-4 mr-1" />
                        Upload
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Uploaded Fonts */}
          {hasUploadedFonts && (
            <div className="p-4 bg-[#F0FDF4] rounded-xl border border-[#BBF7D0]">
              <div className="flex items-center gap-2 mb-4">
                <CheckCircle2 className="w-5 h-5 text-[#16A34A]" />
                <h4 className="text-sm font-semibold text-[#166534]">
                  Uploaded Fonts ({uploadedFonts.length})
                </h4>
              </div>
              <div className="space-y-2">
                {uploadedFonts.map((font, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 bg-white rounded-xl border border-[#D1FAE5] shadow-sm"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-[#DCFCE7] flex items-center justify-center">
                        <CheckCircle2 className="w-4 h-4 text-[#16A34A]" />
                      </div>
                      <span className="text-sm font-medium text-[#166534]">
                        {font.fontName}
                      </span>
                    </div>
                    <button
                      onClick={() => removeFont(font.fontName)}
                      className="p-2 rounded-full text-[#6B7280] hover:text-[#DC2626] hover:bg-[#FEE2E2] transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Action Footer */}
        <div className={`px-6 py-5 border-t transition-colors duration-300 ${allFontsUploaded
          ? 'bg-[#F0FDF4] border-[#BBF7D0]'
          : 'bg-[#FAFAFA] border-[#F3F4F6]'
          }`}>
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            {!allFontsUploaded && (
              <div className="flex items-start gap-2 text-sm text-[#6B7280]">
                <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <p>You can continue without all fonts, but some text may not display correctly.</p>
              </div>
            )}
            {allFontsUploaded && (
              <p className="text-sm text-[#16A34A] font-medium">
                ✓ All fonts are ready
              </p>
            )}
            <Button
              size="lg"
              onClick={onContinue}
              disabled={isUploading}
              className={`
                px-5 py-2 h-auto text-sm font-semibold rounded-full transition-all duration-300
                ${isUploading
                  ? 'bg-[#E5E7EB] text-[#9CA3AF]'
                  : allFontsUploaded
                    ? 'bg-[#16A34A] text-white hover:bg-[#15803D] shadow-sm'
                    : 'bg-white text-[#374151] border border-[#E5E7EB] hover:bg-[#F9FAFB]'
                }
              `}
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  {allFontsUploaded ? 'Continue to Preview' : 'Continue'}
                  <ChevronRight className="w-4 h-4 ml-1" />
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FontManager;
