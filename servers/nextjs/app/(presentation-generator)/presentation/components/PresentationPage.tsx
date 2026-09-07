"use client";
import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { useDispatch, useSelector } from "react-redux";
import { v4 as uuidv4 } from "uuid";
import { RootState } from "@/store/store";
import { cn } from "@/lib/utils";
import "../../utils/prism-languages";
import { Skeleton } from "@/components/ui/skeleton";
import { OverlayLoader } from "@/components/ui/overlay-loader";
import PresentationMode from "./PresentationMode";
import SidePanel from "./SidePanel";
import SlideContent from "./SlideContent";
import { Button } from "@/components/ui/button";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { trackEvent, MixpanelEvent } from "@/utils/mixpanel";
import {
  AlertCircle,
  ChevronRight,
  Keyboard,
  Sparkles,
  X,
} from "lucide-react";
import {
  usePresentationStreaming,
  usePresentationData,
  usePresentationNavigation,
  useAutoSave,
} from "../hooks";
import { PresentationPageProps } from "../types";
import { applyPresentationThemeToElement } from "../utils/applyPresentationThemeDom";

import { replaceSlidesWithBlankFallback } from "@/store/slices/presentationGeneration";
import { addToHistory } from "@/store/slices/undoRedoSlice";
import {
  createBlankPresentationSlide,
  getPresentationTemplateId,
  isTemplateV2Slide,
  isTemplateV2TemplateId,
} from "../../_shared/blank-slide";
import PresentationHeader from "./PresentationHeader";
import PresentationActions from "./PresentationActions";
import {
  TEMPLATE_V2_ACTIVATE_SURFACE_EVENT,
  TEMPLATE_V2_SURFACE_SELECTED_EVENT,
  type TemplateV2ActivateSurfaceDetail,
  type TemplateV2SurfaceSelectedDetail,
} from "@/components/slide-editor/events/events";
import { isEditableTarget } from "@/components/slide-editor/model/core";

function hasTemplateV2Layouts(layout: unknown): boolean {
  if (!layout || typeof layout !== "object") return false;
  const layouts = (layout as any).layouts;
  if (Array.isArray(layouts)) return true;
  return Boolean(
    layouts &&
    typeof layouts === "object" &&
    Array.isArray((layouts as any).layouts)
  );
}

function hasTemplateV2Slides(slides: unknown): boolean {
  return (
    Array.isArray(slides) &&
    slides.some((slide) => isTemplateV2Slide(slide))
  );
}

function collectTemplateV2Ids(value: unknown): string[] {
  const ids = new Set<string>();
  const visit = (item: unknown, depth = 0) => {
    if (depth > 4 || !item) return;
    if (Array.isArray(item)) {
      item.forEach((entry) => visit(entry, depth + 1));
      return;
    }
    if (typeof item !== "object") return;
    const record = item as Record<string, unknown>;
    ["layout_group", "layout", "template_id", "templateV2Id", "template_v2_id", "id"].forEach(
      (key) => {
        const value = record[key];
        if (isTemplateV2TemplateId(value)) {
          ids.add(value);
        }
      }
    );
    visit(record.layout, depth + 1);
    visit(record.layouts, depth + 1);
    visit(record.slides, depth + 1);
  };
  visit(value);
  return Array.from(ids);
}

interface LoadingState {
  isLoading: boolean;
  message: string;
  showProgress: boolean;
  duration: number;
  extra_info?: string;
}

type SlideAddedOptions = {
  promptOverlaySlideId?: string;
  promptOverlayKind?: "blank" | "layout";
};

const DEFAULT_LOADING_STATE: LoadingState = {
  isLoading: true,
  message: "Loading presentation",
  showProgress: false,
  duration: 0,
  extra_info: "",
};

const STREAM_LOADING_STATE: LoadingState = {
  isLoading: true,
  message: "Creating your presentation",
  showProgress: true,
  duration: 90,
  extra_info: "This can take a few minutes depending on slide count.",
};

const IDLE_LOADING_STATE: LoadingState = {
  isLoading: false,
  message: "",
  showProgress: false,
  duration: 0,
  extra_info: "",
};

