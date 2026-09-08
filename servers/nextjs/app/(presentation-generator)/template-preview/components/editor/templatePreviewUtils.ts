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
  minItems?: number;
  maxItems?: number;
};

type DensityLengthField = Pick<
  SchemaField,
  "label" | "minChars" | "maxChars"
>;

const CONTENT_ELEMENT_TYPES = new Set([
  "text",
  "image",
  "text-list",
  "table",
  "chart",
  "infographic",
]);

type ComparableSchemaNode = {
  name: string;
  schema: UnknownRecord;
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
      resizeRepeatedComponentElements(component, density);
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
  } else if (isEditableContent && type === "table") {
    Object.assign(element, applyTableDensity(element, density));
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

function densityTargetCount(
  density: Exclude<Density, "">,
  currentCount: number,
  minimum?: number,
  maximum?: number,
) {
  const clampCount = (value: number) =>
    Math.min(100, Math.max(0, Math.round(value)));
  const minCount = clampCount(minimum ?? currentCount);
  const maxCount = clampCount(Math.max(minCount, maximum ?? currentCount));

  if (density === "Low") return minCount;
  if (density === "High") return maxCount;
  return clampCount(minCount + (maxCount - minCount) / 2);
}

function densityTargetLength(
  field: DensityLengthField,
  density: Exclude<Density, "">,
  currentLength: number,
) {
  const clampPreviewLength = (length: number) =>
    Math.min(2_000, Math.max(1, Math.round(length)));
  const contentLength = Math.max(1, currentLength || field.label.length);
  const hasMin = typeof field.minChars === "number";
  const hasMax = typeof field.maxChars === "number";

  if (!hasMin && !hasMax) {
    if (density === "Low") {
      return clampPreviewLength(Math.max(12, contentLength * 0.55));
    }
    if (density === "Medium") {
      return clampPreviewLength(Math.max(24, contentLength * 1.2));
    }
    return clampPreviewLength(Math.max(48, contentLength * 1.8));
  }

  const minLength = Math.max(
    1,
    field.minChars ??
      Math.min(field.maxChars ?? contentLength, Math.max(12, contentLength)),
  );
  const maxLength = Math.max(
    minLength,
    field.maxChars ??
      Math.max(minLength * 2, Math.round(contentLength * 1.6)),
  );

  if (density === "Low") return clampPreviewLength(minLength);
  if (density === "High") return clampPreviewLength(maxLength);
  return clampPreviewLength(minLength + (maxLength - minLength) / 2);
}

function textAtTargetLength(
  value: string,
  label: string,
  targetLength: number,
) {
  const normalizedValue = value.replace(/\s+/g, " ").trim();
  const fallback = `${label} provides a clear supporting point.`;
  const source = normalizedValue || fallback;
  const supportingDetail =
    "This supporting detail adds useful context and helps explain the key message clearly.";
  let expanded = source;

  while (expanded.length < targetLength) {
    expanded = `${expanded} ${supportingDetail}`;
  }

  if (expanded.length <= targetLength) return expanded;

  const clipped = expanded.slice(0, targetLength).trimEnd();
  const finalSpace = clipped.lastIndexOf(" ");
  if (finalSpace >= Math.floor(targetLength * 0.72)) {
    return clipped.slice(0, finalSpace).trimEnd();
  }
  return clipped;
}

function comparableContentSchema(element: UnknownRecord): UnknownRecord {
  const type = readString(element.type);

  if (type === "text") {
    return {
      type: "string",
      minLength: readNumber(element.min_length),
      maxLength: readNumber(element.max_length),
    };
  }

  if (type === "image") {
    return {
      type: "image",
      promptKey: element.is_icon === true ? "icon_query" : "image_prompt",
    };
  }

  if (type === "text-list") {
    return {
      type: "array",
      minItems: readNumber(element.min_items),
      maxItems: readNumber(element.max_items),
      items: {
        type: "string",
        minLength: readNumber(element.min_item_length),
        maxLength: readNumber(element.max_item_length),
      },
    };
  }

  if (type === "table") {
    const limits = tableTextLimits(element);
    return {
      type: "table",
      minRows: readNumber(element.min_rows),
      maxRows: readNumber(element.max_rows),
      minColumns: readNumber(element.min_columns),
      maxColumns: readNumber(element.max_columns),
      headerMinimum: limits.header.minimum,
      headerMaximum: limits.header.maximum,
      bodyMinimum: limits.body.minimum,
      bodyMaximum: limits.body.maximum,
    };
  }

  if (type === "chart") {
    return {
      type: "chart",
      hasTitle: readString(element.title).trim().length > 0,
    };
  }

  if (type === "infographic") {
    const data = isRecord(element.data) ? element.data : {};
    return {
      type: "infographic",
      infographicType: readString(data.type),
    };
  }

  return { type };
}

function comparableObjectSchema(nodes: ComparableSchemaNode[]): UnknownRecord {
  const properties: UnknownRecord = {};
  nodes.forEach((node) => {
    let key = node.name;
    let suffix = 2;
    while (Object.prototype.hasOwnProperty.call(properties, key)) {
      key = `${node.name}_${suffix}`;
      suffix += 1;
    }
    properties[key] = node.schema;
  });

  return {
    type: "object",
    properties,
  };
}

function numericNameToken(value: string) {
  return value.match(/_\d+(?=_|$)/)?.[0] ?? null;
}

function prefixNameToken(value: string) {
  const separatorIndex = value.indexOf("_");
  return separatorIndex > 0 ? value.slice(0, separatorIndex + 1) : null;
}

function normalizationTokenForNodes(
  nodes: ComparableSchemaNode[],
  strategy: "numeric" | "none" | "prefix",
) {
  if (strategy === "none") return null;
  const tokenForName =
    strategy === "numeric" ? numericNameToken : prefixNameToken;
  const tokens = nodes.map((node) => tokenForName(node.name)).filter(Boolean);
  if (tokens.length === 0) return null;
  return tokens.every((token) => token === tokens[0]) ? tokens[0] : null;
}

function normalizeComparableSchema(value: unknown, token: string | null): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeComparableSchema(item, token));
  }
  if (!isRecord(value)) return value;

  return Object.fromEntries(
    Object.entries(value).map(([key, child]) => [
      token ? key.replace(token, "") : key,
      normalizeComparableSchema(child, token),
    ]),
  );
}

function stableComparableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableComparableValue);
  if (!isRecord(value)) return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, stableComparableValue(value[key])]),
  );
}

function normalizedRepeatedItemSchema(
  nodes: ComparableSchemaNode[],
  strategy: "numeric" | "none" | "prefix",
) {
  const token = normalizationTokenForNodes(nodes, strategy);
  const itemSchema =
    nodes.length === 1 && nodes[0].schema.type === "object"
      ? nodes[0].schema
      : comparableObjectSchema(nodes);
  return stableComparableValue(normalizeComparableSchema(itemSchema, token));
}

function repeatedRootNamesMatch(nodeSets: ComparableSchemaNode[][]) {
  if (
    nodeSets.length === 0 ||
    nodeSets.some((nodes) => nodes.length !== 1)
  ) {
    return false;
  }

  const names = nodeSets.map((nodes) => nodes[0].name);
  if (names.every((name) => name === names[0])) return true;
  const normalizedNames = names.map((name) => {
    const token = numericNameToken(name);
    return token ? name.replace(token, "") : name;
  });
  return normalizedNames.every((name) => name === normalizedNames[0]);
}

function flattenedContentNodes(nodes: ComparableSchemaNode[]) {
  const flattened: ComparableSchemaNode[] = [];
  const visit = (node: ComparableSchemaNode) => {
    const properties = isRecord(node.schema.properties)
      ? node.schema.properties
      : null;
    if (node.schema.type !== "object" || !properties) {
      flattened.push(node);
      return;
    }

    Object.entries(properties).forEach(([name, schema]) => {
      if (isRecord(schema)) visit({ name, schema });
    });
  };
  nodes.forEach(visit);
  return flattened;
}

