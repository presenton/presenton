"use client";

import React, { memo, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ArrowUpRight, CheckCircle2, Loader2 } from "lucide-react";
import { resolveBackendAssetUrl } from "@/utils/api";
import {
  TemplateCreateTaskResponse,
  TemplateListItem,
} from "../services/api/template";
import {
  TemplatePreviewStage,
  LayoutsBadge,
} from "./TemplatePreviewComponents";
import { TemplateTab } from "../hooks/useTemplateSummaries";

export function TemplateThumbnailPreview({
  thumbnail,
  templateName,
  selectionPage = false,
}: {
  thumbnail?: string | null;
  templateName: string;
  selectionPage?: boolean;
}) {
  const resolvedThumbnail = thumbnail ? resolveBackendAssetUrl(thumbnail) : "";

  if (!resolvedThumbnail) {
    return (
      <div
        className={cn(
          "relative z-10 flex w-full items-center justify-center rounded-[12px] border border-[#EDEEEF] bg-white/80",
          selectionPage ? "h-full" : "aspect-video"
        )}
      >
        <div className="h-10 w-16 rounded-md border border-dashed border-[#C9CDD8] bg-[#F7F8FB]" />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative z-10 flex w-full items-center justify-center",
        selectionPage ? "h-full" : "aspect-video"
      )}
    >
      <div
        aria-label={`${templateName} thumbnail`}
        className={cn(
          "h-full w-full rounded-[12px] border border-[#EDEEEF] bg-white bg-contain bg-center bg-no-repeat",
          !selectionPage && "shadow-sm"
        )}
        role="img"
        style={{ backgroundImage: `url(${JSON.stringify(resolvedThumbnail)})` }}
      />
    </div>
  );
}

