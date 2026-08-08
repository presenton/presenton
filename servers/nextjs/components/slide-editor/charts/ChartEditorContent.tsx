import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Layer, Stage } from "react-konva";
import {
  BarChart3,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  GripVertical,
  MoreVertical,
  Pencil,
  Plus,
  Settings,
  Trash2,
  Type,
  X,
} from "lucide-react";
import { DeferredColorInput } from "@/components/slide-editor/toolbar/DeferredColorInput";
import {
  numericInputMode,
  preventInvalidNumberInput,
  sanitizeNumericInput,
} from "@/components/slide-editor/toolbar/numericInput";
import {
  CHART_TEXT_MAX_LENGTH,
  DEFAULT_CHART_COLORS,
  appendChartColorTarget,
  chartColorTargetMode,
  chartDataFromSeriesWithColors,
  chartSupportsMultipleSeries,
  ellipsizeChartText,
  extendChartColors,
  limitChartText,
  resolvedChartColorTargets,
  resolvedChartCategories,
  updateChartColorTarget,
} from "@/components/slide-editor/charts/chart-data";
import {
  EDITOR_STAGE_HEIGHT,
  EDITOR_STAGE_WIDTH,
  type ChartElement,
  type ChartSeries,
  type ChartType,
  type DataLabelPosition,
} from "@/components/slide-editor/types";
import { ChartColorPaletteCard } from "@/components/slide-editor/charts/ChartColorPalette";
import { TemplateV2ChartJsElement } from "@/components/slide-editor/charts/TemplateV2ChartJsElement";

const CHART_TYPES: Array<{ label: string; value: ChartType }> = [
  { label: "Bar Chart", value: "bar" },
  { label: "Horizontal Bar", value: "horizontal_bar" },
  { label: "Stacked Bar", value: "stacked_bar" },
  { label: "Horizontal Stack Bar", value: "horizontal_stacked_bar" },
  { label: "Line Chart", value: "line" },
  { label: "Area Chart", value: "area" },
  { label: "Pie Chart", value: "pie" },
  { label: "Donut Chart", value: "donut" },
  { label: "Scatter Chart", value: "scatter" },
  { label: "Radar Chart", value: "radar" },
  { label: "Polar Area", value: "polar_area" },
];
const DATA_LABEL_TABS: Array<{
  label: string;
  value: DataLabelPosition;
}> = [
  { label: "Base", value: "base" },
  { label: "Middle", value: "mid" },
  { label: "Top", value: "top" },
  { label: "Outside", value: "outside" },
];
const DATA_MODAL_CHART_PREVIEW_WIDTH = 215;
const DATA_MODAL_CHART_PREVIEW_HEIGHT = 180;
const DATA_MODAL_MAX_HEIGHT = "min(650px, calc(100dvh - 32px))";

export function ChartEditorContent({
  chart,
  chartPath,
  onChange,
  onClose,
}: {
  chart: ChartElement;
  chartPath?: string | null;
  onChange: (chart: ChartElement) => void;
  onClose?: () => void;
}) {
  const [tab, setTab] = useState<"data" | "customize">("data");
  const [dataModalOpen, setDataModalOpen] = useState(false);

  return (
    <>
      <div
        data-inline-edit-ignore="true"
        className="h-full overflow-y-auto px-5 pb-8 pt-6 font-syne hide-scrollbar"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="mb-6 flex items-center justify-between gap-4">
          <h3 className="text-[15px] font-semibold leading-5 text-[#101323]">
            Edit Charts
          </h3>
          {onClose ? (
            <button
              type="button"
              aria-label="Close chart editor"
              className="grid h-8 w-8 place-items-center rounded-full text-[#191919] transition hover:bg-[#F5F5F7]"
              onClick={onClose}
            >
              <X size={17} strokeWidth={2} />
            </button>
          ) : null}
        </div>

        <label className="mb-2 block text-[12px] font-medium text-[#686873]">
          Chart type
        </label>
        <ChartTypeSelect
          value={chart.chart_type}
          onChange={(chartType) =>
            onChange({ ...chart, chart_type: chartType })
          }
        />

        <div className="mt-6 border-t border-[#ECECF1]">
          <div className="grid grid-cols-2">
            <button
              type="button"
              className={`h-12 border-b-2 text-[13px] font-medium transition ${tab === "data"
                ? "border-[#7C51F8] text-[#191919]"
                : "border-transparent text-[#191919]"
                }`}
              onClick={() => setTab("data")}
            >
              Data
            </button>
            <button
              type="button"
              className={`h-12 border-b-2 text-[13px] font-medium transition ${tab === "customize"
                ? "border-[#7C51F8] text-[#191919]"
                : "border-transparent text-[#191919]"
                }`}
              onClick={() => setTab("customize")}
            >
              Customize
            </button>
          </div>

          {tab === "data" ? (
            <ChartDataPanel
              chart={chart}
              onOpenDataModal={() => setDataModalOpen(true)}
            />
          ) : (
            <ChartCustomizePanel chart={chart} onChange={onChange} />
          )}
        </div>
      </div>

      {dataModalOpen ? (
        <ChartDataEditorPopover
          chart={chart}
          chartPath={chartPath ?? "chart"}
          onChange={onChange}
          onClose={() => setDataModalOpen(false)}
        />
      ) : null}
    </>
  );
}

