import React from "react";
import { PresentationCard } from "./PresentationCard";
import { PresentationResponse } from "@/app/(presentation-generator)/services/api/dashboard";
import { EmptyState } from "./EmptyState";

interface PresentationGridProps {
  presentations: PresentationResponse[];
  viewMode?: "grid" | "list";
  isLoading?: boolean;
  error?: string | null;
  onPresentationDeleted?: (presentationId: string) => void;
  onPresentationDuplicated?: (presentation: PresentationResponse) => void;
}

export const PresentationGrid = ({
  presentations,
  viewMode = "grid",
  isLoading = false,
  error = null,
  onPresentationDeleted,
  onPresentationDuplicated,
}: PresentationGridProps) => {
  const ShimmerCard = () => (
    <div className="flex min-h-[216px] flex-col overflow-hidden rounded-[12px] border border-[#EDEEEF] bg-[#F8FBFB] shadow-none animate-pulse">
      <div className="relative flex-1 overflow-hidden p-4">
        <img
          src="/card_bg.svg"
          alt=""
          className="absolute inset-0 h-full w-full object-cover opacity-70"
        />
        <div className="relative mx-auto mt-2 aspect-video w-[88%] rounded-lg border border-gray-200 bg-gray-200" />
      </div>
      <div className="relative z-10 border-t border-[#EDEEEF] bg-white px-5 py-3">
        <div className="flex items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="h-3.5 w-24 rounded bg-gray-200" />
            <div className="h-3 w-16 rounded bg-gray-200" />
          </div>
          <div className="h-5 w-1 rounded-full bg-gray-200" />
        </div>
      </div>
    </div>
  );

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 sm:gap-6 w-full">
        {[...Array(12)].map((_, i) => (
          <ShimmerCard key={i} />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[220px] items-center justify-center rounded-xl border border-[#EDEEEF] bg-white/80">
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
    );
  }

  if (!presentations || presentations.length === 0) {
    return <EmptyState />;
  }

  return (
    <div
      className={
        viewMode === "grid"
          ? "grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4"
          : "grid grid-cols-1 gap-4"
      }
    >
      {presentations.map((presentation) => (

        <PresentationCard
          key={presentation.id}
          id={presentation.id}
          title={presentation.title}
          presentation={presentation}
          viewMode={viewMode}
          onDeleted={onPresentationDeleted}
          onDuplicated={onPresentationDuplicated}
        />
      ))}
    </div>
  );
};
