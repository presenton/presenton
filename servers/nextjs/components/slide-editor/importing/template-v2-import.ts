import { resolveBackendAssetUrl } from "@/utils/api";
import { chartDataFromSeriesWithColors } from "@/components/slide-editor/charts/chart-data";
import { renderMarkdownTextRuns } from "@/components/slide-editor/text/markdown-text";
import {
  EDITOR_STAGE_HEIGHT,
  EDITOR_STAGE_WIDTH,
  type Alignment,
  type BorderRadius,
  type ChartSeries,
  type DataLabelPosition,
  type Deck,
  type DesignVariable,
  type Fill,
  type Font,
  type GroupElement,
  type InfographicData,
  type LayoutAlignment,
  type LayoutItem,
  type Padding,
  type Shadow,
  type Slide,
  type SlideElement,
  type Stroke,
  type TableCell,
  type TextElement,
  type TextListItem,
  type TextRun,
  type VectorCurve,
} from "@/components/slide-editor/types";
import { normalizeInfographicIcon } from "@/components/slide-editor/infographics/infographic-editing";

const MIN_ELEMENT_SIZE = 1;
const MAX_BORDER_RADIUS = 128;
type UnknownRecord = Record<string, unknown>;
type AdaptedPosition = { x: number; y: number };
type AdaptedSize = { width: number; height: number };
type AdaptedBaseElement = {
  decorative?: boolean | null;
  position?: AdaptedPosition | null;
  size?: AdaptedSize | null;
  rotation?: number | null;
  opacity?: number | null;
  shadow?: Shadow | null;
  component_id?: string | null;
  component_instance_id?: string | null;
  component_description?: string | null;
  component_slot?: string | null;
  design_variables?: DesignVariable[] | null;
  layout?: LayoutItem | null;
};
type AdaptedRequiredBaseElement = AdaptedBaseElement & {
  position: AdaptedPosition;
  size: AdaptedSize;
};

export type TemplateV2Layout = {
  id?: unknown;
  description?: unknown;
  elements?: unknown;
  components?: unknown;
};

export type TemplateV2ImportResponse = {
  id?: unknown;
  name?: unknown;
  description?: unknown;
  icon_type?: unknown;
  merged_components?: unknown;
  raw_layouts?: unknown;
  layouts?: unknown;
  assets?: unknown;
  fonts?: unknown;
};

export type GeneratedTemplateV2PresentationResponse = {
  id?: unknown;
  title?: unknown;
  description?: unknown;
  layout?: unknown;
  slides?: unknown;
};

const LAYOUT_ALIGNMENT_VALUES = new Set([
  "flex-start",
  "flex-end",
  "center",
  "stretch",
]);
const DATA_LABEL_POSITIONS = new Set(["base", "mid", "top", "outside"]);

export function adaptTemplateV2ResponseToDeck(
  template: TemplateV2ImportResponse,
): Deck {
  const layouts = extractRenderableLayouts(template);
  if (layouts.length === 0) {
    throw new Error("Template response did not include any layouts.");
  }

  const slides = layouts.slice(0, 50).map(adaptLayoutToSlide);
  const deck = {
    title: truncateString(readString(template.name) ?? "Imported template", 90),
    description:
      truncateString(readString(template.description) ?? "", 1200) || null,
    slides,
  } satisfies Deck;

  return deck;
}

export function normalizeTemplateV2Fonts(
  template: TemplateV2ImportResponse,
  fallbackFonts: Record<string, string> = {},
): Record<string, string> {

  const assetFonts = asRecord(template?.fonts);
  const fonts =
    assetFonts && Object.keys(assetFonts).length > 0 ? assetFonts : fallbackFonts;
  return Object.fromEntries(
    Object.entries(fonts)
      .filter(
        (entry): entry is [string, string] =>
          typeof entry[0] === "string" &&
          entry[0].trim().length > 0 &&
          typeof entry[1] === "string" &&
          entry[1].trim().length > 0,
      )
      .map(([name, url]) => [name, resolveBackendAssetUrl(url)]),
  );
}

export function adaptGeneratedTemplateV2PresentationToDeck(
  presentation: GeneratedTemplateV2PresentationResponse,
): Deck {
  const presentationRecord = asRecord(presentation) ?? {};
  const layoutPayload = readValue(presentationRecord, "layout");
  const layouts = extractTemplateV2Layouts(layoutPayload);
  const layoutById = new Map(
    layouts
      .map((layout) => [readString(layout.id), layout] as const)
      .filter((entry): entry is [string, TemplateV2Layout] => Boolean(entry[0])),
  );
  const generatedSlides = readArray(presentationRecord, "slides")
    .filter(isRecord)
    .sort((a, b) => (readNumber(a, "index") ?? 0) - (readNumber(b, "index") ?? 0));

  if (layouts.length === 0 && generatedSlides.length === 0) {
    throw new Error("Generated presentation did not include template v2 slides.");
  }

  const slides =
    generatedSlides.length > 0
      ? generatedSlides.slice(0, 50).map((slide, index) => {
        const uiLayout = readGeneratedSlideUiLayout(slide);
        if (uiLayout) {
          return adaptLayoutToSlide(uiLayout, index);
        }

        const layoutId = readString(slide.layout);
        const layout =
          (layoutId ? layoutById.get(layoutId) : null) ??
          layouts[index % layouts.length];
        if (!layout) {
          throw new Error(
            `Generated slide ${index + 1} did not include a renderable template v2 layout.`,
          );
        }
        return adaptLayoutToSlide(layout, index);
      })
      : layouts.slice(0, 50).map(adaptLayoutToSlide);

  const deck = {
    title: truncateString(
      readString(presentationRecord.title) ??
      readString(presentationRecord.id) ??
      "Generated presentation",
      90,
    ),
    description:
      truncateString(readString(presentationRecord.description) ?? "", 1200) ||
      null,
    slides,
  } satisfies Deck;

  return deck;
}

function readGeneratedSlideUiLayout(slide: UnknownRecord): TemplateV2Layout | null {
  const ui = asRecord(readValue(slide, "ui"));
  return ui ? (ui as TemplateV2Layout) : null;
}

export function extractTemplateV2Layouts(value: unknown): TemplateV2Layout[] {
  if (Array.isArray(value)) {
    return value.filter(isRecord) as TemplateV2Layout[];
  }

  const record = asRecord(value);
  if (Array.isArray(record?.layouts)) {
    return record.layouts.filter(isRecord) as TemplateV2Layout[];
  }
  const nestedLayouts = asRecord(record?.layouts);
  if (Array.isArray(nestedLayouts?.layouts)) {
    return nestedLayouts.layouts.filter(isRecord) as TemplateV2Layout[];
  }

  return [];
}

function extractRenderableLayouts(
  template: TemplateV2ImportResponse,
): TemplateV2Layout[] {
  const layouts = extractTemplateV2Layouts(template.layouts);
  if (layouts.length > 0) return layouts;
  return extractTemplateV2Layouts(template.raw_layouts);
}

export function adaptTemplateV2LayoutToSlide(
  layout: TemplateV2Layout,
  index = 0,
): Slide {
  return adaptLayoutToSlide(layout, index);
}