export const TemplateListCard = memo(function TemplateListCard({
  template,
  onClick,
  isSelected = false,
  showArrow = false,
  selectionPage = false,
}: {
  template: TemplateListItem;
  onClick: () => void;
  isSelected?: boolean;
  showArrow?: boolean;
  selectionPage?: boolean;
}) {
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.currentTarget.getAttribute("aria-disabled") === "true") {
        return;
      }
      if (event.key !== "Enter" && event.key !== " ") {
        return;
      }
      event.preventDefault();
      onClick();
    },
    [onClick]
  );

  const rawStatus = template.generation_status ?? template.status ?? null;
  const status = rawStatus?.toLowerCase().replace(/[_-]+/g, " ") ?? null;
  const isGeneratingStatus =
    status === "generating" ||
    status === "processing" ||
    status === "pending" ||
    status === "queued" ||
    status === "running" ||
    status === "in progress";
  const statusLabel =
    status && !isGeneratingStatus
      ? status.replace(/\b\w/g, (char) => char.toUpperCase())
      : null;

  return (
    <Card
      role="button"
      tabIndex={0}
      aria-pressed={isSelected}
      aria-label={`${showArrow ? "Open" : "Select"} ${template.name} template`}
      className={cn(
        "group relative overflow-hidden border bg-white shadow-none outline-none transition-all duration-200",
        selectionPage ? "rounded-[12px]" : "rounded-[22px]",
        "cursor-pointer hover:-translate-y-1 hover:border-[#7A5AF8] hover:ring-2 hover:ring-[#7A5AF8]/20 hover:shadow-[0_18px_40px_rgba(34,31,54,0.12)] focus-visible:-translate-y-1 focus-visible:border-[#7A5AF8] focus-visible:ring-2 focus-visible:ring-[#7A5AF8]/30 focus-visible:shadow-[0_18px_40px_rgba(34,31,54,0.12)]",
        isSelected
          ? cn(
              "ring-2 ring-[#7A5AF8]/25 shadow-[0_14px_34px_rgba(34,31,54,0.12)]",
              selectionPage ? "!border-0" : "border-[#7A5AF8]"
            )
          : selectionPage
            ? "!border-0 !shadow-[inset_0_0_0_1px_#EDEEEF]"
            : "border-[#E8E9EC]"
      )}
      onClick={onClick}
      onKeyDown={handleKeyDown}
    >
      <div
        className={cn(
          "pointer-events-none absolute inset-0 z-30 bg-[#7A5AF8]/[0.04] opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100",
          selectionPage ? "rounded-[12px]" : "rounded-[22px]"
        )}
      />
      {isSelected && (
        <span className="absolute right-4 top-3.5 z-50 inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#7A5AF8] text-white shadow-sm">
          <CheckCircle2 className="h-4 w-4" />
        </span>
      )}
      <TemplatePreviewStage selectionPage={selectionPage}>
        <LayoutsBadge
          count={template.layout_count ?? 0}
          selectionPage={selectionPage}
        />
        <TemplateThumbnailPreview
          thumbnail={template.thumbnail}
          templateName={template.name}
          selectionPage={selectionPage}
        />
      </TemplatePreviewStage>
      <div
        className={cn(
          "relative z-40 flex items-center justify-between gap-4 border-t border-[#EDEEEF] bg-white",
          selectionPage ? "h-20 px-5 py-2.5" : "px-6 py-5"
        )}
      >
        <div className="min-w-0 flex-1">
          <h3
            className={cn(
              "font-syne capitalize",
              selectionPage
                ? "text-sm font-semibold tracking-[0.14px] text-[#191919]"
                : cn(
                    "font-bold text-gray-900",
                    showArrow ? "text-base" : "text-sm"
                  )
            )}
          >
            {template.name}
          </h3>
          {template.description && (
            <p
              className={cn(
                "line-clamp-2 font-syne",
                selectionPage
                  ? "mt-1 text-[11px] font-semibold leading-3 tracking-[0.11px] text-[#808080]"
                  : cn(
                      "text-gray-600",
                      showArrow ? "mt-1 text-sm text-gray-500" : "text-xs"
                    )
              )}
            >
              {template.description}
            </p>
          )}
          {statusLabel && (
            <span
              className="mt-2 inline-flex w-fit items-center gap-1.5 rounded-full border border-[#E7E8EE] bg-[#F6F7FA] px-2.5 py-1 text-[11px] font-medium text-[#60636F]"
            >
              {statusLabel}
            </span>
          )}
        </div>
        {showArrow && (
          <ArrowUpRight
            aria-hidden="true"
            strokeWidth={selectionPage ? 1.67 : 2}
            className={cn(
              "shrink-0",
              selectionPage
                ? "h-5 w-5 text-[#808080]"
                : "h-4 w-4 text-gray-400 transition-colors group-hover:text-purple-600"
            )}
          />
        )}
      </div>
    </Card>
  );
});

