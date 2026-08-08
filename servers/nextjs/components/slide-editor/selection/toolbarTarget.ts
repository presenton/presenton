import {
  isTemplateV2GroupElement,
  isTemplateV2LayoutElement,
  type TemplateV2ToolbarElement,
} from "@/components/slide-editor/layout/LayoutToolbar";
import {
  isTemplateV2InfographicToolbarElement,
  type TemplateV2InfographicToolbarElement,
} from "@/components/slide-editor/layout/InfographicToolbarControls";
import { findFirstComponentLayoutElement } from "@/components/slide-editor/layout/layoutToolbarTarget";
import { rawChartToEditorChart } from "@/components/slide-editor/model/chart-model";
import { rawElementForEditorToolbar } from "@/components/slide-editor/model/model";
import type {
  ChartSlideElement,
  TableSlideElement,
} from "@/components/slide-editor/state/state";
import type { SlideElement } from "@/components/slide-editor/types";
import type {
  TemplateV2ToolbarBox,
  TemplateV2ToolbarElementSelection,
  TemplateV2ToolbarSelection,
} from "@/components/slide-editor/selection/toolbarTypes";

type RawRecord = Record<string, unknown>;

export type TemplateV2SelectionToolbarTarget = {
  selection: TemplateV2ToolbarElementSelection;
  element: TemplateV2ToolbarElement;
  box: TemplateV2ToolbarBox;
};

export type TemplateV2ChartSelectionToolbarTarget = {
  selection: TemplateV2ToolbarElementSelection;
  element: ChartSlideElement;
  box: TemplateV2ToolbarBox;
};

export type TemplateV2TableSelectionToolbarTarget = {
  selection: TemplateV2ToolbarElementSelection;
  element: TableSlideElement;
  box: TemplateV2ToolbarBox;
};

export type TemplateV2EditorSelectionToolbarTarget = {
  selection: TemplateV2ToolbarElementSelection;
  element: SlideElement;
  box: TemplateV2ToolbarBox;
};

type SelectionToolbarTargetOptions = {
  selection: TemplateV2ToolbarSelection;
  selectedBox: TemplateV2ToolbarBox | null;
  selectedComponent: RawRecord | null;
  selectedElement: RawRecord | null;
  absoluteBoxForSelection: (
    selection: TemplateV2ToolbarSelection,
  ) => TemplateV2ToolbarBox | null;
};

export function getTemplateV2SelectionToolbarTarget({
  selection,
  selectedBox,
  selectedComponent,
  selectedElement,
  absoluteBoxForSelection,
}: SelectionToolbarTargetOptions): TemplateV2SelectionToolbarTarget | null {
  if (
    selection?.kind === "element" &&
    selectedElement &&
    selectedBox &&
    (isTemplateV2LayoutElement(selectedElement) ||
      isTemplateV2GroupElement(selectedElement) ||
      isTemplateV2InfographicToolbarElement(selectedElement))
  ) {
    return {
      selection,
      element: selectedElement as TemplateV2ToolbarElement,
      box: selectedBox,
    };
  }

  if (selection?.kind !== "component" || !selectedComponent) return null;

  const componentElements = readArray(selectedComponent.elements);
  const toolbarRoot =
    findFirstComponentLayoutElement(componentElements) ??
    findFirstComponentInfographicElement(componentElements);
  if (!toolbarRoot) return null;

  const elementSelection: TemplateV2ToolbarElementSelection = {
    kind: "element",
    componentIndex: selection.componentIndex,
    elementPath: toolbarRoot.elementPath,
  };
  const box = absoluteBoxForSelection(elementSelection);
  return box
    ? { selection: elementSelection, element: toolbarRoot.element, box }
    : null;
}

export function getTemplateV2SelectionChartToolbarTarget({
  selection,
  selectedBox,
  selectedComponent,
  selectedElement,
  absoluteBoxForSelection,
}: SelectionToolbarTargetOptions): TemplateV2ChartSelectionToolbarTarget | null {
  if (
    selection?.kind === "element" &&
    selectedElement &&
    selectedBox &&
    isTemplateV2ChartElement(selectedElement)
  ) {
    return {
      selection,
      element: chartToolbarElement(selectedElement, selectedBox),
      box: selectedBox,
    };
  }

  if (selection?.kind !== "component" || !selectedComponent) return null;

  const chartRoot = findFirstComponentChartElement(
    readArray(selectedComponent.elements),
  );
  if (!chartRoot) return null;

  const elementSelection: TemplateV2ToolbarElementSelection = {
    kind: "element",
    componentIndex: selection.componentIndex,
    elementPath: chartRoot.elementPath,
  };
  const box = absoluteBoxForSelection(elementSelection);
  return box
    ? {
        selection: elementSelection,
        element: chartToolbarElement(chartRoot.element, box),
        box,
      }
    : null;
}

