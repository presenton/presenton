"use client";

import { useCallback, useEffect, useRef, type RefObject } from "react";
import type Konva from "konva";
import { Transformer } from "react-konva";
import { TRANSFORM_ANCHOR_ATTR } from "@/components/slide-editor/selection/transformSession";

const CORNER_HANDLE_SIZE = 14;
const EDGE_HANDLE_LENGTH = 28;
const EDGE_HANDLE_THICKNESS = 9;
const ROTATION_HANDLE_SIZE = 28;
const BOTTOM_CENTER_ROTATION_ANCHOR_OFFSET = 26;
const BOTTOM_CENTER_ROTATION_ANCHOR_ANGLE = 180;
const ROTATION_ICON_SIZE = 18;
const ROTATION_ICON_VIEWBOX_SIZE = 24;
const MIN_TRANSFORM_BOX_SIZE = 8;
const REFRESH_CW_ICON_PATHS = [
  "M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8",
  "M21 3v5h-5",
  "M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16",
  "M8 16H3v5",
];
const SHADOW_EVENT_NAMESPACE = ".presentonSelectionShadows";
const BOTTOM_CENTER_ROTATION_ANCHOR_EVENT_NAMESPACE =
  ".presentonBottomCenterRotationAnchor";
const MULTI_SELECTION_GROUP_DASH = [5, 5];
const MULTI_SELECTION_MEMBER_DASH = [7, 4];
const HORIZONTAL_ONLY_ANCHORS = ["middle-left", "middle-right"];
let refreshCwIconPaths: Path2D[] | null = null;

type SelectionKind = "component" | "multi-component" | "element" | null;

type TransformerBox = {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
};

type TransformerPoint = {
  x: number;
  y: number;
};

type FixedSideTransform = {
  anchor: string;
  right?: number;
  bottom?: number;
};

type TemplateV2SelectionTransformersProps = {
  nodeRefs: RefObject<Map<string, Konva.Node>>;
  parentComponentKey: string | null;
  selectedKey: string | null;
  selectedKeys?: string[];
  selectionKind: SelectionKind;
  horizontalResizeOnly?: boolean;
  fullElementTransform?: boolean;
  suppressSelectedOutline?: boolean;
};

function drawRotationHandle(context: Konva.Context, shape: Konva.Shape) {
  const center = ROTATION_HANDLE_SIZE / 2;

  context.beginPath();
  context.arc(center, center, center - 1, 0, Math.PI * 2, false);
  context.closePath();
  context.fillStrokeShape(shape);

  context.save();
  context.setAttr("strokeStyle", "#111111");
  context.setAttr("lineWidth", 2);
  context.setAttr("lineCap", "round");
  context.setAttr("lineJoin", "round");
  context.translate(
    center - ROTATION_ICON_SIZE / 2,
    center - ROTATION_ICON_SIZE / 2,
  );
  context.scale(
    ROTATION_ICON_SIZE / ROTATION_ICON_VIEWBOX_SIZE,
    ROTATION_ICON_SIZE / ROTATION_ICON_VIEWBOX_SIZE,
  );
  if (!refreshCwIconPaths && typeof Path2D !== "undefined") {
    refreshCwIconPaths = REFRESH_CW_ICON_PATHS.map((path) => new Path2D(path));
  }
  refreshCwIconPaths?.forEach((path) => context.stroke(path));
  context.restore();
}

function preventInvertedTransform(
  oldBox: TransformerBox,
  newBox: TransformerBox,
  allowThinBox = false,
) {
  const minWidth = allowThinBox ? 1 : MIN_TRANSFORM_BOX_SIZE;
  const minHeight = allowThinBox ? 1 : MIN_TRANSFORM_BOX_SIZE;
  const hasMinimumVisibleSize = allowThinBox
    ? Math.max(Math.abs(newBox.width), Math.abs(newBox.height)) >=
    MIN_TRANSFORM_BOX_SIZE
    : true;

  if (
    !Number.isFinite(newBox.width) ||
    !Number.isFinite(newBox.height) ||
    Math.abs(newBox.width) < minWidth ||
    Math.abs(newBox.height) < minHeight ||
    !hasMinimumVisibleSize
  ) {
    return oldBox;
  }
  return newBox;
}

