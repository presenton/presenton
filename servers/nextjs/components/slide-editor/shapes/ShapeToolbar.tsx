import { useEffect, useState, type ReactNode } from "react";
import {
  Circle,
  Cloud,
  Scan,
  Spline,
  Square,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { withHash } from "@/components/slide-editor/utils/color";
import { elementBox } from "@/components/slide-editor/model/element-model";
import type { ShapeSlideElement } from "@/components/slide-editor/state/state";
import type {
  VectorCurve,
  VectorElement,
} from "@/components/slide-editor/types";
import { DeferredColorInput } from "@/components/slide-editor/toolbar/DeferredColorInput";
import {
  FloatingToolbar,
  FloatingToolbarPanel,
  type FloatingToolbarBox,
} from "@/components/slide-editor/toolbar/FloatingToolbar";
import { OpacitySwatchIcon } from "@/components/slide-editor/toolbar/OpacitySwatchIcon";
import {
  ComponentActionsMenu,
  ComponentUngroupButton,
  type ComponentActionsMenuActions,
} from "@/components/slide-editor/selection/ComponentActionsMenu";
import {
  numericInputMode,
  preventInvalidNumberInput,
  sanitizeNumericInput,
} from "@/components/slide-editor/toolbar/numericInput";

type ShapePanel =
  | "fill"
  | "stroke"
  | "radius"
  | "vector"
  | "shadow"
  | "opacity"
  | null;

const DEFAULT_SHAPE_SHADOW = {
  color: "#000000",
  blur: 10,
  opacity: 0.18,
  offset_x: 6,
  offset_y: 6,
};
const DEFAULT_SHAPE_FILL = { color: "#FFFFFF", opacity: 1 };
const DEFAULT_SHAPE_STROKE = {
  color: "#1A1A1A",
  opacity: 1,
  width: 1.5,
};

type ShadowValue = {
  color?: string | null;
  blur?: number | null;
  opacity?: number | null;
  offset_x?: number | null;
  offset_y?: number | null;
};
type ShadowFallback = {
  color: string;
  blur: number;
  opacity: number;
  offset_x: number;
  offset_y: number;
};

type CurveMode = "none" | "smooth";

export function ShapeToolbar({
  anchorBox,
  element,
  index,
  scale,
  componentActions,
  onChange,
}: {
  anchorBox?: FloatingToolbarBox | null;
  element: ShapeSlideElement;
  index: number;
  scale: number;
  componentActions?: ComponentActionsMenuActions | null;
  onChange: (index: number, element: ShapeSlideElement) => void;
}) {
  const [openPanel, setOpenPanel] = useState<ShapePanel>(null);
  const rawBox = elementBox(element);
  const box = anchorBox
    ? {
        x: anchorBox.x / scale,
        y: anchorBox.y / scale,
        w: anchorBox.width / scale,
        h: anchorBox.height / scale,
      }
    : rawBox;
  const fill = element.fill ?? DEFAULT_SHAPE_FILL;
  const stroke = element.stroke
    ? { ...DEFAULT_SHAPE_STROKE, ...element.stroke }
    : DEFAULT_SHAPE_STROKE;
  const shadow = element.shadow ?? DEFAULT_SHAPE_SHADOW;
  const fillEnabled = element.fill != null;
  const strokeEnabled = element.stroke != null && stroke.width > 0;
  const shadowEnabled = element.shadow != null;
  const vectorElement = element;
  const vectorShape = vectorElement.shape === "ellipse" ? "ellipse" : "polygon";
  const canRoundCorners =
    vectorShape === "polygon" &&
    element.closed !== false &&
    element.points.length === 4;
  const maxRadius = Math.max(
    1,
    Math.min(128, box.w / 2, box.h / 2),
  );
  const radius = Math.min(maxRadius, averageCornerRadii(element.corner_radii));
  const vectorClosed = vectorShape === "ellipse" || vectorElement.closed !== false;
  const vectorCurveMode = curveMode(vectorElement.curve);
  const vectorSegments = normalizedSegments(vectorElement.curve?.segments);
  const vectorTension = normalizedTension(vectorElement.curve?.tension);
  const vectorCornerRadii = cornerRadiiForVector(vectorElement);

  const update = (changes: Partial<ShapeSlideElement>) => {
    onChange(index, { ...element, ...changes } as ShapeSlideElement);
  };

  const setFillEnabled = (enabled: boolean) => {
    if (enabled) {
      update({ fill });
      return;
    }
    update({ fill: null });
  };

  const setStrokeEnabled = (enabled: boolean) => {
    if (enabled) {
      update({
        stroke: {
          ...stroke,
          width: Math.max(stroke.width ?? 0, DEFAULT_SHAPE_STROKE.width),
        },
      });
      return;
    }
    update({ stroke: null });
  };

  const setShadowEnabled = (enabled: boolean) => {
    if (enabled) {
      update({ shadow });
      return;
    }
    update({ shadow: null });
  };

  const updateVector = (changes: Partial<VectorElement>) => {
    if (!vectorElement) return;
    onChange(index, { ...vectorElement, ...changes } as ShapeSlideElement);
  };

  const togglePanel = (panel: Exclude<ShapePanel, null>) => {
    setOpenPanel((current) => (current === panel ? null : panel));
  };

  useEffect(() => {
    if (!openPanel || typeof document === "undefined") return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (
        target instanceof Element &&
        target.closest("[data-template-v2-floating-toolbar='true']")
      ) {
        return;
      }
      setOpenPanel(null);
    };

    document.addEventListener("pointerdown", handlePointerDown, true);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
    };
  }, [openPanel]);

  const setCurveMode = (mode: CurveMode) => {
    if (!vectorElement) return;
    updateVector({ curve: curveForMode(vectorElement, mode) });
  };
  const updateCurve = (changes: Partial<VectorCurve>) => {
    if (!vectorElement) return;
    const current = curveForMode(vectorElement, vectorCurveMode);
    if (!current) return;
    updateVector({ curve: { ...current, ...changes } });
  };
  const updateCornerRadius = (cornerIndex: number, value: number) => {
    if (!vectorElement) return;
    const radii = cornerRadiiForVector(vectorElement);
    radii[cornerIndex] = value;
    updateVector({ corner_radii: radii });
  };
  const updateVectorShape = (shape: "polygon" | "ellipse") => {
    if (!vectorElement) return;
    updateVector(
      shape === "ellipse"
        ? { shape, closed: true, curve: null, corner_radii: null }
        : { shape },
    );
  };

  return (
    <FloatingToolbar
      anchorBox={
        anchorBox ?? {
          x: box.x * scale,
          y: box.y * scale,
          width: box.w * scale,
          height: box.h * scale,
        }
      }
      fallbackWidth={380}
      inlineEditIgnore
      className="inline-flex items-center gap-3 rounded-[6px] bg-white px-[10px] py-[6px] text-[#191919] shadow-[0_0_4px_rgba(0,0,0,0.15)]"
    >
      <div className="relative">
        <button
          type="button"
          aria-label="Shape fill"
          aria-expanded={openPanel === "fill"}
          title="Shape fill"
          onClick={() => togglePanel("fill")}
          className={cn(
            "grid h-[22px] w-[22px] place-items-center rounded-[999px] border border-[#D7DAE3] hover:bg-[#F8F8FA]",
            (openPanel === "fill" || fillEnabled) &&
              "border-[#E4D7FF] bg-[#F4F1FF] ring-2 ring-[#7C3AED]/30",
          )}
        >
          <span
            aria-hidden="true"
            className="h-3 w-3 rounded-full border border-black/10"
            style={{
              backgroundColor: fillEnabled ? withHash(fill.color) : "#FFFFFF",
            }}
          />
        </button>
        {openPanel === "fill" ? (
          <Panel className="w-[220px] space-y-3 p-3">
            <ToggleRow
              label="Fill"
              enabled={fillEnabled}
              onToggle={() => setFillEnabled(!fillEnabled)}
            />
            {fillEnabled ? (
              <>
                <ColorField
                  label="Fill color"
                  color={fill.color}
                  onCommit={(color) => update({ fill: { ...fill, color } })}
                />
                <SliderField
                  label="Fill opacity"
                  value={fill.opacity ?? 1}
                  min={0}
                  max={1}
                  step={0.01}
                  formatValue={(value) => `${Math.round(value * 100)}%`}
                  onCommit={(opacity) =>
                    update({ fill: { ...fill, opacity } })
                  }
                />
              </>
            ) : null}
          </Panel>
        ) : null}
      </div>

      <div className="relative">
        <ToolbarButton
          title="Shape border"
          pressed={openPanel === "stroke" || strokeEnabled}
          onClick={() => togglePanel("stroke")}
        >
          <LineWidthIcon />
        </ToolbarButton>
        {openPanel === "stroke" ? (
          <Panel className="w-[220px] space-y-3 p-3">
            <ToggleRow
              label="Stroke"
              enabled={strokeEnabled}
              onToggle={() => setStrokeEnabled(!strokeEnabled)}
            />
            {strokeEnabled ? (
              <>
                <ColorField
                  label="Border color"
                  color={stroke.color}
                  onCommit={(color) => update({ stroke: { ...stroke, color } })}
                />
                <SliderField
                  label="Border width"
                  value={stroke.width ?? DEFAULT_SHAPE_STROKE.width}
                  min={0}
                  max={16}
                  step={0.5}
                  formatValue={(value) => `${formatNumber(value)}pt`}
                  onCommit={(width) => update({ stroke: { ...stroke, width } })}
                />
                <SliderField
                  label="Border opacity"
                  value={stroke.opacity ?? 1}
                  min={0}
                  max={1}
                  step={0.01}
                  formatValue={(value) => `${Math.round(value * 100)}%`}
                  onCommit={(opacity) =>
                    update({ stroke: { ...stroke, opacity } })
                  }
                />
              </>
            ) : null}
          </Panel>
        ) : null}
      </div>

      {canRoundCorners ? (
        <div className="relative">
          <ToolbarButton
            title="Border radius"
            pressed={openPanel === "radius"}
            onClick={() => togglePanel("radius")}
          >
            <Scan size={16} aria-hidden="true" />
          </ToolbarButton>
          {openPanel === "radius" ? (
            <Panel className="w-[252px] space-y-3 p-3">
              <SliderField
                label="Border radius"
                value={radius}
                min={0}
                max={maxRadius}
                step={Math.max(0.001, maxRadius / 100)}
                formatValue={(value) => formatNumber(value)}
                onCommit={(value) =>
                  update({ corner_radii: [value, value, value, value] })
                }
              />
              {vectorElement && vectorCornerRadii.length === 4 ? (
                <div className="grid grid-cols-2 gap-2">
                  {["TL", "TR", "BR", "BL"].map((label, cornerIndex) => (
                    <NumberField
                      key={label}
                      label={label}
                      value={vectorCornerRadii[cornerIndex] ?? 0}
                      min={0}
                      max={maxRadius}
                      step={1}
                      onCommit={(value) => updateCornerRadius(cornerIndex, value)}
                    />
                  ))}
                </div>
              ) : null}
            </Panel>
          ) : null}
        </div>
      ) : null}

      <div className="relative">
        <ToolbarButton
          title="Vector path"
          pressed={openPanel === "vector"}
          onClick={() => togglePanel("vector")}
        >
          <Spline size={16} aria-hidden="true" />
        </ToolbarButton>
        {openPanel === "vector" ? (
          <Panel className="w-[300px] space-y-4 p-3">
              <div className="grid grid-cols-2 gap-1 rounded-md bg-[#F6F6F9] p-1">
                {(["polygon", "ellipse"] as const).map((shape) => (
                  <button
                    key={shape}
                    type="button"
                    aria-pressed={vectorShape === shape}
                    onClick={() => updateVectorShape(shape)}
                    className={cn(
                      "flex h-8 items-center justify-center gap-1 rounded-[4px] text-xs capitalize text-[#4B5563] hover:bg-white",
                      vectorShape === shape &&
                        "bg-white text-[#7A5AF8] shadow-sm",
                    )}
                  >
                    {shape === "polygon" ? (
                      <Square size={14} aria-hidden="true" />
                    ) : (
                      <Circle size={14} aria-hidden="true" />
                    )}
                    {shape}
                  </button>
                ))}
              </div>

              {vectorShape === "polygon" ? (
                <>
                  <button
                    type="button"
                    aria-pressed={vectorClosed}
                    onClick={() => updateVector({ closed: !vectorClosed })}
                    className="flex w-full items-center justify-between rounded-md border border-[#EDEEEF] px-3 py-2 text-left text-xs text-[#4B5563] hover:bg-[#F8F8FA]"
                  >
                    <span className="font-medium text-[#191919]">Closed path</span>
                    <span className="flex items-center gap-1 text-[#7A5AF8]">
                      {vectorClosed ? (
                        <ToggleRight size={17} aria-hidden="true" />
                      ) : (
                        <ToggleLeft size={17} aria-hidden="true" />
                      )}
                      {vectorClosed ? "On" : "Off"}
                    </span>
                  </button>

                  <div className="space-y-2">
                    <div className="text-[12px] font-medium text-[#4B5563]">
                      Curve
                    </div>
                    <div className="grid grid-cols-2 gap-1 rounded-md bg-[#F6F6F9] p-1">
                      {(["none", "smooth"] as const).map((mode) => (
                        <button
                          key={mode}
                          type="button"
                          aria-pressed={vectorCurveMode === mode}
                          onClick={() => setCurveMode(mode)}
                          className={cn(
                            "h-8 rounded-[4px] text-xs capitalize text-[#4B5563] hover:bg-white",
                            vectorCurveMode === mode &&
                              "bg-white text-[#7A5AF8] shadow-sm",
                          )}
                        >
                          {mode === "none" ? "Straight" : mode}
                        </button>
                      ))}
                    </div>
                  </div>

                  {vectorCurveMode === "smooth" ? (
                    <div className="space-y-3">
                      <SliderField
                        label="Tension"
                        value={vectorTension}
                        min={0}
                        max={1}
                        step={0.01}
                        formatValue={(value) => formatNumber(value)}
                        onCommit={(tension) => updateCurve({ tension })}
                      />
                      <SliderField
                        label="Smoothness"
                        value={vectorSegments}
                        min={1}
                        max={96}
                        step={1}
                        formatValue={(value) => `${Math.round(value)}`}
                        onCommit={(segments) =>
                          updateCurve({ segments: Math.round(segments) })
                        }
                      />
                    </div>
                  ) : null}
                </>
              ) : null}

          </Panel>
        ) : null}
      </div>

      <Divider />

      <div className="relative">
        <ToolbarButton
          title="Shape shadow"
          pressed={openPanel === "shadow" || shadowEnabled}
          onClick={() => togglePanel("shadow")}
        >
          <Cloud size={16} strokeWidth={1.7} aria-hidden="true" />
        </ToolbarButton>
        {openPanel === "shadow" ? (
          <ShadowPanel
            enabled={shadowEnabled}
            fallback={DEFAULT_SHAPE_SHADOW}
            shadow={shadow}
            onToggle={() => setShadowEnabled(!shadowEnabled)}
            onChange={(changes) => update({ shadow: { ...shadow, ...changes } })}
          />
        ) : null}
      </div>

      <div className="relative">
        <ToolbarButton
          title="Shape opacity"
          pressed={openPanel === "opacity"}
          onClick={() => togglePanel("opacity")}
        >
          <OpacitySwatchIcon />
        </ToolbarButton>
        {openPanel === "opacity" ? (
          <Panel className="left-auto right-0 w-[220px] translate-x-0 p-3">
            <SliderField
              label="Shape opacity"
              value={element.opacity ?? 1}
              min={0}
              max={1}
              step={0.01}
              formatValue={(value) => `${Math.round(value * 100)}%`}
              onCommit={(opacity) => update({ opacity })}
            />
          </Panel>
        ) : null}
      </div>

      {componentActions ? (
        <>
          <Divider />
          <ComponentUngroupButton actions={componentActions} />
          {componentActions.canUngroup ? <Divider /> : null}
          <ComponentActionsMenu actions={componentActions} />
        </>
      ) : null}
    </FloatingToolbar>
  );
}

