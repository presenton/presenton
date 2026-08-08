"use client";

import React, { memo } from "react";
import CreateCustomTemplate from "../../(dashboard)/templates/components/CreateCustomTemplate";
import { useTemplateSummaries } from "../../hooks/useTemplateSummaries";
import {
  TemplateListCard,
  TemplateListLoadingState,
  TemplateListEmptyState,
  TemplateListSection,
} from "../../components/TemplateListUi";
import { MixpanelEvent, trackEvent } from "@/utils/mixpanel";

interface TemplateSelectionProps {
  presentationId: string | null;
  selectedTemplateId: string | null;
  onSelectTemplate: (template: {
    id: string;
    name: string;
    source: "default" | "custom";
    position: number;
  }) => void;
  onCreateTemplate?: () => void;
}

const TemplateSelection: React.FC<TemplateSelectionProps> = memo(
  function TemplateSelection({
    presentationId,
    selectedTemplateId,
    onSelectTemplate,
    onCreateTemplate,
  }) {
    const { defaultTemplates, customTemplates, loading } =
      useTemplateSummaries();

    if (loading) {
      return <TemplateListLoadingState />;
    }

    const renderTemplateCard = (
      template: (typeof defaultTemplates)[number],
      index: number,
      source: "default" | "custom"
    ) => (
      <TemplateListCard
        key={template.id}
        template={template}
        isSelected={selectedTemplateId === template.id}
        showArrow
        selectionPage
        onClick={() => {
          trackEvent(MixpanelEvent.TemplateV2_Template_Selected, {
            presentation_id: presentationId,
            template_id: template.id,
            template_source: source,
          });
          onSelectTemplate({
            id: template.id,
            name: template.name,
            source,
            position: index,
          });
        }}
      />
    );

    if (customTemplates.length === 0) {
      return (
        <div className="mb-8">
          <TemplateListSection label="Templates" selectionPage>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              <CreateCustomTemplate
                selectionPage
                onClick={onCreateTemplate}
              />
              {defaultTemplates.map((template, index) =>
                renderTemplateCard(template, index, "default")
              )}
            </div>
          </TemplateListSection>
        </div>
      );
    }

    return (
      <div className="mb-8 space-y-[30px]">
        <TemplateListSection label="Custom" selectionPage>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            <CreateCustomTemplate
              selectionPage
              onClick={onCreateTemplate}
            />
            {customTemplates.map((template, index) =>
              renderTemplateCard(template, index, "custom")
            )}
          </div>
        </TemplateListSection>

        <TemplateListSection label="Built-In" selectionPage>
          {defaultTemplates.length === 0 ? (
            <TemplateListEmptyState message="No built-in templates available." />
          ) : (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {defaultTemplates.map((template, index) =>
                renderTemplateCard(template, index, "default")
              )}
            </div>
          )}
        </TemplateListSection>
      </div>
    );
  }
);

export default TemplateSelection;
