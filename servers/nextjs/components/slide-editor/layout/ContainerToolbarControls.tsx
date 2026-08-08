"use client";

import { type ReactNode } from "react";
import { Circle, Scan, SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ColorField,
  NumberField,
  Panel,
} from "@/components/slide-editor/shapes/ShapeToolbar";
import type {
  TemplateV2LayoutElement,
  TemplateV2LayoutToolbarBox,
} from "@/components/slide-editor/layout/LayoutToolbar";
import {
  numericInputMode,
  preventInvalidNumberInput,
  sanitizeNumericInput,
} from "@/components/slide-editor/toolbar/numericInput";

type RawRecord = Record<string, unknown>;
type ContainerPanelId = "fill" | "stroke" | "radius" | "padding" | "shadow";

const ALIGNMENT_MATRIX = [
  { horizontal: "left", vertical: "top" },
  { horizontal: "center", vertical: "top" },
  { horizontal: "right", vertical: "top" },
  { horizontal: "left", vertical: "middle" },
  { horizontal: "center", vertical: "middle" },
  { horizontal: "right", vertical: "middle" },
  { horizontal: "left", vertical: "bottom" },
  { horizontal: "center", vertical: "bottom" },
  { horizontal: "right", vertical: "bottom" },
] as const;

function asRecord(value: unknown): RawRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as RawRecord)
    : {};
}

