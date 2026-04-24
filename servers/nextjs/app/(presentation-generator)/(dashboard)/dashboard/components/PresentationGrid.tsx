import React from "react";
import { PresentationCard } from "./PresentationCard";
import { PlusIcon } from "@radix-ui/react-icons";
import { usePathname, useRouter } from "next/navigation";
import { PresentationResponse } from "@/app/(presentation-generator)/services/api/dashboard";
import { ArrowRight } from "lucide-react";
import { trackEvent, MixpanelEvent } from "@/utils/mixpanel";

interface PresentationGridProps {
  presentations: PresentationResponse[];
  type: "slide" | "video";
  isLoading?: boolean;
  error?: string | null;
  onPresentationDeleted?: (presentationId: string) => void;
}

export const PresentationGrid = ({
  presentations,
  type,
  isLoading = false,
  error = null,
  onPresentationDeleted,
}: PresentationGridProps) => {
  const router = useRouter();
  const pathname = usePathname();
  const handleCreateNewPresentation = () => {
    trackEvent(MixpanelEvent.Dashboard_Create_New_Card_Clicked, {
      pathname,
      type,
      source: "dashboard_grid_card",
    });
    if (type === "slide") {
      router.push("/upload");
    } else {
      router.push("/editor");
    }
  };

  const ShimmerCard = () => (
    <div className="flex flex-col gap-4 min-h-[200px] bg-white/70 rounded-lg p-4 animate-pulse">
      <div className="w-full h-24 bg-gray-200 rounded-lg"></div>
      <div className="space-y-3">
        <div className="h-4 bg-gray-200 rounded w-3/4"></div>
        <div className="h-3 bg-gray-200 rounded w-1/2"></div>
      </div>
    </div>
  );

  const CreateNewCard = () => (
    <div
      onClick={handleCreateNewPresentation}
      className="flex flex-col cursor-pointer group ring-1 ring-inset ring-slate-200 hover:ring-[#8A7DFF]/40 bg-white/80 rounded-xl overflow-hidden transition-all duration-300 font-syne"
    >
      <img src="/create_presentation.png" alt="New Presentation" className="w-full aspect-[16/11] object-cover" />
      <div className="flex items-center gap-3 p-3 mt-auto  border border-[#EDEEEF]">
        <svg xmlns="http://www.w3.org/2000/svg" width="45" height="46" viewBox="0 0 45 46" fill="none" className="flex-shrink-0">
          <rect width="45" height="46" rx="8" fill="#FB6514" />
          <g clipPath="url(#clip0_1789_6104)">
            <path d="M16.0332 17.1807L28.9665 17.1807" stroke="white" strokeWidth="1.11" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M28.3197 17.1807L28.3197 24.294C28.3197 24.637 28.1834 24.966 27.9409 25.2085C27.6983 25.4511 27.3694 25.5873 27.0264 25.5873L17.973 25.5873C17.63 25.5873 17.301 25.4511 17.0585 25.2085C16.8159 24.966 16.6797 24.637 16.6797 24.294L16.6797 17.1807" stroke="white" strokeWidth="1.11" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M19.2676 28.8202L22.5009 25.5869L25.7342 28.8202" stroke="white" strokeWidth="1.11" strokeLinecap="round" strokeLinejoin="round" />
          </g>
          <defs>
            <clipPath id="clip0_1789_6104">
              <rect width="15.52" height="15.52" fill="white" transform="translate(14.7402 15.2402)" />
            </clipPath>
          </defs>
        </svg>
        <div>
          <h4 className="text-sm text-[#191919] font-semibold tracking-[0.14px]">Create New Presentation</h4>
          <p className="text-sm text-[#808080] font-medium tracking-[0.14px] flex items-center gap-2">Get Started <ArrowRight className="w-4 h-4" /></p>
        </div>
      </div>
    </div>
  );

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 px-6 mt-10 md:grid-cols-2 lg:grid-cols-4 gap-5 sm:gap-6 w-full">
        <div className="flex flex-col gap-4 min-h-[200px] cursor-pointer group ring-1 ring-inset ring-slate-200 bg-white/80 rounded-xl items-center justify-center animate-pulse">
          <div className="rounded-full bg-slate-200 p-4">
            <div className="w-8 h-8" />
          </div>
          <div className="text-center space-y-2">
            <div className="h-4 bg-slate-200 rounded w-32 mx-auto"></div>
            <div className="h-3 bg-slate-200 rounded w-48 mx-auto"></div>
          </div>
        </div>
        {[...Array(15)].map((_, i) => (
          <ShimmerCard key={i} />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <CreateNewCard />
        <div className="col-span-3 flex items-center justify-center">
          <div className="text-center text-gray-500">
            <p className="mb-2">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="text-primary hover:text-primary/80 underline"
            >
              Try again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <CreateNewCard />
      {presentations &&
        presentations.length > 0 &&
        presentations.map((presentation) => (
          <PresentationCard
            key={presentation.id}
            id={presentation.id}
            title={presentation.title}
            presentation={presentation}
            onDeleted={onPresentationDeleted}
          />
        ))}
    </div>
  );
};
