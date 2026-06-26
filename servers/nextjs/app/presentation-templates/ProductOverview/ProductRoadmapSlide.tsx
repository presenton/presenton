import * as z from "zod";

export const slideLayoutId = "phase-timeline-cards-slide";
export const slideLayoutName = "Phase Timeline Cards Slide";
export const slideLayoutDescription =
  "A title and subtitle layout with a horizontal sequence of phase cards connected by a timeline line.";

const RoadmapPhaseSchema = z.object({
  period: z.string().min(3).max(16).meta({
    description: "Short phase or period label.",
  }),
  title: z.string().min(4).max(28).meta({
    description: "Short phase title.",
  }),
  description: z.string().min(24).max(96).meta({
    description: "Short explanation of what happens during this phase.",
  }),
  deliverables: z.array(z.string().min(4).max(34).meta({
    description: "Short item included in this phase.",
  })).min(2).max(4).meta({
    description: "Items shown under the phase description.",
  }),
});

const DEFAULT_PHASES = [
  {
    period: "Q1",
    title: "Foundation",
    description: "Launch the core product workspace, account setup, and first planning workflows.",
    deliverables: ["Workspace setup", "Priority model", "Pilot onboarding"],
  },
  {
    period: "Q2",
    title: "Workflow Depth",
    description: "Add deeper team workflows, approvals, automation, and richer launch tracking.",
    deliverables: ["Automations", "Launch tracker", "Role permissions"],
  },
  {
    period: "Q3",
    title: "Insights Layer",
    description: "Connect customer signals, usage trends, and roadmap health into reporting views.",
    deliverables: ["Signal hub", "Executive reports", "Health metrics"],
  },
  {
    period: "Q4",
    title: "Scale",
    description: "Improve enterprise readiness with integrations, governance, and adoption tooling.",
    deliverables: ["Integrations", "Governance", "Adoption analytics"],
  },
];

export const Schema = z.object({
  title: z.string().min(6).max(42).default("Roadmap").meta({
    description: "Main slide title.",
  }),
  subtitle: z
    .string()
    .min(20)
    .max(140)
    .default(
      "A staged view of how work progresses across phases, periods, or milestones."
    )
    .meta({
      description: "Short supporting text below the title.",
    }),
  phases: z.array(RoadmapPhaseSchema).min(3).max(5).default(DEFAULT_PHASES).meta({
    description: "Phase cards shown from left to right.",
  }),
});

export type SchemaType = z.infer<typeof Schema>;

const ProductRoadmapSlide = ({ data }: { data: Partial<SchemaType> }) => {
  const phases = data.phases?.length ? data.phases.slice(0, 5) : DEFAULT_PHASES;
  const compact = phases.length >= 5;
  const title = data.title || "Roadmap";
  const titleFontSize = title.length > 34 ? 58 : title.length > 26 ? 64 : 72;
  const subtitle =
    data.subtitle ||
    "A staged view of how work progresses across phases, periods, or milestones.";

  return (
    <>
      <link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,200..800&display=swap" rel="stylesheet" />
      <div
        className="relative h-[720px] w-[1280px] overflow-hidden px-[56px] py-[46px]"
        style={{
          backgroundColor: "var(--background-color,#DAE1DE)",
          fontFamily: "var(--body-font-family,'Bricolage Grotesque')",
        }}
      >
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
          className="mt-[14px] max-w-[890px] overflow-hidden text-[22px] leading-[1.26]"
          style={{
            color: "var(--background-text,#15342DCC)",
          }}
        >
          {subtitle}
        </p>

        <div className="relative mt-[54px]">
          <div
            className="absolute left-[40px] right-[40px] top-[24px] h-[3px]"
            style={{ backgroundColor: "var(--stroke,#aab7b5)" }}
          />
          <div
            className="grid gap-[14px]"
            style={{ gridTemplateColumns: `repeat(${phases.length}, minmax(0, 1fr))` }}
          >
            {phases.map((phase, index) => (
              <div key={`${phase.period}-${phase.title}-${index}`} className="relative min-w-0 pt-[58px]">
                <div
                  className="absolute left-[18px] top-[0px] z-10 flex h-[52px] w-[52px] items-center justify-center rounded-full text-[17px] font-semibold"
                  style={{
                    backgroundColor:
                      index === 0 ? "var(--primary-color,#15342D)" : "var(--card-color,#ffffff)",
                    border: "2px solid var(--primary-color,#15342D)",
                    color:
                      index === 0 ? "var(--primary-text,#edf2f1)" : "var(--primary-color,#15342D)",
                  }}
                >
                  {phase.period}
                </div>
                <div
                  className="flex h-[332px] min-w-0 flex-col rounded-[20px] border p-[20px]"
                  style={{
                    backgroundColor:
                      index === 0 ? "var(--primary-color,#15342D)" : "var(--card-color,#ffffff)",
                    borderColor: "var(--stroke,#c5cccb)",
                    color:
                      index === 0 ? "var(--primary-text,#edf2f1)" : "var(--primary-color,#15342D)",
                  }}
                >
                  <h3
                    className="overflow-hidden font-semibold leading-[1.04]"
                    style={{
                      fontSize: compact ? "24px" : "28px",
                    }}
                  >
                    {phase.title}
                  </h3>
                  <p
                    className="mt-[12px] overflow-hidden leading-[1.16] opacity-90"
                    style={{
                      fontSize: compact ? "15px" : "17px",
                    }}
                  >
                    {phase.description}
                  </p>
                  <div className="mt-auto grid gap-[8px]">
                    {phase.deliverables.slice(0, 4).map((deliverable, deliverableIndex) => (
                      <div key={`${deliverable}-${deliverableIndex}`} className="flex min-w-0 items-start gap-[8px]">
                        <span
                          className="mt-[7px] h-[7px] w-[7px] shrink-0 rounded-full"
                          style={{
                            backgroundColor:
                              index === 0
                                ? "var(--primary-text,#edf2f1)"
                                : "var(--primary-color,#15342D)",
                          }}
                        />
                        <p
                          className="overflow-hidden leading-[1.14]"
                          style={{
                            fontSize: compact ? "14px" : "16px",
                          }}
                        >
                          {deliverable}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
};

export default ProductRoadmapSlide;
