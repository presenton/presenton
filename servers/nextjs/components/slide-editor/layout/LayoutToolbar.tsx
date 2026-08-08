"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import {
  ChevronDown,
  ChevronUp,
  Plus,
  PlusCircle,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ChartToolbarControls } from "@/components/slide-editor/charts/ChartToolbar";
import { Panel } from "@/components/slide-editor/shapes/ShapeToolbar";
import type {
  ChartSlideElement,
  TableSlideElement,
} from "@/components/slide-editor/state/state";
import { TableToolbarControls } from "@/components/slide-editor/tables/TableToolbar";
import {
  addLayoutItemChanges,
  layoutItemStats,
  removeLastLayoutItemChanges,
} from "@/components/slide-editor/layout/layoutItems";
import { isFlowLayoutElement } from "@/components/slide-editor/layout/flowLayout";
import type { ComponentLayerAction } from "@/components/slide-editor/selection/layering";
import { ComponentActionsMenu } from "@/components/slide-editor/selection/ComponentActionsMenu";
import { TemplateV2ContainerToolbarControls } from "@/components/slide-editor/layout/ContainerToolbarControls";
import {
  isTemplateV2InfographicToolbarElement,
  TemplateV2InfographicToolbarControls,
  type TemplateV2InfographicToolbarElement,
} from "@/components/slide-editor/layout/InfographicToolbarControls";
import { FloatingToolbarBoundsProvider } from "@/components/slide-editor/toolbar/FloatingToolbar";
import {
  numericInputMode,
  preventInvalidNumberInput,
  sanitizeNumericInput,
} from "@/components/slide-editor/toolbar/numericInput";

type RawRecord = Record<string, unknown>;
type LayoutElementType =
  | "container"
  | "flex"
  | "grid"
  | "group"
  | "list-view"
  | "grid-view";
type PanelId =
  | "items"
  | "fill"
  | "stroke"
  | "radius"
  | "padding"
  | "shadow"
  | "chart-colors"
  | "infographic-colors"
  | "infographic-range"
  | "component-menu"
  | null;

export type TemplateV2LayoutToolbarBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type TemplateV2LayoutElement = RawRecord & {
  type: LayoutElementType;
};

export type TemplateV2ToolbarElement =
  | TemplateV2LayoutElement
  | TemplateV2InfographicToolbarElement
  | ChartSlideElement
  | TableSlideElement;

export type TemplateV2SelectionComponentActions = {
  canUngroup: boolean;
  componentIndex: number;
  componentCount: number;
  onDelete: () => void;
  onDuplicate: () => void;
  onLayerAction: (action: ComponentLayerAction) => void;
  onUngroup: () => void;
};

type TemplateV2UngroupAction = {
  canUngroup: boolean;
  onUngroup: () => void;
};

type TemplateV2LayoutToolbarProps = {
  box: TemplateV2LayoutToolbarBox;
  bounds?: {
    bottom: number;
    left: number;
    right: number;
    top: number;
  } | null;
  element?: TemplateV2ToolbarElement | null;
  onChange?: (changes: RawRecord) => void;
  onChartChange?: (element: ChartSlideElement) => void;
  onChartEdit?: () => void;
  onTableChange?: (element: TableSlideElement) => void;
  selectedTableCell?: { rowIndex: number; colIndex: number } | null;
  position?: { left: number; top: number };
  componentActions?: TemplateV2SelectionComponentActions | null;
  ungroupAction?: TemplateV2UngroupAction | null;
};

