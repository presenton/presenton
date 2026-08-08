import type {
  TemplateV2ChartSelectionToolbarTarget,
  TemplateV2SelectionToolbarTarget,
  TemplateV2TableSelectionToolbarTarget,
} from "@/components/slide-editor/selection/toolbarTarget";
import type {
  TemplateV2ToolbarBox,
  TemplateV2ToolbarSelection,
} from "@/components/slide-editor/selection/toolbarTypes";

type Size = {
  width: number;
  height: number;
};

type Bounds = Size & {
  x?: number;
  y?: number;
};

export type TemplateV2ToolbarViewportBounds = {
  bottom: number;
  left: number;
  right: number;
  top: number;
};

const STAGE_WIDTH = 1280;
const STAGE_HEIGHT = 720;
const COMPACT_SELECTION_TOOLBAR_WIDTH = 420;
const MULTI_SELECTION_TOOLBAR_WIDTH = 300;
const CONTAINER_SELECTION_TOOLBAR_WIDTH = 760;
const INFOGRAPHIC_SELECTION_TOOLBAR_WIDTH = 470;
const TOOLBAR_HEIGHT = 40;
const TOOLBAR_GAP = 8;
const TOOLBAR_MARGIN = 8;

export function getTemplateV2SelectionToolbarAnchorBox({
  chartTarget,
  layoutTarget,
  selectedBox,
  selection,
  tableTarget,
}: {
  chartTarget?: TemplateV2ChartSelectionToolbarTarget | null;
  layoutTarget: TemplateV2SelectionToolbarTarget | null;
  selectedBox: TemplateV2ToolbarBox | null;
  selection: TemplateV2ToolbarSelection;
  tableTarget?: TemplateV2TableSelectionToolbarTarget | null;
}) {
  return selection?.kind === "component" ||
    selection?.kind === "multi-component"
    ? selectedBox
    : layoutTarget?.box ?? chartTarget?.box ?? tableTarget?.box ?? null;
}

export function hasTemplateV2SelectionToolbar({
  anchorBox,
  chartTarget,
  isEditMode,
  layoutTarget,
  selection,
  tableTarget,
}: {
  anchorBox: TemplateV2ToolbarBox | null;
  chartTarget?: TemplateV2ChartSelectionToolbarTarget | null;
  isEditMode: boolean;
  layoutTarget: TemplateV2SelectionToolbarTarget | null;
  selection: TemplateV2ToolbarSelection;
  tableTarget?: TemplateV2TableSelectionToolbarTarget | null;
}) {
  return Boolean(
    isEditMode &&
      anchorBox &&
      (selection?.kind === "component" ||
        selection?.kind === "multi-component" ||
        layoutTarget ||
        chartTarget ||
        tableTarget),
  );
}

export function getTemplateV2SelectionToolbarPosition({
  anchorBox,
  layoutTarget,
  root,
  selection,
}: {
  anchorBox: TemplateV2ToolbarBox | null;
  chartTarget?: TemplateV2ChartSelectionToolbarTarget | null;
  layoutTarget: TemplateV2SelectionToolbarTarget | null;
  root: HTMLElement | null;
  selection?: TemplateV2ToolbarSelection;
  tableTarget?: TemplateV2TableSelectionToolbarTarget | null;
}) {
  if (!anchorBox) return null;
  return viewportToolbarPosition({
    root,
    anchorBox,
    toolbarWidth:
      selection?.kind === "multi-component"
        ? MULTI_SELECTION_TOOLBAR_WIDTH
        : toolbarWidthForTarget(layoutTarget),
  });
}

export function getTemplateV2SelectionToolbarBounds(
  root: HTMLElement | null,
): TemplateV2ToolbarViewportBounds | null {
  if (typeof window === "undefined" || !root) return null;
  const rect = root.getBoundingClientRect();
  return {
    bottom: rect.bottom,
    left: rect.left,
    right: rect.right,
    top: rect.top,
  };
}

function toolbarWidthForTarget(
  layoutTarget: TemplateV2SelectionToolbarTarget | null,
) {
  if (layoutTarget?.element.type === "container") {
    return CONTAINER_SELECTION_TOOLBAR_WIDTH;
  }
  if (layoutTarget?.element.type === "infographic") {
    return INFOGRAPHIC_SELECTION_TOOLBAR_WIDTH;
  }
  return COMPACT_SELECTION_TOOLBAR_WIDTH;
}

function toolbarPosition({
  anchorBox,
  bounds,
  toolbarWidth,
}: {
  anchorBox: TemplateV2ToolbarBox;
  bounds?: Bounds;
  toolbarWidth: number;
}) {
  const boundary = bounds ?? { width: STAGE_WIDTH, height: STAGE_HEIGHT };
  const boundaryX = boundary.x ?? 0;
  const boundaryY = boundary.y ?? 0;
  const minLeft = boundaryX + TOOLBAR_MARGIN;
  const maxLeft = Math.max(
    minLeft,
    boundaryX + boundary.width - toolbarWidth - TOOLBAR_MARGIN,
  );
  const minTop = boundaryY + TOOLBAR_MARGIN;
  const maxTop = Math.max(
    minTop,
    boundaryY + boundary.height - TOOLBAR_HEIGHT - TOOLBAR_MARGIN,
  );
  const canFitAbove =
    anchorBox.y - boundaryY >= TOOLBAR_HEIGHT + TOOLBAR_MARGIN;
  const top = canFitAbove
    ? anchorBox.y - TOOLBAR_HEIGHT - TOOLBAR_GAP
    : Math.min(
        maxTop,
        anchorBox.y + anchorBox.height + TOOLBAR_GAP,
      );
  return {
    left: Math.max(minLeft, Math.min(anchorBox.x, maxLeft)),
    top: Math.max(minTop, Math.min(top, maxTop)),
  };
}

function viewportToolbarPosition({
  anchorBox,
  root,
  toolbarWidth,
}: {
  anchorBox: TemplateV2ToolbarBox;
  root: HTMLElement | null;
  toolbarWidth: number;
}) {
  if (typeof window === "undefined" || !root) {
    return toolbarPosition({ anchorBox, toolbarWidth });
  }

  const rect = root.getBoundingClientRect();
  const scaleX = rect.width > 0 ? rect.width / STAGE_WIDTH : 1;
  const scaleY = rect.height > 0 ? rect.height / STAGE_HEIGHT : 1;
  return toolbarPosition({
    anchorBox: {
      x: rect.left + anchorBox.x * scaleX,
      y: rect.top + anchorBox.y * scaleY,
      width: anchorBox.width * scaleX,
      height: anchorBox.height * scaleY,
    },
    bounds: {
      x: rect.left,
      y: rect.top,
      width: rect.width,
      height: rect.height,
    },
    toolbarWidth,
  });
}
