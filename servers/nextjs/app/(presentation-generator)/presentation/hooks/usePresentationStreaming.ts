import { useEffect, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  clearPresentationData,
  setGenerationMetrics,
  setPresentationData,
  setStreaming,
  type GenerationMetrics,
  type PresentationData,
} from "@/store/slices/presentationGeneration";
import { jsonrepair } from "jsonrepair";
import { notify } from "@/components/ui/sonner";
import { MixpanelEvent, trackEvent } from "@/utils/mixpanel";
import { sanitizeAnalyticsError } from "@/utils/analytics";
import { getApiUrl, normalizeBackendAssetUrls } from "@/utils/api";
import { store } from "@/store/store";
import type { RootState } from "@/store/store";
import {
  isChatGptAuthRequiredMessage,
  requestChatGptReauth,
} from "@/utils/chatgptAuth";
import {
  mergeSingleSlidePreservingResolvedAssets,
  mergeSlidesPreservingResolvedAssets,
} from "../utils/streamAssetMerge";
import { isTemplateV2Slide } from "../../_shared/blank-slide";

const MAX_STREAM_RETRIES = 3;
const STREAM_RETRY_DELAY_MS = 1_000;

interface PresentationStreamData {
  type?: string;
  model?: unknown;
  input_tokens?: unknown;
  output_tokens?: unknown;
  thinking_tokens?: unknown;
  total_tokens?: unknown;
  tokens_per_second?: unknown;
  duration_seconds?: unknown;
  estimated?: unknown;
  thinking_tokens_estimated?: unknown;
  supports_thinking?: unknown;
  [key: string]: any;
}

const readMetricNumber = (value: unknown, fallback: number) => {
  const parsedValue = Number(value);
  return Number.isFinite(parsedValue) ? Math.max(0, parsedValue) : fallback;
};

function mergePresentationPreservingTemplateData(
  incoming: PresentationData
): PresentationData {
  const prev = store.getState().presentationGeneration.presentationData;
  if (!prev) return incoming;

  return {
    ...prev,
    ...incoming,
    layout: incoming.layout ?? prev.layout,
    version: incoming.version ?? prev.version,
    theme: incoming.theme ?? prev.theme,
    structure: (incoming as any).structure ?? (prev as any).structure,
    slides: Array.isArray(incoming.slides)
      ? mergeSlidesPreservingResolvedAssets(prev.slides, incoming.slides)
      : prev.slides,
  } as PresentationData;
}

function parseStreamedSlideChunk(chunk: unknown): any | null {
  if (typeof chunk !== "string" || !chunk.trim()) return null;
  try {
    const parsed = JSON.parse(chunk);
    if (
      parsed &&
      typeof parsed === "object" &&
      !Array.isArray(parsed) &&
      typeof parsed.layout === "string" &&
      typeof parsed.index === "number" &&
      parsed.content &&
      typeof parsed.content === "object"
    ) {
      return parsed;
    }
  } catch {
    return null;
  }
  return null;
}

function hasTemplateV2LayoutPayload(layout: unknown): boolean {
  if (!layout || typeof layout !== "object") return false;
  const layouts = (layout as any).layouts;
  if (Array.isArray(layouts)) return true;
  return Boolean(
    layouts &&
      typeof layouts === "object" &&
      Array.isArray((layouts as any).layouts)
  );
}

function isTemplateV2SlidePayload(slide: unknown): boolean {
  return isTemplateV2Slide(slide);
}

function isTemplateV2PresentationPayload(presentation: unknown): boolean {
  if (!presentation || typeof presentation !== "object") return false;
  const record = presentation as Record<string, unknown>;
  return (
    hasTemplateV2LayoutPayload(record.layout) ||
    (Array.isArray(record.slides) && record.slides.some(isTemplateV2SlidePayload))
  );
}

