import * as z from "zod";

export const slideLayoutId = "timeline-slide";
export const slideLayoutName = "Timeline Slide";
export const slideLayoutDescription =
  "A slide with a title, a horizontal progress line, and short heading and description pairs.";

const MilestoneSchema = z.object({
  heading: z.string().max(6).meta({
    description: "Heading displayed under each timeline marker.",
  }),
  description: z.string().max(100).meta({
    description: "Short text shown under each heading. with max 100 characters",
  }),
});

export const Schema = z.object({
  title: z.string().min(4).max(14).default("Timeline").meta({
    description: "Main timeline heading shown at the top-left.",
  }),
  milestones: z
    .array(MilestoneSchema)
    .min(2)
    .max(12)
    .default([
      {
        heading: "2022",
        description:
          "Lorem ipsum dolor sit amet, consectetur adipiscing elit.Lorem ipsum dolor sit amet, consectetur adipiscing elit.",
      },
      {
        heading: "1994",
        description: "Lorem ipsum dolor sit amet, consectetur adipiscing elit.",
      },
      {
        heading: "1993",
        description:
          "Lorem ipsum dolor sit amet, consectetur adipiscing elit.Lorem ipsum dolor sit amet, consectetur adipiscing elit.",
      },
      {
        heading: "1991",
        description:
          "Lorem ipsum dolor sit amet, consectetur adipiscing elit.Lorem ipsum dolor sit amet, consectetur adipiscing elit.",
      },
      {
        heading: "1991",
        description:
          "Lorem ipsum dolor sit amet, consectetur adipiscing elit.Lorem ipsum dolor sit amet, consectetur adipiscing elit.",
      },
      {
        heading: "1988",
        description:
          "Lorem ipsum dolor sit amet, consectetur adipiscing elit.Lorem ipsum dolor sit amet, consectetur adipiscing elit. ",
      },
      {
        heading: "1988",
        description:
          "Lorem ipsum dolor sit amet, consectetur adipiscing elit.Lorem ipsum dolor sit amet, consectetur adipiscing elit.",
      },
      {
        heading: "1988",
        description: "Lorem ipsum dolor sit amet, consectetur adipiscing elit.",
      },
      {
        heading: "1988",
        description: "Lorem ipsum dolor sit amet, consectetur adipiscing elit.",
      },
      {
        heading: "1988",
        description:
          "Lorem ipsum dolor sit amet, consectetur adipiscing elit.Lorem ipsum dolor sit amet, consectetur adipiscing elit.",
      },
      {
        heading: "1988",
        description:
          "Lorem ipsum dolor sit amet, consectetur adipiscing elit.Lorem ipsum dolor sit amet, consectetur adipiscing elit.",
      },
    ])
    .meta({
      description: "Timeline milestones displayed left to right.",
    }),
});

export type SchemaType = z.infer<typeof Schema>;

const EducationTimelineSlide = ({ data }: { data: Partial<SchemaType> }) => {
  const { title, milestones } = data;
  const safeMilestones = milestones || [];
  const isSixOrLess = safeMilestones.length <= 6;

  return (
    <>
      <link
        href="https://fonts.googleapis.com/css2?family=Source+Serif+4:ital,opsz,wght@0,8..60,200..900;1,8..60,200..900&display=swap"
        rel="stylesheet"
      />
      <div
        className="relative flex h-[720px] w-[1280px] flex-col overflow-hidden"
        style={{
          backgroundColor: "var(--background-color,#efeff1)",
          fontFamily: "var(--body-font-family,'Source Serif 4')",
        }}
      >
        <div className="relative z-10 px-[56px] pt-[86px]">
          <h2
            className="font-serif text-[84px] leading-none tracking-[-0.02em]"
            style={{ color: "var(--primary-color,#1a1752)" }}
          >
            {title}
          </h2>
        </div>

        {isSixOrLess ? (
          <TimelineUpToSix milestones={safeMilestones} />
        ) : (
          <TimelineMoreThanSix milestones={safeMilestones} />
        )}
      </div>
    </>
  );
};

