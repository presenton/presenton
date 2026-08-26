"use client";

import {
  Fragment,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { flushSync } from "react-dom";
import type Konva from "konva";
import {
  Arc,
  Circle,
  Ellipse,
  Group,
  Image as KonvaImage,
  Line,
  Path,
  Rect,
  Text,
} from "react-konva";
import { effectiveLineHeight } from "@/components/slide-editor/text/text-line-height";
import { textRunsContent } from "@/components/slide-editor/text/text-runs";
import { TRANSFORM_ANCHOR_ATTR } from "@/components/slide-editor/selection/transformSession";
import {
  displayText,
  layoutTextListRenderItems,
  layoutRenderTextRuns,
  lineRenderHeight,
  lineStartX,
  fontScaleFromResize,
  rawFont,
  rawRenderTextRuns,
  rawTextContent,
  renderKonvaTextSegment,
  textListVisualLocalBox,
  textVisualLocalBox,
  type RenderTextRun,
} from "@/components/slide-editor/text/template-v2-text";
import {
  HTML_TEXT_HEIGHT_ATTR,
  HTML_TEXT_WIDTH_ATTR,
  shouldRenderTextElementAsHtml,
} from "@/components/slide-editor/text/html-text-attrs";
import type { TableCellSelection } from "@/components/slide-editor/state/state";
import { loadKonvaImage } from "@/components/slide-editor/surface/exportAssets";
import { constrainComponentTransformBounds } from "@/components/slide-editor/surface/componentFrameBounds";
import {
  createLatestFrameBatch,
  type LatestFrameBatch,
} from "@/components/slide-editor/surface/latestFrameBatch";
import { TemplateV2ChartJsElement as RawChartElement } from "@/components/slide-editor/charts/TemplateV2ChartJsElement";
import { TemplateV2TableElement as RawTableElement } from "@/components/slide-editor/tables/TemplateV2TableElement";
import { blackOrWhiteTextColor } from "@/components/slide-editor/tables/table-colors";
import { LatexRunNode } from "@/components/slide-editor/math/LatexRunNode";
import { buildSvgUpdateUrl } from "@/lib/svg-color";
import { normalizeInfographicIcon } from "@/components/slide-editor/infographics/infographic-editing";
import {
  componentSideResizeBox,
  resizeComponentFromSideTransform,
  type ComponentSideResizeAnchor,
} from "@/components/slide-editor/model/component-resize";
import {
  asRecord,
  anchoredFramePositionForResize,
  anchoredFramePositionForResizeUnclamped,
  borderRadius,
  childArrayInfo,
  clamp,
  colorWithOpacity,
  componentBox,
  elementBox,
  fillColor,
  fillOpacity,
  boxEqual,
  insertVectorPointInElement,
  isBoxVisualType,
  isManualPositioned,
  isRawIconElement,
  isStaticSvgIconSource,
  isVectorType,
  isRecord,
  keyForSelection,
  layoutChildren,
  lineStrokeWidth,
  nullableBoxEqual,
  numberPathEqual,
  positionFromNodeInParent,
  polygonClosedForElement,
  polygonElementFromFrame,
  polygonLocalPointsForElement,
  rawElementKey,
  readArray,
  readBoolean,
  readNumber,
  readPoint,
  readString,
  ROOT_ELEMENTS_COMPONENT_INDEX,
  STAGE_BOX,
  resizeComponent,
  resizeComponentElementBounds,
  resizeComponentFrame,
  scaleRawElementTextMetrics,
  selectionTouchesComponent,
  selectionTouchesElement,
  shadowProps,
  shouldClipElementChildren,
  shouldUseCenterOrigin,
  strokeColor,
  strokeOpacity,
  strokeWidth,
  removeVectorPointFromElement,
  translateVectorElement,
  unclampedPositionFromNodeInParent,
  updateVectorVertexPoint,
  valueProgress,
  vectorVertexEntriesForElement,
  vectorShapeForElement,
  pointOnCircle,
  withHash,
  type Box,
  type ComponentSelection,
  type ElementSelection,
  type Point,
  type RawComponent,
  type RawElement,
  type SelectOptions,
  type Selection,
} from "@/components/slide-editor/model/model";

type ComponentTransformAnchor =
  | "top-left"
  | "top-center"
  | "top-right"
  | "middle-left"
  | "middle-right"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right"
  | "rotater";

type ComponentResizeMode =
  | "scale-content"
  | "resize-element-bounds"
  | "resize-frame";

type ComponentTransformBox = Box & {
  scaleX: number;
  scaleY: number;
  rawWidth: number;
  rawHeight: number;
};

type ComponentSideTransformTarget = {
  anchor: ComponentSideResizeAnchor;
  box: Box;
  rotation: number;
};

type ComponentSideTransformPreview = {
  source: RawComponent;
  sourceBox: Box;
  target: ComponentSideTransformTarget;
};

const HORIZONTAL_RESIZE_ANCHORS = new Set<ComponentTransformAnchor>([
  "middle-left",
  "middle-right",
]);
const VERTICAL_RESIZE_ANCHORS = new Set<ComponentTransformAnchor>([
  "top-center",
  "bottom-center",
]);
const VECTOR_VERTEX_HANDLE_RADIUS = 5;
const VECTOR_VERTEX_HANDLE_STROKE_WIDTH = 2;
const VECTOR_VERTEX_HANDLE_COLOR = "#7A5AF8";
const VECTOR_VERTEX_HANDLE_HIT_RADIUS = 14;
const VECTOR_ADD_HANDLE_RADIUS = 6;
const VECTOR_DELETE_HANDLE_RADIUS = 5;
const VECTOR_DELETE_HANDLE_OFFSET = 11;
const VECTOR_DELETE_HANDLE_COLOR = "#EF4444";
const VECTOR_MARKERS = new Set([
  "arrow",
  "stealth",
  "triangle",
  "circle",
  "square",
  "diamond",
]);

type VectorMarkerStyle =
  | "arrow"
  | "stealth"
  | "triangle"
  | "circle"
  | "square"
  | "diamond";

function vectorMarkerStyle(value: unknown): VectorMarkerStyle | null {
  const marker = readString(value);
  return marker && VECTOR_MARKERS.has(marker)
    ? (marker as VectorMarkerStyle)
    : null;
}

function VectorEndpointMarker({
  adjacent,
  color,
  endpoint,
  marker,
  strokeWidth: markerStrokeWidth,
}: {
  adjacent: Point;
  color: string;
  endpoint: Point;
  marker: VectorMarkerStyle;
  strokeWidth: number;
}) {
  const dx = endpoint.x - adjacent.x;
  const dy = endpoint.y - adjacent.y;
  if (Math.hypot(dx, dy) < 0.01) return null;

  const length = Math.max(11, Math.min(28, 8 + markerStrokeWidth * 2.5));
  const halfWidth = length * 0.42;
  const rotation = Math.atan2(dy, dx) * (180 / Math.PI);
  const shared = {
    fill: color,
    listening: false,
    stroke: color,
    strokeWidth: Math.max(1, markerStrokeWidth),
  };

  return (
    <Group x={endpoint.x} y={endpoint.y} rotation={rotation} listening={false}>
      {marker === "arrow" ? (
        <Line
          points={[-length, -halfWidth, 0, 0, -length, halfWidth]}
          fillEnabled={false}
          lineCap="round"
          lineJoin="round"
          {...shared}
        />
      ) : marker === "circle" ? (
        <Circle x={-length * 0.42} radius={halfWidth * 0.72} {...shared} />
      ) : marker === "square" ? (
        <Rect
          x={-length * 0.84}
          y={-halfWidth * 0.72}
          width={halfWidth * 1.44}
          height={halfWidth * 1.44}
          {...shared}
        />
      ) : (
        <Line
          closed
          lineJoin="round"
          points={
            marker === "diamond"
              ? [0, 0, -length * 0.5, -halfWidth, -length, 0, -length * 0.5, halfWidth]
              : marker === "stealth"
                ? [0, 0, -length, -halfWidth, -length * 0.63, 0, -length, halfWidth]
                : [0, 0, -length, -halfWidth, -length, halfWidth]
          }
          {...shared}
        />
      )}
    </Group>
  );
}

function isComponentSideResizeAnchor(
  anchor: ComponentTransformAnchor | null,
): anchor is ComponentSideResizeAnchor {
  return Boolean(
    anchor &&
      (HORIZONTAL_RESIZE_ANCHORS.has(anchor) ||
        VERTICAL_RESIZE_ANCHORS.has(anchor)),
  );
}

function isTopOrLeftSideResizeAnchor(anchor: ComponentSideResizeAnchor) {
  return anchor === "top-center" || anchor === "middle-left";
}

function hasTransformScale(node: Konva.Node) {
  return (
    Math.abs(node.scaleX() - 1) >= 0.001 ||
    Math.abs(node.scaleY() - 1) >= 0.001
  );
}

function componentTransformerForNode(node: Konva.Node) {
  const stage = node.getStage();
  if (!stage) return null;
  return stage
    .find<Konva.Transformer>("Transformer")
    .find((candidate) => candidate.getNodes().includes(node));
}

function componentTransformAnchorForNode(
  node: Konva.Node,
): ComponentTransformAnchor | null {
  const transformer = componentTransformerForNode(node);
  const activeAnchor =
    transformer?.getActiveAnchor() ??
    readString(node.getAttr(TRANSFORM_ANCHOR_ATTR));
  return isComponentTransformAnchor(activeAnchor) ? activeAnchor : null;
}

function isComponentTransformAnchor(
  value: string | null | undefined,
): value is ComponentTransformAnchor {
  return (
    value === "top-left" ||
    value === "top-center" ||
    value === "top-right" ||
    value === "middle-left" ||
    value === "middle-right" ||
    value === "bottom-left" ||
    value === "bottom-center" ||
    value === "bottom-right" ||
    value === "rotater"
  );
}

function componentResizeModeForTransform(
  anchor: ComponentTransformAnchor | null,
  scaleX: number,
  scaleY: number,
): ComponentResizeMode {
  if (anchor === "rotater") return "resize-frame";
  if (
    anchor &&
    (HORIZONTAL_RESIZE_ANCHORS.has(anchor) ||
      VERTICAL_RESIZE_ANCHORS.has(anchor))
  ) {
    return "resize-element-bounds";
  }
  if (anchor) return "scale-content";

  const changedX = Math.abs(scaleX - 1) > 0.001;
  const changedY = Math.abs(scaleY - 1) > 0.001;
  if (changedX && changedY) return "scale-content";
  if (changedX || changedY) return "resize-element-bounds";
  return "resize-frame";
}

function componentBoxFromTransform(
  box: Box,
  scaleX: number,
  scaleY: number,
  anchor: ComponentTransformAnchor | null,
): ComponentTransformBox {
  const isVerticalOnly = anchor ? VERTICAL_RESIZE_ANCHORS.has(anchor) : false;
  const isHorizontalOnly = anchor ? HORIZONTAL_RESIZE_ANCHORS.has(anchor) : false;
  const nextScaleX = isVerticalOnly || anchor === "rotater" ? 1 : scaleX;
  const nextScaleY = isHorizontalOnly || anchor === "rotater" ? 1 : scaleY;
  const rawWidth = Math.max(1, box.width * nextScaleX);
  const rawHeight = Math.max(1, box.height * nextScaleY);

  return {
    ...box,
    width: rawWidth,
    height: rawHeight,
    scaleX: box.width > 0 ? rawWidth / box.width : 1,
    scaleY: box.height > 0 ? rawHeight / box.height : 1,
    rawWidth,
    rawHeight,
  };
}

function positionFromComponentTransform(
  box: Box,
  node: Konva.Node,
  nextBox: ComponentTransformBox,
  anchor: ComponentTransformAnchor | null,
): Point {
  if (isComponentSideResizeAnchor(anchor)) {
    return {
      x: clamp(box.x, 0, Math.max(0, STAGE_BOX.width - nextBox.width)),
      y: clamp(box.y, 0, Math.max(0, STAGE_BOX.height - nextBox.height)),
    };
  }

  const rawPosition = positionFromNodeInParent(node, STAGE_BOX, {
    ...nextBox,
    width: nextBox.rawWidth,
    height: nextBox.rawHeight,
  });
  return {
    x: clamp(
      rawPosition.x,
      0,
      Math.max(0, STAGE_BOX.width - nextBox.width),
    ),
    y: clamp(
      rawPosition.y,
      0,
      Math.max(0, STAGE_BOX.height - nextBox.height),
    ),
  };
}

function componentFromNodeTransform(
  component: RawComponent,
  node: Konva.Group,
  anchor: ComponentTransformAnchor | null,
) {
  const box = componentBox(component);
  const scaleX = node.scaleX();
  const scaleY = node.scaleY();
  const nextBox = componentBoxFromTransform(box, scaleX, scaleY, anchor);
  const resizeMode = componentResizeModeForTransform(anchor, scaleX, scaleY);
  node.scaleX(1);
  node.scaleY(1);
  const position = positionFromComponentTransform(box, node, nextBox, anchor);
  const nextComponentBox = {
    ...position,
    width: nextBox.width,
    height: nextBox.height,
    rotation: node.rotation(),
  };

  if (resizeMode === "resize-frame") {
    return resizeComponentFrame(component, nextComponentBox);
  }
  if (resizeMode === "resize-element-bounds") {
    return resizeComponentElementBounds(component, {
      ...nextComponentBox,
      scaleX: nextBox.scaleX,
      scaleY: nextBox.scaleY,
    });
  }
  return resizeComponent(component, {
    ...nextComponentBox,
    scaleX: nextBox.scaleX,
    scaleY: nextBox.scaleY,
  });
}

function syncComponentNodeBox(node: Konva.Group, box: Box) {
  node.setAttrs({
    x: box.x + box.width / 2,
    y: box.y + box.height / 2,
    width: box.width,
    height: box.height,
    offsetX: box.width / 2,
    offsetY: box.height / 2,
    scaleX: 1,
    scaleY: 1,
  });
  componentTransformerForNode(node)?.forceUpdate();
  node.getLayer()?.batchDraw();
}

function componentSideTransformTargetFromNode(
  node: Konva.Group,
  anchor: ComponentSideResizeAnchor,
  sourceBox: Box,
) {
  const transformedWidth = Math.max(1, node.width() * node.scaleX());
  const transformedHeight = Math.max(1, node.height() * node.scaleY());
  const box = componentSideResizeBox(
    sourceBox,
    { width: transformedWidth, height: transformedHeight },
    anchor,
    STAGE_BOX,
  );

  // Stop Konva from stretching the rendered group while React rebuilds its
  // contents at the latest dimensions on the next animation frame.
  syncComponentNodeBox(node, box);
  return { anchor, box, rotation: node.rotation() };
}

function componentFromSideTransformPreview({
  source,
  sourceBox,
  target,
}: ComponentSideTransformPreview) {
  return resizeComponentFromSideTransform(
    source,
    sourceBox,
    { width: target.box.width, height: target.box.height },
    target.anchor,
    STAGE_BOX,
    target.rotation,
  ).component;
}

function setStageCursor(
  event: Konva.KonvaEventObject<MouseEvent>,
  cursor: string,
) {
  const container = event.target.getStage()?.container();
  if (container) container.style.cursor = cursor;
}

export function RawComponentNode({
  component,
  componentIndex,
  isEditMode,
  isMultiSelectedComponent,
  editingKey,
  vectorEditingKey,
  selectedTableCell,
  selectedKey,
  setNodeRef,
  onSelect,
  onTableCellSelect,
  onTableCellEdit,
  onOpenElementEditor,
  onComponentChange,
  onComponentDragStart,
  onComponentDragMove,
  onComponentDragEnd,
  onElementChange,
  onElementDragStart,
  onElementDragMove,
  onElementDragComplete,
  fontRevision,
  renderTextAsHtml,
}: {
  component: RawComponent;
  componentIndex: number;
  isEditMode: boolean;
  isMultiSelectedComponent: boolean;
  editingKey: string | null;
  vectorEditingKey: string | null;
  selectedTableCell: TableCellSelection | null;
  selectedKey: string | null;
  setNodeRef: (key: string, node: Konva.Node | null) => void;
  onSelect: (selection: Selection, options?: SelectOptions) => void;
  onTableCellSelect: (
    selection: ElementSelection,
    rowIndex: number,
    colIndex: number,
  ) => void;
  onTableCellEdit: (
    selection: ElementSelection,
    rowIndex: number,
    colIndex: number,
  ) => void;
  onOpenElementEditor: (selection: ElementSelection) => void;
  onComponentChange: (
    componentIndex: number,
    updater: (component: RawComponent) => RawComponent,
  ) => void;
  onComponentDragStart: (componentIndex: number, node: Konva.Node) => void;
  onComponentDragMove: (componentIndex: number, node: Konva.Node) => void;
  onComponentDragEnd: (componentIndex: number, node: Konva.Node) => void;
  onElementChange: (
    selection: ElementSelection,
    updater: (element: RawElement) => RawElement,
  ) => void;
  onElementDragStart: (
    selection: ElementSelection,
    node: Konva.Node,
  ) => void;
  onElementDragMove: (
    selection: ElementSelection,
    node: Konva.Node,
  ) => void;
  onElementDragComplete: (
    selection: ElementSelection,
    node: Konva.Node,
  ) => void;
  fontRevision: number;
  renderTextAsHtml: boolean;
}) {
  const groupRef = useRef<Konva.Group | null>(null);
  const transformSourceRef = useRef<RawComponent | null>(null);
  const transformSourceBoxRef = useRef<Box | null>(null);
  const transformPreviewRef = useRef<RawComponent | null>(null);
  const transformPreviewAnchorRef = useRef<ComponentTransformAnchor | null>(null);
  const latestSideTransformRef =
    useRef<ComponentSideTransformPreview | null>(null);
  const transformPreviewBatchRef =
    useRef<LatestFrameBatch<ComponentSideTransformPreview> | null>(null);
  const [transformPreview, setTransformPreview] =
    useState<RawComponent | null>(null);
  const renderTransformPreview = useCallback(
    (pending: ComponentSideTransformPreview) => {
      const next = componentFromSideTransformPreview(pending);
      transformPreviewRef.current = next;
      setTransformPreview(next);
    },
    [],
  );

  useEffect(() => {
    const batch = createLatestFrameBatch(
      (callback) => window.requestAnimationFrame(callback),
      (frame) => window.cancelAnimationFrame(frame),
      renderTransformPreview,
    );
    transformPreviewBatchRef.current = batch;

    return () => {
      batch.cancel();
      if (transformPreviewBatchRef.current === batch) {
        transformPreviewBatchRef.current = null;
      }
    };
  }, [renderTransformPreview]);

  const renderedComponent = transformPreview ?? component;
  const box = componentBox(renderedComponent);
  // React should update the children during the gesture without overwriting
  // the newer imperative frame position maintained by Konva.
  const frameBox = componentBox(component);
  const selection = useMemo<ComponentSelection>(
    () => ({ kind: "component", componentIndex }),
    [componentIndex],
  );
  const key = keyForSelection(selection);
  const setGroupNodeRef = useCallback(
    (node: Konva.Group | null) => {
      groupRef.current = node;
      if (node) constrainComponentTransformBounds(node);
      setNodeRef(key, node);
    },
    [key, setNodeRef],
  );
  const elements = readArray(renderedComponent.elements).filter(
    isRecord,
  ) as RawElement[];
  const isSingleVectorElementComponent =
    elements.length === 1 && isVectorType(readString(elements[0]?.type));
  const canNormalizeSingleVectorWrapper =
    isSingleVectorElementComponent &&
    (readNumber(component.rotation) ?? 0) === 0;
  const handleSingleElementComponentDragEnd = useCallback(
    (elementSelection: ElementSelection, delta: Point) => {
      if (
        elementSelection.componentIndex !== componentIndex ||
        elementSelection.elementPath.length !== 1 ||
        elementSelection.elementPath[0] !== 0 ||
        elements.length !== 1 ||
        (readNumber(component.rotation) ?? 0) !== 0
      ) {
        return false;
      }

      onComponentChange(componentIndex, (current) => {
        const position = readPoint(current.position);
        return {
          ...current,
          position: {
            x: position.x + delta.x,
            y: position.y + delta.y,
          },
        };
      });
      return true;
    },
    [component.rotation, componentIndex, elements, onComponentChange],
  );
  const handleMouseDown = useCallback(
    (event: Konva.KonvaEventObject<MouseEvent>) => {
      if (!isEditMode) return;
      event.cancelBubble = true;
      if (isMultiSelectedComponent && !event.evt.shiftKey) return;
      onSelect(selection, { additive: event.evt.shiftKey });
    },
    [
      isEditMode,
      isMultiSelectedComponent,
      onSelect,
      selection,
    ],
  );
  const handleTouchStart = useCallback(
    (event: Konva.KonvaEventObject<TouchEvent>) => {
      if (!isEditMode) return;
      event.cancelBubble = true;
      if (isMultiSelectedComponent) return;
      onSelect(selection);
    },
    [
      isEditMode,
      isMultiSelectedComponent,
      onSelect,
      selection,
    ],
  );
  const handleDragStart = useCallback(
    (event: Konva.KonvaEventObject<DragEvent>) => {
      if (!isEditMode) return;
      event.cancelBubble = true;
      const node = groupRef.current;
      if (!node) return;
      if (!isMultiSelectedComponent && !event.evt.shiftKey) {
        onSelect(selection);
      }
      onComponentDragStart(componentIndex, node);
    },
    [
      componentIndex,
      isEditMode,
      isMultiSelectedComponent,
      onComponentDragStart,
      onSelect,
      selection,
    ],
  );
  const handleDragMove = useCallback(
    (event: Konva.KonvaEventObject<DragEvent>) => {
      event.cancelBubble = true;
      const node = groupRef.current;
      if (!node) return;
      onComponentDragMove(componentIndex, node);
    },
    [componentIndex, onComponentDragMove],
  );
  const handleDragEnd = useCallback(
    (event: Konva.KonvaEventObject<DragEvent>) => {
      if (!isEditMode) return;
      event.cancelBubble = true;
      const node = groupRef.current;
      if (!node) return;
      onComponentDragEnd(componentIndex, node);
    },
    [componentIndex, isEditMode, onComponentDragEnd],
  );
  const handleTransformStart = useCallback(() => {
    transformPreviewBatchRef.current?.cancel();
    transformSourceRef.current = component;
    transformSourceBoxRef.current = componentBox(component);
    transformPreviewRef.current = null;
    transformPreviewAnchorRef.current = null;
    latestSideTransformRef.current = null;
    setTransformPreview(null);
  }, [component]);
  const handleTransform = useCallback(
    (event: Konva.KonvaEventObject<Event>) => {
      if (!isEditMode) return;
      event.cancelBubble = true;
      const node = groupRef.current;
      if (!node) return;
      const anchor = componentTransformAnchorForNode(node);
      if (!isComponentSideResizeAnchor(anchor)) return;
      if (!hasTransformScale(node)) return;
      const source = transformSourceRef.current ?? component;
      const sourceBox = transformSourceBoxRef.current ?? componentBox(source);
      const pending = {
        source,
        sourceBox,
        target: componentSideTransformTargetFromNode(node, anchor, sourceBox),
      } satisfies ComponentSideTransformPreview;
      latestSideTransformRef.current = pending;
      transformPreviewAnchorRef.current = anchor;

      if (isTopOrLeftSideResizeAnchor(anchor)) {
        transformPreviewBatchRef.current?.cancel();
        flushSync(() => renderTransformPreview(pending));
        return;
      }

      const batch = transformPreviewBatchRef.current;
      if (batch) {
        batch.schedule(pending);
      } else {
        renderTransformPreview(pending);
      }
    },
    [component, isEditMode, renderTransformPreview],
  );
  const handleTransformEnd = useCallback(
    (event: Konva.KonvaEventObject<Event>) => {
      if (!isEditMode) return;
      event.cancelBubble = true;
      const node = groupRef.current;
      if (!node) return;
      transformPreviewBatchRef.current?.cancel();
      const anchor = componentTransformAnchorForNode(node);
      const previewAnchor = transformPreviewAnchorRef.current;
      const sideAnchor = isComponentSideResizeAnchor(anchor)
        ? anchor
        : previewAnchor;
      let next: RawComponent;
      if (isComponentSideResizeAnchor(sideAnchor)) {
        const source = transformSourceRef.current ?? component;
        const sourceBox = transformSourceBoxRef.current ?? componentBox(source);
        let finalPreview = latestSideTransformRef.current;
        if (hasTransformScale(node)) {
          finalPreview = {
            source,
            sourceBox,
            target: componentSideTransformTargetFromNode(
              node,
              sideAnchor,
              sourceBox,
            ),
          };
        }
        next = finalPreview
          ? componentFromSideTransformPreview(finalPreview)
          : transformPreviewRef.current ?? source;
      } else {
        next = componentFromNodeTransform(component, node, anchor);
      }
      transformSourceRef.current = null;
      transformSourceBoxRef.current = null;
      transformPreviewRef.current = null;
      transformPreviewAnchorRef.current = null;
      latestSideTransformRef.current = null;
      node.setAttr(TRANSFORM_ANCHOR_ATTR, null);
      flushSync(() => {
        setTransformPreview(null);
        onComponentChange(componentIndex, () => next);
      });
    },
    [component, componentIndex, isEditMode, onComponentChange],
  );

  return (
    <Group
      ref={setGroupNodeRef}
      x={frameBox.x + frameBox.width / 2}
      y={frameBox.y + frameBox.height / 2}
      width={frameBox.width}
      height={frameBox.height}
      offsetX={frameBox.width / 2}
      offsetY={frameBox.height / 2}
      rotation={readNumber(component.rotation) ?? 0}
      draggable={isEditMode}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
      onDragStart={handleDragStart}
      onDragMove={handleDragMove}
      onDragEnd={handleDragEnd}
      onTransformStart={handleTransformStart}
      onTransform={handleTransform}
      onTransformEnd={handleTransformEnd}
    >
      {isEditMode ? <SelectionBoundsRect width={box.width} height={box.height} /> : null}
      {elements.map((element, elementIndex) => (
        <MemoizedRawElementNode
          key={rawElementKey(element, elementIndex)}
          element={element}
          componentIndex={componentIndex}
          elementPath={[elementIndex]}
          isEditMode={isEditMode}
          editingKey={editingKey}
          vectorEditingKey={vectorEditingKey}
          selectedTableCell={selectedTableCell}
          selectedKey={selectedKey}
          setNodeRef={setNodeRef}
          onSelect={onSelect}
          onTableCellSelect={onTableCellSelect}
          onTableCellEdit={onTableCellEdit}
          onOpenEditor={onOpenElementEditor}
          onElementChange={onElementChange}
          onElementDragEnd={handleSingleElementComponentDragEnd}
          onElementDragStart={onElementDragStart}
          onElementDragMove={onElementDragMove}
          onElementDragComplete={onElementDragComplete}
          parentBox={box}
          textConstraintBox={{
            x: 0,
            y: 0,
            width: box.width,
            height: box.height,
          }}
          layoutManaged={false}
          allowVectorResizeBeyondParent={
            canNormalizeSingleVectorWrapper && elementIndex === 0
          }
          allowVectorPointEditing={
            isSingleVectorElementComponent && elementIndex === 0
          }
          allowDirectVectorSelection={
            !isMultiSelectedComponent &&
            isSingleVectorElementComponent &&
            elementIndex === 0
          }
          fontRevision={fontRevision}
          renderTextAsHtml={renderTextAsHtml}
        />
      ))}
    </Group>
  );
}

function constrainedWrappedTextVisualBox(
  element: RawElement,
  box: Box,
  parentBox: Box,
): Box {
  const type = readString(element.type);
  if (type !== "text" && type !== "text-list") return box;

  const availableWidth = Math.max(1, parentBox.width - box.x);
  const width = Math.min(box.width, availableWidth);
  if (Math.abs(width - box.width) < 0.01) return box;

  const constrainedBox = { ...box, width };
  return type === "text-list"
    ? textListVisualLocalBox(element, constrainedBox)
    : textVisualLocalBox(element, constrainedBox);
}

export const MemoizedRawComponentNode = memo(
  RawComponentNode,
  (previous, next) => {
    if (
      previous.component !== next.component ||
      previous.componentIndex !== next.componentIndex ||
      previous.isEditMode !== next.isEditMode ||
      previous.isMultiSelectedComponent !== next.isMultiSelectedComponent ||
      previous.vectorEditingKey !== next.vectorEditingKey ||
      previous.setNodeRef !== next.setNodeRef ||
      previous.onSelect !== next.onSelect ||
      previous.onTableCellSelect !== next.onTableCellSelect ||
      previous.onTableCellEdit !== next.onTableCellEdit ||
      previous.onOpenElementEditor !== next.onOpenElementEditor ||
      previous.onComponentChange !== next.onComponentChange ||
      previous.onComponentDragStart !== next.onComponentDragStart ||
      previous.onComponentDragMove !== next.onComponentDragMove ||
      previous.onComponentDragEnd !== next.onComponentDragEnd ||
      previous.onElementChange !== next.onElementChange ||
      previous.onElementDragStart !== next.onElementDragStart ||
      previous.onElementDragMove !== next.onElementDragMove ||
      previous.onElementDragComplete !== next.onElementDragComplete ||
      previous.selectedTableCell !== next.selectedTableCell ||
      previous.selectedKey !== next.selectedKey ||
      previous.fontRevision !== next.fontRevision ||
      previous.renderTextAsHtml !== next.renderTextAsHtml
    ) {
      return false;
    }
    return !(
      previous.editingKey !== next.editingKey &&
      (selectionTouchesComponent(
        previous.editingKey,
        previous.componentIndex,
      ) ||
        selectionTouchesComponent(next.editingKey, next.componentIndex))
    );
  },
);

function RawElementNode({
  element,
  componentIndex,
  elementPath,
  isEditMode,
  editingKey,
  vectorEditingKey,
  selectedTableCell,
  selectedKey,
  setNodeRef,
  onSelect,
  onTableCellSelect,
  onTableCellEdit,
  onOpenEditor,
  onElementChange,
  onElementDragEnd,
  onElementDragStart,
  onElementDragMove,
  onElementDragComplete,
  parentBox,
  textConstraintBox,
  renderBox,
  layoutManaged = false,
  allowVectorResizeBeyondParent = false,
  allowVectorPointEditing = true,
  allowDirectVectorSelection = true,
  fontRevision,
  renderTextAsHtml,
}: {
  element: RawElement;
  componentIndex: number;
  elementPath: number[];
  isEditMode: boolean;
  editingKey: string | null;
  vectorEditingKey: string | null;
  selectedTableCell: TableCellSelection | null;
  selectedKey: string | null;
  setNodeRef: (key: string, node: Konva.Node | null) => void;
  onSelect: (selection: Selection, options?: SelectOptions) => void;
  onTableCellSelect: (
    selection: ElementSelection,
    rowIndex: number,
    colIndex: number,
  ) => void;
  onTableCellEdit: (
    selection: ElementSelection,
    rowIndex: number,
    colIndex: number,
  ) => void;
  onOpenEditor: (selection: ElementSelection) => void;
  onElementChange: (
    selection: ElementSelection,
    updater: (element: RawElement) => RawElement,
  ) => void;
  onElementDragEnd?: (selection: ElementSelection, delta: Point) => boolean;
  onElementDragStart?: (
    selection: ElementSelection,
    node: Konva.Node,
  ) => void;
  onElementDragMove?: (
    selection: ElementSelection,
    node: Konva.Node,
  ) => void;
  onElementDragComplete?: (
    selection: ElementSelection,
    node: Konva.Node,
  ) => void;
  parentBox: Box;
  textConstraintBox?: Box | null;
  renderBox?: Box | null;
  layoutManaged?: boolean;
  allowVectorResizeBeyondParent?: boolean;
  allowVectorPointEditing?: boolean;
  allowDirectVectorSelection?: boolean;
  fontRevision: number;
  renderTextAsHtml: boolean;
}) {
  const groupRef = useRef<Konva.Group | null>(null);
  const transformSourceBoxRef = useRef<Box | null>(null);
  const transformAnchorRef = useRef<ComponentTransformAnchor | null>(null);
  const box = renderBox ?? elementBox(element);
  const selection = useMemo<ElementSelection>(
    () => ({
      kind: "element",
      componentIndex,
      elementPath,
    }),
    [componentIndex, elementPath],
  );
  const key = keyForSelection(selection);
  const isSelected = selectedKey === key;
  const selectedCell =
    selectedTableCell?.elementPath === key ? selectedTableCell : null;
  const editing = editingKey === key;
  const type = readString(element.type);
  const usesHtmlText =
    renderTextAsHtml && shouldRenderTextElementAsHtml(element);
  const isVector = isVectorType(type);
  const vectorPointEditing = vectorEditingKey === key;
  const [vectorDragPreview, setVectorDragPreview] =
    useState<RawElement | null>(null);
  const renderedElement = vectorDragPreview ?? element;
  const childInfo = childArrayInfo(element);
  const children = childInfo?.items ?? [];
  const laidOutChildren = layoutChildren(element, children, box);
  const clipChildren = shouldClipElementChildren(element, childInfo);
  const shouldConstrainTextVisual =
    componentIndex !== ROOT_ELEMENTS_COMPONENT_INDEX || elementPath.length > 1;
  const visualBox = shouldConstrainTextVisual
    ? constrainedWrappedTextVisualBox(element, box, textConstraintBox ?? parentBox)
    : box;
  const childTextConstraintBox = childInfo
    ? textConstraintBox
      ? {
          ...textConstraintBox,
          x: textConstraintBox.x + box.x,
          y: textConstraintBox.y + box.y,
        }
      : {
          x: 0,
          y: 0,
          width: box.width,
          height: box.height,
        }
    : null;
  const centerOrigin = shouldUseCenterOrigin(element);
  const showVectorPointHandles =
    isEditMode &&
    isSelected &&
    isVector &&
    allowVectorPointEditing &&
    !editing &&
    vectorPointEditing;
  const vectorDraggable =
    isEditMode && isSelected && isVector && !editing && !showVectorPointHandles;
  useEffect(() => {
    if (!isSelected || !isVector) setVectorDragPreview(null);
  }, [isSelected, isVector]);
  const handleTableCellSelect = useCallback(
    (rowIndex: number, colIndex: number) => {
      onTableCellSelect(selection, rowIndex, colIndex);
    },
    [onTableCellSelect, selection],
  );
  const handleTableCellEdit = useCallback(
    (rowIndex: number, colIndex: number) => {
      onTableCellEdit(selection, rowIndex, colIndex);
    },
    [onTableCellEdit, selection],
  );
  const handleVectorDragStart = useCallback(
    (event: Konva.KonvaEventObject<DragEvent>) => {
      if (!vectorDraggable) return;
      event.cancelBubble = true;
      onSelect(selection);
      const node = groupRef.current;
      if (node) onElementDragStart?.(selection, node);
    },
    [onElementDragStart, onSelect, selection, vectorDraggable],
  );
  const handleVectorDragMove = useCallback(
    (event: Konva.KonvaEventObject<DragEvent>) => {
      if (!vectorDraggable) return;
      event.cancelBubble = true;
      const node = groupRef.current;
      if (node) onElementDragMove?.(selection, node);
    },
    [onElementDragMove, selection, vectorDraggable],
  );
  const handleVectorDragEnd = useCallback(
    (event: Konva.KonvaEventObject<DragEvent>) => {
      if (!vectorDraggable) return;
      event.cancelBubble = true;
      const node = groupRef.current;
      if (!node) return;
      onElementDragComplete?.(selection, node);
      const nextPosition = {
        x: node.x() - (centerOrigin ? box.width / 2 : 0),
        y: node.y() - (centerOrigin ? box.height / 2 : 0),
      };
      const delta = {
        x: nextPosition.x - box.x,
        y: nextPosition.y - box.y,
      };
      if (Math.abs(delta.x) < 0.01 && Math.abs(delta.y) < 0.01) return;
      if (onElementDragEnd?.(selection, delta)) {
        node.position({
          x: centerOrigin ? box.x + box.width / 2 : box.x,
          y: centerOrigin ? box.y + box.height / 2 : box.y,
        });
        return;
      }
      node.position({
        x: centerOrigin ? nextPosition.x + box.width / 2 : nextPosition.x,
        y: centerOrigin ? nextPosition.y + box.height / 2 : nextPosition.y,
      });
      onElementChange(selection, (current) => ({
        ...translateVectorElement(current, delta),
        ...(layoutManaged || isManualPositioned(current)
          ? { __presenton_manual_position: true }
          : {}),
      }));
    },
    [
      box,
      centerOrigin,
      layoutManaged,
      onElementChange,
      onElementDragComplete,
      onElementDragEnd,
      selection,
      vectorDraggable,
    ],
  );
  const previewVectorVertex = useCallback(
    (index: number, point: Point) => {
      setVectorDragPreview((current) =>
        updateVectorVertexPoint(current ?? element, index, point),
      );
    },
    [element],
  );
  const commitVectorVertex = useCallback(
    (index: number, point: Point) => {
      setVectorDragPreview(null);
      onElementChange(selection, (current) => ({
        ...updateVectorVertexPoint(current, index, point),
        ...(layoutManaged || isManualPositioned(current)
          ? { __presenton_manual_position: true }
          : {}),
      }));
    },
    [layoutManaged, onElementChange, selection],
  );
  const commitVectorPointInsert = useCallback(
    (afterIndex: number, point: Point) => {
      setVectorDragPreview(null);
      onElementChange(selection, (current) => ({
        ...insertVectorPointInElement(current, afterIndex, point),
        ...(layoutManaged || isManualPositioned(current)
          ? { __presenton_manual_position: true }
          : {}),
      }));
    },
    [layoutManaged, onElementChange, selection],
  );
  const commitVectorPointRemove = useCallback(
    (index: number) => {
      setVectorDragPreview(null);
      onElementChange(selection, (current) => ({
        ...removeVectorPointFromElement(current, index),
        ...(layoutManaged || isManualPositioned(current)
          ? { __presenton_manual_position: true }
          : {}),
      }));
    },
    [layoutManaged, onElementChange, selection],
  );
  const handleTransformStart = useCallback(
    (event: Konva.KonvaEventObject<Event>) => {
      if (!isEditMode) return;
      event.cancelBubble = true;
      transformSourceBoxRef.current = box;
      transformAnchorRef.current = null;
      const node = groupRef.current;
      if (node) {
        transformAnchorRef.current = componentTransformAnchorForNode(node);
      }
    },
    [box, isEditMode],
  );
  const handleTransform = useCallback(
    (event: Konva.KonvaEventObject<Event>) => {
      if (!isEditMode) return;
      event.cancelBubble = true;
      const node = groupRef.current;
      if (!node) return;
      const anchor = componentTransformAnchorForNode(node);
      if (anchor) transformAnchorRef.current = anchor;
    },
    [isEditMode],
  );
  const handleTransformEnd = useCallback(
    (event: Konva.KonvaEventObject<Event>) => {
      if (!isEditMode) return;
      event.cancelBubble = true;
      const node = groupRef.current;
      if (!node) {
        transformSourceBoxRef.current = null;
        transformAnchorRef.current = null;
        return;
      }
      const anchor =
        componentTransformAnchorForNode(node) ?? transformAnchorRef.current;
      const sourceBox = transformSourceBoxRef.current ?? box;
      const scaleX = node.scaleX();
      const scaleY = node.scaleY();
      const nextSize = {
        width: Math.max(1, sourceBox.width * scaleX),
        height: Math.max(1, sourceBox.height * scaleY),
      };
      const canOverflowParent =
        isVector &&
        allowVectorResizeBeyondParent &&
        (anchor?.includes("left") || anchor?.includes("top"));
      node.scaleX(1);
      node.scaleY(1);
      const fontScale = fontScaleFromResize(scaleX, scaleY);
      const measuredPosition = canOverflowParent
        ? unclampedPositionFromNodeInParent(node, parentBox, {
            ...sourceBox,
            ...nextSize,
          })
        : positionFromNodeInParent(node, parentBox, {
            ...sourceBox,
            ...nextSize,
          });
      const nextPosition = isVector
        ? canOverflowParent
          ? anchoredFramePositionForResizeUnclamped(
              sourceBox,
              nextSize,
              anchor,
              measuredPosition,
            )
          : anchoredFramePositionForResize(
              sourceBox,
              nextSize,
              anchor,
              measuredPosition,
              parentBox,
            )
        : measuredPosition;
      node.position({
        x: centerOrigin ? nextPosition.x + nextSize.width / 2 : nextPosition.x,
        y: centerOrigin ? nextPosition.y + nextSize.height / 2 : nextPosition.y,
      });
      transformSourceBoxRef.current = null;
      transformAnchorRef.current = null;
      node.setAttr(TRANSFORM_ANCHOR_ATTR, null);
      onElementChange(selection, (current) => {
        const scaled = scaleRawElementTextMetrics(current, fontScale);
        const type = readString(current.type);
        const geometry =
          isVectorType(type)
            ? polygonElementFromFrame(scaled, nextPosition, scaleX, scaleY)
            : {
                ...scaled,
                position: nextPosition,
                size: nextSize,
              };
        return {
          ...geometry,
          rotation: node.rotation(),
          ...(layoutManaged || isManualPositioned(current)
            ? { __presenton_manual_position: true }
            : {}),
        };
      });
    },
    [
      box,
      allowVectorResizeBeyondParent,
      centerOrigin,
      isEditMode,
      isVector,
      layoutManaged,
      onElementChange,
      parentBox,
      selection,
    ],
  );

  return (
    <Group
      ref={(node) => {
        groupRef.current = node;
        if (node) {
          node.setAttr(HTML_TEXT_WIDTH_ATTR, visualBox.width);
          node.setAttr(HTML_TEXT_HEIGHT_ATTR, visualBox.height);
        }
        setNodeRef(key, node);
      }}
      x={centerOrigin ? box.x + box.width / 2 : box.x}
      y={centerOrigin ? box.y + box.height / 2 : box.y}
      width={box.width}
      height={box.height}
      offsetX={centerOrigin ? box.width / 2 : 0}
      offsetY={centerOrigin ? box.height / 2 : 0}
      clipX={clipChildren ? 0 : undefined}
      clipY={clipChildren ? 0 : undefined}
      clipWidth={clipChildren ? box.width : undefined}
      clipHeight={clipChildren ? box.height : undefined}
      rotation={readNumber(element.rotation) ?? 0}
      opacity={readNumber(element.opacity) ?? 1}
      draggable={vectorDraggable}
      onMouseDown={(event) => {
        if (!isEditMode) return;
        if (isVector) {
          if (!allowDirectVectorSelection) {
            event.cancelBubble = false;
            return;
          }
          if (
            event.evt.shiftKey &&
            componentIndex !== ROOT_ELEMENTS_COMPONENT_INDEX
          ) {
            event.cancelBubble = false;
            return;
          }
          event.cancelBubble = true;
          onSelect(selection);
          return;
        }
        if (vectorDraggable) {
          event.cancelBubble = true;
          onSelect(selection);
          return;
        }
        event.cancelBubble = false;
      }}
      onTouchStart={(event) => {
        if (!isEditMode) return;
        if (isVector) {
          if (!allowDirectVectorSelection) {
            event.cancelBubble = false;
            return;
          }
          event.cancelBubble = true;
          onSelect(selection);
          return;
        }
        if (vectorDraggable) {
          event.cancelBubble = true;
          onSelect(selection);
          return;
        }
        event.cancelBubble = false;
      }}
      onClick={(event) => {
        if (!isEditMode) return;
        if (componentIndex === ROOT_ELEMENTS_COMPONENT_INDEX) {
          event.cancelBubble = true;
          onSelect(selection);
        }
      }}
      onTap={(event) => {
        if (!isEditMode) return;
        if (componentIndex === ROOT_ELEMENTS_COMPONENT_INDEX) {
          event.cancelBubble = true;
          onSelect(selection);
        }
      }}
      onDblClick={(event) => {
        if (!isEditMode) return;
        event.cancelBubble = true;
        onSelect(selection);
        onOpenEditor(selection);
      }}
      onDblTap={(event) => {
        if (!isEditMode) return;
        event.cancelBubble = true;
        onSelect(selection);
        onOpenEditor(selection);
      }}
      onDragStart={handleVectorDragStart}
      onDragMove={handleVectorDragMove}
      onDragEnd={handleVectorDragEnd}
      onTransformStart={handleTransformStart}
      onTransform={handleTransform}
      onTransformEnd={handleTransformEnd}
    >
      {isEditMode ? (
        <SelectionBoundsRect width={box.width} height={box.height} />
      ) : null}
      {editing ? null : usesHtmlText ? (
        isEditMode ? (
          <Rect
            width={visualBox.width}
            height={visualBox.height}
            fill="rgba(0,0,0,0)"
            listening
            perfectDrawEnabled={false}
            shadowForStrokeEnabled={false}
          />
        ) : null
      ) : (
        <MemoizedRawElementVisual
          element={renderedElement}
          width={visualBox.width}
          height={visualBox.height}
          interactive={isEditMode}
          vectorOriginBox={isVector ? box : null}
          selectedTableCell={selectedCell}
          onTableCellSelect={handleTableCellSelect}
          onTableCellEdit={handleTableCellEdit}
          fontRevision={fontRevision}
        />
      )}
      {showVectorPointHandles ? (
        <VectorVertexHandles
          element={renderedElement}
          originBox={box}
          onCommit={commitVectorVertex}
          onInsert={commitVectorPointInsert}
          onPreview={previewVectorVertex}
          onRemove={commitVectorPointRemove}
          onSelect={() => onSelect(selection)}
        />
      ) : null}
      {laidOutChildren.map(({ child, index, box: childBox, layoutManaged }) => (
        <MemoizedRawElementNode
          key={rawElementKey(child, index)}
          element={child}
          componentIndex={componentIndex}
          elementPath={[...elementPath, index]}
          isEditMode={isEditMode}
          editingKey={editingKey}
          vectorEditingKey={vectorEditingKey}
          selectedTableCell={selectedTableCell}
          selectedKey={selectedKey}
          setNodeRef={setNodeRef}
          onSelect={onSelect}
          onTableCellSelect={onTableCellSelect}
          onTableCellEdit={onTableCellEdit}
          onOpenEditor={onOpenEditor}
          onElementChange={onElementChange}
          onElementDragEnd={onElementDragEnd}
          onElementDragStart={onElementDragStart}
          onElementDragMove={onElementDragMove}
          onElementDragComplete={onElementDragComplete}
          allowVectorResizeBeyondParent={false}
          allowVectorPointEditing={allowVectorPointEditing}
          allowDirectVectorSelection={allowDirectVectorSelection}
          parentBox={{
            x: parentBox.x + box.x,
            y: parentBox.y + box.y,
            width: box.width,
            height: box.height,
          }}
          textConstraintBox={childTextConstraintBox}
          renderBox={childBox}
          layoutManaged={layoutManaged}
          fontRevision={fontRevision}
          renderTextAsHtml={renderTextAsHtml}
        />
      ))}
    </Group>
  );
}

export const MemoizedRawElementNode = memo(RawElementNode, (previous, next) => {
  if (
    previous.element !== next.element ||
    previous.componentIndex !== next.componentIndex ||
    previous.isEditMode !== next.isEditMode ||
    previous.layoutManaged !== next.layoutManaged ||
    previous.allowVectorResizeBeyondParent !==
      next.allowVectorResizeBeyondParent ||
    previous.allowVectorPointEditing !== next.allowVectorPointEditing ||
    previous.allowDirectVectorSelection !== next.allowDirectVectorSelection ||
    previous.fontRevision !== next.fontRevision ||
    previous.renderTextAsHtml !== next.renderTextAsHtml ||
    previous.vectorEditingKey !== next.vectorEditingKey ||
    previous.selectedTableCell !== next.selectedTableCell ||
    previous.selectedKey !== next.selectedKey ||
    previous.setNodeRef !== next.setNodeRef ||
    previous.onSelect !== next.onSelect ||
    previous.onTableCellSelect !== next.onTableCellSelect ||
    previous.onTableCellEdit !== next.onTableCellEdit ||
    previous.onOpenEditor !== next.onOpenEditor ||
    previous.onElementChange !== next.onElementChange ||
    previous.onElementDragEnd !== next.onElementDragEnd ||
    previous.onElementDragStart !== next.onElementDragStart ||
    previous.onElementDragMove !== next.onElementDragMove ||
    previous.onElementDragComplete !== next.onElementDragComplete ||
    !numberPathEqual(previous.elementPath, next.elementPath) ||
    !boxEqual(previous.parentBox, next.parentBox) ||
    !nullableBoxEqual(previous.textConstraintBox, next.textConstraintBox) ||
    !nullableBoxEqual(previous.renderBox, next.renderBox)
  ) {
    return false;
  }
  return !(
    previous.editingKey !== next.editingKey &&
    (selectionTouchesElement(
      previous.editingKey,
      previous.componentIndex,
      previous.elementPath,
    ) ||
      selectionTouchesElement(
        next.editingKey,
        next.componentIndex,
        next.elementPath,
      ))
  );
});

function VectorVertexHandles({
  element,
  originBox,
  onSelect,
  onPreview,
  onCommit,
  onInsert,
  onRemove,
}: {
  element: RawElement;
  originBox: Box;
  onSelect: () => void;
  onPreview: (index: number, point: Point) => void;
  onCommit: (index: number, point: Point) => void;
  onInsert: (afterIndex: number, point: Point) => void;
  onRemove: (index: number) => void;
}) {
  const vertices = vectorVertexEntriesForElement(element);
  if (vertices.length === 0) return null;
  const isEllipse = vectorShapeForElement(element) === "ellipse";
  const closed = isEllipse || (readBoolean(element.closed) ?? vertices.length > 2);
  const canRemove = !isEllipse && vertices.length > (closed ? 3 : 2);
  const edges = isEllipse
    ? []
    : vertices.flatMap((vertex, orderIndex) => {
        const next = vertices[orderIndex + 1] ?? (closed ? vertices[0] : null);
        return next ? [{ current: vertex, next }] : [];
      });

  return (
    <>
      {edges.map(({ current, next }) => {
        const x = (current.point.x + next.point.x) / 2 - originBox.x;
        const y = (current.point.y + next.point.y) / 2 - originBox.y;
        const point = {
          x: originBox.x + x,
          y: originBox.y + y,
        };
        return (
          <Group
            key={`${current.index}:${next.index}`}
            x={x}
            y={y}
            listening
            onMouseDown={(event) => {
              event.cancelBubble = true;
              onSelect();
            }}
            onTouchStart={(event) => {
              event.cancelBubble = true;
              onSelect();
            }}
            onMouseEnter={(event) => setStageCursor(event, "copy")}
            onMouseLeave={(event) => setStageCursor(event, "")}
            onClick={(event) => {
              event.cancelBubble = true;
              onInsert(current.index, point);
            }}
            onTap={(event) => {
              event.cancelBubble = true;
              onInsert(current.index, point);
            }}
          >
            <Circle
              radius={VECTOR_ADD_HANDLE_RADIUS}
              fill={VECTOR_VERTEX_HANDLE_COLOR}
              stroke="#FFFFFF"
              strokeWidth={1}
              hitStrokeWidth={VECTOR_VERTEX_HANDLE_HIT_RADIUS}
              perfectDrawEnabled={false}
            />
            <Text
              x={-VECTOR_ADD_HANDLE_RADIUS}
              y={-VECTOR_ADD_HANDLE_RADIUS - 0.5}
              width={VECTOR_ADD_HANDLE_RADIUS * 2}
              height={VECTOR_ADD_HANDLE_RADIUS * 2}
              align="center"
              verticalAlign="middle"
              fill="#FFFFFF"
              fontSize={11}
              fontStyle="bold"
              listening={false}
              text="+"
            />
          </Group>
        );
      })}
      {vertices.map(({ index, point }) => {
        const x = point.x - originBox.x;
        const y = point.y - originBox.y;
        return (
          <Fragment key={index}>
            <Circle
              x={x}
              y={y}
              radius={VECTOR_VERTEX_HANDLE_RADIUS}
              fill="#FFFFFF"
              stroke={VECTOR_VERTEX_HANDLE_COLOR}
              strokeWidth={VECTOR_VERTEX_HANDLE_STROKE_WIDTH}
              hitStrokeWidth={VECTOR_VERTEX_HANDLE_HIT_RADIUS}
              draggable
              listening
              perfectDrawEnabled={false}
              shadowColor="#101828"
              shadowBlur={4}
              shadowOffsetX={0}
              shadowOffsetY={1}
              shadowOpacity={0.18}
              onMouseDown={(event) => {
                event.cancelBubble = true;
                onSelect();
              }}
              onTouchStart={(event) => {
                event.cancelBubble = true;
                onSelect();
              }}
              onClick={(event) => {
                event.cancelBubble = true;
                if (event.evt.altKey && canRemove) onRemove(index);
              }}
              onTap={(event) => {
                event.cancelBubble = true;
              }}
              onDblClick={(event) => {
                event.cancelBubble = true;
                if (canRemove) onRemove(index);
              }}
              onDblTap={(event) => {
                event.cancelBubble = true;
                if (canRemove) onRemove(index);
              }}
              onMouseEnter={(event) => setStageCursor(event, "move")}
              onMouseLeave={(event) => setStageCursor(event, "")}
              onDragStart={(event) => {
                event.cancelBubble = true;
                onSelect();
              }}
              onDragMove={(event) => {
                event.cancelBubble = true;
                onPreview(index, {
                  x: originBox.x + event.target.x(),
                  y: originBox.y + event.target.y(),
                });
              }}
              onDragEnd={(event) => {
                event.cancelBubble = true;
                onCommit(index, {
                  x: originBox.x + event.target.x(),
                  y: originBox.y + event.target.y(),
                });
              }}
            />
            {canRemove ? (
              <Group
                x={x + VECTOR_DELETE_HANDLE_OFFSET}
                y={y - VECTOR_DELETE_HANDLE_OFFSET}
                listening
                onMouseDown={(event) => {
                  event.cancelBubble = true;
                  onSelect();
                }}
                onTouchStart={(event) => {
                  event.cancelBubble = true;
                  onSelect();
                }}
                onMouseEnter={(event) => setStageCursor(event, "pointer")}
                onMouseLeave={(event) => setStageCursor(event, "")}
                onClick={(event) => {
                  event.cancelBubble = true;
                  onRemove(index);
                }}
                onTap={(event) => {
                  event.cancelBubble = true;
                  onRemove(index);
                }}
              >
                <Circle
                  radius={VECTOR_DELETE_HANDLE_RADIUS}
                  fill={VECTOR_DELETE_HANDLE_COLOR}
                  stroke="#FFFFFF"
                  strokeWidth={1}
                  hitStrokeWidth={VECTOR_VERTEX_HANDLE_HIT_RADIUS}
                  perfectDrawEnabled={false}
                />
                <Text
                  x={-VECTOR_DELETE_HANDLE_RADIUS}
                  y={-VECTOR_DELETE_HANDLE_RADIUS - 0.5}
                  width={VECTOR_DELETE_HANDLE_RADIUS * 2}
                  height={VECTOR_DELETE_HANDLE_RADIUS * 2}
                  align="center"
                  verticalAlign="middle"
                  fill="#FFFFFF"
                  fontSize={9}
                  fontStyle="bold"
                  listening={false}
                  text="x"
                />
              </Group>
            ) : null}
          </Fragment>
        );
      })}
    </>
  );
}

function SelectionBoundsRect({
  width,
  height,
}: {
  width: number;
  height: number;
}) {
  return (
    <Rect
      width={width}
      height={height}
      fill="rgba(0,0,0,0)"
      listening={false}
      perfectDrawEnabled={false}
      shadowForStrokeEnabled={false}
    />
  );
}

function RawElementVisual({
  element,
  width,
  height,
  interactive,
  vectorOriginBox,
  selectedTableCell,
  onTableCellSelect,
  onTableCellEdit,
  fontRevision,
}: {
  element: RawElement;
  width: number;
  height: number;
  interactive: boolean;
  vectorOriginBox?: Box | null;
  selectedTableCell: TableCellSelection | null;
  onTableCellSelect: (rowIndex: number, colIndex: number) => void;
  onTableCellEdit: (rowIndex: number, colIndex: number) => void;
  fontRevision: number;
}) {
  void fontRevision;
  const type = readString(element.type);
  if (isBoxVisualType(type)) {
    const fill = colorWithOpacity(
      fillColor(element.fill),
      fillOpacity(element.fill),
    );
    const stroke = colorWithOpacity(
      strokeColor(element.stroke),
      strokeOpacity(element.stroke),
    );
    if (!fill && !(stroke && strokeWidth(element.stroke) > 0)) return null;
    return (
      <Rect
        width={width}
        height={height}
        fill={fill}
        stroke={stroke}
        strokeWidth={strokeWidth(element.stroke)}
        cornerRadius={borderRadius(element)}
        {...shadowProps(element)}
        listening={interactive}
      />
    );
  }
  if (isVectorType(type)) {
    const vectorShape = vectorShapeForElement(element);
    const stroke = colorWithOpacity(
      strokeColor(element.stroke),
      strokeOpacity(element.stroke),
    );
    const lineWidth = lineStrokeWidth(element);
    const lineDash = readArray(asRecord(element.stroke)?.dash)
      .map(readNumber)
      .filter((value): value is number => value != null);

    if (vectorShape === "ellipse") {
      const fill = colorWithOpacity(fillColor(element.fill), fillOpacity(element.fill));
      if (!fill && !(stroke && lineWidth > 0)) return null;
      return (
        <Ellipse
          x={width / 2}
          y={height / 2}
          radiusX={width / 2}
          radiusY={height / 2}
          fill={fill}
          stroke={stroke}
          strokeWidth={stroke ? lineWidth : 0}
          dash={lineDash.length ? lineDash : undefined}
          hitStrokeWidth={Math.max(20, lineWidth)}
          {...shadowProps(element)}
          listening={interactive}
        />
      );
    }

    const points = polygonLocalPointsForElement(
      element,
      vectorOriginBox ?? undefined,
    );
    const closed = polygonClosedForElement(element);
    const fill = closed
      ? colorWithOpacity(fillColor(element.fill), fillOpacity(element.fill))
      : undefined;
    const polygonStroke = colorWithOpacity(
      strokeColor(element.stroke) ?? (!closed ? "#000000" : undefined),
      strokeOpacity(element.stroke),
    );
    const startMarker = !closed
      ? vectorMarkerStyle(element.start_marker ?? element.startMarker)
      : null;
    const endMarker = !closed
      ? vectorMarkerStyle(element.end_marker ?? element.endMarker)
      : null;
    if (points.length < 4) return null;
    if (!fill && !(polygonStroke && lineWidth > 0)) return null;
    const localPoints = Array.from(
      { length: points.length / 2 },
      (_, index) => ({ x: points[index * 2], y: points[index * 2 + 1] }),
    );
    const firstPoint = localPoints[0];
    const secondPoint = localPoints[1];
    const lastPoint = localPoints[localPoints.length - 1];
    const penultimatePoint = localPoints[localPoints.length - 2];
    return (
      <Group listening={interactive}>
        <Line
          points={points}
          closed={closed}
          fill={fill}
          stroke={polygonStroke}
          strokeWidth={polygonStroke ? lineWidth : 0}
          dash={lineDash.length ? lineDash : undefined}
          hitStrokeWidth={Math.max(20, lineWidth)}
          lineCap="round"
          lineJoin="round"
          {...shadowProps(element)}
          listening={interactive}
        />
        {polygonStroke && startMarker && firstPoint && secondPoint ? (
          <VectorEndpointMarker
            adjacent={secondPoint}
            color={polygonStroke}
            endpoint={firstPoint}
            marker={startMarker}
            strokeWidth={lineWidth}
          />
        ) : null}
        {polygonStroke && endMarker && lastPoint && penultimatePoint ? (
          <VectorEndpointMarker
            adjacent={penultimatePoint}
            color={polygonStroke}
            endpoint={lastPoint}
            marker={endMarker}
            strokeWidth={lineWidth}
          />
        ) : null}
      </Group>
    );
  }
  if (type === "text") {
    return (
      <RawRichTextElement
        element={element}
        width={width}
        height={height}
        interactive={interactive}
      />
    );
  }
  if (type === "text-list") {
    return (
      <RawTextListElement
        element={element}
        width={width}
        height={height}
        interactive={interactive}
      />
    );
  }
  if (type === "image") {
    return <RawImageElement element={element} width={width} height={height} interactive={interactive} />;
  }
  if (type === "table") {
    return (
      <RawTableElement
        element={element}
        width={width}
        height={height}
        interactive={interactive}
        selectedCell={selectedTableCell}
        onCellSelect={onTableCellSelect}
        onCellEdit={onTableCellEdit}
      />
    );
  }
  if (type === "chart") {
    const legendState = Object.prototype.hasOwnProperty.call(element, "legend")
      ? String(element.legend)
      : String(element.showLegend ?? "auto");
    return (
      <RawChartElement
        key={`chart-legend-${legendState}`}
        element={element}
        width={width}
        height={height}
        interactive={interactive}
      />
    );
  }
  if (type === "infographic") {
    return <RawInfographicElement element={element} width={width} height={height} interactive={interactive} />;
  }
  return null;
}

const MemoizedRawElementVisual = memo(
  RawElementVisual,
  (previous, next) =>
    previous.element === next.element &&
    previous.width === next.width &&
    previous.height === next.height &&
    previous.interactive === next.interactive &&
    nullableBoxEqual(previous.vectorOriginBox, next.vectorOriginBox) &&
    previous.selectedTableCell === next.selectedTableCell &&
    previous.onTableCellSelect === next.onTableCellSelect &&
    previous.onTableCellEdit === next.onTableCellEdit &&
    previous.fontRevision === next.fontRevision,
);

function RawRichTextElement({
  element,
  width,
  height,
  text,
  runs: runsOverride,
  interactive,
}: {
  element: RawElement;
  width: number;
  height: number;
  text?: string;
  runs?: RenderTextRun[];
  interactive: boolean;
}) {
  const font = rawFont(element);
  const renderRuns =
    runsOverride ?? (text == null ? rawRenderTextRuns(element) : []);
  const content =
    text ??
    (runsOverride ? textRunsContent(runsOverride) : rawTextContent(element));
  const displayContent = displayText(content);
  const align = readString(element.alignment?.horizontal) ?? "left";
  const verticalAlign = readString(element.alignment?.vertical) ?? "top";
  const textLineHeight = effectiveLineHeight({
    text: displayContent,
    width,
    fontSize: font.size,
    lineHeight: font.lineHeight,
    fallback: 1.15,
    wrap: "word",
  });

  const layoutRuns =
    renderRuns.length > 0 ? renderRuns : [{ text: displayContent, font }];
  const lines = layoutRenderTextRuns(layoutRuns, width, "word");
  const lineMetrics = lines.map((line) => ({
    height: lineRenderHeight(line, textLineHeight),
    width: line.reduce((sum, segment) => sum + segment.width, 0),
  }));
  const totalHeight = lineMetrics.reduce(
    (sum, metric) => sum + metric.height,
    0,
  );
  const startY =
    verticalAlign === "middle"
      ? Math.max(0, (height - totalHeight) / 2)
      : verticalAlign === "bottom"
        ? Math.max(0, height - totalHeight)
        : 0;
  let y = startY;

  return (
    <Group listening={interactive}>
      {lines.map((line, lineIndex) => {
        const lineMetric = lineMetrics[lineIndex] ?? {
          height: font.size * textLineHeight,
          width: 0,
        };
        const startX = lineStartX(align, width, lineMetric.width, false);
        const justifyGapCount =
          align === "justify" && lineIndex < lines.length - 1
            ? line.filter(
                (segment, segmentIndex) =>
                  segmentIndex < line.length - 1 &&
                  segment.type !== "latex" &&
                  /^\s+$/.test(segment.text),
              ).length
            : 0;
        const justifyGapWidth =
          justifyGapCount > 0
            ? Math.max(0, width - lineMetric.width) / justifyGapCount
            : 0;
        let x = startX;
        const lineY = y;
        y += lineMetric.height;
        return line.map((segment, segmentIndex) => {
          const segmentX = x;
          x +=
            segment.width +
            (segmentIndex < line.length - 1 &&
            segment.type !== "latex" &&
            /^\s+$/.test(segment.text)
              ? justifyGapWidth
              : 0);
          if (segment.type === "latex" && segment.latex) {
            return (
              <LatexRunNode
                key={`${lineIndex}:${segmentIndex}`}
                x={segmentX}
                y={lineY}
                width={segment.width}
                height={lineMetric.height}
                latex={segment.latex}
                displayMode={segment.displayMode}
                fontSize={segment.font.size}
                color={textFill(segment.font) ?? "#111827"}
                interactive={interactive}
              />
            );
          }
          // Keep width automatic. The custom layout owns the x advance; a fixed
          // tight width lets Konva re-wrap and clip the final glyph.
          return (
            <Text
              key={`${lineIndex}:${segmentIndex}`}
              x={segmentX}
              y={lineY}
              height={lineMetric.height}
              text={renderKonvaTextSegment(segment.text)}
              fill={textFill(segment.font)}
              fontFamily={`${segment.font.family}, Helvetica, sans-serif`}
              fontSize={segment.font.size}
              fontStyle={`${segment.font.bold ? "bold" : "normal"} ${segment.font.italic ? "italic" : ""}`}
              textDecoration={segment.font.underline ? "underline" : ""}
              verticalAlign="middle"
              lineHeight={segment.font.lineHeight ?? textLineHeight}
              letterSpacing={segment.font.letterSpacing}
              wrap="none"
              {...shadowProps(element)}
              listening={interactive}
            />
          );
        });
      })}
    </Group>
  );
}

function textFill(font: { color: string; opacity?: number | null }) {
  return colorWithOpacity(withHash(font.color), font.opacity ?? 1);
}

function RawTextListElement({
  element,
  width,
  height,
  interactive,
}: {
  element: RawElement;
  width: number;
  height: number;
  interactive: boolean;
}) {
  const { tokens } = layoutTextListRenderItems(element, width, height);

  return (
    <Group listening={interactive}>
      {tokens.map((token, tokenIndex) => (
        token.type === "latex" && token.latex ? (
          <LatexRunNode
            key={`${tokenIndex}:${token.x}:${token.y}`}
            x={token.x}
            y={token.y}
            width={token.width}
            height={token.height}
            latex={token.latex}
            displayMode={token.displayMode}
            fontSize={token.font.size}
            color={textFill(token.font) ?? "#111827"}
            interactive={interactive}
          />
        ) : (
          <Text
            key={`${tokenIndex}:${token.x}:${token.y}`}
            x={token.x}
            y={token.y}
            height={token.height}
            text={renderKonvaTextSegment(token.text)}
            fill={textFill(token.font)}
            fontFamily={`${token.font.family}, Helvetica, sans-serif`}
            fontSize={token.font.size}
            fontStyle={`${token.font.bold ? "bold" : "normal"} ${token.font.italic ? "italic" : ""}`}
            textDecoration={token.font.underline ? "underline" : ""}
            verticalAlign="middle"
            lineHeight={token.font.lineHeight}
            letterSpacing={token.font.letterSpacing}
            wrap="none"
            {...shadowProps(element)}
            listening={interactive}
          />
        )
      ))}
    </Group>
  );
}

function RawImageElement({
  element,
  width,
  height,
  interactive,
}: {
  element: RawElement;
  width: number;
  height: number;
  interactive: boolean;
}) {
  const src = readString(element.data);
  const color = readString(element.color);
  const isIcon = isRawIconElement(element);
  const renderSrc = useMemo(() => {
    if (!src || !isIcon || typeof window === "undefined") return src;
    const baseUrl = window.location.href;
    if (!isStaticSvgIconSource(src, baseUrl)) return src;
    return buildSvgUpdateUrl(src, baseUrl, { color, forceRoute: true }) ?? src;
  }, [color, isIcon, src]);
  const loaded = useLoadedKonvaImage(renderSrc);

  if (!loaded) {
    return (
      <Rect
        width={width}
        height={height}
        fill="#EEF1F5"
        stroke="#CBD2D9"
        strokeWidth={1}
        listening={interactive}
      />
    );
  }

  const fit = imageFit(element.fit);
  const focusX = clamp(readNumber(element.focus_x) ?? 50, 0, 100) / 100;
  const focusY = clamp(readNumber(element.focus_y) ?? 50, 0, 100) / 100;
  const cropScale = clamp(readNumber(element.crop_scale) ?? 1, 0.1, 6);
  const flipH = readBoolean(element.flip_h) === true;
  const flipV = readBoolean(element.flip_v) === true;
  const clipPath = imageClipPath(element);
  const cornerRadii = imageCornerRadii(element, width, height);
  const naturalRatio = loaded.width / loaded.height || 1;
  const boxRatio = width / height || 1;
  let drawW = width;
  let drawH = height;
  let offsetX = 0;
  let offsetY = 0;
  let crop:
    | {
      x: number;
      y: number;
      width: number;
      height: number;
    }
    | undefined;

  if (fit === "cover") {
    if (cropScale < 1) {
      if (naturalRatio > boxRatio) {
        drawW = height * naturalRatio * cropScale;
        drawH = height * cropScale;
      } else {
        drawW = width * cropScale;
        drawH = (width / naturalRatio) * cropScale;
      }
      offsetX =
        drawW <= width
          ? (width - drawW) * focusX
          : -(drawW - width) * focusX;
      offsetY =
        drawH <= height
          ? (height - drawH) * focusY
          : -(drawH - height) * focusY;
    } else if (naturalRatio > boxRatio) {
      const baseCropWidth = loaded.height * boxRatio;
      const cropWidth = Math.min(loaded.width, baseCropWidth / cropScale);
      const cropHeight = Math.min(loaded.height, loaded.height / cropScale);
      crop = {
        x: Math.max(0, (loaded.width - cropWidth) * focusX),
        y: Math.max(0, (loaded.height - cropHeight) * focusY),
        width: cropWidth,
        height: cropHeight,
      };
    } else {
      const baseCropHeight = loaded.width / boxRatio;
      const cropWidth = Math.min(loaded.width, loaded.width / cropScale);
      const cropHeight = Math.min(loaded.height, baseCropHeight / cropScale);
      crop = {
        x: Math.max(0, (loaded.width - cropWidth) * focusX),
        y: Math.max(0, (loaded.height - cropHeight) * focusY),
        width: cropWidth,
        height: cropHeight,
      };
    }
  } else if (fit === "contain") {
    if (naturalRatio > boxRatio) {
      drawH = width / naturalRatio;
      offsetY = (height - drawH) * focusY;
    } else {
      drawW = height * naturalRatio;
      offsetX = (width - drawW) * focusX;
    }
  }

  const imageNode = (
    <KonvaImage
      image={loaded}
      x={offsetX}
      y={offsetY}
      width={drawW}
      height={drawH}
      crop={crop}
      listening={interactive}
    />
  );

  const contentNode = clipPath || flipH || flipV ? (
    <Group
      x={flipH ? width : 0}
      y={flipV ? height : 0}
      width={width}
      height={height}
      scaleX={flipH ? -1 : 1}
      scaleY={flipV ? -1 : 1}
      clipFunc={
        clipPath
          ? (context) => drawImageClipPath(context, clipPath, width, height)
          : undefined
      }
      listening={interactive}
    >
      {imageNode}
    </Group>
  ) : (
    imageNode
  );

  return (
    <Group
      clipFunc={(context) =>
        drawRoundedImageClip(context, width, height, cornerRadii)
      }
      listening={interactive}
    >
      {contentNode}
    </Group>
  );
}

function imageFit(value: unknown): "contain" | "cover" | "fill" {
  const fit = readString(value);
  return fit === "contain" || fit === "cover" || fit === "fill"
    ? fit
    : "contain";
}

type ParsedImageClipPath =
  | { kind: "polygon"; points: Point[] }
  | { kind: "path"; data: string }
  | {
    kind: "inset";
    top: number;
    right: number;
    bottom: number;
    left: number;
    radius: number;
  }
  | { kind: "rect"; x: number; y: number; width: number; height: number; radius: number }
  | { kind: "circle"; x: number; y: number; radius: number }
  | { kind: "ellipse"; x: number; y: number; radiusX: number; radiusY: number };

function imageClipPath(element: RawElement): string | null {
  const raw = readString(element.clippath ?? element.clipPath ?? element.clip_path);
  const clipPath = raw?.trim();
  return clipPath && clipPath.toLowerCase() !== "none" ? clipPath : null;
}

function drawImageClipPath(
  context: Konva.Context,
  clipPath: string,
  width: number,
  height: number,
) {
  const parsed = parseImageClipPath(clipPath, width, height);
  if (!parsed) {
    context.rect(0, 0, width, height);
    return;
  }

  if (parsed.kind === "path") {
    if (typeof Path2D !== "undefined") {
      try {
        return [new Path2D(parsed.data)] as [Path2D];
      } catch {
        // Fall through to the basic path drawer below.
      }
    }
    if (drawBasicSvgClipPath(context, parsed.data)) return;
    context.rect(0, 0, width, height);
    return;
  }

  if (parsed.kind === "polygon") {
    parsed.points.forEach((point, index) => {
      if (index === 0) context.moveTo(point.x, point.y);
      else context.lineTo(point.x, point.y);
    });
    context.closePath();
    return;
  }

  if (parsed.kind === "inset") {
    const x = parsed.left;
    const y = parsed.top;
    const insetWidth = Math.max(0, width - parsed.left - parsed.right);
    const insetHeight = Math.max(0, height - parsed.top - parsed.bottom);
    const radius = Math.min(parsed.radius, insetWidth / 2, insetHeight / 2);
    if (radius > 0) {
      context.roundRect(x, y, insetWidth, insetHeight, radius);
    } else {
      context.rect(x, y, insetWidth, insetHeight);
    }
    return;
  }

  if (parsed.kind === "rect") {
    const radius = Math.min(parsed.radius, parsed.width / 2, parsed.height / 2);
    if (radius > 0) {
      context.roundRect(parsed.x, parsed.y, parsed.width, parsed.height, radius);
    } else {
      context.rect(parsed.x, parsed.y, parsed.width, parsed.height);
    }
    return;
  }

  if (parsed.kind === "circle") {
    context.arc(parsed.x, parsed.y, parsed.radius, 0, Math.PI * 2);
    return;
  }

  context.ellipse(
    parsed.x,
    parsed.y,
    parsed.radiusX,
    parsed.radiusY,
    0,
    0,
    Math.PI * 2,
  );
}

function parseImageClipPath(
  value: string,
  width: number,
  height: number,
): ParsedImageClipPath | null {
  const pathData = clipPathDataFromValue(value);
  if (pathData) return { kind: "path", data: pathData };

  const clipFunction = readCssClipFunction(value);
  if (!clipFunction) return null;

  const { kind, body } = clipFunction;
  if (kind === "polygon") return parsePolygonClipPath(body, width, height);
  if (kind === "inset") return parseInsetClipPath(body, width, height);
  if (kind === "rect") return parseRectClipPath(body, width, height);
  if (kind === "xywh") return parseXywhClipPath(body, width, height);
  if (kind === "circle") return parseCircleClipPath(body, width, height);
  if (kind === "ellipse") return parseEllipseClipPath(body, width, height);
  return null;
}

function parsePolygonClipPath(
  body: string,
  width: number,
  height: number,
): ParsedImageClipPath | null {
  const pointSource = body.replace(/^(evenodd|nonzero)\s*,\s*/i, "");
  const rawPoints = pointSource.split(/\s*,\s*/).filter(Boolean);
  const points =
    rawPoints.length >= 3
      ? rawPoints.map((point) => parseClipPoint(point, width, height))
      : parseClipPointPairs(splitCssTokens(pointSource), width, height);

  if (points.length < 3 || points.some((point) => point == null)) return null;
  return {
    kind: "polygon",
    points: points as Point[],
  };
}

function parseInsetClipPath(
  body: string,
  width: number,
  height: number,
): ParsedImageClipPath | null {
  const [insetPart, radiusPart] = splitCssRound(body);
  const values = splitCssTokens(insetPart);
  if (values.length === 0) return null;

  const top = parseClipLength(values[0], height);
  const right = parseClipLength(values[1] ?? values[0], width);
  const bottom = parseClipLength(values[2] ?? values[0], height);
  const left = parseClipLength(values[3] ?? values[1] ?? values[0], width);
  if (top == null || right == null || bottom == null || left == null) {
    return null;
  }

  const radius = parseClipBoxRadius(radiusPart, width, height);
  return {
    kind: "inset",
    top,
    right,
    bottom,
    left,
    radius,
  };
}

function parseRectClipPath(
  body: string,
  width: number,
  height: number,
): ParsedImageClipPath | null {
  const [rectPart, radiusPart] = splitCssRound(body);
  const values = splitCssTokens(rectPart);
  if (values.length < 4) return null;

  const top = parseClipLength(values[0], height);
  const right = parseClipLength(values[1], width);
  const bottom = parseClipLength(values[2], height);
  const left = parseClipLength(values[3], width);
  if (top == null || right == null || bottom == null || left == null) {
    return null;
  }

  return {
    kind: "rect",
    x: left,
    y: top,
    width: Math.max(0, right - left),
    height: Math.max(0, bottom - top),
    radius: parseClipBoxRadius(radiusPart, width, height),
  };
}

function parseXywhClipPath(
  body: string,
  width: number,
  height: number,
): ParsedImageClipPath | null {
  const [boxPart, radiusPart] = splitCssRound(body);
  const values = splitCssTokens(boxPart);
  if (values.length < 4) return null;

  const x = parseClipLength(values[0], width);
  const y = parseClipLength(values[1], height);
  const rectWidth = parseClipLength(values[2], width);
  const rectHeight = parseClipLength(values[3], height);
  if (x == null || y == null || rectWidth == null || rectHeight == null) {
    return null;
  }

  return {
    kind: "rect",
    x,
    y,
    width: Math.max(0, rectWidth),
    height: Math.max(0, rectHeight),
    radius: parseClipBoxRadius(radiusPart, width, height),
  };
}

function parseCircleClipPath(
  body: string,
  width: number,
  height: number,
): ParsedImageClipPath | null {
  const [radiusPart, positionPart] = splitCssAt(body);
  const radiusToken = splitCssTokens(radiusPart)[0];
  const center = parseClipPosition(positionPart, width, height);
  if (!center) return null;
  const radius = radiusToken
    ? parseCircleRadius(radiusToken, center, width, height)
    : Math.min(center.x, width - center.x, center.y, height - center.y);
  if (radius == null || !center) return null;
  return {
    kind: "circle",
    x: center.x,
    y: center.y,
    radius,
  };
}

function parseEllipseClipPath(
  body: string,
  width: number,
  height: number,
): ParsedImageClipPath | null {
  const [radiusPart, positionPart] = splitCssAt(body);
  const radiusTokens = splitCssTokens(radiusPart);
  const center = parseClipPosition(positionPart, width, height);
  if (!center) return null;
  const radiusX = radiusTokens[0]
    ? parseEllipseRadius(radiusTokens[0], center.x, width)
    : Math.min(center.x, width - center.x);
  const radiusY = radiusTokens[1]
    ? parseEllipseRadius(radiusTokens[1], center.y, height)
    : radiusTokens[0]
      ? parseEllipseRadius(radiusTokens[0], center.y, height)
      : Math.min(center.y, height - center.y);
  if (radiusX == null || radiusY == null || !center) return null;
  return {
    kind: "ellipse",
    x: center.x,
    y: center.y,
    radiusX,
    radiusY,
  };
}

function parseClipBoxRadius(
  value: string | null,
  width: number,
  height: number,
) {
  const radiusToken = value ? splitCssTokens(value)[0] : null;
  return radiusToken
    ? parseClipLength(radiusToken, Math.min(width, height)) ?? 0
    : 0;
}

function parseCircleRadius(
  token: string,
  center: Point,
  width: number,
  height: number,
) {
  const normalized = token.toLowerCase();
  if (normalized === "closest-side") {
    return Math.min(center.x, width - center.x, center.y, height - center.y);
  }
  if (normalized === "farthest-side") {
    return Math.max(center.x, width - center.x, center.y, height - center.y);
  }
  return parseClipLength(token, Math.min(width, height));
}

function parseEllipseRadius(token: string, center: number, size: number) {
  const normalized = token.toLowerCase();
  if (normalized === "closest-side") return Math.min(center, size - center);
  if (normalized === "farthest-side") return Math.max(center, size - center);
  return parseClipLength(token, size);
}

function drawBasicSvgClipPath(context: Konva.Context, data: string) {
  const tokens =
    data.match(/[AaCcHhLlMmQqSsTtVvZz]|[-+]?(?:\d*\.\d+|\d+\.?)(?:e[-+]?\d+)?/g) ??
    [];
  let index = 0;
  let command = "";
  let current: Point = { x: 0, y: 0 };
  let subpathStart: Point = { x: 0, y: 0 };
  let lastCubicControl: Point | null = null;
  let lastQuadraticControl: Point | null = null;

  const isCommand = (token: string | undefined) =>
    Boolean(token && /^[A-Za-z]$/.test(token));
  const readPathNumber = () => {
    const token = tokens[index];
    if (token == null || isCommand(token)) return null;
    index += 1;
    const value = Number.parseFloat(token);
    return Number.isFinite(value) ? value : null;
  };
  const readPoint = (relative: boolean): Point | null => {
    const x = readPathNumber();
    const y = readPathNumber();
    if (x == null || y == null) return null;
    return relative ? { x: current.x + x, y: current.y + y } : { x, y };
  };
  const reflectPoint = (point: Point | null) =>
    point ? { x: current.x * 2 - point.x, y: current.y * 2 - point.y } : current;

  while (index < tokens.length) {
    if (isCommand(tokens[index])) {
      command = tokens[index] ?? "";
      index += 1;
    } else if (!command) {
      return false;
    }

    const relative = command === command.toLowerCase();
    switch (command.toLowerCase()) {
      case "m": {
        const point = readPoint(relative);
        if (!point) return false;
        context.moveTo(point.x, point.y);
        current = point;
        subpathStart = point;
        command = relative ? "l" : "L";
        lastCubicControl = null;
        lastQuadraticControl = null;
        break;
      }
      case "l": {
        const point = readPoint(relative);
        if (!point) return false;
        context.lineTo(point.x, point.y);
        current = point;
        lastCubicControl = null;
        lastQuadraticControl = null;
        break;
      }
      case "h": {
        const value = readPathNumber();
        if (value == null) return false;
        current = { x: relative ? current.x + value : value, y: current.y };
        context.lineTo(current.x, current.y);
        lastCubicControl = null;
        lastQuadraticControl = null;
        break;
      }
      case "v": {
        const value = readPathNumber();
        if (value == null) return false;
        current = { x: current.x, y: relative ? current.y + value : value };
        context.lineTo(current.x, current.y);
        lastCubicControl = null;
        lastQuadraticControl = null;
        break;
      }
      case "c": {
        const control1 = readPoint(relative);
        const control2 = readPoint(relative);
        const point = readPoint(relative);
        if (!control1 || !control2 || !point) return false;
        context.bezierCurveTo(
          control1.x,
          control1.y,
          control2.x,
          control2.y,
          point.x,
          point.y,
        );
        current = point;
        lastCubicControl = control2;
        lastQuadraticControl = null;
        break;
      }
      case "s": {
        const control1 = reflectPoint(lastCubicControl);
        const control2 = readPoint(relative);
        const point = readPoint(relative);
        if (!control2 || !point) return false;
        context.bezierCurveTo(
          control1.x,
          control1.y,
          control2.x,
          control2.y,
          point.x,
          point.y,
        );
        current = point;
        lastCubicControl = control2;
        lastQuadraticControl = null;
        break;
      }
      case "q": {
        const control = readPoint(relative);
        const point = readPoint(relative);
        if (!control || !point) return false;
        context.quadraticCurveTo(control.x, control.y, point.x, point.y);
        current = point;
        lastCubicControl = null;
        lastQuadraticControl = control;
        break;
      }
      case "t": {
        const control = reflectPoint(lastQuadraticControl);
        const point = readPoint(relative);
        if (!point) return false;
        context.quadraticCurveTo(control.x, control.y, point.x, point.y);
        current = point;
        lastCubicControl = null;
        lastQuadraticControl = control;
        break;
      }
      case "z": {
        context.closePath();
        current = subpathStart;
        command = "";
        lastCubicControl = null;
        lastQuadraticControl = null;
        break;
      }
      default:
        return false;
    }
  }

  return true;
}

function parseClipPoint(
  value: string,
  width: number,
  height: number,
): Point | null {
  const [rawX, rawY] = splitCssTokens(value);
  const x = parseClipLength(rawX, width);
  const y = parseClipLength(rawY, height);
  return x == null || y == null ? null : { x, y };
}

function parseClipPointPairs(
  tokens: string[],
  width: number,
  height: number,
) {
  const points: Array<Point | null> = [];
  for (let index = 0; index < tokens.length; index += 2) {
    points.push(parseClipPoint(`${tokens[index]} ${tokens[index + 1]}`, width, height));
  }
  return points;
}

function parseClipPosition(
  value: string | null,
  width: number,
  height: number,
): Point | null {
  const tokens = splitCssTokens(value ?? "");
  if (tokens.length === 0) return { x: width / 2, y: height / 2 };
  if (tokens.length === 1) {
    const token = tokens[0].toLowerCase();
    if (token === "center") return { x: width / 2, y: height / 2 };
    if (token === "left" || token === "right") {
      return {
        x: parseClipPositionLength(token, width, "left", "right") ?? width / 2,
        y: height / 2,
      };
    }
    if (token === "top" || token === "bottom") {
      return {
        x: width / 2,
        y: parseClipPositionLength(token, height, "top", "bottom") ?? height / 2,
      };
    }
    const x = parseClipLength(token, width);
    return x == null ? null : { x, y: height / 2 };
  }

  const x = parseClipPositionLength(tokens[0], width, "left", "right");
  const y = parseClipPositionLength(tokens[1], height, "top", "bottom");
  return x == null || y == null ? null : { x, y };
}

function parseClipPositionLength(
  token: string | undefined,
  reference: number,
  startKeyword: string,
  endKeyword: string,
) {
  if (!token) return null;
  const normalized = token.toLowerCase();
  if (normalized === "center") return reference / 2;
  if (normalized === startKeyword) return 0;
  if (normalized === endKeyword) return reference;
  return parseClipLength(normalized, reference);
}

function parseClipLength(token: string | undefined, reference: number) {
  if (!token) return null;
  const normalized = token.trim().toLowerCase();
  if (!normalized) return null;
  if (normalized.endsWith("%")) {
    const value = Number.parseFloat(normalized.slice(0, -1));
    return Number.isFinite(value) ? (value / 100) * reference : null;
  }
  if (normalized.endsWith("px")) {
    const value = Number.parseFloat(normalized.slice(0, -2));
    return Number.isFinite(value) ? value : null;
  }
  const value = Number.parseFloat(normalized);
  return Number.isFinite(value) ? value : null;
}

function splitCssAt(value: string): [string, string | null] {
  const parts = value.split(/\s+at\s+/i);
  return [parts[0]?.trim() ?? "", parts[1]?.trim() ?? null];
}

function splitCssRound(value: string): [string, string | null] {
  const parts = value.split(/\s+round\s+/i);
  return [parts[0]?.trim() ?? "", parts[1]?.trim() ?? null];
}

function splitCssTokens(value: string) {
  return value.trim().split(/\s+/).filter(Boolean);
}

function readCssClipFunction(value: string) {
  const match = /([a-z-]+)\(/i.exec(value);
  if (!match || match.index == null) return null;

  const kind = match[1].toLowerCase();
  const bodyStart = match.index + match[0].length;
  let depth = 1;
  let quote: string | null = null;

  for (let index = bodyStart; index < value.length; index += 1) {
    const char = value[index];
    if (quote) {
      if (char === "\\" && index + 1 < value.length) {
        index += 1;
        continue;
      }
      if (char === quote) quote = null;
      continue;
    }
    if (char === "'" || char === '"') {
      quote = char;
      continue;
    }
    if (char === "(") {
      depth += 1;
      continue;
    }
    if (char === ")") {
      depth -= 1;
      if (depth === 0) {
        return {
          kind,
          body: value.slice(bodyStart, index).trim(),
        };
      }
    }
  }

  return null;
}

function clipPathDataFromValue(value: string) {
  const clipFunction = readCssClipFunction(value);
  if (clipFunction?.kind === "path") {
    const data = extractCssPathData(clipFunction.body);
    return data && isSafeSvgClipPathData(data) ? data : null;
  }

  const data = extractCssPathData(value);
  return data && isSafeSvgClipPathData(data) ? data : null;
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

function useLoadedKonvaImage(src: string | null): HTMLImageElement | null {
  const [loaded, setLoaded] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    if (!src) {
      setLoaded(null);
      return;
    }

    let cancelled = false;
    void loadKonvaImage(src).then((image) => {
      if (!cancelled) setLoaded(image);
    });

    return () => {
      cancelled = true;
    };
  }, [src]);

  return loaded;
}

function imageCornerRadii(
  element: RawElement,
  width: number,
  height: number,
): [number, number, number, number] {
  const rawRadius = borderRadius(element);
  const values = Array.isArray(rawRadius)
    ? rawRadius
    : [rawRadius, rawRadius, rawRadius, rawRadius];
  const maxRadius = Math.max(0, Math.min(width, height) / 2);
  return [
    clamp(values[0] ?? 0, 0, maxRadius),
    clamp(values[1] ?? 0, 0, maxRadius),
    clamp(values[2] ?? 0, 0, maxRadius),
    clamp(values[3] ?? 0, 0, maxRadius),
  ];
}

function drawRoundedImageClip(
  context: Konva.Context,
  width: number,
  height: number,
  [topLeft, topRight, bottomRight, bottomLeft]: [
    number,
    number,
    number,
    number,
  ],
) {
  context.beginPath();
  context.moveTo(topLeft, 0);
  context.lineTo(width - topRight, 0);
  context.quadraticCurveTo(width, 0, width, topRight);
  context.lineTo(width, height - bottomRight);
  context.quadraticCurveTo(width, height, width - bottomRight, height);
  context.lineTo(bottomLeft, height);
  context.quadraticCurveTo(0, height, 0, height - bottomLeft);
  context.lineTo(0, topLeft);
  context.quadraticCurveTo(0, 0, topLeft, 0);
  context.closePath();
}



function RawInfographicElement({
  element,
  width,
  height,
  interactive,
}: {
  element: RawElement;
  width: number;
  height: number;
  interactive: boolean;
}) {
  const data = asRecord(element.data);
  const colors = readArray(element.colors);
  const infographicType =
    readString(data?.type) ??
    readString(element.infographic_type) ??
    "gauge";
  const progress = valueProgress(element);
  const baseColor =
    withHash(readString(colors[0])) ??
    withHash(readString(element.base_color)) ??
    "#E5E7EB";
  const highlightColor =
    withHash(readString(colors[1])) ??
    withHash(readString(element.highlight_color)) ??
    "#2563EB";
  const palette = [
    highlightColor,
    ...colors.slice(2).map((color) => withHash(readString(color))).filter(Boolean),
  ] as string[];
  const customTextColor = withHash(readString(element.text_color)) ?? null;

  if (infographicType === "gantt") {
    return (
      <RawGanttInfographic
        data={data}
        width={width}
        height={height}
        interactive={interactive}
        baseColor={baseColor}
        palette={palette}
        textColor={customTextColor}
      />
    );
  }

  if (infographicType === "timeline") {
    return (
      <RawTimelineInfographic
        data={data}
        width={width}
        height={height}
        interactive={interactive}
        baseColor={baseColor}
        palette={palette}
        textColor={customTextColor}
      />
    );
  }

  if (infographicType === "roadmap") {
    return (
      <RawRoadmapInfographic
        data={data}
        width={width}
        height={height}
        interactive={interactive}
        baseColor={baseColor}
        palette={palette}
        textColor={customTextColor}
      />
    );
  }

  if (infographicType === "milestone_timeline") {
    return (
      <RawMilestoneTimelineInfographic
        data={data}
        width={width}
        height={height}
        interactive={interactive}
        baseColor={baseColor}
        palette={palette}
        textColor={customTextColor}
      />
    );
  }

  if (infographicType === "staircase") {
    return (
      <RawStaircaseInfographic
        data={data}
        width={width}
        height={height}
        interactive={interactive}
        baseColor={baseColor}
        palette={palette}
        textColor={customTextColor}
      />
    );
  }

  if (infographicType === "supply_chain") return <RawSupplyChainInfographic data={data} width={width} height={height} interactive={interactive} baseColor={baseColor} palette={palette} textColor={customTextColor} />;
  if (infographicType === "stair_step_blocks") return <RawStairStepBlocksInfographic data={data} width={width} height={height} interactive={interactive} baseColor={baseColor} palette={palette} textColor={customTextColor} />;
  if (infographicType === "maturity_model") return <RawMaturityModelInfographic data={data} width={width} height={height} interactive={interactive} baseColor={baseColor} palette={palette} textColor={customTextColor} />;
  if (infographicType === "pillar_framework") return <RawPillarFrameworkInfographic data={data} width={width} height={height} interactive={interactive} baseColor={baseColor} palette={palette} textColor={customTextColor} />;
  if (infographicType === "transformation_hub") return <RawTransformationHubInfographic data={data} width={width} height={height} interactive={interactive} baseColor={baseColor} palette={palette} textColor={customTextColor} />;
  if (infographicType === "diagonal_circles") return <RawDiagonalCirclesInfographic data={data} width={width} height={height} interactive={interactive} baseColor={baseColor} palette={palette} textColor={customTextColor} />;
  if (infographicType === "risk_matrix") return <RawRiskMatrixInfographic data={data} width={width} height={height} interactive={interactive} baseColor={baseColor} palette={palette} textColor={customTextColor} />;

  if (infographicType === "chevron_process") {
    return (
      <RawChevronProcessInfographic
        data={data}
        width={width}
        height={height}
        interactive={interactive}
        baseColor={baseColor}
        palette={palette}
        textColor={customTextColor}
      />
    );
  }

  if (infographicType === "radial_cycle") {
    return (
      <RawRadialCycleInfographic
        data={data}
        width={width}
        height={height}
        interactive={interactive}
        baseColor={baseColor}
        palette={palette}
        textColor={customTextColor}
      />
    );
  }

  if (infographicType === "conversion_funnel") {
    return (
      <RawConversionFunnelInfographic
        data={data}
        width={width}
        height={height}
        interactive={interactive}
        baseColor={baseColor}
        palette={palette}
        textColor={customTextColor}
      />
    );
  }

  if (infographicType === "pyramid") {
    return (
      <RawPyramidInfographic
        data={data}
        width={width}
        height={height}
        interactive={interactive}
        baseColor={baseColor}
        palette={palette}
        textColor={customTextColor}
      />
    );
  }

  if (infographicType === "segmented_wheel") {
    return (
      <RawSegmentedWheelInfographic
        data={data}
        width={width}
        height={height}
        interactive={interactive}
        baseColor={baseColor}
        palette={palette}
        textColor={customTextColor}
      />
    );
  }

  if (infographicType === "customer_journey") {
    return (
      <RawCustomerJourneyInfographic
        data={data}
        width={width}
        height={height}
        interactive={interactive}
        baseColor={baseColor}
        palette={palette}
        textColor={customTextColor}
      />
    );
  }

  if (infographicType === "before_after") {
    return (
      <RawBeforeAfterInfographic
        data={data}
        width={width}
        height={height}
        interactive={interactive}
        baseColor={baseColor}
        palette={palette}
        textColor={customTextColor}
      />
    );
  }

  if (infographicType === "impact_effort_matrix") {
    return <RawImpactEffortInfographic data={data} width={width} height={height} interactive={interactive} baseColor={baseColor} palette={palette} textColor={customTextColor} />;
  }

  if (infographicType === "comparison_matrix") {
    return <RawComparisonMatrixInfographic data={data} width={width} height={height} interactive={interactive} baseColor={baseColor} palette={palette} textColor={customTextColor} />;
  }

  if (infographicType === "org_chart" || infographicType === "decision_tree") {
    return <RawHierarchyInfographic type={infographicType} data={data} width={width} height={height} interactive={interactive} baseColor={baseColor} palette={palette} textColor={customTextColor} />;
  }

  if (infographicType === "mind_map") {
    return (
      <RawMindMapInfographic
        data={data}
        width={width}
        height={height}
        interactive={interactive}
        baseColor={baseColor}
        palette={palette}
        textColor={customTextColor}
      />
    );
  }

  const value =
    readNumber(data?.value) ??
    readNumber(element.value) ??
    0;

  if (infographicType === "progress_bar") {
    const radius = Math.min(height / 2, 8);
    return (
      <Group listening={interactive} {...shadowProps(element)}>
        <Rect width={width} height={height} cornerRadius={radius} fill={baseColor} />
        <Rect
          width={width * progress}
          height={height}
          cornerRadius={radius}
          fill={highlightColor}
        />
      </Group>
    );
  }

  const valueAngle = 180 * progress;
  const thickness = Math.max(6, Math.min(width, height) * 0.18);
  const outerRadius = Math.max(1, Math.min(width * 0.43, height * 0.86));
  const innerRadius = Math.max(1, outerRadius - thickness);
  const middleRadius = (outerRadius + innerRadius) / 2;
  const capRadius = thickness / 2;
  const centerX = width / 2;
  const centerY = Math.min(height - capRadius, height * 0.86);
  const start = pointOnCircle(centerX, centerY, middleRadius, 180);
  const end = pointOnCircle(centerX, centerY, middleRadius, 180 + valueAngle);
  return (
    <Group listening={interactive} {...shadowProps(element)}>
      <Arc
        x={centerX}
        y={centerY}
        innerRadius={innerRadius}
        outerRadius={outerRadius}
        angle={180}
        rotation={180}
        fill={baseColor}
      />
      <Circle x={start.x} y={start.y} radius={capRadius} fill={baseColor} />
      <Circle
        x={pointOnCircle(centerX, centerY, middleRadius, 360).x}
        y={pointOnCircle(centerX, centerY, middleRadius, 360).y}
        radius={capRadius}
        fill={baseColor}
      />
      {valueAngle > 0 ? (
        <>
          <Arc
            x={centerX}
            y={centerY}
            innerRadius={innerRadius}
            outerRadius={outerRadius}
            angle={valueAngle}
            rotation={180}
            fill={highlightColor}
          />
          <Circle x={start.x} y={start.y} radius={capRadius} fill={highlightColor} />
          <Circle x={end.x} y={end.y} radius={capRadius} fill={highlightColor} />
        </>
      ) : null}
      <Text
        x={0}
        y={height * 0.5}
        width={width}
        height={height * 0.3}
        text={String(Math.round(value))}
        fontFamily="Arial, Helvetica, sans-serif"
        fontSize={Math.max(10, Math.min(width, height) * 0.22)}
        fontStyle="bold"
        align="center"
        verticalAlign="middle"
        fill={customTextColor ?? "#172033"}
      />
    </Group>
  );
}

function RawGanttInfographic({
  baseColor,
  data,
  height,
  interactive,
  palette,
  textColor: customTextColor,
  width,
}: {
  baseColor: string;
  data: RawElement | null;
  height: number;
  interactive: boolean;
  palette: string[];
  textColor: string | null;
  width: number;
}) {
  const columns = readArray(data?.columns).map(asRecord).filter(Boolean);
  const rows = readArray(data?.rows).map(asRecord).filter(Boolean);
  const safeColumns = columns.length > 0 ? columns : [{ label: "Phase" }];
  const safeRows = rows.length > 0 ? rows : [{ label: "Workstream", items: [] }];
  const darkBackground = isDarkInfographicColor(baseColor);
  const paddingX = darkBackground ? width * 0.07 : 0;
  const paddingY = darkBackground ? height * 0.065 : 0;
  const contentWidth = Math.max(1, width - paddingX * 2);
  const labelWidth = contentWidth * 0.22;
  const headerHeight = Math.min(38, height * 0.12);
  const chartX = paddingX + labelWidth;
  const chartWidth = Math.max(1, contentWidth - labelWidth);
  const columnWidth = chartWidth / safeColumns.length;
  const gridTop = paddingY + headerHeight;
  const gridBottom = height - paddingY;
  const rowHeight = Math.max(1, (gridBottom - gridTop) / safeRows.length);
  const textColor =
    customTextColor ?? (darkBackground ? "#F3F4F6" : "#111111");
  const gridColor = darkBackground ? "#D9DEE8" : "#D1D5DB";

  return (
    <Group listening={interactive}>
      <Text
        x={paddingX}
        y={paddingY}
        width={labelWidth - 8}
        height={headerHeight}
        text="Process"
        fontFamily="Arial, Helvetica, sans-serif"
        fontSize={Math.max(10, Math.min(14, headerHeight * 0.38))}
        fontStyle="bold"
        verticalAlign="middle"
        fill={textColor}
      />
      {safeColumns.map((column, index) => (
        <Fragment key={`gantt-column-${index}`}>
          <Line
            points={[
              chartX + index * columnWidth,
              gridTop,
              chartX + index * columnWidth,
              gridBottom,
            ]}
            stroke={gridColor}
            strokeWidth={1}
            opacity={darkBackground ? 0.78 : 1}
          />
          <Text
            x={chartX + index * columnWidth + 4}
            y={paddingY}
            width={Math.max(1, columnWidth - 8)}
            height={headerHeight}
            text={readString(column?.label) ?? `Phase ${index + 1}`}
            fontFamily="Arial, Helvetica, sans-serif"
            fontSize={Math.max(9, Math.min(14, headerHeight * 0.36))}
            align="center"
            verticalAlign="middle"
            fill={textColor}
          />
        </Fragment>
      ))}
      <Line
        points={[chartX + chartWidth, gridTop, chartX + chartWidth, gridBottom]}
        stroke={gridColor}
        strokeWidth={1}
        opacity={darkBackground ? 0.78 : 1}
      />
      {safeRows.map((row, rowIndex) => {
        const y = gridTop + rowIndex * rowHeight;
        const tasks = readArray(row?.items).map(asRecord).filter(Boolean);
        return (
          <Fragment key={`gantt-row-${rowIndex}`}>
            <Text
              x={paddingX}
              y={y}
              width={Math.max(1, labelWidth - 10)}
              height={rowHeight}
              text={readString(row?.label) ?? `Workstream ${rowIndex + 1}`}
              fontFamily="Arial, Helvetica, sans-serif"
              fontSize={Math.max(8, Math.min(13, rowHeight * 0.3))}
              verticalAlign="middle"
              fill={textColor}
            />
            {tasks.map((task, taskIndex) => {
              const start = asRecord(task?.start);
              const end = asRecord(task?.end);
              const startUnits = clamp(
                (readNumber(start?.column) ?? 0) + (readNumber(start?.offset) ?? 0),
                0,
                safeColumns.length,
              );
              const endUnits = clamp(
                (readNumber(end?.column) ?? startUnits) + (readNumber(end?.offset) ?? 0),
                startUnits + 0.05,
                safeColumns.length,
              );
              const taskX = chartX + startUnits * columnWidth;
              const taskWidth = Math.max(8, (endUnits - startUnits) * columnWidth);
              const taskHeight = Math.min(26, rowHeight * 0.72);
              const taskY = y + (rowHeight - taskHeight) / 2;
              const color = palette[(rowIndex + taskIndex) % palette.length] ?? "#2563EB";
              return (
                <Rect
                  key={`gantt-task-${rowIndex}-${taskIndex}`}
                  x={taskX}
                  y={taskY}
                  width={taskWidth}
                  height={taskHeight}
                  fill={color}
                  stroke={gridColor}
                  strokeWidth={1}
                />
              );
            })}
          </Fragment>
        );
      })}
    </Group>
  );
}

function RawTimelineInfographic({
  baseColor,
  data,
  height,
  interactive,
  palette,
  textColor: customTextColor,
  width,
}: {
  baseColor: string;
  data: RawElement | null;
  height: number;
  interactive: boolean;
  palette: string[];
  textColor: string | null;
  width: number;
}) {
  const items = readArray(data?.items).map(asRecord).filter(Boolean);
  const safeItems = items.length > 0 ? items : [{ heading: "Milestone" }];
  const darkBackground = isDarkInfographicColor(baseColor);
  const lineY = height * 0.39;
  const sidePadding = darkBackground ? width * 0.075 : width * 0.025;
  const usableWidth = Math.max(1, width - sidePadding * 2);
  const itemWidth = usableWidth / safeItems.length;
  const radius = Math.max(
    18,
    Math.min(itemWidth * 0.28, height * 0.19),
  );
  const textColor =
    customTextColor ?? (darkBackground ? "#F0F1F4" : "#111111");
  const mutedTextColor =
    customTextColor ?? (darkBackground ? "#E1E4EA" : "#222222");

  return (
    <Group listening={interactive}>
      {safeItems.map((item, index) => {
        const x = sidePadding + itemWidth * (index + 0.5);
        const color = palette[index % palette.length] ?? "#2563EB";
        const itemIcon = normalizeInfographicIcon(item?.icon, item?.color);
        const previousX = sidePadding + itemWidth * (index - 0.5);
        return (
          <Group key={`timeline-item-${index}`}>
            {index > 0 ? (
              <Line
                points={[
                  previousX + radius + 12,
                  lineY,
                  x - radius - 12,
                  lineY,
                ]}
                stroke={color}
                strokeWidth={3}
              />
            ) : null}
            <Text
              x={x - itemWidth * 0.45}
              y={Math.max(0, lineY - radius - height * 0.17)}
              width={itemWidth * 0.9}
              height={height * 0.13}
              text={String(index + 1).padStart(2, "0")}
              fontFamily="Arial, Helvetica, sans-serif"
              fontSize={Math.max(11, Math.min(16, height * 0.065))}
              fontStyle="bold"
              align="center"
              verticalAlign="middle"
              fill={textColor}
            />
            <Circle
              x={x}
              y={lineY}
              radius={radius}
              stroke={color}
              strokeWidth={3}
            />
            <Circle
              x={x}
              y={lineY}
              radius={Math.max(1, radius - 9)}
              fill={color}
            />
            <InfographicUrlIcon
              color={itemIcon?.color ?? null}
              icon={itemIcon?.url ?? null}
              x={x}
              y={lineY}
              size={Math.max(20, radius * 0.85)}
            />
            <Text
              x={x - itemWidth * 0.45}
              y={lineY + radius + 12}
              width={itemWidth * 0.9}
              height={height * 0.13}
              text={
                readString(item?.heading) ?? `Step ${index + 1}`
              }
              fontFamily="Arial, Helvetica, sans-serif"
              fontSize={Math.max(11, Math.min(16, height * 0.065))}
              fontStyle="bold"
              align="center"
              verticalAlign="top"
              fill={textColor}
            />
            <Text
              x={x - itemWidth * 0.45}
              y={lineY + radius + height * 0.16}
              width={itemWidth * 0.9}
              height={Math.max(1, height - lineY - radius - height * 0.16)}
              text={readString(item?.description) ?? ""}
              fontFamily="Arial, Helvetica, sans-serif"
              fontSize={Math.max(8, Math.min(11, height * 0.043))}
              lineHeight={1.2}
              align="center"
              fill={mutedTextColor}
            />
          </Group>
        );
      })}
    </Group>
  );
}

function RawRoadmapInfographic({
  baseColor,
  data,
  height,
  interactive,
  palette,
  textColor: customTextColor,
  width,
}: {
  baseColor: string;
  data: RawElement | null;
  height: number;
  interactive: boolean;
  palette: string[];
  textColor: string | null;
  width: number;
}) {
  const items = readArray(data?.items).map(asRecord).filter(Boolean).slice(0, 8);
  const safeItems = items.length > 0 ? items : [{ heading: "Destination" }];
  const darkBackground = isDarkInfographicColor(baseColor);
  const textColor =
    customTextColor ?? (darkBackground ? "#F0F1F4" : "#111111");
  const sidePadding = width * 0.072;
  const roadWidth = Math.max(26, height * 0.13);
  const roadUsableWidth = width - sidePadding * 2;
  const roadStartT = (-roadWidth - sidePadding) / roadUsableWidth;
  const roadEndT = (width + roadWidth - sidePadding) / roadUsableWidth;
  const roadPoints = Array.from({ length: 49 }, (_, index) => {
    const t = roadStartT + (index / 48) * (roadEndT - roadStartT);
    return [
      sidePadding + t * roadUsableWidth,
      roadmapRoadRatio(t) * height,
    ];
  }).flat();
  const itemWidth = (width - sidePadding * 2) / safeItems.length;
  const pinSize = Math.max(9, Math.min(itemWidth * 0.12, height * 0.043));

  return (
    <Group listening={interactive}>
      <Line
        points={roadPoints}
        stroke="#D1D1D1"
        strokeWidth={roadWidth}
        lineCap="butt"
        lineJoin="round"
      />
      <Line
        points={roadPoints}
        stroke="#FFFFFF"
        strokeWidth={Math.max(2, roadWidth * 0.08)}
        dash={[roadWidth * 0.34, roadWidth * 0.28]}
        lineCap="butt"
        lineJoin="round"
      />
      {safeItems.map((item, index) => {
        const t = safeItems.length === 1 ? 0.5 : index / (safeItems.length - 1);
        const x = sidePadding + t * (width - sidePadding * 2);
        const roadY = roadmapRoadRatio(t) * height;
        const color = palette[index % palette.length] ?? "#2563EB";
        const pinCenterY = roadY - pinSize * 1.48;
        const labelY = roadmapLabelRatio(t) * height;
        const labelWidth = Math.min(width * 0.2, itemWidth * 0.98);
        const labelX = clamp(x - labelWidth / 2, 0, width - labelWidth);
        return (
          <Group key={`roadmap-item-${index}`}>
            <Line
              points={[
                x,
                roadY,
                x - pinSize * 0.72,
                pinCenterY,
                x + pinSize * 0.72,
                pinCenterY,
              ]}
              closed
              fill={color}
              stroke="#D1D5DB"
              strokeWidth={1}
            />
            <Circle
              x={x}
              y={pinCenterY}
              radius={pinSize}
              fill={color}
              stroke="#D1D5DB"
              strokeWidth={1}
            />
            <Circle
              x={x}
              y={pinCenterY}
              radius={pinSize * 0.46}
              fill="#FFFFFF"
            />
            <Arc
              x={x}
              y={pinCenterY}
              innerRadius={0}
              outerRadius={pinSize * 0.46}
              angle={180}
              fill="#D6D6D6"
            />
            <Text
              x={labelX}
              y={labelY}
              width={labelWidth}
              height={height * 0.09}
              text={readString(item?.heading) ?? `Stop ${index + 1}`}
              fontFamily="Arial, Helvetica, sans-serif"
              fontSize={Math.max(10, Math.min(16, height * 0.052))}
              fontStyle="bold"
              align="center"
              fill={customTextColor ?? color}
            />
            <Text
              x={labelX}
              y={labelY + height * 0.08}
              width={labelWidth}
              height={Math.max(1, height - labelY - height * 0.08)}
              text={readString(item?.description) ?? ""}
              fontFamily="Arial, Helvetica, sans-serif"
              fontSize={Math.max(8, Math.min(11, height * 0.038))}
              lineHeight={1.15}
              align="center"
              fill={textColor}
            />
          </Group>
        );
      })}
    </Group>
  );
}

function RawMilestoneTimelineInfographic({
  data,
  height,
  interactive,
  palette,
  textColor: customTextColor,
  width,
}: {
  baseColor: string;
  data: RawElement | null;
  height: number;
  interactive: boolean;
  palette: string[];
  textColor: string | null;
  width: number;
}) {
  const items = readArray(data?.items).map(asRecord).filter(Boolean).slice(0, 9);
  const safeItems = items.length > 0 ? items : [{ heading: "2025" }];
  const lineColor = "#E5E7EB";
  const lineY = height * 0.5;
  const sidePadding = width * 0.055;
  const itemWidth = (width - sidePadding * 2) / safeItems.length;
  const markerRadius = Math.max(9, Math.min(15, height * 0.045));
  const bubbleWidth = Math.min(width * 0.2, itemWidth * 1.55);
  const bubbleHeight = Math.min(height * 0.25, 78);

  return (
    <Group listening={interactive}>
      <Line
        points={[0, lineY, width, lineY]}
        stroke={lineColor}
        strokeWidth={Math.max(3, height * 0.015)}
      />
      {safeItems.map((item, index) => {
        const x = sidePadding + itemWidth * (index + 0.5);
        const above = index % 2 === 1;
        const color = palette[index % palette.length] ?? "#2563EB";
        const bubbleX = x - bubbleWidth / 2;
        const bubbleY = above
          ? lineY - bubbleHeight - height * 0.18
          : lineY + height * 0.18;
        const yearY = above ? lineY - height * 0.14 : lineY + height * 0.065;
        const bubbleTextColor = blackOrWhiteTextColor(color);
        return (
          <Group key={`milestone-item-${index}`}>
            <Circle
              x={x}
              y={lineY}
              radius={markerRadius}
              fill={color}
              stroke={lineColor}
              strokeWidth={1.5}
            />
            <Text
              x={x - itemWidth * 0.48}
              y={yearY}
              width={itemWidth * 0.96}
              height={height * 0.08}
              text={readString(item?.heading) ?? `Milestone ${index + 1}`}
              fontFamily="Arial, Helvetica, sans-serif"
              fontSize={Math.max(10, Math.min(16, height * 0.052))}
              fontStyle="bold"
              align="center"
              fill={customTextColor ?? color}
            />
            <Rect
              x={bubbleX}
              y={bubbleY}
              width={bubbleWidth}
              height={bubbleHeight}
              cornerRadius={Math.max(8, bubbleHeight * 0.2)}
              fill={color}
              stroke={lineColor}
              strokeWidth={1}
            />
            <Line
              points={
                above
                  ? [x - 8, bubbleY + bubbleHeight, x, bubbleY + bubbleHeight + 12, x + 8, bubbleY + bubbleHeight]
                  : [x - 8, bubbleY, x, bubbleY - 12, x + 8, bubbleY]
              }
              closed
              fill={color}
              stroke={lineColor}
              strokeWidth={1}
            />
            <Text
              x={bubbleX + 8}
              y={bubbleY + 7}
              width={Math.max(1, bubbleWidth - 16)}
              height={Math.max(1, bubbleHeight - 14)}
              text={readString(item?.description) ?? ""}
              fontFamily="Arial, Helvetica, sans-serif"
              fontSize={Math.max(8, Math.min(11, height * 0.037))}
              lineHeight={1.15}
              align="center"
              verticalAlign="middle"
              fill={bubbleTextColor}
            />
          </Group>
        );
      })}
    </Group>
  );
}

function RawStaircaseInfographic({
  baseColor,
  data,
  height,
  interactive,
  palette,
  textColor: customTextColor,
  width,
}: {
  baseColor: string;
  data: RawElement | null;
  height: number;
  interactive: boolean;
  palette: string[];
  textColor: string | null;
  width: number;
}) {
  const items = readArray(data?.items).map(asRecord).filter(Boolean).slice(0, 7);
  const safeItems = items.length > 0 ? items : [{ heading: "Step" }];
  const darkBackground = isDarkInfographicColor(baseColor);
  const textColor =
    customTextColor ?? (darkBackground ? "#F0F1F4" : "#111111");
  const sidePadding = width * 0.04;
  const usableWidth = width - sidePadding * 2;
  const itemWidth = usableWidth / safeItems.length;
  const firstY = height * 0.3;
  const drop = safeItems.length > 1 ? (height * 0.5) / (safeItems.length - 1) : 0;
  const iconRadius = Math.max(11, Math.min(itemWidth * 0.1, height * 0.036));
  const contentInset = itemWidth * 0.05;
  const staircasePoints = safeItems.flatMap((_, index) => {
    const x = sidePadding + index * itemWidth;
    const y = firstY + index * drop;
    const diagonalEndX = index < safeItems.length - 1
      ? sidePadding + (index + 1) * itemWidth
      : Math.min(width - sidePadding * 0.25, x + itemWidth * 1.02);
    const diagonalEndY = index < safeItems.length - 1 ? y + drop : y + drop * 0.58;
    return [x + itemWidth * 0.88, y, diagonalEndX, diagonalEndY];
  });
  staircasePoints.unshift(sidePadding, firstY);
  const gradientStops = safeItems.flatMap((_, index) => [
    safeItems.length === 1 ? 0 : index / (safeItems.length - 1),
    palette[index % palette.length] ?? "#2563EB",
  ]);

  return (
    <Group listening={interactive}>
      <Line
        points={staircasePoints}
        strokeLinearGradientStartPoint={{ x: sidePadding, y: 0 }}
        strokeLinearGradientEndPoint={{ x: width - sidePadding, y: 0 }}
        strokeLinearGradientColorStops={gradientStops}
        strokeWidth={Math.max(3, height * 0.012)}
        lineCap="square"
        lineJoin="miter"
      />
      {safeItems.map((item, index) => {
        const x = sidePadding + index * itemWidth;
        const y = firstY + index * drop;
        const color = palette[index % palette.length] ?? "#2563EB";
        const itemIcon = normalizeInfographicIcon(item?.icon, item?.color);
        return (
          <Group key={`staircase-item-${index}`}>
            <Circle
              x={x + contentInset + iconRadius}
              y={y - height * 0.12}
              radius={iconRadius}
              fill={color}
            />
            <InfographicUrlIcon
              color={itemIcon?.color ?? null}
              icon={itemIcon?.url ?? null}
              x={x + contentInset + iconRadius}
              y={y - height * 0.12}
              size={iconRadius * 1.05}
            />
            <Text
              x={x + contentInset}
              y={y - height * 0.06}
              width={itemWidth * 0.92}
              height={height * 0.08}
              text={readString(item?.heading) ?? `Step ${index + 1}`}
              fontFamily="Arial, Helvetica, sans-serif"
              fontSize={Math.max(9, Math.min(14, height * 0.038))}
              fontStyle="bold"
              fill={customTextColor ?? color}
            />
            <Text
              x={x + contentInset + 1}
              y={y + height * 0.03}
              width={itemWidth * 0.88}
              height={Math.max(1, Math.min(height * 0.18, height - y - 4))}
              text={readString(item?.description) ?? ""}
              fontFamily="Arial, Helvetica, sans-serif"
              fontSize={Math.max(8, Math.min(10, height * 0.028))}
              lineHeight={1.15}
              fill={textColor}
            />
          </Group>
        );
      })}
    </Group>
  );
}

type RawInfographicRendererProps = {
  baseColor: string;
  data: RawElement | null;
  height: number;
  interactive: boolean;
  palette: string[];
  textColor: string | null;
  width: number;
};

function infographicItems(data: RawElement | null, max = 8) {
  return readArray(data?.items).map(asRecord).filter(Boolean).slice(0, max);
}

function RawSupplyChainInfographic({ baseColor, data, height, interactive, palette, textColor: customTextColor, width }: RawInfographicRendererProps) {
  const items = infographicItems(data, 7);
  const safe = items.length ? items : [{ heading: "Sourcing" }];
  const dark = isDarkInfographicColor(baseColor);
  const body = customTextColor ?? (dark ? "#F0F1F4" : "#111111");
  const lineColor = dark ? "#E0E0E0" : "#D2D2D2";
  const pad = safe.length > 1 ? width * .13 : width * .5;
  const gap = safe.length > 1 ? (width - pad * 2) / (safe.length - 1) : 0;
  const cy = height * .49;
  // Use one radius for both axes. When stages are removed the available gap
  // can become wider than the design height; separate radii would turn the
  // surrounding circular wave into an ellipse.
  const waveRadius = safe.length > 1
    ? Math.min(gap * .5, height * .22)
    : Math.min(width, height) * .16;
  const waveRadiusX = waveRadius;
  const waveRadiusY = waveRadius;
  const radius = Math.min(waveRadiusX, waveRadiusY) * .78;
  const bezier = .55228475;
  const wavePath = safe.reduce((path, _, index) => {
    const x = pad + index * gap;
    const direction = index % 2 === 0 ? -1 : 1;
    const peakY = cy + direction * waveRadiusY;
    const left = x - waveRadiusX;
    const right = x + waveRadiusX;
    const first = `${left} ${cy} C ${left} ${cy + direction * waveRadiusY * bezier} ${x - waveRadiusX * bezier} ${peakY} ${x} ${peakY}`;
    const second = `C ${x + waveRadiusX * bezier} ${peakY} ${right} ${cy + direction * waveRadiusY * bezier} ${right} ${cy}`;
    return `${path}${index === 0 ? `M ${first}` : ` L ${first}` } ${second}`;
  }, "");
  return <Group listening={interactive}>
    <Path data={wavePath} stroke={lineColor} strokeWidth={Math.max(2, height * .006)} lineCap="round" lineJoin="round" />
    {safe.map((item, index) => {
      const x = pad + index * gap;
      const color = palette[index % Math.max(1, palette.length)] ?? "#24468E";
      const icon = normalizeInfographicIcon(item?.icon, item?.color);
      const top = index % 2 === 1;
      const titleY = top ? cy - radius - height * .22 : cy + radius + height * .09;
      const descriptionHeight = top ? height * .065 : height * .1;
      return <Group key={`supply-${index}`}>
        <Circle
          x={x}
          y={cy}
          radius={radius}
          fill={color}
          stroke={lineColor}
          strokeWidth={Math.max(1, height * .004)}
        />
        <InfographicUrlIcon icon={icon?.url ?? null} color={icon?.color ?? null} x={x} y={cy} size={radius * .72} />
        <Text x={x-radius} y={top ? cy-radius-height*.08 : cy+radius+height*.025} width={radius*2} height={height*.06} text={String(index+1).padStart(2,"0")} align="center" fontFamily="Arial" fontStyle="bold" fontSize={Math.max(10,height*.048)} fill={customTextColor ?? color} />
        <Text x={x-gap*.45} y={titleY} width={gap*.9 || radius*3} height={height*.055} text={readString(item?.heading) ?? "Stage"} align="center" fontFamily="Arial" fontStyle="bold" fontSize={Math.max(8,height*.029)} fill={customTextColor ?? color} />
        <Text x={x-gap*.45} y={titleY+height*.052} width={gap*.9 || radius*3} height={descriptionHeight} text={readString(item?.description) ?? ""} align="center" fontFamily="Arial" fontSize={Math.max(7,height*.023)} lineHeight={1.12} fill={body} />
      </Group>;
    })}
  </Group>;
}

function RawStairStepBlocksInfographic({ baseColor, data, height, interactive, palette, textColor: customTextColor, width }: RawInfographicRendererProps) {
  const safe = infographicItems(data, 7);
  const items = safe.length ? safe : [{ heading: "Foundation" }];
  const dark = isDarkInfographicColor(baseColor);
  const body = customTextColor ?? (dark ? "#F0F1F4" : "#111111");
  const pad = width * .12;
  const blockW = (width - pad * 2) / items.length;
  const blockH = height * .29;
  const rise = height * .145;
  const baseY = height * .74;
  return <Group listening={interactive}>
    {items.map((item,index) => {
      const x = pad + index*blockW;
      const y = baseY-index*rise-blockH;
      const color = palette[index % Math.max(1,palette.length)] ?? "#24468E";
      const nodeTextColor = blackOrWhiteTextColor(color);
      const icon = normalizeInfographicIcon(item?.icon,item?.color);
      return <Group key={`block-step-${index}`}>
        <Rect x={x} y={y} width={blockW+.5} height={blockH} fill={color} stroke={dark ? "#D6D6D6" : undefined} strokeWidth={dark ? 1 : 0} />
        <Text x={x+blockW*.06} y={y+blockH*.08} width={blockW*.88} height={blockH*.22} text={`Step ${String(index+1).padStart(2,"0")}`} fontFamily="Arial" fontStyle="bold" fontSize={Math.max(11,height*.053)} fill={nodeTextColor} />
        <InfographicUrlIcon icon={icon?.url ?? null} color={icon?.color ?? null} x={x+blockW*.13} y={y+blockH*.58} size={Math.min(blockW,blockH)*.18} />
        <Text x={x+blockW*.06} y={y+blockH*.76} width={blockW*.86} height={blockH*.17} text={readString(item?.heading) ?? "Step"} fontFamily="Arial" fontStyle="bold" fontSize={Math.max(8,height*.026)} fill={nodeTextColor} />
        <Text x={x+blockW*.08} y={y+blockH+height*.018} width={blockW*.84} height={height*.13} text={readString(item?.description) ?? ""} fontFamily="Arial" fontSize={Math.max(7,height*.022)} lineHeight={1.12} fill={body} />
      </Group>;
    })}
  </Group>;
}

function RawMaturityModelInfographic({ data, height, interactive, palette, width }: RawInfographicRendererProps) {
  const safe = infographicItems(data, 7);
  const items = safe.length ? safe : [{ heading: "Initial" }];
  const rowH = height * .145;
  const gap = height * .022;
  return <Group listening={interactive}>
    {items.map((item,index) => {
      const reverse = items.length-1-index;
      const w = width*.62;
      const x = width*(.03+index*.09);
      const y = height*.08+reverse*(rowH+gap);
      const color = palette[index % Math.max(1,palette.length)] ?? "#24468E";
      const nodeTextColor = blackOrWhiteTextColor(color);
      const icon = normalizeInfographicIcon(item?.icon,item?.color);
      return <Group key={`maturity-${index}`}>
        <Rect x={x} y={y} width={w} height={rowH} fill={color} />
        <Text x={x+w*.035} y={y} width={w*.24} height={rowH} text={readString(item?.heading) ?? "Level"} verticalAlign="middle" fontFamily="Arial" fontStyle="bold" fontSize={Math.max(9,height*.035)} fill={nodeTextColor} />
        <Line points={[x+w*.28,y+rowH*.22,x+w*.28,y+rowH*.78]} stroke={nodeTextColor} strokeWidth={1} />
        <Text x={x+w*.34} y={y+rowH*.12} width={w*.52} height={rowH*.76} text={readString(item?.description) ?? ""} verticalAlign="middle" fontFamily="Arial" fontSize={Math.max(7,height*.023)} lineHeight={1.1} fill={nodeTextColor} />
        <InfographicUrlIcon icon={icon?.url ?? null} color={icon?.color ?? null} x={x+w*.94} y={y+rowH*.5} size={rowH*.4} />
      </Group>;
    })}
  </Group>;
}

function RawPillarFrameworkInfographic({ baseColor, data, height, interactive, palette, textColor: customTextColor, width }: RawInfographicRendererProps) {
  const safe = infographicItems(data, 7);
  const items = safe.length ? safe : [{ heading: "Customer" }];
  const dark = isDarkInfographicColor(baseColor);
  const text = customTextColor ?? (dark ? "#F0F1F4" : "#111111");
  const roofColor = withHash(readString(data?.card_color)) ?? "#D6D6D6";
  const roofTextColor =
    withHash(readString(data?.background_text_color)) ??
    customTextColor ??
    "#4D73BE";
  const left = width*.04;
  const right = width*.985;
  const roofBottom = height*.33;
  const gap = width*.01;
  const colW = (right-left-gap*(items.length-1))/items.length;
  return <Group listening={interactive}>
    <Line points={[left,roofBottom,width*.52,height*.015,right,roofBottom]} closed fill={roofColor} />
    <Text x={width*.25} y={height*.18} width={width*.54} height={height*.08} text={readString(data?.title) ?? "Growth & Transformation Framework"} align="center" verticalAlign="middle" fontFamily="Arial" fontStyle="bold" fontSize={Math.max(11,height*.041)} fill={roofTextColor} />
    {items.map((item,index) => {
      const x = left+index*(colW+gap);
      const color = palette[index % Math.max(1,palette.length)] ?? "#24468E";
      const nodeTextColor = blackOrWhiteTextColor(color);
      const icon = normalizeInfographicIcon(item?.icon,item?.color);
      return <Group key={`pillar-${index}`}>
        <Rect x={x} y={height*.345} width={colW} height={height*.09} fill={color} />
        <Text x={x} y={height*.345} width={colW} height={height*.09} text={readString(item?.heading) ?? "Pillar"} align="center" verticalAlign="middle" fontFamily="Arial" fontStyle="bold" fontSize={Math.max(9,height*.032)} fill={nodeTextColor} />
        <Rect x={x} y={height*.46} width={colW} height={height*.35} fill={color} />
        <InfographicUrlIcon icon={icon?.url ?? null} color={icon?.color ?? null} x={x+colW*.5} y={height*.56} size={Math.min(colW*.25,height*.1)} />
        <Text x={x+colW*.08} y={height*.63} width={colW*.84} height={height*.16} text={readString(item?.description) ?? ""} align="center" verticalAlign="middle" fontFamily="Arial" fontSize={Math.max(7,height*.022)} lineHeight={1.1} fill={nodeTextColor} />
        <Rect x={x} y={height*.835} width={colW} height={height*.095} fill={color} />
        <Text x={x+colW*.05} y={height*.835} width={colW*.9} height={height*.095} text={readString(item?.focus) ?? ""} align="center" verticalAlign="middle" fontFamily="Arial" fontSize={Math.max(7,height*.024)} fill={nodeTextColor} />
      </Group>;
    })}
    <Text x={0} y={height*.37} width={width*.035} height={height*.08} rotation={-90} text="Pillar" align="center" fontFamily="Arial" fontSize={Math.max(7,height*.023)} fill={text} />
  </Group>;
}

function RawTransformationHubInfographic({ baseColor, data, height, interactive, palette, textColor: customTextColor, width }: RawInfographicRendererProps) {
  const safe = infographicItems(data, 8);
  const items = safe.length ? safe : [{ heading: "Strategy" },{ heading: "Process" }];
  const dark = isDarkInfographicColor(baseColor);
  const line = dark ? "#E0E0E0" : "#D2D2D2";
  const centerColor = withHash(readString(data?.card_color)) ?? "#D6D6D6";
  const centerTextColor =
    withHash(readString(data?.background_text_color)) ??
    customTextColor ??
    "#111111";
  const cx=width*.5, cy=height*.5, cr=Math.min(width*.2,height*.265);
  const leftCount=Math.ceil(items.length/2), leftItems=items.slice(0,leftCount), rightItems=items.slice(leftCount);
  const boxW=width*.25,boxH=height*.18;
  const sideX={left:width*.015,right:width*.71};
  const sideCenter=(rank:number,count:number)=>height*(.175+rank*(.65/Math.max(1,count-1)));
  const connector=(side:"left"|"right",rank:number,count:number)=>{
    const centerY=sideCenter(rank,count),boxEdge=side==="left"?sideX.left+boxW:sideX.right;
    const elbowX=side==="left"?cx-cr*.72:cx+cr*.72,arrow=Math.max(5,height*.014),endX=side==="left"?boxEdge+arrow:boxEdge-arrow;
    const triangle=side==="left"?[boxEdge,centerY,boxEdge+arrow,centerY-arrow*.62,boxEdge+arrow,centerY+arrow*.62]:[boxEdge,centerY,boxEdge-arrow,centerY-arrow*.62,boxEdge-arrow,centerY+arrow*.62];
    return <Group key={`hub-connector-${side}-${rank}`}>
      <Line points={[cx,cy,elbowX,cy,elbowX,centerY,endX,centerY]} stroke={line} strokeWidth={Math.max(1,height*.004)} lineJoin="miter"/>
      <Line points={triangle} closed fill={line}/>
    </Group>;
  };
  const renderSide=(side:"left"|"right", sideItems:(RawElement|null)[]) => sideItems.map((item,sideIndex)=>{
    const originalIndex=side==="left"?sideIndex:leftCount+sideIndex;
    const x=sideX[side],y=sideCenter(sideIndex,sideItems.length)-boxH*.5;
    const color=palette[originalIndex%Math.max(1,palette.length)] ?? "#24468E";
    const nodeTextColor=blackOrWhiteTextColor(color);
    return <Group key={`hub-${side}-${sideIndex}`}>
      <Rect x={x} y={y} width={boxW} height={boxH} fill={color} stroke={line} strokeWidth={Math.max(1,height*.003)} />
      <Text x={x} y={y} width={boxW} height={boxH} text={readString(item?.heading) ?? "Capability"} align="center" verticalAlign="middle" fontFamily="Arial" fontStyle="bold" fontSize={Math.max(9,height*.04)} fill={nodeTextColor} />
    </Group>;
  });
  return <Group listening={interactive}>
    {leftItems.map((_,index)=>connector("left",index,leftItems.length))}
    {rightItems.map((_,index)=>connector("right",index,rightItems.length))}
    {renderSide("left",leftItems)}{renderSide("right",rightItems)}
    <Circle x={cx} y={cy} radius={cr} fill={centerColor}/>
    <Text x={cx-cr*.9} y={cy-cr*.5} width={cr*1.8} height={cr} text={readString(data?.center_label) ?? "Business Transformation"} align="center" verticalAlign="middle" fontFamily="Arial" fontStyle="bold" fontSize={Math.max(11,height*.055)} fill={centerTextColor}/>
  </Group>;
}

function RawDiagonalCirclesInfographic({ baseColor, data, height, interactive, palette, textColor: customTextColor, width }: RawInfographicRendererProps) {
  const safe=infographicItems(data,7); const items=safe.length?safe:[{heading:"Strategy"}];
  const dark=isDarkInfographicColor(baseColor); const text=customTextColor??(dark?"#F0F1F4":"#111111");
  const r=Math.min(width/(items.length+3.8),height*.135); const startX=width*.215,startY=height*.7,dx=width*.125,dy=-height*.118;
  const lineColor=dark?"#E0E0E0":"#D2D2D2",arrowSize=Math.max(5,height*.014),textW=width*.205;
  const layout=items.map((item,index)=>{const x=startX+index*dx,y=startY+index*dy,color=palette[index%Math.max(1,palette.length)]??"#24468E",calloutLeft=index%2===1,anchorX=x+(calloutLeft?-r*.64:r*.3),anchorY=y+(calloutLeft?-r*.77:r*.954),elbowY=y+(calloutLeft?-r*1.28:r*1.22),direction=calloutLeft?-1:1,arrowTipX=anchorX+direction*r*.82,arrowBaseX=arrowTipX-direction*arrowSize,textX=calloutLeft?Math.max(width*.01,arrowTipX-arrowSize-width*.018-textW):Math.min(width-textW-width*.01,arrowTipX+arrowSize+width*.018);return {anchorX,anchorY,arrowBaseX,arrowTipX,calloutLeft,color,elbowY,index,item,textX,x,y};});
  return <Group listening={interactive}>
    {layout.map(({color,index,x,y})=><Circle key={`diag-circle-${index}`} x={x} y={y} radius={r} fill={color} opacity={.88}/>)}
    {layout.map(({anchorX,anchorY,arrowBaseX,arrowTipX,calloutLeft,color,elbowY,index,item,textX,x,y})=>{const nodeTextColor=blackOrWhiteTextColor(color),icon=normalizeInfographicIcon(item?.icon,item?.color),numberX=calloutLeft?x-r*.82:x-r*.05,numberY=calloutLeft?y-r*.78:y+r*.51,iconX=x+r*.62,iconY=y-r*.34;return <Group key={`diag-content-${index}`}>
      <Text x={numberX} y={numberY} width={r*.7} height={r*.35} text={String(index+1).padStart(2,"0")} align="center" fontFamily="Arial" fontStyle="bold" fontSize={Math.max(10,height*.045)} fill={nodeTextColor}/>
      <InfographicUrlIcon icon={icon?.url??null} color={icon?.color??null} x={iconX} y={iconY} size={r*.34}/>
      <Line points={[anchorX,anchorY,anchorX,elbowY,arrowBaseX,elbowY]} stroke={lineColor} strokeWidth={1.5}/>
      <Line points={[arrowTipX,elbowY,arrowBaseX,elbowY-arrowSize*.65,arrowBaseX,elbowY+arrowSize*.65]} closed fill={lineColor}/>
      <Circle x={anchorX} y={anchorY} radius={3} fill={lineColor}/>
      <Text x={textX} y={elbowY-height*.026} width={textW} height={height*.05} text={readString(item?.heading)??"Pillar"} align={calloutLeft?"right":"left"} fontFamily="Arial" fontStyle="bold" fontSize={Math.max(8,height*.027)} fill={customTextColor??color}/>
      <Text x={textX} y={elbowY+height*.018} width={textW} height={height*.1} text={readString(item?.description)??""} align={calloutLeft?"right":"left"} fontFamily="Arial" fontSize={Math.max(7,height*.02)} lineHeight={1.12} fill={text}/>
    </Group>})}
  </Group>;
}

function RawRiskMatrixInfographic({ baseColor, data, height, interactive, palette, textColor: customTextColor, width }: RawInfographicRendererProps) {
  const raw=infographicItems(data,4); const defaults: RawElement[]=[{heading:"Identify"},{heading:"Prioritize"},{heading:"Assess"},{heading:"Respond"}]; const items=defaults.map((fallback,index)=>raw[index]??fallback);
  const dark=isDarkInfographicColor(baseColor), body=customTextColor??(dark?"#F0F1F4":"#111111");
  const q=height*.43,gap=height*.035,cx=width*.5,cy=height*.5, left=cx-q-gap*.5, top=cy-q-gap*.5;
  const pos=[[left,top],[cx+gap*.5,top],[left,cy+gap*.5],[cx+gap*.5,cy+gap*.5]];
  const sideMargin=width*.015, arrowGap=width*.018, arrowLength=width*.04, textGap=width*.018;
  return <Group listening={interactive}>
    {items.map((item,index)=>{const [x,y]=pos[index],side=index%2===0?"left":"right",color=palette[index%Math.max(1,palette.length)]??"#24468E",icon=normalizeInfographicIcon(item?.icon,item?.color),midY=y+q*.5,arrowHalf=Math.max(12,height*.055),blockEdge=side==="left"?x:x+q,arrowBase=blockEdge+(side==="left"?-arrowGap:arrowGap),arrowTip=arrowBase+(side==="left"?-arrowLength:arrowLength),tx=side==="left"?sideMargin:arrowTip+textGap,textWidth=side==="left"?Math.max(width*.12,arrowTip-textGap-sideMargin):Math.max(width*.12,width-sideMargin-tx);return <Group key={`risk-${index}`}>
      <Rect x={x} y={y} width={q} height={q} cornerRadius={q*.1} fill={color}/>
      <InfographicUrlIcon icon={icon?.url??null} color={icon?.color??null} x={x+q*.5} y={y+q*.43} size={q*.28}/>
      <Line points={[arrowTip,midY,arrowBase,midY-arrowHalf,arrowBase,midY+arrowHalf]} closed fill={color}/>
      <Text x={tx} y={y+q*.27} width={textWidth} height={q*.11} text={readString(item?.heading)??"Activity"} align={side==="left"?"right":"left"} fontFamily="Arial" fontStyle="bold" fontSize={Math.max(8,height*.027)} fill={customTextColor??color}/>
      <Text x={tx} y={y+q*.39} width={textWidth} height={q*.35} text={readString(item?.description)??""} align={side==="left"?"right":"left"} fontFamily="Arial" fontSize={Math.max(7,height*.02)} lineHeight={1.1} fill={body}/>
    </Group>})}
    <Rect x={cx-q*.375} y={cy-q*.375} width={q*.75} height={q*.75} cornerRadius={q*.1} fill="#FFFFFF" opacity={.34}/>
    {(readString(data?.center_label)??"RISK").padEnd(4," ").slice(0,4).split("").map((letter,index)=><Text key={`risk-letter-${index}`} x={cx-q*.34+(index%2)*q*.34} y={cy-q*.34+Math.floor(index/2)*q*.34} width={q*.34} height={q*.34} text={letter} align="center" verticalAlign="middle" fontFamily="Arial" fontStyle="bold" fontSize={Math.max(11,height*.06)} fill="#FFFFFF"/>)}
  </Group>;
}

function RawChevronProcessInfographic({
  baseColor,
  data,
  height,
  interactive,
  palette,
  textColor: customTextColor,
  width,
}: {
  baseColor: string;
  data: RawElement | null;
  height: number;
  interactive: boolean;
  palette: string[];
  textColor: string | null;
  width: number;
}) {
  const items = readArray(data?.items).map(asRecord).filter(Boolean).slice(0, 8);
  const safeItems = items.length > 0 ? items : [{ heading: "Stage" }];
  const darkBackground = isDarkInfographicColor(baseColor);
  const bodyColor = customTextColor ?? (darkBackground ? "#F0F1F4" : "#111111");
  const sidePadding = width * 0.035;
  const contentWidth = width * 0.83;
  const itemStep = contentWidth / (safeItems.length + 0.34);
  const top = height * 0.32;
  const middle = height * 0.5;
  const bottom = height * 0.68;

  return (
    <Group listening={interactive}>
      {safeItems.map((item, index) => {
        const x = sidePadding + index * itemStep;
        const shapeWidth = itemStep * 1.34;
        const color = palette[index % palette.length] ?? "#2563EB";
        const nodeTextColor = blackOrWhiteTextColor(color);
        const anchorX = x + shapeWidth * 0.565;
        const above = index % 2 === 1;
        const dotY = above ? height * 0.075 : height * 0.91;
        const labelX = anchorX + width * 0.012;
        const labelWidth = Math.max(
          width * 0.1,
          Math.min(itemStep * 1.45, width - labelX - width * 0.025),
        );
        const labelY = above ? height * 0.06 : height * 0.79;
        const labelColor = customTextColor ?? (darkBackground ? bodyColor : color);
        return (
          <Group key={`chevron-process-${index}`}>
            <Line
              closed
              points={[
                x,
                top,
                x + shapeWidth * 0.68,
                top,
                x + shapeWidth,
                middle,
                x + shapeWidth * 0.68,
                bottom,
                x + shapeWidth * 0.04,
                bottom,
                x + shapeWidth * 0.38,
                middle,
              ]}
              fill={color}
            />
            <Text
              x={x + shapeWidth * 0.34}
              y={middle - height * 0.035}
              width={shapeWidth * 0.45}
              height={height * 0.08}
              text={String(index + 1).padStart(2, "0")}
              fontFamily="Arial, Helvetica, sans-serif"
              fontSize={Math.max(14, Math.min(22, height * 0.055))}
              fontStyle="bold"
              align="center"
              fill={nodeTextColor}
            />
            <Line
              points={above
                ? [anchorX, middle - height * 0.045, anchorX, dotY]
                : [anchorX, middle + height * 0.02, anchorX, dotY]}
              stroke="#D1D1D1"
              strokeWidth={1.5}
            />
            <Circle x={anchorX} y={dotY} radius={Math.max(4, height * 0.011)} fill={color} />
            <Text
              x={labelX}
              y={labelY}
              width={labelWidth}
              height={height * 0.07}
              text={readString(item?.heading) ?? `Stage ${index + 1}`}
              fontFamily="Arial, Helvetica, sans-serif"
              fontSize={Math.max(10, Math.min(14, height * 0.037))}
              fontStyle="bold"
              fill={labelColor}
            />
            <Text
              x={labelX}
              y={labelY + height * 0.055}
              width={labelWidth}
              height={height * 0.12}
              text={readString(item?.description) ?? ""}
              fontFamily="Arial, Helvetica, sans-serif"
              fontSize={Math.max(8, Math.min(11, height * 0.029))}
              lineHeight={1.15}
              fill={bodyColor}
            />
          </Group>
        );
      })}
    </Group>
  );
}

function RawRadialCycleInfographic({
  data,
  height,
  interactive,
  palette,
  width,
}: {
  baseColor: string;
  data: RawElement | null;
  height: number;
  interactive: boolean;
  palette: string[];
  textColor: string | null;
  width: number;
}) {
  const items = readArray(data?.items).map(asRecord).filter(Boolean).slice(0, 8);
  const safeItems = items.length > 0 ? items : [{ heading: "Stage" }];
  const centerX = width / 2;
  const centerY = height / 2;
  const orbitX = width * 0.315;
  const orbitY = height * 0.315;
  const nodeRadius = Math.max(34, Math.min(width * 0.12, height * (safeItems.length >= 6 ? 0.13 : 0.145)));
  const imageRadius = Math.max(34, Math.min(width * 0.14, height * 0.15));
  const startAngle = 270 - 360 / safeItems.length;
  const badgeColor =
    withHash(readString(data?.card_color)) ?? "#E4E4E7";
  const badgeTextColor =
    withHash(readString(data?.background_text_color)) ?? "#111111";

  return (
    <Group listening={interactive}>
      <Ellipse
        x={centerX}
        y={centerY}
        radiusX={orbitX}
        radiusY={orbitY}
        stroke="#D1D1D1"
        strokeWidth={2}
        dash={[7, 7]}
      />
      <RadialCycleCenterImage
        radius={imageRadius}
        src={readString(data?.center_image)}
        x={centerX}
        y={centerY}
      />
      {safeItems.map((item, index) => {
        const angle = ((startAngle + index * (360 / safeItems.length)) * Math.PI) / 180;
        const x = centerX + Math.cos(angle) * orbitX;
        const y = centerY + Math.sin(angle) * orbitY;
        const color = palette[index % palette.length] ?? "#2563EB";
        const nodeTextColor = blackOrWhiteTextColor(color);
        return (
          <Group key={`radial-cycle-${index}`}>
            <Circle
              x={x}
              y={y}
              radius={nodeRadius}
              fill={color}
              stroke="#D1D1D1"
              strokeWidth={1.5}
            />
            <Circle
              x={x}
              y={y - nodeRadius * 0.43}
              radius={nodeRadius * 0.25}
              fill={badgeColor}
            />
            <Text
              x={x - nodeRadius * 0.38}
              y={y - nodeRadius * 0.54}
              width={nodeRadius * 0.76}
              height={nodeRadius * 0.24}
              text={String(index + 1).padStart(2, "0")}
              fontFamily="Arial, Helvetica, sans-serif"
              fontSize={Math.max(11, nodeRadius * 0.21)}
              fontStyle="bold"
              align="center"
              verticalAlign="middle"
              fill={badgeTextColor}
            />
            <Text
              x={x - nodeRadius * 0.82}
              y={y - nodeRadius * 0.08}
              width={nodeRadius * 1.64}
              height={nodeRadius * 0.26}
              text={readString(item?.heading) ?? `Stage ${index + 1}`}
              fontFamily="Arial, Helvetica, sans-serif"
              fontSize={Math.max(9, nodeRadius * 0.14)}
              fontStyle="bold"
              align="center"
              fill={nodeTextColor}
            />
            <Text
              x={x - nodeRadius * 0.82}
              y={y + nodeRadius * 0.18}
              width={nodeRadius * 1.64}
              height={nodeRadius * 0.65}
              text={readString(item?.description) ?? ""}
              fontFamily="Arial, Helvetica, sans-serif"
              fontSize={Math.max(7, nodeRadius * 0.105)}
              lineHeight={1.15}
              align="center"
              fill={nodeTextColor}
            />
          </Group>
        );
      })}
    </Group>
  );
}

function RadialCycleCenterImage({
  radius,
  src,
  x,
  y,
}: {
  radius: number;
  src: string | null;
  x: number;
  y: number;
}) {
  const loaded = useLoadedKonvaImage(src);
  if (!loaded) {
    return <Circle x={x} y={y} radius={radius} fill="#EEF1F5" stroke="#D1D5DB" strokeWidth={1} />;
  }
  const diameter = radius * 2;
  const targetRatio = 1;
  const naturalRatio = loaded.width / loaded.height || 1;
  const crop = naturalRatio > targetRatio
    ? {
        x: (loaded.width - loaded.height) / 2,
        y: 0,
        width: loaded.height,
        height: loaded.height,
      }
    : {
        x: 0,
        y: (loaded.height - loaded.width) / 2,
        width: loaded.width,
        height: loaded.width,
      };
  return (
    <Group
      x={x - radius}
      y={y - radius}
      clipFunc={(context) => {
        context.beginPath();
        context.arc(radius, radius, radius, 0, Math.PI * 2, false);
        context.closePath();
      }}
      listening={false}
    >
      <KonvaImage image={loaded} width={diameter} height={diameter} crop={crop} />
    </Group>
  );
}

function RawConversionFunnelInfographic({
  baseColor,
  data,
  height,
  interactive,
  palette,
  textColor: customTextColor,
  width,
}: {
  baseColor: string;
  data: RawElement | null;
  height: number;
  interactive: boolean;
  palette: string[];
  textColor: string | null;
  width: number;
}) {
  const items = readArray(data?.items).map(asRecord).filter(Boolean).slice(0, 8);
  const safeItems = items.length > 0 ? items : [{ value: 50, heading: "Stage" }];
  const darkBackground = isDarkInfographicColor(baseColor);
  const textColor = customTextColor ?? (darkBackground ? "#F0F1F4" : "#111111");
  const columnWidth = width / safeItems.length;
  const curvePoints = Array.from({ length: 41 }, (_, index) => {
    const ratio = index / 40;
    return [ratio * width, funnelBoundaryRatio(ratio) * height];
  }).flat();

  return (
    <Group listening={interactive}>
      {safeItems.map((_, index) => {
        const x0 = index * columnWidth;
        const x1 = (index + 1) * columnWidth;
        const curve = Array.from({ length: 11 }, (_, pointIndex) => {
          const x = x1 - (pointIndex / 10) * columnWidth;
          return [x, funnelBoundaryRatio(x / width) * height];
        }).flat();
        return (
          <Line
            key={`funnel-fill-${index}`}
            closed
            points={[x0, 0, x1 + 0.5, 0, ...curve, x0, funnelBoundaryRatio(x0 / width) * height]}
            fill={palette[index % palette.length] ?? "#2563EB"}
          />
        );
      })}
      <Line
        points={curvePoints}
        stroke={palette[(safeItems.length + 1) % palette.length] ?? "#7CA2E5"}
        strokeWidth={Math.max(4, height * 0.018)}
        lineCap="butt"
        lineJoin="round"
      />
      <Rect width={width} height={height} stroke="#D1D1D1" strokeWidth={1.5} />
      {safeItems.map((item, index) => {
        const x = index * columnWidth;
        return (
          <Group key={`funnel-stage-${index}`}>
            {index > 0 ? (
              <Line points={[x, 0, x, height]} stroke="#D1D1D1" strokeWidth={1.5} />
            ) : null}
            <Text
              x={x + columnWidth * 0.13}
              y={height * 0.68}
              width={columnWidth * 0.78}
              height={height * 0.08}
              text={`${Math.round(readNumber(item?.value) ?? 0)}%`}
              fontFamily="Arial, Helvetica, sans-serif"
              fontSize={Math.max(13, Math.min(20, height * 0.058))}
              fontStyle="bold"
              fill={textColor}
            />
            <Text
              x={x + columnWidth * 0.13}
              y={height * 0.76}
              width={columnWidth * 0.78}
              height={height * 0.07}
              text={readString(item?.heading) ?? `Stage ${index + 1}`}
              fontFamily="Arial, Helvetica, sans-serif"
              fontSize={Math.max(9, Math.min(13, height * 0.038))}
              fontStyle="bold"
              fill={textColor}
            />
            <Text
              x={x + columnWidth * 0.13}
              y={height * 0.845}
              width={columnWidth * 0.78}
              height={height * 0.13}
              text={readString(item?.description) ?? ""}
              fontFamily="Arial, Helvetica, sans-serif"
              fontSize={Math.max(7, Math.min(10, height * 0.029))}
              lineHeight={1.15}
              fill={textColor}
            />
          </Group>
        );
      })}
    </Group>
  );
}

function RawSegmentedWheelInfographic({
  baseColor,
  data,
  height,
  interactive,
  palette,
  textColor: customTextColor,
  width,
}: {
  baseColor: string;
  data: RawElement | null;
  height: number;
  interactive: boolean;
  palette: string[];
  textColor: string | null;
  width: number;
}) {
  const items = readArray(data?.items).map(asRecord).filter(Boolean).slice(0, 6);
  const safeItems = items.length >= 3
    ? items
    : [{ heading: "Foundation" }, { heading: "Efficiency" }, { heading: "Growth" }];
  const darkBackground = isDarkInfographicColor(baseColor);
  const outsideTextColor = customTextColor ?? (darkBackground ? "#F0F1F4" : "#111111");
  const centerX = width * 0.5;
  const centerY = height * 0.475;
  const outerRadius = Math.min(width * 0.235, height * 0.33);
  const innerRadius = outerRadius * 0.29;
  const angleStep = 360 / safeItems.length;
  const gapAngle = Math.min(5, angleStep * 0.08);
  const labelWidth = width * 0.205;

  return (
    <Group listening={interactive}>
      {safeItems.map((item, index) => {
        const middleAngle = -90 + (index + 0.5) * angleStep;
        const startAngle = middleAngle - angleStep / 2 + gapAngle / 2;
        const endAngle = middleAngle + angleStep / 2 - gapAngle / 2;
        const color = palette[index % palette.length] ?? "#2563EB";
        const icon = normalizeInfographicIcon(item?.icon, item?.color);
        const iconPoint = polarPoint(
          centerX,
          centerY,
          (innerRadius + outerRadius) * 0.54,
          middleAngle,
        );
        const anchor = polarPoint(centerX, centerY, outerRadius + 2, middleAngle);
        const elbow = polarPoint(centerX, centerY, outerRadius + height * 0.055, middleAngle);
        const horizontalBias = Math.cos((middleAngle * Math.PI) / 180);
        const direction = Math.abs(horizontalBias) <= 0.08
          ? safeItems.length === 3 ? 1 : -1
          : horizontalBias > 0 ? 1 : -1;
        const endX = elbow.x + direction * width * 0.032;
        const textX = direction > 0
          ? endX + width * 0.014
          : endX - width * 0.014 - labelWidth;
        const align = direction > 0 ? "left" : "right";
        return (
          <Group key={`segmented-wheel-${index}`}>
            <Path
              data={annularSectorPath(
                centerX,
                centerY,
                innerRadius,
                outerRadius,
                startAngle,
                endAngle,
                Math.max(5, outerRadius * 0.035),
              )}
              fill={color}
            />
            <InfographicUrlIcon
              color={icon?.color ?? null}
              icon={icon?.url ?? null}
              x={iconPoint.x}
              y={iconPoint.y}
              size={Math.max(20, Math.min(width * 0.042, height * 0.072))}
            />
            <Line
              points={[anchor.x, anchor.y, elbow.x, elbow.y, endX, elbow.y]}
              stroke={darkBackground ? "#E5E7EB" : color}
              strokeWidth={1.5}
              lineJoin="round"
            />
            <Circle
              x={endX}
              y={elbow.y}
              radius={Math.max(3.5, height * 0.008)}
              fill={darkBackground ? "#E5E7EB" : color}
            />
            <Text
              x={textX}
              y={elbow.y - height * 0.015}
              width={labelWidth}
              height={height * 0.06}
              text={readString(item?.heading) ?? `Segment ${index + 1}`}
              fontFamily="Arial, Helvetica, sans-serif"
              fontSize={Math.max(10, Math.min(14, height * 0.032))}
              fontStyle="bold"
              align={align}
              fill={customTextColor ?? (darkBackground ? outsideTextColor : color)}
            />
            <Text
              x={textX}
              y={elbow.y + height * 0.035}
              width={labelWidth}
              height={height * 0.115}
              text={readString(item?.description) ?? ""}
              fontFamily="Arial, Helvetica, sans-serif"
              fontSize={Math.max(8, Math.min(11, height * 0.025))}
              lineHeight={1.18}
              align={align}
              fill={outsideTextColor}
            />
          </Group>
        );
      })}
    </Group>
  );
}

function RawCustomerJourneyInfographic({
  baseColor,
  data,
  height,
  interactive,
  palette,
  textColor: customTextColor,
  width,
}: {
  baseColor: string;
  data: RawElement | null;
  height: number;
  interactive: boolean;
  palette: string[];
  textColor: string | null;
  width: number;
}) {
  const items = readArray(data?.items).map(asRecord).filter(Boolean).slice(0, 6);
  const safeItems = items.length >= 4
    ? items
    : [
        { icon: null },
        { heading: "Awareness" },
        { heading: "Consideration" },
        { heading: "Experience" },
      ];
  const startItem = safeItems[0];
  const stages = safeItems.slice(1);
  const darkBackground = isDarkInfographicColor(baseColor);
  const textColor = customTextColor ?? (darkBackground ? "#F0F1F4" : "#111111");
  const start = { x: width * 0.08, y: height * 0.64 };
  const topY = height * 0.285;
  const bottomY = height * 0.715;
  const stageStartX = width * 0.285;
  const stageEndX = width * 0.875;
  const stagePitch = stages.length > 1
    ? (stageEndX - stageStartX) / (stages.length - 1)
    : stageEndX - stageStartX;
  // Keep every node circular while reserving a clear horizontal lane for the
  // neighbouring label and the connector when more stages are added.
  const nodeRadius = Math.min(
    width * 0.063,
    height * 0.1,
    stagePitch * 0.36,
  );
  const stagePoints = stages.map((_, index) => ({
    x: stages.length === 1
      ? (stageStartX + stageEndX) / 2
      : stageStartX + (index / (stages.length - 1)) * (stageEndX - stageStartX),
    y: index % 2 === 0 ? topY : bottomY,
  }));
  const lastPoint = stagePoints.at(-1) ?? start;
  const pathPoints = [start, ...stagePoints, { x: width * 0.96, y: lastPoint.y }];
  const startIcon = normalizeInfographicIcon(startItem?.icon, startItem?.color);
  const startColor =
    palette[0] ??
    withHash(readString(data?.start_color)) ??
    "#2563EB";

  return (
    <Group listening={interactive}>
      <Path
        data={roundedOrthogonalPath(pathPoints, Math.max(10, width * 0.018))}
        stroke={darkBackground ? "#E2E2E2" : "#D1D1D1"}
        strokeWidth={Math.max(2.5, width * 0.004)}
        lineCap="round"
        lineJoin="round"
      />
      <Circle x={start.x} y={start.y} radius={nodeRadius * 1.08} fill={startColor} />
      <InfographicUrlIcon
        color={startIcon?.color ?? "#111111"}
        icon={startIcon?.url ?? null}
        x={start.x}
        y={start.y}
        size={nodeRadius * 0.78}
      />
      {stages.map((item, index) => {
        const point = stagePoints[index];
        const color = palette[(index + 1) % palette.length] ?? "#2563EB";
        const icon = normalizeInfographicIcon(item?.icon, item?.color);
        const above = index % 2 === 1;
        const textWidth = Math.min(width * 0.145, stagePitch * 0.72);
        const textX = point.x - textWidth / 2;
        const headingY = above
          ? point.y - nodeRadius - height * 0.19
          : point.y + nodeRadius + height * 0.035;
        return (
          <Group key={`customer-journey-${index}`}>
            <Circle x={point.x} y={point.y} radius={nodeRadius} fill={color} />
            <InfographicUrlIcon
              color={icon?.color ?? null}
              icon={icon?.url ?? null}
              x={point.x}
              y={point.y}
              size={nodeRadius * 0.68}
            />
            <Text
              x={textX}
              y={headingY}
              width={textWidth}
              height={height * 0.055}
              text={readString(item?.heading) ?? `Stage ${index + 1}`}
              fontFamily="Arial, Helvetica, sans-serif"
              fontSize={Math.max(10, Math.min(14, height * 0.034))}
              fontStyle="bold"
              align="center"
              fill={customTextColor ?? (darkBackground ? textColor : color)}
            />
            <Text
              x={textX}
              y={headingY + height * 0.052}
              width={textWidth}
              height={height * 0.12}
              text={readString(item?.description) ?? ""}
              fontFamily="Arial, Helvetica, sans-serif"
              fontSize={Math.max(8, Math.min(11, height * 0.027))}
              lineHeight={1.15}
              align="center"
              fill={textColor}
            />
          </Group>
        );
      })}
    </Group>
  );
}

function RawBeforeAfterInfographic({
  baseColor,
  data,
  height,
  interactive,
  palette,
  textColor: customTextColor,
  width,
}: {
  baseColor: string;
  data: RawElement | null;
  height: number;
  interactive: boolean;
  palette: string[];
  textColor: string | null;
  width: number;
}) {
  const items = readArray(data?.items).map(asRecord).filter(Boolean).slice(0, 10);
  const evenItems = items.slice(0, items.length - (items.length % 2));
  const safeItems = evenItems.length >= 2
    ? evenItems
    : [{ heading: "Before" }, { heading: "After" }];
  const pairCount = safeItems.length / 2;
  const darkBackground = isDarkInfographicColor(baseColor);
  const textColor = customTextColor ?? (darkBackground ? "#F0F1F4" : "#111111");
  const centerX = width * 0.5;
  const lineTop = height * 0.18;
  const lineBottom = height * 0.94;
  const nodeRadius = Math.min(width * 0.043, height * 0.075);
  const headerY = height * 0.04;
  const pillWidth = width * 0.14;
  const pillHeight = height * 0.07;
  const rowTop = height * 0.31;
  const rowBottom = height * 0.81;
  const rowY = (index: number) => pairCount === 1
    ? (rowTop + rowBottom) / 2
    : rowTop + (index / (pairCount - 1)) * (rowBottom - rowTop);
  const pillFill = darkBackground ? "#FFFFFF" : palette[Math.min(3, palette.length - 1)] ?? "#4D73BE";
  const pillText = darkBackground ? palette[Math.min(3, palette.length - 1)] ?? "#4D73BE" : "#F0F1F4";

  return (
    <Group listening={interactive}>
      <Rect x={width * 0.045} y={headerY} width={pillWidth} height={pillHeight} cornerRadius={pillHeight / 2} fill={pillFill} />
      <Text x={width * 0.045} y={headerY} width={pillWidth} height={pillHeight} text={readString(data?.before_label) ?? "Before"} fontFamily="Arial, Helvetica, sans-serif" fontSize={Math.max(11, Math.min(16, height * 0.036))} fontStyle="bold" verticalAlign="middle" align="center" fill={pillText} />
      <Rect x={width * 0.815} y={headerY} width={pillWidth} height={pillHeight} cornerRadius={pillHeight / 2} fill={pillFill} />
      <Text x={width * 0.815} y={headerY} width={pillWidth} height={pillHeight} text={readString(data?.after_label) ?? "After"} fontFamily="Arial, Helvetica, sans-serif" fontSize={Math.max(11, Math.min(16, height * 0.036))} fontStyle="bold" verticalAlign="middle" align="center" fill={pillText} />
      <Line points={[centerX, lineTop, centerX, lineBottom]} stroke="#D1D1D1" strokeWidth={1.5} />
      <Circle x={centerX} y={lineTop} radius={4} fill="#D1D1D1" />
      <Circle x={centerX} y={lineBottom} radius={4} fill="#D1D1D1" />
      {Array.from({ length: Math.max(0, pairCount - 1) }, (_, index) => (
        <Circle
          key={`before-after-divider-${index}`}
          x={centerX}
          y={(rowY(index) + rowY(index + 1)) / 2}
          radius={Math.max(8, height * 0.017)}
          fill="#D1D1D1"
        />
      ))}
      {Array.from({ length: pairCount }, (_, index) => {
        const beforeItem = safeItems[index * 2];
        const afterItem = safeItems[index * 2 + 1];
        const y = rowY(index);
        const beforeColor = palette[index % palette.length] ?? "#102E79";
        const afterColor = palette[(index + pairCount) % palette.length] ?? "#6388D0";
        const beforeIcon = normalizeInfographicIcon(beforeItem?.icon, beforeItem?.color);
        const afterIcon = normalizeInfographicIcon(afterItem?.icon, afterItem?.color);
        return (
          <Group key={`before-after-row-${index}`}>
            <Circle x={width * 0.39} y={y} radius={nodeRadius} fill={beforeColor} />
            <InfographicUrlIcon color={beforeIcon?.color ?? null} icon={beforeIcon?.url ?? null} x={width * 0.39} y={y} size={nodeRadius * 0.68} />
            <Text x={width * 0.045} y={y - height * 0.035} width={width * 0.27} height={height * 0.06} text={readString(beforeItem?.heading) ?? `Before ${index + 1}`} fontFamily="Arial, Helvetica, sans-serif" fontSize={Math.max(10, Math.min(14, height * 0.033))} fontStyle="bold" fill={customTextColor ?? (darkBackground ? textColor : beforeColor)} />
            <Text x={width * 0.045} y={y + height * 0.02} width={width * 0.27} height={height * 0.09} text={readString(beforeItem?.description) ?? ""} fontFamily="Arial, Helvetica, sans-serif" fontSize={Math.max(8, Math.min(11, height * 0.026))} lineHeight={1.15} fill={textColor} />
            <Circle x={width * 0.61} y={y} radius={nodeRadius} fill={afterColor} />
            <InfographicUrlIcon color={afterIcon?.color ?? null} icon={afterIcon?.url ?? null} x={width * 0.61} y={y} size={nodeRadius * 0.68} />
            <Text x={width * 0.685} y={y - height * 0.035} width={width * 0.27} height={height * 0.06} text={readString(afterItem?.heading) ?? `After ${index + 1}`} fontFamily="Arial, Helvetica, sans-serif" fontSize={Math.max(10, Math.min(14, height * 0.033))} fontStyle="bold" align="right" fill={customTextColor ?? (darkBackground ? textColor : afterColor)} />
            <Text x={width * 0.685} y={y + height * 0.02} width={width * 0.27} height={height * 0.09} text={readString(afterItem?.description) ?? ""} fontFamily="Arial, Helvetica, sans-serif" fontSize={Math.max(8, Math.min(11, height * 0.026))} lineHeight={1.15} align="right" fill={textColor} />
          </Group>
        );
      })}
    </Group>
  );
}

function polarPoint(
  centerX: number,
  centerY: number,
  radius: number,
  angleDegrees: number,
) {
  const angle = (angleDegrees * Math.PI) / 180;
  return {
    x: centerX + Math.cos(angle) * radius,
    y: centerY + Math.sin(angle) * radius,
  };
}

function annularSectorPath(
  centerX: number,
  centerY: number,
  innerRadius: number,
  outerRadius: number,
  startAngle: number,
  endAngle: number,
  cornerRadius: number,
) {
  const span = endAngle - startAngle;
  const outerOffset = Math.min((cornerRadius / outerRadius) * (180 / Math.PI), span * 0.18);
  const innerOffset = Math.min((cornerRadius / innerRadius) * (180 / Math.PI), span * 0.18);
  const outerStart = polarPoint(centerX, centerY, outerRadius, startAngle + outerOffset);
  const outerEnd = polarPoint(centerX, centerY, outerRadius, endAngle - outerOffset);
  const outerCornerEnd = polarPoint(centerX, centerY, outerRadius, endAngle);
  const outerInsetEnd = polarPoint(centerX, centerY, outerRadius - cornerRadius, endAngle);
  const innerOutEnd = polarPoint(centerX, centerY, innerRadius + cornerRadius, endAngle);
  const innerCornerEnd = polarPoint(centerX, centerY, innerRadius, endAngle);
  const innerEnd = polarPoint(centerX, centerY, innerRadius, endAngle - innerOffset);
  const innerStart = polarPoint(centerX, centerY, innerRadius, startAngle + innerOffset);
  const innerCornerStart = polarPoint(centerX, centerY, innerRadius, startAngle);
  const innerOutStart = polarPoint(centerX, centerY, innerRadius + cornerRadius, startAngle);
  const outerInsetStart = polarPoint(centerX, centerY, outerRadius - cornerRadius, startAngle);
  const outerCornerStart = polarPoint(centerX, centerY, outerRadius, startAngle);
  const largeArc = span > 180 ? 1 : 0;
  return [
    `M ${outerStart.x} ${outerStart.y}`,
    `A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${outerEnd.x} ${outerEnd.y}`,
    `Q ${outerCornerEnd.x} ${outerCornerEnd.y} ${outerInsetEnd.x} ${outerInsetEnd.y}`,
    `L ${innerOutEnd.x} ${innerOutEnd.y}`,
    `Q ${innerCornerEnd.x} ${innerCornerEnd.y} ${innerEnd.x} ${innerEnd.y}`,
    `A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${innerStart.x} ${innerStart.y}`,
    `Q ${innerCornerStart.x} ${innerCornerStart.y} ${innerOutStart.x} ${innerOutStart.y}`,
    `L ${outerInsetStart.x} ${outerInsetStart.y}`,
    `Q ${outerCornerStart.x} ${outerCornerStart.y} ${outerStart.x} ${outerStart.y}`,
    "Z",
  ].join(" ");
}

function roundedOrthogonalPath(
  points: Array<{ x: number; y: number }>,
  radius: number,
) {
  const first = points[0];
  if (!first) return "";
  const commands = [`M ${first.x} ${first.y}`];
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    if (Math.abs(current.y - previous.y) < 0.01) {
      commands.push(`L ${current.x} ${current.y}`);
      continue;
    }
    const middleX = (previous.x + current.x) / 2;
    const horizontalDirection = Math.sign(current.x - previous.x) || 1;
    const verticalDirection = Math.sign(current.y - previous.y) || 1;
    const safeRadius = Math.min(
      radius,
      Math.abs(current.x - previous.x) / 4,
      Math.abs(current.y - previous.y) / 2,
    );
    commands.push(
      `L ${middleX - horizontalDirection * safeRadius} ${previous.y}`,
      `Q ${middleX} ${previous.y} ${middleX} ${previous.y + verticalDirection * safeRadius}`,
      `L ${middleX} ${current.y - verticalDirection * safeRadius}`,
      `Q ${middleX} ${current.y} ${middleX + horizontalDirection * safeRadius} ${current.y}`,
      `L ${current.x} ${current.y}`,
    );
  }
  return commands.join(" ");
}

