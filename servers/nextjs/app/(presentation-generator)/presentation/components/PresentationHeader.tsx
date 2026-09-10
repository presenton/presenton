"use client";
import { Button } from "@/components/ui/button";
import {
  Play,
  Loader2,
  Redo2,
  Undo2,
  RotateCcw,
  ArrowRightFromLine,
  ArrowUpRight,
  Pencil,
  Check,
  Keyboard,
  X,
  AlertTriangle,
  BarChart3,
  MousePointer2,
} from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useDispatch, useSelector } from "react-redux";

import { RootState } from "@/store/store";
import { notify } from "@/components/ui/sonner";
import {
  trackEvent,
  trackEventImmediately,
  MixpanelEvent,
} from "@/utils/mixpanel";
import { usePresentationUndoRedo } from "../hooks/PresentationUndoRedo";
import ToolTip from "@/components/ToolTip";
import {
  clearChatHtmlSelection,
  clearPresentationData,
  setEnableHtmlSelector,
  updateTitle,
} from "@/store/slices/presentationGeneration";
import { clearHistory } from "@/store/slices/undoRedoSlice";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import MarkdownRenderer from "@/components/MarkDownRender";
import { cn } from "@/lib/utils";
import { KeyboardShortcutsDialog } from "./KeyboardShortcutsDialog";
import { sanitizeAnalyticsError } from "@/utils/analytics";
import { v4 as uuidv4 } from "uuid";
import StreamingGenerationMetrics from "./StreamingGenerationMetrics";
import { PresentationGenerationApi } from "../../services/api/presentation-generation";

const MAX_EXPORT_TITLE_LENGTH = 40;

const buildSafeExportFileName = (
  rawTitle: string | null | undefined,
  extension: "pdf" | "pptx"
) => {
  const normalizedTitle = (rawTitle || "presentation").trim();
  const titleWithoutExtension = normalizedTitle.replace(/\.(pdf|pptx)$/i, "");

  let safeBase = titleWithoutExtension
    // Replace all punctuation/special chars (including dots) with dashes
    .replace(/[^a-zA-Z0-9\s_-]+/g, "-")
    // Replace whitespace with single dashes
    .replace(/\s+/g, "-")
    // Collapse repeated separators
    .replace(/[-_]{2,}/g, "-")
    // Trim separators from both ends
    .replace(/^[-_]+|[-_]+$/g, "");

  if (!safeBase) {
    safeBase = "presentation";
  }

  if (safeBase.length > MAX_EXPORT_TITLE_LENGTH) {
    safeBase = safeBase
      .slice(0, MAX_EXPORT_TITLE_LENGTH)
      .replace(/[-_]+$/g, "");
  }

  if (!safeBase) {
    safeBase = "presentation";
  }

  return `${safeBase}.${extension}`;
};

