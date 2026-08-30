"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import {
  Mark,
  Node as TiptapNode,
  mergeAttributes,
  type Editor,
  type JSONContent,
} from "@tiptap/core";
import Underline from "@tiptap/extension-underline";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { NodeSelection, TextSelection } from "@tiptap/pm/state";
import type { Font, Marker, TextRun } from "@/components/slide-editor/types";
import {
  isLatexTextRun,
  mergeAdjacentTextRuns,
  type TextSelectionRange,
} from "@/components/slide-editor/text/text-runs";
import { cssFontFamilyStack } from "@/components/slide-editor/text/css-text";
import { normalizeMathLatex } from "@/lib/math";

export const COMMIT_TEMPLATE_V2_INLINE_TEXT_EVENT =
  "presenton:commit-template-v2-inline-text";
const NON_BREAKING_SPACE = "\u00A0";
const LATEX_RUN_FOCUS_EVENT = "presenton:latex-run-focus";

type RunStyleAttrs = {
  family?: string | null;
  size?: number | null;
  color?: string | null;
  bold?: boolean | null;
  italic?: boolean | null;
  underline?: boolean | null;
  lineHeight?: number | null;
  letterSpacing?: number | null;
  opacity?: number | null;
};

const RunStyle = Mark.create({
  name: "runStyle",
  inclusive: true,
  addAttributes() {
    const attribute = () => ({
      default: null,
      parseHTML: () => null,
      renderHTML: () => ({}),
    });

    return {
      family: attribute(),
      size: attribute(),
      color: attribute(),
      bold: attribute(),
      italic: attribute(),
      underline: attribute(),
      lineHeight: attribute(),
      letterSpacing: attribute(),
      opacity: attribute(),
    };
  },
  parseHTML() {
    return [{ tag: "span[data-slide-run-style]" }];
  },
  renderHTML({ mark, HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        "data-slide-run-style": "true",
        style: runStyleAttrsToCss(mark.attrs as RunStyleAttrs),
      }),
      0,
    ];
  },
});

