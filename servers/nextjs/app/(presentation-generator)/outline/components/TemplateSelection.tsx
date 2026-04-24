"use client";
import React, { useEffect, useMemo, useCallback, memo } from "react";

import { TemplateLayoutsWithSettings } from "@/app/presentation-templates/utils";
import { templates } from "@/app/presentation-templates";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { CustomTemplates, useCustomTemplateSummaries } from "@/app/hooks/useCustomTemplates";
import { Loader2 } from "lucide-react";

import CreateCustomTemplate from "../../(dashboard)/templates/components/CreateCustomTemplate";
import { CustomTemplateCard } from "./CustomTemplateCard";
import {
  TemplatePreviewStage,
  LayoutsBadge,
  InbuiltTemplatePreview,
} from "../../components/TemplatePreviewComponents";

const BuiltInTemplateCard = memo(function BuiltInTemplateCard({
  template,
  isSelected,
  onSelect,
}: {
  template: TemplateLayoutsWithSettings;
  isSelected: boolean;
  onSelect: (template: TemplateLayoutsWithSettings) => void;
}) {
  const handleClick = useCallback(() => onSelect(template), [onSelect, template]);

  return (
    <Card
      className={cn(
        "cursor-pointer relative hover:shadow-sm transition-all duration-200 group overflow-hidden rounded-[22px] bg-white border",
        isSelected
          ? " border-blue-500 ring-2 ring-blue-500/25 shadow-sm"
          : " border-[#E8E9EC]"
      )}
      onClick={handleClick}
    >
      <TemplatePreviewStage>
        <LayoutsBadge count={template.layouts.length} />
        <InbuiltTemplatePreview layouts={template.layouts} templateId={template.id} isOutline={true} />
      </TemplatePreviewStage>
      <div className="flex items-center justify-between px-6 py-5 bg-white border-t border-[#EDEEEF] relative z-40">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-bold text-gray-900 capitalize font-syne">
            {template.name}
          </h3>
          <p className="text-xs text-gray-600 line-clamp-2 font-syne">
            {template.description}
          </p>
        </div>
      </div>
    </Card>
  );
});

interface TemplateSelectionProps {
  selectedTemplate: (TemplateLayoutsWithSettings | string) | null;
  onSelectTemplate: (template: TemplateLayoutsWithSettings | string) => void;
}

const TemplateSelection: React.FC<TemplateSelectionProps> = memo(function TemplateSelection({
  selectedTemplate,
  onSelectTemplate,
}) {
  useEffect(() => {
    const existingScript = document.querySelector(
      'script[src*="tailwindcss.com"]'
    );
    if (!existingScript) {
      const script = document.createElement("script");
      script.src = "https://cdn.tailwindcss.com";
      script.async = true;
      document.head.appendChild(script);
    }
  }, []);

  const { templates: customTemplates, loading: customLoading } = useCustomTemplateSummaries();

  const handleCustomSelect = useCallback(
    (template: TemplateLayoutsWithSettings | string) => onSelectTemplate(template),
    [onSelectTemplate]
  );

  const handleBuiltInSelect = useCallback(
    (template: TemplateLayoutsWithSettings) => onSelectTemplate(template),
    [onSelectTemplate]
  );

  const selectedCustomId = useMemo(
    () => (typeof selectedTemplate === "string" ? selectedTemplate : null),
    [selectedTemplate]
  );

  const selectedBuiltInId = useMemo(
    () => (typeof selectedTemplate !== "string" ? selectedTemplate?.id ?? null : null),
    [selectedTemplate]
  );

  const customTemplateCards = useMemo(() => {
    if (customLoading) {
      return (
        <div className="flex items-center justify-center py-12 font-syne">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          <span className="ml-3 text-gray-600">Loading custom templates...</span>
        </div>
      );
    }
    if (customTemplates.length === 0) {
      return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          <CreateCustomTemplate />
        </div>
      );
    }
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {customTemplates.map((template: CustomTemplates) => (
          <CustomTemplateCard
            key={template.id}
            template={template}
            onSelectTemplate={handleCustomSelect}
            selectedTemplate={selectedCustomId}
          />
        ))}
      </div>
    );
  }, [customLoading, customTemplates, handleCustomSelect, selectedCustomId]);

  const builtInTemplateCards = useMemo(
    () =>
      templates.map((template: TemplateLayoutsWithSettings) => (
        <BuiltInTemplateCard
          key={template.id}
          template={template}
          isSelected={selectedBuiltInId === template.id}
          onSelect={handleBuiltInSelect}
        />
      )),
    [selectedBuiltInId, handleBuiltInSelect]
  );

  return (
    <div className="space-y-[30px] mb-4">
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-semibold text-gray-900 font-syne">Custom</h3>
        </div>
        {customTemplateCards}
      </div>
      <div>
        <h3 className="text-base font-semibold text-gray-900 mb-3 font-syne">In Built</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {builtInTemplateCards}
        </div>
      </div>
    </div>
  );
});

export default TemplateSelection;
