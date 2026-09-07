import { Group, Rect, Text } from "react-konva";
import { renderMarkdownTextRuns } from "@/components/slide-editor/text/markdown-text";
import type { TextRun } from "@/components/slide-editor/types";
import {
  layoutRichText,
  renderKonvaTextSegment,
  type RenderTextRun,
} from "@/components/slide-editor/text/template-v2-text";
import { isLatexTextRun } from "@/components/slide-editor/text/text-runs";
import { LatexRunNode } from "@/components/slide-editor/math/LatexRunNode";
import { effectiveLineHeight } from "@/components/slide-editor/text/text-line-height";
import { readableTableTextColor } from "@/components/slide-editor/tables/table-colors";
import { colorWithOpacity } from "@/components/slide-editor/model/render-style";

type UnknownRecord = Record<string, any>;
type RawElement = UnknownRecord;
type RenderTextFont = {
  family: string;
  size: number;
  color: string;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  lineHeight: number;
  letterSpacing: number;
  opacity: number;
};

export function TemplateV2TableElement({
  element,
  width,
  height,
  interactive,
  selectedCell,
  onCellSelect,
  onCellEdit,
}: {
  element: RawElement;
  width: number;
  height: number;
  interactive: boolean;
  selectedCell?: { rowIndex: number; colIndex: number } | null;
  onCellSelect?: (rowIndex: number, colIndex: number) => void;
  onCellEdit?: (rowIndex: number, colIndex: number) => void;
}) {
  const rows = rawTableRows(element);
  const rowCount = Math.max(1, rows.length);
  const colCount = Math.max(1, ...rows.map((row) => row.length));
  const cellW = width / colCount;
  const cellH = height / rowCount;
  const font = rawFont(element);

  return (
    <Group listening={interactive}>
      {rows.map((row, rowIndex) =>
        Array.from({ length: colCount }, (_, colIndex) => {
          const cell = asRecord(row[colIndex]) ?? {};
          const firstRun = asRecord(readArray(cell.runs)[0]) ?? {};
          const cellFont = fontFromRecord(
            asRecord(cell.font) ?? asRecord(firstRun.font),
            font,
          );
          const forceHeaderBold =
            rowIndex === 0 && !hasExplicitBold(cell, firstRun);
          const fill = fillColor(cell.fill ?? cell.color);
          const runs = readableTableCellRuns(
            rawTableCellRuns(cell, cellFont),
            fill,
            rowIndex === 0,
          );
          const renderRuns =
            forceHeaderBold
              ? runs.map((run) => ({
                ...run,
                font: { ...run.font, bold: true },
              }))
              : runs;
          const text = tableCellTextContent(runs);
          const fontSize = cellFont.size;
          const textWidth = Math.max(1, cellW - 12);
          const cellLineHeight = effectiveLineHeight({
            text,
            width: textWidth,
            fontSize,
            lineHeight: cellFont.lineHeight,
            fallback: 1.15,
            wrap: "word",
          });
          return (
            <Group
              key={`${rowIndex}-${colIndex}`}
              x={colIndex * cellW}
              y={rowIndex * cellH}
              onClick={(event) => {
                if (!interactive) return;
                event.cancelBubble = true;
                onCellSelect?.(rowIndex, colIndex);
              }}
              onTap={(event) => {
                if (!interactive) return;
                event.cancelBubble = true;
                onCellSelect?.(rowIndex, colIndex);
              }}
              onDblClick={(event) => {
                if (!interactive) return;
                event.cancelBubble = true;
                onCellSelect?.(rowIndex, colIndex);
                onCellEdit?.(rowIndex, colIndex);
              }}
              onDblTap={(event) => {
                if (!interactive) return;
                event.cancelBubble = true;
                onCellSelect?.(rowIndex, colIndex);
                onCellEdit?.(rowIndex, colIndex);
              }}
            >
              <Rect
                width={cellW}
                height={cellH}
                fill={fill ?? "rgba(0,0,0,0)"}
                stroke={strokeColor(cell.stroke) ?? "#D0D5DD"}
                strokeWidth={strokeWidth(cell.stroke) || 1}
              />
              <TableCellText
                x={6}
                y={4}
                width={textWidth}
                height={Math.max(1, cellH - 8)}
                runs={renderRuns}
                font={forceHeaderBold ? { ...cellFont, bold: true } : cellFont}
                align={readString(cell.alignment) ?? "left"}
                verticalAlign="middle"
                lineHeight={cellLineHeight}
              />
            </Group>
          );
        }),
      )}
      <SelectedTableCellOutline
        cellH={cellH}
        cellW={cellW}
        colCount={colCount}
        rowCount={rowCount}
        selectedCell={selectedCell}
      />
    </Group>
  );
}

