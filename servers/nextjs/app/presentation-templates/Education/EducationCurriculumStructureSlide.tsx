import * as z from "zod";

export const slideLayoutId = "module-grid-slide";
export const slideLayoutName = "Multi Column Module Grid Slide";
export const slideLayoutDescription =
  "A title and subtitle layout with vertical cards containing a label, heading, description, and item list.";

const CurriculumModuleSchema = z.object({
  period: z.string().min(2).max(14).meta({
    description: "Short group label, such as a year, term, week, or phase.",
  }),
  title: z.string().min(4).max(28).meta({
    description: "Short title for the content group.",
  }),
  description: z.string().min(20).max(90).meta({
    description: "Short explanation of what this group covers.",
  }),
  subjects: z.array(z.string().min(3).max(36).meta({
    description: "Individual item shown in the group list.",
  })).min(3).max(6).meta({
    description: "Items included in this group.",
  }),
});

const DEFAULT_MODULES = [
  {
    period: "Year 1",
    title: "Foundation",
    description: "Students build core academic and technical fundamentals.",
    subjects: ["Mathematics", "Python Basics", "Academic Writing"],
  },
  {
    period: "Year 2",
    title: "Core Skills",
    description: "Learners move into discipline-specific technical courses.",
    subjects: ["Data Structures", "Statistics", "Databases"],
  },
  {
    period: "Year 3",
    title: "Application",
    description: "Students apply skills through labs, projects, and research.",
    subjects: ["Machine Learning", "Cloud Systems", "Research Methods"],
  },
];

export const Schema = z.object({
  title: z.string().min(6).max(32).default("Module Structure").meta({
    description: "Main slide title.",
  }),
  subtitle: z.string().min(20).max(140).default(
    "A structured overview of grouped content across stages, periods, or categories."
  ).meta({
    description: "Short description below the title.",
  }),
  modules: z.array(CurriculumModuleSchema).min(3).max(6).default(DEFAULT_MODULES).meta({
    description: "Content groups shown as columns in the module grid.",
  }),
});

export type SchemaType = z.infer<typeof Schema>;

function getModules(modules?: Array<Partial<SchemaType["modules"][number]>>) {
  const source = modules?.length ? modules : DEFAULT_MODULES;

  return source.slice(0, 6).map((module, index) => ({
    ...DEFAULT_MODULES[index % DEFAULT_MODULES.length],
    ...module,
    subjects: module?.subjects?.length
      ? module.subjects.slice(0, 6)
      : DEFAULT_MODULES[index % DEFAULT_MODULES.length].subjects,
  }));
}

const EducationCurriculumStructureSlide = ({ data }: { data: Partial<SchemaType> }) => {
  const modules = getModules(data.modules);
  const compact = modules.length >= 5;
  const title = data.title || "Module Structure";
  const subtitle = data.subtitle || "A structured overview of grouped content across stages, periods, or categories.";

  return (
    <>
      <link href="https://fonts.googleapis.com/css2?family=Source+Serif+4:ital,opsz,wght@0,8..60,200..900;1,8..60,200..900&display=swap" rel="stylesheet" />
      <div
        className="relative h-[720px] w-[1280px] overflow-hidden px-[56px] py-[50px]"
        style={{
          backgroundColor: "var(--background-color,#efeff1)",
          fontFamily: "var(--body-font-family,'Source Serif 4')",
        }}
      >
        <h2 className="font-serif text-[60px] font-medium leading-[96%] tracking-[-0.02em]" style={{ color: "var(--primary-color,#1a1752)" }}>
          {title}
        </h2>
        <p className="mt-[14px] max-w-[980px] text-[22px] leading-[1.28]" style={{ color: "var(--background-text,#3a3d4c)" }}>
          {subtitle}
        </p>

        <div
          className="mt-[28px] grid h-[464px] gap-[14px]"
          style={{ gridTemplateColumns: `repeat(${modules.length}, minmax(0, 1fr))` }}
        >
          {modules.map((module, index) => (
            <div
              key={`${module.period}-${module.title}-${index}`}
              className="flex min-w-0 flex-col overflow-hidden rounded-[18px] border px-[18px] py-[18px]"
              style={{
                backgroundColor: "var(--card-color,#FFFFFF80)",
                borderColor: "var(--stroke,#d8d8dd)",
              }}
            >
              <p
                className="w-fit rounded-full px-[12px] py-[5px] text-[14px] font-semibold leading-none"
                style={{
                  backgroundColor: "var(--primary-color,#272272)",
                  color: "var(--primary-text,#ffffff)",
                }}
              >
                {module.period}
              </p>
              <h3
                className="mt-[16px] font-semibold leading-[1.05]"
                style={{
                  color: "var(--primary-color,#1a1752)",
                  fontSize: compact ? "22px" : "26px",
                }}
              >
                {module.title}
              </h3>
              <p
                className="mt-[10px] leading-[1.18]"
                style={{
                  color: "var(--background-text,#3a3d4c)",
                  fontSize: compact ? "16px" : "18px",
                  overflow: "hidden",
                }}
              >
                {module.description}
              </p>
              <div className="mt-[16px] h-px w-full" style={{ backgroundColor: "var(--stroke,#d8d8dd)" }} />
              <div className="mt-[14px] flex min-h-0 flex-1 flex-col gap-[9px]">
                {module.subjects.map((subject, subjectIndex) => (
                  <div key={`${subject}-${subjectIndex}`} className="flex min-w-0 items-start gap-[9px]">
                    <span className="mt-[8px] h-[7px] w-[7px] shrink-0 rounded-full" style={{ backgroundColor: "var(--primary-color,#272272)" }} />
                    <p
                      className="min-w-0 leading-[1.14]"
                      style={{
                        color: "var(--background-text,#34394c)",
                        fontSize: compact ? "15px" : "17px",
                        overflow: "hidden",
                      }}
                    >
                      {subject}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
};

export default EducationCurriculumStructureSlide;
