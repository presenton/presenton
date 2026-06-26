import * as z from "zod";

const FindingSchema = z.object({
  number: z.string().min(1).max(4).meta({
    description: "Short finding number or ordering label.",
  }),
  title: z.string().min(4).max(32).meta({
    description: "Finding title.",
  }),
  evidence: z.string().min(18).max(95).meta({
    description: "Brief evidence statement supporting the finding.",
  }),
  interpretation: z.string().min(18).max(110).meta({
    description: "Short interpretation explaining why the finding matters.",
  }),
});

export const slideLayoutId = "finding-cards-slide";
export const slideLayoutName = "Finding Cards Slide";
export const slideLayoutDescription =
  "A report slide with a title, subtitle, and finding cards that pair evidence with interpretation.";

export const Schema = z.object({
  title: z.string().min(6).max(36).default("Key Findings").meta({
    description: "Main slide title.",
  }),
  subtitle: z.string().min(20).max(140).default(
    "A concise set of findings showing the strongest evidence and what each signal means."
  ).meta({
    description: "Short subtitle introducing the findings.",
  }),
  findings: z.array(FindingSchema).min(3).max(5).default([
    {
      number: "01",
      title: "Consistent Movement",
      evidence: "Multiple source groups show the same direction of change across the reporting period.",
      interpretation: "The pattern is likely meaningful and should be reviewed as a decision signal.",
    },
    {
      number: "02",
      title: "Uneven Adoption",
      evidence: "Activity is concentrated in a few segments while other areas show slower progress.",
      interpretation: "Follow-up should target the gaps that limit broader performance.",
    },
    {
      number: "03",
      title: "Clear Constraints",
      evidence: "Recurring notes point to capacity, timing, and ownership as common blockers.",
      interpretation: "Removing these constraints can improve execution and reduce delays.",
    },
  ]).meta({
    description: "Finding cards with evidence and interpretation.",
  }),
});

export type SchemaType = z.infer<typeof Schema>;

const KeyFindingsSlide = ({ data }: { data: Partial<SchemaType> }) => {
  const findings = data.findings ?? [];

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
            className="mt-[14px] max-w-[950px] break-words text-[23px] leading-[1.22] text-[#4A4D53]"
            style={{ color: "var(--background-text,#4A4D53)", opacity: 0.82 }}
          >
            {data.subtitle}
          </p>
        </div>

        <div
          className="mx-[64px] mt-[28px] grid gap-[18px]"
          style={{ gridTemplateColumns: `repeat(${Math.max(findings.length, 1)}, minmax(0, 1fr))` }}
        >
          {findings.map((finding, index) => (
            <div
              key={`${finding.number}-${finding.title}-${index}`}
              className="rounded-[24px] border border-[#D6D9DE] bg-white p-[24px]"
              style={{
                backgroundColor: "var(--card-color,#ffffff)",
                borderColor: "var(--stroke,#D6D9DE)",
                color: "var(--card-text,var(--background-text,#232223))",
              }}
            >
              <div className="flex items-start gap-[16px]">
                <div
                  className="flex h-[48px] w-[48px] shrink-0 items-center justify-center rounded-full bg-[#157CFF] text-[18px] font-bold text-white"
                  style={{
                    backgroundColor: "var(--primary-color,#157CFF)",
                    color: "var(--primary-text,#ffffff)",
                  }}
                >
                  {finding.number}
                </div>
                <p className="min-w-0 break-words text-[28px] font-bold leading-[1.08] text-[#232223]" style={{ color: "inherit" }}>
                  {finding.title}
                </p>
              </div>
              <div
                className="mt-[18px] rounded-[16px] bg-[#F1F5FA] px-[18px] py-[14px]"
                style={{ backgroundColor: "var(--background-color,#F1F5FA)" }}
              >
                <p className="text-[14px] font-bold uppercase leading-none text-[#157CFF]" style={{ color: "var(--primary-color,#157CFF)" }}>Evidence</p>
                <p className="mt-[8px] break-words text-[18px] leading-[1.16] text-[#34333A]" style={{ color: "var(--background-text,var(--card-text,#34333A))" }}>{finding.evidence}</p>
              </div>
              <p className="mt-[14px] break-words text-[19px] leading-[1.18] text-[#4A4D53]" style={{ color: "inherit", opacity: 0.78 }}>
                {finding.interpretation}
              </p>
            </div>
          ))}
        </div>
      </div>
    </>
  );
};

export default KeyFindingsSlide;
