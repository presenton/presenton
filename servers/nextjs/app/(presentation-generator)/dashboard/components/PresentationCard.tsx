import React, { useMemo } from "react";

import { Card } from "@/components/ui/card";
import { DashboardApi } from "@/app/(presentation-generator)/services/api/dashboard";
import { DotsVerticalIcon, TrashIcon } from "@radix-ui/react-icons";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTemplateLayouts } from "@/app/(presentation-generator)/hooks/useTemplateLayouts";

export const PresentationCard = ({
  id,
  title,
  created_at,
  slide,
  onDeleted
}: {
  id: string;
  title: string;
  created_at: string;
  slide: any;
  onDeleted?: (presentationId: string) => void;
}) => {
  const router = useRouter();
  const { renderSlideContent } = useTemplateLayouts();



  const handlePreview = (e: React.MouseEvent) => {
    e.preventDefault();
    router.push(`/presentation?id=${id}`);
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();


    const response = await DashboardApi.deletePresentation(id);

    if (response) {
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
  return (
    <Card
      onClick={handlePreview}

      className="bg-white rounded-[8px] slide-theme cursor-pointer overflow-hidden p-4"

    >
      <div className="space-y-4">
        {/* Date */}
        <div className="flex items-center justify-between">
          <p className="text-[#667085] text-sm font-roboto pt-2">
            {new Date(created_at).toLocaleDateString()}
          </p>
          <Popover>
            <PopoverTrigger className="w-6 h-6 rounded-full flex items-center justify-center text-gray-500 hover:text-gray-700" onClick={(e) => e.stopPropagation()}>


              <DotsVerticalIcon className="w-4 h-4 text-gray-500" />

            </PopoverTrigger>
            <PopoverContent align="end" className="bg-white w-[200px]">
              <button
                className="flex items-center justify-between w-full px-2 py-1 hover:bg-gray-100"
                onClick={handleDelete}
              >
                <p>Delete</p>
                <TrashIcon className="w-4 h-4 text-red-500" />
              </button>
            </PopoverContent>
          </Popover>
        </div>

        <div className=" slide-box relative overflow-hidden border aspect-video"
          style={{

          }}
        >
          <div className="absolute bg-transparent z-40 top-0 left-0 w-full h-full" />
          <div className="transform scale-[0.2] flex justify-center items-center origin-top-left  w-[500%] h-[500%]">
            {renderSlideContent(slide, false)}
          </div>
        </div>

        {/* Icon and Title */}
        <div className="flex items-center gap-2 pb-1">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="w-full h-full max-w-[20px] max-h-[20px]"
            viewBox="0 0 24 24"
            fill="none"
          >
            <path
              d="M15.75 0.75V6C15.75 6.42 16.08 6.75 16.5 6.75H21.75M9.75 17.25H7.5C7.08 17.25 6.75 16.92 6.75 16.5V12C6.75 11.58 7.08 11.25 7.5 11.25H13.5C13.92 11.25 14.25 11.58 14.25 12V14.25M21.75 6.3V22.5C21.75 22.92 21.42 23.25 21 23.25H3C2.58 23.25 2.25 22.92 2.25 22.5V1.5C2.25 1.08 2.58 0.75 3 0.75H16.275C16.47 0.75 16.665 0.825 16.815 0.975L21.54 5.775C21.675 5.925 21.75 6.105 21.75 6.3ZM10.5 14.25H16.5C16.92 14.25 17.25 14.58 17.25 15V19.5C17.25 19.92 16.92 20.25 16.5 20.25H10.5C10.08 20.25 9.75 19.92 9.75 19.5V15C9.75 14.58 10.08 14.25 10.5 14.25Z"
              stroke="black"
              strokeWidth="1.5"
            />
          </svg>
          <p className="text-[#667085] text-sm ml-1 line-clamp-2 font-roboto">
            {title}
          </p>
        </div>
      </div>
    </Card>
  );
};