const LatexRun = TiptapNode.create({
  name: "latexRun",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,
  draggable: false,
  addAttributes() {
    return {
      latex: { default: "" },
      displayMode: { default: false },
      font: { default: null },
    };
  },
  parseHTML() {
    return [{ tag: "span[data-slide-latex-run]" }];
  },
  renderHTML({ node, HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        "data-slide-latex-run": "true",
        "data-latex": node.attrs.latex,
        contenteditable: "false",
      }),
      node.attrs.latex,
    ];
  },
  renderText({ node }) {
    return node.attrs.latex;
  },
  addNodeView() {
    return ({ getPos, node, view }) => {
      const dom = document.createElement("span");
      const textarea = document.createElement("textarea");
      let currentNode = node;
      let committing = false;
      let resizeFrame: number | null = null;

      const resizeTextarea = () => {
        textarea.style.width = `${Math.min(72, Math.max(12, textarea.value.length + 2))}ch`;
        textarea.style.height = "auto";
        const editorHeight =
          currentNode.attrs.displayMode === true ? view.dom.clientHeight : 0;
        textarea.style.height = `${Math.max(textarea.scrollHeight, editorHeight, 1)}px`;
      };
      const scheduleTextareaResize = () => {
        if (resizeFrame != null) window.cancelAnimationFrame(resizeFrame);
        resizeFrame = window.requestAnimationFrame(() => {
          resizeFrame = null;
          resizeTextarea();
        });
      };
      const syncTextarea = () => {
        const { displayMode, latex } = currentNode.attrs;
        dom.dataset.slideLatexRun = "true";
        dom.dataset.latex = latex;
        dom.contentEditable = "false";
        dom.style.cssText = `display:${displayMode ? "block" : "inline-block"};max-width:100%;vertical-align:middle;`;
        textarea.value = latex;
        resizeTextarea();
        scheduleTextareaResize();
      };

      const emitTextareaSelection = () => {
        const position = getPos();
        if (typeof position !== "number") return;
        const runStart = view.state.doc.textBetween(
          0,
          position,
          "\n",
          editorLeafText,
        ).length;
        const range = {
          start: runStart + textarea.selectionStart,
          end: runStart + textarea.selectionEnd,
        };
        view.dom.dispatchEvent(
          new CustomEvent<TextSelectionRange>(LATEX_RUN_FOCUS_EVENT, {
            detail: range,
          }),
        );
      };

      const commit = (deleteEmpty = true) => {
        if (committing) return;
        committing = true;

        const position = getPos();
        if (typeof position !== "number") {
          committing = false;
          syncTextarea();
          return;
        }
        const latex = normalizeMathLatex(textarea.value);
        if (
          latex === currentNode.attrs.latex &&
          (latex.length > 0 || !deleteEmpty)
        ) {
          committing = false;
          return;
        }
        const transaction = latex || !deleteEmpty
          ? view.state.tr.setNodeMarkup(position, undefined, {
              ...currentNode.attrs,
              latex,
            })
          : view.state.tr.delete(position, position + currentNode.nodeSize);
        view.dispatch(transaction);
        committing = false;
      };

      textarea.rows = 1;
      textarea.wrap = "soft";
      textarea.setAttribute("aria-label", "Edit LaTeX expression");
      textarea.setAttribute("title", "LaTeX expression");
      textarea.spellcheck = false;
      textarea.draggable = false;
      textarea.style.cssText = `box-sizing:border-box;display:block;min-width:8ch;max-width:100%;min-height:1.8em;padding:2px 6px;border:1px solid #7c3aed;border-radius:4px;background:#fff;color:#111827;caret-color:currentColor;font:500 0.8em/1.4 ui-monospace,SFMono-Regular,Menlo,monospace;outline:none;overflow:hidden;overflow-wrap:anywhere;resize:none;white-space:pre-wrap;vertical-align:middle;`;
      textarea.addEventListener("input", () => {
        resizeTextarea();
        commit(false);
        emitTextareaSelection();
      });
      textarea.addEventListener("focus", () => {
        resizeTextarea();
        const position = getPos();
        if (typeof position !== "number") return;
        const { selection } = view.state;
        if (selection instanceof NodeSelection && selection.from === position) {
          view.dispatch(
            view.state.tr.setSelection(
              TextSelection.near(
                view.state.doc.resolve(position + currentNode.nodeSize),
              ),
            ),
          );
        }
        emitTextareaSelection();
      });
      textarea.addEventListener("select", emitTextareaSelection);
      textarea.addEventListener("mouseup", emitTextareaSelection);
      textarea.addEventListener("keyup", emitTextareaSelection);
      textarea.addEventListener("dragstart", (event) => {
        event.preventDefault();
      });
      textarea.addEventListener("blur", () => commit());
      textarea.addEventListener("keydown", (keyboardEvent) => {
        if (keyboardEvent.key === "Enter") {
          keyboardEvent.preventDefault();
          commit();
          view.focus();
        } else if (keyboardEvent.key === "Escape") {
          keyboardEvent.preventDefault();
          syncTextarea();
          view.focus();
        }
      });
      dom.draggable = false;
      dom.appendChild(textarea);
      syncTextarea();
      return {
        dom,
        update(updatedNode) {
          if (updatedNode.type.name !== "latexRun") return false;
          currentNode = updatedNode;
          if (document.activeElement !== textarea) syncTextarea();
          return true;
        },
        stopEvent(event) {
          return event.target === textarea;
        },
        destroy() {
          if (resizeFrame != null) window.cancelAnimationFrame(resizeFrame);
        },
      };
    };
  },
});

const TIPTAP_EXTENSIONS = [
  StarterKit.configure({
    heading: false,
    bulletList: false,
    orderedList: false,
    blockquote: false,
    codeBlock: false,
    horizontalRule: false,
  }),
  Underline,
  RunStyle,
  LatexRun,
];

