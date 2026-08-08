type RawRecord = Record<string, unknown>;

export type TemplateV2GroupBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type GroupDeps = {
  componentBox: (component: RawRecord) => TemplateV2GroupBox;
};

type GroupEntry = {
  component: RawRecord;
  componentIndex: number;
  box: TemplateV2GroupBox;
};

type TemplateV2GroupShortcutEvent = Pick<
  KeyboardEvent,
  "altKey" | "code" | "ctrlKey" | "key" | "metaKey" | "shiftKey"
>;

export type TemplateV2GroupSelection = {
  kind: "component";
  componentIndex: number;
};

export function isTemplateV2GroupShortcut(
  event: TemplateV2GroupShortcutEvent,
) {
  if (
    !(event.metaKey || event.ctrlKey) ||
    event.altKey ||
    event.shiftKey
  ) {
    return false;
  }
  return event.code === "KeyG" || event.key.toLowerCase() === "g";
}

export function groupTemplateV2ComponentsInUi<TUi extends RawRecord>(
  sourceUi: TUi,
  componentIndexes: number[],
  deps: GroupDeps,
): { ui: TUi; selection: TemplateV2GroupSelection } | null {
  const sourceComponents = readArray(sourceUi.components);
  const entries = normalizedGroupEntries(
    sourceComponents,
    componentIndexes,
    deps,
  );
  if (entries.length < 2) return null;

  const groupBox = boxContainingBoxes(
    entries.map(({ box, component }) =>
      rotatedBox(box, readNumber(component.rotation) ?? 0),
    ),
  );
  const groupId = uniqueComponentId("group", sourceComponents);
  const groupedComponent = {
    id: groupId,
    description: "Grouped components",
    position: { x: groupBox.x, y: groupBox.y },
    elements: [
      {
        type: "group",
        name: groupId,
        position: { x: 0, y: 0 },
        size: { width: groupBox.width, height: groupBox.height },
        children: entries.map((entry) =>
          componentGroupElement(entry, groupBox),
        ),
        __presenton_manual_position: true,
      },
    ],
  };

  const groupedIndexSet = new Set(
    entries.map(({ componentIndex }) => componentIndex),
  );
  const highestGroupedIndex = entries[entries.length - 1]?.componentIndex ?? 0;
  const components = sourceComponents.filter(
    (_component, componentIndex) => !groupedIndexSet.has(componentIndex),
  );
  // Keep the group in the layer slot occupied by the frontmost selected item.
  const insertionIndex = sourceComponents
    .slice(0, highestGroupedIndex + 1)
    .filter((_component, componentIndex) => !groupedIndexSet.has(componentIndex))
    .length;
  components.splice(insertionIndex, 0, groupedComponent);

  return {
    ui: {
      ...sourceUi,
      components,
    } as TUi,
    selection: {
      kind: "component",
      componentIndex: insertionIndex,
    },
  };
}

function normalizedGroupEntries(
  components: unknown[],
  componentIndexes: number[],
  deps: GroupDeps,
): GroupEntry[] {
  return Array.from(
    new Set(
      componentIndexes.filter(
        (componentIndex) =>
          Number.isInteger(componentIndex) &&
          componentIndex >= 0 &&
          componentIndex < components.length,
      ),
    ),
  )
    .sort((a, b) => a - b)
    .flatMap((componentIndex) => {
      const component = asRecord(components[componentIndex]);
      return component
        ? [
            {
              component,
              componentIndex,
              box: deps.componentBox(component),
            },
          ]
        : [];
    });
}

function componentGroupElement(
  { box, component, componentIndex }: GroupEntry,
  groupBox: TemplateV2GroupBox,
): RawRecord {
  const componentId =
    readString(component.id) ??
    readString(component.name) ??
    `component_${componentIndex + 1}`;
  const description = readString(component.description);
  const rotation = readNumber(component.rotation) ?? 0;
  const designVariables = readArray(component.design_variables);

  return {
    type: "group",
    name: componentId,
    position: {
      x: box.x - groupBox.x,
      y: box.y - groupBox.y,
    },
    size: { width: box.width, height: box.height },
    ...(rotation !== 0 ? { rotation } : {}),
    children: cloneJson(readArray(component.elements)),
    component_id: componentId,
    component_instance_id: `${componentId}:${componentIndex}`,
    ...(description ? { component_description: description } : {}),
    ...(designVariables.length > 0
      ? { design_variables: cloneJson(designVariables) }
      : {}),
    __presenton_manual_position: true,
  };
}

function rotatedBox(
  box: TemplateV2GroupBox,
  rotation: number,
): TemplateV2GroupBox {
  if (rotation % 360 === 0) return box;

  const radians = (rotation * Math.PI) / 180;
  const sin = Math.abs(Math.sin(radians));
  const cos = Math.abs(Math.cos(radians));
  const width = Math.max(1, box.width * cos + box.height * sin);
  const height = Math.max(1, box.width * sin + box.height * cos);
  const centerX = box.x + box.width / 2;
  const centerY = box.y + box.height / 2;

  return {
    x: centerX - width / 2,
    y: centerY - height / 2,
    width,
    height,
  };
}

function boxContainingBoxes(boxes: TemplateV2GroupBox[]) {
  const minX = Math.min(...boxes.map((box) => box.x));
  const minY = Math.min(...boxes.map((box) => box.y));
  const maxX = Math.max(...boxes.map((box) => box.x + box.width));
  const maxY = Math.max(...boxes.map((box) => box.y + box.height));
  return {
    x: minX,
    y: minY,
    width: Math.max(1, maxX - minX),
    height: Math.max(1, maxY - minY),
  };
}

function uniqueComponentId(base: string, components: unknown[]) {
  const existingIds = new Set(
    components
      .map((component) => readString(asRecord(component)?.id))
      .filter((id): id is string => Boolean(id)),
  );
  if (!existingIds.has(base)) return base;

  let suffix = 2;
  while (existingIds.has(`${base}_${suffix}`)) {
    suffix += 1;
  }
  return `${base}_${suffix}`;
}

function readArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asRecord(value: unknown): RawRecord | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as RawRecord)
    : null;
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
