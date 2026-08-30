"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Pencil, Plus, PlusCircle, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { NumberField, Panel } from "@/components/slide-editor/shapes/ShapeToolbar";
import type { InfographicType } from "@/components/slide-editor/types";
import {
  addInfographicToolbarItem,
  infographicToolbarItemStats,
  removeLastInfographicToolbarItem,
} from "@/components/slide-editor/infographics/infographic-editing";
import { resizedInfographicFrame } from "@/components/slide-editor/infographics/infographic-sizing";
import {
  numericInputMode,
  preventInvalidNumberInput,
  sanitizeNumericInput,
} from "@/components/slide-editor/toolbar/numericInput";

type RawRecord = Record<string, unknown>;
type InfographicPanelId = "items" | "infographic-range";

export type TemplateV2InfographicToolbarElement = RawRecord & {
  type: "infographic";
  text_color?: string | null;
};

type ToolbarInfographicData = {
  type: InfographicType;
  min_value: number;
  max_value: number;
  value: number;
};

export function TemplateV2InfographicToolbarControls({
  element,
  onChange,
  onEdit,
  onToggle,
  openPanel,
}: {
  element: TemplateV2InfographicToolbarElement;
  onChange: (changes: RawRecord) => void;
  onEdit?: () => void;
  onToggle: (panel: InfographicPanelId) => void;
  openPanel: string | null;
}) {
  const data = readInfographicData(element);
  const infographicType = data.type;
  const minValue = data.min_value;
  const maxValue = data.max_value;
  const value = data.value;
  const isMeter =
    infographicType === "progress_bar" || infographicType === "gauge";
  const rawData = readRecord(element.data);
  const itemStats = infographicToolbarItemStats(rawData);

  const commitDataChange = (changes: Partial<ToolbarInfographicData>) => {
    const next = { ...rawData, ...data, ...changes };
    onChange({
      data: next,
      infographic_type: undefined,
      min_value: undefined,
      max_value: undefined,
      value: undefined,
    });
  };

  const commitItemsChange = (nextData: unknown) => {
    if (nextData === rawData) return;
    onChange({
      data: nextData,
      ...resizedInfographicFrame(element, nextData),
      infographic_type: undefined,
      min_value: undefined,
      max_value: undefined,
      value: undefined,
    });
  };

  return (
    <>
      {isMeter ? (
        <InlineNumberInput
          label="Value"
          value={value}
          onCommit={(nextValue) => commitDataChange({ value: nextValue })}
        />
      ) : null}

      {isMeter ? (
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
      ) : null}

      {itemStats ? (
        <InfographicItemsControl
          canAdd={infographicType !== "decision_tree" && itemStats.canAdd}
          canRemove={itemStats.canRemove}
          count={itemStats.count}
          open={openPanel === "items"}
          onAdd={() => commitItemsChange(addInfographicToolbarItem(rawData))}
          onRemove={() =>
            commitItemsChange(removeLastInfographicToolbarItem(rawData))
          }
          onToggle={() => onToggle("items")}
        />
      ) : null}

      {onEdit ? (
        <ToolbarIconButton title="Edit infographic" open={false} onClick={onEdit}>
          <Pencil size={15} strokeWidth={1.8} aria-hidden />
        </ToolbarIconButton>
      ) : null}
    </>
  );
}

function InfographicItemsControl({
  canAdd,
  canRemove,
  count,
  onAdd,
  onRemove,
  onToggle,
  open,
}: {
  canAdd: boolean;
  canRemove: boolean;
  count: number;
  onAdd: () => void;
  onRemove: () => void;
  onToggle: () => void;
  open: boolean;
}) {
  const addItem = () => {
    if (!canAdd) return;
    onAdd();
    onToggle();
  };
  const removeItem = () => {
    if (!canRemove) return;
    onRemove();
    onToggle();
  };

  return (
    <div className="relative">
      <ToolbarIconButton title="Items" open={open} onClick={onToggle}>
        <PlusCircle size={16} strokeWidth={1} aria-hidden />
      </ToolbarIconButton>
      {open ? (
        <Panel className="w-[206px] overflow-hidden py-2.5">
          <button
            type="button"
            disabled={!canAdd}
            onClick={addItem}
            className={cn(
              "flex w-full items-center gap-2 px-4 py-2.5 text-left font-manrope text-[14px] font-medium text-[#191919] hover:bg-[#F8F8FA]",
              !canAdd &&
                "cursor-not-allowed text-[#A0A3AD] hover:bg-transparent",
            )}
          >
            <Plus size={16} strokeWidth={1} aria-hidden />
            <span>Add Item</span>
          </button>
          <div className="my-1 h-px bg-[#E7E8EC]" aria-hidden />
          <button
            type="button"
            disabled={!canRemove}
            onClick={removeItem}
            className={cn(
              "flex w-full items-center gap-2 px-4 py-2.5 text-left font-manrope text-[14px] font-medium text-[#191919] hover:bg-[#F8F8FA]",
              !canRemove &&
                "cursor-not-allowed text-[#A0A3AD] hover:bg-transparent",
            )}
          >
            <Trash2 size={16} strokeWidth={1} aria-hidden />
            <span>Last Item</span>
            <span className="ml-auto text-[11px] text-[#8A8D96]">{count}</span>
          </button>
        </Panel>
      ) : null}
    </div>
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
    // Keep the unfocused input draft synchronized with external canvas updates.
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
  return value === "progress_bar" ||
    value === "gauge" ||
    value === "gantt" ||
    value === "timeline" ||
    value === "roadmap" ||
    value === "milestone_timeline" ||
    value === "staircase" ||
    value === "supply_chain" ||
    value === "stair_step_blocks" ||
    value === "maturity_model" ||
    value === "diagonal_circles" ||
    value === "pillar_framework" ||
    value === "transformation_hub" ||
    value === "risk_matrix" ||
    value === "chevron_process" ||
    value === "radial_cycle" ||
    value === "conversion_funnel" ||
    value === "pyramid" ||
    value === "segmented_wheel" ||
    value === "customer_journey" ||
    value === "before_after" ||
    value === "impact_effort_matrix" ||
    value === "comparison_matrix" ||
    value === "org_chart" ||
    value === "decision_tree" ||
    value === "mind_map"
    ? value
    : "gauge";
}

function readInfographicData(element: RawRecord): ToolbarInfographicData {
  const data = readRecord(element.data);
  const minValue = readNumber(
    data.min_value,
    readNumber(element.min_value, 0),
  );
  const maxValue = readNumber(
    data.max_value,
    readNumber(element.max_value, 100),
  );
  return {
    type: readInfographicType(data.type ?? element.infographic_type),
    min_value: minValue,
    max_value: maxValue,
    value: readNumber(data.value, readNumber(element.value, minValue)),
  };
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

function formatNumber(value: number) {
  return Number.isFinite(value) ? String(value) : "0";
}
