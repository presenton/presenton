"use client";
import React, { memo, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { CheckCircle2 } from "lucide-react";
import {
    TemplatePreviewStage,
    LayoutsBadge,
} from "../../components/TemplatePreviewComponents";
import { TemplateThumbnailPreview } from "../../components/TemplateListUi";

interface TemplateListItem {
    id: string;
    name: string;
    layout_count?: number;
    thumbnail?: string | null;
}

export const CustomTemplateCard = memo(function CustomTemplateCard({
    template,
    onSelectTemplate,
    selectedTemplate,
}: {
    template: TemplateListItem;
    onSelectTemplate: (template: string) => void;
    selectedTemplate: string | null;
}) {
    const isSelected = selectedTemplate === template.id;
    const handleSelect = useCallback(() => onSelectTemplate(template.id), [onSelectTemplate, template.id]);
    const handleKeyDown = useCallback(
        (event: React.KeyboardEvent<HTMLDivElement>) => {
            if (event.key !== "Enter" && event.key !== " ") {
                return;
            }
            event.preventDefault();
            handleSelect();
        },
        [handleSelect]
    );

    return (
        <Card
            role="button"
            tabIndex={0}
            aria-pressed={isSelected}
            aria-label={`Select ${template.name} template`}
            className={cn(
                "font-syne cursor-pointer flex flex-col justify-between relative transition-all duration-200 group overflow-hidden rounded-[22px] bg-white border outline-none",
                "hover:-translate-y-1 hover:border-[#7A5AF8] hover:ring-2 hover:ring-[#7A5AF8]/20 hover:shadow-[0_18px_40px_rgba(34,31,54,0.12)]",
                "focus-visible:-translate-y-1 focus-visible:border-[#7A5AF8] focus-visible:ring-2 focus-visible:ring-[#7A5AF8]/30 focus-visible:shadow-[0_18px_40px_rgba(34,31,54,0.12)]",
                isSelected
                    ? " border-[#7A5AF8] ring-2 ring-[#7A5AF8]/25 shadow-[0_14px_34px_rgba(34,31,54,0.12)]"
                    : " border-[#E8E9EC]"
            )}
            onClick={handleSelect}
            onKeyDown={handleKeyDown}
        >
            <div className="pointer-events-none absolute inset-0 z-30 rounded-[22px] bg-[#7A5AF8]/[0.04] opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100" />
            {isSelected && (
                <span className="absolute right-4 top-3.5 z-50 inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#7A5AF8] text-white shadow-sm">
                    <CheckCircle2 className="h-4 w-4" />
                </span>
            )}
            <TemplatePreviewStage>
                <LayoutsBadge count={template.layout_count ?? 0} />
                <TemplateThumbnailPreview
                    thumbnail={template.thumbnail}
                    templateName={template.name}
                />
            </TemplatePreviewStage>
            <div className="flex items-center justify-between px-6 py-5 bg-white border-t border-[#EDEEEF] relative z-40">
                <h3 className="text-sm font-bold text-gray-900 font-syne">
                    {template.name}
                </h3>
            </div>
        </Card>
    );
});
