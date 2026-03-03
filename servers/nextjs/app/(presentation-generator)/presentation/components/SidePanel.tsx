"use client";
import React, { useState, useEffect } from "react";
import { LayoutList, ListTree, PanelRightOpen, X } from "lucide-react";
import ToolTip from "@/components/ToolTip";
import { Button } from "@/components/ui/button";
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
import { SortableListItem } from "./SortableListItem";
import { useTemplateLayouts } from "../../hooks/useTemplateLayouts";

interface SidePanelProps {
  selectedSlide: number;
  onSlideClick: (index: number) => void;
  isMobilePanelOpen: boolean;
  setIsMobilePanelOpen: (value: boolean) => void;
  loading: boolean;
}

const SidePanel = ({
  selectedSlide,
  onSlideClick,
  isMobilePanelOpen,
  setIsMobilePanelOpen,
  loading,
}: SidePanelProps) => {
  const [isOpen, setIsOpen] = useState(true);
  const [active, setActive] = useState<"list" | "grid">("grid");

  const { presentationData, isStreaming } = useSelector(
    (state: RootState) => state.presentationGeneration
  );

  const dispatch = useDispatch();

  // Use the centralized group layouts hook
  const { renderSlideContent } = useTemplateLayouts();

  useEffect(() => {
    if (window.innerWidth < 768) {
      setIsOpen(isMobilePanelOpen);
    }
  }, [isMobilePanelOpen]);

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

  const handleClose = () => {
    setIsOpen(false);
    if (window.innerWidth < 768) {
      setIsMobilePanelOpen(false);
    }
  };

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
    <>
      {/* Desktop Toggle Button - Always visible when panel is closed */}
      {!isOpen && (
        <div className="hidden xl:block fixed left-4 top-1/2 -translate-y-1/2 z-50">
          <ToolTip content="Open Panel">
            <Button
              onClick={() => setIsOpen(true)}
              className="bg-white hover:bg-gray-50 shadow-lg"
            >
              <PanelRightOpen className="text-black" size={20} />
            </Button>
          </ToolTip>
        </div>
      )}

      {/* Mobile Toggle Button */}
      {!isMobilePanelOpen && (
        <div className="xl:hidden fixed left-4 bottom-4 z-50">
          <ToolTip content="Show Panel">
            <Button
              onClick={() => setIsMobilePanelOpen(true)}
              className="bg-[#5146E5] text-white p-3 rounded-full shadow-lg"
            >
              <PanelRightOpen className="text-white" size={20} />
            </Button>
          </ToolTip>
        </div>
      )}

      <div
        className={`
          fixed xl:relative h-full z-50 xl:z-auto
          transition-all duration-300 ease-in-out
          ${isOpen ? "ml-0" : "-ml-[300px]"}
          ${isMobilePanelOpen
            ? "translate-x-0"
            : "-translate-x-full xl:translate-x-0"
          }
        `}
      >
        <div

          className="min-w-[300px] bg-white max-w-[300px] h-[calc(100vh-120px)]  rounded-[20px] hide-scrollbar overflow-hidden slide-theme shadow-xl"
        >
          <div
            className="sticky top-0 z-40  px-6 py-4"
          >
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center justify-start gap-4">
                <ToolTip content="Image Preview">
                  <Button
                    className={`${active === "grid"
                      ? "bg-[#5141e5] hover:bg-[#4638c7]"
                      : "bg-white hover:bg-white"
                      }`}
                    onClick={() => {
                      if (!isStreaming) {
                        setActive("grid")
                      }
                    }}
                  >
                    <LayoutList
                      className={`${active === "grid" ? "text-white" : "text-black"
                        }`}
                      size={20}
                    />
                  </Button>
                </ToolTip>
                <ToolTip content="List Preview">
                  <Button
                    className={`${active === "list"
                      ? "bg-[#5141e5] hover:bg-[#4638c7]"
                      : "bg-white hover:bg-white"
                      }`}
                    onClick={() => {
                      if (!isStreaming) {
                        setActive("list")
                      }
                    }}
                  >
                    <ListTree
                      className={`${active === "list" ? "text-white" : "text-black"
                        }`}
                      size={20}
                    />
                  </Button>
                </ToolTip>
              </div>
              <X
                onClick={handleClose}
                className="text-[#6c7081] cursor-pointer hover:text-gray-600"
                size={20}
              />
            </div>
          </div>

          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            {/* List Preview */}
            {active === "list" && (
              <div className="p-4 overflow-y-auto hide-scrollbar h-[calc(100%-100px)]">
                {isStreaming ? (
                  presentationData &&
                  presentationData?.slides.map((slide: any, index: number) => (
                    <div
                      key={`${index}-${slide.type}-${slide.id}`}
                      className={`p-3 cursor-pointer rounded-lg slide-box`}
                    >
                      <span className="font-medium slide-title">
                        Slide {index + 1}
                      </span>
                      <p className="text-sm slide-description">
                        {slide.content.title}
                      </p>
                    </div>
                  ))
                ) : (
                  <SortableContext
                    items={
                      presentationData?.slides.map((slide: any) => slide.id!) || []
                    }
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-2" id={`slide-${selectedSlide}`}>
                      {presentationData &&
                        presentationData?.slides.map((slide: any, index: number) => (
                          <SortableListItem
                            key={`${slide.id}-${index}`}
                            slide={slide}
                            index={index}
                            selectedSlide={selectedSlide}
                            onSlideClick={onSlideClick}
                          />

                        ))}
                    </div>
                  </SortableContext>
                )}
              </div>
            )}

            {/* Grid Preview */}
            {active === "grid" && (
              <div className="p-4 overflow-y-auto hide-scrollbar h-[calc(100%-100px)] space-y-4">
                {isStreaming ? (
                  presentationData &&
                  presentationData?.slides.map((slide: any, index: number) => (
                    <div
                      key={`${slide.id}-${index}`}
                      onClick={() => onSlideClick(index)}
                      className={` cursor-pointer ring-2 p-1  rounded-md transition-all duration-200 ${selectedSlide === index ? ' ring-[#5141e5]' : 'ring-gray-200'
                        }`}
                    >
                      <div className=" bg-white pointer-events-none  relative overflow-hidden aspect-video">
                        <div className="absolute bg-gray-100/5 z-50  top-0 left-0 w-full h-full" />
                        <div className="transform scale-[0.2] flex justify-center items-center origin-top-left  w-[500%] h-[500%]">
                          {renderSlideContent(slide, false)}
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
                          renderSlideContent={(slide) => renderSlideContent(slide, false)}
                        />
                      ))}
                  </SortableContext>
                )}
              </div>
            )}
          </DndContext>
        </div>
      </div>
    </>
  );
};

export default SidePanel;
