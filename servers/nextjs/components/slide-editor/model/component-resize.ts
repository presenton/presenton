import {
  asRecord,
  readArray,
  readNumber,
  readOptionalSize,
  readPoint,
  readString,
  type Box,
  type ChildArrayInfo,
  type RawComponent,
} from "@/components/slide-editor/model/core";

export type ComponentSideResizeAnchor =
  | "middle-left"
  | "middle-right"
  | "top-center"
  | "bottom-center";

type Size = Pick<Box, "width" | "height">;

const MIN_COMPONENT_SIDE_RESIZE_SIZE = 8;

export function componentSideResizeBox(
  sourceBox: Box,
  transformedSize: Size,
  anchor: ComponentSideResizeAnchor,
  bounds: Size,
): Box {
  const sourceRight = sourceBox.x + sourceBox.width;
  const sourceBottom = sourceBox.y + sourceBox.height;
  let x = sourceBox.x;
  let y = sourceBox.y;
  let width = sourceBox.width;
  let height = sourceBox.height;

  if (anchor === "middle-left") {
    width = boundedResizeSize(transformedSize.width, sourceBox.width, sourceRight);
    x = sourceRight - width;
  } else if (anchor === "middle-right") {
    width = boundedResizeSize(
      transformedSize.width,
      sourceBox.width,
      bounds.width - sourceBox.x,
    );
  } else if (anchor === "top-center") {
    height = boundedResizeSize(transformedSize.height, sourceBox.height, sourceBottom);
    y = sourceBottom - height;
  } else {
    height = boundedResizeSize(
      transformedSize.height,
      sourceBox.height,
      bounds.height - sourceBox.y,
    );
  }

  return { x, y, width, height };
}

export function resizeComponentFromSideTransform(
  component: RawComponent,
  sourceBox: Box,
  transformedSize: Size,
  anchor: ComponentSideResizeAnchor,
  bounds: Size,
  rotation = readNumber(component.rotation) ?? 0,
) {
  // `component` and `sourceBox` are the immutable gesture-start values. Applying
  // every pointer sample to them keeps recursive flex/grid resizing idempotent.
  const box = componentSideResizeBox(
    sourceBox,
    transformedSize,
    anchor,
    bounds,
  );
  return {
    box,
    component: resizeComponentElementBounds(component, {
      ...box,
      rotation,
      scaleX: sourceBox.width > 0 ? box.width / sourceBox.width : 1,
      scaleY: sourceBox.height > 0 ? box.height / sourceBox.height : 1,
    }),
  };
}

export function resizeComponentElementBounds(
  component: RawComponent,
  next: Box & { scaleX: number; scaleY: number; rotation?: number },
) {
  const { size, ...componentWithoutSize } = component;
  void size;
  return {
    ...componentWithoutSize,
    position: { x: next.x, y: next.y },
    rotation: next.rotation ?? readNumber(component.rotation) ?? 0,
    elements: resizeRawElementBounds(
      readArray(component.elements),
      next.scaleX,
      next.scaleY,
    ),
  };
}

export function resizeRawElementBounds(
  elements: unknown[],
  scaleX: number,
  scaleY: number,
): unknown[] {
  const safeScaleX = Number.isFinite(scaleX) && scaleX > 0 ? scaleX : 1;
  const safeScaleY = Number.isFinite(scaleY) && scaleY > 0 ? scaleY : 1;

  return elements.map((value) => {
    const element = asRecord(value);
    if (!element) return value;
    const position = readPoint(element.position);
    const explicitSize = readOptionalSize(element.size);
    const type = readString(element.type);
    const polygonPoints =
      type === "vector" ? readArray(element.points) : [];
    const radiusScale = Math.min(safeScaleX, safeScaleY);
    const cornerRadii = readArray(element.corner_radii ?? element.cornerRadii);
    const childInfo = childArrayInfo(element);
    const resizedChildren = childInfo
      ? resizeRawElementBounds(childInfo.items, safeScaleX, safeScaleY)
      : null;
    return {
      ...element,
      position: {
        x: position.x * safeScaleX,
        y: position.y * safeScaleY,
      },
      ...(explicitSize
        ? {
            size: {
              width: Math.max(1, explicitSize.width * safeScaleX),
              height: Math.max(1, explicitSize.height * safeScaleY),
            },
          }
        : {}),
      ...(polygonPoints.length > 0
        ? {
            points: polygonPoints.map((point) => {
              const record = asRecord(point);
              if (!record) return point;
              return {
                ...record,
                x: (readNumber(record.x) ?? 0) * safeScaleX,
                y: (readNumber(record.y) ?? 0) * safeScaleY,
              };
            }),
          }
        : {}),
      ...(cornerRadii.length > 0
        ? {
            corner_radii: cornerRadii.map((value) =>
              Math.max(0, (readNumber(value) ?? 0) * radiusScale),
            ),
          }
        : {}),
      ...(childInfo && resizedChildren
        ? withUpdatedChildItems({}, childInfo, resizedChildren)
        : {}),
    };
  });
}

function boundedResizeSize(value: number, fallback: number, maximum: number) {
  const safeMaximum = Math.max(1, Number.isFinite(maximum) ? maximum : fallback);
  const minimum = Math.min(MIN_COMPONENT_SIDE_RESIZE_SIZE, safeMaximum);
  const safeValue = Number.isFinite(value) ? value : fallback;
  return Math.min(safeMaximum, Math.max(minimum, safeValue));
}

function childArrayInfo(element: RawComponent): ChildArrayInfo | null {
  if (Array.isArray(element.children)) {
    return { key: "children", items: element.children };
  }
  if (Array.isArray(element.elements)) {
    return { key: "elements", items: element.elements };
  }
  if (asRecord(element.child)) {
    return { key: "child", items: [element.child] };
  }
  return null;
}

function withUpdatedChildItems(
  element: RawComponent,
  childInfo: ChildArrayInfo,
  updatedChildren: unknown[],
) {
  if (childInfo.key === "child") {
    return { ...element, child: updatedChildren[0] ?? null };
  }
  return { ...element, [childInfo.key]: updatedChildren };
}