function TimelineUpToSix({
  milestones,
}: {
  milestones: SchemaType["milestones"];
}) {
  return (
    <div className="relative z-10 mt-[160px] px-[56px]">
      <div
        className="grid"
        style={{
          gridTemplateColumns: `repeat(${milestones.length}, minmax(0, 1fr))`,
        }}
      >
        {milestones.map((milestone, index) => (
          <div key={`${milestone.heading}-${index}`}>
            <div className="flex items-center">
              <div
                className="relative z-10 h-[22px] w-[22px] rounded-full"
                style={{ backgroundColor: "var(--primary-color,#272272)" }}
              />
              {index !== milestones.length - 1 && (
                <div
                  className="h-[3px] flex-1"
                  style={{ backgroundColor: "var(--stroke,#d8d8dd)" }}
                />
              )}
            </div>
            <p
              className="mt-[18px] text-[20px] font-medium leading-none"
              style={{ color: "var(--background-text,#3c3f4b)" }}
            >
              {milestone.heading}
            </p>
            <p
              className="text-[18px] leading-[1.2]"
              style={{ color: "var(--background-text,#3a3d4c)" }}
            >
              {milestone.description}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function TimelineMoreThanSix({
  milestones,
}: {
  milestones: SchemaType["milestones"];
}) {
  const topItems = milestones.slice(0, 6);
  const bottomItems = milestones.slice(6);
  const topConnectorOffset = 44;

  return (
    <div className="relative z-10 mt-[84px] h-[360px] px-[56px]">
      <div
        className="absolute right-[40px] top-[10px] z-[-1] h-[228px] w-[139px] rounded-r-[12px] border-y-[3px] border-r-[3px] border-l-0"
        style={{ borderColor: "var(--stroke,#d8d8dd)" }}
      />

      <div className="absolute left-0 right-0 top-0 z-10 px-[56px]">
        <div
          className="grid"
          style={{
            gridTemplateColumns: `repeat(${topItems.length}, minmax(0, 1fr))`,
          }}
        >
          {topItems.map((milestone, index) => (
            <div key={`${milestone.heading}-${index}`}>
              <div className="flex items-center">
                <div
                  className="relative z-10 h-[22px] w-[22px] rounded-full"
                  style={{ backgroundColor: "var(--primary-color,#272272)" }}
                />
                <div
                  className="h-[3px] flex-1"
                  style={{
                    backgroundColor: "var(--stroke,#d8d8dd)",
                    marginRight:
                      index === topItems.length - 1
                        ? `${topConnectorOffset}px`
                        : undefined,
                  }}
                />
              </div>
              <div className="mt-[18px] pr-2">
                <p
                  className="text-[20px] font-medium leading-none"
                  style={{ color: "var(--background-text,#3c3f4b)" }}
                >
                  {milestone.heading}
                </p>
                <p
                  className="mt-2 text-[18px] leading-[1.2]"
                  style={{ color: "var(--background-text,#3a3d4c)" }}
                >
                  {milestone.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div
        className="absolute left-0 right-0 top-[226px] grid px-[56px] pr-[180px]"
        style={{
          gridTemplateColumns: `repeat(${bottomItems.length}, minmax(0, 1fr))`,
        }}
      >
        {bottomItems.map((item, colIndex) => (
          <div
            key={`${item.heading}-${colIndex + 6}`}
            className="flex flex-col items-end"
          >
            <div className="flex w-full items-center">
              <div
                className="h-[3px] flex-1"
                style={{
                  backgroundColor:
                    colIndex === 0 ? "transparent" : "var(--stroke,#d8d8dd)",
                }}
              />
              <div
                className="relative z-10 h-[22px] w-[22px] rounded-full"
                style={{ backgroundColor: "var(--primary-color,#272272)" }}
              />
            </div>
            <div className="mt-[18px] pl-2">
              <p
                className="text-right text-[20px] font-medium leading-none"
                style={{ color: "var(--background-text,#3c3f4b)" }}
              >
                {item.heading}
              </p>
              <p
                className="mt-2 text-right text-[18px] leading-[1.2]"
                style={{ color: "var(--background-text,#3a3d4c)" }}
              >
                {item.description}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default EducationTimelineSlide;