const NAVIGATION_HINT_STORAGE_KEY = "presenton:editor-navigation-hint:v1";
const NAVIGATION_HINT_KEYS = ["←", "↑", "↓", "→"];
const NAVIGATION_SCROLL_THRESHOLD = 240;
const NAVIGATION_SCROLL_WINDOW_MS = 800;

const PresentationPage: React.FC<PresentationPageProps> = ({
  presentation_id,
}) => {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const dispatch = useDispatch();
  // State management
  const [loading, setLoading] = useState(true);
  const [loadingState, setLoadingState] =
    useState<LoadingState>(DEFAULT_LOADING_STATE);
  const [selectedSlide, setSelectedSlide] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isChatSending, setIsChatSending] = useState(false);
  const [isChatMutating, setIsChatMutating] = useState(false);
  const [isFollowModeEnabled, setIsFollowModeEnabled] = useState(true);
  const [agentFocusedSlide, setAgentFocusedSlide] = useState<number | null>(
    null
  );
  const [agentFocusEventId, setAgentFocusEventId] = useState<string | null>(
    null
  );
  const [glowingSlideIndex, setGlowingSlideIndex] = useState<number | null>(
    null
  );
  const [chatTargetedSlides, setChatTargetedSlides] = useState<number[]>([]);
  const [blankPromptSlideIds, setBlankPromptSlideIds] = useState<Set<string>>(
    () => new Set()
  );
  const [templatePromptSlideIds, setTemplatePromptSlideIds] = useState<
    Set<string>
  >(() => new Set());
  const [isMobileAssistantOpen, setIsMobileAssistantOpen] = useState(false);
  const [isRightPanelOpen, setIsRightPanelOpen] = useState(false);
  const [showNavigationHint, setShowNavigationHint] = useState(false);
  const [error, setError] = useState(false);
  const mobileAssistantTriggerRef = useRef<HTMLButtonElement | null>(null);
  const mobileAssistantCloseRef = useRef<HTMLButtonElement | null>(null);
  const presentationCanvasRef = useRef<HTMLDivElement | null>(null);
  const templateV2EditorLoadedKeyRef = useRef<string | null>(null);
  const navigationHintShownRef = useRef(false);
  const navigationHintSlideRef = useRef<number | null>(null);
  const navigationScrollIntentRef = useRef({ amount: 0, lastAt: 0 });
  const lastAutoOpenedSelectionRef = useRef<number | null>(null);
  const router = useRouter();
  const shouldPreloadTemplateV2Presentation =
    searchParams.get("editor") === "v2" || searchParams.get("type") === "smart";

  const { presentationData, isStreaming, chatHtmlSelection } = useSelector(
    (state: RootState) => state.presentationGeneration
  );
  const presentationDataRef = useRef(presentationData);
  const slidesLength = presentationData?.slides?.length ?? 0;
  const isSmartPresentation =
    searchParams.get("type") === "smart" ||
    presentationData?.type === "smart" ||
    presentationData?.generation_mode === "smart";
  const isTemplateV2Presentation =
    presentationData?.version === "v2-standard" ||
    hasTemplateV2Layouts(presentationData?.layout) ||
    hasTemplateV2Slides(presentationData?.slides);
  const editingDisabled = isStreaming === true;

  useEffect(() => {
    presentationDataRef.current = presentationData;
  }, [presentationData]);

  useEffect(() => {
    if (
      !isSmartPresentation ||
      isStreaming ||
      !chatHtmlSelection ||
      lastAutoOpenedSelectionRef.current === chatHtmlSelection.selectedAt
    ) {
      return;
    }

    lastAutoOpenedSelectionRef.current = chatHtmlSelection.selectedAt;
    if (window.matchMedia("(min-width: 1280px)").matches) {
      setIsRightPanelOpen(true);
    } else {
      setIsMobileAssistantOpen(true);
    }
  }, [chatHtmlSelection, isSmartPresentation, isStreaming]);

  const closeMobileAssistant = useCallback(() => {
    setIsMobileAssistantOpen(false);
    window.requestAnimationFrame(() => {
      mobileAssistantTriggerRef.current?.focus();
    });
  }, []);

  useEffect(() => {
    if (!isMobileAssistantOpen) return;
    mobileAssistantCloseRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeMobileAssistant();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [closeMobileAssistant, isMobileAssistantOpen]);

  useEffect(() => {
    const desktopQuery = window.matchMedia("(min-width: 1280px)");
    const closeDrawerOnDesktop = () => {
      if (desktopQuery.matches) {
        setIsMobileAssistantOpen(false);
      }
    };

    closeDrawerOnDesktop();
    desktopQuery.addEventListener("change", closeDrawerOnDesktop);
    return () =>
      desktopQuery.removeEventListener("change", closeDrawerOnDesktop);
  }, []);

  // Auto-save functionality.
  // Pause while the chat assistant is mutating the deck: the assistant edits
  // slide.ui directly in the database, so a debounced autosave firing with the
  // pre-edit Redux state would overwrite (revert) the assistant's change.
  const { isSaving } = useAutoSave({
    debounceMs: 2000,
    enabled:
      !!presentationData &&
      !isStreaming &&
      !isChatSending &&
      !isChatMutating,
  });

  // Custom hooks
  const { fetchUserSlides } = usePresentationData(
    presentation_id,
    setLoading,
    setError
  );

  const {
    isPresentMode,
    stream,
    currentSlide: presentSlideFromUrl,
    toggleFullscreen,
    handlePresentExit,
    handleSlideChange,
  } = usePresentationNavigation(
    presentation_id,
    selectedSlide,
    setSelectedSlide,
    setIsFullscreen
  );

  // Initialize streaming
  usePresentationStreaming(
    presentation_id,
    stream,
    setLoading,
    setError,
    fetchUserSlides,
    {
      preloadPresentationData: shouldPreloadTemplateV2Presentation,
      generationMode: isSmartPresentation ? "smart" : "standard",
    }
  );

  useEffect(() => {
    if (
      !presentationData ||
      loading ||
      error ||
      stream ||
      !isTemplateV2Presentation ||
      slidesLength > 0
    ) {
      return;
    }

    const blankSlide = createBlankPresentationSlide({
      id: uuidv4(),
      index: 0,
      presentationId: presentation_id,
      templateId: getPresentationTemplateId(presentationData),
      isTemplateV2: true,
    });
    dispatch(replaceSlidesWithBlankFallback({ slideData: blankSlide }));
    setSelectedSlide(0);
  }, [
    dispatch,
    error,
    isTemplateV2Presentation,
    loading,
    presentationData,
    presentation_id,
    slidesLength,
    stream,
  ]);

  useEffect(() => {
    if (!loading) {
      setLoadingState(IDLE_LOADING_STATE);
      return;
    }

    setLoadingState(stream ? STREAM_LOADING_STATE : DEFAULT_LOADING_STATE);
  }, [loading, stream]);

  useEffect(() => {
    if (isStreaming && slidesLength > 0) {
      setSelectedSlide(slidesLength - 1);
    }
  }, [isStreaming, slidesLength]);

  const dismissNavigationHint = useCallback(() => {
    setShowNavigationHint(false);
    navigationHintSlideRef.current = null;
    try {
      window.localStorage.setItem(NAVIGATION_HINT_STORAGE_KEY, "seen");
    } catch {
      // The hint can still be dismissed when storage is unavailable.
    }
  }, []);

  useEffect(() => {
    if (
      isPresentMode ||
      loading ||
      isStreaming ||
      slidesLength <= 1 ||
      navigationHintShownRef.current ||
      !window.matchMedia("(min-width: 768px)").matches
    ) {
      return;
    }

    try {
      if (window.localStorage.getItem(NAVIGATION_HINT_STORAGE_KEY)) return;
    } catch {
      // Show the hint for this visit when storage is unavailable.
    }

    navigationHintShownRef.current = true;
    navigationHintSlideRef.current = selectedSlide;
    setShowNavigationHint(true);
  }, [isPresentMode, isStreaming, loading, selectedSlide, slidesLength]);

  useEffect(() => {
    if (!showNavigationHint) return;
    const timer = window.setTimeout(dismissNavigationHint, 5_000);
    return () => window.clearTimeout(timer);
  }, [dismissNavigationHint, showNavigationHint]);

  useEffect(() => {
    const canvas = presentationCanvasRef.current;
    if (
      !canvas ||
      isPresentMode ||
      loading ||
      isStreaming ||
      slidesLength <= 1 ||
      !window.matchMedia("(min-width: 768px)").matches
    ) {
      return;
    }

    const handleWheel = (event: WheelEvent) => {
      if (showNavigationHint || Math.abs(event.deltaY) < 4) return;

      const now = Date.now();
      const scrollIntent = navigationScrollIntentRef.current;
      if (now - scrollIntent.lastAt > NAVIGATION_SCROLL_WINDOW_MS) {
        scrollIntent.amount = 0;
      }

      const multiplier =
        event.deltaMode === WheelEvent.DOM_DELTA_LINE
          ? 16
          : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
            ? window.innerHeight
            : 1;
      scrollIntent.amount += Math.abs(event.deltaY) * multiplier;
      scrollIntent.lastAt = now;

      if (scrollIntent.amount < NAVIGATION_SCROLL_THRESHOLD) return;

      scrollIntent.amount = 0;
      navigationHintSlideRef.current = selectedSlide;
      setShowNavigationHint(true);
    };

    canvas.addEventListener("wheel", handleWheel, { passive: true });
    return () => canvas.removeEventListener("wheel", handleWheel);
  }, [
    isPresentMode,
    isStreaming,
    loading,
    selectedSlide,
    showNavigationHint,
    slidesLength,
  ]);

  useEffect(() => {
    if (
      !showNavigationHint ||
      navigationHintSlideRef.current === null ||
      navigationHintSlideRef.current === selectedSlide
    ) {
      return;
    }
    dismissNavigationHint();
  }, [dismissNavigationHint, selectedSlide, showNavigationHint]);

  useEffect(() => {
    trackEvent(MixpanelEvent.Presentation_Editor_Viewed, {
      pathname,
      presentation_id,
      stream_mode: !!stream,
      presentation_mode: isPresentMode ? "present" : "edit",
      generation_mode: isSmartPresentation ? "smart" : "standard",
    });
  }, [
    isPresentMode,
    isSmartPresentation,
    pathname,
    presentation_id,
    stream,
  ]);

  useEffect(() => {
    if (!presentationData || !isTemplateV2Presentation || loading || error) {
      return;
    }
    if (templateV2EditorLoadedKeyRef.current === presentation_id) {
      return;
    }
    templateV2EditorLoadedKeyRef.current = presentation_id;
    trackEvent(MixpanelEvent.TemplateV2_Editor_Loaded, {
      presentation_id,
      slide_count: slidesLength,
      stream_mode: !!stream,
      template_id_candidates: collectTemplateV2Ids(presentationData),
    });
  }, [
    error,
    isTemplateV2Presentation,
    loading,
    presentationData,
    presentation_id,
    slidesLength,
    stream,
  ]);

  /** Editor tree unmounts in present mode; remount loses inline theme CSS — re-apply from Redux. */
  useLayoutEffect(() => {
    if (isPresentMode) return;
    const theme = presentationData?.theme;
    if (!theme) return;
    const el = document.getElementById("presentation-slides-wrapper");
    applyPresentationThemeToElement(el, theme);
  }, [isPresentMode, presentationData?.theme]);

  const onSlideChange = (newSlide: number) => {
    handleSlideChange(newSlide, presentationData);
  };

  const navigateEditorToSlide = useCallback(
    (index: number) => {
      setSelectedSlide(index);
    },
    [],
  );

  const handleEditorSlideNavigation = useCallback(
    (index: number, options?: SlideAddedOptions) => {
      navigateEditorToSlide(index);
      if (!options?.promptOverlayKind || !options.promptOverlaySlideId) {
        return;
      }
      if (options.promptOverlayKind === "blank") {
        setBlankPromptSlideIds((current) => {
          const next = new Set(current);
          next.add(options.promptOverlaySlideId!);
          return next;
        });
        return;
      }
      if (options.promptOverlayKind === "layout") {
        setTemplatePromptSlideIds((current) => {
          const next = new Set(current);
          next.add(options.promptOverlaySlideId!);
          return next;
        });
      }
    },
    [navigateEditorToSlide],
  );

  const dismissBlankPromptOverlay = useCallback((slideId: unknown) => {
    if (typeof slideId !== "string" || !slideId) return;
    setBlankPromptSlideIds((current) => {
      if (!current.has(slideId)) return current;
      const next = new Set(current);
      next.delete(slideId);
      return next;
    });
  }, []);

  const dismissTemplatePromptOverlay = useCallback((slideId: unknown) => {
    if (typeof slideId !== "string" || !slideId) return;
    setTemplatePromptSlideIds((current) => {
      if (!current.has(slideId)) return current;
      const next = new Set(current);
      next.delete(slideId);
      return next;
    });
  }, []);

  const handlePresentationChanged = useCallback(async () => {
    const currentPresentationData = presentationDataRef.current;
    if (currentPresentationData?.slides) {
      dispatch(
        addToHistory({
          slides: currentPresentationData.slides,
          actionType: "CHAT_ASSISTANT_BEFORE_REFRESH",
        })
      );
    }

    const updatedPresentation = await fetchUserSlides({ clearHistory: false });
    if (updatedPresentation) {
      presentationDataRef.current = updatedPresentation;
    }
    if (updatedPresentation?.slides) {
      dispatch(
        addToHistory({
          slides: updatedPresentation.slides,
          actionType: "CHAT_ASSISTANT_REFRESH",
        })
      );
    }
  }, [dispatch, fetchUserSlides]);

  const handleChatSendingStateChange = useCallback((sending: boolean) => {
    setIsChatSending(sending);
    if (sending) {
      setChatTargetedSlides((previous) =>
        previous.length === 0 ? previous : []
      );
      return;
    }
    setAgentFocusedSlide(null);
    setAgentFocusEventId(null);
  }, []);

  const handleChatMutationStateChange = useCallback((mutating: boolean) => {
    setIsChatMutating(mutating);
  }, []);

  const handleAgentSlideFocus = useCallback(
    ({ slideIndex, eventId }: { slideIndex: number; eventId: string }) => {
      if (slideIndex < 0) {
        return;
      }
      setAgentFocusedSlide(slideIndex);
      setAgentFocusEventId(eventId);
      setChatTargetedSlides((previous) =>
        previous.includes(slideIndex) ? previous : [...previous, slideIndex]
      );
    },
    []
  );

  const totalSlides = presentationData?.slides?.length ?? 0;
  const activeSlideIndex =
    totalSlides > 0
      ? Math.min(Math.max(selectedSlide, 0), totalSlides - 1)
      : 0;
  const activeEditorSlide = presentationData?.slides?.[activeSlideIndex];

  useEffect(() => {
    if (isPresentMode || totalSlides <= 1) return;

    const handleEditorArrowNavigation = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.isComposing ||
        event.repeat ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        event.shiftKey ||
        isEditableTarget(event.target)
      ) {
        return;
      }

      const previousSlide =
        event.key === "ArrowLeft" || event.key === "ArrowUp";
      const nextSlide =
        event.key === "ArrowRight" || event.key === "ArrowDown";
      if (!previousSlide && !nextSlide) return;

      event.preventDefault();
      setSelectedSlide((current) =>
        Math.min(
          Math.max(current + (previousSlide ? -1 : 1), 0),
          totalSlides - 1,
        ),
      );
    };

    window.addEventListener("keydown", handleEditorArrowNavigation);
    return () =>
      window.removeEventListener("keydown", handleEditorArrowNavigation);
  }, [isPresentMode, totalSlides]);

  // Mutation traces normally identify the exact slide. Fall back to the slide
  // the user is viewing so an active edit never happens without feedback.
  const updatingSlideIndex = isChatMutating
    ? agentFocusedSlide ?? selectedSlide
    : null;

  useEffect(() => {
    if (totalSlides <= 0 || selectedSlide <= totalSlides - 1) {
      return;
    }
    setSelectedSlide(totalSlides - 1);
  }, [selectedSlide, totalSlides]);

  useEffect(() => {
    if (!isFollowModeEnabled || !isChatSending || totalSlides <= 0) {
      return;
    }
    if (agentFocusedSlide === null) {
      return;
    }

    const clampedIndex = Math.min(
      Math.max(agentFocusedSlide, 0),
      totalSlides - 1
    );
    if (clampedIndex !== selectedSlide) {
      navigateEditorToSlide(clampedIndex);
    }
  }, [
    isFollowModeEnabled,
    isChatSending,
    totalSlides,
    agentFocusedSlide,
    agentFocusEventId,
    selectedSlide,
    navigateEditorToSlide,
  ]);

  useEffect(() => {
    if (totalSlides <= 0) {
      setGlowingSlideIndex(null);
      setChatTargetedSlides([]);
      return;
    }

    if (!isChatSending) {
      if (glowingSlideIndex === null && chatTargetedSlides.length === 0) {
        return;
      }
      const clearTimer = window.setTimeout(() => {
        setGlowingSlideIndex(null);
        setChatTargetedSlides([]);
      }, 900);
      return () => window.clearTimeout(clearTimer);
    }

    // Do not show glow/scanner until chat traces identify an actual target slide.
    // This avoids the "instant scanner on send" effect before tools start editing.
    if (agentFocusedSlide === null) {
      if (glowingSlideIndex !== null) {
        setGlowingSlideIndex(null);
      }
      return;
    }

    const targetIndex = Math.min(
      Math.max(agentFocusedSlide, 0),
      totalSlides - 1
    );
    setGlowingSlideIndex(targetIndex);
  }, [
    isChatSending,
    totalSlides,
    selectedSlide,
    isFollowModeEnabled,
    agentFocusedSlide,
    chatTargetedSlides.length,
    glowingSlideIndex,
  ]);

  useEffect(() => {
    const handleTemplateV2SurfaceSelected = (event: Event) => {
      const detail = (event as CustomEvent<TemplateV2SurfaceSelectedDetail>)
        .detail;
      const slideIndex = detail?.slideIndex;
      if (typeof slideIndex !== "number") return;
      if (slideIndex < 0 || slideIndex >= totalSlides) return;
      setSelectedSlide((current) =>
        current === slideIndex ? current : slideIndex
      );
    };

    window.addEventListener(
      TEMPLATE_V2_SURFACE_SELECTED_EVENT,
      handleTemplateV2SurfaceSelected
    );
    return () => {
      window.removeEventListener(
        TEMPLATE_V2_SURFACE_SELECTED_EVENT,
        handleTemplateV2SurfaceSelected
      );
    };
  }, [totalSlides]);

  useEffect(() => {
    if (
      isPresentMode ||
      !isTemplateV2Presentation ||
      typeof window === "undefined"
    ) {
      return;
    }
    delete document.documentElement.dataset.templateV2KonvaActiveSurface;
    delete document.documentElement.dataset.templateV2KonvaActiveSlideIndex;
    const frame = window.requestAnimationFrame(() => {
      window.dispatchEvent(
        new CustomEvent<TemplateV2ActivateSurfaceDetail>(
          TEMPLATE_V2_ACTIVATE_SURFACE_EVENT,
          {
            detail: {
              slideIndex: selectedSlide,
            },
          }
        )
      );
    });
    return () => window.cancelAnimationFrame(frame);
  }, [isPresentMode, isTemplateV2Presentation, selectedSlide]);

  // Presentation Mode View
  if (isPresentMode) {
    return (
      <PresentationMode
        slides={presentationData?.slides!}
        currentSlide={presentSlideFromUrl}
        theme={presentationData?.theme ?? undefined}
        fonts={presentationData?.fonts}
        isFullscreen={isFullscreen}
        onFullscreenToggle={toggleFullscreen}
        onExit={handlePresentExit}
        onSlideChange={onSlideChange}
      />
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gray-100 font-syne">
        <div
          className="bg-white border border-red-300 text-red-700 px-6 py-8 rounded-lg shadow-lg flex flex-col items-center"
          role="alert"
        >
          <AlertCircle className="w-16 h-16 mb-4 text-red-500" />
          <h2 className="text-xl font-semibold mb-2">Something went wrong</h2>
          <p className="text-center mb-4">
            We couldn't load your presentation. Please try again.
          </p>
          <div className="flex gap-2 justify-center items-center">
            <Button
              onClick={() => {
                trackEvent(
                  MixpanelEvent.PresentationPage_Refresh_Page_Button_Clicked,
                  { pathname }
                );
                window.location.reload();
              }}
            >
              Refresh Page
            </Button>
            <Button
              onClick={() => {
                trackEvent(MixpanelEvent.Navigation, {
                  from: pathname,
                  to: "/upload",
                });
                router.push("/upload");
              }}
            >
              Go to Upload
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-dvh overflow-hidden font-syne">
      <OverlayLoader
        show={loadingState.isLoading}
        text={loadingState.message}
        showProgress={loadingState.showProgress}
        duration={loadingState.duration}
        extra_info={loadingState.extra_info}
      />
      <div
        style={{
          background: isSmartPresentation ? "#F6F6F9" : "#EDEEEF",
        }}
        id="presentation-slides-wrapper"
        className="relative flex h-full flex-col overflow-hidden"
      >
        <PresentationHeader
          presentation_id={presentation_id}
          isPresentationSaving={isSaving}
          currentSlide={selectedSlide}
          generationMode={isSmartPresentation ? "smart" : "standard"}
        />
        <div className="flex flex-1 min-h-0 gap-3 overflow-hidden xl:gap-5 2xl:gap-6">
          <div className="sticky top-0 hidden h-full w-[165px] shrink-0 self-start md:block">
            <SidePanel
              selectedSlide={selectedSlide}
              onSlideClick={handleEditorSlideNavigation}
              presentationId={presentation_id}
              loading={loading}
            />
          </div>
          <div
            ref={presentationCanvasRef}
            className="relative h-full min-w-0 flex-1 px-3 pb-6 pt-[18px] md:px-0 max-md:ml-3"
          >
            {showNavigationHint ? (
              <div
                className="pointer-events-none fixed top-[72px] z-[95] hidden items-center gap-3 rounded-full border border-[#E1E3E9] bg-white/95 py-2 pl-3 pr-2 font-syne text-[13px] text-[#344054] shadow-[0_8px_24px_rgba(16,24,40,0.14)] backdrop-blur md:flex"
                role="status"
                style={{ left: "50%", transform: "translateX(-50%)" }}
              >
                <Keyboard
                  className="h-4 w-4 text-[#6847F4]"
                  aria-hidden="true"
                />
                <span>Navigate with</span>
                <span
                  className="flex items-center gap-1"
                  aria-label="arrow keys"
                >
                  {NAVIGATION_HINT_KEYS.map((key) => (
                    <kbd
                      key={key}
                      className="flex h-6 min-w-6 items-center justify-center rounded-[6px] border border-[#D9DCE3] bg-[#F8F8FA] px-1 text-[12px] font-medium text-[#101323] shadow-[0_1px_1px_rgba(16,24,40,0.06)]"
                    >
                      {key}
                    </kbd>
                  ))}
                </span>
                <span>or the left thumbnails</span>
                <button
                  type="button"
                  aria-label="Dismiss navigation hint"
                  onClick={dismissNavigationHint}
                  className="pointer-events-auto ml-1 flex h-7 w-7 items-center justify-center rounded-full text-[#667085] transition hover:bg-[#F0F1F4] hover:text-[#101323] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB]"
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>
            ) : null}
            {!presentationData ||
            loading ||
            !presentationData?.slides ||
            presentationData.slides.length === 0 ? (
              <div className="flex h-full min-h-0 w-full items-center justify-center">
                <Skeleton className="aspect-video w-full max-w-[1280px] bg-gray-400" />
              </div>
            ) : (
              <div className="mx-auto h-full min-h-0 w-full">
                <SlideContent
                  slide={activeEditorSlide}
                  index={activeSlideIndex}
                  selected
                  fitToContainer
                  presentationId={presentation_id}
                  onSlideActive={setSelectedSlide}
                  onSlideAdded={handleEditorSlideNavigation}
                  theme={presentationData.theme}
                  fonts={presentationData.fonts}
                  editingDisabled={editingDisabled}
                  isStreaming={isStreaming}
                  showBlankPromptOverlay={
                    typeof activeEditorSlide?.id === "string" &&
                    blankPromptSlideIds.has(activeEditorSlide.id)
                  }
                  onBlankPromptOverlayDismiss={() =>
                    dismissBlankPromptOverlay(activeEditorSlide?.id)
                  }
                  showTemplatePromptOverlay={
                    typeof activeEditorSlide?.id === "string" &&
                    templatePromptSlideIds.has(activeEditorSlide.id)
                  }
                  onTemplatePromptOverlayDismiss={() =>
                    dismissTemplatePromptOverlay(activeEditorSlide?.id)
                  }
                  isChatEditing={
                    updatingSlideIndex !== null &&
                    activeSlideIndex === updatingSlideIndex
                  }
                />
              </div>
            )}
          </div>
          <button
            ref={mobileAssistantTriggerRef}
            type="button"
            aria-controls="presentation-mobile-assistant"
            aria-expanded={isMobileAssistantOpen}
            onClick={() => setIsMobileAssistantOpen(true)}
            className="fixed bottom-5 right-5 z-40 inline-flex h-11 items-center gap-2 rounded-full border border-white/70 px-4 text-sm font-semibold text-[#101323] shadow-[0_8px_24px_rgba(74,58,155,0.24)] transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] focus-visible:ring-offset-2 xl:hidden"
            style={{
              background:
                "linear-gradient(270deg, #D5CAFC 2.4%, #E3D2EB 27.88%, #F4DCD3 69.23%, #FDE4C2 100%)",
            }}
          >
            <Sparkles className="h-4 w-4 text-[#2563EB]" aria-hidden="true" />
            AI Assistant
          </button>

          <button
            type="button"
            aria-label="Close AI Assistant"
            onClick={closeMobileAssistant}
            className={cn(
              "inset-0 z-[60] bg-black/35 xl:hidden",
              isMobileAssistantOpen ? "fixed" : "hidden"
            )}
          />

          <div
            id="presentation-mobile-assistant"
            role={isMobileAssistantOpen ? "dialog" : undefined}
            aria-label={isMobileAssistantOpen ? "AI Assistant" : undefined}
            aria-modal={isMobileAssistantOpen ? true : undefined}
            className={cn(
              "h-screen w-[calc(100vw-16px)] max-w-[375px] shrink-0 flex-col bg-white shadow-[-12px_0_32px_rgba(16,24,40,0.18)] transition-[width] duration-200 xl:relative xl:z-auto xl:h-full xl:max-w-none xl:self-start xl:border-l xl:border-[#EDEEEF] xl:shadow-none",
              isRightPanelOpen ? "xl:w-[383px]" : "xl:w-[90px]",
              isMobileAssistantOpen
                ? "fixed inset-y-0 right-0 z-[70] flex"
                : "hidden xl:flex"
            )}
          >
            {isRightPanelOpen ? (
              <button
                type="button"
                aria-label="Close tools panel"
                onClick={() => setIsRightPanelOpen(false)}
                className="absolute -left-[10px] top-1/2 z-[80] hidden h-[36px] w-[16px] -translate-y-1/2 items-center justify-center rounded-full border-2 border-[#DBEAFE] bg-[#FEFEFF] text-[#1D4ED8] shadow-[0_10px_26px_rgba(52,48,96,0.10)] transition-[border-color,box-shadow,color] hover:border-[#BFDBFE] hover:text-[#1E40AF] hover:shadow-[0_12px_30px_rgba(52,48,96,0.16)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] focus-visible:ring-offset-2 xl:flex"
              >
                <ChevronRight
                  className="h-4 w-4"
                  strokeWidth={2.5}
                  aria-hidden="true"
                />
              </button>
            ) : null}
            <div className="flex h-14 shrink-0 items-center justify-between border-b border-[#EDEEEF] px-4 xl:hidden">
              <div className="flex items-center gap-2 text-sm font-semibold text-[#101323]">
                <Sparkles className="h-4 w-4 text-[#2563EB]" aria-hidden="true" />
                AI Assistant
              </div>
              <button
                ref={mobileAssistantCloseRef}
                type="button"
                aria-label="Close AI Assistant"
                onClick={closeMobileAssistant}
                className="flex h-8 w-8 items-center justify-center rounded-full text-[#667085] transition hover:bg-[#F6F6F9] hover:text-[#101323] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB]"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <div className="min-h-0 flex-1">
              <PresentationActions
                presentationId={presentation_id}
                presentationType={isSmartPresentation ? "smart" : "standard"}
                variant={isTemplateV2Presentation ? "template-v2" : "presentation"}
                currentSlide={selectedSlide}
                presentationData={presentationData}
                onPresentationChanged={handlePresentationChanged}
                onChatSendingStateChange={handleChatSendingStateChange}
                onChatMutationStateChange={handleChatMutationStateChange}
                onFollowModeChange={setIsFollowModeEnabled}
                onAgentSlideFocus={handleAgentSlideFocus}
                editingDisabled={editingDisabled}
                panelOpen={isMobileAssistantOpen || isRightPanelOpen}
                onPanelOpenChange={setIsRightPanelOpen}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PresentationPage;
