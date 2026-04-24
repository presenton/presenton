"use client";

import { useId } from "react";
import * as z from "zod";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ReferenceLine,
  Scatter,
  ScatterChart,
  XAxis,
  YAxis,
  LabelList,
  ResponsiveContainer,
} from "recharts";

export const simpleDataSchema = z.object({
  name: z.string().meta({ description: "Data point name" }),
  value: z.number().meta({ description: "Data point value" }),
});

export const multiSeriesDataSchema = z.object({
  name: z.string().meta({ description: "Category name" }),
  values: z.any().meta({
    description:
      "Key-value pairs for each series (object with series names as keys and numbers as values)",
  }),
});

export const divergingDataSchema = z.object({
  name: z.string().meta({ description: "Category name" }),
  positive: z.number().meta({ description: "Positive value" }),
  negative: z.number().meta({ description: "Negative value" }),
});

export const scatterDataSchema = z.object({
  x: z.number().meta({ description: "X coordinate" }),
  y: z.number().meta({ description: "Y coordinate" }),
});

/** Two series over categorical labels (line stats slide). */
export const dualLinePointSchema = z.object({
  label: z.string().meta({ description: "Chart axis label" }),
  valueA: z.number().meta({ description: "First series value" }),
  valueB: z.number().meta({ description: "Second series value" }),
});
export const SimpleDataPointSchema = z.object({
  name: z.string(),
  value: z.number(),
});

export const MultiSeriesDataPointSchema = z.object({
  name: z.string(),
  values: z.any(),
});

export const DivergingDataPointSchema = z.object({
  name: z.string(),
  positive: z.number(),
  negative: z.number(),
});

export const ScatterDataPointSchema = z.object({
  x: z.number(),
  y: z.number(),
  name: z.string().optional(),
});


export const flexibleChartTypeSchema = z.enum([
  "bar",
  "bar-horizontal",
  "bar-grouped-vertical",
  "bar-grouped-horizontal",
  "bar-stacked-vertical",
  "bar-stacked-horizontal",
  "bar-clustered",
  "bar-diverging",
  "line",
  "line-dual",
  "area",
  "area-stacked",
  "pie",
  "donut",
  "scatter",
]);

export const flexibleChartDataSchema = z.object({
  type: flexibleChartTypeSchema.default("bar"),
  data: z.union([
    z.array(simpleDataSchema),
    z.array(multiSeriesDataSchema),
    z.array(divergingDataSchema),
    z.array(scatterDataSchema),
    z.array(dualLinePointSchema),
  ]),
  series: z.array(z.string()).optional().meta({ description: "Series names for grouped/stacked charts" }),
  divergingLabels: z.tuple([z.string(), z.string()]).optional(),
});

export type FlexibleChartData = z.infer<typeof flexibleChartDataSchema>;

const formatComma = (value: number) => value.toLocaleString("en-US");

export function deriveSeriesNames(data: any[], explicit: string[]): string[] {
  if (explicit.length > 0) return explicit;
  const first = data[0];
  if (!first) return [];
  if (first.values != null && typeof first.values === "object" && !Array.isArray(first.values)) {
    return Object.keys(first.values);
  }
  if (typeof first.value === "number") return ["value"];
  return [];
}

export function transformMultiSeriesData(data: any[], series: string[]) {
  return data.map((item) => {
    const result: Record<string, any> = { name: item.name };
    series.forEach((s) => {
      if (item.values != null && typeof item.values === "object" && s in item.values) {
        result[s] = Number(item.values[s]) || 0;
      } else if (s === "value" && typeof item.value === "number") {
        result[s] = item.value;
      } else if (typeof item[s] === "number") {
        result[s] = item[s];
      } else {
        result[s] = Number(item.values?.[s]) || 0;
      }
    });
    return result;
  });
}

export function transformDivergingData(data: any[]) {
  return data.map((item) => {
    if (typeof item.positive === "number" && typeof item.negative === "number") {
      return {
        name: item.name,
        positive: item.positive,
        negative: -Math.abs(item.negative),
      };
    }
    const v = Number(item.value);
    if (!Number.isNaN(v)) {
      return {
        name: item.name,
        positive: Math.max(0, v),
        negative: v < 0 ? v : 0,
      };
    }
    return { name: item.name, positive: 0, negative: 0 };
  });
}