export function withEqualTemplateV2FlowChildSizes(
  element: Record<string, unknown>,
): unknown[] {
  const children = readArray(element, "children");
  if (children.length === 0) return children;

  const size = readRecord(element, "size");
  const width = readNumber(size ?? {}, "width");
  const height = readNumber(size ?? {}, "height");
  if (width == null || height == null) return children;

  const padding = readRecord(element, "padding");
  const contentWidth = Math.max(
    MIN_ELEMENT_SIZE,
    width -
    (readNumber(padding ?? {}, "left") ?? 0) -
    (readNumber(padding ?? {}, "right") ?? 0),
  );
  const contentHeight = Math.max(
    MIN_ELEMENT_SIZE,
    height -
    (readNumber(padding ?? {}, "top") ?? 0) -
    (readNumber(padding ?? {}, "bottom") ?? 0),
  );
  const type = readString(element.type);

  if (type === "flex" || type === "list-view") {
    const childTypes = children.map((child) => readString(asRecord(child)?.type));
    if (
      childTypes.some((childType) => childType == null) ||
      new Set(childTypes).size > 1
    ) {
      return children;
    }

    const direction = readString(element.direction) === "row" ? "row" : "column";
    const gap =
      direction === "row"
        ? readNumber(element, "column_gap") ??
        readNumber(element, "gap") ??
        0
        : readNumber(element, "row_gap") ??
        readNumber(element, "gap") ??
        0;
    const availableMain = Math.max(
      MIN_ELEMENT_SIZE,
      (direction === "row" ? contentWidth : contentHeight) -
      gap * Math.max(0, children.length - 1),
    );
    const mainSize = availableMain / children.length;
    return children.map((child) =>
      withTemplateV2ChildSize(
        child,
        direction === "row" ? mainSize : contentWidth,
        direction === "row" ? contentHeight : mainSize,
      ),
    );
  }

  if (type === "grid" || type === "grid-view") {
    const columns = Math.max(
      1,
      Math.min(children.length, Math.trunc(readNumber(element, "columns") ?? 1)),
    );
    const rows = Math.max(
      1,
      Math.trunc(readNumber(element, "rows") ?? Math.ceil(children.length / columns)),
    );
    const columnGap =
      readNumber(element, "column_gap") ??
      readNumber(element, "gap") ??
      0;
    const rowGap =
      readNumber(element, "row_gap") ??
      readNumber(element, "gap") ??
      0;
    const cellWidth = Math.max(
      MIN_ELEMENT_SIZE,
      (contentWidth - columnGap * Math.max(0, columns - 1)) / columns,
    );
    const cellHeight = Math.max(
      MIN_ELEMENT_SIZE,
      (contentHeight - rowGap * Math.max(0, rows - 1)) / rows,
    );
    return children.map((child) =>
      withTemplateV2ChildSize(child, cellWidth, cellHeight),
    );
  }

  return children;
}

function withTemplateV2ChildSize(
  child: unknown,
  width: number,
  height: number,
) {
  const record = asRecord(child);
  if (!record) return child;
  const size: UnknownRecord = readRecord(record, "size") ?? {};
  return {
    ...record,
    size: {
      ...size,
      width: readNumber(size, "width") ?? round(width),
      height: readNumber(size, "height") ?? round(height),
    },
  };
}

export function normalizeTemplateV2Slide(slide: Slide): Slide {
  return {
    ...slide,
    elements: slide.elements.map(normalizeTemplateV2Element),
  };
}

function adaptLayoutToSlide(layout: TemplateV2Layout, index: number): Slide {
  const rawElements = extractLayoutElements(layout);
  const elements = rawElements
    .slice(0, 80)
    .map((element) => adaptElement(element))
    .filter((element): element is SlideElement => Boolean(element));

  const slideElements =
    elements.length > 0 ? elements : [invisibleFallbackElement()];

  return normalizeTemplateV2Slide({
    title: titleFromLayout(layout, index),
    background: backgroundFromElements(slideElements),
    elements: slideElements,
  });
}

function normalizeTemplateV2Element(element: SlideElement): SlideElement {
  if ("children" in element && Array.isArray(element.children)) {
    const next = {
      ...element,
      children: element.children.map(normalizeTemplateV2Element),
    } as SlideElement;
    return next.type === "group" ? normalizeAuthorInfoCardGroup(next) : next;
  }

  if (element.type === "container" && element.child) {
    return {
      ...element,
      child: normalizeTemplateV2Element(element.child),
    };
  }

  return element;
}

function normalizeAuthorInfoCardGroup(group: GroupElement): GroupElement {
  if (!isAuthorInfoCard(group)) return group;

  const cardRight = authorInfoCardRightEdge(group);
  let changed = false;
  const children = group.children.map((child) => {
    if (!isAuthorInfoText(child) || !child.position || !child.size) {
      return child;
    }

    const availableWidth = Math.max(
      MIN_ELEMENT_SIZE,
      cardRight - child.position.x - 24,
    );
    if (availableWidth <= child.size.width + 1) return child;

    changed = true;
    return {
      ...child,
      size: {
        ...child.size,
        width: Math.min(EDITOR_STAGE_WIDTH, availableWidth),
      },
    };
  });

  return changed ? { ...group, children } : group;
}

function isAuthorInfoCard(group: GroupElement) {
  return (
    group.component_id === "author_info_card" ||
    group.component_slot === "author_info_card" ||
    group.component_instance_id?.startsWith("author_info_card:")
  );
}

function authorInfoCardRightEdge(group: GroupElement) {
  const backgroundRightEdge = group.children
    .filter((child): child is Extract<SlideElement, { type: "vector" }> =>
      child.type === "vector",
    )
    .map(vectorBackgroundRightEdge)
    .find((rightEdge): rightEdge is number => rightEdge != null);

  if (backgroundRightEdge != null) return backgroundRightEdge;

  return group.size.width;
}

function vectorBackgroundRightEdge(
  element: Extract<SlideElement, { type: "vector" }>,
) {
  if (element.points.length === 0 || !element.fill?.color) return null;
  const minX = Math.min(...element.points.map((point) => point.x));
  const minY = Math.min(...element.points.map((point) => point.y));
  const maxX = Math.max(...element.points.map((point) => point.x));
  if (minX > 0.05 || minY > 0.05 || maxX <= 0) return null;
  return maxX;
}

function isAuthorInfoText(
  element: SlideElement,
): element is Extract<SlideElement, { type: "text" }> {
  return (
    element.type === "text" &&
    (element.component_slot === "author_name" || element.component_slot === "date")
  );
}

function extractLayoutElements(layout: TemplateV2Layout): unknown[] {
  if (Array.isArray(layout.elements) && layout.elements.length > 0) {
    return layout.elements;
  }

  const components = readArray(layout as UnknownRecord, "components");
  return components
    .map((component, componentIndex) =>
      componentToGroupElement(component, componentIndex),
    )
    .filter((element): element is UnknownRecord => Boolean(asRecord(element)));
}

function componentToGroupElement(
  component: unknown,
  componentIndex: number,
): UnknownRecord | null {
  const raw = asRecord(component);
  if (!raw) return null;

  const elements = readArray(raw, "elements");
  if (elements.length === 0) return null;

  const renderedElements = elements.filter(isRecord);
  const componentFrame = rawComponentFrame(raw);
  const frame = componentFrame ?? rawElementsFrame(renderedElements);
  if (!frame) return null;

  const componentId =
    truncateString(readString(raw.id) ?? `component_${componentIndex}`, 120) ||
    `component_${componentIndex}`;
  const componentDescription = truncateString(
    readString(raw.description) ?? "",
    600,
  );

  return stripNullish({
    type: "group",
    position: { x: frame.x, y: frame.y },
    size: { width: frame.width, height: frame.height },
    children: componentFrame
      ? renderedElements.map((element) =>
        frameTopLevelFlowElementToComponent(element, componentFrame),
      )
      : renderedElements.map((element) =>
        localizeRawElementToFrame(element, frame),
      ),
    name: componentId,
    component_id: componentId,
    component_instance_id: `${componentId}:${componentIndex}`,
    component_description: componentDescription || null,
    design_variables: readArray(raw, "design_variables"),
  });
}

export function extractTemplateV2MergedComponents(template: unknown): unknown[] {
  const raw = asRecord(template);
  if (!raw) return [];

  const value = readValue(raw, "merged_components");
  if (Array.isArray(value)) {
    return value.filter(isRecord);
  }

  const record = asRecord(value);
  if (!record) return [];

  const components = readArray(record, "components");
  if (components.length > 0) {
    return components.filter(isRecord);
  }

  return Object.values(record).filter(isRecord);
}

export function adaptTemplateV2ComponentToElement(
  component: unknown,
  componentIndex = 0,
): SlideElement | null {
  const rawGroup = componentToGroupElement(component, componentIndex);
  if (!rawGroup) return null;

  const element = adaptElement(rawGroup);
  return element ? normalizeTemplateV2Element(element) : null;
}

function frameTopLevelFlowElementToComponent(
  element: UnknownRecord,
  frame: RawFrame,
): UnknownRecord {
  const type = readString(element.type);
  if (
    (type !== "grid" && type !== "flex") ||
    readRecord(element, "position") ||
    readRecord(element, "size")
  ) {
    return element;
  }

  return {
    ...element,
    position: { x: 0, y: 0 },
    size: { width: frame.width, height: frame.height },
  };
}

function rawElementsFrame(elements: UnknownRecord[]) {
  return mergeRawElementFrames(
    elements
      .map((element) => rawElementFrame(element))
      .filter((frame): frame is RawFrame => Boolean(frame)),
  );
}

type RawFrame = { x: number; y: number; width: number; height: number };

