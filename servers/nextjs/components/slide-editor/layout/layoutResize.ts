import {
  childCrossSize,
  flexBasis,
  flowLayoutKind,
  isFlowLayoutElement,
  placeGridChildren,
  type FlowLayoutDeps,
} from "@/components/slide-editor/layout/flowLayout";

type RawRecord = Record<string, any>;
type Direction = "row" | "column";

export type LayoutItemResizeBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type Size = {
  width: number;
  height: number;
};

type Point = {
  x: number;
  y: number;
};

type Padding = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

type ChildArrayInfo = {
  key: "children" | "elements" | "child";
  items: unknown[];
};

export type LayoutItemResizeDeps = FlowLayoutDeps & {
  childrenBounds: (children: unknown[]) => Size;
  normalizeLayoutChildren: (
    element: RawRecord,
    parentBox: LayoutItemResizeBox,
  ) => RawRecord;
};

const MIN_EMPTY_LAYOUT_SIZE = 24;

export function updateComponentLayoutElement(
  component: RawRecord,
  elementPath: number[],
  changes: Record<string, unknown>,
  fallbackAbsoluteBox: LayoutItemResizeBox,
  deps: LayoutItemResizeDeps,
): RawRecord {
  const currentElements = readArray(component.elements);
  const currentElement = getElementFromArray(currentElements, elementPath);
  if (!currentElement) return component;

  const componentOrigin = readPoint(component.position);
  const currentBox = {
    ...fallbackAbsoluteBox,
    x: fallbackAbsoluteBox.x - componentOrigin.x,
    y: fallbackAbsoluteBox.y - componentOrigin.y,
  };
  const mergedElement = {
    ...currentElement,
    ...changes,
  };
  const itemCountDelta = layoutElementItemCountDelta(
    currentElement,
    mergedElement,
  );
  const resizedElement = layoutElementWithAdjustedItemSpace(
    currentElement,
    mergedElement,
    currentBox,
    itemCountDelta,
    deps,
  );
  const nextRenderBox = {
    ...currentBox,
    ...readSize(resizedElement.size, {
      width: currentBox.width,
      height: currentBox.height,
    }),
  };
  const nextElement = deps.normalizeLayoutChildren(resizedElement, nextRenderBox);
  const elements = updateElementArray(
    currentElements,
    elementPath,
    () => nextElement,
  );
  if (elements === currentElements) return component;

  return resizeComponentForLayoutItemChange({ ...component, elements });
}

export function deleteLayoutChildFromArray(elements: unknown[], path: number[]) {
  const [index, ...rest] = path;
  if (!Number.isInteger(index) || index < 0 || index >= elements.length) {
    return elements;
  }
  const current = asRecord(elements[index]);
  const childInfo = current ? childArrayInfo(current) : null;
  if (!current || !childInfo) return elements;
  if (rest.length >= 1 && isFlowLayoutElement(current)) {
    if (childInfo.key === "children") {
      const minChildren = Math.max(0, readNumber(current.min_children) ?? 0);
      if (childInfo.items.length <= minChildren) return elements;
      const updatedChildren = [...childInfo.items];
      updatedChildren.splice(rest[0], 1);
      const next = [...elements];
      next[index] = withUpdatedChildItems(current, childInfo, updatedChildren);
      return next;
    }
  }
  const updatedChildren = deleteLayoutChildFromArray(childInfo.items, rest);
  if (updatedChildren === childInfo.items) return elements;
  const next = [...elements];
  next[index] = withUpdatedChildItems(current, childInfo, updatedChildren);
  return next;
}

function layoutElementWithAdjustedItemSpace(
  previous: RawRecord,
  next: RawRecord,
  currentBox: LayoutItemResizeBox,
  itemCountDelta: number,
  deps: LayoutItemResizeDeps,
): RawRecord {
  const kind = flowLayoutKind(next);
  if (itemCountDelta === 0 || !kind) return next;

  const currentSize = readSize(next.size, {
    width: currentBox.width,
    height: currentBox.height,
  });
  const adjustedSize =
    kind === "flex"
      ? adjustedFlexSize(next, currentSize, itemCountDelta, deps)
      : kind === "grid"
        ? adjustedGridSize(previous, next, currentSize, itemCountDelta)
        : currentSize;

  if (
    adjustedSize.width === currentSize.width &&
    adjustedSize.height === currentSize.height
  ) {
    return next;
  }

  return {
    ...next,
    size: {
      width: Math.max(1, adjustedSize.width),
      height: Math.max(1, adjustedSize.height),
    },
  };
}

function layoutElementItemCountDelta(previous: RawRecord, next: RawRecord) {
  const previousChildren = layoutChildItems(previous);
  const nextChildren = layoutChildItems(next);
  return nextChildren.length - previousChildren.length;
}

