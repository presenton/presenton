"use client";

import { useEffect, useMemo, useState } from "react";
import {
  extractTemplateV2Layouts,
  normalizeTemplateV2Fonts,
} from "@/components/slide-editor/importing/template-v2-import";
import { normalizeBackendAssetUrls } from "@/utils/api";
import { TemplateV2Layout } from "../custom-template/types";
import TemplateService, {
  TemplateDetailsResponse,
} from "../services/api/template";

function getRenderableLayouts(template: TemplateDetailsResponse): TemplateV2Layout[] {
  const layouts = extractTemplateV2Layouts(template.layouts);
  if (layouts.length > 0) {
    return layouts as TemplateV2Layout[];
  }
  return extractTemplateV2Layouts(template.raw_layouts) as TemplateV2Layout[];
}

export function useTemplateDetails(templateId: string) {
  const [template, setTemplate] = useState<TemplateDetailsResponse | null>(null);
  const [loading, setLoading] = useState(Boolean(templateId));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!templateId) {
      setTemplate(null);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;

    const loadTemplate = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await TemplateService.getTemplateDetails(templateId);
        if (!cancelled) {
          setTemplate(normalizeBackendAssetUrls(response));
        }
      } catch (loadError) {
        console.error("Failed to load template details", loadError);
        if (!cancelled) {
          setTemplate(null);
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Failed to load template"
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadTemplate();
    return () => {
      cancelled = true;
    };
  }, [templateId]);

  const layouts = useMemo(
    () => (template ? getRenderableLayouts(template) : []),
    [template]
  );

  const fonts = useMemo(
    () => (template ? normalizeTemplateV2Fonts(template) : undefined),
    [template]
  );



  return {
    template,
    layouts,
    fonts,
    loading,
    error,
  };
}
