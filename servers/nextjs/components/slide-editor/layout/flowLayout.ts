import {
  displayText,
  rawFont,
  rawTextContent,
} from "@/components/slide-editor/text/template-v2-text";
import { layoutWrappedFlexChildren } from "@/components/slide-editor/layout/wrappedFlexLayout";

export type FlowLayoutElement = Record<string, any>;
export type FlowDirection = "row" | "column";
export type FlowLayoutKind = "flex" | "grid";

export type FlowLayoutBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type Size = {
  width: number;
  height: number;
};

type Padding = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

export type FlowLaidOutChild = {
  child: FlowLayoutElement;
  index: number;
  box: FlowLayoutBox | null;
  layoutManaged: boolean;
};

export type FlowLayoutDeps = {
  elementBox: (element: FlowLayoutElement) => FlowLayoutBox;
  elementSize: (element: FlowLayoutElement, fallback?: Size) => Size;
  isManualPositioned: (element: FlowLayoutElement) => boolean;
};

export type GridPlacement = {
  col: number;
  row: number;
  columnSpan: number;
  rowSpan: number;
};

const TEXT_AVERAGE_CHAR_EM = 0.5;
const DECORATIVE_LINE_LENGTH = 80;
const DECORATIVE_LINE_THICKNESS = 4;

export function flowLayoutKind(
  element: FlowLayoutElement,
): FlowLayoutKind | null {
  const type = readString(element.type);
  if (type === "flex" || type === "list-view") return "flex";
  if (type === "grid" || type === "grid-view") return "grid";
  return null;
}

export function isFlowLayoutElement(element: FlowLayoutElement) {
  return flowLayoutKind(element) != null;
}

export function layoutFlowChildren(
  parent: FlowLayoutElement,
  children: FlowLayoutElement[],
  parentBox: FlowLayoutBox,
  deps: FlowLayoutDeps,
): FlowLaidOutChild[] {
  const kind = flowLayoutKind(parent);
  if (kind === "grid") {
    return layoutGridChildren(parent, children, parentBox, deps);
  }
  if (kind === "flex") {
    return layoutFlexChildren(parent, children, parentBox, deps);
  }
  return children.map((child, index) => ({
    child,
    index,
    box: null,
    layoutManaged: false,
  }));
}

export function intrinsicFlowSize(
  parent: FlowLayoutElement,
  children: FlowLayoutElement[],
  deps: Pick<FlowLayoutDeps, "elementBox" | "elementSize" | "isManualPositioned">,
): Size {
  const kind = flowLayoutKind(parent);
  if (kind === "flex") {
    return intrinsicFlexSize(parent, children, deps);
  }
  if (kind === "grid") {
    return intrinsicGridSize(parent, children, deps);
  }
  return { width: 1, height: 1 };
}

export function flexBasis(
  child: FlowLayoutElement,
  direction: FlowDirection,
  crossSize: number,
  deps: FlowLayoutDeps,
) {
  const dimension = direction === "row" ? "width" : "height";
  const explicit = layoutNumber(child, "basis") ?? readOptionalSize(child.size)?.[dimension];
  if (explicit != null && explicit > 0) {
    return clampLayoutSize(explicit, child, dimension);
  }

  if (isFramelessDecorativeShape(child)) {
    return DECORATIVE_LINE_THICKNESS;
  }
  if (readString(child.type) === "text") {
    return clampLayoutSize(
      intrinsicTextMainSize(child, direction, crossSize),
      child,
      dimension,
    );
  }

  const inferred = deps.elementSize(child);
  const size = direction === "row" ? inferred.width : inferred.height;
  return size > 1 ? clampLayoutSize(size, child, dimension) : 0;
}

export function childCrossSize(
  child: FlowLayoutElement,
  direction: FlowDirection,
  crossSize: number,
  alignItems: string,
  deps: FlowLayoutDeps,
) {
  const dimension = direction === "row" ? "height" : "width";
  const alignSelf =
    readString(child.layout?.align_self) ?? readString(child.layout?.alignSelf);
  if (isFramelessDecorativeShape(child)) {
    return clampLayoutSize(
      Math.min(crossSize, DECORATIVE_LINE_LENGTH),
      child,
      dimension,
    );
  }
  if (alignItems === "stretch" && alignSelf == null) {
    return crossSize;
  }
  const explicit = readOptionalSize(child.size)?.[dimension];
  const inferred = deps.elementSize(child, {
    width: direction === "row" ? 1 : crossSize,
    height: direction === "row" ? crossSize : 1,
  })[dimension];
  return clampLayoutSize(explicit ?? inferred ?? crossSize, child, dimension, crossSize);
}

