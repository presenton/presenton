import * as z from "zod";

export const slideLayoutId = "two-panel-contrast-metrics-slide";
export const slideLayoutName = "Two Panel Contrast with Metrics Slide";
export const slideLayoutDescription =
  "A title and subtitle layout with contrasting content panels and a row of bottom metrics.";

const PointSchema = z.string().min(8).max(70).meta({
  description: "Short supporting point shown inside a panel.",
});

const PanelSchema = z.object({
  eyebrow: z.string().min(4).max(18).meta({
    description: "Small label shown above the panel title.",
  }),
  title: z.string().min(6).max(36).meta({
    description: "Panel heading.",
  }),
  description: z.string().min(30).max(150).meta({
    description: "Short paragraph explaining the panel subject.",
  }),
  points: z.array(PointSchema).min(2).max(4).meta({
    description: "Concise supporting points for this panel.",
  }),
});

const MetricSchema = z.object({
  value: z.string().min(2).max(12).meta({
    description: "Short impact metric value.",
  }),
  label: z.string().min(6).max(42).meta({
    description: "Short label explaining the metric.",
  }),
});

const DEFAULT_PROBLEM = {
  eyebrow: "Problem",
  title: "Teams lose time in scattered workflows",
  description:
    "Critical product work is delayed when customer data, planning, and execution live across disconnected tools.",
  points: [
    "Manual handoffs slow decisions",
    "Context is hard to find",
    "Leaders lack a single product view",
  ],
};

const DEFAULT_SOLUTION = {
  eyebrow: "Solution",
  title: "One workspace for product execution",
  description:
    "The product brings planning, customer signals, priorities, and launch tracking into one focused operating layer.",
  points: [
    "Unified product context",
    "Clear ownership and progress",
    "Faster launch decisions",
  ],
};

const DEFAULT_METRICS = [
  { value: "40%", label: "Less reporting overhead" },
  { value: "2.5x", label: "Faster priority reviews" },
  { value: "18 hrs", label: "Saved per launch cycle" },
];

export const Schema = z.object({
  title: z.string().min(6).max(42).default("Problem and Solution").meta({
    description: "Main slide title.",
  }),
  subtitle: z
    .string()
    .min(20)
    .max(140)
    .default(
      "A direct view of the customer pain point and how the product creates a clearer operating model."
    )
    .meta({
      description: "Short supporting text below the title.",
    }),
  problem: PanelSchema.default(DEFAULT_PROBLEM).meta({
    description: "Left content panel.",
  }),
  solution: PanelSchema.default(DEFAULT_SOLUTION).meta({
    description: "Right content panel.",
  }),
  metrics: z.array(MetricSchema).min(2).max(3).default(DEFAULT_METRICS).meta({
    description: "Bottom metrics shown below the contrast panels.",
  }),
});

export type SchemaType = z.infer<typeof Schema>;

function normalizePanel(
  panel: Partial<SchemaType["problem"]> | undefined,
  fallback: SchemaType["problem"]
) {
  return {
    ...fallback,
    ...(panel || {}),
    points: panel?.points?.length ? panel.points.slice(0, 4) : fallback.points,
  };
}

const ProblemSolutionSlide = ({ data }: { data: Partial<SchemaType> }) => {
  const problem = normalizePanel(data.problem, DEFAULT_PROBLEM);
  const solution = normalizePanel(data.solution, DEFAULT_SOLUTION);
  const metrics = data.metrics?.length ? data.metrics.slice(0, 3) : DEFAULT_METRICS;
  const title = data.title || "Problem and Solution";
  const titleFontSize = title.length > 34 ? 58 : title.length > 26 ? 64 : 72;
  const subtitle =
    data.subtitle ||
    "A direct view of the customer pain point and how the product creates a clearer operating model.";
  const densePanels = [problem, solution].some(
    (panel) =>
      panel.title.length > 30 ||
      panel.description.length > 105 ||
      panel.points.length > 3 ||
      panel.points.some((point) => point.length > 42)
  );

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
          className="max-w-[1120px] font-semibold leading-[1.02]"
          style={{
            color: "var(--primary-color,#15342D)",
            fontSize: `${titleFontSize}px`,
            letterSpacing: 0,
          }}
        >
          {title}
        </h2>
        <p
          className="mt-[14px] max-w-[860px] overflow-hidden text-[22px] leading-[1.26]"
          style={{
            color: "var(--background-text,#15342DCC)",
          }}
        >
          {subtitle}
        </p>

        <div className="mt-[24px] grid grid-cols-2 gap-[24px]">
          {[problem, solution].map((panel, index) => {
            const active = index === 1;
            const compact =
              densePanels ||
              panel.title.length > 30 ||
              panel.description.length > 105 ||
              panel.points.length > 3;
            const panelTitleSize = compact ? 30 : 32;
            const panelDescriptionSize = compact ? 18 : 19;
            const pointSize = compact ? 16 : 17;
            return (
              <div
                key={`${panel.eyebrow}-${panel.title}`}
                className="flex h-[338px] min-w-0 flex-col overflow-hidden rounded-[22px] border p-[24px]"
                style={{
                  backgroundColor: active
                    ? "var(--primary-color,#15342D)"
                    : "var(--card-color,#ffffff)",
                  borderColor: "var(--stroke,#c5cccb)",
                  color: active
                    ? "var(--primary-text,#edf2f1)"
                    : "var(--primary-color,#15342D)",
                }}
              >
                <p className="text-[15px] font-semibold uppercase tracking-[0.12em] opacity-80">
                  {panel.eyebrow}
                </p>
                <h3
                  className="mt-[14px] overflow-hidden font-semibold leading-[1.04]"
                  style={{
                    fontSize: `${panelTitleSize}px`,
                  }}
                >
                  {panel.title}
                </h3>
                <p
                  className="mt-[12px] overflow-hidden leading-[1.14] opacity-90"
                  style={{
                    fontSize: `${panelDescriptionSize}px`,
                  }}
                >
                  {panel.description}
                </p>
                <div className="mt-[14px] flex min-h-0 flex-1 flex-col justify-end gap-[8px] overflow-hidden">
                  {panel.points.map((point, pointIndex) => (
                    <div key={`${point}-${pointIndex}`} className="flex min-w-0 items-start gap-[10px]">
                      <span
                        className="mt-[6px] h-[7px] w-[7px] shrink-0 rounded-full"
                        style={{
                          backgroundColor: active
                            ? "var(--primary-text,#edf2f1)"
                            : "var(--primary-color,#15342D)",
                        }}
                      />
                      <p
                        className="overflow-hidden leading-[1.14]"
                        style={{
                          fontSize: `${pointSize}px`,
                        }}
                      >
                        {point}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-[16px] grid grid-cols-3 gap-[18px]">
          {metrics.map((metric, index) => (
            <div
              key={`${metric.value}-${index}`}
              className="min-w-0 rounded-[18px] border px-[24px] py-[16px]"
              style={{
                backgroundColor: "var(--card-color,#ffffff)",
                borderColor: "var(--stroke,#c5cccb)",
              }}
            >
              <p
                className="text-[32px] font-semibold leading-none"
                style={{ color: "var(--primary-color,#15342D)" }}
              >
                {metric.value}
              </p>
              <p
                className="mt-[8px] overflow-hidden text-[17px] leading-[1.16]"
                style={{
                  color: "var(--background-text,#15342DCC)",
                }}
              >
                {metric.label}
              </p>
            </div>
          ))}
        </div>
      </div>
    </>
  );
};

export default ProblemSolutionSlide;
