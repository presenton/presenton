import * as z from "zod";

export const slideLayoutId = "timeline-slide";
export const slideLayoutName = "Timeline Slide";
export const slideLayoutDescription =
  "A slide with a title, a horizontal progress line, and short heading and description pairs.";

const MilestoneSchema = z.object({
  heading: z.string().max(6).meta({
    description: "Heading displayed under each timeline marker.",
  }),
  description: z.string().max(50).meta({
    description: "Short text shown under each heading. with max 50 characters",
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
      { heading: "2022", description: "Lorem ipsum dolor sit amet, consectetur adipiscing elit." },
      { heading: "1994", description: "Lorem ipsum dolor sit amet, consectetur adipiscing elit." },
      { heading: "1993", description: "Lorem ipsum dolor sit amet, consectetur adipiscing elit." },
      { heading: "1991", description: "Lorem ipsum dolor sit amet, consectetur adipiscing elit." },
      { heading: "1991", description: "Lorem ipsum dolor sit amet, consectetur adipiscing elit." },
      { heading: "1988", description: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. " },
      { heading: "1988", description: "Lorem ipsum dolor sit amet, consectetur adipiscing elit." },
      { heading: "1988", description: "Lorem ipsum dolor sit amet, consectetur adipiscing elit." },
    ])
    .meta({
      description: "Timeline milestones displayed left to right.",
    }),
});

export type SchemaType = z.infer<typeof Schema>;

const EducationTimelineSlide = ({ data }: { data: Partial<SchemaType> }) => {

  const { title, milestones } = data;

  const isSixOrLess = milestones?.length && milestones?.length <= 6;

  return (
    <>

      <link href="https://fonts.googleapis.com/css2?family=Source+Serif+4:ital,opsz,wght@0,8..60,200..900;1,8..60,200..900&display=swap" rel="stylesheet" />
      <div
        className="relative h-[720px] w-[1280px] overflow-hidden flex flex-col"
        style={{
          backgroundColor: "var(--background-color,#efeff1)",
          fontFamily: "var(--body-font-family,'Source Serif 4')",
        }}
      >
        <div className="relative z-10 px-[56px] pt-[86px]">
          <h2 className="font-serif text-[84px] leading-none tracking-[-0.02em]" style={{ color: "var(--primary-color,#1a1752)" }}>
            {title}
          </h2>
        </div>

        {isSixOrLess ? (
          <TimelineUpToSix milestones={milestones || []} />
        ) : (
          <TimelineMoreThanSix milestones={milestones || []} />
        )}
      </div>
    </>
  );
};

function TimelineUpToSix({
  milestones,
}: {
  milestones: any;
}) {


  return (

    <div className="relative z-10 mt-[160px] px-[56px]">
      <div
        className="grid "
        style={{ gridTemplateColumns: `repeat(${milestones.length}, minmax(0, 1fr))` }}
      >
        {milestones.map((milestone: any, index: number) => (
          <div key={`${milestone.heading}-${index}`} className="">
            <div className="flex items-center ">

              <div className="h-[22px] z-10 relative w-[22px] rounded-full" style={{ backgroundColor: "var(--primary-color,#272272)" }} />
              {index !== milestones.length - 1 && <div className="h-[3px] flex-1" style={{ backgroundColor: "var(--stroke,#d8d8dd)" }} />}
            </div>
            <p className="mt-[18px] text-[20px] font-medium leading-none" style={{ color: "var(--background-text,#3c3f4b)" }}>
              {milestone.heading}
            </p>
            <p className=" text-[18px] leading-[1.2]" style={{ color: "var(--background-text,#3a3d4c)" }}>
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

  return (
    <div className="relative z-10 mt-[84px] px-[56px]">
      {/* vertical connector on left */}
      <svg className="absolute z-[-1] right-[100px] top-[10px]" xmlns="http://www.w3.org/2000/svg" width="139" height="231" viewBox="0 0 139 231" fill="none">
        <mask id="path-1-inside-1_220_636" fill="white">
          <path d="M0 0H128C133.891 0 138.667 4.77563 138.667 10.6667V220C138.667 225.891 133.891 230.667 128 230.667H0V0Z" />
        </mask>
        <path d="M0 -2.66667H128C135.364 -2.66667 141.333 3.30287 141.333 10.6667H136C136 6.24839 132.418 2.66667 128 2.66667H0V-2.66667ZM141.333 220C141.333 227.364 135.364 233.333 128 233.333H0V228H128C132.418 228 136 224.418 136 220H141.333ZM136 220M0 230.667V0V230.667M128 -2.66667C135.364 -2.66667 141.333 3.30287 141.333 10.6667V220C141.333 227.364 135.364 233.333 128 233.333V228C132.418 228 136 224.418 136 220V10.6667C136 6.24839 132.418 2.66667 128 2.66667V-2.66667Z" fill="var(--primary-color,#101C3D)" fillOpacity="0.1" mask="url(#path-1-inside-1_220_636)" />
      </svg>
      {/* bottom horizontal line */}
      {/* <div className="absolute z-[-1]  right-[110px] top-[220px] w-[150px] h-[3px]" style={{ backgroundColor: "var(--stroke,#d8d8dd)" }} /> */}
      <div className="relative z-10  px-[56px]">
        <div
          className="grid "
          style={{ gridTemplateColumns: `repeat(${topItems.length}, minmax(0, 1fr))` }}
        >
          {topItems.map((milestone: any, index: number) => (
            <div key={`${milestone.heading}-${index}`} className="">
              <div className="flex items-center ">

                <div className="h-[22px] z-10 relative w-[22px] rounded-full" style={{ backgroundColor: "var(--primary-color,#272272)" }} />
                {index !== milestones.length - 1 && <div className="h-[3px] flex-1" style={{ backgroundColor: "var(--stroke,#d8d8dd)" }} />}
              </div>
              <div className="pr-2 mt-[18px]">

                <p className=" text-[20px] font-medium leading-none" style={{ color: "var(--background-text,#3c3f4b)" }}>
                  {milestone.heading}
                </p>
                <p className="mt-2 text-[18px] leading-[1.2]" style={{ color: "var(--background-text,#3a3d4c)" }}>
                  {milestone.description}
                </p>
              </div>
            </div>
          ))}
        </div>

      </div>

      {/* bottom row */}
      <div
        className="mt-[95px] grid items-end px-[56px] pr-[180px] "

        style={{ gridTemplateColumns: `repeat(${bottomItems.length}, minmax(0, 1fr))` }}
      >
        {bottomItems.map((_, colIndex) => {
          const item = bottomItems[colIndex];
          if (!item) return <div key={colIndex} />;

          return (
            <div key={`${item.heading}-${colIndex + 8}`} className="flex flex-col items-end">
              <div className="flex w-full items-center ">
                {/* {colIndex === 0 && <div className="absolute h-[3px] flex-1" style={{ backgroundColor: "var(--stroke,#d8d8dd)" }} />} */}
                <div className="h-[3px] flex-1" style={{ backgroundColor: colIndex === 0 ? "transparent" : "var(--stroke,#d8d8dd)" }} />
                <div className="h-[22px] z-10 relative w-[22px] rounded-full" style={{ backgroundColor: "var(--primary-color,#272272)" }} />
              </div>
              <div className="pl-2 mt-[18px]">

                <p className=" text-right text-[20px] font-medium leading-none" style={{ color: "var(--background-text,#3c3f4b)" }}>
                  {item.heading}
                </p>
                <p className="mt-2 text-[18px] text-right leading-[1.2]" style={{ color: "var(--background-text,#3a3d4c)" }}>
                  {item.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default EducationTimelineSlide;
