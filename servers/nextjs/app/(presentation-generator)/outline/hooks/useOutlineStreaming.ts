import { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { toast } from "sonner";
import { setOutlines } from "@/store/slices/presentationGeneration";
import { jsonrepair } from "jsonrepair";
import { RootState } from "@/store/store";
import { getFastAPIUrl } from "@/utils/api";

const MAX_STREAM_RETRIES = 3;
const STREAM_RETRY_DELAY_MS = 1_000;



export const useOutlineStreaming = (presentationId: string | null) => {
  const dispatch = useDispatch();
  const { outlines } = useSelector((state: RootState) => state.presentationGeneration);
  const [isStreaming, setIsStreaming] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [activeSlideIndex, setActiveSlideIndex] = useState<number | null>(null);
  const [highestActiveIndex, setHighestActiveIndex] = useState<number>(-1);
  const prevSlidesRef = useRef<{ content: string }[]>([]);
  const activeIndexRef = useRef<number>(-1);
  const highestIndexRef = useRef<number>(-1);

  useEffect(() => {
    if (!presentationId || outlines.length > 0) return;

    let eventSource: EventSource | null = null;
    let accumulatedChunks = "";
    let retryCount = 0;
    let isClosed = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

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

    const resetStreamingState = () => {
      setIsStreaming(false);
      setIsLoading(false);
      setActiveSlideIndex(null);
      setHighestActiveIndex(-1);
      activeIndexRef.current = -1;
      highestIndexRef.current = -1;
    };

    const scheduleRetry = (reason: string): boolean => {
      if (retryCount >= MAX_STREAM_RETRIES || isClosed) {
        return false;
      }

      retryCount += 1;
      const retryDelay = STREAM_RETRY_DELAY_MS * retryCount;
      console.warn(
        `Outline stream retry ${retryCount}/${MAX_STREAM_RETRIES}: ${reason}`
      );

      closeEventSource();
      clearRetryTimer();
      accumulatedChunks = "";
      prevSlidesRef.current = [];
      activeIndexRef.current = -1;
      highestIndexRef.current = -1;

      retryTimer = setTimeout(() => {
        if (!isClosed) {
          openStream();
        }
      }, retryDelay);

      return true;
    };

    const openStream = () => {
      closeEventSource();
      eventSource = new EventSource(`${getFastAPIUrl()}/api/v1/ppt/outlines/stream/${presentationId}`);

      eventSource.addEventListener("response", (event) => {
        let data: any;
        try {
          data = JSON.parse(event.data);
        } catch {
          if (!scheduleRetry("invalid SSE payload")) {
            resetStreamingState();
            toast.error("Failed to parse outline stream response.");
          }
          return;
        }

        switch (data.type) {
          case "chunk":
            accumulatedChunks += data.chunk;
            try {
              const repairedJson = jsonrepair(accumulatedChunks);
              const partialData = JSON.parse(repairedJson);

              if (partialData.slides) {
                const nextSlides: { content: string }[] = partialData.slides || [];
                try {
                  const prev = prevSlidesRef.current || [];
                  let changedIndex: number | null = null;
                  const maxLen = Math.max(prev.length, nextSlides.length);
                  for (let i = 0; i < maxLen; i++) {
                    const prevContent = prev[i]?.content;
                    const nextContent = nextSlides[i]?.content;
                    if (nextContent !== prevContent) {
                      changedIndex = i;
                    }
                  }
                  const prevActive = activeIndexRef.current;
                  let nextActive = changedIndex ?? prevActive;
                  if (nextActive < prevActive) {
                    nextActive = prevActive;
                  }
                  activeIndexRef.current = nextActive;
                  setActiveSlideIndex(nextActive);

                  if (nextActive > highestIndexRef.current) {
                    highestIndexRef.current = nextActive;
                    setHighestActiveIndex(nextActive);
                  }
                } catch {}

                prevSlidesRef.current = nextSlides;
                dispatch(setOutlines(nextSlides));
                setIsLoading(false);
              }
            } catch (error) {
              // JSON isn't complete yet, continue accumulating
            }
            break;

          case "complete":
            try {
              const outlinesData: { content: string }[] =
                data.presentation.outlines.slides;
              dispatch(setOutlines(outlinesData));
              setIsStreaming(false);
              setIsLoading(false);
              setActiveSlideIndex(null);
              setHighestActiveIndex(-1);
              prevSlidesRef.current = outlinesData;
              activeIndexRef.current = -1;
              highestIndexRef.current = -1;
              isClosed = true;
              closeEventSource();
              clearRetryTimer();
              retryCount = 0;
            } catch (error) {
              if (!scheduleRetry("failed to parse complete payload")) {
                resetStreamingState();
                toast.error("Failed to parse presentation data");
              }
            }
            accumulatedChunks = "";
            break;

          case "closing":
            setIsStreaming(false);
            setIsLoading(false);
            setActiveSlideIndex(null);
            setHighestActiveIndex(-1);
            activeIndexRef.current = -1;
            highestIndexRef.current = -1;
            isClosed = true;
            closeEventSource();
            clearRetryTimer();
            retryCount = 0;
            break;
          case "error":
            if (!scheduleRetry(data.detail || "server returned stream error")) {
              resetStreamingState();
              closeEventSource();
              toast.error("Error in outline streaming", {
                description:
                  data.detail ||
                  "Failed to connect to the server. Please try again.",
              });
            }
            break;
        }
      });

      eventSource.onerror = () => {
        if (!scheduleRetry("connection lost")) {
          resetStreamingState();
          closeEventSource();
          toast.error("Failed to connect to the server. Please try again.");
        }
      };
    };

    setIsStreaming(true);
    setIsLoading(true);
    openStream();

    return () => {
      isClosed = true;
      closeEventSource();
      clearRetryTimer();
    };
  }, [presentationId, dispatch]);

  return { isStreaming, isLoading, activeSlideIndex, highestActiveIndex };
}; 