import * as z from "zod";

const MethodStepSchema = z.object({
  label: z.string().min(2).max(12).meta({
    description: "Short step label or sequence marker.",
  }),
  title: z.string().min(4).max(30).meta({
    description: "Short title for the method step.",
  }),
  description: z.string().min(20).max(100).meta({
    description: "Brief explanation of the method step.",
  }),
});

const SourceItemSchema = z.object({
  name: z.string().min(3).max(34).meta({
    description: "Name of a data source, reference, input, or evidence group.",
  }),
  detail: z.string().min(14).max(90).meta({
    description: "Short detail explaining how the source is used.",
  }),
});

const ParameterItemSchema = z.object({
  label: z.string().min(3).max(24).meta({
    description: "Label for an assumption, scope item, or parameter.",
  }),
  value: z.string().min(4).max(60).meta({
    description: "Short value or description for the parameter.",
  }),
});

export const slideLayoutId = "method-source-panels-slide";
export const slideLayoutName = "Method and Source Panels Slide";
export const slideLayoutDescription =
  "A report slide with method steps, source panels, and compact assumptions or scope parameters.";

export const Schema = z.object({
  title: z.string().min(6).max(38).default("Methodology").meta({
    description: "Main slide title.",
  }),
  subtitle: z.string().min(20).max(140).default(
    "This slide explains the inputs, source groups, and method used to structure the report analysis."
  ).meta({
    description: "Short subtitle introducing the method and source context.",
  }),
  steps: z.array(MethodStepSchema).min(3).max(5).default([
    {
      label: "01",
      title: "Collect Inputs",
      description: "Gather relevant records, source material, observations, and supporting context.",
    },
    {
      label: "02",
      title: "Compare Signals",
      description: "Review patterns across sources and identify consistent or conflicting evidence.",
    },
    {
      label: "03",
      title: "Synthesize",
      description: "Translate the strongest evidence into findings, risks, and recommended actions.",
    },
  ]).meta({
    description: "Method steps shown in the primary panel.",
  }),
  sources: z.array(SourceItemSchema).min(3).max(5).default([
    {
      name: "Operational Records",
      detail: "Primary records used to understand recent performance and activity levels.",
    },
    {
      name: "Stakeholder Notes",
      detail: "Qualitative input used to clarify context, constraints, and decision needs.",
    },
    {
      name: "Reference Data",
      detail: "External or historical data used to compare movement and validate assumptions.",
    },
  ]).meta({
    description: "Source panels shown alongside the method steps.",
  }),
  parameters: z.array(ParameterItemSchema).min(2).max(4).default([
    { label: "Scope", value: "Current reporting period" },
    { label: "Confidence", value: "Based on available source quality" },
    { label: "Review", value: "Validated against source notes" },
  ]).meta({
    description: "Compact assumptions, scope markers, or analysis parameters.",
  }),
});

export type SchemaType = z.infer<typeof Schema>;

const MethodologySourcesSlide = ({ data }: { data: Partial<SchemaType> }) => {
  const steps = data.steps ?? [];
  const sources = data.sources ?? [];
  const parameters = data.parameters ?? [];

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
            className="mt-[14px] max-w-[920px] break-words text-[23px] leading-[1.22] text-[#4A4D53]"
            style={{ color: "var(--background-text,#4A4D53)", opacity: 0.82 }}
          >
            {data.subtitle}
          </p>
        </div>

        <div className="mx-[64px] mt-[26px] grid grid-cols-[1.05fr_0.95fr] gap-[24px]">
          <div
            className="rounded-[28px] bg-white p-[24px]"
            style={{
              backgroundColor: "var(--card-color,#ffffff)",
              color: "var(--card-text,var(--background-text,#232223))",
            }}
          >
            <p className="text-[15px] font-bold uppercase leading-none text-[#157CFF]" style={{ color: "var(--primary-color,#157CFF)" }}>Method</p>
            <div className="mt-[18px] grid gap-[14px]">
              {steps.map((step, index) => (
                <div key={`${step.label}-${step.title}-${index}`} className="grid grid-cols-[62px_1fr] gap-[16px]">
                  <div
                    className="flex h-[48px] w-[48px] items-center justify-center rounded-full bg-[#157CFF] text-[18px] font-bold text-white"
                    style={{
                      backgroundColor: "var(--primary-color,#157CFF)",
                      color: "var(--primary-text,#ffffff)",
                    }}
                  >
                    {step.label}
                  </div>
                  <div>
                    <p className="break-words text-[26px] font-bold leading-[1.08] text-[#232223]" style={{ color: "inherit" }}>{step.title}</p>
                    <p className="mt-[5px] break-words text-[18px] leading-[1.16] text-[#4A4D53]" style={{ color: "inherit", opacity: 0.78 }}>{step.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-[18px]">
            <div
              className="rounded-[28px] bg-white p-[24px]"
              style={{
                backgroundColor: "var(--card-color,#ffffff)",
                color: "var(--card-text,var(--background-text,#232223))",
              }}
            >
              <p className="text-[15px] font-bold uppercase leading-none text-[#157CFF]" style={{ color: "var(--primary-color,#157CFF)" }}>Sources</p>
              <div className="mt-[16px] grid gap-[11px]">
                {sources.map((source, index) => (
                  <div
                    key={`${source.name}-${index}`}
                    className="rounded-[16px] border border-[#D6D9DE] px-[17px] py-[12px]"
                    style={{ borderColor: "var(--stroke,#D6D9DE)" }}
                  >
                    <p className="break-words text-[21px] font-bold leading-[1.06] text-[#232223]" style={{ color: "inherit" }}>{source.name}</p>
                    <p className="mt-[5px] break-words text-[16px] leading-[1.16] text-[#4A4D53]" style={{ color: "inherit", opacity: 0.78 }}>{source.detail}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-[12px]" style={{ gridTemplateColumns: `repeat(${Math.max(parameters.length, 1)}, minmax(0, 1fr))` }}>
              {parameters.map((parameter, index) => (
                <div
                  key={`${parameter.label}-${index}`}
                  className="rounded-[18px] bg-[#157CFF] px-[18px] py-[15px] text-white"
                  style={{
                    backgroundColor: "var(--primary-color,#157CFF)",
                    color: "var(--primary-text,#ffffff)",
                  }}
                >
                  <p className="break-words text-[15px] font-bold uppercase leading-none opacity-80">{parameter.label}</p>
                  <p className="mt-[8px] break-words text-[18px] font-semibold leading-[1.1]">{parameter.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default MethodologySourcesSlide;