export function placeGridChildren(
  children: FlowLayoutElement[],
  columns: number,
  declaredRows: number | null,
) {
  const occupied = new Set<string>();
  const placements: GridPlacement[] = [];
  let rowLimit = Math.max(1, declaredRows ?? Math.ceil(children.length / columns));

  children.forEach((child) => {
    const columnSpan = Math.min(
      columns,
      Math.max(1, Math.floor(layoutNumber(child, "columnSpan", "column_span") ?? 1)),
    );
    const rowSpan = Math.max(
      1,
      Math.floor(layoutNumber(child, "rowSpan", "row_span") ?? 1),
    );
    let placedRow = 0;
    let placedCol = 0;

    while (true) {
      let placed = false;
      for (let row = 0; row < rowLimit && !placed; row += 1) {
        for (let col = 0; col <= columns - columnSpan; col += 1) {
          if (gridAreaOpen(occupied, row, col, rowSpan, columnSpan)) {
            placed = true;
            placedRow = row;
            placedCol = col;
            break;
          }
        }
      }
      if (placed) break;
      rowLimit += 1;
    }

    markGridArea(occupied, placedRow, placedCol, rowSpan, columnSpan);
    placements.push({
      col: placedCol,
      row: placedRow,
      columnSpan,
      rowSpan,
    });
  });

  return placements;
}

function layoutFlexChildren(
  parent: FlowLayoutElement,
  children: FlowLayoutElement[],
  parentBox: FlowLayoutBox,
  deps: FlowLayoutDeps,
) {
  if (children.length === 0) return [];
  const padding = readPadding(parent.padding);
  const direction = readString(parent.direction) === "row" ? "row" : "column";
  const isColumn = direction === "column";
  const mainGap =
    (isColumn
      ? readNumber(parent.row_gap) ?? readNumber(parent.rowGap)
      : readNumber(parent.column_gap) ?? readNumber(parent.columnGap)) ??
    readNumber(parent.gap) ??
    0;
  const align =
    readString(parent.align_items) ?? readString(parent.alignItems) ?? "stretch";
  const justify =
    readString(parent.justify_content) ??
    readString(parent.justifyContent) ??
    "flex-start";
  const availableW = Math.max(1, parentBox.width - padding.left - padding.right);
  const availableH = Math.max(1, parentBox.height - padding.top - padding.bottom);
  const availableMain = isColumn ? availableH : availableW;
  const availableCross = isColumn ? availableW : availableH;

  if (parent.wrap === true) {
    const crossGap =
      (isColumn
        ? readNumber(parent.column_gap) ?? readNumber(parent.columnGap)
        : readNumber(parent.row_gap) ?? readNumber(parent.rowGap)) ??
      readNumber(parent.gap) ??
      0;
    return layoutWrappedFlexChildren({
      align,
      alignSelf: (child) =>
        readString(child.layout?.align_self) ??
        readString(child.layout?.alignSelf),
      alignmentOffset,
      availableCross,
      availableMain,
      childCrossSize: (child, childDirection, crossSize, alignment) =>
        childCrossSize(child, childDirection, crossSize, alignment, deps),
      children,
      clampLayoutSize,
      crossGap,
      direction,
      elementBox: deps.elementBox,
      flexBasis: (child, childDirection, crossSize) =>
        flexBasis(child, childDirection, crossSize, deps),
      isManualPositioned: deps.isManualPositioned,
      justify,
      layoutNumber,
      mainGap,
      padding,
    });
  }

  const bases = children.map((child) =>
    deps.isManualPositioned(child)
      ? isColumn
        ? deps.elementBox(child).height
        : deps.elementBox(child).width
      : flexBasis(child, direction, availableCross, deps),
  );
  const gapTotal = mainGap * Math.max(0, children.length - 1);
  const freeBeforeFlex =
    Math.max(1, availableMain - gapTotal) -
    bases.reduce((sum, size) => sum + Math.max(0, size), 0);
  let mainSizes = bases.map((basis) => Math.max(0, basis));
  const grows = children.map((child, index) =>
    deps.isManualPositioned(child)
      ? 0
      : layoutNumber(child, "grow") ?? (bases[index] > 0 ? 0 : 1),
  );
  const growTotal = grows.reduce((sum, grow) => sum + grow, 0);

  if (freeBeforeFlex > 0 && growTotal > 0) {
    mainSizes = mainSizes.map(
      (size, index) => size + (freeBeforeFlex * grows[index]) / growTotal,
    );
  } else if (freeBeforeFlex > 0 && justify === "stretch") {
    const flexibleCount = Math.max(
      1,
      children.filter((child) => !deps.isManualPositioned(child)).length,
    );
    mainSizes = mainSizes.map((size, index) =>
      deps.isManualPositioned(children[index])
        ? size
        : size + freeBeforeFlex / flexibleCount,
    );
  }

  const usedMain =
    mainSizes.reduce((sum, size) => sum + size, 0) +
    mainGap * Math.max(0, children.length - 1);
  let cursor = alignmentOffset(justify, availableMain, usedMain);

  return children.map((child, index) => {
    const raw = deps.elementBox(child);
    if (deps.isManualPositioned(child)) {
      cursor += (isColumn ? raw.height : raw.width) + mainGap;
      return { child, index, box: raw, layoutManaged: false };
    }
    const main = clampLayoutSize(mainSizes[index], child, isColumn ? "height" : "width");
    const cross = childCrossSize(child, direction, availableCross, align, deps);
    const alignSelf =
      readString(child.layout?.align_self) ?? readString(child.layout?.alignSelf);
    const crossOffset = alignmentOffset(alignSelf ?? align, availableCross, cross);
    const box = isColumn
      ? {
          x: padding.left + crossOffset,
          y: padding.top + cursor,
          width: cross,
          height: main,
        }
      : {
          x: padding.left + cursor,
          y: padding.top + crossOffset,
          width: main,
          height: cross,
        };
    cursor += main + mainGap;
    return { child, index, box, layoutManaged: true };
  });
}