function ChartTypeSelect({
  compact = false,
  value,
  onChange,
}: {
  compact?: boolean;
  value: ChartType;
  onChange: (value: ChartType) => void;
}) {
  return (
    <div className="relative">
      <BarChart3 className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#191919]" />
      <select
        aria-label="Chart type"
        className={`${compact ? "h-9 rounded-lg pl-10 pr-9 text-[12px]" : "h-12 rounded-xl pl-11 pr-10 text-[13px]"} w-full appearance-none border border-[#E6E6EA] bg-white font-medium text-[#191919] outline-none transition focus:border-[#7C51F8]`}
        value={value}
        onChange={(event) => onChange(event.target.value as ChartType)}
      >
        {CHART_TYPES.map((item) => (
          <option key={item.value} value={item.value}>
            {item.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#191919]" />
    </div>
  );
}

function DataLabelsControl({
  value,
  onChange,
}: {
  value: DataLabelPosition | null;
  onChange: (value: DataLabelPosition | null) => void;
}) {
  const enabled = value != null;
  const [lastPosition, setLastPosition] = useState<DataLabelPosition>(
    value ?? "top",
  );
  const activePosition = value ?? lastPosition;

  useEffect(() => {
    if (value) {
      setLastPosition(value);
    }
  }, [value]);

  const setEnabled = (checked: boolean) => {
    onChange(checked ? activePosition : null);
  };

  const selectPosition = (position: DataLabelPosition) => {
    setLastPosition(position);
    onChange(position);
  };

  return (
    <div className="space-y-2">
      <div className="flex min-h-6 items-center justify-between gap-3 text-[12px] font-medium text-[#191919]">
        <span>Data labels</span>
        <CompactSwitch
          checked={enabled}
          label="Data labels"
          onChange={setEnabled}
        />
      </div>
      <div
        role="tablist"
        aria-label="Data label position"
        className={`grid grid-cols-4 rounded-lg bg-[#F3F4F7] p-1 transition ${enabled ? "" : "opacity-55"}`}
      >
        {DATA_LABEL_TABS.map((item) => {
          const active = activePosition === item.value;

          return (
            <button
              key={item.value}
              type="button"
              role="tab"
              aria-selected={active && enabled}
              disabled={!enabled}
              className={`h-8 rounded-md px-1 text-[12px] font-semibold transition ${active && enabled
                ? "bg-white text-[#191919] shadow-sm"
                : "text-[#686873] hover:text-[#191919]"
                } disabled:cursor-not-allowed disabled:hover:text-[#686873]`}
              onClick={() => selectPosition(item.value)}
            >
              {item.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ChartDataPanel({
  chart,
  onOpenDataModal,
}: {
  chart: ChartElement;
  onOpenDataModal: () => void;
}) {
  const categories = safeCategoriesForChart(chart);
  const series = normalizedSeries(chart, categories.length);

  return (
    <div className="space-y-5 pt-5">
      <MiniDataTable categories={categories} series={series} />
      <button
        type="button"
        className="flex h-10 w-full items-center justify-center gap-2 rounded-full border border-[#E6E6EA] bg-white px-4 text-[12px] font-semibold text-[#191919] transition hover:bg-[#F7F7FA]"
        onClick={onOpenDataModal}
      >
        <Pencil size={15} strokeWidth={2} />
        Edit data
      </button>
    </div>
  );
}

function MiniDataTable({
  categories,
  series,
}: {
  categories: string[];
  series: ChartSeries[];
}) {
  const visibleSeries = series.slice(0, 2);
  return (
    <div className="overflow-hidden rounded-xl bg-[#F7F7FA]">
      <div className="max-h-[210px] overflow-auto">
        <table className="min-w-full border-collapse text-[12px] text-[#191919]">
          <thead>
            <tr>
              <th className="sticky left-0 top-0 min-w-[110px] border-b border-r border-[#E6E6EA] bg-[#F3F4F7] px-3 py-3 text-left font-medium" />
              {visibleSeries.map((item) => (
                <th
                  key={item.name}
                  className="min-w-[120px] max-w-[180px] border-b border-r border-[#E6E6EA] bg-[#F3F4F7] px-3 py-3 text-left font-medium"
                  title={item.name}
                >
                  <span className="block truncate">
                    {ellipsizeChartText(item.name)}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {categories.slice(0, 5).map((category, rowIndex) => (
              <tr key={`${category}-${rowIndex}`}>
                <td
                  className="sticky left-0 max-w-[180px] border-b border-r border-[#E6E6EA] bg-[#F7F7FA] px-3 py-3 font-medium"
                  title={category}
                >
                  <span className="block truncate">
                    {ellipsizeChartText(category)}
                  </span>
                </td>
                {visibleSeries.map((item, seriesIndex) => (
                  <td
                    key={`${item.name}-${seriesIndex}`}
                    className="border-b border-r border-[#E6E6EA] bg-white px-3 py-3"
                  >
                    {item.values[rowIndex] ?? 0}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ChartCustomizePanel({
  chart,
  compact = false,
  defaultTextOpen = true,
  onChange,
}: {
  chart: ChartElement;
  compact?: boolean;
  defaultTextOpen?: boolean;
  onChange: (chart: ChartElement) => void;
}) {
  const hasCartesianAxes =
    chart.chart_type !== "pie" &&
    chart.chart_type !== "donut" &&
    chart.chart_type !== "polar_area" &&
    chart.chart_type !== "radar";
  const hasRadialAxes = chart.chart_type === "radar";
  const hasAxes = hasCartesianAxes || hasRadialAxes;
  const showLegend = chart.legend ?? defaultChartLegendVisible(chart);

  return (
    <div className="space-y-1 py-2">
      <AccordionSection
        compact={compact}
        defaultOpen={defaultTextOpen}
        icon={<Type size={17} />}
        label="Text"
      >
        <TextField
          label="Title"
          placeholder="Chart title"
          value={chart.title ?? ""}
          onChange={(title) => onChange({ ...chart, title: title || null })}
        />
        <ColorRow
          label="Title color"
          value={chart.title_color ?? "344054"}
          onChange={(titleColor) =>
            onChange({ ...chart, title_color: titleColor })
          }
        />
        <DataLabelsControl
          value={chart.data_labels ?? null}
          onChange={(dataLabels) =>
            onChange({ ...chart, data_labels: dataLabels })
          }
        />
      </AccordionSection>

      {hasCartesianAxes ? (
        <>
          <AccordionSection
            compact={compact}
            icon={<BarChart3 size={17} />}
            label="X Axis"
          >
            <ToggleRow
              checked={chart.x_axis ?? true}
              label="Show axis"
              onChange={(xAxis) => onChange({ ...chart, x_axis: xAxis })}
            />
            <TextField
              label="Title"
              placeholder="X-axis title"
              value={chart.x_axis_title ?? ""}
              onChange={(xAxisTitle) =>
                onChange({ ...chart, x_axis_title: xAxisTitle || null })
              }
            />
            <ToggleRow
              checked={chart.x_axis_grid ?? true}
              label="Show grid"
              onChange={(xAxisGrid) =>
                onChange({ ...chart, x_axis_grid: xAxisGrid })
              }
            />
          </AccordionSection>
          <AccordionSection
            compact={compact}
            icon={<BarChart3 size={17} />}
            label="Y Axis"
          >
            <ToggleRow
              checked={chart.y_axis ?? true}
              label="Show axis"
              onChange={(yAxis) => onChange({ ...chart, y_axis: yAxis })}
            />
            <TextField
              label="Title"
              placeholder="Y-axis title"
              value={chart.y_axis_title ?? ""}
              onChange={(yAxisTitle) =>
                onChange({ ...chart, y_axis_title: yAxisTitle || null })
              }
            />
            <ToggleRow
              checked={chart.y_axis_grid ?? true}
              label="Show grid"
              onChange={(yAxisGrid) =>
                onChange({ ...chart, y_axis_grid: yAxisGrid })
              }
            />
          </AccordionSection>
        </>
      ) : null}

      {hasRadialAxes ? (
        <>
          <AccordionSection
            compact={compact}
            icon={<BarChart3 size={17} />}
            label="X Axis"
          >
            <ToggleRow
              checked={chart.x_axis ?? true}
              label="Category labels"
              onChange={(xAxis) => onChange({ ...chart, x_axis: xAxis })}
            />
            <ToggleRow
              checked={chart.x_axis_grid ?? true}
              label="Spokes"
              onChange={(xAxisGrid) =>
                onChange({ ...chart, x_axis_grid: xAxisGrid })
              }
            />
          </AccordionSection>
          <AccordionSection
            compact={compact}
            icon={<BarChart3 size={17} />}
            label="Y Axis"
          >
            <ToggleRow
              checked={chart.y_axis ?? true}
              label="Value labels"
              onChange={(yAxis) => onChange({ ...chart, y_axis: yAxis })}
            />
            <ToggleRow
              checked={chart.y_axis_grid ?? true}
              label="Rings"
              onChange={(yAxisGrid) =>
                onChange({ ...chart, y_axis_grid: yAxisGrid })
              }
            />
          </AccordionSection>
        </>
      ) : null}

      <AccordionSection
        compact={compact}
        icon={<Settings size={17} />}
        label="Settings"
      >
        <ToggleRow
          checked={showLegend}
          label="Show legend"
          onChange={(legend) => onChange({ ...chart, legend })}
        />
        {showLegend ? (
          <ColorRow
            label="Legend color"
            value={chart.legend_color ?? "475467"}
            onChange={(legendColor) =>
              onChange({ ...chart, legend_color: legendColor })
            }
          />
        ) : null}
        <ChartSeriesColorControls chart={chart} onChange={onChange} />
        {hasAxes ? (
          <>
            <ColorRow
              label="Axis color"
              value={chart.axis_color ?? "9AA7BD"}
              onChange={(axisColor) =>
                onChange({ ...chart, axis_color: axisColor })
              }
            />
            <ColorRow
              label="Grid color"
              value={chart.grid_color ?? chart.axis_color ?? "D0D5DD"}
              onChange={(gridColor) =>
                onChange({ ...chart, grid_color: gridColor })
              }
            />
          </>
        ) : null}
      </AccordionSection>
    </div>
  );
}

function defaultChartLegendVisible(chart: ChartElement) {
  const series = chart.series ?? [];
  return (
    chart.chart_type === "pie" ||
    chart.chart_type === "donut" ||
    series.length > 1 ||
    Boolean(series[0]?.name && series[0].name !== "Series 1")
  );
}

function ChartSeriesColorControls({
  chart,
  onChange,
}: {
  chart: ChartElement;
  onChange: (chart: ChartElement) => void;
}) {
  const [paletteAnchor, setPaletteAnchor] = useState<{
    index: number;
    rect: DOMRect;
  } | null>(null);
  const swatchRefs = useRef(new Map<number, HTMLButtonElement>());
  const targets = resolvedChartColorTargets(chart);
  const openTarget = paletteAnchor
    ? targets.find((target) => target.index === paletteAnchor.index)
    : null;

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {targets.map((target) => (
          <button
            type="button"
            key={`${target.mode}-${target.index}`}
            aria-label={`Change chart color ${target.index + 1}`}
            className={`grid h-8 w-8 place-items-center rounded-full border bg-white p-1 transition ${paletteAnchor?.index === target.index
              ? "border-[#7C51F8] ring-2 ring-[#E9E2FF]"
              : "border-[#E6E6EA] hover:border-[#B8A3F8]"
              }`}
            ref={(node) => {
              if (node) {
                swatchRefs.current.set(target.index, node);
              } else {
                swatchRefs.current.delete(target.index);
              }
            }}
            title={`Chart color ${target.index + 1}`}
            onClick={() =>
              setPaletteAnchor((current) => {
                if (current?.index === target.index) return null;
                const anchor = swatchRefs.current.get(target.index);
                return anchor
                  ? { index: target.index, rect: anchor.getBoundingClientRect() }
                  : null;
              })
            }
          >
            <span
              aria-hidden="true"
              className="h-full w-full rounded-full border border-black/10"
              style={{ backgroundColor: `#${target.color}` }}
            />
          </button>
        ))}
        {targets.length < 12 ? (
          <button
            type="button"
            aria-label="Add chart color"
            className="grid h-8 w-8 place-items-center rounded-full border border-dashed border-[#B8A3F8] bg-white text-[#7C51F8] transition hover:bg-[#F7F3FF]"
            title="Add chart color"
            onClick={() => onChange(appendChartColorTarget(chart))}
          >
            <Plus size={15} strokeWidth={2.2} />
          </button>
        ) : null}
      </div>
      {openTarget && paletteAnchor && typeof document !== "undefined"
        ? createPortal(
          <ChartColorPaletteCard
            colors={targets.map((target) => target.color)}
            onAddColor={() => {
              onChange(appendChartColorTarget(chart));
              setPaletteAnchor(null);
            }}
            onChange={(color) =>
              onChange(updateChartColorTarget(chart, openTarget.index, color))
            }
            onClose={() => setPaletteAnchor(null)}
            onSelectIndex={(index) =>
              setPaletteAnchor((current) =>
                current ? { ...current, index } : current,
              )
            }
            selectedIndex={openTarget.index}
            style={chartPalettePortalStyle(paletteAnchor.rect)}
          />,
          document.body,
        )
        : null}
    </div>
  );
}

function chartPalettePortalStyle(anchorRect: DOMRect) {
  const width = 296;
  const estimatedHeight = 330;
  const margin = 12;
  const gap = 8;
  const viewportWidth =
    typeof window === "undefined" ? anchorRect.right + width : window.innerWidth;
  const viewportHeight =
    typeof window === "undefined"
      ? anchorRect.bottom + estimatedHeight + margin
      : window.innerHeight;
  const spaceBelow = viewportHeight - anchorRect.bottom - margin;
  const spaceAbove = anchorRect.top - margin;
  const shouldOpenAbove =
    spaceBelow < estimatedHeight && spaceAbove > spaceBelow;
  const preferredTop = shouldOpenAbove
    ? anchorRect.top - estimatedHeight - gap
    : anchorRect.bottom + gap;
  const top = Math.max(
    margin,
    Math.min(preferredTop, viewportHeight - estimatedHeight - margin),
  );

  return {
    position: "fixed" as const,
    left: Math.max(12, Math.min(anchorRect.right - width, viewportWidth - width - 12)),
    top,
    maxHeight: Math.max(180, viewportHeight - top - margin),
    overflowY: "auto" as const,
    zIndex: 10020,
  };
}

function AccordionSection({
  children,
  compact = false,
  defaultOpen = false,
  icon,
  label,
}: {
  children: ReactNode;
  compact?: boolean;
  defaultOpen?: boolean;
  icon: ReactNode;
  label: string;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <details
      className="group"
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary
        className={`${compact ? "h-9 gap-2 px-2 text-[12px]" : "h-12 gap-3 px-3 text-[13px]"} flex cursor-pointer list-none items-center rounded-lg font-medium text-[#191919] transition hover:bg-[#F7F7FA] group-open:bg-[#F7F7FA] [&::-webkit-details-marker]:hidden`}
      >
        <span className={`${compact ? "h-5 w-5 [&>svg]:h-3.5 [&>svg]:w-3.5" : "h-6 w-6"} grid shrink-0 place-items-center text-[#191919]`}>
          {icon}
        </span>
        <span className="min-w-0 flex-1">{label}</span>
        <ChevronDown className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180" />
      </summary>
      <div className={`${compact ? "px-2 pb-3 pt-2" : "px-3 pb-4 pt-3"} space-y-3`}>
        {children}
      </div>
    </details>
  );
}

function TextField({
  label,
  onChange,
  placeholder,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  placeholder?: string;
  value: string;
}) {
  const [draftValue, setDraftValue] = useState(() => limitChartText(value));

  useEffect(() => {
    setDraftValue(limitChartText(value));
  }, [value]);

  const commitValue = () => {
    const nextValue = limitChartText(draftValue);
    if (nextValue !== draftValue) {
      setDraftValue(nextValue);
    }
    if (nextValue !== value) {
      onChange(nextValue);
    }
  };

  return (
    <label className="block text-[12px] font-medium text-[#686873]">
      {label}
      <input
        className="mt-1.5 h-9 w-full truncate rounded-lg border border-[#E6E6EA] bg-white px-3 text-[12px] text-[#191919] outline-none transition placeholder:text-[#A6A6AF] focus:border-[#7C51F8]"
        maxLength={CHART_TEXT_MAX_LENGTH}
        placeholder={placeholder}
        spellCheck={false}
        value={draftValue}
        onBlur={commitValue}
        onChange={(event) => setDraftValue(limitChartText(event.target.value))}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.currentTarget.blur();
          }
        }}
      />
    </label>
  );
}

function ToggleRow({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex min-h-6 items-center justify-between gap-3 text-[12px] font-medium text-[#191919]">
      <span>{label}</span>
      <CompactSwitch checked={checked} label={label} onChange={onChange} />
    </div>
  );
}

function CompactSwitch({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={`relative h-5 w-9 shrink-0 rounded-full transition ${checked ? "bg-[#7C51F8]" : "bg-[#D8D8DE]"
        }`}
      onClick={() => onChange(!checked)}
    >
      <span
        className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${checked ? "translate-x-4" : "translate-x-0"
          }`}
      />
    </button>
  );
}

function ColorRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3 text-[12px] font-medium text-[#191919]">
      {label}
      <DeferredColorInput
        className="h-8 w-11 rounded-lg border border-[#E6E6EA] bg-white p-1"
        value={value}
        onCommit={onChange}
      />
    </label>
  );
}

export function ChartDataEditorPopover({
  chart,
  chartPath,
  onChange,
  onClose,
}: {
  chart: ChartElement;
  chartPath: string;
  onChange: (chart: ChartElement) => void;
  onClose: () => void;
}) {
  if (typeof document === "undefined") return null;

  return createPortal(
    <ChartDataModal
      chart={chart}
      chartPath={chartPath}
      onChange={onChange}
      onClose={onClose}
    />,
    document.body,
  );
}

function ChartDataModal({
  chart,
  chartPath,
  onChange,
  onClose,
}: {
  chart: ChartElement;
  chartPath: string;
  onChange: (chart: ChartElement) => void;
  onClose: () => void;
}) {
  const [draftChart, setDraftChart] = useState<ChartElement>(() => chart);
  const categories = safeCategoriesForChart(draftChart);
  const series = normalizedSeries(draftChart, categories.length);
  const previewChart = useMemo(
    () => chartPreviewElement(draftChart),
    [draftChart],
  );

  const updateData = (
    nextCategories: string[],
    nextSeries: ChartSeries[],
    nextColors = draftChart.colors ?? [],
  ) => {
    setDraftChart((currentChart) => {
      const normalizedCategories = nextCategories.slice(0, 24);
      const limitedCategories = normalizedCategories.map(limitChartText);
      const normalized = nextSeries
        .map((item) => ({
          name: limitChartText(item.name ?? ""),
          values: normalizeValues(item.values, limitedCategories.length),
        }))
        .slice(
          0,
          chartSupportsMultipleSeries(currentChart.chart_type) ? 12 : 1,
        );
      const colorMode = chartColorTargetMode({
        ...currentChart,
        categories: limitedCategories,
        series: normalized,
      });
      const minimumColorCount = Math.max(
        1,
        nextColors.length,
        currentChart.colors?.length ?? 0,
        colorMode === "series" ? normalized.length : 1,
      );
      const colors = extendChartColors(
        nextColors.length > 0 ? nextColors : currentChart.colors,
        minimumColorCount,
        currentChart.color ?? DEFAULT_CHART_COLORS[0],
      );

      return {
        ...currentChart,
        categories: limitedCategories,
        color: colors[0] ?? currentChart.color,
        series: normalized,
        colors,
        data: chartDataFromSeriesWithColors(
          limitedCategories,
          normalized,
          colors,
          colorMode === "category",
        ),
      };
    });
  };

  return (
    <div
      data-inline-edit-ignore="true"
      className="fixed inset-0 z-[10010] flex items-center justify-center bg-black/35 p-4 pr-[72px] font-syne"
      onMouseDown={(event) => event.stopPropagation()}
    >
      <div
        className="relative flex w-full max-w-[1080px] flex-col overflow-visible"
        style={{
          height: DATA_MODAL_MAX_HEIGHT,
          maxHeight: DATA_MODAL_MAX_HEIGHT,
        }}
      >
        <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl bg-white shadow-[0_24px_80px_rgba(16,24,40,0.24)]">
          <header className="flex h-[70px] shrink-0 items-center justify-between border-b border-[#ECECF1] px-5">
            <div>
              <h2 className="text-[15px] font-semibold text-[#191919]">
                Edit Data Table
              </h2>
              <p className="mt-1 text-[11px] text-[#8B8B94]">
                Edit Data Table
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="flex h-8 items-center gap-1.5 rounded-full border border-[#E6E6EA] bg-white px-4 text-[12px] font-semibold text-[#191919] transition hover:bg-[#F7F7FA]"
                onClick={() =>
                  setDraftChart((currentChart) =>
                    clearChartData(currentChart),
                  )
                }
              >
                <Trash2 size={14} strokeWidth={2} />
                Clear data
              </button>
              <button
                type="button"
                className="h-8 min-w-[76px] rounded-full bg-[linear-gradient(100deg,#FFE6A6_0%,#D8B4FE_100%)] px-5 text-[12px] font-semibold text-[#191919] transition hover:brightness-95"
                onClick={() => {
                  onChange(sanitizeChartTextFields(draftChart));
                  onClose();
                }}
              >
                Save
              </button>
            </div>
          </header>

          <div className="flex min-h-0 flex-1 overflow-hidden">
            <aside className="min-h-0 w-[255px] shrink-0 overflow-y-auto overscroll-contain border-r border-[#ECECF1] px-4 py-4 hide-scrollbar">
              <label className="mb-2 block text-[12px] font-medium text-[#191919]">
                Charts
              </label>
              <ChartTypeSelect
                compact
                value={draftChart.chart_type}
                onChange={(chartType) =>
                  setDraftChart((currentChart) => ({
                    ...currentChart,
                    chart_type: chartType,
                  }))
                }
              />
              <div
                className="relative mt-4 flex h-[210px] items-center justify-center overflow-hidden rounded-lg border border-[#ECECF1] bg-[#F8F8FA]"
                style={{
                  backgroundImage: "url('/card_bg.svg')",
                  backgroundPosition: "center",
                  backgroundSize: "100% 100%",
                }}
              >
                <div
                  className="pointer-events-none relative overflow-hidden"
                  style={{
                    height: DATA_MODAL_CHART_PREVIEW_HEIGHT,
                    width: DATA_MODAL_CHART_PREVIEW_WIDTH,
                  }}
                >
                  <Stage
                    height={DATA_MODAL_CHART_PREVIEW_HEIGHT}
                    width={DATA_MODAL_CHART_PREVIEW_WIDTH}
                  >
                    <Layer listening={false}>
                      <TemplateV2ChartJsElement
                        element={previewChart}
                        height={DATA_MODAL_CHART_PREVIEW_HEIGHT}
                        interactive={false}
                        width={DATA_MODAL_CHART_PREVIEW_WIDTH}
                      />
                    </Layer>
                  </Stage>
                </div>
              </div>
              <div className="mt-2">
                <ChartCustomizePanel
                  chart={draftChart}
                  compact
                  defaultTextOpen={false}
                  onChange={setDraftChart}
                />
              </div>
            </aside>

            <main className="min-h-0 min-w-0 flex-1 overflow-auto overscroll-contain px-8 py-5">
              <EditableDataTable
                allowMultipleSeries={chartSupportsMultipleSeries(
                  draftChart.chart_type,
                )}
                categories={categories}
                chartPath={chartPath}
                series={series}
                colors={draftChart.colors ?? []}
                fallbackColor={draftChart.color}
                onUpdate={updateData}
              />
            </main>
          </div>
        </div>
        <button
          type="button"
          aria-label="Close data editor"
          className="absolute -right-14 top-0 grid h-11 w-11 place-items-center rounded-full bg-white text-[#191919] shadow-sm transition hover:bg-[#F7F7FA]"
          onClick={onClose}
        >
          <X size={18} />
        </button>
      </div>
    </div>
  );
}

function EditableDataTable({
  allowMultipleSeries,
  categories,
  chartPath,
  onUpdate,
  series,
  colors,
  fallbackColor,
}: {
  allowMultipleSeries: boolean;
  categories: string[];
  fallbackColor?: string | null;
  chartPath: string;
  onUpdate: (
    categories: string[],
    series: ChartSeries[],
    colors?: string[],
  ) => void;
  series: ChartSeries[];
  colors: string[];
}) {
  const safeCategories = categories.length > 0 ? categories : ["Item 1"];
  const safeSeries =
    series.length > 0
      ? series
      : [
        {
          name: "Series 1",
          values: normalizeValues([], safeCategories.length),
        },
      ];
  const tableRootRef = useRef<HTMLDivElement | null>(null);
  const [seriesMenu, setSeriesMenu] = useState<{
    index: number;
    left: number;
  } | null>(null);
  const [columnMenuOpen, setColumnMenuOpen] = useState(false);
  const [selectedRowIndex, setSelectedRowIndex] = useState(0);
  const [valueDrafts, setValueDrafts] = useState<Record<string, string>>({});
  const selectedSeriesIndex = seriesMenu
    ? Math.min(seriesMenu.index, safeSeries.length - 1)
    : null;
  const selectedSeries =
    selectedSeriesIndex == null ? null : safeSeries[selectedSeriesIndex];
  const chartValueInputOptions = {
    allowDecimal: true,
    allowNegative: true,
  };
  const categoryColumnWidth = 160;
  const seriesColumnWidth = 190;
  const actionColumnWidth = 48;
  const minimumTableWidth =
    categoryColumnWidth +
    safeSeries.length * seriesColumnWidth +
    actionColumnWidth;
  const dataGridTemplateColumns = `${categoryColumnWidth}px repeat(${safeSeries.length}, minmax(${seriesColumnWidth}px, 1fr)) ${actionColumnWidth}px`;

  const updateCategory = (rowIndex: number, value: string) => {
    const nextValue = limitChartText(value);
    onUpdate(
      safeCategories.map((category, index) =>
        index === rowIndex ? nextValue : category,
      ),
      safeSeries,
      colors,
    );
  };
  const updateSeriesName = (seriesIndex: number, name: string) => {
    const nextName = limitChartText(name);
    onUpdate(
      safeCategories,
      safeSeries.map((item, index) =>
        index === seriesIndex ? { ...item, name: nextName } : item,
      ),
      colors,
    );
  };
  const updateValue = (
    seriesIndex: number,
    rowIndex: number,
    value: string,
  ) => {
    const numeric = Number(value);
    onUpdate(
      safeCategories,
      safeSeries.map((item, index) =>
        index === seriesIndex
          ? {
            ...item,
            values: item.values.map((current, valueIndex) =>
              valueIndex === rowIndex && Number.isFinite(numeric)
                ? numeric
                : current,
            ),
          }
          : item,
      ),
      colors,
    );
  };
  const updateValueDraft = (
    seriesIndex: number,
    rowIndex: number,
    value: string,
  ) => {
    const key = `${seriesIndex}:${rowIndex}`;
    setValueDrafts((current) => ({ ...current, [key]: value }));
    if (isCompleteNumericInput(value)) {
      updateValue(seriesIndex, rowIndex, value);
    }
  };
  const clearValueDrafts = () => setValueDrafts({});
  const addRow = () => {
    const nextCategories = [
      ...safeCategories,
      `Item ${safeCategories.length + 1}`,
    ];
    onUpdate(
      nextCategories,
      safeSeries.map((item) => ({
        ...item,
        values: [...item.values, 0],
      })),
      colors,
    );
    clearValueDrafts();
  };
  const deleteRow = (rowIndex: number) => {
    if (safeCategories.length <= 1) return;

    onUpdate(
      safeCategories.filter((_, index) => index !== rowIndex),
      safeSeries.map((item) => ({
        ...item,
        values: item.values.filter((_, index) => index !== rowIndex),
      })),
      colors,
    );
    setSelectedRowIndex((current) =>
      Math.max(0, Math.min(current, safeCategories.length - 2)),
    );
    clearValueDrafts();
  };
  const addSeries = () => {
    const nextSeries = [
      ...safeSeries,
      {
        name: `Series ${safeSeries.length + 1}`,
        values: normalizeValues([], safeCategories.length),
      },
    ];
    onUpdate(
      safeCategories,
      nextSeries,
      extendChartColors(colors, nextSeries.length, fallbackColor),
    );
    clearValueDrafts();
  };
  const deleteSeries = (seriesIndex: number) => {
    if (safeSeries.length <= 1) return;
    onUpdate(
      safeCategories,
      safeSeries.filter((_, index) => index !== seriesIndex),
      colors,
    );
    setSeriesMenu(null);
    setColumnMenuOpen(false);
    clearValueDrafts();
  };
  const moveSeries = (seriesIndex: number, direction: -1 | 1) => {
    const targetIndex = seriesIndex + direction;
    if (targetIndex < 0 || targetIndex >= safeSeries.length) return;
    const nextSeries = [...safeSeries];
    const [movedSeries] = nextSeries.splice(seriesIndex, 1);
    if (!movedSeries) return;
    nextSeries.splice(targetIndex, 0, movedSeries);
    const nextColors = [...colors];
    if (nextColors[seriesIndex] != null && nextColors[targetIndex] != null) {
      const [movedColor] = nextColors.splice(seriesIndex, 1);
      if (movedColor != null) nextColors.splice(targetIndex, 0, movedColor);
    }
    onUpdate(safeCategories, nextSeries, nextColors);
    setSeriesMenu(null);
    setColumnMenuOpen(false);
    clearValueDrafts();
  };
  const showSeriesMenu = (seriesIndex: number, node: HTMLElement) => {
    const root = tableRootRef.current;
    if (!root) return;
    const rootRect = root.getBoundingClientRect();
    const columnRect = node.getBoundingClientRect();
    const desiredLeft = columnRect.left + columnRect.width / 2 - rootRect.left;
    if (seriesMenu?.index !== seriesIndex) setColumnMenuOpen(false);
    setSeriesMenu({
      index: seriesIndex,
      left: Math.max(116, Math.min(desiredLeft, rootRect.width - 116)),
    });
  };

  return (
    <div
      ref={tableRootRef}
      className="relative w-full px-4 pb-4 pt-10"
      onMouseLeave={() => {
        setSeriesMenu(null);
        setColumnMenuOpen(false);
      }}
    >
      {selectedSeries && seriesMenu && selectedSeriesIndex != null ? (
        <div
          className="absolute top-0 z-20 flex h-8 w-[168px] -translate-x-1/2 items-center overflow-hidden rounded-xl border border-[#E6E6EA] bg-white pl-3 pr-1 text-[#191919] shadow-[0_3px_12px_rgba(16,24,40,0.10)]"
          style={{ left: seriesMenu.left }}
        >
          <input
            className="h-full min-w-0 flex-1 truncate bg-transparent text-[12px] font-medium outline-none"
            maxLength={CHART_TEXT_MAX_LENGTH}
            spellCheck={false}
            value={selectedSeries.name}
            onChange={(event) =>
              updateSeriesName(selectedSeriesIndex, event.target.value)
            }
          />
          <button
            type="button"
            aria-label="Delete selected series"
            className="grid h-7 w-7 shrink-0 place-items-center border-l border-[#ECECF1] text-[#191919] disabled:cursor-not-allowed disabled:opacity-30"
            disabled={safeSeries.length <= 1}
            onClick={() => deleteSeries(selectedSeriesIndex)}
          >
            <Trash2 size={13} strokeWidth={2} />
          </button>
          <button
            type="button"
            aria-expanded={columnMenuOpen}
            aria-label="More column actions"
            className="grid h-7 w-5 shrink-0 place-items-center text-[#191919]"
            onClick={() => setColumnMenuOpen((current) => !current)}
          >
            <MoreVertical size={13} strokeWidth={2.3} />
          </button>
        </div>
      ) : null}

      {columnMenuOpen && seriesMenu && selectedSeriesIndex != null ? (
        <div
          className="absolute top-9 z-30 w-[232px] -translate-x-1/2 overflow-hidden rounded-2xl border border-[#E6E6EA] bg-white py-2 shadow-[0_14px_36px_rgba(16,24,40,0.18)]"
          style={{ left: seriesMenu.left }}
        >
          <ColumnMenuItem
            icon={<Trash2 size={16} />}
            label="Delete Row"
            disabled={safeCategories.length <= 1}
            onClick={() => {
              deleteRow(selectedRowIndex);
              setColumnMenuOpen(false);
            }}
          />
          <ColumnMenuItem
            icon={<Trash2 size={16} />}
            label="Delete Column"
            disabled={safeSeries.length <= 1}
            onClick={() => deleteSeries(selectedSeriesIndex)}
          />
          <ColumnMenuItem
            icon={<Plus size={16} />}
            label="Add Row"
            onClick={() => {
              addRow();
              setColumnMenuOpen(false);
            }}
          />
          <ColumnMenuItem
            icon={<Plus size={16} />}
            label="Add Column"
            disabled={!allowMultipleSeries}
            onClick={() => {
              addSeries();
              setColumnMenuOpen(false);
            }}
          />
          <div className="my-2 h-px bg-[#ECECF1]" />
          <ColumnMenuItem
            icon={<ChevronRight size={16} />}
            label="Move Column Right"
            disabled={selectedSeriesIndex >= safeSeries.length - 1}
            onClick={() => moveSeries(selectedSeriesIndex, 1)}
          />
          <ColumnMenuItem
            icon={<ChevronLeft size={16} />}
            label="Move Column Left"
            disabled={selectedSeriesIndex <= 0}
            onClick={() => moveSeries(selectedSeriesIndex, -1)}
          />
        </div>
      ) : null}

      <div className="relative rounded-b-lg bg-[#F3F4F6] pb-9 pr-9">
        <div className="relative z-10 max-h-[390px] overflow-auto">
          <div
            className="min-w-full text-[12px] text-[#191919]"
            style={{
              minWidth: minimumTableWidth,
              width: "100%",
            }}
          >
            <div
              className="sticky top-0 z-20 grid"
              style={{ gridTemplateColumns: dataGridTemplateColumns }}
            >
              <div className="sticky left-0 z-20 border-b border-r border-[#E8E8EC] bg-[#F6F7F8]" />
              {safeSeries.map((item, seriesIndex) => (
                <div
                  key={`${chartPath}-series-${seriesIndex}`}
                  className="border-b border-r border-[#E8E8EC] bg-[#F6F7F8] px-3 py-2 text-center text-[12px] font-medium"
                  onMouseEnter={(event) =>
                    showSeriesMenu(seriesIndex, event.currentTarget)
                  }
                >
                  <button
                    type="button"
                    className="w-full truncate text-center outline-none"
                    title={item.name}
                    onFocus={(event) =>
                      showSeriesMenu(seriesIndex, event.currentTarget)
                    }
                  >
                    {item.name}
                  </button>
                </div>
              ))}
              <div className="sticky right-0 z-20 border-b border-[#E8E8EC] bg-[#F3F4F6]" />
            </div>

            {safeCategories.map((category, rowIndex) => (
              <div
                key={`${chartPath}-row-${rowIndex}`}
                className="grid"
                style={{ gridTemplateColumns: dataGridTemplateColumns }}
                onMouseEnter={() => setSelectedRowIndex(rowIndex)}
              >
                <div className="sticky left-0 z-10 border-b border-r border-[#E8E8EC] bg-[#F7F8FA] px-3 py-1.5">
                  <span className="absolute -left-6 top-1/2 flex -translate-y-1/2 items-center justify-center">
                    <GripVertical size={13} strokeWidth={2.1} />
                  </span>
                  <input
                    className="h-7 w-full truncate rounded-md border border-transparent bg-transparent px-0 text-[12px] font-medium outline-none focus:border-[#7C51F8] focus:bg-white focus:px-2"
                    maxLength={CHART_TEXT_MAX_LENGTH}
                    spellCheck={false}
                    value={category}
                    title={category}
                    onFocus={() => setSelectedRowIndex(rowIndex)}
                    onChange={(event) =>
                      updateCategory(rowIndex, event.target.value)
                    }
                  />
                </div>
                {safeSeries.map((item, seriesIndex) => {
                  const draftKey = `${seriesIndex}:${rowIndex}`;
                  const hasDraft = Object.prototype.hasOwnProperty.call(
                    valueDrafts,
                    draftKey,
                  );
                  const displayValue = hasDraft
                    ? valueDrafts[draftKey]
                    : item.values[rowIndex] ?? "";

                  return (
                    <div
                      key={`${chartPath}-cell-${rowIndex}-${seriesIndex}`}
                      className="border-b border-r border-[#E8E8EC] bg-white px-3 py-1.5"
                    >
                      <input
                        className="h-7 w-full rounded-md border border-transparent bg-transparent px-0 text-[12px] outline-none focus:border-[#7C51F8] focus:bg-[#FAFAFF] focus:px-2"
                        type="text"
                        inputMode={numericInputMode(chartValueInputOptions)}
                        value={displayValue}
                        onFocus={() => setSelectedRowIndex(rowIndex)}
                        onBlur={() => {
                          const draft = valueDrafts[draftKey];
                          if (!isCompleteNumericInput(draft)) return;
                          setValueDrafts((current) => {
                            const next = { ...current };
                            delete next[draftKey];
                            return next;
                          });
                        }}
                        onKeyDown={(event) => {
                          if (
                            preventInvalidNumberInput(
                              event,
                              chartValueInputOptions,
                            )
                          ) {
                            return;
                          }
                          if (
                            event.key === "ArrowUp" ||
                            event.key === "ArrowDown"
                          ) {
                            event.preventDefault();
                            const direction =
                              event.key === "ArrowUp" ? 1 : -1;
                            const draft = valueDrafts[draftKey];
                            const currentValue = isCompleteNumericInput(draft)
                              ? Number(draft)
                              : item.values[rowIndex] ?? 0;
                            const nextValue = String(currentValue + direction);
                            updateValueDraft(
                              seriesIndex,
                              rowIndex,
                              nextValue,
                            );
                          }
                        }}
                        onChange={(event) =>
                          updateValueDraft(
                            seriesIndex,
                            rowIndex,
                            sanitizeNumericInput(
                              event.target.value,
                              chartValueInputOptions,
                            ),
                          )
                        }
                      />
                    </div>
                  );
                })}
                <div className="sticky right-0 grid place-items-center border-b border-[#E8E8EC] bg-[#F3F4F6] px-1">
                  <button
                    type="button"
                    aria-label={`Delete ${category || `row ${rowIndex + 1}`}`}
                    className="grid h-7 w-7 place-items-center rounded-md text-[#8E8E98] transition hover:bg-white hover:text-[#191919] disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-[#8E8E98]"
                    disabled={safeCategories.length <= 1}
                    onClick={() => deleteRow(rowIndex)}
                  >
                    <Trash2 size={12} strokeWidth={2.1} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="absolute bottom-0 right-0 top-0 z-0 w-9 rounded-r-lg bg-[#EDEEF0]" />
        <div className="absolute bottom-0 left-0 right-9 z-0 h-9 rounded-b-lg bg-[#EDEEF0]" />
        {allowMultipleSeries ? (
          <button
            type="button"
            className="absolute right-0 top-1/2 z-10 grid h-8 w-9 -translate-y-1/2 place-items-center text-[#191919]"
            onClick={addSeries}
          >
            <Plus size={13} strokeWidth={2.2} />
          </button>
        ) : null}
        <button
          type="button"
          className="absolute bottom-0 left-1/2 z-10 grid h-9 w-16 -translate-x-1/2 place-items-center text-[#191919]"
          onClick={addRow}
        >
          <Plus size={12} strokeWidth={2.2} />
        </button>
      </div>
    </div>
  );
}

function isCompleteNumericInput(value: string | undefined) {
  if (!value || value === "-" || value === "." || value === "-.") {
    return false;
  }
  return Number.isFinite(Number(value));
}

function ColumnMenuItem({
  disabled = false,
  icon,
  label,
  onClick,
}: {
  disabled?: boolean;
  icon: ReactNode;
  label: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      className="flex h-10 w-full items-center gap-3 px-4 text-left text-[12px] font-medium text-[#191919] transition hover:bg-[#F7F7FA] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
      disabled={disabled}
      onClick={onClick}
    >
      <span className="grid h-5 w-5 shrink-0 place-items-center">{icon}</span>
      <span>{label}</span>
    </button>
  );
}

function safeCategoriesForChart(element: ChartElement) {
  const categories = resolvedChartCategories(element);
  return (categories.length > 0 ? categories : ["Item 1"]).map(limitChartText);
}

function normalizedSeries(element: ChartElement, categoryLength: number) {
  const length = Math.max(1, categoryLength);
  if (element.series?.length) {
    return element.series
      .slice(0, chartSupportsMultipleSeries(element.chart_type) ? 12 : 1)
      .map((series) => ({
        ...series,
        name: limitChartText(series.name ?? ""),
        values: normalizeValues(series.values, length),
      }));
  }
  return [
    {
      name: limitChartText(element.title ?? "Series 1"),
      values: normalizeValues([], length),
    },
  ];
}

function normalizeValues(values: number[], length: number) {
  const normalized = values.slice(0, length);
  while (normalized.length < length) normalized.push(0);
  return normalized;
}

function clearChartData(chart: ChartElement): ChartElement {
  const chartData = chart.data ?? [];
  const sourceCategories =
    chart.categories && chart.categories.length > 0
      ? chart.categories
      : chartData.length > 0
        ? chartData.map((datum, index) => datum.label || `Item ${index + 1}`)
        : resolvedChartCategories(chart);
  const sourceSeries =
    chart.series && chart.series.length > 0
      ? chart.series
      : [
        {
          name: chart.title ?? "Series 1",
          values: chartData.map((datum) => datum.value),
        },
      ];
  const valueLength = Math.min(
    24,
    Math.max(
      1,
      sourceCategories.length,
      chartData.length,
      ...sourceSeries.map((item) => item.values.length),
    ),
  );
  const categories = Array.from(
    { length: valueLength },
    (_, index) => limitChartText(sourceCategories[index] ?? `Item ${index + 1}`),
  );
  const series = sourceSeries.map((item) => ({
    ...item,
    name: limitChartText(item.name ?? ""),
    values: Array.from({ length: valueLength }, () => 0),
  }));
  const fallbackColors =
    chart.colors && chart.colors.length > 0
      ? chart.colors
      : [chart.color ?? DEFAULT_CHART_COLORS[0]];
  const fallbackData = chartDataFromSeriesWithColors(
    categories,
    series,
    fallbackColors,
    chartColorTargetMode({ ...chart, categories, series }) === "category",
  );
  const data =
    chartData.length > 0
      ? chartData.map((datum) => ({ ...datum, value: 0 }))
      : fallbackData;

  return {
    ...chart,
    categories,
    series,
    data,
  };
}

function sanitizeChartTextFields(chart: ChartElement): ChartElement {
  return {
    ...chart,
    title: chart.title ? limitChartText(chart.title) : chart.title,
    x_axis_title: chart.x_axis_title
      ? limitChartText(chart.x_axis_title)
      : chart.x_axis_title,
    y_axis_title: chart.y_axis_title
      ? limitChartText(chart.y_axis_title)
      : chart.y_axis_title,
    categories: chart.categories?.map(limitChartText) ?? chart.categories,
    series:
      chart.series?.map((series) => ({
        ...series,
        name: limitChartText(series.name ?? ""),
      })) ?? chart.series,
    data: (chart.data ?? []).map((datum) => ({
      ...datum,
      label: limitChartText(datum.label ?? ""),
    })),
  };
}

function chartPreviewElement(chart: ChartElement): ChartElement {
  return {
    ...sanitizeChartTextFields(chart),
    opacity: 1,
    position: { x: 45, y: 45 },
    rotation: 0,
    size: {
      width: EDITOR_STAGE_WIDTH - 90,
      height: EDITOR_STAGE_HEIGHT - 90,
    },
  };
}
