import * as z from "zod";

const AllocationSchema = z.object({
  label: z.string().min(3).max(24).meta({
    description: "Funding allocation label.",
  }),
  percent: z.string().min(2).max(6).meta({
    description: "Allocation percentage.",
  }),
  description: z.string().min(14).max(56).meta({
    description: "Short description of the allocation.",
  }),
});

const FundingMilestoneSchema = z.object({
  label: z.string().min(3).max(24).meta({
    description: "Milestone label.",
  }),
  description: z.string().min(12).max(50).meta({
    description: "Milestone description.",
  }),
});

export const slideLayoutId = "funding-ask-slide";
export const slideLayoutName = "Funding Ask Slide";
export const slideLayoutDescription =
  "A pitch-deck layout with funding ask, runway, allocation cards, and milestones unlocked.";

export const Schema = z.object({
  title: z.string().min(4).max(28).default("Funding Ask").meta({
    description: "Main slide heading.",
  }),
  askAmount: z.string().min(2).max(16).default("$2.5M").meta({
    description: "Funding amount or ask value.",
  }),
  askContext: z.string().min(24).max(90).default(
    "Seed capital to accelerate product development, focused acquisition, and customer expansion."
  ).meta({
    description: "Short context explaining the funding ask.",
  }),
  runway: z.string().min(4).max(28).default("24 months runway").meta({
    description: "Runway or operating duration enabled by the raise.",
  }),
  allocations: z.array(AllocationSchema).min(3).max(4).default([
    { label: "Product", percent: "45%", description: "Core roadmap, automation, and integrations." },
    { label: "Growth", percent: "35%", description: "Sales, marketing, and account expansion." },
    { label: "Operations", percent: "20%", description: "Customer success, support, and infrastructure." },
  ]).meta({
    description: "Funding allocation cards.",
  }),
  milestones: z.array(FundingMilestoneSchema).min(2).max(4).default([
    { label: "Product", description: "Launch enterprise-ready workflow controls." },
    { label: "Revenue", description: "Reach repeatable sales motion and expansion." },
    { label: "Team", description: "Build key product and go-to-market roles." },
  ]).meta({
    description: "Milestones enabled by the funding.",
  }),
});

export type SchemaType = z.infer<typeof Schema>;

const FundingAskSlide = ({ data }: { data: Partial<SchemaType> }) => {
  const defaults = Schema.parse({});
  const slideData = {
    ...defaults,
    ...data,
    allocations: data.allocations ?? defaults.allocations,
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
        <div className="grid grid-cols-[420px_1fr] gap-[42px]">
          <div>
            <p className="text-[28px] leading-none" style={{ color: "var(--primary-color,#dddac7)" }}>{slideData.title}</p>
            <p className="mt-[52px] break-words text-[94px] leading-none" style={{ color: "var(--background-text,#dddac7)" }}>{slideData.askAmount}</p>
            <p className="mt-[24px] break-words text-[27px] leading-[1.15]" style={{ color: "var(--background-text,#cbc7b2)" }}>{slideData.askContext}</p>
            <p className="mt-[28px] inline-block px-[18px] py-[12px] text-[25px] leading-none" style={{ backgroundColor: "var(--primary-color,#dddac7)", color: "var(--primary-text,#27292d)" }}>
              {slideData.runway}
            </p>
          </div>

          <div className="pt-[18px]">
            <div className="grid gap-[18px]" style={{ gridTemplateColumns: `repeat(${slideData.allocations.length}, minmax(0, 1fr))` }}>
              {slideData.allocations.map((allocation, index) => (
                <div key={`${allocation.label}-${index}`} className="border p-[20px]" style={{ borderColor: "var(--stroke,#8d8a7d)" }}>
                  <p className="break-words text-[54px] leading-none" style={{ color: "var(--primary-color,#dddac7)" }}>{allocation.percent}</p>
                  <p className="mt-[18px] break-words text-[29px] leading-none" style={{ color: "var(--background-text,#dddac7)" }}>{allocation.label}</p>
                  <p className="mt-[12px] break-words text-[19px] leading-[1.13]" style={{ color: "var(--background-text,#cbc7b2)" }}>{allocation.description}</p>
                </div>
              ))}
            </div>

            <div className="mt-[34px] grid gap-[12px]">
              {slideData.milestones.map((milestone, index) => (
                <div key={`${milestone.label}-${index}`} className="grid grid-cols-[150px_1fr] border-b py-[11px]" style={{ borderColor: "var(--stroke,#8d8a7d)" }}>
                  <p className="break-words text-[25px] leading-none" style={{ color: "var(--background-text,#dddac7)" }}>{milestone.label}</p>
                  <p className="break-words text-[21px] leading-[1.12]" style={{ color: "var(--background-text,#cbc7b2)" }}>{milestone.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default FundingAskSlide;