export function TiptapInlineTextEditor({
  autoFocus = true,
  baseFont,
  contentClassName,
  contentStyle,
  editorStyle,
  listMarker,
  runs,
  onBlurOutside,
  onCommitShortcut,
  onEscape,
  onRunsChange,
  onSelectionChange,
}: {
  autoFocus?: boolean;
  baseFont: Font;
  contentClassName?: string;
  contentStyle?: CSSProperties;
  editorStyle: CSSProperties;
  listMarker?: Marker | null;
  runs: TextRun[];
  onBlurOutside: () => void;
  onCommitShortcut: () => void;
  onEscape: () => void;
  onRunsChange: (runs: TextRun[]) => void;
  onSelectionChange: (range: TextSelectionRange | null) => void;
}) {
  const lastEmittedSignatureRef = useRef<string | null>(null);
  const lastSelectionSignatureRef = useRef<string | null>(null);
  const didAutoFocusRef = useRef(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const pendingRunsFrameRef = useRef<number | null>(null);
  const pendingRunsEditorRef = useRef<Editor | null>(null);
  const toolbarPointerDownRef = useRef(false);
  const toolbarPointerDownTimeoutRef = useRef<number | null>(null);
  const callbacksRef = useLatestRef({
    onBlurOutside,
    onCommitShortcut,
    onEscape,
    onRunsChange,
    onSelectionChange,
  });
  const baseFontSignature = useMemo(() => JSON.stringify(baseFont), [baseFont]);
  const stableBaseFont = useMemo(
    () => JSON.parse(baseFontSignature) as Font,
    [baseFontSignature],
  );
  const [initialContent] = useState<JSONContent>(() =>
    textRunsToTiptapContent(runs, stableBaseFont),
  );
  const [initialContentSignature] = useState(() => textRunsSignature(runs));
  const syncedContentSignatureRef = useRef<string | null>(
    initialContentSignature,
  );
  const stableBaseFontRef = useLatestRef(stableBaseFont);
  const listMarkerRef = useLatestRef(listMarker ?? null);
  const content = useMemo(
    () => textRunsToTiptapContent(runs, stableBaseFont),
    [runs, stableBaseFont],
  );
  const contentSignature = useMemo(() => textRunsSignature(runs), [runs]);
  const editorContentStyle = useMemo(
    () => tiptapEditorStyle(stableBaseFont, runs),
    [runs, stableBaseFont],
  );
  const emitRuns = useCallback(
    (editor: Editor) => {
      const nextRuns = tiptapContentToTextRuns(
        editor.getJSON(),
        stableBaseFontRef.current,
      );
      const nextSignature = textRunsSignature(nextRuns);
      if (nextSignature === lastEmittedSignatureRef.current) return;
      lastEmittedSignatureRef.current = nextSignature;
      syncedContentSignatureRef.current = nextSignature;
      callbacksRef.current.onRunsChange(nextRuns);
    },
    [callbacksRef, stableBaseFontRef],
  );
  const flushPendingRuns = useCallback(() => {
    if (pendingRunsFrameRef.current != null) {
      window.cancelAnimationFrame(pendingRunsFrameRef.current);
      pendingRunsFrameRef.current = null;
    }
    const pendingEditor = pendingRunsEditorRef.current;
    pendingRunsEditorRef.current = null;
    if (!pendingEditor || pendingEditor.isDestroyed) return;
    emitRuns(pendingEditor);
  }, [emitRuns]);
  const scheduleRunsEmit = useCallback(
    (editor: Editor) => {
      pendingRunsEditorRef.current = editor;
      if (typeof window === "undefined") {
        flushPendingRuns();
        return;
      }
      if (pendingRunsFrameRef.current != null) return;
      pendingRunsFrameRef.current = window.requestAnimationFrame(() => {
        pendingRunsFrameRef.current = null;
        const pendingEditor = pendingRunsEditorRef.current;
        pendingRunsEditorRef.current = null;
        if (!pendingEditor || pendingEditor.isDestroyed) return;
        emitRuns(pendingEditor);
      });
    },
    [emitRuns, flushPendingRuns],
  );
  const emitSelection = useCallback(
    (editor: Editor) => {
      const range = selectionRangeFromEditor(editor);
      const signature = selectionRangeSignature(range);
      if (signature === lastSelectionSignatureRef.current) return;
      lastSelectionSignatureRef.current = signature;
      callbacksRef.current.onSelectionChange(range);
    },
    [callbacksRef],
  );

  const editor = useEditor({
    extensions: TIPTAP_EXTENSIONS,
    content: initialContent,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: "template-v2-tiptap-inline-prosemirror",
        style: editorContentStyle,
        "data-inline-edit-ignore": "true",
      },
      handleDOMEvents: {
        beforeinput: (view, event) => {
          if (!(event instanceof InputEvent)) return false;
          if (!applyBeforeInput(view, event, listMarkerRef.current)) return false;
          event.preventDefault();
          event.stopPropagation();
          return true;
        },
        mousedown: (_view, event) => {
          event.stopPropagation();
          return false;
        },
        pointerdown: (_view, event) => {
          event.stopPropagation();
          return false;
        },
        keydown: (view, event) => {
          event.stopPropagation();
          if (event.key === "Escape") {
            event.preventDefault();
            callbacksRef.current.onEscape();
            return true;
          }
          if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
            event.preventDefault();
            flushPendingRuns();
            callbacksRef.current.onCommitShortcut();
            return true;
          }
          if (event.key === "Enter" && listMarkerRef.current != null) {
            event.preventDefault();
            return applyLineBreakBeforeInput(view, listMarkerRef.current);
          }
          return false;
        },
      },
    },
    onUpdate: ({ editor }) => {
      scheduleRunsEmit(editor);
    },
    onSelectionUpdate: ({ editor }) => {
      emitSelection(editor);
    },
    onFocus: ({ editor }) => {
      emitSelection(editor);
    },
    onBlur: ({ event }) => {
      const relatedTarget = event.relatedTarget;
      if (
        relatedTarget instanceof HTMLElement &&
        relatedTarget.closest("[data-inline-edit-ignore='true']")
      ) {
        return;
      }
      window.setTimeout(() => {
        if (toolbarPointerDownRef.current) return;
        const active = document.activeElement;
        if (
          active instanceof HTMLElement &&
          active.closest("[data-inline-edit-ignore='true']")
        ) {
          return;
        }
        flushPendingRuns();
        callbacksRef.current.onBlurOutside();
      }, 0);
    },
  });

  useEffect(() => {
    if (!editor) return;
    editor.setOptions({
      editorProps: {
        ...editor.options.editorProps,
        attributes: {
          ...editor.options.editorProps.attributes,
          style: editorContentStyle,
        },
      },
    });
  }, [editor, editorContentStyle]);

  useEffect(() => {
    if (!editor) return;
    if (contentSignature === syncedContentSignatureRef.current) return;
    if (contentSignature === lastEmittedSignatureRef.current) return;
    const { from, to } = editor.state.selection;
    lastEmittedSignatureRef.current = contentSignature;
    syncedContentSignatureRef.current = contentSignature;
    editor.commands.setContent(content, false);
    const maxPosition = Math.max(1, editor.state.doc.content.size);
    editor.commands.setTextSelection({
      from: clampPosition(from, maxPosition),
      to: clampPosition(to, maxPosition),
    });
    emitSelection(editor);
  }, [content, contentSignature, editor, emitSelection, runs]);

  useEffect(() => {
    if (!editor) return;
    const handleLatexRunFocus = (event: Event) => {
      if (!(event instanceof CustomEvent)) return;
      const range = event.detail as TextSelectionRange;
      const signature = selectionRangeSignature(range);
      lastSelectionSignatureRef.current = signature;
      callbacksRef.current.onSelectionChange(range);
    };
    const editorDom = editor.view.dom;
    editorDom.addEventListener(LATEX_RUN_FOCUS_EVENT, handleLatexRunFocus);
    return () => {
      editorDom.removeEventListener(LATEX_RUN_FOCUS_EVENT, handleLatexRunFocus);
    };
  }, [callbacksRef, editor]);

  useEffect(() => {
    if (!editor || !autoFocus) return;
    if (didAutoFocusRef.current) return;
    didAutoFocusRef.current = true;
    const timeout = window.setTimeout(() => {
      if (editor.isDestroyed) return;
      editor.commands.focus();
      emitSelection(editor);
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [autoFocus, editor, emitSelection]);

  useEffect(() => {
    if (typeof document === "undefined") return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (rootRef.current?.contains(target)) return;
      const targetElement =
        target instanceof Element ? target : target.parentElement;
      if (targetElement?.closest("[data-inline-edit-ignore='true']")) {
        toolbarPointerDownRef.current = true;
        if (toolbarPointerDownTimeoutRef.current != null) {
          window.clearTimeout(toolbarPointerDownTimeoutRef.current);
        }
        toolbarPointerDownTimeoutRef.current = window.setTimeout(() => {
          toolbarPointerDownRef.current = false;
          toolbarPointerDownTimeoutRef.current = null;
        }, 200);
        return;
      }
      toolbarPointerDownRef.current = false;
      if (toolbarPointerDownTimeoutRef.current != null) {
        window.clearTimeout(toolbarPointerDownTimeoutRef.current);
        toolbarPointerDownTimeoutRef.current = null;
      }
      flushPendingRuns();
      callbacksRef.current.onBlurOutside();
    };

    document.addEventListener("pointerdown", handlePointerDown, true);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
    };
  }, [callbacksRef, flushPendingRuns]);

  useEffect(() => {
    const commitBeforeExternalAction = () => {
      flushPendingRuns();
      callbacksRef.current.onBlurOutside();
    };

    window.addEventListener(
      COMMIT_TEMPLATE_V2_INLINE_TEXT_EVENT,
      commitBeforeExternalAction,
    );
    return () => {
      window.removeEventListener(
        COMMIT_TEMPLATE_V2_INLINE_TEXT_EVENT,
        commitBeforeExternalAction,
      );
    };
  }, [callbacksRef, flushPendingRuns]);

  useEffect(() => {
    return () => {
      if (pendingRunsFrameRef.current != null) {
        window.cancelAnimationFrame(pendingRunsFrameRef.current);
      }
      if (toolbarPointerDownTimeoutRef.current != null) {
        window.clearTimeout(toolbarPointerDownTimeoutRef.current);
      }
      pendingRunsFrameRef.current = null;
      pendingRunsEditorRef.current = null;
      toolbarPointerDownTimeoutRef.current = null;
    };
  }, []);

  return (
    <div
      ref={rootRef}
      data-inline-edit-ignore="true"
      onMouseDown={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
      style={editorStyle}
    >
      <EditorContent
        className={contentClassName}
        editor={editor}
        style={contentStyle}
      />
      <style>{TIPTAP_INLINE_EDITOR_CSS}</style>
    </div>
  );
}

function useLatestRef<T>(value: T) {
  const ref = useRef(value);
  useEffect(() => {
    ref.current = value;
  }, [value]);
  return ref;
}

function applyBeforeInput(
  view: Editor["view"],
  event: InputEvent,
  listMarker?: Marker | null,
) {
  if (event.isComposing || event.inputType === "insertCompositionText") {
    return false;
  }
  if (isManualDeleteInput(event.inputType)) {
    return applyDeleteBeforeInput(view, event.inputType);
  }
  if (event.inputType === "insertText") {
    const text = event.data;
    if (!text) return false;
    const { from, to } = view.state.selection;
    const transaction = view.state.tr
      .insertText(text, from, to)
      .scrollIntoView();
    view.dispatch(transaction);
    return true;
  }
  if (
    event.inputType === "insertLineBreak" ||
    event.inputType === "insertParagraph"
  ) {
    return applyLineBreakBeforeInput(view, listMarker);
  }
  return false;
}

function applyLineBreakBeforeInput(
  view: Editor["view"],
  listMarker?: Marker | null,
) {
  const hardBreak = view.state.schema.nodes.hardBreak;
  if (!hardBreak) return false;

  const markerPrefix = nextListMarkerPrefix(view, listMarker);
  const transaction = view.state.tr
    .replaceSelectionWith(hardBreak.create())
    .scrollIntoView();

  if (markerPrefix) {
    transaction.insertText(
      markerPrefix,
      transaction.selection.from,
      transaction.selection.to,
    );
  }

  view.dispatch(transaction);
  return true;
}

function nextListMarkerPrefix(
  view: Editor["view"],
  listMarker?: Marker | null,
) {
  if (!listMarker || listMarker === "none") return "";
  if (listMarker === "bullet") return "• ";

  const textBefore = view.state.doc.textBetween(
    0,
    view.state.selection.from,
    "\n",
    "\n",
  );
  const previousItemCount = textBefore
    .split("\n")
    .filter((line) => line.trim().length > 0).length;
  return `${previousItemCount + 1}. `;
}

function isManualDeleteInput(inputType: string) {
  return (
    inputType === "deleteContent" ||
    inputType === "deleteContentBackward" ||
    inputType === "deleteContentForward" ||
    inputType === "deleteWordBackward" ||
    inputType === "deleteWordForward"
  );
}

function applyDeleteBeforeInput(view: Editor["view"], inputType: string) {
  const { selection } = view.state;
  if (!selection.empty) {
    return dispatchManualDelete(view, selection.from, selection.to);
  }

  const isBackward =
    inputType === "deleteContent" || inputType.endsWith("Backward");
  const isForward = inputType.endsWith("Forward");
  const cursor = selection.$from;

  if (isBackward) {
    if (cursor.parentOffset <= 0) {
      return true;
    }
    return dispatchManualDelete(view, selection.from - 1, selection.from);
  }

  if (isForward) {
    if (cursor.parentOffset >= cursor.parent.content.size) {
      return true;
    }
    return dispatchManualDelete(view, selection.from, selection.from + 1);
  }

  return false;
}

function dispatchManualDelete(view: Editor["view"], from: number, to: number) {
  if (from === to) return true;
  const transaction = view.state.tr.delete(from, to).scrollIntoView();
  view.dispatch(transaction);
  return true;
}

function textRunsToTiptapContent(runs: TextRun[], baseFont: Font): JSONContent {
  const content: JSONContent[] = [];
  const sourceRuns = runs.length > 0 ? runs : [{ text: " ", font: baseFont }];

  for (const run of sourceRuns) {
    const font = normalizeFont(run.font, baseFont);
    if (isLatexTextRun(run)) {
      content.push({
        type: "latexRun",
        attrs: {
          latex: run.latex,
          displayMode: run.display_mode ?? false,
          font,
        },
      });
      continue;
    }
    const marks = [
      {
        type: "runStyle",
        attrs: fontToRunStyleAttrs(font),
      },
    ];
    const parts = (run.text || " ").split("\n");
    parts.forEach((part, index) => {
      if (index > 0) content.push({ type: "hardBreak" });
      if (part) {
        content.push({
          type: "text",
          text: encodeBoundarySpacesForEditor(part),
          marks,
        });
      }
    });
  }

  return {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: content.length > 0 ? content : [{ type: "text", text: " " }],
      },
    ],
  };
}

