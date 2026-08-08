/* eslint-disable @next/next/no-img-element */
import React from "react";
import {
  type TemplateV2Layout as EditorTemplateV2Layout,
  withEqualTemplateV2FlowChildSizes,
} from "@/components/slide-editor/importing/template-v2-import";
import {
  EDITOR_STAGE_HEIGHT,
  EDITOR_STAGE_WIDTH,
} from "@/components/slide-editor/types";
import { resolveBackendAssetUrl } from "@/utils/api";
import { TemplateV2KonvaSlide } from "@/components/slide-editor/surface/TemplateV2KonvaSlide";
import {
  TemplateV2Component,
  TemplateV2Element,
  TemplateV2Layout,
  TemplateV2TextRun,
} from "../../types";

type RenderMode = "absolute" | "flow";
type Box = {
  x: number;
  y: number;
  width?: number;
  height?: number;
};

function hashKey(value: string) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(36);
}

function layoutElementKey(element: TemplateV2Element) {
  const record = element as Record<string, unknown>;
  const explicitKey =
    readString(record.name) ??
    readString(record.component_instance_id) ??
    readString(record.component_instance_id) ??
    readString(record.component_id) ??
    readString(record.component_id) ??
    readString(record.component_slot) ??
    readString(record.component_slot);
  return explicitKey ?? `${readString(record.type) ?? "element"}-${hashKey(JSON.stringify(element))}`;
}

function tableCellKey(cell: unknown) {
  return hashKey(JSON.stringify(cell));
}

function tableRowKey(row: unknown) {
  return hashKey(JSON.stringify(row));
}

interface TemplateV2LayoutPreviewProps {
  layout: TemplateV2Layout;
  slideDisplayRef?: React.RefObject<HTMLDivElement | null>;
  useKonvaRenderer?: boolean;
  fonts?: Record<string, string>;
}

const previewStageStyle: React.CSSProperties = {
  width: EDITOR_STAGE_WIDTH,
  height: EDITOR_STAGE_HEIGHT,
};

export const TemplateV2LayoutPreview: React.FC<TemplateV2LayoutPreviewProps> = ({
  layout,
  slideDisplayRef,
  useKonvaRenderer = true,
  fonts,
}) => {
  if (useKonvaRenderer) {
    return (
      <div
        ref={slideDisplayRef}
        className="relative mx-auto select-none overflow-hidden bg-white"
        style={previewStageStyle}
      >
        <TemplateV2KonvaSlide
          layout={layout as EditorTemplateV2Layout}
          isEditMode={false}
          slideId={null}
          slideIndex={0}
          fonts={fonts}
        />
      </div>
    );
  }

  const elements = getLayoutElements(layout);

  return (
    <div
      ref={slideDisplayRef}
      className="relative mx-auto overflow-hidden bg-white"
      style={previewStageStyle}
    >
      {elements.map((element) =>
        renderElement(element, `layout-element-${layoutElementKey(element)}`, "absolute")
      )}
    </div>
  );
};

function getLayoutElements(layout: TemplateV2Layout): TemplateV2Element[] {
  if (Array.isArray(layout.elements) && layout.elements.length > 0) {
    return layout.elements;
  }

  return (layout.components ?? [])
    .map(componentToGroup)
    .filter((element): element is TemplateV2Element => Boolean(element));
}

function componentToGroup(component: TemplateV2Component): TemplateV2Element | null {
  const children = Array.isArray(component.elements) ? component.elements : [];
  if (children.length === 0) return null;

  return {
    ...component,
    type: "group",
    children,
  };
}

function renderElement(
  element: TemplateV2Element | null | undefined,
  key: string,
  mode: RenderMode
): React.ReactNode {
  if (!element || typeof element !== "object") return null;

  switch (element.type) {
    case "vector":
      return renderPolygon(element, key, mode);
    case "image":
      return renderImage(element, key, mode);
    case "text":
      return renderText(element, key, mode);
    case "text-list":
      return renderTextList(element, key, mode);
    case "table":
      return renderTable(element, key, mode);
    case "container":
      return renderContainer(element, key, mode);
    case "flex":
      return renderFlex(element, key, mode);
    case "grid":
      return renderGrid(element, key, mode);
    case "group":
      return renderGroup(element, key, mode);
    default:
      if (Array.isArray(element.children)) {
        return renderGroup(element, key, mode);
      }
      if (element.child) {
        return renderContainer(element, key, mode);
      }
      return null;
  }
}