function pinFixedSideTransformBox(
  anchor: string | null | undefined,
  oldBox: TransformerBox,
  newBox: TransformerBox,
  fixedSide: FixedSideTransform | null,
) {
  let pinnedBox = newBox;
  if (anchor?.includes("left")) {
    const right =
      fixedSide?.anchor === anchor
        ? fixedSide.right ?? oldBox.x + oldBox.width
        : oldBox.x + oldBox.width;
    pinnedBox = {
      ...pinnedBox,
      x: right - newBox.width,
    };
  }
  if (anchor?.includes("top")) {
    const bottom =
      fixedSide?.anchor === anchor
        ? fixedSide.bottom ?? oldBox.y + oldBox.height
        : oldBox.y + oldBox.height;
    pinnedBox = {
      ...pinnedBox,
      y: bottom - newBox.height,
    };
  }
  return pinnedBox;
}

function fixedSideTransformFromTransformer(
  transformer: Konva.Transformer | null,
): FixedSideTransform | null {
  const anchor = transformer?.getActiveAnchor();
  if (!transformer || !anchor || anchor === "rotater") {
    return null;
  }

  const fixedSide: FixedSideTransform = { anchor };
  if (anchor.includes("left")) {
    fixedSide.right = transformer.x() + transformer.width();
  }
  if (anchor.includes("top")) {
    fixedSide.bottom = transformer.y() + transformer.height();
  }
  return fixedSide.right != null || fixedSide.bottom != null
    ? fixedSide
    : null;
}

function rememberTransformAnchorForNodes(
  transformer: Konva.Transformer | null,
) {
  if (!transformer) return;
  const anchor = transformer.getActiveAnchor() ?? null;
  transformer.getNodes().forEach((node) => {
    node.setAttr(TRANSFORM_ANCHOR_ATTR, anchor);
  });
}

function preventInvertedAnchorDrag(
  transformer: Konva.Transformer | null,
  newPoint: TransformerPoint,
) {
  const anchor = transformer?.getActiveAnchor();
  if (!transformer || !anchor || anchor === "rotater") return newPoint;

  const transform = transformer.getAbsoluteTransform();
  const localPoint = transform.copy().invert().point(newPoint);
  const clampedPoint = { ...localPoint };
  const width = Math.max(MIN_TRANSFORM_BOX_SIZE, Math.abs(transformer.width()));
  const height = Math.max(MIN_TRANSFORM_BOX_SIZE, Math.abs(transformer.height()));

  if (anchor.includes("left")) {
    clampedPoint.x = Math.min(clampedPoint.x, width - MIN_TRANSFORM_BOX_SIZE);
  } else if (anchor.includes("right")) {
    clampedPoint.x = Math.max(clampedPoint.x, MIN_TRANSFORM_BOX_SIZE);
  }

  if (anchor.includes("top")) {
    clampedPoint.y = Math.min(clampedPoint.y, height - MIN_TRANSFORM_BOX_SIZE);
  } else if (anchor.includes("bottom")) {
    clampedPoint.y = Math.max(clampedPoint.y, MIN_TRANSFORM_BOX_SIZE);
  }

  if (
    clampedPoint.x === localPoint.x &&
    clampedPoint.y === localPoint.y
  ) {
    return newPoint;
  }

  return transform.point(clampedPoint);
}