function tiptapContentToTextRuns(doc: JSONContent, baseFont: Font): TextRun[] {
  const runs: TextRun[] = [];
  let lastFont = baseFont;
  let hasParagraph = false;

  const append = (text: string, font: Font) => {
    if (!text) return;
    lastFont = font;
    runs.push({ text, font });
  };

  const visit = (node: JSONContent) => {
    if (node.type === "paragraph") {
      if (hasParagraph) append("\n", lastFont);
      hasParagraph = true;
      node.content?.forEach(visit);
      return;
    }
    if (node.type === "hardBreak") {
      append("\n", lastFont);
      return;
    }
    if (node.type === "text") {
      append(
        decodeEditorSpaces(node.text ?? ""),
        fontFromMarks(node.marks, baseFont),
      );
      return;
    }
    if (node.type === "latexRun") {
      const latex = typeof node.attrs?.latex === "string" ? node.attrs.latex : "";
      if (latex) {
        const font = normalizeFont(node.attrs?.font as Font | undefined, baseFont);
        lastFont = font;
        runs.push({
          type: "latex",
          latex,
          display_mode: node.attrs?.displayMode === true,
          font,
        });
      }
      return;
    }
    node.content?.forEach(visit);
  };

  doc.content?.forEach(visit);
  return mergeAdjacentTextRuns(runs);
}

