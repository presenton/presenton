"use client";

import React, { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  ArrowDown,
  ArrowUp,
  Copy,
  EllipsisVertical,
  Plus,
  Trash2,
} from "lucide-react";
import { usePathname } from "next/navigation";
import { useDispatch, useSelector, useStore } from "react-redux";
import { v4 as uuidv4 } from "uuid";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { notify } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";
import {
  addNewSlide,
  deletePresentationSlide,
  duplicatePresentationSlide,
  movePresentationSlide,
  replaceSlidesWithBlankFallback,
} from "@/store/slices/presentationGeneration";
import { addToHistory } from "@/store/slices/undoRedoSlice";
import { RootState } from "@/store/store";
import { trackEvent, MixpanelEvent } from "@/utils/mixpanel";
import {
  BLANK_SLIDE_LAYOUT_ID,
  createBlankPresentationSlide,
  getSlideTemplateId,
  isTemplateFreePresentation,
  isTemplateV2Slide as isTemplateV2PresentationSlide,
} from "../../_shared/blank-slide";
import NewSlide from "./NewSlide";
import { MAX_NUMBER_OF_SLIDES } from "@/utils/presentationLimits";

interface SlideActionBarProps {
  slide: any;
  selectedSlide: number;
  presentationId: string;
  onSlideSelected: (
    index: number,
    options?: {
      promptOverlaySlideId?: string;
      promptOverlayKind?: "blank" | "layout";
    },
  ) => void;
  revealOnGroupHover?: boolean;
}

const menuItemClass =
  "flex h-9 cursor-pointer select-none items-center gap-2.5 px-3 text-sm font-normal leading-none text-[#050505] outline-none transition-colors focus:bg-[#F7F6F9] data-[disabled]:pointer-events-none data-[disabled]:cursor-not-allowed data-[disabled]:text-[#9B9B9B]";

