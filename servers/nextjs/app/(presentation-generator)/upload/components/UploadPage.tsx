/**
 * UploadPage Component
 * 
 * This component handles the presentation generation upload process, allowing users to:
 * - Configure presentation settings (slides, language)
 * - Input prompts
 * - Upload supporting documents
 * 
 * @component
 */

"use client";
import React, { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useDispatch, useSelector } from "react-redux";
import { clearOutlines, setPresentationId } from "@/store/slices/presentationGeneration";
import { PromptInput } from "./PromptInput";
import { LanguageType, PresentationConfig, ToneType, VerbosityType } from "../type";
import SupportingDoc from "./SupportingDoc";
import { notify } from "@/components/ui/sonner";
import { PresentationGenerationApi } from "../../services/api/presentation-generation";
import { OverlayLoader } from "@/components/ui/overlay-loader";
import Wrapper from "@/components/Wrapper";
import { setPptGenUploadState } from "@/store/slices/presentationGenUpload";
import { trackEvent, MixpanelEvent } from "@/utils/mixpanel";
import { sanitizeAnalyticsError } from "@/utils/analytics";
import { ConfigurationSelects } from "./ConfigurationSelects";
import { RootState } from "@/store/store";
import { ImagesApi } from "../../services/api/images";
import CurrentConfig from "./CurrentConfig";
import { LLMConfig } from "@/types/llm_config";
import {
  clampSlideCountValue,
  parseLimitedSlideCount,
} from "@/utils/presentationLimits";
import {
  type GenerationMode,
  type PresentationGenerationMode,
  getInitialGenerationMode,
  isGenerationModeAvailable,
} from "@/utils/presentationGenerationMode";

const STOCK_IMAGE_PROVIDERS = new Set(["pexels", "pixabay"]);
const FILE_TYPE_WORD = new Set([".doc", ".docx", ".docm", ".odt", ".rtf"]);
const FILE_TYPE_PRESENTATION = new Set([".ppt", ".pptx", ".pptm", ".odp"]);
const FILE_TYPE_SPREADSHEET = new Set([".xls", ".xlsx", ".xlsm", ".ods", ".csv", ".tsv"]);
const FILE_TYPE_IMAGE = new Set([".jpg", ".jpeg", ".png", ".gif", ".bmp", ".tiff", ".webp"]);
const FILE_MIME_IMAGE = new Set(["image/jpeg", "image/png", "image/gif", "image/bmp", "image/tiff", "image/webp"]);
const FILE_TYPE_PDF = new Set([".pdf"]);
const FILE_TYPE_TEXT = new Set([".txt"]);
// Types for loading state
interface LoadingState {
  isLoading: boolean;
  message: string;
  duration?: number;
  showProgress?: boolean;
  extra_info?: string;
}

const getFileExtension = (fileName: string): string => {
  const index = fileName.lastIndexOf(".");
  if (index < 0) return "";
  return fileName.slice(index).toLowerCase();
};

const getFileCategory = (file: File): string => {
  const extension = getFileExtension(file.name || "");
  if (FILE_TYPE_WORD.has(extension)) return "word";
  if (FILE_TYPE_PRESENTATION.has(extension)) return "presentation";
  if (FILE_TYPE_SPREADSHEET.has(extension)) return "spreadsheet";
  if (FILE_TYPE_IMAGE.has(extension) || FILE_MIME_IMAGE.has((file.type || "").toLowerCase())) return "image";
  if (FILE_TYPE_PDF.has(extension) || file.type === "application/pdf") return "pdf";
  if (FILE_TYPE_TEXT.has(extension) || file.type === "text/plain") return "text";
  return "other";
};

const getSelectedTextModel = (config?: LLMConfig): string => {
  if (!config) return "";
  switch (config.LLM) {
    case "openai":
      return config.OPENAI_MODEL || "";
    case "deepseek":
      return config.DEEPSEEK_MODEL || "";
    case "google":
      return config.GOOGLE_MODEL || "";
    case "vertex":
      return config.VERTEX_MODEL || "";
    case "azure":
      return config.AZURE_OPENAI_MODEL || "";
    case "bedrock":
      return config.BEDROCK_MODEL || "";
    case "openrouter":
      return config.OPENROUTER_MODEL || "";
    case "conifer":
      return config.CONIFER_MODEL || "";
    case "fireworks":
      return config.FIREWORKS_MODEL || "";
    case "together":
      return config.TOGETHER_MODEL || "";
    case "cerebras":
      return config.CEREBRAS_MODEL || "";
    case "litellm":
      return config.LITELLM_MODEL || "";
    case "lmstudio":
      return config.LMSTUDIO_MODEL || "";
    case "anthropic":
      return config.ANTHROPIC_MODEL || "";
    case "ollama":
      return config.OLLAMA_MODEL || "";
    case "custom":
      return config.CUSTOM_MODEL || "";
    case "codex":
      return config.CODEX_MODEL || "";
    default:
      return "";
  }
};

