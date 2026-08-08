"use client";

import React, { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  ScreenShareOff,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Slide } from "../../types/slide";
import SlideScale from "../../components/PresentationRender";
import type { Theme } from "../../services/api/types";
import { applyPresentationThemeToElement } from "../utils/applyPresentationThemeDom";

interface PresentationModeProps {
  slides: Slide[];
  currentSlide: number;
  theme?: Theme | null;
  fonts?: unknown;
  isFullscreen: boolean;
  onFullscreenToggle: (target?: Element | null) => void;
  onExit: () => void;
  onSlideChange: (slideNumber: number) => void;
}

const SLIDE_BASE_WIDTH = 1280;
const SLIDE_BASE_HEIGHT = 720;
const THUMBNAIL_WIDTH = 252;
const THUMBNAIL_SCALE = THUMBNAIL_WIDTH / SLIDE_BASE_WIDTH;
const THUMBNAIL_HEIGHT = SLIDE_BASE_HEIGHT * THUMBNAIL_SCALE;
const CHROME_HIDE_MS = 2000;

function SpeakerNoteIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M7.33 16.67v-3.42l1.59.17c.46-.03.9-.22 1.23-.54.33-.32.54-.75.58-1.21V6.92a4.58 4.58 0 0 0-9.16-.04c0 2.33.55 2.54.83 3.79.2.75.21 1.54.03 2.29l-.86 3.71"
        stroke="currentColor"
        strokeWidth="1.55"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M16.5 14.83a6.25 6.25 0 0 0 0-8.83"
        stroke="currentColor"
        strokeWidth="1.55"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M14.17 12.5a2.95 2.95 0 0 0-.02-4.15"
        stroke="currentColor"
        strokeWidth="1.55"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PresentationIconButton({
  title,
  children,
  active = false,
  disabled = false,
  onClick,
}: {
  title: string;
  children: React.ReactNode;
  active?: boolean;
  disabled?: boolean;
  onClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={active || undefined}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex size-[18px] shrink-0 items-center justify-center text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7A5AF8] focus-visible:ring-offset-4 focus-visible:ring-offset-[#1A1B20]",
        active ? "text-[#7A5AF8]" : "hover:text-[#E6E6E6]",
        disabled && "cursor-not-allowed opacity-35 hover:text-white"
      )}
    >
      {children}
    </button>
  );
}

const PresentationModeSlide = memo(
  function PresentationModeSlide({
    slide,
    slideIndex,
    theme,
    fonts,
  }: {
    slide: Slide;
    slideIndex: number;
    theme?: Theme | null;
    fonts?: unknown;
  }) {
    return (
      <SlideScale
        slide={slide}
        theme={theme ?? undefined}
        fonts={fonts}
        isEditMode={false}
        presentMode
        isClickable={false}
        renderIndex={slideIndex}
      />
    );
  },
  (previous, next) =>
    previous.slide === next.slide &&
    previous.slideIndex === next.slideIndex &&
    previous.theme === next.theme &&
    previous.fonts === next.fonts
);

const PresentationThumbnail = memo(
  function PresentationThumbnail({
    slide,
    slideIndex,
    isActive,
    theme,
    fonts,
    onSelect,
  }: {
    slide: Slide;
    slideIndex: number;
    isActive: boolean;
    theme?: Theme | null;
    fonts?: unknown;
    onSelect: (index: number) => void;
  }) {
    return (
      <button
        type="button"
        className="group flex w-full flex-col items-start gap-[10px] text-left focus-visible:outline-none"
        onClick={(event) => {
          event.stopPropagation();
          onSelect(slideIndex);
        }}
      >
        <div
          className={cn(
            "relative w-full overflow-hidden bg-[#F9F8F8] transition-shadow",
            isActive
              ? "shadow-[0_0_0_2px_#7A5AF8]"
              : "shadow-[0_0_0_1px_rgba(76,76,76,0)] group-hover:shadow-[0_0_0_1px_#4C4C4C] group-focus-visible:shadow-[0_0_0_2px_#7A5AF8]"
          )}
          style={{ height: THUMBNAIL_HEIGHT }}
          aria-hidden="true"
        >
          <div
            className="pointer-events-none absolute left-0 top-0 origin-top-left"
            style={{
              width: SLIDE_BASE_WIDTH,
              height: SLIDE_BASE_HEIGHT,
              transform: `scale(${THUMBNAIL_SCALE})`,
            }}
          >
            <SlideScale
              slide={slide}
              theme={theme ?? undefined}
              fonts={fonts}
              isEditMode={false}
              fixedSize
              isClickable={false}
              renderIndex={slideIndex}
            />
          </div>
        </div>
        <span
          className={cn(
            "font-manrope text-[16px] font-medium leading-[25px] tracking-[-0.16px]",
            isActive ? "text-white" : "text-[#E6E6E6]"
          )}
        >
          {slideIndex + 1}
        </span>
      </button>
    );
  },
  (previous, next) =>
    previous.slide === next.slide &&
    previous.slideIndex === next.slideIndex &&
    previous.isActive === next.isActive &&
    previous.theme === next.theme &&
    previous.fonts === next.fonts
);