export function ToolbarButton({
  children,
  onClick,
  pressed,
  title,
}: {
  children: ReactNode;
  onClick: () => void;
  pressed?: boolean;
  title: string;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        "relative flex h-7 min-w-7 items-center justify-center gap-1 rounded-[2px] border-0 bg-transparent px-1 text-[#05070A] hover:bg-[#F8F8FA]",
        pressed && "bg-[#F4F1FF] text-[#7C3AED]",
      )}
    >
      {children}
    </button>
  );
}

export function Panel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <FloatingToolbarPanel
      className={cn(
        "absolute left-1/2 top-[calc(100%+10px)] z-10 box-border -translate-x-1/2 rounded-lg bg-white shadow-[0_0_4px_rgba(0,0,0,0.16)]",
        className,
      )}
    >
      {children}
    </FloatingToolbarPanel>
  );
}

export function Divider() {
  return <span aria-hidden="true" className="h-[23px] w-px flex-none bg-[#EDEEEF]" />;
}

export function ToggleRow({
  enabled,
  label,
  onToggle,
}: {
  enabled: boolean;
  label: string;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={enabled}
      onClick={onToggle}
      className="flex w-full items-center justify-between rounded-md border border-[#EDEEEF] px-3 py-2 text-left text-xs text-[#4B5563] hover:bg-[#F8F8FA]"
    >
      <span className="font-medium text-[#191919]">{label}</span>
      <span className="flex items-center gap-1 text-[#7A5AF8]">
        {enabled ? (
          <ToggleRight size={17} aria-hidden="true" />
        ) : (
          <ToggleLeft size={17} aria-hidden="true" />
        )}
        {enabled ? "On" : "Off"}
      </span>
    </button>
  );
}

