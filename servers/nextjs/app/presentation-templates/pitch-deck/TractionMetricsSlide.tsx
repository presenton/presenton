import * as z from "zod";

const TractionMetricSchema = z.object({
  value: z.string().min(1).max(10).meta({
    description: "Primary traction metric value.",
  }),
  label: z.string().min(3).max(30).meta({
    description: "Short traction metric label.",
  }),
  detail: z.string().min(12).max(52).meta({
    description: "Brief detail explaining the metric.",
  }),
});

const MilestoneSchema = z.object({
  period: z.string().min(2).max(14).meta({
    description: "Short period or milestone label.",
  }),
  result: z.string().min(8).max(44).meta({
    description: "Short result achieved in the period.",
  }),
});

export const slideLayoutId = "traction-metrics-slide";
export const slideLayoutName = "Traction Metrics Slide";
export const slideLayoutDescription =
  "A pitch-deck layout with traction metrics and a compact milestone row.";

export const Schema = z.object({
  title: z.string().min(4).max(26).default("Traction").meta({
    description: "Main slide heading.",
  }),
  summary: z.string().min(24).max(90).default(
    "Early signals show repeatable demand, stronger retention, and a clear path to expansion."
  ).meta({
    description: "Short summary introducing the traction story.",
  }),
  metrics: z.array(TractionMetricSchema).min(3).max(4).default([
    { value: "125%", label: "Net Revenue Retention", detail: "Expansion from active customer accounts." },
    { value: "38%", label: "Monthly Growth", detail: "Average growth across the last quarter." },
    { value: "14", label: "Design Partners", detail: "Teams actively shaping product feedback." },
  ]).meta({
    description: "Traction metric cards.",
  }),
  milestones: z.array(MilestoneSchema).min(3).max(5).default([
    { period: "Q1", result: "Pilot cohort launched" },
    { period: "Q2", result: "Paid conversion started" },
    { period: "Q3", result: "Expansion motion validated" },
  ]).meta({
    description: "Compact milestones shown along the bottom.",
  }),
});

export type SchemaType = z.infer<typeof Schema>;

const TractionMetricsSlide = ({ data }: { data: Partial<SchemaType> }) => {
  const defaults = Schema.parse({});
  const slideData = {
    ...defaults,
    ...data,
    metrics: data.metrics ?? defaults.metrics,
    milestones: data.milestones ?? defaults.milestones,
  } as SchemaType;

  return (
    <>
      <link href="https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&display=swap" rel="stylesheet" />
      <div
        className="relative h-[720px] w-[1280px] overflow-hidden px-[42px] py-[54px]"
        style={{
          backgroundColor: "var(--background-color,#27292d)",
          color: "var(--background-text,#d7d3be)",
          fontFamily: "var(--body-font-family,'DM Serif Display')",
          letterSpacing: 0,
        }}
      >
        <h2 className="break-words text-[80px] leading-none" style={{ color: "var(--background-text,#dddac7)" }}>
          {slideData.title}
        </h2>
        <p className="mt-[18px] max-w-[850px] break-words text-[27px] leading-[1.15]" style={{ color: "var(--background-text,#cbc7b2)" }}>
          {slideData.summary}
        </p>

        <div className="mt-[48px] grid gap-[22px]" style={{ gridTemplateColumns: `repeat(${slideData.metrics.length}, minmax(0, 1fr))` }}>
          {slideData.metrics.map((metric, index) => (
            <div key={`${metric.label}-${index}`} className="border px-[24px] py-[30px]" style={{ borderColor: "var(--stroke,#8d8a7d)" }}>
              <p className="break-words text-[66px] leading-none" style={{ color: "var(--primary-color,#dddac7)" }}>{metric.value}</p>
              <p className="mt-[20px] break-words text-[29px] leading-[1.04]" style={{ color: "var(--background-text,#dddac7)" }}>{metric.label}</p>
              <p className="mt-[12px] break-words text-[20px] leading-[1.13]" style={{ color: "var(--background-text,#cbc7b2)" }}>{metric.detail}</p>
            </div>
          ))}
        </div>

        <div className="absolute bottom-[42px] left-[42px] right-[42px] grid gap-[18px]" style={{ gridTemplateColumns: `repeat(${slideData.milestones.length}, minmax(0, 1fr))` }}>
          {slideData.milestones.map((milestone, index) => (
            <div key={`${milestone.period}-${index}`} className="border-t pt-[14px]" style={{ borderColor: "var(--primary-color,#dddac7)" }}>
              <p className="text-[25px] leading-none" style={{ color: "var(--primary-color,#dddac7)" }}>{milestone.period}</p>
              <p className="mt-[9px] break-words text-[20px] leading-[1.12]" style={{ color: "var(--background-text,#cbc7b2)" }}>{milestone.result}</p>
            </div>
          ))}
        </div>
      </div>
    </>
  );
};

export default TractionMetricsSlide;
