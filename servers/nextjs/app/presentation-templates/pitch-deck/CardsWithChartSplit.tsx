"use client";

import * as z from "zod";

import PitchDeckChart from "./PitchDeckChart";
import { ChartPayloadSchema } from "./pitchDeckSchemas";
import { RemoteSvgIcon } from "@/app/hooks/useRemoteSvgIcon";

export const slideLayoutId = "cards-with-chart-split";
export const slideLayoutName = "Cards with Chart Split";
export const slideLayoutDescription =
  "A split layout with cards on the left and a chart panel on the right.";

const DEFAULT_CHART = {
  chartType: "line" as const,
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

const ValueCardSchema = z.object({
  value: z.string().max(6).meta({
    description: "Card value text.",
  }),
  label: z.string().max(28).meta({
    description: "Card supporting label.",
  }),
  icon: z.object({
    __icon_url__: z.string(),
    __icon_query__: z.string(),
  }),
});

export const Schema = z.object({
  title: z.string().max(16).default("Highlights").meta({
    description: "Main heading.",
  }),
  items: z
    .array(ValueCardSchema)

    .max(4)
    .default([
      {
        value: "X 5",
        label: "Lorem ipsum dolor sit.",
        icon: {
          __icon_url__:
            "https://presenton-public.s3.ap-southeast-1.amazonaws.com/static/icons/placeholder.svg",
          __icon_query__: "check icon",
        },
      },
      {
        value: "X 5",
        label: "Lorem ipsum dolor sit.",
        icon: {
          __icon_url__:
            "https://presenton-public.s3.ap-southeast-1.amazonaws.com/static/icons/placeholder.svg",
          __icon_query__: "check icon",
        },
      },
      {
        value: "X 5",
        label: "Lorem ipsum dolor sit.",
        icon: {
          __icon_url__:
            "https://presenton-public.s3.ap-southeast-1.amazonaws.com/static/icons/placeholder.svg",
          __icon_query__: "check icon",
        },
      },
      {
        value: "X 5",
        label: "Lorem ipsum dolor sit.",
        icon: {
          __icon_url__:
            "https://presenton-public.s3.ap-southeast-1.amazonaws.com/static/icons/placeholder.svg",
          __icon_query__: "check icon",
        },
      },
    ])
    .meta({
      description: "Cards shown beside the chart.",
    }),
  chart: ChartPayloadSchema.default(DEFAULT_CHART).meta({
    description: "Chart configuration for the right panel.",
  }),
  showAccentGlow: z.boolean().default(true).meta({
    description:
      "Whether to render the subtle decorative glow near bottom-left.",
  }),
});

export type SchemaType = z.infer<typeof Schema>;

function Card({
  value,
  label,
  icon,
}: {
  value: string;
  label: string;
  icon: { __icon_url__: string; __icon_query__: string };
}) {
  return (
    <div
      className="flex h-full flex-col items-center justify-center border text-center"
      style={{
        borderColor: "var(--stroke,#8d8a7d)",
        color: "var(--background-text,#d7d3be)",
      }}
    >
      <div className="flex items-center gap-[14px]">
        <span
          className="inline-flex items-center justify-center rounded-full"
          style={{
            width: 56,
            height: 56,
            backgroundColor: "var(--primary-color,#dddac7)",
            color: "var(--primary-color,#27292d)",
          }}
        >
          <RemoteSvgIcon
            url={icon.__icon_url__}
            className="w-7 h-7"
            strokeColor={"currentColor"}
            color="var(--primary-text,#27292d)"
            title={icon.__icon_query__}
          />
        </span>
        <p className="text-[45px] font-semibold leading-none tracking-[0.01em]">
          {value}
        </p>
      </div>

      <p
        className="mt-[14px] max-w-[82%] text-[30px] leading-[1.06]"
        style={{ color: "var(--background-text,#d7d3be)" }}
      >
        {label}
      </p>
    </div>
  );
}

const CardsWithChartSplit = ({ data }: { data: Partial<SchemaType> }) => {
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
        <h2
          className="px-[36px] pt-[72px] text-[100px] leading-none tracking-[-0.02em]"
          style={{
            color: "var(--background-text,#dddac7)",
            fontFamily: "var(--heading-font-family,'DM Serif Display')",
          }}
        >
          {slideData.title}
        </h2>
        <div
          className="absolute bottom-[36px] left-[36px] right-[80px] top-[198px] grid min-h-0 gap-[32px]"
          style={{ gridTemplateColumns: "minmax(0, 45fr) minmax(0, 55fr)" }}
        >
          <div className="min-h-0">
            <div
              className="grid grid-cols-2 gap-[20px]"
              style={{ gridAutoRows: "216px" }}
            >
              {slideData.items.map((card, index) => (
                <Card
                  key={`${card.value}-${index}`}
                  value={card.value}
                  label={card.label}
                  icon={card.icon}
                />
              ))}
            </div>
          </div>

          <div className="h-full min-h-0 overflow-hidden pt-[10px]">
            <PitchDeckChart payload={slideData.chart ?? DEFAULT_CHART} />
          </div>
        </div>
      </div>
    </>
  );
};

export default CardsWithChartSplit;
