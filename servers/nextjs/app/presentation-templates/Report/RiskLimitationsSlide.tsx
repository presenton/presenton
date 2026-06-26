import * as z from "zod";

const RiskItemSchema = z.object({
  label: z.string().min(3).max(28).meta({
    description: "Short risk or issue label.",
  }),
  level: z.string().min(3).max(14).meta({
    description: "Severity, likelihood, or priority level label.",
  }),
  impact: z.string().min(12).max(70).meta({
    description: "Brief impact statement for the risk.",
  }),
  response: z.string().min(12).max(80).meta({
    description: "Brief response, mitigation, or monitoring action.",
  }),
});

export const slideLayoutId = "risk-limitation-matrix-slide";
export const slideLayoutName = "Risk and Limitation Matrix Slide";
export const slideLayoutDescription =
  "A report slide with a compact risk matrix and a side panel for assumptions, caveats, or limitations.";

export const Schema = z.object({
  title: z.string().min(6).max(38).default("Risks and Limitations").meta({
    description: "Main slide title.",
  }),
  subtitle: z.string().min(20).max(140).default(
    "A concise view of the main risks, expected impacts, responses, and limitations that shape interpretation."
  ).meta({
    description: "Short subtitle introducing the risk and limitation context.",
  }),
  risks: z.array(RiskItemSchema).min(3).max(5).default([
    {
      label: "Data Gaps",
      level: "Medium",
      impact: "Incomplete records can reduce confidence in trend interpretation.",
      response: "Validate findings against source notes and update missing fields.",
    },
    {
      label: "Timing Shift",
      level: "High",
      impact: "Late inputs can change priorities after the report is shared.",
      response: "Add a review checkpoint before final decisions are made.",
    },
    {
      label: "Scope Drift",
      level: "Medium",
      impact: "Expanding scope can dilute focus and slow recommended actions.",
      response: "Keep next steps tied to the agreed report questions.",
    },
  ]).meta({
    description: "Risks, issues, or constraints shown in the matrix.",
  }),
  limitations: z.array(z.string().min(12).max(90).meta({
    description: "Single limitation, caveat, or assumption statement.",
  })).min(2).max(4).default([
    "The report reflects available information from the stated review period.",
    "Some qualitative inputs may require follow-up validation before action.",
    "Trend interpretation should be updated when new source data is available.",
  ]).meta({
    description: "Limitations, caveats, or assumptions shown in the side panel.",
  }),
});

export type SchemaType = z.infer<typeof Schema>;

const RiskLimitationsSlide = ({ data }: { data: Partial<SchemaType> }) => {
  const risks = data.risks ?? [];
  const limitations = data.limitations ?? [];

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
          <h2 className="break-words text-[56px] font-bold leading-[1.02] tracking-normal">
            {data.title}
          </h2>
          <p
            className="mt-[14px] max-w-[940px] break-words text-[23px] leading-[1.22] text-[#4A4D53]"
            style={{ color: "var(--background-text,#4A4D53)", opacity: 0.82 }}
          >
            {data.subtitle}
          </p>
        </div>

        <div className="mx-[64px] mt-[28px] grid grid-cols-[1fr_350px] gap-[24px]">
          <div
            className="rounded-[26px] bg-white p-[20px]"
            style={{
              backgroundColor: "var(--card-color,#ffffff)",
              color: "var(--card-text,var(--background-text,#232223))",
            }}
          >
            <div
              className="grid grid-cols-[1.05fr_0.7fr_1.3fr_1.3fr] rounded-t-[16px] bg-[#157CFF] px-[18px] py-[12px] text-[16px] font-bold uppercase leading-none text-white"
              style={{
                backgroundColor: "var(--primary-color,#157CFF)",
                color: "var(--primary-text,#ffffff)",
              }}
            >
              <p>Risk</p>
              <p>Level</p>
              <p>Impact</p>
              <p>Response</p>
            </div>
            <div className="grid">
              {risks.map((risk, index) => (
                <div
                  key={`${risk.label}-${index}`}
                  className="grid grid-cols-[1.05fr_0.7fr_1.3fr_1.3fr] border-b border-[#E3E4E8] px-[18px] py-[13px] last:border-b-0"
                  style={{ borderColor: "var(--stroke,#E3E4E8)" }}
                >
                  <p className="break-words text-[19px] font-bold leading-[1.12] text-[#232223]" style={{ color: "inherit" }}>{risk.label}</p>
                  <p className="break-words text-[17px] font-semibold leading-[1.12] text-[#157CFF]" style={{ color: "var(--primary-color,#157CFF)" }}>{risk.level}</p>
                  <p className="break-words text-[16px] leading-[1.14] text-[#4A4D53]" style={{ color: "inherit", opacity: 0.78 }}>{risk.impact}</p>
                  <p className="break-words text-[16px] leading-[1.14] text-[#4A4D53]" style={{ color: "inherit", opacity: 0.78 }}>{risk.response}</p>
                </div>
              ))}
            </div>
          </div>

          <div
            className="rounded-[26px] border border-[#D6D9DE] bg-white p-[24px]"
            style={{
              backgroundColor: "var(--card-color,#ffffff)",
              borderColor: "var(--stroke,#D6D9DE)",
              color: "var(--card-text,var(--background-text,#34333A))",
            }}
          >
            <p className="text-[15px] font-bold uppercase leading-none text-[#157CFF]" style={{ color: "var(--primary-color,#157CFF)" }}>Limitations</p>
            <div className="mt-[18px] grid gap-[14px]">
              {limitations.map((limitation, index) => (
                <div key={`limitation-${index}`} className="grid grid-cols-[34px_1fr] gap-[12px]">
                  <div
                    className="flex h-[26px] w-[26px] items-center justify-center rounded-full bg-[#157CFF] text-[13px] font-bold leading-none text-white"
                    style={{
                      backgroundColor: "var(--primary-color,#157CFF)",
                      color: "var(--primary-text,#ffffff)",
                    }}
                  >
                    {index + 1}
                  </div>
                  <p className="break-words text-[18px] leading-[1.16] text-[#34333A]" style={{ color: "inherit" }}>{limitation}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default RiskLimitationsSlide;
