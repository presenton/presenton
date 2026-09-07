"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useDispatch, useSelector } from "react-redux";
import { toast } from "sonner";

import { OverlayLoader } from "@/components/ui/overlay-loader";
import { cn } from "@/lib/utils";
import { RootState, store } from "@/store/store";
import {
  clearOutlines,
  setOutlines,
  setPresentationId,
} from "@/store/slices/presentationGeneration";
import { setPptGenUploadState } from "@/store/slices/presentationGenUpload";
import {
  clampSlideCountValue,
  limitOutlines,
  parseLimitedSlideCount,
  trimTextToWordLimit,
} from "@/utils/presentationLimits";
import { sanitizeAnalyticsError } from "@/utils/analytics";
import { MixpanelEvent, trackEvent } from "@/utils/mixpanel";

import Chat from "../../presentation/components/Chat";
import {
  LanguageType,
  PresentationConfig,
  ToneType,
  VerbosityType,
} from "../../upload/type";
import { PresentationGenerationApi } from "../../services/api/presentation-generation";
import { useOutlineManagement } from "../hooks/useOutlineManagement";
import { useOutlineStreaming } from "../hooks/useOutlineStreaming";
import { usePresentationGeneration } from "../hooks/usePresentationGeneration";
import EmptyStateView from "./EmptyStateView";
import GenerateButton from "./GenerateButton";
import OutlineContent from "./OutlineContent";
import OutlinePromptBar from "./OutlinePromptBar";
import OutlineStandardHeader from "./OutlineStandardHeader";
import TemplateSelection from "./TemplateSelection";

const DEFAULT_OUTLINE_CONFIG: PresentationConfig = {
  slides: null,
  language: LanguageType.Auto,
  prompt: "",
  tone: ToneType.Default,
  verbosity: VerbosityType.Standard,
  instructions: "",
  includeTableOfContents: false,
  includeTitleSlide: false,
  webSearch: false,
};

const normalizeOutlineConfig = (
  config: PresentationConfig
): PresentationConfig => ({
  ...config,
  slides: config.slides ? clampSlideCountValue(config.slides) || null : null,
});

const getDocumentPaths = (files: unknown): string[] => {
  if (!Array.isArray(files)) {
    return [];
  }

  return files
    .flat()
    .map((file) =>
      file && typeof file === "object" && "file_path" in file
        ? (file as { file_path?: unknown }).file_path
        : null
    )
    .filter((filePath): filePath is string => typeof filePath === "string");
};

const getOutlinesFromResponse = (outline: unknown): { content: string }[] => {
  if (!outline || typeof outline !== "object") {
    return [];
  }

  const slides = (outline as { slides?: unknown }).slides;
  if (!Array.isArray(slides)) {
    return [];
  }

  return limitOutlines(
    slides.map((slide) => {
      const content =
        slide && typeof slide === "object"
          ? (slide as { content?: unknown }).content
          : null;

      if (typeof content === "string") {
        return { content };
      }
      if (content == null) {
        return { content: "" };
      }
      return { content: String(content) };
    })
  );
};

const scrollToPageTop = () => {
  window.requestAnimationFrame(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  });
};

