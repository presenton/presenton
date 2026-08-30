"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import TemplateService, {
  TemplateCreateTaskResponse,
  TemplateListItem,
} from "../services/api/template";

export type TemplateTab = "custom" | "default";

const FEATURED_BUILT_IN_TEMPLATE_ORDER = [
  "momentum",
  "dynamic",
  "executive",
] as const;

function orderBuiltInTemplates(templates: TemplateListItem[]) {
  const priorityByName = new Map<string, number>(
    FEATURED_BUILT_IN_TEMPLATE_ORDER.map((name, index) => [name, index]),
  );

  return templates
    .map((template, index) => ({ template, index }))
    .sort((left, right) => {
      const leftPriority =
        priorityByName.get(left.template.name.trim().toLowerCase()) ??
        FEATURED_BUILT_IN_TEMPLATE_ORDER.length;
      const rightPriority =
        priorityByName.get(right.template.name.trim().toLowerCase()) ??
        FEATURED_BUILT_IN_TEMPLATE_ORDER.length;

      return leftPriority - rightPriority || left.index - right.index;
    })
    .map(({ template }) => template);
}

export function splitTemplatesByDefault(templates: TemplateListItem[]) {
  const defaultTemplates = orderBuiltInTemplates(
    templates.filter((template) => template.is_default)
  );
  const customTemplates = templates.filter((template) => !template.is_default);
  return { defaultTemplates, customTemplates };
}

function filterTemplatesWithLayouts(templates: TemplateListItem[]) {
  return templates.filter(
    (template) => template.layout_count == null || template.layout_count > 0
  );
}

function deduplicateCloudTemplates(templates: TemplateListItem[]) {
  const seen = new Set<string>();
  return templates.filter((template) => {
    const normalizedName = template.name.trim().toLowerCase();
    const key = `${template.is_default ? "default" : "custom"}:${normalizedName}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function useTemplateSummaries({
  includeProcessingTemplateTasks = false,
  presentonCloudOnly = false,
}: {
  includeProcessingTemplateTasks?: boolean;
  presentonCloudOnly?: boolean;
} = {}) {
  const [templates, setTemplates] = useState<TemplateListItem[]>([]);
  const [processingTemplateTasks, setProcessingTemplateTasks] = useState<
    TemplateCreateTaskResponse[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let intervalId: ReturnType<typeof setInterval> | null = null;
    let hadProcessingTemplateTasks = false;

    const loadProcessingTemplateTasks = async () => {
      if (!includeProcessingTemplateTasks) {
        return [];
      }

      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      try {
        return await TemplateService.getProcessingTemplateCreateTasks(oneHourAgo);
      } catch (error) {
        console.error("Failed to load processing template tasks", error);
        return [];
      }
    };

    const loadTemplateSummaries = async () => {
      const [defaultResponse, customResponse] = await Promise.all([
        TemplateService.getTemplateSummaries(true, { presentonCloudOnly }),
        TemplateService.getTemplateSummaries(false, { presentonCloudOnly }),
      ]);
      const loadedTemplates = [
        ...filterTemplatesWithLayouts(defaultResponse.items ?? []),
        ...filterTemplatesWithLayouts(customResponse.items ?? []),
      ];
      return presentonCloudOnly
        ? deduplicateCloudTemplates(loadedTemplates)
        : loadedTemplates;
    };

    const loadInitialTemplates = async () => {
      setLoading(true);
      setError(null);
      try {
        const [loadedTemplates, processingTasks] = await Promise.all([
          loadTemplateSummaries(),
          loadProcessingTemplateTasks(),
        ]);
        if (!cancelled) {
          const nextProcessingTasks = processingTasks ?? [];
          hadProcessingTemplateTasks = nextProcessingTasks.length > 0;
          setTemplates(loadedTemplates);
          setProcessingTemplateTasks(nextProcessingTasks);
        }
      } catch (error) {
        console.error("Failed to load templates", error);
        if (!cancelled) {
          const message =
            error instanceof Error
              ? error.message
              : "The template service could not be reached. Please try again.";
          setError(message);
          toast.error("Could not load templates", { description: message });
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadInitialTemplates();
    if (includeProcessingTemplateTasks) {
      intervalId = setInterval(() => {
        loadProcessingTemplateTasks().then((processingTasks) => {
          if (!cancelled) {
            const nextProcessingTasks = processingTasks ?? [];
            const shouldRefreshTemplates =
              hadProcessingTemplateTasks || nextProcessingTasks.length > 0;
            hadProcessingTemplateTasks = nextProcessingTasks.length > 0;
            setProcessingTemplateTasks(nextProcessingTasks);

            if (shouldRefreshTemplates) {
              loadTemplateSummaries()
                .then((loadedTemplates) => {
                  if (!cancelled) {
                    setTemplates(loadedTemplates);
                  }
                })
                .catch((error) => {
                  console.error("Failed to refresh templates", error);
                });
            }
          }
        });
      }, 30000);
    }

    return () => {
      cancelled = true;
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [includeProcessingTemplateTasks, presentonCloudOnly]);

  const { defaultTemplates, customTemplates } = useMemo(
    () => splitTemplatesByDefault(templates),
    [templates]
  );

  return {
    templates,
    defaultTemplates,
    customTemplates,
    processingTemplateTasks,
    loading,
    error,
  };
}
