"use client";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  X,
  Minimize2,
  Maximize2,
  StickyNote,
  EyeOff,
  Play,
  Pause,
  Volume2,
  VolumeX,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slide } from "../../types/slide";
import { V1ContentRender } from "../../components/V1ContentRender";



interface PresentationModeProps {
  slides: Slide[];
  currentSlide: number;

  isFullscreen: boolean;
  onFullscreenToggle: () => void;
  onExit: () => void;
  onSlideChange: (slideNumber: number) => void;

  // Audio narration props
  audioMap?: { [slideIndex: number]: string };
  isAudioPlaying?: boolean;
  autoPlay?: boolean;
  onPlayAudio?: (slideIndex: number) => void;
  onPauseAudio?: () => void;
  onToggleAutoPlay?: () => void;
}

const PresentationMode: React.FC<PresentationModeProps> = ({

  slides,
  currentSlide,

  isFullscreen,
  onFullscreenToggle,
  onExit,
  onSlideChange,

  audioMap = {},
  isAudioPlaying = false,
  autoPlay = false,
  onPlayAudio,
  onPauseAudio,
  onToggleAutoPlay,
}) => {
  if (slides === undefined || slides === null || slides.length === 0) {
    return null;
  }

  const [showSpeakerNotes, setShowSpeakerNotes] = useState(true);
  const currentSpeakerNote = useMemo(
    () => slides[currentSlide]?.speaker_note?.trim() || "",
    [slides, currentSlide]
  );


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
        case "n":
        case "N":
          setShowSpeakerNotes((prev) => !prev);
          break;
        case "p":
        case "P":
          if (audioMap[currentSlide]) {
            if (isAudioPlaying) {
              onPauseAudio?.();
            } else {
              onPlayAudio?.(currentSlide);
            }
          }
          break;
      }
    },
    [currentSlide, slides.length, onSlideChange, onExit, onFullscreenToggle, isFullscreen, audioMap, isAudioPlaying, onPlayAudio, onPauseAudio]
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

            {/* Audio narration controls */}
            {audioMap[currentSlide] && onPlayAudio && onPauseAudio && (
              <div className="flex items-center gap-1 ml-2 border-l border-black/10 pl-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (isAudioPlaying) {
                      onPauseAudio();
                    } else {
                      onPlayAudio(currentSlide);
                    }
                  }}
                  className="text-white hover:bg-white/20"
                  title={isAudioPlaying ? "Pause narration (P)" : "Play narration (P)"}
                >
                  {isAudioPlaying ? (
                    <Pause className="h-4 w-4" style={{ color: "var(--text-body-color,#000000)" }} />
                  ) : (
                    <Play className="h-4 w-4" style={{ color: "var(--text-body-color,#000000)" }} />
                  )}
                </Button>
                {onToggleAutoPlay && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleAutoPlay();
                    }}
                    className="text-white hover:bg-white/20"
                    title={autoPlay ? "Disable auto-play narration" : "Enable auto-play narration"}
                  >
                    {autoPlay ? (
                      <Volume2 className="h-4 w-4" style={{ color: "var(--text-body-color,#000000)" }} />
                    ) : (
                      <VolumeX className="h-4 w-4" style={{ color: "var(--text-body-color,#000000)" }} />
                    )}
                  </Button>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {/* Centered 16:9 stage for consistent alignment in normal + fullscreen modes */}
      <div className={`flex-1 min-h-0 flex items-center justify-center ${isFullscreen ? "px-6 py-8 md:px-10 md:py-12" : "p-8"}`}>
        <div
          className="relative rounded-sm font-inter"
          style={{
            aspectRatio: "16 / 9",
            width: isFullscreen
              ? "min(90vw, calc(88vh * 16 / 9))"
              : "min(calc(100vw - 4rem), calc((100vh - 4rem) * 16 / 9))",
            maxHeight: isFullscreen ? "88vh" : "calc(100vh - 4rem)",
          }}
        >
          {slides.length > 0 && slides.map((slide, index) => (
            <div
              key={slide.id}
              className={index === currentSlide ? "h-full w-full" : "hidden h-full w-full"}
            >
              <V1ContentRender slide={slide} isEditMode={true} />
            </div>
          ))}
        </div>
      </div>

      {currentSpeakerNote && (
        <div className="presentation-controls absolute bottom-4 right-4 z-50">
          {showSpeakerNotes ? (
            <div className="w-[360px] max-w-[50vw] rounded-xl border border-black/10 bg-white/95 shadow-xl backdrop-blur-sm">
              <div className="flex items-center justify-between border-b border-black/10 px-3 py-2">
                <div className="flex items-center gap-2 text-sm font-medium text-gray-800">
                  <StickyNote className="h-4 w-4" />
                  Speaker notes
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowSpeakerNotes(false);
                  }}
                  className="h-8 px-2 text-gray-600 hover:bg-black/5 hover:text-gray-800"
                >
                  <EyeOff className="mr-1 h-4 w-4" />
                  Hide
                </Button>
              </div>
              <div className="max-h-[28vh] overflow-auto whitespace-pre-wrap px-3 py-2 text-sm text-gray-700">
                {currentSpeakerNote}
              </div>
            </div>
          ) : (
            <Button
              variant="secondary"
              onClick={(e) => {
                e.stopPropagation();
                setShowSpeakerNotes(true);
              }}
              className="h-9 rounded-full border border-black/10 bg-white/95 px-3 text-gray-800 shadow-md hover:bg-white"
            >
              <StickyNote className="mr-2 h-4 w-4" />
              Show notes
            </Button>
          )}
        </div>
      )}
    </div>
  );
};

export default PresentationMode;
