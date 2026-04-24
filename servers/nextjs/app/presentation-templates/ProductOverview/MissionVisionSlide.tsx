import * as z from "zod";


export const slideLayoutId = "text-blocks-with-image-block-slide";
export const slideLayoutName = "Text Blocks with Image Block Slide";
export const slideLayoutDescription =
  "A slide with a title in the top-left block, text in the top-right , another text block in the bottom-left , and an image in the bottom-right block.";

export const Schema = z.object({
  title: z.string().min(8).max(30).default("Mission & Vision").meta({
    description: "Primary heading shown in the top-left tile.",
  }),

  topleftTextBlockLabel: z.string().min(3).max(20).default("MISSION").meta({
    description: "Mission section label.",
  }),
  topleftTextBlockBody: z.string().min(40).max(90).default(
    "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore."
  ).meta({
    description: "Mission paragraph content.",
  }),
  bottomleftTextBlockLabel: z.string().min(3).max(20).default("VISION").meta({
    description: "Vision section label.",
  }),
  bottomleftTextBlockBody: z.string().min(40).max(90).default(
    "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore."
  ).meta({
    description: "Vision paragraph content.",
  }),
  image: z.object({
    __image_url__: z.string(),
    __image_prompt__: z.string(),
  }).optional().meta({
    description: "Bottom-right supporting image. Optional.",
  }).optional().default({
    __image_url__: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1400&q=80",
    __image_prompt__: "Business silhouette at window skyline",
  }),
});

export type SchemaType = z.infer<typeof Schema>;

const MissionVisionSlide = ({ data }: { data: Partial<SchemaType> }) => {

  return (
    <>
      <link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,200..800&display=swap" rel="stylesheet" />
      <div
        className="relative h-[720px] w-[1280px] overflow-hidden "
        style={{
          backgroundColor: "var(--background-color,#DAE1DE)",
          fontFamily: "var(--body-font-family,'Bricolage Grotesque')",
        }}
      >
        <div className="grid h-full grid-cols-2 grid-rows-2">
          <div className="px-[74px] pt-[50px]">
            <h2
              className="text-[80px] font-semibold leading-[108.4%] tracking-[-2.419px] text-[#15342D]"
              style={{ color: "var(--primary-color,#15342D)" }}
            >
              {data.title}
            </h2>
          </div>

          <div
            className="pl-[60px] pt-[76px]"
            style={{ backgroundColor: "var(--primary-color,#15342D)" }}
          >
            <p
              className="text-[20px] font-semibold tracking-[2.074px] text-white"
              style={{ color: "var(--primary-text,#edf2f1)" }}
            >
              {data.topleftTextBlockLabel}
            </p>
            <p
              className="mt-[26px] text-[28px] font-normal  text-white"
              style={{ color: "var(--primary-text,#edf2f1)" }}
            >
              {data.topleftTextBlockBody}
            </p>
          </div>

          <div
            className="pl-[53px] py-[53px]"
            style={{ backgroundColor: "var(--primary-color,#15342D)" }}
          >
            <p
              className="text-[20px] font-semibold tracking-[2.074px] text-white"
              style={{ color: "var(--primary-text,#edf2f1)" }}
            >
              {data.bottomleftTextBlockLabel}
            </p>
            <p
              className="mt-[24px] text-[28px] font-normal  text-white"
              style={{ color: "var(--primary-text,#edf2f1)" }}
            >
              {data.bottomleftTextBlockBody}
            </p>
          </div>
          <div
            className="h-full w-full overflow-hidden bg-white"
            style={{ backgroundColor: "var(--card-color,#ffffff)" }}
          >
            {data.image?.__image_url__ && (
              <img
                src={data.image.__image_url__}
                alt={data.image.__image_prompt__}
                className="h-full w-full object-cover"
              />
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default MissionVisionSlide;
