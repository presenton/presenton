import { useCallback, useState } from "react";
import type { TextRun } from "@/components/slide-editor/types";
import type { TemplateV2InlineEdit } from "@/components/slide-editor/text/template-v2-text-editing";
import {
  textRunsContent,
  type TextSelectionRange,
} from "@/components/slide-editor/text/text-runs";

export function useTemplateV2InlineEditing<Selection>({
  keyForSelection,
}: {
  keyForSelection: (selection: Selection) => string;
}) {
  const [inlineEdit, setInlineEdit] =
    useState<TemplateV2InlineEdit<Selection>>(null);

  const clearInlineEdit = useCallback(() => {
    setInlineEdit(null);
  }, []);

  const startInlineEdit = useCallback(
    (nextInlineEdit: NonNullable<TemplateV2InlineEdit<Selection>>) => {
      setInlineEdit(nextInlineEdit);
    },
    [],
  );

  const updateInlineDraft = useCallback((draft: string) => {
    setInlineEdit((current) => (current ? { ...current, draft } : current));
  }, []);

  const updateInlineRuns = useCallback(
    (selection: Selection, runs: TextRun[]) => {
      setInlineEdit((current) =>
        current &&
        (current.kind === "text" || current.kind === "text-list") &&
        keyForSelection(current.selection) === keyForSelection(selection)
          ? { ...current, draft: textRunsContent(runs), runs }
          : current,
      );
    },
    [keyForSelection],
  );

  const updateInlineTextSelectionRange = useCallback(
    (selection: Selection, textSelectionRange: TextSelectionRange | null) => {
      setInlineEdit((current) =>
        current &&
        (current.kind === "text" || current.kind === "text-list") &&
        keyForSelection(current.selection) === keyForSelection(selection)
          ? { ...current, textSelectionRange }
          : current,
      );
    },
    [keyForSelection],
  );

  const updateInlineEdit = useCallback(
    (
      selection: Selection,
      updater: (
        current: NonNullable<TemplateV2InlineEdit<Selection>>,
      ) => NonNullable<TemplateV2InlineEdit<Selection>>,
    ) => {
      setInlineEdit((current) =>
        current && keyForSelection(current.selection) === keyForSelection(selection)
          ? updater(current)
          : current,
      );
    },
    [keyForSelection],
  );

  return {
    inlineEdit,
    clearInlineEdit,
    startInlineEdit,
    updateInlineDraft,
    updateInlineEdit,
    updateInlineRuns,
    updateInlineTextSelectionRange,
  };
}
