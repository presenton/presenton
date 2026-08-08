import { renderMarkdownTextRuns } from "@/components/slide-editor/text/markdown-text";
import type { Font, TextRun } from "@/components/slide-editor/types";
import { effectiveLineHeight } from "@/components/slide-editor/text/text-line-height";
import { textRunsContent } from "@/components/slide-editor/text/text-runs";
import type { TemplateV2TextEditStyle } from "@/components/slide-editor/text/template-v2-text-editing";

type UnknownRecord = Record<string, any>;

export type TemplateV2RawTextElement = UnknownRecord;
export type RenderTextFont = Omit<
  TemplateV2TextEditStyle,
  "horizontal" | "vertical"
>;
export type RenderTextRun = {
  text: string;
  font: RenderTextFont;
};
export type LaidToken = {
  text: string;
  font: RenderTextFont;
  x: number;
  y: number;
  width: number;
  height: number;
};
export type TextListRenderItem = {
  marker: string;
  markerFont: RenderTextFont;
  runs: RenderTextRun[];
};
export type TemplateV2TextBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

const TEXT_AVERAGE_CHAR_EM = 0.5;
const DEFAULT_FONT: RenderTextFont = {
  family: "Arial",
  size: 18,
  color: "#111827",
  bold: false,
  italic: false,
  underline: false,
  lineHeight: 1.15,
  letterSpacing: 0,
  opacity: 1,
};
const TEXT_RENDER_WRAP = "word";
const MIN_TRANSFORM_FONT_SIZE = 1;
const MAX_TRANSFORM_FONT_SIZE = 512;
const TRANSFORM_FONT_SCALE_EPSILON = 0.001;

const richMeasureCtx: { ctx: CanvasRenderingContext2D | null } = { ctx: null };
let renderTextMeasureCanvas: HTMLCanvasElement | null = null;
const NON_BREAKING_SPACE = "\u00A0";

export function isRenderWhitespaceText(text: string) {
  return text.length > 0 && /^\s+$/u.test(text);
}

export function renderKonvaTextSegment(text: string) {
  return isRenderWhitespaceText(text)
    ? text.replace(/ /g, NON_BREAKING_SPACE)
    : text;
}

function withoutFontWrap(font: UnknownRecord): UnknownRecord {
  return Object.fromEntries(
    Object.entries(font).filter(([key]) => key !== "wrap"),
  );
}

export function displayText(text: string) {
  return text
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/__(.*?)__/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/_(.*?)_/g, "$1");
}

export function rawFont(element: TemplateV2RawTextElement) {
  const font = asRecord(element.font) ?? {};
  return fontFromRecord(font, DEFAULT_FONT);
}