function RawPyramidInfographic({
  baseColor,
  data,
  height,
  interactive,
  palette,
  textColor: customTextColor,
  width,
}: {
  baseColor: string;
  data: RawElement | null;
  height: number;
  interactive: boolean;
  palette: string[];
  textColor: string | null;
  width: number;
}) {
  const items = readArray(data?.items).map(asRecord).filter(Boolean).slice(0, 4);
  const safeItems = items.length >= 3 ? items : [
    { heading: "Foundation" },
    { heading: "Efficiency" },
    { heading: "Innovation" },
  ];
  const darkBackground = isDarkInfographicColor(baseColor);
  const outsideTextColor = customTextColor ?? (darkBackground ? "#F0F1F4" : "#111111");
  const apexX = width * 0.5;
  const apexY = height * 0.05;
  const bottomY = height * 0.94;
  const baseLeft = width * 0.25;
  const baseRight = width * 0.75;
  const firstCut = height * 0.35;
  const secondCut = height * 0.68;
  const leftAt = (y: number) => apexX - ((y - apexY) / (bottomY - apexY)) * (apexX - baseLeft);
  const rightAt = (y: number) => apexX + ((y - apexY) / (bottomY - apexY)) * (baseRight - apexX);
  const shapeItems = [
    {
      item: safeItems[0],
      color: palette[0 % palette.length] ?? "#102E79",
      points: [apexX, apexY, rightAt(firstCut), firstCut, leftAt(firstCut), firstCut],
      x: apexX,
      y: (apexY + firstCut * 2) / 3,
      callout: "right-top" as const,
    },
    {
      item: safeItems[1],
      color: palette[1 % palette.length] ?? "#24468E",
      points: [leftAt(firstCut), firstCut, rightAt(firstCut), firstCut, rightAt(secondCut), secondCut, leftAt(secondCut), secondCut],
      x: apexX,
      y: (firstCut + secondCut) / 2,
      callout: "left-middle" as const,
    },
    ...(safeItems.length >= 4
      ? [
          {
            item: safeItems[2],
            color: palette[2 % palette.length] ?? "#385EAA",
            points: [leftAt(secondCut), secondCut, apexX, secondCut, apexX, bottomY, baseLeft, bottomY],
            x: (leftAt(secondCut) + apexX + baseLeft) / 3,
            y: (secondCut + bottomY) / 2,
            callout: "left-bottom" as const,
          },
          {
            item: safeItems[3],
            color: palette[3 % palette.length] ?? "#4D73BE",
            points: [apexX, secondCut, rightAt(secondCut), secondCut, baseRight, bottomY, apexX, bottomY],
            x: (rightAt(secondCut) + apexX + baseRight) / 3,
            y: (secondCut + bottomY) / 2,
            callout: "right-bottom" as const,
          },
        ]
      : [
          {
            item: safeItems[2],
            color: palette[2 % palette.length] ?? "#4D73BE",
            points: [leftAt(secondCut), secondCut, rightAt(secondCut), secondCut, baseRight, bottomY, baseLeft, bottomY],
            x: apexX,
            y: (secondCut + bottomY) / 2,
            callout: "right-bottom" as const,
          },
        ]),
  ];

  return (
    <Group listening={interactive}>
      {shapeItems.map(({ callout, color, item, points, x, y }, index) => {
        const itemIcon = normalizeInfographicIcon(item?.icon, item?.color);
        const insideTextColor = blackOrWhiteTextColor(color);
        const calloutLayout = pyramidCalloutLayout(callout, width, height);
        return (
          <Group key={`pyramid-item-${index}`}>
            <Line closed points={points} fill={color} />
            <InfographicUrlIcon
              color={itemIcon?.color ?? null}
              icon={itemIcon?.url ?? null}
              x={x}
              y={y - height * 0.025}
              size={Math.max(18, Math.min(width * 0.045, height * 0.075))}
            />
            <Text
              x={x - width * 0.09}
              y={y + height * 0.045}
              width={width * 0.18}
              height={height * 0.06}
              text={readString(item?.heading) ?? `Level ${index + 1}`}
              fontFamily="Arial, Helvetica, sans-serif"
              fontSize={Math.max(9, Math.min(14, height * 0.035))}
              fontStyle="bold"
              align="center"
              fill={insideTextColor}
            />
            <Line
              points={calloutLayout.line}
              stroke="#D1D1D1"
              strokeWidth={1.25}
            />
            <Text
              x={calloutLayout.textX}
              y={calloutLayout.textY}
              width={calloutLayout.textWidth}
              height={height * 0.06}
              text={readString(item?.heading) ?? `Level ${index + 1}`}
              fontFamily="Arial, Helvetica, sans-serif"
              fontSize={Math.max(9, Math.min(13, height * 0.034))}
              fontStyle="bold"
              align={calloutLayout.align}
              fill={outsideTextColor}
            />
            <Text
              x={calloutLayout.textX}
              y={calloutLayout.textY + height * 0.055}
              width={calloutLayout.textWidth}
              height={height * 0.12}
              text={readString(item?.description) ?? ""}
              fontFamily="Arial, Helvetica, sans-serif"
              fontSize={Math.max(7, Math.min(10, height * 0.027))}
              lineHeight={1.15}
              align={calloutLayout.align}
              fill={outsideTextColor}
            />
          </Group>
        );
      })}
    </Group>
  );
}