function fontFromMarks(marks: JSONContent["marks"], baseFont: Font): Font {
  const runStyle = marks?.find((mark) => mark.type === "runStyle");
  const font = runStyle?.attrs
    ? fontFromRunStyleAttrs(runStyle.attrs as RunStyleAttrs, baseFont)
    : { ...baseFont };
  if (marks?.some((mark) => mark.type === "bold")) {
    font.bold = true;
  }
  if (marks?.some((mark) => mark.type === "italic")) {
    font.italic = true;
  }
  if (marks?.some((mark) => mark.type === "underline")) {
    font.underline = true;
  }
  return font;
}

function encodeBoundarySpacesForEditor(text: string) {
  let start = 0;
  while (start < text.length && text[start] === " ") start += 1;

  let end = text.length;
  while (end > start && text[end - 1] === " ") end -= 1;

  return (
    NON_BREAKING_SPACE.repeat(start) +
    text.slice(start, end) +
    NON_BREAKING_SPACE.repeat(text.length - end)
  );
}

function decodeEditorSpaces(text: string) {
  return text.replace(/\u00A0/g, " ");
}

function selectionRangeFromEditor(editor: Editor) {
  const { from, to } = editor.state.selection;
  return selectionRangeForPositions(editor.state.doc, from, to);
}