function rawElementFrame(
  element: UnknownRecord,
  offsetX = 0,
  offsetY = 0,
): RawFrame | null {
  const position = readRecord(element, "position");
  const size = readRecord(element, "size");
  const x = readNumber(position ?? {}, "x");
  const y = readNumber(position ?? {}, "y");
  const width = readNumber(size ?? {}, "width");
  const height = readNumber(size ?? {}, "height");
  const hasPosition = x != null && y != null;
  const vectorFrame = rawVectorFrame(element, offsetX, offsetY);
  const frame =
    vectorFrame ??
    (hasPosition && width != null && height != null
      ? {
        x: offsetX + x,
        y: offsetY + y,
        width: Math.max(1, width),
        height: Math.max(1, height),
      }
      : null);
  const childOffsetX = hasPosition ? offsetX + x : offsetX;
  const childOffsetY = hasPosition ? offsetY + y : offsetY;
  const childFrames = rawElementChildren(element)
    .map((child) => rawElementFrame(child, childOffsetX, childOffsetY))
    .filter((childFrame): childFrame is RawFrame => Boolean(childFrame));

  return mergeRawElementFrames(frame ? [frame, ...childFrames] : childFrames);
}

function rawVectorFrame(
  element: UnknownRecord,
  offsetX: number,
  offsetY: number,
): RawFrame | null {
  if (readString(element.type) !== "vector") return null;
  const points = readArray(element, "points")
    .map(asRecord)
    .map((point) => {
      const x = readNumber(point ?? {}, "x");
      const y = readNumber(point ?? {}, "y");
      return x != null && y != null ? { x, y } : null;
    })
    .filter((point): point is { x: number; y: number } => point != null);
  if (points.length === 0) return null;

  const minX = Math.min(...points.map((point) => point.x));
  const minY = Math.min(...points.map((point) => point.y));
  return {
    x: offsetX + minX,
    y: offsetY + minY,
    width: Math.max(1, Math.max(...points.map((point) => point.x)) - minX),
    height: Math.max(1, Math.max(...points.map((point) => point.y)) - minY),
  };
}

function rawElementChildren(element: UnknownRecord): UnknownRecord[] {
  const children = readArray(element, "children").filter(isRecord);
  const child = asRecord(readValue(element, "child"));
  return [...children, ...(child ? [child] : [])];
}

function mergeRawElementFrames(frames: RawFrame[]): RawFrame | null {
  if (frames.length === 0) {
    return null;
  }

  const minX = Math.min(...frames.map((frame) => frame.x));
  const minY = Math.min(...frames.map((frame) => frame.y));
  const maxX = Math.max(...frames.map((frame) => frame.x + frame.width));
  const maxY = Math.max(...frames.map((frame) => frame.y + frame.height));

  return {
    x: minX,
    y: minY,
    width: Math.max(1, maxX - minX),
    height: Math.max(1, maxY - minY),
  };
}

function rawComponentFrame(component: UnknownRecord) {
  const position = readRecord(component, "position");
  const x = readNumber(position ?? {}, "x");
  const y = readNumber(position ?? {}, "y");
  if (x == null || y == null) return null;
  const elements = readArray(component, "elements").filter(isRecord);
  const content = rawElementsContentSize(elements);

  return {
    x,
    y,
    width: content.width,
    height: content.height,
  };
}

function rawElementsContentSize(elements: UnknownRecord[]) {
  const frame = rawElementsFrame(elements);
  if (!frame) return { width: 1, height: 1 };
  return {
    width: Math.max(1, frame.x + frame.width),
    height: Math.max(1, frame.y + frame.height),
  };
}

function localizeRawElementToFrame(
  element: UnknownRecord,
  frame: { x: number; y: number },
) {
  const position = readRecord(element, "position");
  const localized: UnknownRecord = position
    ? {
      ...element,
      position: {
        ...position,
        x: (readNumber(position, "x") ?? 0) - frame.x,
        y: (readNumber(position, "y") ?? 0) - frame.y,
      },
    }
    : { ...element };

  if (readString(localized.type) === "vector") {
    localized.points = readArray(localized, "points").map((point) => {
      const rawPoint = asRecord(point);
      if (!rawPoint) return point;
      const x = readNumber(rawPoint, "x");
      const y = readNumber(rawPoint, "y");
      if (x == null || y == null) return point;
      return {
        ...rawPoint,
        x: x - frame.x,
        y: y - frame.y,
      };
    });
  }

  if (!position) {
    const children = readArray(localized, "children");
    if (children.length > 0) {
      localized.children = children.map((child) => {
        const rawChild = asRecord(child);
        return rawChild ? localizeRawElementToFrame(rawChild, frame) : child;
      });
    }

    const child = asRecord(readValue(localized, "child"));
    if (child) {
      localized.child = localizeRawElementToFrame(child, frame);
    }
  }

  return localized;
}

function adaptElement(value: unknown): SlideElement | null {
  const raw = asRecord(value);
  const type = readString(raw?.type);
  if (!raw || !type) return null;

  switch (type) {
    case "text":
      return adaptText(raw);
    case "container":
      return adaptContainer(raw);
    case "image":
      return adaptImage(raw);
    case "text-list":
      return adaptTextList(raw);
    case "table":
      return adaptTable(raw);
    case "vector":
      return adaptVector(raw);
    case "chart":
      return adaptChart(raw);
    case "infographic":
      return adaptInfographic(raw);
    case "flex":
      return adaptFlex(raw);
    case "grid":
      return adaptGrid(raw);
    case "group":
      return adaptGroup(raw);
    default:
      return null;
  }
}

function adaptText(raw: UnknownRecord): SlideElement {
  const font = adaptFont(readRecord(raw, "font"));
  const element: TextElement = {
    ...baseElement(raw),
    type: "text",
    font: font && font.line_height == null ? { ...font, line_height: 1 } : font,
    alignment: adaptAlignment(readRecord(raw, "alignment")),
    fill: adaptFill(readRecord(raw, "fill")),
    stroke: adaptStroke(readRecord(raw, "stroke")),
    runs: adaptTextRuns(readArray(raw, "runs"), readString(raw.text)),
    max_length: readNumber(raw, "max_length"),
    min_length: readNumber(raw, "min_length"),
  };
  return element;
}

function adaptContainer(raw: UnknownRecord): SlideElement {
  const child = adaptElement(readValue(raw, "child"));
  const base = baseElement(raw);
  const padding = adaptPadding(readRecord(raw, "padding"));
  const inferredSize =
    !base.size && child?.size ? paddedChildSize(child.size, padding) : null;
  return {
    ...base,
    ...(inferredSize ? { size: inferredSize } : {}),
    type: "container",
    alignment: adaptAlignment(readRecord(raw, "alignment")),
    fill: adaptFill(readRecord(raw, "fill")),
    stroke: adaptStroke(readRecord(raw, "stroke")),
    border_radius: adaptBorderRadius(readRecord(raw, "border_radius")),
    padding,
    shadow: adaptShadow(readRecord(raw, "shadow")),
    child,
  };
}

function paddedChildSize(
  size: AdaptedSize,
  padding: Padding | null,
): AdaptedSize {
  return {
    width: clamp(
      round(size.width + (padding?.left ?? 0) + (padding?.right ?? 0)),
      MIN_ELEMENT_SIZE,
      EDITOR_STAGE_WIDTH,
    ),
    height: clamp(
      round(size.height + (padding?.top ?? 0) + (padding?.bottom ?? 0)),
      MIN_ELEMENT_SIZE,
      EDITOR_STAGE_HEIGHT,
    ),
  };
}

function adaptImage(raw: UnknownRecord): SlideElement {
  const data = readString(raw.data);
  return {
    ...baseElement(raw),
    type: "image",
    flip_h: readBoolean(raw, "flip_h"),
    flip_v: readBoolean(raw, "flip_v"),
    data: data ? resolveBackendAssetUrl(data) : null,
    name: truncateString(readString(raw.name) ?? "", 120) || null,
    fit: readEnum(raw, ["contain", "cover", "fill"], "fit"),
    focus_x: readNumber(raw, "focus_x"),
    focus_y: readNumber(raw, "focus_y"),
    crop_scale: readNumber(raw, "crop_scale"),
    border_radius: adaptBorderRadius(readRecord(raw, "border_radius")),
    clippath: readString(raw.clippath ?? raw.clipPath ?? raw.clip_path),
    color: readString(raw.color),
    is_icon: readBoolean(raw, "is_icon"),
    icon_type: readEnum(
      raw,
      ["bold", "duotone", "fill", "light", "regular", "thin"],
      "icon_type",
    ),
  };
}

