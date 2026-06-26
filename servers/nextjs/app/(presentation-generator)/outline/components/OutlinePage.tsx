"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RootState } from "@/store/store";
import { useDispatch, useSelector } from "react-redux";
import { OverlayLoader } from "@/components/ui/overlay-loader";
import Wrapper from "@/components/Wrapper";
import OutlineContent from "./OutlineContent";
import EmptyStateView from "./EmptyStateView";
import GenerateButton from "./GenerateButton";

import { TABS } from "../types/index";
import { useOutlineStreaming } from "../hooks/useOutlineStreaming";
import { useOutlineManagement } from "../hooks/useOutlineManagement";
import { usePresentationGeneration } from "../hooks/usePresentationGeneration";
import TemplateSelection from "./TemplateSelection";
import { TemplateLayoutsWithSettings } from "@/app/presentation-templates/utils";
import { Separator } from "@/components/ui/separator";
import OutlinePromptBar from "./OutlinePromptBar";
import Chat from "../../presentation/components/Chat";
import { cn } from "@/lib/utils";
import { clearOutlines, setOutlines, setPresentationId } from "@/store/slices/presentationGeneration";
import { setPptGenUploadState } from "@/store/slices/presentationGenUpload";
import { LanguageType, PresentationConfig, ToneType, VerbosityType } from "../../upload/type";
import { PresentationGenerationApi } from "../../services/api/presentation-generation";
import { toast } from "sonner";

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

const getOutlinesFromResponse = (outline: any): { content: string }[] => {
  const slides = outline?.slides;
  if (!Array.isArray(slides)) {
    return [];
  }

  return slides.map((slide) => {
    const content = slide?.content;
    if (typeof content === "string") {
      return { content };
    }
    if (content == null) {
      return { content: "" };
    }
    return { content: String(content) };
  });
};

