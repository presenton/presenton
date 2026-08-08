import { useCallback, useRef, useState } from "react";
import type {
  TableCellSelection,
  TableSlideElement,
  TextSlideElement,
} from "@/components/slide-editor/state/state";
import { withHash } from "@/components/slide-editor/utils/color";
import {
  elementBox,
  elementFont,
  tableRowsAsStrings,
} from "@/components/slide-editor/model/element-model";
import type { Font, TableCell, TextRun } from "@/components/slide-editor/types";
import { effectiveLineHeight } from "@/components/slide-editor/text/text-line-height";
import {
  textRunsContent,
  type TextSelectionRange,
} from "@/components/slide-editor/text/text-runs";
import type { TemplateFontOption } from "@/components/slide-editor/text/google-fonts";
import { inlineStyles } from "@/components/slide-editor/toolbar/inlineStyles";
import { TextToolbar } from "@/components/slide-editor/text/TextToolbar";
import { TiptapInlineTextEditor } from "@/components/slide-editor/text/TiptapInlineTextEditor";
import { readableTableTextColor } from "@/components/slide-editor/tables/table-colors";

const EMPTY_TEMPLATE_FONTS: TemplateFontOption[] = [];
const TEMPLATE_V2_PX_PER_IN = 128;

export function TableInlineEditor({
  element,
  index,
  scale,
  selectedCell,
  templateFonts = EMPTY_TEMPLATE_FONTS,
  onChange,
  onClose,
}: {
  element: TableSlideElement;
  index: number;
  scale: number;
  selectedCell: TableCellSelection | null;
  templateFonts?: TemplateFontOption[];
  onChange: (index: number, element: TableSlideElement) => void;
  onClose: () => void;
}) {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const [textSelectionRange, setTextSelectionRange] =
    useState<TextSelectionRange | null>(null);
  const box = elementBox(element);
  const rows = [element.columns, ...element.rows];
  const stringRows = tableRowsAsStrings(element);
  const rowCount = Math.max(1, rows.length);
  const columnCount = Math.max(1, ...stringRows.map((row) => row.length));
  const rowIndex = Math.min(
    rowCount - 1,
    Math.max(0, selectedCell?.rowIndex ?? 0),
  );
  const colIndex = Math.min(
    columnCount - 1,
    Math.max(0, selectedCell?.colIndex ?? 0),
  );
  const tableFont = elementFont(element);
  const isHeader = rowIndex === 0;
  const cell = rows[rowIndex]?.[colIndex] ?? { runs: [] };
  const cellBackground = tableCellBackground(cell);
  const font = readableTableCellFont(
    tableCellFont(cell, tableFont, isHeader),
    cellBackground,
  );
  const tableWidth = box.w * scale;
  const tableHeight = box.h * scale;
  const cellWidth = tableWidth / columnCount;
  const cellHeight = tableHeight / rowCount;
  const cellLeft = box.x * scale + colIndex * cellWidth;
  const cellTop = box.y * scale + rowIndex * cellHeight;
  const paddingX = Math.max(4, 0.08 * scale);
  const paddingY = Math.max(3, 0.04 * scale);
  const textElement: TextSlideElement = {
    type: "text",
    position: { x: cellLeft / scale, y: cellTop / scale },
    size: { width: cellWidth / scale, height: cellHeight / scale },
    font,
    alignment: {
      horizontal: cell.alignment ?? "left",
      vertical: "middle",
    },
    runs: normalizedTextRuns(cell, font).map((run) =>
      readableTableCellRun(run, font, cellBackground),
    ),
  };
  const textFont = elementFont(textElement);
  const cellText = textRunsContent(textElement.runs);
  const textFontSizePx = textFont.size * (scale / TEMPLATE_V2_PX_PER_IN);
  const editorTextWidth = Math.max(1, cellWidth - paddingX * 2);
  const editorLineHeight = effectiveLineHeight({
    text: cellText,
    width: editorTextWidth,
    fontSize: textFontSizePx,
    lineHeight: textFont.lineHeight,
    fallback: 1.12,
    wrap: "word",
  });
  const closeAfterBlur = useCallback(() => {
    window.setTimeout(() => {
      const active = document.activeElement;
      if (active && editorRef.current?.contains(active)) return;
      if (active?.closest?.("[data-inline-edit-ignore='true']")) return;
      onClose();
    }, 0);
  }, [onClose]);

  const updateCell = (nextCell: TableCell) => {
    if (isHeader) {
      onChange(index, {
        ...element,
        columns: Array.from({ length: columnCount }, (_, nextColIndex) =>
          nextColIndex === colIndex
            ? nextCell
            : element.columns[nextColIndex] ?? { runs: [] },
        ),
      });
      return;
    }

    onChange(index, {
      ...element,
      rows: element.rows.map((row, nextRowIndex) =>
        nextRowIndex === rowIndex - 1
          ? Array.from({ length: columnCount }, (_, nextColIndex) =>
            nextColIndex === colIndex
              ? nextCell
              : row[nextColIndex] ?? { runs: [] },
          )
          : row,
      ),
    });
  };

  const updateCellTextElement = (nextTextElement: TextSlideElement) => {
    updateCell({
      ...cell,
      font: nextTextElement.font ?? cell.font,
      alignment: nextTextElement.alignment?.horizontal ?? cell.alignment,
      runs: normalizedTextRuns(nextTextElement, nextTextElement.font ?? font),
    });
  };
  const updateCellRuns = (runs: TextRun[]) => {
    updateCell({
      ...cell,
      runs: runs.length > 0 ? runs : [{ text: " ", font }],
    });
  };

  return (
    <div
      ref={editorRef}
      data-inline-edit-ignore="true"
      onBlur={closeAfterBlur}
      onPointerDown={(event) => event.stopPropagation()}
      onMouseDown={(event) => event.stopPropagation()}
      style={{
        position: "absolute",
        zIndex: 30,
        inset: 0,
        pointerEvents: "none",
      }}
    >
      <div style={{ pointerEvents: "auto" }}>
        <TextToolbar
          element={textElement}
          index={index}
          scale={scale}
          selectionRange={textSelectionRange}
          templateFonts={templateFonts}
          onChange={(_index, nextTextElement) =>
            updateCellTextElement(nextTextElement)
          }
        />
      </div>
      <TiptapInlineTextEditor
        baseFont={textElement.font ?? font}
        runs={textElement.runs}
        onBlurOutside={closeAfterBlur}
        onCommitShortcut={onClose}
        onEscape={onClose}
        onRunsChange={updateCellRuns}
        onSelectionChange={setTextSelectionRange}
        contentClassName="template-v2-table-cell-editor-content"
        contentStyle={{ width: "100%" }}
        editorStyle={{
          ...inlineStyles.textEditor,
          ...cellEditorStyle,
          left: cellLeft,
          top: cellTop,
          width: cellWidth,
          height: cellHeight,
          pointerEvents: "auto",
          display: "flex",
          alignItems: "center",
          padding: `${paddingY}px ${paddingX}px`,
          background: cellBackground,
          color: withHash(textFont.color),
          caretColor: withHash(textFont.color),
          fontFamily: `${textFont.family}, Helvetica, sans-serif`,
          fontSize: textFontSizePx,
          fontStyle: textFont.italic ? "italic" : "normal",
          fontWeight: textFont.bold ? 700 : 400,
          textDecoration: textFont.underline ? "underline" : "none",
          lineHeight: editorLineHeight,
          textAlign: textElement.alignment?.horizontal ?? "left",
          letterSpacing:
            (textFont.letterSpacing ?? 0) * (scale / TEMPLATE_V2_PX_PER_IN),
        }}
      />
    </div>
  );
}