function normalizedNodeNamesAreUnique(
  nodes: ComparableSchemaNode[],
  strategy: "numeric" | "none" | "prefix",
) {
  if (nodes.length === 0) return false;
  const token = normalizationTokenForNodes(nodes, strategy);
  const names = nodes.map((node) =>
    token ? node.name.replace(token, "") : node.name,
  );
  return new Set(names).size === names.length;
}

function repeatedChildrenSchema(
  element: UnknownRecord,
  childNodeSets: ComparableSchemaNode[][],
) {
  if (childNodeSets.some((nodes) => nodes.length === 0)) return null;

  const childCount = childNodeSets.length;
  const maxChildren = readNumber(element.max_children);
  if (childCount < 2 && !(maxChildren != null && maxChildren > childCount)) {
    return null;
  }

  for (const strategy of ["numeric", "none", "prefix"] as const) {
    const itemSchemas = childNodeSets.map((nodes) =>
      normalizedRepeatedItemSchema(nodes, strategy),
    );
    const first = JSON.stringify(itemSchemas[0]);
    if (itemSchemas.every((schema) => JSON.stringify(schema) === first)) {
      const isGroup = readString(element.type) === "group";
      return {
        type: "array",
        minItems: isGroup
          ? Math.floor(childCount / 2)
          : readNumber(element.min_children),
        maxItems: isGroup ? childCount : maxChildren,
        items: itemSchemas[0],
      } satisfies UnknownRecord;
    }
  }

  if (repeatedRootNamesMatch(childNodeSets)) {
    const flattenedNodeSets = childNodeSets.map(flattenedContentNodes);
    for (const strategy of ["numeric", "none", "prefix"] as const) {
      if (
        !flattenedNodeSets.every((nodes) =>
          normalizedNodeNamesAreUnique(nodes, strategy),
        )
      ) {
        continue;
      }

      const itemSchemas = flattenedNodeSets.map((nodes) =>
        normalizedRepeatedItemSchema(nodes, strategy),
      );
      const first = JSON.stringify(itemSchemas[0]);
      if (itemSchemas.every((schema) => JSON.stringify(schema) === first)) {
        const isGroup = readString(element.type) === "group";
        return {
          type: "array",
          minItems: isGroup
            ? Math.floor(childCount / 2)
            : readNumber(element.min_children),
          maxItems: isGroup ? childCount : maxChildren,
          items: itemSchemas[0],
        } satisfies UnknownRecord;
      }
    }
  }

  return null;
}

function comparableSchemaNodesForElement(
  value: unknown,
): ComparableSchemaNode[] {
  if (!isRecord(value)) return [];
  const type = readString(value.type);
  const name = readString(value.name).trim();

  if (
    CONTENT_ELEMENT_TYPES.has(type) &&
    value.decorative === false &&
    name
  ) {
    return [{ name, schema: comparableContentSchema(value) }];
  }

  if (type === "container") {
    const childNodes = comparableSchemaNodesForElement(value.child);
    if (!name || childNodes.length === 0) return childNodes;
    return [{ name, schema: comparableObjectSchema(childNodes) }];
  }

  if (type !== "flex" && type !== "grid" && type !== "group") return [];
  const children = readArray(value.children);
  const childNodeSets = children.map(comparableSchemaNodesForElement);
  const childNodes = childNodeSets.flat();
  if (!name || childNodes.length === 0) return childNodes;

  const arraySchema = repeatedChildrenSchema(value, childNodeSets);

  return [
    {
      name,
      schema: arraySchema ?? comparableObjectSchema(childNodes),
    },
  ];
}

