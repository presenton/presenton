import { Fragment } from "react/jsx-runtime";
import * as z from "zod";

const MetricSchema = z.object({
  value: z.string().min(1).max(6).meta({
    description: "Primary metric value shown in the pill.",
  }),
  label: z.string().max(20).optional().meta({
    description: "Short label shown below the metric value.",
  }),
  description: z.string().min(6).max(50).optional().meta({
    description: "Supporting metric description shown below the label.",
  }),
});

const MetricColumnSchema = z.object({
  metrics: z.array(MetricSchema).max(2).meta({
    description: "One or two metrics shown in a single snapshot pill. Maximum two metrics.",
  }),
});

export const slideLayoutId = "title-metrics-slide";
export const slideLayoutName = "Title Metrics Slide";
export const slideLayoutDescription =
  "A slide with a title at the top and tall metric cards arranged horizontally below it. Each card can contain one or two stacked metric blocks, and each block includes a main value, a label, and a supporting description.";

export const Schema = z.object({
  title: z.string().min(3).max(80).default("Performance Snapshot").meta({
    description: "Slide title shown at the top-left.",
  }),
  columns: z
    .array(MetricColumnSchema)
    .min(1)
    .max(4)
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
      {
        metrics: [
          { value: "25K", label: "Students", description: "Ut enim ad minima" },
          { value: "25K", label: "Students", description: "Ut enim ad minima" },
        ],
      }
    ])
    .meta({
      description: "Three metric columns displayed beneath the title.",
    }),
});

export type SchemaType = z.infer<typeof Schema>;

type StatMetric = {
  value: string;
  label?: string;
  description?: string;
};

function StatPill({
  metrics,

}: {
  metrics: StatMetric[];

}) {
  return (

    <div
      className=" h-[438px] w-[248px] overflow-hidden rounded-[127px] bg-[#157CFF] px-[28px] py-[74px] text-center text-white"
      style={{
        backgroundColor: "var(--primary-color,#157CFF)",
        color: "var(--primary-text,#ffffff)",
      }}
    >

      {metrics.map((metric, index) => (
        <Fragment key={`${metric.value}-${metric.label}-${index}`}>
          <div
            key={`${metric.value}-${metric.label}-${index}`}
            className={``}
          >
            <p className="text-[55px]  leading-[44.353px] tracking-[-1.09px]">
              {metric.value}
            </p>
            {metric.label && <p className="mt-[10px] text-[20px] font-medium leading-none">{metric.label}</p>}
            {metric.description && <p className=" text-[20px] mt-1 leading-[1.15] text-white/90" style={{ color: "var(--primary-text,#ffffff)", opacity: 0.9 }}>
              {metric.description}
            </p>}
          </div>
          {index === 0 && <div className="py-[22px]">

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
          }
        </Fragment>
      ))}


    </div>
  );
}

const PerformanceSnapshotSlide = ({ data }: { data: Partial<SchemaType> }) => {
  const { title, columns } = data;

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

        <div className="mt-[44px] flex justify-center gap-[33px]">
          {columns?.map((column, index) => (
            <StatPill
              key={`snapshot-column-${index}`}
              metrics={column.metrics}

            />
          ))}
        </div>
      </div>
    </>
  );
};

export default PerformanceSnapshotSlide;
