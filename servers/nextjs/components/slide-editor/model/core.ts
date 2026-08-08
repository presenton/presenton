import type Konva from "konva";
import type { TemplateV2Layout } from "@/components/slide-editor/importing/template-v2-import";
import {
  EDITOR_STAGE_HEIGHT,
  EDITOR_STAGE_WIDTH,
} from "@/components/slide-editor/types";

export const STAGE_WIDTH = EDITOR_STAGE_WIDTH;
export const STAGE_HEIGHT = EDITOR_STAGE_HEIGHT;
export const ROOT_ELEMENTS_COMPONENT_INDEX = -1;
export const STAGE_BOX: Box = {
  x: 0,
  y: 0,
  width: STAGE_WIDTH,
  height: STAGE_HEIGHT,
};
export const TEXT_AVERAGE_CHAR_EM = 0.5;
export const DECORATIVE_LINE_LENGTH = 80;
export const DECORATIVE_LINE_THICKNESS = 4;
export const MAX_HISTORY_ENTRIES = 50;
export const SCROLL_DISMISS_THRESHOLD_PX = 300;

export type UnknownRecord = Record<string, any>;
export type RawUi = TemplateV2Layout & UnknownRecord;
export type RawComponent = UnknownRecord;
export type RawElement = UnknownRecord;
export type Size = { width: number; height: number };
export type Point = { x: number; y: number };
export type Box = Point & Size;
export type ChildArrayInfo = {
  key: "children" | "elements" | "child";
  items: unknown[];
};
export type LaidOutChild = {
  child: RawElement;
  index: number;
  box: Box | null;
  layoutManaged: boolean;
};

export type ComponentSelection = {
  kind: "component";
  componentIndex: number;
};

export type MultiComponentSelection = {
  kind: "multi-component";
  componentIndexes: number[];
};

export type ElementSelection = {
  kind: "element";
  componentIndex: number;
  elementPath: number[];
};

export type Selection =
  | ComponentSelection
  | MultiComponentSelection
  | ElementSelection
  | null;
export type SelectOptions = {
  additive?: boolean;
};
export type MultiComponentDragState = {
  draggedComponentIndex: number;
  draggedNodeStart: Point;
  nodes: Array<{
    componentIndex: number;
    node: Konva.Node;
    nodeStart: Point;
    modelStart: Point;
  }>;
};

export function readPadding(value: unknown) {
  if (typeof value === "number") {
    return { top: value, right: value, bottom: value, left: value };
  }
  const record = asRecord(value);
  const x = readNumber(record?.x) ?? readNumber(record?.horizontal);
  const y = readNumber(record?.y) ?? readNumber(record?.vertical);
  return {
    top: readNumber(record?.top) ?? y ?? 0,
    right: readNumber(record?.right) ?? x ?? 0,
    bottom: readNumber(record?.bottom) ?? y ?? 0,
    left: readNumber(record?.left) ?? x ?? 0,
  };
}

export function alignmentOffset(
  alignment: string | null,
  available: number,
  used: number,
) {
  const free = Math.max(0, available - used);
  if (alignment === "center") return free / 2;
  if (
    alignment === "right" ||
    alignment === "bottom" ||
    alignment === "end" ||
    alignment === "flex-end"
  ) {
    return free;
  }
  return 0;
}

export function readPoint(value: unknown): Point {
  const record = asRecord(value);
  return {
    x: readNumber(record?.x) ?? 0,
    y: readNumber(record?.y) ?? 0,
  };
}

export function readSize(
  value: unknown,
  fallback: Size = { width: 1, height: 1 },
): Size {
  const record = asRecord(value);
  return {
    width: Math.max(1, readNumber(record?.width) ?? fallback.width),
    height: Math.max(1, readNumber(record?.height) ?? fallback.height),
  };
}

export function readOptionalSize(value: unknown): Size | null {
  const record = asRecord(value);
  const width = readNumber(record?.width);
  const height = readNumber(record?.height);
  if (width == null || height == null) return null;
  return {
    width: Math.max(1, width),
    height: Math.max(1, height),
  };
}

export function readArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

export function stripUndefined<T extends UnknownRecord>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined),
  ) as T;
}

export function asRecord(value: unknown): UnknownRecord | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as UnknownRecord)
    : null;
}

export function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(asRecord(value));
}

export function readString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

export function readNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function readBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

export function withHash(value: string | null | undefined) {
  if (!value) return undefined;
  return value.startsWith("#") || value.startsWith("rgb") ? value : `#${value}`;
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function normalizeId(value: string) {
  const normalized = value
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return normalized || "component";
}

export function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

export function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof Element)) return false;
  return Boolean(
    target.closest(
      "button,input,textarea,select,[contenteditable='true'],[role='dialog'],[data-inline-edit-ignore='true']",
    ),
  );
}
