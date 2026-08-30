import type { TemplateV2Layout } from "@/components/slide-editor/importing/template-v2-import";

export type UnknownRecord = Record<string, unknown>;
export type TemplateSavePayload = UnknownRecord & {
  id: string;
  name: string;
  layout_count: number;
  layouts: unknown;
};
export type PanelMode =
  | "blocks"
  | "texts"
  | "charts"
  | "infographics"
  | "tables"
  | "images"
  | "elements"
  | "schema"
  | "layouts";
export type Density = "" | "Low" | "Medium" | "High";
export type LayoutPath = Array<string | number>;
export type HistoryCommand = { action: "undo" | "redo"; token: number };
export type HistoryAvailability = { canUndo: boolean; canRedo: boolean };

export type CreatedTemplateLayout = {
  index: number;
  layout: TemplateV2Layout;
};

export type SchemaField = {
  decorative: boolean;
  elementType: string;
  id: string;
  label: string;
  type: "text" | "text-list" | "image" | "element";
  path: LayoutPath;
  value: string;
  minChars?: number;
  maxChars?: number;
};

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function readNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

function readArray(value: unknown) {
  return Array.isArray(value) ? value : [];
}

export function cloneLayout<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

type ContentDensity = Exclude<Density, "">;

const MAX_PREVIEW_ITEMS = 24;
const MAX_PREVIEW_TEXT_LENGTH = 10_000;
const DENSE_CONTENT_SENTENCES = [
  "Strategic teams need clear context, measurable progress, and practical next steps for every decision.",
  "This expanded sample copy demonstrates how the layout behaves when a field receives dense presentation content.",
  "Use this mock content to inspect wrapping, alignment, overflow, spacing, and visual balance across the slide.",
  "Each sentence adds realistic business language so longer text blocks feel close to generated presentation output.",
  "The preview fills the schema allowance to expose layout pressure before export.",
];

/**
 * Build a density preview without changing the layout that will be saved.
 * Low and High mirror the reference editor's min/max schema previews, while
 * Medium uses the midpoint between the configured bounds.
 */
export function applyTemplateContentDensity(
  layout: TemplateV2Layout,
  density: Density,
) {
  if (!density) return layout;

  const nextLayout = cloneLayout(layout);
  const layoutRecord = nextLayout as UnknownRecord;

  applyDensityToElements(layoutRecord.elements, density);
  readArray(layoutRecord.components).forEach((component) => {
    if (isRecord(component)) {
      applyDensityToElements(component.elements, density);
    }
  });

  return nextLayout;
}

/**
 * Density content is synthetic, so only copy canvas/layout edits back into the
 * stored layout while a density preview is active.
 */
export function mergeDensityPreviewCanvasEdits(
  storedLayout: TemplateV2Layout,
  editedPreviewLayout: TemplateV2Layout,
) {
  const nextLayout = cloneLayout(storedLayout);
  const target = nextLayout as UnknownRecord;
  const source = editedPreviewLayout as UnknownRecord;

  syncComponentCanvasFields(target.components, source.components);
  syncElementCanvasFields(target.elements, source.elements);
  return nextLayout;
}

function applyDensityToElements(elements: unknown, density: ContentDensity) {
  readArray(elements).forEach((element) => {
    if (isRecord(element)) applyDensityToElement(element, density);
  });
}

function applyDensityToElement(
  element: UnknownRecord,
  density: ContentDensity,
) {
  const type = readString(element.type);
  const name = readString(element.name).trim();
  const isEditableContent = element.decorative === false && Boolean(name);

  if (isEditableContent && type === "text") {
    const targetLength = densityTextLength(element, density);
    setElementRunsText(element, exactDensityText(name, targetLength, density));
  } else if (isEditableContent && type === "text-list") {
    applyTextListDensity(element, name, density);
  } else if (isEditableContent && type === "image") {
    const promptLabel = element.is_icon === true ? `${name} icon` : `${name} image`;
    element.prompt = exactDensityText(
      promptLabel,
      densityTextLength({}, density),
      density,
    );
  } else if (isEditableContent && type === "table") {
    applyTableDensity(element, name, density);
  }

  resizeRepeatedChildren(element, density);

  if (isRecord(element.child)) {
    applyDensityToElement(element.child, density);
  }
  applyDensityToElements(element.children, density);
  applyDensityToElements(element.elements, density);
}

