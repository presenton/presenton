"use client";

import * as z from "zod";

import PitchDeckChart from "./PitchDeckChart";
import { ChartPayloadSchema } from "./pitchDeckSchemas";

export const slideLayoutId = "text-and-chart-split-layout";
export const slideLayoutName = "Text and Chart Split Layout";
export const slideLayoutDescription =
  "A split layout with narrative text on the left and a configurable chart canvas on the right.";

const DEFAULT_CHART = {
  chartType: "bar" as const,
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
    { label: "label", value: 7 },
    { label: "label", value: 2 },
    { label: "label", value: 92 },
    { label: "label", value: 15 },
    { label: "label", value: 91 },
    { label: "label", value: 73 },
    { label: "label", value: 56 },
    { label: "label", value: 90 },
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

export const Schema = z.object({
  title: z.string().max(16).default("Highlights").meta({
    description: "Main heading on the left.",
  }),
  leadText: z
    .string()
    .max(52)
    .default("This is a sample text to tell story for audience is written here")
    .meta({
      description: "Primary narrative line above supporting text.",
    }),
  supportingText: z
    .string()

    .max(126)
    .default(
      "Ut enim ad minima veniam, quis nostrum exercitationem ullam corporis suscipit laboriosam, nisi ut alUt enim ad minima veniam."
    )
    .meta({
      description: "Supporting paragraph text.",
    }),
  chart: ChartPayloadSchema.default(DEFAULT_CHART).meta({
    description: "Chart configuration payload rendered on the right side.",
  }),
  showAccentGlow: z.boolean().default(true).meta({
    description:
      "Whether to render the subtle decorative glow near bottom-left.",
  }),
});

export type SchemaType = z.infer<typeof Schema>;

const TextAndChartSplit = ({ data }: { data: Partial<SchemaType> }) => {
  const slideData = data as SchemaType;

  return (
    <>
      <link
        href="https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&display=swap"
        rel="stylesheet"
      />

      <div
        className="relative h-[720px] w-[1280px] overflow-hidden "
        style={{
          backgroundColor: "var(--background-color,#27292d)",
          fontFamily: "var(--body-font-family,'DM Serif Display')",
        }}
      >
        <div className="grid h-full grid-cols-[47.5%_52.5%]">
          <div className="px-[36px] pt-[44px]">
            <h2
              className="font-serif text-[100px] leading-none tracking-[-0.02em]"
              style={{
                color: "var(--background-text,#dddac7)",
              }}
            >
              {slideData.title}
            </h2>

            <p
              className="mt-[76px] max-w-[520px] text-[32px] leading-[1.12]"
              style={{ color: "var(--background-text,#d7d3be)" }}
            >
              {slideData.leadText}
            </p>

            <p
              className="mt-[38px] max-w-[530px] text-[22px] leading-[1.16]"
              style={{ color: "var(--background-text,#cbc7b2)" }}
            >
              {slideData.supportingText}
            </p>
          </div>

          <div className="h-full min-h-0 overflow-hidden px-[24px] pb-[52px] pt-[142px]">
            <PitchDeckChart payload={slideData.chart ?? DEFAULT_CHART} />
          </div>
        </div>
      </div>
    </>
  );
};

export default TextAndChartSplit;
