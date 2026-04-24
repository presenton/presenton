import * as z from "zod";



export const slideLayoutId = "cover-slide";
export const slideLayoutName = "Cover Slide";
export const slideLayoutDescription =
  "A cover slide with a compact logo in the top-left, a date/text/label in the top-right, a centered title, and a image anchored to the bottom with a soft fade into the background.";

export const Schema = z.object({

  label: z.string().min(3).max(16).optional().default("MARCH 2026").meta({
    description: "Date/text/label shown at the top-right corner.",
  }),
  titleLine1: z.string().min(3).max(18).default("Social Media").meta({
    description: "First line of the cover title.",
  }),
  titleLine2: z.string().min(3).max(20).default("Marketing Report").meta({
    description: "Second line of the cover title.",
  }),
  backgroundImage: z.object({
    __image_url__: z.string().url().default("https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1920&q=80"),
    __image_prompt__: z.string().min(10).max(100).default("Tall glass buildings from street view"),
  }).default({
    __image_url__: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1920&q=80",
    __image_prompt__: "Tall glass buildings from street view",
  }),
});

export type SchemaType = z.infer<typeof Schema>;

const CoverSlide = ({ data }: { data: Partial<SchemaType> }) => {


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
        <div
          className="relative z-20 flex h-full flex-col px-[36px] pt-[62px] text-[#15342D]"
          style={{ color: "var(--primary-color,#15342D)" }}
        >
          <div className="flex items-center justify-between">

            <p></p>

            <p
              className="text-[18px] font-normal leading-[18.991px] text-[#15342D]"
              style={{ color: "var(--primary-color,#15342D)" }}
            >
              {data.label || ''}
            </p>
          </div>

          <div className="flex flex-1 items-center justify-center pb-[80px]">
            <h1
              className="text-center text-[100px] font-semibold leading-[108.4%] tracking-[-3.024px]"
            >
              <p> {data.titleLine1}</p>
              <p>{data.titleLine2} </p>
            </h1>
          </div>
        </div>

        {data.backgroundImage?.__image_url__ && (
          <img
            src={data.backgroundImage.__image_url__ || ''}
            alt={data.backgroundImage.__image_prompt__ || ''}
            className="absolute bottom-0 left-0 z-0 h-[360px] w-full object-cover"
          />
        )}

        <div
          className="pointer-events-none absolute bottom-0 left-0 w-full z-10"
          style={{
            height: "365px",
            background:
              "linear-gradient(0deg, rgba(218, 225, 222, 0.00) 0%, var(--background-color,#DAE1DE) 80.33%)",
          }}
        />
      </div>
    </>
  );
};

export default CoverSlide;