function renderPolygon(
  element: TemplateV2Element,
  key: string,
  mode: RenderMode
) {
  if (vectorShape(element) === "ellipse") {
    return renderEllipseVector(element, key, mode);
  }

  const points = polygonPoints(element);
  if (points.length < 2) return null;

  const box = polygonBox(element, points);
  const closed = polygonClosed(element, points);
  const fill = readRecord(element.fill);
  const stroke = readRecord(element.stroke);
  const fillColor = closed ? readString(fill.color) : null;
  const strokeColor = readString(stroke.color) ?? (!closed ? "#000000" : null);
  const strokeWidth = Math.max(0, readNumber(stroke.width) ?? 1);
  if (!fillColor && !(strokeColor && strokeWidth > 0)) return null;

  const pointString = points
    .map((point) => `${point.x - box.x},${point.y - box.y}`)
    .join(" ");
  const ShapeTag = closed ? "polygon" : "polyline";
  return (
    <div
      key={key}
      style={{
        ...frameStyleFromBox(box, mode),
        overflow: "visible",
        transform: transformStyle(element),
      }}
    >
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${box.width ?? 1} ${box.height ?? 1}`}
        preserveAspectRatio="none"
        style={{ display: "block", overflow: "visible" }}
      >
        <ShapeTag
          points={pointString}
          fill={closed ? fillColor ?? "none" : "none"}
          stroke={strokeColor ?? undefined}
          strokeWidth={strokeColor ? strokeWidth : undefined}
        />
      </svg>
    </div>
  );
}

function renderEllipseVector(
  element: TemplateV2Element,
  key: string,
  mode: RenderMode
) {
  const points = polygonSourcePoints(element);
  if (points.length < 2) return null;

  const box = polygonBox(element, points);
  const fill = readRecord(element.fill);
  const stroke = readRecord(element.stroke);
  const fillColor = readString(fill.color);
  const strokeColor = readString(stroke.color);
  const strokeWidth = Math.max(0, readNumber(stroke.width) ?? 1);
  if (!fillColor && !(strokeColor && strokeWidth > 0)) return null;

  return (
    <div
      key={key}
      style={{
        ...frameStyleFromBox(box, mode),
        overflow: "visible",
        transform: transformStyle(element),
      }}
    >
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${box.width ?? 1} ${box.height ?? 1}`}
        preserveAspectRatio="none"
        style={{ display: "block", overflow: "visible" }}
      >
        <ellipse
          cx={(box.width ?? 1) / 2}
          cy={(box.height ?? 1) / 2}
          rx={(box.width ?? 1) / 2}
          ry={(box.height ?? 1) / 2}
          fill={fillColor ?? "none"}
          stroke={strokeColor ?? undefined}
          strokeWidth={strokeColor ? strokeWidth : undefined}
        />
      </svg>
    </div>
  );
}

function renderImage(element: TemplateV2Element, key: string, mode: RenderMode) {
  const src = typeof element.data === "string" ? element.data.trim() : "";
  if (!src) return null;
  const color = readString(element.color);
  const resolvedSrc = resolveBackendAssetUrl(src);
  const borderRadius = borderRadiusPx(readRecord(element.border_radius));
  const fit = imageFit(element.fit);
  const objectPosition = imageObjectPosition(element);
  const clipPath = imageClipPath(element);
  const flipH = readBoolean(element.flip_h);
  const flipV = readBoolean(element.flip_v);
  const cropScale = imageCropScale(element);
  const frameTransform = imageFlipTransform(flipH, flipV);
  const cropTransform = imageCropTransform(cropScale);
  const cropTransformOrigin = cropScale > 1 ? objectPosition ?? "center" : undefined;
  const imageTransform = clipPath
    ? cropTransform
    : imageTransformValue(frameTransform, cropTransform);
  const imageTransformOrigin = clipPath
    ? cropTransformOrigin
    : cropTransformOrigin ?? (frameTransform ? "center" : undefined);

  return (
    <div
      key={key}
      style={{
        ...frameStyle(element, mode),
        borderRadius,
        overflow: "hidden",
        clipPath,
        transform: clipPath ? frameTransform : undefined,
        transformOrigin: clipPath && frameTransform ? "center" : undefined,
        WebkitClipPath: clipPath,
      }}
    >
      <img
        alt=""
        draggable={false}
        src={resolvedSrc}
        style={{
          display: "block",
          height: "100%",
          objectFit: fit,
          objectPosition,
          transform: imageTransform,
          transformOrigin: imageTransformOrigin,
          width: "100%",
        }}
      />
      {color ? (
        <div
          aria-hidden="true"
          style={{
            backgroundColor: color,
            clipPath,
            inset: 0,
            maskImage: `url(${resolvedSrc})`,
            maskPosition: objectPosition ?? "center",
            maskRepeat: "no-repeat",
            maskSize: fit === "fill" ? "100% 100%" : fit,
            pointerEvents: "none",
            position: "absolute",
            transform: imageTransform,
            transformOrigin: imageTransformOrigin,
            WebkitMaskImage: `url(${resolvedSrc})`,
            WebkitMaskPosition: objectPosition ?? "center",
            WebkitMaskRepeat: "no-repeat",
            WebkitMaskSize: fit === "fill" ? "100% 100%" : fit,
          }}
        />
      ) : null}
    </div>
  );
}

