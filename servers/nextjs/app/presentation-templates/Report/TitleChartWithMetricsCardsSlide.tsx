"use client";

import * as z from "zod";

import { ResponsiveContainer } from "recharts";

import { FlexibleReportChart, flexibleChartDataSchema } from "./flexibleReportChart";

const MetricSchema = z.object({
  value: z.string().min(1).max(12).meta({
    description: "Primary metric value shown in the stat card.",
  }),
  label: z.string().min(3).max(24).optional().meta({
    description: "Metric label shown below the value.",
  }),
  description: z.string().min(6).max(36).optional().meta({
    description: "Supporting description shown below the label.",
  }),
});

const StatColumnSchema = z.object({
  metrics: z.array(MetricSchema).min(0).max(2).meta({
    description: "Two stacked metrics shown in one stat card.",
  }),
});

export const slideLayoutId = "title-chart-metrics-cards-slide";
export const slideLayoutName = "Title Chart with Metrics Cards Slide";
export const slideLayoutDescription =
  "A slide with a title at the top, chart in the left content area, and optional metric cards arranged side by side on the right.";

export const Schema = z.object({
  title: z.string().min(3).max(80).default("Data Analysis").meta({
    description: "Slide title shown at the top-left.",
  }),
  seriesALabel: z.string().min(3).max(20).default("Category A").meta({
    description: "Legend label for the first line series.",
  }),
  seriesBLabel: z.string().min(3).max(20).default("Category B").meta({
    description: "Legend label for the second line series.",
  }),
  chartData: flexibleChartDataSchema.default({
    type: "line-dual",
    data: [
      { label: "label", valueA: 24, valueB: 40 },
      { label: "label", valueA: 55, valueB: 72 },
      { label: "label", valueA: 50, valueB: 98 },
      { label: "label", valueA: 97, valueB: 86 },
      { label: "label", valueA: 70, valueB: 52 },
      { label: "label", valueA: 42, valueB: 78 },
      { label: "label", valueA: 63, valueB: 51 },
    ],
  }),
  legendLabel: z.string().min(3).max(32).default("Traditional Workflow").meta({
    description: "Legend label shown below the chart.",
  }),
  statColumns: z
    .array(StatColumnSchema)
    .min(1)
    .max(2)
    .default([
      {
        metrics: [
          { value: "25K", label: "Students", description: "Ut enim ad minima" },
          { value: "25K", label: "Students", description: "Ut enim ad minima" },
        ],
      },
      {
        metrics: [
          { value: "25K", label: "Students", description: "Ut enim ad minima" },
          { value: "25K", label: "Students", description: "Ut enim ad minima" },
        ],
      },
    ])
    .meta({
      description: "Stat/metric cards shown on the right side of the slide.",
    }),
});

export type SchemaType = z.infer<typeof Schema>;

type StatMetric = {
  value: string;
  label?: string;
  description?: string;
};

function StatPill({ metrics }: { metrics: StatMetric[] }) {
  return (
    <div
      className="h-[438px] w-[248px] overflow-hidden rounded-[127px] bg-[#157CFF] px-[28px] py-[74px] text-center text-white"
      style={{
        backgroundColor: "var(--primary-color,#157CFF)",
        color: "var(--primary-text,#ffffff)",
      }}
    >
      {metrics.map((metric, index) => (
        <div key={`${metric.value}-${metric.label}-${index}`} className="flex flex-col items-center justify-between gap-2">
          <div key={`${metric.value}-${metric.label}-${index}`} className={``}>
            <p className="text-[55px]  leading-[44.353px] tracking-[-1.09px]">{metric.value}</p>
            {metric.label && <p className="mt-[6px] text-[20px]  leading-none">{metric.label}</p>}
            {metric.description && <p className="text-[20px] mt-1 leading-[1.15] text-white/90" style={{ color: "var(--primary-text,#ffffff)", opacity: 0.9 }}>
              {metric.description}
            </p>}
          </div>
          {index === 0 && (
            <div className="py-[22px]">
              <svg xmlns="http://www.w3.org/2000/svg" width="181" height="1" viewBox="0 0 181 1" fill="none">
                <path
                  opacity="0.2"
                  d="M0 0.487305H180.122"
                  stroke="var(--primary-text,#ffffff)"
                  strokeWidth="0.974913"
                  strokeDasharray="3.9 1.95"
                />
              </svg>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

const DataAnalysisLineStatsSlide = ({ data }: { data: Partial<SchemaType> }) => {
  const { title, seriesALabel, seriesBLabel, chartData, statColumns, legendLabel } = data;
  const rows = chartData?.data ?? [];
  const chartType = chartData?.type ?? "line-dual";
  const series = chartData?.series ?? [];

  return (
    <>
      <link href="https://fonts.googleapis.com/css2?family=Source+Sans+3:ital,wght@0,200..900;1,200..900&display=swap" rel="stylesheet" />
      <div
        className="relative h-[720px] w-[1280px] overflow-hidden rounded-[24px] bg-[#f9f8f8]"
        style={{
          backgroundColor: "var(--background-color,#f9f8f8)",
          fontFamily: "var(--body-font-family,'Source Sans 3')",
        }}
      >
        <div
          className="absolute left-0 top-0 w-[42px] rounded-b-[22px] bg-[#157CFF]"
          style={{ height: 185, backgroundColor: "var(--primary-color,#157CFF)" }}
        />

        <div className="px-[64px] pt-[48px]">
          <h2
            className="text-[80px] font-bold leading-[108.4%] tracking-[-2.419px] text-[#232223]"
            style={{ color: "var(--background-text,#232223)" }}
          >
            {title}
          </h2>
        </div>

        <div className="flex justify-between px-[74px] pt-[40px]">
          <div className="w-[474px]">
            {chartType === "line-dual" && <div
              className="flex justify-center gap-[26px] text-[14px] text-[#353538]"
              style={{ color: "var(--background-text,#353538)" }}
            >
              <span className="flex items-center gap-[8px]">
                <span className="h-[2px] w-[20px] bg-[#9fb6ff]" style={{ backgroundColor: "var(--graph-0,#9fb6ff)" }} />
                {seriesALabel}
              </span>
              <span className="flex items-center gap-[8px]">
                <span className="h-[2px] w-[20px] bg-[#4d4ef3]" style={{ backgroundColor: "var(--graph-1,#4d4ef3)" }} />
                {seriesBLabel}
              </span>
            </div>}

            <div className="mt-[12px] h-[356px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <FlexibleReportChart
                  chartType={chartType}
                  data={rows}
                  series={series}
                  colorFallback="#157CFF"
                  density="default"
                  dualLineColors={["var(--graph-0,#9fb6ff)", "var(--graph-1,#4d4ef3)"]}
                />
              </ResponsiveContainer>
            </div>

            <div
              className="mt-[12px] flex items-center gap-[10px] text-center justify-center text-[24px] tracking-[-0.03em] text-[#157CFF]"
              style={{ color: "var(--primary-color,#157CFF)" }}
            >
              <span
                className="h-[12px] w-[12px] rounded-full bg-[#157CFF]"
                style={{ backgroundColor: "var(--primary-color,#157CFF)" }}
              />
              <p>{data.legendLabel}</p>
            </div>
          </div>

          <div className="ml-[42px] flex gap-[30px]">
            {statColumns?.map((column, index) => (
              <StatPill key={`line-stat-column-${index}`} metrics={column.metrics} />
            ))}
          </div>
        </div>
      </div>
    </>
  );
};

export default DataAnalysisLineStatsSlide;
