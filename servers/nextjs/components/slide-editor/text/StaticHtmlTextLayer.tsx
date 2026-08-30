"use client";

import {
  memo,
  useLayoutEffect,
  useMemo,
  useRef,
  type CSSProperties,
  type RefObject,
} from "react";
import type Konva from "konva";
import {
  ROOT_ELEMENTS_COMPONENT_INDEX,
  asRecord,
  childArrayInfo,
  keyForSelection,
  readArray,
  readNumber,
  readString,
  type ElementSelection,
  type RawElement,
  type RawUi,
} from "@/components/slide-editor/model/model";
import {
  fontToSource,
  rawFont,
  rawTextListRunsForEditor,
  rawTextRunsForEditor,
} from "@/components/slide-editor/text/template-v2-text";
import { isLatexTextRun } from "@/components/slide-editor/text/text-runs";
import { cssFontFamilyStack } from "@/components/slide-editor/text/css-text";
import type { Font, TextRun } from "@/components/slide-editor/types";
import { withHash } from "@/components/slide-editor/utils/color";
import { renderMathHtml } from "@/lib/math";
import {
  HTML_TEXT_HEIGHT_ATTR,
  HTML_TEXT_WIDTH_ATTR,
  shouldRenderTextElementAsHtml,
} from "@/components/slide-editor/text/html-text-attrs";

type HtmlTextDescriptor = {
  element: RawElement;
  key: string;
};

type StaticHtmlTextLayerProps = {
  editingKey: string | null;
  nodeRefs: RefObject<Map<string, Konva.Node>>;
  revision: number;
  ui: RawUi;
};

function StaticHtmlTextLayerComponent({
  editingKey,
  nodeRefs,
  revision,
  ui,
}: StaticHtmlTextLayerProps) {
  const elementRefs = useRef(new Map<string, HTMLDivElement>());
  const descriptors = useMemo(() => collectHtmlTextDescriptors(ui), [ui]);

  useLayoutEffect(() => {
    const syncTextElements = () => {
      descriptors.forEach(({ key }) => {
        const htmlElement = elementRefs.current.get(key);
        const konvaNode = nodeRefs.current?.get(key);
        if (!htmlElement || !konvaNode) {
          if (htmlElement) htmlElement.style.display = "none";
          return;
        }

        const matrix = konvaNode.getAbsoluteTransform().getMatrix();
        const width = readFiniteDimension(
          konvaNode.getAttr(HTML_TEXT_WIDTH_ATTR),
          konvaNode.width(),
        );
        const height = readFiniteDimension(
          konvaNode.getAttr(HTML_TEXT_HEIGHT_ATTR),
          konvaNode.height(),
        );
        htmlElement.style.display =
          editingKey === key || !konvaNode.isVisible() ? "none" : "flex";
        htmlElement.style.width = `${width}px`;
        htmlElement.style.height = `${height}px`;
        htmlElement.style.opacity = String(konvaNode.getAbsoluteOpacity());
        htmlElement.style.transform = `matrix(${matrix.join(",")})`;
      });
    };

    syncTextElements();
    const stage = Array.from(nodeRefs.current?.values() ?? [])
      .map((node) => node.getStage())
      .find(Boolean);
    if (!stage) return;

    const layers = stage.getLayers();
    stage.on(
      "dragmove.staticHtmlText transform.staticHtmlText",
      syncTextElements,
    );
    layers.forEach((layer) => {
      layer.on("draw.staticHtmlText", syncTextElements);
    });
    return () => {
      stage.off(
        "dragmove.staticHtmlText transform.staticHtmlText",
        syncTextElements,
      );
      layers.forEach((layer) => {
        layer.off("draw.staticHtmlText", syncTextElements);
      });
    };
  }, [descriptors, editingKey, nodeRefs, revision]);

  return (
    <div
      data-template-v2-html-text-layer="true"
      className="pointer-events-none absolute inset-0"
      style={{ zIndex: 5 }}
    >
      {descriptors.map(({ element, key }) => (
        <StaticHtmlTextElement
          key={key}
          element={element}
          hidden={editingKey === key}
          nodeRef={(node) => {
            if (node) elementRefs.current.set(key, node);
            else elementRefs.current.delete(key);
          }}
        />
      ))}
    </div>
  );
}

export const StaticHtmlTextLayer = memo(StaticHtmlTextLayerComponent);
StaticHtmlTextLayer.displayName = "StaticHtmlTextLayer";

