"use client";
import React, { useState } from "react";
import { Plus } from "lucide-react";
import { useDispatch, useSelector } from "react-redux";
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
import { setPresentationData } from "@/store/slices/presentationGeneration";
import { SortableSlide } from "./SortableSlide";
import SlideScale from "../../components/PresentationRender";
import { Separator } from "@/components/ui/separator";
import { usePathname, useRouter } from "next/navigation";
import NewSlide from "./NewSlide";
import { trackEvent, MixpanelEvent } from "@/utils/mixpanel";

interface SidePanelProps {
  selectedSlide: number;
  onSlideClick: (index: number) => void;
  presentationId: string;

  loading: boolean;
}

const SidePanel = ({
  selectedSlide,
  onSlideClick,
  presentationId,

  loading,
}: SidePanelProps) => {

  const router = useRouter();
  const pathname = usePathname();
  const [showNewSlideSelection, setShowNewSlideSelection] = useState(false);

  const { presentationData, isStreaming } = useSelector(
    (state: RootState) => state.presentationGeneration
  );

  const dispatch = useDispatch();

  const lastSlideIndex = presentationData?.slides?.length
    ? presentationData.slides.length - 1
    : 0;
  const lastSlideTemplateId = presentationData?.slides?.[lastSlideIndex]?.layout
    ? presentationData.slides[lastSlideIndex].layout.split(":")[0]
    : "";

  const handleAddSlideClick = () => {
    if (!presentationData?.slides?.length || isStreaming) return;
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

  return (
    <div className="bg-[#F6F6F9] pt-8 px-4 w-[200px]">

      <img onClick={() => {
        router.push("/dashboard");
      }} src="/logo-with-bg.png" alt="" className="w-10 h-10 cursor-pointer object-contain" />

      <Separator orientation="horizontal" className="my-6 " />
      <div
        className={`
          relative bg-[#F6F6F9] h-full z-50 xl:z-auto 
          transition-all duration-300 ease-in-out
        `}
      >
        <div

          className="w-full h-[calc(100vh-120px)]   hide-scrollbar overflow-hidden slide-theme "
        >

          <p className="text-xl font-normal font-syne pb-3.5 text-[#000000]">Slides ({presentationData?.slides?.length})</p>

          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <div className=" overflow-y-auto w-full hide-scrollbar h-[calc(100%-140px)] space-y-3.5">
              {isStreaming ? (
                presentationData &&
                presentationData?.slides.map((slide: any, index: number) => (
                  <div
                    key={`${slide.id}-${index}`}
                    onClick={() => onSlideClick(index)}
                    className={` cursor-pointer ring-2   rounded-[12px] transition-all duration-200 ${selectedSlide === index ? ' ring-[#5141e5]' : 'ring-gray-200'
                      }`}
                  >
                    <div className=" bg-white pointer-events-none  relative overflow-hidden aspect-video">
                      <div className="absolute bg-gray-100/5 z-50  top-0 left-0 w-full h-full" />
                      <div className="transform scale-[0.2] flex justify-center items-center origin-top-left  w-[500%] h-[500%]">
                        <SlideScale slide={slide} />
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <SortableContext
                  items={
                    presentationData?.slides.map((slide: any) => slide.id || `${slide.index}`) || []
                  }
                  strategy={verticalListSortingStrategy}
                >
                  {presentationData &&
                    presentationData?.slides.map((slide: any, index: number) => (
                      <SortableSlide
                        key={`${slide.id}-${index}`}
                        slide={slide}
                        index={index}
                        selectedSlide={selectedSlide}
                        onSlideClick={onSlideClick}

                      />
                    ))}
                </SortableContext>
              )}
            </div>

          </DndContext>
          <Separator orientation="horizontal" className=" " />

          <button
            type="button"
            onClick={handleAddSlideClick}
            className="pt-6 gap-2 flex flex-col py-2 duration-300 items-center justify-center rounded-lg cursor-pointer mx-auto"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="text-[11px] font-normal text-[#000000]">Add Slide</span>
          </button>
        </div>
      </div>
      {showNewSlideSelection && lastSlideTemplateId && (
        <div className="fixed inset-0 z-[60] bg-black/50 overflow-y-auto p-4">
          <div className="min-h-full flex items-start justify-center py-8">
            <NewSlide
              index={lastSlideIndex}
              templateID={lastSlideTemplateId}
              setShowNewSlideSelection={setShowNewSlideSelection}
              presentationId={presentationId}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default SidePanel;
