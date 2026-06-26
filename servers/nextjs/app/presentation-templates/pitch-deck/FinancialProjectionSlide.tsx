import * as z from "zod";

const ProjectionRowSchema = z.object({
  label: z.string().min(3).max(24).meta({
    description: "Metric label for the projection row.",
  }),
  year1: z.string().min(1).max(12).meta({
    description: "Projected value for the first period.",
  }),
  year2: z.string().min(1).max(12).meta({
    description: "Projected value for the second period.",
  }),
  year3: z.string().min(1).max(12).meta({
    description: "Projected value for the third period.",
  }),
});

const ProjectionAssumptionSchema = z.object({
  label: z.string().min(3).max(24).meta({
    description: "Assumption label.",
  }),
  value: z.string().min(6).max(52).meta({
    description: "Short assumption value or explanation.",
  }),
});

export const slideLayoutId = "financial-projection-slide";
export const slideLayoutName = "Financial Projection Slide";
export const slideLayoutDescription =
  "A pitch-deck layout with a compact projection table and supporting assumptions.";

export const Schema = z.object({
  title: z.string().min(4).max(30).default("Financial Plan").meta({
    description: "Main slide heading.",
  }),
  subtitle: z.string().min(24).max(90).default(
    "A simple projection view of revenue growth, margin movement, and operating assumptions."
  ).meta({
    description: "Short subtitle introducing the projection.",
  }),
  periods: z.object({
    first: z.string().min(2).max(10).default("Year 1").meta({
      description: "First projection period label.",
    }),
    second: z.string().min(2).max(10).default("Year 2").meta({
      description: "Second projection period label.",
    }),
    third: z.string().min(2).max(10).default("Year 3").meta({
      description: "Third projection period label.",
    }),
  }).default({
    first: "Year 1",
    second: "Year 2",
    third: "Year 3",
  }).meta({
    description: "Projection period labels used as table headers.",
  }),
  rows: z.array(ProjectionRowSchema).min(3).max(5).default([
    { label: "Revenue", year1: "$1.2M", year2: "$4.8M", year3: "$12.5M" },
    { label: "Gross Margin", year1: "72%", year2: "78%", year3: "82%" },
    { label: "Customers", year1: "42", year2: "160", year3: "410" },
    { label: "Runway", year1: "18 mo", year2: "24 mo", year3: "Profitable" },
  ]).meta({
    description: "Projection rows.",
  }),
  assumptions: z.array(ProjectionAssumptionSchema).min(2).max(4).default([
    { label: "ACV", value: "Expansion increases with workflow depth." },
    { label: "Margin", value: "Automation and self-serve onboarding improve margin." },
    { label: "Sales", value: "Growth assumes focused account selection." },
  ]).meta({
    description: "Assumptions shown beside the table.",
  }),
});

export type SchemaType = z.infer<typeof Schema>;

const FinancialProjectionSlide = ({ data }: { data: Partial<SchemaType> }) => {
  const defaults = Schema.parse({});
  const slideData = {
    ...defaults,
    ...data,
    periods: { ...defaults.periods, ...(data.periods ?? {}) },
    rows: data.rows ?? defaults.rows,
    assumptions: data.assumptions ?? defaults.assumptions,
  } as SchemaType;
  const periods = [slideData.periods.first, slideData.periods.second, slideData.periods.third];

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
        <p className="mt-[18px] max-w-[840px] break-words text-[27px] leading-[1.15]" style={{ color: "var(--background-text,#cbc7b2)" }}>
          {slideData.subtitle}
        </p>

        <div className="mt-[42px] grid grid-cols-[1fr_360px] gap-[34px]">
          <div className="border" style={{ borderColor: "var(--stroke,#8d8a7d)" }}>
            <div className="grid grid-cols-[1.15fr_1fr_1fr_1fr]" style={{ backgroundColor: "var(--primary-color,#dddac7)", color: "var(--primary-text,#27292d)" }}>
              <p className="px-[18px] py-[14px] text-[21px] leading-none">Metric</p>
              {periods.map((period) => (
                <p key={period} className="px-[18px] py-[14px] text-[21px] leading-none">{period}</p>
              ))}
            </div>
            {slideData.rows.map((row, index) => (
              <div key={`${row.label}-${index}`} className="grid grid-cols-[1.15fr_1fr_1fr_1fr] border-t" style={{ borderColor: "var(--stroke,#8d8a7d)" }}>
                <p className="break-words px-[18px] py-[16px] text-[24px] leading-[1.08]" style={{ color: "var(--background-text,#dddac7)" }}>{row.label}</p>
                <p className="break-words px-[18px] py-[16px] text-[24px] leading-[1.08]" style={{ color: "var(--background-text,#d7d3be)" }}>{row.year1}</p>
                <p className="break-words px-[18px] py-[16px] text-[24px] leading-[1.08]" style={{ color: "var(--background-text,#d7d3be)" }}>{row.year2}</p>
                <p className="break-words px-[18px] py-[16px] text-[24px] leading-[1.08]" style={{ color: "var(--background-text,#d7d3be)" }}>{row.year3}</p>
              </div>
            ))}
          </div>

          <div className="grid content-start gap-[16px]">
            {slideData.assumptions.map((assumption, index) => (
              <div key={`${assumption.label}-${index}`} className="border p-[18px]" style={{ borderColor: "var(--stroke,#8d8a7d)" }}>
                <p className="break-words text-[27px] leading-none" style={{ color: "var(--primary-color,#dddac7)" }}>{assumption.label}</p>
                <p className="mt-[10px] break-words text-[20px] leading-[1.13]" style={{ color: "var(--background-text,#cbc7b2)" }}>{assumption.value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
};

export default FinancialProjectionSlide;
