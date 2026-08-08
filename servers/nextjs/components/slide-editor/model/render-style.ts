import {
  asRecord,
  clamp,
  readNumber,
  readString,
  withHash,
  type RawElement,
  type RawUi,
} from "@/components/slide-editor/model/core";

export function backgroundColor(ui: RawUi) {
  return withHash(readString(ui.background) ?? "#FFFFFF");
}

export function fillColor(fill: unknown) {
  const value = asRecord(fill);
  return withHash(readString(value?.color));
}

export function fillOpacity(fill: unknown) {
  const value = asRecord(fill);
  return readNumber(value?.opacity) ?? 1;
}

export function strokeColor(stroke: unknown) {
  const value = asRecord(stroke);
  return withHash(readString(value?.color));
}

export function strokeWidth(stroke: unknown) {
  const value = asRecord(stroke);
  return readNumber(value?.width) ?? 0;
}

export function strokeOpacity(stroke: unknown) {
  const value = asRecord(stroke);
  return readNumber(value?.opacity) ?? 1;
}

export function colorWithOpacity(color: string | undefined, opacity: number) {
  if (!color) return undefined;
  const alpha = clamp(opacity, 0, 1);
  if (alpha >= 1) return color;
  const hex = color.startsWith("#") ? color.slice(1) : color;
  if (hex.length === 3) {
    const [r, g, b] = hex.split("").map((part) => parseInt(part + part, 16));
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  if (hex.length === 6) {
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  return color;
}

export function shadowProps(element: RawElement) {
  const shadow = asRecord(element.shadow);
  if (!shadow) return {};
  const color = withHash(readString(shadow.color) ?? "#000000");
  const opacity = readNumber(shadow.opacity) ?? 0.2;
  const blur = readNumber(shadow.blur) ?? 0;
  const offsetX = readNumber(shadow.offset_x) ?? readNumber(shadow.offsetX) ?? 0;
  const offsetY = readNumber(shadow.offset_y) ?? readNumber(shadow.offsetY) ?? 0;
  if (opacity <= 0 || (blur <= 0 && offsetX === 0 && offsetY === 0)) return {};
  return {
    shadowColor: color,
    shadowOpacity: opacity,
    shadowBlur: blur,
    shadowOffsetX: offsetX,
    shadowOffsetY: offsetY,
  };
}

export function borderRadius(element: RawElement) {
  const value = element.border_radius ?? element.borderRadius;
  if (typeof value === "number") return value;
  const record = asRecord(value);
  const radius = readNumber(record?.radius);
  if (radius != null) return radius;
  const topLeft = readNumber(record?.tl) ?? readNumber(record?.topLeft) ?? 0;
  const topRight = readNumber(record?.tr) ?? readNumber(record?.topRight) ?? topLeft;
  const bottomRight =
    readNumber(record?.br) ?? readNumber(record?.bottomRight) ?? topRight;
  const bottomLeft =
    readNumber(record?.bl) ?? readNumber(record?.bottomLeft) ?? bottomRight;
  if (topLeft || topRight || bottomRight || bottomLeft) {
    return [topLeft, topRight, bottomRight, bottomLeft];
  }
  return 0;
}