const PresentationMode: React.FC<PresentationModeProps> = ({
  slides,
  currentSlide,
  theme,
  fonts,
  isFullscreen,
  onFullscreenToggle,
  onExit,
  onSlideChange,
}) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const hideChromeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showSpeakerNotes, setShowSpeakerNotes] = useState(false);
  const [showSlideGrid, setShowSlideGrid] = useState(false);
  const [chromeVisible, setChromeVisible] = useState(true);

  const slideCount = Array.isArray(slides) ? slides.length : 0;
  const activeSlideIndex = useMemo(() => {
    if (slideCount <= 0) return 0;
    const parsedSlide = Number.isFinite(currentSlide) ? currentSlide : 0;
    return Math.min(Math.max(parsedSlide, 0), slideCount - 1);
  }, [currentSlide, slideCount]);

  const activeSlide = slideCount > 0 ? slides[activeSlideIndex] : null;
  const currentSpeakerNote = useMemo(
    () => activeSlide?.speaker_note?.trim() || "",
    [activeSlide]
  );
  const notesPanelOpen = showSpeakerNotes && !showSlideGrid;

  const clearChromeTimer = useCallback(() => {
    if (!hideChromeTimerRef.current) return;
    clearTimeout(hideChromeTimerRef.current);
    hideChromeTimerRef.current = null;
  }, []);

  const scheduleChromeHide = useCallback(() => {
    clearChromeTimer();
    if (showSlideGrid || notesPanelOpen) {
      setChromeVisible(true);
      return;
    }
    hideChromeTimerRef.current = setTimeout(() => {
      setChromeVisible(false);
    }, CHROME_HIDE_MS);
  }, [clearChromeTimer, notesPanelOpen, showSlideGrid]);

  const revealChrome = useCallback(() => {
    setChromeVisible(true);
    scheduleChromeHide();
  }, [scheduleChromeHide]);

  useEffect(() => {
    rootRef.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    setChromeVisible(true);
    scheduleChromeHide();
    return clearChromeTimer;
  }, [clearChromeTimer, scheduleChromeHide]);

  useLayoutEffect(() => {
    if (!theme || !rootRef.current) return;
    applyPresentationThemeToElement(rootRef.current, theme);
  }, [theme]);

  const goNext = useCallback(() => {
    if (activeSlideIndex < slideCount - 1) onSlideChange(activeSlideIndex + 1);
  }, [activeSlideIndex, slideCount, onSlideChange]);

  const goPrev = useCallback(() => {
    if (activeSlideIndex > 0) onSlideChange(activeSlideIndex - 1);
  }, [activeSlideIndex, onSlideChange]);

  const handleThumbnailSelect = useCallback(
    (index: number) => {
      setShowSlideGrid(false);
      onSlideChange(index);
    },
    [onSlideChange]
  );

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      const navKeys = [
        "ArrowRight",
        "ArrowLeft",
        "ArrowUp",
        "ArrowDown",
        " ",
        "Home",
        "End",
        "PageDown",
        "PageUp",
      ];
      if (navKeys.includes(event.key)) {
        event.preventDefault();
      }

      if (event.repeat && [" ", "ArrowRight", "ArrowLeft"].includes(event.key)) {
        return;
      }

      switch (event.key) {
        case "ArrowRight":
        case "ArrowDown":
        case " ":
        case "PageDown":
          if (!showSlideGrid) goNext();
          break;
        case "ArrowLeft":
        case "ArrowUp":
        case "PageUp":
          if (!showSlideGrid) goPrev();
          break;
        case "Home":
          if (!showSlideGrid && activeSlideIndex !== 0) onSlideChange(0);
          break;
        case "End":
          if (!showSlideGrid && slideCount > 0 && activeSlideIndex !== slideCount - 1) {
            onSlideChange(slideCount - 1);
          }
          break;
        case "Escape":
          if (showSlideGrid) {
            setShowSlideGrid(false);
            return;
          }
          if (document.fullscreenElement) {
            document.exitFullscreen().catch(() => undefined);
            return;
          }
          onExit();
          break;
        case "f":
        case "F":
          if (!event.ctrlKey && !event.metaKey && !event.altKey) {
            onFullscreenToggle(rootRef.current);
          }
          break;
        case "g":
        case "G":
          if (!event.ctrlKey && !event.metaKey && !event.altKey) {
            setShowSlideGrid((previous) => !previous);
            setShowSpeakerNotes(false);
          }
          break;
        case "n":
        case "N":
          if (!event.ctrlKey && !event.metaKey && !event.altKey) {
            setShowSpeakerNotes((previous) => !previous);
            setShowSlideGrid(false);
          }
          break;
        default:
          break;
      }
    },
    [
      activeSlideIndex,
      goNext,
      goPrev,
      onExit,
      onFullscreenToggle,
      onSlideChange,
      showSlideGrid,
      slideCount,
    ]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const handleSlideAreaClick = (event: React.MouseEvent) => {
    if ((event.target as HTMLElement).closest(".presentation-controls")) return;
    const clickX = event.clientX;
    const width = window.innerWidth;
    if (clickX < width / 5) goPrev();
    else if (clickX > (width * 4) / 5) goNext();
  };

  if (slideCount === 0 || !activeSlide) {
    return null;
  }

  return (
    <div
      id="presentation-mode-wrapper"
      ref={rootRef}
      role="application"
      aria-label="Presentation"
      data-fullscreen={isFullscreen ? "true" : "false"}
      className="fixed inset-0 z-[100] h-[100dvh] w-[100dvw] overflow-hidden bg-black font-syne text-white outline-none select-none"
      tabIndex={0}
      onClick={showSlideGrid ? undefined : handleSlideAreaClick}
      onMouseMove={revealChrome}
    >
      <span className="sr-only">
        Slide {activeSlideIndex + 1} of {slideCount}
      </span>

      {showSlideGrid ? (
        <div className="absolute inset-0 overflow-hidden bg-black">
          <button
            type="button"
            className="presentation-controls absolute right-5 top-5 z-50 rounded-[48px] border border-[#4C4C4C] px-5 py-2.5 text-[14px] font-semibold leading-none tracking-[-0.14px] text-white transition-colors hover:border-[#E6E6E6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7A5AF8]"
            onClick={(event) => {
              event.stopPropagation();
              setShowSlideGrid(false);
            }}
          >
            Back
          </button>
          <div className="absolute inset-0 overflow-y-auto px-5 pb-14 pt-[88px] sm:px-[49px] sm:pt-[96px]">
            <div
              className="grid gap-x-5 gap-y-5"
              style={{
                gridTemplateColumns: "repeat(auto-fill, minmax(min(252px, 100%), 252px))",
              }}
            >
              {slides.map((slide, index) => (
                <PresentationThumbnail
                  key={slide.id ?? `present-thumbnail-${index}`}
                  slide={slide}
                  slideIndex={index}
                  isActive={index === activeSlideIndex}
                  theme={theme}
                  fonts={fonts}
                  onSelect={handleThumbnailSelect}
                />
              ))}
            </div>
          </div>
        </div>
      ) : (
        <>
          <main
            className={cn(
              "absolute left-0 right-0 top-0 min-h-0 overflow-hidden bg-black transition-[right,bottom] duration-200",
              isFullscreen ? "bottom-0" : "bottom-[70px]",
              notesPanelOpen && "md:right-[302px]"
            )}
          >
            <div className="h-full w-full overflow-hidden">
              <PresentationModeSlide
                slide={activeSlide}
                slideIndex={activeSlideIndex}
                theme={theme}
                fonts={fonts}
              />
            </div>
          </main>

          <div
            className={cn(
              "presentation-controls pointer-events-none absolute bottom-0 left-0 right-0 z-40 flex h-[2px] gap-px transition-opacity duration-300",
              chromeVisible ? "opacity-0" : "opacity-100",
              notesPanelOpen && "md:right-[302px]"
            )}
            aria-hidden="true"
          >
            {slides.map((slide, index) => (
              <div
                key={slide.id ?? `present-mini-progress-${index}`}
                className={cn(
                  "h-full min-w-px flex-1",
                  index <= activeSlideIndex ? "bg-[#7A5AF8]" : "bg-[#323436]"
                )}
              />
            ))}
          </div>

          <div
            className={cn(
              "presentation-controls absolute bottom-0 left-0 right-0 z-40 flex h-[70px] flex-col bg-[#1A1B20] pt-[10px] transition-all duration-300",
              chromeVisible ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-full opacity-0",
              notesPanelOpen && "md:right-[302px]"
            )}
          >
            <div className="flex h-[6px] w-full gap-[3px]" aria-hidden="true">
              {slides.map((slide, index) => (
                <div
                  key={slide.id ?? `present-progress-${index}`}
                  className={cn(
                    "h-full min-w-px flex-1",
                    index <= activeSlideIndex ? "bg-[#7A5AF8]" : "bg-[#323436]"
                  )}
                />
              ))}
            </div>
            <div className="flex flex-1 items-center justify-between px-5 sm:px-9">
              <div className="flex items-center gap-[26px]">
                <PresentationIconButton
                  title="Previous slide"
                  disabled={activeSlideIndex === 0}
                  onClick={(event) => {
                    event.stopPropagation();
                    goPrev();
                  }}
                >
                  <ChevronLeft className="size-[18px]" strokeWidth={2} />
                </PresentationIconButton>
                <div
                  className="flex items-center gap-[5px] whitespace-nowrap font-manrope text-[16px] font-normal leading-none text-white"
                  role="status"
                  aria-live="polite"
                  aria-atomic="true"
                >
                  <span>{activeSlideIndex + 1}</span>
                  <span>of</span>
                  <span>{slideCount}</span>
                </div>
                <PresentationIconButton
                  title="Next slide"
                  disabled={activeSlideIndex === slideCount - 1}
                  onClick={(event) => {
                    event.stopPropagation();
                    goNext();
                  }}
                >
                  <ChevronRight className="size-[18px]" strokeWidth={2} />
                </PresentationIconButton>
              </div>
              <div className="flex items-center gap-[26px]">
                <PresentationIconButton
                  title="Layout preview"
                  active={showSlideGrid}
                  onClick={(event) => {
                    event.stopPropagation();
                    setShowSlideGrid(true);
                    setShowSpeakerNotes(false);
                  }}
                >
                  <LayoutGrid className="size-[18px]" strokeWidth={2} />
                </PresentationIconButton>
                <PresentationIconButton
                  title="Speaker note"
                  active={notesPanelOpen}
                  onClick={(event) => {
                    event.stopPropagation();
                    setShowSpeakerNotes((previous) => !previous);
                  }}
                >
                  <SpeakerNoteIcon className="size-[18px]" />
                </PresentationIconButton>
                <PresentationIconButton
                  title="Exit presentation"
                  onClick={(event) => {
                    event.stopPropagation();
                    onExit();
                  }}
                >
                  <ScreenShareOff className="size-[18px]" strokeWidth={2} />
                </PresentationIconButton>
              </div>
            </div>
          </div>

          {notesPanelOpen ? (
            <aside className="presentation-controls absolute bottom-0 right-0 top-0 z-50 w-full border-l border-[#333333] bg-black md:w-[302px]">
              <button
                type="button"
                className="absolute right-5 top-5 rounded-[48px] border border-[#4C4C4C] px-5 py-2.5 text-[14px] font-semibold leading-none tracking-[-0.14px] text-white transition-colors hover:border-[#E6E6E6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7A5AF8]"
                onClick={(event) => {
                  event.stopPropagation();
                  setShowSpeakerNotes(false);
                }}
              >
                Hide
              </button>
              <div className="mx-auto mt-[105px] flex w-[262px] max-w-[calc(100%-40px)] flex-col items-start gap-6">
                <div className="flex items-center gap-2">
                  <SpeakerNoteIcon className="size-5 text-white" />
                  <h2 className="text-[16px] font-medium leading-none tracking-[-0.16px] text-white">
                    Speaker Note
                  </h2>
                </div>
                <div className="w-full">
                  {currentSpeakerNote ? (
                    <p className="whitespace-pre-wrap font-manrope text-[16px] font-medium leading-[25px] tracking-[-0.16px] text-[#E6E6E6]">
                      {currentSpeakerNote}
                    </p>
                  ) : null}
                  <p
                    className={cn(
                      "text-[16px] font-normal leading-none text-[#999999]",
                      currentSpeakerNote && "mt-6"
                    )}
                  >
                    Add notes in the editor
                  </p>
                </div>
              </div>
            </aside>
          ) : null}
        </>
      )}
    </div>
  );
};

export default PresentationMode;
