import type { Marker, TextRun } from "@/components/slide-editor/types";
import type { TextSelectionRange } from "@/components/slide-editor/text/text-runs";
import {
  fontFromRecord,
  layoutRenderTextRuns,
  lineRenderHeight,
  type RenderTextRun,
} from "@/components/slide-editor/text/template-v2-text";

export type TemplateV2InlineEditKind = "text" | "text-list" | "svg";

export type TemplateV2InlineEditBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type TemplateV2TextEditStyle = {
  family: string;
  size: number;
  color: string;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  lineHeight: number;
  letterSpacing: number;
  opacity: number;
  horizontal: "left" | "center" | "right";
  vertical: "top" | "middle" | "bottom";
};

export type TemplateV2InlineEdit<Selection> =
  | {
      kind: TemplateV2InlineEditKind;
      selection: Selection;
      draft: string;
      frame?: TemplateV2InlineEditBox | null;
      style?: TemplateV2TextEditStyle;
      runs?: TextRun[];
      listMarker?: Marker | null;
      textSelectionRange?: TextSelectionRange | null;
    }
  | null;

export function measureWrappedRenderTextHeight(
  runs: RenderTextRun[],
  width: number,
  wrap: string | null | undefined,
  fallbackLineHeight: number,
) {
  const lines = layoutRenderTextRuns(runs, width, wrap);
  if (lines.length === 0) return fallbackLineHeight;
  return lines.reduce(
    (sum, line) => sum + lineRenderHeight(line, fallbackLineHeight),
    0,
  );
}

export function measureWordWrappedTextRunsHeight(
  runs: TextRun[],
  width: number,
  style: TemplateV2TextEditStyle,
) {
  const baseFont: RenderTextRun["font"] = style;
  const sourceRuns = runs.length > 0 ? runs : [{ text: " ", font: {} }];
  const renderRuns = sourceRuns.map((run) => ({
    text: run.text,
    font: fontFromRecord(
      (run.font ?? {}) as Record<string, unknown>,
      baseFont,
    ),
  }));
  const text = sourceRuns.map((run) => run.text).join("");
  const emptyHardLines = text.includes("\n")
    ? text.split("\n").filter((line) => line.length === 0).length
    : 0;
  return Math.ceil(
    measureWrappedRenderTextHeight(
      renderRuns,
      Math.max(1, width),
      "word",
      baseFont.lineHeight,
    ) +
      emptyHardLines * baseFont.size * baseFont.lineHeight,
  );
}

export function wordWrappedTextRuns(runs: TextRun[]): TextRun[] {
  return runs.map((run) => ({
    ...run,
    font: stripRunFontWrap(run.font),
  }));
}

function stripRunFontWrap(font: TextRun["font"] | null | undefined) {
  if (!font) return font;
  return Object.fromEntries(
    Object.entries(font).filter(([key]) => key !== "wrap"),
  ) as TextRun["font"];
}
