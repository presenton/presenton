import type {
  GanttInfographicData,
  GanttInfographicItem,
  GanttInfographicPosition,
  InfographicIcon,
  InfographicType,
} from "@/components/slide-editor/types";
import { defaultInfographicIcon } from "@/components/slide-editor/infographics/infographic-icons";

const DEFAULT_PALETTE = [
  "FFFFFF",
  "102E79",
  "24468E",
  "385EAA",
  "4D73BE",
  "6388D0",
  "7CA2E5",
  "9AC8ED",
  "B5DCF4",
  "CBEAF7",
];

type InfographicRecord = Record<string, unknown>;

export type InfographicToolbarItemStats = {
  canAdd: boolean;
  canRemove: boolean;
  count: number;
};

export type InfographicItemOffset = {
  x: number;
  y: number;
};

export type InfographicChildTargetKind = "icon" | "image" | "shape" | "text";

const INFOGRAPHIC_ITEM_LIMITS: Partial<
  Record<InfographicType, { min: number; max: number; step?: number }>
> = {
  before_after: { min: 2, max: 10, step: 2 },
  comparison_matrix: { min: 1, max: 6 },
  customer_journey: { min: 4, max: 6 },
  impact_effort_matrix: { min: 4, max: 4 },
  org_chart: { min: 1, max: 16 },
  decision_tree: { min: 1, max: 16 },
  pillar_framework: { min: 3, max: 7 },
  pyramid: { min: 3, max: 4 },
  risk_matrix: { min: 4, max: 4 },
  segmented_wheel: { min: 3, max: 6 },
  transformation_hub: { min: 2, max: 8 },
};

const DEFAULT_ITEM_LIMIT = { min: 1, max: 8, step: 1 };

function readInfographicRecord(value: unknown): InfographicRecord | null {
  return value != null && typeof value === "object" && !Array.isArray(value)
    ? (value as InfographicRecord)
    : null;
}

function readInfographicArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

export function infographicItemAtPath(
  data: unknown,
  itemPath: number[],
  collection: "items" | "rows" = "items",
): InfographicRecord | null {
  let items = readInfographicArray(readInfographicRecord(data)?.[collection]);
  let item: InfographicRecord | null = null;
  for (const index of itemPath) {
    item = readInfographicRecord(items[index]);
    if (!item) return null;
    items = readInfographicArray(item.items);
  }
  return item;
}

export function infographicItemOffset(value: unknown): InfographicItemOffset {
  const item = readInfographicRecord(value);
  const offset = readInfographicRecord(item?.__presenton_offset);
  return {
    x: readInfographicNumber(offset?.x, 0),
    y: readInfographicNumber(offset?.y, 0),
  };
}

export function infographicChildOffset(
  value: unknown,
  kind: InfographicChildTargetKind,
  field?: string,
): InfographicItemOffset {
  const item = readInfographicRecord(value);
  const offsets = readInfographicRecord(item?.__presenton_child_offsets);
  const offset = readInfographicRecord(offsets?.[infographicChildOffsetKey(kind, field)]);
  return {
    x: readInfographicNumber(offset?.x, 0),
    y: readInfographicNumber(offset?.y, 0),
  };
}

export function infographicChildOffsetKey(
  kind: InfographicChildTargetKind,
  field?: string,
) {
  return `${kind}:${field ?? kind}`;
}

export function replaceInfographicItemFields(
  data: unknown,
  itemPath: number[],
  fields: InfographicRecord,
  collection: "items" | "rows" = "items",
): unknown {
  const record = readInfographicRecord(data);
  if (!record || itemPath.length === 0) return data;

  const replaceAtDepth = (items: unknown[], depth: number): unknown[] => {
    const index = itemPath[depth];
    const item = readInfographicRecord(items[index]);
    if (!item) return items;
    const next = [...items];
    next[index] =
      depth === itemPath.length - 1
        ? { ...item, ...fields }
        : {
            ...item,
            items: replaceAtDepth(readInfographicArray(item.items), depth + 1),
          };
    return next;
  };

  return {
    ...record,
    [collection]: replaceAtDepth(readInfographicArray(record[collection]), 0),
  };
}