function layoutGridChildren(
  parent: FlowLayoutElement,
  children: FlowLayoutElement[],
  parentBox: FlowLayoutBox,
  deps: FlowLayoutDeps,
) {
  const padding = readPadding(parent.padding);
  const gap = readNumber(parent.gap) ?? 0;
  const columnGap =
    readNumber(parent.column_gap) ?? readNumber(parent.columnGap) ?? gap;
  const rowGap = readNumber(parent.row_gap) ?? readNumber(parent.rowGap) ?? gap;
  const explicitColumns = readArray(parent.columns);
  const explicitRows = readArray(parent.rows);
  const columnCount =
    readNumber(parent.columns) ??
    (explicitColumns.length > 0
      ? explicitColumns.length
      : 1);
  const safeColumns = Math.max(1, Math.floor(columnCount));
  const declaredRows =
    readNumber(parent.rows) ??
    (explicitRows.length > 0 ? explicitRows.length : null);
  const placements = placeGridChildren(children, safeColumns, declaredRows);
  const rowCount = Math.max(
    declaredRows ?? 1,
    ...placements.map((placement) => placement.row + placement.rowSpan),
  );
  const rowSizingCount = Math.max(1, Math.floor(declaredRows ?? rowCount));
  const availableW = Math.max(1, parentBox.width - padding.left - padding.right);
  const availableH = Math.max(1, parentBox.height - padding.top - padding.bottom);
  const cellW = Math.max(1, (availableW - columnGap * (safeColumns - 1)) / safeColumns);
  const cellH = Math.max(
    1,
    (availableH - rowGap * Math.max(0, rowSizingCount - 1)) / rowSizingCount,
  );

  return children.map((child, index) => {
    const raw = deps.elementBox(child);
    if (deps.isManualPositioned(child)) {
      return { child, index, box: raw, layoutManaged: false };
    }
    const placement = placements[index];
    const area = {
      x: padding.left + placement.col * (cellW + columnGap),
      y: padding.top + placement.row * (cellH + rowGap),
      width: cellW * placement.columnSpan + columnGap * (placement.columnSpan - 1),
      height: cellH * placement.rowSpan + rowGap * (placement.rowSpan - 1),
    };
    const justify =
      readString(child.layout?.align_self) ??
      readString(child.layout?.alignSelf) ??
      readString(parent.justify_items) ??
      readString(parent.justifyItems) ??
      "stretch";
    const align =
      readString(child.layout?.align_self) ??
      readString(child.layout?.alignSelf) ??
      readString(parent.align_items) ??
      readString(parent.alignItems) ??
      "stretch";
    const width =
      justify === "stretch"
        ? area.width
        : clampLayoutSize(raw.width, child, "width", area.width);
    const height =
      align === "stretch"
        ? area.height
        : clampLayoutSize(raw.height, child, "height", area.height);
    return {
      child,
      index,
      box: {
        x: area.x + alignmentOffset(justify, area.width, width),
        y: area.y + alignmentOffset(align, area.height, height),
        width,
        height,
      },
      layoutManaged: true,
    };
  });
}

