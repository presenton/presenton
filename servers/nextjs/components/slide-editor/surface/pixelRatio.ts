export const SCENE_DEVICE_OVERSAMPLE = 1.35;
export const MIN_CONTENT_SCENE_PIXEL_RATIO = 2;
export const MAX_CONTENT_SCENE_PIXEL_RATIO = 4;
export const CONSTRAINED_SCENE_DEVICE_OVERSAMPLE = 1.15;
export const MIN_CONSTRAINED_CONTENT_SCENE_PIXEL_RATIO = 1.5;
export const MAX_CONSTRAINED_CONTENT_SCENE_PIXEL_RATIO = 3;
export const MIN_BACKGROUND_SCENE_PIXEL_RATIO = 1;
export const MAX_BACKGROUND_SCENE_PIXEL_RATIO = 1;
export const MIN_ALIGNMENT_SCENE_PIXEL_RATIO = 1;
export const MAX_ALIGNMENT_SCENE_PIXEL_RATIO = 2;

export function isConstrainedRenderingDevice({
  deviceMemory,
  hardwareConcurrency,
}: {
  deviceMemory?: number;
  hardwareConcurrency?: number;
}) {
  return (
    (Number.isFinite(deviceMemory) && deviceMemory! <= 4) ||
    (Number.isFinite(hardwareConcurrency) && hardwareConcurrency! <= 4)
  );
}

export function calculateScenePixelRatio({
  devicePixelRatio,
  displayScale,
  minimum,
  maximum,
  oversample = 1,
}: {
  devicePixelRatio: number;
  displayScale: number;
  minimum: number;
  maximum: number;
  oversample?: number;
}) {
  const safeDevicePixelRatio = Number.isFinite(devicePixelRatio)
    ? Math.max(1, devicePixelRatio)
    : 1;
  const safeDisplayScale = Number.isFinite(displayScale)
    ? Math.max(0.1, Math.abs(displayScale))
    : 1;

  return Math.min(
    maximum,
    Math.max(
      minimum,
      safeDevicePixelRatio * safeDisplayScale * oversample,
    ),
  );
}

export function calculateContentScenePixelRatio({
  devicePixelRatio,
  displayScale,
  deviceMemory,
  hardwareConcurrency,
}: {
  devicePixelRatio: number;
  displayScale: number;
  deviceMemory?: number;
  hardwareConcurrency?: number;
}) {
  const constrained = isConstrainedRenderingDevice({
    deviceMemory,
    hardwareConcurrency,
  });

  return calculateScenePixelRatio({
    devicePixelRatio,
    displayScale,
    minimum: constrained
      ? MIN_CONSTRAINED_CONTENT_SCENE_PIXEL_RATIO
      : MIN_CONTENT_SCENE_PIXEL_RATIO,
    maximum: constrained
      ? MAX_CONSTRAINED_CONTENT_SCENE_PIXEL_RATIO
      : MAX_CONTENT_SCENE_PIXEL_RATIO,
    oversample: constrained
      ? CONSTRAINED_SCENE_DEVICE_OVERSAMPLE
      : SCENE_DEVICE_OVERSAMPLE,
  });
}