function funnelBoundaryRatio(t: number) {
  const normalized = (1 - Math.exp(-2.3 * clamp(t, 0, 1))) / (1 - Math.exp(-2.3));
  return 0.62 - normalized * 0.52;
}

function pyramidCalloutLayout(
  placement: "right-top" | "left-middle" | "left-bottom" | "right-bottom",
  width: number,
  height: number,
) {
  const left = placement.startsWith("left");
  const lineY = placement === "right-top"
    ? height * 0.105
    : placement === "left-middle"
      ? height * 0.385
      : height * 0.71;
  const apexY = height * 0.05;
  const bottomY = height * 0.94;
  const edgeProgress = (lineY - apexY) / (bottomY - apexY);
  const edgeX = left
    ? width * 0.5 - edgeProgress * width * 0.25
    : width * 0.5 + edgeProgress * width * 0.25;
  const lineEnd = edgeX + (left ? -1 : 1) * width * 0.1;
  const textWidth = width * 0.18;
  return {
    line: [edgeX, lineY, lineEnd, lineY],
    textX: left
      ? edgeX - width * 0.125 - textWidth
      : edgeX + width * 0.125,
    textY: lineY - height * 0.015,
    textWidth,
    align: (left ? "right" : "left") as "left" | "right",
  };
}

