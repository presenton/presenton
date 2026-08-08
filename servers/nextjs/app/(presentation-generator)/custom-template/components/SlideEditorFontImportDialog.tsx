import React, { useMemo, useRef } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  FileType,
  Loader2,
  Type,
  Upload,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { FontData, FontItem, UploadedFont } from "../types";

type SlideEditorFontImportDialogProps = {
  open: boolean;
  fileName?: string;
  fontsData: FontData | null;
  uploadedFonts: UploadedFont[];
  isChecking: boolean;
  isPreparing: boolean;
  error: string | null;
  uploadFont: (fontName: string, file: File) => string | null;
  removeFont: (fontName: string) => void;
  onCancel: () => void;
  onOpenWithoutFontCheck: () => void;
  onOpenWithFonts: () => void;
};

export function SlideEditorFontImportDialog({
  open,
  fileName,
  fontsData,
  uploadedFonts,
  isChecking,
  isPreparing,
  error,
  uploadFont,
  removeFont,
  onCancel,
  onOpenWithoutFontCheck,
  onOpenWithFonts,
}: SlideEditorFontImportDialogProps) {
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const fontsNeedingUpload = useMemo(() => {
    if (!fontsData) return [];
    return fontsData.unavailable_fonts.filter(
      (font) => !isFontUploaded(font, uploadedFonts)
    );
  }, [fontsData, uploadedFonts]);

  const allFontsReady = fontsNeedingUpload.length === 0;
  const hasAvailableFonts = Boolean(fontsData?.available_fonts.length);
  const hasUploadedFonts = uploadedFonts.length > 0;
  const canOpenWithFonts = Boolean(fontsData) && !isChecking;
  const primaryLabel = allFontsReady ? "Open in editor" : "Open anyway";

  const handleFontInputChange = (
    fontName: string,
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const fontFile = event.target.files?.[0];
    if (!fontFile) return;
    const result = uploadFont(fontName, fontFile);
    if (result) {
      event.target.value = "";
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && !isPreparing) {
          onCancel();
        }
      }}
    >
      <DialogContent className="max-h-[88vh] overflow-hidden p-0 sm:max-w-[760px]">
        <DialogHeader className="border-b border-[#EEF0F4] px-6 py-5">
          <DialogTitle className="flex items-center gap-3 text-left">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#EBE9FE]">
              <Type className="h-5 w-5 text-[#7A5AF8]" />
            </span>
            <span className="grid gap-1">
              <span className="text-xl font-semibold text-[#111827]">
                Prepare fonts
              </span>
              {fileName ? (
                <span className="max-w-[520px] truncate text-sm font-normal text-[#6B7280]">
                  {fileName}
                </span>
              ) : null}
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="max-h-[58vh] overflow-y-auto px-6 py-5">
          {isChecking ? (
            <div className="flex min-h-[220px] flex-col items-center justify-center gap-3 text-center">
              <Loader2 className="h-8 w-8 animate-spin text-[#7A5AF8]" />
              <div>
                <p className="text-sm font-semibold text-[#111827]">
                  Checking presentation fonts
                </p>
                <p className="mt-1 text-sm text-[#6B7280]">
                  Looking for fonts that need to be available in the editor.
                </p>
              </div>
            </div>
          ) : error && !fontsData ? (
            <div className="rounded-xl border border-[#FDE68A] bg-[#FFFBEB] p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[#D97706]" />
                <div>
                  <p className="text-sm font-semibold text-[#92400E]">
                    Font check failed
                  </p>
                  <p className="mt-1 text-sm text-[#6B7280]">{error}</p>
                </div>
              </div>
            </div>
          ) : fontsData ? (
            <div className="space-y-5">
              {hasAvailableFonts ? (
                <section className="rounded-xl border border-[#BBF7D0] bg-[#F0FDF4] p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-[#16A34A]" />
                    <h3 className="text-sm font-semibold text-[#166534]">
                      Available fonts ({fontsData.available_fonts.length})
                    </h3>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {fontsData.available_fonts.map((font) => (
                      <span
                        key={`${font.name}-${font.variant ?? "regular"}`}
                        className="rounded-full border border-[#D1FAE5] bg-white px-3 py-1.5 text-xs font-medium text-[#166534]"
                      >
                        {font.name}
                      </span>
                    ))}
                  </div>
                </section>
              ) : null}

              {fontsNeedingUpload.length > 0 ? (
                <section className="rounded-xl border border-[#FDE68A] bg-[#FFFBEB] p-4">
                  <div className="mb-4 flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-[#D97706]" />
                    <h3 className="text-sm font-semibold text-[#92400E]">
                      Missing fonts ({fontsNeedingUpload.length})
                    </h3>
                  </div>
                  <div className="space-y-3">
                    {fontsNeedingUpload.map((font) => {
                      const uploadKey = fontUploadKey(font);
                      return (
                        <div
                          key={uploadKey}
                          className="flex items-center justify-between gap-4 rounded-xl border border-[#FDE68A] bg-white p-4"
                        >
                          <div className="flex min-w-0 items-center gap-3">
                            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#FEF3C7]">
                              <FileType className="h-5 w-5 text-[#D97706]" />
                            </span>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-[#111827]">
                                {font.name}
                              </p>
                              {font.family_name && font.family_name !== font.name ? (
                                <p className="truncate text-xs text-[#6B7280]">
                                  {font.family_name}
                                  {font.variant
                                    ? ` · ${font.variant.replace(/_/g, " ")}`
                                    : ""}
                                </p>
                              ) : null}
                            </div>
                          </div>
                          <input
                            ref={(element) => {
                              fileInputRefs.current[uploadKey] = element;
                            }}
                            type="file"
                            accept=".ttf,.otf,.woff,.woff2,.eot"
                            className="hidden"
                            onChange={(event) =>
                              handleFontInputChange(uploadKey, event)
                            }
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            className="shrink-0 rounded-full border-[#D97706] text-[#D97706] hover:bg-[#FFFBEB]"
                            onClick={() => fileInputRefs.current[uploadKey]?.click()}
                          >
                            <Upload className="h-4 w-4" />
                            Upload
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                </section>
              ) : (
                <section className="rounded-xl border border-[#BBF7D0] bg-[#F0FDF4] p-4">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-[#16A34A]" />
                    <p className="text-sm font-semibold text-[#166534]">
                      All fonts are ready
                    </p>
                  </div>
                </section>
              )}

              {hasUploadedFonts ? (
                <section className="rounded-xl border border-[#BBF7D0] bg-[#F0FDF4] p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-[#16A34A]" />
                    <h3 className="text-sm font-semibold text-[#166534]">
                      Uploaded fonts ({uploadedFonts.length})
                    </h3>
                  </div>
                  <div className="space-y-2">
                    {uploadedFonts.map((font) => (
                      <div
                        key={font.fontName}
                        className="flex items-center justify-between rounded-xl border border-[#D1FAE5] bg-white px-3 py-2"
                      >
                        <span className="text-sm font-medium text-[#166534]">
                          {font.fontName}
                        </span>
                        <button
                          type="button"
                          className="rounded-full p-2 text-[#6B7280] hover:bg-[#FEE2E2] hover:text-[#DC2626]"
                          onClick={() => removeFont(font.fontName)}
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </section>
              ) : null}
            </div>
          ) : null}
        </div>

        <DialogFooter className="border-t border-[#EEF0F4] px-6 py-4">
          <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-[#6B7280]">
              {fontsNeedingUpload.length > 0
                ? "Missing fonts may render with browser fallbacks."
                : "The editor will load available font files before importing."}
            </p>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                className="rounded-full"
                disabled={isPreparing}
                onClick={onCancel}
              >
                Cancel
              </Button>
              {error && !fontsData ? (
                <Button
                  className="rounded-full bg-[#7A5AF8] text-white hover:bg-[#6941C6]"
                  disabled={isPreparing}
                  onClick={onOpenWithoutFontCheck}
                >
                  Open without check
                  <ChevronRight className="h-4 w-4" />
                </Button>
              ) : (
                <Button
                  className="rounded-full bg-[#7A5AF8] text-white hover:bg-[#6941C6]"
                  disabled={!canOpenWithFonts || isPreparing}
                  onClick={onOpenWithFonts}
                >
                  {isPreparing ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Preparing...
                    </>
                  ) : (
                    <>
                      {primaryLabel}
                      <ChevronRight className="h-4 w-4" />
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function fontUploadKey(font: FontItem) {
  return font.name;
}

function isFontUploaded(font: FontItem, uploadedFonts: UploadedFont[]) {
  return uploadedFonts.some(
    (uploaded) =>
      uploaded.fontName === font.name ||
      Boolean(font.original_name && uploaded.fontName === font.original_name)
  );
}
