import { RemoteSvgIcon } from "@/app/hooks/useRemoteSvgIcon";
import * as z from "zod";


const AnalysisItemSchema = z.object({
  title: z.string().max(30).meta({
    description: "Short item title displayed next to the icon.",
  }),
  description: z.string().max(60).meta({
    description: "Supporting sentence shown below the title.",
  }),
});

export const slideLayoutId = "bullet-list-with-icon-title-description-slide";
export const slideLayoutName = "Bullet List with Icon Title Description Slide";
export const slideLayoutDescription =
  "A slide with a title at the top and a two-column list of bullets points underneath. Each point contains a small circular icon badge, a short title on the same row, and a supporting description directly below.";

export const Schema = z.object({
  title: z.string().min(3).max(12).default("Data Analysis").meta({
    description: "Slide title shown at the top-left.",
  }),
  itemIcon: z.object({
    __icon_url__: z.string().default("https://presenton-public.s3.ap-southeast-1.amazonaws.com/static/icons/placeholder.svg"),
    __icon_query__: z.string().default("pulse icon"),
  }).default({
    __icon_url__:
      "https://presenton-public.s3.ap-southeast-1.amazonaws.com/static/icons/placeholder.svg",
    __icon_query__: "pulse icon",
  }).meta({
    description: "Icon shown in each analysis list badge.",
  }),
  items: z
    .array(AnalysisItemSchema)

    .max(6)
    .default([
      { title: "Title 1 title 1 title 1 title 1 title 1", description: "Ut enim ad minima veniam, quis. Ut enim ad minima veniam, quis. Ut enim" },
      { title: "Title 3 title 3 title 3 title 3 title 3", description: "Ut enim ad minima veniam, quis. Ut enim ad minima veniam, quis. Ut enim " },
      { title: "Title 2 title 2 title 2 title 2 title 2", description: "Ut enim ad minima veniam, quis. Ut enim ad minima veniam, quis. Ut enim " },
      { title: "Title 4 title 4 title 4 title 4 title 4", description: "Ut enim ad minima veniam, quis. Ut enim ad minima veniam, quis. Ut enim " },
      { title: "Title 2 title 2 title 2 title 2 title 2", description: "Ut enim ad minima veniam, quis. Ut enim ad minima veniam, quis. Ut enim " },
      { title: "Title 5 title 5 title 5 title 5 title 5", description: "Ut enim ad minima veniam, quis. Ut enim ad minima veniam, quis. Ut enim " },
    ])
    .meta({
      description: "List of points contains a title and description.",
    }),
});

export type SchemaType = z.infer<typeof Schema>;

const DataAnalysisListSlide = ({ data }: { data: Partial<SchemaType> }) => {
  const { title, itemIcon, items } = data;

  return (
    <>
      <link href="https://fonts.googleapis.com/css2?family=Source+Sans+3:ital,wght@0,200..900;1,200..900&display=swap" rel="stylesheet" />
      <div
        className="relative h-[720px] w-[1280px] overflow-hidden rounded-[24px] bg-[#f9f8f8]"
        style={{
          backgroundColor: "var(--background-color,#f9f8f8)",
          fontFamily: "var(--body-font-family,'Source Sans 3')",
        }}
      >
        <div
          className="absolute left-0 top-0 w-[42px] rounded-b-[22px] bg-[#157CFF]"
          style={{ height: 185, backgroundColor: "var(--primary-color,#157CFF)" }}
        />

        <div className="px-[58px] pt-[52px]">
          <h2
            className="text-[80px] font-bold leading-[108.4%] tracking-[-2.419px] text-[#232223]"
            style={{ color: "var(--background-text,#232223)" }}
          >
            {title}
          </h2>
        </div>

        <div className="grid grid-cols-2 gap-x-[92px] gap-y-[42px] px-[82px] pt-[58px]">
          {items?.map((item, index) => (
            <div key={`${item.title}-${index}`}>
              <div className="flex items-center gap-[14px]">
                <div
                  className="flex h-[55px] w-[55px] items-center justify-center rounded-full bg-[#157CFF] text-white"
                  style={{
                    backgroundColor: "var(--primary-color,#157CFF)",
                    color: "var(--primary-text,#ffffff)",
                  }}
                >
                  <RemoteSvgIcon
                    url={itemIcon?.__icon_url__}
                    strokeColor={"currentColor"}
                    className="h-[26px] w-[26px] object-contain"
                    color="var(--primary-text, #ffffff)"
                    title={itemIcon?.__icon_query__}
                  />
                  {/* <img
                    src={itemIcon?.__icon_url__}
                    alt={itemIcon?.__icon_query__}
                    className="h-[26px] w-[26px] object-contain"
                    style={{ filter: "brightness(0) invert(1)" }}
                  /> */}
                </div>
                <h3
                  className="text-[20px] font-medium tracking-[2.074px] text-[#232223]"
                  style={{ color: "var(--background-text,#232223)" }}
                >
                  {item.title}
                </h3>
              </div>
              <p
                className="mt-5 max-w-[420px] text-[24px] leading-[26.667px]  text-[#232223]"
                style={{ color: "var(--background-text,#232223)" }}
              >
                {item.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </>
  );
};

export default DataAnalysisListSlide;