export const usePresentationStreaming = (
  presentationId: string,
  stream: string | null,
  setLoading: (loading: boolean) => void,
  setError: (error: boolean) => void,
  fetchUserSlides: (options?: {
    clearHistory?: boolean;
  }) => void | Promise<unknown>,
  options: {
    preloadPresentationData?: boolean;
    generationMode?: "standard" | "smart";
  } = {}
) => {
  const dispatch = useDispatch();
  const previousSlidesLength = useRef(0);
  const preloadPresentationData = Boolean(options.preloadPresentationData);
  const isSmartMode = options.generationMode === "smart";
  const usePresentonSmartEndpoint = useSelector(
    (state: RootState) =>
      isSmartMode && state.userConfig.llm_config.LLM === "presenton"
  );

  useEffect(() => {
    if (!stream) {
      fetchUserSlides();
      return;
    }

    let eventSource: EventSource | null = null;
    let accumulatedChunks = "";
    let retryCount = 0;
    let isClosed = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    const shownAssetWarnings = new Set<string>();
    let preloadAttempted = false;
    let preloadRequest: Promise<void> | null = null;
    const streamStartedAt = Date.now();
    let streamIsTemplateV2 = preloadPresentationData;
    let smartGenerationOutcomeTracked = false;
    let latestGenerationMetrics: GenerationMetrics | null = null;

    const closeEventSource = () => {
      if (eventSource) {
        eventSource.close();
        eventSource = null;
      }
    };

    const clearRetryTimer = () => {
      if (retryTimer) {
        clearTimeout(retryTimer);
        retryTimer = null;
      }
    };

    const finalizeFailure = (
      description: string,
      options: { showToast?: boolean } = {}
    ) => {
      if (isSmartMode && !smartGenerationOutcomeTracked) {
        smartGenerationOutcomeTracked = true;
        trackEvent(MixpanelEvent.Smart_Mode_Generation_Failed, {
          presentation_id: presentationId,
          stage: "presentation_stream",
          retry_count: retryCount,
          duration_ms: Date.now() - streamStartedAt,
          error_message: sanitizeAnalyticsError(description, "Stream failed"),
        });
      }
      if (streamIsTemplateV2) {
        trackEvent(MixpanelEvent.TemplateV2_Stream_Failed, {
          presentation_id: presentationId,
          retry_count: retryCount,
          duration_ms: Date.now() - streamStartedAt,
          error_message: sanitizeAnalyticsError(description, "Stream failed"),
        });
      }
      isClosed = true;
      closeEventSource();
      clearRetryTimer();
      setLoading(false);
      dispatch(setStreaming(false));
      setError(true);
      if (options.showToast !== false) {
        notify.error("Presentation streaming failed", description);
      }
    };

    const scheduleRetry = (reason: string): boolean => {
      if (retryCount >= MAX_STREAM_RETRIES || isClosed) {
        return false;
      }

      retryCount += 1;
      const retryDelay = STREAM_RETRY_DELAY_MS * retryCount;
      console.warn(
        `Presentation stream retry ${retryCount}/${MAX_STREAM_RETRIES}: ${reason}`
      );

      closeEventSource();
      clearRetryTimer();
      accumulatedChunks = "";
      previousSlidesLength.current = 0;

      retryTimer = setTimeout(() => {
        if (!isClosed) {
          openStream();
        }
      }, retryDelay);

      return true;
    };

    const preloadPreparedPresentation = async (force = false) => {
      if ((!preloadPresentationData && !force) || preloadAttempted) return;
      if (preloadRequest) return preloadRequest;

      preloadAttempted = true;
      preloadRequest = (async () => {
        try {
          const response = await fetch(
            getApiUrl(`/api/v1/ppt/presentation/${presentationId}`),
            {
              credentials: "include",
            }
          );
          if (!response.ok) {
            throw new Error("Failed to preload prepared presentation.");
          }
          const preparedPresentation = normalizeBackendAssetUrls(
            await response.json()
          );
          if (!isClosed) {
            const prev = store.getState().presentationGeneration.presentationData;
            streamIsTemplateV2 =
              streamIsTemplateV2 ||
              isTemplateV2PresentationPayload(preparedPresentation);
            dispatch(
              setPresentationData({
                ...(prev ?? {}),
                ...(preparedPresentation as PresentationData),
                slides: prev?.slides ?? (preparedPresentation as any).slides,
              } as PresentationData)
            );
          }
        } catch (error) {
          console.warn("Could not preload prepared presentation:", error);
        } finally {
          preloadRequest = null;
        }
      })();

      return preloadRequest;
    };

    const trackTemplateV2StreamCompleted = (presentation: unknown) => {
      if (!streamIsTemplateV2 && !isTemplateV2PresentationPayload(presentation)) {
        return;
      }
      streamIsTemplateV2 = true;
      const slides = isTemplateV2PresentationPayload(presentation)
        ? (presentation as Record<string, unknown>).slides
        : store.getState().presentationGeneration.presentationData?.slides;
      trackEvent(MixpanelEvent.TemplateV2_Stream_Completed, {
        presentation_id: presentationId,
        slide_count: Array.isArray(slides) ? slides.length : 0,
        retry_count: retryCount,
        duration_ms: Date.now() - streamStartedAt,
      });
    };

    const trackSmartModeGenerationCompleted = (presentation: unknown) => {
      if (!isSmartMode || smartGenerationOutcomeTracked) return;
      smartGenerationOutcomeTracked = true;
      const slides =
        presentation &&
        typeof presentation === "object" &&
        Array.isArray((presentation as Record<string, unknown>).slides)
          ? (presentation as Record<string, unknown>).slides
          : store.getState().presentationGeneration.presentationData?.slides;
      trackEvent(MixpanelEvent.Smart_Mode_Generation_Completed, {
        presentation_id: presentationId,
        slide_count: Array.isArray(slides) ? slides.length : 0,
        retry_count: retryCount,
        duration_ms: Date.now() - streamStartedAt,
      });
    };

    const openStream = () => {
      closeEventSource();
      eventSource = new EventSource(
        getApiUrl(
          usePresentonSmartEndpoint
            ? `/api/v2/ppt/presentation/stream/${presentationId}`
            : `/api/v1/ppt/presentation/stream/${presentationId}`
        )
      );

      eventSource.addEventListener("response", async (event) => {
        let data: PresentationStreamData;
        try {
          data = JSON.parse(event.data) as PresentationStreamData;
        } catch {
          if (!scheduleRetry("invalid SSE payload")) {
            finalizeFailure("Failed to parse stream response.");
          }
          return;
        }

        switch (data.type) {
          case "generation_metrics": {
            const previousMetrics = latestGenerationMetrics;
            const inputTokens = readMetricNumber(
              data.input_tokens,
              previousMetrics?.input_tokens ?? 0
            );
            const outputTokens = readMetricNumber(
              data.output_tokens,
              previousMetrics?.output_tokens ?? 0
            );
            const totalTokens = readMetricNumber(
              data.total_tokens,
              previousMetrics?.total_tokens ?? 0
            );
            const thinkingTokens =
              data.thinking_tokens === null ||
              data.thinking_tokens === undefined
                ? previousMetrics?.thinking_tokens ?? null
                : readMetricNumber(
                    data.thinking_tokens,
                    previousMetrics?.thinking_tokens ?? 0
                  );
            const hasExactThinkingTokens =
              data.thinking_tokens !== null &&
              data.thinking_tokens !== undefined &&
              data.thinking_tokens_estimated === false;

            const nextMetrics: GenerationMetrics = {
              model:
                data.model === undefined
                  ? previousMetrics?.model ?? ""
                  : String(data.model),
              input_tokens: Math.max(
                previousMetrics?.input_tokens ?? 0,
                inputTokens
              ),
              output_tokens: Math.max(
                previousMetrics?.output_tokens ?? 0,
                outputTokens
              ),
              thinking_tokens:
                thinkingTokens === null
                  ? null
                  : hasExactThinkingTokens
                    ? thinkingTokens
                    : Math.max(
                        previousMetrics?.thinking_tokens ?? 0,
                        thinkingTokens
                      ),
              total_tokens: Math.max(
                previousMetrics?.total_tokens ?? 0,
                totalTokens
              ),
              tokens_per_second: readMetricNumber(
                data.tokens_per_second,
                previousMetrics?.tokens_per_second ?? 0
              ),
              duration_seconds: Math.max(
                previousMetrics?.duration_seconds ?? 0,
                readMetricNumber(
                  data.duration_seconds,
                  previousMetrics?.duration_seconds ?? 0
                )
              ),
              estimated:
                data.estimated === undefined
                  ? previousMetrics?.estimated ?? false
                  : Boolean(data.estimated),
              thinking_tokens_estimated:
                data.thinking_tokens_estimated === undefined
                  ? previousMetrics?.thinking_tokens_estimated ?? false
                  : Boolean(data.thinking_tokens_estimated),
              supports_thinking:
                previousMetrics?.supports_thinking === true ||
                data.supports_thinking === true,
            };

            const hasMeaningfulMetrics =
              nextMetrics.input_tokens > 0 ||
              nextMetrics.output_tokens > 0 ||
              nextMetrics.total_tokens > 0 ||
              nextMetrics.tokens_per_second > 0 ||
              nextMetrics.supports_thinking;

            if (previousMetrics || hasMeaningfulMetrics) {
              latestGenerationMetrics = nextMetrics;
              dispatch(setGenerationMetrics(nextMetrics));
            }
            break;
          }

          case "fonts": {
            if (data.fonts && typeof data.fonts === "object") {
              const prev = store.getState().presentationGeneration.presentationData;
              dispatch(
                setPresentationData({
                  ...(prev ?? {}),
                  fonts: data.fonts,
                  slides: prev?.slides ?? [],
                } as PresentationData)
              );
            }
            break;
          }

          case "slide_html": {
            const slideIndex = Number(data.index);
            const html = typeof data.html === "string" ? data.html : "";
            if (!Number.isFinite(slideIndex) || !html) break;

            const incomingSlide =
              data.slide && typeof data.slide === "object"
                ? data.slide
                : {
                    id: data.slide_id,
                    index: slideIndex,
                    layout: "smart-html",
                    layout_group: "smart-html",
                    content: { title: `Slide ${slideIndex + 1}` },
                    html_content: html,
                  };
            const normalizedSlide = normalizeBackendAssetUrls(incomingSlide);
            const prev = store.getState().presentationGeneration.presentationData;
            const mergedSlides = mergeSingleSlidePreservingResolvedAssets(
              prev?.slides,
              normalizedSlide
            );
            dispatch(
              setPresentationData({
                ...(prev ?? {}),
                slides: mergedSlides,
              } as PresentationData)
            );
            previousSlidesLength.current = mergedSlides.length;
            setLoading(false);
            break;
          }

          case "chunk":
            accumulatedChunks += data.chunk;
            const streamedSlide = parseStreamedSlideChunk(data.chunk);
            if (streamedSlide) {
              const prev = store.getState().presentationGeneration.presentationData;
              const normalizedSlide = normalizeBackendAssetUrls(streamedSlide);
              const mergedSlides = mergeSingleSlidePreservingResolvedAssets(
                prev?.slides,
                normalizedSlide
              );
              dispatch(
                setPresentationData({
                  ...(prev ?? {}),
                  slides: mergedSlides,
                } as PresentationData)
              );
              previousSlidesLength.current = mergedSlides.length;
              setLoading(false);
              if (
                isTemplateV2SlidePayload(normalizedSlide) &&
                !hasTemplateV2LayoutPayload(prev?.layout)
              ) {
                streamIsTemplateV2 = true;
                void preloadPreparedPresentation(true);
              }
            }

            try {
              const repairedJson = jsonrepair(accumulatedChunks);
              const partialData = JSON.parse(repairedJson);
              const normalizedPartialData = normalizeBackendAssetUrls(partialData);

              if (
                normalizedPartialData.slides &&
                normalizedPartialData.slides.length > 0
              ) {
                const prev =
                  store.getState().presentationGeneration.presentationData;
                const mergedSlides = mergeSlidesPreservingResolvedAssets(
                  prev?.slides,
                  normalizedPartialData.slides
                );
                dispatch(
                  setPresentationData({
                    ...(prev ?? {}),
                    ...normalizedPartialData,
                    slides: mergedSlides,
                  } as PresentationData)
                );
                previousSlidesLength.current =
                  normalizedPartialData.slides.length;
                setLoading(false);
              }
            } catch {
              // JSON isn't complete yet, continue accumulating
            }
            break;

          case "slide_assets": {
            if (
              data.slide &&
              typeof data.slide === "object"
            ) {
              const prev = store.getState().presentationGeneration.presentationData;
              const normalizedSlide = normalizeBackendAssetUrls(data.slide);
              const mergedSlides = mergeSingleSlidePreservingResolvedAssets(
                prev?.slides,
                normalizedSlide
              );
              dispatch(
                setPresentationData({
                  ...(prev ?? {}),
                  slides: mergedSlides,
                } as PresentationData)
              );
              if (
                isTemplateV2SlidePayload(normalizedSlide) &&
                !hasTemplateV2LayoutPayload(prev?.layout)
              ) {
                streamIsTemplateV2 = true;
                void preloadPreparedPresentation(true);
              }
            }
            if (Array.isArray(data.warnings)) {
              for (const warning of data.warnings) {
                const detail =
                  warning &&
                  typeof warning === "object" &&
                  typeof warning.detail === "string"
                    ? warning.detail
                    : null;
                if (!detail || shownAssetWarnings.has(detail)) {
                  continue;
                }
                shownAssetWarnings.add(detail);
                notify.warning("Some images could not be generated", detail, {
                  duration: 12_000,
                });
              }
            }
            break;
          }

          case "complete":
            try {
              const hasCompletePresentation =
                data.presentation &&
                typeof data.presentation === "object" &&
                !Array.isArray(data.presentation);
              let completedPresentation: unknown = hasCompletePresentation
                ? data.presentation
                : null;

              if (hasCompletePresentation) {
                dispatch(
                  setPresentationData(
                    mergePresentationPreservingTemplateData(
                      normalizeBackendAssetUrls(
                        data.presentation
                      ) as PresentationData
                    )
                  )
                );
              } else if (
                isSmartMode &&
                typeof data.presentation_id === "string" &&
                data.presentation_id === presentationId
              ) {
                // Smart v2 completes with only the presentation id. The local
                // proxy mirrors the finished cloud deck before forwarding this
                // event, so load that persisted presentation for the editor.
                const fetchedPresentation = await fetchUserSlides({
                  clearHistory: false,
                });
                if (!fetchedPresentation) {
                  throw new Error("Completed presentation could not be loaded");
                }
                completedPresentation = fetchedPresentation;
              } else {
                throw new Error("Completion event did not contain a presentation");
              }

              if (!completedPresentation) {
                throw new Error("Completed presentation could not be loaded");
              }

              trackTemplateV2StreamCompleted(completedPresentation);
              trackSmartModeGenerationCompleted(completedPresentation);
              dispatch(setStreaming(false));
              setLoading(false);
              isClosed = true;
              closeEventSource();
              clearRetryTimer();
              retryCount = 0;

              // Remove stream parameter from URL
              const newUrl = new URL(window.location.href);
              newUrl.searchParams.delete("stream");
              window.history.replaceState({}, "", newUrl.toString());
            } catch (error) {
              console.error("Could not finalize presentation stream:", error);
              if (!scheduleRetry("failed to parse complete payload")) {
                finalizeFailure("Failed to load the completed presentation.");
              }
            }
            accumulatedChunks = "";
            break;

          case "closing":
            dispatch(
              setPresentationData(
                mergePresentationPreservingTemplateData(
                  normalizeBackendAssetUrls(data.presentation) as PresentationData
                )
              )
            );
            trackTemplateV2StreamCompleted(data.presentation);
            trackSmartModeGenerationCompleted(data.presentation);
            setLoading(false);
            dispatch(setStreaming(false));
            isClosed = true;
            closeEventSource();
            clearRetryTimer();
            retryCount = 0;

            // Remove stream parameter from URL
            const newUrl = new URL(window.location.href);
            newUrl.searchParams.delete("stream");
            window.history.replaceState({}, "", newUrl.toString());
            break;
          case "error":
            if (isChatGptAuthRequiredMessage(data.detail)) {
              requestChatGptReauth({
                message: data.detail,
                source: "presentation-stream",
              });
              finalizeFailure(
                data.detail ||
                  "Your ChatGPT session expired. Please sign in again from Settings.",
                { showToast: false }
              );
              break;
            }
            const completedSlides = Number(data.completed_slides);
            const totalSlides = Number(data.total_slides);
            const detail =
              data.detail || "Failed to connect to the server. Please try again.";
            const detailWithProgress =
              Number.isFinite(completedSlides) && completedSlides > 0
                ? `${detail} ${completedSlides}${
                    Number.isFinite(totalSlides) && totalSlides > 0
                      ? ` of ${totalSlides}`
                      : ""
                  } slides were saved and will be reused.`
                : detail;
            if (data.retryable === false) {
              finalizeFailure(detailWithProgress);
              break;
            }
            if (
              !scheduleRetry(detail || "server returned stream error response")
            ) {
              finalizeFailure(detailWithProgress);
            }
            break;
        }
      });

      eventSource.onerror = (error) => {
        console.error("EventSource failed:", error);
        if (!scheduleRetry("connection lost")) {
          finalizeFailure("Failed to connect to the server. Please try again.");
        }
      };
    };

    const startStream = async () => {
      dispatch(setStreaming(true));
      dispatch(clearPresentationData());
      latestGenerationMetrics = null;
      dispatch(setGenerationMetrics(null));
      trackEvent(MixpanelEvent.Presentation_Stream_API_Call, {
        presentation_id: presentationId,
        generation_mode: options.generationMode ?? "standard",
      });
      await preloadPreparedPresentation();
      if (!isClosed) {
        openStream();
      }
    };

    void startStream();

    return () => {
      isClosed = true;
      closeEventSource();
      clearRetryTimer();
    };
  }, [
    presentationId,
    stream,
    dispatch,
    setLoading,
    setError,
    fetchUserSlides,
    preloadPresentationData,
    isSmartMode,
    options.generationMode,
    usePresentonSmartEndpoint,
  ]);
};