const PresentationHeader = ({
  presentation_id,
  isPresentationSaving,
  currentSlide,
  generationMode = "standard",

}: {
  presentation_id: string;
  isPresentationSaving: boolean;
  currentSlide?: number;
  generationMode?: "standard" | "smart";
}) => {
  const [open, setOpen] = useState(false);
  const [shortcutsDialogOpen, setShortcutsDialogOpen] = useState(false);
  const router = useRouter();
  const [isExporting, setIsExporting] = useState(false);
  const [qualityOpen, setQualityOpen] = useState(false);
  const [packOpen, setPackOpen] = useState(false);
  const [nielsenOpen, setNielsenOpen] = useState(false);
  const [collabOpen, setCollabOpen] = useState(false);
  const [collabComments, setCollabComments] = useState<Array<{ id?: string; text?: string; author?: string }>>([]);
  const [collabDraft, setCollabDraft] = useState("");
  const [nielsenPanel, setNielsenPanel] = useState("Total National Urban");
  const [nielsenUnits, setNielsenUnits] = useState<Record<string, string>>({});
  const [nielsenPanels, setNielsenPanels] = useState<string[]>(["Total National Urban"]);
  const [packItems, setPackItems] = useState<Array<{ id: string; name?: string; tokens?: { colors?: Record<string, string>; logo?: string } }>>([]);
  const [packEditId, setPackEditId] = useState<string | null>(null);
  const [packDraft, setPackDraft] = useState<Record<string, string>>({
    primary: "#2CE0CE",
    primary_text: "#06100E",
    background: "#0A0C10",
    background_text: "#EEF2F8",
    card: "#12151B",
    stroke: "#363D49",
    surface_2: "#191D25",
    surface_3: "#232833",
    line: "#262B34",
    steel_500: "#7A8595",
    steel_300: "#AEB8C6",
    text_muted: "#A6B0BF",
    text_dim: "#6C7688",
    accent_deep: "#17A99B",
    ai: "#5B8CFF",
    coin: "#E9B23C",
    alert: "#FF6A00",
    warning: "#FFC940",
    danger: "#FF4D57",
    graph_0: "#2CE0CE",
    graph_1: "#5B8CFF",
    graph_2: "#E9B23C",
    graph_3: "#FF6A00",
    heading: "Exo 2",
    body: "Exo 2",
    mono: "JetBrains Mono",
    radius: "6",
    logo: "",
    background_image: "",
  });
  const [qualityIssues, setQualityIssues] = useState<Array<{ code: string; slideId?: string }>>([]);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [isRegenerateConfirmOpen, setIsRegenerateConfirmOpen] = useState(false);
  const [draftTitle, setDraftTitle] = useState("");
  const titleInputRef = useRef<HTMLInputElement>(null);
  /** Avoid committing on blur when Save/Cancel was used (focus/click ordering) */
  const titleBlurIntentRef = useRef<"none" | "save" | "cancel">("none");

  const pathname = usePathname();
  const dispatch = useDispatch();

  const {
    presentationData,
    isStreaming,
    enableHtmlSelector,
    generationMetrics,
  } = useSelector((state: RootState) => state.presentationGeneration);
  const { onUndo, onRedo, canUndo, canRedo } = usePresentationUndoRedo();

  useEffect(() => {
    if (isEditingTitle) {
      titleInputRef.current?.focus();
      titleInputRef.current?.select();
    }
  }, [isEditingTitle]);

  useEffect(() => {
    if (generationMode !== "smart" || isStreaming) {
      dispatch(setEnableHtmlSelector(false));
      return;
    }
    const storedMode = window.localStorage.getItem("html-selector-mode");
    dispatch(setEnableHtmlSelector(storedMode !== "false"));
  }, [dispatch, generationMode, isStreaming]);

  const toggleHtmlSelector = () => {
    const nextValue = !enableHtmlSelector;
    dispatch(setEnableHtmlSelector(nextValue));
    if (!nextValue) dispatch(clearChatHtmlSelection());
    window.localStorage.setItem("html-selector-mode", String(nextValue));
    trackEvent(MixpanelEvent.Smart_Mode_Select_Edit_Toggled, {
      pathname,
      presentation_id,
      enabled: nextValue,
    });
  };

  const beginTitleEdit = () => {
    if (isStreaming || !presentationData) return;
    setDraftTitle(presentationData.title || "");
    setIsEditingTitle(true);
  };

  const commitTitleEdit = () => {
    if (!presentationData) {
      setIsEditingTitle(false);
      return;
    }
    const trimmed = draftTitle.trim();
    const next = trimmed || presentationData.title || "Presentation";
    if (next !== presentationData.title) {
      dispatch(updateTitle(next));
      trackEvent(MixpanelEvent.Presentation_Title_Updated, {
        pathname,
        presentation_id,
        previous_title_length: (presentationData.title || "").length,
        next_title_length: next.length,
      });
    }
    setIsEditingTitle(false);
  };

  const cancelTitleEdit = () => {
    setDraftTitle(presentationData?.title || "");
    setIsEditingTitle(false);
  };

  const handleTitleBlur = () => {
    queueMicrotask(() => {
      const intent = titleBlurIntentRef.current;
      titleBlurIntentRef.current = "none";
      if (intent === "cancel" || intent === "save") return;
      commitTitleEdit();
    });
  };

  const onTitleSaveMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    titleBlurIntentRef.current = "save";
  };

  const onTitleCancelMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    titleBlurIntentRef.current = "cancel";
  };

  const exportViaIpc = async (
    format: "pptx" | "pdf",
    title: string
  ): Promise<void> => {
    if (!window.electron?.exportPresentation) {
      throw new Error("Electron export bridge is unavailable");
    }
    const result = await window.electron.exportPresentation(
      presentation_id,
      title,
      format
    );
    if (!result?.success) {
      throw new Error(result?.message || "Export failed");
    }
  };

  const loadQuality = async () => {
    try {
      const report = await PresentationGenerationApi.getQualityReport(presentation_id);
      setQualityIssues(Array.isArray(report?.issues) ? report.issues : []);
    } catch (error) {
      notify.error("Quality check failed", error instanceof Error ? error.message : "Try again.");
    }
  };

  const handleExportPptx = async () => {
    if (isStreaming) return;

    const exportId = uuidv4();
    const exportStartedAt = Date.now();
    const exportRuntime = window.electron?.exportPresentation
      ? "electron"
      : "browser_api";
    let exportToastId: string | number | undefined;
    try {
      exportToastId = notify.loading(
        "Exporting PPTX",
        "Your presentation is being exported. This may take a moment."
      );
      setIsExporting(true);
      await trackExportLifecycle(
        MixpanelEvent.Presentation_Export_Started,
        "pptx",
        exportRuntime,
        exportId,
        exportStartedAt
      );
      const safePptxFileName = buildSafeExportFileName(
        presentationData?.title,
        "pptx"
      );
      const safePptxTitle = safePptxFileName.replace(/\.pptx$/i, "");
      if (exportRuntime === "electron") {
        await exportViaIpc("pptx", safePptxTitle);
      } else {
        const response = await fetch("/api/export-presentation", {
          method: "POST",
          body: JSON.stringify({
            format: "pptx",
            id: presentation_id,
            title: safePptxTitle,
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to export PPTX");
        }

        const { path: pptxPath } = await response.json();
        if (!pptxPath) {
          throw new Error("No path returned from export");
        }

        downloadLink(pptxPath, safePptxFileName);
      }
      await trackExportLifecycle(
        MixpanelEvent.Presentation_Export_Completed,
        "pptx",
        exportRuntime,
        exportId,
        exportStartedAt
      );
      notify.success(
        "Export complete",
        "Your PPTX file has been downloaded.",
        { id: exportToastId }
      );
    } catch (error) {
      console.error("Export failed:", error);
      await trackExportLifecycle(
        MixpanelEvent.Presentation_Export_Failed,
        "pptx",
        exportRuntime,
        exportId,
        exportStartedAt,
        error
      );
      notify.error(
        "Export failed",
        "We are having trouble exporting your presentation. Please try again.",
        exportToastId !== undefined ? { id: exportToastId } : undefined
      );
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportPptxEditable = async () => {
    if (isStreaming) return;
    let exportToastId: string | number | undefined;
    try {
      exportToastId = notify.loading("Exporting editable PPTX");
      setIsExporting(true);
      const result = await PresentationGenerationApi.exportEditablePptx(presentation_id);
      const pptxPath = typeof result?.path === "string" ? result.path : "";
      if (!pptxPath) throw new Error("No path returned from export");
      const marker = "/exports/";
      const relative = pptxPath.includes(marker)
        ? pptxPath.slice(pptxPath.indexOf(marker) + marker.length)
        : pptxPath;
      downloadLink(
        `/api/export-presentation/file?name=${encodeURIComponent(relative)}`,
        buildSafeExportFileName(presentationData?.title, "pptx").replace(/\.pptx$/i, "") + "_editable.pptx",
      );
      notify.success("Export complete", "Editable PPTX downloaded.", { id: exportToastId });
    } catch (error) {
      notify.error(
        "Export failed",
        error instanceof Error ? error.message : "Could not export editable PPTX.",
        exportToastId !== undefined ? { id: exportToastId } : undefined,
      );
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportPdf = async () => {
    if (isStreaming) return;

    const exportId = uuidv4();
    const exportStartedAt = Date.now();
    const exportRuntime = window.electron?.exportPresentation
      ? "electron"
      : "browser_api";
    let exportToastId: string | number | undefined;
    try {
      exportToastId = notify.loading(
        "Exporting PDF",
        "Your presentation is being exported. This may take a moment."
      );
      setIsExporting(true);
      await trackExportLifecycle(
        MixpanelEvent.Presentation_Export_Started,
        "pdf",
        exportRuntime,
        exportId,
        exportStartedAt
      );
      const safePdfFileName = buildSafeExportFileName(
        presentationData?.title,
        "pdf"
      );
      const safePdfTitle = safePdfFileName.replace(/\.pdf$/i, "");
      if (exportRuntime === "electron") {
        await exportViaIpc("pdf", safePdfTitle);
      } else {
        const response = await fetch("/api/export-presentation", {
          method: "POST",
          body: JSON.stringify({
            format: "pdf",
            id: presentation_id,
            title: safePdfTitle,
          }),
        });

        if (response.ok) {
          const { path: pdfPath } = await response.json();
          if (!pdfPath) {
            throw new Error("No path returned from export");
          }
          downloadLink(pdfPath, safePdfFileName);
        } else {
          throw new Error("Failed to export PDF");
        }
      }
      await trackExportLifecycle(
        MixpanelEvent.Presentation_Export_Completed,
        "pdf",
        exportRuntime,
        exportId,
        exportStartedAt
      );
      notify.success(
        "Export complete",
        "Your PDF file has been downloaded.",
        { id: exportToastId }
      );
    } catch (error) {
      console.error(error);
      await trackExportLifecycle(
        MixpanelEvent.Presentation_Export_Failed,
        "pdf",
        exportRuntime,
        exportId,
        exportStartedAt,
        error
      );
      notify.error(
        "Export failed",
        "We are having trouble exporting your presentation. Please try again.",
        exportToastId !== undefined ? { id: exportToastId } : undefined
      );
    } finally {
      setIsExporting(false);
    }
  };
  const handleReGenerate = () => {
    setIsRegenerateConfirmOpen(false);
    dispatch(clearPresentationData());
    dispatch(clearHistory());
    trackEvent(MixpanelEvent.Presentation_Regenerated, {
      pathname,
      presentation_id,
      slide_count: presentationData?.slides?.length || 0,
      generation_mode: generationMode,
    });
    if (generationMode === "smart") {
      trackEvent(MixpanelEvent.Smart_Mode_Generation_Started, {
        pathname,
        presentation_id,
        slide_count: presentationData?.slides?.length || 0,
        source: "regenerate",
      });
    }
    router.push(
      `/presentation?id=${presentation_id}&stream=true${
        generationMode === "smart" ? "&type=smart" : ""
      }`
    );
  };
  const downloadLink = (path: string, fileName: string) => {
    const link = document.createElement("a");
    link.href = path;
    link.download = fileName;
    link.rel = "noopener";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const trackExportLifecycle = async (
    event:
      | MixpanelEvent.Presentation_Export_Started
      | MixpanelEvent.Presentation_Export_Completed
      | MixpanelEvent.Presentation_Export_Failed,
    format: "pptx" | "pdf",
    exportRuntime: "electron" | "browser_api",
    exportId: string,
    exportStartedAt: number,
    error?: unknown
  ) => {
    try {
      await trackEventImmediately(event, {
        pathname,
        presentation_id,
        export_id: exportId,
        format,
        slide_count: presentationData?.slides?.length || 0,
        export_runtime: exportRuntime,
        generation_mode: generationMode,
        ...(event !== MixpanelEvent.Presentation_Export_Started
          ? { duration_ms: Date.now() - exportStartedAt }
          : {}),
        ...(error !== undefined
          ? { error_message: sanitizeAnalyticsError(error, "Export failed") }
          : {}),
      });
    } catch (analyticsError) {
      // Analytics must never prevent or change the result of an export.
      console.warn("Failed to track export lifecycle:", analyticsError);
    }
  };

  const ExportOptions = ({ mobile }: { mobile: boolean }) => (
    <div
      className={` rounded-[18px] max-md:mt-4 ${mobile ? "" : "bg-white"}  p-5`}
    >
      <p className="text-sm font-medium text-[#19001F]">Export as</p>
      <div className="my-[18px] h-[1px] bg-[#E8E8E8]" />
      <div className="space-y-3">
        <Button
          onClick={() => {
            handleExportPdf();
            setOpen(false);
          }}
          variant="ghost"
          className={`  rounded-none px-0 w-full text-xs flex justify-start text-black hover:bg-transparent ${mobile ? "bg-white py-6 border-none rounded-lg" : ""
            }`}
        >
          PDF
          <ArrowUpRight className="w-3.5 h-3.5" />
        </Button>
        <Button
          onClick={() => {
            handleExportPptx();
            setOpen(false);
          }}
          variant="ghost"
          className={`w-full flex px-0 justify-start text-xs text-black hover:bg-transparent  ${mobile ? "bg-white py-6" : ""
            }`}
        >
          PPTX
          <ArrowUpRight className="w-3.5 h-3.5" />
        </Button>
        <Button
          data-testid="export-pptx-editable"
          onClick={() => {
            handleExportPptxEditable();
            setOpen(false);
          }}
          variant="ghost"
          className={`w-full flex px-0 justify-start text-xs text-black hover:bg-transparent  ${mobile ? "bg-white py-6" : ""
            }`}
        >
          PPTX editable
          <ArrowUpRight className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );

  const titleBlock = (
    <div
      className={cn(
        "min-w-0 max-w-[min(640px,calc(100vw-12rem))] flex-1 transition-[box-shadow] duration-200",
        isEditingTitle && "relative z-[60]"
      )}
    >
      {isEditingTitle ? (
        <div className="flex items-stretch w-[450px]  gap-0.5 rounded-[14px] border border-[#E4E2EB] bg-white pl-3.5 pr-1 py-1 shadow-[0_2px_12px_rgba(17,3,31,0.06)] ring-2 ring-[#5141e5]/15">
          <input
            ref={titleInputRef}
            value={draftTitle}
            onChange={(e) => setDraftTitle(e.target.value)}
            onBlur={handleTitleBlur}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                titleBlurIntentRef.current = "save";
                commitTitleEdit();
              } else if (e.key === "Escape") {
                e.preventDefault();
                titleBlurIntentRef.current = "cancel";
                cancelTitleEdit();
              }
            }}
            placeholder="Presentation title"
            className="min-w-0 flex-1 bg-transparent py-2 pr-2 font-syne text-base leading-tight text-[#101323] placeholder:text-[#101323]/35 outline-none border-0 focus:ring-0"
            aria-label="Presentation title"
          />
          <div className="flex shrink-0 items-center gap-0.5 border-l border-[#EDECEC] pl-1 ml-0.5">
            <ToolTip content="Save · Enter">
              <button
                type="button"
                onMouseDown={onTitleSaveMouseDown}
                onClick={commitTitleEdit}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-[#5141e5] hover:bg-[#5141e5]/10 transition-colors"
                aria-label="Save title"
              >
                <Check className="h-4 w-4" strokeWidth={2.25} />
              </button>
            </ToolTip>
            <ToolTip content="Cancel · Esc">
              <button
                type="button"
                onMouseDown={onTitleCancelMouseDown}
                onClick={cancelTitleEdit}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-[#101323]/55 hover:bg-[#F6F6F9] hover:text-[#101323] transition-colors"
                aria-label="Cancel editing title"
              >
                <X className="h-4 w-4" strokeWidth={2.25} />
              </button>
            </ToolTip>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={beginTitleEdit}
          disabled={isStreaming || !presentationData}
          className={cn(
            "group/title flex w-full min-w-0 items-center gap-2.5 rounded-[14px] px-3 py-2 text-left -mx-3 transition-colors",
            "hover:bg-[#F6F6F9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5141e5] focus-visible:ring-offset-2",
            "disabled:pointer-events-none disabled:opacity-100 disabled:hover:bg-transparent"
          )}
        >
          <h2 className="min-w-0 flex-1 font-syne text-lg w-[450px] leading-snug text-[#101323]">
            <MarkdownRenderer
              content={presentationData?.title || "Presentation"}
              className="mb-0 min-w-0 overflow-hidden text-ellipsis line-clamp-1 text-sm text-[#101323] prose-p:my-0 prose-headings:my-0"
            />
          </h2>
          {presentationData && !isStreaming && (
            <Pencil
              className="h-3.5 w-3.5 shrink-0 text-[#101323]/40 transition-all duration-200 group-hover/title:text-[#5141e5] opacity-80 sm:opacity-0 sm:group-hover/title:opacity-100 group-hover/title:opacity-100"
              aria-hidden
            />
          )}
        </button>
      )}
    </div>
  );

  return (
    <>
      <div className="py-[18px] px-4 sticky top-0 bg-white z-50 shadow-sm font-syne flex justify-between items-center gap-4 overflow-x-auto">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <img
            onClick={() => {
              router.push("/dashboard");
            }}
            src="/logo-with-bg.png"
            alt=""
            className="w-10 h-10 cursor-pointer object-contain"
          />
          {presentationData && !isStreaming && !isEditingTitle ? (
            <ToolTip content="Rename presentation">{titleBlock}</ToolTip>
          ) : (
            titleBlock
          )}
         
        </div>

        <div className="flex shrink-0 items-center gap-2.5">
          {generationMode === "smart" && generationMetrics ? (
            <StreamingGenerationMetrics metrics={generationMetrics} />
          ) : null}
          {isPresentationSaving && (
            <div className="flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            </div>
          )}
          {generationMode === "smart" && !isStreaming && (
            <ToolTip
              content={
                enableHtmlSelector
                  ? "Element selection is on"
                  : "Click a slide element to add it to AI chat"
              }
            >
              <button
                type="button"
                data-testid="html-selector-btn"
                onClick={toggleHtmlSelector}
                aria-pressed={enableHtmlSelector}
                className={cn(
                  "hidden h-[38px] items-center gap-2 rounded-xl border px-3 font-syne text-xs font-semibold shadow-sm transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6D5DFB] focus-visible:ring-offset-2 xl:inline-flex",
                  enableHtmlSelector
                    ? "border-[#CEC6FF] bg-[#F3F0FF] text-[#5141E5]"
                    : "border-[#E4E4E8] bg-white text-[#3D3D48] hover:border-[#D7D2F5] hover:bg-[#FAF9FF] hover:text-[#5141E5]"
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "flex h-6 w-6 items-center justify-center rounded-lg transition-colors",
                    enableHtmlSelector
                      ? "bg-[#6D5DFB] text-white"
                      : "bg-[#F1EFFF] text-[#6553E8]"
                  )}
                >
                  <MousePointer2 className="h-3.5 w-3.5" strokeWidth={2} />
                </span>
                <span className="whitespace-nowrap">Select to edit</span>
                <span
                  aria-hidden="true"
                  className={cn(
                    "ml-0.5 h-1.5 w-1.5 rounded-full transition-colors",
                    enableHtmlSelector ? "bg-[#6D5DFB]" : "bg-[#B8B8C2]"
                  )}
                />
              </button>
            </ToolTip>
          )}
          <div className="flex items-center gap-2 bg-[#F6F6F9] px-3.5 h-[38px] border border-[#EDECEC] rounded-[80px]">
            <ToolTip content="Regenerate Presentation">
              <button
                type="button"
                onClick={() => setIsRegenerateConfirmOpen(true)}
                className="group"
              >
                <RotateCcw className="w-3.5 h-3.5 text-[#101323] group-hover:text-[#5141e5] duration-300" />
              </button>
            </ToolTip>
            <Separator orientation="vertical" className="h-4" />
            <ToolTip content="Undo">
              <button
                disabled={!canUndo}
                className=" disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer group"
                onClick={() => {
                  onUndo();
                }}
              >
                <Undo2 className="w-3.5 h-3.5 text-[#101323] group-hover:text-[#5141e5] duration-300" />
              </button>
            </ToolTip>
            <Separator orientation="vertical" className="h-4" />
            <ToolTip content="Redo">
              <button
                disabled={!canRedo}
                className=" disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer group"
                onClick={() => {
                  onRedo();
                }}
              >
                <Redo2 className="w-3.5 h-3.5 text-[#101323] group-hover:text-[#5141e5] duration-300" />
              </button>
            </ToolTip>
            <Separator orientation="vertical" className="h-4 w-[2px]" />
            <ToolTip content="Present">
              <button
                onClick={() => {
                  const to = `?id=${presentation_id}&mode=present&slide=${
                    currentSlide || 0
                  }${generationMode === "smart" ? "&type=smart" : ""}`;
                  trackEvent(MixpanelEvent.Presentation_Mode_Entered, {
                    pathname,
                    presentation_id,
                    slide_index: currentSlide || 0,
                    slide_count: presentationData?.slides?.length || 0,
                    generation_mode: generationMode,
                  });
                  trackEvent(MixpanelEvent.Navigation, { from: pathname, to });
                  router.push(to);
                }}
                disabled={
                  isStreaming ||
                  !presentationData?.slides ||
                  presentationData?.slides.length === 0
                }
                className="cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed group"
              >
                <Play className="w-3.5 h-3.5 text-[#101323] group-hover:text-[#5141e5] duration-300" />
              </button>
            </ToolTip>
          </div>

        {generationMode === "standard" && (
          <ToolTip content="Keyboard shortcuts (?)">
            <button
              type="button"
              aria-label="Keyboard shortcuts"
              aria-haspopup="dialog"
              aria-expanded={shortcutsDialogOpen}
              aria-keyshortcuts="?"
              data-testid="keyboard-shortcuts-btn"
              className="inline-flex h-[38px] w-[38px] items-center justify-center rounded-full border border-[#EDECEC] bg-[#F6F6F9] text-[#101323] transition-colors hover:border-[#D8D3FE] hover:bg-[#F0EDFF] hover:text-[#6847F4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7A5AF8] focus-visible:ring-offset-2"
              onClick={() => setShortcutsDialogOpen(true)}
            >
              <Keyboard
                aria-hidden="true"
                className="size-4"
                strokeWidth={1.8}
              />
            </button>
          </ToolTip>)}

          <Popover
            open={packOpen}
            onOpenChange={(next) => {
              setPackOpen(next);
              if (next) {
                void PresentationGenerationApi.listBrandPacks()
                  .then((rows) => setPackItems(Array.isArray(rows) ? rows : []))
                  .catch(() => setPackItems([]));
              }
            }}
          >
            <PopoverTrigger asChild>
              <button
                type="button"
                data-testid="dozer-catalog"
                className="inline-flex h-[38px] items-center gap-1.5 rounded-full border border-[#EDECEC] bg-[#F6F6F9] px-3 text-sm font-medium text-[#101323]"
              >
                Pack
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-[360px] rounded-[18px] p-3" data-testid="dozer-catalog-panel">
              <ul className="space-y-2">
                {packItems.map((item) => (
                  <li key={item.id} className="rounded-lg border border-[#EEE] p-2">
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <button
                        type="button"
                        data-testid={`dozer-item-${item.id}`}
                        className="text-left text-sm font-medium text-[#101323]"
                        onClick={async () => {
                          try {
                            await PresentationGenerationApi.applyBrandPack(item.id, presentation_id);
                            notify.success(`Theme: ${item.name || item.id}`);
                            setPackOpen(false);
                            window.location.reload();
                          } catch (error) {
                            notify.error("Theme failed", error instanceof Error ? error.message : "Try again.");
                          }
                        }}
                      >
                        {item.name || item.id}
                      </button>
                      <button
                        type="button"
                        className="text-xs text-[#667]"
                        onClick={() => {
                          const colors = item.tokens?.colors || {};
                          const fonts = (item as any).tokens?.fonts || {};
                          setPackEditId(packEditId === item.id ? null : item.id);
                          const hx = (v: string | undefined, d: string) => (v && v.startsWith("#") ? v : v ? `#${v}` : d);
                          setPackDraft({
                            primary: hx(colors.primary, "#2CE0CE"),
                            primary_text: hx(colors.primary_text, "#06100E"),
                            background: hx(colors.background, "#0A0C10"),
                            background_text: hx(colors.background_text, "#EEF2F8"),
                            card: hx(colors.card, "#12151B"),
                            stroke: hx(colors.stroke, "#363D49"),
                            surface_2: hx(colors.surface_2, "#191D25"),
                            surface_3: hx(colors.surface_3, "#232833"),
                            line: hx(colors.line, "#262B34"),
                            steel_500: hx(colors.steel_500, "#7A8595"),
                            steel_300: hx(colors.steel_300, "#AEB8C6"),
                            text_muted: hx(colors.text_muted, "#A6B0BF"),
                            text_dim: hx(colors.text_dim, "#6C7688"),
                            accent_deep: hx(colors.accent_deep, "#17A99B"),
                            ai: hx(colors.ai, "#5B8CFF"),
                            coin: hx(colors.coin, "#E9B23C"),
                            alert: hx(colors.alert, "#FF6A00"),
                            warning: hx(colors.warning, "#FFC940"),
                            danger: hx(colors.danger, "#FF4D57"),
                            graph_0: hx(colors.graph_0, "#2CE0CE"),
                            graph_1: hx(colors.graph_1, "#5B8CFF"),
                            graph_2: hx(colors.graph_2, "#E9B23C"),
                            graph_3: hx(colors.graph_3, "#FF6A00"),
                            heading: fonts.heading || "Exo 2",
                            body: fonts.body || "Exo 2",
                            mono: fonts.mono || "JetBrains Mono",
                            radius: String((item as any).tokens?.radius || "6"),
                            logo: (item as any).tokens?.logo || "",
                            background_image: (item as any).tokens?.background_image || "",
                          });
                        }}
                      >
                        Edit
                      </button>
                    </div>
                    {packEditId === item.id && (
                      <div className="max-h-[55vh] space-y-2 overflow-auto pt-1">
                        <p className="text-[10px] uppercase tracking-wide text-[#889]">noob · Palette</p>
                        {([
                          ["background", "ink"],
                          ["card", "surface"],
                          ["surface_2", "surface-2"],
                          ["surface_3", "surface-3"],
                          ["line", "line"],
                          ["stroke", "line-2"],
                          ["steel_500", "steel-500"],
                          ["steel_300", "steel-300"],
                          ["background_text", "text"],
                          ["text_muted", "text-muted"],
                          ["text_dim", "text-dim"],
                          ["primary", "accent · cyan"],
                          ["accent_deep", "accent-deep"],
                          ["primary_text", "on-accent"],
                          ["ai", "ai · blue"],
                          ["coin", "coin · gold"],
                          ["alert", "alert · orange"],
                          ["warning", "warning"],
                          ["danger", "danger"],
                        ] as const).map(([key, label]) => (
                          <label key={key} className="flex items-center justify-between text-xs">
                            {label}
                            <input type="color" value={packDraft[key] || "#000000"}
                              onChange={(e) => setPackDraft({ ...packDraft, [key]: e.target.value })} />
                          </label>
                        ))}
                        <p className="text-[10px] uppercase tracking-wide text-[#889]">Charts</p>
                        {(["graph_0", "graph_1", "graph_2", "graph_3"] as const).map((key) => (
                          <label key={key} className="flex items-center justify-between text-xs">
                            {key}
                            <input type="color" value={packDraft[key] || "#000000"}
                              onChange={(e) => setPackDraft({ ...packDraft, [key]: e.target.value })} />
                          </label>
                        ))}
                        <p className="text-[10px] uppercase tracking-wide text-[#889]">Type</p>
                        <input className="w-full rounded border border-[#EDEEEF] px-2 py-1 text-xs" placeholder="Heading · Exo 2"
                          value={packDraft.heading} onChange={(e) => setPackDraft({ ...packDraft, heading: e.target.value })} />
                        <input className="w-full rounded border border-[#EDEEEF] px-2 py-1 text-xs" placeholder="Body · Exo 2"
                          value={packDraft.body} onChange={(e) => setPackDraft({ ...packDraft, body: e.target.value })} />
                        <input className="w-full rounded border border-[#EDEEEF] px-2 py-1 text-xs" placeholder="Mono · JetBrains Mono"
                          value={packDraft.mono || ""} onChange={(e) => setPackDraft({ ...packDraft, mono: e.target.value })} />
                        <label className="flex items-center justify-between text-xs">Radius
                          <input className="w-16 rounded border border-[#EDEEEF] px-1 py-0.5 text-xs" value={packDraft.radius}
                            onChange={(e) => setPackDraft({ ...packDraft, radius: e.target.value })} />
                        </label>
                        <p className="text-[10px] uppercase tracking-wide text-[#889]">Chrome</p>
                        <input className="w-full rounded border border-[#EDEEEF] px-2 py-1 text-xs" placeholder="Logo URL"
                          value={packDraft.logo} onChange={(e) => setPackDraft({ ...packDraft, logo: e.target.value })} />
                        <input className="w-full rounded border border-[#EDEEEF] px-2 py-1 text-xs" placeholder="Background image URL"
                          value={packDraft.background_image} onChange={(e) => setPackDraft({ ...packDraft, background_image: e.target.value })} />
                        <button
                          type="button"
                          className="w-full rounded-lg border border-[#EDEEEF] py-1 text-xs font-medium"
                          onClick={async () => {
                            try {
                              await PresentationGenerationApi.updateBrandPack(item.id, {
                                tokens: {
                                  colors: {
                                    primary: packDraft.primary,
                                    primary_text: packDraft.primary_text,
                                    background: packDraft.background,
                                    background_text: packDraft.background_text,
                                    card: packDraft.card,
                                    stroke: packDraft.stroke,
                                    surface_2: packDraft.surface_2,
                                    surface_3: packDraft.surface_3,
                                    line: packDraft.line,
                                    steel_500: packDraft.steel_500,
                                    steel_300: packDraft.steel_300,
                                    text_muted: packDraft.text_muted,
                                    text_dim: packDraft.text_dim,
                                    accent_deep: packDraft.accent_deep,
                                    ai: packDraft.ai,
                                    coin: packDraft.coin,
                                    alert: packDraft.alert,
                                    warning: packDraft.warning,
                                    danger: packDraft.danger,
                                    graph_0: packDraft.graph_0,
                                    graph_1: packDraft.graph_1,
                                    graph_2: packDraft.graph_2,
                                    graph_3: packDraft.graph_3,
                                  },
                                  fonts: { heading: packDraft.heading, body: packDraft.body, mono: packDraft.mono },
                                  radius: packDraft.radius,
                                  logo: packDraft.logo,
                                  background_image: packDraft.background_image,
                                },
                              });
                              await PresentationGenerationApi.applyBrandPack(item.id, presentation_id);
                              notify.success("Design system saved");
                              window.location.reload();
                            } catch (error) {
                              notify.error("Save failed", error instanceof Error ? error.message : "Try again.");
                            }
                          }}
                        >
                          Save and apply
                        </button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </PopoverContent>
          </Popover>

          <Popover
            open={collabOpen}
            onOpenChange={(next) => {
              setCollabOpen(next);
              if (next) {
                void PresentationGenerationApi.getCollab(presentation_id)
                  .then((data: any) => setCollabComments(Array.isArray(data?.comments) ? data.comments : []))
                  .catch(() => setCollabComments([]));
              }
            }}
          >
            <PopoverTrigger asChild>
              <button
                type="button"
                data-testid="collab-open"
                className="inline-flex h-[38px] items-center gap-1.5 rounded-full border border-[#EDECEC] bg-[#F6F6F9] px-3 text-sm font-medium text-[#101323]"
              >
                Collab
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-[280px] rounded-[18px] p-3" data-testid="collab-panel">
              <ul className="mb-2 max-h-32 space-y-1 overflow-auto">
                {collabComments.map((c) => (
                  <li key={c.id} className="text-sm text-[#101323]" data-testid="collab-comment">{c.author}: {c.text}</li>
                ))}
              </ul>
              <input
                data-testid="collab-input"
                className="mb-2 w-full rounded-lg border border-[#EDEEEF] px-2 py-1.5 text-sm"
                value={collabDraft}
                onChange={(e) => setCollabDraft(e.target.value)}
                placeholder="Comment"
              />
              <button
                type="button"
                data-testid="collab-send"
                className="w-full rounded-lg border border-[#EDEEEF] px-2 py-1.5 text-xs font-medium"
                onClick={async () => {
                  try {
                    const slideId = presentationData?.slides?.[currentSlide || 0]?.id;
                    if (!slideId || !collabDraft.trim()) return;
                    await PresentationGenerationApi.postCollabComment(presentation_id, String(slideId), collabDraft.trim());
                    setCollabDraft("");
                    const data = await PresentationGenerationApi.getCollab(presentation_id);
                    setCollabComments(Array.isArray(data?.comments) ? data.comments : []);
                    notify.success("Comment saved");
                  } catch (error) {
                    notify.error("Comment failed", error instanceof Error ? error.message : "Try again.");
                  }
                }}
              >
                Send
              </button>
            </PopoverContent>
          </Popover>

          <button
            type="button"
            data-testid="design-variants"
            className="inline-flex h-[38px] items-center gap-1.5 rounded-full border border-[#EDECEC] bg-[#F6F6F9] px-3 text-sm font-medium text-[#101323]"
            onClick={async () => {
              try {
                const snap = await PresentationGenerationApi.getDocumentSnapshot(presentation_id);
                const slides = Array.isArray(snap?.slides) ? snap.slides : [];
                const slideId = slides[currentSlide || 0]?.id || slides[0]?.id;
                if (!slideId) throw new Error("Slide not found");
                const proposed = await PresentationGenerationApi.proposeVariants(presentation_id, String(slideId));
                const first = proposed?.variants?.[0]?.composition_id;
                if (!first) throw new Error("No variants");
                await PresentationGenerationApi.applyVariant(presentation_id, String(slideId), first);
                notify.success(`Variant: ${first}`);
              } catch (error) {
                notify.error("Variant failed", error instanceof Error ? error.message : "Try again.");
              }
            }}
          >
            Variant
          </button>
          <button
            type="button"
            data-testid="report-refresh"
            className="inline-flex h-[38px] items-center gap-1.5 rounded-full border border-[#EDECEC] bg-[#F6F6F9] px-3 text-sm font-medium text-[#101323]"
            onClick={async () => {
              try {
                await PresentationGenerationApi.refreshReport(presentation_id);
                notify.success("Report refreshed");
              } catch (error) {
                notify.error("Refresh failed", error instanceof Error ? error.message : "Try again.");
              }
            }}
          >
            Refresh
          </button>

          <Popover
            open={nielsenOpen}
            onOpenChange={(next) => {
              setNielsenOpen(next);
              if (next) {
                void PresentationGenerationApi.nielsenUnits()
                  .then((data: any) => {
                    setNielsenUnits(data?.units || data || {});
                    if (Array.isArray(data?.panels) && data.panels.length) setNielsenPanels(data.panels);
                  })
                  .catch(() => undefined);
              }
            }}
          >
            <PopoverTrigger asChild>
              <button
                type="button"
                data-testid="nielsen-open"
                className="inline-flex h-[38px] items-center gap-1.5 rounded-full border border-[#EDECEC] bg-[#F6F6F9] px-3 text-sm font-medium text-[#101323]"
              >
                <BarChart3 className="h-3.5 w-3.5" />
                Nielsen
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-[360px] rounded-[18px] p-3" data-testid="nielsen-panel">
              <label className="text-[11px] uppercase text-[#667085]">Panel</label>
              <select
                data-testid="nielsen-panel-select"
                className="mt-1 mb-2 w-full rounded-lg border border-[#EDEEEF] px-2 py-1.5 text-sm"
                value={nielsenPanel}
                onChange={(e) => setNielsenPanel(e.target.value)}
              >
                {nielsenPanels.map((panel) => (
                  <option key={panel} value={panel}>{panel}</option>
                ))}
              </select>
              <p className="mb-2 text-[11px] text-[#667085]" data-testid="nielsen-glossary">
                {nielsenUnits["money__mat_ty"] || "Nielsen MAT money units (not RUB without glossary)"}
              </p>
              <button
                type="button"
                data-testid="nielsen-pull"
                aria-label="Pull Nielsen"
                className="w-full rounded-lg border border-[#EDEEEF] px-2 py-1.5 text-xs font-medium text-[#101323]"
                onClick={async () => {
                  try {
                    await PresentationGenerationApi.pullNielsen(presentation_id, nielsenPanel);
                    notify.success("Nielsen MAT pulled");
                    setNielsenOpen(false);
                  } catch (error) {
                    notify.error(
                      "Nielsen pull failed",
                      error instanceof Error ? error.message : "Try again.",
                    );
                  }
                }}
              >
                Pull
              </button>
            </PopoverContent>
          </Popover>

          <Popover
            open={qualityOpen}
            onOpenChange={(next) => {
              setQualityOpen(next);
              if (next) void loadQuality();
            }}
          >
            <PopoverTrigger asChild>
              <button
                type="button"
                data-testid="quality-check"
                className="inline-flex h-[38px] items-center gap-1.5 rounded-full border border-[#EDECEC] bg-[#F6F6F9] px-3 text-sm font-medium text-[#101323]"
              >
                <AlertTriangle className="h-3.5 w-3.5" />
                Quality
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-[260px] rounded-[18px] p-3" data-testid="quality-panel">
              {qualityIssues.length === 0 ? (
                <p className="text-sm text-[#667085]" data-testid="quality-ok">No issues</p>
              ) : (
                <>
                <ul className="space-y-1.5">
                  {qualityIssues.map((issue, index) => (
                    <li key={`${issue.code}-${index}`} className="text-sm text-[#101323]" data-testid={`quality-issue-${issue.code}`}>
                      {issue.code}
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  data-testid="quality-fix"
                  className="mt-3 w-full rounded-lg border border-[#EDEEEF] px-2 py-1.5 text-xs font-medium text-[#101323]"
                  onClick={async () => {
                    try {
                      await PresentationGenerationApi.fixQualityIssues(presentation_id);
                      await loadQuality();
                      notify.success("Quality fixes applied");
                    } catch (error) {
                      notify.error(
                        "Could not apply fixes",
                        error instanceof Error ? error.message : "Try again.",
                      );
                    }
                  }}
                >
                  Fix empty images
                </button>
                </>
              )}
            </PopoverContent>
          </Popover>
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <button
                className="flex  items-center gap-[7px] px-[18px] py-[11px] rounded-[53px] text-sm font-semibold text-[#101323]"
                style={{
                  background:
                    "linear-gradient(270deg, #D5CAFC 2.4%, #E3D2EB 27.88%, #F4DCD3 69.23%, #FDE4C2 100%)",
                }}
                disabled={isExporting || isStreaming === true}
              >
                {isExporting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  "Export"
                )}{" "}
                <ArrowRightFromLine className="w-3.5 h-3.5" />
              </button>
            </PopoverTrigger>
            <PopoverContent
              align="end"
              className="w-[200px] rounded-[18px] space-y-2 p-0  "
            >
              <ExportOptions mobile={false} />
            </PopoverContent>
          </Popover>
        </div>
      </div>
      <Dialog
        open={isRegenerateConfirmOpen}
        onOpenChange={setIsRegenerateConfirmOpen}
      >
        <DialogContent className="w-[360px] rounded-2xl border-0 p-0 shadow-2xl sm:max-w-[360px]">
          <DialogHeader className="items-center px-6 pb-4 pt-6 text-center">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-50">
              <AlertTriangle className="h-6 w-6 text-red-500" />
            </div>
            <DialogTitle className="text-lg font-semibold text-[#191919]">
              Regenerate Presentation?
            </DialogTitle>
            <DialogDescription className="text-sm leading-relaxed text-gray-500">
              This will replace the current slides with a newly generated
              version and clear undo history. Your current edits may be lost.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-row border-t border-gray-100 p-0 sm:space-x-0">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setIsRegenerateConfirmOpen(false)}
              className="h-auto flex-1 rounded-none rounded-bl-2xl px-4 py-3.5 text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-700"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={handleReGenerate}
              className="h-auto flex-1 rounded-none rounded-br-2xl border-l border-gray-100 px-4 py-3.5 text-sm font-medium text-red-500 hover:bg-red-50 hover:text-red-600"
            >
              Regenerate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <KeyboardShortcutsDialog
        open={shortcutsDialogOpen}
        onOpenChange={setShortcutsDialogOpen}
      />
    </>
  );
};

export default PresentationHeader;