function selectionRangeForPositions(
  doc: ProseMirrorNode,
  from: number,
  to: number,
) {
  return {
    start: doc.textBetween(0, from, "\n", editorLeafText).length,
    end: doc.textBetween(0, to, "\n", editorLeafText).length,
  };
}

function editorLeafText(node: ProseMirrorNode) {
  if (node.type.name === "latexRun") return String(node.attrs.latex ?? "");
  if (node.type.name === "hardBreak") return "\n";
  return "";
}

function selectionRangeSignature(range: TextSelectionRange | null) {
  return range ? `${range.start}:${range.end}` : "none";
}

function textRunsSignature(runs: TextRun[]) {
  return JSON.stringify(runs);
}

function clampPosition(position: number, maxPosition: number) {
  return Math.min(maxPosition, Math.max(1, position));
}

function normalizeFont(font: TextRun["font"], baseFont: Font): Font {
  return {
    ...baseFont,
    ...(font ?? {}),
  };
}

function fontToRunStyleAttrs(font: Font): RunStyleAttrs {
  return {
    family: font.family,
    size: font.size,
    color: font.color,
    bold: font.bold,
    italic: font.italic,
    underline: font.underline,
    lineHeight: font.line_height,
    letterSpacing: font.letter_spacing,
    opacity: font.opacity,
  };
}

