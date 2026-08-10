import { resolveBackendAssetUrl } from "@/utils/api";
import { markdownToPlainChartText } from "@/components/slide-editor/charts/chart-data";
import { normalizeRawTextMarkdownElement } from "@/components/slide-editor/text/template-v2-text";
import { normalizeMathLatex, renderMathHtml } from "@/lib/math";
import {
  CHART_BROWSER_SCRIPT_URL,
  CHART_DATALABELS_SCRIPT_URL,
} from "@/lib/chart-browser";

type JsonRecord = Record<string, unknown>;
type RenderMode = "absolute" | "flow";
type DataLabelPosition = "base" | "mid" | "top" | "outside";
type ChartKind =
  | "bar"
  | "bubble"
  | "horizontal_bar"
  | "horizontal_stacked_bar"
  | "stacked_bar"
  | "line"
  | "area"
  | "pie"
  | "donut"
  | "polar_area"
  | "radar"
  | "scatter";
type InfographicKind = "progress_bar" | "gauge";

type JsonToHtmlItem = JsonRecord;
const DATA_LABEL_POSITIONS = new Set(["base", "mid", "top", "outside"]);

interface ChartPointData {
  x: number;
  y: number;
  r?: number;
}

interface ChartSeriesData {
  name: string;
  points: ChartPointData[];
  values: number[];
}

interface NormalizedChartData {
  categories: string[];
  colors: string[];
  series: ChartSeriesData[];
}

interface Box {
  x: number;
  y: number;
  width?: number;
  height?: number;
}

interface Point {
  x: number;
  y: number;
}

interface FontFaceDefinition {
  family: string;
  url: string;
  format?: string;
  weight?: string;
  style?: string;
}

interface TemplateV2HtmlOptions {
  fonts?: unknown;
  width?: number;
  height?: number;
}

interface TemplateV2RenderPayload {
  items: JsonToHtmlItem[];
  width: number;
  height: number;
  fonts?: unknown;
  background: string;
}

const ELEMENT_TYPES = new Set([
  "text",
  "math",
  "container",
  "image",
  "text-list",
  "table",
  "vector",
  "svg",
  "chart",
  "infographic",
  "flex",
  "grid",
  "group",
  "list-view",
  "grid-view",
]);

const DEFAULT_CHART_COLORS = [
  "#7F22FE",
  "#155DFC",
  "#F59E0B",
  "#12B76A",
  "#EF4444",
  "#06B6D4",
  "#8B5CF6",
  "#64748B",
];

const CHART_FONT_FAMILY = "Inter, Arial, sans-serif";

export const TEMPLATE_V2_HTML_WIDTH = 1280;
export const TEMPLATE_V2_HTML_HEIGHT = 720;

export function templateV2UiToHtml(
  ui: unknown,
  options: TemplateV2HtmlOptions = {}
): string | null {
  const payload = templateV2RenderPayload(ui, options);
  if (!payload) return null;

  return jsonToHtml(
    payload.items,
    payload.width,
    payload.height,
    payload.fonts,
    payload.background
  );
}

export function templateV2UiToHtmlFragment(
  ui: unknown,
  options: TemplateV2HtmlOptions = {}
): string | null {
  const payload = templateV2RenderPayload(ui, options);
  if (!payload) return null;

  return jsonToHtmlFragment(
    payload.items,
    payload.width,
    payload.height,
    payload.fonts,
    payload.background
  );
}

function templateV2RenderPayload(
  ui: unknown,
  options: TemplateV2HtmlOptions
): TemplateV2RenderPayload | null {
  const record = readRecord(ui);
  const rootElements = readArray(record.elements);
  const components = readArray(record.components);
  const items = [...rootElements, ...components].map((item) =>
    readRecord(normalizeTemplateV2AssetUrls(item))
  );

  if (items.length === 0) {
    return null;
  }

  const width = options.width ?? TEMPLATE_V2_HTML_WIDTH;
  const height = options.height ?? TEMPLATE_V2_HTML_HEIGHT;
  const background = normalizeCssColor(readString(record.background) ?? "#FFFFFF");

  return {
    items,
    width,
    height,
    fonts: options.fonts,
    background,
  };
}

export function hasTemplateV2RenderableUi(ui: unknown): boolean {
  const record = readRecord(ui);
  return readArray(record.components).length > 0 || readArray(record.elements).length > 0;
}

function normalizeTemplateV2AssetUrls(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(normalizeTemplateV2AssetUrls);
  }

  const record = readRecord(value);
  if (!Object.keys(record).length) return value;

  const normalized = Object.fromEntries(
    Object.entries(record).map(([key, child]) => [
      key,
      normalizeTemplateV2AssetUrls(child),
    ])
  ) as JsonRecord;

  if (readString(normalized.type) === "image") {
    const source = readString(normalized.data);
    if (source) {
      normalized.data = resolveBackendAssetUrl(source);
    }
  }

  return normalized;
}

function jsonToHtml(
  items: JsonToHtmlItem[],
  width: number,
  height: number,
  fonts: unknown = {},
  background = "#FFFFFF"
): string {
  const records = items.map(readRecord);
  const chartScripts = records.some(hasChartItem) ? renderChartScripts() : "";
  const fontAssetTags = renderFontAssetTags(fonts);
  const bg = escapeCssColor(background);
  const slideRoot = renderSlideRoot(records, width, height, bg);

  return `<!doctype html>
<html><head><meta charset="utf-8">${fontAssetTags}<style>
html,body{margin:0;width:100%;height:100%;overflow:hidden;background:${bg}}
body{font-family:Arial,Helvetica,sans-serif}
*,*::before,*::after{box-sizing:border-box}
</style></head><body>${slideRoot}${chartScripts}</body></html>`;
}

function jsonToHtmlFragment(
  items: JsonToHtmlItem[],
  width: number,
  height: number,
  fonts: unknown = {},
  background = "#FFFFFF"
): string {
  const records = items.map(readRecord);
  const bg = escapeCssColor(background);

  return `${renderFontAssetTags(fonts)}${renderSlideRoot(
    records,
    width,
    height,
    bg
  )}`;
}

function renderSlideRoot(
  records: JsonRecord[],
  width: number,
  height: number,
  background: string
): string {
  resolveOverflowLayout(records);
  const content = records.map((item) => renderItem(item, "absolute")).join("");

  return `<div class="relative overflow-hidden" data-template-v2-html-slide="true" style="box-sizing:border-box;position:relative;width:${cssNumber(
    width
  )}px;height:${cssNumber(
    height
  )}px;overflow:hidden;background:${background};font-family:Arial,Helvetica,sans-serif">${content}</div>`;
}

function renderFontAssetTags(fonts: unknown): string {
  const css = readStringValueOrNull(fonts);
  if (css) {
    return `<style>${escapeStyleText(css)}${fontCssFamilyAliases(css)}</style>`;
  }

  const tags: string[] = [];
  const records = readRecord(fonts);
  const embeddedCss = readStringValueOrNull(records.css ?? records.font_css);
  if (embeddedCss) {
    tags.push(
      `<style>${escapeStyleText(embeddedCss)}${fontCssFamilyAliases(embeddedCss)}</style>`
    );
  }

  const faceEntries = readArray(records.fonts).length ? records.fonts : fonts;
  tags.push(...normalizeFontFaces(faceEntries).map(renderFontFaceDefinition));

  const stylesheets = normalizeFontStylesheetUrls(faceEntries);
  tags.push(
    ...stylesheets.map(
      (url) =>
        `<link rel="stylesheet" href="${escapeAttribute(resolveBackendAssetUrl(url))}">`
    )
  );

  return tags.join("");
}

function normalizeFontFaces(fonts: unknown): FontFaceDefinition[] {
  if (Array.isArray(fonts)) {
    return fonts.flatMap((entry) => normalizeFontFaceEntry(undefined, entry));
  }

  return Object.entries(readRecord(fonts)).flatMap(([family, value]) =>
    family === "css" || family === "font_css" || family === "fonts"
      ? []
      : normalizeFontFaceEntry(family, value)
  );
}

function normalizeFontFaceEntry(
  fallbackFamily: string | undefined,
  value: unknown
): FontFaceDefinition[] {
  if (Array.isArray(value)) {
    return value.flatMap((entry) => normalizeFontFaceEntry(fallbackFamily, entry));
  }

  const url = readString(value);
  if (url) {
    if (isFontStylesheetUrl(url)) return [];
    const family = fallbackFamily?.trim();
    return family
      ? [
        {
          family,
          url,
          weight: inferFontWeight(`${family} ${url}`),
          style: inferFontStyle(`${family} ${url}`),
        },
      ]
      : [];
  }

  const record = readRecord(value);
  const family = readString(
    record.family ?? record.name ?? record.fontFamily ?? record.font_family
  ) ?? fallbackFamily?.trim();
  const source = readString(
    record.url ?? record.src ?? record.href ?? record.data ?? record.source
  );
  if (!family || !source || isFontStylesheetUrl(source)) return [];

  return [
    {
      family,
      url: source,
      format: readString(record.format) ?? undefined,
      weight:
        readFontWeight(record.weight ?? record.fontWeight ?? record.font_weight) ??
        inferFontWeight(`${family} ${source}`),
      style:
        readFontStyle(record.style ?? record.fontStyle ?? record.font_style) ??
        inferFontStyle(`${family} ${source}`),
    },
  ];
}

function normalizeFontStylesheetUrls(fonts: unknown): string[] {
  if (Array.isArray(fonts)) {
    return fonts.flatMap(normalizeFontStylesheetUrls);
  }

  const directUrl = readString(fonts);
  if (directUrl && isFontStylesheetUrl(directUrl)) return [directUrl];

  return Object.values(readRecord(fonts)).flatMap((value) => {
    const url = readString(value);
    if (url && isFontStylesheetUrl(url)) return [url];

    const record = readRecord(value);
    const source = readString(
      record.url ?? record.src ?? record.href ?? record.data ?? record.source
    );
    return source && isFontStylesheetUrl(source) ? [source] : [];
  });
}

function renderFontFaceDefinition(definition: FontFaceDefinition): string {
  const aliases = fontFamilyAliases(definition.family, definition.weight);
  const src = `url("${escapeCssUrl(resolveBackendAssetUrl(definition.url))}")${definition.format ? ` format("${escapeCssUrl(definition.format)}")` : ""
    }`;
  return aliases
    .map(
      (family) =>
        `<style>@font-face{font-family:${escapeCssFont(
          family
        )};src:${src};font-weight:${definition.weight ?? "400"};font-style:${definition.style ?? "normal"
        };font-display:swap}</style>`
    )
    .join("");
}