export function tableDraftFromElement(element: TableSlideElement) {
  return tableRowsAsStrings(element)
    .map((row) => row.map(formatTableCell).join(", "))
    .join("\n");
}

export function tableRowsFromDraft(draft: string) {
  return draft
    .split(/\r?\n/)
    .map(parseTableRow)
    .filter((row) => row.some(Boolean))
    .map((row) => row.slice(0, 6))
    .slice(0, 8);
}

function tableCellFont(
  cell: TableCell,
  tableFont: ReturnType<typeof elementFont>,
  isHeader: boolean,
): Font {
  const cellFont = cell.font ?? {};
  return {
    family: cellFont.family ?? tableFont.family,
    size: cellFont.size ?? tableFont.size,
    color: cellFont.color ?? tableFont.color,
    bold: cellFont.bold ?? tableFont.bold ?? isHeader,
    italic: cellFont.italic ?? tableFont.italic,
    line_height: cellFont.line_height ?? tableFont.lineHeight ?? 1.12,
    letter_spacing: cellFont.letter_spacing ?? tableFont.letterSpacing,
    ellipsis: cellFont.ellipsis ?? tableFont.ellipsis,
    opacity: cellFont.opacity ?? tableFont.opacity,
  };
}

function readableTableCellFont(font: Font, background: string): Font {
  return {
    ...font,
    color: readableTableTextColor(font.color, background),
  };
}

function readableTableCellRun(
  run: TextRun,
  fallbackFont: Font,
  background: string,
): TextRun {
  const runFont = run.font ?? fallbackFont;
  return {
    ...run,
    font: {
      ...runFont,
      color: readableTableTextColor(
        runFont.color ?? fallbackFont.color,
        background,
      ),
    },
  };
}

function tableCellBackground(cell: TableCell) {
  const fill =
    cell.color?.color ??
    (cell as TableCell & { fill?: { color?: string | null } | null }).fill
      ?.color;
  return fill ? withHash(fill) : "transparent";
}

function normalizedTextRuns(
  source: Pick<TextSlideElement, "runs"> | TableCell,
  font: Font | null | undefined,
) {
  const runs = source.runs.length > 0 ? source.runs : [{ text: " " }];
  return runs.map((run) => ({
    ...run,
    text: run.text || " ",
    font: run.font ?? font ?? undefined,
  }));
}

function formatTableCell(cell: string) {
  if (!/[",\n\r]/.test(cell)) return cell;
  return `"${cell.replace(/"/g, '""')}"`;
}

function parseTableRow(line: string) {
  const cells: string[] = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (quoted && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }
    if (char === "," && !quoted) {
      cells.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }

  cells.push(current.trim());
  return cells;
}

const cellEditorStyle = {
  zIndex: 31,
  border: "1px solid #7C51F8",
  outline: "none",
  resize: "none",
  margin: 0,
  backgroundClip: "padding-box",
} as const;