function styleAnchor(anchor: Konva.Rect) {
  const name = anchor.name();
  const isRotationHandle = name.includes("rotater");
  const isHorizontalEdge =
    name.includes("top-center") || name.includes("bottom-center");
  const isVerticalEdge =
    name.includes("middle-left") || name.includes("middle-right");

  let width = CORNER_HANDLE_SIZE;
  let height = CORNER_HANDLE_SIZE;
  if (isHorizontalEdge) {
    width = EDGE_HANDLE_LENGTH;
    height = EDGE_HANDLE_THICKNESS;
  } else if (isVerticalEdge) {
    width = EDGE_HANDLE_THICKNESS;
    height = EDGE_HANDLE_LENGTH;
  } else if (isRotationHandle) {
    width = ROTATION_HANDLE_SIZE;
    height = ROTATION_HANDLE_SIZE;
  }

  anchor.setAttrs({
    width,
    height,
    offsetX: width / 2,
    offsetY: height / 2,
    cornerRadius: Math.min(width, height) / 2,
    fill: "#FFFFFF",
    stroke: "#E5E7EB",
    strokeWidth: 1,
    shadowColor: "#101828",
    shadowBlur: isRotationHandle ? 5 : 4,
    shadowOffsetX: 0,
    shadowOffsetY: isRotationHandle ? 2 : 2,
    shadowOpacity: isRotationHandle ? 0.16 : 0.13,
    shadowForStrokeEnabled: false,
    perfectDrawEnabled: false,
  });

  if (isRotationHandle) anchor.sceneFunc(drawRotationHandle);
}

function drawContextBoundary(context: Konva.Context, shape: Konva.Shape) {
  const width = shape.width();
  const height = shape.height();

  context.save();
  context.setAttr("lineWidth", 2);
  context.setAttr("lineJoin", "miter");
  context.setLineDash([]);
  context.setAttr("strokeStyle", "#D9D9DE");
  context.beginPath();
  context.rect(0, 0, width, height);
  context.stroke();

  context.setLineDash([4, 8]);
  context.setAttr("strokeStyle", "#FFFFFF");
  context.beginPath();
  context.rect(0, 0, width, height);
  context.stroke();
  context.restore();
}

function applyContextBoundaryStyle(transformer: Konva.Transformer) {
  const back = transformer.findOne<Konva.Rect>(".back");
  back?.sceneFunc(drawContextBoundary);
  back?.setAttrs({
    shadowColor: "#101828",
    shadowBlur: 6,
    shadowOffsetX: 0,
    shadowOffsetY: 1,
    shadowOpacity: 0.16,
    shadowForStrokeEnabled: true,
    perfectDrawEnabled: false,
  });
}

function setTransformerShadowsEnabled(
  transformers: Array<Konva.Transformer | null>,
  enabled: boolean,
) {
  transformers.forEach((transformer) => {
    if (!transformer) return;
    transformer.find<Konva.Rect>("._anchor").forEach((anchor) => {
      anchor.shadowEnabled(enabled);
    });
    transformer.findOne<Konva.Rect>(".back")?.shadowEnabled(enabled);
  });
  transformers[0]?.getLayer()?.batchDraw();
}

function TemplateV2MultiSelectionMemberOutline({
  nodeRefs,
  selectedKey,
}: {
  nodeRefs: RefObject<Map<string, Konva.Node>>;
  selectedKey: string;
}) {
  const transformerRef = useRef<Konva.Transformer | null>(null);

  useEffect(() => {
    const transformer = transformerRef.current;
    if (!transformer) return;

    const node = nodeRefs.current?.get(selectedKey);
    transformer.nodes(node ? [node] : []);
    transformer.getLayer()?.batchDraw();

    return () => {
      transformer.nodes([]);
      transformer.getLayer()?.batchDraw();
    };
  }, [nodeRefs, selectedKey]);

  return (
    <Transformer
      ref={transformerRef}
      anchorSize={0}
      borderDash={MULTI_SELECTION_MEMBER_DASH}
      borderEnabled
      borderStroke="#7A5AF8"
      borderStrokeWidth={1}
      enabledAnchors={[]}
      listening={false}
      resizeEnabled={false}
      rotateEnabled={false}
      rotateLineVisible={false}
    />
  );
}

function getBottomCenterRotationAnchorAngle(
  node: Konva.Node | null | undefined,
) {
  return (
    BOTTOM_CENTER_ROTATION_ANCHOR_ANGLE - (node?.getAbsoluteRotation() ?? 0)
  );
}

function applyBottomCenterRotationAnchor(
  transformer: Konva.Transformer | null,
  node: Konva.Node | null | undefined,
) {
  if (!transformer) return;

  transformer.rotateAnchorAngle(getBottomCenterRotationAnchorAngle(node));
  transformer.rotateAnchorOffset(BOTTOM_CENTER_ROTATION_ANCHOR_OFFSET);
  transformer.forceUpdate();
  transformer.getLayer()?.batchDraw();
}

