import * as z from "zod";

const ValuePillarSchema = z.object({
  title: z.string().min(4).max(28).meta({
    description: "Value pillar title.",
  }),
  description: z.string().min(20).max(70).meta({
    description: "Short explanation of the value pillar.",
  }),
});

export const slideLayoutId = "value-proposition-slide";
export const slideLayoutName = "Value Proposition Slide";
export const slideLayoutDescription =
  "A pitch-deck layout with a clear value statement and supporting value pillars.";

export const Schema = z.object({
  title: z.string().min(4).max(28).default("Solution").meta({
    description: "Main slide heading.",
  }),
  valueStatement: z
    .string()
    .min(30)
    .max(105)
    .default(
      "One focused workspace that turns scattered inputs into clear priorities, ownership, and progress."
    )
    .meta({
      description: "Value proposition statement.",
    }),
  supportingText: z
    .string()
    .min(24)
    .max(90)
    .default(
      "The product keeps teams aligned without adding another manual reporting layer."
    )
    .meta({
      description: "Supporting paragraph beneath the value statement.",
    }),
  pillars: z
    .array(ValuePillarSchema)
    .min(3)
    .max(4)
    .default([
      {
        title: "Unify Context",
        description:
          "Bring goals, updates, blockers, and customer signals into one operating view.",
      },
      {
        title: "Clarify Priority",
        description:
          "Turn raw activity into a focused view of what needs attention next.",
      },
      {
        title: "Track Progress",
        description:
          "Keep owners, timelines, and status visible across the workflow.",
      },
    ])
    .meta({
      description: "Pillars displayed across the bottom.",
    }),
});

export type SchemaType = z.infer<typeof Schema>;

const ValuePropositionSlide = ({ data }: { data: Partial<SchemaType> }) => {
  const defaults = Schema.parse({});
  const slideData = {
    ...defaults,
    ...data,
    pillars: data.pillars ?? defaults.pillars,
  } as SchemaType;

  return (
    <>
      <link
        href="https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&display=swap"
        rel="stylesheet"
      />
      <div
        className="relative h-[720px] w-[1280px] overflow-hidden px-[42px] py-[56px]"
        style={{
          backgroundColor: "var(--background-color,#27292d)",
          color: "var(--background-text,#d7d3be)",
          fontFamily: "var(--body-font-family,'DM Serif Display')",
          letterSpacing: 0,
        }}
      >
        <p
          className="text-[28px] leading-none"
          style={{ color: "var(--primary-color,#dddac7)" }}
        >
          {slideData.title}
        </p>
        <h2
          className="mt-[42px] max-w-[1030px]  text-[36px] leading-[1.15]"
          style={{ color: "var(--background-text,#dddac7)" }}
        >
          {slideData.valueStatement}
        </h2>
        <p
          className="mt-[24px] max-w-[780px]  text-[24px] leading-[1.16]"
          style={{ color: "var(--background-text,#cbc7b2)" }}
        >
          {slideData.supportingText}
        </p>

        <div
          className=" grid gap-[22px] mt-[42px]"
          style={{
            gridTemplateColumns: `repeat(${slideData.pillars.length}, minmax(0, 1fr))`,
          }}
        >
          {slideData.pillars.map((pillar, index) => (
            <div
              key={`${pillar.title}-${index}`}
              className="border px-[22px] py-[24px]"
              style={{ borderColor: "var(--stroke,#8d8a7d)" }}
            >
              <p
                className="break-words text-[31px] leading-[1.04]"
                style={{ color: "var(--background-text,#dddac7)" }}
              >
                {pillar.title}
              </p>
              <p
                className="mt-[12px] break-words text-[20px] leading-[1.15]"
                style={{ color: "var(--background-text,#cbc7b2)" }}
              >
                {pillar.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </>
  );
};

export default ValuePropositionSlide;