const ROADMAP_CURVE_X = [-0.12, 0, 0.2, 0.4, 0.6, 0.8, 1, 1.12];
const ROADMAP_CURVE_Y = [0.4, 0.34, 0.2, 0.47, 0.3, 0.38, 0.61, 0.49];
const ROADMAP_LABEL_X = [0, 0.2, 0.4, 0.6, 0.8, 1];
const ROADMAP_LABEL_Y = [0.52, 0.31, 0.57, 0.46, 0.58, 0.73];

function roadmapRoadRatio(t: number) {
  return catmullRomAt(t, ROADMAP_CURVE_X, ROADMAP_CURVE_Y);
}

function roadmapLabelRatio(t: number) {
  return catmullRomAt(t, ROADMAP_LABEL_X, ROADMAP_LABEL_Y);
}

function catmullRomAt(t: number, positions: number[], values: number[]) {
  const last = positions.length - 1;
  let segment = Math.max(0, last - 1);
  for (let index = 0; index < last; index += 1) {
    if (t <= positions[index + 1]) {
      segment = index;
      break;
    }
  }
  const start = positions[segment];
  const end = positions[segment + 1];
  const u = end === start ? 0 : clamp((t - start) / (end - start), 0, 1);
  const p0 = values[Math.max(0, segment - 1)];
  const p1 = values[segment];
  const p2 = values[segment + 1];
  const p3 = values[Math.min(last, segment + 2)];
  const u2 = u * u;
  const u3 = u2 * u;
  return 0.5 * (
    2 * p1 +
    (-p0 + p2) * u +
    (2 * p0 - 5 * p1 + 4 * p2 - p3) * u2 +
    (-p0 + 3 * p1 - 3 * p2 + p3) * u3
  );
}

