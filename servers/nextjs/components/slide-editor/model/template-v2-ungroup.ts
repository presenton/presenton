type RawRecord = Record<string, any>;

export type TemplateV2UngroupBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type ChildArrayInfo = {
  items: unknown[];
};

type LaidOutChild = {
  child: RawRecord;
  box: TemplateV2UngroupBox | null;
};

type UngroupEntry = {
  element: RawRecord;
  box: TemplateV2UngroupBox;
  rotation: number;
  sourceBox: TemplateV2UngroupBox;
};

type UngroupDeps = {
  childArrayInfo: (element: RawRecord) => ChildArrayInfo | null;
  componentBox: (component: RawRecord) => TemplateV2UngroupBox;
  elementBox: (element: RawRecord) => TemplateV2UngroupBox;
  layoutChildren: (
    parent: RawRecord,
    children: unknown[],
    parentBox: TemplateV2UngroupBox,
  ) => LaidOutChild[];
};

export type TemplateV2UngroupSelection = {
  kind: "component";
  componentIndex: number;
} | null;

export function canUngroupTemplateV2Component(
  component: RawRecord | null | undefined,
) {
  if (!component) return false;
  const elements = readArray(component.elements).filter(isRecord);
  if (elements.length > 1) return true;
  return elements.some(hasUngroupableLayout);
}

export function ungroupTemplateV2ComponentInUi(
  sourceUi: RawRecord,
  componentIndex: number,
  deps: UngroupDeps,
): { ui: RawRecord; selection: TemplateV2UngroupSelection } | null {
  const components = [...readArray(sourceUi.components)];
  const component = asRecord(components[componentIndex]);
  if (!component || !canUngroupTemplateV2Component(component)) return null;

  const ungroupedComponents = ungroupedComponentsFromComponent(
    component,
    componentIndex,
    deps,
  );
  if (ungroupedComponents.length === 0) return null;

  components.splice(componentIndex, 1, ...ungroupedComponents);
  return {
    ui: {
      ...sourceUi,
      components,
    },
    selection: null,
  };
}

function ungroupedComponentsFromComponent(
  component: RawRecord,
  componentIndex: number,
  deps: UngroupDeps,
): RawRecord[] {
  const componentBoxValue = deps.componentBox(component);
  const componentRotation = readNumber(component.rotation) ?? 0;
  const idBase = normalizeId(
    readString(component.id) ??
      readString(component.name) ??
      readString(component.description) ??
      `component_${componentIndex + 1}`,
  );
  const elements = readArray(component.elements).filter(isRecord);
  const entries =
    elements.length === 1
      ? ungroupElementOneLevel(
          elements[0],
          absoluteElementEntry(elements[0], componentBoxValue, deps).box,
          deps,
        )
      : elements.map((element) =>
          absoluteElementEntry(element, componentBoxValue, deps),
        );

  return entries.map((entry, index) =>
    ungroupedComponent(entry, idBase, index, componentBoxValue, componentRotation),
  );
}

function absoluteElementEntry(
  element: RawRecord,
  componentBoxValue: TemplateV2UngroupBox,
  deps: UngroupDeps,
): UngroupEntry {
  const box = deps.elementBox(element);
  return {
    element,
    sourceBox: box,
    rotation: 0,
    box: {
      x: componentBoxValue.x + box.x,
      y: componentBoxValue.y + box.y,
      width: box.width,
      height: box.height,
    },
  };
}

function ungroupElementOneLevel(
  element: RawRecord,
  box: TemplateV2UngroupBox,
  deps: UngroupDeps,
): UngroupEntry[] {
  const childInfo = deps.childArrayInfo(element);
  if (!childInfo) return [];
  const elementRotation = readNumber(element.rotation) ?? 0;

  return deps
    .layoutChildren(
      element,
      childInfo.items,
      { x: 0, y: 0, width: box.width, height: box.height },
    )
    .map((item) => {
      const childBox = item.box ?? deps.elementBox(item.child);
      const unrotatedBox = {
        x: box.x + childBox.x,
        y: box.y + childBox.y,
        width: childBox.width,
        height: childBox.height,
      };
      return {
        element: item.child,
        sourceBox: childBox,
        rotation: elementRotation,
        box: rotatedChildComponentBox(unrotatedBox, box, elementRotation),
      };
    });
}

