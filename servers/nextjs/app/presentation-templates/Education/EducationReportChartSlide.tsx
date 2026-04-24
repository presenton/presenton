import * as z from "zod";

import EducationChartPrimitives, {
  type EducationChartDatum,
  type EducationChartType,
} from "./EducationChartPrimitives";

export const slideLayoutId = "report-chart-slide";
export const slideLayoutName = "Report Chart Slide";
export const slideLayoutDescription =
  "A left text column with a report title, body, footnote and a right-side chart.";

const ChartTypeSchema = z.enum([
  "bar",

  "line",
  "area",

  "pie",
  "donut",
  "scatter",
]);

const SimpleDataSchema = z.object({
  name: z.string().min(1).max(20).meta({
    description: "Simple chart category label.",
  }),
  value: z.number().meta({
    description: "Simple chart numeric value.",
  }),
});

const MultiSeriesDataSchema = z.object({
  name: z.string().min(1).max(20).meta({
    description: "Grouped/stacked category label.",
  }),
  values: z.record(z.string(), z.number()).meta({
    description: "Series-to-value map for grouped or stacked charts.",
  }),
});

const DivergingDataSchema = z.object({
  name: z.string().min(1).max(20).meta({
    description: "Diverging chart category label.",
  }),
  positive: z.number().min(0).max(100000).meta({
    description: "Positive side value.",
  }),
  negative: z.number().min(0).max(100000).meta({
    description: "Negative side value.",
  }),
});

const ScatterDataSchema = z.object({
  x: z.number().min(-100000).max(100000).meta({
    description: "Scatter X coordinate.",
  }),
  y: z.number().min(-100000).max(100000).meta({
    description: "Scatter Y coordinate.",
  }),
  name: z.string().min(1).max(20).optional().meta({
    description: "Optional scatter tick label.",
  }),
});

const UnifiedChartDataSchema = z.union([
  z.array(SimpleDataSchema),
  z.array(MultiSeriesDataSchema),
  z.array(DivergingDataSchema),
  z.array(ScatterDataSchema),
]);

export const Schema = z.object({
  title: z.string().max(24).default("Report").meta({
    description: "Left-side report title.",
  }),
  body: z.string().min(80).max(260).default(
    "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat."
  ).meta({
    description: "Left-side report body paragraph.",
  }),
  footnote: z.string().min(20).max(150).default(
    "(Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.)"
  ).meta({
    description: "Left-side footnote line.",
  }),
  chartTitle: z.string().min(8).max(42).default("Students by Grade Level").meta({
    description: "Right-panel chart heading.",
  }),
  dateRange: z.string().min(8).max(22).default("Apr 10 - Apr 17").meta({
    description: "Right-panel date range label.",
  }),
  chartType: ChartTypeSchema.default("bar").meta({
    description:
      "Chart type selector. Supports bar, grouped, stacked, clustered, diverging, line, area, pie/donut, and scatter.",
  }),
  chartData: UnifiedChartDataSchema.default([
    { name: "Option A", value: 17.07 },
    { name: "Option B", value: 45.23 },
    { name: "Option C", value: 21.61 },
    { name: "Option D", value: 16.36 },
  ]).meta({
    description: "Unified chart data payload. Shape depends on chartType.",
  }),
  series: z.array(z.string().min(1).max(20)).max(6).default(["Series A", "Series B"]).meta({
    description: "Series names for grouped/stacked/clustered/area-stacked charts.",
  }),
  divergingLabels: z.tuple([z.string().min(1).max(24), z.string().min(1).max(24)]).default([
    "Positive",
    "Negative",
  ]).meta({
    description: "Legend labels for bar-diverging charts.",
  }),
  showLegend: z.boolean().default(true).meta({
    description: "Show or hide chart legend.",
  }),

  showStatusMessage: z.boolean().default(false).meta({
    description: "Show callout message under chart (useful for weekly/performance styles).",
  }),
  statusMessageTitle: z.string().min(8).max(40).default("You are doing good!").meta({
    description: "Callout headline under chart.",
  }),
  statusMessageBody: z.string().min(10).max(80).default("You almost reached your goal").meta({
    description: "Callout subtitle under chart.",
  }),
});

export type SchemaType = z.infer<typeof Schema>;



const EducationReportChartSlide = ({ data }: { data: Partial<SchemaType> }) => {
  const slideData = data;

  const chartHeightClass = slideData.showStatusMessage ? "h-[372px]" : "h-[486px]";

  return (
    <>

      <link href="https://fonts.googleapis.com/css2?family=Source+Serif+4:ital,opsz,wght@0,8..60,200..900;1,8..60,200..900&display=swap" rel="stylesheet" />
      <div
        className="relative h-[720px] w-[1280px] overflow-hidden"
        style={{
          backgroundColor: "var(--background-color,#efeff1)",
          fontFamily: "var(--body-font-family,'Times New Roman')",
        }}
      >
        <div className="grid h-full grid-cols-[1fr_560px] items-center ">
          <div className="px-[52px] pb-[46px] mt-[111px]   ">
            <div className="text-start">
              <h2 className=" text-[64px] font-medium leading-[98%]" style={{ color: "var(--primary-color,#101C3D)" }}>
                {slideData.title}
              </h2>
              <p className=" mt-[38px] max-w-[610px] text-[22px] leading-[1.22]" style={{ color: "var(--background-text,#3E3F4A)" }}>
                {slideData.body}
              </p>
            </div>

            <p className="max-w-[610px] mt-[96px] text-[18px] leading-[1.22]" style={{ color: "var(--background-text,#4E4F57)" }}>
              {slideData.footnote}
            </p>
          </div>

          <div className="px-[42px] h-full flex flex-col justify-center" style={{ backgroundColor: "var(--card-color,#eceaf0)" }}>
            <h3 className="text-center  text-[24px] font-semibold leading-none" style={{ color: "var(--background-text,#33313A)" }}>
              {slideData.chartTitle}
            </h3>
            <p className="mt-1 text-center pb-6 text-[18px] leading-none" style={{ color: "var(--background-text,#4D4B55)" }}>
              {slideData.dateRange}
            </p>

            <div className={` ${chartHeightClass} h-[372px]`}>
              <EducationChartPrimitives
                chartType={slideData.chartType as EducationChartType}
                chartData={slideData.chartData as EducationChartDatum[]}
                series={slideData.series || []}
                showLegend={slideData.showLegend || false}
                divergingLabels={slideData.divergingLabels || ['', '']}
                showTooltip={true}
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default EducationReportChartSlide;