function isRepeatableStructuralElement(element: UnknownRecord) {
  const type = readString(element.type);
  const children = readArray(element.children);
  if (type !== "flex" && type !== "grid" && type !== "group") return false;

  return Boolean(
    repeatedChildrenSchema(
      element,
      children.map(comparableSchemaNodesForElement),
    ),
  );
}

function repeatedItemsAtDensity(
  items: unknown[],
  targetCount: number,
  centerWhenReduced: boolean,
) {
  if (items.length === 0 || targetCount === 0) return [];
  const start =
    centerWhenReduced && targetCount < items.length
      ? Math.floor((items.length - targetCount) / 2)
      : 0;

  return Array.from({ length: targetCount }, (_, index) => {
    const sourceIndex =
      targetCount < items.length
        ? start + index
        : Math.min(index, items.length - 1);
    const source = cloneLayout(items[sourceIndex]);
    if (!isRecord(source)) return source;
    delete source.__presenton_manual_position;
    if (index >= items.length) normalizeRepeatedNames(source, index);
    return source;
  });
}

function tableCellAtDensity(
  value: unknown,
  density: Exclude<Density, "">,
  label: string,
  minChars?: number,
  maxChars?: number,
) {
  const cell = isRecord(value) ? cloneLayout(value) : { runs: [] };
  const currentText = textRunsToString(cell.runs);
  const targetLength = densityTargetLength(
    { label, minChars, maxChars },
    density,
    currentText.length,
  );
  updateTextRuns(
    cell,
    textAtTargetLength(currentText, label, targetLength),
  );
  return cell;
}

function tableCellsAtDensity(
  values: unknown[],
  targetCount: number,
  fallbackValues: unknown[],
) {
  if (targetCount === 0) return [];
  const source =
    values.length > 0
      ? values
      : fallbackValues.length > 0
        ? [fallbackValues[0]]
        : [{ runs: [{ text: "" }] }];
  return repeatedItemsAtDensity(source, targetCount, false);
}

type TableTextLimit = { minimum?: number; maximum?: number };

function tableTextLimits(value: UnknownRecord): {
  header: TableTextLimit;
  body: TableTextLimit;
} {
  const size = isRecord(value.size) ? value.size : {};
  const width = readNumber(size.width);
  const height = readNumber(size.height);
  if (!width || width <= 0 || !height || height <= 0) {
    return { header: {}, body: {} };
  }

  const columns = readArray(value.columns).filter(isRecord);
  const rows = readArray(value.rows).map(readArray);
  const bodyCells = rows.flat().filter(isRecord);
  const columnCount = Math.max(
    1,
    Math.round((readNumber(value.max_columns) ?? columns.length) || 1),
  );
  const rowCount = Math.max(
    0,
    Math.round(readNumber(value.max_rows) ?? rows.length),
  );
  const cellWidth = Math.max(1, width / columnCount - 24);
  const cellHeight = Math.max(1, height / (rowCount + 1) - 12);

  return {
    header: tableSectionTextLimit(columns, cellWidth, cellHeight),
    body: tableSectionTextLimit(
      bodyCells,
      cellWidth,
      cellHeight,
      columns,
    ),
  };
}

function tableSectionTextLimit(
  cells: UnknownRecord[],
  cellWidth: number,
  cellHeight: number,
  fallbackCells: UnknownRecord[] = [],
): TableTextLimit {
  const { glyphWidth, lineHeight } = tableCellTypography(
    cells.length > 0 ? cells : fallbackCells,
  );
  const charactersPerLine = Math.max(1, Math.floor(cellWidth / glyphWidth));
  const lineCount = Math.max(1, Math.floor(cellHeight / lineHeight + 0.15));
  const estimatedMaximum = Math.max(
    1,
    Math.floor(charactersPerLine * lineCount * 0.85),
  );
  const texts = cells.map((cell) => textRunsToString(cell.runs));
  const observedMaximum = texts.reduce(
    (maximum, text) => Math.max(maximum, text.length),
    0,
  );
  return {
    minimum: texts.length > 0 && texts.every((text) => text.trim()) ? 1 : 0,
    maximum: Math.max(estimatedMaximum, observedMaximum),
  };
}

