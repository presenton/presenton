"use client";
import React, { useLayoutEffect, useState } from "react";
import { useSelector } from "react-redux";
import { RootState } from "@/store/store";
import "../../utils/prism-languages";
import { Skeleton } from "@/components/ui/skeleton";
import PresentationMode from "./PresentationMode";
import SidePanel from "./SidePanel";
import SlideContent from "./SlideContent";
import { Button } from "@/components/ui/button";
import { usePathname, useRouter } from "next/navigation";
import { trackEvent, MixpanelEvent } from "@/utils/mixpanel";
import { AlertCircle } from "lucide-react";
import {
  usePresentationStreaming,
  usePresentationData,
  usePresentationNavigation,
  useAutoSave,
} from "../hooks";
import { PresentationPageProps } from "../types";
import LoadingState from "./LoadingState";
import { applyPresentationThemeToElement } from "../utils/applyPresentationThemeDom";

import { usePresentationUndoRedo } from "../hooks/PresentationUndoRedo";
import PresentationHeader from "./PresentationHeader";

const PresentationPage: React.FC<PresentationPageProps> = ({
  presentation_id,
}) => {
  const pathname = usePathname();
  // State management
  const [loading, setLoading] = useState(true);
  const [selectedSlide, setSelectedSlide] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [error, setError] = useState(false);
  const router = useRouter();



  const { presentationData, isStreaming } = useSelector(
    (state: RootState) => state.presentationGeneration
  );

  // Auto-save functionality
  const { isSaving } = useAutoSave({
    debounceMs: 2000,
    enabled: !!presentationData && !isStreaming,
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
    handleSlideClick,
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
    fetchUserSlides
  );

  usePresentationUndoRedo();

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


  // Presentation Mode View
  if (isPresentMode) {
    return (
      <PresentationMode
        slides={presentationData?.slides!}
        currentSlide={presentSlideFromUrl}
        theme={presentationData?.theme ?? undefined}
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

            <Button onClick={() => { trackEvent(MixpanelEvent.PresentationPage_Refresh_Page_Button_Clicked, { pathname }); window.location.reload(); }}>Refresh Page</Button>
            <Button onClick={() => { trackEvent(MixpanelEvent.Navigation, { from: pathname, to: "/upload" }); router.push("/upload"); }}>Go to Upload</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen overflow-hidden font-syne ">
      <div
        style={{
          background: "#ffffff",
        }}
        id="presentation-slides-wrapper"
        className="flex  gap-6 relative "
      >
        <div className="w-[200px]">
          <SidePanel
            selectedSlide={selectedSlide}
            onSlideClick={handleSlideClick}
            presentationId={presentation_id}
            loading={loading}

          />
        </div>
        <div className=" w-full h-[calc(100vh-20px)]  pr-[25px] overflow-y-auto">
          <PresentationHeader presentation_id={presentation_id} isPresentationSaving={isSaving} currentSlide={selectedSlide} />
          <div

            style={{
              background: "rgba(255, 255, 255, 0.10)",
              boxShadow: "0 0 20.01px 0 rgba(122, 90, 248, 0.16) inset",
            }}
            className="p-6 rounded-[20px] font-inter flex flex-col items-center overflow-hidden justify-center  border border-[#EDECEC] "
          >
            <div className="w-full max-w-[1280px] h-full">

              {!presentationData ||
                loading ||
                !presentationData?.slides ||
                presentationData?.slides.length === 0 ? (
                <div className="relative w-full h-[calc(100vh-120px)]   mx-auto">
                  <div className="">
                    {Array.from({ length: 2 }).map((_, index) => (
                      <Skeleton
                        key={index}
                        className="aspect-video bg-gray-400 my-4 w-full mx-auto "
                      />
                    ))}
                  </div>
                  {stream && <LoadingState />}
                </div>
              ) : (
                <>
                  {presentationData &&
                    presentationData.slides &&
                    presentationData.slides.length > 0 &&
                    presentationData.slides.map((slide: any, index: number) => (
                      <SlideContent
                        key={`${slide.type}-${index}-${slide.index}`}
                        slide={slide}
                        index={index}
                        presentationId={presentation_id}
                      />
                    ))}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PresentationPage;
