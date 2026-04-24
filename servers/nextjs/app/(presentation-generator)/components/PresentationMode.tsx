"use client";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  X,
  Minimize2,
  Maximize2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slide } from "../types/slide";
import { V1ContentRender } from "./V1ContentRender";


interface PresentationModeProps {
  slides: Slide[];
  currentSlide: number;

  isFullscreen: boolean;
  onFullscreenToggle: () => void;
  onExit: () => void;
  onSlideChange: (slideNumber: number) => void;
}

const PresentationMode: React.FC<PresentationModeProps> = ({

  slides,
  currentSlide,

  isFullscreen,
  onFullscreenToggle,
  onExit,
  onSlideChange,


}) => {
  if (slides === undefined || slides === null || slides.length === 0) {
    return null;
  }



  const recomputeScale = useCallback(() => {
    if (typeof window === "undefined") return;
    const padding = isFullscreen ? 0 : 64; // match p-8 when not fullscreen
    const fullscreenMargin = isFullscreen ? 16 : 0; // small safety margin to prevent clipping
    const availableWidth = Math.max(window.innerWidth - padding - fullscreenMargin, 0);
    const availableHeight = Math.max(window.innerHeight - padding - fullscreenMargin, 0);
    const baseW = 1280;
    const baseH = 720;
    const s = Math.min(availableWidth / baseW, availableHeight / baseH);

  }, [isFullscreen]);

  useEffect(() => {
    recomputeScale();
    window.addEventListener("resize", recomputeScale);
    return () => window.removeEventListener("resize", recomputeScale);
  }, [recomputeScale]);


  // Modify the handleKeyPress to prevent default behavior
  const handleKeyPress = useCallback(
    (event: KeyboardEvent) => {
      event.preventDefault(); // Prevent default scroll behavior

      switch (event.key) {
        case "ArrowRight":
        case "ArrowDown":
        case " ": // Space key
          if (currentSlide < slides.length - 1) {
            onSlideChange(currentSlide + 1);
          }
          break;
        case "ArrowLeft":
        case "ArrowUp":
          if (currentSlide > 0) {
            onSlideChange(currentSlide - 1);
          }
          break;
        case "Escape":
          // If fullscreen is active, only exit fullscreen on first ESC. Second ESC exits present mode.
          if (document.fullscreenElement) {
            try { document.exitFullscreen(); } catch (_) { }
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
    [currentSlide, slides.length, onSlideChange, onExit, onFullscreenToggle, isFullscreen]
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
      if (currentSlide > 0) {
        onSlideChange(currentSlide - 1);
      }
    } else if (clickX > (windowWidth * 2) / 3) {
      if (currentSlide < slides.length - 1) {
        onSlideChange(currentSlide + 1);
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
                onSlideChange(currentSlide - 1);
              }}
              disabled={currentSlide === 0}
              className="text-white hover:bg-white/20"
            >
              <ChevronLeft className="h-5 w-5" style={{ color: "var(--text-body-color,#000000)" }} />
            </Button>
            <span className="text-white"
              style={{ color: "var(--text-body-color,#000000)" }}
            >
              {currentSlide + 1} / {slides.length}
            </span>
            <Button
              variant="ghost"
              style={{ color: "var(--text-body-color,#000000)" }}
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                onSlideChange(currentSlide + 1);
              }}
              disabled={currentSlide === slides.length - 1}
              className="text-white hover:bg-white/20"
            >
              <ChevronRight className="h-5 w-5" style={{ color: "var(--text-body-color,#000000)" }} />
            </Button>
          </div>
        </>
      )}

      {/* Slides (all mounted, only current visible) */}
      <div className={`flex-1 flex items-center justify-center ${isFullscreen ? "p-0" : "p-8"}`}>
        <div className="w-full h-full flex items-center justify-center relative" >
          <div
            className={` rounded-sm font-inter relative w-full h-full flex items-center justify-center`}

          >
            {slides.length > 0 && slides.map((slide, index) => (
              <div
                key={slide.id}
                className={index === currentSlide ? " w-full h-full flex items-center justify-center" : "hidden w-full h-full"}
              >
                <V1ContentRender slide={slide} isEditMode={true} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PresentationMode;