function renderText(element: TemplateV2Element, key: string, mode: RenderMode) {
  const runs = readTextRuns(element);
  const alignment = readRecord(element.alignment);
  const horizontal = readString(alignment.horizontal);
  const vertical = readString(alignment.vertical);

  return (
    <div
      key={key}
      style={{
        ...frameStyle(element, mode),
        ...fontStyle(element.font),
        alignItems: verticalAlign(vertical),
        display: "flex",
        justifyContent: horizontalAlign(horizontal),
        lineHeight: readLineHeight(element.font) ?? 1.1,
        overflow: "hidden",
        textAlign: textAlign(horizontal),
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
      }}
    >
      <span style={{ width: "100%" }}>
        {runs.map((run) => (
          <span
            key={`${key}-run-${hashKey(JSON.stringify(run))}`}
            style={fontStyle({ ...(element.font ?? {}), ...(run.font ?? {}) })}
          >
            {run.text ?? ""}
          </span>
        ))}
      </span>
    </div>
  );
}

function renderTextList(
  element: TemplateV2Element,
  key: string,
  mode: RenderMode
) {
  const marker = readString(element.marker);
  const items = Array.isArray(element.items) ? element.items : [];
  const ListTag = marker === "number" ? "ol" : "ul";
  const alignment = readRecord(element.alignment);
  const horizontal = readString(alignment.horizontal);
  const vertical = readString(alignment.vertical);

  return (
    <div
      key={key}
      style={{
        ...frameStyle(element, mode),
        ...fontStyle(element.font),
        alignItems: verticalAlign(vertical),
        display: "flex",
        justifyContent: horizontalAlign(horizontal),
        lineHeight: readLineHeight(element.font) ?? 1.1,
        overflow: "hidden",
        textAlign: textAlign(horizontal),
        wordBreak: "break-word",
      }}
    >
      <ListTag
        style={{
          listStyleType: marker === "none" ? "none" : undefined,
          margin: 0,
          paddingLeft: marker === "none" ? 0 : 24,
          width: "100%",
        }}
      >
        {items.map((item, itemIndex) => {
          const itemRuns = readTextListItemRuns(item);
          return (
            <li key={`${key}-list-item-${itemIndex}`} style={{ overflow: "hidden" }}>
              {itemRuns.map((run, runIndex) => (
                <span
                  key={`${key}-list-run-${itemIndex}-${runIndex}`}
                  style={fontStyle({
                    ...(element.font ?? {}),
                    ...(run.font ?? {}),
                  })}
                >
                  {run.text ?? ""}
                </span>
              ))}
            </li>
          );
        })}
      </ListTag>
    </div>
  );
}

function readTextListItemRuns(item: unknown): TemplateV2TextRun[] {
  if (Array.isArray(item)) {
    return item.filter((run): run is TemplateV2TextRun => Boolean(readRecord(run).text));
  }

  const record = readRecord(item);
  const text = readString(record.text) ?? readString(item);
  if (!text) return [];

  return [
    {
      text,
      font: readRecord(record.font) as TemplateV2TextRun["font"],
    },
  ];
}