const SlideActionBar = ({
  slide,
  selectedSlide,
  presentationId,
  onSlideSelected,
  revealOnGroupHover = false,
}: SlideActionBarProps) => {
  const dispatch = useDispatch();
  const store = useStore();
  const pathname = usePathname();
  const [showNewSlideSelection, setShowNewSlideSelection] = useState(false);
  const [isSpeakerPopoverOpen, setIsSpeakerPopoverOpen] = useState(false);
  const [isSlideMenuOpen, setIsSlideMenuOpen] = useState(false);
  const isStreaming = useSelector(
    (state: RootState) => state.presentationGeneration.isStreaming
  );
  const slideCount = useSelector((state: RootState) => {
    const currentSlides = state.presentationGeneration.presentationData?.slides;
    return Array.isArray(currentSlides) ? currentSlides.length : 0;
  });
  const hasPresentation = useSelector(
    (state: RootState) => Boolean(state.presentationGeneration.presentationData)
  );
  const isTemplateFree = useSelector((state: RootState) =>
    isTemplateFreePresentation(
      state.presentationGeneration.presentationData
    )
  );

  const hasReachedSlideLimit = slideCount >= MAX_NUMBER_OF_SLIDES;
  const currentIndex = Number.isInteger(selectedSlide)
    ? selectedSlide
    : typeof slide?.index === "number"
      ? slide.index
      : 0;
  const slideLayout = typeof slide?.layout === "string" ? slide.layout : "";
  const templateId = useMemo(() => getSlideTemplateId(slide), [slide]);
  const isTemplateV2Slide = isTemplateV2PresentationSlide(slide);
  const speakerNote =
    typeof slide?.speaker_note === "string" ? slide.speaker_note.trim() : "";
  const keepVisible =
    showNewSlideSelection || isSpeakerPopoverOpen || isSlideMenuOpen;

  if (!slide || !hasPresentation || slideCount === 0 || isStreaming) {
    return null;
  }

  const rememberSlides = (actionType: string) => {
    const currentSlides = (store.getState() as RootState)
      .presentationGeneration.presentationData?.slides;
    if (!Array.isArray(currentSlides)) return;

    dispatch(
      addToHistory({
        slides: currentSlides,
        actionType,
      })
    );
  };

  const notifySlideLimitReached = () => {
    notify.warning(
      "Slide limit reached",
      `You can have up to ${MAX_NUMBER_OF_SLIDES} slides.`
    );
  };

  const handleBlankSlide = () => {
    if (hasReachedSlideLimit) {
      notifySlideLimitReached();
      return;
    }

    if (!templateId) {
      notify.error(
        "Could not add blank slide",
        "This slide does not have a template context."
      );
      return;
    }

    const slideId = uuidv4();
    const blankSlide = createBlankPresentationSlide({
      id: slideId,
      index: currentIndex,
      presentationId,
      templateId,
      isTemplateV2: isTemplateV2Slide,
    });

    rememberSlides("ADD_BLANK_SLIDE");
    dispatch(addNewSlide({ slideData: blankSlide, index: currentIndex }));
    const insertedIndex = currentIndex + 1;
    onSlideSelected(
      insertedIndex,
      isTemplateV2Slide
        ? {
            promptOverlaySlideId: slideId,
            promptOverlayKind: "blank",
          }
        : undefined,
    );
    trackEvent(MixpanelEvent.Presentation_Slide_Added, {
      pathname,
      presentation_id: presentationId,
      inserted_after_index: currentIndex,
      template_id: templateId,
      layout_id: BLANK_SLIDE_LAYOUT_ID,
      source: "blank_action_bar",
      is_template_v2: isTemplateV2Slide,
    });
  };

  const handleDuplicateSlide = () => {
    if (hasReachedSlideLimit) {
      notifySlideLimitReached();
      return;
    }

    rememberSlides("DUPLICATE_SLIDE");
    dispatch(
      duplicatePresentationSlide({
        index: currentIndex,
        slideId: uuidv4(),
      })
    );
    const insertedIndex = currentIndex + 1;
    onSlideSelected(insertedIndex);
    trackEvent(MixpanelEvent.Presentation_Slide_Added, {
      pathname,
      presentation_id: presentationId,
      inserted_after_index: currentIndex,
      source: "duplicate_action_bar",
      slide_id: slide?.id,
      slide_index: currentIndex,
      layout: slideLayout,
    });
  };

  const handleMoveSlide = (toIndex: number) => {
    if (toIndex < 0 || toIndex >= slideCount || toIndex === currentIndex) {
      return;
    }

    rememberSlides("MOVE_SLIDE");
    dispatch(movePresentationSlide({ fromIndex: currentIndex, toIndex }));
    onSlideSelected(toIndex);
    trackEvent(MixpanelEvent.Presentation_Slides_Reordered, {
      pathname,
      presentation_id: presentationId,
      from_index: currentIndex,
      to_index: toIndex,
      slide_count: slideCount,
      source: "action_bar",
    });
  };

  const handleDeleteSlide = () => {
    if (slideCount <= 1) {
      const slideId = uuidv4();
      const blankSlide = createBlankPresentationSlide({
        id: slideId,
        index: 0,
        presentationId,
        templateId,
        isTemplateV2: isTemplateV2Slide,
      });

      rememberSlides("DELETE_LAST_SLIDE");
      dispatch(replaceSlidesWithBlankFallback({ slideData: blankSlide }));
      onSlideSelected(0);
      trackEvent(MixpanelEvent.Presentation_Slide_Deleted, {
        pathname,
        presentation_id: presentationId,
        slide_id: slide?.id,
        slide_index: currentIndex,
        layout: slideLayout,
        blank_fallback: true,
        fallback_slide_id: slideId,
      });
      return;
    }

    const nextSelectedIndex = Math.min(currentIndex, slideCount - 2);
    rememberSlides("DELETE_SLIDE");
    dispatch(deletePresentationSlide(currentIndex));
    onSlideSelected(nextSelectedIndex);
    trackEvent(MixpanelEvent.Presentation_Slide_Deleted, {
      pathname,
      presentation_id: presentationId,
      slide_id: slide?.id,
      slide_index: currentIndex,
      layout: slideLayout,
    });
  };

  const openTemplatePicker = () => {
    if (isTemplateFree) return;

    if (hasReachedSlideLimit) {
      notifySlideLimitReached();
      return;
    }

    if (!templateId) {
      notify.error(
        "Could not open templates",
        "This slide does not have a template context."
      );
      return;
    }
    setShowNewSlideSelection(true);
  };

  const newSlideModal =
    showNewSlideSelection &&
    !isTemplateFree &&
    templateId &&
    typeof document !== "undefined"
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
                index={currentIndex}
                templateID={templateId}
                setShowNewSlideSelection={setShowNewSlideSelection}
                presentationId={presentationId}
                onSlideAdded={onSlideSelected}
              />
            </div>
          </div>
        </div>,
        document.body
      )
      : null;

  return (
    <>
      <div
        className={cn(
          "z-[80] flex justify-center px-4 transition-opacity duration-300",
          revealOnGroupHover
            ? keepVisible
              ? "opacity-100"
              : "opacity-100 xl:pointer-events-none xl:opacity-0 xl:group-hover:pointer-events-auto xl:group-hover:opacity-100 xl:focus-within:pointer-events-auto xl:focus-within:opacity-100"
            : "opacity-100"
        )}
      >
        <div className="pointer-events-auto hide-scrollbar flex h-10 max-w-[calc(100%_-_2rem)] items-center overflow-x-auto rounded-[8px] border border-[#E6E6EC] bg-white px-2 shadow-[0_2px_14px_rgba(17,24,39,0.12)]">
          <button
            type="button"
            onClick={handleBlankSlide}
            disabled={hasReachedSlideLimit}
            className={cn(
              "flex h-8 shrink-0 items-center gap-2 rounded-[6px] px-2 text-sm font-normal leading-none text-[#111324] transition-colors hover:bg-[#F7F6F9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5141e5]",
              hasReachedSlideLimit && "cursor-not-allowed opacity-50"
            )}
          >
            <span>Blank</span>
            <Plus className="h-4 w-4" strokeWidth={2.4} />
          </button>

          {!isTemplateFree && (
            <>
              <Separator orientation="vertical" className="mx-2 h-6 shrink-0 bg-[#EDEEEF]" />

              <button
                type="button"
                onClick={openTemplatePicker}
                disabled={hasReachedSlideLimit}
                className={cn(
                  "flex h-8 shrink-0 items-center gap-2 rounded-[6px] px-2 text-sm font-normal leading-none text-[#111324] transition-colors hover:bg-[#F7F6F9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5141e5]",
                  hasReachedSlideLimit && "cursor-not-allowed opacity-50"
                )}
              >
                <span>Use Template</span>
                <Plus className="h-4 w-4" strokeWidth={2.4} />
              </button>
            </>
          )}

          <Separator orientation="vertical" className="mx-2 h-6 shrink-0 bg-[#EDEEEF]" />
          {speakerNote &&
            <Popover
              open={isSpeakerPopoverOpen}
              onOpenChange={setIsSpeakerPopoverOpen}
            >
              <PopoverTrigger asChild>
                <button
                  type="button"
                  aria-label="Speaker notes"
                  className={cn(
                    "flex h-8 w-10 shrink-0 items-center justify-center rounded-[6px] text-[#050505] transition-colors hover:bg-[#F7F6F9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5141e5]",
                    isSpeakerPopoverOpen && "bg-[#F7F6F9]"
                  )}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M5.86683 13.3331V10.5997L7.1335 10.7331C7.50225 10.7126 7.85123 10.5597 8.11627 10.3025C8.38131 10.0453 8.54462 9.70103 8.57616 9.33306V5.53306C8.58058 4.57262 8.20329 3.64976 7.52728 2.96751C6.85128 2.28525 5.93193 1.89948 4.9715 1.89506C4.01106 1.89064 3.0882 2.26793 2.40595 2.94394C1.72369 3.61994 1.33792 4.53929 1.3335 5.49972C1.3335 7.36639 1.77083 7.53572 2.00016 8.53306C2.15515 9.13537 2.16179 9.76628 2.0195 10.3717L1.3335 13.3331" stroke="black" strokeWidth="1.33333" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M13.2002 11.8668C14.1374 10.9294 14.6641 9.65834 14.6645 8.33284C14.6648 7.00735 14.1389 5.73594 13.2022 4.7981" stroke="black" strokeWidth="1.33333" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M11.3336 10C11.5517 9.78195 11.7244 9.52279 11.8417 9.23755C11.9591 8.95231 12.0187 8.64663 12.0171 8.33821C12.0156 8.02978 11.9529 7.72472 11.8327 7.44067C11.7125 7.15662 11.5372 6.89922 11.3169 6.68335" stroke="black" strokeWidth="1.33333" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </PopoverTrigger>
              <PopoverContent
                side="top"
                align="center"
                sideOffset={14}
                className="z-[90] w-[360px] rounded-[16px] border border-[#E6E6EC] bg-white p-0 font-syne shadow-[0_8px_24px_rgba(17,24,39,0.14)]"
              >
                <div className="border-b border-[#EDEEEF] px-5 py-4">
                  <p className="text-sm font-semibold text-[#191919]">
                    Speaker notes
                  </p>
                </div>
                <div className="p-5">
                  <div className="max-h-[240px] min-h-[108px] overflow-auto whitespace-pre-wrap rounded-[12px] border border-[#EDEEEF] bg-[#FAFAFB] p-4 text-sm leading-relaxed text-[#333333]">
                    {speakerNote || "No speaker notes for this slide."}
                  </div>
                </div>
              </PopoverContent>
            </Popover>}
          {speakerNote &&
            <Separator orientation="vertical" className="mx-2 h-6 shrink-0 bg-[#EDEEEF]" />}

          <DropdownMenu.Root
            open={isSlideMenuOpen}
            onOpenChange={setIsSlideMenuOpen}
          >
            <DropdownMenu.Trigger asChild>
              <button
                type="button"
                aria-label="Slide actions"
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-[6px] text-[#050505] transition-colors hover:bg-[#F7F6F9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5141e5]",
                  isSlideMenuOpen && "bg-[#F7F6F9]"
                )}
              >
                <EllipsisVertical className="h-5 w-5" strokeWidth={2.4} />
              </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content
                side="top"
                align="end"
                sideOffset={8}
                className="z-[90] w-[188px] overflow-hidden rounded-[10px] border border-[#E6E6EC] bg-white py-2 font-syne shadow-[0_8px_24px_rgba(17,24,39,0.14)]"
              >
                <DropdownMenu.Item
                  disabled={hasReachedSlideLimit}
                  className={menuItemClass}
                  onSelect={handleDuplicateSlide}
                >
                  <Copy className="h-4 w-4 shrink-0 text-current" />
                  <span>Duplicate Slide</span>
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  disabled={currentIndex <= 0}
                  className={menuItemClass}
                  onSelect={() => handleMoveSlide(currentIndex - 1)}
                >
                  <ArrowUp className="h-4 w-4 shrink-0 text-current" />
                  <span>Move Up</span>
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  disabled={currentIndex >= slideCount - 1}
                  className={menuItemClass}
                  onSelect={() => handleMoveSlide(currentIndex + 1)}
                >
                  <ArrowDown className="h-4 w-4 shrink-0 text-current" />
                  <span>Move Down</span>
                </DropdownMenu.Item>
                <DropdownMenu.Separator className="my-2 h-px bg-[#EDEEEF]" />
                <DropdownMenu.Item
                  className={menuItemClass}
                  onSelect={handleDeleteSlide}
                >
                  <Trash2 className="h-4 w-4 shrink-0 text-current" />
                  <span>Delete Slide</span>
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>
      </div>
      {newSlideModal}
    </>
  );
};

export default SlideActionBar;
