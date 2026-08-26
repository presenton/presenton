import {
  EDITOR_STAGE_HEIGHT,
  EDITOR_STAGE_WIDTH,
  type InfographicType,
} from "@/components/slide-editor/types";

type RawRecord = Record<string, unknown>;
type Frame = {
  data?: unknown;
  position?: unknown;
  size?: unknown;
};

export type InfographicContentSize = {
  width: number;
  height: number;
};

const FRAME_MARGIN = 12;
const MIN_WIDTH = 280;
const MIN_HEIGHT = 72;
const MAX_WIDTH = EDITOR_STAGE_WIDTH - FRAME_MARGIN * 2;
const MAX_HEIGHT = EDITOR_STAGE_HEIGHT - FRAME_MARGIN * 2;

function record(value: unknown): RawRecord | null {
  return value != null && typeof value === "object" && !Array.isArray(value)
    ? (value as RawRecord)
    : null;
}

function array(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function number(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function countItems(data: RawRecord) {
  return Math.max(1, array(data.items).length);
}

function roundEven(value: number) {
  return Math.round(value / 2) * 2;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function contentSize(width: number, height: number): InfographicContentSize {
  return {
    width: roundEven(clamp(width, MIN_WIDTH, MAX_WIDTH)),
    height: roundEven(clamp(height, MIN_HEIGHT, MAX_HEIGHT)),
  };
}

function hierarchyMetrics(itemsValue: unknown) {
  const items = array(itemsValue)
    .map(record)
    .filter((item): item is RawRecord => item != null);
  if (items.length === 0) return { count: 1, depth: 1, breadth: 1 };

  const byId = new Map<string, RawRecord>();
  for (const item of items) {
    if (typeof item.id === "string") byId.set(item.id, item);
  }

  const depthMemo = new Map<RawRecord, number>();
  const depthOf = (item: RawRecord, visiting = new Set<RawRecord>()): number => {
    const cached = depthMemo.get(item);
    if (cached != null) return cached;
    if (visiting.has(item)) return 1;
    visiting.add(item);
    const parent =
      typeof item.parent_id === "string" ? byId.get(item.parent_id) : null;
    const depth = parent ? depthOf(parent, visiting) + 1 : 1;
    visiting.delete(item);
    depthMemo.set(item, depth);
    return depth;
  };

  const perDepth = new Map<number, number>();
  let depth = 1;
  for (const item of items) {
    const itemDepth = depthOf(item);
    depth = Math.max(depth, itemDepth);
    perDepth.set(itemDepth, (perDepth.get(itemDepth) ?? 0) + 1);
  }

  return {
    count: items.length,
    depth,
    breadth: Math.max(1, ...perDepth.values()),
  };
}

/**
 * Returns the natural frame required by an infographic's current data.
 * The formulas mirror the renderer families: horizontal sequences grow in
 * width, stacked layouts grow in height, and radial layouts grow on both axes.
 */
export function infographicContentSize(
  dataValue: unknown,
): InfographicContentSize | null {
  const data = record(dataValue);
  if (!data || typeof data.type !== "string") return null;

  const type = data.type as InfographicType;
  const itemCount = countItems(data);

  switch (type) {
    case "progress_bar":
      return contentSize(420, 74);
    case "gauge":
      return contentSize(320, 190);
    case "gantt": {
      const columns = Math.max(1, array(data.columns).length);
      const rows = Math.max(1, array(data.rows).length);
      return contentSize(160 + columns * 70, 75 + rows * 25);
    }
    case "timeline":
      return contentSize(220 + itemCount * 100, 160 + itemCount * 20);
    case "roadmap":
      return contentSize(240 + itemCount * 80, 132 + itemCount * 20);
    case "milestone_timeline":
      return contentSize(300 + itemCount * 60, 120 + itemCount * 20);
    case "staircase":
      return contentSize(220 + itemCount * 100, 215 + itemCount * 25);
    case "supply_chain":
      // The renderer derives both the wave and node radius from the available
      // height. Keep that design axis fixed as stages are added or removed so
      // the circular nodes retain their original geometry. The baseline design
      // uses 180px per interval (5 stages = 720px), so removing stages also
      // removes their empty horizontal intervals.
      return contentSize((itemCount - 1) * 180, 300);
    case "stair_step_blocks":
      return contentSize(220 + itemCount * 100, 225 + itemCount * 25);
    case "maturity_model":
      return contentSize(420 + itemCount * 60, 90 + itemCount * 60);
    case "pillar_framework":
      return contentSize(220 + itemCount * 100, 280 + itemCount * 20);
    case "transformation_hub": {
      const rows = Math.ceil(itemCount / 2);
      return contentSize(600 + itemCount * 20, 120 + rows * 60);
    }
    case "diagonal_circles":
      return contentSize(270 + itemCount * 90, 180 + itemCount * 50);
    case "risk_matrix":
      return contentSize(720, 370);
    case "chevron_process":
      return contentSize(220 + itemCount * 100, 260 + itemCount * 20);
    case "radial_cycle":
      return contentSize(380 + itemCount * 30, 340 + itemCount * 30);
    case "conversion_funnel":
      return contentSize(320 + itemCount * 100, 200 + itemCount * 30);
    case "pyramid":
      return contentSize(560 + itemCount * 40, 160 + itemCount * 60);
    case "segmented_wheel":
      return contentSize(520 + itemCount * 40, 310 + itemCount * 30);
    case "customer_journey":
      return contentSize(220 + itemCount * 100, 270 + itemCount * 30);
    case "before_after": {
      const pairs = Math.ceil(Math.max(2, itemCount) / 2);
      return contentSize(420 + pairs * 100, 250 + pairs * 70);
    }
    case "impact_effort_matrix":
      return contentSize(720, 420);
    case "comparison_matrix": {
      const criteria = Math.max(1, array(data.criteria).length);
      return contentSize(120 + itemCount * 120, 140 + criteria * 40);
    }
    case "org_chart": {
      const metrics = hierarchyMetrics(data.items);
      return contentSize(
        240 + metrics.breadth * 120,
        120 + metrics.depth * 60,
      );
    }
    case "decision_tree": {
      const metrics = hierarchyMetrics(data.items);
      return contentSize(
        240 + metrics.breadth * 60,
        150 + metrics.depth * 70,
      );
    }
    case "mind_map": {
      const metrics = hierarchyMetrics(data.items);
      return contentSize(
        320 + metrics.count * 80,
        230 + metrics.count * 30,
      );
    }
    default:
      return null;
  }
}

function frameSize(value: unknown): InfographicContentSize | null {
  const valueRecord = record(value);
  const width = number(valueRecord?.width);
  const height = number(valueRecord?.height);
  return width != null && height != null ? { width, height } : null;
}

function framePosition(value: unknown): { x: number; y: number } | null {
  const valueRecord = record(value);
  const x = number(valueRecord?.x);
  const y = number(valueRecord?.y);
  return x != null && y != null ? { x, y } : null;
}

function containedPosition(
  position: { x: number; y: number },
  size: InfographicContentSize,
) {
  return {
    x: clamp(
      position.x,
      FRAME_MARGIN,
      Math.max(FRAME_MARGIN, EDITOR_STAGE_WIDTH - size.width - FRAME_MARGIN),
    ),
    y: clamp(
      position.y,
      FRAME_MARGIN,
      Math.max(FRAME_MARGIN, EDITOR_STAGE_HEIGHT - size.height - FRAME_MARGIN),
    ),
  };
}

/** Fits a newly inserted infographic to its natural data-driven frame. */
export function fitInfographicElementToData<T extends object>(element: T): T {
  const frame = element as Frame;
  const size = infographicContentSize(frame.data);
  return size ? ({ ...element, size } as T) : element;
}

/**
 * Computes the frame changes for an existing infographic mutation. Structural
 * changes snap to their exact natural content bounds, while edits that do not
 * change the natural footprint leave the user's current frame untouched.
 */
export function resizedInfographicFrame(
  elementValue: unknown,
  nextData: unknown,
): { size?: InfographicContentSize; position?: { x: number; y: number } } {
  const element = record(elementValue);
  if (!element) return {};

  const currentSize = frameSize(element.size);
  const currentPosition = framePosition(element.position);
  const previousNaturalSize = infographicContentSize(element.data);
  const nextNaturalSize = infographicContentSize(nextData);
  if (!nextNaturalSize) return {};

  if (
    previousNaturalSize &&
    previousNaturalSize.width === nextNaturalSize.width &&
    previousNaturalSize.height === nextNaturalSize.height
  ) {
    return {};
  }

  const nextSize = nextNaturalSize;

  if (!currentSize || !currentPosition) return { size: nextSize };

  const centeredPosition = {
    x: currentPosition.x + (currentSize.width - nextSize.width) / 2,
    y: currentPosition.y + (currentSize.height - nextSize.height) / 2,
  };
  return {
    size: nextSize,
    position: containedPosition(centeredPosition, nextSize),
  };
}