function adaptTextList(raw: UnknownRecord): SlideElement {
  const font = adaptFont(readRecord(raw, "font"));
  const marker = readEnum(raw, ["bullet", "number", "none"], "marker");
  return {
    ...baseElement(raw),
    type: "text-list",
    font,
    marker,
    items: adaptTextListItems(readArray(raw, "items")),
    max_items: readNumber(raw, "max_items"),
    min_items: readNumber(raw, "min_items"),
    max_item_length: readNumber(raw, "max_item_length"),
    min_item_length: readNumber(raw, "min_item_length"),
  };
}

function adaptTable(raw: UnknownRecord): SlideElement {
  const columns = adaptTableCells(readArray(raw, "columns")).slice(0, 6);
  const rows = readArray(raw, "rows")
    .map((row) => adaptTableCells(Array.isArray(row) ? row : []))
    .filter((row) => row.length > 0)
    .slice(0, 7);

  return {
    ...baseElement(raw),
    type: "table",
    font: adaptFont(readRecord(raw, "font")),
    columns,
    rows: rows.length > 0 ? rows : [columns],
    max_columns: readNumber(raw, "max_columns"),
    min_columns: readNumber(raw, "min_columns"),
    max_rows: readNumber(raw, "max_rows"),
    min_rows: readNumber(raw, "min_rows"),
  };
}

function adaptVector(raw: UnknownRecord): SlideElement | null {
  const base = baseElement(raw);
  const fill = adaptFill(readRecord(raw, "fill"));
  const stroke = adaptStroke(readRecord(raw, "stroke"));
  const points = adaptVectorPoints(raw);
  if (!hasVisiblePaint(fill, stroke, base.opacity)) return null;
  if (points.length < 2) return null;

  const { position, size, decorative, ...pointBase } = base;
  void position;
  void size;
  void decorative;

  return {
    ...pointBase,
    type: "vector",
    shape: readEnum(raw, ["polygon", "ellipse"], "shape") ?? undefined,
    points,
    closed: adaptVectorClosed(raw, points),
    corner_radii: adaptCornerRadii(raw, points.length),
    curve: adaptVectorCurve(raw) ?? adaptImplicitVectorCurve(raw),
    start_marker:
      readEnum(
        raw,
        ["none", "arrow", "stealth", "triangle", "circle", "square", "diamond"],
        "start_marker",
      ) ?? undefined,
    end_marker:
      readEnum(
        raw,
        ["none", "arrow", "stealth", "triangle", "circle", "square", "diamond"],
        "end_marker",
      ) ?? undefined,
    fill,
    stroke,
    shadow: adaptShadow(readRecord(raw, "shadow")),
  };
}

function adaptVectorPoints(raw: UnknownRecord): AdaptedPosition[] {
  return readArray(raw, "points")
    .map((value) => {
      const point = asRecord(value);
      if (!point) return null;
      const x = readRawNumber(point.x);
      const y = readRawNumber(point.y);
      return x != null && y != null ? { x: round(x), y: round(y) } : null;
    })
    .filter((point): point is AdaptedPosition => point != null);
}

function adaptVectorClosed(
  raw: UnknownRecord,
  points: AdaptedPosition[],
): boolean {
  const closed = readValue(raw, "closed");
  if (typeof closed === "boolean") return closed;
  if (typeof closed === "string") {
    const normalized = closed.trim().toLowerCase();
    if (normalized === "false" || normalized === "0") return false;
    if (normalized === "true" || normalized === "1") return true;
  }
  return points.length > 2;
}

function adaptVectorCurve(raw: UnknownRecord): VectorCurve | null {
  const curve = readRecord(raw, "curve");
  if (!curve) return null;
  const rawType = readString(curve.type)?.trim().toLowerCase();
  if (rawType !== "smooth") return null;
  return {
    type: "smooth",
    tension: clampOptional(readRawNumber(curve.tension), 0, 1),
    segments: clampOptional(readRawNumber(curve.segments), 1, 96),
  };
}

function adaptImplicitVectorCurve(raw: UnknownRecord): VectorCurve | null {
  void raw;
  return null;
}

function adaptCornerRadii(raw: UnknownRecord, pointCount: number): number[] | null {
  const rawRadii = raw.corner_radii ?? raw.cornerRadii;
  const explicit = (Array.isArray(rawRadii) ? rawRadii : [])
    .map(readRawNumber)
    .filter((value): value is number => value != null)
    .map((value) => clamp(round(value), 0, MAX_BORDER_RADIUS));
  if (explicit.length > 0) return explicit.slice(0, pointCount);

  return null;
}

function adaptChart(raw: UnknownRecord): SlideElement {
  const categories = adaptChartCategories(readArray(raw, "categories"));
  const series = readArray(raw, "series")
    .map(adaptChartSeries)
    .filter((item): item is ChartSeries => item != null);
  const chartType =
    readEnum(
      raw,
      [
        "area",
        "bar",
        "bubble",
        "donut",
        "horizontal_bar",
        "horizontal_stacked_bar",
        "line",
        "pie",
        "polar_area",
        "radar",
        "scatter",
        "stacked_bar",
      ],
      "chart_type",
    ) ??
    "bar";
  const supportedSeries =
    chartType === "pie" || chartType === "donut"
      ? series.slice(0, 1)
      : series;
  const colors = readArray(raw, "colors")
    .map(readColor)
    .filter((item): item is string => Boolean(item))
    .slice(0, 12);
  const color = colors[0] ?? null;
  const data = chartDataFromSeriesWithColors(
    categories,
    supportedSeries,
    colors,
    supportedSeries.length <= 1,
  ).slice(0, 8);
  const dataLabels = readDataLabelPosition(
    raw,
    Object.prototype.hasOwnProperty.call(raw, "data_labels")
      ? "data_labels"
      : "dataLabels",
  );

  return {
    ...baseElement(raw),
    type: "chart",
    chart_type: chartType,
    data: data.length > 0 ? data : [{ label: "Data", value: 0 }],
    title: truncateString(readString(raw.title) ?? "", 80) || null,
    title_color: readColor(readValue(raw, "title_color") ?? raw.titleColor),
    legend_color: readColor(readValue(raw, "legend_color") ?? raw.legendColor),
    color,
    axis_color: readColor(readValue(raw, "axis_color")),
    grid_color: readColor(readValue(raw, "grid_color")),
    data_labels: dataLabels,
    legend: readBoolean(raw, "legend"),
    colors,
    x_axis: readBoolean(raw, "x_axis"),
    y_axis: readBoolean(raw, "y_axis"),
    x_axis_grid: readBoolean(raw, "x_axis_grid"),
    y_axis_grid: readBoolean(raw, "y_axis_grid"),
    x_axis_title:
      truncateString(
        readString(readValue(raw, "x_axis_title")) ?? "",
        80,
      ) || null,
    y_axis_title:
      truncateString(
        readString(readValue(raw, "y_axis_title")) ?? "",
        80,
      ) || null,
    categories,
    series: supportedSeries,
    source: truncateString(readString(raw.source) ?? "", 120) || null,
  };
}

function adaptInfographic(raw: UnknownRecord): SlideElement {
  const data = readRecord(raw, "data") ?? {};
  const infographicType =
    readEnum(
      data,
      [
        "progress_bar",
        "gauge",
        "gantt",
        "timeline",
        "roadmap",
        "milestone_timeline",
        "staircase",
        "supply_chain",
        "stair_step_blocks",
        "maturity_model",
        "pillar_framework",
        "transformation_hub",
        "diagonal_circles",
        "risk_matrix",
        "chevron_process",
        "radial_cycle",
        "conversion_funnel",
        "pyramid",
        "segmented_wheel",
        "customer_journey",
        "before_after",
        "impact_effort_matrix",
        "comparison_matrix",
        "org_chart",
        "decision_tree",
        "mind_map",
      ],
      "type",
    ) ??
    readEnum(
      raw,
      [
        "progress_bar",
        "gauge",
        "gantt",
        "timeline",
        "roadmap",
        "milestone_timeline",
        "staircase",
        "supply_chain",
        "stair_step_blocks",
        "maturity_model",
        "pillar_framework",
        "transformation_hub",
        "diagonal_circles",
        "risk_matrix",
        "chevron_process",
        "radial_cycle",
        "conversion_funnel",
        "pyramid",
        "segmented_wheel",
        "customer_journey",
        "before_after",
        "impact_effort_matrix",
        "comparison_matrix",
        "org_chart",
        "decision_tree",
        "mind_map",
      ],
      "infographic_type",
    ) ??
    "gauge";
  const minValue =
    readNumber(data, "min_value") ??
    readNumber(raw, "min_value") ??
    0;
  const rawMaxValue =
    readNumber(data, "max_value") ??
    readNumber(raw, "max_value") ??
    100;
  const maxValue =
    rawMaxValue === minValue ? minValue + 1 : rawMaxValue;
  const colors = readArray(raw, "colors")
    .map(readColor)
    .filter((color): color is string => Boolean(color));

  return {
    ...baseElement(raw),
    type: "infographic",
    name: truncateString(readString(raw.name) ?? "", 120) || null,
    data: adaptInfographicData(
      infographicType,
      data,
      raw,
      minValue,
      maxValue,
    ),
    colors: [
      colors[0] ??
        readColor(readValue(raw, "base_color")) ??
        "E5E7EB",
      colors[1] ??
        readColor(readValue(raw, "highlight_color")) ??
        "2563EB",
      ...colors.slice(2),
    ],
    text_color: readColor(readValue(raw, "text_color")) ?? null,
  };
}

