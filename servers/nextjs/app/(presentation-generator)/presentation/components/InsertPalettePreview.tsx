"use client";

import { useMemo } from "react";
import {
  createChartInsertElements,
  createElementInsertElements,
  createImageInsertContent,
  createInfographicInsertElements,
  createTableInsertElements,
  createTextInsertElements,
  type EditorInsertContent,
} from "@/components/slide-editor/insert/insert-elements";
import {
  TEMPLATE_V2_HTML_HEIGHT,
  TEMPLATE_V2_HTML_WIDTH,
} from "@/lib/template-v2-json-to-html";
import type { TemplateTheme } from "@/lib/template-theme";
import { TemplateV2HtmlSlidePreview } from "../../components/TemplateV2HtmlSlidePreview";

export type InsertPalettePreviewKind =
  | "text"
  | "chart"
  | "infographic"
  | "table"
  | "image"
  | "element";

type PreviewElement = NonNullable<EditorInsertContent["elements"]>[number];
type Bounds = { left: number; top: number; right: number; bottom: number };

const PREVIEW_FIT: Record<
  InsertPalettePreviewKind,
  { maxScale: number; padding: { x: number; y: number } }
> = {
  text: { maxScale: 0.82, padding: { x: 0.12, y: 0.18 } },
  chart: { maxScale: 0.55, padding: { x: 0.07, y: 0.09 } },
  infographic: { maxScale: 0.55, padding: { x: 0.06, y: 0.07 } },
  table: { maxScale: 0.55, padding: { x: 0.05, y: 0.1 } },
  image: { maxScale: 0.6, padding: { x: 0.07, y: 0.08 } },
  element: { maxScale: 0.62, padding: { x: 0.18, y: 0.14 } },
};

function createPreviewContent(
  kind: InsertPalettePreviewKind,
  itemId: string | undefined,
  theme: TemplateTheme,
): EditorInsertContent {
  switch (kind) {
    case "text":
      return { elements: createTextInsertElements(itemId, theme) };
    case "chart":
      return { elements: createChartInsertElements(itemId, theme) };
    case "infographic":
      return { elements: createInfographicInsertElements(itemId, theme) };
    case "table":
      return { elements: createTableInsertElements(itemId, theme) };
    case "image":
      return createImageInsertContent(itemId, theme);
    case "element":
      return { elements: createElementInsertElements(itemId, theme) };
  }
}

function getElementBounds(element: PreviewElement): Bounds | null {
  if (element.type === "vector" && element.points.length > 0) {
    const inset = (element.stroke?.width ?? 0) / 2;
    const x = element.points.map((point) => point.x);
    const y = element.points.map((point) => point.y);
    return {
      left: Math.min(...x) - inset,
      top: Math.min(...y) - inset,
      right: Math.max(...x) + inset,
      bottom: Math.max(...y) + inset,
    };
  }
  if (!element.position || !element.size) return null;
  return {
    left: element.position.x,
    top: element.position.y,
    right: element.position.x + element.size.width,
    bottom: element.position.y + element.size.height,
  };
}

function textRunValue(run: unknown) {
  if (!run || typeof run !== "object") return "";
  const text = (run as { text?: unknown }).text;
  return typeof text === "string" ? text : "";
}

function getVisibleTextBounds(element: PreviewElement): Bounds | null {
  const bounds = getElementBounds(element);
  if (!bounds || !element.position || !element.size) return bounds;
  if (element.type !== "text" && element.type !== "text-list") return bounds;

  const fontSize = Math.max(element.font?.size ?? 18, 1);
  const lineHeight = Math.max(element.font?.line_height ?? 1.2, 0.8);
  const strings =
    element.type === "text"
      ? [element.runs.map(textRunValue).join("")]
      : element.items.map((item) => item.map(textRunValue).join(""));
  if (!strings.some((value) => value.trim())) return bounds;

  const longestLine = Math.max(
    ...strings.flatMap((value) => value.split("\n")).map((line) => line.length),
    1,
  );
  const visibleWidth = Math.min(
    element.size.width,
    Math.max(
      element.type === "text-list" ? 360 : 260,
      Math.min(620, (longestLine + (element.type === "text-list" ? 4 : 0)) * fontSize * 0.62 + 32),
    ),
  );
  const charsPerLine = Math.max(
    1,
    Math.floor((visibleWidth - 32) / (fontSize * 0.62)),
  );
  const wrappedLines = Math.max(
    strings.reduce(
      (total, value) =>
        total +
        value
          .split("\n")
          .reduce((sum, line) => sum + Math.max(1, Math.ceil(line.length / charsPerLine)), 0),
      0,
    ),
    1,
  );
  const visibleHeight = Math.max(
    fontSize * lineHeight + 16,
    wrappedLines * fontSize * lineHeight + 20,
  );
  const alignment = element.type === "text" ? element.alignment?.horizontal : "left";
  const left =
    alignment === "center"
      ? element.position.x + (element.size.width - visibleWidth) / 2
      : alignment === "right"
        ? element.position.x + element.size.width - visibleWidth
        : element.position.x;

  return { left, top: bounds.top, right: left + visibleWidth, bottom: bounds.top + visibleHeight };
}

