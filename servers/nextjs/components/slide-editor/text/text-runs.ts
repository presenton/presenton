import type { Font, TextElement, TextRun } from "@/components/slide-editor/types";

export type TextSelectionRange = {
  start: number;
  end: number;
};

export function textRunsContent(runs: Pick<TextRun, "text">[]) {
  return runs.map((run) => run.text).join("");
}

export function normalizedTextSelectionRange(
  range: TextSelectionRange | null | undefined,
  textLength: number,
) {
  if (!range) return null;
  const start = clamp(Math.min(range.start, range.end), 0, textLength);
  const end = clamp(Math.max(range.start, range.end), 0, textLength);
  return end > start ? { start, end } : null;
}

export function fontForTextSelection(
  element: Pick<TextElement, "font" | "runs">,
  range: TextSelectionRange | null | undefined,
) {
  const textLength = textRunsContent(element.runs).length;
  const normalized = normalizedTextSelectionRange(range, textLength);
  const targetOffset = normalized?.start ?? 0;
  let offset = 0;

  for (const run of element.runs) {
    const nextOffset = offset + run.text.length;
    if (targetOffset >= offset && targetOffset <= nextOffset) {
      return { ...(element.font ?? {}), ...(run.font ?? {}) } satisfies Font;
    }
    offset = nextOffset;
  }

  return element.runs[0]?.font
    ? ({ ...(element.font ?? {}), ...element.runs[0].font } satisfies Font)
    : element.font;
}

export function applyTextRunFontToSelection<T extends Pick<TextElement, "font" | "runs">>(
  element: T,
  range: TextSelectionRange | null | undefined,
  fontPatch: Partial<Font>,
) {
  const textLength = textRunsContent(element.runs).length;
  const normalized = normalizedTextSelectionRange(range, textLength);
  if (!normalized) return element;

  const patch = cleanFontPatch(fontPatch);
  const nextRuns: TextRun[] = [];
  let offset = 0;

  for (const run of element.runs) {
    const runText = run.text;
    const runStart = offset;
    const runEnd = offset + runText.length;
    const overlapStart = Math.max(runStart, normalized.start);
    const overlapEnd = Math.min(runEnd, normalized.end);

    if (overlapStart >= overlapEnd) {
      nextRuns.push(run);
      offset = runEnd;
      continue;
    }

    const before = runText.slice(0, overlapStart - runStart);
    const selected = runText.slice(overlapStart - runStart, overlapEnd - runStart);
    const after = runText.slice(overlapEnd - runStart);
    const runFont = run.font ?? element.font ?? undefined;

    if (before) nextRuns.push({ ...run, text: before });
    if (selected) {
      nextRuns.push({
        ...run,
        text: selected,
        font: {
          ...(runFont ?? {}),
          ...patch,
        },
      });
    }
    if (after) nextRuns.push({ ...run, text: after });

    offset = runEnd;
  }

  return {
    ...element,
    runs: mergeAdjacentTextRuns(nextRuns),
  };
}

export function replaceTextRunsContent(
  runs: TextRun[],
  text: string,
  fallbackFont?: Font | null,
) {
  const nextText = text || " ";
  if (runs.length === 0) {
    return [
      fallbackFont ? { text: nextText, font: fallbackFont } : { text: nextText },
    ];
  }

  const nextRuns: TextRun[] = [];
  let offset = 0;
  let lastFont = runs[0]?.font ?? fallbackFont ?? undefined;

  for (const run of runs) {
    if (offset >= nextText.length) break;
    const runLength = Math.max(1, run.text.length);
    const textSlice = nextText.slice(offset, offset + runLength);
    if (textSlice) {
      lastFont = run.font ?? lastFont;
      nextRuns.push({
        ...run,
        text: textSlice,
        font: run.font ?? fallbackFont ?? undefined,
      });
    }
    offset += runLength;
  }

  if (offset < nextText.length) {
    const sourceRun = runs[runs.length - 1];
    nextRuns.push({
      ...(sourceRun ?? {}),
      text: nextText.slice(offset),
      font: sourceRun?.font ?? lastFont,
    });
  }

  return mergeAdjacentTextRuns(nextRuns);
}

export function mergeAdjacentTextRuns(runs: TextRun[]) {
  const merged: TextRun[] = [];
  for (const run of runs) {
    if (!run.text) continue;
    const previous = merged[merged.length - 1];
    if (previous && sameFont(previous.font, run.font)) {
      previous.text += run.text;
      continue;
    }
    merged.push(run);
  }
  return merged.length > 0 ? merged : [{ text: " " }];
}

function cleanFontPatch(font: Partial<Font>) {
  return Object.fromEntries(
    Object.entries(font).filter(([, value]) => value !== undefined),
  ) as Partial<Font>;
}

function sameFont(left: TextRun["font"], right: TextRun["font"]) {
  return JSON.stringify(left ?? null) === JSON.stringify(right ?? null);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