function TableCellText({
  x,
  y,
  width,
  height,
  runs,
  font,
  align,
  verticalAlign,
  lineHeight,
}: {
  x: number;
  y: number;
  width: number;
  height: number;
  runs: RenderTextRun[];
  font: RenderTextFont;
  align: string;
  verticalAlign: string;
  lineHeight: number;
}) {
  const baseFont = { ...font, lineHeight };
  const renderRuns = runs.map((run) => ({
    ...run,
    font: {
      ...run.font,
      lineHeight: run.font.lineHeight || lineHeight,
    },
  }));

  const { tokens } = layoutRichText(
    renderRuns,
    width,
    baseFont,
    align,
    verticalAlign,
    height,
    "word",
  );

  return (
    <Group x={x} y={y} listening={false}>
      {tokens.map((token, index) => (
        token.type === "latex" && token.latex ? (
          <LatexRunNode
            key={index}
            x={token.x}
            y={token.y}
            width={token.width}
            height={token.height}
            latex={token.latex}
            displayMode={token.displayMode}
            fontSize={token.font.size}
            color={
              colorWithOpacity(withHash(token.font.color), token.font.opacity) ??
              "#111827"
            }
            interactive={false}
          />
        ) : (
          <Text
            key={index}
            x={token.x}
            y={token.y}
            width={token.width}
            height={token.height}
            text={renderKonvaTextSegment(token.text)}
            fill={colorWithOpacity(withHash(token.font.color), token.font.opacity)}
            fontFamily={`${token.font.family}, Inter`}
            fontSize={token.font.size}
            fontStyle={`${token.font.bold ? "bold" : "normal"} ${token.font.italic ? "italic" : ""
              }`}
            textDecoration={token.font.underline ? "underline" : ""}
            lineHeight={token.font.lineHeight}
            letterSpacing={token.font.letterSpacing}
            wrap="none"
            listening={false}
          />
        )
      ))}
    </Group>
  );
}

function SelectedTableCellOutline({
  cellH,
  cellW,
  colCount,
  rowCount,
  selectedCell,
}: {
  cellH?: number;
  cellW?: number;
  colCount: number;
  rowCount?: number;
  selectedCell?: { rowIndex: number; colIndex: number } | null;
}) {
  if (!selectedCell) return null;
  if (selectedCell.colIndex < 0 || selectedCell.colIndex >= colCount) return null;
  if (cellW == null || cellH == null || rowCount == null) return null;
  if (selectedCell.rowIndex < 0 || selectedCell.rowIndex >= rowCount) return null;

  return (
    <Rect
      x={selectedCell.colIndex * cellW}
      y={selectedCell.rowIndex * cellH}
      width={cellW}
      height={cellH}
      fill="rgba(0,0,0,0)"
      stroke="#2563EB"
      strokeWidth={2}
      listening={false}
    />
  );
}

function rawTableRows(element: RawElement) {
  const columns = readArray(element.columns);
  const rows = readArray(element.rows);
  return [columns, ...rows].filter((row) => Array.isArray(row)) as unknown[][];
}

function rawTableCellRuns(cell: unknown, fallbackFont: RenderTextFont) {
  const sourceRuns = rawTableCellSourceRuns(cell, fallbackFont);
  return renderMarkdownTextRuns(sourceRuns).map((run): RenderTextRun => {
    const font = fontFromRecord(asRecord(run.font), fallbackFont);
    return isLatexTextRun(run)
      ? {
          type: "latex",
          text: run.latex,
          latex: run.latex,
          displayMode: run.display_mode ?? false,
          font,
        }
      : { text: run.text, font };
  });
}