export function replaceInfographicItemIcon(
  data: unknown,
  itemPath: number[],
  iconUrl: string,
  collection: "items" | "rows" = "items",
): unknown {
  const item = infographicItemAtPath(data, itemPath, collection);
  const currentIcon = normalizeInfographicIcon(item?.icon, item?.color);
  return replaceInfographicItemFields(data, itemPath, {
    icon: { url: iconUrl, color: currentIcon?.color ?? "FFFFFF" },
    color: undefined,
  }, collection);
}

export function replaceInfographicItemIconColor(
  data: unknown,
  itemPath: number[],
  color: string,
  collection: "items" | "rows" = "items",
): unknown {
  const item = infographicItemAtPath(data, itemPath, collection);
  const currentIcon = normalizeInfographicIcon(item?.icon, item?.color);
  if (!currentIcon) return data;
  return replaceInfographicItemFields(data, itemPath, {
    icon: { ...currentIcon, color },
    color: undefined,
  }, collection);
}

export function replaceInfographicItemText(
  data: unknown,
  itemPath: number[],
  field: string,
  value: string,
  collection: "items" | "rows" = "items",
): unknown {
  if (!field || field.startsWith("__")) return data;
  const [arrayField, arrayIndexValue] = field.split(".");
  const arrayIndex = Number(arrayIndexValue);
  if (arrayField && Number.isInteger(arrayIndex) && arrayIndex >= 0) {
    if (itemPath.length === 0) {
      const record = readInfographicRecord(data);
      if (!record) return data;
      const values = readInfographicArray(record[arrayField]);
      return {
        ...record,
        [arrayField]: values.map((current, index) =>
          index === arrayIndex ? value : current,
        ),
      };
    }
    const item = infographicItemAtPath(data, itemPath, collection);
    if (!item) return data;
    const values = readInfographicArray(item[arrayField]);
    return replaceInfographicItemFields(data, itemPath, {
      [arrayField]: values.map((current, index) =>
        index === arrayIndex ? value : current,
      ),
    }, collection);
  }
  if (itemPath.length === 0) {
    const record = readInfographicRecord(data);
    return record ? { ...record, [field]: value } : data;
  }
  return replaceInfographicItemFields(
    data,
    itemPath,
    { [field]: value },
    collection,
  );
}

export function replaceInfographicImage(
  data: unknown,
  itemPath: number[],
  field: string,
  value: string,
  collection: "items" | "rows" = "items",
): unknown {
  return replaceInfographicItemText(data, itemPath, field, value, collection);
}

export function replaceInfographicImageSettings(
  data: unknown,
  itemPath: number[],
  field: string,
  settings: InfographicRecord,
  collection: "items" | "rows" = "items",
): unknown {
  const settingsField = `${field}_settings`;
  if (itemPath.length === 0) {
    const record = readInfographicRecord(data);
    return record ? { ...record, [settingsField]: settings } : data;
  }
  return replaceInfographicItemFields(data, itemPath, {
    [settingsField]: settings,
  }, collection);
}

export function setInfographicItemOffset(
  data: unknown,
  itemPath: number[],
  offset: InfographicItemOffset,
  collection: "items" | "rows" = "items",
): unknown {
  return replaceInfographicItemFields(data, itemPath, {
    __presenton_offset: {
      x: Math.round(offset.x * 100) / 100,
      y: Math.round(offset.y * 100) / 100,
    },
  }, collection);
}

export function setInfographicChildOffset(
  data: unknown,
  itemPath: number[],
  kind: InfographicChildTargetKind,
  field: string | undefined,
  offset: InfographicItemOffset,
  collection: "items" | "rows" = "items",
): unknown {
  const item = infographicItemAtPath(data, itemPath, collection);
  if (!item) return data;
  const offsets = readInfographicRecord(item.__presenton_child_offsets) ?? {};
  return replaceInfographicItemFields(
    data,
    itemPath,
    {
      __presenton_child_offsets: {
        ...offsets,
        [infographicChildOffsetKey(kind, field)]: {
          x: Math.round(offset.x * 100) / 100,
          y: Math.round(offset.y * 100) / 100,
        },
      },
    },
    collection,
  );
}

export function setInfographicItemUngrouped(
  data: unknown,
  itemPath: number[],
  ungrouped: boolean,
  collection: "items" | "rows" = "items",
): unknown {
  return replaceInfographicItemFields(data, itemPath, {
    __presenton_ungrouped: ungrouped || undefined,
  }, collection);
}

