"use client";

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  X,
  Minimize2,
  Maximize2,
  StickyNote,
  EyeOff,
  Keyboard,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slide } from "../../types/slide";
import SlideScale from "../../components/PresentationRender";
import type { Theme } from "../../services/api/types";
import { applyPresentationThemeToElement } from "../utils/applyPresentationThemeDom";

interface PresentationModeProps {
  slides: Slide[];
  currentSlide: number;
  theme?: Theme | null;
  isFullscreen: boolean;
  onFullscreenToggle: () => void;
  onExit: () => void;
  onSlideChange: (slideNumber: number) => void;
}

const CHROME_HIDE_MS = 800;

const PresentationMode: React.FC<PresentationModeProps> = ({
  slides,
  currentSlide,
  theme,
  isFullscreen,
  onFullscreenToggle,
  onExit,
  onSlideChange,
}) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const hideChromeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showSpeakerNotes, setShowSpeakerNotes] = useState(true);
  const [chromeVisible, setChromeVisible] = useState(true);

  const currentSpeakerNote = useMemo(
    () => slides[currentSlide]?.speaker_note?.trim() || "",
    [slides, currentSlide]
  );

  const activeSlide = slides[currentSlide];

  const bumpChromeVisibility = useCallback(() => {
    setChromeVisible(true);
    if (hideChromeTimerRef.current) clearTimeout(hideChromeTimerRef.current);
    hideChromeTimerRef.current = setTimeout(() => {
      if (isFullscreen) setChromeVisible(false);
    }, CHROME_HIDE_MS);
  }, [isFullscreen]);

  useEffect(() => {
    rootRef.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    if (!isFullscreen) {
      setChromeVisible(true);
      if (hideChromeTimerRef.current) {
        clearTimeout(hideChromeTimerRef.current);
        hideChromeTimerRef.current = null;
      }
      return;
    }
    bumpChromeVisibility();
    return () => {
      if (hideChromeTimerRef.current) clearTimeout(hideChromeTimerRef.current);
    };
  }, [isFullscreen, bumpChromeVisibility]);

  useLayoutEffect(() => {
    if (!theme || !rootRef.current) return;
    applyPresentationThemeToElement(rootRef.current, theme);
  }, [theme]);

  const handlePointerActivity = useCallback(() => {
    bumpChromeVisibility();
  }, [bumpChromeVisibility]);

  const goNext = useCallback(() => {
    if (currentSlide < slides.length - 1) onSlideChange(currentSlide + 1);
  }, [currentSlide, slides.length, onSlideChange]);

  const goPrev = useCallback(() => {
    if (currentSlide > 0) onSlideChange(currentSlide - 1);
  }, [currentSlide, onSlideChange]);

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

      if (event.repeat) {
        if (event.key === " " || event.key === "ArrowRight" || event.key === "ArrowLeft") {
          return;
        }
      }

      switch (event.key) {
        case "ArrowRight":
        case "ArrowDown":
        case " ":
        case "PageDown":
          goNext();
          break;
        case "ArrowLeft":
        case "ArrowUp":
        case "PageUp":
          goPrev();
          break;
        case "Home":
          if (currentSlide !== 0) onSlideChange(0);
          break;
        case "End":
          if (slides.length > 0 && currentSlide !== slides.length - 1) {
            onSlideChange(slides.length - 1);
          }
          break;
        case "Escape":
          if (document.fullscreenElement) {
            try {
              document.exitFullscreen();
            } catch {
              /* ignore */
            }
            return;
          }
          onExit();
          break;
        case "f":
        case "F":
          if (!event.ctrlKey && !event.metaKey && !event.altKey) {
            onFullscreenToggle();
          }
          break;
        case "n":
        case "N":
          if (!event.ctrlKey && !event.metaKey && !event.altKey) {
            setShowSpeakerNotes((prev) => !prev);
          }
          break;
        default:
          break;
      }
    },
    [currentSlide, slides.length, onSlideChange, onExit, onFullscreenToggle, goNext, goPrev]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const handleSlideAreaClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest(".presentation-controls")) return;
    const clickX = e.clientX;
    const w = window.innerWidth;
    if (clickX < w / 5) goPrev();
    else if (clickX > (w * 4) / 5) goNext();
  };

  const progress = slides.length > 0 ? ((currentSlide + 1) / slides.length) * 100 : 0;

  if (slides === undefined || slides === null || slides.length === 0) {
    return null;
  }

  return (
    <div
      id="presentation-mode-wrapper"
      ref={rootRef}
      role="application"
      aria-label="Presentation"
      className="fixed inset-0 z-[100] flex flex-col outline-none select-none"
      style={{ backgroundColor: "var(--page-background-color, #c8c7c9)" }}
      tabIndex={0}
      onMouseMove={handlePointerActivity}
      onClick={handleSlideAreaClick}
    >
      <span className="sr-only">
        Slide {currentSlide + 1} of {slides.length}
      </span>

      {/* Top bar — fullscreen: auto-hide */}
      <div
        className={`presentation-controls absolute left-0 right-0 top-0 z-50 flex justify-end gap-2 px-3 py-3 transition-opacity duration-300 md:px-4 ${isFullscreen && !chromeVisible ? "pointer-events-none opacity-0" : "opacity-100"
          }`}
      >
        <div className="flex items-center gap-1 rounded-full  bg-white/95 px-1 py-1  backdrop-blur-sm">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            title="Fullscreen (F)"
            onClick={(e) => {
              e.stopPropagation();
              onFullscreenToggle();
            }}
            className="h-9 w-9 text-gray-800 hover:bg-gray-100"
          >
            {isFullscreen ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            title="Exit presentation (Esc)"
            onClick={(e) => {
              e.stopPropagation();
              onExit();
            }}
            className="h-9 w-9 text-gray-800 hover:bg-gray-100"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Slide stage — large viewport; SlideScale uses width+height so slides scale up */}
      <div
        className={`flex min-h-0 flex-1 items-stretch justify-stretch ${isFullscreen ? "px-2 pb-9 pt-12 sm:px-3" : "px-3 pb-24 pt-14 sm:px-4 md:pb-28 md:pt-16"
          }`}
      >
        <div
          className={`min-h-0 w-full flex-1 overflow-hidden rounded-sm `}
        >
          {activeSlide ? (
            <SlideScale
              key={activeSlide.id ?? `slide-${currentSlide}`}
              slide={activeSlide}
              theme={theme ?? undefined}
              isEditMode={false}
              presentMode
            />
          ) : null}
        </div>
      </div>

      {/* Progress */}
      <div
        className={`absolute bottom-0 left-0 right-0 z-40 h-1 bg-gray-200 ${isFullscreen && !chromeVisible ? "opacity-70" : "opacity-100"
          }`}
        aria-hidden
      >
        <div
          className="h-full bg-[#5141e5] transition-[width] duration-300 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Bottom controls */}
      <div
        className={`presentation-controls absolute bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-full border border-gray-200/90 bg-white/95 px-2 py-2 shadow-md backdrop-blur-sm transition-all duration-300 md:gap-4 md:px-3 ${isFullscreen && !chromeVisible
          ? "pointer-events-none translate-y-4 opacity-0"
          : "translate-y-0 opacity-100"
          }`}
      >
        <Button
          type="button"
          variant="ghost"
          size="icon"
          title="Previous slide"
          onClick={(e) => {
            e.stopPropagation();
            goPrev();
          }}
          disabled={currentSlide === 0}
          className="h-10 w-10 text-gray-800 hover:bg-gray-100 disabled:opacity-35"
        >
          <ChevronLeft className="h-6 w-6" />
        </Button>
        <div
          className="min-w-22 text-center text-sm font-medium tabular-nums text-gray-800"
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          {currentSlide + 1} / {slides.length}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          title="Next slide"
          onClick={(e) => {
            e.stopPropagation();
            goNext();
          }}
          disabled={currentSlide === slides.length - 1}
          className="h-10 w-10 text-gray-800 hover:bg-gray-100 disabled:opacity-35"
        >
          <ChevronRight className="h-6 w-6" />
        </Button>
        <div className="mx-1 hidden h-6 w-px bg-gray-200 sm:block" />
        <div
          className="hidden max-w-[200px] items-center gap-1.5 text-[11px] leading-tight text-gray-500 sm:flex"
          title="Keyboard shortcuts"
        >
          <Keyboard className="h-3.5 w-3.5 shrink-0" />
          <span>
            ← → space · Home/End · F fullscreen · N notes · Esc exit
          </span>
        </div>
      </div>

      {currentSpeakerNote ? (
        <div
          className={`presentation-controls absolute bottom-16 right-3 z-50 max-w-[min(380px,46vw)] md:bottom-20 md:right-6 ${isFullscreen && !chromeVisible ? "opacity-90" : ""
            }`}
        >
          {showSpeakerNotes ? (
            <div className="rounded-xl border border-gray-200/90 bg-white/95 shadow-lg backdrop-blur-sm">
              <div className="flex items-center justify-between border-b border-gray-100 px-3 py-2">
                <div className="flex items-center gap-2 text-sm font-medium text-gray-800">
                  <StickyNote className="h-4 w-4 text-amber-600" />
                  Speaker notes
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowSpeakerNotes(false);
                  }}
                  className="h-8 px-2 text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                >
                  <EyeOff className="mr-1 h-4 w-4" />
                  Hide
                </Button>
              </div>
              <div className="max-h-[min(28vh,220px)] overflow-auto whitespace-pre-wrap px-3 py-2.5 text-sm leading-relaxed text-gray-700">
                {currentSpeakerNote}
              </div>
            </div>
          ) : (
            <Button
              type="button"
              variant="secondary"
              onClick={(e) => {
                e.stopPropagation();
                setShowSpeakerNotes(true);
              }}
              className="h-9 rounded-full border border-gray-200 bg-white/95 px-3 text-gray-800 shadow-md backdrop-blur-sm hover:bg-gray-50"
            >
              <StickyNote className="mr-2 h-4 w-4 text-amber-600" />
              Show notes
            </Button>
          )}
        </div>
      ) : null}
    </div>
  );
};

export default PresentationMode;
