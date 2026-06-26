import * as z from "zod";

const SummaryMetricSchema = z.object({
  value: z.string().min(1).max(10).meta({
    description: "Compact metric value shown in the summary row.",
  }),
  label: z.string().min(3).max(28).meta({
    description: "Short label explaining the metric value.",
  }),
});

const SummaryHighlightSchema = z.object({
  label: z.string().min(3).max(24).meta({
    description: "Short label for a summary highlight.",
  }),
  description: z.string().min(18).max(110).meta({
    description: "Concise highlight text supporting the summary.",
  }),
});

export const slideLayoutId = "summary-cards-slide";
export const slideLayoutName = "Summary Cards Slide";
export const slideLayoutDescription =
  "A report slide with a title, short summary statement, compact metric cards, supporting highlight cards, and a concluding note.";

export const Schema = z.object({
  title: z.string().min(6).max(36).default("Executive Summary").meta({
    description: "Main slide title.",
  }),
  subtitle: z.string().min(20).max(140).default(
    "A concise overview of the report context, main observations, and overall direction."
  ).meta({
    description: "Short subtitle introducing the summary context.",
  }),
  summary: z.string().min(40).max(220).default(
    "The report identifies the most important patterns, explains what changed, and summarizes the implications for decision makers."
  ).meta({
    description: "Primary summary statement shown prominently on the slide.",
  }),
  metrics: z.array(SummaryMetricSchema).min(2).max(4).default([
    { value: "84%", label: "Completion" },
    { value: "12", label: "Key Inputs" },
    { value: "3", label: "Main Findings" },
  ]).meta({
    description: "Compact metrics that support the summary.",
  }),
  highlights: z.array(SummaryHighlightSchema).min(3).max(4).default([
    {
      label: "Context",
      description: "The report compares recent activity, supporting evidence, and the resulting operational signals.",
    },
    {
      label: "Pattern",
      description: "The strongest movement appears in the areas with the clearest ownership and follow-up cadence.",
    },
    {
      label: "Direction",
      description: "Near-term work should focus on the few actions most likely to improve measurable outcomes.",
    },
  ]).meta({
    description: "Supporting highlight cards shown beneath the metrics.",
  }),
  conclusion: z.string().min(18).max(150).default(
    "Use the remaining sections to review evidence, risks, recommendations, and next steps."
  ).meta({
    description: "Closing note shown at the bottom of the summary slide.",
  }),
});

export type SchemaType = z.infer<typeof Schema>;

const ExecutiveSummarySlide = ({ data }: { data: Partial<SchemaType> }) => {
  const metrics = data.metrics ?? [];
  const highlights = data.highlights ?? [];

  return (
    <>
      <link href="https://fonts.googleapis.com/css2?family=Source+Sans+3:ital,wght@0,200..900;1,200..900&display=swap" rel="stylesheet" />
      <div
        className="relative h-[720px] w-[1280px] overflow-hidden rounded-[24px] bg-[#F9F8F8]"
        style={{
          backgroundColor: "var(--background-color,#F9F8F8)",
          color: "var(--background-text,#232223)",
          fontFamily: "var(--body-font-family,'Source Sans 3')",
          letterSpacing: 0,
        }}
      >
        <div
          className="absolute left-0 top-0 w-[42px] rounded-b-[22px] bg-[#157CFF]"
          style={{ height: 185, backgroundColor: "var(--primary-color,#157CFF)" }}
        />

        <div className="px-[64px] pt-[48px]">
          <h2 className="max-w-[940px] break-words text-[58px] font-bold leading-[1.02] tracking-normal">
            {data.title}
          </h2>
          <p
            className="mt-[16px] max-w-[910px] break-words text-[23px] leading-[1.22] text-[#4A4D53]"
            style={{ color: "var(--background-text,#4A4D53)", opacity: 0.82 }}
          >
            {data.subtitle}
          </p>
        </div>

        <div className="mx-[64px] mt-[28px] grid grid-cols-[1.25fr_0.85fr] gap-[24px]">
          <div
            className="rounded-[28px] bg-white p-[34px] shadow-[0_1px_0_rgba(0,0,0,0.08)]"
            style={{
              backgroundColor: "var(--card-color,#ffffff)",
              color: "var(--card-text,var(--background-text,#232223))",
            }}
          >
            <p className="break-words text-[29px] font-semibold leading-[1.13] text-[#232223]" style={{ color: "inherit" }}>
              {data.summary}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-[14px]">
            {metrics.map((metric, index) => (
              <div
                key={`${metric.label}-${index}`}
                className="rounded-[22px] bg-[#157CFF] px-[22px] py-[18px] text-white"
                style={{
                  backgroundColor: index === 0 ? "var(--primary-color,#157CFF)" : "var(--card-color,#ffffff)",
                  color: index === 0 ? "var(--primary-text,#ffffff)" : "var(--card-text,var(--background-text,#232223))",
                }}
              >
                <p className="break-words text-[34px] font-bold leading-none">{metric.value}</p>
                <p className="mt-[8px] break-words text-[17px] font-semibold leading-[1.12] opacity-90">{metric.label}</p>
              </div>
            ))}
          </div>
        </div>

        <div
          className="mx-[64px] mt-[22px] grid gap-[18px]"
          style={{ gridTemplateColumns: `repeat(${Math.max(highlights.length, 1)}, minmax(0, 1fr))` }}
        >
          {highlights.map((highlight, index) => (
            <div
              key={`${highlight.label}-${index}`}
              className="rounded-[22px] border border-[#D6D9DE] bg-white p-[22px]"
              style={{
                backgroundColor: "var(--card-color,#ffffff)",
                borderColor: "var(--stroke,#D6D9DE)",
                color: "var(--card-text,var(--background-text,#34333A))",
              }}
            >
              <p
                className="break-words text-[14px] font-bold uppercase leading-none text-[#157CFF]"
                style={{ color: "var(--primary-color,#157CFF)" }}
              >
                {highlight.label}
              </p>
              <p className="mt-[12px] break-words text-[20px] leading-[1.18] text-[#34333A]" style={{ color: "inherit" }}>
                {highlight.description}
              </p>
            </div>
          ))}
        </div>

        <p
          className="mx-[64px] mt-[22px] break-words rounded-[18px] border border-[#D6D9DE] bg-white px-[24px] py-[14px] text-[20px] leading-[1.18] text-[#4A4D53]"
          style={{
            backgroundColor: "var(--card-color,#ffffff)",
            borderColor: "var(--stroke,#D6D9DE)",
            color: "var(--card-text,var(--background-text,#4A4D53))",
          }}
        >
          {data.conclusion}
        </p>
      </div>
    </>
  );
};

export default ExecutiveSummarySlide;