function renderTable(element: TemplateV2Element, key: string, mode: RenderMode) {
  const columns = Array.isArray(element.columns) ? element.columns : [];
  const rows = Array.isArray(element.rows) ? element.rows : [];

  return (
    <div
      key={key}
      style={{
        ...frameStyle(element, mode),
        overflow: "hidden",
      }}
    >
      <table
        style={{
          borderCollapse: "collapse",
          height: "100%",
          tableLayout: "fixed",
          width: "100%",
        }}
      >
        {columns.length > 0 && (
          <thead>
            <tr>
              {columns.map((cell) => (
                <th key={`${key}-head-${tableCellKey(cell)}`} style={tableCellStyle(cell, true)}>
                  {readCellText(cell)}
                </th>
              ))}
            </tr>
          </thead>
        )}
        <tbody>
          {rows.map((row) => (
            <tr key={`${key}-row-${tableRowKey(row)}`}>
              {(Array.isArray(row) ? row : []).map((cell) => (
                <td
                  key={`${key}-cell-${tableCellKey(cell)}`}
                  style={tableCellStyle(cell, false)}
                >
                  {readCellText(cell)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function renderContainer(
  element: TemplateV2Element,
  key: string,
  mode: RenderMode
) {
  const padding = paddingStyle(readRecord(element.padding));
  const fallbackSize = containerFallbackSize(element);
  const childMode = element.child?.position ? "absolute" : "flow";

  return (
    <div
      key={key}
      style={{
        ...frameStyle(element, mode, fallbackSize),
        ...boxStyle(element),
        ...padding,
        alignItems: verticalAlign(readString(readRecord(element.alignment).vertical)),
        display: "flex",
        justifyContent: horizontalAlign(readString(readRecord(element.alignment).horizontal)),
        overflow: "hidden",
      }}
    >
      {renderElement(element.child, `${key}-child`, childMode)}
    </div>
  );
}

function containerFallbackSize(element: TemplateV2Element) {
  const child = element.child;
  if (!child) return undefined;

  const childFallback = Array.isArray(child.children)
    ? childrenBounds(child.children)
    : undefined;
  const childBox = readBox(child, childFallback);
  const padding = readRecord(element.padding);
  return {
    width:
      childBox.x +
      (childBox.width ?? 1) +
      (readNumber(padding.left) ?? 0) +
      (readNumber(padding.right) ?? 0),
    height:
      childBox.y +
      (childBox.height ?? 1) +
      (readNumber(padding.top) ?? 0) +
      (readNumber(padding.bottom) ?? 0),
  };
}

function renderFlex(element: TemplateV2Element, key: string, mode: RenderMode) {
  const direction = readString(element.direction) === "row" ? "row" : "column";
  const gap = readNumber(element.gap) ?? 0;
  const rowGap = readNumber(element.row_gap ?? element.rowGap) ?? gap;
  const columnGap = readNumber(element.column_gap ?? element.columnGap) ?? gap;
  const wrap = readBoolean(element.wrap);
  const children = withEqualTemplateV2FlowChildSizes(
    element as Record<string, unknown>,
  ) as TemplateV2Element[];

  return (
    <div
      key={key}
      style={{
        ...flexFrameStyle(element, mode, children, direction, wrap, columnGap, rowGap),
        ...boxStyle(element),
        alignItems: cssAlignment(readString(element.align_items), "stretch"),
        columnGap: px(columnGap),
        display: "flex",
        flexDirection: direction,
        flexWrap: wrap ? "wrap" : "nowrap",
        gap: px(gap),
        justifyContent: cssAlignment(readString(element.justify_content), "flex-start"),
        overflow: "visible",
        rowGap: px(rowGap),
      }}
    >
      {children.map((child) =>
        renderElement(child, `${key}-child-${layoutElementKey(child)}`, "flow")
      )}
    </div>
  );
}

function flexFrameStyle(
  element: TemplateV2Element,
  mode: RenderMode,
  children: TemplateV2Element[],
  direction: "row" | "column",
  wrap: boolean,
  columnGap: number,
  rowGap: number
): React.CSSProperties {
  const box = readBox(element);
  const expanded = flexExpandedSize(element, box, children, direction, wrap, columnGap, rowGap);
  const style = frameStyleFromBox(box, mode);
  if (expanded.width != null && (box.width == null || expanded.width > box.width)) {
    style.width = px(expanded.width);
  }
  if (expanded.height != null && (box.height == null || expanded.height > box.height)) {
    style.height = px(expanded.height);
  }
  return style;
}

function flexExpandedSize(
  element: TemplateV2Element,
  box: Box,
  children: TemplateV2Element[],
  direction: "row" | "column",
  wrap: boolean,
  columnGap: number,
  rowGap: number
): { width?: number; height?: number } {
  if (!children.length) return {};

  const padding = readRecord(element.padding);
  const paddingX = (readNumber(padding.left) ?? 0) + (readNumber(padding.right) ?? 0);
  const paddingY = (readNumber(padding.top) ?? 0) + (readNumber(padding.bottom) ?? 0);
  const sizes = children.map(flowChildSize);

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

function flowChildSize(child: TemplateV2Element) {
  const fallback = Array.isArray(child.children)
    ? childrenBounds(child.children)
    : undefined;
  const box = readBox(child, fallback);
  return {
    width: box.width ?? 1,
    height: box.height ?? 1,
  };
}

function renderGrid(element: TemplateV2Element, key: string, mode: RenderMode) {
  const columns = Math.max(1, Math.floor(readNumber(element.columns) ?? 1));
  const gap = readNumber(element.gap) ?? 0;
  const rowGap = readNumber(element.row_gap) ?? gap;
  const columnGap = readNumber(element.column_gap) ?? gap;
  const children = withEqualTemplateV2FlowChildSizes(
    element as Record<string, unknown>,
  ) as TemplateV2Element[];
  const renderedRows = Math.max(1, Math.ceil(children.length / columns));
  const declaredRows = readNumber(element.rows);
  const rows = declaredRows == null ? null : Math.max(1, Math.floor(declaredRows));
  const size = readRecord(element.size);
  const explicitHeight = readNumber(size.height);
  const explicitWidth = readNumber(size.width);

  return (
    <div
      key={key}
      style={{
        ...frameStyle(element, mode),
        ...boxStyle(element),
        alignItems: cssAlignment(readString(element.align_items), "stretch"),
        columnGap: px(columnGap),
        display: "grid",
        gridTemplateColumns: gridColumnTemplate(columns, explicitWidth, columnGap),
        gridTemplateRows: gridRowTemplate(rows, renderedRows, explicitHeight, rowGap),
        justifyItems: cssAlignment(readString(element.justify_items), "stretch"),
        overflow: "visible",
        rowGap: px(rowGap),
      }}
    >
      {children.map((child) =>
        renderElement(child, `${key}-child-${layoutElementKey(child)}`, "flow")
      )}
    </div>
  );
}

function gridColumnTemplate(columns: number, explicitWidth: number | null, columnGap: number) {
  if (explicitWidth == null) return `repeat(${columns}, minmax(0, 1fr))`;
  const columnWidth = Math.max(1, (explicitWidth - columnGap * (columns - 1)) / columns);
  return `repeat(${columns}, ${px(columnWidth)})`;
}

function gridRowTemplate(
  rows: number | null,
  renderedRows: number,
  explicitHeight: number | null,
  rowGap: number
) {
  if (!rows) return undefined;
  if (explicitHeight == null) {
    return `repeat(${Math.max(rows, renderedRows)}, minmax(0, 1fr))`;
  }

  const rowHeight = Math.max(1, (explicitHeight - rowGap * (rows - 1)) / rows);
  return `repeat(${Math.max(rows, renderedRows)}, ${px(rowHeight)})`;
}

function renderGroup(element: TemplateV2Element, key: string, mode: RenderMode) {
  const children: TemplateV2Element[] = Array.isArray(element.children)
    ? element.children
    : [];
  return (
    <div
      key={key}
      style={{
        ...frameStyle(element, mode, childrenBounds(children)),
        ...boxStyle(element),
        overflow: "visible",
      }}
    >
      {children.map((child) =>
        renderElement(child, `${key}-child-${layoutElementKey(child)}`, "absolute")
      )}
    </div>
  );
}

function frameStyle(
  element: TemplateV2Element,
  mode: RenderMode,
  fallbackSize?: { width: number; height: number }
): React.CSSProperties {
  const box = readBox(element, fallbackSize);
  return frameStyleFromBox(box, mode);
}

function frameStyleFromBox(box: Box, mode: RenderMode): React.CSSProperties {
  const style: React.CSSProperties = {
    boxSizing: "border-box",
    minHeight: 0,
    minWidth: 0,
    position: mode === "absolute" ? "absolute" : "relative",
  };
  if (mode === "flow") style.flexShrink = 0;

  if (mode === "absolute") {
    style.left = px(box.x);
    style.top = px(box.y);
  }

  if (box.width != null) style.width = px(box.width);
  if (box.height != null) style.height = px(box.height);

  return style;
}

function readBox(
  element: TemplateV2Element,
  fallbackSize?: { width: number; height: number }
): Box {
  const position = readRecord(element.position);
  const size = readRecord(element.size);
  if (element.type === "vector") {
    return polygonBox(
      element,
      vectorShape(element) === "ellipse"
        ? polygonSourcePoints(element)
        : polygonPoints(element)
    );
  }
  return {
    x: readNumber(position.x) ?? 0,
    y: readNumber(position.y) ?? 0,
    width: readNumber(size.width) ?? fallbackSize?.width,
    height: readNumber(size.height) ?? fallbackSize?.height,
  };
}

function childrenBounds(children: TemplateV2Element[]): { width: number; height: number } {
  if (!children.length) return { width: 1, height: 1 };

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

type PreviewPoint = { x: number; y: number };

function polygonSourcePoints(element: TemplateV2Element): PreviewPoint[] {
  return readPointArray(element.points);
}

function vectorShape(element: TemplateV2Element): "polygon" | "ellipse" {
  return element.shape === "ellipse" ? "ellipse" : "polygon";
}

function polygonPoints(element: TemplateV2Element): PreviewPoint[] {
  const points = polygonSourcePoints(element);
  if (vectorShape(element) === "ellipse") return points;
  const closed = polygonClosed(element, points);
  const rounded = closed
    ? roundedPolygonPoints(points, cornerRadii(element, points.length))
    : points;
  const curve = readRecord(element.curve);
  const rawType = readString(curve.type)?.trim().toLowerCase();
  const segments = Math.max(1, Math.min(96, Math.round(readNumber(curve.segments) ?? 16)));
  if (rawType === "smooth") {
    return sampleSmoothCurve(
      rounded,
      closed,
      Math.max(
        0,
        Math.min(
          1,
          readNumber(curve.tension) ?? 0.4,
        ),
      ),
      segments,
    );
  }
  return rounded;
}

function readPointArray(value: unknown): PreviewPoint[] {
  return Array.isArray(value)
    ? value
        .map((point) => {
          const record = readRecord(point);
          const x = readNumber(record.x);
          const y = readNumber(record.y);
          return x != null && y != null ? { x, y } : null;
        })
        .filter((point): point is PreviewPoint => point != null)
    : [];
}

function cornerRadii(element: TemplateV2Element, pointCount: number): number[] {
  const value = element.corner_radii ?? element.cornerRadii;
  return Array.isArray(value)
    ? value
        .map(readNumber)
        .filter((item): item is number => item != null)
        .slice(0, pointCount)
        .map((item) => Math.max(0, item))
    : [];
}

function pointAt(points: PreviewPoint[], index: number) {
  return points[((index % points.length) + points.length) % points.length];
}

function lerpPoint(start: PreviewPoint, end: PreviewPoint, t: number): PreviewPoint {
  return {
    x: start.x + (end.x - start.x) * t,
    y: start.y + (end.y - start.y) * t,
  };
}

function roundedPolygonPoints(points: PreviewPoint[], radii: number[], segments = 8) {
  if (points.length < 3 || radii.length === 0) return points;
  const rounded: PreviewPoint[] = [];
  points.forEach((point, index) => {
    const previous = pointAt(points, index - 1);
    const next = pointAt(points, index + 1);
    const prevDistance = Math.hypot(point.x - previous.x, point.y - previous.y);
    const nextDistance = Math.hypot(point.x - next.x, point.y - next.y);
    const radius = Math.min(radii[index] ?? 0, prevDistance / 2, nextDistance / 2);
    if (radius <= 0) {
      rounded.push(point);
      return;
    }
    const from = lerpPoint(point, previous, radius / prevDistance);
    const to = lerpPoint(point, next, radius / nextDistance);
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

function hermitePoint(
  start: PreviewPoint,
  end: PreviewPoint,
  startTangent: PreviewPoint,
  endTangent: PreviewPoint,
  t: number,
): PreviewPoint {
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

function sampleSmoothCurve(
  points: PreviewPoint[],
  closed: boolean,
  tension: number,
  segments: number,
) {
  if (points.length < 3 || tension <= 0) return points;
  const sampled: PreviewPoint[] = [];
  const segmentCount = closed ? points.length : points.length - 1;
  for (let index = 0; index < segmentCount; index += 1) {
    const p0 = closed ? pointAt(points, index - 1) : points[Math.max(0, index - 1)];
    const p1 = pointAt(points, index);
    const p2 = pointAt(points, index + 1);
    const p3 = closed ? pointAt(points, index + 2) : points[Math.min(points.length - 1, index + 2)];
    const tangentScale = tension * 0.5;
    const startTangent = {
      x: (p2.x - p0.x) * tangentScale,
      y: (p2.y - p0.y) * tangentScale,
    };
    const endTangent = {
      x: (p3.x - p1.x) * tangentScale,
      y: (p3.y - p1.y) * tangentScale,
    };
    if (index === 0) sampled.push(p1);
    for (let step = 1; step <= segments; step += 1) {
      sampled.push({
        ...hermitePoint(p1, p2, startTangent, endTangent, step / segments),
      });
    }
  }
  return sampled;
}

function polygonClosed(
  element: TemplateV2Element,
  points: Array<{ x: number; y: number }>
) {
  if (vectorShape(element) === "ellipse") return true;
  if (element.closed === false || element.closed === "false" || element.closed === "0") {
    return false;
  }
  if (element.closed === true || element.closed === "true" || element.closed === "1") {
    return true;
  }
  return points.length > 2;
}

function polygonBox(
  element: TemplateV2Element,
  points: Array<{ x: number; y: number }>
): Box {
  if (!points.length) return { x: 0, y: 0, width: 1, height: 1 };
  const minX = Math.min(...points.map((point) => point.x));
  const minY = Math.min(...points.map((point) => point.y));
  const maxX = Math.max(...points.map((point) => point.x));
  const maxY = Math.max(...points.map((point) => point.y));
  const stroke = readRecord(element.stroke);
  const strokeWidth = Math.max(1, readNumber(stroke.width) ?? 1);
  return {
    x: minX,
    y: minY,
    width: Math.max(maxX - minX, strokeWidth, 1),
    height: Math.max(maxY - minY, strokeWidth, 1),
  };
}

function transformStyle(element: TemplateV2Element) {
  const rotation = readNumber(element.rotation);
  return rotation ? `rotate(${rotation}deg)` : undefined;
}

function boxStyle(element: TemplateV2Element): React.CSSProperties {
  const fill = readRecord(element.fill);
  const stroke = readRecord(element.stroke);
  const shadow = readRecord(element.shadow);
  const borderRadius = readRecord(element.border_radius);
  const fillColor = readString(fill.color);
  const strokeColor = readString(stroke.color);
  const strokeWidth = readNumber(stroke.width);
  const shadowOpacity = readNumber(shadow.opacity) ?? 0;
  const shadowColor = readString(shadow.color) ?? "#000000";
  const offsetX = readNumber(shadow.offset_x ?? shadow.offset_x) ?? 0;
  const offsetY = readNumber(shadow.offset_y ?? shadow.offset_y) ?? 0;
  const blur = readNumber(shadow.blur) ?? 0;

  return {
    backgroundColor: fillColor ?? undefined,
    border: strokeColor || strokeWidth
      ? `${strokeWidth ?? 1}px solid ${strokeColor ?? "transparent"}`
      : undefined,
    borderRadius: borderRadiusPx(borderRadius),
    boxShadow: shadowOpacity > 0
      ? `${px(offsetX)} ${px(offsetY)} ${px(blur)} rgba(${hexToRgb(shadowColor)}, ${shadowOpacity})`
      : undefined,
    opacity: readNumber(fill.opacity) ?? undefined,
  };
}

function tableCellStyle(cell: unknown, isHeader: boolean): React.CSSProperties {
  const record = readRecord(cell);
  const text = readRecord(record.text);
  return {
    ...fontStyle(text.font as TemplateV2Element["font"]),
    border: "1px solid rgba(8, 35, 20, 0.18)",
    fontWeight: isHeader ? 700 : fontStyle(text.font as TemplateV2Element["font"]).fontWeight,
    overflow: "hidden",
    padding: "4px 6px",
    textAlign: "left",
    verticalAlign: "middle",
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
  };
}

function readCellText(cell: unknown) {
  const record = readRecord(cell);
  const text = readRecord(record.text);
  return readString(text.text) ?? "";
}

function readTextRuns(element: TemplateV2Element): TemplateV2TextRun[] {
  if (Array.isArray(element.runs) && element.runs.length > 0) {
    return element.runs;
  }
  return [{ text: element.text ?? "" }];
}

function fontStyle(font: TemplateV2Element["font"]): React.CSSProperties {
  const record = readRecord(font);
  const size = readNumber(record.size);
  return {
    color: readString(record.color) ?? "#111827",
    fontFamily: readString(record.family) ?? undefined,
    fontSize: size ? px(size) : undefined,
    fontStyle: readBoolean(record.italic) ? "italic" : undefined,
    fontWeight: readBoolean(record.bold) ? 700 : undefined,
    lineHeight: readLineHeight(font) ?? undefined,
  };
}

function readLineHeight(font: TemplateV2Element["font"]) {
  const record = readRecord(font);
  return readNumber(record.line_height ?? record.line_height);
}

function paddingStyle(padding: Record<string, unknown>): React.CSSProperties {
  return {
    paddingBottom: px(readNumber(padding.bottom) ?? 0),
    paddingLeft: px(readNumber(padding.left) ?? 0),
    paddingRight: px(readNumber(padding.right) ?? 0),
    paddingTop: px(readNumber(padding.top) ?? 0),
  };
}

function borderRadiusPx(radius: Record<string, unknown>) {
  const topLeft = readNumber(radius.tl) ?? 0;
  const topRight = readNumber(radius.tr) ?? topLeft;
  const bottomRight = readNumber(radius.br) ?? topLeft;
  const bottomLeft = readNumber(radius.bl) ?? topLeft;
  if (!topLeft && !topRight && !bottomRight && !bottomLeft) return undefined;
  return `${px(topLeft)} ${px(topRight)} ${px(bottomRight)} ${px(bottomLeft)}`;
}

function readRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
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
  return value === true || value === "true";
}

function px(value: number) {
  return `${value}px`;
}

function imageFit(value: unknown): React.CSSProperties["objectFit"] {
  if (value === "contain" || value === "cover" || value === "fill") {
    return value;
  }
  return "contain";
}

function imageClipPath(
  element: TemplateV2Element,
): React.CSSProperties["clipPath"] {
  const raw =
    readString(element.clippath) ??
    readString(element.clipPath) ??
    readString(element.clip_path);
  const clipPath = raw?.trim();
  if (!clipPath) return undefined;
  return normalizeSafeImageClipPath(clipPath);
}

function normalizeSafeImageClipPath(value: string) {
  const path = /^path\(([\s\S]*)\)$/i.exec(value);
  if (path) {
    const data = extractCssPathData(path[1]);
    return data && isSafeSvgClipPathData(data) ? `path('${data}')` : undefined;
  }
  const rawPath = extractCssPathData(value);
  if (isSafeSvgClipPathData(rawPath)) return `path('${rawPath}')`;
  return isSafeCssClipPath(value) ? value : undefined;
}

function extractCssPathData(value: string) {
  const body = value.trim().replace(/^(evenodd|nonzero)\s*,\s*/i, "");
  const quoted = /^(['"])([\s\S]*)\1$/.exec(body);
  return quoted ? quoted[2].trim() : body;
}

function isSafeSvgClipPathData(value: string) {
  return (
    /[A-Za-z]/.test(value) &&
    /^[AaCcHhLlMmQqSsTtVvZz0-9eE\s.,+\-]*$/.test(value)
  );
}

function isSafeCssClipPath(value: string) {
  const trimmed = value.trim();
  const lower = trimmed.toLowerCase();
  return (
    trimmed.length > 0 &&
    trimmed.length <= 4096 &&
    !/[;"{}<>\\]/.test(trimmed) &&
    !lower.includes("javascript:") &&
    !lower.includes("data:") &&
    !lower.includes("expression(") &&
    !lower.includes("var(") &&
    hasBalancedCssClipPathSyntax(trimmed) &&
    /(?:path|polygon|inset|circle|ellipse|rect|xywh|url)\(/i.test(trimmed)
  );
}

function hasBalancedCssClipPathSyntax(value: string) {
  let depth = 0;
  let quote: string | null = null;
  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    if (quote) {
      if (char === quote) quote = null;
      continue;
    }
    if (char === "'") {
      quote = char;
      continue;
    }
    if (char === "(") depth += 1;
    else if (char === ")") {
      depth -= 1;
      if (depth < 0) return false;
    }
  }
  return depth === 0 && quote == null;
}

function imageObjectPosition(
  element: TemplateV2Element,
): React.CSSProperties["objectPosition"] {
  const focus_x = clampPercent(readNumber(element.focus_x));
  const focus_y = clampPercent(readNumber(element.focus_y));
  if (focus_x == null && focus_y == null) return undefined;
  return `${focus_x ?? 50}% ${focus_y ?? 50}%`;
}

function clampPercent(value: number | null) {
  if (value == null) return null;
  return Math.min(100, Math.max(0, value));
}

function imageCropScale(element: TemplateV2Element) {
  const value = readNumber(element.crop_scale);
  if (value == null) return 1;
  return Math.min(6, Math.max(1, value));
}

function imageFlipTransform(flipH: boolean, flipV: boolean) {
  const transforms = [
    flipH ? "scaleX(-1)" : "",
    flipV ? "scaleY(-1)" : "",
  ].filter(Boolean);
  return transforms.length ? transforms.join(" ") : undefined;
}

function imageCropTransform(cropScale: number) {
  return cropScale > 1 ? `scale(${cropScale})` : undefined;
}

function imageTransformValue(
  frameTransform: string | undefined,
  cropTransform: string | undefined,
) {
  return [frameTransform, cropTransform].filter(Boolean).join(" ") || undefined;
}

function horizontalAlign(value: string | null) {
  if (value === "center") return "center";
  if (value === "right") return "flex-end";
  return "flex-start";
}

function verticalAlign(value: string | null) {
  if (value === "middle" || value === "center") return "center";
  if (value === "bottom") return "flex-end";
  return "flex-start";
}

function textAlign(value: string | null): React.CSSProperties["textAlign"] {
  if (value === "center" || value === "right") return value;
  return "left";
}

function cssAlignment(value: string | null, fallback: string) {
  if (
    value === "flex-start" ||
    value === "flex-end" ||
    value === "center" ||
    value === "stretch"
  ) {
    return value;
  }
  return fallback;
}

function hexToRgb(color: string) {
  const normalized = color.replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return "0, 0, 0";
  const value = Number.parseInt(normalized, 16);
  return `${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}`;
}
