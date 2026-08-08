"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Palette, SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ColorField,
  NumberField,
  Panel,
} from "@/components/slide-editor/shapes/ShapeToolbar";
import type { InfographicType } from "@/components/slide-editor/types";
import {
  numericInputMode,
  preventInvalidNumberInput,
  sanitizeNumericInput,
} from "@/components/slide-editor/toolbar/numericInput";

type RawRecord = Record<string, unknown>;
type InfographicPanelId = "infographic-colors" | "infographic-range";

const INFOGRAPHIC_TYPE_OPTIONS: Array<{
  label: string;
  value: InfographicType;
}> = [
  { label: "Progress Bar", value: "progress_bar" },
  { label: "Gauge", value: "gauge" },
];

export type TemplateV2InfographicToolbarElement = RawRecord & {
  type: "infographic";
};

type ToolbarInfographicData = RawRecord & {
  type: InfographicType;
  min_value: number;
  max_value: number;
  value: number;
};

export function TemplateV2InfographicToolbarControls({
  element,
  onChange,
  onToggle,
  openPanel,
}: {
  element: TemplateV2InfographicToolbarElement;
  onChange: (changes: RawRecord) => void;
  onToggle: (panel: InfographicPanelId) => void;
  openPanel: string | null;
}) {
  const data = readInfographicData(element);
  const infographicType = data.type;
  const minValue = data.min_value;
  const maxValue = data.max_value;
  const value = data.value;
  const colors = readInfographicColors(element);
  const baseColor = colors[0];
  const highlightColor = colors[1];

  const commitDataChange = (changes: Partial<ToolbarInfographicData>) => {
    onChange({ data: { ...data, ...changes } });
  };

  const commitColorChange = (index: number, color: string) => {
    const nextColors = [...colors];
    nextColors[index] = color;
    onChange({ colors: nextColors });
  };

  return (
    <>
      <div className="inline-flex h-7 items-center gap-1.5 rounded-[6px] px-1.5 text-[#191919]">
        <SlidersHorizontal size={16} strokeWidth={1.6} aria-hidden />
        <select
          aria-label="Infographic type"
          title="Infographic type"
          value={infographicType}
          onChange={(event) =>
            commitDataChange({
              type: event.target.value as InfographicType,
            })
          }
          className="h-7 max-w-[116px] bg-transparent px-0 text-[12px] font-medium outline-none"
        >
          {INFOGRAPHIC_TYPE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <InlineNumberInput
        label="Value"
        value={value}
        onCommit={(nextValue) => commitDataChange({ value: nextValue })}
      />

      <div className="relative">
        <ToolbarIconButton
          title="Range"
          open={openPanel === "infographic-range"}
          onClick={() => onToggle("infographic-range")}
        >
          <span className="text-[11px] font-semibold leading-none" aria-hidden>
            Min
          </span>
        </ToolbarIconButton>
        {openPanel === "infographic-range" ? (
          <Panel className="w-[230px] space-y-3 p-3">
            <NumberField
              label="Min"
              value={minValue}
              step={1}
              onCommit={(min_value) => commitDataChange({ min_value })}
            />
            <NumberField
              label="Max"
              value={maxValue}
              step={1}
              onCommit={(max_value) => commitDataChange({ max_value })}
            />
          </Panel>
        ) : null}
      </div>

      <div className="relative">
        <ToolbarIconButton
          title="Colors"
          open={openPanel === "infographic-colors"}
          onClick={() => onToggle("infographic-colors")}
        >
          <Palette size={16} strokeWidth={1.8} aria-hidden />
        </ToolbarIconButton>
        {openPanel === "infographic-colors" ? (
          <Panel className="w-[230px] space-y-3 p-3">
            <ColorField
              label="Base"
              color={baseColor}
              onCommit={(baseColor) => commitColorChange(0, baseColor)}
            />
            <ColorField
              label="Highlight"
              color={highlightColor}
              onCommit={(highlightColor) => commitColorChange(1, highlightColor)}
            />
          </Panel>
        ) : null}
      </div>
    </>
  );
}

export function isTemplateV2InfographicToolbarElement(
  element: RawRecord | null | undefined,
): element is TemplateV2InfographicToolbarElement {
  return element?.type === "infographic";
}

function ToolbarIconButton({
  children,
  onClick,
  open,
  title,
}: {
  children: ReactNode;
  onClick: () => void;
  open: boolean;
  title: string;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-expanded={open}
      onClick={onClick}
      className={cn(
        "grid h-7 min-w-7 place-items-center rounded-md border-0 bg-transparent px-1 text-[#05070A] hover:bg-[#F8F8FA]",
        open && "bg-[#F4F1FF] text-[#7C3AED]",
      )}
    >
      {children}
    </button>
  );
}

function InlineNumberInput({
  label,
  onCommit,
  value,
}: {
  label: string;
  onCommit: (value: number) => void;
  value: number;
}) {
  const [draft, setDraft] = useState(() => formatNumber(value));
  const [focused, setFocused] = useState(false);
  const numericInputOptions = { allowDecimal: true };

  useEffect(() => {
    if (focused) return;
    setDraft(formatNumber(value));
  }, [focused, value]);

  const commit = (nextDraft = draft) => {
    const nextValue = Number.parseFloat(nextDraft);
    if (!Number.isFinite(nextValue)) {
      setDraft(formatNumber(value));
      return;
    }
    setDraft(formatNumber(nextValue));
    if (nextValue !== value) onCommit(nextValue);
  };

  return (
    <label className="flex h-7 items-center gap-1.5 rounded-[6px] px-1 text-[12px] font-medium text-[#191919]">
      <span>{label}</span>
      <input
        aria-label={label}
        type="text"
        inputMode={numericInputMode(numericInputOptions)}
        value={draft}
        onFocus={() => setFocused(true)}
        onChange={(event) =>
          setDraft(sanitizeNumericInput(event.target.value, numericInputOptions))
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
            const nextDraft = formatNumber(current + direction);
            setDraft(nextDraft);
            commit(nextDraft);
          }
        }}
        className="h-6 w-[58px] rounded-md border border-[#EDEEEF] bg-white px-1.5 text-right text-[12px] text-[#191919] outline-none focus:border-[#7C51F8]"
      />
    </label>
  );
}

function readInfographicType(value: unknown): InfographicType {
  return value === "progress_bar" || value === "gauge" ? value : "gauge";
}

function readInfographicData(element: RawRecord): ToolbarInfographicData {
  const data = readRecord(element.data);
  const minValue = readNumber(data.min_value, 0);
  const maxValue = readNumber(data.max_value, 100);
  return {
    ...data,
    type: readInfographicType(data.type),
    min_value: minValue,
    max_value: maxValue,
    value: readNumber(data.value, minValue),
  };
}

function readInfographicColors(element: RawRecord): [string, string] {
  const colors = Array.isArray(element.colors) ? element.colors : [];
  return [
    readColor(colors[0], "E5E7EB"),
    readColor(colors[1], "2563EB"),
  ];
}

function readRecord(value: unknown): RawRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as RawRecord)
    : {};
}

function readNumber(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : fallback;
}

function readColor(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function formatNumber(value: number) {
  return Number.isFinite(value) ? String(value) : "0";
}
