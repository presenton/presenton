export type TemplateV2ClipboardRecord = Record<string, unknown>;

export type TemplateV2ClipboardBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type TemplateV2ClipboardSelection =
  | { kind: "component"; componentIndex: number }
  | { kind: "multi-component"; componentIndexes: number[] }
  | null;

export type TemplateV2ClipboardItem = {
  data: TemplateV2ClipboardRecord;
  absoluteBox: TemplateV2ClipboardBox;
};

export type TemplateV2ClipboardPayload = {
  format: "presenton/template-v2";
  version: 1;
  kind: "component" | "components";
  data?: TemplateV2ClipboardRecord;
  components?: TemplateV2ClipboardItem[];
  absoluteBox: TemplateV2ClipboardBox;
};

export type TemplateV2ClipboardPasteResult<TUi> = {
  ui: TUi;
  selection: Exclude<TemplateV2ClipboardSelection, null>;
};

type PasteOptions<TUi extends TemplateV2ClipboardRecord> = {
  sourceUi: TUi;
  payload: TemplateV2ClipboardPayload;
  offset: number;
};

export function createTemplateV2ClipboardPayload(
  items: TemplateV2ClipboardItem[],
): TemplateV2ClipboardPayload {
  const normalizedItems = items.filter((item) => isValidBox(item.absoluteBox));
  const first = normalizedItems[0];
  const absoluteBox = unionBoxes(
    normalizedItems.map((item) => item.absoluteBox),
  );

  return {
    format: "presenton/template-v2",
    version: 1,
    kind: normalizedItems.length > 1 ? "components" : "component",
    ...(first ? { data: cloneJson(first.data) } : {}),
    components: normalizedItems.map((item) => ({
      data: cloneJson(item.data),
      absoluteBox: { ...item.absoluteBox },
    })),
    absoluteBox,
  };
}

export function pasteTemplateV2ClipboardPayload<
  TUi extends TemplateV2ClipboardRecord,
>({
  sourceUi,
  payload,
  offset,
}: PasteOptions<TUi>): TemplateV2ClipboardPasteResult<TUi> | null {
  if (payload.kind !== "component" && payload.kind !== "components") return null;
  const items = payloadItems(payload);
  if (items.length === 0) return null;

  const components = [...readArray(sourceUi.components)];
  const componentIndexes: number[] = [];

  items.forEach((item) => {
    const component = cloneJson(item.data);
    const box = item.absoluteBox;
    const componentIndex = components.length;
    componentIndexes.push(componentIndex);
    components.push({
      ...withUniquePastedComponentIdentity(component, components),
      position: { x: box.x + offset, y: box.y + offset },
    });
  });

  return {
    ui: { ...sourceUi, components } as TUi,
    selection:
      componentIndexes.length === 1
        ? { kind: "component", componentIndex: componentIndexes[0] ?? 0 }
        : { kind: "multi-component", componentIndexes },
  };
}

function payloadItems(payload: TemplateV2ClipboardPayload): TemplateV2ClipboardItem[] {
  const items = Array.isArray(payload.components)
    ? payload.components
    : payload.data
      ? [{ data: payload.data, absoluteBox: payload.absoluteBox }]
      : [];
  return items.filter(
    (item): item is TemplateV2ClipboardItem =>
      isRecord(item.data) && isValidBox(item.absoluteBox),
  );
}

function readArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function withUniquePastedComponentIdentity(
  component: TemplateV2ClipboardRecord,
  siblings: unknown[],
) {
  const next = { ...component };
  next.id = uniqueComponentId(
    `${normalizeId(
      readString(component.id) ??
        readString(component.name) ??
        readString(component.description) ??
        "component",
    )}_copy`,
    siblings,
  );
  return next;
}

function uniqueComponentId(base: string, siblings: unknown[]) {
  const existingIds = new Set(
    siblings
      .map((component) =>
        isRecord(component) ? readString(component.id) : null,
      )
      .filter(Boolean),
  );
  if (!existingIds.has(base)) return base;
  let index = 2;
  while (existingIds.has(`${base}_${index}`)) {
    index += 1;
  }
  return `${base}_${index}`;
}

function normalizeId(value: string) {
  const normalized = value
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return normalized || "component";
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function isValidBox(value: unknown): value is TemplateV2ClipboardBox {
  if (!isRecord(value)) return false;
  return (
    typeof value.x === "number" &&
    typeof value.y === "number" &&
    typeof value.width === "number" &&
    typeof value.height === "number" &&
    Number.isFinite(value.x) &&
    Number.isFinite(value.y) &&
    Number.isFinite(value.width) &&
    Number.isFinite(value.height) &&
    value.width > 0 &&
    value.height > 0
  );
}

function unionBoxes(boxes: TemplateV2ClipboardBox[]): TemplateV2ClipboardBox {
  const validBoxes = boxes.filter(isValidBox);
  if (validBoxes.length === 0) {
    return { x: 0, y: 0, width: 1, height: 1 };
  }
  const left = Math.min(...validBoxes.map((box) => box.x));
  const top = Math.min(...validBoxes.map((box) => box.y));
  const right = Math.max(...validBoxes.map((box) => box.x + box.width));
  const bottom = Math.max(...validBoxes.map((box) => box.y + box.height));
  return {
    x: left,
    y: top,
    width: right - left,
    height: bottom - top,
  };
}
