'use client'
import React, { useEffect } from "react";

import { Card } from "@/components/ui/card";
import { DashboardApi } from "@/app/(presentation-generator)/services/api/dashboard";
import { EllipsisVertical, Star, Trash } from "lucide-react";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";

import { useFontLoader } from "@/app/(presentation-generator)/hooks/useFontLoad";
import SlideScale from "@/app/(presentation-generator)/components/PresentationRender";
import MarkdownRenderer from "@/components/MarkDownRender";
import { trackEvent, MixpanelEvent } from "@/utils/mixpanel";

export const PresentationCard = ({
  id,
  title,
  presentation,
  onDeleted
}: {
  id: string;
  title: string;
  presentation: any;
  onDeleted?: (presentationId: string) => void;
}) => {
  const router = useRouter();
  const pathname = usePathname();

  const handlePreview = (e: React.MouseEvent) => {
    e.preventDefault();
    trackEvent(MixpanelEvent.Dashboard_Presentation_Opened, {
      pathname,
      presentation_id: id,
      title_length: (title || "").length,
      slide_count: presentation?.slides?.length || 0,
    });
    router.push(`/presentation?id=${id}&type=standard`);
  };
  useEffect(() => {
    applyTheme(presentation.theme)
  }, [])
  const applyTheme = async (theme: any) => {
    const element = document.getElementById(`dashboard-presentation-card-${id}`)
    if (!element) return;

    if (!theme || !theme.data || !theme.data.colors['graph_0']) { return; }
    const cssVariables = {
      '--primary-color': theme.data.colors['primary'],
      '--background-color': theme.data.colors['background'],
      '--card-color': theme.data.colors['card'],
      '--stroke': theme.data.colors['stroke'],
      '--primary-text': theme.data.colors['primary_text'],
      '--background-text': theme.data.colors['background_text'],
      '--graph-0': theme.data.colors['graph_0'],
      '--graph-1': theme.data.colors['graph_1'],
      '--graph-2': theme.data.colors['graph_2'],
      '--graph-3': theme.data.colors['graph_3'],
      '--graph-4': theme.data.colors['graph_4'],
      '--graph-5': theme.data.colors['graph_5'],
      '--graph-6': theme.data.colors['graph_6'],
      '--graph-7': theme.data.colors['graph_7'],
      '--graph-8': theme.data.colors['graph_8'],
      '--graph-9': theme.data.colors['graph_9'],
    }
    Object.entries(cssVariables).forEach(([key, value]) => {
      element.style.setProperty(key, value)
    })
    // 
    if (theme.data.fonts.textFont.url && theme.data.fonts.textFont.name) {
      useFontLoader({ [theme.data.fonts.textFont.name]: theme.data.fonts.textFont.url })
    }

    // Apply fonts to preview container
    element.style.setProperty('font-family', `"${theme.data.fonts.textFont.name}"`)
    element.style.setProperty('--heading-font-family', `"${theme.data.fonts.textFont.name}"`)
    element.style.setProperty('--body-font-family', `"${theme.data.fonts.textFont.name}"`)


  }

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();


    const response = await DashboardApi.deletePresentation(id);

    if (response) {
      trackEvent(MixpanelEvent.Dashboard_Presentation_Deleted, {
        pathname,
        presentation_id: id,
        slide_count: presentation?.slides?.length || 0,
      });
      toast.success("Presentation deleted", {
        description: "The presentation has been deleted successfully",
      });
      if (onDeleted) {
        onDeleted(id);
      }
    } else {
      toast.error("Error deleting presentation");
    }
  };
  const firstSlide = presentation?.slides?.[0];
  return (
    <Card
      suppressHydrationWarning={true}
      onClick={handlePreview}
      className="bg-[#F8FBFB] font-syne shadow-none sm:shadow-none  presentation-card rounded-[12px] p-0 group hover:shadow-md transition-all duration-500 slide-theme cursor-pointer overflow-hidden flex flex-col"
    >
      <div
        id={`dashboard-presentation-card-${id}`}
        suppressHydrationWarning={true} className="flex flex-col flex-1 relative z-40">
        {/* <p className=" text-xs font-syne absolute top-2 flex gap-1 capitalize  items-center left-2 rounded-[100px]  px-2.5 py-1 bg-[#3A3A3AF5] text-white font-semibold  z-40 ">

          {presentation.type}
        </p> */}

        <img src="/card_bg.svg" alt="" className="absolute top-0 left-0 w-full h-full object-cover" />
        <div className="scale-[0.75] mt-4  border border-gray-300 rounded-lg overflow-hidden">

          <SlideScale slide={firstSlide} isClickable={false} />
        </div>

        <div className="w-full py-3 px-5 mt-auto z-40 relative bg-white  border-t border-[#EDEEEF]">
          <div className="flex items-center justify-between gap-7 w-full">
            <div className="flex flex-col items-start gap-1">
              <div className="text-sm text-[#191919] font-semibold  overflow-hidden line-clamp-1">
                <MarkdownRenderer content={title} className="text-sm mb-0  font-syne text-[#191919] font-semibold  overflow-hidden line-clamp-1" />
              </div>
              <p className="text-[#808080] text-sm font-syne">
                {new Date(presentation?.created_at).toLocaleDateString()}
              </p>

            </div>
            <Popover>
              <PopoverTrigger className="w-6 h-6 hover:bg-gray-100 rounded-full flex items-center justify-center text-gray-500 hover:text-gray-700" onClick={(e) => e.stopPropagation()}>
                <EllipsisVertical className="w-6 h-6 text-gray-500" />
              </PopoverTrigger>
              <PopoverContent align="end" className="bg-white w-[200px]">
                <button
                  className="flex items-center justify-between w-full px-2 py-1 hover:bg-gray-100"
                  onClick={handleDelete}
                >
                  <p>Delete</p>
                  <Trash className="w- h-4 text-red-500" />
                </button>
              </PopoverContent>
            </Popover>
          </div>

        </div>
      </div>
    </Card>
  );
};