function intrinsicFlexSize(
  parent: FlowLayoutElement,
  children: FlowLayoutElement[],
  deps: Pick<FlowLayoutDeps, "elementBox" | "elementSize" | "isManualPositioned">,
): Size {
  const padding = readPadding(parent.padding);
  if (children.length === 0) {
    return {
      width: Math.max(1, padding.left + padding.right),
      height: Math.max(1, padding.top + padding.bottom),
    };
  }

  const direction = readString(parent.direction) === "row" ? "row" : "column";
  const isColumn = direction === "column";
  const mainGap =
    (isColumn
      ? readNumber(parent.row_gap) ?? readNumber(parent.rowGap)
      : readNumber(parent.column_gap) ?? readNumber(parent.columnGap)) ??
    readNumber(parent.gap) ??
    0;

  let main = 0;
  let cross = 0;
  children.forEach((child) => {
    const size = intrinsicFlowChildSize(child, deps);
    main += isColumn ? size.height : size.width;
    cross = Math.max(cross, isColumn ? size.width : size.height);
  });
  main += mainGap * Math.max(0, children.length - 1);

  return {
    width: Math.max(1, padding.left + padding.right + (isColumn ? cross : main)),
    height: Math.max(1, padding.top + padding.bottom + (isColumn ? main : cross)),
  };
}

function intrinsicGridSize(
  parent: FlowLayoutElement,
  children: FlowLayoutElement[],
  deps: Pick<FlowLayoutDeps, "elementBox" | "elementSize" | "isManualPositioned">,
): Size {
  const padding = readPadding(parent.padding);
  if (children.length === 0) {
    return {
      width: Math.max(1, padding.left + padding.right),
      height: Math.max(1, padding.top + padding.bottom),
    };
  }

  const gap = readNumber(parent.gap) ?? 0;
  const columnGap =
    readNumber(parent.column_gap) ?? readNumber(parent.columnGap) ?? gap;
  const rowGap = readNumber(parent.row_gap) ?? readNumber(parent.rowGap) ?? gap;
  const explicitColumns = readArray(parent.columns);
  const explicitRows = readArray(parent.rows);
  const columnCount =
    readNumber(parent.columns) ??
    (explicitColumns.length > 0 ? explicitColumns.length : 1);
  const columns = Math.max(1, Math.floor(columnCount));
  const declaredRows =
    readNumber(parent.rows) ??
    (explicitRows.length > 0 ? explicitRows.length : null);
  const placements = placeGridChildren(children, columns, declaredRows);
  const rows = Math.max(
    declaredRows ?? 1,
    ...placements.map((placement) => placement.row + placement.rowSpan),
  );
  const columnWidths = Array.from({ length: columns }, () => 1);
  const rowHeights = Array.from({ length: rows }, () => 1);

  children.forEach((child, index) => {
    const placement = placements[index];
    if (!placement) return;
    const size = intrinsicFlowChildSize(child, deps);
    const widthShare =
      (size.width - columnGap * Math.max(0, placement.columnSpan - 1)) /
      placement.columnSpan;
    const heightShare =
      (size.height - rowGap * Math.max(0, placement.rowSpan - 1)) /
      placement.rowSpan;
    for (
      let column = placement.col;
      column < placement.col + placement.columnSpan;
      column += 1
    ) {
      columnWidths[column] = Math.max(columnWidths[column], widthShare);
    }
    for (
      let row = placement.row;
      row < placement.row + placement.rowSpan;
      row += 1
    ) {
      rowHeights[row] = Math.max(rowHeights[row], heightShare);
    }
  });

  return {
    width: Math.max(
      1,
      padding.left +
        padding.right +
        columnWidths.reduce((sum, width) => sum + Math.max(1, width), 0) +
        columnGap * Math.max(0, columns - 1),
    ),
    height: Math.max(
      1,
      padding.top +
        padding.bottom +
        rowHeights.reduce((sum, height) => sum + Math.max(1, height), 0) +
        rowGap * Math.max(0, rows - 1),
    ),
  };
}

function intrinsicFlowChildSize(
  child: FlowLayoutElement,
  deps: Pick<FlowLayoutDeps, "elementBox" | "elementSize" | "isManualPositioned">,
): Size {
  const box = deps.isManualPositioned(child) ? deps.elementBox(child) : null;
  if (box) {
    return {
      width: Math.max(1, box.width),
      height: Math.max(1, box.height),
    };
  }
  return deps.elementSize(child);
}