function readNumber(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

type LayoutControlsProps = {
  element: TemplateV2LayoutElement;
  onChange: (changes: RawRecord) => void;
  onToggle: (panel: Exclude<PanelId, null>) => void;
  openPanel: PanelId;
};

function FlowControls({
  element,
  onChange,
  onToggle,
  openPanel,
}: LayoutControlsProps) {
  return (
    <>
      <GapControl element={element} onChange={onChange} />
      <ToolbarDivider />
      <ItemsControl
        element={element}
        onChange={onChange}
        openPanel={openPanel}
        onToggle={onToggle}
      />
    </>
  );
}

function GapControl({
  element,
  onChange,
}: {
  element: TemplateV2LayoutElement;
  onChange: (changes: RawRecord) => void;
}) {
  const value = readGapValue(element);
  const numericInputOptions = { allowDecimal: true, min: 0 };
  const commit = (nextValue: number) => {
    const gap = Math.max(0, Math.round(nextValue * 10) / 10);
    onChange({ gap, column_gap: gap, row_gap: gap });
  };

  return (
    <label className="flex  items-center gap-2.5 px-1 text-[14px] font-medium font-manrope text-[#191919]">
      <span>Gap</span>
      <span className="flex gap-2  items-center rounded-md bg-white">
        <input
          type="text"
          inputMode={numericInputMode(numericInputOptions)}
          aria-label="Gap"
          value={formatGapValue(value)}
          onKeyDown={(event) => {
            if (preventInvalidNumberInput(event, numericInputOptions)) return;
            if (event.key === "ArrowUp" || event.key === "ArrowDown") {
              event.preventDefault();
              commit(value + (event.key === "ArrowUp" ? 1 : -1));
            }
          }}
          onChange={(event) => {
            const sanitizedValue = sanitizeNumericInput(
              event.target.value,
              numericInputOptions,
            );
            const nextValue = Number(sanitizedValue);
            if (Number.isFinite(nextValue)) commit(nextValue);
          }}
          className="w-[30px] border-0 bg-transparent p-0 text-center text-[12px] font-medium font-manrope text-[#191919] outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />
        <span className="flex   flex-col items-center justify-center">
          <button
            type="button"
            title="Increase gap"
            aria-label="Increase gap"
            onClick={() => commit(value + 1)}
            className="grid  place-items-center rounded-sm text-[#05070A] hover:bg-[#F8F8FA]"
          >
            <ChevronUp size={11} strokeWidth={1} aria-hidden />
          </button>
          <button
            type="button"
            title="Decrease gap"
            aria-label="Decrease gap"
            onClick={() => commit(value - 1)}
            className="grid   place-items-center rounded-sm text-[#05070A] hover:bg-[#F8F8FA]"
          >
            <ChevronDown size={11} strokeWidth={1} aria-hidden />
          </button>
        </span>
      </span>
    </label>
  );
}

function ItemsControl({
  element,
  onChange,
  onToggle,
  openPanel,
}: LayoutControlsProps) {
  const { canAdd, canRemove, children } = layoutItemStats(element);
  const addItem = () => {
    if (!canAdd) return;
    onChange(addLayoutItemChanges(element));
    onToggle("items");
  };
  const removeItem = () => {
    if (!canRemove) return;
    const changes = removeLastLayoutItemChanges(element);
    if (changes) onChange(changes);
    onToggle("items");
  };
  const open = openPanel === "items";

  return (
    <div className="relative">
      <button
        type="button"
        title="Items"
        aria-label="Items"
        aria-expanded={open}
        onClick={() => onToggle("items")}
        className={cn(
          "grid h-7 w-7 place-items-center rounded-md border-0 bg-transparent text-[#05070A] hover:bg-[#F8F8FA]",
          open && "bg-[#F4F1FF] text-[#7C3AED]",
        )}
      >
        <PlusCircle size={16} strokeWidth={1} aria-hidden />
      </button>
      {open ? (
        <Panel className="w-[206px] overflow-hidden py-2.5">
          <button
            type="button"
            disabled={!canAdd}
            onClick={addItem}
            className={cn(
              "flex  w-full items-center gap-2 px-4 py-2.5 text-left text-[14px] font-medium font-manrope text-[#191919] hover:bg-[#F8F8FA]",
              !canAdd &&
              "cursor-not-allowed text-[#A0A3AD] hover:bg-transparent",
            )}
          >
            <Plus size={16} strokeWidth={1} aria-hidden />
            <span>Add Item</span>
          </button>
          <div className="h-px my-1 bg-[#E7E8EC]" aria-hidden />
          <button
            type="button"
            disabled={!canRemove}
            onClick={removeItem}
            className={cn(
              "flex  w-full items-center gap-2 px-4 py-2.5 text-left text-[14px] font-medium font-manrope text-[#191919] hover:bg-[#F8F8FA]",
              !canRemove &&
              "cursor-not-allowed text-[#A0A3AD] hover:bg-transparent",
            )}
          >
            <Trash2 size={16} strokeWidth={1} aria-hidden />
            <span>Last Item</span>
            <span className="ml-auto text-[11px] text-[#8A8D96]">
              {children.length}
            </span>
          </button>
        </Panel>
      ) : null}
    </div>
  );
}

function readGapValue(element: RawRecord) {
  return readNumber(
    element.gap,
    readNumber(element.column_gap, readNumber(element.row_gap)),
  );
}

function formatGapValue(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function ToolbarDivider() {
  return <span aria-hidden className="h-5 w-px bg-[#EDEEEF]" />;
}

export function TemplateV2LayoutToolbar({
  box,
  bounds,
  element,
  onChange,
  onChartChange,
  onChartEdit,
  onTableChange,
  selectedTableCell,
  position,
  componentActions,
  ungroupAction: flowUngroupAction,
}: TemplateV2LayoutToolbarProps) {
  const [openPanel, setOpenPanel] = useState<PanelId>(null);
  const layoutType = element ? normalizedLayoutType(element) : null;
  const hasFlowControls = Boolean(
    element && onChange && (layoutType === "flex" || layoutType === "grid"),
  );
  const hasContainerControls = Boolean(
    element && onChange && layoutType === "container",
  );
  const hasInfographicControls = Boolean(
    element && onChange && isTemplateV2InfographicToolbarElement(element),
  );
  const hasChartControls = Boolean(
    element && onChartChange && isTemplateV2ChartToolbarElement(element),
  );
  const hasTableControls = Boolean(
    element && onTableChange && isTemplateV2TableToolbarElement(element),
  );
  const hasLayoutControls =
    hasFlowControls ||
    hasContainerControls ||
    hasInfographicControls;
  const hasToolbarControls =
    hasLayoutControls || hasChartControls || hasTableControls;
  const ungroupAction = componentActions?.canUngroup
    ? componentActions
    : flowUngroupAction?.canUngroup
      ? flowUngroupAction
      : null;
  if (!componentActions && !hasToolbarControls && !ungroupAction) return null;

  const togglePanel = (panel: Exclude<PanelId, null>) => {
    setOpenPanel((current) => (current === panel ? null : panel));
  };
  const setPanelOpen = (panel: Exclude<PanelId, null>, open: boolean) => {
    setOpenPanel((current) =>
      open ? panel : current === panel ? null : current,
    );
  };

  const toolbar = (
    <FloatingToolbarBoundsProvider bounds={bounds ?? null}>
      <div
        data-template-v2-floating-toolbar="true"
        style={{ top: position?.top, left: position?.left }}
        onMouseDown={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
        className="fixed z-[10000] inline-flex items-center gap-[6px] rounded-[6px] bg-[#FFF] p-[6px] font-manrope text-[14px] font-medium leading-4 text-[#191919] shadow-[0_0_4px_rgba(0,0,0,0.15)]"
      >
        {ungroupAction ? (
          <>
            <div
              className="inline-flex h-7 items-center gap-1 rounded-[6px] px-2 hover:bg-[#F6F6F9] cursor-pointer text-[14px] font-manrope font-medium leading-4 text-[#191919]"
              title="Ungroup"
              onClick={ungroupAction.onUngroup}
            >
              <span>Ungroup</span>
            </div>
            <ToolbarDivider />
          </>
        ) : null}
        {hasFlowControls && element && onChange && isTemplateV2LayoutElement(element) ? (
          <FlowControls
            element={element}
            onChange={onChange}
            openPanel={openPanel}
            onToggle={togglePanel}
          />
        ) : hasContainerControls && element && onChange && isTemplateV2LayoutElement(element) ? (
          <TemplateV2ContainerToolbarControls
            box={box}
            element={element}
            onChange={onChange}
            openPanel={openPanel}
            onToggle={togglePanel}
          />
        ) : hasInfographicControls &&
          element &&
          onChange &&
          isTemplateV2InfographicToolbarElement(element) ? (
          <TemplateV2InfographicToolbarControls
            element={element}
            onChange={onChange}
            openPanel={openPanel}
            onToggle={togglePanel}
          />
        ) : hasChartControls &&
          element &&
          onChartChange &&
          isTemplateV2ChartToolbarElement(element) ? (
          <ChartToolbarControls
            element={element}
            paletteOpen={openPanel === "chart-colors"}
            onChange={onChartChange}
            onEdit={
              onChartEdit
                ? () => {
                    setOpenPanel(null);
                    onChartEdit();
                  }
                : undefined
            }
            onPaletteOpenChange={(open) => setPanelOpen("chart-colors", open)}
          />
        ) : hasTableControls &&
          element &&
          onTableChange &&
          isTemplateV2TableToolbarElement(element) ? (
          <TableToolbarControls
            element={element}
            index={0}
            selectedCell={
              selectedTableCell
                ? {
                    elementIndex: 0,
                    rowIndex: selectedTableCell.rowIndex,
                    colIndex: selectedTableCell.colIndex,
                  }
                : null
            }
            onChange={(_index, element) => onTableChange(element)}
          />
        ) : null}
        {componentActions ? (
          <>
            {hasToolbarControls ? <ToolbarDivider /> : null}
            <ComponentActionsMenu
              actions={componentActions}
              open={openPanel === "component-menu"}
              onOpenChange={(open) => setPanelOpen("component-menu", open)}
            />
          </>
        ) : null}
      </div>
    </FloatingToolbarBoundsProvider>
  );

  return position && typeof document !== "undefined"
    ? createPortal(toolbar, document.body)
    : toolbar;
}

function normalizedLayoutType(element: TemplateV2ToolbarElement) {
  if (element.type === "list-view") return "flex";
  if (element.type === "grid-view") return "grid";
  if (isTemplateV2LayoutElement(element)) return element.type;
  return null;
}


export function isTemplateV2LayoutElement(
  element: RawRecord | TemplateV2ToolbarElement | null | undefined,
): element is TemplateV2LayoutElement {
  return (
    element?.type === "container" ||
    isTemplateV2FlowLayoutElement(element)
  );
}

export function isTemplateV2FlowLayoutElement(
  element: RawRecord | TemplateV2ToolbarElement | null | undefined,
): element is TemplateV2LayoutElement {
  return (
    element?.type === "flex" ||
    element?.type === "grid" ||
    element?.type === "list-view" ||
    element?.type === "grid-view" ||
    Boolean(element && isFlowLayoutElement(element as RawRecord))
  );
}

export function isTemplateV2GroupElement(
  element: RawRecord | TemplateV2ToolbarElement | null | undefined,
): element is TemplateV2LayoutElement {
  return element?.type === "group";
}

export function isTemplateV2ChartToolbarElement(
  element: RawRecord | TemplateV2ToolbarElement | null | undefined,
): element is ChartSlideElement {
  return element?.type === "chart";
}

export function isTemplateV2TableToolbarElement(
  element: RawRecord | TemplateV2ToolbarElement | null | undefined,
): element is TableSlideElement {
  return element?.type === "table";
}