export const ProcessingTemplateListCard = memo(
  function ProcessingTemplateListCard({
    task,
  }: {
    task: TemplateCreateTaskResponse;
  }) {
    const templateName = task.data?.name?.trim() || "New template";
    const createdLayouts = task.data?.created_layouts ?? 0;
    const remainingLayouts = task.data?.remaining_layouts ?? 0;
    const totalLayouts = createdLayouts + remainingLayouts;
    const progressPercent =
      totalLayouts > 0
        ? Math.min(
            95,
            Math.max(0, Math.round((createdLayouts / totalLayouts) * 100))
          )
        : 0;
    const overlayWidth = `${100 - progressPercent}%`;
    const visibilityOverlayOpacity = Math.max(
      0.1,
      0.72 - progressPercent / 150
    );
    const progressLabel =
      totalLayouts > 0
        ? `${createdLayouts} of ${totalLayouts} layouts`
        : "Preparing layouts";

    return (
      <Card
        role="group"
        aria-disabled="true"
        aria-label={`${templateName} template is processing`}
        className={cn(
          "relative overflow-hidden rounded-[22px] border border-[#E8E9EC] bg-white",
          "cursor-not-allowed opacity-90 shadow-sm"
        )}
      >
        <TemplatePreviewStage>
          <LayoutsBadge count={totalLayouts} />
          <TemplateThumbnailPreview
            thumbnail={task.data?.thumbnail}
            templateName={templateName}
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-5 z-20 rounded-xl bg-white transition-opacity duration-500 ease-out"
            style={{ opacity: visibilityOverlayOpacity }}
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute bottom-5 right-5 top-5 z-20 rounded-r-xl bg-[#F8F7FF]/70 transition-[width] duration-500 ease-out"
            style={{ width: overlayWidth }}
          />
          <div className="absolute right-8 top-8 z-30 inline-flex items-center gap-1.5 rounded-full border border-white/80 bg-white/90 px-2.5 py-1.5 text-xs font-bold text-[#5146E5] shadow-sm backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-[#7A5AF8]" />
            {progressPercent}%
          </div>
          <div className="absolute inset-x-5 bottom-5 z-30 h-1.5 overflow-hidden rounded-full bg-white/70">
            <div
              className="h-full rounded-full bg-[#5146E5] transition-[width] duration-500 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </TemplatePreviewStage>
        <div className="relative z-40 flex items-center justify-between gap-4 border-t border-[#EDEEEF] bg-white px-6 py-5">
          <div className="min-w-0 flex-1">
            <h3 className="truncate font-syne text-base font-bold capitalize text-gray-900">
              {templateName}
            </h3>
            <p className="mt-1 text-xs font-medium text-[#60636F]">
              {progressLabel}
            </p>
          </div>
        </div>
      </Card>
    );
  }
);

export function TemplateListSection({
  label,
  children,
  selectionPage = false,
}: {
  label: string;
  children: React.ReactNode;
  selectionPage?: boolean;
}) {
  return (
    <section className={selectionPage ? "space-y-3" : "space-y-4"}>
      <h3
        className={cn(
          "font-syne text-sm text-[#3A3A3A]",
          selectionPage ? "text-base font-medium" : "font-semibold"
        )}
      >
        {label}
      </h3>
      {children}
    </section>
  );
}

export function TemplateTabSwitcher({
  tab,
  onTabChange,
}: {
  tab: TemplateTab;
  onTabChange: (tab: TemplateTab) => void;
}) {
  return (
    <div className="p-1 rounded-[40px] bg-[#ffffff] w-fit border border-[#EDEEEF] flex items-center justify-center">
      <button
        type="button"
        className="px-5 py-2 text-xs font-medium text-[#3A3A3A] rounded-[70px]"
        onClick={() => onTabChange("custom")}
        style={{
          background: tab === "custom" ? "#F4F3FF" : "transparent",
          color: tab === "custom" ? "#5146E5" : "#3A3A3A",
        }}
      >
        Custom
      </button>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="mx-1"
        width="2"
        height="17"
        viewBox="0 0 2 17"
        fill="none"
        aria-hidden="true"
      >
        <path d="M1 0V16.5" stroke="#EDECEC" strokeWidth="2" />
      </svg>
      <button
        type="button"
        className="px-5 py-2 text-xs font-medium text-[#3A3A3A] rounded-[70px]"
        onClick={() => onTabChange("default")}
        style={{
          background: tab === "default" ? "#F4F3FF" : "transparent",
          color: tab === "default" ? "#5146E5" : "#3A3A3A",
        }}
      >
        Built-in
      </button>
    </div>
  );
}

export function TemplateListLoadingState({ message = "Loading templates..." }: { message?: string }) {
  return (
    <div className="flex items-center justify-center py-12 font-syne">
      <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      <span className="ml-3 text-gray-600">{message}</span>
    </div>
  );
}

export function TemplateListEmptyState({ message = "No templates available." }: { message?: string }) {
  return (
    <div className="flex items-center justify-center py-12 font-syne text-gray-600">
      {message}
    </div>
  );
}