function compactTextElements(elements: PreviewElement[]) {
  return elements.map((element) => {
    const bounds = getVisibleTextBounds(element);
    if (
      !bounds ||
      !element.position ||
      !element.size ||
      (element.type !== "text" && element.type !== "text-list")
    ) {
      return element;
    }
    return {
      ...element,
      position: { x: bounds.left, y: element.position.y },
      size: {
        ...element.size,
        width: bounds.right - bounds.left,
        height: bounds.bottom - bounds.top,
      },
    };
  });
}

function clarifyVectors(elements: PreviewElement[], theme: TemplateTheme) {
  return elements.map((element) =>
    element.type === "vector" && element.closed === false && element.stroke
      ? {
          ...element,
          stroke: {
            ...element.stroke,
            color: theme.background_text,
            width: Math.max(element.stroke.width ?? 0, 5),
          },
        }
      : element,
  );
}

function centerElements(elements: PreviewElement[]) {
  const bounds = elements
    .map(getElementBounds)
    .filter((value): value is Bounds => Boolean(value));
  if (!bounds.length) return elements;

  const left = Math.min(...bounds.map((bound) => bound.left));
  const top = Math.min(...bounds.map((bound) => bound.top));
  const right = Math.max(...bounds.map((bound) => bound.right));
  const bottom = Math.max(...bounds.map((bound) => bound.bottom));
  const offsetX = (TEMPLATE_V2_HTML_WIDTH - (right - left)) / 2 - left;
  const offsetY = (TEMPLATE_V2_HTML_HEIGHT - (bottom - top)) / 2 - top;

  return elements.map((element) =>
    element.type === "vector"
      ? {
          ...element,
          points: element.points.map((point) => ({ x: point.x + offsetX, y: point.y + offsetY })),
        }
      : element.position
        ? {
            ...element,
            position: { x: element.position.x + offsetX, y: element.position.y + offsetY },
          }
        : element,
  );
}

function centerComponents(components: EditorInsertContent["components"]) {
  const values = components ?? [];
  const bounds = values.flatMap((component) =>
    component.elements.flatMap((element) => {
      const bound = getElementBounds(element);
      return bound
        ? [{
            left: component.position.x + bound.left,
            top: component.position.y + bound.top,
            right: component.position.x + bound.right,
            bottom: component.position.y + bound.bottom,
          }]
        : [];
    }),
  );
  if (!bounds.length) return values;

  const left = Math.min(...bounds.map((bound) => bound.left));
  const top = Math.min(...bounds.map((bound) => bound.top));
  const right = Math.max(...bounds.map((bound) => bound.right));
  const bottom = Math.max(...bounds.map((bound) => bound.bottom));
  const offsetX = (TEMPLATE_V2_HTML_WIDTH - (right - left)) / 2 - left;
  const offsetY = (TEMPLATE_V2_HTML_HEIGHT - (bottom - top)) / 2 - top;
  return values.map((component) => ({
    ...component,
    position: { x: component.position.x + offsetX, y: component.position.y + offsetY },
  }));
}

function getPreviewBounds(
  kind: InsertPalettePreviewKind,
  elements: PreviewElement[],
  components: EditorInsertContent["components"],
): Bounds | undefined {
  const bounds = [
    ...elements
      .map((element) => (kind === "text" ? getVisibleTextBounds(element) : getElementBounds(element)))
      .filter((value): value is Bounds => Boolean(value)),
    ...(components ?? []).flatMap((component) =>
      component.elements.flatMap((element) => {
        const bound = getElementBounds(element);
        return bound
          ? [{
              left: component.position.x + bound.left,
              top: component.position.y + bound.top,
              right: component.position.x + bound.right,
              bottom: component.position.y + bound.bottom,
            }]
          : [];
      }),
    ),
  ];
  if (!bounds.length) return undefined;
  return {
    left: Math.min(...bounds.map((bound) => bound.left)),
    top: Math.min(...bounds.map((bound) => bound.top)),
    right: Math.max(...bounds.map((bound) => bound.right)),
    bottom: Math.max(...bounds.map((bound) => bound.bottom)),
  };
}

function createPreviewSlide(
  kind: InsertPalettePreviewKind,
  itemId: string | undefined,
  theme: TemplateTheme,
) {
  const content = createPreviewContent(kind, itemId, theme);
  const sourceElements =
    kind === "text"
      ? compactTextElements(content.elements ?? [])
      : kind === "element"
        ? clarifyVectors(content.elements ?? [], theme)
        : content.elements ?? [];
  const elements = centerElements(sourceElements);
  const components = centerComponents(content.components);
  return {
    bounds: getPreviewBounds(kind, elements, components),
    slide: {
      ui: {
        id: `insert-preview-${kind}-${itemId ?? "default"}`,
        background: theme.background,
        elements,
        components,
      },
    },
  };
}

export function InsertPalettePreview({
  itemId,
  kind,
  theme,
}: {
  itemId?: string;
  kind: InsertPalettePreviewKind;
  theme: TemplateTheme;
}) {
  const preview = useMemo(
    () => createPreviewSlide(kind, itemId, theme),
    [itemId, kind, theme],
  );
  const fit = PREVIEW_FIT[kind];
  return (
    <TemplateV2HtmlSlidePreview
      slide={preview.slide}
      fonts={theme.fonts}
      fitBounds={preview.bounds}
      fitPadding={fit.padding}
      fitMaxScale={fit.maxScale}
      className="h-full rounded-[inherit]"
      contentClassName="rounded-[inherit]"
    />
  );
}
