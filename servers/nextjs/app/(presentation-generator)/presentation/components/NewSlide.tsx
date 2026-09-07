"use client";
import React, {
  useEffect,
  useState,
  memo,
  useCallback,
  useRef,
} from "react";
import { useDispatch, useSelector } from "react-redux";
import { addNewSlide } from "@/store/slices/presentationGeneration";
import { Loader2, Plus, X } from "lucide-react";
import { v4 as uuidv4 } from "uuid";
import { notify } from "@/components/ui/sonner";

import { usePathname } from "next/navigation";
import { trackEvent, MixpanelEvent } from "@/utils/mixpanel";
import { RootState } from "@/store/store";
import { TemplateV2HtmlSlidePreview } from "../../components/TemplateV2HtmlSlidePreview";
import {
  extractTemplateV2Layouts,
  type TemplateV2Layout,
} from "@/components/slide-editor/importing/template-v2-import";
import {
  BLANK_SLIDE_LAYOUT_ID,
  BLANK_TEMPLATE_V2_LAYOUT,
} from "../../_shared/blank-slide";
import { MAX_NUMBER_OF_SLIDES } from "@/utils/presentationLimits";
import TemplateService from "../../services/api/template";

interface LayoutItemProps {
  layout: any;
  onSelect: (sampleData: any, layoutId: string) => void;
}

const PREVIEW_WIDTH = 1280;
const PREVIEW_HEIGHT = 720;
const EMPTY_SLIDE_LAYOUT = {
  layoutId: BLANK_SLIDE_LAYOUT_ID,
  layoutName: "Empty Slide",
  sampleData: BLANK_TEMPLATE_V2_LAYOUT,
  isEmptySlide: true,
};

function createTemplateV2LayoutItem(layout: TemplateV2Layout, layoutIndex: number) {
  const layoutId =
    typeof layout.id === "string" && layout.id.trim()
      ? layout.id
      : `layout_${layoutIndex + 1}`;
  const description =
    typeof layout.description === "string" && layout.description.trim()
      ? layout.description
      : null;

  return {
    layoutId,
    layoutName: description ?? layoutId,
    sampleData: layout,
    v2Layout: layout,
  };
}

function createTemplateV2PreviewSlide(layout: TemplateV2Layout, layoutId: string) {
  return {
    id: `template-v2-preview-${layoutId}`,
    content: {},
    ui: layout,
    layout: layoutId,
    layout_group: "template-v2",
  };
}