function RawImpactEffortInfographic({
  baseColor,
  data,
  height,
  interactive,
  palette,
  textColor: customTextColor,
  width,
}: InfographicRendererProps) {
  const dark = isDarkInfographicColor(baseColor);
  const textColor = customTextColor ?? (dark ? "#F3F4F6" : "#111111");
  const axisColor = dark ? "#E4E4E7" : "#D1D1D1";
  const items = readArray(data?.items).map(asRecord).filter(Boolean).slice(0, 4);
  const defaults = ["Quick Wins", "Strategic Priorities", "Deprioritize", "Fill-ins"];
  const cx = width * 0.49;
  const cy = height * 0.523;
  const axisHalfX = width * 0.226;
  const axisHalfY = height * 0.43;
  const blockW = width * 0.157;
  const blockH = height * 0.297;
  const blockThickness = Math.min(blockW * 0.36, blockH * 0.34);
  const calloutWidth = width * 0.205;
  const calloutGap = width * 0.02;
  const positions = [
    { outerX: width * 0.262, outerY: height * 0.095, circleX: width * 0.366, circleY: height * 0.291, side: -1, horizontal: "top", vertical: "left" },
    { outerX: width * 0.559, outerY: height * 0.095, circleX: width * 0.613, circleY: height * 0.291, side: 1, horizontal: "top", vertical: "right" },
    { outerX: width * 0.559, outerY: height * 0.657, circleX: width * 0.613, circleY: height * 0.759, side: 1, horizontal: "bottom", vertical: "right" },
    { outerX: width * 0.262, outerY: height * 0.657, circleX: width * 0.366, circleY: height * 0.759, side: -1, horizontal: "bottom", vertical: "left" },
  ] as const;
  return (
    <Group listening={interactive}>
      <Line points={[cx - axisHalfX, cy, cx + axisHalfX, cy]} stroke={axisColor} strokeWidth={2} />
      <Line points={[cx, cy - axisHalfY, cx, cy + axisHalfY]} stroke={axisColor} strokeWidth={2} />
      <Circle x={cx} y={cy} radius={Math.max(10, Math.min(width, height) * 0.032)} fill={axisColor} />
      {[[cx + axisHalfX, cy, 0], [cx - axisHalfX, cy, 180], [cx, cy - axisHalfY, -90], [cx, cy + axisHalfY, 90]].map(([x, y, rotation], index) => (
        <Line key={`axis-arrow-${index}`} x={x} y={y} rotation={rotation} points={[-9, -6, 0, 0, -9, 6]} closed fill={axisColor} stroke={axisColor} />
      ))}
      <Text x={cx + 16} y={cy + 7} width={80} text={readString(data?.x_axis_label) ?? "Impact"} fontSize={Math.max(8, height * 0.026)} fill={textColor} />
      <Text x={cx - 28} y={cy - 55} width={70} text={readString(data?.y_axis_label) ?? "Effort"} rotation={-90} fontSize={Math.max(8, height * 0.026)} fill={textColor} />
      <Text x={cx - axisHalfX - 42} y={cy - 8} width={36} align="right" text={readString(data?.low_label) ?? "Low"} fontSize={Math.max(8, height * 0.026)} fill={textColor} />
      <Text x={cx + axisHalfX + 8} y={cy - 8} width={42} text={readString(data?.high_label) ?? "High"} fontSize={Math.max(8, height * 0.026)} fill={textColor} />
      <Text x={cx - 28} y={cy - axisHalfY - 22} width={56} align="center" text={readString(data?.high_label) ?? "High"} fontSize={Math.max(8, height * 0.026)} fill={textColor} />
      <Text x={cx - 28} y={cy + axisHalfY + 7} width={56} align="center" text={readString(data?.low_label) ?? "Low"} fontSize={Math.max(8, height * 0.026)} fill={textColor} />
      {positions.map((position, index) => {
        const item = items[index];
        const color = palette[index % Math.max(1, palette.length)] ?? "#24468E";
        const nodeTextColor = blackOrWhiteTextColor(color);
        const horizontalY = position.horizontal === "top" ? position.outerY : position.outerY + blockH - blockThickness;
        const verticalX = position.vertical === "left" ? position.outerX : position.outerX + blockW - blockThickness;
        const circleX = position.circleX;
        const circleY = position.circleY;
        const calloutX = position.side < 0
          ? position.outerX - calloutGap - calloutWidth
          : position.outerX + blockW + calloutGap;
        const calloutY = index < 2 ? circleY - height * 0.095 : circleY - height * 0.01;
        return (
          <Fragment key={`impact-quadrant-${index}`}>
            <Rect x={position.outerX} y={horizontalY} width={blockW} height={blockThickness} fill={color} />
            <Rect x={verticalX} y={position.outerY} width={blockThickness} height={blockH} fill={color} />
            <Circle x={circleX} y={circleY} radius={Math.max(15, Math.min(width, height) * 0.045)} fill={color} />
            <Text x={circleX - 25} y={circleY - 12} width={50} align="center" text={String(index + 1).padStart(2, "0")} fontStyle="bold" fontSize={Math.max(10, height * 0.05)} fill={nodeTextColor} />
            <Text x={calloutX} y={calloutY} width={calloutWidth} align={position.side < 0 ? "right" : "left"} text={readString(item?.heading) ?? defaults[index]} fontStyle="bold" fontSize={Math.max(9, height * 0.032)} fill={color} />
            <Text x={calloutX} y={calloutY + height * 0.052} width={calloutWidth} align={position.side < 0 ? "right" : "left"} text={readString(item?.description) ?? ""} fontSize={Math.max(8, height * 0.024)} lineHeight={1.15} fill={textColor} />
          </Fragment>
        );
      })}
    </Group>
  );
}