function applyTextListDensity(
  element: UnknownRecord,
  name: string,
  density: ContentDensity,
) {
  const itemCount = densityCount(
    element.min_items,
    element.max_items,
    density,
  );
  const currentItems = readArray(element.items);
  const itemLength = densityLength(
    element.min_item_length,
    element.max_item_length,
    density,
  );

  element.items = Array.from({ length: itemCount }, (_, index) => {
    const source =
      currentItems[index] ??
      currentItems[currentItems.length - 1] ??
      currentItems[0] ??
      [{ text: "" }];
    const nextItem = cloneLayout(source);
    setRunsTextOnValue(
      nextItem,
      exactDensityText(`${name} ${index + 1}`, itemLength, density),
    );
    return nextItem;
  });
}

function applyTableDensity(
  element: UnknownRecord,
  name: string,
  density: ContentDensity,
) {
  const columnCount = densityCount(
    element.min_columns,
    element.max_columns,
    density,
  );
  const rowCount = densityCount(
    element.min_rows,
    element.max_rows,
    density,
  );
  const cellTextLength = densityTextLength({}, density);
  const currentColumns = readArray(element.columns);
  const currentRows = readArray(element.rows);

  element.columns = Array.from({ length: columnCount }, (_, columnIndex) =>
    cellWithText(
      currentColumns[columnIndex] ??
        currentColumns[currentColumns.length - 1],
      exactDensityText(
        `${name} column ${columnIndex + 1}`,
        cellTextLength,
        density,
      ),
    ),
  );
  element.rows = Array.from({ length: rowCount }, (_, rowIndex) => {
    const sourceRow = readArray(
      currentRows[rowIndex] ?? currentRows[currentRows.length - 1],
    );
    return Array.from({ length: columnCount }, (_, columnIndex) =>
      cellWithText(
        sourceRow[columnIndex] ??
          sourceRow[sourceRow.length - 1] ??
          currentColumns[columnIndex],
        exactDensityText(
          `${name} row ${rowIndex + 1} column ${columnIndex + 1}`,
          cellTextLength,
          density,
        ),
      ),
    );
  });
}

function resizeRepeatedChildren(
  element: UnknownRecord,
  density: ContentDensity,
) {
  const type = readString(element.type);
  if (type !== "flex" && type !== "grid") return;

  const children = readArray(element.children);
  const minChildren = readNumber(element.min_children);
  const maxChildren = readNumber(element.max_children);
  if (minChildren === undefined && maxChildren === undefined) return;

  const targetCount = densityCount(minChildren, maxChildren, density);
  if (targetCount === children.length) return;
  if (!childrenCanRepeat(children, maxChildren)) return;

  const nextChildren = children.slice(0, targetCount).map(cloneLayout);
  while (nextChildren.length < targetCount) {
    const index = nextChildren.length;
    const source =
      children[index] ??
      children[children.length - 1] ??
      children[0] ??
      { type: "group", children: [] };
    const nextChild = cloneLayout(source);
    normalizeRepeatedNames(nextChild, index);
    nextChildren.push(nextChild);
  }
  element.children = nextChildren;
}

function childrenCanRepeat(children: unknown[], maxChildren?: number) {
  if (children.length === 0) return false;
  if (children.length === 1) {
    return maxChildren !== undefined && maxChildren > 1;
  }

  return (["none", "numeric"] as const).some((strategy) => {
    const signatures = children.map((child) =>
      JSON.stringify(contentShape(child, strategy)),
    );
    return (
      signatures[0] !== "null" &&
      signatures.every((signature) => signature === signatures[0])
    );
  });
}