export function isInfographicItemUngrouped(value: unknown): boolean {
  return readInfographicRecord(value)?.__presenton_ungrouped === true;
}

export function isInfographicMainUngrouped(data: unknown): boolean {
  return readInfographicRecord(data)?.__presenton_items_ungrouped === true;
}

export function setInfographicMainUngrouped(
  data: unknown,
  ungrouped: boolean,
): unknown {
  const record = readInfographicRecord(data);
  return record
    ? {
        ...record,
        __presenton_items_ungrouped: ungrouped || undefined,
      }
    : data;
}

export function normalizeInfographicIcon(
  value: unknown,
  legacyColor?: unknown,
): InfographicIcon | null {
  const record = readInfographicRecord(value);
  const url =
    typeof value === "string"
      ? value.trim()
      : typeof record?.url === "string"
        ? record.url.trim()
        : "";
  if (!url) return null;
  const color =
    typeof record?.color === "string" && record.color.trim()
      ? record.color
      : typeof legacyColor === "string" && legacyColor.trim()
        ? legacyColor
        : "FFFFFF";
  return { url, color };
}

export function infographicToolbarItemStats(
  data: unknown,
): InfographicToolbarItemStats | null {
  const record = readInfographicRecord(data);
  const type = infographicType(record?.type);
  const collection = type === "gantt" ? record?.rows : record?.items;
  if (!record || !type || !Array.isArray(collection)) return null;

  const items = infographicToolbarItems(record, type).items;
  const limits = INFOGRAPHIC_ITEM_LIMITS[type] ?? DEFAULT_ITEM_LIMIT;
  const step = limits.step ?? 1;
  return {
    canAdd: items.length + step <= limits.max,
    canRemove: items.length - step >= limits.min,
    count: items.length,
  };
}

export function addInfographicToolbarItem(data: unknown): unknown {
  const record = readInfographicRecord(data);
  const type = infographicType(record?.type);
  const stats = infographicToolbarItemStats(record);
  if (!record || !type || !stats?.canAdd) return data;

  const collection = infographicToolbarItems(record, type);
  const items = collection.items;
  const step = (INFOGRAPHIC_ITEM_LIMITS[type] ?? DEFAULT_ITEM_LIMIT).step ?? 1;
  const nextItems = [...items];
  for (let offset = 0; offset < step; offset += 1) {
    nextItems.push(createInfographicToolbarItem(type, nextItems, record));
  }
  return collection.write(nextItems);
}

export function canInsertInfographicItemAfterPath(
  data: unknown,
  itemPath: number[],
  collection: "items" | "rows" = "items",
): boolean {
  const record = readInfographicRecord(data);
  const type = infographicType(record?.type);
  if (!record || !type || itemPath.length === 0) return false;

  let siblings = readInfographicArray(record[collection]);
  for (let depth = 0; depth < itemPath.length - 1; depth += 1) {
    const item = readInfographicRecord(siblings[itemPath[depth]]);
    if (!item) return false;
    siblings = readInfographicArray(item.items);
  }
  const selectedIndex = itemPath.at(-1);
  if (selectedIndex == null || !readInfographicRecord(siblings[selectedIndex])) {
    return false;
  }
  const maximum = (INFOGRAPHIC_ITEM_LIMITS[type] ?? DEFAULT_ITEM_LIMIT).max;
  return siblings.length < maximum;
}

