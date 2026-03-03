import React, { useEffect, useState, useMemo } from "react";
import { Loader2, PlusIcon, Trash2, WandSparkles, StickyNote } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { SendHorizontal } from "lucide-react";
import { toast } from "sonner";
import { PresentationGenerationApi } from "../../services/api/presentation-generation";
import ToolTip from "@/components/ToolTip";
import { RootState } from "@/store/store";
import { useDispatch, useSelector } from "react-redux";
import {
  deletePresentationSlide,
  updateSlide,
} from "@/store/slices/presentationGeneration";
import { useTemplateLayouts } from "../../hooks/useTemplateLayouts";
import { usePathname } from "next/navigation";
import { trackEvent, MixpanelEvent } from "@/utils/mixpanel";
import NewSlide from "../../components/NewSlide";
import { addToHistory } from "@/store/slices/undoRedoSlice";

interface SlideContentProps {
  slide: any;
  index: number;
  presentationId: string;
}

const SlideContent = ({ slide, index, presentationId }: SlideContentProps) => {
  const dispatch = useDispatch();
  const [isUpdating, setIsUpdating] = useState(false);
  const [showNewSlideSelection, setShowNewSlideSelection] = useState(false);
  const { presentationData, isStreaming } = useSelector(
    (state: RootState) => state.presentationGeneration
  );

  // Use the centralized group layouts hook
  const { renderSlideContent, loading } = useTemplateLayouts();
  const pathname = usePathname();

  const handleSubmit = async () => {
    const element = document.getElementById(
      `slide-${slide.index}-prompt`
    ) as HTMLInputElement;
    const value = element?.value;
    if (!value?.trim()) {
      toast.error("Please enter a prompt before submitting");
      return;
    }
    setIsUpdating(true);

    try {
      trackEvent(MixpanelEvent.Slide_Edit_API_Call);
      const response = await PresentationGenerationApi.editSlide(
        slide.id,
        value
      );

      if (response) {
        dispatch(updateSlide({ index: slide.index, slide: response }));
        toast.success("Slide updated successfully");
      }
    } catch (error: any) {
      console.error("Error in slide editing:", error);
      toast.error("Error in slide editing.", {
        description: error.message || "Error in slide editing.",
      });
    } finally {
      setIsUpdating(false);
    }
  };
  const onDeleteSlide = async () => {
    try {
      trackEvent(MixpanelEvent.Slide_Delete_API_Call);
      // Add current state to past
      dispatch(addToHistory({
        slides: presentationData?.slides,
        actionType: "DELETE_SLIDE"
      }));
      dispatch(deletePresentationSlide(slide.index));

    } catch (error: any) {
      console.error("Error deleting slide:", error);
      toast.error("Error deleting slide.", {
        description: error.message || "Error deleting slide.",
      });
    }
  };
  // Scroll to the new slide when streaming and new slides are being generated
  useEffect(() => {
    if (
      presentationData &&
      presentationData?.slides &&
      presentationData.slides.length > 1 &&
      isStreaming
    ) {
      // Scroll to the last slide (newly generated during streaming)
      const lastSlideIndex = presentationData.slides.length - 1;
      const slideElement = document.getElementById(
        `slide-${presentationData.slides[lastSlideIndex].index}`
      );
      if (slideElement) {
        slideElement.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }
    }
  }, [presentationData?.slides?.length, isStreaming]);

  // Memoized slide content rendering to prevent unnecessary re-renders
  const slideContent = useMemo(() => {
    return renderSlideContent(slide, isStreaming ? false : true); // Enable edit mode for main content
  }, [renderSlideContent, slide, isStreaming]);

  useEffect(() => {
    if (loading) {
      return;
    }
    if (slide.layout.includes("custom")) {

      const existingScript = document.querySelector(
        'script[src*="tailwindcss.com"]'
      );
      if (!existingScript) {
        const script = document.createElement("script");
        script.src = "https://cdn.tailwindcss.com";
        script.async = true;
        document.head.appendChild(script);
      }
    }
  }, [slide, isStreaming, loading]);

  return (
    <>
      <div
        id={`slide-${slide.index}`}
        className=" w-full max-w-[1280px] main-slide flex items-center max-md:mb-4 justify-center relative"
      >
        {isStreaming && (
          <Loader2 className="w-8 h-8 absolute right-2 top-2 z-30 text-blue-800 animate-spin" />
        )}
        <div
          data-layout={slide.layout}
          data-group={slide.layout_group}
          className={` w-full  group `}
        >
          {/* render slides */}
          {loading ? (
            <div className="flex flex-col bg-white aspect-video items-center justify-center h-full">
              <Loader2 className="w-8 h-8 animate-spin" />
            </div>
          ) : (
            slideContent
          )}

          {!showNewSlideSelection && (
            <div className="group-hover:opacity-100 hidden md:block opacity-0 transition-opacity my-4 duration-300">
              <ToolTip content="Add new slide below">
                {!isStreaming && !loading && (
                  <div
                    onClick={() => {
                      trackEvent(MixpanelEvent.Slide_Add_New_Slide_Button_Clicked, { pathname });
                      setShowNewSlideSelection(true);
                    }}
                    className="  bg-white shadow-md w-[80px] py-2 border hover:border-[#5141e5] duration-300  flex items-center justify-center rounded-lg cursor-pointer mx-auto"
                  >
                    <PlusIcon className="text-gray-500 text-base cursor-pointer" />
                  </div>
                )}
              </ToolTip>
            </div>
          )}
          {showNewSlideSelection && !loading && (
            <NewSlide
              index={index}
              templateID={`${slide.layout.split(":")[0]}`}
              setShowNewSlideSelection={setShowNewSlideSelection}
              presentationId={presentationId}
            />
          )}

          {!isStreaming && !loading && (
            <ToolTip content="Delete slide">
              <div
                onClick={() => {
                  trackEvent(MixpanelEvent.Slide_Delete_Slide_Button_Clicked, { pathname });
                  onDeleteSlide();
                }}
                className="absolute top-2 z-20 sm:top-4 right-2 sm:right-4 hidden md:block  transition-transform"
              >
                <Trash2 className="text-gray-500 text-xl cursor-pointer" />
              </div>
            </ToolTip>
          )}
          {!isStreaming && (
            <div className="absolute top-2 z-20 sm:top-4 hidden md:block left-2 sm:left-4 transition-transform">
              <Popover>
                <PopoverTrigger>
                  <ToolTip content="Update slide using prompt">
                    <div
                      className={`p-2 group-hover:scale-105 rounded-lg bg-[#5141e5] hover:shadow-md transition-all duration-300 cursor-pointer shadow-md `}
                    >
                      <WandSparkles className="w-4 sm:w-5 h-4 sm:h-5 text-white" />
                    </div>
                  </ToolTip>
                </PopoverTrigger>
                <PopoverContent
                  side="right"
                  align="start"
                  sideOffset={10}
                  className="w-[280px] sm:w-[400px] z-20"
                >
                  <div className="space-y-4">
                    <form
                      className="flex flex-col gap-3"
                      onSubmit={(e) => {
                        e.preventDefault();
                        handleSubmit();
                      }}
                    >
                      <Textarea
                        id={`slide-${slide.index}-prompt`}
                        placeholder="Enter your prompt here..."
                        className="w-full min-h-[100px] max-h-[100px] p-2 text-sm border rounded-lg focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
                        disabled={isUpdating}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            handleSubmit();
                          }
                        }}
                        rows={4}
                        wrap="soft"
                      />
                      <button
                        disabled={isUpdating}
                        type="submit"
                        className={`bg-gradient-to-r from-[#9034EA] to-[#5146E5] rounded-[32px] px-4 py-2 text-white flex items-center justify-end gap-2 ml-auto ${isUpdating ? "opacity-70 cursor-not-allowed" : ""
                          }`}
                        onClick={() => {
                          trackEvent(MixpanelEvent.Slide_Update_From_Prompt_Button_Clicked, { pathname });
                        }}
                      >
                        {isUpdating ? "Updating..." : "Update"}
                        <SendHorizontal className="w-4 sm:w-5 h-4 sm:h-5" />
                      </button>
                    </form>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          )}
          {/* Speaker Notes */}
          {!isStreaming && slide?.speaker_note && (
            <div className="absolute top-2 z-20 sm:top-4 right-8 sm:right-12 hidden md:block transition-transform">
              <Popover>
                <PopoverTrigger asChild>
                  <div className=" cursor-pointer ">
                    <ToolTip content="Show speaker notes">
                      <StickyNote className="text-xl text-gray-500" />
                    </ToolTip>
                  </div>
                </PopoverTrigger>
                <PopoverContent side="left" align="start" sideOffset={10} className="w-[320px] z-30">
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-gray-600">Speaker notes</p>
                    <div className="text-sm text-gray-800 whitespace-pre-wrap max-h-64 overflow-auto">
                      {slide.speaker_note}
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default SlideContent;
