import * as z from "zod";

const RecommendationSchema = z.object({
  priority: z.string().min(2).max(14).meta({
    description: "Short priority label.",
  }),
  title: z.string().min(4).max(32).meta({
    description: "Recommendation title.",
  }),
  recommendation: z.string().min(20).max(100).meta({
    description: "Concrete recommendation statement.",
  }),
  rationale: z.string().min(20).max(95).meta({
    description: "Reason the recommendation is included.",
  }),
  impact: z.string().min(10).max(60).meta({
    description: "Short expected impact or outcome label.",
  }),
});

export const slideLayoutId = "recommendation-cards-slide";
export const slideLayoutName = "Recommendation Cards Slide";
export const slideLayoutDescription =
  "A report slide with a title, subtitle, and recommendation cards that include priority, action, rationale, and impact.";

export const Schema = z.object({
  title: z.string().min(6).max(36).default("Recommendations").meta({
    description: "Main slide title.",
  }),
  subtitle: z.string().min(20).max(140).default(
    "A prioritized set of recommended actions based on the findings and available evidence."
  ).meta({
    description: "Short subtitle introducing the recommendations.",
  }),
  recommendations: z.array(RecommendationSchema).min(3).max(5).default([
    {
      priority: "P1",
      title: "Focus Ownership",
      recommendation: "Assign one accountable owner for the highest-priority action area.",
      rationale: "Clear ownership reduces handoffs and improves follow-through across teams.",
      impact: "Faster execution",
    },
    {
      priority: "P2",
      title: "Standardize Review",
      recommendation: "Create a repeatable review cadence for the most important report signals.",
      rationale: "A consistent cadence keeps decisions connected to current evidence.",
      impact: "Clearer decisions",
    },
    {
      priority: "P3",
      title: "Track Gaps",
      recommendation: "Monitor the main gaps with simple measures and visible status updates.",
      rationale: "Focused tracking makes progress easier to compare over time.",
      impact: "Better visibility",
    },
  ]).meta({
    description: "Recommendation cards.",
  }),
});

export type SchemaType = z.infer<typeof Schema>;

const RecommendationsSlide = ({ data }: { data: Partial<SchemaType> }) => {
  const recommendations = data.recommendations ?? [];

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
          <h2 className="break-words text-[58px] font-bold leading-[1.02] tracking-normal">
            {data.title}
          </h2>
          <p
            className="mt-[14px] max-w-[940px] break-words text-[23px] leading-[1.22] text-[#4A4D53]"
            style={{ color: "var(--background-text,#4A4D53)", opacity: 0.82 }}
          >
            {data.subtitle}
          </p>
        </div>

        <div
          className="mx-[64px] mt-[28px] grid gap-[18px]"
          style={{ gridTemplateColumns: `repeat(${Math.max(recommendations.length, 1)}, minmax(0, 1fr))` }}
        >
          {recommendations.map((item, index) => (
            <div
              key={`${item.priority}-${item.title}-${index}`}
              className="rounded-[24px] border border-[#D6D9DE] bg-white p-[22px]"
              style={{
                backgroundColor: "var(--card-color,#ffffff)",
                borderColor: "var(--stroke,#D6D9DE)",
                color: "var(--card-text,var(--background-text,#232223))",
              }}
            >
              <div className="flex items-start justify-between gap-[16px]">
                <p className="min-w-0 break-words text-[27px] font-bold leading-[1.08] text-[#232223]" style={{ color: "inherit" }}>
                  {item.title}
                </p>
                <span
                  className="shrink-0 rounded-full bg-[#157CFF] px-[16px] py-[7px] text-[16px] font-bold leading-none text-white"
                  style={{
                    backgroundColor: "var(--primary-color,#157CFF)",
                    color: "var(--primary-text,#ffffff)",
                  }}
                >
                  {item.priority}
                </span>
              </div>
              <p className="mt-[14px] break-words text-[20px] font-semibold leading-[1.15] text-[#34333A]" style={{ color: "inherit" }}>
                {item.recommendation}
              </p>
              <p className="mt-[12px] break-words text-[17px] leading-[1.16] text-[#4A4D53]" style={{ color: "inherit", opacity: 0.78 }}>
                {item.rationale}
              </p>
              <div
                className="mt-[16px] rounded-[16px] bg-[#F1F5FA] px-[16px] py-[12px]"
                style={{ backgroundColor: "var(--background-color,#F1F5FA)" }}
              >
                <p className="text-[14px] font-bold uppercase leading-none text-[#157CFF]" style={{ color: "var(--primary-color,#157CFF)" }}>Impact</p>
                <p className="mt-[7px] break-words text-[18px] font-semibold leading-[1.1] text-[#232223]" style={{ color: "var(--background-text,var(--card-text,#232223))" }}>{item.impact}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
};

export default RecommendationsSlide;
