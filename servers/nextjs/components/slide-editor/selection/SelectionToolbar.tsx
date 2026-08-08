"use client";

import {
  TemplateV2LayoutToolbar,
  type TemplateV2SelectionComponentActions,
} from "@/components/slide-editor/layout/LayoutToolbar";
import type { ComponentLayerAction } from "@/components/slide-editor/selection/layering";
import type {
  TemplateV2ChartSelectionToolbarTarget,
  TemplateV2EditorSelectionToolbarTarget,
  TemplateV2SelectionToolbarTarget,
  TemplateV2TableSelectionToolbarTarget,
} from "@/components/slide-editor/selection/toolbarTarget";
import type {
  TemplateV2ToolbarBox,
  TemplateV2ToolbarSelection,
} from "@/components/slide-editor/selection/toolbarTypes";
import type { TemplateV2ToolbarViewportBounds } from "@/components/slide-editor/selection/toolbarPosition";
import type {
  ChartSlideElement,
  TableCellSelection,
  TableSlideElement,
} from "@/components/slide-editor/state/state";
import type { TemplateFontOption } from "@/components/slide-editor/text/google-fonts";
import { ElementToolbar } from "@/components/slide-editor/toolbar/ElementToolbar";
import type { SlideElement } from "@/components/slide-editor/types";
import { TemplateV2MultiSelectionToolbar } from "@/components/slide-editor/selection/MultiSelectionToolbar";

type TemplateV2SelectionToolbarProps = {
  anchorBox: TemplateV2ToolbarBox | null;
  canUngroupComponent: boolean;
  canUngroupLayoutTarget: boolean;
  chartTarget: TemplateV2ChartSelectionToolbarTarget | null;
  componentCount: number;
  editorTarget: TemplateV2EditorSelectionToolbarTarget | null;
  isEditMode: boolean;
  layoutTarget: TemplateV2SelectionToolbarTarget | null;
  position: { left: number; top: number } | null;
  selectedTableCell: TableCellSelection | null;
  selection: TemplateV2ToolbarSelection;
  selectionKey: string;
  tableTarget: TemplateV2TableSelectionToolbarTarget | null;
  targetComponentActions: TemplateV2SelectionComponentActions | null;
  templateFonts?: TemplateFontOption[];
  toolbarBounds: TemplateV2ToolbarViewportBounds | null;
  onChartChange: (element: ChartSlideElement) => void;
  onChartEdit: () => void;
  onEditorChange: (element: SlideElement) => void;
  onImageCropModeChange: (active: boolean) => void;
  onIconEdit: () => void;
  onDeleteSelection: () => void;
  onDuplicateSelection: () => void;
  onLayoutChange: (changes: Record<string, unknown>) => void;
  onLayerAction: (action: ComponentLayerAction) => void;
  onGroupSelection: () => void;
  onTableChange: (element: TableSlideElement) => void;
  onUngroupComponent: () => void;
  onUngroupLayoutTarget: () => void;
};

export function TemplateV2SelectionToolbar({
  anchorBox,
  canUngroupComponent,
  canUngroupLayoutTarget,
  chartTarget,
  componentCount,
  editorTarget,
  isEditMode,
  layoutTarget,
  position,
  selectedTableCell,
  selection,
  selectionKey,
  tableTarget,
  targetComponentActions,
  templateFonts,
  toolbarBounds,
  onChartChange,
  onChartEdit,
  onEditorChange,
  onImageCropModeChange,
  onIconEdit,
  onDeleteSelection,
  onDuplicateSelection,
  onLayoutChange,
  onLayerAction,
  onGroupSelection,
  onTableChange,
  onUngroupComponent,
  onUngroupLayoutTarget,
}: TemplateV2SelectionToolbarProps) {
  if (!isEditMode || !anchorBox) return null;
  if (selection?.kind === "multi-component") {
    return (
      <TemplateV2MultiSelectionToolbar
        count={selection.componentIndexes.length}
        position={position}
        onGroup={onGroupSelection}
      />
    );
  }

  const componentActions =
    selection?.kind === "component"
      ? {
          canUngroup: canUngroupComponent,
          componentCount,
          componentIndex: selection.componentIndex,
          onDelete: onDeleteSelection,
          onDuplicate: onDuplicateSelection,
          onLayerAction,
          onUngroup: onUngroupComponent,
      }
      : targetComponentActions;

  if (editorTarget && componentActions) {
    return (
      <ElementToolbar
        element={editorTarget.element}
        index={editorTarget.selection.componentIndex}
        anchorBox={anchorBox}
        path={selectionKey}
        scale={1}
        componentActions={componentActions}
        selectedTableCell={null}
        templateFonts={templateFonts}
        onChange={(_index, element) => onEditorChange(element)}
        onImageCropModeChange={onImageCropModeChange}
        onEditIcon={onIconEdit}
        onEditImage={() => undefined}
      />
    );
  }

  return (
    <TemplateV2LayoutToolbar
      key={selectionKey}
      box={anchorBox}
      element={
        layoutTarget?.element ??
        chartTarget?.element ??
        tableTarget?.element ??
        null
      }
      position={position ?? undefined}
      bounds={toolbarBounds}
      componentActions={componentActions}
      onChartChange={chartTarget ? onChartChange : undefined}
      onChartEdit={chartTarget ? onChartEdit : undefined}
      onChange={layoutTarget ? onLayoutChange : undefined}
      onTableChange={tableTarget ? onTableChange : undefined}
      selectedTableCell={selectedTableCell}
      ungroupAction={
        canUngroupLayoutTarget
          ? {
              canUngroup: true,
              onUngroup: onUngroupLayoutTarget,
            }
          : null
      }
    />
  );
}
