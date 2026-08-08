type RawRecord = Record<string, unknown>;

export type LayoutItemStats = {
  canAdd: boolean;
  canRemove: boolean;
  children: unknown[];
};

export function layoutItemStats(element: RawRecord): LayoutItemStats {
  const { items: children } = layoutItemArrayInfo(element);
  return {
    canAdd: true,
    canRemove: children.length > 0,
    children,
  };
}

export function addLayoutItemChanges(element: RawRecord): RawRecord {
  const { key, items: children } = layoutItemArrayInfo(element);
  const nextChildren = [
    ...children,
    cloneChildForAppend(
      children[children.length - 1] ?? defaultLayoutItem(),
      children.length,
    ),
  ];
  return childCountChanges(element, key, nextChildren);
}

export function removeLastLayoutItemChanges(element: RawRecord): RawRecord | null {
  const { key, items: children } = layoutItemArrayInfo(element);
  if (children.length === 0) return null;
  return childCountChanges(element, key, children.slice(0, -1));
}

function childCountChanges(
  element: RawRecord,
  key: "children" | "elements",
  children: unknown[],
): RawRecord {
  return {
    [key]: children,
    max_children: Math.max(
      children.length,
      readNumber(element.max_children) ?? children.length,
    ),
    min_children: Math.min(
      Math.max(0, readNumber(element.min_children) ?? 0),
      children.length,
    ),
  };
}

function layoutItemArrayInfo(element: RawRecord): {
  key: "children" | "elements";
  items: unknown[];
} {
  if (Array.isArray(element.children)) {
    return { key: "children", items: element.children };
  }
  if (Array.isArray(element.elements)) {
    return { key: "elements", items: element.elements };
  }
  return { key: "children", items: [] };
}

function cloneChildForAppend(child: unknown, index: number) {
  const cloned =
    child && typeof child === "object"
      ? JSON.parse(JSON.stringify(child))
      : child;
  if (!cloned || typeof cloned !== "object" || Array.isArray(cloned)) {
    return cloned;
  }
  const next = { ...(cloned as RawRecord) };
  delete next.id;
  delete next.__presenton_manual_position;
  if (typeof next.name === "string") {
    next.name = `${next.name}_copy_${index + 1}`;
  }
  return next;
}

function defaultLayoutItem(): RawRecord {
  return {
    type: "text",
    position: { x: 0, y: 0 },
    size: { width: 1, height: 1 },
    runs: [{ text: "New item" }],
    font: {
      family: "Arial",
      size: 18,
      color: "#1A1A1A",
    },
  };
}

function readNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
