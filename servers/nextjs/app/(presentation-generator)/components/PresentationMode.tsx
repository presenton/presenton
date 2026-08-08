"use client";
import React, { memo, useCallback, useEffect } from "react";
import {
  ChevronLeft,
  ChevronRight,
  X,
  Minimize2,
  Maximize2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slide } from "../types/slide";
import SlideScale from "./PresentationRender";

interface PresentationModeProps {
  slides: Slide[];
  currentSlide: number;
  theme?: unknown;
  fonts?: unknown;
  isFullscreen: boolean;
  onFullscreenToggle: () => void;
  onExit: () => void;
  onSlideChange: (slideNumber: number) => void;
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
    theme?: unknown;
    fonts?: unknown;
  }) {
    return (
      <SlideScale
        slide={slide}
        theme={theme}
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
  const slideCount = Array.isArray(slides) ? slides.length : 0;
  const activeSlideIndex = Math.min(
    Math.max(currentSlide, 0),
    Math.max(slideCount - 1, 0)
  );
  const activeSlide = slideCount > 0 ? slides[activeSlideIndex] : null;

  // Modify the handleKeyPress to prevent default behavior
  const handleKeyPress = useCallback(
    (event: KeyboardEvent) => {
      event.preventDefault(); // Prevent default scroll behavior

      switch (event.key) {
        case "ArrowRight":
        case "ArrowDown":
        case " ": // Space key
          if (activeSlideIndex < slideCount - 1) {
            onSlideChange(activeSlideIndex + 1);
          }
          break;
        case "ArrowLeft":
        case "ArrowUp":
          if (activeSlideIndex > 0) {
            onSlideChange(activeSlideIndex - 1);
          }
          break;
        case "Escape":
          // If fullscreen is active, only exit fullscreen on first ESC. Second ESC exits present mode.
          if (document.fullscreenElement) {
            void document.exitFullscreen().catch(() => undefined);
            return;
          }
          onExit();
          break;
        case "f":
        case "F":
          onFullscreenToggle();
          break;
      }
    },
    [activeSlideIndex, slideCount, onSlideChange, onExit, onFullscreenToggle]
  );

  // Add both keydown and keyup listeners
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent default behavior for arrow keys and space
      if (
        ["ArrowRight", "ArrowLeft", "ArrowUp", "ArrowDown", " "].includes(e.key)
      ) {
        e.preventDefault();
      }
      handleKeyPress(e);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleKeyPress]);

  // Add click handlers for the slide area
  const handleSlideClick = (e: React.MouseEvent) => {
    // Don't trigger navigation if clicking on controls
    if ((e.target as HTMLElement).closest(".presentation-controls")) {
      return;
    }

    const clickX = e.clientX;
    const windowWidth = window.innerWidth;

    if (clickX < windowWidth / 3) {
      if (activeSlideIndex > 0) {
        onSlideChange(activeSlideIndex - 1);
      }
    } else if (clickX > (windowWidth * 2) / 3) {
      if (activeSlideIndex < slideCount - 1) {
        onSlideChange(activeSlideIndex + 1);
      }
    }
  };

  // Handle Escape key separately
  useEffect(() => {
    const handleEscKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isFullscreen) {
        onFullscreenToggle(); // Just toggle fullscreen, don't exit presentation
      }
    };

    document.addEventListener("keydown", handleEscKey);
    return () => document.removeEventListener("keydown", handleEscKey);
  }, [isFullscreen, onFullscreenToggle]);

  if (!activeSlide) {
    return null;
  }

  return (
    <div
      className="fixed inset-0  flex flex-col"
      style={{ backgroundColor: "var(--page-background-color,#c8c7c9)" }}
      tabIndex={0}
      onClick={handleSlideClick}
    >
      {/* Controls - Only show when not in fullscreen */}
      {!isFullscreen && (
        <>
          <div className="presentation-controls absolute top-4 right-4 flex items-center gap-2 z-50">
            <Button
              variant="ghost"
              style={{ color: "var(--text-body-color,#000000)" }}
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                onFullscreenToggle();
              }}
              className="text-white hover:bg-white/20"
            >
              {isFullscreen ? (
                <Minimize2 className="h-5 w-5" />
              ) : (
                <Maximize2 className="h-5 w-5" />
              )}
            </Button>
            <Button
              variant="ghost"
              style={{ color: "var(--text-body-color,#000000)" }}
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                onExit();
              }}
              className="text-white hover:bg-white/20"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          <div className="presentation-controls absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-4 z-50">
            <Button
              variant="ghost"
              style={{ color: "var(--text-body-color,#000000)" }}
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                onSlideChange(activeSlideIndex - 1);
              }}
              disabled={activeSlideIndex === 0}
              className="text-white hover:bg-white/20"
            >
              <ChevronLeft className="h-5 w-5" style={{ color: "var(--text-body-color,#000000)" }} />
            </Button>
            <span className="text-white"
              style={{ color: "var(--text-body-color,#000000)" }}
            >
              {activeSlideIndex + 1} / {slideCount}
            </span>
            <Button
              variant="ghost"
              style={{ color: "var(--text-body-color,#000000)" }}
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                onSlideChange(activeSlideIndex + 1);
              }}
              disabled={activeSlideIndex === slideCount - 1}
              className="text-white hover:bg-white/20"
            >
              <ChevronRight className="h-5 w-5" style={{ color: "var(--text-body-color,#000000)" }} />
            </Button>
          </div>
        </>
      )}

      {/* Active slide only */}
      <div className={`flex-1 flex items-center justify-center ${isFullscreen ? "p-0" : "p-8"}`}>
        <div className="w-full h-full flex items-center justify-center relative" >
          <div
            className={` rounded-sm font-inter relative w-full h-full flex items-center justify-center`}

          >
            <PresentationModeSlide
              key={activeSlide.id ?? activeSlideIndex}
              slide={activeSlide}
              slideIndex={activeSlideIndex}
              theme={theme}
              fonts={fonts}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default PresentationMode;
