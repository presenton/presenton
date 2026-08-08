import { useState } from "react";
import { BarChart3, Palette, Pencil } from "lucide-react";
import type { ChartSlideElement } from "@/components/slide-editor/state/state";
import {
  appendChartColorTarget,
  resolvedChartColorTargets,
  updateChartColorTarget,
} from "@/components/slide-editor/charts/chart-data";
import { ChartColorPaletteCard } from "@/components/slide-editor/charts/ChartColorPalette";
import { ChartDataEditorPopover } from "@/components/slide-editor/charts/ChartEditorContent";
import {
  FloatingToolbar,
  FloatingToolbarPanel,
  type FloatingToolbarBox,
} from "@/components/slide-editor/toolbar/FloatingToolbar";
import { inlineStyles } from "@/components/slide-editor/toolbar/inlineStyles";

const DEFAULT_CHART_TOOLBAR_SIZE = { width: 2.5, height: 2.5 };
const CHART_TYPE_OPTIONS: Array<{
  label: string;
  value: ChartSlideElement["chart_type"];
}> = [
    { value: "bar", label: "Bar Chart" },
    { value: "horizontal_bar", label: "Horizontal Bar" },
    { value: "stacked_bar", label: "Stacked Bar" },
    { value: "horizontal_stacked_bar", label: "Horizontal Stack Bar" },
    { value: "line", label: "Line Chart" },
    { value: "area", label: "Area Chart" },
    { value: "pie", label: "Pie Chart" },
    { value: "donut", label: "Donut Chart" },
    { value: "scatter", label: "Scatter Chart" },
    { value: "radar", label: "Radar Chart" },
    { value: "polar_area", label: "Polar Area" },
  ];

export function ChartToolbarControls({
  element,
  paletteOpen: controlledPaletteOpen,
  onChange,
  onEdit,
  onPaletteOpenChange,
}: {
  element: ChartSlideElement;
  paletteOpen?: boolean;
  onChange: (element: ChartSlideElement) => void;
  onEdit?: () => void;
  onPaletteOpenChange?: (open: boolean) => void;
}) {
  const [uncontrolledPaletteOpen, setUncontrolledPaletteOpen] =
    useState(false);
  const [activeColorIndex, setActiveColorIndex] = useState(0);
  const paletteOpen = controlledPaletteOpen ?? uncontrolledPaletteOpen;
  const setPaletteOpen = (open: boolean) => {
    if (onPaletteOpenChange) {
      onPaletteOpenChange(open);
      return;
    }
    setUncontrolledPaletteOpen(open);
  };
  const colorTargets = resolvedChartColorTargets(element);
  const activeTarget =
    colorTargets.find((target) => target.index === activeColorIndex) ??
    colorTargets[0];

  return (
    <>
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          paddingRight: 8,
          borderRight: "1px solid #E6E6EA",
        }}
      >
        <BarChart3 size={16} strokeWidth={2} />
        <select
          aria-label="Chart type"
          title="Chart type"
          value={element.chart_type}
          onChange={(event) =>
            onChange({
              ...element,
              chart_type: event.target.value as ChartSlideElement["chart_type"],
            })
          }
          style={{
            ...inlineStyles.select,
            minWidth: 80,
            maxWidth: 100,
            border: "none",
            paddingLeft: 0,
          }}
        >
          {CHART_TYPE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {onEdit ? (
        <button
          type="button"
          aria-label="Edit chart data"
          title="Edit data"
          onClick={() => {
            setPaletteOpen(false);
            onEdit();
          }}
          style={inlineStyles.iconButton}
        >
          <Pencil size={16} strokeWidth={2} />
        </button>
      ) : null}

      <div style={{ position: "relative" }}>
        <button
          type="button"
          aria-expanded={paletteOpen}
          aria-label="Chart colors"
          title="Chart colors"
          onClick={() => setPaletteOpen(!paletteOpen)}
          style={{
            ...inlineStyles.iconButton,
            ...(paletteOpen ? inlineStyles.iconButtonActive : {}),
          }}
        >
          <Palette size={16} strokeWidth={2} />
        </button>
        {paletteOpen && activeTarget ? (
          <FloatingToolbarPanel>
            <ChartColorPaletteCard
              colors={colorTargets.map((target) => target.color)}
              onAddColor={() => {
                const nextIndex = Math.min(11, colorTargets.length);
                setActiveColorIndex(nextIndex);
                onChange(appendChartColorTarget(element));
              }}
              onChange={(color) =>
                onChange(
                  updateChartColorTarget(element, activeTarget.index, color),
                )
              }
              onClose={() => setPaletteOpen(false)}
              onSelectIndex={setActiveColorIndex}
              selectedIndex={activeTarget.index}
            />
          </FloatingToolbarPanel>
        ) : null}
      </div>
    </>
  );
}

export function ChartToolbar({
  anchorBox,
  element,
  index,
  scale,
  onChange,
}: {
  anchorBox?: FloatingToolbarBox | null;
  element: ChartSlideElement;
  index: number;
  scale: number;
  onChange: (index: number, element: ChartSlideElement) => void;
}) {
  const [editorOpen, setEditorOpen] = useState(false);

  return (
    <>
      <FloatingToolbar
        anchorBox={
          anchorBox ?? {
            x: (element.position?.x ?? 0) * scale,
            y: (element.position?.y ?? 0) * scale,
            width:
              (element.size?.width ?? DEFAULT_CHART_TOOLBAR_SIZE.width) * scale,
            height:
              (element.size?.height ?? DEFAULT_CHART_TOOLBAR_SIZE.height) * scale,
          }
        }
        fallbackWidth={220}
        inlineEditIgnore
        style={inlineStyles.toolbar}
      >
        <ChartToolbarControls
          element={element}
          onChange={(element) => onChange(index, element)}
          onEdit={() => setEditorOpen(true)}
        />
      </FloatingToolbar>
      {editorOpen ? (
        <ChartDataEditorPopover
          chart={element}
          chartPath={`chart-${index}`}
          onChange={(chart) => onChange(index, chart)}
          onClose={() => setEditorOpen(false)}
        />
      ) : null}
    </>
  );
}