export function normalizeScatterPoints(data: any[]) {
  return data.map((item, i) => {
    if (typeof item.x === "number" && typeof item.y === "number") {
      return { ...item, x: item.x, y: item.y };
    }
    if (typeof item.value === "number") {
      return { ...item, x: typeof item.x === "number" ? item.x : i + 1, y: item.value };
    }
    return { ...item, x: i + 1, y: 0 };
  });
}

/** Line-stats style rows: categorical `label` + two metrics (not a single `value` series). */
function dataIsDualLineShape(data: any[]): boolean {
  const row = data[0];
  return (
    !!row &&
    typeof row === "object" &&
    typeof row.label === "string" &&
    typeof row.valueA === "number" &&
    typeof row.valueB === "number" &&
    typeof row.value !== "number"
  );
}

const MULTI_SERIES_CHART_TYPES: FlexibleChartData["type"][] = [
  "bar-grouped-vertical",
  "bar-grouped-horizontal",
  "bar-stacked-vertical",
  "bar-stacked-horizontal",
  "bar-clustered",
  "area-stacked",
];

/**
 * Aligns `data`/`series` with `chartType`. Line-stats slides often keep `{ label, valueA, valueB }`
 * while bar/line/pie/etc. expect `name`/`value` or `values` + series keys.
 */
export function normalizeFlexibleChartData(
  chartType: FlexibleChartData["type"],
  data: any[],
  seriesIn: string[],
): { data: any[]; series: string[] } {
  const series = seriesIn ?? [];
  const rows = data ?? [];

  if (chartType === "line-dual") {
    if (dataIsDualLineShape(rows)) return { data: rows, series };
    return {
      data: rows.map((r, i) => ({
        label: r.label ?? r.name ?? `P${i + 1}`,
        valueA: typeof r.valueA === "number" ? r.valueA : typeof r.value === "number" ? r.value : 0,
        valueB: typeof r.valueB === "number" ? r.valueB : typeof r.value === "number" ? r.value : 0,
      })),
      series,
    };
  }

  if (!dataIsDualLineShape(rows)) {
    return { data: rows, series };
  }

  const dual = rows as Array<{ label: string; valueA: number; valueB: number }>;

  if (MULTI_SERIES_CHART_TYPES.includes(chartType)) {
    const keys = series.length >= 2 ? [series[0], series[1]] : ["A", "B"];
    const mapped = dual.map((r) => ({
      name: r.label,
      values: { [keys[0]]: r.valueA, [keys[1]]: r.valueB },
    }));
    return { data: mapped, series: keys };
  }

  if (chartType === "bar-diverging") {
    const mapped = dual.map((r) => ({
      name: r.label,
      positive: Math.max(0, r.valueA),
      negative: Math.max(0, r.valueB),
    }));
    return { data: mapped, series };
  }

  const mapped = dual.map((r) => ({
    name: r.label,
    value: r.valueA + r.valueB,
  }));
  return { data: mapped, series };
}

const graphVar = (index: number, fallback: string) => `var(--graph-${index % 10}, ${fallback})`;

export type ChartDensity = "default" | "compact";

export type FlexibleReportChartProps = {
  chartType: FlexibleChartData["type"];
  data: any[];
  series?: string[];
  colorFallback?: string;
  /** For `line-dual` only */
  dualLineColors?: [string, string];
  /** Smaller type, margins, and labels for multi-chart dashboards */
  density?: ChartDensity;
};

