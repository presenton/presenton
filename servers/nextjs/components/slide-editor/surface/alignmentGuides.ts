import type { Box, Point } from "@/components/slide-editor/model/model";

type AlignmentAnchor = "start" | "center" | "end";

type AlignmentTarget = {
  anchor: AlignmentAnchor;
  box: Box | null;
  kind: "element" | "stage";
  value: number;
};

type AlignmentCandidate = AlignmentTarget & {
  delta: number;
  distance: number;
  movingAnchor: AlignmentAnchor;
};

export type AlignmentGuide = {
  axis: "horizontal" | "vertical";
  coordinate: number;
  start: number;
  end: number;
};

export type AlignmentSnapResult = {
  guides: AlignmentGuide[];
  position: Point;
};

export type AlignmentSnapTargets = {
  horizontal: AlignmentTarget[];
  vertical: AlignmentTarget[];
};

type SnapBoxToAlignmentGuidesOptions = {
  movingBox: Box;
  stageBox: Box;
  targets: AlignmentSnapTargets;
  threshold: number;
};

const GUIDE_EXTENSION = 10;
const DISTANCE_EPSILON = 0.001;

function axisAnchors(
  box: Box,
  axis: "x" | "y",
): Array<{ anchor: AlignmentAnchor; value: number }> {
  const start = axis === "x" ? box.x : box.y;
  const size = axis === "x" ? box.width : box.height;
  return [
    { anchor: "start", value: start },
    { anchor: "center", value: start + size / 2 },
    { anchor: "end", value: start + size },
  ];
}

function stageTargets(
  stageBox: Box,
  axis: "x" | "y",
): AlignmentTarget[] {
  return axisAnchors(stageBox, axis).map(({ anchor, value }) => ({
    anchor,
    box: null,
    kind: "stage",
    value,
  }));
}

function elementTargets(
  targetBoxes: Box[],
  axis: "x" | "y",
): AlignmentTarget[] {
  return targetBoxes.flatMap((box) =>
    axisAnchors(box, axis).map(({ anchor, value }) => ({
      anchor,
      box,
      kind: "element" as const,
      value,
    })),
  );
}

export function createAlignmentSnapTargets(
  stageBox: Box,
  targetBoxes: Box[],
): AlignmentSnapTargets {
  return {
    vertical: [
      ...stageTargets(stageBox, "x"),
      ...elementTargets(targetBoxes, "x"),
    ],
    horizontal: [
      ...stageTargets(stageBox, "y"),
      ...elementTargets(targetBoxes, "y"),
    ],
  };
}

function anchorsCanAlign(
  movingAnchor: AlignmentAnchor,
  target: AlignmentTarget,
) {
  if (target.kind === "stage") {
    return movingAnchor === target.anchor;
  }
  const includesCenter =
    movingAnchor === "center" || target.anchor === "center";
  return includesCenter
    ? movingAnchor === "center" && target.anchor === "center"
    : true;
}

function candidatePriority(candidate: AlignmentCandidate) {
  if (
    candidate.kind === "stage" &&
    candidate.anchor === "center" &&
    candidate.movingAnchor === "center"
  ) {
    return 0;
  }
  if (
    candidate.anchor === "center" &&
    candidate.movingAnchor === "center"
  ) {
    return 1;
  }
  if (candidate.anchor === candidate.movingAnchor) return 2;
  return 3;
}

function isBetterCandidate(
  candidate: AlignmentCandidate,
  current: AlignmentCandidate | null,
) {
  if (!current) return true;
  if (candidate.distance < current.distance - DISTANCE_EPSILON) return true;
  if (candidate.distance > current.distance + DISTANCE_EPSILON) return false;
  return candidatePriority(candidate) < candidatePriority(current);
}

function closestAlignment(
  movingBox: Box,
  targets: AlignmentTarget[],
  axis: "x" | "y",
  threshold: number,
) {
  let closest: AlignmentCandidate | null = null;
  for (const moving of axisAnchors(movingBox, axis)) {
    for (const target of targets) {
      if (!anchorsCanAlign(moving.anchor, target)) continue;
      const delta = target.value - moving.value;
      const candidate = {
        ...target,
        delta,
        distance: Math.abs(delta),
        movingAnchor: moving.anchor,
      };
      if (
        candidate.distance <= threshold &&
        isBetterCandidate(candidate, closest)
      ) {
        closest = candidate;
      }
    }
  }
  return closest;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function guideForCandidate(
  candidate: AlignmentCandidate,
  snappedBox: Box,
  stageBox: Box,
  axis: "x" | "y",
): AlignmentGuide {
  if (candidate.kind === "stage" || !candidate.box) {
    return axis === "x"
      ? {
          axis: "vertical",
          coordinate: candidate.value,
          start: stageBox.y,
          end: stageBox.y + stageBox.height,
        }
      : {
          axis: "horizontal",
          coordinate: candidate.value,
          start: stageBox.x,
          end: stageBox.x + stageBox.width,
        };
  }

  const target = candidate.box;
  if (axis === "x") {
    return {
      axis: "vertical",
      coordinate: candidate.value,
      start: clamp(
        Math.min(snappedBox.y, target.y) - GUIDE_EXTENSION,
        stageBox.y,
        stageBox.y + stageBox.height,
      ),
      end: clamp(
        Math.max(
          snappedBox.y + snappedBox.height,
          target.y + target.height,
        ) + GUIDE_EXTENSION,
        stageBox.y,
        stageBox.y + stageBox.height,
      ),
    };
  }

  return {
    axis: "horizontal",
    coordinate: candidate.value,
    start: clamp(
      Math.min(snappedBox.x, target.x) - GUIDE_EXTENSION,
      stageBox.x,
      stageBox.x + stageBox.width,
    ),
    end: clamp(
      Math.max(
        snappedBox.x + snappedBox.width,
        target.x + target.width,
      ) + GUIDE_EXTENSION,
      stageBox.x,
      stageBox.x + stageBox.width,
    ),
  };
}

export function snapBoxToAlignmentGuides({
  movingBox,
  stageBox,
  targets,
  threshold,
}: SnapBoxToAlignmentGuidesOptions): AlignmentSnapResult {
  const safeThreshold = Math.max(0, threshold);
  const vertical = closestAlignment(
    movingBox,
    targets.vertical,
    "x",
    safeThreshold,
  );
  const horizontal = closestAlignment(
    movingBox,
    targets.horizontal,
    "y",
    safeThreshold,
  );
  const position = {
    x: movingBox.x + (vertical?.delta ?? 0),
    y: movingBox.y + (horizontal?.delta ?? 0),
  };
  const snappedBox = { ...movingBox, ...position };
  const guides = [
    ...(vertical
      ? [guideForCandidate(vertical, snappedBox, stageBox, "x")]
      : []),
    ...(horizontal
      ? [guideForCandidate(horizontal, snappedBox, stageBox, "y")]
      : []),
  ];

  return { guides, position };
}
