"use client";

import { useEffect, useRef } from "react";
import Chart from "chart.js/auto";
import type { ChartConfiguration, ChartOptions } from "chart.js";

export type PitchChartType = "bar" | "pie" | "scatter" | "stackedBar" | "line";

export type PitchBarDatum = {
  label: string;
  value: number;
  value2?: number;
};

export type PitchPieDatum = {
  label: string;
  value: number;
  color: string;
};

export type PitchScatterDatum = {
  label: string;
  value: number;
};

export type PitchChartPayload = {
  chartType: PitchChartType;
  legendLabel: string;
  yAxisLabel: string;
  barData: PitchBarDatum[];
  pieData: PitchPieDatum[];
  scatterData: PitchScatterDatum[];
  lineData: PitchBarDatum[];
  stackedBarData: PitchBarDatum[];
};

type Props = {
  payload?: Partial<PitchChartPayload> | null;
};

const DEFAULT_CHART_COLORS = [
  "#dddac7",
  "#b8b4a3",
  "#a2a091",
  "#8d8a7d",
  "#cbc7b2",
  "#747168",
  "#e8e5d3",
  "#9a9789",
  "#c5c1ae",
  "#66645d",
];
const AXIS = "var(--background-text,#d8d4bf)";
const GRID = "var(--background-text,#585a61)";
const PRIMARY_TEXT = "var(--primary-text,#ffffff)";
const BODY_FONT = "var(--body-font-family,Inter)";

const graphColors = (index: number, fallbackColor?: string) => {
  const slot = index % 10;
  const fallback =
    fallbackColor || DEFAULT_CHART_COLORS[index % DEFAULT_CHART_COLORS.length];
  return `var(--graph-${slot}, ${fallback})`;
};

const DEFAULT_CHART_PAYLOAD: PitchChartPayload = {
  chartType: "bar",
  legendLabel: "Series Label",
  yAxisLabel: "Y axis name",
  barData: [
    { label: "Mon", value: 120 },
    { label: "Tue", value: 200 },
    { label: "Wed", value: 150 },
    { label: "Thu", value: 80 },
    { label: "Fri", value: 70 },
    { label: "Sat", value: 110 },
    { label: "Sun", value: 130 },
  ],
  pieData: [
    { label: "Category A", value: 55, color: "#dddac7" },
    { label: "Category B", value: 25, color: "#b8b4a3" },
    { label: "Category C", value: 20, color: "#a2a091" },
  ],
  scatterData: [
    { label: "Mon", value: 7 },
    { label: "Tue", value: 2 },
    { label: "Wed", value: 92 },
    { label: "Thu", value: 15 },
    { label: "Fri", value: 91 },
    { label: "Sat", value: 73 },
    { label: "Sun", value: 56 },
  ],
  lineData: [
    { label: "Mon", value: 30 },
    { label: "Tue", value: 48 },
    { label: "Wed", value: 64 },
    { label: "Thu", value: 42 },
    { label: "Fri", value: 58 },
    { label: "Sat", value: 70 },
    { label: "Sun", value: 90 },
  ],
  stackedBarData: [
    { label: "Mon", value: 50, value2: 50 },
    { label: "Tue", value: 80, value2: 70 },
    { label: "Wed", value: 90, value2: 90 },
    { label: "Thu", value: 40, value2: 60 },
    { label: "Fri", value: 80, value2: 70 },
    { label: "Sat", value: 90, value2: 90 },
    { label: "Sun", value: 70, value2: 80 },
  ],
};

function resolveChartPayload(
  payload?: Partial<PitchChartPayload> | null
): PitchChartPayload {
  return {
    ...DEFAULT_CHART_PAYLOAD,
    ...payload,
    barData: payload?.barData?.length
      ? payload.barData
      : DEFAULT_CHART_PAYLOAD.barData,
    pieData: payload?.pieData?.length
      ? payload.pieData
      : DEFAULT_CHART_PAYLOAD.pieData,
    scatterData: payload?.scatterData?.length
      ? payload.scatterData
      : DEFAULT_CHART_PAYLOAD.scatterData,
    lineData: payload?.lineData?.length
      ? payload.lineData
      : DEFAULT_CHART_PAYLOAD.lineData,
    stackedBarData: payload?.stackedBarData?.length
      ? payload.stackedBarData
      : DEFAULT_CHART_PAYLOAD.stackedBarData,
    chartType: payload?.chartType || DEFAULT_CHART_PAYLOAD.chartType,
    legendLabel: payload?.legendLabel || DEFAULT_CHART_PAYLOAD.legendLabel,
    yAxisLabel: payload?.yAxisLabel || DEFAULT_CHART_PAYLOAD.yAxisLabel,
  };
}