const getSelectedImageQuality = (config?: LLMConfig): string => {
  if (!config) return "";
  if (config.IMAGE_PROVIDER === "dall-e-3") return config.DALL_E_3_QUALITY || "";
  if (config.IMAGE_PROVIDER === "gpt-image-1.5") return config.GPT_IMAGE_1_5_QUALITY || "";
  return "";
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

type UploadPageProps = {
  presentationGenerationMode: PresentationGenerationMode;
};

const UploadPage = ({ presentationGenerationMode }: UploadPageProps) => {
  const router = useRouter();
  const pathname = usePathname();
  const dispatch = useDispatch();
  const llmConfig = useSelector((state: RootState) => state.userConfig.llm_config);

  const [files, setFiles] = useState<File[]>([]);
  const [generationMode, setGenerationMode] = useState<GenerationMode>(() =>
    getInitialGenerationMode(presentationGenerationMode),
  );
  const [config, setConfig] = useState<PresentationConfig>({
    slides: null,
    language: LanguageType.Auto,
    prompt: "",
    tone: ToneType.Default,
    verbosity: VerbosityType.Standard,
    instructions: "",
    includeTableOfContents: false,
    includeTitleSlide: false,
    webSearch: false,
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requestedPrompt = params.get("prompt")?.trim();

    const requestedMode = params.get("mode");
    if (
      (requestedMode === "standard" || requestedMode === "smart") &&
      isGenerationModeAvailable(presentationGenerationMode, requestedMode)
    ) {
      setGenerationMode(requestedMode);
    } else {
      setGenerationMode(getInitialGenerationMode(presentationGenerationMode));
    }
    if (requestedPrompt) {
      setConfig((current) => ({ ...current, prompt: requestedPrompt }));
    }
  }, [pathname, presentationGenerationMode]);

  useEffect(() => {
    if (llmConfig?.WEB_GROUNDING !== undefined) {
      setConfig((current) => ({
        ...current,
        webSearch: !!llmConfig.WEB_GROUNDING,
      }));
    }
  }, [llmConfig?.WEB_GROUNDING]);

  const [loadingState, setLoadingState] = useState<LoadingState>({
    isLoading: false,
    message: "",
    duration: 4,
    showProgress: false,
    extra_info: "",
  });

  const getUploadSnapshotProps = () => {
    const trimmedPrompt = config.prompt.trim();
    const trimmedInstructions = (config.instructions || "").trim();
    const attachmentCategories = Array.from(new Set(files.map(getFileCategory))).sort();
    const imageGenerationEnabled = !llmConfig?.DISABLE_IMAGE_GENERATION;
    const parsedSlides = parseLimitedSlideCount(config.slides);

    return {
      pathname,
      generation_path: files.length > 0 ? "documents" : "prompt_only",
      slides_selected: parsedSlides,
      slides_mode: config.slides ? "selected" : "auto",
      language: config.language || "",
      tone: config.tone,
      verbosity: config.verbosity,
      include_table_of_contents: !!config.includeTableOfContents,
      include_title_slide: !!config.includeTitleSlide,
      web_search: !!config.webSearch,
      generation_mode: generationMode,
      has_prompt: Boolean(trimmedPrompt),
      prompt_char_count: trimmedPrompt.length,
      prompt_word_count: trimmedPrompt ? trimmedPrompt.split(/\s+/).filter(Boolean).length : 0,
      has_instructions: Boolean(trimmedInstructions),
      instructions_char_count: trimmedInstructions.length,
      has_attachments: files.length > 0,
      attachments_count: files.length,
      attachment_categories: attachmentCategories.join(","),
      text_provider: llmConfig?.LLM || "",
      text_model: getSelectedTextModel(llmConfig),
      image_generation_enabled: imageGenerationEnabled,
      image_provider: imageGenerationEnabled ? (llmConfig?.IMAGE_PROVIDER || "") : "disabled",
      image_quality: imageGenerationEnabled ? getSelectedImageQuality(llmConfig) : "",
    };
  };

  const trackUploadValidationFailure = (reason: string) => {
    trackEvent(MixpanelEvent.Upload_Configuration_Invalid, {
      ...getUploadSnapshotProps(),
      reason,
    });
  };

  const handleConfigChange = (key: keyof PresentationConfig, value: unknown) => {
    const nextValue =
      key === "slides" && typeof value === "string"
        ? clampSlideCountValue(value)
        : value;
    setConfig((prev) => ({ ...prev, [key]: nextValue } as PresentationConfig));
  };

  const handleGenerationModeChange = (mode: GenerationMode) => {
    if (!isGenerationModeAvailable(presentationGenerationMode, mode)) return;
    if (mode === generationMode) return;
    const previousMode = generationMode;
    setGenerationMode(mode);
    if (mode === "smart") {
      trackEvent(MixpanelEvent.Smart_Mode_Selected, {
        pathname,
        source: "upload_mode_selector",
        previous_generation_mode: previousMode,
      });
    }
  };

  const getGenerationDestination = (presentationId: string) => {
    if (generationMode === "smart") {
      return `/presentation?id=${presentationId}&stream=true&type=smart`;
    }

    const params = new URLSearchParams({ id: presentationId });
    return `/outline?${params.toString()}`;
  };

  const ensureStockImageProviderReady = async (): Promise<boolean> => {
    if (llmConfig?.DISABLE_IMAGE_GENERATION) {
      return true;
    }

    const selectedProvider = (llmConfig?.IMAGE_PROVIDER || "").toLowerCase();
    if (!STOCK_IMAGE_PROVIDERS.has(selectedProvider)) {
      return true;
    }

    try {
      const providerApiKey =
        selectedProvider === "pexels"
          ? llmConfig?.PEXELS_API_KEY
          : llmConfig?.PIXABAY_API_KEY;
      await ImagesApi.searchStockImages("business", 1, {
        provider: selectedProvider,
        apiKey: providerApiKey,
        strictApiKey: true,
      });
      return true;
    } catch (error: any) {
      notify.error(
        "Image provider unavailable",
        error?.message ||
        `Unable to reach ${selectedProvider} right now. Please check your API key/settings and try again.`
      );
      return false;
    }
  };

  /**
   * Validates the current configuration and files
   * @returns boolean indicating if the configuration is valid
   */
  const validateConfiguration = (): boolean => {
    if (!config.language) {
      trackUploadValidationFailure("language_missing");
      notify.warning("Language required", "Please select a language.");
      return false;
    }

    if (files.length > 0 && config.language === LanguageType.Auto) {
      trackUploadValidationFailure("language_auto_with_documents");
      notify.warning("Language required", "Please choose a language before processing uploaded documents.");
      return false;
    }

    if (!config.prompt.trim() && files.length === 0) {
      trackUploadValidationFailure("prompt_or_document_missing");
      notify.warning(
        "Input required",
        "Provide a prompt or upload a document."
      );
      return false;
    }
    return true;
  };

  /**
   * Handles the presentation generation process
   */
  const handleGeneratePresentation = async () => {
    if (!validateConfiguration()) return;
    const snapshot = getUploadSnapshotProps();
    trackEvent(MixpanelEvent.Upload_Generation_Started, snapshot);
    if (generationMode === "smart") {
      trackEvent(MixpanelEvent.Smart_Mode_Generation_Started, {
        ...snapshot,
        source: "upload",
      });
    }

    try {
      const isStockProviderReady =
        generationMode === "smart" || (await ensureStockImageProviderReady());
      if (!isStockProviderReady) {
        trackUploadValidationFailure("stock_image_provider_unreachable");
        return;
      }

      const hasUploadedAssets = files.length > 0;

      if (hasUploadedAssets) {
        await handleDocumentProcessing();
      } else {
        await handleDirectPresentationGeneration();
      }
    } catch (error) {
      handleGenerationError(error);
    }
  };

  /**
   * Handles document processing
   */
  const handleDocumentProcessing = async () => {
    setLoadingState({
      isLoading: true,
      message: "Processing documents...",
      showProgress: true,
      duration: 90,
      extra_info: files.length > 0 ? "It might take a few minutes for large documents." : "",
    });

    let documents = [];

    if (files.length > 0) {
      const uploadResponse = await PresentationGenerationApi.uploadDoc(files);
      documents = uploadResponse;
    }

    const selectedLanguage = config?.language ?? "";

    const promises: Promise<any>[] = [];

    if (documents.length > 0) {
      promises.push(
        PresentationGenerationApi.decomposeDocuments(
          documents,
          selectedLanguage
        )
      );
    }
    const responses = await Promise.all(promises);
    const documentPaths = getDocumentPaths(responses);

    setLoadingState({
      isLoading: true,
      message:
        generationMode === "smart"
          ? "Starting Smart presentation..."
          : "Generating presentation outline...",
      showProgress: true,
      duration: 40,
      extra_info: "",
    });

    const createResponse = await PresentationGenerationApi.createPresentation({
      content: config?.prompt ?? "",
      version: "v2-standard",
      n_slides: parseLimitedSlideCount(config?.slides),
      file_paths: documentPaths,
      language: selectedLanguage,
      tone: config?.tone,
      verbosity: config?.verbosity,
      instructions: config?.instructions || null,
      include_table_of_contents: !!config?.includeTableOfContents,
      include_title_slide: !!config?.includeTitleSlide,
      web_search: !!config?.webSearch,
      generation_mode: generationMode,
    });

    dispatch(setPptGenUploadState({
      config,
      files: responses,
    }));
    dispatch(clearOutlines());
    dispatch(setPresentationId(createResponse.id));
    trackEvent(MixpanelEvent.Upload_Documents_Processed, {
      ...getUploadSnapshotProps(),
      uploaded_documents_count: documents.length,
      decompose_job_count: responses.length,
      extracted_document_count: documentPaths.length,
      destination:
        generationMode === "smart" ? "/presentation" : "/outline",
    });
    trackEvent(MixpanelEvent.Upload_Outline_Generation_Requested, {
      ...getUploadSnapshotProps(),
      presentation_id: createResponse.id,
      uploaded_documents_count: documents.length,
      extracted_document_count: documentPaths.length,
      destination:
        generationMode === "smart" ? "/presentation" : "/outline",
    });
    const destination = getGenerationDestination(createResponse.id);
    trackEvent(MixpanelEvent.Navigation, { from: pathname, to: destination });
    router.push(destination);
  };

  /**
   * Handles direct presentation generation without documents
   */
  const handleDirectPresentationGeneration = async () => {
    setLoadingState({
      isLoading: true,
      message:
        generationMode === "smart"
          ? "Starting Smart presentation..."
          : "Preparing outline generation...",
      showProgress: true,
      duration: 30,
    });

    const selectedLanguage = config?.language ?? "";

    // Standard mode continues to outline review; Smart mode streams the deck directly.
    const createResponse = await PresentationGenerationApi.createPresentation({
      content: config?.prompt ?? "",

      n_slides: parseLimitedSlideCount(config?.slides),
      file_paths: [],
      language: selectedLanguage,
      tone: config?.tone,
      verbosity: config?.verbosity,
      instructions: config?.instructions || null,
      include_table_of_contents: !!config?.includeTableOfContents,
      include_title_slide: !!config?.includeTitleSlide,
      web_search: !!config?.webSearch,
      generation_mode: generationMode,
    });

    dispatch(setPptGenUploadState({
      config,
      files: [],
    }));
    dispatch(clearOutlines());
    dispatch(setPresentationId(createResponse.id));
    trackEvent(MixpanelEvent.Upload_Outline_Generation_Requested, {
      ...getUploadSnapshotProps(),
      presentation_id: createResponse.id,
      destination:
        generationMode === "smart" ? "/presentation" : "/outline",
    });
    const destination = getGenerationDestination(createResponse.id);
    trackEvent(MixpanelEvent.Navigation, { from: pathname, to: destination });
    router.push(destination);
  };

  /**
   * Handles errors during presentation generation
   */
  const handleGenerationError = (error: any) => {
    console.error("Error in upload page", error);
    if (generationMode === "smart") {
      trackEvent(MixpanelEvent.Smart_Mode_Generation_Failed, {
        ...getUploadSnapshotProps(),
        stage: "presentation_setup",
        error_message: sanitizeAnalyticsError(error, "Generation setup failed"),
      });
    }
    setLoadingState({
      isLoading: false,
      message: "",
      duration: 0,
      showProgress: false,
    });
    notify.error(
      "Generation failed",
      error.message || "Something went wrong while starting your presentation."
    );
  };

  return (
    <Wrapper className="w-full pb-10">
      <OverlayLoader
        show={loadingState.isLoading}
        text={loadingState.message}
        showProgress={loadingState.showProgress}
        duration={loadingState.duration}
        extra_info={loadingState.extra_info}
      />
      <div className="mx-auto mb-8 max-w-[760px] space-y-[18px] px-4 lg:max-w-[780px] xl:max-w-[900px] min-[1600px]:max-w-[1050px] min-[1920px]:max-w-[1280px]">
        <div className="flex min-h-[34px] w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <CurrentConfig webSearchEnabled={config.webSearch} />
          </div>
          <ConfigurationSelects
            compact
            mode={generationMode}
            onModeChange={
              presentationGenerationMode === "both"
                ? handleGenerationModeChange
                : undefined
            }
            config={config}
            onConfigChange={handleConfigChange}
          />
        </div>

        <PromptInput
          value={config.prompt}
         
          onChange={(value) => handleConfigChange("prompt", value)}
          onSubmit={handleGeneratePresentation}
          hasAttachments={files.length > 0}
          footer={
            <SupportingDoc
              files={files}
              onFilesChange={setFiles}
              onSubmit={handleGeneratePresentation}
              disabled={loadingState.isLoading}
            />
          }
        />

      </div>
    </Wrapper>
  );
};

export default UploadPage;