export function insertInfographicItemAfterPath(
  data: unknown,
  itemPath: number[],
  collection: "items" | "rows" = "items",
): unknown {
  const record = readInfographicRecord(data);
  const type = infographicType(record?.type);
  if (
    !record ||
    !type ||
    !canInsertInfographicItemAfterPath(record, itemPath, collection)
  ) {
    return data;
  }

  if ((type === "org_chart" || type === "decision_tree") && itemPath.length === 1) {
    const items = readInfographicArray(record[collection]);
    const selectedIndex = itemPath[0];
    const parent = readInfographicRecord(items[selectedIndex]);
    if (!parent) return data;
    const created = createInfographicToolbarItem(type, items, record);
    const parentId =
      typeof parent.id === "string" && parent.id.trim()
        ? parent.id
        : `node-${selectedIndex}`;
    const normalizedItems = items.map((item, index) => {
      const current = readInfographicRecord(item);
      return index === selectedIndex && current?.id !== parentId
        ? { ...current, id: parentId }
        : item;
    });
    normalizedItems.splice(selectedIndex + 1, 0, {
      ...created,
      parent_id: parentId,
    });
    return { ...record, [collection]: normalizedItems };
  }

  const insertAtDepth = (items: unknown[], depth: number): unknown[] => {
    const selectedIndex = itemPath[depth];
    const selected = readInfographicRecord(items[selectedIndex]);
    if (!selected) return items;
    if (depth < itemPath.length - 1) {
      const next = [...items];
      next[selectedIndex] = {
        ...selected,
        items: insertAtDepth(readInfographicArray(selected.items), depth + 1),
      };
      return next;
    }
    const next = [...items];
    next.splice(
      selectedIndex + 1,
      0,
      createInfographicToolbarItem(type, items, record),
    );
    return next;
  };

  return {
    ...record,
    [collection]: insertAtDepth(readInfographicArray(record[collection]), 0),
  };
}

export function removeLastInfographicToolbarItem(data: unknown): unknown {
  const record = readInfographicRecord(data);
  const type = infographicType(record?.type);
  const stats = infographicToolbarItemStats(record);
  if (!record || !type || !stats?.canRemove) return data;

  const collection = infographicToolbarItems(record, type);
  const items = collection.items;
  const step = (INFOGRAPHIC_ITEM_LIMITS[type] ?? DEFAULT_ITEM_LIMIT).step ?? 1;
  const removedIds = new Set(
    items
      .slice(Math.max(0, items.length - step))
      .map((item) => readInfographicRecord(item)?.id)
      .filter((id): id is string => typeof id === "string"),
  );
  const remaining = items.slice(0, -step).map((item) => {
    const itemRecord = readInfographicRecord(item);
    if (!itemRecord || !removedIds.has(String(itemRecord.parent_id ?? ""))) {
      return item;
    }
    return { ...itemRecord, parent_id: null };
  });
  return collection.write(remaining);
}

export function removeInfographicItemAtPath(
  data: unknown,
  itemPath: number[],
  collection: "items" | "rows" = "items",
): unknown {
  const record = readInfographicRecord(data);
  if (
    !record ||
    !canRemoveInfographicItemAtPath(record, itemPath, collection)
  ) {
    return data;
  }

  const removeAtDepth = (items: unknown[], depth: number): unknown[] => {
    const index = itemPath[depth];
    const item = readInfographicRecord(items[index]);
    if (!item) return items;
    if (depth < itemPath.length - 1) {
      const next = [...items];
      next[index] = {
        ...item,
        items: removeAtDepth(readInfographicArray(item.items), depth + 1),
      };
      return next;
    }

    const removedId = readInfographicRecord(items[index])?.id;
    return items
      .filter((_, itemIndex) => itemIndex !== index)
      .map((entry) => {
        const current = readInfographicRecord(entry);
        return current &&
          typeof removedId === "string" &&
          current.parent_id === removedId
          ? { ...current, parent_id: null }
          : entry;
      });
  };

  return {
    ...record,
    [collection]: removeAtDepth(readInfographicArray(record[collection]), 0),
  };
}

export function canRemoveInfographicItemAtPath(
  data: unknown,
  itemPath: number[],
  collection: "items" | "rows" = "items",
): boolean {
  const record = readInfographicRecord(data);
  const type = infographicType(record?.type);
  if (!record || !type || itemPath.length === 0) return false;

  let siblings = readInfographicArray(record[collection]);
  for (let depth = 0; depth < itemPath.length - 1; depth += 1) {
    const item = readInfographicRecord(siblings[itemPath[depth]]);
    if (!item) return false;
    siblings = readInfographicArray(item.items);
  }
  const selectedIndex = itemPath.at(-1);
  if (selectedIndex == null || !readInfographicRecord(siblings[selectedIndex])) {
    return false;
  }
  const minimum = (INFOGRAPHIC_ITEM_LIMITS[type] ?? DEFAULT_ITEM_LIMIT).min;
  return siblings.length > minimum;
}