function cssVarParts(value: string) {
  const match = value.match(/^var\((--[^,\s)]+)\s*,?\s*([^)]+)?\)$/);
  if (!match) return null;

  return {
    name: match[1],
    fallback: match[2]?.trim(),
  };
}

function resolveToken(element: HTMLElement, value: string, fallback: string) {
  const parts = cssVarParts(value);
  if (!parts) return value;

  const resolved = getComputedStyle(element)
    .getPropertyValue(parts.name)
    .trim();
  return resolved || parts.fallback || fallback;
}

function resolveColor(element: HTMLElement, value: string) {
  return resolveToken(element, value, "#d8d4bf");
}

function resolveFont(element: HTMLElement) {
  return resolveToken(element, BODY_FONT, "Inter").replace(/^['"]|['"]$/g, "");
}

function formatValue(value: number | string) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric.toLocaleString("en-US") : String(value);
}

function colorLuminance(color: string) {
  const weights = [0.2126, 0.7152, 0.0722];
  const hex = color.trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    const raw = hex[1].length === 3
      ? hex[1].split("").map((char) => char + char).join("")
      : hex[1];
    const int = Number.parseInt(raw, 16);
    const rgb = [(int >> 16) & 255, (int >> 8) & 255, int & 255];
    return rgb
      .map((value) => {
        const channel = value / 255;
        return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
      })
      .reduce((sum, channel, index) => sum + channel * (weights[index] ?? 0), 0);
  }

  const rgb = color.trim().match(/^rgba?\(([^)]+)\)$/i);
  if (rgb) {
    const channels = rgb[1].split(",").slice(0, 3).map((part) => Number(part.trim()));
    if (channels.every(Number.isFinite)) {
      return channels
        .map((value) => {
          const channel = value / 255;
          return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
        })
        .reduce((sum, channel, index) => sum + channel * (weights[index] ?? 0), 0);
    }
  }

  return 0;
}

function readableTextColor(fill: unknown) {
  const color = Array.isArray(fill) ? fill[0] : fill;
  if (typeof color !== "string") return "#ffffff";

  return colorLuminance(color) > 0.52 ? "#27292d" : "#ffffff";
}

function labelPlugin({
  axisColor,
  fontFamily,
  mode,
  primaryText,
}: {
  axisColor: string;
  fontFamily: string;
  mode: "bar" | "pie" | "stacked" | "none";
  primaryText: string;
}) {
  return {
    id: `pitchDeckLabels-${mode}`,
    afterDatasetsDraw(chart: any) {
      if (mode === "none") return;

      const ctx = chart.ctx as CanvasRenderingContext2D;
      ctx.save();

      if (mode === "bar") {
        const dataset = chart.data.datasets[0];
        const meta = chart.getDatasetMeta(0);
        ctx.fillStyle = axisColor;
        ctx.font = `600 16px ${fontFamily}`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        meta.data.forEach((element: any, index: number) => {
          const position = element.tooltipPosition();
          ctx.fillText(formatValue(dataset.data[index]), position.x, position.y - 20);
        });
      }

      if (mode === "stacked") {
        ctx.fillStyle = primaryText;
        ctx.font = `600 16px ${fontFamily}`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        chart.data.datasets.forEach((dataset: any, datasetIndex: number) => {
          const meta = chart.getDatasetMeta(datasetIndex);
          meta.data.forEach((element: any, index: number) => {
            const value = Number(dataset.data[index]) || 0;
            if (!value) return;
            const position = element.tooltipPosition();
            ctx.fillText(formatValue(value), position.x, position.y);
          });
        });
      }

      if (mode === "pie") {
        const dataset = chart.data.datasets[0];
        const meta = chart.getDatasetMeta(0);
        ctx.font = `700 18px ${fontFamily}`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.shadowColor = "rgba(0,0,0,0.18)";
        ctx.shadowBlur = 1;
        ctx.shadowOffsetY = 1;
        meta.data.forEach((element: any, index: number) => {
          const value = Number(dataset.data[index]) || 0;
          if (!value) return;
          const arc = element.getProps(
            ["x", "y", "startAngle", "endAngle", "innerRadius", "outerRadius"],
            true
          );
          const angle = (arc.startAngle + arc.endAngle) / 2;
          const radius = arc.outerRadius * 0.72;
          const x = arc.x + Math.cos(angle) * radius;
          const y = arc.y + Math.sin(angle) * radius;
          const text = `${value}%`;

          const sliceFill = Array.isArray(dataset.backgroundColor)
            ? dataset.backgroundColor[index]
            : dataset.backgroundColor;
          ctx.fillStyle = readableTextColor(sliceFill);
          ctx.fillText(text, x, y + 1);
        });
      }

      ctx.restore();
    },
  };
}