export function FlexibleReportChart({
  chartType,
  data: chartData,
  series = [],
  colorFallback = "#157CFF",
  dualLineColors = ["var(--graph-0,#9fb6ff)", "var(--graph-1,#4d4ef3)"],
  density = "default",
}: FlexibleReportChartProps) {
  const areaGradientId = `flex-area-${useId().replace(/:/g, "")}`;
  const compact = density === "compact";

  const { data: normalizedData, series: normalizedSeries } = normalizeFlexibleChartData(
    chartType,
    chartData,
    series,
  );
  const effectiveSeries = deriveSeriesNames(normalizedData as any[], normalizedSeries);
  const scatterPoints = normalizeScatterPoints(normalizedData as any[]);

  const ui = {
    tickFs: compact ? 6 : 10,
    catAxisW: compact ? 36 : 60,
    barSize: compact ? 20 : 35,
    labelFs: compact ? 8 : 14,
    labelOffTop: compact ? 2 : 10,
    labelOffSide: compact ? 2 : 8,
    margin: compact
      ? { top: 10, right: 15, left: -2, bottom: 0 }
      : { top: 20, right: 20, left: 0, bottom: 5 },
    lineStroke: compact ? 2 : 3,
    dotR: compact ? 2.5 : 4,
    dotStroke: compact ? 1 : 2,
    barRadiusLg: compact ? ([4, 4, 0, 0] as const) : ([8, 8, 0, 0] as const),
    barRadiusMd: compact ? ([2, 2, 0, 0] as const) : ([4, 4, 0, 0] as const),
    barRadiusH: compact ? ([0, 4, 4, 0] as const) : ([0, 6, 6, 0] as const),
    pieOuter: compact ? "100%" : "100%",
    donutOuter: compact ? "90%" : "100%",
    donutInner: compact ? "60%" : "70%",
    pieMargin: compact
      ? { top: 0, right: 0, left: 0, bottom: 0 }
      : { top: 8, right: 8, left: 8, bottom: 8 },
    pieLabelMinPct: compact ? 0.12 : 0.06,
    pieMaxNameLen: compact ? 6 : 10,
  };

  const axisProps = {
    tick: { fill: "var(--background-text, #232223)", fontSize: ui.tickFs, fontWeight: 500 },
    axisLine: { stroke: "var(--background-text, #232223)" },
    tickLine: { stroke: "var(--background-text, #232223)" },
  };

  const gridProps = {
    strokeDasharray: "3 3",
    stroke: "var(--background-text, #232223)",
    opacity: 0.7,
  };

  const renderPieInsideLabel = (props: any) => {
    const {
      cx = 0,
      cy = 0,
      midAngle = 0,
      innerRadius: ir = 0,
      outerRadius: or = 0,
      percent = 0,
      name,
    } = props;
    if (percent < ui.pieLabelMinPct) return null;
    const toNum = (v: unknown) => {
      if (typeof v === "number" && Number.isFinite(v)) return v;
      if (typeof v === "string" && v.trim().endsWith("%")) return NaN;
      const n = Number(v);
      return Number.isFinite(n) ? n : NaN;
    };
    let inner = toNum(ir);
    let outer = toNum(or);
    if (!Number.isFinite(outer)) {
      outer = compact ? 56 : 140;
      inner = Number.isFinite(inner) ? inner : 0;
    }
    if (!Number.isFinite(inner)) inner = 0;
    const midR = inner + (outer - inner) * 0.5;
    const rad = (-midAngle * Math.PI) / 180;
    const x = cx + midR * Math.cos(rad);
    const y = cy + midR * Math.sin(rad);
    const nm = String(name ?? "");
    const short = nm.length <= ui.pieMaxNameLen;
    const pct = `${(percent * 100).toFixed(0)}%`;
    const fontSize = compact ? (short ? 6 : 5) : short ? 12 : 12;
    const labelText = compact ? pct : short ? `${name} ${pct}` : pct;
    return (

      <g>
        {/* <circle cx={x} cy={y} fill="var(--card-color,#ECEAF8)" /> */}
        <text
          x={x}
          y={y}
          style={{ padding: "4px" }}
          textAnchor="middle"
          fill="var(--background-text,#2C2B39)"
          fontSize={fontSize}
          fontWeight={600}
        >
          {labelText}
        </text>
      </g>
    );
  };

  const commonProps = {
    margin: ui.margin,

  };

  switch (chartType) {
    case "bar":
      return (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={normalizedData as any[]} {...commonProps}>
            <CartesianGrid vertical={false} {...gridProps} />
            <XAxis
              dataKey="name"
              {...axisProps}
              tickFormatter={formatComma}
              tickLine={false}
              axisLine={false}
            />
            <YAxis {...axisProps} tickFormatter={formatComma} tickLine={false} axisLine={false} />
            <Bar dataKey="value" fill={graphVar(0, colorFallback)} barSize={ui.barSize} radius={[...ui.barRadiusLg]}>
              <LabelList
                dataKey="value"
                position="top"
                fill={graphVar(0, colorFallback)}
                fontSize={ui.labelFs}
                offset={ui.labelOffTop}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      );

    case "bar-horizontal":
      return (
        <ResponsiveContainer width="100%" height="100%">

          <BarChart data={normalizedData as any[]} layout="vertical" {...commonProps}>
            <CartesianGrid vertical={false} {...gridProps} />
            <XAxis type="number" {...axisProps} tickFormatter={formatComma} tickLine={false} axisLine={false} />
            <YAxis
              type="category"
              dataKey="name"
              {...axisProps}
              width={ui.catAxisW}
              tickFormatter={formatComma}
              tickLine={false}
              axisLine={false}
            />
            <Bar dataKey="value" barSize={ui.barSize} fill={graphVar(0, colorFallback)} radius={[...ui.barRadiusH]}>
              <LabelList
                dataKey="value"
                position="right"
                fill={graphVar(0, colorFallback)}
                fontSize={ui.labelFs}
                offset={ui.labelOffSide}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      );

    case "bar-grouped-vertical": {
      const transformedData = transformMultiSeriesData(normalizedData as any[], effectiveSeries);
      return (
        <ResponsiveContainer width="100%" height="100%">

          <BarChart data={transformedData} {...commonProps}>
            <CartesianGrid vertical={false} {...gridProps} />
            <XAxis
              dataKey="name"
              {...axisProps}
              tickFormatter={formatComma}
              tickLine={false}
              axisLine={false}
            />
            <YAxis {...axisProps} tickFormatter={formatComma} tickLine={false} axisLine={false} />
            {effectiveSeries.map((s: string, index: number) => (
              <Bar key={s} dataKey={s} barSize={ui.barSize} fill={graphVar(index, colorFallback)} radius={[...ui.barRadiusMd]}>
                <LabelList
                  dataKey={s}
                  position="top"
                  fill={graphVar(index, colorFallback)}
                  fontSize={ui.labelFs}
                  offset={ui.labelOffTop}
                />
              </Bar>
            ))}
          </BarChart>
        </ResponsiveContainer>
      );
    }

    case "bar-grouped-horizontal": {
      const transformedData = transformMultiSeriesData(normalizedData as any[], effectiveSeries);
      return (
        <ResponsiveContainer width="100%" height="100%">

          <BarChart data={transformedData} layout="vertical" {...commonProps}>
            <CartesianGrid vertical={false} {...gridProps} />
            <XAxis type="number" {...axisProps} tickFormatter={formatComma} tickLine={false} axisLine={false} />
            <YAxis
              type="category"
              dataKey="name"
              {...axisProps}
              width={ui.catAxisW}
              tickFormatter={formatComma}
              tickLine={false}
              axisLine={false}
            />
            {effectiveSeries.map((s: string, index: number) => (
              <Bar key={s} dataKey={s} barSize={ui.barSize} fill={graphVar(index, colorFallback)} radius={[...ui.barRadiusH]}>
                <LabelList
                  dataKey={s}
                  position="right"
                  fill={graphVar(index, colorFallback)}
                  fontSize={ui.labelFs}
                  offset={ui.labelOffSide}
                />
              </Bar>
            ))}
          </BarChart>
        </ResponsiveContainer>
      );
    }

    case "bar-stacked-vertical": {
      const transformedData = transformMultiSeriesData(normalizedData as any[], effectiveSeries);
      return (
        <ResponsiveContainer width="100%" height="100%">

          <BarChart data={transformedData} {...commonProps}>
            <CartesianGrid vertical={false} {...gridProps} />
            <XAxis
              dataKey="name"
              {...axisProps}
              tickFormatter={formatComma}
              tickLine={false}
              axisLine={false}
            />
            <YAxis {...axisProps} tickFormatter={formatComma} tickLine={false} axisLine={false} />
            {effectiveSeries.map((s: string, index: number) => (
              <Bar
                key={s}
                dataKey={s}
                stackId="stack"
                barSize={ui.barSize}
                fill={graphVar(index, colorFallback)}
                radius={index === effectiveSeries.length - 1 ? [...ui.barRadiusMd] : [0, 0, 0, 0]}
              >
                <LabelList
                  dataKey={s}
                  position="top"
                  fill={graphVar(index, colorFallback)}
                  fontSize={ui.labelFs}
                  offset={ui.labelOffTop}
                />
              </Bar>
            ))}
          </BarChart>
        </ResponsiveContainer>
      );
    }

    case "bar-stacked-horizontal": {
      const transformedData = transformMultiSeriesData(normalizedData as any[], effectiveSeries);
      return (
        <ResponsiveContainer width="100%" height="100%">

          <BarChart data={transformedData} layout="vertical" {...commonProps}>
            <CartesianGrid vertical={false} {...gridProps} />
            <XAxis type="number" {...axisProps} tickFormatter={formatComma} tickLine={false} axisLine={false} />
            <YAxis
              type="category"
              dataKey="name"
              {...axisProps}
              width={ui.catAxisW}
              tickFormatter={formatComma}
              tickLine={false}
              axisLine={false}
            />
            {effectiveSeries.map((s: string, index: number) => (
              <Bar
                key={s}
                dataKey={s}
                stackId="stack"
                barSize={ui.barSize}
                fill={graphVar(index, colorFallback)}
                radius={index === effectiveSeries.length - 1 ? [...ui.barRadiusH] : [0, 0, 0, 0]}
              >
                <LabelList
                  dataKey={s}
                  position="right"
                  fill={graphVar(index, colorFallback)}
                  fontSize={ui.labelFs}
                  offset={ui.labelOffSide}
                />
              </Bar>
            ))}
          </BarChart>
        </ResponsiveContainer>
      );
    }

    case "bar-clustered": {
      const transformedData = transformMultiSeriesData(normalizedData as any[], effectiveSeries);
      return (
        <ResponsiveContainer width="100%" height="100%">

          <BarChart data={transformedData} barGap={1} barCategoryGap="15%" {...commonProps}>
            <CartesianGrid vertical={false} {...gridProps} />
            <XAxis
              dataKey="name"
              {...axisProps}
              tickFormatter={formatComma}
              tickLine={false}
              axisLine={false}
            />
            <YAxis {...axisProps} tickFormatter={formatComma} tickLine={false} axisLine={false} />
            {effectiveSeries.map((s: string, index: number) => (
              <Bar
                key={s}
                dataKey={s}
                barSize={Math.max(
                  compact ? 6 : 15,
                  (compact ? 22 : 50) / Math.max(1, effectiveSeries.length),
                )}
                fill={graphVar(index, colorFallback)}
                radius={compact ? [2, 2, 0, 0] : [3, 3, 0, 0]}
              >
                <LabelList
                  dataKey={s}
                  position="top"
                  fill={graphVar(index, colorFallback)}
                  fontSize={ui.labelFs}
                  offset={ui.labelOffTop}
                />
              </Bar>
            ))}
          </BarChart>
        </ResponsiveContainer>
      );
    }

    case "bar-diverging": {
      const transformedData = transformDivergingData(normalizedData as any[]);
      return (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={transformedData} layout="vertical" stackOffset="sign" {...commonProps}>
            <CartesianGrid vertical={false} {...gridProps} />
            <XAxis type="number" {...axisProps} tickFormatter={formatComma} tickLine={false} axisLine={false} />
            <YAxis
              type="category"
              dataKey="name"
              {...axisProps}
              width={ui.catAxisW}
              tickFormatter={formatComma}
              tickLine={false}
              axisLine={false}
            />
            <ReferenceLine x={0} stroke="var(--stroke,#9CA3AF)" strokeWidth={1} />
            <Bar dataKey="positive" barSize={ui.barSize} fill={graphVar(0, colorFallback)} stackId="stack" radius={[...ui.barRadiusH]}>
              <LabelList dataKey="positive" position="right" fill={graphVar(0, colorFallback)} fontSize={ui.labelFs} offset={ui.labelOffSide} />
            </Bar>
            <Bar dataKey="negative" fill={graphVar(3, colorFallback)} stackId="stack" radius={compact ? [2, 0, 0, 2] : [4, 0, 0, 4]}>
              <LabelList dataKey="negative" position="left" fill={graphVar(3, colorFallback)} fontSize={ui.labelFs} offset={ui.labelOffSide} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      );
    }

    case "line":
      return (
        <ResponsiveContainer width="100%" height="100%">

          <LineChart data={normalizedData as any[]} {...commonProps}>
            <CartesianGrid vertical={false} {...gridProps} />
            <XAxis
              dataKey="name"
              {...axisProps}
              tickFormatter={formatComma}
              tickLine={false}
              axisLine={false}
            />
            <YAxis {...axisProps} tickFormatter={formatComma} tickLine={false} axisLine={false} />
            <Line
              type="monotone"
              dataKey="value"
              stroke={graphVar(0, colorFallback)}
              strokeWidth={ui.lineStroke}
              dot={{ fill: graphVar(0, colorFallback), strokeWidth: ui.dotStroke, r: ui.dotR }}
            />
          </LineChart>
        </ResponsiveContainer>
      );

    case "line-dual":
      return (
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={normalizedData as any[]} {...commonProps}>
            <CartesianGrid vertical={false} {...gridProps} />
            <XAxis
              dataKey="label"
              {...axisProps}
              tickFormatter={formatComma}
              tickLine={false}
              axisLine={false}
            />
            <YAxis {...axisProps} tickFormatter={formatComma} tickLine={false} axisLine={false} />
            <Line
              type="monotone"
              dataKey="valueA"
              stroke={dualLineColors[0]}
              strokeWidth={ui.lineStroke}
              dot={{ fill: dualLineColors[0], strokeWidth: ui.dotStroke, r: ui.dotR }}
            />
            <Line
              type="monotone"
              dataKey="valueB"
              stroke={dualLineColors[1]}
              strokeWidth={ui.lineStroke}
              dot={{ fill: dualLineColors[1], strokeWidth: ui.dotStroke, r: ui.dotR }}
            />
          </LineChart>
        </ResponsiveContainer>
      );

    case "area":
      return (
        <ResponsiveContainer width="100%" height="100%">


          <AreaChart data={normalizedData as any[]} {...commonProps}>
            <CartesianGrid vertical={false} {...gridProps} />
            <XAxis
              dataKey="name"
              {...axisProps}
              tickFormatter={formatComma}
              tickLine={false}
              axisLine={false}
            />
            <YAxis {...axisProps} tickFormatter={formatComma} tickLine={false} axisLine={false} />
            <defs>
              <linearGradient id={areaGradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={graphVar(0, colorFallback)} stopOpacity={0.4} />
                <stop offset="95%" stopColor={graphVar(0, colorFallback)} stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <Area
              type="monotone"
              dataKey="value"
              stroke={graphVar(0, colorFallback)}
              strokeWidth={compact ? 1.5 : 2}
              fill={`url(#${areaGradientId})`}
            />
          </AreaChart>
        </ResponsiveContainer>
      );

    case "area-stacked": {
      const transformedData = transformMultiSeriesData(normalizedData as any[], effectiveSeries);
      return (
        <ResponsiveContainer width="100%" height="100%">

          <AreaChart data={transformedData} {...commonProps}>
            <CartesianGrid vertical={false} {...gridProps} />
            <XAxis
              dataKey="name"
              {...axisProps}
              tickFormatter={formatComma}
              tickLine={false}
              axisLine={false}
            />
            <YAxis {...axisProps} tickFormatter={formatComma} tickLine={false} axisLine={false} />
            {effectiveSeries.map((s: string, index: number) => (
              <Area
                key={s}
                type="monotone"
                dataKey={s}
                stackId="1"
                stroke={graphVar(index, colorFallback)}
                fill={graphVar(index, colorFallback)}
                fillOpacity={0.4}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      );
    }

    case "pie":
      return (
        <ResponsiveContainer width="100%" height="100%">

          <PieChart {...commonProps} margin={ui.pieMargin}>
            <Pie
              data={normalizedData as any[]}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius={ui.pieOuter}
              innerRadius={0}
              label={renderPieInsideLabel}
              labelLine={false}
            >
              {(normalizedData as any[]).map((_, index) => (
                <Cell key={`pie-cell-${index}`} fill={graphVar(index, colorFallback)} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      );

    case "donut":
      return (
        <ResponsiveContainer width="100%" height="100%">

          <PieChart {...commonProps} margin={ui.pieMargin}>
            <Pie
              data={normalizedData as any[]}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius={ui.donutOuter}
              innerRadius={ui.donutInner}
              label={renderPieInsideLabel}
              paddingAngle={compact ? 1 : 2}
              labelLine={false}
            >
              {(normalizedData as any[]).map((_, index) => (
                <Cell key={`donut-cell-${index}`} fill={graphVar(index, colorFallback)} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      );

    case "scatter":
      return (
        <ResponsiveContainer width="100%" height="100%">

          <ScatterChart {...commonProps}>
            <CartesianGrid vertical={false} {...gridProps} />
            <XAxis dataKey="x" type="number" {...axisProps} tickFormatter={formatComma} tickLine={false} axisLine={false} />
            <YAxis dataKey="y" type="number" {...axisProps} tickFormatter={formatComma} tickLine={false} axisLine={false} />
            <Scatter data={scatterPoints} name="Series">
              {scatterPoints.map((_, index) => (
                <Cell key={`scatter-cell-${index}`} fill={graphVar(index, colorFallback)} />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      );

    default:
      return (
        <div className="flex h-full items-center justify-center text-gray-500">Unsupported chart type</div>
      );
  }
}
