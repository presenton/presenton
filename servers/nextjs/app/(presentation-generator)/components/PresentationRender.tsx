import React, { useEffect, useMemo, useRef, useState } from "react";

import { V1ContentRender } from "../../(presentation-generator)/components/V1ContentRender";

const BASE_WIDTH = 1280;
const BASE_HEIGHT = 720;

const SlideScale = ({
  slide,
  presentationId,
  theme,
  fonts,
  isEditMode = true,

  /** Fill viewport; scale may exceed 1 so slides appear larger in present mode */
  presentMode = false,
  isClickable = true,
  fixedSize = false,
  presentationLayout,
  renderIndex,
  enableViewportCulling = false,
  isSelected = false,
  showBlankPromptOverlay = false,
  onBlankPromptOverlayDismiss,
  showTemplatePromptOverlay = false,
  onTemplatePromptOverlayDismiss,
}: {
  slide: any;
  presentationId?: string;
  theme?: any;
  fonts?: unknown;
  isEditMode?: boolean;

  presentMode?: boolean;
  isClickable?: boolean;
  fixedSize?: boolean;
  presentationLayout?: unknown;
  renderIndex?: number;
  enableViewportCulling?: boolean;
  isSelected?: boolean;
  showBlankPromptOverlay?: boolean;
  onBlankPromptOverlayDismiss?: () => void;
  showTemplatePromptOverlay?: boolean;
  onTemplatePromptOverlayDismiss?: () => void;
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });

  const scale = useMemo(() => {
    if (fixedSize) return 1;
    if (presentMode) {
      if (box.w < 1 || box.h < 1) return 1;
      const sx = box.w / BASE_WIDTH;
      const sy = box.h / BASE_HEIGHT;
      return Math.min(sx, sy);
    }
    const safeWidth = Math.max(0, box.w + 20);
    if (!safeWidth) return 1;
    return Math.min((safeWidth / BASE_WIDTH) * 0.98, 1);
  }, [fixedSize, presentMode, box.w, box.h]);

  useEffect(() => {
    if (!containerRef.current) return;

    const el = containerRef.current;
    const ro = new ResizeObserver(() => {
      setBox({ w: el.clientWidth, h: el.clientHeight });
    });

    ro.observe(el);
    setBox({ w: el.clientWidth, h: el.clientHeight });

    return () => ro.disconnect();
  }, []);
  return (
    <div
      ref={containerRef}
      className={
        fixedSize
          ? "relative h-[720px] w-[1280px] overflow-hidden shadow-none"
          : `relative w-full ${
              presentMode
                ? "flex h-full min-h-0 items-center justify-center shadow-none"
                : "shadow-md"
            }`
      }
    >
      <div
        className={
          presentMode || fixedSize
            ? "relative mx-auto shrink-0"
            : "relative mx-auto max-w-[1280px]"
        }
        style={{
          width: `${BASE_WIDTH * scale}px`,
          height: `${BASE_HEIGHT * scale}px`,
          overflow: presentMode ? "visible" : "hidden",
        }}
      >
        <div
          className="absolute top-0 left-0"
          style={{
            width: BASE_WIDTH,
            height: BASE_HEIGHT,
            transformOrigin: "top left",
            transform: `scale(${scale})`,
          }}
        >
          <div
            className="slide-edit-stage relative w-full h-full select-none"
            data-testid="slide-content"
            style={
              {
                userSelect: "none",
                WebkitUserSelect: "none",
                MozUserSelect: "none",
                msUserSelect: "none",
              } as React.CSSProperties
            }
          >
            {!isClickable && (
              <div
                className="absolute inset-0 bg-transparent z-30 w-full h-full  select-none"
                aria-hidden="true"
              />
            )}
            <V1ContentRender
              slide={slide}
              presentationId={presentationId}
              isEditMode={isEditMode}
              theme={theme}
              fonts={fonts}
              presentationLayout={presentationLayout}
              renderIndex={renderIndex}
              displayScale={scale}
              enableViewportCulling={enableViewportCulling}
              isSelected={isSelected}
              showBlankPromptOverlay={showBlankPromptOverlay}
              onBlankPromptOverlayDismiss={onBlankPromptOverlayDismiss}
              showTemplatePromptOverlay={showTemplatePromptOverlay}
              onTemplatePromptOverlayDismiss={onTemplatePromptOverlayDismiss}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default SlideScale;