const OutlinePage: React.FC = () => {
  const dispatch = useDispatch();
  const { presentation_id, outlines } = useSelector(
    (state: RootState) => state.presentationGeneration
  );
  const { config: savedConfig, files } = useSelector(
    (state: RootState) => state.pptGenUpload
  );

  const [activeTab, setActiveTab] = useState<string>(TABS.LAYOUTS);
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateLayoutsWithSettings | string | null>(null);
  const [draftConfig, setDraftConfig] = useState<PresentationConfig>(
    savedConfig ?? DEFAULT_OUTLINE_CONFIG
  );
  const [isRegeneratingOutline, setIsRegeneratingOutline] = useState(false);
  const [hasOutlineStreamFinished, setHasOutlineStreamFinished] =
    useState(false);

  // Custom hooks
  const streamState = useOutlineStreaming(
    presentation_id,
    activeTab === TABS.OUTLINE
  );
  const { handleDragEnd, handleAddSlide } = useOutlineManagement(outlines);
  const { loadingState, handleSubmit } = usePresentationGeneration(
    presentation_id,
    outlines,
    selectedTemplate,
    setActiveTab
  );

  const documentPaths = useMemo(() => getDocumentPaths(files), [files]);
  const outlineControlsBusy =
    isRegeneratingOutline || streamState.isLoading || streamState.isStreaming;
  const hasSelectedTemplate = selectedTemplate !== null;
  const isOutlineReady =
    hasSelectedTemplate && hasOutlineStreamFinished && !outlineControlsBusy;
  const isRegenerateDisabled =
    !hasSelectedTemplate || (activeTab === TABS.OUTLINE && !isOutlineReady);
  const outlineStreamFinished =
    activeTab === TABS.OUTLINE &&
    !outlineControlsBusy &&
    (outlines.length > 0 || streamState.statusMessage === "Outline ready");

  useEffect(() => {
    if (savedConfig) {
      setDraftConfig(savedConfig);
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

  const handleTabChange = (tab: string) => {
    if (tab === TABS.OUTLINE) {
      if (!hasSelectedTemplate) {
        toast.error("Please select a template first");
        return;
      }

      if (!isOutlineReady) {
        return;
      }
    }

    if (streamState.isStreaming) {
      return;
    }
    setActiveTab(tab);

  };

  const handleConfigChange = (key: keyof PresentationConfig, value: unknown) => {
    setDraftConfig((previous) => ({
      ...previous,
      [key]: value,
    }));
  };

  const handleTemplateSelect = useCallback(
    (template: TemplateLayoutsWithSettings | string) => {
      setSelectedTemplate(template);
      setActiveTab(TABS.OUTLINE);
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

    if (activeTab === TABS.OUTLINE && !isOutlineReady) {
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
    try {
      const createResponse = await PresentationGenerationApi.createPresentation({
        content: draftConfig.prompt ?? "",
        n_slides: draftConfig.slides ? parseInt(draftConfig.slides, 10) : null,
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
      setActiveTab(TABS.OUTLINE);
    } catch (error: any) {
      console.error("Error regenerating outline", error);
      toast.error("Outline Error", {
        description: error.message || "Failed to regenerate outline.",
      });
    } finally {
      setIsRegeneratingOutline(false);
    }
  }, [
    activeTab,
    dispatch,
    documentPaths,
    draftConfig,
    files,
    hasSelectedTemplate,
    isOutlineReady,
    outlineControlsBusy,
  ]);

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

    await PresentationGenerationApi.updateOutlines(presentation_id, outlines);
  }, [outlines, presentation_id]);

  if (!presentation_id) {
    return <EmptyStateView />;
  }


  return (
    <div className="min-h-screen bg-[#F8F7FB] pb-9 font-syne">

      <OverlayLoader
        show={loadingState.isLoading}
        text={loadingState.message}
        showProgress={loadingState.showProgress}
        duration={loadingState.duration}
      />

      <Wrapper className="relative flex w-full flex-col px-5 sm:px-10 lg:px-20">
        <div className="w-full mx-auto">
          <Tabs value={activeTab} onValueChange={handleTabChange} className="flex w-full flex-col">
            <div
              className={cn(
                "w-full gap-5",
                activeTab === TABS.OUTLINE
                  ? "grid lg:grid-cols-[minmax(0,1fr)_352px]"
                  : "block"
              )}
            >
              <div className="min-w-0">
                <div className="pb-7 pt-2">
                  <OutlinePromptBar
                    config={draftConfig}
                    disabled={outlineControlsBusy}
                    isBusy={outlineControlsBusy}
                    regenerateDisabled={isRegenerateDisabled}
                    onConfigChange={handleConfigChange}
                    onRegenerate={handleRegenerateOutline}
                  />
                </div>

                <div className="mb-6">
                  <TabsList className="h-auto w-fit rounded-full border border-[#EDEEEF] bg-white p-1.5 shadow-sm">
                    <TabsTrigger
                      value={TABS.LAYOUTS}
                      className="relative rounded-full px-5 py-2 text-xs font-medium text-[#2D2D2D] shadow-none data-[state=active]:bg-[#F4F3FF] data-[state=active]:text-[#7E3AF2] data-[state=active]:shadow-none"
                    >
                      Select Template
                    </TabsTrigger>
                    <Separator orientation="vertical" className="mx-1 h-6" />
                    <TabsTrigger
                      value={TABS.OUTLINE}
                      disabled={!isOutlineReady}
                      className={cn(
                        "rounded-full px-5 py-2 text-xs font-medium text-[#2D2D2D] shadow-none data-[state=active]:bg-[#F4F3FF] data-[state=active]:text-[#7E3AF2] data-[state=active]:shadow-none",
                        !isOutlineReady && "cursor-not-allowed opacity-50"
                      )}
                    >
                      Outline & Content
                    </TabsTrigger>
                  </TabsList>
                </div>

                <TabsContent value={TABS.OUTLINE} className="mt-0 pb-24">
                  <OutlineContent
                    outlines={outlines}
                    isLoading={streamState.isLoading}
                    isStreaming={streamState.isStreaming}
                    activeSlideIndex={streamState.activeSlideIndex}
                    highestActiveIndex={streamState.highestActiveIndex}
                    statusMessage={streamState.statusMessage}
                    onDragEnd={handleDragEnd}
                    onAddSlide={handleAddSlide}
                  />
                </TabsContent>

                <TabsContent value={TABS.LAYOUTS} className="mt-0">
                  <TemplateSelection
                    selectedTemplate={selectedTemplate}
                    onSelectTemplate={handleTemplateSelect}
                  />
                </TabsContent>
              </div>

              {activeTab === TABS.OUTLINE && (
                <aside className="h-[min(760px,calc(100vh-250px))] overflow-hidden border border-[#EDEEEF] bg-white lg:sticky lg:top-[92px] lg:h-[min(760px,calc(100vh-250px))]">
                  <Chat
                    key={presentation_id}
                    presentationId={presentation_id}
                    variant="outline"
                    onBeforeSend={handleBeforeOutlineChatSend}
                    onPresentationChanged={handleOutlineChanged}
                  />
                </aside>
              )}
            </div>
          </Tabs>

          <div
            className={cn(
              "fixed bottom-[26px] z-50",
              activeTab === TABS.OUTLINE
                ? "left-5 sm:left-10 lg:left-auto lg:right-[calc(5rem+352px+2.5rem)]"
                : "right-[26px]"
            )}
          >
            <GenerateButton
              loadingState={loadingState}
              streamState={streamState}
              selectedTemplate={selectedTemplate}
              onSubmit={handleSubmit}
            />
          </div>
        </div>



      </Wrapper>
    </div>
  );
};

export default OutlinePage;
