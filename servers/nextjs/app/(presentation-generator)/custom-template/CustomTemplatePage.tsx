/* eslint-disable @next/next/no-img-element */
"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Sparkles,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useSelector } from "react-redux";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { notify } from "@/components/ui/sonner";
import {
  EDITOR_STAGE_HEIGHT,
  EDITOR_STAGE_WIDTH,
} from "@/components/slide-editor/types";
import {
  GOOGLE_FONT_OPTIONS,
  loadGoogleFontOptions,
  type GoogleFontOption,
} from "@/components/slide-editor/text/google-fonts";
import type { RootState } from "@/store/store";
import { normalizeBackendAssetUrls, resolveBackendAssetUrl } from "@/utils/api";
import { setupImageUrlConverter } from "@/utils/image-url-converter";
import { MixpanelEvent, trackEvent } from "@/utils/mixpanel";

import { useFontLoader as loadFontAssets } from "../hooks/useFontLoad";
import TemplateService from "../services/api/template";
import { ensureTailwindBrowserScript } from "@/lib/tailwind-browser";
import { TemplateV2LayoutPreview } from "./components/EachSlide/TemplateV2LayoutPreview";
import { useFileUpload } from "./hooks/useFileUpload";
import { useTemplateCreation } from "./hooks/useTemplateCreation";
import type {
  FontData,
  FontItem,
  ProcessedSlide,
  TemplateCreationStep,
  TemplateV2Layout,
  UploadedFont,
} from "./types";
import {
  dismissTemplateV2ModelWarning,
  showTemplateV2ModelWarningIfNeeded,
} from "./utils/templateModelWarning";



type StudioStep = 1 | 2 | 3 | 4;



const studioSteps: { id: StudioStep; label: string }[] = [
  { id: 1, label: "Upload" },
  { id: 2, label: "Analyze" },
  { id: 3, label: "Preview" },
  { id: 4, label: "Review" },
];

const pillGradient =
  "linear-gradient(270deg, #D5CAFC 2.4%, #E3D2EB 27.88%, #F4DCD3 69.23%, #FDE4C2 100%)";

const FONT_FALLBACK_OPTION_HEIGHT = 40;
const FONT_FALLBACK_MAX_VISIBLE_ROWS = 7;
const FONT_FALLBACK_OVERSCAN_ROWS = 4;

function getDefaultTemplateName(file: File | null): string {
  if (!file?.name) return "";
  return file.name.replace(/\.pptx$/i, "").trim();
}

function formatFileSize(size: number): string {
  return `${(size / (1024 * 1024)).toFixed(2)} MB`;
}

function activeStudioStep(step: TemplateCreationStep): StudioStep {
  if (step === "font-check" || step === "font-upload") return 2;
  if (step === "slides-preview") return 3;
  if (step === "template-creation" || step === "completed") return 4;
  return 1;
}

function StudioTopBar({ activeStep }: { activeStep: StudioStep }) {
  return (
    <header className="pointer-events-none fixed inset-x-0 top-0 z-40 h-[72px] sm:h-[80px] 2xl:h-[96px] bg-gradient-to-b from-white via-white to-white/0">
      <div className="relative mx-auto flex h-full max-w-[1280px] 2xl:max-w-[1536px] items-center justify-between px-5 sm:px-8 2xl:px-[90px]">
        <a
          href="/dashboard"
          className="pointer-events-auto block h-8 w-8 sm:h-[34px] sm:w-[34px] 2xl:h-[44px] 2xl:w-[44px] shrink-0"
          aria-label="Dashboard"
        >
          <img
            src="/logo-with-bg.png"
            alt="Presenton"
            className="h-full w-full"
            draggable={false}
          />
        </a>

        <nav
          className="pointer-events-auto flex items-center"
          aria-label="Template Studio progress"
        >
          {studioSteps.map((step, index) => {
            const isActive = step.id === activeStep;
            return (
              <React.Fragment key={step.id}>
                <div className="flex items-center gap-1 sm:gap-1.5 2xl:gap-2">
                  <span
                    className={`flex h-5 w-5 sm:h-6 sm:w-6 2xl:h-7 2xl:w-7 items-center justify-center rounded-full border text-[10px] sm:text-[11px] 2xl:text-xs leading-none ${isActive
                      ? "border-black bg-black text-white"
                      : "border-[#E4E5EB] bg-white text-[#9B9CA3]"
                      }`}
                  >
                    {step.id}
                  </span>
                  <span
                    className={`hidden text-[10px] font-medium sm:inline sm:text-[11px] 2xl:text-xs ${isActive ? "text-black" : "text-[#9B9CA3]"}`}
                  >
                    {step.label}
                  </span>
                </div>
                {index < studioSteps.length - 1 ? (
                  <span className="mx-1.5 sm:mx-2 2xl:mx-2.5 h-px w-3 sm:w-[18px] 2xl:w-[22px] bg-[#E9EAF0]" />
                ) : null}
              </React.Fragment>
            );
          })}
        </nav>
      </div>
    </header>
  );
}

function StudioBottomAction({ children }: { children: React.ReactNode }) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-5 sm:bottom-6 2xl:bottom-8 z-30 flex justify-center px-4">
      <div className="pointer-events-auto w-full max-w-[260px] sm:max-w-[300px] 2xl:max-w-[380px]">
        {children}
      </div>
    </div>
  );
}