function adaptInfographicData(
  type:
    | "progress_bar"
    | "gauge"
    | "gantt"
    | "timeline"
    | "roadmap"
    | "milestone_timeline"
    | "staircase"
    | "supply_chain"
    | "stair_step_blocks"
    | "maturity_model"
    | "pillar_framework"
    | "transformation_hub"
    | "diagonal_circles"
    | "risk_matrix"
    | "chevron_process"
    | "radial_cycle"
    | "conversion_funnel"
    | "pyramid"
    | "segmented_wheel"
    | "customer_journey"
    | "before_after"
    | "impact_effort_matrix"
    | "comparison_matrix"
    | "org_chart"
    | "decision_tree"
    | "mind_map",
  data: UnknownRecord,
  raw: UnknownRecord,
  minValue: number,
  maxValue: number,
): InfographicData {
  if (type === "gantt") {
    const columns = readArray(data, "columns")
      .map(asRecord)
      .filter((item): item is UnknownRecord => Boolean(item))
      .map((item, index) => ({
        label: truncateString(
          readString(item.label) ?? `Phase ${index + 1}`,
          80,
        ),
      }));
    const safeColumns = columns.length > 0 ? columns : [{ label: "Phase 1" }];
    const rows = readArray(data, "rows")
      .map(asRecord)
      .filter((item): item is UnknownRecord => Boolean(item))
      .map((row, rowIndex) => ({
        label: truncateString(
          readString(row.label) ?? `Workstream ${rowIndex + 1}`,
          80,
        ),
        items: readArray(row, "items")
          .map(asRecord)
          .filter((item): item is UnknownRecord => Boolean(item))
          .map((item, itemIndex) => ({
            name: truncateString(
              readString(item.name) ?? `Task ${itemIndex + 1}`,
              80,
            ),
            start: adaptGanttPosition(
              asRecord(item.start),
              0,
              safeColumns.length,
            ),
            end: adaptGanttPosition(
              asRecord(item.end),
              safeColumns.length - 1,
              safeColumns.length,
            ),
          })),
      }));
    return {
      type,
      columns: safeColumns,
      rows: rows.length > 0 ? rows : [{ label: "Workstream", items: [] }],
    };
  }

  if (
    type === "timeline" ||
    type === "roadmap" ||
    type === "milestone_timeline" ||
    type === "staircase" ||
    type === "supply_chain" ||
    type === "stair_step_blocks" ||
    type === "maturity_model" ||
    type === "diagonal_circles" ||
    type === "chevron_process" ||
    type === "segmented_wheel" ||
    type === "customer_journey" ||
    type === "pyramid"
  ) {
    const items = readArray(data, "items")
      .map(adaptInfographicTextItem)
      .filter((item): item is NonNullable<typeof item> => Boolean(item));
    return {
      type,
      ...(type === "customer_journey"
        ? { start_color: readString(data.start_color) }
        : {}),
      items:
        items.length > 0
          ? items
          : type === "pyramid"
            ? [
                { heading: "Foundation" },
                { heading: "Efficiency" },
                { heading: "Innovation" },
              ]
            : [{ heading: "Milestone" }],
    };
  }

  if (type === "radial_cycle") {
    const items = readArray(data, "items")
      .map(adaptInfographicTextItem)
      .filter((item): item is NonNullable<typeof item> => Boolean(item));
    return {
      type,
      center_image: truncateString(readString(data.center_image) ?? "", 2000) || null,
      items: items.length > 0 ? items : [{ heading: "Step 1" }],
    };
  }

  if (type === "pillar_framework") {
    const items = readArray(data, "items").map(adaptInfographicTextItem).filter((item): item is NonNullable<typeof item> => Boolean(item));
    return { type, title: truncateString(readString(data.title) ?? "Growth & Transformation Framework", 120), items: items.length > 0 ? items : [{ heading: "Customer", focus: "Experience & Value" }] };
  }

  if (type === "transformation_hub") {
    const items = readArray(data, "items").map(adaptInfographicTextItem).filter((item): item is NonNullable<typeof item> => Boolean(item));
    return { type, center_label: truncateString(readString(data.center_label) ?? "Business Transformation", 120), items: items.length > 0 ? items : [{ heading: "Strategy" }, { heading: "Process" }] };
  }

  if (type === "risk_matrix") {
    const items = readArray(data, "items").map(adaptInfographicTextItem).filter((item): item is NonNullable<typeof item> => Boolean(item));
    const defaults = ["Identify", "Prioritize", "Assess", "Respond"];
    return { type, center_label: truncateString(readString(data.center_label) ?? "RISK", 4), items: defaults.map((heading, index) => items[index] ?? { heading }) };
  }

  if (type === "conversion_funnel") {
    const items = readArray(data, "items")
      .map(asRecord)
      .filter((item): item is UnknownRecord => Boolean(item))
      .map((item, index) => ({
        value: clamp(
          readNumber(item, "value") ?? Math.max(0, 60 - index * 10),
          0,
          100,
        ),
        heading: truncateString(readString(item.heading) ?? `Stage ${index + 1}`, 80),
        description: truncateString(readString(item.description) ?? "", 280) || null,
      }));
    return {
      type,
      items:
        items.length > 0
          ? items
          : [{ value: 50, heading: "Stage 1", description: null }],
    };
  }

  if (type === "before_after") {
    const items = readArray(data, "items")
      .map(adaptInfographicTextItem)
      .filter((item): item is NonNullable<typeof item> => Boolean(item));
    const evenItems = items.slice(0, items.length - (items.length % 2));
    return {
      type,
      before_label: truncateString(readString(data.before_label) ?? "Before", 80),
      after_label: truncateString(readString(data.after_label) ?? "After", 80),
      items:
        evenItems.length >= 2
          ? evenItems
          : [{ heading: "Before" }, { heading: "After" }],
    };
  }

  if (type === "impact_effort_matrix") {
    const items = readArray(data, "items")
      .map(adaptInfographicTextItem)
      .filter((item): item is NonNullable<typeof item> => Boolean(item));
    const defaults = ["Quick Wins", "Strategic Priorities", "Deprioritize", "Fill-ins"];
    return {
      type,
      x_axis_label: truncateString(readString(data.x_axis_label) ?? "Impact", 80),
      y_axis_label: truncateString(readString(data.y_axis_label) ?? "Effort", 80),
      low_label: truncateString(readString(data.low_label) ?? "Low", 40),
      high_label: truncateString(readString(data.high_label) ?? "High", 40),
      items: defaults.map((heading, index) => items[index] ?? { heading }),
    };
  }

  if (type === "comparison_matrix") {
    const criteria = readArray(data, "criteria")
      .map((value) => truncateString(readString(value) ?? "", 80))
      .filter(Boolean);
    const safeCriteria = criteria.length > 0 ? criteria : ["Criterion 1"];
    const items = readArray(data, "items")
      .map(asRecord)
      .filter((item): item is UnknownRecord => Boolean(item))
      .map((item, index) => {
        const normalizedIcon = normalizeInfographicIcon(item.icon, item.color);
        const values = readArray(item, "values").map((value) => truncateString(readString(value) ?? "", 80));
        return {
          icon: normalizedIcon ?? undefined,
          heading: truncateString(readString(item.heading) ?? `Option ${index + 1}`, 120),
          values: safeCriteria.map((_, valueIndex) => values[valueIndex] ?? ""),
        };
      });
    return {
      type,
      criteria: safeCriteria,
      items: items.length > 0 ? items : [{ heading: "Option 1", values: safeCriteria.map(() => "") }],
    };
  }

  if (type === "org_chart" || type === "decision_tree") {
    const items = readArray(data, "items")
      .map(asRecord)
      .filter((item): item is UnknownRecord => Boolean(item))
      .map((item, index) => ({
        id: truncateString(readString(item.id) ?? `node-${index + 1}`, 80),
        parent_id: truncateString(readString(item.parent_id) ?? "", 80) || null,
        heading: truncateString(readString(item.heading) ?? `Item ${index + 1}`, 120),
        description: truncateString(readString(item.description) ?? "", 240) || null,
      }));
    return {
      type,
      items: items.length > 0 ? items : [{ id: "node-1", parent_id: null, heading: type === "org_chart" ? "Leader" : "Decision", description: null }],
    };
  }

  if (type === "mind_map") {
    const items = readArray(data, "items")
      .map(adaptMindMapNode)
      .filter((item): item is NonNullable<typeof item> => Boolean(item));
    return {
      type,
      items:
        items.length > 0 ? items : [{ heading: "Core idea", items: [] }],
    };
  }

  return {
    type,
    min_value: minValue,
    max_value: maxValue,
    value: readNumber(data, "value") ?? readNumber(raw, "value") ?? minValue,
  };
}