function contentShape(
  value: unknown,
  nameStrategy: "none" | "numeric",
): unknown {
  if (!isRecord(value)) return null;

  const type = readString(value.type);
  const name = normalizedContentName(readString(value.name), nameStrategy);
  if (
    value.decorative === false &&
    name &&
    ["text", "image", "text-list", "table", "chart", "infographic"].includes(
      type,
    )
  ) {
    return {
      type,
      name,
      min_length: value.min_length,
      max_length: value.max_length,
      min_items: value.min_items,
      max_items: value.max_items,
      min_item_length: value.min_item_length,
      max_item_length: value.max_item_length,
    };
  }

  const childShape = contentShape(value.child, nameStrategy);
  const childrenShapes = readArray(value.children)
    .map((child) => contentShape(child, nameStrategy))
    .filter((shape) => shape !== null);
  const elementShapes = readArray(value.elements)
    .map((child) => contentShape(child, nameStrategy))
    .filter((shape) => shape !== null);

  if (!childShape && childrenShapes.length === 0 && elementShapes.length === 0) {
    return null;
  }
  return {
    type,
    name: name || undefined,
    child: childShape || undefined,
    children: childrenShapes.length ? childrenShapes : undefined,
    elements: elementShapes.length ? elementShapes : undefined,
  };
}

function normalizedContentName(
  name: string,
  strategy: "none" | "numeric",
) {
  const trimmedName = name.trim();
  if (strategy === "none") return trimmedName;
  return trimmedName.replace(/_\d+(?=_|$)/, "").replace(/_\d+$/, "");
}

function normalizeRepeatedNames(value: unknown, index: number): void {
  if (Array.isArray(value)) {
    value.forEach((item) => normalizeRepeatedNames(item, index));
    return;
  }
  if (!isRecord(value)) return;

  if (typeof value.name === "string") {
    value.name = value.name
      .replace(/_\d+(?=_|$)/, `_${index + 1}`)
      .replace(/_\d+$/, `_${index + 1}`);
  }
  Object.values(value).forEach((item) => normalizeRepeatedNames(item, index));
}

function densityTextLength(
  schema: UnknownRecord,
  density: ContentDensity,
) {
  return densityLength(schema.min_length, schema.max_length, density);
}

function densityLength(
  minValue: unknown,
  maxValue: unknown,
  density: ContentDensity,
) {
  const minLength = nonNegativeInteger(minValue, 8);
  const maxLength = Math.max(
    minLength,
    nonNegativeInteger(maxValue, Math.max(160, minLength)),
  );
  return Math.min(
    MAX_PREVIEW_TEXT_LENGTH,
    densityValue(minLength, maxLength, density),
  );
}

function densityCount(
  minValue: unknown,
  maxValue: unknown,
  density: ContentDensity,
) {
  const minCount = nonNegativeInteger(minValue, 1);
  const maxCount = Math.max(
    minCount,
    nonNegativeInteger(maxValue, Math.max(2, minCount)),
  );
  return Math.min(
    MAX_PREVIEW_ITEMS,
    densityValue(minCount, maxCount, density),
  );
}

function densityValue(
  minValue: number,
  maxValue: number,
  density: ContentDensity,
) {
  if (density === "Low") return minValue;
  if (density === "High") return maxValue;
  return Math.round((minValue + maxValue) / 2);
}

function nonNegativeInteger(value: unknown, fallback: number) {
  const number = readNumber(value);
  return Math.max(0, Math.floor(number ?? fallback));
}