function GradientPillButton({
  children,
  onClick,
  disabled,
  className = "",
  mutedWhenDisabled = false,
  fullWidth = false,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  mutedWhenDisabled?: boolean;
  fullWidth?: boolean;
}) {
  const isMuted = mutedWhenDisabled && disabled;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex ${fullWidth ? "w-full" : ""} h-10 items-center justify-center gap-2 rounded-[58px] px-5 text-sm font-medium text-black shadow-none transition disabled:cursor-not-allowed ${isMuted
        ? "bg-[#ECECF1] text-[#5C5E68] disabled:opacity-100"
        : "disabled:opacity-60"
        } ${className}`}
      style={isMuted ? undefined : { background: pillGradient }}
    >
      {children}
    </button>
  );
}

function TemplateStudioTitle({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={`px-4 text-center ${compact ? "pt-[88px] sm:pt-[96px] 2xl:pt-[112px]" : "pt-[96px] sm:pt-[108px] 2xl:pt-[128px]"}`}
    >
      <h1 className="font-unbounded text-[36px] font-normal leading-none tracking-[-1.2px] text-[#101323] sm:text-[48px] sm:tracking-[-1.4px] md:text-[56px] 2xl:text-[68px] 2xl:tracking-[-1.8px]">
        Template Studio
      </h1>
      <p className="mx-auto mt-3 max-w-[480px] text-center font-syne text-[15px] font-normal leading-[1.4] text-[#101323CC] sm:mt-4 sm:max-w-[520px] sm:text-[16px] 2xl:mt-5 2xl:max-w-[600px] 2xl:text-[18px]">
        Upload your PPTX file to extract slides and convert them to a template
        which you can use to generate AI presentations.
      </p>
    </div>
  );
}

function UploadPanel({
  selectedFile,
  isProcessing,
  onFileInput,
  onFileDrop,
  onRemove,
  onStart,
}: {
  selectedFile: File | null;
  isProcessing: boolean;
  onFileInput: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onFileDrop: (file: File) => void;
  onRemove: () => void;
  onStart: () => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const dropInputRef = useRef<HTMLInputElement | null>(null);

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const file = event.dataTransfer.files?.[0];
    if (file) onFileDrop(file);
  };

  const handleGetStarted = () => {
    if (!selectedFile) {
      inputRef.current?.click();
      return;
    }
    onStart();
  };

  return (
    <main className="flex min-h-screen flex-col items-center bg-white font-syne">
      <TemplateStudioTitle />

      <section className="mt-8 w-full max-w-[640px] px-4 sm:mt-10 sm:max-w-[700px] 2xl:mt-12 2xl:max-w-[820px]">
        <div className="group relative">
          <div className="relative z-10 ml-8 2xl:ml-10 w-max rounded-t-[28px] 2xl:rounded-t-[32px] border border-b-0 border-[#EDEEF4] bg-white px-3 2xl:px-4 pb-2.5 2xl:pb-3 pt-2 2xl:pt-2.5">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="flex h-[34px] 2xl:h-[42px] items-center gap-1.5 2xl:gap-2 rounded-[80px] bg-white px-3.5 2xl:px-4 text-[12px] 2xl:text-sm font-semibold text-black shadow-[0_0_4px_rgba(0,0,0,0.06)]"
            >
              <Upload className="h-3.5 w-3.5 2xl:h-4 2xl:w-4 text-[#7A5AF8]" />
              Upload PPTX File
            </button>
            <input
              ref={inputRef}
              type="file"
              accept=".pptx"
              className="hidden"
              onChange={onFileInput}
            />
          </div>

          <div className="relative -mt-px rounded-[28px] 2xl:rounded-[32px] border border-[#EDEEF4] bg-white p-2.5 2xl:p-3 shadow-[0_0_16px_rgba(80,71,230,0.08)] transition-shadow duration-200 ">
            <div
              className={`relative h-[120px] 2xl:h-[150px] overflow-hidden rounded-[18px] 2xl:rounded-[22px] border border-[#E8E8EF] bg-white ${selectedFile ? "" : "cursor-pointer"
                }`}
              onDragOver={(event) => event.preventDefault()}
              onDrop={handleDrop}
              onClick={() => {
                if (!selectedFile) dropInputRef.current?.click();
              }}
            >
              <input
                ref={dropInputRef}
                type="file"
                accept=".pptx"
                onChange={onFileInput}
                className="hidden"
              />

              {selectedFile ? (
                <div className="relative flex h-full items-center ">
                  <div
                    className="flex  flex-1 h-full min-w-0 items-center rounded-[14px] bg-[#F6F6FA] px-5 transition-[width] duration-300"

                  >
                    <div className="min-w-0">
                      <p className="truncate text-base 2xl:text-lg font-medium text-[#20212A]">
                        {selectedFile.name}
                      </p>
                      <p className="mt-2 2xl:mt-2.5 text-sm 2xl:text-base text-[#777985]">
                        {isProcessing ? (
                          "Processing..."
                        ) : (
                          <>
                            {formatFileSize(selectedFile.size)}
                            <span className="px-2">•</span>
                            Ready
                          </>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="w-[64px] 2xl:w-[76px] h-full flex justify-center items-center px-3.5">

                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        onRemove();
                      }}
                      disabled={isProcessing}
                      className="w-[36px] h-[36px] 2xl:w-[44px] 2xl:h-[44px] top-1/2 z-20 flex items-center justify-center rounded-full border border-[#E8E8EF] bg-[#EFF0F4] text-black disabled:opacity-50"
                      aria-label="Remove file"
                    >
                      <X className="h-3.5 w-3.5 2xl:h-4 2xl:w-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex h-full flex-col py-[28px] 2xl:py-[36px] items-center justify-center">
                  <img
                    src="/upload_icon.png"
                    alt=""
                    className="h-[42px] w-[55px] 2xl:h-[52px] 2xl:w-[68px]"
                    draggable={false}
                  />
                  <p className="mt-3 2xl:mt-4 text-sm 2xl:text-base font-normal text-[#808080]">
                    Drag &amp; Drop your files here
                  </p>
                </div>
              )}
            </div>

            <div className="mt-3 flex items-center justify-end gap-3 px-1">
              <GradientPillButton
                onClick={handleGetStarted}
                disabled={isProcessing}
                className="h-9 px-5 text-xs font-semibold"
              >
                {isProcessing ? "Processing" : "Get Started"}
                {isProcessing ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5" />
                )}
              </GradientPillButton>
            </div>
          </div>
        </div>

        <ul className="mx-auto mt-6 2xl:mt-8 flex max-w-[480px] 2xl:max-w-[600px] items-center justify-between gap-5 2xl:gap-8">
          {["Test in Real Time", "Max 100MB", "5min Generation"].map((item) => (
            <li key={item} className="flex items-center gap-2 2xl:gap-2.5">
              <span className="h-2.5 w-2.5 2xl:h-3 2xl:w-3 rounded-full bg-[#EBE9FE]" />
              <span className="text-[13px] 2xl:text-[15px] font-normal text-[#3A3A3A]">{item}</span>
            </li>
          ))}
        </ul>
      </section>

      <div className="mt-auto w-full pb-5 2xl:pb-8 pt-12 2xl:pt-16">
        <div className="mx-auto flex max-w-[558px] 2xl:max-w-[700px] items-center gap-2 2xl:gap-3 rounded-[6px] bg-[#F4F7FB] px-3 2xl:px-4 py-2 2xl:py-2.5 text-[11px] 2xl:text-[13px] leading-tight text-[#505462]">
          <span className="flex h-[14px] w-[14px] 2xl:h-4 2xl:w-4 shrink-0 items-center justify-center rounded-full bg-[#0B4FBD] text-[10px] 2xl:text-[11px] font-bold text-white">
            i
          </span>
          <p>
            Presenton sends each slide as a screenshot and HTML reference. Use a
            vision-enabled model for accurate layouts. Text-only models may produce
            poor results or fail.
          </p>
        </div>
      </div>
    </main>
  );
}

function chipLabel(font: FontItem): string {
  return font.name || font.family_name || font.original_name || "Unknown font";
}

function uniqueFontChips(fontsData: FontData): FontItem[] {
  const seen = new Set<string>();
  return [...fontsData.available_fonts, ...fontsData.unavailable_fonts].filter((font) => {
    const key = chipLabel(font).toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function googleFontKey(family: string): string {
  return family.trim().toLowerCase();
}

function preferredFallbackFont(
  font: FontItem,
  googleFontOptions: GoogleFontOption[],
): GoogleFontOption | null {
  if (googleFontOptions.length === 0) return null;

  const byFamily = new Map(
    googleFontOptions.map((option) => [googleFontKey(option.family), option]),
  );
  const candidates = [
    font.family_name,
    font.original_name,
    "Poppins",
    "Inter",
    "Roboto",
  ];

  for (const candidate of candidates) {
    if (!candidate) continue;
    const option = byFamily.get(googleFontKey(candidate));
    if (option) return option;
  }

  return googleFontOptions[0] ?? null;
}

function FontFallbackPicker({
  fontName,
  options,
  selectedOption,
  disabled,
  onLoadOptions,
  onChange,
}: {
  fontName: string;
  options: GoogleFontOption[];
  selectedOption?: GoogleFontOption;
  disabled?: boolean;
  onLoadOptions: () => void;
  onChange: (option: GoogleFontOption) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [scrollTop, setScrollTop] = useState(0);
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setScrollTop(0);
    if (listRef.current) {
      listRef.current.scrollTop = 0;
    }
  }, [open]);

  const handleSelect = (option: GoogleFontOption) => {
    onChange(option);
    setOpen(false);
  };
  const normalizedQuery = query.trim().toLowerCase();
  const filteredOptions = useMemo(
    () =>
      normalizedQuery
        ? options.filter((option) =>
          option.family.toLowerCase().includes(normalizedQuery),
        )
        : options,
    [normalizedQuery, options],
  );
  const viewportRows = Math.min(
    Math.max(filteredOptions.length, 1),
    FONT_FALLBACK_MAX_VISIBLE_ROWS,
  );
  const viewportHeight =
    filteredOptions.length === 0 ? 80 : viewportRows * FONT_FALLBACK_OPTION_HEIGHT;
  const firstVisibleIndex = Math.max(
    0,
    Math.floor(scrollTop / FONT_FALLBACK_OPTION_HEIGHT) -
    FONT_FALLBACK_OVERSCAN_ROWS,
  );
  const visibleOptionCount =
    viewportRows + FONT_FALLBACK_OVERSCAN_ROWS * 2 + 1;
  const visibleOptions = filteredOptions.slice(
    firstVisibleIndex,
    firstVisibleIndex + visibleOptionCount,
  );

  useEffect(() => {
    setScrollTop(0);
    if (listRef.current) {
      listRef.current.scrollTop = 0;
    }
  }, [normalizedQuery]);

  useEffect(() => {
    if (!open || normalizedQuery.length === 0) return;
    onLoadOptions();
  }, [normalizedQuery, onLoadOptions, open]);

  const handleListScroll = (event: React.UIEvent<HTMLDivElement>) => {
    const target = event.currentTarget;
    setScrollTop(target.scrollTop);

    const distanceToBottom =
      target.scrollHeight - target.scrollTop - target.clientHeight;
    if (distanceToBottom < FONT_FALLBACK_OPTION_HEIGHT * 2) {
      onLoadOptions();
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label={`Fallback font for ${fontName}`}
          disabled={disabled}
          className="h-11 w-full justify-between rounded-lg border-[#DADDE6] bg-white px-3 font-syne text-sm font-medium text-[#282A32] shadow-none hover:border-[#B8BCC8] hover:bg-white"
        >
          <span className="min-w-0 truncate">
            {selectedOption?.family ?? "Choose fallback"}
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 text-[#61646F]" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="z-[100] w-[var(--radix-popover-trigger-width)] overflow-hidden rounded-xl border-[#E4E6EE] bg-white p-0 shadow-[0_18px_45px_rgba(16,24,40,0.14)]"
      >
        <Command shouldFilter={false}>
          <CommandInput
            value={query}
            onValueChange={setQuery}
            placeholder="Search fonts"
            className="font-syne text-sm"
          />
          <CommandList
            ref={listRef}
            className="overflow-y-auto overflow-x-hidden"
            style={{ height: viewportHeight }}
            onScroll={handleListScroll}
          >
            {filteredOptions.length === 0 ? (
              <CommandEmpty>
                {options.length === 0 ? "Loading fonts..." : "No fonts found"}
              </CommandEmpty>
            ) : (
              <CommandGroup
                className="relative p-1"
                style={{
                  height: filteredOptions.length * FONT_FALLBACK_OPTION_HEIGHT,
                }}
              >
                {visibleOptions.map((option, offset) => {
                  const optionIndex = firstVisibleIndex + offset;
                  const isSelected = option.family === selectedOption?.family;
                  return (
                    <CommandItem
                      key={option.family}
                      value={option.family}
                      onSelect={() => handleSelect(option)}
                      className="absolute left-1 right-1 h-10 cursor-pointer justify-between rounded-lg px-3 font-syne text-sm font-medium text-[#242630] data-[selected=true]:bg-[#F6F5FF]"
                      style={{
                        top: optionIndex * FONT_FALLBACK_OPTION_HEIGHT + 4,
                      }}
                    >
                      <span className="min-w-0 truncate">{option.family}</span>
                      {isSelected ? (
                        <Check className="h-4 w-4 shrink-0 text-[#5146E5]" />
                      ) : (
                        <span className="shrink-0 text-xs font-semibold text-[#8B8E99]">
                          Aa
                        </span>
                      )}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function AnalyzePanel({
  fontsData,
  uploadedFonts,
  isUploading,
  uploadFont,
  googleFontOptions,
  selectedFallbackFonts,
  onFallbackFontChange,
  onLoadGoogleFontOptions,
  onContinue,
  isAutoContinuing = false,
}: {
  fontsData: FontData | null;
  uploadedFonts: UploadedFont[];
  isUploading: boolean;
  uploadFont: (fontName: string, file: File) => string | null;
  googleFontOptions: GoogleFontOption[];
  selectedFallbackFonts: Record<string, GoogleFontOption>;
  onFallbackFontChange: (fontName: string, option: GoogleFontOption) => void;
  onLoadGoogleFontOptions: () => void;
  onContinue: () => void;
  isAutoContinuing?: boolean;
}) {
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [resolvingFont, setResolvingFont] = useState<FontItem | null>(null);
  const missingFonts = fontsData?.unavailable_fonts ?? [];
  const fontChips = fontsData ? uniqueFontChips(fontsData) : [];
  const missingFontsByKey = new Map(
    missingFonts.map((font) => [chipLabel(font).toLowerCase(), font]),
  );

  const uploadedFontNames = new Set(uploadedFonts.map((font) => font.fontName));
  const pendingMissingCount = missingFonts.filter(
    (font) => !uploadedFontNames.has(font.name),
  ).length;
  const allFontsAvailable = Boolean(fontsData) && missingFonts.length === 0;
  const allMissingFontsResolved =
    missingFonts.length > 0 && pendingMissingCount === 0;
  const fontAnalysisNotice = fontsData
    ? allFontsAvailable
      ? {
        tone: "success",
        title: "All fonts are available",
        description: "Preparing the slide preview automatically.",
      }
      : allMissingFontsResolved
        ? {
          tone: "success",
          title: "Missing fonts resolved",
          description: "All required font files are attached. Continue to preview.",
        }
        : {
          tone: "warning",
          title: `${pendingMissingCount} font${pendingMissingCount === 1 ? "" : "s"} need attention`,
          description:
            "Upload exact font files or keep the selected fallback fonts before continuing.",
        }
    : null;

  const handleFontFile = (fontName: string, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    uploadFont(fontName, file);
    event.target.value = "";
  };
  const resolvingFontName = resolvingFont?.name ?? "";
  const resolvingFontUploaded = resolvingFontName
    ? uploadedFontNames.has(resolvingFontName)
    : false;
  const resolvingFallback = resolvingFontName
    ? selectedFallbackFonts[resolvingFontName]
    : undefined;

  return (
    <main className="flex min-h-screen flex-col bg-white px-4 pb-28 font-syne sm:px-6 sm:pb-32 2xl:px-10 2xl:pb-36">
      <TemplateStudioTitle compact />
      <section className="mx-auto mt-8 w-full max-w-[600px] sm:mt-10 2xl:mt-12 2xl:max-w-[900px]">




        <div className="relative z-10 ml-8 2xl:ml-10 w-max rounded-t-[28px] 2xl:rounded-t-[32px] border border-b-0 border-[#EDEEF4] bg-white px-3 2xl:px-4 pb-2.5 2xl:pb-3 pt-2 2xl:pt-2.5">
          <button
            type="button"
            onClick={() => {
              const firstMissing = missingFonts[0];
              if (firstMissing) setResolvingFont(firstMissing);
            }}
            className="flex h-[34px] 2xl:h-[42px] items-center gap-1.5 2xl:gap-2 rounded-[80px] bg-white px-3.5 2xl:px-4 text-[12px] 2xl:text-sm font-semibold text-black shadow-[0_0_4px_rgba(0,0,0,0.06)]"
          >
            <Upload className="h-3.5 w-3.5 2xl:h-4 2xl:w-4 text-[#7A5AF8]" />
            Fonts Upload
          </button>
        </div>

        <div className="relative -mt-px rounded-[28px] w-full  2xl:rounded-[32px] border border-[#EDEEF4] bg-white p-5 2xl:p-3 shadow-[0_0_16px_rgba(80,71,230,0.08)] transition-shadow duration-200 ">
          {fontAnalysisNotice ? (
            <div
              className={`mb-5 flex items-start gap-3 rounded-[16px] border px-4 py-3 ${fontAnalysisNotice.tone === "success"
                ? "border-[#BBF7D0] bg-[#F0FDF4]"
                : "border-[#FDE68A] bg-[#FFFBEB]"
                }`}
            >
              <span
                className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${fontAnalysisNotice.tone === "success"
                  ? "bg-[#DCFCE7] text-[#16A34A]"
                  : "bg-[#FEF3C7] text-[#D97706]"
                  }`}
              >
                {fontAnalysisNotice.tone === "success" ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  <AlertTriangle className="h-3.5 w-3.5" />
                )}
              </span>
              <div className="min-w-0">
                <p
                  className={`text-sm font-semibold ${fontAnalysisNotice.tone === "success"
                    ? "text-[#166534]"
                    : "text-[#92400E]"
                    }`}
                >
                  {fontAnalysisNotice.title}
                </p>
                <p
                  className={`mt-1 text-xs leading-[1.45] ${fontAnalysisNotice.tone === "success"
                    ? "text-[#237A50]"
                    : "text-[#9A5A08]"
                    }`}
                >
                  {fontAnalysisNotice.description}
                </p>
              </div>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-3 pt-2 min-h-[140px] ">
            {fontChips.length > 0 ? (
              fontChips.map((font, index) => {
                const label = chipLabel(font);
                const missingFont = missingFontsByKey.get(label.toLowerCase());
                const isMissing = Boolean(missingFont);
                const isUploaded = missingFont
                  ? uploadedFontNames.has(missingFont.name)
                  : false;
                return (
                  <button
                    key={`${font.name}-${index}`}
                    type="button"
                    disabled={!missingFont || isUploading}
                    onClick={() => {
                      if (missingFont) setResolvingFont(missingFont);
                    }}
                    className={`relative flex   h-[59px] items-center justify-center rounded-xl border px-4 text-center text-sm font-semibold transition ${isMissing
                      ? isUploaded
                        ? "border-[#CFEBDD] bg-[#F4FBF7] text-[#236C4A] hover:border-[#9FD7BA]"
                        : "border-[#F3C78F] bg-[#FFF8F1] text-[#D12B1F] hover:border-[#E8AA5D]"
                      : "border-[#E8EAF0] bg-white text-[#171821]"
                      } disabled:cursor-default`}
                    title={label}
                  >
                    <span className="line-clamp-2 text-xs">{label}</span>
                    {isMissing ? (
                      <span className="absolute -right-2 -top-2 flex h-[26px] w-[46px] items-center justify-center rounded-full border border-[#EDEEEF] bg-white text-[#171821] shadow-sm">
                        {isUploaded ? (
                          <Check className="h-3.5 w-3.5 text-[#237A50]" />
                        ) : (
                          <Upload className="h-3.5 w-3.5" />
                        )}
                      </span>
                    ) : null}

                  </button>
                );
              })
            ) : (
              <div className="col-span-full flex min-h-[140px] items-center justify-center rounded-xl border border-[#E8EAF0] bg-white text-sm font-medium text-[#686C78]">
                No fonts detected
              </div>
            )}
          </div>

          <div className="mt-6 flex justify-end px-1 pb-1">
            <GradientPillButton
              onClick={onContinue}
              disabled={isUploading || isAutoContinuing}
              className="h-9 min-w-[120px] px-6 text-sm font-semibold"
            >
              {isUploading || isAutoContinuing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {isAutoContinuing ? "Preparing..." : "Creating..."}
                </>
              ) : (
                <>
                  Continue
                  <ChevronRight className="h-4 w-4" />
                </>
              )}
            </GradientPillButton>
          </div>
        </div>

        {resolvingFont ? (
          <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/35 px-4 font-syne">
            <div className="relative w-full max-w-[550px] rounded-2xl bg-white shadow-[0_22px_70px_rgba(16,24,40,0.22)]">
              <button
                type="button"
                onClick={() => setResolvingFont(null)}
                aria-label="Close"
                className="absolute -right-14 top-0 flex h-11 w-11 items-center justify-center rounded-full bg-white text-[#20222B] shadow-sm"
              >
                <X className="h-6 w-6" />
              </button>

              <div className="flex items-center justify-between gap-4 border-b border-[#EEF0F5] px-5 py-4">
                <div className="min-w-0">
                  <h3 className=" text-lg font-semibold text-[#191919]">
                    Resolve Missing Font
                  </h3>
                  <p className="mt-1 text-xs text-[#808080]">
                    {resolvingFontName} is missing.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setResolvingFont(null)}
                  className="h-9 rounded-full px-5 text-sm font-medium text-black"
                  style={{ background: pillGradient }}
                >
                  Save
                </button>
              </div>

              <div className="space-y-4 px-5 py-4">
                <div>
                  <p className="mb-2 text-xs font-semibold text-[#30323A]">
                    Upload original font file
                  </p>
                  <input
                    ref={(node) => {
                      fileInputRefs.current[resolvingFontName] = node;
                    }}
                    type="file"
                    accept=".ttf,.otf,.woff,.woff2,.eot"
                    className="hidden"
                    onChange={(event) => handleFontFile(resolvingFontName, event)}
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRefs.current[resolvingFontName]?.click()}
                    disabled={isUploading}
                    className="flex h-[78px] w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-[#DADDE6] bg-white text-sm font-medium text-[#606470] transition hover:border-[#B8BCC8] hover:bg-[#FAFBFC] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#F3EFFF] text-[#7A3DF0]">
                      {resolvingFontUploaded ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <Upload className="h-4 w-4" />
                      )}
                    </span>
                    {resolvingFontUploaded ? "Font file uploaded" : "Upload .ttf / .otf"}
                  </button>
                </div>

                <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3">
                  <span className="h-px bg-[#EEF0F5]" />
                  <span className="text-xs font-medium text-[#686C78]">or</span>
                  <span className="h-px bg-[#EEF0F5]" />
                </div>

                <div>
                  <p className="mb-2 text-xs font-semibold text-[#30323A]">
                    Fallback font
                  </p>
                  <FontFallbackPicker
                    fontName={resolvingFontName}
                    options={googleFontOptions}
                    selectedOption={resolvingFallback}
                    disabled={isUploading}
                    onLoadOptions={onLoadGoogleFontOptions}
                    onChange={(option) =>
                      onFallbackFontChange(resolvingFontName, option)
                    }
                  />
                </div>
              </div>
            </div>
          </div>
        ) : null}

      </section>

      <div className="mt-auto w-full pb-5 pt-12 2xl:pb-8 2xl:pt-16">
        <div className="mx-auto flex max-w-[558px] items-center gap-2 rounded-[6px] bg-[#F4F7FB] px-3 py-2 text-[11px] leading-tight text-[#505462] 2xl:max-w-[700px] 2xl:px-4 2xl:py-2.5 2xl:text-[13px]">
          <span className="flex h-[14px] w-[14px] shrink-0 items-center justify-center rounded-full bg-[#0B4FBD] text-[10px] font-bold text-white 2xl:h-4 2xl:w-4 2xl:text-[11px]">
            i
          </span>
          <p>
            Exact font files maintain typography and spacing. Fallback fonts may
            slightly change the layout and text wrapping.
          </p>
        </div>
      </div>
    </main>
  );
}

