import * as z from "zod";

export const slideLayoutId = "scenario-cards-slide";
export const slideLayoutName = "Scenario Cards Slide";
export const slideLayoutDescription =
  "A split title/content layout with scenario cards containing actor and outcome text.";

const UseCaseSchema = z.object({
  scenario: z.string().max(34).meta({
    description: "Scenario title.",
  }),
  user: z.string().max(30).meta({
    description: "Associated actor, group, or owner label.",
  }),
  outcome: z.string().max(80).meta({
    description: "Outcome or result statement for this scenario.",
  }),
});

const DEFAULT_USE_CASES = [
  {
    scenario: "Roadmap Planning",
    user: "Product Managers",
    outcome:
      "Combine customer signals, effort, impact, and strategic goals into a clear planning view.",
  },
  {
    scenario: "Launch Readiness",
    user: "Go-to-market Teams",
    outcome:
      "Track ownership, dependencies, approvals, blockers, and launch milestones before release.",
  },
  {
    scenario: "Executive Updates",
    user: "Leadership",
    outcome:
      "Turn live product data into concise progress summaries and board-ready reporting.",
  },
  {
    scenario: "Customer Feedback",
    user: "Success Teams",
    outcome:
      "Connect customer requests and objections directly to roadmap decisions and product strategy.",
  },
  {
    scenario: "Operational Reviews",
    user: "Operations",
    outcome:
      "Standardize status updates, recurring reviews, and cross-functional product rituals.",
  },
  {
    scenario: "Operational Reviews",
    user: "Operations",
    outcome:
      "Standardize status updates, recurring reviews, and cross-functional product rituals. ",
  },
];

export const Schema = z.object({
  title: z.string().max(42).default("Use Cases").meta({
    description: "Main slide title.",
  }),
  subtitle: z
    .string()

    .max(140)
    .default(
      "Scenario cards show how different groups, workflows, or contexts connect to outcomes."
    )
    .meta({
      description: "Short supporting text below the title.",
    }),
  useCases: z
    .array(UseCaseSchema)

    .max(6)
    .default(DEFAULT_USE_CASES)
    .meta({
      description: "Scenario cards shown on the slide.",
    }),
});

export type SchemaType = z.infer<typeof Schema>;

const UseCasesSlide = ({ data }: { data: Partial<SchemaType> }) => {
  const title = data.title || "Use Cases";
  const titleFontSize = title.length > 34 ? 58 : title.length > 26 ? 64 : 72;
  const subtitle =
    data.subtitle ||
    "Scenario cards show how different groups, workflows, or contexts connect to outcomes.";

  return (
    <>
      <link
        href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,200..800&display=swap"
        rel="stylesheet"
      />
      <div
        className="relative h-[720px] w-[1280px] overflow-hidden px-[56px] py-[46px]"
        style={{
          backgroundColor: "var(--background-color,#DAE1DE)",
          fontFamily: "var(--body-font-family,'Bricolage Grotesque')",
        }}
      >
        <div className="grid grid-cols-[395px_1fr] gap-[34px]">
          <div className="min-w-0">
            <h2
              className="font-semibold leading-[1.02]"
              style={{
                color: "var(--primary-color,#15342D)",
                fontSize: `${titleFontSize}px`,
                letterSpacing: 0,
              }}
            >
              {title}
            </h2>
            <p
              className="mt-[18px] overflow-hidden text-[22px] leading-[1.26]"
              style={{
                color: "var(--background-text,#15342DCC)",
              }}
            >
              {subtitle}
            </p>
            <div
              className="mt-[32px] h-[220px] rounded-[28px]"
              style={{ backgroundColor: "var(--primary-color,#15342D)" }}
            />
          </div>

          <div className="grid auto-rows-fr grid-cols-2 gap-[16px]">
            {data.useCases &&
              data.useCases.map((useCase, index) => (
                <div
                  key={`${useCase.scenario}-${index}`}
                  className="flex min-h-0 min-w-0 flex-col rounded-[20px] border p-[20px]"
                  style={{
                    backgroundColor:
                      index === 0
                        ? "var(--primary-color,#15342D)"
                        : "var(--card-color,#ffffff)",
                    borderColor: "var(--stroke,#c5cccb)",
                    color:
                      index === 0
                        ? "var(--primary-text,#edf2f1)"
                        : "var(--primary-color,#15342D)",
                  }}
                >
                  <div className="flex items-center justify-between gap-[16px]">
                    <p className="text-[15px] font-semibold uppercase tracking-[0.1em] opacity-75">
                      {useCase.user}
                    </p>
                    <span className="shrink-0 text-[18px] font-semibold">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                  </div>
                  <h3
                    className="mt-[18px] overflow-hidden text-[28px] font-semibold leading-[1.04]"
                    style={{}}
                  >
                    {useCase.scenario}
                  </h3>
                  <p
                    className="mt-[14px] overflow-hidden text-[17px] leading-[1.18] opacity-90"
                    style={{}}
                  >
                    {useCase.outcome}
                  </p>
                </div>
              ))}
          </div>
        </div>
      </div>
    </>
  );
};

export default UseCasesSlide;