function exactDensityText(
  label: string,
  targetLength: number,
  density: ContentDensity,
) {
  if (targetLength <= 0) return "";

  const title = sentenceCase(
    label.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim() || "content",
  );
  const candidates =
    density === "Low"
      ? [
          `${title}.`,
          `${title} is ready.`,
          `${title} is clear.`,
          "Clear next step.",
          "Teams have a clear next step.",
          "The plan is ready for review.",
          "This section has enough content to validate spacing.",
        ]
      : [
          `${title} summary shows steady progress and a clear next step.`,
          ...DENSE_CONTENT_SENTENCES,
          "Stakeholders can compare options, spot risks, and align on the strongest path forward.",
          "The final wording stays deterministic while still resembling natural presentation copy.",
        ];
  const seed = candidates.join(" ").replace(/\s+/g, " ").trim();
  if (seed.length >= targetLength) return seed.slice(0, targetLength);

  const filler = ` ${DENSE_CONTENT_SENTENCES.join(" ")} ${seed}`;
  let text = seed;
  while (text.length < targetLength) text += filler;
  return text.slice(0, targetLength);
}

function sentenceCase(value: string) {
  return value
    ? `${value.charAt(0).toUpperCase()}${value.slice(1)}`
    : value;
}

function setElementRunsText(element: UnknownRecord, text: string) {
  const runs = readArray(element.runs).filter(isRecord);
  if (runs.length === 0) {
    element.runs = [{ text }];
    return;
  }
  element.runs = runs.map((run, index) => ({
    ...run,
    text: index === 0 ? text : "",
  }));
}

function setRunsTextOnValue(value: unknown, text: string) {
  if (Array.isArray(value)) {
    if (value.length === 0) value.push({ text });
    value.forEach((run, index) => {
      if (isRecord(run)) run.text = index === 0 ? text : "";
    });
    return;
  }

  if (!isRecord(value)) return;
  if (!Array.isArray(value.runs)) value.runs = [{ text }];
  setElementRunsText(value, text);
}

function cellWithText(source: unknown, text: string) {
  const cell = cloneLayout(isRecord(source) ? source : { runs: [{ text: "" }] });
  setElementRunsText(cell, text);
  return cell;
}

function syncComponentCanvasFields(
  targetComponents: unknown,
  sourceComponents: unknown,
) {
  if (!Array.isArray(targetComponents) || !Array.isArray(sourceComponents)) {
    return;
  }

  targetComponents.forEach((targetComponent, index) => {
    const sourceComponent = sourceComponents[index];
    if (!isRecord(targetComponent) || !isRecord(sourceComponent)) return;
    syncObjectFields(targetComponent, sourceComponent, [
      "position",
      "size",
      "rotation",
    ]);
    syncElementCanvasFields(targetComponent.elements, sourceComponent.elements);
  });
}

function syncElementCanvasFields(
  targetElements: unknown,
  sourceElements: unknown,
) {
  if (!Array.isArray(targetElements) || !Array.isArray(sourceElements)) return;

  targetElements.forEach((targetElement, index) => {
    const sourceElement = sourceElements[index];
    if (!isRecord(targetElement) || !isRecord(sourceElement)) return;
    syncObjectFields(targetElement, sourceElement, [
      "position",
      "size",
      "rotation",
      "points",
      "__presenton_manual_position",
    ]);
    syncElementCanvasFields(targetElement.children, sourceElement.children);
    syncElementCanvasFields(targetElement.elements, sourceElement.elements);
    if (isRecord(targetElement.child) && isRecord(sourceElement.child)) {
      syncElementCanvasFields([targetElement.child], [sourceElement.child]);
    }
  });
}

function syncObjectFields(
  target: UnknownRecord,
  source: UnknownRecord,
  fields: string[],
) {
  fields.forEach((field) => {
    if (field in source) target[field] = cloneLayout(source[field]);
    else delete target[field];
  });
}

function withEditedLayouts(
  currentLayoutsValue: unknown,
  layouts: TemplateV2Layout[],
) {
  if (Array.isArray(currentLayoutsValue)) {
    return layouts;
  }

  if (isRecord(currentLayoutsValue)) {
    return {
      ...currentLayoutsValue,
      layouts,
    };
  }

  return { layouts };
}

