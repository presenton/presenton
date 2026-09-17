"use client";

import React, { memo, useEffect, useState } from "react";
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
import ThemeApi, {
  GeneratedThemeColors,
  ReferencePaletteSeeds,
} from "../../services/api/theme";

interface TemplateSelectionProps {
  presentationId: string | null;
  selectedTemplateId: string | null;
  suggestedTemplate?: string | null;
  themeOverride?: GeneratedThemeColors | null;
  onThemeOverrideChange?: (theme: GeneratedThemeColors | null) => void;
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

const THEME_SWATCH_KEYS: Array<keyof GeneratedThemeColors> = [
  "background",
  "card",
  "primary",
  "background_text",
];

const ThemeOverridePicker: React.FC<{
  themeOverride?: GeneratedThemeColors | null;
  onThemeOverrideChange: (theme: GeneratedThemeColors | null) => void;
}> = ({ themeOverride, onThemeOverrideChange }) => {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mood, setMood] = useState<string | null>(null);

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setIsUploading(true);
    setError(null);
    try {
      const result = await ThemeApi.generateThemeFromImage(file);
      onThemeOverrideChange(result.theme);
      setMood((result.seeds as ReferencePaletteSeeds)?.mood ?? null);
    } catch (err) {
      console.error("Failed to generate theme from reference image", err);
      setError("Couldn't read a palette from that image. Try another one.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="mb-6 rounded-xl border border-[#E6E6F0] bg-white px-4 py-3 font-syne">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-[#141414]">Visual theme</p>
          <p className="text-xs text-[#6B6B76]">
            Use the template&apos;s default colors, or match a reference image.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              onThemeOverrideChange(null);
              setMood(null);
              setError(null);
            }}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
              !themeOverride
                ? "border-[#5141E5] bg-[#F7F5FF] text-[#5141E5]"
                : "border-[#E6E6F0] text-[#6B6B76]"
            }`}
          >
            Template default
          </button>
          <label
            className={`cursor-pointer rounded-full border px-3 py-1.5 text-xs font-medium ${
              themeOverride
                ? "border-[#5141E5] bg-[#F7F5FF] text-[#5141E5]"
                : "border-[#E6E6F0] text-[#6B6B76]"
            }`}
          >
            {isUploading ? "Reading image…" : "Match a reference image"}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              disabled={isUploading}
              onChange={handleFileChange}
            />
          </label>
        </div>
      </div>

      {themeOverride && (
        <div className="mt-3 flex items-center gap-2">
          <div className="flex overflow-hidden rounded-md border border-[#E6E6F0]">
            {THEME_SWATCH_KEYS.map((key) => (
              <span
                key={key}
                className="h-6 w-6"
                style={{ backgroundColor: themeOverride[key] }}
                title={`${key}: ${themeOverride[key]}`}
              />
            ))}
          </div>
          {mood && <span className="text-xs text-[#6B6B76]">{mood}</span>}
        </div>
      )}

      {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
    </div>
  );
};

const normalizeTemplateName = (name: string) =>
  name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-");

const TemplateSelection: React.FC<TemplateSelectionProps> = memo(
  function TemplateSelection({
    presentationId,
    selectedTemplateId,
    suggestedTemplate,
    themeOverride,
    onThemeOverrideChange,
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
      <div className="mb-5 rounded-xl border border-[#E4E0FF] bg-[#F7F5FF] px-4 py-3 font-syne text-xs font-medium text-[#5141E5]">
        <strong className="font-semibold">Suggested template selected.</strong>{" "}
        Click the highlighted template to continue.
      </div>
    );

    const themePicker = onThemeOverrideChange && (
      <ThemeOverridePicker
        themeOverride={themeOverride}
        onThemeOverrideChange={onThemeOverrideChange}
      />
    );

    if (customTemplates.length === 0) {
      return (
        <div className="mb-8">
          {themePicker}
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
        {themePicker}
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
