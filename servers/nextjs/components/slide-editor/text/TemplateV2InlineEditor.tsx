"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { withHash } from "@/components/slide-editor/utils/color";
import type { Font, Marker, TextRun } from "@/components/slide-editor/types";
import {
  type TemplateV2InlineEditBox,
  type TemplateV2InlineEditKind,
  type TemplateV2TextEditStyle,
  wordWrappedTextRuns,
} from "@/components/slide-editor/text/template-v2-text-editing";
import { effectiveLineHeight } from "@/components/slide-editor/text/text-line-height";
import type { TextSelectionRange } from "@/components/slide-editor/text/text-runs";
import {
  cssFontFamilyStack,
  TiptapInlineTextEditor,
} from "@/components/slide-editor/text/TiptapInlineTextEditor";

const DEFAULT_TEXT_EDIT_STYLE: TemplateV2TextEditStyle = {
  family: "Arial",
  size: 18,
  color: "#111827",
  bold: false,
  italic: false,
  underline: false,
  lineHeight: 1.15,
  letterSpacing: 0,
  opacity: 1,
  horizontal: "left",
  vertical: "top",
};

export function TemplateV2InlineEditor({
  box,
  draft,
  kind,
  listMarker,
  runs,
  style,
  onChange,
  onClose,
  onRunsChange,
  onSelectionChange,
}: {
  box: TemplateV2InlineEditBox;
  draft: string;
  kind: TemplateV2InlineEditKind;
  listMarker?: Marker | null;
  runs?: TextRun[];
  style?: TemplateV2TextEditStyle;
  onChange: (draft: string) => void;
  onClose: (commit: boolean, runs?: TextRun[]) => void;
  onRunsChange?: (runs: TextRun[]) => void;
  onSelectionChange?: (range: TextSelectionRange | null) => void;
}) {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const font = style ?? DEFAULT_TEXT_EDIT_STYLE;
  const isCode = kind === "svg";
  const isRichText = kind === "text" || kind === "text-list";
  const textStyle = font;
  const fontSize = isCode ? 12 : textStyle.size;
  const editorLineHeight = effectiveLineHeight({
    text: draft,
    width: box.width,
    fontSize,
    lineHeight: textStyle.lineHeight,
    fallback: 1.15,
    wrap: "word",
  });
  const closeAfterBlur = useCallback(() => {
    window.setTimeout(() => {
      const active = document.activeElement;
      if (active && editorRef.current?.contains(active)) return;
      if (active?.closest?.("[data-inline-edit-ignore='true']")) return;
      onClose(true);
    }, 0);
  }, [onClose]);
  const reportSelection = useCallback(
    (target: HTMLTextAreaElement) => {
      if (!isRichText) return;
      onSelectionChange?.({
        start: target.selectionStart,
        end: target.selectionEnd,
      });
    },
    [isRichText, onSelectionChange],
  );
  const editorStyle: CSSProperties = {
    position: "absolute",
    zIndex: 31,
    left: box.x,
    top: box.y,
    width: box.width,
    height: box.height,
    pointerEvents: "auto",
    border: "1px solid #7C51F8",
    outline: "none",
    resize: "none",
    padding: 0,
    background: isCode
      ? "rgba(7,20,37,0.96)"
      : "rgba(255,255,255,0.08)",
    color: isCode ? "#E7EDF8" : withHash(textStyle.color),
    caretColor: isCode ? "#E7EDF8" : withHash(textStyle.color),
    fontFamily: isCode
      ? "Menlo, Consolas, monospace"
      : cssFontFamilyStack(textStyle.family),
    fontSize,
    fontWeight: textStyle.bold ? 700 : 400,
    fontStyle: textStyle.italic ? "italic" : "normal",
    lineHeight: editorLineHeight,
    letterSpacing: textStyle.letterSpacing,
    textAlign: textStyle.horizontal as CSSProperties["textAlign"],
    overflow: isCode ? "auto" : "visible",
  };
  const baseTextFont = useMemo(() => textEditStyleToFont(textStyle), [textStyle]);
  const [initialTextEditorRuns] = useState<TextRun[]>(() =>
    wordWrappedTextRuns(runs ?? [{ text: draft || " ", font: baseTextFont }]),
  );
  const textEditorRuns = useMemo(
    () => wordWrappedTextRuns(runs ?? initialTextEditorRuns),
    [initialTextEditorRuns, runs],
  );
  const latestRunsRef = useRef<TextRun[]>(initialTextEditorRuns);

  useEffect(() => {
    latestRunsRef.current = wordWrappedTextRuns(textEditorRuns);
  }, [textEditorRuns]);

  const closeTextEditor = useCallback(
    (commit: boolean) => {
      onClose(commit, commit ? latestRunsRef.current : undefined);
    },
    [onClose],
  );

  return (
    <div
      ref={editorRef}
      data-inline-edit-ignore="true"
      onBlur={isRichText ? undefined : closeAfterBlur}
      onPointerDown={(event) => event.stopPropagation()}
      onMouseDown={(event) => event.stopPropagation()}
      style={{
        position: "absolute",
        zIndex: 30,
        inset: 0,
        pointerEvents: "none",
      }}
    >
      {isRichText ? (
        <TiptapInlineTextEditor
          baseFont={baseTextFont}
          editorStyle={editorStyle}
          listMarker={kind === "text-list" ? listMarker : null}
          runs={textEditorRuns}
          onBlurOutside={() => closeTextEditor(true)}
          onCommitShortcut={() => closeTextEditor(true)}
          onEscape={() => closeTextEditor(false)}
          onRunsChange={(nextRuns) => {
            latestRunsRef.current = nextRuns;
            onRunsChange?.(nextRuns);
          }}
          onSelectionChange={onSelectionChange ?? (() => undefined)}
        />
      ) : (
        <textarea
          autoFocus
          data-inline-edit-ignore="true"
          value={draft}
          onMouseDown={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
          onChange={(event) => {
            onChange(event.target.value);
            reportSelection(event.currentTarget);
          }}
          onFocus={(event) => reportSelection(event.currentTarget)}
          onSelect={(event) => reportSelection(event.currentTarget)}
          onMouseUp={(event) => reportSelection(event.currentTarget)}
          onKeyUp={(event) => reportSelection(event.currentTarget)}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              onClose(false);
            }
            if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
              event.preventDefault();
              onClose(true);
            }
          }}
          style={editorStyle}
        />
      )}
    </div>
  );
}

function textEditStyleToFont(font: TemplateV2TextEditStyle): Font {
  return {
    family: font.family,
    size: font.size,
    color: font.color,
    bold: font.bold,
    italic: font.italic,
    underline: font.underline,
    line_height: font.lineHeight,
    letter_spacing: font.letterSpacing,
    opacity: font.opacity,
  };
}