function adaptGanttPosition(
  value: UnknownRecord | null,
  fallbackColumn: number,
  columnCount: number,
) {
  const column = Math.round(
    readNumber(value ?? {}, "column") ?? fallbackColumn,
  );
  const offset = readNumber(value ?? {}, "offset") ?? 0;
  return {
    column: clamp(column, 0, Math.max(0, columnCount - 1)),
    offset: clamp(offset, 0, 1),
  };
}

function adaptInfographicTextItem(value: unknown) {
  const item = asRecord(value);
  if (!item) return null;
  const normalizedIcon = normalizeInfographicIcon(item.icon, item.color);
  const icon = normalizedIcon
    ? {
        ...normalizedIcon,
        url: truncateString(normalizedIcon.url, 2048),
      }
    : undefined;
  const heading =
    truncateString(readString(item.heading) ?? "", 120) || undefined;
  const description =
    truncateString(readString(item.description) ?? "", 240) || undefined;
  const focus = truncateString(readString(item.focus) ?? "", 120) || undefined;
  return icon || heading || description || focus ? { icon, heading, description, focus } : null;
}

function adaptMindMapNode(
  value: unknown,
): Extract<InfographicData, { type: "mind_map" }>["items"][number] | null {
  const item = asRecord(value);
  if (!item) return null;
  const visible = adaptInfographicTextItem(item);
  const items = readArray(item, "items")
    .map(adaptMindMapNode)
    .filter((child): child is NonNullable<typeof child> => Boolean(child));
  if (!visible && items.length === 0) return null;
  return { ...visible, items };
}

function adaptFlex(raw: UnknownRecord): SlideElement {
  return {
    ...requiredBaseElement(raw),
    type: "flex",
    direction: readEnum(raw, ["row", "column"], "direction") ?? "column",
    wrap: readBoolean(raw, "wrap"),
    align_items: readLayoutAlignment(raw, "align_items"),
    justify_content: readLayoutAlignment(raw, "justify_content"),
    padding: adaptPadding(readRecord(raw, "padding")),
    gap: readNumber(raw, "gap"),
    column_gap: readNumber(raw, "column_gap"),
    row_gap: readNumber(raw, "row_gap"),
    children: withEqualTemplateV2FlowChildSizes(raw)
      .map(adaptElement)
      .filter(Boolean) as SlideElement[],
    max_children: readNumber(raw, "max_children"),
    min_children: readNumber(raw, "min_children"),
  };
}

function adaptGrid(raw: UnknownRecord): SlideElement {
  return {
    ...requiredBaseElement(raw),
    type: "grid",
    columns: positiveInteger(readNumber(raw, "columns"), 1),
    rows: positiveIntegerOrNull(readNumber(raw, "rows")),
    gap: readNumber(raw, "gap"),
    column_gap: readNumber(raw, "column_gap"),
    row_gap: readNumber(raw, "row_gap"),
    align_items: readLayoutAlignment(raw, "align_items"),
    justify_items: readLayoutAlignment(raw, "justify_items"),
    padding: adaptPadding(readRecord(raw, "padding")),
    children: withEqualTemplateV2FlowChildSizes(raw)
      .map(adaptElement)
      .filter(Boolean) as SlideElement[],
    max_children: readNumber(raw, "max_children"),
    min_children: readNumber(raw, "min_children"),
  };
}

function adaptGroup(raw: UnknownRecord): SlideElement {
  const children = readArray(raw, "children")
    .map(adaptElement)
    .filter(Boolean) as SlideElement[];
  const base = baseElement(raw);
  const frame = groupFrame(base, children);

  return {
    ...base,
    ...frame,
    type: "group",
    children,
    max_children: readNumber(raw, "max_children"),
    min_children: readNumber(raw, "min_children"),
  };
}

function groupFrame(
  base: AdaptedBaseElement,
  children: SlideElement[],
): AdaptedRequiredBaseElement {
  const bounds = childrenBounds(children);
  return {
    ...base,
    position: base.position ?? { x: 0, y: 0 },
    size: base.size ?? bounds,
  };
}

function childrenBounds(children: SlideElement[]): AdaptedSize {
  if (children.length === 0) {
    return { width: MIN_ELEMENT_SIZE, height: MIN_ELEMENT_SIZE };
  }

  const bounds = children.reduce(
    (acc, child) => {
      const childBounds = adaptedElementBounds(child);
      return {
        width: Math.max(acc.width, childBounds.x + childBounds.width),
        height: Math.max(acc.height, childBounds.y + childBounds.height),
      };
    },
    { width: MIN_ELEMENT_SIZE, height: MIN_ELEMENT_SIZE },
  );

  return {
    width: clamp(round(bounds.width), MIN_ELEMENT_SIZE, EDITOR_STAGE_WIDTH),
    height: clamp(round(bounds.height), MIN_ELEMENT_SIZE, EDITOR_STAGE_HEIGHT),
  };
}

function adaptedElementBounds(child: SlideElement): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  if (
    child.type === "vector" &&
    Array.isArray(child.points)
  ) {
    const points = child.points.filter(
      (point): point is AdaptedPosition =>
        typeof point.x === "number" && typeof point.y === "number",
    );
    if (points.length > 0) {
      const minX = Math.min(...points.map((point) => point.x));
      const minY = Math.min(...points.map((point) => point.y));
      const maxX = Math.max(...points.map((point) => point.x));
      const maxY = Math.max(...points.map((point) => point.y));
      const strokeWidth = Math.max(1, child.stroke?.width ?? 1);
      return {
        x: minX,
        y: minY,
        width: Math.max(maxX - minX, strokeWidth, MIN_ELEMENT_SIZE),
        height: Math.max(maxY - minY, strokeWidth, MIN_ELEMENT_SIZE),
      };
    }
  }

  return {
    x: child.position?.x ?? 0,
    y: child.position?.y ?? 0,
    width: child.size?.width ?? MIN_ELEMENT_SIZE,
    height: child.size?.height ?? MIN_ELEMENT_SIZE,
  };
}

function baseElement(
  raw: UnknownRecord,
  options: { requireFrame?: boolean } = {},
): AdaptedBaseElement {
  const base: AdaptedBaseElement = {};
  const position = adaptPosition(readRecord(raw, "position"));
  const size = adaptSize(readRecord(raw, "size"));
  const componentSlot =
    readString(readValue(raw, "component_slot")) ??
    readString(raw.name);

  const decorative = readDecorative(raw);
  if (decorative != null) base.decorative = decorative;
  if (position) base.position = position;
  if (size) base.size = size;
  if (options.requireFrame && !position) base.position = { x: 0, y: 0 };
  if (options.requireFrame && !size) base.size = { width: EDITOR_STAGE_WIDTH, height: EDITOR_STAGE_HEIGHT };
  if (options.requireFrame && !readRecord(raw, "layout")) {
    base.layout = { grow: 1, shrink: 1 };
  }
  if (readNumber(raw, "rotation") != null) {
    base.rotation = clamp(readNumber(raw, "rotation") ?? 0, -360, 360);
  }
  if (readNumber(raw, "opacity") != null) {
    base.opacity = clamp(readNumber(raw, "opacity") ?? 1, 0, 1);
  }
  if (componentSlot) base.component_slot = truncateString(componentSlot, 120);
  const designVariables = adaptDesignVariables(
    readArray(raw, "design_variables"),
  );
  if (designVariables.length > 0) base.design_variables = designVariables;
  if (readString(readValue(raw, "component_id"))) {
    base.component_id = truncateString(
      readString(readValue(raw, "component_id")) ?? "",
      120,
    );
  }
  if (readString(readValue(raw, "component_instance_id"))) {
    base.component_instance_id = truncateString(
      readString(readValue(raw, "component_instance_id")) ?? "",
      160,
    );
  }
  if (readString(readValue(raw, "component_description"))) {
    base.component_description = truncateString(
      readString(readValue(raw, "component_description")) ?? "",
      600,
    );
  }

  const shadow = adaptShadow(readRecord(raw, "shadow"));
  if (shadow) base.shadow = shadow;

  const layout = adaptLayoutItem(readRecord(raw, "layout"));
  if (layout) base.layout = { ...(base.layout ?? {}), ...layout };

  return base;
}

