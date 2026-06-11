"use client";

import { useEffect, useRef } from "react";
import Chart from "chart.js/auto";
import type { ChartConfiguration, ChartOptions } from "chart.js";
import * as z from "zod";
import { RemoteSvgIcon } from "@/app/hooks/useRemoteSvgIcon";

export const slideLayoutId = "title-description-with-chart-and-kpi-cards-slide";
export const slideLayoutName = "Title Description with Chart and KPI Cards Slide";
export const slideLayoutDescription =
  "A text slide with a title on top and a description below, and a content section containing a chart and a grid of KPI cards.";

const LegacyBarSchema = z.object({
  value: z.number().min(10).max(100).meta({
    description: "Relative bar value used by legacy data.",
  }),
});

const MiniBarPointSchema = z.object({
  label: z.string().min(1).max(10).meta({
    description: "Category label for the mini bar chart.",
  }),
  primary: z.number().min(0).max(1000).meta({
    description: "Primary series value.",
  }),
  secondary: z.number().min(0).max(1000).meta({
    description: "Secondary series value.",
  }),
});

const DonutPointSchema = z.object({
  name: z.string().min(1).max(20).meta({
    description: "Donut segment label.",
  }),
  value: z.number().min(1).max(100).meta({
    description: "Donut segment value.",
  }),
});

const GroupedBarPointSchema = z.object({
  label: z.string().min(1).max(12).meta({
    description: "X-axis label for grouped bars.",
  }),
  optionA: z.number().min(0).max(220).meta({
    description: "Option A value.",
  }),
  optionB: z.number().min(0).max(220).meta({
    description: "Option B value.",
  }),
});

const TrendPointSchema = z.object({
  label: z.string().min(1).max(12).meta({
    description: "X-axis label for trend lines.",
  }),
  optionA: z.number().min(0).max(100).meta({
    description: "Option A trend value.",
  }),
  optionB: z.number().min(0).max(100).meta({
    description: "Option B trend value.",
  }),
});

const MetricCardSchema = z.object({
  value: z.string().min(1).max(8).meta({
    description: "KPI value text.",
  }),
  body: z.string().min(10).max(40).meta({
    description: "KPI supporting sentence.",
  }),
});

