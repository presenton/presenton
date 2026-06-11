import * as z from "zod";

export const slideLayoutId = "segment-cards-slide";
export const slideLayoutName = "Segment Cards Slide";
export const slideLayoutDescription =
  "A title and subtitle layout with segment cards containing profile, need, and priority text.";

const SegmentSchema = z.object({
  name: z.string().max(28).meta({
    description: "Segment or group name.",
  }),
  profile: z.string().max(60).meta({
    description: "Short profile text for this card.",
  }),
  painPoint: z.string().max(60).meta({
    description: "Main need, challenge, or context for this card.",
  }),
  priority: z.string().max(20).meta({
    description: "Short priority or emphasis label for this card.",
  }),
});

const DEFAULT_SEGMENTS = [
  {
    name: "Product Leaders",
    profile: "Own roadmap quality, launch confidence, and executive reporting.",
    painPoint:
      "Need a trusted view of priorities, dependencies, and delivery risk.",
    priority: "Roadmap clarity",
  },
  // {
  //   name: "Startup Teams",
  //   profile:
  //     "Move quickly with small teams, fast feedback, and limited process.",
  //   painPoint:
  //     "Need lightweight structure without slowing down product iteration.",
  //   priority: "Speed to launch",
  // },
  // {
  //   name: "Operations Teams",
  //   profile:
  //     "Coordinate handoffs, data quality, status updates, and workflows.",
  //   painPoint:
  //     "Need fewer manual updates and fewer disconnected status meetings.",
  //   priority: "Workflow control",
  // },
  // {
  //   name: "Customer Success",
  //   profile: "Collect feedback, requests, objections, and expansion signals.",
  //   painPoint:
  //     "Need customer voice to influence product planning consistently.",
  //   priority: "Customer insight",
  // },
];

export const Schema = z.object({
  title: z.string().max(42).default("Key Segments").meta({
    description: "Main slide title.",
  }),
  subtitle: z
    .string()

    .max(140)
    .default(
      "Need a trusted view of priorities, dependencies, and delivery risk.A grouped view of important segments, their context, needs, and priorities."
    )
    .meta({
      description: "Short supporting text below the title.",
    }),
  segments: z
    .array(SegmentSchema)

    .max(4)
    .default(DEFAULT_SEGMENTS)
    .meta({
      description: "Segment cards shown in the main grid.",
    }),
});

export type SchemaType = z.infer<typeof Schema>;

const TargetAudienceSlide = ({ data }: { data: Partial<SchemaType> }) => {
  const segments = data.segments?.length
    ? data.segments.slice(0, 4)
    : DEFAULT_SEGMENTS;
  const title = data.title || "Key Segments";
  const titleFontSize = title.length > 34 ? 58 : title.length > 26 ? 64 : 72;
  const subtitle =
    data.subtitle ||
    "A grouped view of important segments, their context, needs, and priorities.";

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

        <div
          className="mt-[32px] grid gap-[18px]"
          style={{
            gridTemplateColumns: `repeat(${segments.length}, minmax(0, 1fr))`,
          }}
        >
          {segments.map((segment, index) => (
            <div
              key={`${segment.name}-${index}`}
              className="flex  min-w-0 flex-col rounded-[22px] border p-[24px]"
              style={{
                backgroundColor: "var(--card-color,#ffffff)",
                borderColor: "var(--stroke,#c5cccb)",
                maxWidth: segments.length === 1 ? "500px" : "100%",
                margin: "0 auto",
              }}
            >
              <div
                className="flex h-[56px] w-[56px] items-center justify-center rounded-full text-[22px] font-semibold"
                style={{
                  backgroundColor:
                    index === 0
                      ? "var(--primary-color,#15342D)"
                      : "var(--background-color,#DAE1DE)",
                  color:
                    index === 0
                      ? "var(--primary-text,#edf2f1)"
                      : "var(--primary-color,#15342D)",
                }}
              >
                {String(index + 1).padStart(2, "0")}
              </div>
              <h3
                className="mt-[24px] overflow-hidden text-[30px] font-semibold leading-[1.04]"
                style={{
                  color: "var(--primary-color,#15342D)",
                }}
              >
                {segment.name}
              </h3>
              <p
                className="mt-[14px] overflow-hidden text-[18px] leading-[1.18]"
                style={{
                  color: "var(--background-text,#15342DCC)",
                }}
              >
                {segment.profile}
              </p>
              <div
                className="mt-[20px] h-px w-full"
                style={{ backgroundColor: "var(--stroke,#c5cccb)" }}
              />
              <p
                className="mt-[18px] overflow-hidden text-[17px] leading-[1.18]"
                style={{
                  color: "var(--background-text,#15342DCC)",
                }}
              >
                {segment.painPoint}
              </p>
              <p
                className=" text-center mt-4 w-fit rounded-full px-[14px] py-[8px] text-[14px] font-semibold uppercase tracking-[0.08em]"
                style={{
                  backgroundColor: "var(--primary-color,#15342D)",
                  color: "var(--primary-text,#edf2f1)",
                }}
              >
                {segment.priority}
              </p>
            </div>
          ))}
        </div>
      </div>
    </>
  );
};

export default TargetAudienceSlide;
