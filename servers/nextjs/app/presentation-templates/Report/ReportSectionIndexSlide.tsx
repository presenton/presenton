import * as z from "zod";

export const slideLayoutId = "section-index-slide";
export const slideLayoutName = "Section Index Slide";
export const slideLayoutDescription =
  "A split layout with a large title area and a numbered list of report sections arranged in columns.";

const SectionSchema = z.object({
  number: z.string().min(1).max(4).meta({
    description: "Short section number or label.",
  }),
  title: z.string().min(4).max(36).meta({
    description: "Section title.",
  }),
  description: z.string().min(12).max(90).meta({
    description: "Short section description.",
  }),
});

const DEFAULT_SECTIONS = [
  { number: "01", title: "Overview", description: "Context, scope, and the report objective." },
  { number: "02", title: "Method", description: "Sources, assumptions, and collection approach." },
  { number: "03", title: "Findings", description: "Main signals observed across the analysis." },
  { number: "04", title: "Recommendations", description: "Suggested actions based on the evidence." },
  { number: "05", title: "Next Steps", description: "Owners, timing, and follow-up checkpoints." },
];

export const Schema = z.object({
  title: z.string().min(6).max(44).default("Report Sections").meta({
    description: "Main slide title.",
  }),
  subtitle: z
    .string()
    .min(20)
    .max(140)
    .default("A structured guide to the major sections covered in this report.")
    .meta({
      description: "Short supporting text shown below the title.",
    }),
  sections: z.array(SectionSchema).min(4).max(10).default(DEFAULT_SECTIONS).meta({
    description: "Numbered section entries shown in the index list.",
  }),
});

export type SchemaType = z.infer<typeof Schema>;

const ReportSectionIndexSlide = ({ data }: { data: Partial<SchemaType> }) => {
  const title = data.title || "Report Sections";
  const subtitle =
    data.subtitle || "A structured guide to the major sections covered in this report.";
  const sections = data.sections?.length ? data.sections.slice(0, 10) : DEFAULT_SECTIONS;
  const columns = sections.length > 6 ? 2 : 1;

  return (
    <>
      <link href="https://fonts.googleapis.com/css2?family=Source+Sans+3:ital,wght@0,200..900;1,200..900&display=swap" rel="stylesheet" />
      <div
        className="relative grid h-[720px] w-[1280px] grid-cols-[410px_1fr] overflow-hidden rounded-[24px]"
        style={{
          backgroundColor: "var(--background-color,#F9F8F8)",
          fontFamily: "var(--body-font-family,'Source Sans 3')",
          letterSpacing: 0,
        }}
      >
        <div className="flex flex-col px-[62px] py-[62px]" style={{ backgroundColor: "var(--primary-color,#157CFF)", color: "var(--primary-text,#ffffff)" }}>
          <p className="text-[18px] font-semibold uppercase tracking-normal opacity-85">Sections</p>
          <h2 className="mt-[24px] break-words text-[68px] font-bold leading-[0.98]">{title}</h2>
          <p className="mt-[24px] break-words text-[23px] leading-[1.24] opacity-90">{subtitle}</p>
          <div className="mt-auto h-[2px] w-[160px]" style={{ backgroundColor: "var(--primary-text,#ffffff)", opacity: 0.45 }} />
        </div>

        <div className="px-[58px] py-[58px]">
          <div
            className="grid gap-x-[26px] gap-y-[14px]"
            style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
          >
            {sections.map((section, index) => (
              <div
                key={`${section.number}-${section.title}-${index}`}
                className="grid min-w-0 grid-cols-[64px_1fr] gap-[18px] rounded-[20px] border px-[20px] py-[17px]"
                style={{
                  backgroundColor: "var(--card-color,#ffffff)",
                  borderColor: "var(--stroke,#E5E4E4)",
                }}
              >
                <div className="flex h-[48px] w-[48px] items-center justify-center rounded-full text-[18px] font-bold" style={{ backgroundColor: "var(--background-color,#F1F5FF)", color: "var(--primary-color,#157CFF)" }}>
                  {section.number}
                </div>
                <div className="min-w-0">
                  <h3 className="break-words text-[24px] font-bold leading-[1.05]" style={{ color: "var(--background-text,#232223)" }}>
                    {section.title}
                  </h3>
                  <p className="mt-[7px] break-words text-[17px] leading-[1.18]" style={{ color: "var(--background-text,#56565c)" }}>
                    {section.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
};

export default ReportSectionIndexSlide;