export const Schema = z.object({
  title: z.string().max(24).default("Report Report Report Report").meta({
    description: "Slide heading text.",
  }),
  taglineLabel: z.string().max(24).default("TAGLINE").meta({
    description: "Small label above intro paragraph.",
  }),
  taglineBody: z.string().max(120).default(
    "Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat."
  ).meta({
    description: "Intro paragraph shown beneath the heading.",
  }),
  sideImage: z.object({
    __image_url__: z.string().url().default("https://images.unsplash.com/photo-1520607162513-77705c0f0d4a?auto=format&fit=crop&w=700&q=80"),
    __image_prompt__: z.string().min(10).max(100).default("Team members reviewing charts together"),
  }).default({
    __image_url__:
      "https://images.unsplash.com/photo-1520607162513-77705c0f0d4a?auto=format&fit=crop&w=700&q=80",
    __image_prompt__: "Team members reviewing charts together",
  }).meta({
    description: "Left-side vertical image strip.",
  }),
  chartStyle: z.enum(["mini-bars", "donut", "grouped-bars", "dual-line"]).default("donut").meta({
    description: "Chart style variant matching Image #1 to Image #4.",
  }),
  chartTitle: z.string().min(3).max(20).default("Sandro Tavares").meta({
    description: "Name displayed in the chart card.",
  }),
  miniBars: z
    .array(MiniBarPointSchema)
    .min(8)
    .max(9)
    .default([
      { label: "1", primary: 320, secondary: 560 },
      { label: "2", primary: 140, secondary: 840 },
      { label: "3", primary: 230, secondary: 520 },
      { label: "4", primary: 320, secondary: 660 },
      { label: "5", primary: 150, secondary: 460 },
      { label: "6", primary: 160, secondary: 850 },
      { label: "7", primary: 640, secondary: 320 },
      { label: "8", primary: 320, secondary: 440 },
      { label: "9", primary: 420, secondary: 620 },
    ])
    .meta({
      description: "Data for Image #1 mini dual-series bar chart.",
    }),
  donutData: z
    .array(DonutPointSchema)
    .min(3)
    .max(3)
    .default([
      { name: "Option A", value: 60 },
      { name: "Option B", value: 20 },
      { name: "Option C", value: 20 },
    ])
    .meta({
      description: "Data for Image #2 donut chart.",
    }),
  groupedBars: z
    .array(GroupedBarPointSchema)
    .min(4)
    .max(4)
    .default([
      { label: "label", optionA: 120, optionB: 200 },
      { label: "label", optionA: 150, optionB: 80 },
      { label: "label", optionA: 70, optionB: 110 },
      { label: "label", optionA: 130, optionB: 130 },
    ])
    .meta({
      description: "Data for Image #3 grouped bar chart.",
    }),
  trendLines: z
    .array(TrendPointSchema)
    .min(6)
    .max(7)
    .default([
      { label: "label", optionA: 8, optionB: 2 },
      { label: "label", optionA: 45, optionB: 65 },
      { label: "label", optionA: 35, optionB: 40 },
      { label: "label", optionA: 95, optionB: 100 },
      { label: "label", optionA: 50, optionB: 35 },
      { label: "label", optionA: 5, optionB: 75 },
      { label: "label", optionA: 55, optionB: 50 },
    ])
    .meta({
      description: "Data for Image #4 dual-line chart.",
    }),
  legendLabels: z.array(z.string().min(1).max(18).meta({
    description: "Single legend label used by chart variants.",
  })).min(2).max(3).default(["Option A", "Option B", "Option C"]).meta({
    description: "Legend labels used by donut/grouped/line variants.",
  }),
  xAxisName: z.string().min(3).max(16).default("X axis name").meta({
    description: "X axis title used in the dual-line variant.",
  }),
  yAxisName: z.string().min(3).max(16).default("Y axis name").meta({
    description: "Y axis title used in the dual-line variant.",
  }),
  footerLabel: z.string().min(10).max(60).default("Current margin: April Spendings").meta({
    description: "Footer label under mini bar chart.",
  }),
  footerValue: z.string().min(6).max(24).default("$350.00  /  $640.00").meta({
    description: "Footer value under mini bar chart.",
  }),
  bars: z
    .array(LegacyBarSchema)
    .min(8)
    .max(9)
    .default([
      { value: 52 },
      { value: 24 },
      { value: 35 },
      { value: 48 },
      { value: 26 },
      { value: 72 },
      { value: 47 },
      { value: 55 },
    ])
    .meta({
      description: "Legacy fallback bar values used when miniBars is not supplied.",
    }),
  metricValue: z.string().min(1).max(8).default("X 5").meta({
    description: "Legacy single KPI value.",
  }),
  metricBody: z.string().min(10).max(40).default("Lorem ipsum dolor sit.").meta({
    description: "Legacy single KPI body.",
  }),
  metricCards: z
    .array(MetricCardSchema)
    .min(1)
    .max(2)
    .default([
      { value: "X 5", body: "Lorem ipsum dolor sit." },
      { value: "X 5", body: "Lorem ipsum dolor sit." },
    ])
    .meta({
      description: "One or two KPI cards shown on the right.",
    }),
  metricIcon: z.object({
    __icon_url__: z.string().default("https://presenton-public.s3.ap-southeast-1.amazonaws.com/static/icons/placeholder.svg"),
    __icon_query__: z.string().min(3).max(30).default("pulse icon"),
  }).default({
    __icon_url__:
      "https://presenton-public.s3.ap-southeast-1.amazonaws.com/static/icons/placeholder.svg",
    __icon_query__: "pulse icon",
  }).meta({
    description: "Icon shown in the KPI callout card.",
  }),
});