type InfographicRendererProps = {
  baseColor: string;
  data: RawElement | null;
  height: number;
  interactive: boolean;
  palette: string[];
  textColor: string | null;
  width: number;
};

function RawComparisonMatrixInfographic(props: InfographicRendererProps) {
  const { baseColor, data, height, interactive, palette, width } = props;
  const dark = isDarkInfographicColor(baseColor);
  const criteria = readArray(data?.criteria)
    .map(readString)
    .filter((value): value is string => Boolean(value));
  const items = readArray(data?.items).map(asRecord).filter(Boolean).slice(0, 6);
  const safeCriteria = criteria.length > 0 ? criteria : ["Criterion"];
  const padding = width * 0.03;
  const top = height * 0.18;
  const tableHeight = height * 0.65;
  const criteriaWidth = width * 0.17;
  const optionWidth = (width - padding * 2 - criteriaWidth) / Math.max(1, items.length);
  const headerHeight = tableHeight * 0.36;
  const rowHeight = (tableHeight - headerHeight) / safeCriteria.length;
  const badgeColor =
    withHash(readString(data?.card_color)) ?? "#E4E4E7";
  const iconColor =
    withHash(readString(data?.background_text_color)) ?? "#111111";
  return (
    <Group listening={interactive}>
      <Rect x={padding} y={top} width={criteriaWidth - 4} height={tableHeight} fill={badgeColor} />
      <Text x={padding} y={top + headerHeight * 0.36} width={criteriaWidth - 4} align="center" text="Criteria" fontStyle="bold" fontSize={Math.max(9, height * 0.032)} fill={iconColor} />
      {safeCriteria.map((criterion, rowIndex) => <Text key={`criterion-${rowIndex}`} x={padding + 5} y={top + headerHeight + rowIndex * rowHeight} width={criteriaWidth - 14} height={rowHeight} align="center" verticalAlign="middle" text={criterion} fontSize={Math.max(8, height * 0.024)} fill={iconColor} />)}
      {items.map((item, index) => {
        const x = padding + criteriaWidth + index * optionWidth;
        const color = palette[index % Math.max(1, palette.length)] ?? "#24468E";
        const columnTextColor = blackOrWhiteTextColor(color);
        const icon = normalizeInfographicIcon(item?.icon, item?.color);
        const values = readArray(item?.values).map(readString);
        return (
          <Fragment key={`comparison-column-${index}`}>
            <Rect x={x + 2} y={top} width={optionWidth - 4} height={tableHeight} fill={color} />
            <Circle x={x + optionWidth / 2} y={top} radius={Math.min(optionWidth * 0.2, height * 0.075)} fill={badgeColor} stroke={color} strokeWidth={3} />
            <InfographicUrlIcon color={iconColor} icon={icon?.url ?? null} x={x + optionWidth / 2} y={top} size={Math.min(optionWidth * 0.19, height * 0.065)} />
            <Text x={x + 7} y={top + headerHeight * 0.35} width={optionWidth - 14} align="center" text={readString(item?.heading) ?? `Option ${index + 1}`} fontStyle="bold" fontSize={Math.max(8, height * 0.029)} fill={columnTextColor} />
            {safeCriteria.map((_, rowIndex) => <Fragment key={`value-${index}-${rowIndex}`}><Line points={[x + 2, top + headerHeight + rowIndex * rowHeight, x + optionWidth - 2, top + headerHeight + rowIndex * rowHeight]} stroke={dark ? "#FFFFFF" : "#D1D5DB"} opacity={0.35} /><Text x={x + 5} y={top + headerHeight + rowIndex * rowHeight} width={optionWidth - 10} height={rowHeight} align="center" verticalAlign="middle" text={values[rowIndex] ?? ""} fontSize={Math.max(8, height * 0.023)} fill={columnTextColor} /></Fragment>)}
          </Fragment>
        );
      })}
    </Group>
  );
}

