import {
  isTemplateV2FlowLayoutElement,
  isTemplateV2LayoutElement,
  type TemplateV2LayoutElement,
} from "@/components/slide-editor/layout/LayoutToolbar";

type RawRecord = Record<string, unknown>;

export type ComponentLayoutElementTarget = {
  element: TemplateV2LayoutElement;
  elementPath: number[];
};

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

export function findFirstComponentLayoutElement(
  elements: unknown[],
  parentPath: number[] = [],
): ComponentLayoutElementTarget | null {
  return (
    findFirstComponentLayoutElementBy(
      elements,
      parentPath,
      isTemplateV2FlowLayoutElement,
    ) ??
    findFirstComponentLayoutElementBy(
      elements,
      parentPath,
      isTemplateV2LayoutElement,
    )
  );
}

function findFirstComponentLayoutElementBy(
  elements: unknown[],
  parentPath: number[],
  predicate: (element: RawRecord) => element is TemplateV2LayoutElement,
): ComponentLayoutElementTarget | null {
  for (let index = 0; index < elements.length; index += 1) {
    const element = asRecord(elements[index]);
    if (!element) continue;
    const elementPath = [...parentPath, index];
    if (predicate(element)) {
      return { element, elementPath };
    }
    const nested = findFirstComponentLayoutElementBy(
      childElements(element),
      elementPath,
      predicate,
    );
    if (nested) return nested;
  }
  return null;
}
