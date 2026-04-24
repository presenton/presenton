import { Fragment } from "react/jsx-runtime";
import * as z from "zod";

const MetricSchema = z.object({
  value: z.string().min(1).max(6).meta({
    description: "Primary metric value shown in the card.",
  }),
  label: z.string().min(0).max(10).optional().meta({
    description: "Short metric label shown below the value.",
  }),
  description: z.string().min(0).max(20).optional().meta({
    description: "Supporting text shown below the label.",
  }),
});

const StatColumnSchema = z.object({
  metrics: z.array(MetricSchema).min(2).max(2).meta({
    description: "Two stacked metrics shown in one tall card.",
  }),
});

export const slideLayoutId = "metrics-slide";
export const slideLayoutName = "Metrics Slide";
export const slideLayoutDescription =
  "A slide with a title and explanatory text on the left, an optional bulleted list underneath the text, and metric cards on the right. Each metric card contains two stacked metric blocks.";

export const Schema = z.object({
  title: z.string().min(3).max(12).default("Introduction").meta({
    description: "Slide title shown at the top-left.",
  }),
  body: z.string().max(250).default(
    "Ut enim ad minima veniam, quis nostrum exercitationem ullam corporis suscipit laboriosam, nisi ut alut enim ad minima veniam, quis. Ut enim ad minima veniam, quis nostrum exercitationem ullam corporis suscipit laboriosam, nisi ut alut enim ad minima veniam, quis"
  ).meta({
    description: "Primary paragraph shown below the title.",
  }),
  bullets: z
    .array(z.string().max(100))
    .max(4)
    .optional()
    .default([
      "Ut enim ad minima veniam, quis nostrum",
      "Exercitationem ullam corporis suscipit",
      "Ut enim ad minima veniam, quis nostrum",
      "exercitationem ullam corporis suscipit",
    ])
    .meta({
      description: "Optional bullet list shown after the description if required.",
    }),
  statColumns: z
    .array(StatColumnSchema)

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
      description: "Two stat cards shown on the right side of the slide.",
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
            {metric.label && <p className="mt-[6px] text-[20px]  leading-none">{metric.label}</p>}
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

const IntroductionStatsSlide = ({ data }: { data: Partial<SchemaType> }) => {

  const { title, body, bullets, statColumns } = data;

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

        <div className="flex justify-between px-[96px] pt-[38px]">
          <div className="">
            <p className="max-w-[400px] text-[24px] leading-[26.667px] text-[#232223]" style={{ color: "var(--background-text,#232223)" }}>
              {body}
            </p>

            <div
              className="mt-[34px] list-disc pl-[28px] text-[24px] leading-[26.667px] text-[#232223]"
              style={{ color: "var(--background-text,#232223)" }}
            >
              {bullets?.map((bullet, index) => (
                <div key={`${bullet}-${index}`} className="mt-[8px] flex items-center gap-2">
                  <div className="w-[8px] h-[8px] rounded-full bg-[#232223]" style={{ backgroundColor: "var(--background-text,#232223)" }} /> <p className="text-[24px] leading-[26.667px] text-[#232223]" style={{ color: "var(--background-text,#232223)" }}>
                    {bullet}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="ml-[48px] flex gap-[34px]">
            {statColumns?.map((column, index) => (
              <StatPill key={`intro-stat-column-${index}`} metrics={column.metrics} />
            ))}
          </div>
        </div>
      </div>
    </>
  );
};

export default IntroductionStatsSlide;