export function getTemplateV2SelectionTableToolbarTarget({
  selection,
  selectedBox,
  selectedComponent,
  selectedElement,
  absoluteBoxForSelection,
}: SelectionToolbarTargetOptions): TemplateV2TableSelectionToolbarTarget | null {
  if (
    selection?.kind === "element" &&
    selectedElement &&
    selectedBox &&
    isTemplateV2TableElement(selectedElement)
  ) {
    return {
      selection,
      element: tableToolbarElement(selectedElement, selectedBox),
      box: selectedBox,
    };
  }

  if (selection?.kind !== "component" || !selectedComponent) return null;

  const tableRoot = findFirstComponentTableElement(
    readArray(selectedComponent.elements),
  );
  if (!tableRoot) return null;

  const elementSelection: TemplateV2ToolbarElementSelection = {
    kind: "element",
    componentIndex: selection.componentIndex,
    elementPath: tableRoot.elementPath,
  };
  const box = absoluteBoxForSelection(elementSelection);
  return box
    ? {
        selection: elementSelection,
        element: tableToolbarElement(tableRoot.element, box),
        box,
      }
    : null;
}

export function getTemplateV2SelectionEditorToolbarTarget({
  selection,
  selectedComponent,
  absoluteBoxForSelection,
}: SelectionToolbarTargetOptions): TemplateV2EditorSelectionToolbarTarget | null {
  if (selection?.kind !== "component" || !selectedComponent) return null;

  const elements = readArray(selectedComponent.elements);
  if (elements.length !== 1) return null;

  const editorElement = asRecord(elements[0]);
  if (!isTemplateV2EditorToolbarElement(editorElement)) return null;

  const elementSelection: TemplateV2ToolbarElementSelection = {
    kind: "element",
    componentIndex: selection.componentIndex,
    elementPath: [0],
  };
  const box = absoluteBoxForSelection(elementSelection);
  const toolbarElement = box
    ? rawElementForEditorToolbar(editorElement, box)
    : null;
  return box && toolbarElement
    ? { selection: elementSelection, element: toolbarElement, box }
    : null;
}

function readArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asRecord(value: unknown): RawRecord | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as RawRecord)
    : null;
}

function childElements(element: RawRecord): unknown[] {
  if (Array.isArray(element.children)) return element.children;
  if (Array.isArray(element.elements)) return element.elements;
  if (asRecord(element.child)) return [element.child];
  if (asRecord(element.item)) return [element.item];
  return [];
}

function isTemplateV2ChartElement(
  element: RawRecord | null | undefined,
): element is RawRecord {
  return element?.type === "chart";
}

function isTemplateV2TableElement(
  element: RawRecord | null | undefined,
): element is RawRecord {
  return element?.type === "table";
}

function isTemplateV2EditorToolbarElement(
  element: RawRecord | null | undefined,
): element is RawRecord {
  return (
    element?.type === "text" ||
    element?.type === "math" ||
    element?.type === "text-list" ||
    element?.type === "vector" ||
    (element?.type === "image" && element.is_icon === true)
  );
}

function chartToolbarElement(
  element: RawRecord,
  box: TemplateV2ToolbarBox,
): ChartSlideElement {
  return {
    ...rawChartToEditorChart(element),
    position: {
      x: box.x,
      y: box.y,
    },
    size: {
      width: box.width,
      height: box.height,
    },
  };
}

function tableToolbarElement(
  element: RawRecord,
  box: TemplateV2ToolbarBox,
): TableSlideElement {
  return {
    ...element,
    type: "table",
    position: {
      x: box.x,
      y: box.y,
    },
    size: {
      width: box.width,
      height: box.height,
    },
    columns: readArray(element.columns) as TableSlideElement["columns"],
    rows: readArray(element.rows).map((row) => readArray(row)) as
      TableSlideElement["rows"],
  };
}

function findFirstComponentChartElement(
  elements: unknown[],
  parentPath: number[] = [],
): { element: RawRecord; elementPath: number[] } | null {
  for (let index = 0; index < elements.length; index += 1) {
    const element = asRecord(elements[index]);
    if (!element) continue;
    const elementPath = [...parentPath, index];
    if (isTemplateV2ChartElement(element)) {
      return { element, elementPath };
    }
    const nested = findFirstComponentChartElement(
      childElements(element),
      elementPath,
    );
    if (nested) return nested;
  }
  return null;
}

function findFirstComponentTableElement(
  elements: unknown[],
  parentPath: number[] = [],
): { element: RawRecord; elementPath: number[] } | null {
  for (let index = 0; index < elements.length; index += 1) {
    const element = asRecord(elements[index]);
    if (!element) continue;
    const elementPath = [...parentPath, index];
    if (isTemplateV2TableElement(element)) {
      return { element, elementPath };
    }
    const nested = findFirstComponentTableElement(
      childElements(element),
      elementPath,
    );
    if (nested) return nested;
  }
  return null;
}

function findFirstComponentInfographicElement(
  elements: unknown[],
  parentPath: number[] = [],
): {
  element: TemplateV2InfographicToolbarElement;
  elementPath: number[];
} | null {
  for (let index = 0; index < elements.length; index += 1) {
    const element = asRecord(elements[index]);
    if (!element) continue;
    const elementPath = [...parentPath, index];
    if (isTemplateV2InfographicToolbarElement(element)) {
      return { element, elementPath };
    }
    const nested = findFirstComponentInfographicElement(
      childElements(element),
      elementPath,
    );
    if (nested) return nested;
  }
  return null;
}
