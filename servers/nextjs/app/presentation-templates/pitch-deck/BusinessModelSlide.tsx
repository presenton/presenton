import * as z from "zod";

const RevenueStreamSchema = z.object({
  name: z.string().min(3).max(28).meta({
    description: "Revenue stream name.",
  }),
  model: z.string().min(8).max(46).meta({
    description: "Short pricing or monetization model.",
  }),
  note: z.string().min(16).max(64).meta({
    description: "Brief note about the revenue stream.",
  }),
});

const UnitMetricSchema = z.object({
  value: z.string().min(1).max(10).meta({
    description: "Compact unit metric value.",
  }),
  label: z.string().min(3).max(28).meta({
    description: "Short unit metric label.",
  }),
});

export const slideLayoutId = "business-model-slide";
export const slideLayoutName = "Business Model Slide";
export const slideLayoutDescription =
  "A pitch-deck layout with revenue streams, pricing logic, and compact unit metrics.";

export const Schema = z.object({
  title: z.string().min(4).max(28).default("Business Model").meta({
    description: "Main slide heading.",
  }),
  summary: z.string().min(24).max(95).default(
    "Revenue grows through recurring subscriptions, usage expansion, and higher-value customer tiers."
  ).meta({
    description: "Short summary of the business model.",
  }),
  revenueStreams: z.array(RevenueStreamSchema).min(3).max(4).default([
    {
      name: "Subscription",
      model: "Monthly or annual platform fee",
      note: "Primary recurring revenue stream tied to seats or workspace size.",
    },
    {
      name: "Usage",
      model: "Volume-based expansion",
      note: "Additional revenue scales with workflow volume and automation usage.",
    },
    {
      name: "Services",
      model: "Onboarding and success packages",
      note: "Optional support accelerates deployment for larger accounts.",
    },
  ]).meta({
    description: "Revenue stream rows.",
  }),
  unitMetrics: z.array(UnitMetricSchema).min(2).max(4).default([
    { value: "$18K", label: "Target ACV" },
    { value: "82%", label: "Gross Margin" },
    { value: "4 mo", label: "Payback Goal" },
  ]).meta({
    description: "Compact unit metric cards.",
  }),
});

export type SchemaType = z.infer<typeof Schema>;

const BusinessModelSlide = ({ data }: { data: Partial<SchemaType> }) => {
  const defaults = Schema.parse({});
  const slideData = {
    ...defaults,
    ...data,
    revenueStreams: data.revenueStreams ?? defaults.revenueStreams,
    unitMetrics: data.unitMetrics ?? defaults.unitMetrics,
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
        <h2 className="break-words text-[76px] leading-none" style={{ color: "var(--background-text,#dddac7)" }}>
          {slideData.title}
        </h2>
        <p className="mt-[18px] max-w-[900px] break-words text-[27px] leading-[1.15]" style={{ color: "var(--background-text,#cbc7b2)" }}>
          {slideData.summary}
        </p>

        <div className="mt-[40px] grid grid-cols-[1fr_360px] gap-[34px]">
          <div className="grid gap-[18px]">
            {slideData.revenueStreams.map((stream, index) => (
              <div key={`${stream.name}-${index}`} className="grid grid-cols-[210px_1fr] gap-[20px] border-b pb-[18px]" style={{ borderColor: "var(--stroke,#8d8a7d)" }}>
                <p className="break-words text-[33px] leading-none" style={{ color: "var(--background-text,#dddac7)" }}>{stream.name}</p>
                <div>
                  <p className="break-words text-[25px] leading-[1.08]" style={{ color: "var(--primary-color,#dddac7)" }}>{stream.model}</p>
                  <p className="mt-[8px] break-words text-[21px] leading-[1.14]" style={{ color: "var(--background-text,#cbc7b2)" }}>{stream.note}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="grid gap-[16px] content-start">
            {slideData.unitMetrics.map((metric, index) => (
              <div key={`${metric.value}-${index}`} className="p-[20px]" style={{ backgroundColor: "var(--primary-color,#dddac7)", color: "var(--primary-text,#27292d)" }}>
                <p className="break-words text-[56px] leading-none">{metric.value}</p>
                <p className="mt-[10px] break-words text-[22px] leading-[1.08]">{metric.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
};

export default BusinessModelSlide;