function categoryScale(axisColor: string, gridColor: string, fontFamily: string, showGrid = false) {
  return {
    type: "category",
    grid: {
      color: gridColor,
      display: showGrid,
      drawTicks: false,
    },
    border: {
      color: axisColor,
      display: true,
    },
    ticks: {
      color: axisColor,
      font: {
        family: fontFamily,
        size: 18,
      },
      maxRotation: 0,
      padding: 10,
    },
  };
}

function linearScale(axisColor: string, gridColor: string, fontFamily: string, showGrid = false) {
  return {
    type: "linear",
    beginAtZero: true,
    grace: "6%",
    grid: {
      color: gridColor,
      display: showGrid,
      drawTicks: false,
    },
    border: {
      display: false,
    },
    ticks: {
      color: axisColor,
      font: {
        family: fontFamily,
        size: 18,
      },
      padding: 8,
    },
  };
}

function baseOptions(axisColor: string, fontFamily: string): ChartOptions {
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    resizeDelay: 0,
    color: axisColor,
    font: {
      family: fontFamily,
    },
    layout: {
      padding: 4,
    },
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        enabled: false,
      },
    },
  };
}

function makeChartConfig(canvas: HTMLCanvasElement, payload: PitchChartPayload): ChartConfiguration {
  const axisColor = resolveColor(canvas, AXIS);
  const gridColor = resolveColor(canvas, GRID);
  const primaryText = resolveColor(canvas, PRIMARY_TEXT);
  const fontFamily = resolveFont(canvas);
  const options = baseOptions(axisColor, fontFamily);
  const chartColor = (index: number, fallbackColor?: string) =>
    resolveColor(canvas, graphColors(index, fallbackColor));

  if (payload.chartType === "pie") {
    return {
      type: "pie",
      data: {
        labels: payload.pieData.map((item) => item.label),
        datasets: [
          {
            data: payload.pieData.map((item) => item.value),
            backgroundColor: payload.pieData.map((item, index) =>
              chartColor(index, item.color)
            ),
            borderColor: "transparent",
            borderWidth: 0,
            hoverBorderWidth: 0,
            spacing: 0,
          },
        ],
      },
      options: {
        ...options,
        layout: {
          padding: {
            top: 18,
            right: 36,
            bottom: 18,
            left: 28,
          },
        },
      },
      plugins: [
        labelPlugin({
          axisColor,
          fontFamily,
          mode: "pie",
          primaryText,
        }),
      ],
    } as ChartConfiguration;
  }

  if (payload.chartType === "scatter") {
    return {
      type: "scatter",
      data: {
        datasets: [
          {
            data: payload.scatterData.map((item, index) => ({
              x: index + 1,
              y: item.value,
            })),
            backgroundColor: chartColor(0),
            borderColor: chartColor(0),
            clip: false,
            pointRadius: 5,
            pointHoverRadius: 5,
          },
        ],
      },
      options: {
        ...options,
        layout: {
          padding: {
            top: 18,
            right: 36,
            bottom: 20,
            left: 18,
          },
        },
        scales: {
          x: {
            ...linearScale(axisColor, gridColor, fontFamily, false),
            min: 0.65,
            max: Math.max(payload.scatterData.length, 2) + 0.35,
            border: {
              color: axisColor,
              display: true,
            },
            ticks: {
              color: axisColor,
              font: {
                family: fontFamily,
                size: 18,
              },
              padding: 10,
              stepSize: 1,
              callback(value: string | number) {
                const index = Math.round(Number(value)) - 1;
                return payload.scatterData[index]?.label ?? "";
              },
            },
          },
          y: {
            ...linearScale(axisColor, gridColor, fontFamily, false),
            suggestedMin: 0,
            suggestedMax: 100,
            title: {
              color: axisColor,
              display: true,
              font: {
                family: fontFamily,
                size: 18,
              },
              text: payload.yAxisLabel,
            },
          },
        },
      },
    } as ChartConfiguration;
  }

  if (payload.chartType === "line") {
    return {
      type: "line",
      data: {
        labels: payload.lineData.map((item) => item.label),
        datasets: [
          {
            data: payload.lineData.map((item) => item.value),
            borderColor: chartColor(0),
            backgroundColor: chartColor(0),
            borderWidth: 4,
            pointBackgroundColor: chartColor(0),
            pointBorderColor: chartColor(0),
            clip: false,
            pointRadius: 5,
            pointHoverRadius: 5,
            tension: 0.35,
          },
        ],
      },
      options: {
        ...options,
        layout: {
          padding: {
            top: 24,
            right: 36,
            bottom: 20,
            left: 8,
          },
        },
        scales: {
          x: {
            ...categoryScale(axisColor, gridColor, fontFamily, false),
            offset: true,
          },
          y: linearScale(axisColor, gridColor, fontFamily, true),
        },
      },
    } as ChartConfiguration;
  }

  if (payload.chartType === "stackedBar") {
    return {
      type: "bar",
      data: {
        labels: payload.stackedBarData.map((item) => item.label),
        datasets: [
          {
            data: payload.stackedBarData.map((item) => item.value),
            backgroundColor: chartColor(1),
            borderRadius: 5,
            borderWidth: 0,
            stack: "stack",
          },
          {
            data: payload.stackedBarData.map((item) => item.value2 ?? 0),
            backgroundColor: chartColor(0),
            borderRadius: 5,
            borderWidth: 0,
            stack: "stack",
          },
        ],
      },
      options: {
        ...options,
        layout: {
          padding: {
            top: 28,
            right: 36,
            bottom: 20,
            left: 8,
          },
        },
        scales: {
          x: {
            ...categoryScale(axisColor, gridColor, fontFamily, false),
            stacked: true,
          },
          y: {
            ...linearScale(axisColor, gridColor, fontFamily, false),
            stacked: true,
          },
        },
      },
      plugins: [
        labelPlugin({
          axisColor,
          fontFamily,
          mode: "stacked",
          primaryText,
        }),
      ],
    } as ChartConfiguration;
  }

  return {
    type: "bar",
    data: {
      labels: payload.barData.map((item) => item.label),
      datasets: [
        {
          data: payload.barData.map((item) => item.value),
          backgroundColor: chartColor(0),
          borderRadius: 5,
          borderWidth: 0,
          barThickness: 34,
        },
      ],
    },
    options: {
      ...options,
      layout: {
        padding: {
          top: 36,
          right: 36,
          bottom: 20,
          left: 8,
        },
      },
      scales: {
        x: categoryScale(axisColor, gridColor, fontFamily, false),
        y: linearScale(axisColor, gridColor, fontFamily, false),
      },
    },
    plugins: [
      labelPlugin({
        axisColor,
        fontFamily,
        mode: "bar",
        primaryText,
      }),
    ],
  } as ChartConfiguration;
}

