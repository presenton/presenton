import * as z from "zod";

const MilestoneItemSchema = z.object({
  bulletNumber: z.string().min(2).max(4).meta({
    description: "Short milestone number such as 01 or 05.",
  }),
  heading: z.string().min(3).max(30).meta({
    description: "Heading displayed below the milestone marker.",
  }),
  description: z.string().min(10).max(80).meta({
    description: "Supporting milestone description shown under the heading. with max 80 characters",
  }),
});

export const slideLayoutId = "milestone-slide";
export const slideLayoutName = "Milestone Slide";
export const slideLayoutDescription =
  "A slide with a title at the top and a single horizontal milestone sequence below it. The sequence contains five circular markers aligned in one row, and each marker has a heading and description placed directly underneath. The activeIndex field controls which marker is emphasized while the remaining markers stay in the default state.";

export const Schema = z.object({
  title: z.string().min(3).max(12).default("Milestone").meta({
    description: "Slide title shown at the top-left.",
  }),
  activeIndex: z.number().int().min(0).max(4).default(4).meta({
    description: "Zero-based index of the highlighted milestone.",
  }),
  items: z
    .array(MilestoneItemSchema)
    .min(1)
    .max(5)
    .default([
      {
        bulletNumber: "01",
        heading: "Heading",
        description: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Lorem ipsum dolor sit amet,",
      },
      {
        bulletNumber: "02",
        heading: "Heading",
        description: "Lorem ipsum dolor sit amet,  Lorem ipsum dolor sit amet,",
      },
      {
        bulletNumber: "03",
        heading: "Heading",
        description: "Lorem ipsum dolor sit amet. Lorem ipsum dolor sit amet, Lorem ipsum dolor sit amet",
      },
      {
        bulletNumber: "04",
        heading: "Heading",
        description: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Lorem ipsum dolor sit amet,",
      },
      {
        bulletNumber: "05",
        heading: "Heading",
        description: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Lorem ipsum dolor sit amet,",
      },
    ])
    .meta({
      description: "Bullet with title and description.",
    }),
});

export type SchemaType = z.infer<typeof Schema>;

const MilestoneSlide = ({ data }: { data: Partial<SchemaType> }) => {
  const { title, activeIndex, items } = data;

  return (
    <>
      <link href="https://fonts.googleapis.com/css2?family=Source+Sans+3:ital,wght@0,200..900;1,200..900&display=swap" rel="stylesheet" />
      <div
        className="relative h-[720px] w-[1280px] overflow-hidden rounded-[24px] bg-[#F9F8F8]"
        style={{
          backgroundColor: "var(--background-color,#F9F8F8)",
          fontFamily: "var(--body-font-family,'Source Sans 3')",
        }}
      >
        <div
          className="absolute left-0 top-0 w-[42px] rounded-b-[22px] bg-[#157CFF]"
          style={{ height: 185, backgroundColor: "var(--primary-color,#157CFF)" }}
        />

        <div className="px-[70px] pt-[56px]">
          <h2
            className="text-[80px] font-bold leading-[108.4%] tracking-[-2.419px] text-[#232223]"
            style={{ color: "var(--background-text,#232223)" }}
          >
            {title}
          </h2>
        </div>

        <div className="mt-[52px] pl-[74px] pr-[63px]">
          <div className="flex items-center justify-center">
            {items?.map((item, index) => {
              const isActive = index === activeIndex;

              return (
                <div className=" " key={`${item.bulletNumber}-${index}`}>

                  <div
                    className={`relative flex h-[270px]   w-[270px] items-center justify-center rounded-full ${isActive
                      ? "z-10 bg-[#157CFF] text-white"
                      : "border border-[#157CFF] bg-white text-[#157CFE]"
                      } ${index > 0 ? "ml-[-45px]" : ""} `}
                    style={{
                      backgroundColor: isActive ? "var(--primary-color,#157CFF)" : "var(--card-color,#ffffff)",
                      borderColor: "var(--primary-color,#157CFF)",
                      color: isActive ? "var(--primary-text,#ffffff)" : "var(--primary-color,#157CFE)",
                    }}
                  >
                    <span
                      className={`${isActive ? "text-white" : "text-[#157CFF]"} text-[42px] font-medium tracking-[0.18em]`}
                      style={{ color: isActive ? "var(--primary-text,#ffffff)" : "var(--primary-color,#157CFF)" }}
                    >
                      {item.bulletNumber}
                    </span>

                  </div>
                  <div
                    key={`${item.heading}-${index}`}
                    className={`text-center  h-[130px]  mt-[20px] text-[#232223] ${index > 0 ? 'pr-[33px]' : ''} ${index === 0 ? 'px-[33px]' : ''}`}
                    style={{ color: "var(--background-text,#232223)" }}
                  >
                    <h3 className="text-[20px] text-[#232223] font-medium tracking-[2.074px]" style={{ color: "var(--background-text,#232223)" }}>
                      {item.heading}
                    </h3>
                    <p className="mt-[6px] text-[24px] leading-[26.667px]  text-[#232223]" style={{ color: "var(--background-text,#232223)" }}>
                      {item.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
};

export default MilestoneSlide;