function hasUngroupableLayout(element: RawRecord): boolean {
  const childInfo = childArrayInfoFromRecord(element);
  if (!childInfo) return false;
  const children = childInfo.items.filter(isRecord);
  if (isUngroupableLayoutType(readString(element.type)) && children.length > 0) {
    return true;
  }
  return children.some(hasUngroupableLayout);
}

function ungroupedComponent(
  entry: UngroupEntry,
  idBase: string,
  index: number,
  parentBox: TemplateV2UngroupBox,
  parentRotation: number,
): RawRecord {
  const { box, element, rotation, sourceBox } = entry;
  const position = rotatedChildComponentPosition(box, parentBox, parentRotation);
  const inheritedRotation = parentRotation + rotation;
  return {
    id: `${idBase}_part_${index + 1}`,
    description: "Ungrouped component element",
    position,
    ...(inheritedRotation !== 0 ? { rotation: inheritedRotation } : {}),
    elements: [ungroupedElement(element, sourceBox)],
  };
}

function rotatedChildComponentBox(
  box: TemplateV2UngroupBox,
  parentBox: TemplateV2UngroupBox,
  parentRotation: number,
): TemplateV2UngroupBox {
  return {
    ...box,
    ...rotatedChildComponentPosition(box, parentBox, parentRotation),
  };
}

function rotatedChildComponentPosition(
  box: TemplateV2UngroupBox,
  parentBox: TemplateV2UngroupBox,
  parentRotation: number,
) {
  if (parentRotation === 0) return { x: box.x, y: box.y };

  const radians = (parentRotation * Math.PI) / 180;
  const sin = Math.sin(radians);
  const cos = Math.cos(radians);
  const parentCenter = {
    x: parentBox.x + parentBox.width / 2,
    y: parentBox.y + parentBox.height / 2,
  };
  const childCenter = {
    x: box.x + box.width / 2,
    y: box.y + box.height / 2,
  };
  const dx = childCenter.x - parentCenter.x;
  const dy = childCenter.y - parentCenter.y;
  const rotatedCenter = {
    x: parentCenter.x + dx * cos - dy * sin,
    y: parentCenter.y + dx * sin + dy * cos,
  };
  return {
    x: rotatedCenter.x - box.width / 2,
    y: rotatedCenter.y - box.height / 2,
  };
}

function ungroupedElement(
  element: RawRecord,
  sourceBox: TemplateV2UngroupBox,
) {
  const cloned = cloneJson(element);
  return {
    ...cloned,
    ...(readString(cloned.type) === "vector"
      ? { points: translatePointArray(cloned.points, -sourceBox.x, -sourceBox.y) }
      : {}),
    position: { x: 0, y: 0 },
    size: { width: sourceBox.width, height: sourceBox.height },
    __presenton_manual_position: true,
  };
}

function translatePointArray(value: unknown, deltaX: number, deltaY: number) {
  return readArray(value).map((item) => {
    const point = asRecord(item);
    const x = readNumber(point?.x);
    const y = readNumber(point?.y);
    if (x == null || y == null) return item;
    return { ...point, x: x + deltaX, y: y + deltaY };
  });
}

function childArrayInfoFromRecord(element: RawRecord): ChildArrayInfo | null {
  if (Array.isArray(element.children)) return { items: element.children };
  if (Array.isArray(element.elements)) return { items: element.elements };
  if (asRecord(element.child)) return { items: [element.child] };
  return null;
}

function isFlowLayoutType(type: string | null) {
  return (
    type === "flex" ||
    type === "grid" ||
    type === "list-view" ||
    type === "grid-view"
  );
}

function isUngroupableLayoutType(type: string | null) {
  return isFlowLayoutType(type) || type === "group";
}

function readArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asRecord(value: unknown): RawRecord | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as RawRecord)
    : null;
}

function isRecord(value: unknown): value is RawRecord {
  return Boolean(asRecord(value));
}

function readString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function readNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function normalizeId(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") || "component";
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