function fontCssFamilyAliases(css: string): string {
  const aliases: string[] = [];
  const facePattern = /@font-face\s*\{[^}]*font-family\s*:\s*(['"]?)([^;'"}]+)\1[^}]*\}/gi;
  for (const match of css.matchAll(facePattern)) {
    const block = match[0];
    const family = match[2]?.trim();
    if (!family) continue;
    const weight = /font-weight\s*:\s*([^;}]+)/i.exec(block)?.[1]?.trim();
    for (const alias of fontFamilyAliases(family, weight).filter(
      (item) => item !== family
    )) {
      aliases.push(
        block.replace(
          /font-family\s*:\s*(['"]?)([^;'"}]+)\1/i,
          `font-family:${escapeCssFont(alias)}`
        )
      );
    }
  }
  return aliases.join("");
}

function fontFamilyAliases(family: string, weight?: string): string[] {
  const normalized = family.trim();
  const aliases = new Set([normalized]);
  const alias = normalized
    .replace(/\s+(regular|bold\s*italic|bold|italic|black|semibold|semi\s*bold|medium|light)$/i, "")
    .trim();

  if (alias && alias !== normalized && (weight || inferFontWeight(normalized))) {
    aliases.add(alias);
  }

  return [...aliases];
}

function renderItem(item: JsonRecord, mode: RenderMode): string {
  if (isComponent(item)) {
    return renderGroup({ ...item, type: "group", children: item.elements }, mode);
  }

  switch (readString(item.type)) {
    case "vector":
      return renderPolygon(item, mode);
    case "svg":
      return renderSvg(item, mode);
    case "image":
      return renderImage(item, mode);
    case "text":
      return renderText(item, mode);
    case "math":
      return renderMath(item, mode);
    case "text-list":
      return renderTextList(item, mode);
    case "table":
      return renderTable(item, mode);
    case "container":
      return renderContainer(item, mode);
    case "flex":
    case "list-view":
      return renderFlex(item, mode);
    case "grid":
    case "grid-view":
      return renderGrid(item, mode);
    case "group":
      return renderGroup(item, mode);
    case "chart":
      return renderChart(item, mode);
    case "infographic":
      return renderInfographic(item, mode);
    default:
      if (Array.isArray(item.children)) return renderGroup(item, mode);
      if (readRecordOrNull(item.child)) return renderContainer(item, mode);
      return "";
  }
}

function renderImage(item: JsonRecord, mode: RenderMode): string {
  const source = readString(item.data);
  if (!source) return "";
  const color = normalizeChartColor(readString(item.color));
  const clipPath = clipPathStyle(item);
  if (color && readBoolean(item.isIcon ?? item.is_icon)) {
    const maskUrl = cssUrl(source);
    const maskSize = imageMaskSize(item.fit);
    return `<div style="${frameStyle(item, mode)}${boxStyle(
      item
    )}color:${escapeCssColor(
      color
    )};background:currentColor;-webkit-mask:${maskUrl} center/${maskSize} no-repeat;mask:${maskUrl} center/${maskSize} no-repeat;${clipPath}"></div>`;
  }
  const fit = imageFit(item.fit);
  const focusStyle = imageFocusStyle(item);
  const cropTransformStyle = imageCropTransformStyle(item);
  if (cropTransformStyle) {
    return `<div style="${frameStyle(item, mode)}${boxStyle(
      item
    )}${clipPath}overflow:hidden;"><img alt="" src="${escapeAttribute(
      source
    )}" style="display:block;max-width:none;max-height:none;height:100%;width:100%;object-fit:${fit};${focusStyle}${cropTransformStyle}"></div>`;
  }
  if (clipPath) {
    return `<div style="${frameStyle(item, mode)}${boxStyle(
      item
    )}${clipPath}overflow:hidden;"><img alt="" src="${escapeAttribute(
      source
    )}" style="display:block;max-width:none;max-height:none;height:100%;width:100%;object-fit:${fit};${focusStyle}"></div>`;
  }
  return `<img alt="" src="${escapeAttribute(source)}" style="${frameStyle(
    item,
    mode
  )}${boxStyle(
    item
  )}display:block;max-width:none;max-height:none;object-fit:${fit};${focusStyle}${clipPath}">`;
}

function renderText(item: JsonRecord, mode: RenderMode): string {
  const font = readRecord(item.font);
  const alignment = readRecord(item.alignment);
  const horizontal = readString(alignment.horizontal);
  const vertical = readString(alignment.vertical);
  const runs = normalizedRunsForHtml(item, font);
  const scale = titleFitScale(item, font, runs);
  const scaledFont = scale === 1 ? font : { ...font, size: (readNumber(font.size) ?? 0) * scale };
  const runHtml = runs
    .map((run) => {
      const runFont = { ...font, ...readRecord(run.font) };
      if (scale !== 1) {
        runFont.size = (readNumber(runFont.size) ?? readNumber(font.size) ?? 0) * scale;
      }
      return `<span style="${fontStyle(runFont)}">${escapeHtml(
        readStringValue(run.text)
      )}</span>`;
    })
    .join("");

  return `<div style="${frameStyle(item, mode)}${transformStyle(item)}${fontStyle(scaledFont, {
    includeLineHeight: false,
    includeTextDecoration: false,
  })}${textShadowStyle(item)}display:flex;align-items:${verticalAlign(
    vertical
  )};justify-content:${horizontalAlign(horizontal)};${lineHeightStyle(
    scaledFont,
    1.1
  )}${textOverflowStyle()}text-align:${textAlign(horizontal)};"><span style="display:block;width:100%">${runHtml}</span></div>`;
}

// Shrinks headline font if estimated line count won't fit the box height (no real text
// measurement available server-side, so this is a glyph-width estimate). Floor: 60%.
function titleFitScale(item: JsonRecord, font: JsonRecord, runs: JsonRecord[]): number {
  const size = readNumber(font.size);
  if (size == null || size < DISPLAY_HEADING_MIN_SIZE) return 1;

  const box = readBox(item);
  if (!box.width || !box.height) return 1;

  const lineHeight = effectiveLineHeight(font, 1.1);
  if (lineHeight == null) return 1;

  const text = runs.map((run) => readStringValue(run.text)).join("");
  if (!text) return 1;

  let scale = 1;
  for (let i = 0; i < 8; i++) {
    const currentSize = size * scale;
    const avgCharWidth = currentSize * 0.56;
    const charsPerLine = Math.max(1, Math.floor(box.width / avgCharWidth));
    const lines = Math.max(1, Math.ceil(text.length / charsPerLine));
    const neededHeight = lines * currentSize * lineHeight;
    if (neededHeight <= box.height || scale <= 0.6) break;
    scale = Math.max(0.6, scale - 0.08);
  }
  return scale;
}

// Заголовок и элементы под ним (разделитель, подзаголовок, карточка) — независимые
// прямоугольники со своими x/y от LLM, без общего flow-layout. titleFitScale уже
// ужимает шрифт, чтобы влезть в СВОЮ рамку, но если рамка была выбрана в расчёте на
// меньше строк, чем реально нужно, заголовок всё равно вылезает за неё и перекрывает
// то, что стоит ниже (см. слайд с заголовком в 3 строки поверх декоративной полоски).
// Сдвигаем всё, что стоит в том же столбце ниже заголовка, на величину переполнения.
function resolveOverflowLayout(records: JsonRecord[]): void {
  for (const item of records) {
    if (readString(item.type) !== "text") continue;
    const font = readRecord(item.font);
    const size = readNumber(font.size);
    if (size == null) continue;

    const box = readBox(item);
    if (!box.width || !box.height) continue;

    const runs = normalizedRunsForHtml(item, font);
    const text = runs.map((run) => readStringValue(run.text)).join("");
    if (!text) continue;

    // Заголовочный масштаб (>=36px) сам ужимается через titleFitScale — обычный
    // текст абзаца не уменьшаем, просто меряем, сколько места ему реально нужно.
    const scale = size >= DISPLAY_HEADING_MIN_SIZE ? titleFitScale(item, font, runs) : 1;
    const currentSize = size * scale;
    const lineHeight = effectiveLineHeight({ ...font, size: currentSize }, 1.1) ?? 1.1;
    const avgCharWidth = currentSize * 0.56;
    const charsPerLine = Math.max(1, Math.floor(box.width / avgCharWidth));
    const lines = Math.max(1, Math.ceil(text.length / charsPerLine));
    const neededHeight = lines * currentSize * lineHeight;

    const overflow = neededHeight - box.height;
    if (overflow <= 0) continue;

    const bottom = box.y + box.height;
    const left = box.x;
    const right = box.x + box.width;

    for (const other of records) {
      if (other === item) continue;
      const otherBox = readBox(other);
      if (otherBox.y == null || otherBox.y < bottom - 1) continue;
      const otherLeft = otherBox.x ?? 0;
      const otherRight = otherLeft + (otherBox.width ?? 0);
      if (otherRight <= left || otherLeft >= right) continue; // другой столбец — не трогаем

      const position = readRecord(other.position);
      other.position = { ...position, y: (readNumber(position.y) ?? otherBox.y) + overflow };
    }
  }
}

function renderMath(item: JsonRecord, mode: RenderMode): string {
  const latex = normalizeMathLatex(item.latex);
  if (!latex) return "";
  const font = readRecord(item.font);
  const alignment = readRecord(item.alignment);
  const horizontal = readString(alignment.horizontal);
  const vertical = readString(alignment.vertical);
  const displayMode = readBoolean(item.display_mode ?? item.displayMode) ?? true;
  const markup = renderMathHtml(latex, { displayMode });
  const color = normalizeCssColor(readString(font.color) ?? "#111827");
  const fontSize = readNumber(font.size) ?? 32;

  return `<div data-presenton-math="true" data-screenshot="true" data-screenshot-include-children="true" aria-label="${escapeAttribute(
    `Mathematical expression: ${latex}`
  )}" style="${frameStyle(item, mode)}${transformStyle(
    item
  )}display:flex;align-items:${verticalAlign(vertical)};justify-content:${horizontalAlign(
    horizontal
  )};overflow:hidden;color:${escapeCssColor(color)};font-size:${cssNumber(
    fontSize
  )}px;"><div style="max-width:100%;max-height:100%;overflow:hidden;">${markup}</div></div>`;
}

function renderTextList(item: JsonRecord, mode: RenderMode): string {
  const marker = readString(item.marker);
  const tag = marker === "number" ? "ol" : "ul";
  const font = readRecord(item.font);
  const entries = readArray(item.items)
    .map((entry) => {
      const runs = normalizedListRunsForHtml(entry, font);
      const html = runs
        .map(
          (run) =>
            `<span style="${fontStyle({
              ...font,
              ...readRecord(run.font),
            })}">${escapeHtml(readStringValue(run.text))}</span>`
        )
        .join("");
      return `<li style="${textOverflowStyle()}">${html}</li>`;
    })
    .join("");
  const listStyle = `margin:0;padding-left:${marker === "none" ? 0 : 24}px;${marker === "none" ? "list-style-type:none;" : ""
    }`;

  return `<div style="${frameStyle(item, mode)}${transformStyle(item)}${fontStyle(
    font,
    { includeTextDecoration: false }
  )}${textOverflowStyle()}"><${tag} style="${listStyle}">${entries}</${tag}></div>`;
}

function renderTable(item: JsonRecord, mode: RenderMode): string {
  const rows = tableRows(item);
  if (!rows.length) {
    return `<div style="${frameStyle(
      item,
      mode
    )}${transformStyle(item)}overflow:hidden"></div>`;
  }

  const rowCount = Math.max(1, rows.length);
  const colCount = Math.max(1, ...rows.map((row) => row.length));
  const tableFont = tableBaseFont(item);
  const cells = rows
    .flatMap((row, rowIndex) =>
      Array.from({ length: colCount }, (_, colIndex) => {
        const cell = row[colIndex] ?? {};
        const isHeader = rowIndex === 0;
        return `<div style="${tableCellStyle(
          cell,
          isHeader,
          tableFont
        )}">${cellText(cell, tableFont, isHeader)}</div>`;
      })
    )
    .join("");
  return `<div style="${frameStyle(
    item,
    mode
  )}${transformStyle(item)}display:grid;grid-template-columns:repeat(${colCount},minmax(0,1fr));grid-template-rows:repeat(${rowCount},minmax(0,1fr));overflow:hidden">${cells}</div>`;
}

function renderContainer(item: JsonRecord, mode: RenderMode): string {
  const child = readRecordOrNull(item.child);
  const alignment = readRecord(item.alignment);
  const style = `${frameStyle(item, mode)}${boxStyle(item)}${paddingStyle(
    readRecord(item.padding)
  )}display:flex;align-items:${verticalAlign(
    readString(alignment.vertical)
  )};justify-content:${horizontalAlign(
    readString(alignment.horizontal)
  )};${containerOverflowStyle(item, child)}`;
  return `<div style="${style}">${
    child ? renderItem(child, readRecordOrNull(child.position) ? "absolute" : "flow") : ""
  }</div>`;
}

function containerOverflowStyle(
  item: JsonRecord,
  child: JsonRecord | null
): string {
  const overflow = readString(item.overflow);
  if (overflow === "hidden" || overflow === "visible") {
    return `overflow:${overflow}`;
  }
  if (readBoolean(item.clip)) return "overflow:hidden";
  if (!child || readString(child.type) !== "image") return "overflow:visible";

  const childHasClipPath = Boolean(readString(child.clip_path ?? child.clipPath));
  const hasPositionedChild = Boolean(readRecordOrNull(child.position));
  if (!hasPositionedChild) return "overflow:visible";
  if (childHasClipPath) return "overflow:hidden";

  const containerBox = readBox(item);
  const childBox = readBox(child);
  if (containerBox.width == null || containerBox.height == null) {
    return "overflow:visible";
  }

  const epsilon = 0.01;
  const childOverflows =
    childBox.x < -epsilon ||
    childBox.y < -epsilon ||
    (childBox.width != null &&
      childBox.x + childBox.width > containerBox.width + epsilon) ||
    (childBox.height != null &&
      childBox.y + childBox.height > containerBox.height + epsilon);

  return childOverflows ? "overflow:hidden" : "overflow:visible";
}

function renderFlex(item: JsonRecord, mode: RenderMode): string {
  const direction = readString(item.direction) === "row" ? "row" : "column";
  const gap = readNumber(item.gap) ?? 0;
  const rowGap = readNumber(item.rowGap ?? item.row_gap) ?? gap;
  const columnGap = readNumber(item.columnGap ?? item.column_gap) ?? gap;
  const childrenList = readLayoutChildren(item);
  const children = childrenList
    .map((child) => renderItem(readRecord(child), "flow"))
    .join("");
  const style = `${flexFrameStyle(
    item,
    mode,
    childrenList,
    direction,
    readBoolean(item.wrap),
    columnGap,
    rowGap,
  )}${boxStyle(item)}${paddingStyle(
    readRecord(item.padding)
  )}display:flex;flex-direction:${direction};flex-wrap:${readBoolean(item.wrap) ? "wrap" : "nowrap"};align-items:${cssAlignment(
    readString(item.alignItems ?? item.align_items),
    "stretch"
  )};justify-content:${cssAlignment(
    readString(item.justifyContent ?? item.justify_content),
    "flex-start"
  )};gap:${cssNumber(gap)}px;column-gap:${cssNumber(columnGap)}px;row-gap:${cssNumber(rowGap)}px;overflow:visible`;
  return `<div style="${style}">${children}</div>`;
}

function flexFrameStyle(
  item: JsonRecord,
  mode: RenderMode,
  children: unknown[],
  direction: "row" | "column",
  wrap: boolean,
  columnGap: number,
  rowGap: number
) {
  const box = readBox(item);
  const expanded = flexExpandedSize(item, box, children, direction, wrap, columnGap, rowGap);
  let style = frameStyleFromBox(box, mode);
  if (expanded.width != null && (box.width == null || expanded.width > box.width)) {
    style += `width:${cssNumber(expanded.width)}px;`;
  }
  if (expanded.height != null && (box.height == null || expanded.height > box.height)) {
    style += `height:${cssNumber(expanded.height)}px;`;
  }
  return style;
}

function flexExpandedSize(
  item: JsonRecord,
  box: Box,
  children: unknown[],
  direction: "row" | "column",
  wrap: boolean,
  columnGap: number,
  rowGap: number
): { width?: number; height?: number } {
  const records = children.map(readRecord);
  if (!records.length) return {};

  const padding = readRecord(item.padding);
  const paddingX = (readNumber(padding.left) ?? 0) + (readNumber(padding.right) ?? 0);
  const paddingY = (readNumber(padding.top) ?? 0) + (readNumber(padding.bottom) ?? 0);
  const sizes = records.map(flowChildSize);

  if (!wrap) {
    if (direction === "row") {
      return {
        width:
          paddingX +
          sizes.reduce((sum, size) => sum + size.width, 0) +
          columnGap * Math.max(0, sizes.length - 1),
      };
    }
    return {
      height:
        paddingY +
        sizes.reduce((sum, size) => sum + size.height, 0) +
        rowGap * Math.max(0, sizes.length - 1),
    };
  }

  const mainLimit =
    direction === "row"
      ? box.width == null
        ? null
        : Math.max(1, box.width - paddingX)
      : box.height == null
        ? null
        : Math.max(1, box.height - paddingY);
  if (mainLimit == null) return {};

  const lines: Array<{ cross: number; main: number }> = [];
  const mainGap = direction === "row" ? columnGap : rowGap;
  const crossGap = direction === "row" ? rowGap : columnGap;
  sizes.forEach((size) => {
    const childMain = direction === "row" ? size.width : size.height;
    const childCross = direction === "row" ? size.height : size.width;
    let line = lines.at(-1);
    if (!line || (line.main > 0 && line.main + mainGap + childMain > mainLimit)) {
      line = { cross: 0, main: 0 };
      lines.push(line);
    }
    line.main += (line.main > 0 ? mainGap : 0) + childMain;
    line.cross = Math.max(line.cross, childCross);
  });

  const requiredCross =
    lines.reduce((sum, line) => sum + line.cross, 0) +
    crossGap * Math.max(0, lines.length - 1);
  return direction === "row"
    ? { height: paddingY + requiredCross }
    : { width: paddingX + requiredCross };
}

function flowChildSize(child: JsonRecord) {
  const fallback = Array.isArray(child.children)
    ? childrenBounds(readArray(child.children).map(readRecord))
    : undefined;
  const box = readBox(child, fallback);
  return {
    width: box.width ?? 1,
    height: box.height ?? 1,
  };
}

function renderGrid(item: JsonRecord, mode: RenderMode): string {
  const columns = Math.max(1, Math.floor(readNumber(item.columns) ?? 1));
  const gap = readNumber(item.gap) ?? 0;
  const rowGap = readNumber(item.rowGap ?? item.row_gap) ?? gap;
  const columnGap = readNumber(item.columnGap ?? item.column_gap) ?? gap;
  const childrenList = readLayoutChildren(item);
  const renderedRows = Math.max(1, Math.ceil(childrenList.length / columns));
  const declaredRows = readNumber(item.rows);
  const rows = declaredRows == null ? null : Math.max(1, Math.floor(declaredRows));
  const size = readRecord(item.size);
  const explicitHeight = readNumber(size.height);
  const explicitWidth = readNumber(size.width);
  const children = childrenList
    .map((child) => renderItem(readRecord(child), "flow"))
    .join("");
  const rowTemplate = gridRowTemplate(rows, renderedRows, explicitHeight, rowGap);
  const columnTemplate = gridColumnTemplate(columns, explicitWidth, columnGap);
  const style = `${frameStyle(item, mode)}${boxStyle(item)}${paddingStyle(
    readRecord(item.padding)
  )}display:grid;grid-template-columns:${columnTemplate};${rowTemplate}align-items:${cssAlignment(
      readString(item.alignItems ?? item.align_items),
      "stretch"
    )};justify-items:${cssAlignment(
      readString(item.justifyItems ?? item.justify_items),
      "stretch"
    )};column-gap:${cssNumber(columnGap)}px;row-gap:${cssNumber(rowGap)}px;overflow:visible`;
  return `<div style="${style}">${children}</div>`;
}

function gridColumnTemplate(columns: number, explicitWidth: number | null, columnGap: number) {
  if (explicitWidth == null) return `repeat(${columns},minmax(0,1fr))`;
  const columnWidth = Math.max(1, (explicitWidth - columnGap * (columns - 1)) / columns);
  return `repeat(${columns},${cssNumber(columnWidth)}px)`;
}

function gridRowTemplate(
  rows: number | null,
  renderedRows: number,
  explicitHeight: number | null,
  rowGap: number
) {
  if (!rows) return "";

  // Don't reserve empty rows when the model returned fewer items than `rows` expects.
  const effectiveRows = renderedRows < rows ? renderedRows : Math.max(rows, renderedRows);

  if (explicitHeight == null) {
    return `grid-template-rows:repeat(${effectiveRows},minmax(0,1fr));`;
  }

  const rowHeight = Math.max(1, (explicitHeight - rowGap * (rows - 1)) / rows);
  return `grid-template-rows:repeat(${effectiveRows},${cssNumber(rowHeight)}px);`;
}

function readLayoutChildren(item: JsonRecord): unknown[] {
  const children = readArray(item.children);
  if (children.length) return children;

  const elements = readArray(item.elements);
  if (elements.length) return elements;

  const child = readRecordOrNull(item.item);
  const count = Math.max(0, Math.floor(readNumber(item.count) ?? 0));
  return child && count ? Array.from({ length: count }, () => child) : [];
}

function renderGroup(item: JsonRecord, mode: RenderMode): string {
  const children = readArray(item.children).map(readRecord);
  const content = children.map((child) => renderItem(child, "absolute")).join("");
  return `<div style="${frameStyle(item, mode, childrenBounds(children))}${boxStyle(
    item
  )}overflow:visible">${content}</div>`;
}

function renderPolygon(item: JsonRecord, mode: RenderMode): string {
  if (readString(item.type) === "vector" && vectorShape(item) === "ellipse") {
    return renderEllipseVector(item, mode);
  }

  const points = polygonPoints(item);
  if (points.length < 2) return "";

  const box = polygonBox(item, points);
  const closed = polygonClosed(item, points);
  const stroke = readRecord(item.stroke);
  const fill = readRecord(item.fill);
  const fillColor = closed
    ? colorWithOpacity(readString(fill.color) ?? "", readNumber(fill.opacity))
    : "";
  const strokeWidth = Math.max(0, readNumber(stroke.width) ?? 1);
  const strokeColor = colorWithOpacity(
    readString(stroke.color) ?? (!closed ? "#000000" : ""),
    readNumber(stroke.opacity)
  );
  if (!fillColor && !(strokeColor && strokeWidth > 0)) return "";

  const pointString = points
    .map((point) => `${cssNumber(point.x - box.x)},${cssNumber(point.y - box.y)}`)
    .join(" ");
  const dash = readArray(stroke.dash)
    .map(readNumber)
    .filter((value): value is number => value != null)
    .join(" ");
  const shape = closed
    ? `<polygon points="${escapeAttribute(pointString)}"${fillColor ? ` fill="${escapeAttribute(fillColor)}"` : ` fill="none"`}${strokeColor && strokeWidth > 0
      ? ` stroke="${escapeAttribute(strokeColor)}" stroke-width="${cssNumber(strokeWidth)}"`
      : ""
    }${dash ? ` stroke-dasharray="${dash}"` : ""}/>`
    : `<polyline points="${escapeAttribute(pointString)}" fill="none"${strokeColor && strokeWidth > 0
      ? ` stroke="${escapeAttribute(strokeColor)}" stroke-width="${cssNumber(strokeWidth)}"`
      : ""
    }${dash ? ` stroke-dasharray="${dash}"` : ""}/>`;
  return `<div style="${frameStyleFromBox(box, mode)}${transformStyle(
    item
  )}overflow:visible"><svg width="100%" height="100%" viewBox="0 0 ${cssNumber(
    box.width ?? 1
  )} ${cssNumber(
    box.height ?? 1
  )}" preserveAspectRatio="none" style="display:block;overflow:visible">${shape}</svg></div>`;
}

function renderEllipseVector(item: JsonRecord, mode: RenderMode): string {
  const points = polygonSourcePoints(item);
  if (points.length < 2) return "";

  const box = polygonBox(item, points);
  const stroke = readRecord(item.stroke);
  const fill = readRecord(item.fill);
  const fillColor = colorWithOpacity(
    readString(fill.color) ?? "",
    readNumber(fill.opacity)
  );
  const strokeWidth = Math.max(0, readNumber(stroke.width) ?? 1);
  const strokeColor = colorWithOpacity(
    readString(stroke.color) ?? "",
    readNumber(stroke.opacity)
  );
  if (!fillColor && !(strokeColor && strokeWidth > 0)) return "";

  const dash = readArray(stroke.dash)
    .map(readNumber)
    .filter((value): value is number => value != null)
    .join(" ");
  const width = box.width ?? 1;
  const height = box.height ?? 1;
  const shape = `<ellipse cx="${cssNumber(width / 2)}" cy="${cssNumber(
    height / 2
  )}" rx="${cssNumber(width / 2)}" ry="${cssNumber(height / 2)}"${fillColor
    ? ` fill="${escapeAttribute(fillColor)}"`
    : ` fill="none"`}${strokeColor && strokeWidth > 0
    ? ` stroke="${escapeAttribute(strokeColor)}" stroke-width="${cssNumber(strokeWidth)}"`
    : ""
  }${dash ? ` stroke-dasharray="${dash}"` : ""}/>`;

  return `<div style="${frameStyleFromBox(box, mode)}${transformStyle(
    item
  )}overflow:visible"><svg width="100%" height="100%" viewBox="0 0 ${cssNumber(
    width
  )} ${cssNumber(
    height
  )}" preserveAspectRatio="none" style="display:block;overflow:visible">${shape}</svg></div>`;
}

function renderSvg(item: JsonRecord, mode: RenderMode): string {
  const svg = readStringValue(item.svg);
  if (!svg) return "";
  return `<div style="${frameStyle(item, mode)}${transformStyle(
    item
  )}overflow:hidden">${svg}</div>`;
}

function renderChart(item: JsonRecord, mode: RenderMode): string {
  const box = readBox(item);
  const width = Math.max(1, box.width ?? 1);
  const height = Math.max(1, box.height ?? 1);
  const config = chartConfig(item, height);

  return `<div style="${frameStyle(item, mode)}${transformStyle(
    item
  )}overflow:hidden"><canvas data-presenton-chart="true" data-chart-config="${escapeAttribute(
    JSON.stringify(config)
  )}" width="${cssNumber(Math.round(width))}" height="${cssNumber(
    Math.round(height)
  )}" style="display:block;width:100%;height:100%"></canvas></div>`;
}

function renderInfographic(item: JsonRecord, mode: RenderMode): string {
  const data = infographicData(item);
  const kind = infographicKindFromValue(readString(data.type));
  if (kind === "gauge") return renderGaugeInfographic(item, mode);
  return renderProgressBarInfographic(item, mode);
}

function renderProgressBarInfographic(item: JsonRecord, mode: RenderMode): string {
  const metrics = infographicMetrics(item);
  const highlightColor = infographicHighlightColor(item);
  const baseColor = infographicBaseColor(item);
  const fallbackSize = { width: 180, height: 40 };
  const box = readBox(item, fallbackSize);

  return `<div style="${frameStyle(item, mode, fallbackSize)}${transformStyle(
    item
  )}display:flex;align-items:center;overflow:hidden"><div style="position:relative;width:100%;height:${cssNumber(
    Math.max(
      6,
      Math.min(18, Math.round((box.height ?? fallbackSize.height) * 0.35))
    )
  )}px;border-radius:999px;background:${escapeCssColor(
    baseColor
  )};overflow:hidden"><div style="height:100%;width:${cssNumber(
    metrics.ratio * 100
  )}%;border-radius:inherit;background:${escapeCssColor(highlightColor)}"></div></div></div>`;
}

function renderGaugeInfographic(item: JsonRecord, mode: RenderMode): string {
  const metrics = infographicMetrics(item);
  const highlightColor = infographicHighlightColor(item);
  const baseColor = infographicBaseColor(item);
  const fallbackSize = { width: 160, height: 96 };
  const progressPath =
    metrics.ratio > 0
      ? `<path d="${escapeAttribute(
        describeGaugeArc(60, 60, 48, metrics.ratio)
      )}" fill="none" stroke="${escapeAttribute(
        escapeCssColor(highlightColor)
      )}" stroke-width="12" stroke-linecap="round"/>`
      : "";

  return `<div style="${frameStyle(item, mode, fallbackSize)}${transformStyle(
    item
  )}overflow:hidden"><svg width="100%" height="100%" viewBox="0 0 120 72" preserveAspectRatio="xMidYMid meet" style="display:block"><path d="M 12 60 A 48 48 0 0 1 108 60" fill="none" stroke="${escapeAttribute(
    escapeCssColor(baseColor)
  )}" stroke-width="12" stroke-linecap="round"/>${progressPath}</svg></div>`;
}

function chartConfig(item: JsonRecord, height: number): JsonRecord {
  const chartKind = chartKindFromValue(readString(item.chartType ?? item.chart_type));
  const data = normalizeChartData(item, chartKind);
  const primaryColor = safeChartColor(readString(item.color), DEFAULT_CHART_COLORS[0]);
  const colors = data.colors.length > 0 ? data.colors : [primaryColor];
  const axisColor = safeChartColor(
    readString(item.axisColor ?? item.axis_color),
    "#98A2B3"
  );
  const gridColor = safeChartColor(
    readString(item.gridColor ?? item.grid_color),
    axisColor
  );
  const textColor = safeChartColor(
    readString(item.textColor ?? item.text_color ?? item.labelColor ?? item.label_color),
    "#475467"
  );
  const titleColor =
    safeChartColor(readString(item.titleColor ?? item.title_color), "#344054");
  const legendColor = safeChartColor(
    readString(item.legendColor ?? item.legend_color),
    textColor
  );
  const title = markdownToPlainChartText(readString(item.title) ?? "");
  const fontSize = clamp(height * 0.033, 9, 18);
  const titleFontSize = clamp(height * 0.044, 11, 26);
  const valueFontSize = clamp(height * 0.029, 8, 15);
  const autoShowLegend =
    isPieLikeChart(chartKind) ||
    data.series.length > 1 ||
    Boolean(data.series[0]?.name && data.series[0].name !== "Series 1");
  const showLegend = readOptionalBoolean(
    item.legend ?? item.showLegend,
    autoShowLegend
  );
  const dataLabelPosition = readDataLabelPosition(
    Object.prototype.hasOwnProperty.call(item, "data_labels")
      ? item.data_labels
      : item.dataLabels
  );
  const dataLabels = dataLabelPosition != null;
  const xAxisGrid = readOptionalBoolean(
    item.x_axis_grid ?? item.xAxisGrid ?? item.grid,
    true
  );
  const yAxisGrid = readOptionalBoolean(
    item.y_axis_grid ?? item.yAxisGrid ?? item.grid,
    true
  );
  const xAxis = readOptionalBoolean(item.x_axis ?? item.xAxis, true);
  const yAxis = readOptionalBoolean(item.y_axis ?? item.yAxis, true);
  const xAxisTitle = markdownToPlainChartText(
    readString(
      Object.prototype.hasOwnProperty.call(item, "x_axis_title")
        ? item.x_axis_title
        : item.xAxisTitle
    ) ?? ""
  );
  const yAxisTitle = markdownToPlainChartText(
    readString(
      Object.prototype.hasOwnProperty.call(item, "y_axis_title")
        ? item.y_axis_title
        : item.yAxisTitle
    ) ?? ""
  );
  const config: JsonRecord = {
    type: chartJsType(chartKind),
    data: {
      labels: data.categories,
      datasets: chartDatasets(chartKind, { ...data, colors }),
    },
    options: {
      color: textColor,
      font: {
        family: CHART_FONT_FAMILY,
      },
      indexAxis: isHorizontalChart(chartKind) ? "y" : "x",
      layout: {
        padding: isPieLikeChart(chartKind)
          ? { top: 16, right: 20, bottom: 12, left: 20 }
          : { top: 12, right: 22, bottom: 8, left: 12 },
      },
      responsive: false,
      maintainAspectRatio: false,
      animation: false,
      normalized: true,
      plugins: {
        legend: {
          display: showLegend,
          position: "bottom",
          labels: {
            boxWidth: Math.max(8, fontSize * 0.8),
            boxHeight: Math.max(8, fontSize * 0.8),
            color: legendColor,
            font: { family: CHART_FONT_FAMILY, size: fontSize, weight: 600 },
            padding: Math.max(8, fontSize),
            usePointStyle: true,
          },
        },
        title: {
          display: Boolean(title),
          text: title.split(/\r?\n/).filter(Boolean),
          color: titleColor,
          font: {
            family: CHART_FONT_FAMILY,
            size: titleFontSize,
            weight: "700",
          },
          padding: {
            bottom: Math.max(16, titleFontSize * 0.8),
            top: 0,
          },
        },
        tooltip: { enabled: false },
        datalabels: {
          align: chartDataLabelAlign(dataLabelPosition ?? "top"),
          anchor: chartDataLabelAnchor(dataLabelPosition ?? "top"),
          clamp: true,
          clip: false,
          color: textColor,
          display: dataLabels,
          font: {
            family: CHART_FONT_FAMILY,
            size: valueFontSize,
            weight: 600,
          },
          offset: dataLabelPosition === "outside" ? 6 : 2,
          presentonOutsideColor: textColor,
          presentonPosition: dataLabelPosition ?? "top",
        },
      },
    },
  };

  if (chartKind === "donut") {
    readRecord(config.options).cutout = "58%";
  } else if (chartKind === "pie") {
    readRecord(config.options).cutout = "0%";
  } else {
    readRecord(config.options).scales = chartScales({
      axisColor,
      chartKind,
      fontSize,
      gridColor,
      xAxis,
      xAxisGrid,
      xAxisTitle,
      yAxis,
      yAxisGrid,
      yAxisTitle,
    });
  }

  return config;
}

function chartDatasets(chartKind: ChartKind, data: NormalizedChartData): JsonRecord[] {
  if (chartKind === "pie" || chartKind === "donut") {
    const series = data.series[0];
    if (!series) return [];
    return [
      {
        label: series.name,
        data: series.values.map((value) => Math.max(0, value)),
        backgroundColor: series.values.map(
          (_, index) =>
            data.colors[index % data.colors.length] ??
            DEFAULT_CHART_COLORS[index % DEFAULT_CHART_COLORS.length]
        ),
        borderColor: "#FFFFFF",
        borderWidth: 1,
        hoverOffset: 0,
      },
    ];
  }

  if (chartKind === "polar_area") {
    const series = data.series.length ? data.series : [emptyChartSeries()];
    return series.map((seriesItem) => {
      const colors =
        data.series.length === 1
          ? categoryColors(seriesItem, data.colors)
          : seriesItem.values.map(() => seriesColor(seriesItem, data));
      return {
        label: seriesItem.name,
        data: seriesItem.values,
        backgroundColor: colors.map((color) => withAlpha(color, 0.78)),
        borderColor: colors,
        borderWidth: 1,
      };
    });
  }

  if (chartKind === "scatter" || chartKind === "bubble") {
    return data.series.map((seriesItem) => {
      const colors =
        data.series.length === 1
          ? categoryColors(seriesItem, data.colors)
          : [seriesColor(seriesItem, data)];
      return {
        label: seriesItem.name,
        data:
          chartKind === "bubble"
            ? seriesItem.points.map((point) => ({ ...point, r: point.r ?? 6 }))
            : seriesItem.points.map(({ x, y }) => ({ x, y })),
        backgroundColor: colors.map((color) => withAlpha(color, 0.78)),
        borderColor: colors,
        borderWidth: 2,
        pointRadius: chartKind === "scatter" ? 4 : undefined,
        pointHoverRadius: 4,
      };
    });
  }

  const lineLike = chartKind === "line" || chartKind === "area";

  return data.series.map((series, index) => {
    const color = seriesColor(series, data, index);
    const perCategoryColors =
      data.series.length === 1 && data.colors.length
        ? categoryColors(series, data.colors)
        : null;
    const barChart = isBarChart(chartKind);
    const stackedBarChart = isStackedChart(chartKind);
    const dataset: JsonRecord = {
      label: series.name,
      data: series.values,
      backgroundColor:
        chartKind === "area"
          ? withAlpha(color, 0.24)
          : lineLike
            ? color
            : perCategoryColors ?? color,
      borderColor: color,
      borderWidth: lineLike ? 3 : 0,
      borderRadius: barChart && stackedBarChart ? 7 : undefined,
      borderSkipped: barChart ? (stackedBarChart ? "start" : false) : undefined,
      fill: chartKind === "area",
      maxBarThickness: 62,
      presentonBarRadius:
        barChart && !stackedBarChart
          ? { horizontal: isHorizontalChart(chartKind), radius: 7 }
          : undefined,
      pointBackgroundColor: perCategoryColors ?? color,
      pointBorderColor: "#FFFFFF",
      pointBorderWidth: lineLike ? 1.5 : 0,
      pointRadius: lineLike ? 3.5 : 0,
      tension: lineLike ? 0.35 : 0,
    };

    return dataset;
  });
}

function normalizeChartData(
  item: JsonRecord,
  chartKind: ChartKind
): NormalizedChartData {
  const points = readArray(item.data)
    .map(readRecord)
    .map((point, index) => {
      const value = chartValue(point);
      return {
        label: readString(point.label) ?? `Value ${index + 1}`,
        value,
        point: chartPoint(point, index),
        color: normalizeChartColor(readString(point.color)),
      };
    })
    .filter(
      (
        point
      ): point is {
        label: string;
        value: number;
        point: ChartPointData;
        color: string | null;
      } =>
        Boolean(point)
    );
  const series = readArray(item.series)
    .map(readRecord)
    .map((series, index) => {
      const rawValues = readArray(series.values ?? series.data);
      const values = rawValues.map(chartValue);
      return {
        name: readString(series.name) ?? `Series ${index + 1}`,
        points: rawValues.map((value, valueIndex) =>
          chartPoint(value, valueIndex)
        ),
        values,
      };
    })
    .filter((series) => series.values.length);
  if (!series.length && points.length) {
    series.push({
      name: readString(item.title) ?? "Series 1",
      points: points.map((point) => point.point),
      values: points.map((point) => point.value),
    });
  }
  if (!series.length) {
    series.push(emptyChartSeries());
  }
  if (isPieLikeChart(chartKind) && series.length > 1) {
    series.splice(1);
  }
  const maxLength = Math.min(
    24,
    Math.max(1, ...series.map((item) => item.values.length), points.length)
  );
  const categoryValues = readArray(item.categories);
  const categories = normalizeCategories(
    categoryValues.length ? categoryValues : points.map((point) => point.label),
    maxLength
  );
  const colors = readColorArray(item.colors);
  const legacySeriesColors = colors.length
    ? []
    : readColorArray(item.seriesColors ?? item.series_colors);
  const pointColors = points
    .map((point) => point.color)
    .filter((color): color is string => Boolean(color));

  return {
    categories,
    colors:
      colors.length > 0
        ? colors
        : legacySeriesColors.length > 0
          ? legacySeriesColors
          : pointColors.length > 0
            ? pointColors
            : [normalizeChartColor(readString(item.color)) ?? DEFAULT_CHART_COLORS[0]],
    series: series.map((item) => ({
      ...item,
      values: padValues(item.values, categories.length),
      points: padPoints(item.points, categories.length, item.values),
    })),
  };
}

function normalizeCategories(values: unknown[], length: number): string[] {
  return Array.from({ length }, (_, index) => {
    const value = values[index];
    return readStringValue(value) || `Value ${index + 1}`;
  });
}

function padValues(values: number[], length: number): number[] {
  return Array.from({ length }, (_, index) => values[index] ?? 0);
}

function padPoints(
  points: ChartPointData[],
  length: number,
  fallbackValues: number[]
): ChartPointData[] {
  return Array.from({ length }, (_, index) => {
    const point = points[index];
    if (point) return point;
    return { x: index + 1, y: fallbackValues[index] ?? 0 };
  });
}

function readColorArray(value: unknown): string[] {
  return readArray(value)
    .map((item) => normalizeChartColor(readString(item)))
    .filter((color): color is string => Boolean(color));
}

function normalizeChartColor(value: string | null): string | null {
  if (!value) return null;
  return safeChartColor(value, DEFAULT_CHART_COLORS[0]);
}

function normalizeChartKindValue(value: string | null): string {
  if (!value) return "";
  return value
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .toLowerCase()
    .replace(/[\s-]+/g, "_")
    .replace(/_+/g, "_");
}

function chartKindFromValue(value: string | null): ChartKind {
  const normalized = normalizeChartKindValue(value);
  if (normalized === "bubble") return "bubble";
  if (normalized === "horizontal_bar" || normalized === "bar_horizontal") {
    return "horizontal_bar";
  }
  if (
    normalized === "horizontal_stacked_bar" ||
    normalized === "stacked_horizontal_bar"
  ) {
    return "horizontal_stacked_bar";
  }
  if (
    normalized === "stacked_bar" ||
    normalized === "bar_stacked" ||
    normalized === "stacked" ||
    normalized === "stacked_column"
  ) {
    return "stacked_bar";
  }
  if (normalized === "line") return "line";
  if (normalized === "area") return "area";
  if (normalized === "pie") return "pie";
  if (normalized === "donut" || normalized === "doughnut") return "donut";
  if (normalized === "polar" || normalized === "polar_area") return "polar_area";
  if (normalized === "radar") return "radar";
  if (normalized === "scatter") return "scatter";
  return "bar";
}

function chartJsType(chartKind: ChartKind): string {
  if (chartKind === "donut") return "doughnut";
  if (chartKind === "area") return "line";
  if (chartKind === "polar_area") return "polarArea";
  if (
    chartKind === "horizontal_bar" ||
    chartKind === "stacked_bar" ||
    chartKind === "horizontal_stacked_bar"
  ) {
    return "bar";
  }
  return chartKind;
}

function isPieLikeChart(chartKind: ChartKind): boolean {
  return chartKind === "pie" || chartKind === "donut";
}

function isBarChart(chartKind: ChartKind): boolean {
  return (
    chartKind === "bar" ||
    chartKind === "horizontal_bar" ||
    chartKind === "stacked_bar" ||
    chartKind === "horizontal_stacked_bar"
  );
}

function isHorizontalChart(chartKind: ChartKind): boolean {
  return (
    chartKind === "horizontal_bar" || chartKind === "horizontal_stacked_bar"
  );
}

function isStackedChart(chartKind: ChartKind): boolean {
  return chartKind === "stacked_bar" || chartKind === "horizontal_stacked_bar";
}

function chartScales({
  axisColor,
  chartKind,
  fontSize,
  gridColor,
  xAxis,
  xAxisGrid,
  xAxisTitle,
  yAxis,
  yAxisGrid,
  yAxisTitle,
}: {
  axisColor: string;
  chartKind: ChartKind;
  fontSize: number;
  gridColor: string;
  xAxis: boolean;
  xAxisGrid: boolean;
  xAxisTitle: string;
  yAxis: boolean;
  yAxisGrid: boolean;
  yAxisTitle: string;
}): JsonRecord | undefined {
  if (isPieLikeChart(chartKind) || chartKind === "polar_area") return undefined;

  if (chartKind === "radar") {
    return {
      r: {
        angleLines: {
          color: withAlpha(gridColor, xAxisGrid ? 0.35 : 0),
          display: xAxisGrid,
        },
        beginAtZero: true,
        grid: {
          color: withAlpha(gridColor, yAxisGrid ? 0.35 : 0),
          display: yAxisGrid,
        },
        pointLabels: {
          color: axisColor,
          display: xAxis,
          font: { family: CHART_FONT_FAMILY, size: fontSize, weight: 600 },
        },
        ticks: {
          backdropColor: "transparent",
          color: axisColor,
          display: yAxis,
          font: {
            family: CHART_FONT_FAMILY,
            size: Math.max(8, fontSize - 1),
          },
          presentonFormat: true,
        },
      },
    };
  }

  const horizontal = isHorizontalChart(chartKind);
  const stacked = isStackedChart(chartKind);
  const showCategoryGrid = horizontal ? xAxisGrid : yAxisGrid;
  const showLinearGrid = horizontal ? yAxisGrid : xAxisGrid;
  const showCategoryAxis = horizontal ? yAxis : xAxis;
  const showLinearAxis = horizontal ? xAxis : yAxis;
  const categoryAxis = {
    display: showCategoryAxis || showCategoryGrid,
    border: { color: axisColor, display: showCategoryAxis },
    grid: {
      color: withAlpha(gridColor, showCategoryGrid ? 0.25 : 0),
      display: showCategoryGrid,
      drawTicks: showCategoryAxis,
    },
    stacked,
    ticks: {
      color: axisColor,
      display: showCategoryAxis,
      font: { family: CHART_FONT_FAMILY, size: fontSize, weight: 600 },
      maxRotation: 0,
      autoSkip: true,
    },
    title: {
      color: axisColor,
      display: showCategoryAxis && Boolean(horizontal ? yAxisTitle : xAxisTitle),
      font: { family: CHART_FONT_FAMILY, size: fontSize, weight: 700 },
      text: horizontal ? yAxisTitle : xAxisTitle,
    },
    type: "category",
  };
  const linearAxis = {
    beginAtZero: true,
    display: showLinearAxis || showLinearGrid,
    border: { color: axisColor, display: showLinearAxis },
    grace: "8%",
    grid: {
      color: withAlpha(gridColor, showLinearGrid ? 0.35 : 0),
      display: showLinearGrid,
      drawTicks: showLinearAxis,
    },
    stacked,
    ticks: {
      color: axisColor,
      display: showLinearAxis,
      font: {
        family: CHART_FONT_FAMILY,
        size: Math.max(8, fontSize - 2),
        weight: 600,
      },
      presentonFormat: true,
    },
    title: {
      color: axisColor,
      display: showLinearAxis && Boolean(horizontal ? xAxisTitle : yAxisTitle),
      font: { family: CHART_FONT_FAMILY, size: fontSize, weight: 700 },
      text: horizontal ? xAxisTitle : yAxisTitle,
    },
    type: "linear",
  };

  if (chartKind === "scatter" || chartKind === "bubble") {
    return {
      x: {
        ...linearAxis,
        display: xAxis || yAxisGrid,
        border: { ...linearAxis.border, display: xAxis },
        grid: {
          color: withAlpha(gridColor, yAxisGrid ? 0.35 : 0),
          display: yAxisGrid,
          drawTicks: xAxis,
        },
        ticks: { ...linearAxis.ticks, display: xAxis },
        title: {
          ...linearAxis.title,
          display: xAxis && Boolean(xAxisTitle),
          text: xAxisTitle,
        },
      },
      y: {
        ...linearAxis,
        display: yAxis || xAxisGrid,
        border: { ...linearAxis.border, display: yAxis },
        grid: {
          color: withAlpha(gridColor, xAxisGrid ? 0.35 : 0),
          display: xAxisGrid,
          drawTicks: yAxis,
        },
        ticks: { ...linearAxis.ticks, display: yAxis },
        title: {
          ...linearAxis.title,
          display: yAxis && Boolean(yAxisTitle),
          text: yAxisTitle,
        },
      },
    };
  }

  return horizontal ? { x: linearAxis, y: categoryAxis } : { x: categoryAxis, y: linearAxis };
}

function chartValue(value: unknown): number {
  const direct = readNumber(value);
  if (direct != null) return direct;

  const record = readRecord(value);
  return (
    readNumber(record.value) ??
    readNumber(record.y) ??
    readNumber(record.data) ??
    0
  );
}

function chartPoint(value: unknown, index: number): ChartPointData {
  const record = readRecord(value);
  const radius = readNumber(record.r ?? record.radius);
  return {
    x: readNumber(record.x) ?? index + 1,
    y: chartValue(value),
    ...(radius != null ? { r: radius } : {}),
  };
}

function emptyChartSeries(): ChartSeriesData {
  return {
    name: "Series 1",
    points: [{ x: 1, y: 0 }],
    values: [0],
  };
}

function seriesColor(
  series: ChartSeriesData,
  data: NormalizedChartData,
  index = data.series.indexOf(series)
): string {
  return (
    data.colors[index % data.colors.length] ??
    DEFAULT_CHART_COLORS[index % DEFAULT_CHART_COLORS.length]
  );
}

function categoryColors(series: ChartSeriesData, colors: string[]): string[] {
  return series.values.map(
    (_, index) =>
      colors[index % colors.length] ??
      DEFAULT_CHART_COLORS[index % DEFAULT_CHART_COLORS.length]
  );
}

function safeChartColor(
  value: string | null | undefined,
  fallback = DEFAULT_CHART_COLORS[0]
): string {
  const color = withHash(value) ?? fallback;
  if (
    /^#[0-9A-Fa-f]{3}$/.test(color) ||
    /^#[0-9A-Fa-f]{6}$/.test(color) ||
    /^rgba?\(/i.test(color)
  ) {
    return color;
  }
  return fallback;
}

function withHash(value: string | null | undefined): string | null {
  if (!value) return null;
  const color = value.trim();
  if (!color) return null;
  return color.startsWith("#") || /^rgba?\(/i.test(color) ? color : `#${color}`;
}

function withAlpha(color: string, alpha: number): string {
  const normalized = safeChartColor(color);
  const hex = normalized.match(/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/);
  if (!hex) {
    const rgb = normalized.match(/^rgba?\(([^)]+)\)$/i);
    if (rgb) {
      const channels = rgb[1]
        .split(",")
        .slice(0, 3)
        .map((part) => part.trim());
      return `rgba(${channels.join(", ")}, ${alpha})`;
    }
    return normalized;
  }

  const raw =
    hex[1].length === 3
      ? hex[1]
        .split("")
        .map((char) => char + char)
        .join("")
      : hex[1];
  const int = Number.parseInt(raw, 16);
  return `rgba(${(int >> 16) & 255}, ${(int >> 8) & 255}, ${int & 255}, ${alpha})`;
}

interface InfographicMetrics {
  ratio: number;
}

function infographicKindFromValue(value: string | null): InfographicKind {
  return value === "gauge" ? "gauge" : "progress_bar";
}

function infographicData(item: JsonRecord): JsonRecord {
  return readRecord(item.data);
}

function infographicMetrics(item: JsonRecord): InfographicMetrics {
  const data = infographicData(item);
  const rawMin = readNumber(data.min_value) ?? 0;
  const rawMax = readNumber(data.max_value) ?? 100;
  const min = Math.min(rawMin, rawMax);
  const max = Math.max(rawMin, rawMax);
  const value = clamp(readNumber(data.value) ?? min, min, max);
  const ratio = max === min ? 0 : (value - min) / (max - min);

  return {
    ratio,
  };
}

function infographicHighlightColor(item: JsonRecord): string {
  const colors = readArray(item.colors);
  return (
    normalizeChartColor(readString(colors[1])) ??
    DEFAULT_CHART_COLORS[0]
  );
}

function infographicBaseColor(item: JsonRecord): string {
  const colors = readArray(item.colors);
  return (
    normalizeChartColor(readString(colors[0])) ??
    "#E5E7EB"
  );
}

function describeGaugeArc(
  centerX: number,
  centerY: number,
  radius: number,
  ratio: number
): string {
  const start = gaugePoint(centerX, centerY, radius, 180);
  const end = gaugePoint(
    centerX,
    centerY,
    radius,
    180 + clamp(ratio, 0, 1) * 180
  );
  return `M ${cssNumber(start.x)} ${cssNumber(start.y)} A ${cssNumber(
    radius
  )} ${cssNumber(radius)} 0 0 1 ${cssNumber(end.x)} ${cssNumber(end.y)}`;
}

function gaugePoint(
  centerX: number,
  centerY: number,
  radius: number,
  angleDegrees: number
): { x: number; y: number } {
  const radians = (angleDegrees * Math.PI) / 180;
  return {
    x: centerX + radius * Math.cos(radians),
    y: centerY + radius * Math.sin(radians),
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function readOptionalBoolean(value: unknown, fallback: boolean): boolean {
  return value == null ? fallback : readBoolean(value);
}

function readDataLabelPosition(value: unknown): DataLabelPosition | null {
  if (value === true) return "top";
  if (value === false || value == null) return null;
  const text = readString(value);
  return text && DATA_LABEL_POSITIONS.has(text)
    ? (text as DataLabelPosition)
    : null;
}

function chartDataLabelAnchor(position: DataLabelPosition) {
  if (position === "base") return "start";
  if (position === "mid") return "center";
  return "end";
}

function chartDataLabelAlign(position: DataLabelPosition) {
  if (position === "base") return "end";
  if (position === "top") return "start";
  if (position === "outside") return "end";
  return "center";
}

function hasChartItem(item: JsonRecord): boolean {
  if (isComponent(item)) {
    return readArray(item.elements).map(readRecord).some(hasChartItem);
  }

  if (readString(item.type) === "chart") return true;
  if (Array.isArray(item.children)) {
    return readArray(item.children).map(readRecord).some(hasChartItem);
  }

  if (Array.isArray(item.elements)) {
    return readArray(item.elements).map(readRecord).some(hasChartItem);
  }

  const child = readRecordOrNull(item.child);
  if (child) return hasChartItem(child);

  const itemChild = readRecordOrNull(item.item);
  return itemChild ? hasChartItem(itemChild) : false;
}

function renderChartScripts(): string {
  return `<script src="${escapeAttribute(CHART_BROWSER_SCRIPT_URL)}"></script><script src="${escapeAttribute(
    CHART_DATALABELS_SCRIPT_URL,
  )}"></script><script>${escapeScriptText(
    chartRendererScript()
  )}</script>`;
}

function chartRendererScript(): string {
  return `
(function(){
var state=window.__PRESENTON_JSON_CHARTS__={status:"pending"};
function finish(status,message){state.status=status;if(message)state.message=message}
function readNumber(value){var parsed=Number(value);return Number.isFinite(parsed)?parsed:null}
function chartValue(raw){if(typeof raw==="number")return raw;if(raw&&typeof raw==="object"){var value=raw.y!=null?raw.y:raw.value!=null?raw.value:raw.data;var numeric=readNumber(value);return numeric==null?0:numeric}var parsed=readNumber(raw);return parsed==null?0:parsed}
var compactNumberSuffixes=["","K","M","B","T","Qa","Qi","Sx","Sp","Oc","No","Dc"];
function formatScaledCompactNumber(value){var abs=Math.abs(value);var decimals=abs>=100?0:abs>=10?1:2;return Number(value.toFixed(decimals)).toString()}
function formatValue(value){if(!Number.isFinite(value))return "";var abs=Math.abs(value);if(abs<1000)return abs%1===0?String(value):String(Math.round(value*10)/10).replace(/\\.0$/,"");var suffixIndex=Math.floor(Math.log10(abs)/3);if(suffixIndex>=compactNumberSuffixes.length)return value.toExponential(2).replace(/\\.?0+e/,"e");var scaled=value/Math.pow(1000,suffixIndex);var formatted=formatScaledCompactNumber(scaled);if(Math.abs(Number(formatted))>=1000&&suffixIndex<compactNumberSuffixes.length-1){suffixIndex+=1;scaled=value/Math.pow(1000,suffixIndex);formatted=formatScaledCompactNumber(scaled)}return formatted+compactNumberSuffixes[suffixIndex]}
function formatAxisTick(value){var numeric=Number(value);return Number.isFinite(numeric)?formatValue(numeric):String(value)}
function hydrateScales(scales){if(!scales)return;Object.keys(scales).forEach(function(key){var scale=scales[key];if(!scale)return;if(scale.ticks&&scale.ticks.presentonFormat){scale.ticks.callback=formatAxisTick;delete scale.ticks.presentonFormat}if(scale.r&&scale.r.ticks&&scale.r.ticks.presentonFormat){scale.r.ticks.callback=formatAxisTick;delete scale.r.ticks.presentonFormat}})}
function barBorderRadius(rawValue,horizontal,radius){var value=chartValue(rawValue);if(horizontal){return value<0?{bottomLeft:radius,bottomRight:0,topLeft:radius,topRight:0}:{bottomLeft:0,bottomRight:radius,topLeft:0,topRight:radius}}return value<0?{bottomLeft:radius,bottomRight:radius,topLeft:0,topRight:0}:{bottomLeft:0,bottomRight:0,topLeft:radius,topRight:radius}}
function hydrateBarBorderRadii(config){var datasets=config&&config.data&&Array.isArray(config.data.datasets)?config.data.datasets:[];datasets.forEach(function(dataset){var options=dataset&&dataset.presentonBarRadius;if(!options)return;var radius=readNumber(options.radius);dataset.borderRadius=function(context){return barBorderRadius(context&&context.raw,!!options.horizontal,radius==null?7:radius)};delete dataset.presentonBarRadius})}
function datasetBackgroundColor(dataset,index){var background=dataset&&dataset.backgroundColor;var color=Array.isArray(background)?background[index]:background;return typeof color==="string"?color:null}
function clamp(value,min,max){return Math.min(Math.max(value,min),max)}
function parseColor(color){if(!color)return null;var hex=String(color).match(/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/);if(hex){var raw=hex[1].length===3?hex[1].split("").map(function(ch){return ch+ch}).join(""):hex[1];var value=Number.parseInt(raw,16);return[(value>>16)&255,(value>>8)&255,value&255,1]}var rgb=String(color).match(/^rgba?\\(([^)]+)\\)$/i);if(!rgb)return null;var channels=rgb[1].split(",").map(function(part){return Number(part.trim())});if(channels.length<3||channels.slice(0,3).some(Number.isNaN))return null;return[clamp(channels[0],0,255),clamp(channels[1],0,255),clamp(channels[2],0,255),clamp(Number.isFinite(channels[3])?channels[3]:1,0,1)]}
function relativeLuminance(channels){var mapped=channels.map(function(channel){var normalized=channel/255;return normalized<=0.04045?normalized/12.92:Math.pow((normalized+0.055)/1.055,2.4)});return mapped[0]*0.2126+mapped[1]*0.7152+mapped[2]*0.0722}
function contrastRatio(first,second){var lighter=Math.max(first,second);var darker=Math.min(first,second);return(lighter+0.05)/(darker+0.05)}
function contrastTextColor(backgroundColor,fallback){var background=parseColor(backgroundColor);if(!background)return fallback;var composite=[background[0],background[1],background[2]].map(function(channel){return channel*background[3]+255*(1-background[3])});var luminance=relativeLuminance(composite);var dark=[16,24,40];var light=[255,255,255];return contrastRatio(luminance,relativeLuminance(light))>=contrastRatio(luminance,relativeLuminance(dark))?"#FFFFFF":"#101828"}
function hydrateDataLabels(config){var plugins=config&&config.options&&config.options.plugins;var options=plugins&&plugins.datalabels;if(!options)return;var position=options.presentonPosition==="base"||options.presentonPosition==="mid"||options.presentonPosition==="outside"||options.presentonPosition==="top"?options.presentonPosition:"top";var outsideColor=options.presentonOutsideColor||options.color||"#475467";options.formatter=function(value){return formatValue(chartValue(value))};options.color=function(context){if(position==="outside")return outsideColor;var meta=context.chart.getDatasetMeta(context.datasetIndex);var type=String(meta&&meta.type||"");if(type!=="bar"&&type!=="pie"&&type!=="doughnut"&&type!=="polarArea")return outsideColor;return contrastTextColor(datasetBackgroundColor(context.dataset,context.dataIndex),outsideColor)};delete options.presentonOutsideColor;delete options.presentonPosition}
function render(){if(!window.Chart){finish("error","Chart.js failed to load");return}if(!window.ChartDataLabels){finish("error","Chart.js datalabels plugin failed to load");return}try{var Chart=window.Chart;Chart.register(window.ChartDataLabels);document.querySelectorAll("canvas[data-presenton-chart]").forEach(function(canvas){var configText=canvas.getAttribute("data-chart-config");if(!configText)return;var config=JSON.parse(configText);config.options=config.options||{};config.options.animation=false;config.options.responsive=false;config.options.maintainAspectRatio=false;hydrateScales(config.options.scales);hydrateBarBorderRadii(config);hydrateDataLabels(config);var existing=typeof Chart.getChart==="function"?Chart.getChart(canvas):null;if(existing)existing.destroy();var chart=new Chart(canvas,config);if(typeof chart.update==="function")chart.update("none")});requestAnimationFrame(function(){finish("ready")})}catch(error){finish("error",error&&error.message?error.message:String(error))}}
if(document.readyState==="loading"){document.addEventListener("DOMContentLoaded",render,{once:true})}else{render()}
})();
`;
}
function frameStyle(
  item: JsonRecord,
  mode: RenderMode,
  fallbackSize?: { width: number; height: number }
): string {
  const box = readBox(item, fallbackSize);
  return frameStyleFromBox(box, mode);
}

function frameStyleFromBox(box: Box, mode: RenderMode): string {
  let style = `box-sizing:border-box;min-height:0;min-width:0;position:${mode === "absolute" ? "absolute" : "relative"
    };`;
  if (mode === "flow") style += "flex-shrink:0;";
  if (mode === "absolute") {
    style += `left:${cssNumber(box.x)}px;top:${cssNumber(box.y)}px;`;
  }
  if (box.width != null) style += `width:${cssNumber(box.width)}px;`;
  if (box.height != null) style += `height:${cssNumber(box.height)}px;`;
  return style;
}

function readBox(
  item: JsonRecord,
  fallbackSize?: { width: number; height: number }
): Box {
  const position = readRecord(item.position);
  const size = readRecord(item.size);
  const type = readString(item.type);
  if (type === "vector") {
    return polygonBox(
      item,
      vectorShape(item) === "ellipse"
        ? polygonSourcePoints(item)
        : polygonPoints(item)
    );
  }
  return {
    x: readNumber(position.x) ?? 0,
    y: readNumber(position.y) ?? 0,
    width: readNumber(size.width) ?? fallbackSize?.width,
    height: readNumber(size.height) ?? fallbackSize?.height,
  };
}

function childrenBounds(
  children: JsonRecord[]
): { width: number; height: number } {
  return children.reduce<{ width: number; height: number }>(
    (bounds, child) => {
      const box = readBox(child);
      return {
        width: Math.max(bounds.width, box.x + (box.width ?? 1)),
        height: Math.max(bounds.height, box.y + (box.height ?? 1)),
      };
    },
    { width: 1, height: 1 }
  );
}

function polygonSourcePoints(item: JsonRecord): Point[] {
  return readArray(item.points)
    .map(readRecord)
    .map((point) => {
      const x = readNumber(point.x);
      const y = readNumber(point.y);
      return x != null && y != null ? { x, y } : null;
    })
    .filter((point): point is Point => point != null);
}

function vectorShape(item: JsonRecord): "polygon" | "ellipse" {
  return readString(item.shape) === "ellipse" ? "ellipse" : "polygon";
}

function polygonPoints(item: JsonRecord): Point[] {
  const points = polygonSourcePoints(item);
  if (readString(item.type) === "vector" && vectorShape(item) === "ellipse") {
    return points;
  }
  const closed = polygonClosed(item, points);
  const rounded = closed
    ? roundedPolygonPoints(points, cornerRadii(item, points.length))
    : points;
  const curve = curveSettings(item);
  if (!curve) return rounded;
  return sampleSmoothCurve(rounded, closed, curve.tension, curve.segments);
}

function cornerRadii(item: JsonRecord, pointCount: number): number[] {
  return readArray(item.corner_radii ?? item.cornerRadii)
    .map(readNumber)
    .filter((value): value is number => value != null)
    .slice(0, pointCount)
    .map((value) => Math.max(0, value));
}

function pointAt(points: Point[], index: number) {
  return points[((index % points.length) + points.length) % points.length];
}

function lerpPoint(start: Point, end: Point, t: number): Point {
  return {
    x: start.x + (end.x - start.x) * t,
    y: start.y + (end.y - start.y) * t,
  };
}

function roundedPolygonPoints(points: Point[], radii: number[], segments = 8): Point[] {
  if (points.length < 3 || radii.length === 0) return points;
  const rounded: Point[] = [];
  points.forEach((point, index) => {
    const radius = radii[index] ?? 0;
    const previous = pointAt(points, index - 1);
    const next = pointAt(points, index + 1);
    const prevDistance = Math.hypot(point.x - previous.x, point.y - previous.y);
    const nextDistance = Math.hypot(point.x - next.x, point.y - next.y);
    const safeRadius = Math.min(radius, prevDistance / 2, nextDistance / 2);
    if (safeRadius <= 0) {
      rounded.push(point);
      return;
    }
    const from = lerpPoint(point, previous, safeRadius / prevDistance);
    const to = lerpPoint(point, next, safeRadius / nextDistance);
    rounded.push(from);
    for (let step = 1; step < segments; step += 1) {
      const t = step / segments;
      rounded.push({
        x: (1 - t) * (1 - t) * from.x + 2 * (1 - t) * t * point.x + t * t * to.x,
        y: (1 - t) * (1 - t) * from.y + 2 * (1 - t) * t * point.y + t * t * to.y,
      });
    }
    rounded.push(to);
  });
  return rounded;
}

function curveSettings(item: JsonRecord) {
  const curve = readRecordOrNull(item.curve);
  if (!curve) return null;
  const rawType = readString(curve.type)?.trim().toLowerCase();
  if (rawType !== "smooth") return null;
  return {
    type: "smooth",
    tension: clamp(readNumber(curve.tension) ?? 0.4, 0, 1),
    segments: Math.max(1, Math.min(96, Math.round(readNumber(curve.segments) ?? 16))),
  };
}

function hermitePoint(
  start: Point,
  end: Point,
  startTangent: Point,
  endTangent: Point,
  t: number
): Point {
  const t2 = t * t;
  const t3 = t2 * t;
  const h00 = 2 * t3 - 3 * t2 + 1;
  const h10 = t3 - 2 * t2 + t;
  const h01 = -2 * t3 + 3 * t2;
  const h11 = t3 - t2;
  return {
    x:
      h00 * start.x +
      h10 * startTangent.x +
      h01 * end.x +
      h11 * endTangent.x,
    y:
      h00 * start.y +
      h10 * startTangent.y +
      h01 * end.y +
      h11 * endTangent.y,
  };
}

function sampleSmoothCurve(points: Point[], closed: boolean, tension: number, segments: number): Point[] {
  if (points.length < 3 || tension <= 0) return points;
  const sampled: Point[] = [];
  const segmentCount = closed ? points.length : points.length - 1;
  for (let index = 0; index < segmentCount; index += 1) {
    const p0 = closed ? pointAt(points, index - 1) : points[Math.max(0, index - 1)];
    const p1 = pointAt(points, index);
    const p2 = pointAt(points, index + 1);
    const p3 = closed ? pointAt(points, index + 2) : points[Math.min(points.length - 1, index + 2)];
    if (index === 0) sampled.push(p1);
    const tangentScale = tension * 0.5;
    const startTangent = {
      x: (p2.x - p0.x) * tangentScale,
      y: (p2.y - p0.y) * tangentScale,
    };
    const endTangent = {
      x: (p3.x - p1.x) * tangentScale,
      y: (p3.y - p1.y) * tangentScale,
    };
    for (let step = 1; step <= segments; step += 1) {
      sampled.push(
        hermitePoint(p1, p2, startTangent, endTangent, step / segments)
      );
    }
  }
  return sampled;
}

function polygonClosed(item: JsonRecord, points: Point[]): boolean {
  if (readString(item.type) === "vector" && vectorShape(item) === "ellipse") {
    return true;
  }
  const value = item.closed;
  if (value === false || value === "false" || value === "0") return false;
  if (value === true || value === "true" || value === "1") return true;
  return points.length > 2;
}

function polygonBox(item: JsonRecord, points: Point[]): Box {
  if (points.length === 0) {
    return { x: 0, y: 0, width: 1, height: 1 };
  }

  const minX = Math.min(...points.map((point) => point.x));
  const minY = Math.min(...points.map((point) => point.y));
  const maxX = Math.max(...points.map((point) => point.x));
  const maxY = Math.max(...points.map((point) => point.y));
  const stroke = readRecord(item.stroke);
  const strokeWidth = Math.max(1, readNumber(stroke.width) ?? 1);
  return {
    x: minX,
    y: minY,
    width: Math.max(maxX - minX, strokeWidth, 1),
    height: Math.max(maxY - minY, strokeWidth, 1),
  };
}

function boxStyle(item: JsonRecord): string {
  const fill = readRecord(item.fill);
  const stroke = readRecord(item.stroke);
  const shadow = readRecord(item.shadow);
  const radius = readRecord(item.borderRadius ?? item.border_radius);
  let style = transformStyle(item);
  const fillColor = readString(fill.color);
  if (fillColor) {
    style += `background-color:${escapeCssColor(
      colorWithOpacity(fillColor, readNumber(fill.opacity))
    )};`;
  }
  const strokeColor = readString(stroke.color);
  const strokeWidth = readNumber(stroke.width);
  if (strokeColor || strokeWidth != null) {
    style += `border:${cssNumber(strokeWidth ?? 1)}px solid ${escapeCssColor(
      colorWithOpacity(strokeColor ?? "transparent", readNumber(stroke.opacity))
    )};`;
  }
  const borderRadius = borderRadiusStyle(radius);
  if (borderRadius) style += `border-radius:${borderRadius};`;
  const shadowValue = shadowCssValue(shadow);
  if (shadowValue) style += `box-shadow:${shadowValue};`;
  const opacity = readNumber(item.opacity);
  if (opacity != null) style += `opacity:${cssNumber(opacity)};`;
  return style;
}

function textShadowStyle(item: JsonRecord): string {
  const shadowValue = shadowCssValue(readRecord(item.shadow));
  return shadowValue ? `text-shadow:${shadowValue};` : "";
}

function shadowCssValue(shadow: JsonRecord): string {
  const shadowOpacity = Object.keys(shadow).length
    ? (readNumber(shadow.opacity) ?? 1)
    : 0;
  if (shadowOpacity <= 0) return "";

  return `${cssNumber(readNumber(shadow.offsetX ?? shadow.offset_x) ?? 0)}px ${cssNumber(
    readNumber(shadow.offsetY ?? shadow.offset_y) ?? 0
  )}px ${cssNumber(readNumber(shadow.blur) ?? 0)}px ${escapeCssColor(
    colorWithOpacity(readString(shadow.color) ?? "#000000", shadowOpacity)
  )}`;
}

function transformStyle(item: JsonRecord): string {
  const rotation = readNumber(item.rotation);
  const flipH = readBoolean(item.flip_h ?? item.flipH);
  const flipV = readBoolean(item.flip_v ?? item.flipV);
  if (!rotation && !flipH && !flipV) return "";

  const transforms = [];
  if (rotation) transforms.push(`rotate(${cssNumber(rotation)}deg)`);
  if (flipH) transforms.push("scaleX(-1)");
  if (flipV) transforms.push("scaleY(-1)");
  return `transform:${transforms.join(" ")};transform-origin:center;`;
}

function fontStyle(
  fontValue: unknown,
  options: { includeLineHeight?: boolean; includeTextDecoration?: boolean } = {}
): string {
  const font = readRecord(fontValue);
  let style = `color:${escapeCssColor(
    colorWithOpacity(readString(font.color) ?? "#111827", readNumber(font.opacity))
  )};`;
  const family = readString(font.family);
  const size = readNumber(font.size);
  if (family) style += `font-family:${escapeCssFont(family)};`;
  if (size != null) style += `font-size:${cssNumber(size)}px;`;
  if (hasOwn(font, "italic")) {
    style += readBoolean(font.italic) ? "font-style:italic;" : "font-style:normal;";
  }
  if (hasOwn(font, "bold")) {
    style += readBoolean(font.bold) ? "font-weight:700;" : "font-weight:400;";
  }
  if (options.includeLineHeight !== false) style += lineHeightStyle(font);
  const letterSpacing = readNumber(font.letterSpacing ?? font.letter_spacing);
  if (letterSpacing != null) style += `letter-spacing:${cssNumber(letterSpacing)}px;`;
  if (options.includeTextDecoration !== false) {
    style += textDecorationStyle(font);
  }
  return style;
}

function textDecorationStyle(font: JsonRecord): string {
  if (hasOwn(font, "underline")) {
    return readBoolean(font.underline)
      ? "text-decoration:underline;"
      : "text-decoration:none;";
  }

  const decorations = [font.text_decoration, font.textDecoration]
    .map((value) => readString(value)?.toLowerCase())
    .filter(Boolean);
  if (decorations.includes("underline")) return "text-decoration:underline;";
  if (decorations.includes("none")) return "text-decoration:none;";
  return "";
}

// Tight line-height (e.g. 0.8) on headlines overlaps glyphs once text wraps to 2+ lines.
const DISPLAY_HEADING_MIN_SIZE = 36;

function effectiveLineHeight(font: JsonRecord, fallback?: number): number | null {
  const lineHeight = readNumber(font.lineHeight ?? font.line_height) ?? fallback ?? null;
  if (lineHeight == null) return null;
  const size = readNumber(font.size);
  if (size != null && size >= DISPLAY_HEADING_MIN_SIZE && lineHeight < 1.0) {
    return 1.0;
  }
  return lineHeight;
}

function lineHeightStyle(font: JsonRecord, fallback?: number): string {
  const lineHeight = effectiveLineHeight(font, fallback);
  if (lineHeight == null) return "";
  return `line-height:${cssNumber(lineHeight)};`;
}

function tableRows(item: JsonRecord): unknown[][] {
  const columns = readArray(item.columns);
  const bodyRows = readArray(item.rows).map(readArray);
  return (columns.length ? [columns, ...bodyRows] : bodyRows).filter((row) =>
    Array.isArray(row)
  );
}

function tableBaseFont(item: JsonRecord): JsonRecord {
  return {
    family: "Arial",
    size: 18,
    color: "#111827",
    line_height: 1.15,
    wrap: "word",
    ...readRecord(item.font),
  };
}

function tableCellStyle(
  cellValue: unknown,
  header: boolean,
  tableFont: JsonRecord
): string {
  const cell = readRecord(cellValue);
  const cellFont = tableCellFont(cellValue, tableFont);
  const alignment =
    readString(cell.alignment) ??
    readString(readRecord(cell.alignment).horizontal) ??
    readString(readRecord(readRecord(cell.text).alignment).horizontal);
  const fill = readRecord(cell.color ?? cell.fill);
  const stroke = readRecord(cell.stroke);
  const fillColor = readString(fill.color);
  const background = fillColor
    ? colorWithOpacity(fillColor, readNumber(fill.opacity))
    : "transparent";
  const forceHeaderBold = header && !tableCellHasExplicitBold(cellValue);
  let style = `${fontStyle(cellFont, {
    includeTextDecoration: false,
  })}display:flex;align-items:center;justify-content:${horizontalAlign(
    alignment
  )};border:${cssNumber(
    readNumber(stroke.width) ?? 1
  )}px solid ${escapeCssColor(
    colorWithOpacity(readString(stroke.color) ?? "#D1D5DB", readNumber(stroke.opacity))
  )};min-height:0;min-width:0;overflow:hidden;padding:4px 6px;text-align:${textAlign(
    alignment
  )};vertical-align:middle;white-space:pre-wrap;word-break:break-word;`;
  if (forceHeaderBold && !readBoolean(cellFont.bold)) style += "font-weight:700;";
  style += `background:${escapeCssColor(background)};`;
  return style;
}

function textOverflowStyle(): string {
  return "overflow:visible;white-space:pre-wrap;overflow-wrap:anywhere;word-break:break-word;";
}

function tableCellFont(cellValue: unknown, tableFont: JsonRecord): JsonRecord {
  if (typeof cellValue === "string" || typeof cellValue === "number") {
    return tableFont;
  }

  const cell = readRecord(cellValue);
  const firstRun = readRecord(readArray(cell.runs)[0]);
  const text = readRecord(cell.text);
  return {
    ...tableFont,
    ...readRecord(cell.font),
    ...(Object.keys(firstRun).length ? readRecord(firstRun.font) : {}),
    ...(Object.keys(text).length ? readRecord(text.font) : {}),
  };
}

function tableCellHasExplicitBold(cellValue: unknown): boolean {
  if (typeof cellValue === "string" || typeof cellValue === "number") {
    return false;
  }

  const cell = readRecord(cellValue);
  const firstRun = readRecord(readArray(cell.runs)[0]);
  const text = readRecord(cell.text);
  return (
    Object.prototype.hasOwnProperty.call(readRecord(cell.font), "bold") ||
    Object.prototype.hasOwnProperty.call(readRecord(firstRun.font), "bold") ||
    Object.prototype.hasOwnProperty.call(readRecord(text.font), "bold")
  );
}

function cellText(
  cellValue: unknown,
  tableFont: JsonRecord,
  header: boolean
): string {
  if (typeof cellValue === "string" || typeof cellValue === "number") {
    return escapeHtml(readStringValue(cellValue));
  }

  const cell = readRecord(cellValue);
  const fill = readRecord(cell.color ?? cell.fill);
  const fillColor = readString(fill.color)
    ? colorWithOpacity(readString(fill.color) ?? "", readNumber(fill.opacity))
    : null;
  const forceHeaderBold = header && !tableCellHasExplicitBold(cellValue);
  const headerFontPatch = forceHeaderBold ? { bold: true } : {};
  const directRuns = readArray(cell.runs).map(readRecord);
  if (directRuns.length) {
    const runs = normalizeRunsForHtml(
      directRuns,
      Object.prototype.hasOwnProperty.call(cell, "text")
        ? cell.text
        : joinedRunText(directRuns),
      cell.font,
    );
    return runs
      .map((run) => {
        const runFont = readableTableFont(
          {
            ...tableFont,
            ...readRecord(cell.font),
            ...readRecord(run.font),
            ...headerFontPatch,
          },
          fillColor,
          header
        );
        return `<span style="${fontStyle(runFont)}">${escapeHtml(
          readStringValue(run.text)
        )}</span>`;
      })
      .join("");
  }

  const text = cell.text;
  if (typeof text === "string") {
    return `<span style="${fontStyle(
      readableTableFont(
        { ...tableFont, ...readRecord(cell.font), ...headerFontPatch },
        fillColor,
        header
      )
    )}">${escapeHtml(text)}</span>`;
  }
  const textRecord = readRecord(text);
  const textRuns = normalizedRunsForHtml(textRecord, textRecord.font);
  if (textRuns.length) {
    return textRuns
      .map((run) => {
        const runFont = readableTableFont(
          {
            ...tableFont,
            ...readRecord(cell.font),
            ...readRecord(textRecord.font),
            ...readRecord(run.font),
            ...headerFontPatch,
          },
          fillColor,
          header
        );
        return `<span style="${fontStyle(runFont)}">${escapeHtml(
          readStringValue(run.text)
        )}</span>`;
      })
      .join("");
  }
  return `<span style="${fontStyle(
    readableTableFont(
      { ...tableFont, ...readRecord(cell.font), ...headerFontPatch },
      fillColor,
      header
    )
  )}">${escapeHtml(readStringValue(textRecord.text))}</span>`;
}

function readableTableFont(
  font: JsonRecord,
  fillColor: string | null,
  header: boolean
): JsonRecord {
  if (header) return font;
  return {
    ...font,
    color: readableTableTextColor(readString(font.color), fillColor),
  };
}

function readableTableTextColor(
  color: string | null,
  fill: string | null
): string {
  const textColor = normalizeReadableColor(color) ?? "#111827";
  const textLuminance = colorLuminance(textColor);
  const fillLuminance = colorLuminance(fill);
  if (textLuminance == null || fillLuminance == null) return textColor;

  const lighter = Math.max(textLuminance, fillLuminance);
  const darker = Math.min(textLuminance, fillLuminance);
  const contrast = (lighter + 0.05) / (darker + 0.05);
  if (contrast >= 3) return textColor;
  return fillLuminance > 0.5 ? "#111827" : "#FFFFFF";
}

function colorLuminance(color: string | null): number | null {
  const rgb = parseRgbColor(color);
  if (!rgb) return null;
  const [r, g, b] = rgb.map((channel) => {
    const normalized = channel / 255;
    return normalized <= 0.03928
      ? normalized / 12.92
      : Math.pow((normalized + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function parseRgbColor(color: string | null): [number, number, number] | null {
  const value = normalizeReadableColor(color);
  if (!value) return null;

  const hex = value.startsWith("#") ? value.slice(1) : value;
  if (/^[0-9a-fA-F]{3}$/.test(hex)) {
    return [
      Number.parseInt(hex[0] + hex[0], 16),
      Number.parseInt(hex[1] + hex[1], 16),
      Number.parseInt(hex[2] + hex[2], 16),
    ];
  }
  if (/^[0-9a-fA-F]{6}$/.test(hex)) {
    return [
      Number.parseInt(hex.slice(0, 2), 16),
      Number.parseInt(hex.slice(2, 4), 16),
      Number.parseInt(hex.slice(4, 6), 16),
    ];
  }

  const rgb = value.match(
    /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i
  );
  if (!rgb) return null;
  return [
    clamp(Number(rgb[1]), 0, 255),
    clamp(Number(rgb[2]), 0, 255),
    clamp(Number(rgb[3]), 0, 255),
  ];
}

function normalizeReadableColor(color: string | null): string | null {
  if (!color) return null;
  const value = color.trim();
  if (!value) return null;
  return value.startsWith("#") || value.startsWith("rgb") ? value : `#${value}`;
}

function readRuns(item: JsonRecord): JsonRecord[] {
  const runs = readArray(item.runs).map(readRecord);
  return runs.length ? runs : [{ text: readStringValue(item.text) }];
}

function normalizedRunsForHtml(item: JsonRecord, fallbackFont: unknown): JsonRecord[] {
  const runs = readRuns(item);
  return normalizeRunsForHtml(
    runs,
    Object.prototype.hasOwnProperty.call(item, "text")
      ? item.text
      : joinedRunText(runs),
    item.font ?? fallbackFont,
  );
}

function normalizedListRunsForHtml(value: unknown, fallbackFont: unknown): JsonRecord[] {
  const runs = readListRuns(value);
  const record = readRecord(value);
  return normalizeRunsForHtml(
    runs,
    Object.prototype.hasOwnProperty.call(record, "text")
      ? record.text
      : joinedRunText(runs),
    record.font ?? fallbackFont,
  );
}

function normalizeRunsForHtml(
  runs: JsonRecord[],
  text: unknown,
  fallbackFont: unknown,
): JsonRecord[] {
  const normalized = normalizeRawTextMarkdownElement({
    type: "text",
    font: fallbackFont,
    text: readStringValue(text),
    runs,
  }).runs;

  return normalized.map((run) => ({
    text: run.text,
    font: run.font,
  }));
}

function joinedRunText(runs: JsonRecord[]): string {
  return runs.map((run) => readStringValue(run.text)).join("");
}

function readListRuns(value: unknown): JsonRecord[] {
  if (Array.isArray(value)) return value.map(readRecord);
  const record = readRecord(value);
  const runs = readArray(record.runs).map(readRecord);
  if (runs.length) return runs;
  if (Object.prototype.hasOwnProperty.call(record, "text")) {
    return [{ text: readStringValue(record.text), font: record.font }];
  }
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return [{ text: readStringValue(value) }];
  }
  return [];
}

function isComponent(item: JsonRecord): item is JsonRecord & { elements: unknown[] } {
  const type = readString(item.type);
  return Array.isArray(item.elements) && (!type || !ELEMENT_TYPES.has(type));
}

function readRecord(value: unknown): JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};
}

function readRecordOrNull(value: unknown): JsonRecord | null {
  const record = readRecord(value);
  return Object.keys(record).length ? record : null;
}

function hasOwn(record: JsonRecord, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}

function readArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readStringValueOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function readStringValue(value: unknown): string {
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

function readNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function readBoolean(value: unknown): boolean {
  return value === true || value === "true" || value === "1";
}

function readFontWeight(value: unknown): string | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(Math.round(value));
  }
  const text = readString(value);
  if (!text) return undefined;
  const normalized = text.toLowerCase().replace(/\s+/g, "");
  const namedWeights: Record<string, string> = {
    thin: "100",
    extralight: "200",
    ultralight: "200",
    light: "300",
    regular: "400",
    normal: "400",
    medium: "500",
    semibold: "600",
    demibold: "600",
    bold: "700",
    extrabold: "800",
    ultrabold: "800",
    black: "900",
    heavy: "900",
  };
  if (namedWeights[normalized]) return namedWeights[normalized];
  return /^\d{3}$/.test(normalized) ? normalized : undefined;
}

function inferFontWeight(value: string): string | undefined {
  const normalized = decodeFontHint(value).toLowerCase();
  if (/\b(black|heavy)\b/.test(normalized)) return "900";
  if (/\b(extra|ultra)[\s_-]?bold\b/.test(normalized)) return "800";
  if (/\bbold\b/.test(normalized)) return "700";
  if (/\b(semi|demi)[\s_-]?bold\b/.test(normalized)) return "600";
  if (/\bmedium\b/.test(normalized)) return "500";
  if (/\bregular\b|\bnormal\b/.test(normalized)) return "400";
  if (/\blight\b/.test(normalized)) return "300";
  if (/\b(extra|ultra)[\s_-]?light\b/.test(normalized)) return "200";
  if (/\bthin\b/.test(normalized)) return "100";
  return undefined;
}

function readFontStyle(value: unknown): string | undefined {
  const text = readString(value)?.toLowerCase();
  return text === "italic" || text === "oblique" || text === "normal"
    ? text
    : undefined;
}

function inferFontStyle(value: string): string | undefined {
  return /\bitalic\b/i.test(decodeFontHint(value)) ? "italic" : undefined;
}

function decodeFontHint(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function paddingStyle(padding: JsonRecord): string {
  return `padding:${cssNumber(readNumber(padding.top) ?? 0)}px ${cssNumber(
    readNumber(padding.right) ?? 0
  )}px ${cssNumber(readNumber(padding.bottom) ?? 0)}px ${cssNumber(
    readNumber(padding.left) ?? 0
  )}px;`;
}

function borderRadiusStyle(radius: JsonRecord): string {
  const tl = readNumber(radius.tl) ?? 0;
  const tr = readNumber(radius.tr) ?? tl;
  const br = readNumber(radius.br) ?? tl;
  const bl = readNumber(radius.bl) ?? tl;
  return tl || tr || br || bl
    ? `${cssNumber(tl)}px ${cssNumber(tr)}px ${cssNumber(br)}px ${cssNumber(bl)}px`
    : "";
}

function imageFit(value: unknown): string {
  return value === "cover" || value === "fill" ? value : "contain";
}

function imageMaskSize(value: unknown): string {
  const fit = imageFit(value);
  return fit === "fill" ? "100% 100%" : fit;
}

function imageCropScale(item: JsonRecord): number {
  const value = readNumber(item.crop_scale ?? item.cropScale);
  if (value == null) return 1;
  return clamp(value, 1, 6);
}

function imageCropTransformStyle(item: JsonRecord): string {
  const cropScale = imageCropScale(item);
  if (cropScale <= 1) return "";
  return `transform:scale(${cssNumber(cropScale)});transform-origin:${
    imageFocusValue(item) ?? "center"
  };`;
}

function imageFocusStyle(item: JsonRecord): string {
  const focus = imageFocusValue(item);
  return focus ? `object-position:${focus};` : "";
}

function imageFocusValue(item: JsonRecord): string | null {
  const focus = readArray(item.focus);
  const rawX = item.focus_x ?? item.focusX ?? focus[0];
  const rawY = item.focus_y ?? item.focusY ?? focus[1];
  if (rawX == null && rawY == null) return null;

  const focusX = clamp(readNumber(rawX) ?? 50, 0, 100);
  const focusY = clamp(readNumber(rawY) ?? 50, 0, 100);
  return `${cssNumber(focusX)}% ${cssNumber(focusY)}%`;
}

function clipPathStyle(item: JsonRecord): string {
  const value = normalizeCssClipPath(
    readString(item.clippath ?? item.clipPath ?? item.clip_path)
  );
  return value ? `clip-path:${value};-webkit-clip-path:${value};` : "";
}

function normalizeCssClipPath(value: string | null): string | null {
  if (!value) return null;

  let normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized || normalized.toLowerCase() === "none") return null;

  const doubleQuotedPath = normalized.match(/^path\("([^"]*)"\)$/i);
  if (doubleQuotedPath) {
    normalized = `path('${doubleQuotedPath[1]}')`;
  }

  if (/[";{}<>\\]/.test(normalized)) return null;
  if (!/^[a-zA-Z0-9\s.,%()+\-_' ]+$/.test(normalized)) return null;

  const functionName = normalized.match(/^([a-z-]+)\(/i)?.[1]?.toLowerCase();
  if (
    !functionName ||
    !["path", "polygon", "circle", "ellipse", "inset"].includes(functionName) ||
    !normalized.endsWith(")")
  ) {
    return null;
  }

  if (functionName === "path" && !/^path\('[^']*'\)$/i.test(normalized)) {
    return null;
  }

  return normalized;
}

function horizontalAlign(value: string | null): string {
  return value === "center" ? "center" : value === "right" ? "flex-end" : "flex-start";
}

function verticalAlign(value: string | null): string {
  return value === "middle" || value === "center"
    ? "center"
    : value === "bottom"
      ? "flex-end"
      : "flex-start";
}

function textAlign(value: string | null): string {
  return value === "center" || value === "right" ? value : "left";
}

function cssAlignment(value: string | null, fallback: string): string {
  return value === "flex-start" ||
    value === "flex-end" ||
    value === "center" ||
    value === "stretch"
    ? value
    : fallback;
}

function normalizeCssColor(color: string): string {
  const normalized = color.trim();
  const hex = normalized.match(/^#?([0-9a-fA-F]{6})$/)?.[1];
  return hex ? `#${hex}` : normalized;
}

function colorWithOpacity(color: string, opacity: number | null): string {
  const normalized = normalizeCssColor(color);
  if (opacity == null || opacity >= 1 || normalized === "transparent") return normalized;
  const hex = normalized.replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) return normalized;
  const value = Number.parseInt(hex, 16);
  return `rgba(${(value >> 16) & 255},${(value >> 8) & 255},${value & 255},${Math.max(
    0,
    opacity
  )})`;
}

function cssNumber(value: number): string {
  return Number.isFinite(value) ? String(value) : "0";
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttribute(value: string): string {
  return escapeHtml(value);
}

function escapeScriptText(value: string): string {
  return value.replaceAll("</script", "<\\/script").replaceAll("<!--", "<\\!--");
}

function escapeStyleText(value: string): string {
  return value.replaceAll("</style", "<\\/style");
}

function escapeCssColor(value: string): string {
  return /^[#(),.%\s\w-]+$/.test(value) ? value : "transparent";
}

function escapeCssFont(value: string): string {
  return `'${value.replaceAll("\\", "\\\\").replaceAll("'", "\\'")}'`;
}

function cssUrl(value: string): string {
  return `url('${escapeCssUrl(value)}')`;
}

function escapeCssUrl(value: string): string {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll('"', '\\"')
    .replaceAll("'", "\\'")
    .replaceAll("\n", "")
    .replaceAll("\r", "");
}

function isFontStylesheetUrl(url: string): boolean {
  return /\.css(\?|$)/i.test(url) || /fonts\.googleapis\.com/.test(url);
}