function Legend({
  label,
  color = graphColors(0),
}: {
  label: string;
  color?: string;
}) {
  return (
    <div
      className="flex shrink-0 items-center justify-center gap-[10px] pt-[8px]"
      style={{ color: AXIS }}
    >
      <span
        className="h-[16px] w-[16px] rounded-full"
        style={{ backgroundColor: color }}
      />
      <span className="text-[18px] leading-none">{label}</span>
    </div>
  );
}

function ChartCanvas({ payload }: { payload: PitchChartPayload }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let frame: number | null = null;
    let chart: Chart | null = null;

    const renderChart = () => {
      chart?.destroy();
      chart = new Chart(canvas, makeChartConfig(canvas, payload));
    };

    const scheduleRender = () => {
      if (frame !== null) {
        cancelAnimationFrame(frame);
      }
      frame = requestAnimationFrame(() => {
        frame = null;
        renderChart();
      });
    };

    renderChart();

    const observer = new MutationObserver(scheduleRender);
    let node: HTMLElement | null = canvas.parentElement;
    while (node) {
      observer.observe(node, {
        attributeFilter: ["class", "data-theme", "style"],
        attributes: true,
      });
      node = node.parentElement;
    }

    return () => {
      if (frame !== null) {
        cancelAnimationFrame(frame);
      }
      observer.disconnect();
      chart?.destroy();
    };
  }, [payload]);

  return <canvas ref={canvasRef} className="block h-full w-full" />;
}

export default function PitchDeckChart({ payload }: Props) {
  const resolvedPayload = resolveChartPayload(payload);

  if (resolvedPayload.chartType === "pie") {
    return (
      <div className="flex h-full min-h-0 w-full flex-col overflow-hidden">
        <div className="min-h-0 flex-1">
          <ChartCanvas payload={resolvedPayload} />
        </div>

        <div
          className="flex shrink-0 items-center justify-center gap-[26px] pb-[2px] pt-[8px] text-[18px] leading-none"
          style={{ color: AXIS }}
        >
          {resolvedPayload.pieData.map((entry, index) => (
            <span key={entry.label} className="flex items-center gap-[10px]">
              <span
                className="h-[15px] w-[15px] rounded-full"
                style={{ backgroundColor: graphColors(index, entry.color) }}
              />
              {entry.label}
            </span>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden">
      <div className="min-h-0 flex-1">
        <ChartCanvas payload={resolvedPayload} />
      </div>
      <Legend label={resolvedPayload.legendLabel} />
    </div>
  );
}