function adjustedFlexSize(
  next: RawRecord,
  currentSize: Size,
  itemCountDelta: number,
  deps: LayoutItemResizeDeps,
): Size {
  const nextChildren = layoutChildItems(next).filter(isRecord);
  const padding = readPadding(next.padding);
  if (nextChildren.length === 0) {
    return emptyLayoutSize(padding);
  }

  const direction = readString(next.direction) === "row" ? "row" : "column";
  const isColumn = direction === "column";
  const mainGap =
    (isColumn
      ? readNumber(next.row_gap) ?? readNumber(next.rowGap)
      : readNumber(next.column_gap) ?? readNumber(next.columnGap)) ??
    readNumber(next.gap) ??
    0;
  const crossGap =
    (isColumn
      ? readNumber(next.column_gap) ?? readNumber(next.columnGap)
      : readNumber(next.row_gap) ?? readNumber(next.rowGap)) ??
    readNumber(next.gap) ??
    0;
  const availableMain = Math.max(
    1,
    (isColumn ? currentSize.height : currentSize.width) -
      (isColumn
        ? padding.top + padding.bottom
        : padding.left + padding.right),
  );
  const availableCross = Math.max(
    1,
    (isColumn ? currentSize.width : currentSize.height) -
      (isColumn
        ? padding.left + padding.right
        : padding.top + padding.bottom),
  );

  if (next.wrap === true) {
    const required = wrappedFlexRequiredSpace({
      align: readString(next.align_items) ?? readString(next.alignItems) ?? "stretch",
      availableMain,
      availableCross,
      children: nextChildren,
      crossGap,
      direction,
      mainGap,
      deps,
    });
    const mainAdjustment =
      itemCountDelta > 0
        ? Math.max(0, required.main - availableMain)
        : required.main - availableMain;
    const crossAdjustment =
      itemCountDelta > 0
        ? Math.max(0, required.cross - availableCross)
        : required.cross - availableCross;
    return isColumn
      ? {
          width: currentSize.width + crossAdjustment,
          height: currentSize.height + mainAdjustment,
        }
      : {
          width: currentSize.width + mainAdjustment,
          height: currentSize.height + crossAdjustment,
        };
  }

  const requiredMain =
    nextChildren.reduce(
      (sum, child) =>
        sum + Math.max(1, flexBasis(child, direction, availableCross, deps)),
      0,
    ) +
    mainGap * Math.max(0, nextChildren.length - 1);
  const mainAdjustment =
    itemCountDelta > 0
      ? Math.max(0, requiredMain - availableMain)
      : requiredMain - availableMain;

  return isColumn
    ? { width: currentSize.width, height: currentSize.height + mainAdjustment }
    : { width: currentSize.width + mainAdjustment, height: currentSize.height };
}

function wrappedFlexRequiredSpace({
  align,
  availableCross,
  availableMain,
  children,
  crossGap,
  deps,
  direction,
  mainGap,
}: {
  align: string;
  availableCross: number;
  availableMain: number;
  children: RawRecord[];
  crossGap: number;
  deps: LayoutItemResizeDeps;
  direction: Direction;
  mainGap: number;
}) {
  const lines: RawRecord[][] = [];
  let currentLine: RawRecord[] = [];
  let currentMain = 0;
  let largestMain = 0;

  children.forEach((child) => {
    const basis = Math.max(1, flexBasis(child, direction, availableCross, deps));
    largestMain = Math.max(largestMain, basis);
    const nextMain = currentMain + (currentLine.length > 0 ? mainGap : 0) + basis;
    if (currentLine.length > 0 && nextMain > availableMain) {
      lines.push(currentLine);
      currentLine = [];
      currentMain = 0;
    }
    currentLine.push(child);
    currentMain += (currentLine.length > 1 ? mainGap : 0) + basis;
  });
  if (currentLine.length > 0) lines.push(currentLine);

  const requiredCross =
    lines.reduce((sum, line) => {
      const lineCross = line.reduce(
        (max, child) =>
          Math.max(
            max,
            childCrossSize(child, direction, availableCross, align, deps),
          ),
        1,
      );
      return sum + lineCross;
    }, 0) + crossGap * Math.max(0, lines.length - 1);

  return {
    main: Math.max(availableMain, largestMain),
    cross: requiredCross,
  };
}

function adjustedGridSize(
  previous: RawRecord,
  next: RawRecord,
  currentSize: Size,
  itemCountDelta: number,
): Size {
  const previousChildren = layoutChildItems(previous).filter(isRecord);
  const nextChildren = layoutChildItems(next).filter(isRecord);
  const padding = readPadding(next.padding);
  if (nextChildren.length === 0) {
    return emptyLayoutSize(padding);
  }

  const gap = readNumber(next.gap) ?? 0;
  const rowGap = readNumber(next.row_gap) ?? readNumber(next.rowGap) ?? gap;
  const previousColumns = gridColumnCount(previous);
  const nextColumns = gridColumnCount(next);
  const previousDeclaredRows = gridDeclaredRows(previous);
  const nextDeclaredRows = gridDeclaredRows(next);
  const previousRows = gridRowCount(
    previousChildren,
    previousColumns,
    previousDeclaredRows,
  );
  const nextRows = gridRowCount(nextChildren, nextColumns, nextDeclaredRows);
  if (nextRows === previousRows) return currentSize;
  if (itemCountDelta > 0 && nextRows < previousRows) return currentSize;
  if (itemCountDelta < 0 && nextRows > previousRows) return currentSize;

  const availableHeight = Math.max(
    1,
    currentSize.height - padding.top - padding.bottom,
  );
  const currentRowHeight = Math.max(
    1,
    (availableHeight - rowGap * Math.max(0, previousRows - 1)) / previousRows,
  );
  const rowDelta = nextRows - previousRows;
  return {
    width: currentSize.width,
    height: currentSize.height + rowDelta * (currentRowHeight + rowGap),
  };
}

