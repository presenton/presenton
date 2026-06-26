import * as z from "zod";

const AdvantageSchema = z.object({
  title: z.string().min(4).max(26).meta({
    description: "Advantage title.",
  }),
  description: z.string().min(20).max(70).meta({
    description: "Short explanation of the advantage.",
  }),
});

export const slideLayoutId = "defensibility-slide";
export const slideLayoutName = "Defensibility Slide";
export const slideLayoutDescription =
  "A pitch-deck layout with a defensibility statement and advantage pillars.";

export const Schema = z.object({
  title: z.string().min(4).max(28).default("Defensibility").meta({
    description: "Main slide heading.",
  }),
  statement: z
    .string()

    .max(90)
    .default(
      "The advantage compounds as workflow data, customer habits, and integrations become harder to replace."
    )
    .meta({
      description: "Large defensibility statement.",
    }),
  advantages: z
    .array(AdvantageSchema)
    .min(3)
    .max(4)
    .default([
      {
        title: "Data Context",
        description:
          "Each workflow improves the operating record and makes future decisions easier.",
      },
      {
        title: "Embedded Process",
        description:
          "Teams adopt shared routines that become part of how work is managed.",
      },
      {
        title: "Integration Depth",
        description:
          "Connections to existing systems reduce switching and increase daily utility.",
      },
    ])
    .meta({
      description: "Defensibility advantage cards.",
    }),
});

export type SchemaType = z.infer<typeof Schema>;

const DefensibilitySlide = ({ data }: { data: Partial<SchemaType> }) => {
  const defaults = Schema.parse({});
  const slideData = {
    ...defaults,
    ...data,
    advantages: data.advantages ?? defaults.advantages,
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
          className="mt-[48px] max-w-[1080px] break-words text-[72px] leading-[1.03]"
          style={{ color: "var(--background-text,#dddac7)" }}
        >
          {slideData.statement}
        </h2>

        <div
          className="absolute bottom-[52px] left-[42px] right-[42px] grid gap-[22px]"
          style={{
            gridTemplateColumns: `repeat(${slideData.advantages.length}, minmax(0, 1fr))`,
          }}
        >
          {slideData.advantages.map((advantage, index) => (
            <div
              key={`${advantage.title}-${index}`}
              className="border-t pt-[20px]"
              style={{ borderColor: "var(--primary-color,#dddac7)" }}
            >
              <p
                className="break-words text-[32px] leading-none"
                style={{ color: "var(--background-text,#dddac7)" }}
              >
                {advantage.title}
              </p>
              <p
                className="mt-[12px] break-words text-[21px] leading-[1.14]"
                style={{ color: "var(--background-text,#cbc7b2)" }}
              >
                {advantage.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </>
  );
};

export default DefensibilitySlide;
