"use client";

import React, { memo, useEffect } from "react";
import CreateCustomTemplate from "../../(dashboard)/templates/components/CreateCustomTemplate";
import { useTemplateSummaries } from "../../hooks/useTemplateSummaries";
import {
  TemplateListCard,
  TemplateListLoadingState,
  TemplateListEmptyState,
  TemplateListSection,
} from "../../components/TemplateListUi";
import { MixpanelEvent, trackEvent } from "@/utils/mixpanel";
import { useSelector } from "react-redux";
import type { RootState } from "@/store/store";

interface TemplateSelectionProps {
  presentationId: string | null;
  selectedTemplateId: string | null;
  suggestedTemplate?: string | null;
  onSuggestedTemplateResolved?: (template: {
    id: string;
    name: string;
    source: "default" | "custom";
    position: number;
  }) => void;
  onSelectTemplate: (template: {
    id: string;
    name: string;
    source: "default" | "custom";
    position: number;
  }) => void;
  onCreateTemplate?: () => void;
}

const normalizeTemplateName = (name: string) =>
  name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-");

const TemplateSelection: React.FC<TemplateSelectionProps> = memo(
  function TemplateSelection({
    presentationId,
    selectedTemplateId,
    suggestedTemplate,
    onSuggestedTemplateResolved,
    onSelectTemplate,
    onCreateTemplate,
  }) {
    const presentonCloudOnly = useSelector(
      (state: RootState) => state.userConfig.llm_config.LLM === "presenton"
    );
    const { defaultTemplates, customTemplates, loading, error } =
      useTemplateSummaries({ presentonCloudOnly });

    useEffect(() => {
      if (loading || !suggestedTemplate || selectedTemplateId) return;

      const normalizedSuggestion = suggestedTemplate.trim().toLowerCase();
      const candidates = [
        ...defaultTemplates.map((template, position) => ({
          template,
          position,
          source: "default" as const,
        })),
        ...customTemplates.map((template, position) => ({
          template,
          position,
          source: "custom" as const,
        })),
      ];
      const match = candidates.find(
        ({ template }) =>
          template.id === suggestedTemplate ||
          normalizeTemplateName(template.name) === normalizedSuggestion
      );

      if (match) {
        onSuggestedTemplateResolved?.({
          id: match.template.id,
          name: match.template.name,
          source: match.source,
          position: match.position,
        });
      }
    }, [
      customTemplates,
      defaultTemplates,
      loading,
      onSuggestedTemplateResolved,
      selectedTemplateId,
      suggestedTemplate,
    ]);

    if (loading) {
      return <TemplateListLoadingState />;
    }

    if (error) {
      return (
        <TemplateListEmptyState
          message={`Templates could not be loaded: ${error}`}
        />
      );
    }

    const renderTemplateCard = (
      template: (typeof defaultTemplates)[number],
      index: number,
      source: "default" | "custom"
    ) => {
      const isSuggested = Boolean(
        suggestedTemplate &&
          (template.id === suggestedTemplate ||
            normalizeTemplateName(template.name) ===
              suggestedTemplate.trim().toLowerCase())
      );

      return (
        <TemplateListCard
          key={template.id}
          template={template}
          isSelected={selectedTemplateId === template.id}
          isSuggested={isSuggested}
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
    };

    const suggestionNotice = suggestedTemplate && selectedTemplateId && (
      <div className="mb-5 rounded-xl border border-[#E4E0FF] bg-[#F7F5FF] px-4 py-3 font-syne text-xs font-medium text-[#1D4ED8]">
        <strong className="font-semibold">Suggested template selected.</strong>{" "}
        Click the highlighted template to continue.
      </div>
    );

    if (customTemplates.length === 0) {
      return (
        <div className="mb-8">
          {suggestionNotice}
          <TemplateListSection label="Templates" selectionPage>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {!presentonCloudOnly && (
                <CreateCustomTemplate
                  selectionPage
                  onClick={onCreateTemplate}
                />
              )}
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
        {suggestionNotice}
        <TemplateListSection label="Custom" selectionPage>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {!presentonCloudOnly && (
              <CreateCustomTemplate
                selectionPage
                onClick={onCreateTemplate}
              />
            )}
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