function fontFromRunStyleAttrs(attrs: RunStyleAttrs, baseFont: Font): Font {
  return {
    ...baseFont,
    family: attrs.family ?? baseFont.family,
    size: attrs.size ?? baseFont.size,
    color: attrs.color ?? baseFont.color,
    bold: attrs.bold ?? baseFont.bold,
    italic: attrs.italic ?? baseFont.italic,
    underline: attrs.underline ?? baseFont.underline,
    line_height: attrs.lineHeight ?? baseFont.line_height,
    letter_spacing: attrs.letterSpacing ?? baseFont.letter_spacing,
    opacity: attrs.opacity ?? baseFont.opacity,
  };
}

function runStyleAttrsToCss(attrs: RunStyleAttrs) {
  const styles = [
    attrs.family ? `font-family:${cssFontFamilyStack(attrs.family)}` : null,
    attrs.size != null ? `font-size:${attrs.size}px` : null,
    attrs.color ? `color:${cssColor(attrs.color)}` : null,
    attrs.bold != null ? `font-weight:${attrs.bold ? 700 : 400}` : null,
    attrs.italic != null
      ? `font-style:${attrs.italic ? "italic" : "normal"}`
      : null,
    attrs.underline != null
      ? `text-decoration:${attrs.underline ? "underline" : "none"}`
      : null,
    attrs.lineHeight != null ? `line-height:${attrs.lineHeight}` : null,
    attrs.letterSpacing != null ? `letter-spacing:${attrs.letterSpacing}px` : null,
    attrs.opacity != null ? `opacity:${attrs.opacity}` : null,
  ].filter(Boolean);
  return styles.join(";");
}

function tiptapEditorStyle(font: Font, runs: TextRun[]) {
  const rootLineHeight = rootLineHeightPx(font, runs);
  return [
    "outline:none",
    "width:100%",
    "height:100%",
    "min-height:100%",
    "box-sizing:border-box",
    "margin:0",
    "padding:0",
    "white-space:pre-wrap",
    "overflow-wrap:break-word",
    `font-family:${cssFontFamilyStack(font.family ?? "Arial")}`,
    `font-size:${font.size ?? 18}px`,
    `color:${cssColor(font.color ?? "111827")}`,
    "caret-color:currentColor",
    font.bold ? "font-weight:700" : "font-weight:400",
    font.italic ? "font-style:italic" : "font-style:normal",
    font.underline ? "text-decoration:underline" : "text-decoration:none",
    `line-height:${rootLineHeight}px`,
    `letter-spacing:${font.letter_spacing ?? 0}px`,
  ].join(";");
}

function rootLineHeightPx(baseFont: Font, runs: TextRun[]) {
  const sourceRuns = runs.length > 0 ? runs : [{ text: " ", font: baseFont }];
  return Math.max(
    1,
    ...sourceRuns.map((run) => {
      const font = normalizeFont(run.font, baseFont);
      return (font.size ?? baseFont.size ?? 18) * (font.line_height ?? 1.15);
    }),
  );
}

function cssColor(color: string) {
  return color.startsWith("#") ? color : `#${color}`;
}

const TIPTAP_INLINE_EDITOR_CSS = `
.template-v2-tiptap-inline-prosemirror p {
  line-height: inherit;
  margin: 0;
}
.template-v2-tiptap-inline-prosemirror * {
  box-sizing: border-box;
  caret-color: currentColor;
}
.template-v2-table-cell-editor-content {
  width: 100%;
}
.template-v2-table-cell-editor-content .template-v2-tiptap-inline-prosemirror {
  height: auto !important;
  min-height: 0 !important;
}
`;