function requiredBaseElement(raw: UnknownRecord): AdaptedRequiredBaseElement {
  return baseElement(raw, { requireFrame: true }) as AdaptedRequiredBaseElement;
}

function adaptDesignVariables(values: unknown[]): DesignVariable[] {
  return values
    .map((value): DesignVariable | null => {
      const raw = asRecord(value);
      if (!raw) return null;

      const name = truncateString(readString(raw.name) ?? "", 120);
      const type = truncateString(readString(raw.type) ?? "", 40);
      const options: unknown[] = readArray(raw, "options")
        .map(toJsonValue)
        .filter((option) => option !== undefined);
      const effect = readArray(raw, "effect")
        .map((item) => {
          const rawEffect = asRecord(item);
          if (!rawEffect) return null;
          const path = truncateString(
            readString(readValue(rawEffect, "path")) ?? "",
            240,
          );
          const expression = truncateString(
            readString(readValue(rawEffect, "effect")) ?? "",
            120,
          );
          return path && expression ? { path, effect: expression } : null;
        })
        .filter((item): item is DesignVariable["effect"][number] =>
          Boolean(item),
        );

      if (!name || options.length === 0 || effect.length === 0) return null;
      return {
        name,
        ...(type ? { type } : {}),
        options,
        effect,
      } satisfies DesignVariable;
    })
    .filter((item): item is DesignVariable => Boolean(item));
}

function toJsonValue(value: unknown): unknown {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(toJsonValue).filter((item) => item !== undefined);
  }

  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value)
        .map(([key, item]) => [key, toJsonValue(item)] as const)
        .filter(([, item]) => item !== undefined),
    );
  }

  return undefined;
}

function adaptPosition(value: UnknownRecord | null): { x: number; y: number } | null {
  if (!value) return null;
  return {
    x: round(readNumber(value, "x") ?? 0),
    y: round(readNumber(value, "y") ?? 0),
  };
}

function adaptSize(value: UnknownRecord | null): { width: number; height: number } | null {
  if (!value) return null;
  return {
    width: clamp(round(readNumber(value, "width") ?? MIN_ELEMENT_SIZE), MIN_ELEMENT_SIZE, EDITOR_STAGE_WIDTH),
    height: clamp(round(readNumber(value, "height") ?? MIN_ELEMENT_SIZE), MIN_ELEMENT_SIZE, EDITOR_STAGE_HEIGHT),
  };
}

function adaptLayoutItem(value: UnknownRecord | null): LayoutItem | null {
  if (!value) return null;
  return stripNullish({
    grow: clampOptional(readNumber(value, "grow"), 0, 12),
    shrink: clampOptional(readNumber(value, "shrink"), 0, 12),
    basis: readNumber(value, "basis"),
    min_width: readNumber(value, "min_width"),
    max_width: readNumber(value, "max_width"),
    min_height: readNumber(value, "min_height"),
    max_height: readNumber(value, "max_height"),
    column_span: clampInteger(readNumber(value, "column_span"), 1, 12),
    row_span: clampInteger(readNumber(value, "row_span"), 1, 12),
    align_self: readLayoutAlignment(value, "align_self"),
  });
}

function adaptAlignment(value: UnknownRecord | null): Alignment | null {
  if (!value) return null;
  return stripNullish({
    horizontal: readEnum(
      value,
      ["left", "center", "right", "justify"],
      "horizontal",
    ),
    vertical: readEnum(value, ["top", "middle", "bottom"], "vertical"),
  });
}

function adaptFont(value: UnknownRecord | null): Font | null {
  if (!value) return null;
  const fontWeight = readNumber(value, "font_weight");
  const size = readNumber(value, "size");
  return stripNullish({
    family:
      truncateString(readString(value.family) ?? readString(value.name) ?? "", 80) ||
      null,
    size: size == null ? null : clamp(round(size), 6, 360),
    color: readColor(value.color),
    bold: readBoolean(value, "bold") ?? (fontWeight == null ? null : fontWeight >= 600),
    italic: readBoolean(value, "italic"),
    underline:
      readBoolean(value, "underline") ??
      ([
        readString(value.text_decoration),
        readString(value.textDecoration),
      ].includes("underline")
        ? true
        : null),
    line_height: clampOptional(readNumber(value, "line_height"), 0.8, 2.2),
    letter_spacing: clamp(readNumber(value, "letter_spacing") ?? 0, -200, 600),
    ellipsis: readBoolean(value, "ellipsis"),
    opacity: clampOptional(readNumber(value, "opacity"), 0, 1),
  });
}

function adaptFill(value: UnknownRecord | null): Fill | null {
  const color = readColor(value?.color);
  if (!color) return null;
  return stripNullish({
    color,
    opacity: clamp(readNumber(value ?? {}, "opacity") ?? 1, 0, 1),
  });
}

function adaptStroke(value: UnknownRecord | null): Stroke | null {
  const color = readColor(value?.color);
  if (!color) return null;
  return stripNullish({
    color,
    opacity: clamp(readNumber(value ?? {}, "opacity") ?? 1, 0, 1),
    width: clamp(round(readNumber(value ?? {}, "width") ?? 1), 0, 8),
    dash: readArray(value ?? {}, "dash")
      .map((item) => readRawNumber(item))
      .filter((item): item is number => item != null && item >= 0),
  });
}

function hasVisiblePaint(
  fill: Fill | null,
  stroke: Stroke | null,
  opacity?: number | null,
) {
  if ((opacity ?? 1) <= 0) return false;
  if (fill && (fill.opacity ?? 1) > 0) return true;
  return Boolean(stroke && stroke.width > 0 && (stroke.opacity ?? 1) > 0);
}

function adaptBorderRadius(value: UnknownRecord | null): BorderRadius | null {
  if (!value) return null;
  return {
    tl: clamp(round(readNumber(value, "tl") ?? 0), 0, MAX_BORDER_RADIUS),
    tr: clamp(round(readNumber(value, "tr") ?? 0), 0, MAX_BORDER_RADIUS),
    bl: clamp(round(readNumber(value, "bl") ?? 0), 0, MAX_BORDER_RADIUS),
    br: clamp(round(readNumber(value, "br") ?? 0), 0, MAX_BORDER_RADIUS),
  };
}

function adaptPadding(value: UnknownRecord | null): Padding | null {
  if (!value) return null;
  return {
    top: Math.max(0, round(readNumber(value, "top") ?? 0)),
    right: Math.max(0, round(readNumber(value, "right") ?? 0)),
    bottom: Math.max(0, round(readNumber(value, "bottom") ?? 0)),
    left: Math.max(0, round(readNumber(value, "left") ?? 0)),
  };
}

function adaptShadow(value: UnknownRecord | null): Shadow | null {
  if (!value) return null;
  return stripNullish({
    color: readColor(value.color),
    blur: clamp(round(readNumber(value, "blur") ?? 0), 0, 100),
    opacity: clamp(readNumber(value, "opacity") ?? 0.2, 0, 1),
    offset_x: clamp(round(readNumber(value, "offset_x") ?? 0), -256, 256),
    offset_y: clamp(round(readNumber(value, "offset_y") ?? 0), -256, 256),
  });
}

function textRun(text: string, font?: Font | null): TextRun {
  return stripNullish({ text, font }) as TextRun;
}

function adaptTextRun(item: unknown): TextRun | null {
  const record = asRecord(item);
  if (!record) return null;
  if (readString(record.type) === "latex") {
    const latex = truncateString(readString(record.latex) ?? "", 4000);
    if (!latex) return null;
    return stripNullish({
      type: "latex",
      latex,
      display_mode: readBoolean(record, "display_mode") ?? false,
      font: adaptFont(readRecord(record, "font")),
    }) as TextRun;
  }
  const text = truncateString(readString(record.text) ?? "", 700);
  if (!text) return null;
  return textRun(text, adaptFont(readRecord(record, "font")));
}

