"use client";
import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Plus } from "lucide-react";
import { useDispatch, useSelector } from "react-redux";
import { v4 as uuidv4 } from "uuid";
import { RootState } from "@/store/store";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import {
  addNewSlide,
  setPresentationData,
} from "@/store/slices/presentationGeneration";
import { SortableSlide } from "./SortableSlide";
import { notify } from "@/components/ui/sonner";
import { usePathname } from "next/navigation";
import NewSlide from "./NewSlide";
import { trackEvent, MixpanelEvent } from "@/utils/mixpanel";
import { SlideThumbnailCard } from "./SlideThumbnailCard";
import {
  BLANK_SLIDE_LAYOUT_GROUP,
  BLANK_SLIDE_LAYOUT_ID,
  createBlankPresentationSlide,
  isTemplateFreePresentation,
} from "../../_shared/blank-slide";
import { MAX_NUMBER_OF_SLIDES } from "@/utils/presentationLimits";

interface SidePanelProps {
  selectedSlide: number;
  onSlideClick: (
    index: number,
    options?: {
      promptOverlaySlideId?: string;
      promptOverlayKind?: "blank" | "layout";
    },
  ) => void;
  presentationId: string;

  loading: boolean;
}

const SidePanel = ({
  selectedSlide,
  onSlideClick,
  presentationId,

  loading,
}: SidePanelProps) => {
  const pathname = usePathname();
  const [showNewSlideSelection, setShowNewSlideSelection] = useState(false);
  const thumbnailScrollRef = useRef<HTMLDivElement | null>(null);

  const { presentationData, isStreaming } = useSelector(
    (state: RootState) => state.presentationGeneration
  );

  const dispatch = useDispatch();

  const lastSlideIndex = presentationData?.slides?.length
    ? presentationData.slides.length - 1
    : 0;
  const lastSlide = presentationData?.slides?.[lastSlideIndex];
  const lastSlideLayoutGroup =
    typeof lastSlide?.layout_group === "string" ? lastSlide.layout_group : "";
  const lastSlideLayoutTemplateId =
    typeof lastSlide?.layout === "string" ? lastSlide.layout.split(":")[0] : "";
  const lastSlideTemplateId = lastSlideLayoutGroup.startsWith("template-v2")
    ? lastSlideLayoutGroup
    : lastSlideLayoutGroup || lastSlideLayoutTemplateId;
  const isTemplateFree = isTemplateFreePresentation(presentationData);
  const isSmartPresentation =
    presentationData?.type === "smart" ||
    presentationData?.generation_mode === "smart" ||
    presentationData?.slides?.some(
      (slide: any) =>
        typeof slide?.html_content === "string" && slide.html_content.trim()
    );

  const handleAddSlideClick = () => {
    if (!presentationData?.slides?.length || isStreaming) return;

    if (presentationData.slides.length >= MAX_NUMBER_OF_SLIDES) {
      notify.warning(
        "Slide limit reached",
        `You can have up to ${MAX_NUMBER_OF_SLIDES} slides.`
      );
      return;
    }

    if (isTemplateFree) {
      const slideId = uuidv4();
      const newIndex = lastSlideIndex + 1;
      const blankSlide = createBlankPresentationSlide({
        id: slideId,
        index: newIndex,
        presentationId,
        templateId: BLANK_SLIDE_LAYOUT_GROUP,
        isTemplateV2: true,
      });

      dispatch(
        addNewSlide({
          slideData: blankSlide,
          index: lastSlideIndex,
        })
      );
      trackEvent(MixpanelEvent.Presentation_Slide_Added, {
        pathname,
        presentation_id: presentationId,
        inserted_after_index: lastSlideIndex,
        template_id: BLANK_SLIDE_LAYOUT_GROUP,
        layout_id: BLANK_SLIDE_LAYOUT_ID,
        source: "blank_side_panel",
        is_template_v2: true,
      });
      onSlideClick(newIndex);
      return;
    }

    setShowNewSlideSelection(true);
  };

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Start drag after moving 8px
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    const activeThumbnail = thumbnailScrollRef.current?.querySelector(
      `[data-slide-thumbnail-index="${selectedSlide}"]`,
    );
    activeThumbnail?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
    });
  }, [selectedSlide]);

  const handleDragEnd = (event: any) => {
    const { active, over } = event;

    if (!active || !over || !presentationData?.slides) return;

    if (active.id !== over.id) {
      // Find the indices of the dragged and target items
      const oldIndex = presentationData?.slides.findIndex(
        (item: any) => item.id === active.id
      );
      const newIndex = presentationData?.slides.findIndex(
        (item: any) => item.id === over.id
      );

      // Reorder the array
      const reorderedArray = arrayMove(
        presentationData?.slides,
        oldIndex,
        newIndex
      );

      // Update indices of all slides
      const updatedArray = reorderedArray.map((slide: any, index: number) => ({
        ...slide,
        index: index,
      }));

      // Update the store with new order and indices
      dispatch(
        setPresentationData({ ...presentationData, slides: updatedArray })
      );
      trackEvent(MixpanelEvent.Presentation_Slides_Reordered, {
        pathname,
        presentation_id: presentationId,
        from_index: oldIndex,
        to_index: newIndex,
        slide_count: updatedArray.length,
      });
    }
  };

  // Loading shimmer component
  if (
    !presentationData ||
    loading ||
    !presentationData?.slides ||
    presentationData?.slides.length === 0
  ) {
    return null;
  }

  const shouldShowNewSlideModal =
    showNewSlideSelection &&
    !isTemplateFree &&
    lastSlideTemplateId &&
    typeof document !== "undefined";

  const newSlideModal = shouldShowNewSlideModal
    ? createPortal(
        <div
          className="fixed inset-0 z-[1000] overflow-y-auto bg-black/50 px-4 py-16"
          onClick={() => setShowNewSlideSelection(false)}
        >
          <div className="relative z-[1001] flex min-h-full items-start justify-center pt-10">
            <div
              className="w-full max-w-[675px]"
              onClick={(event) => event.stopPropagation()}
            >
              <NewSlide
                index={lastSlideIndex}
                templateID={lastSlideTemplateId}
                setShowNewSlideSelection={setShowNewSlideSelection}
                presentationId={presentationId}
                onSlideAdded={onSlideClick}
              />
            </div>
          </div>
        </div>,
        document.body
      )
    : null;

  return (
    <aside
      className="relative h-full w-[165px] bg-white px-4 py-5"
      aria-label="Presentation slides"
    >
      <div
        className={`
          relative h-full z-50 xl:z-auto
          transition-all duration-300 ease-in-out
        `}
      >
        <div className="slide-theme flex h-full w-full flex-col overflow-hidden">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <div
              ref={thumbnailScrollRef}
              data-slide-thumbnail-scroll-container="true"
              className={`hide-scrollbar min-h-0 w-full flex-1 space-y-[15px] overflow-y-auto ${
                isSmartPresentation ? "" : "pb-[76px]"
              }`}
            >
              {isStreaming ? (
                presentationData &&
                presentationData?.slides.map((slide: any, index: number) => (
                  <SlideThumbnailCard
                    key={
                      slide.id ??
                      `${slide.type ?? "slide"}-${slide.index ?? index}`
                    }
                    slide={slide}
                    index={index}
                    selected={selectedSlide === index}
                    fonts={presentationData.fonts}
                    presentationVersion={presentationData.version}
                    onClick={() => onSlideClick(index)}
                  />
                ))
              ) : (
                <SortableContext
                  items={
                    presentationData?.slides.map(
                      (slide: any) => slide.id || `${slide.index}`
                    ) || []
                  }
                  strategy={verticalListSortingStrategy}
                >
                  {presentationData &&
                    presentationData?.slides.map(
                      (slide: any, index: number) => (
                        <SortableSlide
                          key={
                            slide.id ??
                            `${slide.type ?? "slide"}-${slide.index ?? index}`
                          }
                          slide={slide}
                          index={index}
                          selectedSlide={selectedSlide}
                          fonts={presentationData.fonts}
                          presentationVersion={presentationData.version}
                          onSlideClick={onSlideClick}
                        />
                      )
                    )}
                </SortableContext>
              )}
            </div>
          </DndContext>
          {!isSmartPresentation && (
            <div className="absolute -bottom-5 -left-4 flex w-[150px] justify-center bg-[linear-gradient(to_top,#FEFEFF_76%,rgba(254,254,255,0)_100%)] py-5">
              <button
                type="button"
                onClick={handleAddSlideClick}
                className="flex w-[70px] cursor-pointer flex-col items-center justify-center gap-2 px-3 text-black transition-opacity duration-200 hover:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5141E5] focus-visible:ring-offset-2"
              >
                <Plus className="h-3.5 w-3.5" />
                <span className="whitespace-nowrap text-[11px] font-normal leading-normal tracking-[0.11px]">
                  Add Slides
                </span>
              </button>
            </div>
          )}
        </div>
      </div>
      {newSlideModal}
    </aside>
  );
};

export default SidePanel;