const LayoutItem = memo(({ layout, onSelect }: LayoutItemProps) => {
  const previewRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(0.2);
  const {
    component: LayoutComponent,
    sampleData,
    layoutId,
    layoutName,
    v2Layout,
    isEmptySlide,
  } = layout;

  useEffect(() => {
    if (!previewRef.current) return;

    const previewElement = previewRef.current;
    const updateScale = () => {
      const nextScale = Math.min(
        previewElement.clientWidth / PREVIEW_WIDTH,
        previewElement.clientHeight / PREVIEW_HEIGHT
      );
      setScale(nextScale || 0.2);
    };

    const resizeObserver = new ResizeObserver(updateScale);
    resizeObserver.observe(previewElement);
    updateScale();

    return () => resizeObserver.disconnect();
  }, []);

  const selectLayout = () => onSelect(sampleData, layoutId);

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Add ${layoutName || "slide"} layout`}
      title={layoutName || "Slide layout"}
      onClick={selectLayout}
      onKeyDown={(event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        selectLayout();
      }}
      className="relative aspect-video cursor-pointer overflow-hidden rounded-md border border-[#E4E4EA] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)] outline-none transition duration-200 hover:border-[#2563EB] hover:shadow-[0_0_0_2px_rgba(124,81,248,0.18)] focus-visible:ring-2 focus-visible:ring-[#2563EB]"
    >
      <div className="absolute inset-0 z-40 bg-transparent" />
      <div ref={previewRef} className="relative h-full w-full overflow-hidden">
        <div
          className="absolute left-0 top-0"
          style={{
            width: isEmptySlide ? "100%" : PREVIEW_WIDTH,
            height: isEmptySlide ? "100%" : PREVIEW_HEIGHT,
            transform: isEmptySlide ? undefined : `scale(${scale})`,
            transformOrigin: "top left",
          }}
        >
          {isEmptySlide ? (
            <div className="flex h-full w-full items-center justify-center bg-white">
              <div className="flex flex-col items-center gap-2 text-[#191919]">
                <span className="flex h-10 w-10 items-center justify-center rounded-full border border-[#E2E2EA] bg-[#FAFAFB]">
                  <Plus className="h-4 w-4" />
                </span>
                <span className="text-sm font-medium">Empty Slide</span>
              </div>
            </div>
          ) : v2Layout ? (
            <TemplateV2HtmlSlidePreview
              slide={createTemplateV2PreviewSlide(v2Layout, layoutId)}
              fixedSize
            />
          ) : LayoutComponent ? (
            <LayoutComponent data={sampleData} />
          ) : null}
        </div>
      </div>
    </div>
  );
});

LayoutItem.displayName = "LayoutItem";
interface NewSlideV1Props {
  setShowNewSlideSelection: (show: boolean) => void;
  templateID: string;
  index: number;
  presentationId: string;
  onSlideAdded?: (
    index: number,
    options?: {
      promptOverlaySlideId?: string;
      promptOverlayKind?: "blank" | "layout";
    },
  ) => void;
}
const NewSlideV1 = ({
  setShowNewSlideSelection,
  templateID,
  index,
  presentationId,
  onSlideAdded,
}: NewSlideV1Props) => {
  const dispatch = useDispatch();
  const pathname = usePathname();
  const presentationLayout = useSelector(
    (state: RootState) => state.presentationGeneration.presentationData?.layout
  );
  const slideCount = useSelector((state: RootState) => {
    const slides = state.presentationGeneration.presentationData?.slides;
    return Array.isArray(slides) ? slides.length : 0;
  });
  const [layouts, setLayouts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setShowNewSlideSelection(false);
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [setShowNewSlideSelection]);

  const handleNewSlide = useCallback(
    (sampleData: any, id: string) => {
      if (slideCount >= MAX_NUMBER_OF_SLIDES) {
        notify.warning(
          "Slide limit reached",
          `You can have up to ${MAX_NUMBER_OF_SLIDES} slides.`
        );
        return;
      }

      try {
        const slideId = uuidv4();
        const newSlide = {
          id: slideId,
          index,
          content: {},
          ui: sampleData,
          layout_group: templateID,
          layout: id,
          presentation: presentationId,
        };

        dispatch(addNewSlide({ slideData: newSlide, index }));
        onSlideAdded?.(
          index + 1,
          {
            promptOverlaySlideId: slideId,
            promptOverlayKind:
              id === BLANK_SLIDE_LAYOUT_ID ? "blank" : "layout",
          },
        );
        trackEvent(MixpanelEvent.Presentation_Slide_Added, {
          pathname,
          presentation_id: presentationId,
          inserted_after_index: index,
          template_id: templateID,
          layout_id: id,
        });
        setShowNewSlideSelection(false);
      } catch (error: any) {
        console.error(error);
        notify.error("Could not add slide", "Something went wrong while adding the new slide.");
      }
    },
    [
      index,
      templateID,
      presentationId,
      dispatch,
      setShowNewSlideSelection,
      pathname,
      onSlideAdded,
      slideCount,
    ]
  );

  useEffect(() => {
    let isMounted = true;

    const fetchLayouts = async () => {
      try {
        setLoading(true);
        setLoadError(null);

        const embeddedLayouts = extractTemplateV2Layouts(presentationLayout);
        let templateV2Layouts = embeddedLayouts;

        try {
          const template = await TemplateService.getTemplateDetails(templateID);
          const fetchedLayouts = extractTemplateV2Layouts(template.layouts);
          if (fetchedLayouts.length > 0) {
            templateV2Layouts = fetchedLayouts;
          }
        } catch (error) {
          if (embeddedLayouts.length === 0) {
            throw error;
          }
          console.warn(
            "Could not refresh template layouts; using presentation layouts instead.",
            error,
          );
        }

        const layoutItems = templateV2Layouts.map((layout, layoutIndex) =>
          createTemplateV2LayoutItem(layout, layoutIndex)
        );
        if (isMounted) {
          setLayouts(layoutItems);
          if (layoutItems.length === 0) {
            setLoadError("This template does not contain any usable layouts.");
          }
        }
      } catch (error) {
        console.error("Error loading slide layouts:", error);
        if (isMounted) {
          setLayouts([]);
          setLoadError("Could not load layouts for this template.");
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchLayouts();

    return () => {
      isMounted = false;
    };
  }, [presentationLayout, templateID]);

  const showEmptySlideLayout = true;
  const selectableLayouts = showEmptySlideLayout
    ? [EMPTY_SLIDE_LAYOUT, ...layouts]
    : layouts;
  const layoutCountText = showEmptySlideLayout
    ? `${selectableLayouts.length} Option${selectableLayouts.length === 1 ? "" : "s"}`
    : `${layouts.length} Layout${layouts.length === 1 ? "" : "s"}`;


  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="choose-slide-layout-title"
      className="relative w-full rounded-[14px] border border-[#EDEEEF] bg-white font-syne shadow-[0_18px_60px_rgba(15,23,42,0.18)]"
    >
      <button
        type="button"
        aria-label="Close layout picker"
        onClick={() => setShowNewSlideSelection(false)}
        className="absolute right-0 top-[-52px] z-50 flex h-10 w-10 items-center justify-center rounded-full border border-[#EDEEEF] bg-white text-[#191919] shadow-[0_6.6px_13.2px_rgba(0,0,0,0.10)] transition hover:bg-[#F7F6F9]"
      >
        <X className="h-5 w-5" />
      </button>

      <div className="flex min-h-[64px] items-center justify-between border-b border-[#EDEEEF] px-5 py-4 md:px-6">
        <div>
          <h2
            id="choose-slide-layout-title"
            className="text-base font-medium leading-tight text-[#191919]"
          >
            Choose Slide Layout
          </h2>
          <p className="mt-1 text-xs font-normal leading-none text-[#7A7A85]">
            {loading ? "Loading layouts" : layoutCountText}
          </p>
        </div>
        {loading && (
          <Loader2 className="h-5 w-5 animate-spin text-[#2563EB]" />
        )}
      </div>

      <div className="max-h-[min(70vh,640px)] overflow-y-auto px-4 py-4 md:px-5">
        {!loading && loadError && (
          <p className="mb-4 rounded-lg border border-[#FEE4E2] bg-[#FFFBFA] px-4 py-3 text-sm text-[#B42318]">
            {loadError}
          </p>
        )}
        {loading ? (
          <div className="flex h-56 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-[#2563EB]" />
          </div>
        ) : selectableLayouts.length > 0 ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {selectableLayouts.map((layout: any) => (
              <LayoutItem
                key={layout.layoutId}
                layout={layout}
                onSelect={handleNewSlide}
              />
            ))}
          </div>
        ) : (
          <div className="flex h-56 items-center justify-center rounded-lg border border-dashed border-[#D9D9E1] bg-[#FAFAFB] text-sm text-[#7A7A85]">
            No layouts available.
          </div>
        )}
      </div>
    </div>
  );
};

export default NewSlideV1;
