"use client";

import React, { useCallback } from "react";
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  type DragEndEvent,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { FileText, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { MAX_NUMBER_OF_SLIDES } from "@/utils/presentationLimits";
import { useStableOutlineIds } from "../../components/useStableOutlineIds";
import { OutlineItem } from "./OutlineItem";

interface OutlineContentProps {
  outlines: { content: string }[] | null;
  isLoading: boolean;
  isStreaming: boolean;
  activeSlideIndex: number | null;
  highestActiveIndex: number;
  statusMessage: string;
  onDragEnd: (oldIndex: number, newIndex: number) => void;
  onAddSlide: () => void;
  onUpdateOutline?: (index: number, newContent: string) => void;
}

const getOutlineContent = (outline: { content: string }) => outline.content;

const OutlineContent: React.FC<OutlineContentProps> = ({
  outlines,
  isLoading,
  isStreaming,
  activeSlideIndex,
  highestActiveIndex,
  statusMessage,
  onDragEnd,
  onAddSlide,
  onUpdateOutline,
}) => {
  const hasReachedSlideLimit =
    (outlines?.length ?? 0) >= MAX_NUMBER_OF_SLIDES;
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 6,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );
  const itemIds = useStableOutlineIds(outlines, getOutlineContent);
  const sortableItemIds = itemIds.slice(0, outlines?.length ?? 0);

  const handleSortableDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;

      if (!active || !over || active.id === over.id) return;

      const oldIndex = sortableItemIds.indexOf(String(active.id));
      const newIndex = sortableItemIds.indexOf(String(over.id));

      if (oldIndex !== -1 && newIndex !== -1) {
        onDragEnd(oldIndex, newIndex);
      }
    },
    [onDragEnd, sortableItemIds]
  );

  return (
    <div className="font-syne">
      {isStreaming && (
        <div className="sr-only" role="status" aria-live="polite">
          <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
          {statusMessage}
        </div>
      )}

      {isLoading && (!outlines || outlines.length === 0) && (
        <div className="space-y-5">
          {[...Array(6)].map((_, index) => (
            <div key={index} className="animate-pulse">
              <div className="flex items-start gap-3 rounded-[12px] bg-white px-[30px] py-10 shadow-[0_6.6px_6.6px_rgba(0,0,0,0.06)]">
                <div className="h-6 w-6 flex-shrink-0 rounded bg-gray-200" />
                <div className="flex-1 space-y-2">
                  <div className="h-[22px] w-16 rounded-full bg-gray-200" />
                  <div className="h-5 w-3/4 rounded bg-gray-200" />
                  <div className="space-y-1">
                    <div className="h-4 w-full rounded bg-gray-100" />
                    <div className="h-4 w-5/6 rounded bg-gray-100" />
                    <div className="h-4 w-4/6 rounded bg-gray-100" />
                  </div>
                </div>
                <div className="h-5 w-5 flex-shrink-0 rounded bg-gray-200" />
              </div>
            </div>
          ))}
        </div>
      )}

      {outlines && outlines.length > 0 && (
        <div className="relative z-20">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleSortableDragEnd}
          >
            {isStreaming ? (
              outlines.map((item, index) => (
                <OutlineItem
                  key={`streaming-outline-${index}`}
                  id={`streaming-outline-${index}`}
                  index={index + 1}
                  slideOutline={item}
                  isStreaming={isStreaming}
                  isActiveStreaming={activeSlideIndex === index}
                  isStableStreaming={
                    highestActiveIndex >= 0 && index < highestActiveIndex
                  }
                />
              ))
            ) : (
              <SortableContext
                items={sortableItemIds}
                strategy={verticalListSortingStrategy}
              >
                {outlines.map((item, index) => (
                  <OutlineItem
                    key={sortableItemIds[index] ?? `outline-${index}`}
                    id={sortableItemIds[index] ?? `outline-${index}`}
                    index={index + 1}
                    slideOutline={item}
                    isStreaming={isStreaming}
                    isActiveStreaming={false}
                    isStableStreaming={false}
                    onUpdate={(newContent) =>
                      onUpdateOutline?.(index + 1, newContent)
                    }
                  />
                ))}
              </SortableContext>
            )}
          </DndContext>

          {!isStreaming && (
            <div className="flex justify-center">
              <Button
                onClick={() => {
                  if (!hasReachedSlideLimit) {
                    onAddSlide();
                  }
                }}
                disabled={hasReachedSlideLimit}
                aria-disabled={hasReachedSlideLimit}
                title={
                  hasReachedSlideLimit
                    ? `Maximum ${MAX_NUMBER_OF_SLIDES} slides`
                    : undefined
                }
                variant="outline"
                className={cn(
                  "h-[58px] w-full rounded-[12px] border-2 border-dashed border-[#D8D8DF] bg-white font-syne text-sm text-[#7A5AF8] shadow-none hover:bg-[#F4F3FF] hover:text-[#7A5AF8]",
                  hasReachedSlideLimit &&
                    "cursor-not-allowed text-[#A0A0A8] opacity-60 hover:bg-white hover:text-[#A0A0A8]"
                )}
              >
                {hasReachedSlideLimit
                  ? `Maximum ${MAX_NUMBER_OF_SLIDES} slides reached`
                  : "+ Add New Slide"}
              </Button>
            </div>
          )}
        </div>
      )}

      {!isStreaming && !isLoading && outlines && outlines.length === 0 && (
        <div className="rounded-lg border-2 border-dashed border-gray-200 bg-white py-12 text-center">
          <FileText className="mx-auto mb-4 h-12 w-12 text-gray-400" />
          <p className="mb-4 text-gray-600">No outlines available</p>
          <Button
            variant="outline"
            onClick={onAddSlide}
            className="border-blue-200 text-blue-600"
          >
            + Add First Slide
          </Button>
        </div>
      )}
    </div>
  );
};

export default OutlineContent;
