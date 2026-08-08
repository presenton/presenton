export type LatestFrameBatch<T> = {
  schedule: (value: T) => void;
  cancel: () => void;
};

type RequestFrame = (callback: () => void) => number;
type CancelFrame = (frame: number) => void;

/**
 * Coalesces a stream of values into at most one commit per animation frame.
 * Only the most recent value matters for pointer-driven visual previews.
 */
export function createLatestFrameBatch<T>(
  requestFrame: RequestFrame,
  cancelFrame: CancelFrame,
  commit: (value: T) => void,
): LatestFrameBatch<T> {
  let frame: number | null = null;
  let latest: T | undefined;
  let hasLatest = false;

  const run = () => {
    frame = null;
    if (!hasLatest) return;

    const value = latest as T;
    latest = undefined;
    hasLatest = false;
    commit(value);
  };

  return {
    schedule(value) {
      latest = value;
      hasLatest = true;
      if (frame != null) return;
      frame = requestFrame(run);
    },
    cancel() {
      if (frame != null) cancelFrame(frame);
      frame = null;
      latest = undefined;
      hasLatest = false;
    },
  };
}