function createInfographicToolbarItem(
  type: InfographicType,
  items: unknown[],
  data: InfographicRecord,
): InfographicRecord {
  const index = items.length;
  const previous = readInfographicRecord(items.at(-1));
  const icon = defaultInfographicIcon(index);

  switch (type) {
    case "gantt":
      return { label: `Workstream ${index + 1}`, items: [] };
    case "org_chart":
    case "decision_tree": {
      const root = readInfographicRecord(items[0]);
      return {
        id: `node-${Date.now().toString(36)}-${index + 1}`,
        parent_id: typeof root?.id === "string" ? root.id : null,
        heading: "New item",
        description: type === "org_chart" ? "Role" : null,
      };
    }
    case "comparison_matrix":
      return {
        icon,
        heading: `Option ${index + 1}`,
        values: readInfographicArray(data.criteria).map(() => ""),
      };
    case "mind_map":
      return {
        icon,
        heading: `Node ${index + 1}`,
        description: "Add a description.",
        items: [],
      };
    case "before_after": {
      const pair = Math.floor(index / 2) + 1;
      return {
        icon,
        heading: `${index % 2 === 0 ? "Before" : "After"} ${pair}`,
        description: "Add a description.",
      };
    }
    case "conversion_funnel":
    case "vertical_funnel":
      return {
        value: Math.max(0, readInfographicNumber(previous?.value, 60) - 10),
        heading: `Stage ${index + 1}`,
        description: "Add a description.",
      };
    case "pillar_framework":
      return {
        icon,
        heading: `Pillar ${index + 1}`,
        description: "Add a description.",
        focus: "Focus area",
      };
    case "transformation_hub":
      return { heading: `Capability ${index + 1}` };
    default:
      return {
        icon: typeUsesToolbarIcons(type) ? icon : null,
        heading: toolbarItemHeading(type, index, previous),
        description: "Add a description.",
      };
  }
}

function toolbarItemHeading(
  type: InfographicType,
  index: number,
  previous: InfographicRecord | null,
) {
  if (type === "milestone_timeline") {
    const previousHeading = Number(previous?.heading);
    return Number.isFinite(previousHeading)
      ? String(previousHeading + 1)
      : `Milestone ${index + 1}`;
  }
  if (type === "stair_step_blocks") {
    return `Step ${String(index + 1).padStart(2, "0")}`;
  }
  if (type === "pillar_framework") return `Pillar ${index + 1}`;
  if (type === "transformation_hub") return `Capability ${index + 1}`;
  if (type === "conversion_funnel" || type === "vertical_funnel") return `Stage ${index + 1}`;
  if (type === "roadmap") return `Stop ${index + 1}`;
  if (type === "pyramid") return `Level ${index + 1}`;
  if (type === "segmented_wheel") return `Segment ${index + 1}`;
  if (type === "customer_journey") return `Stage ${index}`;
  if (type === "diagonal_circles") return `Pillar ${index + 1}`;
  if (type === "maturity_model") return `Level ${index + 1}`;
  if (type === "supply_chain") return `Stage ${index + 1}`;
  return `Step ${index + 1}`;
}

function typeUsesToolbarIcons(type: InfographicType) {
  return !(
    type === "roadmap" ||
    type === "milestone_timeline" ||
    type === "chevron_process" ||
    type === "radial_cycle" ||
    type === "conversion_funnel" ||
    type === "vertical_funnel" ||
    type === "transformation_hub"
  );
}

function infographicToolbarItems(
  data: InfographicRecord,
  type: InfographicType,
): {
  items: unknown[];
  write: (items: unknown[]) => InfographicRecord;
} {
  const items = readInfographicArray(data.items);
  if (type === "gantt") {
    return {
      items: readInfographicArray(data.rows),
      write: (nextItems) => ({ ...data, rows: nextItems }),
    };
  }
  if (type !== "mind_map" || items.length !== 1) {
    return {
      items,
      write: (nextItems) => ({ ...data, items: nextItems }),
    };
  }

  const root = readInfographicRecord(items[0]);
  const nested = root ? readInfographicArray(root.items) : [];
  if (!root || nested.length === 0) {
    return {
      items,
      write: (nextItems) => ({ ...data, items: nextItems }),
    };
  }
  return {
    items: nested,
    write: (nextItems) => ({
      ...data,
      items: [{ ...root, items: nextItems }],
    }),
  };
}