export function buildTemplateSavePayload({
  layouts,
  name,
  targetTemplateId,
  template,
}: {
  layouts: TemplateV2Layout[];
  name: string;
  targetTemplateId: string;
  template: unknown;
}): TemplateSavePayload {
  const templateRecord = isRecord(template) ? template : {};
  const payload = cloneLayout(templateRecord);

  payload.id = targetTemplateId;
  payload.name = name;
  payload.layout_count = layouts.length;
  payload.layouts = withEditedLayouts(templateRecord.layouts, layouts);

  return payload as TemplateSavePayload;
}

export function hashKey(value: string) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(36);
}

function humanize(value: string) {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function readLayoutId(layout: TemplateV2Layout, index: number) {
  const id = readString((layout as UnknownRecord).id).trim();
  return id || `slide-${index + 1}`;
}

export function readLayoutIdValue(layout: TemplateV2Layout, index: number) {
  const layoutRecord = layout as UnknownRecord;
  if (Object.prototype.hasOwnProperty.call(layoutRecord, "id")) {
    return readString(layoutRecord.id);
  }

  return readLayoutId(layout, index);
}

export function readLayoutDescription(layout: TemplateV2Layout) {
  return readString((layout as UnknownRecord).description);
}

export function updateLayoutMetadata(
  layout: TemplateV2Layout,
  field: "id" | "description",
  value: string,
) {
  const nextLayout = cloneLayout(layout) as UnknownRecord;
  nextLayout[field] = value;

  return nextLayout as TemplateV2Layout;
}

function schemaLabelForElement(
  element: UnknownRecord,
  fallback: string,
  parentLabel?: string,
) {
  const label =
    readString(element.component_slot) ||
    readString(element.name) ||
    readString(element.component_description) ||
    parentLabel ||
    fallback;
  return humanize(label);
}

function textRunsToString(runs: unknown) {
  return readArray(runs)
    .map((run) => (isRecord(run) ? readString(run.text) : ""))
    .join("");
}

function textListItemsToString(items: unknown) {
  return readArray(items)
    .map((item) => textRunsToString(item))
    .filter((line) => line.trim().length > 0)
    .join("\n");
}

export function collectSchemaFields(layout: TemplateV2Layout) {
  const fields: SchemaField[] = [];

  const addElement = (
    element: unknown,
    path: LayoutPath,
    parentLabel?: string,
  ) => {
    if (!isRecord(element)) return;

    const type = readString(element.type);
    const decorative = element.decorative !== false;
    const label = schemaLabelForElement(
      element,
      `${type || "Field"} ${fields.length + 1}`,
      parentLabel,
    );

    if (type === "text") {
      const value = textRunsToString(element.runs);
      if (value || label) {
        fields.push({
          decorative,
          elementType: type,
          id: path.join("."),
          label,
          type: "text",
          path,
          value,
          minChars: readNumber(element.min_length),
          maxChars: readNumber(element.max_length),
        });
      }
    }

    if (type === "text-list") {
      const value = textListItemsToString(element.items);
      if (value || label) {
        fields.push({
          decorative,
          elementType: type,
          id: path.join("."),
          label,
          type: "text-list",
          path,
          value,
          minChars: readNumber(element.min_item_length),
          maxChars: readNumber(element.max_item_length),
        });
      }
    }

    if (type === "image") {
      fields.push({
        decorative,
        elementType: element.is_icon === true ? "icon" : type,
        id: path.join("."),
        label,
        type: "image",
        path,
        value: readString(element.data) || readString(element.prompt),
      });
    }

    if (type && type !== "text" && type !== "text-list" && type !== "image") {
      fields.push({
        decorative,
        elementType: type,
        id: path.join("."),
        label,
        type: "element",
        path,
        value: "",
      });
    }

    const childLabel =
      readString(element.component_slot) ||
      readString(element.name) ||
      parentLabel;

    if (isRecord(element.child)) {
      addElement(element.child, [...path, "child"], childLabel);
    }

    readArray(element.children).forEach((child, childIndex) => {
      addElement(child, [...path, "children", childIndex], childLabel);
    });

    readArray(element.elements).forEach((child, childIndex) => {
      addElement(child, [...path, "elements", childIndex], childLabel);
    });
  };

  const layoutRecord = layout as UnknownRecord;

  readArray(layoutRecord.elements).forEach((element, elementIndex) => {
    addElement(element, ["elements", elementIndex]);
  });

  readArray(layoutRecord.components).forEach((component, componentIndex) => {
    if (!isRecord(component)) return;
    const componentLabel =
      readString(component.component_slot) ||
      readString(component.id) ||
      readString(component.description);

    readArray(component.elements).forEach((element, elementIndex) => {
      addElement(
        element,
        ["components", componentIndex, "elements", elementIndex],
        componentLabel,
      );
    });
  });

  return fields;
}

function recordAtPath(root: unknown, path: LayoutPath) {
  let current: unknown = root;
  for (const segment of path) {
    if (typeof segment === "number") {
      if (!Array.isArray(current)) return null;
      current = current[segment];
      continue;
    }
    if (!isRecord(current)) return null;
    current = current[segment];
  }
  return isRecord(current) ? current : null;
}

function updateTextRuns(element: UnknownRecord, value: string) {
  const runs = readArray(element.runs).filter(isRecord);
  const firstRun = runs[0] ?? {};
  element.runs = [{ ...firstRun, text: value }];
}

function updateTextListItems(element: UnknownRecord, value: string) {
  const currentItems = readArray(element.items);
  const firstItem = readArray(currentItems[0]).filter(isRecord);
  const firstRun = firstItem[0] ?? {};
  const lines = value.split(/\r?\n/);
  element.items = lines.map((line) => [{ ...firstRun, text: line }]);
}

export function updateLayoutSchemaField(
  layout: TemplateV2Layout,
  field: SchemaField,
  value: string,
) {
  if (field.decorative) return layout;

  const nextLayout = cloneLayout(layout);
  const element = recordAtPath(nextLayout, field.path);
  if (!element) return layout;

  if (field.type === "text") {
    updateTextRuns(element, value);
  } else if (field.type === "text-list") {
    updateTextListItems(element, value);
  } else if (field.type === "image") {
    element.data = value;
  } else {
    return layout;
  }

  return nextLayout;
}

export function updateLayoutSchemaConstraint(
  layout: TemplateV2Layout,
  field: SchemaField,
  constraint: "min" | "max",
  value: string,
) {
  if (field.decorative) return layout;

  const nextLayout = cloneLayout(layout);
  const element = recordAtPath(nextLayout, field.path);
  if (
    !element ||
    field.type === "image" ||
    field.type === "element"
  ) {
    return layout;
  }

  const numericValue = value.trim() === "" ? null : Number.parseInt(value, 10);
  const key =
    field.type === "text-list"
      ? constraint === "min"
        ? "min_item_length"
        : "max_item_length"
      : constraint === "min"
        ? "min_length"
        : "max_length";

  if (numericValue === null || !Number.isFinite(numericValue)) {
    delete element[key];
  } else {
    element[key] = Math.max(0, numericValue);
  }

  return nextLayout;
}

export function updateLayoutSchemaDecoration(
  layout: TemplateV2Layout,
  field: SchemaField,
  decorative: boolean,
) {
  const nextLayout = cloneLayout(layout);
  const element = recordAtPath(nextLayout, field.path);
  if (!element) return layout;

  element.decorative = decorative;
  return nextLayout;
}

export function extractCreatedLayouts(value: unknown): CreatedTemplateLayout[] {
  if (!isRecord(value)) return [];
  const layoutsValue = value.layouts;
  if (!Array.isArray(layoutsValue)) return [];

  return layoutsValue.flatMap((item) => {
    if (!isRecord(item)) return [];
    const index = item.index;
    if (!Number.isInteger(index) || !item.layout) return [];
    return [
      {
        index: index as number,
        layout: item.layout as TemplateV2Layout,
      },
    ];
  });
}