function readNumber(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function readString(value: unknown, fallback: string) {
  return typeof value === "string" && value ? value : fallback;
}

function readColor(value: unknown, fallback: string) {
  const color = readString(value, fallback);
  return color.startsWith("#") ? color : `#${color}`;
}

function capitalize(value: string) {
  return value
    .replace("flex-", "")
    .replace(/(^|[-_])\w/g, (part) => part.replace(/[-_]/, "").toUpperCase());
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function ContainerControlButton({
  children,
  className,
  open,
  title,
  onClick,
}: {
  children: ReactNode;
  className?: string;
  open?: boolean;
  title: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={open}
      onClick={onClick}
      className={cn(
        "inline-flex h-7 min-w-7 items-center justify-center gap-1 rounded-[6px] border-0 bg-transparent px-2 font-manrope text-[14px] font-medium leading-4 text-[#191919] hover:bg-[#F4F4F6]",
        open && "bg-[#F0ECFF] text-[#2B1D71]",
        className,
      )}
    >
      {children}
    </button>
  );
}

function CompactNumberInput({
  marker,
  min,
  max,
  step = 1,
  value,
  onCommit,
  label,
}: {
  marker?: string;
  min?: number;
  max?: number;
  step?: number;
  value: number;
  onCommit: (value: number) => void;
  label: string;
}) {
  const numericInputOptions = {
    allowDecimal: true,
    min,
  };
  const commitNumber = (nextValue: number) => {
    if (!Number.isFinite(nextValue)) return;
    const bounded = clampNumber(
      nextValue,
      min ?? -Infinity,
      max ?? Infinity,
    );
    onCommit(bounded);
  };

  return (
    <label className="flex items-center justify-between gap-3">
      <span className="font-manrope text-[12px] font-medium leading-6 text-[#191919]">
        {label}
      </span>
      <span className="flex h-9 min-w-[140px] items-center rounded-[10px] border border-[#DDDEE4] bg-white px-3 text-[12px] text-[#191919] focus-within:border-[#6A52E2]">
        {marker ? (
          <span className="mr-3 flex h-5 min-w-5 items-center justify-center rounded-md border border-[#B7BAC6] bg-[#F7F8FB] px-1 text-[11px] font-semibold leading-none text-[#727584]">
            {marker}
          </span>
        ) : null}
        <input
          aria-label={label}
          type="text"
          inputMode={numericInputMode(numericInputOptions)}
          value={Number.isFinite(value) ? value : 0}
          onKeyDown={(event) => {
            if (preventInvalidNumberInput(event, numericInputOptions)) return;
            if (event.key === "ArrowUp" || event.key === "ArrowDown") {
              event.preventDefault();
              const direction = event.key === "ArrowUp" ? 1 : -1;
              commitNumber(value + step * direction);
            }
          }}
          onChange={(event) => {
            const sanitizedValue = sanitizeNumericInput(
              event.target.value,
              numericInputOptions,
            );
            commitNumber(Number(sanitizedValue));
          }}
          className="w-full border-0 bg-transparent p-0 text-[12px] leading-none text-[#191919] outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />
      </span>
    </label>
  );
}

export function TemplateV2ContainerToolbarControls({
  box,
  element,
  onChange,
  onToggle,
  openPanel,
}: {
  box: TemplateV2LayoutToolbarBox;
  element: TemplateV2LayoutElement;
  onChange: (changes: RawRecord) => void;
  onToggle: (panel: ContainerPanelId) => void;
  openPanel: string | null;
}) {
  const alignment = asRecord(element.alignment);
  const fill = asRecord(element.fill);
  const stroke = asRecord(element.stroke);
  const padding = asRecord(element.padding);
  const shadow = asRecord(element.shadow);
  const borderRadius = asRecord(element.border_radius);
  const horizontal = readString(alignment.horizontal, "left");
  const vertical = readString(alignment.vertical, "top");
  const radius =
    typeof element.border_radius === "number"
      ? element.border_radius
      : readNumber(borderRadius.radius, readNumber(borderRadius.tl));
  const maxRadius = Math.max(0, Math.min(box.width, box.height) / 2);
  const fillColor = readColor(fill.color, "#4A6FF3");
  const strokeColor = readColor(stroke.color, "#1A1F36");
  const paddingX = readNumber(
    padding.x,
    (readNumber(padding.left) + readNumber(padding.right)) / 2,
  );
  const paddingY = readNumber(
    padding.y,
    (readNumber(padding.top) + readNumber(padding.bottom)) / 2,
  );
  const updatePaddingX = (value: number) =>
    onChange({
      padding: {
        ...padding,
        x: value,
        left: value,
        right: value,
      },
    });
  const updatePaddingY = (value: number) =>
    onChange({
      padding: {
        ...padding,
        y: value,
        top: value,
        bottom: value,
      },
    });

  return (
    <>
      <div className="relative">
        <ContainerControlButton
          title="Fill"
          open={openPanel === "fill"}
          onClick={() => onToggle("fill")}
          className="w-7 px-0"
        >
          <span
            aria-hidden
            className="h-4 w-4 rounded-full border border-[#D6D9E1]"
            style={{ backgroundColor: fillColor }}
          />
        </ContainerControlButton>
        {openPanel === "fill" ? (
          <Panel className="flex w-[250px] flex-col items-start gap-[14px] rounded-[12px] border border-[#E8E9EE] p-3 font-manrope text-[12px] font-medium leading-6 text-[#191919] shadow-[0_8px_24px_rgba(16,24,40,0.12)]">
            <ColorField
              label="Color"
              color={fillColor}
              onCommit={(color) => onChange({ fill: { ...fill, color } })}
            />
            <NumberField
              label="Opacity"
              value={readNumber(fill.opacity, 1)}
              min={0}
              max={1}
              step={0.05}
              onCommit={(opacity) => onChange({ fill: { ...fill, opacity } })}
            />
          </Panel>
        ) : null}
      </div>

      <div className="relative">
        <ContainerControlButton
          title="Stroke"
          open={openPanel === "stroke"}
          onClick={() => onToggle("stroke")}
          className="w-7 px-0"
        >
          <Circle size={16} strokeWidth={1.33} className="text-[#182042]" aria-hidden />
        </ContainerControlButton>
        {openPanel === "stroke" ? (
          <Panel className="flex w-[250px] flex-col items-start gap-[14px] rounded-[12px] border border-[#E8E9EE] p-3 font-manrope text-[12px] font-medium leading-6 text-[#191919] shadow-[0_8px_24px_rgba(16,24,40,0.12)]">
            <ColorField
              label="Color"
              color={strokeColor}
              onCommit={(color) => onChange({ stroke: { ...stroke, color } })}
            />
            <NumberField
              label="Width"
              value={readNumber(stroke.width)}
              min={0}
              max={32}
              step={0.25}
              suffix="px"
              onCommit={(width) => onChange({ stroke: { ...stroke, width } })}
            />
            <NumberField
              label="Opacity"
              value={readNumber(stroke.opacity, 1)}
              min={0}
              max={1}
              step={0.05}
              onCommit={(opacity) => onChange({ stroke: { ...stroke, opacity } })}
            />
          </Panel>
        ) : null}
      </div>

      <div className="relative">
        <ContainerControlButton
          title="Corner Radius"
          open={openPanel === "radius"}
          onClick={() => onToggle("radius")}
          className="w-7 px-0"
        >
          <Scan size={16} strokeWidth={1.33} aria-hidden />
        </ContainerControlButton>
        {openPanel === "radius" ? (
          <Panel className="flex w-[240px] flex-col items-start gap-[14px] rounded-[12px] border border-[#E8E9EE] p-3 font-manrope text-[12px] font-medium leading-6 text-[#191919] shadow-[0_8px_24px_rgba(16,24,40,0.12)]">
            <div className="flex w-full items-center justify-between">
              <span className="font-manrope text-[12px] font-medium leading-6 text-[#191919]">
                Border Radius
              </span>
              <span
                aria-hidden
                className="h-7 w-7 border border-[#D7DAE3] bg-[#F7F8FB]"
                style={{ borderRadius: `${clampNumber(radius, 0, 12)}px` }}
              />
            </div>
            <CompactNumberInput
              label="Radius"
              marker="R"
              value={radius}
              min={0}
              max={maxRadius}
              step={0.5}
              onCommit={(value) =>
                onChange({
                  border_radius: { tl: value, tr: value, br: value, bl: value },
                })
              }
            />
            <div className="flex w-full items-center gap-2">
              {[0, 8, 16, 24].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() =>
                    onChange({
                      border_radius: {
                        tl: Math.min(maxRadius, preset),
                        tr: Math.min(maxRadius, preset),
                        br: Math.min(maxRadius, preset),
                        bl: Math.min(maxRadius, preset),
                      },
                    })
                  }
                  className="inline-flex h-7 items-center justify-center rounded-[6px] border border-[#D7DAE3] bg-white px-2 text-[11px] leading-none text-[#353742] hover:bg-[#F7F8FB]"
                >
                  {preset}
                </button>
              ))}
            </div>
          </Panel>
        ) : null}
      </div>

      <div className="relative">
        <ContainerControlButton
          title="Shadow"
          open={openPanel === "shadow"}
          onClick={() => onToggle("shadow")}
          className="px-3"
        >
          Shadow
        </ContainerControlButton>
        {openPanel === "shadow" ? (
          <Panel className="flex w-[320px] flex-col items-start gap-[14px] rounded-[12px] border border-[#E8E9EE] p-3 font-manrope text-[12px] font-medium leading-6 text-[#191919] shadow-[0_8px_24px_rgba(16,24,40,0.12)]">
            <CompactNumberInput
              label="Position"
              marker="X"
              value={readNumber(shadow.offset_x)}
              step={0.5}
              onCommit={(offset_x) =>
                onChange({
                  shadow: {
                    ...shadow,
                    offset_x,
                    opacity: Math.max(0.05, readNumber(shadow.opacity, 0.24)),
                  },
                })
              }
            />
            <CompactNumberInput
              label="Position"
              marker="Y"
              value={readNumber(shadow.offset_y)}
              step={0.5}
              onCommit={(offset_y) =>
                onChange({
                  shadow: {
                    ...shadow,
                    offset_y,
                    opacity: Math.max(0.05, readNumber(shadow.opacity, 0.24)),
                  },
                })
              }
            />
            <CompactNumberInput
              label="Blur"
              marker="X"
              min={0}
              max={100}
              step={0.5}
              value={readNumber(shadow.blur, 12)}
              onCommit={(blur) => onChange({ shadow: { ...shadow, blur } })}
            />
            <ColorField
              label="Color"
              color={readColor(shadow.color, "#4A6FF3")}
              onCommit={(color) => onChange({ shadow: { ...shadow, color } })}
            />
            <NumberField
              label="Opacity"
              value={clampNumber(readNumber(shadow.opacity, 0.24), 0, 1) * 100}
              min={0}
              max={100}
              step={1}
              suffix="%"
              onCommit={(opacityPercent) =>
                onChange({
                  shadow: {
                    ...shadow,
                    opacity: clampNumber(opacityPercent, 0, 100) / 100,
                  },
                })
              }
            />
          </Panel>
        ) : null}
      </div>

      <div className="relative">
        <ContainerControlButton
          title="Layout Settings"
          open={openPanel === "padding"}
          onClick={() => onToggle("padding")}
          className="w-7 px-0"
        >
          <SlidersHorizontal size={16} strokeWidth={1.33} aria-hidden />
        </ContainerControlButton>
        {openPanel === "padding" ? (
          <Panel className="flex w-[320px] flex-col items-start gap-[14px] rounded-[12px] border border-[#E8E9EE] p-3 font-manrope text-[12px] font-medium leading-6 text-[#191919] shadow-[0_8px_24px_rgba(16,24,40,0.12)]">
            <div className="flex items-start justify-between gap-3">
              <span className="pt-1 font-manrope text-[12px] font-medium leading-6 text-[#191919]">
                Alignment
              </span>
              <div className="grid grid-cols-3 gap-2 rounded-[10px] border border-[#DDDEE4] bg-[#F8F9FC] p-2">
                {ALIGNMENT_MATRIX.map((point) => {
                  const selected =
                    point.horizontal === horizontal && point.vertical === vertical;
                  return (
                    <button
                      key={`${point.horizontal}-${point.vertical}`}
                      type="button"
                      aria-label={`${capitalize(point.horizontal)} ${capitalize(point.vertical)}`}
                      aria-pressed={selected}
                      onClick={() =>
                        onChange({
                          alignment: {
                            ...alignment,
                            horizontal: point.horizontal,
                            vertical: point.vertical,
                          },
                        })
                      }
                      className={cn(
                        "grid h-8 w-8 place-items-center rounded-md transition-colors hover:bg-[#EDEFFF]",
                        selected && "bg-[#ECE7FF]",
                      )}
                    >
                      <span
                        className={cn(
                          "h-2.5 w-2.5 rounded-full bg-[#C8CBD6]",
                          selected && "bg-[#6A52E2]",
                        )}
                      />
                    </button>
                  );
                })}
              </div>
            </div>
            <CompactNumberInput
              label="Position"
              marker="X"
              min={0}
              value={paddingX}
              step={0.5}
              onCommit={updatePaddingX}
            />
            <CompactNumberInput
              label="Position"
              marker="Y"
              min={0}
              value={paddingY}
              step={0.5}
              onCommit={updatePaddingY}
            />
          </Panel>
        ) : null}
      </div>
    </>
  );
}