function tableCellTypography(cells: UnknownRecord[]) {
  const fonts: UnknownRecord[] = [];
  cells.forEach((cell) => {
    if (isRecord(cell.font)) fonts.push(cell.font);
    readArray(cell.runs).filter(isRecord).forEach((run) => {
      if (isRecord(run.font)) fonts.push(run.font);
    });
  });
  if (fonts.length === 0) fonts.push({});

  const glyphWidths = fonts.map((font) => {
    const fontSize = readNumber(font.size) ?? 14;
    const widthFactor = font.bold === true ? 0.62 : 0.58;
    return fontSize * widthFactor + Math.max(0, readNumber(font.letter_spacing) ?? 0);
  });
  const lineHeights = fonts.map((font) => {
    const fontSize = readNumber(font.size) ?? 14;
    const lineHeight = readNumber(font.line_height);
    if (!lineHeight || lineHeight <= 0) return fontSize * 1.2;
    return lineHeight > 2 ? lineHeight : fontSize * lineHeight;
  });
  return {
    glyphWidth: Math.max(...glyphWidths),
    lineHeight: Math.max(...lineHeights),
  };
}

function applyTableDensity(
  value: UnknownRecord,
  density: Exclude<Density, "">,
) {
  const next = cloneLayout(value);
  if (next.decorative !== false) return next;

  const sourceColumns = readArray(next.columns);
  const sourceRows = readArray(next.rows);
  const targetColumnCount = Math.max(
    1,
    densityTargetCount(
      density,
      sourceColumns.length,
      readNumber(next.min_columns),
      readNumber(next.max_columns),
    ),
  );
  const targetRowCount = densityTargetCount(
    density,
    sourceRows.length,
    readNumber(next.min_rows),
    readNumber(next.max_rows),
  );
  const limits = tableTextLimits(next);
  const hasHeaderLengthLimits =
    limits.header.minimum !== undefined || limits.header.maximum !== undefined;
  const hasCellLengthLimits =
    limits.body.minimum !== undefined || limits.body.maximum !== undefined;

  const columns = tableCellsAtDensity(
    sourceColumns,
    targetColumnCount,
    [],
  ).map((cell, columnIndex) =>
    hasHeaderLengthLimits
      ? tableCellAtDensity(
          cell,
          density,
          `Column ${columnIndex + 1}`,
          limits.header.minimum,
          limits.header.maximum,
        )
      : cloneLayout(cell),
  );
  next.columns = columns;

  const fallbackRow = columns.map((column) => {
    const cell = cloneLayout(column);
    if (isRecord(cell)) updateTextRuns(cell, "");
    return cell;
  });
  const rowSource = sourceRows.length > 0 ? sourceRows : [fallbackRow];
  next.rows = repeatedItemsAtDensity(rowSource, targetRowCount, false).map(
    (row, rowIndex) =>
      tableCellsAtDensity(readArray(row), targetColumnCount, fallbackRow).map(
        (cell, columnIndex) =>
          hasCellLengthLimits
            ? tableCellAtDensity(
                cell,
                density,
                `Cell ${rowIndex + 1}-${columnIndex + 1}`,
                limits.body.minimum,
                limits.body.maximum,
              )
            : cloneLayout(cell),
      ),
  );
  return next;
}

function tableDensityCanChange(value: UnknownRecord) {
  if (readString(value.type) !== "table" || value.decorative !== false) {
    return false;
  }

  const currentColumns = readArray(value.columns).length;
  const currentRows = readArray(value.rows).length;
  const columnMinimum = readNumber(value.min_columns);
  const columnMaximum = readNumber(value.max_columns);
  const rowMinimum = readNumber(value.min_rows);
  const rowMaximum = readNumber(value.max_rows);
  if (
    densityTargetCount(
      "Low",
      currentColumns,
      columnMinimum,
      columnMaximum,
    ) !==
      densityTargetCount(
        "High",
        currentColumns,
        columnMinimum,
        columnMaximum,
      ) ||
    densityTargetCount("Low", currentRows, rowMinimum, rowMaximum) !==
      densityTargetCount("High", currentRows, rowMinimum, rowMaximum)
  ) {
    return true;
  }

  const limits = tableTextLimits(value);
  return (
    limits.header.minimum !== limits.header.maximum ||
    limits.body.minimum !== limits.body.maximum
  );
}

