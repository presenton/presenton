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

const MAX_EXPORT_TITLE_LENGTH = 40;

const buildSafeExportFileName = (
  rawTitle: string | null | undefined,
  extension: "pdf" | "pptx" | "mp4"
) => {
  const normalizedTitle = (rawTitle || "presentation").trim();
  const titleWithoutExtension = normalizedTitle.replace(/\.(pdf|pptx|mp4)$/i, "");

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

  const handleExportVideo = async () => {
    if (isStreaming) return;

    const exportId = uuidv4();
    const exportStartedAt = Date.now();
    const exportRuntime: "electron" | "browser_api" = "browser_api"; // video export always runs server-side, never via Electron IPC
    let exportToastId: string | number | undefined;
    try {
      exportToastId = notify.loading(
        "Exporting Video",
        "Generating narration and assembling your video. This can take a while for longer decks."
      );
      setIsExporting(true);
      await trackExportLifecycle(
        MixpanelEvent.Presentation_Export_Started,
        "mp4",
        exportRuntime,
        exportId,
        exportStartedAt
      );

      const kickoffResponse = await fetch("/api/export-presentation-video", {
        method: "POST",
        body: JSON.stringify({ id: presentation_id }),
      });
      if (!kickoffResponse.ok) {
        throw new Error("Failed to start video export");
      }
      const startedTask = await kickoffResponse.json();
      const taskId: string | undefined = startedTask?.id;
      if (!taskId) {
        throw new Error("No task id returned from video export");
      }

      let finalTask = startedTask;
      const pollIntervalMs = 3000;
      const maxAttempts = 400; // ~20 minute ceiling
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
        const statusResponse = await fetch(
          `/api/export-presentation-video/status?taskId=${encodeURIComponent(
            taskId
          )}`,
          { cache: "no-store" }
        );
        if (!statusResponse.ok) {
          throw new Error("Failed to check video export status");
        }
        finalTask = await statusResponse.json();

        if (finalTask?.status === "completed") break;
        if (finalTask?.status === "error") {
          throw new Error(
            finalTask?.error?.detail || finalTask?.message || "Video export failed"
          );
        }

        const completedSlides = finalTask?.data?.completed_slides;
        const totalSlides = finalTask?.data?.total_slides;
        const progressMessage =
          typeof completedSlides === "number" &&
          typeof totalSlides === "number" &&
          totalSlides > 0
            ? `${finalTask?.message || "Working"} (${completedSlides}/${totalSlides} slides)`
            : finalTask?.message ||
              "Generating narration and assembling your video.";
        notify.loading("Exporting Video", progressMessage, {
          id: exportToastId,
        });
      }

      if (finalTask?.status !== "completed") {
        throw new Error("Video export timed out");
      }

      const videoPath: string | undefined = finalTask?.data?.path;
      const relativeVideoPath: string | undefined =
        finalTask?.data?.relative_path;
      if (!videoPath && !relativeVideoPath) {
        throw new Error("No video path returned from export");
      }

      const safeVideoFileName = buildSafeExportFileName(
        presentationData?.title,
        "mp4"
      );
      // Prefer the path relative to the (unscoped) videos root, since the
      // file actually lives under a per-owner "users/<id>/" subdirectory --
      // falling back to the bare filename only for older task payloads.
      const videoUrlName =
        relativeVideoPath || videoPath?.split("/").pop() || "";
      downloadLink(
        `/api/export-presentation-video/file?name=${encodeURIComponent(
          videoUrlName
        )}`,
        safeVideoFileName
      );

      await trackExportLifecycle(
        MixpanelEvent.Presentation_Export_Completed,
        "mp4",
        exportRuntime,
        exportId,
        exportStartedAt
      );
      notify.success(
        "Export complete",
        "Your narrated video has been downloaded.",
        { id: exportToastId }
      );
    } catch (error) {
      console.error("Video export failed:", error);
      await trackExportLifecycle(
        MixpanelEvent.Presentation_Export_Failed,
        "mp4",
        exportRuntime,
        exportId,
        exportStartedAt,
        error
      );
      notify.error(
        "Export failed",
        "We are having trouble exporting your video. Please try again.",
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
    format: "pptx" | "pdf" | "mp4",
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
          onClick={() => {
            handleExportVideo();
            setOpen(false);
          }}
          variant="ghost"
          className={`w-full flex px-0 justify-start text-xs text-black hover:bg-transparent  ${mobile ? "bg-white py-6" : ""
            }`}
        >
          Video
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
            className="min-w-0 flex-1 bg-transparent py-2 pr-2 font-unbounded text-base leading-tight text-[#101323] placeholder:text-[#101323]/35 outline-none border-0 focus:ring-0"
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
          <h2 className="min-w-0 flex-1 font-unbounded text-lg w-[450px] leading-snug text-[#101323]">
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
      <div className="py-[18px] px-4 sticky top-0 bg-white z-50 shadow-sm font-syne flex justify-between items-center gap-4">
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