function RawHierarchyInfographic({ type, ...props }: InfographicRendererProps & { type: "org_chart" | "decision_tree" }) {
  const { baseColor, data, height, interactive, palette, width } = props;
  const dark = isDarkInfographicColor(baseColor);
  const items = readArray(data?.items).map(asRecord).filter(Boolean).slice(0, 18);
  const ids = items.map((item, index) => readString(item?.id) ?? `node-${index}`);
  const byId = new Map(ids.map((id, index) => [id, index]));
  const children = items.map(() => [] as number[]);
  const roots: number[] = [];
  items.forEach((item, index) => {
    const parent = readString(item?.parent_id);
    const parentIndex = parent ? byId.get(parent) : undefined;
    if (parentIndex == null || parentIndex === index) roots.push(index);
    else children[parentIndex].push(index);
  });
  const rootIndexes = roots.length > 0 ? roots : [0];
  const positions = new Map<number, { x: number; y: number; depth: number }>();
  if (type === "decision_tree") {
    const root = rootIndexes[0] ?? 0;
    positions.set(root, { x: width * 0.5, y: height * 0.5, depth: 0 });
    const first = children[root] ?? [];
    const anchors = [[0.28, 0.27], [0.28, 0.73], [0.72, 0.27], [0.72, 0.73]];
    first.forEach((index, childIndex) => {
      const [x, y] = anchors[childIndex % anchors.length];
      positions.set(index, { x: width * x, y: height * y, depth: 1 });
      const leaves = children[index] ?? [];
      leaves.forEach((leaf, leafIndex) => positions.set(leaf, { x: width * (x < 0.5 ? 0.08 : 0.92), y: height * (y + (leafIndex - (leaves.length - 1) / 2) * 0.16), depth: 2 }));
    });
  } else {
    const levels: number[][] = [];
    const queue = rootIndexes.map((index) => ({ index, depth: 0 }));
    const seen = new Set<number>();
    while (queue.length) {
      const current = queue.shift();
      if (!current || seen.has(current.index)) continue;
      seen.add(current.index);
      (levels[current.depth] ??= []).push(current.index);
      children[current.index].forEach((index) => queue.push({ index, depth: current.depth + 1 }));
    }
    levels.forEach((level, depth) => level.forEach((index, positionIndex) => positions.set(index, { x: width * ((positionIndex + 1) / (level.length + 1)), y: height * (0.12 + depth * (0.76 / Math.max(1, levels.length - 1))), depth })));
  }
  const nodeRadius = type === "decision_tree" ? Math.min(width, height) * 0.095 : 0;
  const boxWidth = width * Math.min(0.19, 0.76 / Math.max(2, Math.max(...Array.from(positions.values()).map((position) => Array.from(positions.values()).filter((other) => other.depth === position.depth).length))));
  const boxHeight = height * 0.14;
  return (
    <Group listening={interactive}>
      {items.map((item, index) => {
        const position = positions.get(index);
        const parentIndex = byId.get(readString(item?.parent_id) ?? "");
        const parentPosition = parentIndex == null ? null : positions.get(parentIndex);
        if (!position || !parentPosition) return null;
        const points = type === "org_chart"
          ? [parentPosition.x, parentPosition.y + boxHeight / 2, parentPosition.x, (parentPosition.y + position.y) / 2, position.x, (parentPosition.y + position.y) / 2, position.x, position.y - boxHeight / 2]
          : [parentPosition.x, parentPosition.y, position.x, position.y];
        return <Line key={`hierarchy-line-${index}`} points={points} stroke={dark ? "#E4E4E7" : "#D1D1D1"} strokeWidth={2} lineJoin="round" />;
      })}
      {items.map((item, index) => {
        const position = positions.get(index);
        if (!position) return null;
        const color = palette[Math.min(position.depth, Math.max(0, palette.length - 1))] ?? "#24468E";
        const nodeTextColor = blackOrWhiteTextColor(color);
        if (type === "decision_tree") {
          const radius = position.depth === 0 ? nodeRadius * 1.25 : position.depth === 1 ? nodeRadius : nodeRadius * 0.57;
          return <Fragment key={`hierarchy-node-${index}`}><Circle x={position.x} y={position.y} radius={radius} fill={color} /><Text x={position.x - radius * 0.85} y={position.y - 18} width={radius * 1.7} height={36} align="center" verticalAlign="middle" text={readString(item?.heading) ?? ""} fontStyle={position.depth < 2 ? "bold" : "normal"} fontSize={Math.max(7, height * (position.depth === 2 ? 0.02 : 0.026))} fill={nodeTextColor} /></Fragment>;
        }
        return <Fragment key={`hierarchy-node-${index}`}><Rect x={position.x - boxWidth / 2} y={position.y - boxHeight / 2} width={boxWidth} height={boxHeight} fill={color} stroke={dark ? "#D1D5DB" : color} strokeWidth={1} /><Text x={position.x - boxWidth * 0.46} y={position.y - boxHeight * 0.38} width={boxWidth * 0.22} text={String(index + 1).padStart(2, "0")} fontStyle="bold" fontSize={Math.max(9, height * 0.034)} fill={nodeTextColor} /><Text x={position.x - boxWidth * 0.3} y={position.y - boxHeight * 0.28} width={boxWidth * 0.68} align="center" text={readString(item?.heading) ?? ""} fontStyle="bold" fontSize={Math.max(8, height * 0.026)} fill={nodeTextColor} /><Text x={position.x - boxWidth * 0.3} y={position.y + boxHeight * 0.04} width={boxWidth * 0.68} align="center" text={readString(item?.description) ?? ""} fontSize={Math.max(7, height * 0.021)} fill={nodeTextColor} /></Fragment>;
      })}
    </Group>
  );
}

