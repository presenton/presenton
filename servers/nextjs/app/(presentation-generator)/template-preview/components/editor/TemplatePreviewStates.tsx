"use client";

import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function TemplatePreviewLoadingState() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#FAFAFB]">
      <Loader2 className="h-8 w-8 animate-spin text-[#2563EB]" />
      <span className="ml-3 text-sm font-medium text-[#696969]">
        Loading template...
      </span>
    </div>
  );
}

export function TemplatePreviewErrorState({
  error,
  onBack,
}: {
  error: string | null | undefined;
  onBack: () => void;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#FAFAFB] px-6 text-center">
      <h2 className="mb-3 text-2xl font-semibold text-[#191919]">
        Error loading template
      </h2>
      <p className="mb-6 max-w-lg text-sm text-[#696969]">{error}</p>
      <Button onClick={onBack} variant="outline">
        <ArrowLeft className="h-4 w-4" />
        Back to Templates
      </Button>
    </div>
  );
}

export function TemplatePreviewNotFoundState({
  onBack,
}: {
  onBack: () => void;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#FAFAFB] px-6 text-center">
      <h2 className="mb-6 text-2xl font-semibold text-[#191919]">
        Template not found
      </h2>
      <Button onClick={onBack} variant="outline">
        <ArrowLeft className="h-4 w-4" />
        Back to Templates
      </Button>
    </div>
  );
}