function gridColumnCount(element: RawRecord) {
  const explicitColumns = readArray(element.columns);
  const columnCount =
    readNumber(element.columns) ??
    (explicitColumns.length > 0 ? explicitColumns.length : 1);
  return Math.max(1, Math.floor(columnCount));
}

function gridDeclaredRows(element: RawRecord) {
  const explicitRows = readArray(element.rows);
  return readNumber(element.rows) ??
    (explicitRows.length > 0 ? explicitRows.length : null);
}

function gridRowCount(
  children: RawRecord[],
  columns: number,
  declaredRows: number | null,
) {
  if (children.length === 0) return Math.max(1, declaredRows ?? 1);
  const placements = placeGridChildren(children, columns, declaredRows);
  return Math.max(
    declaredRows ?? 1,
    ...placements.map((placement) => placement.row + placement.rowSpan),
  );
}

function emptyLayoutSize(padding: Padding): Size {
  return {
    width: Math.max(MIN_EMPTY_LAYOUT_SIZE, padding.left + padding.right),
    height: Math.max(MIN_EMPTY_LAYOUT_SIZE, padding.top + padding.bottom),
  };
}

function resizeComponentForLayoutItemChange(
  component: RawRecord,
): RawRecord {
  const { size, ...componentWithoutSize } = component;
  void size;
  return {
    ...componentWithoutSize,
  };
}

function getElementFromArray(elements: unknown[], path: number[]): RawRecord | null {
  const [index, ...rest] = path;
  const current = asRecord(elements[index]);
  if (!current) return null;
  if (rest.length === 0) return current;
  const childInfo = childArrayInfo(current);
  return childInfo ? getElementFromArray(childInfo.items, rest) : null;
}

function updateElementArray(
  elements: unknown[],
  path: number[],
  updater: (element: RawRecord) => RawRecord,
): unknown[] {
  if (path.length === 0) return elements;
  const [index, ...rest] = path;
  const current = asRecord(elements[index]);
  if (!current) return elements;
  if (rest.length === 0) {
    const updated = updater(current);
    if (updated === current) return elements;
    const next = [...elements];
    next[index] = updated;
    return next;
  }
  const childInfo = childArrayInfo(current);
  if (!childInfo) return elements;
  const updatedChildren = updateElementArray(childInfo.items, rest, updater);
  if (updatedChildren === childInfo.items) return elements;
  const next = [...elements];
  next[index] = withUpdatedChildItems(current, childInfo, updatedChildren);
  return next;
}

function childArrayInfo(element: RawRecord): ChildArrayInfo | null {
  if (Array.isArray(element.children)) return { key: "children", items: element.children };
  if (Array.isArray(element.elements)) return { key: "elements", items: element.elements };
  if (isRecord(element.child)) return { key: "child", items: [element.child] };
  return null;
}

function layoutChildItems(element: RawRecord): unknown[] {
  if (Array.isArray(element.children)) return element.children;
  if (Array.isArray(element.elements)) return element.elements;
  return [];
}

function withUpdatedChildItems(
  element: RawRecord,
  childInfo: ChildArrayInfo,
  updatedChildren: unknown[],
) {
  if (childInfo.key === "child") {
    return { ...element, child: updatedChildren[0] ?? null };
  }
  return { ...element, [childInfo.key]: updatedChildren };
}

function emptyRecord(value: unknown): RawRecord {
  return asRecord(value) ?? {};
}

function readPadding(value: unknown): Padding {
  if (typeof value === "number") {
    return { top: value, right: value, bottom: value, left: value };
  }
  const record = emptyRecord(value);
  const x = readNumber(record.x) ?? readNumber(record.horizontal);
  const y = readNumber(record.y) ?? readNumber(record.vertical);
  return {
    top: readNumber(record.top) ?? y ?? 0,
    right: readNumber(record.right) ?? x ?? 0,
    bottom: readNumber(record.bottom) ?? y ?? 0,
    left: readNumber(record.left) ?? x ?? 0,
  };
}

function readPoint(value: unknown): Point {
  const record = emptyRecord(value);
  return {
    x: readNumber(record.x) ?? 0,
    y: readNumber(record.y) ?? 0,
  };
}

function readSize(value: unknown, fallback: Size = { width: 1, height: 1 }): Size {
  const record = emptyRecord(value);
  return {
    width: Math.max(1, readNumber(record.width) ?? fallback.width),
    height: Math.max(1, readNumber(record.height) ?? fallback.height),
  };
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
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}