const OutlinePage: React.FC = () => {
  const dispatch = useDispatch();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { presentation_id: storedPresentationId, outlines } = useSelector(
    (state: RootState) => state.presentationGeneration
  );
  const queryPresentationId = searchParams.get("id")?.trim() || null;
  const suggestedTemplate = searchParams.get("template")?.trim() || null;
  const presentation_id = queryPresentationId || storedPresentationId;
  const { config: savedConfig, files } = useSelector(
    (state: RootState) => state.pptGenUpload
  );

  const [isTemplateStage, setIsTemplateStage] = useState(true);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(
    null
  );
  const [draftConfig, setDraftConfig] = useState<PresentationConfig>(
    savedConfig ? normalizeOutlineConfig(savedConfig) : DEFAULT_OUTLINE_CONFIG
  );
  const [isRegeneratingOutline, setIsRegeneratingOutline] = useState(false);
  const [hasOutlineStreamFinished, setHasOutlineStreamFinished] =
    useState(false);

  const hasSelectedTemplate = selectedTemplateId !== null;
  const streamState = useOutlineStreaming(
    presentation_id,
    !isTemplateStage && hasSelectedTemplate
  );
  const { handleDragEnd, handleAddSlide } = useOutlineManagement(outlines);
  const { loadingState, handleSubmit } = usePresentationGeneration(
    presentation_id,
    selectedTemplateId
  );

  const documentPaths = useMemo(() => getDocumentPaths(files), [files]);
  const outlineControlsBusy =
    isRegeneratingOutline || streamState.isLoading || streamState.isStreaming;
  const isOutlineReady =
    hasSelectedTemplate && hasOutlineStreamFinished && !outlineControlsBusy;
  const isOutlineAssistantVisible = !isTemplateStage && hasSelectedTemplate;
  const isRegenerateDisabled = !isOutlineReady;
  const outlineStreamFinished =
    !isTemplateStage &&
    !outlineControlsBusy &&
    (outlines.length > 0 || streamState.statusMessage === "Outline ready");

  useEffect(() => {
    if (queryPresentationId && queryPresentationId !== storedPresentationId) {
      dispatch(setPresentationId(queryPresentationId));
    }
  }, [dispatch, queryPresentationId, storedPresentationId]);

  useEffect(() => {
    if (savedConfig) {
      setDraftConfig(normalizeOutlineConfig(savedConfig));
    }
  }, [savedConfig]);

  useEffect(() => {
    setHasOutlineStreamFinished(false);
  }, [presentation_id]);

  useEffect(() => {
    if (!presentation_id || !hasSelectedTemplate) {
      setHasOutlineStreamFinished(false);
      return;
    }

    if (outlineStreamFinished) {
      setHasOutlineStreamFinished(true);
    }
  }, [hasSelectedTemplate, outlineStreamFinished, presentation_id]);

  const handleReturnToTemplates = () => {
    if (streamState.isStreaming) return;
    setIsTemplateStage(true);
    scrollToPageTop();
  };

  const handleConfigChange = (
    key: keyof PresentationConfig,
    value: unknown
  ) => {
    const nextValue =
      key === "slides" && typeof value === "string"
        ? clampSlideCountValue(value)
        : value;

    setDraftConfig((previous) => ({
      ...previous,
      [key]: nextValue,
    }));
  };

  const handleTemplateSelect = useCallback(
    (template: {
      id: string;
      name: string;
      source: "default" | "custom";
      position: number;
    }) => {
      setSelectedTemplateId(template.id);
      setIsTemplateStage(false);
      scrollToPageTop();
    },
    []
  );

  const handleRegenerateOutline = useCallback(async () => {
    if (outlineControlsBusy) {
      return;
    }

    if (!hasSelectedTemplate) {
      toast.error("Please select a template first");
      return;
    }

    if (!isOutlineReady) {
      return;
    }

    if (!draftConfig.language) {
      toast.error("Please select language");
      return;
    }

    if (documentPaths.length > 0 && draftConfig.language === LanguageType.Auto) {
      toast.error("Please choose a language before regenerating from documents");
      return;
    }

    if (!draftConfig.prompt.trim() && documentPaths.length === 0) {
      toast.error("No Prompt or Document Provided");
      return;
    }

    setIsRegeneratingOutline(true);
    setHasOutlineStreamFinished(false);
    trackEvent(MixpanelEvent.TemplateV2_Outline_Regeneration_Started, {
      presentation_id,
      template_id: selectedTemplateId,
      prompt_present: draftConfig.prompt.trim().length > 0,
      document_count: documentPaths.length,
      slide_count: parseLimitedSlideCount(draftConfig.slides),
      language: draftConfig.language,
      tone: draftConfig.tone,
      verbosity: draftConfig.verbosity,
      web_search: !!draftConfig.webSearch,
      include_title_slide: !!draftConfig.includeTitleSlide,
      include_table_of_contents: !!draftConfig.includeTableOfContents,
    });

    try {
      const createResponse = await PresentationGenerationApi.createPresentation({
        content: draftConfig.prompt ?? "",
        n_slides: parseLimitedSlideCount(draftConfig.slides),
        file_paths: documentPaths,
        language: draftConfig.language ?? "",
        tone: draftConfig.tone,
        verbosity: draftConfig.verbosity,
        instructions: draftConfig.instructions || null,
        include_table_of_contents: !!draftConfig.includeTableOfContents,
        include_title_slide: !!draftConfig.includeTitleSlide,
        web_search: !!draftConfig.webSearch,
      });

      dispatch(setPptGenUploadState({ config: draftConfig, files }));
      dispatch(clearOutlines());
      dispatch(setPresentationId(createResponse.id));
      trackEvent(MixpanelEvent.TemplateV2_Outline_Regeneration_Completed, {
        old_presentation_id: presentation_id,
        new_presentation_id: createResponse.id,
        template_id: selectedTemplateId,
      });
      setIsTemplateStage(false);
    } catch (error: unknown) {
      console.error("Error regenerating outline", error);
      trackEvent(MixpanelEvent.TemplateV2_Outline_Regeneration_Failed, {
        presentation_id,
        template_id: selectedTemplateId,
        error_message: sanitizeAnalyticsError(
          error,
          "Failed to regenerate outline"
        ),
      });
      toast.error("Outline Error", {
        description:
          error instanceof Error
            ? error.message
            : "Failed to regenerate outline.",
      });
    } finally {
      setIsRegeneratingOutline(false);
    }
  }, [
    dispatch,
    documentPaths,
    draftConfig,
    files,
    hasSelectedTemplate,
    isOutlineReady,
    outlineControlsBusy,
    presentation_id,
    selectedTemplateId,
  ]);

  const handleUpdateOutline = (index: number, newContent: string) => {
    const slideIndex = index - 1;
    if (!outlines[slideIndex]) return;

    const limitedContent = trimTextToWordLimit(newContent);
    if (outlines[slideIndex].content === limitedContent) return;

    const updatedOutlines = [...outlines];
    updatedOutlines[slideIndex] = {
      ...updatedOutlines[slideIndex],
      content: limitedContent,
    };
    dispatch(setOutlines(updatedOutlines));
  };

  const handleOutlineChanged = useCallback(async () => {
    if (!presentation_id) {
      return;
    }

    const outline = await PresentationGenerationApi.getOutlines(presentation_id);
    dispatch(setOutlines(getOutlinesFromResponse(outline)));
  }, [dispatch, presentation_id]);

  const handleBeforeOutlineChatSend = useCallback(async () => {
    if (!presentation_id) {
      return;
    }

    const latestOutlines =
      store.getState().presentationGeneration.outlines;
    await PresentationGenerationApi.updateOutlines(
      presentation_id,
      latestOutlines
    );
  }, [presentation_id]);

  if (!presentation_id) {
    return (
      <div className="min-h-screen bg-[#FEFEFF]">
        <OutlineStandardHeader
          title="Outline Generation"
          onBack={() => router.push("/dashboard")}
        />
        <EmptyStateView />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "min-h-screen overflow-x-clip font-syne",
        isTemplateStage ? "bg-[#FEFEFF]" : "bg-[#F6F6F9]"
      )}
    >
      <OverlayLoader
        show={loadingState.isLoading}
        text={loadingState.message}
        showProgress={loadingState.showProgress}
        duration={loadingState.duration}
      />

      <OutlineStandardHeader
        title={isTemplateStage ? "Select Template" : "Outline Generation"}
        onBack={() => {
          if (isTemplateStage) {
            router.push("/dashboard");
            return;
          }
          handleReturnToTemplates();
        }}
      />

      {isTemplateStage ? (
        <main className="mx-auto w-full max-w-[1440px] px-5 pb-12 pt-10 sm:px-10 lg:px-20">
          <TemplateSelection
            presentationId={presentation_id}
            selectedTemplateId={selectedTemplateId}
            suggestedTemplate={suggestedTemplate}
            onSuggestedTemplateResolved={(template) =>
              setSelectedTemplateId((current) => current ?? template.id)
            }
            onSelectTemplate={handleTemplateSelect}
          />
        </main>
      ) : (
        <>
          <div className="lg:mr-[369px]">
            <main className="mx-auto w-[calc(100%-2.5rem)] max-w-[967px] pb-28 pt-10 sm:w-[calc(100%-5rem)]">
              <OutlinePromptBar
                config={draftConfig}
                disabled={outlineControlsBusy}
                isBusy={outlineControlsBusy}
                regenerateDisabled={isRegenerateDisabled}
                onConfigChange={handleConfigChange}
                onRegenerate={handleRegenerateOutline}
              />

              <div className="mt-12">
                <OutlineContent
                  outlines={outlines}
                  isLoading={streamState.isLoading}
                  isStreaming={streamState.isStreaming}
                  activeSlideIndex={streamState.activeSlideIndex}
                  highestActiveIndex={streamState.highestActiveIndex}
                  statusMessage={streamState.statusMessage}
                  onDragEnd={handleDragEnd}
                  onAddSlide={handleAddSlide}
                  onUpdateOutline={handleUpdateOutline}
                />
              </div>
            </main>
          </div>

          {isOutlineAssistantVisible && (
            <aside className="mx-auto mb-28 mt-8 flex h-[600px] w-[calc(100%-2.5rem)] overflow-hidden border border-[#EDEEEF] bg-[#FEFEFF] sm:w-[calc(100%-5rem)] lg:fixed lg:bottom-0 lg:right-0 lg:top-[68px] lg:z-40 lg:mx-0 lg:mb-0 lg:mt-0 lg:h-auto lg:w-[369px] lg:border-0">
              <nav
                className="flex w-[70px] shrink-0 flex-col items-center gap-5 px-1.5 py-2"
                aria-label="Outline tools"
              >
                <div className="flex w-full flex-col items-center rounded-[10px] bg-[#EFF6FF]/60 py-7">
                  <div className="flex rounded-[10px] border border-[#EDEEEF] bg-white p-1.5 shadow-[0_6.6px_6.6px_rgba(124,81,248,0.14)]">
                    <Image
                      src="/ai-star.svg"
                      alt=""
                      width={19}
                      height={18}
                      className="h-[18px] w-[19px]"
                    />
                  </div>
                  <span className="mt-1 text-xs font-normal text-[#2563EB]">
                    AI
                  </span>
                </div>
                <span
                  className="h-px w-[30px] bg-[#EDEEEF]"
                  aria-hidden="true"
                />
              </nav>

              <div className="min-w-0 flex-1">
                <Chat
                  key={presentation_id}
                  presentationId={presentation_id}
                  variant="outline"
                  useEditorLayout
                  inputDisabled={!isOutlineReady}
                  onBeforeSend={handleBeforeOutlineChatSend}
                  onPresentationChanged={handleOutlineChanged}
                />
              </div>
            </aside>
          )}

          <div className="pointer-events-none fixed bottom-6 left-5 right-5 z-50 flex justify-center sm:left-10 sm:right-10 lg:left-0 lg:right-[369px]">
            <div className="pointer-events-auto">
              <GenerateButton
                loadingState={loadingState}
                streamState={streamState}
                selectedTemplateId={selectedTemplateId}
                onSubmit={handleSubmit}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default OutlinePage;