function structuralArrayCanChange(value: unknown): boolean {
  if (!isRecord(value)) return false;
  if (tableDensityCanChange(value)) return true;
  const type = readString(value.type);
  const children = readArray(value.children);

  if (isRepeatableStructuralElement(value)) {
    const currentCount = children.length;
    const minimum =
      type === "group"
        ? Math.floor(currentCount / 2)
        : readNumber(value.min_children);
    const maximum =
      type === "group" ? currentCount : readNumber(value.max_children);
    if (
      densityTargetCount("Low", currentCount, minimum, maximum) !==
      densityTargetCount("High", currentCount, minimum, maximum)
    ) {
      return true;
    }
  }

  return (
    structuralArrayCanChange(value.child) ||
    children.some(structuralArrayCanChange)
  );
}

function componentArrayCanChange(value: unknown): boolean {
  if (!isRecord(value)) return false;
  const elements = readArray(value.elements);
  if (elements.some(structuralArrayCanChange)) return true;

  const allTopLevelGroups =
    elements.length >= 2 &&
    elements.every(
      (element) => isRecord(element) && readString(element.type) === "group",
    );
  if (!allTopLevelGroups) return false;

  return Boolean(
    repeatedChildrenSchema(
      { type: "group", children: elements },
      elements.map(comparableSchemaNodesForElement),
    ),
  );
}

export function hasLayoutContentDensityTargets(layout: TemplateV2Layout) {
  const fields = collectSchemaFields(layout);
  if (
    fields.some(
      (field) =>
        !field.decorative &&
        (field.type === "text" ||
          field.type === "text-list"),
    )
  ) {
    return true;
  }

  const layoutRecord = layout as UnknownRecord;
  return (
    readArray(layoutRecord.elements).some(structuralArrayCanChange) ||
    readArray(layoutRecord.components).some(componentArrayCanChange)
  );
}

function resizeRepeatedChildren(
  element: UnknownRecord,
  density: ContentDensity,
) {
  const type = readString(element.type);
  if (type !== "flex" && type !== "grid" && type !== "group") return;

  const children = readArray(element.children);
  if (!isRepeatableStructuralElement(element)) return;

  const minimum =
    type === "group"
      ? Math.floor(children.length / 2)
      : readNumber(element.min_children);
  const maximum =
    type === "group" ? children.length : readNumber(element.max_children);
  const targetCount = densityTargetCount(
    density,
    children.length,
    minimum,
    maximum,
  );
  if (targetCount === children.length) return;

  element.children = repeatedItemsAtDensity(
    children,
    targetCount,
    type === "group",
  );
}

function resizeRepeatedComponentElements(
  component: UnknownRecord,
  density: ContentDensity,
) {
  const elements = readArray(component.elements);
  const allTopLevelGroups =
    elements.length > 0 &&
    elements.every(
      (element) => isRecord(element) && readString(element.type) === "group",
    );
  if (!allTopLevelGroups) return;

  const repeatedSchema = repeatedChildrenSchema(
    { type: "group", children: elements },
    elements.map(comparableSchemaNodesForElement),
  );
  if (!repeatedSchema) return;

  component.elements = repeatedItemsAtDensity(
    elements,
    densityTargetCount(
      density,
      elements.length,
      Math.floor(elements.length / 2),
      elements.length,
    ),
    true,
  );
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
          minItems: readNumber(element.min_items),
          maxItems: readNumber(element.max_items),
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
