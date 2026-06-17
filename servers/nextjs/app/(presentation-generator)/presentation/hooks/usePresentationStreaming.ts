import { useEffect, useRef } from "react";
import { useDispatch } from "react-redux";
import {
  clearPresentationData,
  setPresentationData,
  setStreaming,
  updateSlide,
  type PresentationData,
} from "@/store/slices/presentationGeneration";
import { jsonrepair } from "jsonrepair";
import { notify } from "@/components/ui/sonner";
import { MixpanelEvent, trackEvent } from "@/utils/mixpanel";
import { getApiUrl, normalizeBackendAssetUrls } from "@/utils/api";
import { store } from "@/store/store";

const MAX_STREAM_RETRIES = 3;
const STREAM_RETRY_DELAY_MS = 1_000;

/** Chunk JSON replays each slide as first streamed; don't clobber URLs filled by `slide_assets`. */
const PLACEHOLDER_ASSET_MARKERS = [
  "/static/images/placeholder",
  "/static/icons/placeholder",
  "placeholder.jpg",
  "placeholder.svg",
];

function isPlaceholderAssetUrl(url: unknown): boolean {
  if (typeof url !== "string" || !url.trim()) return false;
  const u = url.toLowerCase();
  return PLACEHOLDER_ASSET_MARKERS.some((m) => u.includes(m));
}

function mergeContentPreservingResolvedAssets(prev: any, incoming: any): any {
  if (incoming === undefined || incoming === null) return prev;
  if (prev === undefined || prev === null) return incoming;

  if (Array.isArray(incoming)) {
    if (!Array.isArray(prev)) return incoming;
    return incoming.map((item, i) =>
      mergeContentPreservingResolvedAssets(prev[i], item)
    );
  }

  if (typeof incoming !== "object") return incoming;
  if (typeof prev !== "object") return incoming;

  const result: Record<string, unknown> = { ...incoming };

  for (const key of Object.keys(incoming)) {
    const pv = prev[key];
    const iv = incoming[key];

    if (iv !== null && typeof iv === "object") {
      if (Array.isArray(iv) && Array.isArray(pv)) {
        result[key] = iv.map((item, idx) =>
          mergeContentPreservingResolvedAssets(pv[idx], item)
        );
      } else if (
        !Array.isArray(iv) &&
        pv !== null &&
        typeof pv === "object" &&
        !Array.isArray(pv)
      ) {
        result[key] = mergeContentPreservingResolvedAssets(pv, iv);
      }
      continue;
    }

    if (
      key === "__image_url__" &&
      typeof iv === "string" &&
      typeof pv === "string"
    ) {
      if (isPlaceholderAssetUrl(iv) && !isPlaceholderAssetUrl(pv)) {
        result[key] = pv;
      }
    }
    if (
      key === "__icon_url__" &&
      typeof iv === "string" &&
      typeof pv === "string"
    ) {
      if (isPlaceholderAssetUrl(iv) && !isPlaceholderAssetUrl(pv)) {
        result[key] = pv;
      }
    }
  }

  return result;
}

function mergeSlidesPreservingResolvedAssets(
  prevSlides: any[] | undefined,
  incomingSlides: any[]
): any[] {
  if (!prevSlides?.length) return incomingSlides;
  return incomingSlides.map((incoming, idx) => {
    const prev = prevSlides[idx];
    if (!prev) return incoming;
    return {
      ...incoming,
      content: mergeContentPreservingResolvedAssets(
        prev.content,
        incoming.content
      ),
    };
  });
}

export const usePresentationStreaming = (
  presentationId: string,
  stream: string | null,
  setLoading: (loading: boolean) => void,
  setError: (error: boolean) => void,
  fetchUserSlides: () => void
) => {
  const dispatch = useDispatch();
  const previousSlidesLength = useRef(0);

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

    const finalizeFailure = (description: string) => {
      closeEventSource();
      clearRetryTimer();
      setLoading(false);
      dispatch(setStreaming(false));
      setError(true);
      notify.error("Presentation streaming failed", description);
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

    const openStream = () => {
      closeEventSource();
      eventSource = new EventSource(
        getApiUrl(`/api/v1/ppt/presentation/stream/${presentationId}`)
      );

      eventSource.addEventListener("response", (event) => {
        let data: any;
        try {
          data = JSON.parse(event.data);
        } catch {
          if (!scheduleRetry("invalid SSE payload")) {
            finalizeFailure("Failed to parse stream response.");
          }
          return;
        }

        switch (data.type) {
          case "chunk":
            accumulatedChunks += data.chunk;
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
            } catch (error) {
              // JSON isn't complete yet, continue accumulating
            }
            break;

          case "slide_assets": {
            const idx = data.slide_index;
            if (
              typeof idx === "number" &&
              idx >= 0 &&
              data.slide &&
              typeof data.slide === "object"
            ) {
              dispatch(
                updateSlide({
                  index: idx,
                  slide: normalizeBackendAssetUrls(data.slide),
                })
              );
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
              dispatch(setPresentationData(normalizeBackendAssetUrls(data.presentation)));
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
              if (!scheduleRetry("failed to parse complete payload")) {
                finalizeFailure("Failed to parse final presentation payload.");
              }
            }
            accumulatedChunks = "";
            break;

          case "closing":
            dispatch(setPresentationData(normalizeBackendAssetUrls(data.presentation)));
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
            if (
              !scheduleRetry(
                data.detail || "server returned stream error response"
              )
            ) {
              finalizeFailure(
                data.detail ||
                  "Failed to connect to the server. Please try again."
              );
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

    dispatch(setStreaming(true));
    dispatch(clearPresentationData());
    trackEvent(MixpanelEvent.Presentation_Stream_API_Call);
    openStream();

    return () => {
      isClosed = true;
      closeEventSource();
      clearRetryTimer();
    };
  }, [presentationId, stream, dispatch, setLoading, setError, fetchUserSlides]);
};