function adaptTextRuns(value: unknown[], fallbackText?: string | null): TextRun[] {
  const runs = value
    .map(adaptTextRun)
    .filter((item): item is TextRun => Boolean(item))
    .slice(0, 24);

  if (runs.length > 0) return runs;
  return [{ text: truncateString(fallbackText || "Text", 700) }];
}

function adaptTextListItems(value: unknown[]): TextListItem[] {
  const items = value
    .map((item) => {
      let runs: TextRun[] = [];
      if (Array.isArray(item)) {
        runs = item
          .map(adaptTextRun)
          .filter((run): run is TextRun => Boolean(run));
      } else {
        const record = asRecord(item);
        const text = truncateString(
          readString(record?.text) ?? readString(item) ?? "",
          180,
        );
        runs = text ? [textRun(text)] : [];
      }
      if (runs.length === 0) return null;
      return renderMarkdownTextRuns(runs).slice(0, 12);
    })
    .filter((item): item is TextRun[] => Boolean(item?.length))
    .slice(0, 8);

  return items.length > 0 ? items : [[textRun("List item")]];
}

function adaptTableCells(value: unknown[]): TableCell[] {
  const cells = value
    .map((item) => {
      if (typeof item === "string" || typeof item === "number") {
        return { runs: [textRun(truncateString(String(item), 80))] } satisfies TableCell;
      }
      const record = asRecord(item);
      if (!record) return null;
      const rawRuns = readArray(record, "runs");
      const runText = rawRuns
        .map((run) => readString(asRecord(run)?.text) ?? "")
        .join("");
      const firstRun = asRecord(rawRuns[0]) ?? {};
      const textValue = record.text;
      const textRecord = asRecord(textValue);
      const text = truncateString(
        runText ||
        (textRecord
          ? readString(textRecord.text) ?? ""
          : readString(textValue) ?? ""),
        80,
      );
      const runs =
        rawRuns.map(adaptTextRun).filter((run): run is TextRun => Boolean(run))
          .length > 0
          ? rawRuns
            .map(adaptTextRun)
            .filter((run): run is TextRun => Boolean(run))
          : text
            ? [textRun(text)]
            : [];
      return stripNullish({
        color:
          adaptFill(readRecord(record, "color")) ??
          adaptFill(readRecord(record, "fill")),
        font:
          adaptFont(readRecord(record, "font")) ??
          adaptFont(readRecord(firstRun, "font")) ??
          adaptFont(readRecord(textRecord ?? {}, "font")),
        alignment: readEnum(
          record,
          ["left", "center", "right", "justify"],
          "alignment",
        ),
        runs,
      }) as TableCell;
    })
    .filter((item): item is TableCell => Boolean(item));

  return cells.length > 0 ? cells : [{ runs: [] }];
}

function adaptChartCategories(value: unknown[]): string[] {
  return value
    .map((item, index) =>
      truncateString(readString(item) ?? readString(asRecord(item)?.label) ?? "", 40) ||
      `Item ${index + 1}`,
    )
    .filter(Boolean)
    .slice(0, 24);
}

function adaptChartSeries(value: unknown): ChartSeries | null {
  const record = asRecord(value);
  if (!record) return null;
  const values = readArray(record, "values")
    .map(readRawNumber)
    .filter((item): item is number => item != null)
    .map((item) => clamp(item, -1_000_000, 1_000_000))
    .slice(0, 24);
  if (values.length === 0) return null;
  return {
    name: truncateString(readString(record.name) ?? "Series", 80) || "Series",
    values,
  };
}

function invisibleFallbackElement(): SlideElement {
  return {
    type: "vector",
    points: [
      { x: 0, y: 0 },
      { x: MIN_ELEMENT_SIZE, y: 0 },
      { x: MIN_ELEMENT_SIZE, y: MIN_ELEMENT_SIZE },
      { x: 0, y: MIN_ELEMENT_SIZE },
    ],
    closed: true,
    fill: { color: "FFFFFF" },
    opacity: 0,
  };
}

function backgroundFromElements(elements: SlideElement[]) {
  const background = findBackgroundShape(elements, 0, 0);

  return background && "fill" in background && background.fill?.color
    ? background.fill.color
    : "FFFFFF";
}

function findBackgroundShape(
  elements: SlideElement[],
  offsetX: number,
  offsetY: number,
): SlideElement | null {
  for (const element of elements) {
    const bounds = adaptedElementBounds(element);
    const x = offsetX + bounds.x;
    const y = offsetY + bounds.y;
    if (isFullSlideFilledShape(element, x, y, bounds)) {
      return element;
    }

    if (
      element.type === "group" ||
      element.type === "flex" ||
      element.type === "grid"
    ) {
      const background = findBackgroundShape(element.children, x, y);
      if (background) return background;
    }

    if (element.type === "container" && element.child) {
      const background = findBackgroundShape([element.child], x, y);
      if (background) return background;
    }
  }

  return null;
}

function isFullSlideFilledShape(
  element: SlideElement,
  x: number,
  y: number,
  bounds: { width: number; height: number },
) {
  if (
    element.type !== "vector"
  ) return false;
  return (
    x === 0 &&
    y === 0 &&
    bounds.width === EDITOR_STAGE_WIDTH &&
    bounds.height === EDITOR_STAGE_HEIGHT &&
    Boolean(element.fill?.color)
  );
}

function titleFromLayout(layout: TemplateV2Layout, index: number) {
  const id = readString(layout.id);
  const slideNumber = id?.match(/\d+/)?.[0] ?? `${index + 1}`;
  return truncateString(`Slide ${slideNumber}`, 60);
}

function readValue(record: UnknownRecord, key: string) {
  return record[key];
}

function readRecord(
  record: UnknownRecord | null | undefined,
  key: string,
) {
  return asRecord(record ? readValue(record, key) : null);
}

function readArray(record: UnknownRecord, key: string) {
  const value = readValue(record, key);
  return Array.isArray(value) ? value : [];
}

function readNumber(record: UnknownRecord, key: string) {
  return readRawNumber(readValue(record, key));
}

function readRawNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function readBoolean(record: UnknownRecord, key: string) {
  const value = readValue(record, key);
  return typeof value === "boolean" ? value : null;
}

function readDataLabelPosition(
  record: UnknownRecord,
  key: string,
): DataLabelPosition | null {
  const value = readValue(record, key);
  if (value === true) return "top";
  if (value === false || value == null) return null;
  const text = readString(value);
  return text && DATA_LABEL_POSITIONS.has(text)
    ? (text as DataLabelPosition)
    : null;
}

function readDecorative(record: UnknownRecord): boolean | null {
  return readBoolean(record, "decorative");
}

function readEnum<const T extends readonly string[]>(
  record: UnknownRecord,
  values: T,
  key: string,
): T[number] | null {
  const value = readString(readValue(record, key));
  return value && (values as readonly string[]).includes(value)
    ? (value as T[number])
    : null;
}

function readLayoutAlignment(
  record: UnknownRecord,
  key: string,
): LayoutAlignment | null {
  const value = readString(readValue(record, key));
  return value && LAYOUT_ALIGNMENT_VALUES.has(value)
    ? (value as LayoutAlignment)
    : null;
}

function readString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function readColor(value: unknown): string | null {
  const color = readString(value)?.trim();
  if (!color) return null;
  return /^#?[0-9A-Fa-f]{6}$/.test(color) ? color : null;
}

function asRecord(value: unknown): UnknownRecord | null {
  return isRecord(value) ? value : null;
}

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stripNullish<T extends UnknownRecord>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(
      ([, item]) =>
        item !== null &&
        item !== undefined &&
        (!Array.isArray(item) || item.length > 0),
    ),
  ) as T;
}

function positiveInteger(value: number | null, fallback: number) {
  return Math.max(1, Math.trunc(value ?? fallback));
}

function positiveIntegerOrNull(value: number | null) {
  return value == null ? null : positiveInteger(value, 1);
}

function clampInteger(value: number | null, min: number, max: number) {
  return value == null ? null : Math.trunc(clamp(value, min, max));
}

function clampOptional(value: number | null, min: number, max: number) {
  return value == null ? null : clamp(value, min, max);
}

function truncateString(value: string, maxLength: number) {
  return value.length > maxLength ? value.slice(0, maxLength) : value;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function round(value: number) {
  return Math.round(value * 10000) / 10000;
}