export function TemplateV2SelectionTransformers({
  nodeRefs,
  parentComponentKey,
  selectedKey,
  selectedKeys,
  selectionKind,
  horizontalResizeOnly = false,
  fullElementTransform = false,
  suppressSelectedOutline = false,
}: TemplateV2SelectionTransformersProps) {
  const selectedTransformerRef = useRef<Konva.Transformer | null>(null);
  const contextTransformerRef = useRef<Konva.Transformer | null>(null);
  const isTransformableElementSelection =
    selectionKind === "element" &&
    (horizontalResizeOnly || fullElementTransform);
  const fixedSideTransformRef = useRef<FixedSideTransform | null>(null);
  useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      Object.assign(window, {
        __presentonResizeProbeTransformer: selectedTransformerRef.current,
      });
    }
  });
  const canTransformSelection =
    selectionKind === "component" || isTransformableElementSelection;
  const boundAnchorDrag = useCallback(
    (_oldPoint: TransformerPoint, newPoint: TransformerPoint) =>
      preventInvertedAnchorDrag(selectedTransformerRef.current, newPoint),
    [],
  );
  const boundTransformBox = useCallback(
    (oldBox: TransformerBox, newBox: TransformerBox) => {
      const transformer = selectedTransformerRef.current;
      rememberTransformAnchorForNodes(transformer);
      const boundedBox = preventInvertedTransform(
        oldBox,
        newBox,
        horizontalResizeOnly,
      );
      if (boundedBox === oldBox) return oldBox;
      return pinFixedSideTransformBox(
        transformer?.getActiveAnchor(),
        oldBox,
        boundedBox,
        fixedSideTransformRef.current,
      );
    },
    [horizontalResizeOnly],
  );
  const handleTransformStart = useCallback(() => {
    const transformer = selectedTransformerRef.current;
    fixedSideTransformRef.current = fixedSideTransformFromTransformer(transformer);
    rememberTransformAnchorForNodes(transformer);
  }, []);
  const handleTransformEnd = useCallback(() => {
    fixedSideTransformRef.current = null;
  }, []);
  const isMultiComponentSelection = selectionKind === "multi-component";
  const selectedNode =
    canTransformSelection && selectedKey
      ? nodeRefs.current?.get(selectedKey)
      : null;
  const bottomCenterRotationAnchorAngle =
    getBottomCenterRotationAnchorAngle(selectedNode);
  const multiSelectionMemberKeys =
    isMultiComponentSelection && !suppressSelectedOutline
      ? selectedKeys ?? []
      : [];

  useEffect(() => {
    const keys = selectedKeys?.length
      ? selectedKeys
      : selectedKey
        ? [selectedKey]
        : [];
    const selectedNodes = suppressSelectedOutline
      ? []
      : keys.flatMap((key) => {
        const node = nodeRefs.current?.get(key);
        return node ? [node] : [];
      });
    const parentComponentNode = parentComponentKey
      ? nodeRefs.current?.get(parentComponentKey)
      : null;

    const selectedTransformer = selectedTransformerRef.current;
    if (selectedTransformer) {
      selectedTransformer.nodes(selectedNodes);
      if (process.env.NODE_ENV === "development") {
        Object.assign(window, {
          __presentonResizeProbeTransformer: selectedTransformer,
        });
      }
    }

    const contextTransformer = contextTransformerRef.current;
    if (contextTransformer) {
      contextTransformer.nodes(parentComponentNode ? [parentComponentNode] : []);
      applyContextBoundaryStyle(contextTransformer);
    }

    const selectedRotationNode =
      canTransformSelection && selectedNodes.length === 1
        ? selectedNodes[0]
        : null;
    const refreshBottomCenterRotationAnchor = () => {
      if (selectedTransformer?.isTransforming()) return;
      applyBottomCenterRotationAnchor(selectedTransformer, selectedRotationNode);
    };
    refreshBottomCenterRotationAnchor();

    selectedTransformer?.getLayer()?.batchDraw();

    const transformers = [selectedTransformer, contextTransformer];
    const dragNodes = Array.from(
      new Set([...selectedNodes, parentComponentNode].filter(Boolean)),
    ) as Konva.Node[];
    const disableShadows = () =>
      setTransformerShadowsEnabled(transformers, false);
    const enableShadows = () =>
      setTransformerShadowsEnabled(transformers, true);

    dragNodes.forEach((node) => {
      node.on(`dragstart${SHADOW_EVENT_NAMESPACE}`, disableShadows);
      node.on(`dragend${SHADOW_EVENT_NAMESPACE}`, enableShadows);
      node.on(`transformstart${SHADOW_EVENT_NAMESPACE}`, disableShadows);
      node.on(`transformend${SHADOW_EVENT_NAMESPACE}`, enableShadows);
    });
    selectedRotationNode?.on(
      `rotationChange${BOTTOM_CENTER_ROTATION_ANCHOR_EVENT_NAMESPACE}`,
      refreshBottomCenterRotationAnchor,
    );
    selectedRotationNode?.on(
      `absoluteTransformChange${BOTTOM_CENTER_ROTATION_ANCHOR_EVENT_NAMESPACE}`,
      refreshBottomCenterRotationAnchor,
    );
    selectedRotationNode?.on(
      `transformend${BOTTOM_CENTER_ROTATION_ANCHOR_EVENT_NAMESPACE}`,
      refreshBottomCenterRotationAnchor,
    );

    return () => {
      dragNodes.forEach((node) => node.off(SHADOW_EVENT_NAMESPACE));
      selectedRotationNode?.off(BOTTOM_CENTER_ROTATION_ANCHOR_EVENT_NAMESPACE);
      enableShadows();
    };
  }, [
    nodeRefs,
    parentComponentKey,
    selectedKey,
    selectedKeys,
    selectionKind,
    canTransformSelection,
    fullElementTransform,
    suppressSelectedOutline,
  ]);

  return (
    <>
      <Transformer
        ref={contextTransformerRef}
        anchorCornerRadius={7}
        anchorFill="#FFFFFF"
        anchorSize={0}
        anchorStroke="#D0D5DD"
        anchorStrokeWidth={1}
        anchorStyleFunc={styleAnchor}
        borderStroke="#D9D9DE"
        borderStrokeWidth={1}
        enabledAnchors={[]}
        listening={false}
        resizeEnabled={false}
        rotateEnabled={false}
        rotateLineVisible={false}
        // Stroke bounds belong to the rendered child, not to the component
        // frame. Including them makes Konva recompute the opposite edge while
        // the preview is being rebuilt during a resize gesture.
        ignoreStroke
      />
      <Transformer
        ref={selectedTransformerRef}
        anchorCornerRadius={7}
        anchorFill="#FFFFFF"
        anchorDragBoundFunc={boundAnchorDrag}
        anchorSize={CORNER_HANDLE_SIZE}
        anchorStroke="#E5E7EB"
        anchorStrokeWidth={1}
        anchorStyleFunc={styleAnchor}
        borderDash={
          isMultiComponentSelection ? MULTI_SELECTION_GROUP_DASH : undefined
        }
        borderEnabled
        borderStroke={isMultiComponentSelection ? "#D9D9DE" : "#7A5AF8"}
        borderStrokeWidth={1}
        boundBoxFunc={boundTransformBox}
        enabledAnchors={
          canTransformSelection
            ? horizontalResizeOnly && !fullElementTransform
              ? HORIZONTAL_ONLY_ANCHORS
              : undefined
            : []
        }
        flipEnabled={false}
        ignoreStroke
        resizeEnabled={canTransformSelection}
        rotateAnchorAngle={bottomCenterRotationAnchorAngle}
        rotateAnchorOffset={BOTTOM_CENTER_ROTATION_ANCHOR_OFFSET}
        rotateEnabled={canTransformSelection}
        rotateLineVisible={false}
        onTransformStart={handleTransformStart}
        onTransformEnd={handleTransformEnd}
      />
      {multiSelectionMemberKeys.map((key) => (
        <TemplateV2MultiSelectionMemberOutline
          key={key}
          nodeRefs={nodeRefs}
          selectedKey={key}
        />
      ))}
    </>
  );
}
