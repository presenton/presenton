import type {
  BorderRadius,
  ChartElement,
  Fill,
  Font,
  ImageElement,
  Position,
  Size,
  SlideElement,
  Stroke,
  TableCell,
  TableElement,
  TextElement,
  TextListElement,
  TextRun,
} from "@/components/slide-editor/types";
import {
  applyTextRunFontToSelection,
  replaceTextRunsContent,
  textRunsContent,
  type TextSelectionRange,
} from "@/components/slide-editor/text/text-runs";

export type ElementType = SlideElement["type"];
export type ElementBox = { x: number; y: number; w: number; h: number };
export type ResolvedFont = {
  family: string;
  size: number;
  color: string;
  bold?: boolean | null;
  italic?: boolean | null;
  underline?: boolean | null;
  lineHeight?: number | null;
  letterSpacing?: number | null;
  ellipsis?: boolean | null;
  opacity?: number | null;
};

export const DEFAULT_FONT_FAMILY = "Arial";
export const DEFAULT_TEXT_COLOR = "1A2B45";
export const DEFAULT_TEXT_SIZE = 18;

export function elementBox(element: Pick<SlideElement, "position" | "size">) {
  return {
    x: element.position?.x ?? 0,
    y: element.position?.y ?? 0,
    w: element.size?.width ?? 1,
    h: element.size?.height ?? 1,
  };
}

export function boxToPositionSize(box: ElementBox): {
  position: Position;
  size: Size;
} {
  return {
    position: { x: box.x, y: box.y },
    size: { width: box.w, height: box.h },
  };
}

export function resizeElement<T extends SlideElement>(
  element: T,
  box: Partial<ElementBox>,
): T {
  const current = elementBox(element);
  return {
    ...element,
    ...boxToPositionSize({
      x: box.x ?? current.x,
      y: box.y ?? current.y,
      w: box.w ?? current.w,
      h: box.h ?? current.h,
    }),
  } as T;
}

export function moveElement<T extends SlideElement>(
  element: T,
  dx: number,
  dy: number,
): T {
  const box = elementBox(element);
  return resizeElement(element, {
    x: box.x + dx,
    y: box.y + dy,
  });
}

export function textContent(element: TextElement): string {
  return textRunsContent(element.runs);
}

export function textRun(text: string, font?: Font | null): TextRun {
  return font ? { text, font } : { text };
}

export function setTextContent(element: TextElement, text: string): TextElement {
  return {
    ...element,
    runs: replaceTextRunsContent(element.runs, text, element.font),
  };
}

export function mergeFontForTextSelection<T extends TextElement>(
  element: T,
  range: TextSelectionRange | null | undefined,
  font: Partial<Font>,
): T {
  return applyTextRunFontToSelection(element, range, font) as T;
}

export function elementFont(element: {
  font?: Font | null;
}): ResolvedFont {
  return {
    family: element.font?.family ?? DEFAULT_FONT_FAMILY,
    size: element.font?.size ?? DEFAULT_TEXT_SIZE,
    color: element.font?.color ?? DEFAULT_TEXT_COLOR,
    bold: element.font?.bold ?? null,
    italic: element.font?.italic ?? null,
    underline: element.font?.underline ?? null,
    lineHeight: element.font?.line_height ?? null,
    letterSpacing: element.font?.letter_spacing ?? null,
    ellipsis: element.font?.ellipsis ?? null,
    opacity: element.font?.opacity ?? null,
  };
}

export function mergeFont<T extends { font?: Font | null }>(
  element: T,
  font: Partial<Font>,
): T {
  const nextFont = { ...(element.font ?? {}), ...font };
  return {
    ...element,
    font: nextFont,
    ...("runs" in element && Array.isArray(element.runs)
      ? {
          runs: element.runs.map((run) => ({
            ...run,
            font: { ...(run.font ?? element.font ?? {}), ...font },
          })),
        }
      : {}),
  };
}

export function textListStrings(element: TextListElement): string[] {
  return element.items.map(textListItemText);
}

export function setTextListStrings(
  element: TextListElement,
  items: string[],
): TextListElement {
  return {
    ...element,
    items: items.map((text) => [textRun(text)]),
  };
}

export function textListItemText(item: TextListElement["items"][number]): string {
  return textRunsContent(item);
}

export function fillColor(fill: Fill | null | undefined, fallback = "FFFFFF") {
  return fill?.color ?? fallback;
}

export function strokeColor(
  stroke: Stroke | null | undefined,
  fallback = "0B1F3A",
) {
  return stroke?.color ?? fallback;
}

export function strokeWidth(stroke: Stroke | null | undefined) {
  return stroke?.width ?? 0;
}

export function uniformBorderRadius(value: number): BorderRadius {
  return { tl: value, tr: value, bl: value, br: value };
}

export function averageBorderRadius(
  radius: BorderRadius | null | undefined,
): number {
  if (!radius) return 0;
  return (radius.tl + radius.tr + radius.bl + radius.br) / 4;
}

export function tableRowsAsStrings(element: TableElement): string[][] {
  return [
    element.columns.map(tableCellText),
    ...element.rows.map((row) => row.map(tableCellText)),
  ];
}

export function tableCellText(cell: TableCell): string {
  return textRunsContent(cell.runs);
}

export function setTableCellText(cell: TableCell, text: string): TableCell {
  return {
    ...cell,
    runs: text ? replaceTextRunsContent(cell.runs, text, cell.font) : [],
  };
}

export function setTableRowsFromStrings(
  element: TableElement,
  rows: string[][],
): TableElement {
  const [header = [], ...body] = rows;
  const existingRows = tableRowsAsStrings(element);
  const cellFor = (text: string, rowIndex: number, colIndex: number): TableCell => ({
    ...setTableCellText(
      (rowIndex === 0
      ? element.columns[colIndex]
      : element.rows[rowIndex - 1]?.[colIndex]) ?? { runs: [] },
      text,
    ),
  });

  return {
    ...element,
    columns: header.map((text, colIndex) =>
      cellFor(text || existingRows[0]?.[colIndex] || "", 0, colIndex),
    ),
    rows: body.map((row, rowIndex) =>
      row.map((text, colIndex) => cellFor(text, rowIndex + 1, colIndex)),
    ),
  };
}

export function chartColor(element: ChartElement, fallback = "D4A24C") {
  return element.color ?? fallback;
}

export function hasImageData(element: ImageElement) {
  return Boolean(element.data);
}

export function isShapeElement(
  element: SlideElement,
): element is Extract<SlideElement, { type: "vector" }> {
  return element.type === "vector";
}
