"use client";

import { useCallback, useEffect, useRef } from "react";
import type { Box } from "@/components/slide-editor/model/model";
import type { InfographicCanvasTextStyle } from "@/components/slide-editor/infographics/infographic-canvas-target";

export function InfographicPlainTextEditor({
  box,
  value,
  onCancel,
  onCommit,
  textStyle,
}: {
  box: Box;
  value: string;
  onCancel: () => void;
  onCommit: (value: string) => void;
  textStyle?: InfographicCanvasTextStyle;
}) {
  const frameRef = useRef<HTMLDivElement | null>(null);
  const editorRef = useRef<HTMLDivElement | null>(null);
  const cancelledRef = useRef(false);
  const committedRef = useRef(false);
  const draftRef = useRef(value);

  const commit = useCallback(() => {
    if (cancelledRef.current || committedRef.current) return;
    committedRef.current = true;
    onCommit(draftRef.current);
  }, [onCommit]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(editor);
    selection?.removeAllRanges();
    selection?.addRange(range);
  }, []);

  useEffect(() => {
    const commitBeforeOutsideInteraction = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Node && frameRef.current?.contains(target)) return;
      commit();
    };
    document.addEventListener("pointerdown", commitBeforeOutsideInteraction, true);
    return () =>
      document.removeEventListener(
        "pointerdown",
        commitBeforeOutsideInteraction,
        true,
      );
  }, [commit]);

  const justifyContent =
    textStyle?.verticalAlign === "middle"
      ? "center"
      : textStyle?.verticalAlign === "bottom"
        ? "flex-end"
        : "flex-start";

  return (
    <div
      ref={frameRef}
      data-inline-edit-ignore="true"
      onMouseDown={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
      style={{
        position: "absolute",
        zIndex: 35,
        left: box.x,
        top: box.y,
        width: box.width,
        height: box.height,
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        justifyContent,
        overflow: "visible",
        outline: "1px solid #7C51F8",
        outlineOffset: 2,
        background: "transparent",
        pointerEvents: "auto",
      }}
    >
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-label="Edit infographic text"
        aria-multiline="true"
        data-inline-edit-ignore="true"
        onBlur={commit}
        onInput={(event) => {
          draftRef.current = event.currentTarget.innerText.replace(
            /\r\n?/g,
            "\n",
          );
        }}
        onMouseDown={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            cancelledRef.current = true;
            onCancel();
          } else if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
            event.preventDefault();
            commit();
          }
        }}
        style={{
          width: "100%",
          minWidth: 0,
          margin: 0,
          padding: 0,
          border: 0,
          outline: "none",
          background: "transparent",
          whiteSpace: "pre-wrap",
          overflowWrap: "break-word",
          wordBreak: "normal",
          color: textStyle?.color ?? "#111111",
          caretColor: textStyle?.color ?? "#111111",
          fontFamily: textStyle?.fontFamily ?? "Arial, Helvetica, sans-serif",
          fontSize: textStyle?.fontSize ?? 12,
          fontStyle: textStyle?.fontStyle ?? "normal",
          fontWeight: textStyle?.fontWeight ?? 400,
          lineHeight: textStyle?.lineHeight ?? 1.2,
          textAlign: textStyle?.textAlign ?? "left",
        }}
      >
        {value}
      </div>
    </div>
  );
}
