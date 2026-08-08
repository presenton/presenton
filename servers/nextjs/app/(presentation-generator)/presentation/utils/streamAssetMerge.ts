const PLACEHOLDER_ASSET_MARKERS = [
  "/static/images/placeholder",
  "/static/images/replaceable_template_image",
  "/static/icons/placeholder",
  "placeholder.jpg",
  "placeholder.svg",
  "replaceable_template_image.png",
];

export function isPlaceholderAssetUrl(value: unknown): boolean {
  if (typeof value !== "string" || !value.trim()) return false;
  const normalized = value.toLowerCase();
  return PLACEHOLDER_ASSET_MARKERS.some((marker) =>
    normalized.includes(marker)
  );
}

function isResolvedAssetUrl(value: unknown): value is string {
  return (
    typeof value === "string" &&
    Boolean(value.trim()) &&
    !isPlaceholderAssetUrl(value)
  );
}

/**
 * Stream chunks replay slides with their original placeholder assets. Once an
 * asset event has supplied a real URL, keep that URL when a later replay sends
 * the placeholder again. This walks the whole slide so it covers both content
 * asset fields and Template V2's already-hydrated `ui` image data.
 */
function mergeTreePreservingResolvedAssets(previous: any, incoming: any): any {
  if (incoming === undefined) return previous;

  if (
    isPlaceholderAssetUrl(incoming) &&
    isResolvedAssetUrl(previous)
  ) {
    return previous;
  }

  if (incoming === null || typeof incoming !== "object") return incoming;

  if (Array.isArray(incoming)) {
    if (!Array.isArray(previous)) return incoming;
    return incoming.map((item, index) =>
      mergeTreePreservingResolvedAssets(previous[index], item)
    );
  }

  if (
    previous === null ||
    typeof previous !== "object" ||
    Array.isArray(previous)
  ) {
    return incoming;
  }

  const merged: Record<string, unknown> = { ...incoming };
  for (const [key, value] of Object.entries(incoming)) {
    merged[key] = mergeTreePreservingResolvedAssets(previous[key], value);
  }
  return merged;
}

function findPreviousSlide(
  previousSlides: any[],
  incomingSlide: any,
  incomingPosition: number
): any | undefined {
  if (typeof incomingSlide?.index === "number") {
    const indexedSlide = previousSlides.find(
      (slide) => slide?.index === incomingSlide.index
    );
    if (indexedSlide) return indexedSlide;
  }
  return previousSlides[incomingPosition];
}

export function mergeSlidePreservingResolvedAssets(
  previousSlide: any,
  incomingSlide: any
): any {
  if (!previousSlide) return incomingSlide;
  if (!incomingSlide || typeof incomingSlide !== "object") {
    return incomingSlide;
  }

  return {
    ...previousSlide,
    ...mergeTreePreservingResolvedAssets(previousSlide, incomingSlide),
  };
}

export function mergeSlidesPreservingResolvedAssets(
  previousSlides: any[] | undefined,
  incomingSlides: any[]
): any[] {
  if (!previousSlides?.length) return incomingSlides;

  return incomingSlides.map((incomingSlide, position) =>
    mergeSlidePreservingResolvedAssets(
      findPreviousSlide(previousSlides, incomingSlide, position),
      incomingSlide
    )
  );
}

export function mergeSingleSlidePreservingResolvedAssets(
  previousSlides: any[] | undefined,
  incomingSlide: any
): any[] {
  const nextSlides = [...(previousSlides ?? [])];
  const incomingIndex =
    typeof incomingSlide?.index === "number"
      ? incomingSlide.index
      : nextSlides.length;
  const existingIndex = nextSlides.findIndex(
    (slide) =>
      typeof slide?.index === "number" && slide.index === incomingIndex
  );
  const existingSlide =
    existingIndex >= 0 ? nextSlides[existingIndex] : nextSlides[incomingIndex];
  const mergedSlide = mergeSlidePreservingResolvedAssets(
    existingSlide,
    incomingSlide
  );

  if (existingIndex >= 0) {
    nextSlides[existingIndex] = mergedSlide;
  } else {
    nextSlides.push(mergedSlide);
  }

  return nextSlides.sort(
    (a, b) =>
      (typeof a?.index === "number" ? a.index : 0) -
      (typeof b?.index === "number" ? b.index : 0)
  );
}
