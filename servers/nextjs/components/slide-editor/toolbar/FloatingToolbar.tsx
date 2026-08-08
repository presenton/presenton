"use client";

import {
  createContext,
  forwardRef,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type HTMLAttributes,
  type MutableRefObject,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import {
  EDITOR_STAGE_HEIGHT,
  EDITOR_STAGE_WIDTH,
} from "@/components/slide-editor/types";

export type FloatingToolbarBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type FloatingBounds = {
  bottom: number;
  left: number;
  right: number;
  top: number;
};

type FloatingToolbarProps = {
  anchorBox?: FloatingToolbarBox | null;
  children: ReactNode;
  className?: string;
  fallbackHeight?: number;
  fallbackWidth?: number;
  inlineEditIgnore?: boolean;
  margin?: number;
  panelGap?: number;
  style?: CSSProperties;
};

type FloatingToolbarPanelProps = HTMLAttributes<HTMLDivElement> & {
  gap?: number;
  margin?: number;
};

const DEFAULT_TOOLBAR_HEIGHT = 40;
const DEFAULT_TOOLBAR_WIDTH = 420;
const DEFAULT_GAP = 8;
const DEFAULT_MARGIN = 8;

const FloatingToolbarBoundsContext = createContext<FloatingBounds | null>(null);

export function FloatingToolbarBoundsProvider({
  bounds,
  children,
}: {
  bounds: FloatingBounds | null;
  children: ReactNode;
}) {
  return (
    <FloatingToolbarBoundsContext.Provider value={bounds}>
      {children}
    </FloatingToolbarBoundsContext.Provider>
  );
}

export function FloatingToolbar({
  anchorBox,
  children,
  className,
  fallbackHeight = DEFAULT_TOOLBAR_HEIGHT,
  fallbackWidth = DEFAULT_TOOLBAR_WIDTH,
  inlineEditIgnore,
  margin = DEFAULT_MARGIN,
  panelGap = DEFAULT_GAP,
  style,
}: FloatingToolbarProps) {
  const anchorRef = useRef<HTMLSpanElement | null>(null);
  const toolbarRef = useRef<HTMLDivElement | null>(null);
  const [mounted, setMounted] = useState(false);
  const [toolbarSize, setToolbarSize] = useState({
    height: fallbackHeight,
    width: fallbackWidth,
  });
  const [rootRect, setRootRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useLayoutEffect(() => {
    if (!mounted || typeof window === "undefined") return;
    const anchor = anchorRef.current;
    const root = anchor?.closest<HTMLElement>("[data-template-v2-konva-surface]");

    const updateMeasurements = () => {
      const toolbar = toolbarRef.current;
      if (toolbar) {
        const rect = toolbar.getBoundingClientRect();
        setToolbarSize({
          height: rect.height > 0 ? rect.height : fallbackHeight,
          width: rect.width > 0 ? rect.width : fallbackWidth,
        });
      }
      setRootRect(root?.getBoundingClientRect() ?? null);
    };

    updateMeasurements();
    const resizeObserver =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(updateMeasurements);
    if (resizeObserver) {
      if (root) resizeObserver.observe(root);
      if (toolbarRef.current) resizeObserver.observe(toolbarRef.current);
    }
    window.addEventListener("resize", updateMeasurements);
    window.addEventListener("scroll", updateMeasurements, true);
    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener("resize", updateMeasurements);
      window.removeEventListener("scroll", updateMeasurements, true);
    };
  }, [fallbackHeight, fallbackWidth, mounted]);

  const bounds = useMemo(() => boundsFromRect(rootRect), [rootRect]);
  const position = useMemo(
    () =>
      toolbarPosition({
        anchorBox,
        bounds,
        fallbackHeight,
        fallbackWidth,
        margin,
        panelGap,
        rootRect,
        toolbarHeight: toolbarSize.height,
        toolbarWidth: toolbarSize.width,
      }),
    [
      anchorBox,
      bounds,
      fallbackHeight,
      fallbackWidth,
      margin,
      panelGap,
      rootRect,
      toolbarSize.height,
      toolbarSize.width,
    ],
  );

  const toolbar = (
    <FloatingToolbarBoundsProvider bounds={bounds}>
      <div
        ref={toolbarRef}
        data-inline-edit-ignore={inlineEditIgnore ? "true" : undefined}
        data-template-v2-floating-toolbar="true"
        className={className}
        style={{
          ...style,
          position: "fixed",
          zIndex: 10000,
          left: position.left,
          top: position.top,
          visibility: position.visible ? "visible" : "hidden",
        }}
        onMouseDown={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
      >
        {children}
      </div>
    </FloatingToolbarBoundsProvider>
  );

  return (
    <>
      <span ref={anchorRef} data-inline-edit-ignore="true" />
      {mounted ? createPortal(toolbar, document.body) : null}
    </>
  );
}

export const FloatingToolbarPanel = forwardRef<
  HTMLDivElement,
  FloatingToolbarPanelProps
>(function FloatingToolbarPanel(
  {
    children,
    className,
    gap = DEFAULT_GAP,
    margin = DEFAULT_MARGIN,
    style,
    ...props
  },
  forwardedRef,
) {
  const localRef = useRef<HTMLDivElement | null>(null);
  const bounds = useContext(FloatingToolbarBoundsContext);
  const [position, setPosition] = useState<CSSProperties | null>(null);

  const setRef = (node: HTMLDivElement | null) => {
    localRef.current = node;
    if (typeof forwardedRef === "function") {
      forwardedRef(node);
    } else if (forwardedRef) {
      (forwardedRef as MutableRefObject<HTMLDivElement | null>).current = node;
    }
  };

  useLayoutEffect(() => {
    if (typeof window === "undefined") return;
    const panel = localRef.current;
    const anchor = panel?.parentElement;
    if (!panel || !anchor) return;

    const updatePosition = () => {
      const panelRect = panel.getBoundingClientRect();
      const anchorRect = anchor.getBoundingClientRect();
      const boundary = bounds ?? viewportBounds();
      const minLeft = boundary.left + margin;
      const maxLeft = Math.max(minLeft, boundary.right - panelRect.width - margin);
      const desiredLeft =
        anchorRect.left + anchorRect.width / 2 - panelRect.width / 2;
      const left = clamp(desiredLeft, minLeft, maxLeft) - anchorRect.left;

      const belowTop = anchorRect.height + gap;
      const viewportBelowTop = anchorRect.bottom + gap;
      const viewportAboveTop = anchorRect.top - panelRect.height - gap;
      const canFitBelow =
        viewportBelowTop + panelRect.height <= boundary.bottom - margin;
      const canFitAbove = viewportAboveTop >= boundary.top + margin;
      const top = !canFitBelow && canFitAbove
        ? -panelRect.height - gap
        : belowTop;

      setPosition({
        left,
        right: "auto",
        top,
        transform: "none",
      });
    };

    updatePosition();
    const resizeObserver =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(updatePosition);
    resizeObserver?.observe(anchor);
    resizeObserver?.observe(panel);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [bounds, gap, margin]);

  return (
    <div
      {...props}
      ref={setRef}
      className={className}
      data-inline-edit-ignore="true"
      data-template-v2-floating-toolbar="true"
      style={{
        ...style,
        position: "absolute",
        zIndex: 10001,
        ...(position ?? {
          left: "50%",
          top: `calc(100% + ${gap}px)`,
          transform: "translateX(-50%)",
        }),
      }}
    >
      {children}
    </div>
  );
});

function toolbarPosition({
  anchorBox,
  bounds,
  fallbackHeight,
  fallbackWidth,
  margin,
  panelGap,
  rootRect,
  toolbarHeight,
  toolbarWidth,
}: {
  anchorBox?: FloatingToolbarBox | null;
  bounds: FloatingBounds | null;
  fallbackHeight: number;
  fallbackWidth: number;
  margin: number;
  panelGap: number;
  rootRect: DOMRect | null;
  toolbarHeight: number;
  toolbarWidth: number;
}) {
  const boundary = bounds ?? viewportBounds();
  const safeWidth = toolbarWidth > 0 ? toolbarWidth : fallbackWidth;
  const safeHeight = toolbarHeight > 0 ? toolbarHeight : fallbackHeight;
  const viewportAnchor = viewportAnchorBox(anchorBox, rootRect);
  if (!viewportAnchor) {
    return {
      left: boundary.left + margin,
      top: boundary.top + margin,
      visible: false,
    };
  }

  const minLeft = boundary.left + margin;
  const maxLeft = Math.max(minLeft, boundary.right - safeWidth - margin);
  const minTop = boundary.top + margin;
  const maxTop = Math.max(minTop, boundary.bottom - safeHeight - margin);
  const canFitAbove =
    viewportAnchor.y - boundary.top >= safeHeight + panelGap + margin;
  const top = canFitAbove
    ? viewportAnchor.y - safeHeight - panelGap
    : viewportAnchor.y + viewportAnchor.height + panelGap;

  return {
    left: clamp(viewportAnchor.x, minLeft, maxLeft),
    top: clamp(top, minTop, maxTop),
    visible: true,
  };
}

function viewportAnchorBox(
  anchorBox: FloatingToolbarBox | null | undefined,
  rootRect: DOMRect | null,
) {
  if (!anchorBox) return null;
  if (!rootRect) return anchorBox;
  const scaleX = rootRect.width > 0 ? rootRect.width / EDITOR_STAGE_WIDTH : 1;
  const scaleY = rootRect.height > 0 ? rootRect.height / EDITOR_STAGE_HEIGHT : 1;
  return {
    x: rootRect.left + anchorBox.x * scaleX,
    y: rootRect.top + anchorBox.y * scaleY,
    width: anchorBox.width * scaleX,
    height: anchorBox.height * scaleY,
  };
}

function boundsFromRect(rect: DOMRect | null): FloatingBounds | null {
  return rect
    ? {
        bottom: rect.bottom,
        left: rect.left,
        right: rect.right,
        top: rect.top,
      }
    : null;
}

function viewportBounds(): FloatingBounds {
  if (typeof window === "undefined") {
    return {
      bottom: EDITOR_STAGE_HEIGHT,
      left: 0,
      right: EDITOR_STAGE_WIDTH,
      top: 0,
    };
  }
  return {
    bottom: window.innerHeight,
    left: 0,
    right: window.innerWidth,
    top: 0,
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(value, max));
}