function readInfographicNumber(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function infographicType(value: unknown): InfographicType | null {
  return typeof value === "string" &&
    [
      "progress_bar", "gauge", "gantt", "timeline", "roadmap",
      "milestone_timeline", "staircase", "supply_chain",
      "stair_step_blocks", "maturity_model", "diagonal_circles",
      "pillar_framework", "transformation_hub", "risk_matrix",
      "chevron_process", "radial_cycle", "conversion_funnel", "vertical_funnel", "pyramid",
      "segmented_wheel", "customer_journey", "before_after",
      "impact_effort_matrix", "comparison_matrix", "org_chart",
      "decision_tree", "mind_map",
    ].includes(value)
    ? (value as InfographicType)
    : null;
}

export function normalizeInfographicColors(
  colors: unknown,
  type: InfographicType,
): string[] {
  const normalized = Array.isArray(colors)
    ? colors.filter(
        (color): color is string =>
          typeof color === "string" && color.trim().length > 0,
      )
    : [];
  const minimum = 2;
  const defaults =
    type === "progress_bar" || type === "gauge"
      ? ["E5E7EB", "2563EB"]
      : DEFAULT_PALETTE;
  const next = normalized.slice(0, 24);
  while (next.length < minimum) {
    next.push(defaults[next.length] ?? "2563EB");
  }
  return next;
}

export function appendInfographicColor(colors: string[]): string[] {
  const nextColor =
    DEFAULT_PALETTE[colors.length % DEFAULT_PALETTE.length] ?? "2563EB";
  return [...colors, nextColor];
}

export function removeInfographicColor(
  colors: string[],
  index: number,
): string[] {
  if (colors.length <= 2 || index < 0 || index >= colors.length) return colors;
  return colors.filter((_, colorIndex) => colorIndex !== index);
}

export function moveCollectionItem<T>(
  items: T[],
  index: number,
  direction: -1 | 1,
): T[] {
  const target = index + direction;
  if (index < 0 || index >= items.length || target < 0 || target >= items.length) {
    return items;
  }
  const next = [...items];
  const [moved] = next.splice(index, 1);
  if (moved == null) return items;
  next.splice(target, 0, moved);
  return next;
}

export function removeGanttColumn(
  data: GanttInfographicData,
  index: number,
): GanttInfographicData {
  if (data.columns.length <= 1 || index < 0 || index >= data.columns.length) {
    return data;
  }
  const nextColumnCount = data.columns.length - 1;
  return {
    ...data,
    columns: data.columns.filter((_, columnIndex) => columnIndex !== index),
    rows: data.rows.map((row) => ({
      ...row,
      items: row.items.map((item) =>
        normalizeGanttItem(
          {
            ...item,
            start: ganttUnitsToPosition(
              unitsAfterColumnRemoval(ganttPositionToUnits(item.start), index),
              nextColumnCount,
            ),
            end: ganttUnitsToPosition(
              unitsAfterColumnRemoval(ganttPositionToUnits(item.end), index),
              nextColumnCount,
            ),
          },
          nextColumnCount,
        ),
      ),
    })),
  };
}

export function normalizeGanttItem(
  item: GanttInfographicItem,
  columnCount: number,
): GanttInfographicItem {
  const count = Math.max(1, columnCount);
  const startUnits = clamp(ganttPositionToUnits(item.start), 0, count);
  const endUnits = clamp(
    ganttPositionToUnits(item.end),
    Math.min(count, startUnits + 0.05),
    count,
  );
  return {
    ...item,
    start: ganttUnitsToPosition(startUnits, count),
    end: ganttUnitsToPosition(endUnits, count),
  };
}

export function ganttPositionToUnits(position: GanttInfographicPosition): number {
  const column = Number.isFinite(position.column) ? position.column : 0;
  const offset = Number.isFinite(position.offset) ? position.offset : 0;
  return column + offset;
}

export function ganttUnitsToPosition(
  units: number,
  columnCount: number,
): GanttInfographicPosition {
  const count = Math.max(1, columnCount);
  const safeUnits = clamp(units, 0, count);
  if (safeUnits >= count) {
    return { column: count - 1, offset: 1 };
  }
  const column = Math.floor(safeUnits);
  return {
    column,
    offset: Math.round((safeUnits - column) * 100) / 100,
  };
}

function unitsAfterColumnRemoval(units: number, removedIndex: number): number {
  if (units <= removedIndex) return units;
  if (units >= removedIndex + 1) return units - 1;
  return removedIndex;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}