const SLIDE_WIDTH = EDITOR_STAGE_WIDTH;
const SLIDE_HEIGHT = EDITOR_STAGE_HEIGHT;

function ResponsiveSlideViewport({
  children,
  className = "",
  fitToAvailableHeight = false,
  bottomReserve = 0,
}: {
  children: React.ReactNode;
  className?: string;
  fitToAvailableHeight?: boolean;
  bottomReserve?: number;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [bounds, setBounds] = useState({ width: 0, maxHeight: 0 });

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    const updateBounds = () => {
      const rect = node.getBoundingClientRect();
      const maxHeight = fitToAvailableHeight
        ? Math.max(160, window.innerHeight - rect.top - bottomReserve)
        : 0;
      setBounds({ width: node.clientWidth, maxHeight });
    };
    updateBounds();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", updateBounds);
      return () => window.removeEventListener("resize", updateBounds);
    }

    const observer = new ResizeObserver(updateBounds);
    observer.observe(node);
    window.addEventListener("resize", updateBounds);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateBounds);
    };
  }, [bottomReserve, fitToAvailableHeight]);

  const widthScale =
    bounds.width > 0 ? (bounds.width / SLIDE_WIDTH) * 0.98 : 0;
  const heightScale =
    fitToAvailableHeight && bounds.maxHeight > 0
      ? bounds.maxHeight / SLIDE_HEIGHT
      : 1;
  const scale = widthScale > 0 ? Math.min(widthScale, heightScale, 1) : 0;

  return (
    <div
      ref={containerRef}
      className={`relative mx-auto w-full max-w-[1280px] ${className}`}
    >
      <div
        className="relative mx-auto overflow-hidden"
        style={{
          width: scale > 0 ? SLIDE_WIDTH * scale : "100%",
          height: scale > 0 ? SLIDE_HEIGHT * scale : undefined,
          aspectRatio: scale > 0 ? undefined : "16 / 9",
        }}
      >
        <div
          className="absolute left-0 top-0"
          style={{
            width: SLIDE_WIDTH,
            height: SLIDE_HEIGHT,
            transformOrigin: "top left",
            transform: scale > 0 ? `scale(${scale})` : undefined,
          }}
        >
          {scale > 0 ? children : null}
        </div>
      </div>
    </div>
  );
}

