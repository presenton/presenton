import * as z from "zod";

export const slideLayoutId = "card-grid-with-labels-slide";
export const slideLayoutName = "Card Grid with Labels Slide";
export const slideLayoutDescription =
  "A title and subtitle layout with cards containing a heading, body text, and compact label.";

const FeatureSchema = z.object({
  name: z.string().max(30).meta({
    description: "Card heading.",
  }),
  description: z.string().max(100).meta({
    description: "Short body text shown inside the card.",
  }),
  benefit: z.string().max(42).meta({
    description: "Compact label shown at the bottom of the card.",
  }),
});

const DEFAULT_FEATURES = [
  {
    name: "Unified Workspace",
    description:
      "Bring planning, customer signals, and launch tasks into one shared product view. ring planning, customer signals, and launch tasks into one shared product view.",
    benefit: "Less context switching Less context switching",
  },
  {
    name: "Priority Engine",
    description:
      "Bring planning, customer signals, and launch tasks into one shared product view. ring planning, customer signals, and launch tasks into one shared product view.",
    benefit: "Clearer decisions",
  },
  {
    name: "Launch Tracker",
    description:
      "Bring planning, customer signals, and launch tasks into one shared product view. ring planning, customer signals, and launch tasks into one shared product view.",
    benefit: "Fewer missed steps",
  },
  {
    name: "Customer Signals",
    description:
      "Connect feedback, requests, and usage trends to roadmap planning.",
    benefit: "Better product bets",
  },
  {
    name: "Executive Reports",
    description:
      "Create concise product updates without rebuilding slides or spreadsheets.",
    benefit: "Faster reporting",
  },
  {
    name: "Workflow Automation",
    description:
      "Bring planning, customer signals, and launch tasks into one shared product view. ring planning, customer signals, and launch tasks into one shared product view.",
    benefit: "Cleaner operations Less context switching",
  },
];

export const Schema = z.object({
  title: z.string().max(42).default("Highlights Highlights Highlights").meta({
    description: "Main slide title.",
  }),
  subtitle: z
    .string()

    .max(140)
    .default(
      "A concise view of the main items, what each one does, and the value each one adds.Bring planning, customer signals, and launch tasks into one shared product view. ring planning, customer signals, and launch tasks into one shared product view."
    )
    .meta({
      description: "Short supporting text below the title.",
    }),
  features: z
    .array(FeatureSchema)

    .max(6)
    .default(DEFAULT_FEATURES)
    .meta({
      description: "Cards shown in the main grid.",
    }),
});

export type SchemaType = z.infer<typeof Schema>;

const FeatureHighlightsSlide = ({ data }: { data: Partial<SchemaType> }) => {
  const features = data.features?.length
    ? data.features.slice(0, 6)
    : DEFAULT_FEATURES;
  const columns = features.length <= 4 ? 2 : 3;
  const compact = columns === 3;
  const dense =
    compact ||
    features.some(
      (feature) =>
        feature.name.length > 24 ||
        feature.description.length > 72 ||
        feature.benefit.length > 28
    );
  const cardPadding = compact ? 20 : 22;
  const headingSize = dense ? 24 : 26;
  const bodySize = dense ? 16 : 17;
  const benefitSize = dense ? 12 : 14;
  const title = data.title || "Highlights";
  const titleFontSize = title.length > 34 ? 58 : title.length > 26 ? 64 : 72;
  const subtitle =
    data.subtitle ||
    "A concise view of the main items, what each one does, and the value each one adds.";

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
        <div className="flex items-end justify-between gap-[40px]">
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
              className="mt-[14px] max-w-[900px] overflow-hidden text-[22px] leading-[1.26]"
              style={{
                color: "var(--background-text,#15342DCC)",
              }}
            >
              {subtitle}
            </p>
          </div>
        </div>

        <div
          className="mt-[28px] grid gap-[18px]"
          style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
        >
          {features.map((feature, index) => (
            <div
              key={`${feature.name}-${index}`}
              className="flex min-w-0 flex-col overflow-hidden rounded-[20px] border"
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

                padding: `${cardPadding}px`,
              }}
            >
              <div className="flex items-start gap-[14px]">
                <span
                  className="flex h-[32px] w-[32px] shrink-0 items-center justify-center rounded-full text-[15px] font-semibold"
                  style={{
                    backgroundColor:
                      index === 0
                        ? "var(--primary-text,#edf2f1)"
                        : "var(--background-color,#DAE1DE)",
                    color:
                      index === 0
                        ? "var(--primary-color,#15342D)"
                        : "var(--primary-color,#15342D)",
                  }}
                >
                  {String(index + 1).padStart(2, "0")}
                </span>
                <h3
                  className="min-w-0 overflow-hidden font-semibold leading-[1.04]"
                  style={{
                    fontSize: `${headingSize}px`,
                  }}
                >
                  {feature.name}
                </h3>
              </div>
              <p
                className="mt-[12px] min-h-0 overflow-hidden leading-[1.14] opacity-90"
                style={{
                  fontSize: `${bodySize}px`,
                }}
              >
                {feature.description}
              </p>
              <p
                className="mt-4 shrink-0 overflow-hidden pt-[8px] font-semibold uppercase leading-[1.1] opacity-80"
                style={{
                  fontSize: `${benefitSize}px`,
                  letterSpacing: "0.14em",
                }}
              >
                {feature.benefit}
              </p>
            </div>
          ))}
        </div>
      </div>
    </>
  );
};

export default FeatureHighlightsSlide;