function intrinsicTextMainSize(
  child: FlowLayoutElement,
  direction: FlowDirection,
  crossSize: number,
) {
  const font = rawFont(child);
  const text = displayText(rawTextContent(child));
  if (direction === "row") {
    return Math.max(1, estimateTextWidth(text, font));
  }

  const explicitWidth = readOptionalSize(child.size)?.width;
  const width = Math.max(1, explicitWidth ?? crossSize);
  return Math.max(1, estimateTextHeight(text, font, width));
}

function estimateTextWidth(text: string, font: ReturnType<typeof rawFont>) {
  const longestLine = text
    .split(/\r?\n/)
    .reduce((longest, line) => Math.max(longest, line.length), 0);
  const weight = font.bold ? 0.56 : TEXT_AVERAGE_CHAR_EM;
  return Math.max(font.size, longestLine * font.size * weight);
}

function estimateTextHeight(
  text: string,
  font: ReturnType<typeof rawFont>,
  width: number,
) {
  const lineHeight = font.size * font.lineHeight;
  const averageCharWidth = Math.max(1, font.size * TEXT_AVERAGE_CHAR_EM);
  const charsPerLine = Math.max(1, Math.floor(width / averageCharWidth));
  const lines = text.split(/\r?\n/).reduce((count, line) => {
    return count + Math.max(1, Math.ceil(line.length / charsPerLine));
  }, 0);
  return Math.max(lineHeight, lines * lineHeight);
}

function gridAreaOpen(
  occupied: Set<string>,
  row: number,
  col: number,
  rowSpan: number,
  columnSpan: number,
) {
  for (let r = row; r < row + rowSpan; r += 1) {
    for (let c = col; c < col + columnSpan; c += 1) {
      if (occupied.has(`${r}:${c}`)) return false;
    }
  }
  return true;
}

function markGridArea(
  occupied: Set<string>,
  row: number,
  col: number,
  rowSpan: number,
  columnSpan: number,
) {
  for (let r = row; r < row + rowSpan; r += 1) {
    for (let c = col; c < col + columnSpan; c += 1) {
      occupied.add(`${r}:${c}`);
    }
  }
}

function isFramelessDecorativeShape(child: FlowLayoutElement) {
  if (readOptionalSize(child.size) || asRecord(child.position)) return false;
  const type = readString(child.type);
  return type === "vector";
}

function clampLayoutSize(
  size: number,
  child: FlowLayoutElement,
  dimension: "width" | "height",
  fallback = 1,
) {
  const value = Number.isFinite(size) && size > 0 ? size : fallback;
  const min =
    dimension === "width"
      ? layoutNumber(child, "minWidth", "min_width")
      : layoutNumber(child, "minHeight", "min_height");
  const max =
    dimension === "width"
      ? layoutNumber(child, "maxWidth", "max_width")
      : layoutNumber(child, "maxHeight", "max_height");
  return Math.min(max ?? Number.POSITIVE_INFINITY, Math.max(min ?? 1, value));
}

function layoutNumber(child: FlowLayoutElement, ...keys: string[]) {
  const layout = asRecord(child.layout);
  for (const key of keys) {
    const value = readNumber(layout?.[key]);
    if (value != null) return value;
  }
  return null;
}

function alignmentOffset(
  alignment: string | null,
  available: number,
  used: number,
) {
  const free = Math.max(0, available - used);
  if (alignment === "center") return free / 2;
  if (
    alignment === "right" ||
    alignment === "bottom" ||
    alignment === "end" ||
    alignment === "flex-end"
  ) {
    return free;
  }
  return 0;
}

function readOptionalSize(value: unknown): Size | null {
  const record = asRecord(value);
  const width = readNumber(record?.width);
  const height = readNumber(record?.height);
  if (width == null || height == null) return null;
  return {
    width: Math.max(1, width),
    height: Math.max(1, height),
  };
}

function readPadding(value: unknown): Padding {
  if (typeof value === "number") {
    return { top: value, right: value, bottom: value, left: value };
  }
  const record = asRecord(value);
  const x = readNumber(record?.x) ?? readNumber(record?.horizontal);
  const y = readNumber(record?.y) ?? readNumber(record?.vertical);
  return {
    top: readNumber(record?.top) ?? y ?? 0,
    right: readNumber(record?.right) ?? x ?? 0,
    bottom: readNumber(record?.bottom) ?? y ?? 0,
    left: readNumber(record?.left) ?? x ?? 0,
  };
}

function readArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asRecord(value: unknown): FlowLayoutElement | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as FlowLayoutElement)
    : null;
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