function KonvaLayoutSlide({
  layout,
  fonts,
  slideKey,
  className = "border border-[#E8E8EF] bg-white shadow-[0_2px_16px_rgba(16,24,40,0.06)]",
}: {
  layout: TemplateV2Layout;
  fonts?: Record<string, string>;
  slideKey: string;
  className?: string;
}) {
  return (
    <ResponsiveSlideViewport className={className}>
      <TemplateV2LayoutPreview
        key={slideKey}
        layout={layout}
        fonts={fonts}
        useKonvaRenderer
      />
    </ResponsiveSlideViewport>
  );
}

function GeneratingSlidesOverlay() {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-6 z-20 flex justify-center sm:bottom-8">
      <span className="relative z-20 flex items-center overflow-hidden rounded-[50px] bg-white px-4 py-2.5 text-sm font-medium text-[#666666] shadow-[0_2px_12px_rgba(16,24,40,0.08)]">
        <span aria-hidden className="generating-slides-background absolute" />
        <span className="relative z-10 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-[#9034EA]" />
          Updating slides...
        </span>
      </span>
    </div>
  );
}

function EmptyGeneratingSlide() {
  return (
    <ResponsiveSlideViewport className="border border-[#E8E8EF] bg-white shadow-[0_2px_16px_rgba(16,24,40,0.06)]">
      <div className="relative h-full w-full bg-white">
        <GeneratingSlidesOverlay />
      </div>
    </ResponsiveSlideViewport>
  );
}

