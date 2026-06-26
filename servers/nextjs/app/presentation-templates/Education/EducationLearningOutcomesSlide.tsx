import * as z from "zod";

export const slideLayoutId = "numbered-outcome-cards-slide";
export const slideLayoutName = "Numbered Outcome Cards Slide";
export const slideLayoutDescription =
  "A title and subtitle layout with numbered cards containing a verb, heading, and description.";

const LearningOutcomeSchema = z.object({
  verb: z.string().min(4).max(14).meta({
    description: "Action verb such as Analyze, Build, Evaluate, Design.",
  }),
  title: z.string().min(4).max(28).meta({
    description: "Short outcome title.",
  }),
  description: z.string().min(24).max(110).meta({
    description: "Specific outcome or capability statement.",
  }),
});

const DEFAULT_OUTCOMES = [
  {
    verb: "Analyze",
    title: "Core Concepts",
    description: "Break down key ideas and explain how they apply in real learning contexts.",
  },
  {
    verb: "Apply",
    title: "Practical Skills",
    description: "Use learned methods to complete tasks, solve problems, and make decisions.",
  },
  {
    verb: "Evaluate",
    title: "Performance",
    description: "Assess results using clear criteria, evidence, and structured reflection.",
  },
];

export const Schema = z.object({
  title: z.string().min(6).max(32).default("Key Outcomes").meta({
    description: "Main slide title.",
  }),
  subtitle: z.string().min(20).max(130).default(
    "A concise overview of the expected outcomes, capabilities, or takeaways."
  ).meta({
    description: "Short subtitle explaining the outcome context.",
  }),
  outcomes: z.array(LearningOutcomeSchema).min(3).max(6).default(DEFAULT_OUTCOMES).meta({
    description: "Numbered outcome cards shown in the main layout.",
  }),
});

export type SchemaType = z.infer<typeof Schema>;

function getOutcomes(outcomes?: Array<Partial<SchemaType["outcomes"][number]>>) {
  const source = outcomes?.length ? outcomes : DEFAULT_OUTCOMES;

  return source.slice(0, 6).map((outcome, index) => ({
    ...DEFAULT_OUTCOMES[index % DEFAULT_OUTCOMES.length],
    ...outcome,
  }));
}

const EducationLearningOutcomesSlide = ({ data }: { data: Partial<SchemaType> }) => {
  const outcomes = getOutcomes(data.outcomes);
  const columns = outcomes.length === 3 ? 1 : 2;
  const compact = outcomes.length > 4;
  const cardHeight = outcomes.length === 3 ? 128 : compact ? 132 : 156;
  const numberColumnWidth = compact ? 78 : 84;
  const title = data.title || "Key Outcomes";
  const subtitle = data.subtitle || "A concise overview of the expected outcomes, capabilities, or takeaways.";

  return (
    <>
      <link href="https://fonts.googleapis.com/css2?family=Source+Serif+4:ital,opsz,wght@0,8..60,200..900;1,8..60,200..900&display=swap" rel="stylesheet" />
      <div
        className="relative h-[720px] w-[1280px] overflow-hidden px-[56px] py-[52px]"
        style={{
          backgroundColor: "var(--background-color,#efeff1)",
          fontFamily: "var(--body-font-family,'Source Serif 4')",
        }}
      >
        <div className="flex items-end justify-between gap-[48px]">
          <div>
            <h2 className="font-serif text-[62px] font-medium leading-[96%] tracking-[-0.02em]" style={{ color: "var(--primary-color,#1a1752)" }}>
              {title}
            </h2>
            <p className="mt-[14px] max-w-[820px] text-[22px] leading-[1.26]" style={{ color: "var(--background-text,#3a3d4c)" }}>
              {subtitle}
            </p>
          </div>
          <p className="shrink-0 text-[18px] font-semibold uppercase tracking-[0.08em]" style={{ color: "var(--primary-color,#272272)" }}>
            Outcomes
          </p>
        </div>

        <div
          className="mt-[34px] grid gap-[18px]"
          style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
        >
          {outcomes.map((outcome, index) => (
            <div
              key={`${outcome.verb}-${outcome.title}-${index}`}
              className="grid min-h-0 overflow-hidden rounded-[18px] border"
              style={{
                backgroundColor: "var(--card-color,#FFFFFF80)",
                borderColor: "var(--stroke,#d8d8dd)",
                gridTemplateColumns: `${numberColumnWidth}px minmax(0, 1fr)`,
                height: `${cardHeight}px`,
              }}
            >
              <div
                className="flex flex-col items-center justify-center border-r"
                style={{
                  backgroundColor: "var(--card-color,#f1efef)",
                  borderColor: "var(--stroke,#d8d8dd)",
                }}
              >
                <p className="text-[24px] font-semibold leading-none" style={{ color: "var(--primary-color,#272272)" }}>
                  {String(index + 1).padStart(2, "0")}
                </p>
                <div className="mt-[12px] h-[26px] w-[3px] rounded-full" style={{ backgroundColor: "var(--primary-color,#272272)" }} />
              </div>
              <div className="min-w-0 px-[24px] py-[16px]">
                <div className="grid min-w-0 grid-cols-[minmax(92px,auto)_minmax(0,1fr)] items-start gap-[14px]">
                  <h3
                    className="font-semibold leading-[1.04]"
                    style={{
                      color: "var(--primary-color,#1a1752)",
                      fontSize: compact ? "24px" : "28px",
                    }}
                  >
                    {outcome.verb}
                  </h3>
                  <p
                    className="min-w-0 font-medium leading-[1.08]"
                    style={{
                      color: "var(--background-text,#3c3f4b)",
                      fontSize: compact ? "18px" : "20px",
                      overflow: "hidden",
                    }}
                  >
                    {outcome.title}
                  </p>
                </div>
                <p
                  className="mt-[13px] leading-[1.22]"
                  style={{
                    color: "var(--background-text,#3a3d4c)",
                    fontSize: compact ? "17px" : "19px",
                    overflow: "hidden",
                  }}
                >
                  {outcome.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
};

export default EducationLearningOutcomesSlide;
