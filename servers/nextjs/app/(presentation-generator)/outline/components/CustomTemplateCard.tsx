"use client";
import React, { memo } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { CustomTemplates, useCustomTemplatePreview } from "@/app/hooks/useCustomTemplates";
import {
    TemplatePreviewStage,
    LayoutsBadge,
    CustomTemplatePreview,
} from "../../components/TemplatePreviewComponents";

export const CustomTemplateCard = memo(function CustomTemplateCard({
    template,
    onSelectTemplate,
    selectedTemplate,
}: {
    template: CustomTemplates;
    onSelectTemplate: (template: string) => void;
    selectedTemplate: string | null;
}) {
    const { previewLayouts, loading } = useCustomTemplatePreview(template.id);
    const isSelected = selectedTemplate === template.id;

    return (
        <Card
            className={cn(
                "font-syne cursor-pointer flex flex-col justify-between relative hover:shadow-sm transition-all duration-200 group overflow-hidden rounded-[22px] bg-white border",
                isSelected
                    ? " border-blue-500 ring-2 ring-blue-500/25 shadow-sm"
                    : " border-[#E8E9EC]"
            )}
            onClick={() => onSelectTemplate(template.id)}
        >
            <TemplatePreviewStage>
                <LayoutsBadge count={template.layoutCount} />
                <CustomTemplatePreview
                    previewLayouts={previewLayouts}
                    loading={loading}
                    templateId={template.id}
                    isOutline={true}
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