export function ShadowPanel({
  enabled = true,
  fallback,
  onToggle,
  shadow,
  onChange,
}: {
  enabled?: boolean;
  fallback: ShadowFallback;
  onToggle?: () => void;
  shadow: ShadowValue;
  onChange: (changes: Partial<ShadowValue>) => void;
}) {
  return (
    <Panel className="left-auto right-0 w-[282px] translate-x-0 space-y-4 p-4">
      {onToggle ? (
        <ToggleRow label="Shadow" enabled={enabled} onToggle={onToggle} />
      ) : null}

      {enabled ? (
        <>
          <div className="space-y-2">
            <div className="text-[12px] font-medium text-[#4B5563]">Position</div>
            <div className="grid grid-cols-2 gap-2">
              <NumberField
                label="X"
                value={shadow.offset_x ?? fallback.offset_x}
                min={-64}
                max={64}
                step={1}
                suffix="px"
                onCommit={(offset_x) => onChange({ offset_x })}
              />
              <NumberField
                label="Y"
                value={shadow.offset_y ?? fallback.offset_y}
                min={-64}
                max={64}
                step={1}
                suffix="px"
                onCommit={(offset_y) => onChange({ offset_y })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-[12px] font-medium text-[#4B5563]">Blur</div>
            <NumberField
              label="Amount"
              value={shadow.blur ?? fallback.blur}
              min={0}
              max={100}
              step={1}
              onCommit={(blur) => onChange({ blur })}
            />
          </div>

          <div className="space-y-2">
            <div className="text-[12px] font-medium text-[#4B5563]">Color</div>
            <ColorField
              label="Color"
              color={shadow.color ?? fallback.color}
              onCommit={(color) => onChange({ color })}
            />
          </div>

          <SliderField
            label="Opacity"
            value={shadow.opacity ?? fallback.opacity}
            min={0}
            max={1}
            step={0.01}
            formatValue={(value) => `${Math.round(value * 100)}%`}
            onCommit={(opacity) => onChange({ opacity })}
          />
        </>
      ) : null}
    </Panel>
  );
}

export function ColorField({
  color,
  label,
  onCommit,
}: {
  color: string;
  label: string;
  onCommit: (color: string) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3 text-xs text-[#4B5563]">
      <span>{label}</span>
      <span className="relative flex h-8 min-w-[104px] items-center gap-2 rounded-md border border-[#EDEEEF] px-2">
        <span
          aria-hidden="true"
          className="h-4 w-4 rounded-full border border-black/10"
          style={{ backgroundColor: withHash(color) }}
        />
        <span className="font-mono text-[11px] text-[#191919]">
          {withHash(color).toUpperCase()}
        </span>
        <DeferredColorInput
          aria-label={label}
          value={color}
          onCommit={onCommit}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        />
      </span>
    </label>
  );
}

export function NumberField({
  label,
  max,
  min,
  onCommit,
  step,
  suffix,
  value,
}: {
  label: string;
  max?: number;
  min?: number;
  onCommit: (value: number) => void;
  step: number;
  suffix?: string;
  value: number;
}) {
  const [draft, setDraft] = useState(() => formatNumber(value));
  const [focused, setFocused] = useState(false);
  const numericInputOptions = {
    allowDecimal: true,
    min,
  };

  useEffect(() => {
    if (focused) return;
    setDraft(formatNumber(value));
  }, [focused, value]);

  const commit = () => {
    const parsed = Number.parseFloat(draft);
    if (!Number.isFinite(parsed)) {
      setDraft(formatNumber(value));
      return;
    }
    const next = Math.min(max ?? Infinity, Math.max(min ?? -Infinity, parsed));
    setDraft(formatNumber(next));
    if (next !== value) onCommit(next);
  };

  return (
    <label className="flex min-w-0 flex-1 items-center gap-2 text-xs text-[#4B5563]">
      <span className="font-semibold">{label}</span>
      <span className="flex min-w-0 flex-1 items-center rounded-md border border-[#EDEEEF] bg-white px-2 focus-within:border-[#7C51F8]">
        <input
          aria-label={label}
          type="text"
          inputMode={numericInputMode(numericInputOptions)}
          value={draft}
          onFocus={() => setFocused(true)}
          onChange={(event) =>
            setDraft(
              sanitizeNumericInput(event.target.value, numericInputOptions),
            )
          }
          onBlur={() => {
            setFocused(false);
            commit();
          }}
          onKeyDown={(event) => {
            if (preventInvalidNumberInput(event, numericInputOptions)) return;
            if (event.key === "Enter") {
              event.preventDefault();
              commit();
            }
            if (event.key === "ArrowUp" || event.key === "ArrowDown") {
              event.preventDefault();
              const parsed = Number.parseFloat(draft);
              const current = Number.isFinite(parsed) ? parsed : value;
              const direction = event.key === "ArrowUp" ? 1 : -1;
              setDraft(formatNumber(current + step * direction));
            }
          }}
          className="h-8 min-w-0 flex-1 border-0 bg-transparent text-right text-xs text-[#191919] outline-none"
        />
        {suffix ? (
          <span className="ml-1 text-[10px] text-[#9CA3AF]">{suffix}</span>
        ) : null}
      </span>
    </label>
  );
}

export function SliderField({
  formatValue,
  label,
  max,
  min,
  onCommit,
  step,
  value,
}: {
  formatValue: (value: number) => string;
  label: string;
  max: number;
  min: number;
  onCommit: (value: number) => void;
  step: number;
  value: number;
}) {
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  const commit = (next: number) => {
    setDraft(next);
    if (next !== value) onCommit(next);
  };

  return (
    <label className="block text-xs text-[#4B5563]">
      <span className="mb-2 flex items-center justify-between">
        <span>{label}</span>
        <span className="font-medium text-[#191919]">{formatValue(draft)}</span>
      </span>
      <input
        aria-label={label}
        type="range"
        min={min}
        max={max}
        step={step}
        value={draft}
        onChange={(event) => setDraft(Number(event.target.value))}
        onBlur={(event) => commit(Number(event.currentTarget.value))}
        onKeyUp={(event) => commit(Number(event.currentTarget.value))}
        onPointerUp={(event) => commit(Number(event.currentTarget.value))}
        className="w-full cursor-pointer accent-[#7A5AF8]"
      />
    </label>
  );
}

export function formatNumber(value: number) {
  if (!Number.isFinite(value)) return "0";
  return Number(value.toFixed(3)).toString();
}

function averageCornerRadii(value: number[] | null | undefined) {
  if (!Array.isArray(value) || value.length === 0) return 0;
  const radii = value.filter((item) => Number.isFinite(item));
  if (radii.length === 0) return 0;
  return radii.reduce((sum, item) => sum + item, 0) / radii.length;
}

function curveMode(curve: VectorCurve | null | undefined): CurveMode {
  if (curve?.type === "smooth") return curve.type;
  return "none";
}

export function normalizedSegments(value: number | null | undefined) {
  return Math.max(1, Math.min(96, Math.round(value ?? 16)));
}

function normalizedTension(value: number | null | undefined) {
  return Math.max(0, Math.min(1, value ?? 0.4));
}

export function curveForMode(
  element: VectorElement,
  mode: CurveMode,
): VectorCurve | null {
  if (mode === "none") return null;
  if (mode === "smooth") {
    return {
      type: "smooth",
      tension: normalizedTension(element.curve?.tension),
      segments: normalizedSegments(element.curve?.segments),
    };
  }
  return null;
}

function cornerRadiiForVector(element: VectorElement) {
  if (element.points.length !== 4) return [];
  return [0, 1, 2, 3].map((index) =>
    Math.max(0, element.corner_radii?.[index] ?? 0),
  );
}

function LineWidthIcon() {
  return (
    <span className="flex h-4 w-[13.7px] flex-col justify-center gap-[1.14px]" aria-hidden>
      <span className="h-[1.71px] w-full bg-current" />
      <span className="h-[3.43px] w-full bg-current" />
      <span className="h-[5.71px] w-full bg-current" />
    </span>
  );
}
