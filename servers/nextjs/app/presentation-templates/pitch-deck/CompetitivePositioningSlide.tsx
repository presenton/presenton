import * as z from "zod";

const CompetitorSchema = z.object({
  name: z.string().min(3).max(24).meta({
    description: "Competitor, alternative, or category name.",
  }),
  strength: z.string().min(8).max(42).meta({
    description: "Short strength or current advantage.",
  }),
  gap: z.string().min(8).max(42).meta({
    description: "Short weakness, gap, or limitation.",
  }),
});

const PositioningAxisSchema = z.object({
  xAxis: z.string().min(4).max(32).meta({
    description: "Horizontal axis label.",
  }),
  yAxis: z.string().min(4).max(32).meta({
    description: "Vertical axis label.",
  }),
});

export const slideLayoutId = "competitive-positioning-slide";
export const slideLayoutName = "Competitive Positioning Slide";
export const slideLayoutDescription =
  "A pitch-deck layout with a simple positioning quadrant and competitor comparison rows.";

export const Schema = z.object({
  title: z.string().min(4).max(30).default("Positioning").meta({
    description: "Main slide heading.",
  }),
  summary: z.string().min(24).max(90).default(
    "The opportunity is to combine workflow depth with a simpler operating layer for teams."
  ).meta({
    description: "Short positioning summary.",
  }),
  axes: PositioningAxisSchema.default({
    xAxis: "Workflow depth",
    yAxis: "Ease of adoption",
  }).meta({
    description: "Axis labels for the positioning quadrant.",
  }),
  competitors: z.array(CompetitorSchema).min(3).max(4).default([
    { name: "Spreadsheets", strength: "Flexible and familiar", gap: "Hard to govern at scale" },
    { name: "Project Tools", strength: "Good task visibility", gap: "Weak decision context" },
    { name: "Custom Systems", strength: "Deep internal fit", gap: "Slow and costly to maintain" },
  ]).meta({
    description: "Competitor or alternative rows.",
  }),
  positionLabel: z.string().min(4).max(26).default("Focused operating layer").meta({
    description: "Label for the preferred position in the quadrant.",
  }),
});

export type SchemaType = z.infer<typeof Schema>;

const CompetitivePositioningSlide = ({ data }: { data: Partial<SchemaType> }) => {
  const defaults = Schema.parse({});
  const slideData = {
    ...defaults,
    ...data,
    axes: { ...defaults.axes, ...(data.axes ?? {}) },
    competitors: data.competitors ?? defaults.competitors,
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
        <h2 className="break-words text-[74px] leading-none" style={{ color: "var(--background-text,#dddac7)" }}>
          {slideData.title}
        </h2>
        <p className="mt-[18px] max-w-[820px] break-words text-[27px] leading-[1.15]" style={{ color: "var(--background-text,#cbc7b2)" }}>
          {slideData.summary}
        </p>

        <div className="mt-[36px] grid grid-cols-[520px_1fr] gap-[34px]">
          <div className="relative h-[392px] border" style={{ borderColor: "var(--stroke,#8d8a7d)" }}>
            <div className="absolute left-1/2 top-0 h-full w-[1px]" style={{ backgroundColor: "var(--stroke,#8d8a7d)" }} />
            <div className="absolute left-0 top-1/2 h-[1px] w-full" style={{ backgroundColor: "var(--stroke,#8d8a7d)" }} />
            <div className="absolute left-[18px] top-[16px]">
              <p className="text-[17px] uppercase leading-none" style={{ color: "var(--primary-color,#dddac7)" }}>High</p>
              <p className="mt-[7px] max-w-[190px] break-words text-[20px] leading-[1.08]" style={{ color: "var(--background-text,#cbc7b2)" }}>{slideData.axes.yAxis}</p>
            </div>
            <div className="absolute bottom-[16px] left-[18px]">
              <p className="text-[17px] uppercase leading-none" style={{ color: "var(--background-text,#cbc7b2)" }}>Low</p>
            </div>
            <div className="absolute bottom-[16px] left-[282px]">
              <p className="text-[17px] uppercase leading-none" style={{ color: "var(--background-text,#cbc7b2)" }}>Low</p>
              <p className="mt-[7px] max-w-[170px] break-words text-[18px] leading-[1.08]" style={{ color: "var(--background-text,#cbc7b2)" }}>{slideData.axes.xAxis}</p>
            </div>
            <div className="absolute bottom-[16px] right-[18px] text-right">
              <p className="text-[17px] uppercase leading-none" style={{ color: "var(--primary-color,#dddac7)" }}>High</p>
              <p className="mt-[7px] max-w-[170px] break-words text-[18px] leading-[1.08]" style={{ color: "var(--background-text,#cbc7b2)" }}>{slideData.axes.xAxis}</p>
            </div>
            <div className="absolute left-[54px] top-[238px] max-w-[150px]">
              <p className="break-words text-[20px] leading-[1.08]" style={{ color: "var(--background-text,#cbc7b2)" }}>Simple but shallow</p>
            </div>
            <div className="absolute right-[34px] top-[238px] max-w-[160px] text-right">
              <p className="break-words text-[20px] leading-[1.08]" style={{ color: "var(--background-text,#cbc7b2)" }}>Deep but harder to adopt</p>
            </div>
            <div className="absolute right-[44px] top-[54px] max-w-[190px] p-[16px]" style={{ backgroundColor: "var(--primary-color,#dddac7)", color: "var(--primary-text,#27292d)" }}>
              <p className="text-[16px] uppercase leading-none opacity-75">Target position</p>
              <p className="break-words text-[26px] leading-[1.03]">{slideData.positionLabel}</p>
            </div>
          </div>

          <div className="grid content-start gap-[14px]">
            {slideData.competitors.map((competitor, index) => (
              <div key={`${competitor.name}-${index}`} className="border-b pb-[14px]" style={{ borderColor: "var(--stroke,#8d8a7d)" }}>
                <p className="break-words text-[30px] leading-none" style={{ color: "var(--background-text,#dddac7)" }}>{competitor.name}</p>
                <div className="mt-[10px] grid grid-cols-2 gap-[18px]">
                  <p className="break-words text-[20px] leading-[1.13]" style={{ color: "var(--background-text,#d7d3be)" }}>{competitor.strength}</p>
                  <p className="break-words text-[20px] leading-[1.13]" style={{ color: "var(--background-text,#cbc7b2)" }}>{competitor.gap}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
};

export default CompetitivePositioningSlide;
