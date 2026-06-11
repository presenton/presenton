import * as z from "zod";

const PainPointSchema = z.object({
  label: z.string().min(3).max(20).meta({
    description: "Short label for the pain point.",
  }),
  description: z.string().min(18).max(70).meta({
    description: "Brief description of the pain point.",
  }),
});

const EvidenceSchema = z.object({
  value: z.string().min(1).max(10).meta({
    description: "Compact evidence value.",
  }),
  label: z.string().min(3).max(34).meta({
    description: "Short label explaining the evidence value.",
  }),
});

export const slideLayoutId = "problem-evidence-slide";
export const slideLayoutName = "Problem Evidence Slide";
export const slideLayoutDescription =
  "A pitch-deck layout with a headline problem statement, pain point list, and compact evidence cards.";

export const Schema = z.object({
  title: z.string().min(4).max(26).default("Problem").meta({
    description: "Main slide heading.",
  }),
  problemStatement: z
    .string()
    .min(30)
    .max(105)
    .default(
      "Teams rely on disconnected tools, slow handoffs, and incomplete context to make important decisions."
    )
    .meta({
      description: "Large statement describing the problem.",
    }),
  audience: z
    .string()
    .min(8)
    .max(58)
    .default("Built for teams managing recurring, high-stakes workflows.")
    .meta({
      description: "Short audience or context line.",
    }),
  painPoints: z
    .array(PainPointSchema)
    .min(3)
    .max(4)
    .default([
      {
        label: "Fragmented Context",
        description:
          "Information is spread across tools, people, and update cycles.",
      },
      {
        label: "Slow Decisions",
        description:
          "Teams spend too much time aligning before meaningful work starts.",
      },
      {
        label: "Missed Signals",
        description:
          "Important changes are hard to notice until problems become visible.",
      },
    ])
    .meta({
      description: "Pain points shown in the right panel.",
    }),
  evidence: z
    .array(EvidenceSchema)
    .min(2)
    .max(3)
    .default([
      { value: "42%", label: "Time lost to status checks" },
      { value: "3.5x", label: "More handoffs per workflow" },
    ])
    .meta({
      description: "Compact evidence cards.",
    }),
});

export type SchemaType = z.infer<typeof Schema>;

const ProblemEvidenceSlide = ({ data }: { data: Partial<SchemaType> }) => {
  const defaults = Schema.parse({});
  const slideData = {
    ...defaults,
    ...data,
    painPoints: data.painPoints ?? defaults.painPoints,
    evidence: data.evidence ?? defaults.evidence,
  } as SchemaType;

  return (
    <>
      <link
        href="https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&display=swap"
        rel="stylesheet"
      />
      <div
        className="relative h-[720px] w-[1280px] overflow-hidden"
        style={{
          backgroundColor: "var(--background-color,#27292d)",
          color: "var(--background-text,#d7d3be)",
          fontFamily: "var(--body-font-family,'DM Serif Display')",
          letterSpacing: 0,
        }}
      >
        <div className="grid h-full grid-cols-[48%_52%]">
          <div className="px-[44px] pt-[58px]">
            <p
              className="text-[28px] leading-none"
              style={{ color: "var(--primary-color,#dddac7)" }}
            >
              {slideData.title}
            </p>
            <h2
              className="mt-[42px] break-words text-[32px] leading-[1.15]"
              style={{ color: "var(--background-text,#dddac7)" }}
            >
              {slideData.problemStatement}
            </h2>
            <p
              className="mt-[34px] break-words text-[24px] leading-[1.15] "
              style={{ color: "var(--background-text,#cbc7b2)" }}
            >
              {slideData.audience}
            </p>

            <div
              className="mt-[24px] grid gap-[18px]"
              style={{
                gridTemplateColumns: `repeat(${slideData.evidence.length}, minmax(0, 1fr))`,
              }}
            >
              {slideData.evidence.map((item, index) => (
                <div
                  key={`${item.value}-${index}`}
                  className="p-[18px]"
                  style={{
                    backgroundColor: "var(--primary-color,#dddac7)",
                    color: "var(--primary-text,#27292d)",
                  }}
                >
                  <p className="break-words text-[46px] leading-none">
                    {item.value}
                  </p>
                  <p className="mt-[10px] break-words text-[19px] leading-[1.1]">
                    {item.label}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="px-[36px] pb-[54px] pt-[86px]">
            <div className="grid gap-[18px]">
              {slideData.painPoints.map((point, index) => (
                <div
                  key={`${point.label}-${index}`}
                  className="border p-[22px]"
                  style={{ borderColor: "var(--stroke,#8d8a7d)" }}
                >
                  <p
                    className="break-words text-[32px] leading-[1.02]"
                    style={{ color: "var(--background-text,#dddac7)" }}
                  >
                    {point.label}
                  </p>
                  <p
                    className="mt-[12px] break-words text-[22px] leading-[1.16]"
                    style={{ color: "var(--background-text,#cbc7b2)" }}
                  >
                    {point.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default ProblemEvidenceSlide;
