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
import type { TableCellSelection } from "@/components/slide-editor/state/state";
import { loadKonvaImage } from "@/components/slide-editor/surface/exportAssets";
import { constrainComponentTransformBounds } from "@/components/slide-editor/surface/componentFrameBounds";
import {
  createLatestFrameBatch,
  type LatestFrameBatch,
} from "@/components/slide-editor/surface/latestFrameBatch";
import { TemplateV2ChartJsElement as RawChartElement } from "@/components/slide-editor/charts/TemplateV2ChartJsElement";
import { TemplateV2TableElement as RawTableElement } from "@/components/slide-editor/tables/TemplateV2TableElement";
import { buildSvgUpdateUrl } from "@/lib/svg-color";
import { mathSvgDataUri, normalizeMathLatex } from "@/lib/math";
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
      previous.fontRevision !== next.fontRevision
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
      {editing ? null : (
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
    if (points.length < 4) return null;
    if (!fill && !(polygonStroke && lineWidth > 0)) return null;
    return (
      <Line
        points={points}
        closed={closed}
        fill={fill}
        stroke={polygonStroke}
        strokeWidth={polygonStroke ? lineWidth : 0}
        dash={lineDash.length ? lineDash : undefined}
        hitStrokeWidth={Math.max(20, lineWidth)}
        {...shadowProps(element)}
        listening={interactive}
      />
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
  if (type === "math") {
    return (
      <RawMathElement
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
        let x = startX;
        const lineY = y;
        y += lineMetric.height;
        return line.map((segment, segmentIndex) => {
          const segmentX = x;
          x += segment.width;
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
      ))}
    </Group>
  );
}

function RawMathElement({
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
  const font = rawFont(element);
  const latex = normalizeMathLatex(element.latex);
  const horizontal = readString(element.alignment?.horizontal);
  const vertical = readString(element.alignment?.vertical);
  const source = useMemo(
    () =>
      mathSvgDataUri({
        align:
          horizontal === "left" || horizontal === "right"
            ? horizontal
            : "center",
        color: withHash(font.color) ?? "#111827",
        displayMode: readBoolean(element.display_mode ?? element.displayMode) ?? true,
        fontSize: font.size,
        height,
        latex,
        verticalAlign:
          vertical === "top" || vertical === "bottom" ? vertical : "middle",
        width,
      }),
    [element.displayMode, element.display_mode, font.color, font.size, height, horizontal, latex, vertical, width],
  );
  const loaded = useLoadedKonvaImage(source);

  if (!loaded) {
    return (
      <Text
        width={width}
        height={height}
        text={latex || "Add a LaTeX expression"}
        fill={textFill(font)}
        fontFamily="Arial, Helvetica, sans-serif"
        fontSize={Math.max(12, Math.min(font.size, 28))}
        fontStyle="italic"
        align="center"
        verticalAlign="middle"
        wrap="word"
        listening={interactive}
      />
    );
  }

  return (
    <KonvaImage
      image={loaded}
      width={width}
      height={height}
      listening={interactive}
    />
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
  const infographicType = readString(data?.type) ?? "gauge";
  const progress = valueProgress(element);
  const baseColor =
    withHash(readString(colors[0])) ??
    "#E5E7EB";
  const highlightColor =
    withHash(readString(colors[1])) ?? "#2563EB";
  const value = readNumber(data?.value) ?? 0;

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
        fill="#172033"
      />
    </Group>
  );
}