function RawMindMapInfographic({
  baseColor,
  data,
  height,
  interactive,
  palette,
  textColor: customTextColor,
  width,
}: {
  baseColor: string;
  data: RawElement | null;
  height: number;
  interactive: boolean;
  palette: string[];
  textColor: string | null;
  width: number;
}) {
  const topLevel = readArray(data?.items).map(asRecord).filter(Boolean);
  const firstNested = readArray(topLevel[0]?.items).map(asRecord).filter(Boolean);
  const usesNestedItems = topLevel.length === 1 && firstNested.length > 0;
  const items = (usesNestedItems
    ? firstNested
    : topLevel
  ).slice(0, 8);
  const safeItems = items.length > 0 ? items : [{ heading: "Core idea" }];
  const darkBackground = isDarkInfographicColor(baseColor);
  const layout = mindMapLayout(safeItems.length, width, height);
  const textColor =
    customTextColor ?? (darkBackground ? "#F0F1F4" : "#111111");
  const mutedTextColor =
    customTextColor ?? (darkBackground ? "#E1E4EA" : "#222222");

  return (
    <Group listening={interactive}>
      {safeItems.map((item, index) => {
        const position = layout.positions[index];
        const color = palette[index % palette.length] ?? "#2563EB";
        const itemIcon = normalizeInfographicIcon(item?.icon, item?.color);
        const textBox = mindMapTextBox(
          position,
          layout.radius,
          width,
          height,
        );
        return (
          <Group key={`mind-map-item-${index}`}>
            <Circle
              x={position.x}
              y={position.y}
              radius={layout.radius}
              fill={color}
              opacity={0.88}
            />
            <InfographicUrlIcon
              color={itemIcon?.color ?? null}
              icon={itemIcon?.url ?? null}
              x={position.x}
              y={position.y}
              size={Math.max(24, layout.radius * 0.42)}
            />
            <Text
              x={textBox.x}
              y={textBox.y}
              width={textBox.width}
              height={textBox.headingHeight}
              text={
                readString(item?.heading) ?? `Idea ${index + 1}`
              }
              fontFamily="Arial, Helvetica, sans-serif"
              fontSize={Math.max(11, Math.min(17, height * 0.045))}
              fontStyle="bold"
              align="center"
              verticalAlign={textBox.verticalAlign}
              fill={textColor}
            />
            <Text
              x={textBox.x}
              y={textBox.y + textBox.headingHeight}
              width={textBox.width}
              height={textBox.descriptionHeight}
              text={readString(item?.description) ?? ""}
              fontFamily="Arial, Helvetica, sans-serif"
              fontSize={Math.max(8, Math.min(12, height * 0.032))}
              lineHeight={1.2}
              align="center"
              fill={mutedTextColor}
            />
          </Group>
        );
      })}
    </Group>
  );
}

function InfographicUrlIcon({
  color,
  icon,
  size,
  x,
  y,
}: {
  color: string | null;
  icon: string | null;
  size: number;
  x: number;
  y: number;
}) {
  const renderSrc = useMemo(() => {
    if (!icon || typeof window === "undefined") return icon;
    const baseUrl = window.location.href;
    if (!isStaticSvgIconSource(icon, baseUrl)) return icon;
    return buildSvgUpdateUrl(icon, baseUrl, {
      color: withHash(color) ?? "#FFFFFF",
    }) ?? icon;
  }, [color, icon]);
  const loaded = useLoadedKonvaImage(renderSrc);

  const naturalRatio = loaded ? loaded.width / loaded.height || 1 : 1;
  const drawWidth = naturalRatio >= 1 ? size : size * naturalRatio;
  const drawHeight = naturalRatio >= 1 ? size / naturalRatio : size;
  return (
    <Group
      x={x}
      y={y}
      listening={false}
    >
      <Rect
        x={-size / 2}
        y={-size / 2}
        width={size}
        height={size}
        fill="rgba(0,0,0,0.001)"
      />
      {loaded ? (
        <KonvaImage
          image={loaded}
          x={-drawWidth / 2}
          y={-drawHeight / 2}
          width={drawWidth}
          height={drawHeight}
          listening={false}
        />
      ) : null}
    </Group>
  );
}

function mindMapLayout(count: number, width: number, height: number) {
  const centerX = width / 2;
  const centerY = height / 2;
  const radius = Math.max(
    28,
    Math.min(width * 0.105, height * (count >= 5 ? 0.19 : 0.22)),
  );

  if (count === 1) {
    return { radius, positions: [{ x: centerX, y: centerY - radius * 0.25 }] };
  }
  if (count === 2) {
    return {
      radius,
      positions: [
        { x: centerX - radius * 0.78, y: centerY },
        { x: centerX + radius * 0.78, y: centerY },
      ],
    };
  }
  if (count === 3) {
    return {
      radius,
      positions: [
        { x: centerX - radius * 0.78, y: centerY - radius * 0.58 },
        { x: centerX, y: centerY + radius * 0.72 },
        { x: centerX + radius * 0.78, y: centerY - radius * 0.58 },
      ],
    };
  }
  if (count === 4) {
    return {
      radius,
      positions: [
        { x: centerX - radius * 0.78, y: centerY - radius * 0.7 },
        { x: centerX - radius * 0.78, y: centerY + radius * 0.7 },
        { x: centerX + radius * 0.78, y: centerY - radius * 0.7 },
        { x: centerX + radius * 0.78, y: centerY + radius * 0.7 },
      ],
    };
  }

  const leftCount = Math.ceil(count / 2);
  const rightCount = count - leftCount;
  const verticalStep = radius * 1.45;
  const columnPositions = (columnCount: number, x: number) => {
    const span = verticalStep * Math.max(0, columnCount - 1);
    return Array.from({ length: columnCount }, (_, index) => ({
      x,
      y: centerY - span / 2 + index * verticalStep,
    }));
  };
  return {
    radius,
    positions: [
      ...columnPositions(leftCount, centerX - radius * 0.78),
      ...columnPositions(rightCount, centerX + radius * 0.78),
    ],
  };
}

function mindMapTextBox(
  position: { x: number; y: number },
  radius: number,
  width: number,
  height: number,
) {
  const headingHeight = Math.max(22, height * 0.075);
  const descriptionHeight = Math.max(30, height * 0.12);
  const textWidth = Math.max(100, Math.min(width * 0.27, position.x - radius - 16));
  const isBottom = position.y + radius > height * 0.82;
  if (isBottom && Math.abs(position.x - width / 2) < radius * 0.5) {
    return {
      x: width / 2 - textWidth / 2,
      y: Math.min(height - headingHeight - descriptionHeight, position.y + radius + 10),
      width: textWidth,
      headingHeight,
      descriptionHeight,
      verticalAlign: "middle" as const,
    };
  }
  const isLeft = position.x < width / 2;
  return {
    x: isLeft ? 0 : width - textWidth,
    y: clamp(
      position.y - (headingHeight + descriptionHeight) / 2,
      0,
      height - headingHeight - descriptionHeight,
    ),
    width: textWidth,
    headingHeight,
    descriptionHeight,
    verticalAlign: "bottom" as const,
  };
}

function isDarkInfographicColor(color: string) {
  const hex = color.replace(/^#/, "");
  if (!/^[0-9a-f]{6}$/i.test(hex)) return false;
  const red = Number.parseInt(hex.slice(0, 2), 16);
  const green = Number.parseInt(hex.slice(2, 4), 16);
  const blue = Number.parseInt(hex.slice(4, 6), 16);
  return (red * 299 + green * 587 + blue * 114) / 1000 < 150;
}