export type SchemaType = z.infer<typeof Schema>;

const MINI_BAR_DARK = "var(--graph-0,#0B4B40)";
const MINI_BAR_LIGHT = "var(--graph-1,#CED3D1)";
const DONUT_COLORS = [
  "var(--graph-0,#0B4B40)",
  "var(--graph-1,#4B6B61)",
  "var(--graph-2,#7B938C)",
  "var(--graph-3,#A9BBB5)",
  "var(--graph-4,#C7D5D1)",
  "var(--graph-5,#6B8E84)",
  "var(--graph-6,#2E6157)",
  "var(--graph-7,#0F6656)",
  "var(--graph-8,#5C7B72)",
  "var(--graph-9,#93AAA2)",
];
const KPI_ICON_BG = "var(--graph-3,#063C73)";
const AXIS_TEXT = "var(--background-text,#566061)";
const GRID_LINE = "var(--stroke,#D7DCDA)";
const BODY_FONT = "var(--body-font-family,'Bricolage Grotesque')";

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
  return resolveToken(element, value, "#566061");
}

function resolveFont(element: HTMLElement) {
  return resolveToken(element, BODY_FONT, "Bricolage Grotesque").replace(/^['"]|['"]$/g, "");
}

function formatCurrency(value: string | number) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? `$${numeric}` : String(value);
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

function readableTextColor(color: unknown) {
  const resolved = Array.isArray(color) ? color[0] : color;
  if (typeof resolved !== "string") return "#ffffff";
  return colorLuminance(resolved) > 0.52 ? "#17342D" : "#ffffff";
}

function productBaseOptions(axisColor: string, fontFamily: string): ChartOptions {
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    resizeDelay: 0,
    color: axisColor,
    font: {
      family: fontFamily,
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

function productCategoryScale(axisColor: string, gridColor: string, fontFamily: string, display = true) {
  return {
    type: "category",
    display,
    offset: true,
    grid: {
      color: gridColor,
      display: false,
      drawTicks: false,
    },
    border: {
      display: false,
    },
    ticks: {
      color: axisColor,
      font: {
        family: fontFamily,
        size: 10,
      },
      maxRotation: 0,
      padding: 8,
    },
  };
}

function productLinearScale(axisColor: string, gridColor: string, fontFamily: string, display = true, currency = false) {
  return {
    type: "linear",
    beginAtZero: true,
    grace: "8%",
    display,
    grid: {
      color: gridColor,
      display: true,
      drawTicks: false,
    },
    border: {
      display: false,
    },
    ticks: {
      color: axisColor,
      font: {
        family: fontFamily,
        size: 10,
      },
      padding: 8,
      callback(value: string | number) {
        return currency ? formatCurrency(value) : String(value);
      },
    },
  };
}

function productLabelPlugin(mode: "grouped-bars" | "donut" | "none", axisColor: string, fontFamily: string) {
  return {
    id: `productOverviewLabels-${mode}`,
    afterDatasetsDraw(chart: any) {
      if (mode === "none") return;

      const ctx = chart.ctx as CanvasRenderingContext2D;
      ctx.save();

      if (mode === "grouped-bars") {
        ctx.fillStyle = axisColor;
        ctx.font = `600 9px ${fontFamily}`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        chart.data.datasets.forEach((dataset: any, datasetIndex: number) => {
          const meta = chart.getDatasetMeta(datasetIndex);
          meta.data.forEach((element: any, index: number) => {
            const value = Number(dataset.data[index]) || 0;
            const position = element.tooltipPosition();
            ctx.fillText(String(value), position.x, position.y - 10);
          });
        });
      }

      if (mode === "donut") {
        const dataset = chart.data.datasets[0];
        const meta = chart.getDatasetMeta(0);
        const values = dataset?.data ?? [];
        const total = values.reduce((sum: number, value: number) => sum + Math.abs(Number(value) || 0), 0);
        if (!total) {
          ctx.restore();
          return;
        }

        ctx.font = `700 11px ${fontFamily}`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.shadowColor = "rgba(0,0,0,0.14)";
        ctx.shadowBlur = 1;
        ctx.shadowOffsetY = 1;

        meta.data.forEach((element: any, index: number) => {
          const value = Number(values[index]) || 0;
          if (!value) return;
          const arc = element.getProps(["x", "y", "startAngle", "endAngle", "innerRadius", "outerRadius"], true);
          const angle = (arc.startAngle + arc.endAngle) / 2;
          const radius = arc.innerRadius + (arc.outerRadius - arc.innerRadius) * 0.58;
          const x = arc.x + Math.cos(angle) * radius;
          const y = arc.y + Math.sin(angle) * radius;
          const fill = Array.isArray(dataset.backgroundColor) ? dataset.backgroundColor[index] : dataset.backgroundColor;

          ctx.fillStyle = readableTextColor(fill);
          ctx.fillText(`${Math.round((value / total) * 100)}%`, x, y);
        });
      }

      ctx.restore();
    },
  };
}

function productChartConfig({
  canvas,
  donutData,
  groupedBars,
  miniBars,
  trendLines,
  variant,
  xAxisName,
  yAxisName,
}: {
  canvas: HTMLCanvasElement;
  donutData: NonNullable<SchemaType["donutData"]>;
  groupedBars: NonNullable<SchemaType["groupedBars"]>;
  miniBars: NonNullable<SchemaType["miniBars"]>;
  trendLines: NonNullable<SchemaType["trendLines"]>;
  variant: NonNullable<SchemaType["chartStyle"]>;
  xAxisName?: string;
  yAxisName?: string;
}): ChartConfiguration {
  const axisColor = resolveColor(canvas, AXIS_TEXT);
  const gridColor = resolveColor(canvas, GRID_LINE);
  const fontFamily = resolveFont(canvas);
  const miniDark = resolveColor(canvas, MINI_BAR_DARK);
  const miniLight = resolveColor(canvas, MINI_BAR_LIGHT);
  const graphTwo = resolveColor(canvas, "var(--graph-2,#8A9A96)");
  const donutColors = DONUT_COLORS.map((color) => resolveColor(canvas, color));
  const options = productBaseOptions(axisColor, fontFamily);

  if (variant === "donut") {
    return {
      type: "doughnut",
      data: {
        labels: donutData.map((item) => item.name),
        datasets: [
          {
            data: donutData.map((item) => item.value),
            backgroundColor: donutData.map((_, index) => donutColors[index % donutColors.length]),
            borderColor: "transparent",
            borderWidth: 0,
            hoverBorderWidth: 0,
            spacing: 0,
          },
        ],
      },
      options: {
        ...options,
        cutout: "58%",
        layout: {
          padding: 8,
        },
      },
      plugins: [productLabelPlugin("donut", axisColor, fontFamily)],
    } as ChartConfiguration;
  }

  if (variant === "grouped-bars") {
    return {
      type: "bar",
      data: {
        labels: groupedBars.map((item) => item.label),
        datasets: [
          {
            data: groupedBars.map((item) => item.optionA),
            backgroundColor: miniDark,
            borderRadius: 4,
            borderWidth: 0,
            barPercentage: 0.75,
            categoryPercentage: 0.65,
          },
          {
            data: groupedBars.map((item) => item.optionB),
            backgroundColor: graphTwo,
            borderRadius: 4,
            borderWidth: 0,
            barPercentage: 0.75,
            categoryPercentage: 0.65,
          },
        ],
      },
      options: {
        ...options,
        layout: {
          padding: { top: 12, right: 6, left: 0, bottom: 0 },
        },
        scales: {
          x: productCategoryScale(axisColor, gridColor, fontFamily, true),
          y: productLinearScale(axisColor, gridColor, fontFamily, true),
        },
      },
      plugins: [productLabelPlugin("grouped-bars", axisColor, fontFamily)],
    } as ChartConfiguration;
  }

  if (variant === "dual-line") {
    return {
      type: "line",
      data: {
        labels: trendLines.map((item) => item.label),
        datasets: [
          {
            data: trendLines.map((item) => item.optionA),
            borderColor: miniDark,
            backgroundColor: miniDark,
            borderWidth: 2,
            clip: false,
            pointRadius: 0,
            tension: 0.35,
          },
          {
            data: trendLines.map((item) => item.optionB),
            borderColor: graphTwo,
            backgroundColor: graphTwo,
            borderWidth: 2,
            clip: false,
            pointRadius: 0,
            tension: 0.35,
          },
        ],
      },
      options: {
        ...options,
        layout: {
          padding: { top: 12, right: 10, left: 0, bottom: 18 },
        },
        scales: {
          x: {
            ...productCategoryScale(axisColor, gridColor, fontFamily, true),
            title: {
              color: axisColor,
              display: Boolean(xAxisName),
              font: { family: fontFamily, size: 10 },
              padding: 0,
              text: xAxisName,
            },
          },
          y: {
            ...productLinearScale(axisColor, gridColor, fontFamily, true),
            suggestedMin: -4,
            suggestedMax: 104,
            title: {
              color: axisColor,
              display: Boolean(yAxisName),
              font: { family: fontFamily, size: 10 },
              padding: 0,
              text: yAxisName,
            },
          },
        },
      },
    } as ChartConfiguration;
  }

  return {
    type: "bar",
    data: {
      labels: miniBars.map((item) => item.label),
      datasets: [
        {
          data: miniBars.map((item) => item.secondary),
          backgroundColor: miniLight,
          borderRadius: 5,
          borderWidth: 0,
          barPercentage: 0.72,
          categoryPercentage: 0.8,
        },
        {
          data: miniBars.map((item) => item.primary),
          backgroundColor: miniDark,
          borderRadius: 5,
          borderWidth: 0,
          barPercentage: 0.72,
          categoryPercentage: 0.8,
        },
      ],
    },
    options: {
      ...options,
      layout: {
        padding: { top: 0, right: 8, left: 0, bottom: 0 },
      },
      scales: {
        x: productCategoryScale(axisColor, gridColor, fontFamily, false),
        y: productLinearScale(axisColor, gridColor, fontFamily, true, true),
      },
    },
  } as ChartConfiguration;
}

function ProductOverviewChart({
  donutData,
  groupedBars,
  miniBars,
  trendLines,
  variant,
  xAxisName,
  yAxisName,
}: {
  donutData: NonNullable<SchemaType["donutData"]>;
  groupedBars: NonNullable<SchemaType["groupedBars"]>;
  miniBars: NonNullable<SchemaType["miniBars"]>;
  trendLines: NonNullable<SchemaType["trendLines"]>;
  variant: NonNullable<SchemaType["chartStyle"]>;
  xAxisName?: string;
  yAxisName?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let frame: number | null = null;
    let chart: Chart | null = null;

    const renderChart = () => {
      chart?.destroy();
      chart = new Chart(canvas, productChartConfig({
        canvas,
        donutData,
        groupedBars,
        miniBars,
        trendLines,
        variant,
        xAxisName,
        yAxisName,
      }));
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
  }, [donutData, groupedBars, miniBars, trendLines, variant, xAxisName, yAxisName]);

  return <canvas ref={canvasRef} className="block h-full w-full" />;
}

const PulseIcon = () => (
  <svg viewBox="0 0 24 24" className="h-[22px] w-[22px]" aria-hidden="true">
    <path
      d="M2.5 12h4.6l1.7-4.4 3.1 9 2.7-6.2h6.9"
      fill="none"
      stroke="var(--primary-text,#ffffff)"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
    />
  </svg>
);

const ReportSnapshotSlide = ({ data }: { data: Partial<SchemaType> }) => {
  const {
    title,
    taglineLabel,
    taglineBody,
    sideImage,
    chartStyle,
    chartTitle,
    miniBars,
    donutData,
    groupedBars,
    trendLines,
    legendLabels,
    xAxisName,
    yAxisName,
    footerLabel,
    footerValue,
    bars,
    metricValue,
    metricBody,
    metricCards,
    metricIcon,
  } = data;

  const resolvedMiniBars =
    miniBars && miniBars.length >= 8
      ? miniBars
      : (bars ?? []).map((bar, index) => {
        const scaledPrimary = Math.round(bar.value * 8 + 80);
        const scaledSecondary = Math.min(1000, scaledPrimary + 220);

        return {
          label: `${index + 1}`,
          primary: scaledPrimary,
          secondary: scaledSecondary,
        };
      });

  const fallbackMetric = {
    value: metricValue ?? "X 5",
    body: metricBody ?? "Lorem ipsum dolor sit.",
  };

  const resolvedMetricCards =
    metricCards && metricCards.length > 0
      ? metricCards
      : [fallbackMetric, fallbackMetric];

  const visibleMetricCards =
    (chartStyle ?? "mini-bars") === "mini-bars"
      ? resolvedMetricCards.slice(0, 1)
      : resolvedMetricCards.slice(0, 2);

  const usePulseFallback = !metricIcon?.__icon_url__ || metricIcon.__icon_url__.includes("placeholder.svg");
  const activeChartStyle = chartStyle ?? "mini-bars";
  const resolvedDonutData =
    donutData && donutData.length > 0
      ? donutData
      : [
        { name: "Option A", value: 60 },
        { name: "Option B", value: 20 },
        { name: "Option C", value: 20 },
      ];
  const resolvedGroupedBars =
    groupedBars && groupedBars.length > 0
      ? groupedBars
      : [
        { label: "label", optionA: 120, optionB: 200 },
        { label: "label", optionA: 150, optionB: 80 },
        { label: "label", optionA: 70, optionB: 110 },
        { label: "label", optionA: 130, optionB: 130 },
      ];
  const resolvedTrendLines =
    trendLines && trendLines.length > 0
      ? trendLines
      : [
        { label: "label", optionA: 8, optionB: 2 },
        { label: "label", optionA: 45, optionB: 65 },
        { label: "label", optionA: 35, optionB: 40 },
        { label: "label", optionA: 95, optionB: 100 },
        { label: "label", optionA: 50, optionB: 35 },
        { label: "label", optionA: 5, optionB: 75 },
        { label: "label", optionA: 55, optionB: 50 },
      ];
  const donutTotal = resolvedDonutData.reduce((sum, item) => sum + item.value, 0) || 1;

  return (
    <>
      <link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,200..800&display=swap" rel="stylesheet" />
      <div
        className="relative h-[720px] w-[1280px] overflow-hidden "
        style={{
          backgroundColor: "var(--background-color,#D7DEDB)",
          fontFamily: "var(--body-font-family,'Bricolage Grotesque')",
        }}
      >
        <div className="flex gap-7 h-full">


          {sideImage?.__image_url__ && (
            <img
              src={sideImage.__image_url__}
              alt={sideImage.__image_prompt__}
              className=" h-full w-[232px] object-cover"
            />
          )}
          <div className="flex flex-col flex-1 justify-center">
            <div
              className=" text-[#083F37]"
              style={{ color: "var(--primary-color,#083F37)" }}
            >
              <h2 className="text-[80px] font-semibold leading-[108.4%] tracking-[-2.419px]">
                {title}
              </h2>

              <div className="mt-[14px] ">
                <p
                  className="text-[20px] font-semibold tracking-[2.074px] text-[#083F37]"
                  style={{ color: "var(--primary-color,#083F37)" }}
                >
                  {taglineLabel}
                </p>
                <p
                  className="mt-[12px] text-[24px] mb-5 leading-[1.11] text-[#083F37]/75"
                  style={{ color: "var(--background-text,#083F37BF)" }}
                >
                  {taglineBody}
                </p>
              </div>
            </div>
            <div className="flex gap-4">
              <div
                className={` w-[580px] overflow-hidden bg-[#F3F3F3] px-[28px] pb-[18px] pt-[20px] ${activeChartStyle === "mini-bars" ? "h-[308px]" : "h-[350px]"
                  }`}
                style={{ backgroundColor: "var(--card-color,#F3F3F3)" }}
              >
                <p
                  className="mt-[14px] text-[32px] font-normal leading-[1.1] text-[#15342D]"
                  style={{ color: "var(--primary-color,#15342D)" }}
                >
                  {chartTitle}
                </p>


                {activeChartStyle === "mini-bars" && (
                  <>
                    <div className="mt-[18px] h-[166px] overflow-hidden">
                      <ProductOverviewChart
                        donutData={resolvedDonutData}
                        groupedBars={resolvedGroupedBars}
                        miniBars={resolvedMiniBars}
                        trendLines={resolvedTrendLines}
                        variant="mini-bars"
                      />
                    </div>

                    <div className="mt-[14px] flex items-center justify-between ">
                      <p
                        className="text-[#6D7371] text-[18px]"
                        style={{ color: "var(--background-text,#6D7371)" }}
                      >
                        {footerLabel}
                      </p>
                      <p
                        className="font-medium text-[#15342D] text-[18px]"
                        style={{ color: "var(--primary-color,#15342D)" }}
                      >
                        {footerValue}
                      </p>
                    </div>
                  </>
                )}

                {activeChartStyle === "donut" && (
                  <div className="mt-[6px] flex h-[250px] items-center">
                    <div className="h-[220px] w-[250px] overflow-hidden">
                      <ProductOverviewChart
                        donutData={resolvedDonutData}
                        groupedBars={resolvedGroupedBars}
                        miniBars={resolvedMiniBars}
                        trendLines={resolvedTrendLines}
                        variant="donut"
                      />
                    </div>

                    <div className="ml-[8px] flex-1 space-y-[16px] pr-[8px]">
                      {resolvedDonutData.map((entry, index) => {
                        const percent = Math.round((entry.value / donutTotal) * 100);
                        return (
                          <div key={`${entry.name}-legend-${index}`} className="flex items-center justify-between">
                            <div className="flex items-center gap-[10px]">
                              <span
                                className="h-[14px] w-[14px] rounded-full"
                                style={{ backgroundColor: DONUT_COLORS[index % DONUT_COLORS.length] }}
                              />
                              <p
                                className="text-[18px] font-bold  text-[#767676]"
                                style={{ color: "var(--background-text,#767676)" }}
                              >
                                {legendLabels?.[index] ?? entry.name}
                              </p>
                            </div>
                            <p
                              className="text-[18px] font-bold  text-[#404040]"
                              style={{ color: "var(--background-text,#404040)" }}
                            >
                              {percent}%
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {activeChartStyle === "grouped-bars" && (
                  <div className="mt-[12px] flex h-[236px] items-center justify-between">
                    <div className="h-[210px] w-[362px] overflow-hidden">
                      <ProductOverviewChart
                        donutData={resolvedDonutData}
                        groupedBars={resolvedGroupedBars}
                        miniBars={resolvedMiniBars}
                        trendLines={resolvedTrendLines}
                        variant="grouped-bars"
                      />
                    </div>

                    <div className="ml-[24px] space-y-[24px]">
                      <div className="flex items-center gap-[10px]">
                        <span
                          className="h-[14px] w-[14px] rounded-full bg-[#0B4B40]"
                          style={{ backgroundColor: "var(--graph-0,#0B4B40)" }}
                        />
                        <p
                          className="text-[18px] font-medium leading-[1] text-[#6A6B6E]"
                          style={{ color: "var(--background-text,#6A6B6E)" }}
                        >
                          {legendLabels?.[0] ?? "Option A"}
                        </p>
                      </div>
                      <div className="flex items-center gap-[10px]">
                        <span
                          className="h-[14px] w-[14px] rounded-full bg-[#8A9A96]"
                          style={{ backgroundColor: "var(--graph-2,#8A9A96)" }}
                        />
                        <p
                          className="text-[18px] font-medium leading-[1] text-[#6A6B6E]"
                          style={{ color: "var(--background-text,#6A6B6E)" }}
                        >
                          {legendLabels?.[1] ?? "Option B"}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {activeChartStyle === "dual-line" && (
                  <div className="mt-[12px] flex h-[236px] items-center justify-between">
                    <div className="h-[210px] w-[362px] overflow-hidden">
                      <ProductOverviewChart
                        donutData={resolvedDonutData}
                        groupedBars={resolvedGroupedBars}
                        miniBars={resolvedMiniBars}
                        trendLines={resolvedTrendLines}
                        variant="dual-line"
                        xAxisName={xAxisName}
                        yAxisName={yAxisName}
                      />
                    </div>

                    <div className="ml-[18px] space-y-[24px]">
                      <div className="flex items-center gap-[10px]">
                        <span
                          className="h-[14px] w-[14px] rounded-full bg-[#0B4B40]"
                          style={{ backgroundColor: "var(--graph-0,#0B4B40)" }}
                        />
                        <p
                          className="text-[18px] font-medium leading-[1] text-[#6A6B6E]"
                          style={{ color: "var(--background-text,#6A6B6E)" }}
                        >
                          {legendLabels?.[0] ?? "Option A"}
                        </p>
                      </div>
                      <div className="flex items-center gap-[10px]">
                        <span
                          className="h-[14px] w-[14px] rounded-full bg-[#8A9A96]"
                          style={{ backgroundColor: "var(--graph-2,#8A9A96)" }}
                        />
                        <p
                          className="text-[18px] font-medium leading-[1] text-[#6A6B6E]"
                          style={{ color: "var(--background-text,#6A6B6E)" }}
                        >
                          {legendLabels?.[1] ?? "Option B"}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div
                className={` w-[362px] ${activeChartStyle === "mini-bars" ? "top-[382px]" : "top-[320px]"
                  }`}
              >
                <div className="flex flex-col justify-end items-end gap-[24px]">
                  {visibleMetricCards.map((metric, index) => (
                    <div
                      key={`${metric.value}-${index}`}
                      className="bg-[#F3F3F3] px-[33px] py-[24px]"
                      style={{ backgroundColor: "var(--card-color,#F3F3F3)" }}
                    >
                      <div className="flex items-center gap-[14px]">
                        <div
                          className="flex h-[56px] w-[56px] items-center justify-center rounded-full"
                          style={{ backgroundColor: metricIcon?.__icon_url__ ? "var(--primary-color,#113F37)" : KPI_ICON_BG }}
                        >
                          {usePulseFallback ? (
                            <PulseIcon />
                          ) : (
                            <RemoteSvgIcon
                              url={metricIcon?.__icon_url__}
                              strokeColor={"currentColor"}
                              className="w-[24px] h-[24px] object-contain"
                              color="var(--primary-text, #FEFEFF)"
                              title={metricIcon?.__icon_query__}
                            />
                          )}
                        </div>
                        <p
                          className="text-[48px] font-semibold leading-[1] text-[#113F37]"
                          style={{ color: "var(--primary-color,#113F37)" }}
                        >
                          {metric.value}
                        </p>
                      </div>
                      <p
                        className="mt-[18px] text-[28px] leading-[1.08] text-[#113F37]"
                        style={{ color: "var(--primary-color,#113F37)" }}
                      >
                        {metric.body}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default ReportSnapshotSlide;