export function fontFromRecord(
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

export function fontToSource(font: RenderTextFont): Font {
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

export function rawTextStyle(
  element: TemplateV2RawTextElement,
): TemplateV2TextEditStyle {
  const font = rawFont(element);
  return {
    ...font,
    color: withHash(font.color) ?? "#111827",
    horizontal: readHorizontalAlignment(
      asRecord(element.alignment)?.horizontal,
    ),
    vertical: readVerticalAlignment(asRecord(element.alignment)?.vertical),
  };
}

export function applyTextStyle(
  element: TemplateV2RawTextElement,
  style: TemplateV2TextEditStyle,
): TemplateV2RawTextElement {
  const sourceFont = asRecord(element.font) ?? {};
  const nextFont = {
    ...withoutFontWrap(sourceFont),
    family: style.family,
    size: style.size,
    color: withHash(style.color) ?? "#111827",
    bold: style.bold,
    italic: style.italic,
    underline: style.underline,
    line_height: style.lineHeight,
    letter_spacing: style.letterSpacing,
    opacity: style.opacity,
  };
  const runs = readArray(element.runs);
  return {
    ...element,
    font: nextFont,
    alignment: {
      ...(asRecord(element.alignment) ?? {}),
      horizontal: style.horizontal,
      vertical: style.vertical,
    },
    ...(runs.length > 0
      ? {
        runs: runs.map((run) => {
          const record = asRecord(run) ?? {};
          return {
            ...record,
            font: {
              ...(asRecord(record.font) ?? {}),
              ...nextFont,
            },
          };
        }),
      }
      : {}),
  };
}

export function normalizeRawTextMarkdownElement(
  element: TemplateV2RawTextElement,
): {
  element: TemplateV2RawTextElement;
  runs: TextRun[];
  changed: boolean;
} {
  const originalSourceRuns = rawSourceTextRuns(element);
  const rawText = rawStoredTextContent(element);
  const hasSourceRuns = rawTextHasRuns(element);
  const reconciledSourceRuns = reconcileTextRunsWithStoredText(
    originalSourceRuns,
    rawText,
  );
  const sourceRuns = reconciledSourceRuns;
  const renderedRuns = renderMarkdownTextRuns(sourceRuns);
  const renderedText = textRunsContent(renderedRuns);
  const sourceHasMarkdown = sourceRuns.some((run) =>
    containsMarkdownSyntax(run.text),
  );
  const runsChanged = !sameTextRuns(originalSourceRuns, sourceRuns);
  const renderedRunsChanged = !sameTextRuns(sourceRuns, renderedRuns);
  const changed =
    runsChanged ||
    renderedRunsChanged ||
    sourceHasMarkdown ||
    ((!hasSourceRuns || containsMarkdownSyntax(rawText)) &&
      rawText !== renderedText);

  return {
    element: changed ? setRawTextRunsContent(element, renderedRuns) : element,
    runs: renderedRuns,
    changed,
  };
}

export function rawTextContent(element: TemplateV2RawTextElement) {
  const runs = readArray(element.runs);
  if (runs.length > 0) {
    const content = runs
      .map((run) => readString(asRecord(run)?.text) ?? "")
      .join("");
    if (content) return content;
  }
  return rawStoredTextContent(element);
}

export function rawStoredTextContent(element: TemplateV2RawTextElement) {
  const text = readString(element.text);
  if (text != null) return text;
  return "";
}

export function rawSourceTextRuns(
  element: TemplateV2RawTextElement,
): TextRun[] {
  const fallbackFont = fontToSource(rawFont(element));
  const runs = readArray(element.runs)
    .map((run) => {
      const record = asRecord(run);
      if (!record) return null;
      const text = readString(record.text) ?? "";
      if (!text) return null;
      return {
        text,
        font: fontToSource(
          fontFromRecord(asRecord(record.font), rawFont(element)),
        ),
      } satisfies TextRun;
    })
    .filter(Boolean) as TextRun[];

  return runs.length > 0
    ? runs
    : [{ text: rawTextContent(element) || " ", font: fallbackFont }];
}

export function rawTextRunsForEditor(
  element: TemplateV2RawTextElement,
): TextRun[] {
  return normalizeRawTextMarkdownElement(element).runs;
}

export function rawTextHasRuns(element: TemplateV2RawTextElement) {
  return readArray(element.runs).some((run) => {
    const record = asRecord(run);
    return Boolean(readString(record?.text));
  });
}

export function setRawTextContent(
  element: TemplateV2RawTextElement,
  text: string,
  style?: TemplateV2TextEditStyle,
): TemplateV2RawTextElement {
  const styled = style ? applyTextStyle(element, style) : element;
  const sourceRuns = readArray(styled.runs);
  const firstRun = asRecord(sourceRuns[0]) ?? {};
  const runs = stripPlainTextListMarkersFromRuns(
    renderMarkdownTextRuns([{ text, font: fontToSource(rawFont(styled)) }]),
  ).map((run) => ({
    ...firstRun,
    text: run.text,
    font: {
      ...(asRecord(firstRun.font) ?? {}),
      ...(asRecord(run.font) ?? {}),
    },
  }));
  return {
    ...styled,
    text: textRunsContent(runs),
    runs,
  };
}

export function setRawTextRunsContent(
  element: TemplateV2RawTextElement,
  runs: TextRun[],
): TemplateV2RawTextElement {
  const storageRuns = stripPlainTextListMarkersFromRuns(runs);
  const sourceRuns = readArray(element.runs);
  const nextRuns = (
    storageRuns.length > 0 ? storageRuns : [{ text: " " }]
  ).map(
    (run, index) => {
      const sourceRun = asRecord(sourceRuns[index]) ?? {};
      return {
        ...sourceRun,
        text: run.text,
        font: rawInlineTextFontRecord(run.font, sourceRun.font),
      };
    },
  );
  return {
    ...element,
    text: textRunsContent(nextRuns),
    runs: nextRuns,
  };
}

export function rawInlineTextFontRecord(value: unknown, fallback: unknown) {
  const font = asRecord(value);
  if (!font) return fallback;
  const fallbackFont = asRecord(fallback) ?? {};
  return {
    ...withoutFontWrap(fallbackFont),
    ...withoutFontWrap(font),
    line_height: font.line_height ?? font.lineHeight,
    letter_spacing: font.letter_spacing ?? font.letterSpacing,
    opacity: font.opacity,
  };
}

export function rawTextListContent(element: TemplateV2RawTextElement) {
  const items = readArray(element.items);
  if (items.length === 0) return "";
  return items.map(rawTextListItemText).join("\n");
}

export function rawTextListRunsForEditor(
  element: TemplateV2RawTextElement,
): TextRun[] {
  const baseFont = rawFont(element);
  const fallbackFont = fontToSource(baseFont);
  const items = readArray(element.items);
  const runs: TextRun[] = [];

  items.forEach((item, index) => {
    const itemRuns = renderMarkdownTextRuns(
      rawTextListItemSourceRuns(item, baseFont),
    );
    const itemFont = itemRuns[0]?.font ?? fallbackFont;
    const prefix = textListMarkerPrefix(element.marker, index);

    if (index > 0) appendTextRun(runs, "\n", itemFont);
    if (prefix) appendTextRun(runs, prefix, itemFont);
    itemRuns.forEach((run) =>
      appendTextRun(runs, run.text, run.font ?? itemFont),
    );
  });

  return runs.length > 0 ? runs : [{ text: " ", font: fallbackFont }];
}

export function rawTextListRenderTextRuns(
  element: TemplateV2RawTextElement,
): RenderTextRun[] {
  const baseFont = rawFont(element);
  return rawTextListRunsForEditor(element)
    .filter((run) => run.text)
    .map((run) => ({
      text: run.text,
      font: fontFromRecord(asRecord(run.font), baseFont),
    }));
}

export function rawTextListRenderItems(
  element: TemplateV2RawTextElement,
): TextListRenderItem[] {
  const baseFont = rawFont(element);
  const fallbackFont = fontToSource(baseFont);
  const items = readArray(element.items);

  return items.map((item, index) => {
    const itemRuns = renderMarkdownTextRuns(
      rawTextListItemSourceRuns(item, baseFont),
    );
    const markerFont = fontFromRecord(
      asRecord(itemRuns[0]?.font ?? fallbackFont),
      baseFont,
    );
    const runs = itemRuns
      .filter((run) => run.text)
      .map((run) => ({
        text: run.text,
        font: fontFromRecord(asRecord(run.font), baseFont),
      }));

    return {
      marker: textListMarkerPrefix(element.marker, index),
      markerFont,
      runs: runs.length > 0 ? runs : [{ text: " ", font: markerFont }],
    };
  });
}

export function rawTextListItemText(item: unknown) {
  if (typeof item === "string") return item;
  if (Array.isArray(item)) {
    return item
      .map((run) => readString(asRecord(run)?.text) ?? "")
      .join("");
  }
  const record = asRecord(item);
  if (!record) return "";
  const directText = readString(record.text);
  if (directText != null) return directText;
  return readArray(record.runs)
    .map((run) => readString(asRecord(run)?.text) ?? "")
    .join("");
}

export function rawTextListItemWithText(
  source: unknown,
  text: string,
): unknown {
  if (Array.isArray(source)) {
    const firstRun = asRecord(source[0]) ?? {};
    return [{ ...firstRun, text }];
  }
  if (typeof source === "string") return text;
  const record = asRecord(source);
  if (!record) return { type: "text", text };
  const runs = readArray(record.runs);
  if (runs.length > 0 || Object.hasOwn(record, "runs")) {
    const firstRun = asRecord(runs[0]) ?? {};
    return { ...record, runs: text ? [{ ...firstRun, text }] : [] };
  }
  return { ...record, type: record.type ?? "text", text };
}

export function setRawTextListContent(
  element: TemplateV2RawTextElement,
  draft: string,
): TemplateV2RawTextElement {
  const sourceItems = readArray(element.items);
  const texts = draft
    .split(/\r?\n/)
    .map((item) => item.replace(/^\s*(?:[•*-]|\d+\.)\s?/, "").trimEnd())
    .filter((item) => item.trim().length > 0);
  const items = (texts.length > 0 ? texts : [" "]).map((text, index) =>
    rawTextListItemWithText(
      sourceItems[index] ?? sourceItems[sourceItems.length - 1],
      text,
    ),
  );
  return { ...element, items };
}

export function setRawTextListRunsContent(
  element: TemplateV2RawTextElement,
  runs: TextRun[],
): TemplateV2RawTextElement {
  const sourceItems = readArray(element.items);
  const stripMarker = readString(element.marker) !== "none";
  const lines = splitTextRunsOnNewlines(runs)
    .map((line) => (stripMarker ? stripTextListMarkerFromRuns(line) : line))
    .map((line) => line.filter((run) => run.text))
    .filter((line) => textRunsContent(line).trim().length > 0);

  const fallbackItem = sourceItems[sourceItems.length - 1];
  const items = (lines.length > 0 ? lines : [[{ text: " " }]]).map(
    (line, index) =>
      rawTextListItemWithRuns(
        sourceItems[index] ?? fallbackItem,
        line as TextRun[],
      ),
  );

  return { ...element, items };
}

export function rawTableCellText(cell: unknown) {
  if (typeof cell === "string" || typeof cell === "number") {
    return displayText(String(cell));
  }
  const record = asRecord(cell);
  if (!record) return "";
  const runs = readArray(record.runs);
  if (runs.length > 0) {
    return textRunsContent(
      renderMarkdownTextRuns(
        runs.map((run) => ({
          text: readString(asRecord(run)?.text) ?? "",
          font: asRecord(run)?.font as TextRun["font"],
        })),
      ),
    );
  }
  const textRecord = asRecord(record.text);
  return displayText(readString(textRecord?.text) ?? readString(record.text) ?? "");
}

export function rawSvgContent(element: TemplateV2RawTextElement) {
  return readString(element.svg) ?? readString(element.data) ?? "";
}

export function setRawSvgContent(
  element: TemplateV2RawTextElement,
  draft: string,
): TemplateV2RawTextElement {
  return { ...element, svg: draft };
}

export function rawRenderTextRuns(
  element: TemplateV2RawTextElement,
): RenderTextRun[] {
  const baseFont = rawFont(element);
  const runs = normalizeRawTextMarkdownElement(element).runs;

  return runs
    .filter((run) => run.text)
    .map((run) => ({
      text: run.text,
      font: fontFromRecord(asRecord(run.font), baseFont),
    }));
}

export function textVisualLocalBox(
  element: TemplateV2RawTextElement,
  box: TemplateV2TextBox,
  options: {
    content?: string;
    runs?: RenderTextRun[];
  } = {},
): TemplateV2TextBox {
  const font = rawFont(element);
  const renderRuns = options.runs ?? rawRenderTextRuns(element);
  const content =
    options.content ??
    (options.runs ? textRunsContent(options.runs) : rawTextContent(element));
  const displayContent = displayText(content);
  const renderRunsDifferFromElement =
    renderRuns.length > 0 &&
    textRunsHaveMixedStyle([{ text: "", font }, ...renderRuns]);
  const align = readString(asRecord(element.alignment)?.horizontal) ?? "left";
  const verticalAlign =
    readString(asRecord(element.alignment)?.vertical) ?? "top";
  const textLineHeight = effectiveLineHeight({
    text: displayContent,
    width: box.width,
    fontSize: font.size,
    lineHeight: font.lineHeight,
    fallback: 1.15,
    wrap: TEXT_RENDER_WRAP,
  });

  if (renderRunsDifferFromElement) {
    const lines = layoutRenderTextRuns(renderRuns, box.width, TEXT_RENDER_WRAP);
    const lineMetrics = lines.map((line) => ({
      height: lineRenderHeight(line, textLineHeight),
      width: line.reduce((sum, segment) => sum + segment.width, 0),
    }));
    const totalHeight = lineMetrics.reduce(
      (sum, metric) => sum + metric.height,
      0,
    );
    const startY = verticalStartY(verticalAlign, box.height, totalHeight);
    const left = Math.min(
      0,
      ...lineMetrics.map((metric) =>
        lineStartX(align, box.width, metric.width, false),
      ),
    );
    const right = Math.max(
      box.width,
      ...lineMetrics.map((metric) => {
        const startX = lineStartX(
          align,
          box.width,
          metric.width,
          false,
        );
        return startX + metric.width;
      }),
    );
    return {
      x: box.x + left,
      y: box.y + Math.min(0, startY),
      width: Math.max(1, right - left),
      height: Math.max(box.height, totalHeight),
    };
  }

  if (renderRuns.length > 1) {
    const { tokens, contentHeight } = layoutRichText(
      renderRuns,
      box.width,
      font,
      align,
      verticalAlign,
      box.height,
      TEXT_RENDER_WRAP,
    );
    if (tokens.length === 0) return box;
    const left = Math.min(0, ...tokens.map((token) => token.x));
    const top = Math.min(0, ...tokens.map((token) => token.y));
    const right = Math.max(
      box.width,
      ...tokens.map((token) => token.x + token.width),
    );
    const bottom = Math.max(
      box.height,
      contentHeight,
      ...tokens.map((token) => token.y + token.height),
    );
    return {
      x: box.x + left,
      y: box.y + top,
      width: Math.max(1, right - left),
      height: Math.max(1, bottom - top),
    };
  }

  const textNodeRuns =
    renderRuns.length > 0 ? renderRuns : [{ text: displayContent, font }];
  return {
    ...box,
    height: Math.max(
      box.height,
      measureRenderTextRunsHeight(
        textNodeRuns,
        box.width,
        TEXT_RENDER_WRAP,
        textLineHeight,
      ),
    ),
  };
}

export function textListVisualLocalBox(
  element: TemplateV2RawTextElement,
  box: TemplateV2TextBox,
): TemplateV2TextBox {
  const { tokens, contentHeight } = layoutTextListRenderItems(
    element,
    box.width,
    box.height,
  );

  if (tokens.length === 0) return box;

  const left = Math.min(0, ...tokens.map((token) => token.x));
  const top = Math.min(0, ...tokens.map((token) => token.y));
  const right = Math.max(
    box.width,
    ...tokens.map((token) => token.x + token.width),
  );
  const bottom = Math.max(
    box.height,
    contentHeight,
    ...tokens.map((token) => token.y + token.height),
  );

  return {
    x: box.x + left,
    y: box.y + top,
    width: Math.max(1, right - left),
    height: Math.max(1, bottom - top),
  };
}

function measureRenderTextRunsHeight(
  runs: RenderTextRun[],
  width: number,
  wrap: string | null | undefined,
  fallbackLineHeight: number,
) {
  const lines = layoutRenderTextRuns(runs, width, wrap);
  if (lines.length === 0) return fallbackLineHeight;
  return lines.reduce(
    (sum, line) => sum + lineRenderHeight(line, fallbackLineHeight),
    0,
  );
}

export function textRunsHaveMixedStyle(runs: RenderTextRun[]) {
  const first = runs[0]?.font;
  return runs.some((run) => JSON.stringify(run.font) !== JSON.stringify(first));
}

export function layoutRichText(
  runs: RenderTextRun[],
  maxWidth: number,
  baseFont: RenderTextFont,
  align: string,
  verticalAlign: string,
  boxHeight: number,
  wrap: string | null | undefined,
): { tokens: LaidToken[]; contentHeight: number } {
  type Tok = {
    text: string;
    font: RenderTextFont;
    newline: boolean;
    space: boolean;
    width: number;
  };
  const tokens: Tok[] = [];
  for (const run of runs) {
    const display = displayText(run.text);
    if (!display) continue;
    for (const part of display.split(/(\n|[ \t]+)/)) {
      if (part === "") continue;
      if (part === "\n") {
        tokens.push({
          text: "",
          font: run.font,
          newline: true,
          space: false,
          width: 0,
        });
      } else {
        const space = /^[ \t]+$/.test(part);
        const measuredParts =
          wrap !== "none" && !space
            ? splitOversizedTextSegment(part, run.font, maxWidth, measureRunText)
            : [{ text: part, width: measureRunText(part, run.font) }];

        for (const measuredPart of measuredParts) {
          tokens.push({
            text: measuredPart.text,
            font: run.font,
            newline: false,
            space,
            width: measuredPart.width,
          });
        }
      }
    }
  }

  type Line = { toks: Tok[]; height: number; width: number };
  const lines: Line[] = [];
  let cur: Tok[] = [];
  let curWidth = 0;
  const flush = () => {
    const height = cur.length
      ? Math.max(...cur.map((t) => t.font.size * t.font.lineHeight))
      : baseFont.size * baseFont.lineHeight;
    lines.push({ toks: cur, height, width: curWidth });
    cur = [];
    curWidth = 0;
  };
  for (const tok of tokens) {
    if (tok.newline) {
      flush();
      continue;
    }
    if (
      wrap !== "none" &&
      !tok.space &&
      curWidth + tok.width > maxWidth &&
      cur.length > 0
    ) {
      flush();
    }
    cur.push(tok);
    curWidth += tok.width;
  }
  flush();

  const contentHeight = lines.reduce((sum, line) => sum + line.height, 0);
  let y =
    verticalAlign === "middle"
      ? (boxHeight - contentHeight) / 2
      : verticalAlign === "bottom"
        ? boxHeight - contentHeight
        : 0;
  if (y < 0) y = 0;

  const laid: LaidToken[] = [];
  for (const line of lines) {
    let x = lineStartX(align, maxWidth, line.width, wrap === "none");
    for (const tok of line.toks) {
      if (tok.text) {
        const tokenBoxHeight = tok.font.size * tok.font.lineHeight;
        laid.push({
          text: tok.text,
          font: tok.font,
          x,
          y: y + (line.height - tokenBoxHeight),
          width: tok.width,
          height: tokenBoxHeight,
        });
      }
      x += tok.width;
    }
    y += line.height;
  }
  return { tokens: laid, contentHeight };
}

export function layoutTextListRenderItems(
  element: TemplateV2RawTextElement,
  width: number,
  height: number,
): { tokens: LaidToken[]; contentHeight: number } {
  const font = rawFont(element);
  const items = rawTextListRenderItems(element);
  const textRuns = rawTextListRenderTextRuns(element);
  const content = textRunsContent(textRuns);
  const align = readString(asRecord(element.alignment)?.horizontal) ?? "left";
  const verticalAlign =
    readString(asRecord(element.alignment)?.vertical) ?? "top";
  const textLineHeight = effectiveLineHeight({
    text: displayText(content),
    width,
    fontSize: font.size,
    lineHeight: font.lineHeight,
    fallback: 1.15,
    wrap: TEXT_RENDER_WRAP,
  });

  type PlannedLine = {
    marker: RenderTextRun & { width: number } | null;
    segments: Array<RenderTextRun & { width: number }>;
    indentWidth: number;
    height: number;
    width: number;
  };

  const plannedLines: PlannedLine[] = [];
  const sourceItems =
    items.length > 0
      ? items
      : [{ marker: "", markerFont: font, runs: [{ text: " ", font }] }];

  for (const item of sourceItems) {
    const markerWidth = item.marker
      ? measureRenderText(item.marker, item.markerFont)
      : 0;
    const contentWidth = Math.max(1, width - markerWidth);
    const contentLines = layoutRenderTextRuns(
      item.runs.length > 0 ? item.runs : [{ text: " ", font: item.markerFont }],
      contentWidth,
      TEXT_RENDER_WRAP,
    );
    const lines = contentLines.length > 0 ? contentLines : [[]];

    lines.forEach((line, lineIndex) => {
      const marker =
        lineIndex === 0 && item.marker
          ? { text: item.marker, font: item.markerFont, width: markerWidth }
          : null;
      const markerHeight = marker
        ? marker.font.size * (marker.font.lineHeight ?? textLineHeight)
        : 0;
      const contentHeight =
        line.length > 0 ? lineRenderHeight(line, textLineHeight) : 0;
      const lineHeight = Math.max(
        1,
        markerHeight,
        contentHeight,
        font.size * textLineHeight,
      );
      const lineWidth =
        markerWidth + line.reduce((sum, segment) => sum + segment.width, 0);
      plannedLines.push({
        marker,
        segments: line,
        indentWidth: markerWidth,
        height: lineHeight,
        width: lineWidth,
      });
    });
  }

  const contentHeight = plannedLines.reduce(
    (sum, line) => sum + line.height,
    0,
  );
  let y = verticalTextStartY(verticalAlign, height, contentHeight, false);
  const tokens: LaidToken[] = [];

  for (const line of plannedLines) {
    const startX = lineStartX(align, width, line.width, false);
    let x = startX;

    if (line.marker) {
      const markerHeight =
        line.marker.font.size *
        (line.marker.font.lineHeight ?? textLineHeight);
      tokens.push({
        text: line.marker.text,
        font: line.marker.font,
        x,
        y: y + (line.height - markerHeight),
        width: line.marker.width,
        height: markerHeight,
      });
    }

    x += line.indentWidth;
    for (const segment of line.segments) {
      const segmentHeight =
        segment.font.size * (segment.font.lineHeight ?? textLineHeight);
      tokens.push({
        text: segment.text,
        font: segment.font,
        x,
        y: y + (line.height - segmentHeight),
        width: segment.width,
        height: segmentHeight,
      });
      x += segment.width;
    }

    y += line.height;
  }

  return { tokens, contentHeight };
}

export function layoutRenderTextRuns(
  runs: RenderTextRun[],
  width: number,
  wrap: string | null | undefined,
) {
  const lines: Array<Array<RenderTextRun & { width: number }>> = [[]];
  let lineWidth = 0;

  const pushLine = () => {
    if (lines[lines.length - 1]?.length === 0) return;
    lines.push([]);
    lineWidth = 0;
  };

  for (const run of runs) {
    const parts = run.text.match(/\n|[^\S\n]+|[^\s]+/g) ?? [run.text];
    for (const part of parts) {
      if (part === "\n") {
        pushLine();
        continue;
      }
      const isWhitespace = isRenderWhitespaceText(part);
      const segments =
        wrap !== "none" && !isWhitespace
          ? splitOversizedTextSegment(part, run.font, width, measureRenderText)
          : [{ text: part, width: measureRenderText(part, run.font) }];

      for (const segment of segments) {
        if (
          wrap !== "none" &&
          !isWhitespace &&
          lineWidth > 0 &&
          lineWidth + segment.width > width
        ) {
          pushLine();
        }
        if (lines.length === 0) lines.push([]);
        lines[lines.length - 1].push({
          ...run,
          text: segment.text,
          width: segment.width,
        });
        lineWidth += segment.width;
      }
    }
  }

  return lines.filter((line) => line.length > 0);
}

export function lineRenderHeight(
  line: Array<RenderTextRun & { width: number }>,
  fallbackLineHeight: number,
) {
  return Math.max(
    1,
    ...line.map(
      (segment) =>
        segment.font.size * (segment.font.lineHeight ?? fallbackLineHeight),
    ),
  );
}

function splitOversizedTextSegment(
  text: string,
  font: RenderTextFont,
  maxWidth: number,
  measure: (text: string, font: RenderTextFont) => number,
): Array<{ text: string; width: number }> {
  const fullWidth = measure(text, font);
  if (!text || maxWidth <= 0 || fullWidth <= maxWidth) {
    return [{ text, width: fullWidth }];
  }

  const characters = Array.from(text);
  const segments: Array<{ text: string; width: number }> = [];
  let start = 0;

  while (start < characters.length) {
    let low = start + 1;
    let high = characters.length;
    let bestEnd = low;
    let bestWidth = measure(characters.slice(start, low).join(""), font);

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      const candidate = characters.slice(start, mid).join("");
      const candidateWidth = measure(candidate, font);

      if (candidateWidth <= maxWidth || mid === start + 1) {
        bestEnd = mid;
        bestWidth = candidateWidth;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    segments.push({
      text: characters.slice(start, bestEnd).join(""),
      width: bestWidth,
    });
    start = bestEnd;
  }

  return segments;
}

export function measureNoWrapTextWidth(text: string, font: RenderTextFont) {
  const lines = text.split(/\r?\n/);
  return Math.max(1, ...lines.map((line) => measureRenderText(line, font)));
}

export function measureNoWrapTextHeight(
  text: string,
  font: RenderTextFont,
  lineHeight: number,
) {
  const lineCount = Math.max(1, text.split(/\r?\n/).length);
  return lineCount * font.size * lineHeight;
}

export function lineStartX(
  align: string,
  boxWidth: number,
  lineWidth: number,
  allowOverflow: boolean,
) {
  const x =
    align === "center"
      ? (boxWidth - lineWidth) / 2
      : align === "right"
        ? boxWidth - lineWidth
        : 0;
  return allowOverflow ? x : Math.max(0, x);
}

export function verticalTextStartY(
  align: string,
  boxHeight: number,
  textHeight: number,
  allowOverflow: boolean,
) {
  const y = verticalStartY(align, boxHeight, textHeight);
  return allowOverflow ? y : Math.max(0, y);
}

function verticalStartY(align: string, boxHeight: number, textHeight: number) {
  const y =
    align === "middle"
      ? (boxHeight - textHeight) / 2
      : align === "bottom"
        ? boxHeight - textHeight
        : 0;
  return y;
}

export function rawFontRecordForEditor(value: unknown) {
  const font = asRecord(value);
  if (!font) return value;
  return {
    ...withoutFontWrap(font),
    line_height: font.line_height ?? font.lineHeight,
    letter_spacing: font.letter_spacing ?? font.letterSpacing,
  };
}

export function editorFontRecordToRaw(value: unknown, fallback: unknown) {
  const font = asRecord(value);
  if (!font) return fallback;
  const fallbackFont = asRecord(fallback) ?? {};
  return {
    ...withoutFontWrap(fallbackFont),
    ...withoutFontWrap(font),
    line_height: font.line_height ?? font.lineHeight,
    letter_spacing: font.letter_spacing ?? font.letterSpacing,
  };
}

export function rawFontToSource(value: unknown) {
  const font = asRecord(value) ?? {};
  return stripUndefined({
    ...withoutFontWrap(font),
    line_height: font.line_height ?? font.lineHeight,
    letter_spacing: font.letter_spacing ?? font.letterSpacing,
    opacity: font.opacity,
  });
}

export function fontScaleFromResize(scaleX: number, scaleY: number) {
  const safeX = Number.isFinite(scaleX) && scaleX > 0 ? scaleX : 1;
  const safeY = Number.isFinite(scaleY) && scaleY > 0 ? scaleY : 1;
  return Math.sqrt(safeX * safeY);
}

export function scaleRawTextMetrics(
  element: TemplateV2RawTextElement,
  scale: number,
): TemplateV2RawTextElement {
  if (
    !Number.isFinite(scale) ||
    Math.abs(scale - 1) < TRANSFORM_FONT_SCALE_EPSILON
  ) {
    return element;
  }

  return stripUndefined({
    ...element,
    font: scaleRawFontMetrics(element.font, scale),
    runs: scaleRawTextRunsMetrics(element.runs, scale),
    items: scaleRawTextListItemsMetrics(element.items, scale),
    columns: scaleRawTableCellsMetrics(element.columns, scale),
    rows: scaleRawTableRowsMetrics(element.rows, scale),
  });
}

function scaleRawTextRunsMetrics(value: unknown, scale: number) {
  if (!Array.isArray(value)) return value;
  return value.map((run) => {
    const record = asRecord(run);
    if (!record) return run;
    return stripUndefined({
      ...record,
      font: scaleRawFontMetrics(record.font, scale),
    });
  });
}

function scaleRawTextListItemsMetrics(value: unknown, scale: number) {
  if (!Array.isArray(value)) return value;
  return value.map((item) => {
    if (Array.isArray(item)) return scaleRawTextRunsMetrics(item, scale);
    const record = asRecord(item);
    if (!record) return item;
    return stripUndefined({
      ...record,
      font: scaleRawFontMetrics(record.font, scale),
      runs: scaleRawTextRunsMetrics(record.runs, scale),
    });
  });
}

function scaleRawTableRowsMetrics(value: unknown, scale: number) {
  if (!Array.isArray(value)) return value;
  return value.map((row) =>
    Array.isArray(row) ? scaleRawTableCellsMetrics(row, scale) : row,
  );
}

function scaleRawTableCellsMetrics(value: unknown, scale: number) {
  if (!Array.isArray(value)) return value;
  return value.map((cell) => {
    const record = asRecord(cell);
    if (!record) return cell;
    const textRecord = asRecord(record.text);
    return stripUndefined({
      ...record,
      font: scaleRawFontMetrics(record.font, scale),
      runs: scaleRawTextRunsMetrics(record.runs, scale),
      text: textRecord
        ? stripUndefined({
          ...textRecord,
          font: scaleRawFontMetrics(textRecord.font, scale),
          runs: scaleRawTextRunsMetrics(textRecord.runs, scale),
        })
        : record.text,
    });
  });
}

function scaleRawFontMetrics(value: unknown, scale: number) {
  const font = asRecord(value);
  if (!font) return value;

  const next = { ...font };
  const size = readNumber(font.size);
  if (size != null) {
    next.size = scaleFontSize(size, scale);
  }

  const letterSpacing = readNumber(font.letter_spacing);
  if (letterSpacing != null) {
    next.letter_spacing = scaleTextMetric(letterSpacing, scale);
  }

  const camelLetterSpacing = readNumber(font.letterSpacing);
  if (camelLetterSpacing != null) {
    next.letterSpacing = scaleTextMetric(camelLetterSpacing, scale);
  }

  return stripUndefined(next);
}

function scaleFontSize(size: number, scale: number) {
  return Math.min(
    MAX_TRANSFORM_FONT_SIZE,
    Math.max(MIN_TRANSFORM_FONT_SIZE, scaleTextMetric(size, scale)),
  );
}

function scaleTextMetric(value: number, scale: number) {
  return Math.round(value * scale * 100) / 100;
}

function rawTextListItemSourceRuns(
  item: unknown,
  fallback: RenderTextFont,
): TextRun[] {
  const fallbackFont = fontToSource(fallback);
  if (typeof item === "string") return [{ text: item, font: fallbackFont }];
  if (typeof item === "number") {
    return [{ text: String(item), font: fallbackFont }];
  }

  if (Array.isArray(item)) {
    const runs = item
      .map((run) => rawRunRecordToTextRun(run, fallback))
      .filter((run): run is TextRun => Boolean(run));
    return runs.length > 0 ? runs : [{ text: " ", font: fallbackFont }];
  }

  const record = asRecord(item);
  if (!record) return [];
  const itemFont = fontFromRecord(asRecord(record.font), fallback);
  const runs = readArray(record.runs)
    .map((run) => rawRunRecordToTextRun(run, itemFont))
    .filter((run): run is TextRun => Boolean(run));
  if (runs.length > 0) return runs;

  const text = readString(record.text);
  if (text != null) return [{ text, font: fontToSource(itemFont) }];
  return [];
}

function rawRunRecordToTextRun(
  value: unknown,
  fallback: RenderTextFont,
): TextRun | null {
  const record = asRecord(value);
  if (!record) return null;
  const text = readString(record.text) ?? "";
  if (!text) return null;
  return {
    text,
    font: fontToSource(fontFromRecord(asRecord(record.font), fallback)),
  };
}

function textListMarkerPrefix(value: unknown, index: number) {
  const marker = readString(value);
  if (marker === "none") return "";
  if (marker === "number") return `${index + 1}. `;
  return "• ";
}

function rawTextListItemWithRuns(source: unknown, runs: TextRun[]): unknown {
  const sourceRuns = Array.isArray(source)
    ? source
    : readArray(asRecord(source)?.runs);
  return runs.map((run, index) => {
    const sourceRun = asRecord(sourceRuns[index]) ?? {};
    return {
      ...sourceRun,
      text: run.text,
      font: rawInlineTextFontRecord(run.font, sourceRun.font),
    };
  });
}

function splitTextRunsOnNewlines(runs: TextRun[]): TextRun[][] {
  const lines: TextRun[][] = [[]];

  for (const run of runs) {
    const parts = (run.text || "").split(/\r?\n/);
    parts.forEach((part, index) => {
      if (index > 0) lines.push([]);
      if (!part) return;
      lines[lines.length - 1].push({
        ...run,
        text: part,
        font: run.font ? { ...run.font } : undefined,
      });
    });
  }

  return lines;
}

function stripPlainTextListMarkersFromRuns(runs: TextRun[]): TextRun[] {
  const lines = splitTextRunsOnNewlines(runs);
  const stripped: TextRun[] = [];

  lines.forEach((line, index) => {
    const normalizedLine = stripTextListMarkerFromRuns(line);
    const lineFont =
      normalizedLine[0]?.font ?? line[0]?.font ?? stripped.at(-1)?.font;

    if (index > 0) appendTextRun(stripped, "\n", lineFont);
    normalizedLine.forEach((run) =>
      appendTextRun(stripped, run.text, run.font),
    );
  });

  return stripped.length > 0 ? stripped : [{ text: " " }];
}

function stripTextListMarkerFromRuns(runs: TextRun[]): TextRun[] {
  const marker = textRunsContent(runs).match(
    /^\s*(?:[-*•]\s+|\d+[.)]\s+)/u,
  )?.[0];
  if (!marker) return runs;
  return removeTextRunPrefix(runs, marker.length);
}

function removeTextRunPrefix(runs: TextRun[], length: number): TextRun[] {
  let remaining = length;
  const stripped: TextRun[] = [];

  for (const run of runs) {
    if (remaining <= 0) {
      stripped.push(cloneTextRun(run));
      continue;
    }

    const text = run.text ?? "";
    if (text.length <= remaining) {
      remaining -= text.length;
      continue;
    }

    const consumed = remaining;
    remaining = 0;
    stripped.push({
      ...run,
      text: text.slice(consumed),
      font: run.font ? { ...run.font } : undefined,
    });
  }

  return stripped;
}

function appendTextRun(
  runs: TextRun[],
  text: string,
  font: TextRun["font"],
) {
  if (!text) return;
  const previous = runs[runs.length - 1];
  if (
    previous &&
    JSON.stringify(previous.font ?? null) === JSON.stringify(font ?? null)
  ) {
    previous.text += text;
    return;
  }
  runs.push(font ? { text, font: { ...font } } : { text });
}

function reconcileTextRunsWithStoredText(
  runs: TextRun[],
  storedText: string,
): TextRun[] {
  if (!storedText || runs.length === 0) return runs;
  if (containsMarkdownSyntax(storedText)) return runs;
  if (textRunsContent(runs) === storedText) return runs;

  const reconciled: TextRun[] = [];
  let cursor = 0;

  for (const run of runs) {
    const runText = run.text ?? "";
    if (!runText) continue;
    const index = storedText.indexOf(runText, cursor);
    if (index < 0) return runs;

    const gap = storedText.slice(cursor, index);
    appendRunText(reconciled, gap, run.font);
    reconciled.push(cloneTextRun(run));
    cursor = index + runText.length;
  }

  appendRunText(
    reconciled,
    storedText.slice(cursor),
    runs[runs.length - 1]?.font,
  );
  return textRunsContent(reconciled) === storedText ? reconciled : runs;
}

function appendRunText(
  runs: TextRun[],
  text: string,
  font: TextRun["font"],
) {
  if (!text) return;
  const previous = runs[runs.length - 1];
  if (previous) {
    previous.text += text;
    return;
  }
  runs.push(font ? { text, font: { ...font } } : { text });
}

function cloneTextRun(run: TextRun): TextRun {
  return {
    ...run,
    font: run.font ? { ...run.font } : undefined,
  };
}

function containsMarkdownSyntax(text: string) {
  return /(\*\*|__|\*|_).+(\*\*|__|\*|_)/.test(text);
}

function sameTextRuns(left: TextRun[], right: TextRun[]) {
  if (left.length !== right.length) return false;
  return left.every(
    (run, index) =>
      run.text === right[index]?.text &&
      JSON.stringify(run.font ?? null) ===
      JSON.stringify(right[index]?.font ?? null),
  );
}

function measureContext(): CanvasRenderingContext2D | null {
  if (typeof document === "undefined") return null;
  if (!richMeasureCtx.ctx) {
    richMeasureCtx.ctx = document.createElement("canvas").getContext("2d");
  }
  return richMeasureCtx.ctx;
}

function richFontCss(font: RenderTextFont): string {
  const italic = font.italic ? "italic " : "";
  const weight = font.bold ? "700 " : "400 ";
  return `${italic}${weight}${font.size}px ${quotedFontFamily(font.family)}, Helvetica, sans-serif`;
}

function quotedFontFamily(family: string): string {
  const name = (family || DEFAULT_FONT.family).trim() || DEFAULT_FONT.family;
  return `"${name.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function measureRunText(text: string, font: RenderTextFont): number {
  if (!text) return 0;
  const ctx = measureContext();
  if (!ctx) return text.length * font.size * TEXT_AVERAGE_CHAR_EM;
  ctx.font = richFontCss(font);
  const width = ctx.measureText(text).width;
  const spacing = font.letterSpacing
    ? font.letterSpacing * Math.max(0, text.length - 1)
    : 0;
  return width + spacing;
}

function measureRenderText(text: string, font: RenderTextFont) {
  const fallbackWidth =
    text.length * font.size * (font.bold ? 0.58 : TEXT_AVERAGE_CHAR_EM);
  if (typeof document === "undefined") return fallbackWidth;
  renderTextMeasureCanvas ??= document.createElement("canvas");
  const context = renderTextMeasureCanvas.getContext("2d");
  if (!context) return fallbackWidth;
  context.font = richFontCss(font);
  return (
    context.measureText(text).width +
    (font.letterSpacing ?? 0) * Math.max(0, text.length - 1)
  );
}

function readHorizontalAlignment(
  value: unknown,
): TemplateV2TextEditStyle["horizontal"] {
  const normalized = readString(value);
  if (normalized === "center" || normalized === "right") return normalized;
  return "left";
}

function readVerticalAlignment(
  value: unknown,
): TemplateV2TextEditStyle["vertical"] {
  const normalized = readString(value);
  if (normalized === "middle" || normalized === "bottom") return normalized;
  return "top";
}

function readArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function stripUndefined<T extends UnknownRecord>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined),
  ) as T;
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