function ScaledScreenshotSlide({
  src,
  alt,
  fitToAvailableHeight = false,
  bottomReserve,
}: {
  src: string;
  alt: string;
  fitToAvailableHeight?: boolean;
  bottomReserve?: number;
}) {
  return (
    <ResponsiveSlideViewport
      className="border border-[#E8E8EF] bg-white shadow-[0_2px_16px_rgba(16,24,40,0.06)]"
      fitToAvailableHeight={fitToAvailableHeight}
      bottomReserve={bottomReserve}
    >
      <img
        src={resolveBackendAssetUrl(src)}
        alt={alt}
        className="block h-full w-full"
        draggable={false}
      />
    </ResponsiveSlideViewport>
  );
}

function ThumbnailStrip({
  slides,
  urls,
  selectedIndex,
  onSelect,
  bottomOffset = "bottom-[88px] sm:bottom-[96px] 2xl:bottom-[104px]",
}: {
  slides?: ProcessedSlide[];
  urls?: string[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  bottomOffset?: string;
}) {
  const count = slides?.length ?? urls?.length ?? 0;
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollState = useCallback(() => {
    const node = scrollRef.current;
    if (!node) {
      setCanScrollLeft(false);
      setCanScrollRight(false);
      return;
    }

    const maxScrollLeft = node.scrollWidth - node.clientWidth;
    const isOverflowing = maxScrollLeft > 1;
    setCanScrollLeft(isOverflowing && node.scrollLeft > 1);
    setCanScrollRight(isOverflowing && node.scrollLeft < maxScrollLeft - 1);
  }, []);

  useEffect(() => {
    updateScrollState();

    const node = scrollRef.current;
    if (!node) return;

    node.addEventListener("scroll", updateScrollState, { passive: true });
    window.addEventListener("resize", updateScrollState);

    const observer =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(updateScrollState)
        : null;
    observer?.observe(node);

    return () => {
      node.removeEventListener("scroll", updateScrollState);
      window.removeEventListener("resize", updateScrollState);
      observer?.disconnect();
    };
  }, [count, updateScrollState]);

  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    node.scrollLeft = 0;
    updateScrollState();
  }, [count, updateScrollState]);

  const scrollThumbnails = useCallback(
    (direction: -1 | 1) => {
      const node = scrollRef.current;
      if (!node) return;

      const distance = Math.max(180, node.clientWidth * 0.72);
      node.scrollBy({ left: direction * distance, behavior: "smooth" });
      window.setTimeout(updateScrollState, 260);
    },
    [updateScrollState],
  );

  return (
    <div
      className={`fixed ${bottomOffset} inset-x-0 z-20 flex justify-center px-4 sm:px-8`}
    >
      <div className="relative flex w-full max-w-[1280px] justify-center">
        <button
          type="button"
          onClick={() => scrollThumbnails(-1)}
          aria-label="Scroll thumbnails left"
          className={`absolute left-0 top-1/2 z-10 flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-[#E6E7ED] bg-white/95 text-black shadow-[0_2px_10px_rgba(16,24,40,0.14)] transition sm:h-9 sm:w-9 ${canScrollLeft ? "opacity-100" : "pointer-events-none opacity-0"}`}
        >
          <ChevronLeft className="h-4 w-4 sm:h-5 sm:w-5" />
        </button>
        <div
          ref={scrollRef}
          className="hide-scrollbar flex w-max max-w-full items-center gap-2 overflow-x-auto overscroll-x-contain rounded-[8px] px-1 pb-3 pt-1 [-webkit-overflow-scrolling:touch] sm:gap-3 2xl:gap-4"
        >
          {Array.from({ length: count }, (_, index) => {
            const slide = slides?.[index];
            const url = urls?.[index] ?? slide?.screenshot_url;
            const isReady = slide
              ? Boolean(slide.processed && !slide.processing && slide.v2Layout)
              : Boolean(url);
            const isSelected = selectedIndex === index;

            return (
              <button
                key={`thumb-${index}`}
                type="button"
                data-slide-thumbnail-index={index}
                onClick={() => onSelect(index)}
                className={`relative aspect-video w-[76px] shrink-0 overflow-visible rounded-[5px] border bg-white p-0 transition sm:w-[86px] sm:rounded-[6px] 2xl:w-[96px] ${isSelected ? "border-[#D9D9E2] ring-1 ring-[#D9D9E2]" : "border-[#ECECF2]"
                  }`}
              >
                {isReady && url ? (
                  <img
                    src={resolveBackendAssetUrl(url)}
                    alt={`Slide ${index + 1}`}
                    className="h-full w-full rounded-[5px] object-cover sm:rounded-[6px]"
                    draggable={false}
                  />
                ) : (
                  <div className="h-full w-full rounded-[5px] bg-white sm:rounded-[6px]" />
                )}
                <span className="absolute -bottom-1.5 -left-1.5 flex h-4 w-4 items-center justify-center rounded-full border border-[#E6E7ED] bg-white text-[9px] text-black shadow-sm sm:-bottom-2 sm:-left-2 sm:h-5 sm:w-5 sm:text-[10px]">
                  {index + 1}
                </span>
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={() => scrollThumbnails(1)}
          aria-label="Scroll thumbnails right"
          className={`absolute right-0 top-1/2 z-10 flex h-8 w-8 translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-[#E6E7ED] bg-white/95 text-black shadow-[0_2px_10px_rgba(16,24,40,0.14)] transition sm:h-9 sm:w-9 ${canScrollRight ? "opacity-100" : "pointer-events-none opacity-0"}`}
        >
          <ChevronRight className="h-4 w-4 sm:h-5 sm:w-5" />
        </button>
      </div>
    </div>
  );
}

function hasRenderableKonvaLayout(
  slide: ProcessedSlide | undefined,
): slide is ProcessedSlide & { v2Layout: TemplateV2Layout } {
  return Boolean(slide?.v2Layout && slide.processed && !slide.processing);
}

function ReviewSlideCanvas({
  slide,
  fonts,
  isGenerating = false,
}: {
  slide: ProcessedSlide | undefined;
  fonts?: Record<string, string>;
  isGenerating?: boolean;
}) {
  if (hasRenderableKonvaLayout(slide)) {
    return (
      <KonvaLayoutSlide
        layout={slide.v2Layout}
        fonts={fonts}
        slideKey={`${slide.slide_number}-${slide.v2Layout.id ?? slide.layout_id ?? "layout"}`}
      />
    );
  }

  if (isGenerating) {
    return <EmptyGeneratingSlide />;
  }

  if (!slide) {
    return (
      <ResponsiveSlideViewport className="border border-[#E8E8EF] bg-white">
        <div className="h-full w-full bg-white" />
      </ResponsiveSlideViewport>
    );
  }

  if (slide.screenshot_url) {
    return (
      <ScaledScreenshotSlide
        src={slide.screenshot_url}
        alt={`Slide ${slide.slide_number}`}
      />
    );
  }

  return (
    <ResponsiveSlideViewport className="border border-[#E8E8EF] bg-[#F7F7FA]">
      <div className="flex h-full w-full items-center justify-center text-sm text-[#777985] 2xl:text-base">
        {slide.processing ? "Generating slide..." : "Slide unavailable"}
      </div>
    </ResponsiveSlideViewport>
  );
}

function SelectionHandles() {
  const handleClass =
    "absolute z-20 h-[13px] w-[13px] rounded-full border border-[#D9DAE2] bg-white shadow-[0_1px_4px_rgba(16,24,40,0.18)]";
  const sideClass =
    "absolute z-20 rounded-[3px] border border-[#E4E4EA] bg-white shadow-[0_1px_4px_rgba(16,24,40,0.14)]";

  return (
    <>
      <span className={`${handleClass} -left-[7px] -top-[7px]`} />
      <span className={`${handleClass} -right-[7px] -top-[7px]`} />
      <span className={`${handleClass} -bottom-[7px] -left-[7px]`} />
      <span className={`${handleClass} -bottom-[7px] -right-[7px]`} />
      <span className={`${sideClass} left-1/2 top-[-4px] h-2 w-4 -translate-x-1/2`} />
      <span className={`${sideClass} bottom-[-4px] left-1/2 h-2 w-4 -translate-x-1/2`} />
      <span className={`${sideClass} left-[-4px] top-1/2 h-4 w-2 -translate-y-1/2`} />
      <span className={`${sideClass} right-[-4px] top-1/2 h-4 w-2 -translate-y-1/2`} />
    </>
  );
}

function PreviewPanel({
  previewUrls,
  selectedIndex,
  onSelect,
}: {
  previewUrls: string[];
  selectedIndex: number;
  onSelect: (index: number) => void;
}) {
  const selectedUrl = previewUrls[selectedIndex] ?? previewUrls[0];

  return (
    <main className="h-screen overflow-hidden bg-white px-4 pt-[80px] font-syne sm:px-6 sm:pt-[92px] 2xl:px-10 2xl:pt-[104px]">
      <div className="relative mx-auto w-full max-w-[1280px]">
        {selectedUrl ? (
          <ScaledScreenshotSlide
            src={selectedUrl}
            alt={`Slide ${selectedIndex + 1}`}
            fitToAvailableHeight
            bottomReserve={176}
          />
        ) : (
          <ResponsiveSlideViewport
            className="border border-[#E8E8EF] bg-[#F7F7FA]"
            fitToAvailableHeight
            bottomReserve={176}
          >
            <div className="flex h-full w-full items-center justify-center text-sm text-[#777985] 2xl:text-base">
              Preview unavailable
            </div>
          </ResponsiveSlideViewport>
        )}
      </div>

      <ThumbnailStrip urls={previewUrls} selectedIndex={selectedIndex} onSelect={onSelect} />
    </main>
  );
}

function ReviewPanel({
  slides,
  selectedIndex,
  onSelect,
  retrySlide,
  setSlides,
  fonts,
  enableEditing = false,
  isGenerating = false,
}: {
  slides: ProcessedSlide[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  retrySlide: (index: number) => void;
  setSlides: React.Dispatch<React.SetStateAction<ProcessedSlide[]>>;
  fonts?: Record<string, string>;
  enableEditing?: boolean;
  isGenerating?: boolean;
}) {
  const selectedSlide = slides[selectedIndex] ?? slides[0];
  const isReady =
    Boolean(selectedSlide?.processed && !selectedSlide.processing && selectedSlide.v2Layout) ||
    Boolean(selectedSlide?.screenshot_url && selectedSlide?.processed);

  const handleDelete = () => {
    if (!selectedSlide) return;
    setSlides((current) => current.filter((_, index) => index !== selectedIndex));
    onSelect(Math.max(0, selectedIndex - 1));
  };

  return (
    <main className="min-h-screen bg-white px-4 pb-44 pt-[80px] font-syne sm:px-6 sm:pb-48 sm:pt-[92px] 2xl:px-10 2xl:pb-52 2xl:pt-[104px]">
      <div className="relative mx-auto w-full max-w-[1280px]">
        <div
          className={`relative ${enableEditing ? "" : ""}`}
        >
          {enableEditing ? (
            <div className="relative border border-[#7A5AF8] bg-white shadow-[0_2px_16px_rgba(16,24,40,0.08)]">
              <SelectionHandles />
              <div className="absolute left-1/2 top-2 z-30 -translate-x-1/2 rounded-[5px] border border-[#E6E7EC] bg-white px-2 py-1.5 shadow-[0_4px_12px_rgba(16,24,40,0.12)] sm:top-3 2xl:px-3 2xl:py-2">
                <div className="flex items-center gap-1 2xl:gap-1.5">
                  <button
                    type="button"
                    onClick={() => retrySlide(selectedIndex)}
                    disabled={!selectedSlide || selectedSlide.processing}
                    className="h-8 rounded-[4px] px-2.5 text-[12px] font-medium text-black transition hover:bg-[#F6F6F9] disabled:cursor-not-allowed disabled:opacity-50 2xl:h-9 2xl:px-3 2xl:text-sm"
                  >
                    Re-Construct
                  </button>
                  <span className="h-6 w-px bg-[#E8E8EE] 2xl:h-7" />
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={!isReady}
                    className="flex h-8 w-8 items-center justify-center rounded-[4px] text-black transition hover:bg-[#F6F6F9] disabled:cursor-not-allowed disabled:opacity-50 2xl:h-9 2xl:w-9"
                    aria-label="Delete slide"
                  >
                    <Trash2 className="h-4 w-4 2xl:h-[18px] 2xl:w-[18px]" />
                  </button>
                </div>
              </div>
              <ReviewSlideCanvas slide={selectedSlide} fonts={fonts} isGenerating={false} />
            </div>
          ) : (
            <ReviewSlideCanvas
              slide={selectedSlide}
              fonts={fonts}
              isGenerating={isGenerating}
            />
          )}
        </div>
      </div>

      <ThumbnailStrip
        slides={slides}
        selectedIndex={selectedIndex}
        onSelect={onSelect}
      />
    </main>
  );
}

function SaveTemplateModal({
  isOpen,
  defaultName,
  isSaving,
  title = "Save Template",
  subtitle = "Give your template a name.",
  submitLabel = "Save",
  onClose,
  onSave,
}: {
  isOpen: boolean;
  defaultName: string;
  isSaving: boolean;
  title?: string;
  subtitle?: string;
  submitLabel?: string;
  onClose: () => void;
  onSave: (name: string, description: string) => Promise<void>;
}) {
  const [name, setName] = useState(defaultName);
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (isOpen) {
      setName(defaultName);
      setDescription("");
    }
  }, [defaultName, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = () => {
    const trimmedName = name.trim();
    if (!trimmedName) return;
    void onSave(trimmedName, description.trim());
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/30 px-4 2xl:px-6 font-syne">
      <div className="relative w-full max-w-[512px] 2xl:max-w-[600px] rounded-[14px] 2xl:rounded-[16px] bg-white shadow-[0_18px_55px_rgba(16,24,40,0.18)]">
        <button
          type="button"
          onClick={onClose}
          disabled={isSaving}
          aria-label="Close"
          className="absolute -right-[54px] 2xl:-right-[62px] top-0 flex h-[46px] w-[46px] 2xl:h-[52px] 2xl:w-[52px] items-center justify-center rounded-full bg-white text-black shadow-sm disabled:opacity-50"
        >
          <X className="h-6 w-6 2xl:h-7 2xl:w-7" />
        </button>
        <div className="flex h-[74px] 2xl:h-[84px] items-center justify-between border-b border-[#EDEEF3] px-5 2xl:px-6">
          <div>
            <h2 className="text-[16px] 2xl:text-lg font-medium text-black">{title}</h2>
            <p className="mt-1 text-[11px] 2xl:text-[13px] text-[#7E818C]">{subtitle}</p>
          </div>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSaving || !name.trim()}
            className="inline-flex h-8 2xl:h-9 min-w-[78px] 2xl:min-w-[88px] items-center justify-center rounded-[58px] px-5 2xl:px-6 text-[13px] 2xl:text-sm font-medium text-black disabled:cursor-not-allowed disabled:opacity-60"
            style={{ background: pillGradient }}
          >
            {isSaving ? <Loader2 className="h-4 w-4 2xl:h-5 2xl:w-5 animate-spin" /> : submitLabel}
          </button>
        </div>

        <div className="space-y-4 2xl:space-y-5 px-[18px] 2xl:px-6 pb-[18px] 2xl:pb-6 pt-5 2xl:pt-6">
          <label className="block">
            <span className="mb-2 2xl:mb-2.5 block text-[12px] 2xl:text-sm font-medium text-[#25272F]">
              Template Name
            </span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              disabled={isSaving}
              placeholder="e.g. Modern Tech Pitch Deck"
              className="h-9 2xl:h-10 w-full rounded-[5px] border border-[#E1E2E8] bg-white px-3 2xl:px-4 text-[13px] 2xl:text-[15px] text-black outline-none placeholder:text-[#8C8E96] focus:border-[#B9ABFF]"
            />
          </label>
          <label className="block">
            <span className="mb-2 2xl:mb-2.5 block text-[12px] 2xl:text-sm font-medium text-[#25272F]">
              Description
            </span>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              disabled={isSaving}
              placeholder="Briefly describe when or how this template should be used."
              rows={4}
              className="h-[86px] 2xl:h-[100px] w-full resize-none rounded-[5px] border border-[#E1E2E8] bg-white px-3 2xl:px-4 py-3 2xl:py-3.5 text-[13px] 2xl:text-[15px] text-black outline-none placeholder:text-[#8C8E96] focus:border-[#B9ABFF]"
            />
          </label>
        </div>
      </div>
    </div>
  );
}

const CustomTemplatePage = () => {
  const router = useRouter();
  const llmConfig = useSelector((state: RootState) => state.userConfig.llm_config);
  const [reviewSlideIndex, setReviewSlideIndex] = useState(0);
  const [templateModalMode, setTemplateModalMode] = useState<"create" | "save" | null>(null);
  const [isSubmittingTemplate, setIsSubmittingTemplate] = useState(false);
  const [googleFontOptions, setGoogleFontOptions] =
    useState<GoogleFontOption[]>(GOOGLE_FONT_OPTIONS);
  const [selectedFallbackFonts, setSelectedFallbackFonts] = useState<
    Record<string, GoogleFontOption>
  >({});
  const [isAutoPreviewQueued, setIsAutoPreviewQueued] = useState(false);
  const googleFontLoadStartedRef = useRef(false);
  const autoPreviewStartedRef = useRef(false);

  const {
    selectedFile,
    handleFileSelect,
    handleRawFileSelect,
    removeFile,
  } = useFileUpload();

  const {
    state,
    uploadedFonts,
    slides,
    setSlides,
    checkFonts,
    uploadFont,
    fontUploadAndPreview,
    retrySlide,
  } = useTemplateCreation();

  const defaultTemplateName = getDefaultTemplateName(selectedFile) || "Untitled Template";
  const activeStep = activeStudioStep(state.step);
  const showUpload = state.step === "file-upload";
  const showAnalyze = state.step === "font-check" || state.step === "font-upload";
  const previewUrls = state.previewData?.slide_image_urls ?? [];
  const showPreview = state.step === "slides-preview" && previewUrls.length > 0;
  const showReview =
    (state.step === "template-creation" || state.step === "completed") && slides.length > 0;
  const isFinalReview = state.step === "completed";
  const isGenerating = state.step === "template-creation";
  const allCheckedFontsAvailable =
    Boolean(state.fontsData) && (state.fontsData?.unavailable_fonts.length ?? 0) === 0;
  const generatedSlidesReady =
    isFinalReview && slides.some((slide) => slide.processed && !slide.error);
  const isTemplateModalOpen = templateModalMode !== null;
  const isCreateTemplateModal = templateModalMode === "create";

  const missingFonts = useMemo(
    () => state.fontsData?.unavailable_fonts ?? [],
    [state.fontsData],
  );
  const uploadedFontNames = useMemo(
    () => new Set(uploadedFonts.map((font) => font.fontName)),
    [uploadedFonts],
  );
  const pendingMissingFonts = useMemo(
    () => missingFonts.filter((font) => !uploadedFontNames.has(font.name)),
    [missingFonts, uploadedFontNames],
  );
  const hasPendingMissingFonts = pendingMissingFonts.length > 0;
  const selectedGoogleFontReplacements = useMemo<
    Record<string, { fontName: string; fontUrl: string }>
  >(
    () =>
      Object.fromEntries(
        pendingMissingFonts.flatMap((font) => {
          const selectedFont = selectedFallbackFonts[font.name];
          if (!selectedFont?.family || !selectedFont.cssUrl) return [];
          return [
            [
              font.name,
              {
                fontName: selectedFont.family,
                fontUrl: selectedFont.cssUrl,
              },
            ] as const,
          ];
        }),
      ),
    [pendingMissingFonts, selectedFallbackFonts],
  );
  const selectedGoogleFontAssets = useMemo<Record<string, string>>(
    () =>
      Object.fromEntries(
        Object.values(selectedGoogleFontReplacements).map((font) => [
          font.fontName,
          font.fontUrl,
        ]),
      ),
    [selectedGoogleFontReplacements],
  );
  const handleFallbackFontChange = useCallback(
    (fontName: string, option: GoogleFontOption) => {
      setSelectedFallbackFonts((current) => ({
        ...current,
        [fontName]: option,
      }));
    },
    [],
  );

  useEffect(() => {
    showTemplateV2ModelWarningIfNeeded(llmConfig);
    return () => {
      dismissTemplateV2ModelWarning();
    };
  }, [llmConfig]);

  useEffect(() => {
    autoPreviewStartedRef.current = false;
    setIsAutoPreviewQueued(false);
    setReviewSlideIndex(0);
    setSelectedFallbackFonts({});
  }, [selectedFile]);

  useEffect(() => {
    ensureTailwindBrowserScript();
  }, []);

  const handleLoadGoogleFontOptions = useCallback(() => {
    if (googleFontLoadStartedRef.current) return;

    googleFontLoadStartedRef.current = true;
    loadGoogleFontOptions()
      .then((options) => setGoogleFontOptions(options))
      .catch((error) => {
        googleFontLoadStartedRef.current = false;
        console.error("Failed to load Google font options", error);
      });
  }, []);

  useEffect(() => {
    if (googleFontOptions.length === 0 || pendingMissingFonts.length === 0) return;

    setSelectedFallbackFonts((current) => {
      let changed = false;
      const next = { ...current };
      const pendingFontNames = new Set(pendingMissingFonts.map((font) => font.name));

      Object.keys(next).forEach((fontName) => {
        if (!pendingFontNames.has(fontName)) {
          delete next[fontName];
          changed = true;
        }
      });

      pendingMissingFonts.forEach((font) => {
        if (next[font.name]) return;
        const fallbackFont = preferredFallbackFont(font, googleFontOptions);
        if (!fallbackFont) return;
        next[font.name] = fallbackFont;
        changed = true;
      });

      return changed ? next : current;
    });
  }, [googleFontOptions, pendingMissingFonts]);

  useEffect(() => {
    if (!state.previewData?.fonts) return;
    loadFontAssets(normalizeBackendAssetUrls(state.previewData.fonts));
  }, [state.previewData?.fonts]);

  useEffect(() => {
    if (!state.previewData) return;
    setReviewSlideIndex(0);
  }, [state.previewData]);

  useEffect(() => {
    if (!showReview && !showPreview) return;
    const observer = setupImageUrlConverter();
    return () => observer?.disconnect();
  }, [showPreview, showReview]);

  useEffect(() => {
    setReviewSlideIndex((current) => {
      const slideCount =
        slides.length > 0
          ? slides.length
          : (state.previewData?.slide_image_urls.length ?? 0);
      if (slideCount === 0) return 0;
      return Math.min(current, slideCount - 1);
    });
  }, [slides.length, state.previewData?.slide_image_urls.length]);

  useEffect(() => {
    if (!isGenerating) return;
    setReviewSlideIndex((currentIndex) => {
      const currentGeneratingSlide = slides[state.currentSlideIndex];
      if (
        hasRenderableKonvaLayout(currentGeneratingSlide) ||
        (currentGeneratingSlide?.error && !currentGeneratingSlide.processing)
      ) {
        return state.currentSlideIndex;
      }

      if (hasRenderableKonvaLayout(slides[currentIndex])) {
        return currentIndex;
      }

      return state.currentSlideIndex;
    });
  }, [isGenerating, slides, state.currentSlideIndex]);

  const handleCheckFonts = useCallback(async () => {
    if (!selectedFile) return;
    const data = await checkFonts(selectedFile);
    if (!data) return;

    const unavailableFontCount = data.unavailable_fonts?.length ?? 0;
    if (unavailableFontCount === 0) {
      notify.success(
        "All fonts available",
        "Preparing the slide preview automatically.",
      );
      return;
    }

    notify.warning(
      "Fonts need attention",
      `${unavailableFontCount} font${unavailableFontCount === 1 ? "" : "s"} are unavailable. Upload exact font files or use the selected fallback fonts before continuing.`,
    );
  }, [checkFonts, selectedFile]);

  const handleFontUploadAndPreview = useCallback(async () => {
    if (!selectedFile) return;
    if (hasPendingMissingFonts) {
      notify.warning(
        "Missing fonts",
        "Continuing without uploaded font files. Selected Google replacements will be applied.",
      );
    }
    const data = await fontUploadAndPreview(
      selectedFile,
      selectedGoogleFontReplacements,
    );
    if (data) {
      loadFontAssets(normalizeBackendAssetUrls(data.fonts));
      trackEvent(MixpanelEvent.Templates_Build_Template_Clicked, {
        source: "template_studio_preview_ready",
        slide_count: data.slide_image_urls.length,
      });
    }
  }, [
    fontUploadAndPreview,
    hasPendingMissingFonts,
    selectedGoogleFontReplacements,
    selectedFile,
  ]);

  useEffect(() => {
    if (
      !showAnalyze ||
      state.isLoading ||
      !allCheckedFontsAvailable ||
      autoPreviewStartedRef.current
    ) {
      return;
    }

    autoPreviewStartedRef.current = true;
    setIsAutoPreviewQueued(true);
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void (async () => {
        await handleFontUploadAndPreview();
        if (!cancelled) {
          setIsAutoPreviewQueued(false);
        }
      })();
    }, 900);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      setIsAutoPreviewQueued(false);
    };
  }, [
    allCheckedFontsAvailable,
    handleFontUploadAndPreview,
    showAnalyze,
    state.isLoading,
  ]);

  const handleCreateTemplate = useCallback(
    async (name: string, description: string) => {
      if (!state.previewData) {
        notify.error("Preview unavailable", "Create the slide preview before continuing.");
        return;
      }

      setIsSubmittingTemplate(true);
      try {
        trackEvent(MixpanelEvent.Templates_Build_Template_Clicked, {
          source: "template_studio_create_async",
          slide_count: state.previewData.slide_image_urls.length,
        });
        await TemplateService.createTemplate({
          pptx_url: state.previewData.modified_pptx_url,
          slide_image_urls: state.previewData.slide_image_urls,
          fonts: {
            ...state.previewData.fonts,
            ...selectedGoogleFontAssets,
          },
          name,
          description: description || null,
        });
        notify.success(
          "Template generation started",
          "You can track the template status from the Templates page.",
        );
        setTemplateModalMode(null);
        router.push("/templates?tab=custom");
      } catch (error) {
        notify.error(
          "Failed to create template",
          error instanceof Error ? error.message : "An unexpected error occurred",
        );
      } finally {
        setIsSubmittingTemplate(false);
      }
    },
    [router, selectedGoogleFontAssets, state.previewData],
  );

  const handleSaveTemplate = useCallback(
    async (name: string, description: string) => {
      if (!state.templateId) {
        notify.error("Template unavailable", "Generate the template before saving.");
        return;
      }

      setIsSubmittingTemplate(true);
      try {
        await TemplateService.updateTemplateMetadata(state.templateId, {
          name,
          description: description || null,
        });
        notify.success("Template saved", "The template was saved successfully.");
        setTemplateModalMode(null);
        router.push(`/template-preview?templateV2Id=${encodeURIComponent(state.templateId)}`);
      } catch (error) {
        notify.error(
          "Failed to save template",
          error instanceof Error ? error.message : "An unexpected error occurred",
        );
      } finally {
        setIsSubmittingTemplate(false);
      }
    },
    [router, state.templateId],
  );

  const handleTemplateModalSubmit = useCallback(
    async (name: string, description: string) => {
      if (templateModalMode === "save") {
        await handleSaveTemplate(name, description);
        return;
      }
      await handleCreateTemplate(name, description);
    },
    [handleCreateTemplate, handleSaveTemplate, templateModalMode],
  );

  const bottomAction = useMemo(() => {
    if (showAnalyze) {
      return null;
    }

    if (showPreview) {
      return (
        <GradientPillButton
          onClick={() => setTemplateModalMode("create")}
          disabled={state.isLoading || isSubmittingTemplate}
          fullWidth
        >
          {isSubmittingTemplate ? "Creating Template..." : "Create Template"}
        </GradientPillButton>
      );
    }

    if (showReview) {
      return (
        <GradientPillButton
          onClick={() => setTemplateModalMode("save")}
          disabled={!generatedSlidesReady || state.isLoading || isSubmittingTemplate}
          fullWidth
        >
          {generatedSlidesReady ? "Save as Template" : "Generating Template"}
        </GradientPillButton>
      );
    }

    return null;
  }, [
    generatedSlidesReady,
    isSubmittingTemplate,
    showAnalyze,
    showPreview,
    showReview,
    state.isLoading,
  ]);

  return (
    <div className="relative min-h-screen bg-white">
      <div className={""}>
        <StudioTopBar activeStep={activeStep} />

        {showUpload ? (
          <UploadPanel
            selectedFile={selectedFile}
            isProcessing={state.isLoading}
            onFileInput={handleFileSelect}
            onFileDrop={handleRawFileSelect}
            onRemove={removeFile}
            onStart={handleCheckFonts}
          />
        ) : null}

        {showAnalyze ? (
          <AnalyzePanel
            fontsData={state.fontsData}
            uploadedFonts={uploadedFonts}
            isUploading={state.isLoading}
            uploadFont={uploadFont}
            googleFontOptions={googleFontOptions}
            selectedFallbackFonts={selectedFallbackFonts}
            onFallbackFontChange={handleFallbackFontChange}
            onLoadGoogleFontOptions={handleLoadGoogleFontOptions}
            onContinue={handleFontUploadAndPreview}
            isAutoContinuing={isAutoPreviewQueued}
          />
        ) : null}

        {showPreview ? (
          <PreviewPanel
            previewUrls={previewUrls}
            selectedIndex={reviewSlideIndex}
            onSelect={setReviewSlideIndex}
          />
        ) : null}

        {showReview ? (
          <ReviewPanel
            slides={slides}
            selectedIndex={reviewSlideIndex}
            onSelect={setReviewSlideIndex}
            retrySlide={retrySlide}
            setSlides={setSlides}
            fonts={state.previewData?.fonts}
            enableEditing={isFinalReview}
            isGenerating={isGenerating}
          />
        ) : null}
      </div>

      {bottomAction ? <StudioBottomAction>{bottomAction}</StudioBottomAction> : null}

      <SaveTemplateModal
        isOpen={isTemplateModalOpen}
        defaultName={defaultTemplateName}
        isSaving={isSubmittingTemplate}
        title={isCreateTemplateModal ? "Create Template" : "Save Template"}
        subtitle={
          isCreateTemplateModal
            ? "Name this template before generation starts."
            : "Give your template a name."
        }
        submitLabel={isCreateTemplateModal ? "Create" : "Save"}
        onClose={() => {
          if (!isSubmittingTemplate) setTemplateModalMode(null);
        }}
        onSave={handleTemplateModalSubmit}
      />


    </div>
  );
};

export default CustomTemplatePage;