function rawTableCellSourceRuns(
  cell: unknown,
  fallbackFont: RenderTextFont,
): TextRun[] {
  if (typeof cell === "string" || typeof cell === "number") {
    return [{ text: String(cell), font: fontToTextRunFont(fallbackFont) }];
  }
  const record = asRecord(cell);
  if (!record) return [{ text: "", font: fontToTextRunFont(fallbackFont) }];
  const cellFont = fontFromRecord(asRecord(record.font), fallbackFont);
  const runs = readArray(record.runs);
  if (runs.length > 0) {
    return runs
      .map((run) => {
        const runRecord = asRecord(run) ?? {};
        if (readString(runRecord.type) === "latex") {
          const latex = readString(runRecord.latex) ?? "";
          return latex
            ? ({
                type: "latex",
                latex,
                display_mode:
                  readBoolean(runRecord.display_mode ?? runRecord.displayMode) ??
                  false,
                font: fontToTextRunFont(
                  fontFromRecord(asRecord(runRecord.font), cellFont),
                ),
              } satisfies TextRun)
            : null;
        }
        return {
          text: readString(runRecord.text) ?? "",
          font: fontToTextRunFont(
            fontFromRecord(asRecord(runRecord.font), cellFont),
          ),
        };
      })
      .filter(Boolean) as TextRun[];
  }
  const textRecord = asRecord(record.text);
  return [
    {
      text: readString(textRecord?.text) ?? readString(record.text) ?? "",
      font: fontToTextRunFont(cellFont),
    },
  ];
}

function fontToTextRunFont(font: RenderTextFont): TextRun["font"] {
  return {
    family: font.family,
    size: font.size,
    color: font.color,
    bold: font.bold,
    italic: font.italic,
    underline: font.underline,
    line_height: font.lineHeight,
    letter_spacing: font.letterSpacing,
    opacity: font.opacity,
  };
}

function tableCellTextContent(runs: RenderTextRun[]) {
  return runs.map((run) => run.text).join("");
}

function readableTableCellRuns(
  runs: RenderTextRun[],
  fill: string | undefined,
  isHeader: boolean,
) {
  if (isHeader) return runs;
  return runs.map((run) => ({
    ...run,
    font: {
      ...run.font,
      color: readableTableTextColor(run.font.color, fill),
    },
  }));
}

function rawFont(element: RawElement) {
  const font = asRecord(element.font) ?? {};
  return fontFromRecord(font, {
    family: "Arial",
    size: 18,
    color: "#111827",
    bold: false,
    italic: false,
    underline: false,
    lineHeight: 1.15,
    letterSpacing: 0,
    opacity: 1,
  });
}

function fontFromRecord(
  font: UnknownRecord | null,
  fallback: RenderTextFont,
): RenderTextFont {
  return {
    family: readString(font?.family) ?? fallback.family,
    size: readNumber(font?.size) ?? fallback.size,
    color: readString(font?.color) ?? fallback.color,
    bold: readBoolean(font?.bold) ?? fallback.bold,
    italic: readBoolean(font?.italic) ?? fallback.italic,
    underline:
      readBoolean(font?.underline) ??
      (readString(font?.text_decoration) === "underline" ||
        readString(font?.textDecoration) === "underline"
        ? true
        : fallback.underline),
    lineHeight:
      readNumber(font?.line_height) ??
      readNumber(font?.lineHeight) ??
      fallback.lineHeight,
    letterSpacing:
      readNumber(font?.letter_spacing) ??
      readNumber(font?.letterSpacing) ??
      fallback.letterSpacing,
    opacity: readNumber(font?.opacity) ?? fallback.opacity,
  };
}

function hasExplicitBold(cell: UnknownRecord, firstRun: UnknownRecord) {
  return (
    Object.prototype.hasOwnProperty.call(asRecord(cell.font) ?? {}, "bold") ||
    Object.prototype.hasOwnProperty.call(asRecord(firstRun.font) ?? {}, "bold")
  );
}

function fillColor(fill: unknown) {
  const value = asRecord(fill);
  return withHash(readString(value?.color));
}

function strokeColor(stroke: unknown) {
  const value = asRecord(stroke);
  return withHash(readString(value?.color));
}

function strokeWidth(stroke: unknown) {
  const value = asRecord(stroke);
  return readNumber(value?.width) ?? 0;
}

function readArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asRecord(value: unknown): UnknownRecord | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as UnknownRecord)
    : null;
}

function readString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function readNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function withHash(value: string | null | undefined) {
  if (!value) return undefined;
  return value.startsWith("#") || value.startsWith("rgb") ? value : `#${value}`;
}