function StaticHtmlTextElement({
  element,
  hidden,
  nodeRef,
}: {
  element: RawElement;
  hidden: boolean;
  nodeRef: (node: HTMLDivElement | null) => void;
}) {
  const type = readString(element.type);
  const baseFont = fontToSource(rawFont(element));
  const runs =
    type === "text-list"
      ? rawTextListRunsForEditor(element)
      : rawTextRunsForEditor(element);
  const alignment = asRecord(element.alignment);
  const horizontal = readString(alignment?.horizontal) ?? "left";
  const vertical = readString(alignment?.vertical) ?? "top";
  const rootLineHeight = rootLineHeightPx(baseFont, runs);

  return (
    <div
      ref={nodeRef}
      aria-hidden={hidden}
      data-template-v2-html-text="true"
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        display: hidden ? "none" : "flex",
        boxSizing: "border-box",
        minWidth: 0,
        transformOrigin: "0 0",
        flexDirection: "column",
        justifyContent:
          vertical === "middle"
            ? "center"
            : vertical === "bottom"
              ? "flex-end"
              : "flex-start",
        color: withHash(baseFont.color, "#111827"),
        fontFamily: cssFontFamilyStack(baseFont.family ?? "Arial"),
        fontSize: baseFont.size ?? 18,
        fontWeight: baseFont.bold ? 700 : 400,
        fontStyle: baseFont.italic ? "italic" : "normal",
        lineHeight: `${rootLineHeight}px`,
        letterSpacing: baseFont.letter_spacing ?? 0,
        textAlign: horizontal as CSSProperties["textAlign"],
        textDecoration: baseFont.underline ? "underline" : "none",
        textShadow: cssTextShadow(element),
        pointerEvents: "none",
        userSelect: "none",
      }}
    >
      <div
        style={{
          boxSizing: "border-box",
          margin: 0,
          minWidth: 0,
          width: "100%",
          whiteSpace: "pre-wrap",
          overflowWrap: "break-word",
        }}
      >
        {(runs.length > 0 ? runs : [{ text: " ", font: baseFont }]).map(
          (run, index) => (
            <StaticHtmlTextRun
              key={`${index}:${isLatexTextRun(run) ? run.latex : run.text}`}
              baseFont={baseFont}
              run={run}
            />
          ),
        )}
      </div>
    </div>
  );
}

function StaticHtmlTextRun({
  baseFont,
  run,
}: {
  baseFont: Font;
  run: TextRun;
}) {
  const font = { ...baseFont, ...(run.font ?? {}) };
  const style: CSSProperties = {
    color: withHash(font.color, "#111827"),
    fontFamily: cssFontFamilyStack(font.family ?? "Arial"),
    fontSize: font.size ?? 18,
    fontWeight: font.bold ? 700 : 400,
    fontStyle: font.italic ? "italic" : "normal",
    lineHeight: font.line_height ?? 1.15,
    letterSpacing: font.letter_spacing ?? 0,
    opacity: font.opacity ?? 1,
    textDecoration: font.underline ? "underline" : "none",
  };

  if (isLatexTextRun(run)) {
    return (
      <span
        className="presenton-math"
        style={{
          ...style,
          display: run.display_mode ? "block" : "inline-block",
          maxWidth: "100%",
          verticalAlign: "middle",
        }}
        dangerouslySetInnerHTML={{
          __html: renderMathHtml(run.latex, {
            displayMode: run.display_mode ?? false,
            output: "mathml",
          }),
        }}
      />
    );
  }

  return <span style={style}>{run.text}</span>;
}

function collectHtmlTextDescriptors(ui: RawUi): HtmlTextDescriptor[] {
  const descriptors: HtmlTextDescriptor[] = [];
  const collect = (
    elements: unknown[],
    componentIndex: number,
    parentPath: number[] = [],
  ) => {
    elements.forEach((value, index) => {
      const element = asRecord(value);
      if (!element) return;
      const elementPath = [...parentPath, index];
      const type = readString(element.type);
      if (
        (type === "text" || type === "text-list") &&
        shouldRenderTextElementAsHtml(element)
      ) {
        const selection: ElementSelection = {
          kind: "element",
          componentIndex,
          elementPath,
        };
        descriptors.push({ element, key: keyForSelection(selection) });
      }
      const childInfo = childArrayInfo(element);
      if (childInfo) collect(childInfo.items, componentIndex, elementPath);
    });
  };

  collect(readArray(ui.elements), ROOT_ELEMENTS_COMPONENT_INDEX);
  readArray(ui.components).forEach((value, componentIndex) => {
    const component = asRecord(value);
    if (component) collect(readArray(component.elements), componentIndex);
  });
  return descriptors;
}

function rootLineHeightPx(baseFont: Font, runs: TextRun[]) {
  const sourceRuns = runs.length > 0 ? runs : [{ text: " ", font: baseFont }];
  return Math.max(
    1,
    ...sourceRuns.map((run) => {
      const font = { ...baseFont, ...(run.font ?? {}) };
      return (font.size ?? 18) * (font.line_height ?? 1.15);
    }),
  );
}

function cssTextShadow(element: RawElement) {
  const shadow = asRecord(element.shadow);
  if (!shadow) return undefined;
  const opacity = Math.max(0, Math.min(1, readNumber(shadow.opacity) ?? 0.2));
  const color = withHash(readString(shadow.color), "#000000");
  const blur = Math.max(0, readNumber(shadow.blur) ?? 0);
  const offsetX = readNumber(shadow.offset_x) ?? readNumber(shadow.offsetX) ?? 0;
  const offsetY = readNumber(shadow.offset_y) ?? readNumber(shadow.offsetY) ?? 0;
  if (opacity <= 0 || (blur <= 0 && offsetX === 0 && offsetY === 0)) {
    return undefined;
  }
  return `${offsetX}px ${offsetY}px ${blur}px ${hexWithOpacity(color, opacity)}`;
}

function hexWithOpacity(color: string, opacity: number) {
  const hex = color.replace(/^#/, "");
  if (!/^[0-9a-f]{6}$/i.test(hex)) return color;
  const red = Number.parseInt(hex.slice(0, 2), 16);
  const green = Number.parseInt(hex.slice(2, 4), 16);
  const blue = Number.parseInt(hex.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${opacity})`;
}

function readFiniteDimension(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : Math.max(1, fallback);
}
