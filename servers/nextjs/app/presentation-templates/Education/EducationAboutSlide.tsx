import * as z from "zod";


export const slideLayoutId = "about-slide";
export const slideLayoutName = "About Slide";
export const slideLayoutDescription =
  "A left text column with company/instructor/presenter/institute name and title introduction and a right-side visual grid made from one repeated image and tinted text panels.";

export const Schema = z.object({
  name: z.string().min(3).max(22).default("Company Name").meta({
    description: "Main heading in the left content column.",
  }),
  intro: z.string().min(40).max(100).default(
    "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et."
  ).meta({
    description: "Bold intro text shown beneath the company heading.",
  }),
  body: z.string().min(120).max(280).default(
    "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat."
  ).meta({
    description: "Body paragraph in the left content section.",
  }),
  topPanelText: z.string().min(20).max(70).default("Insert info about the company.").meta({
    description: "Short text inside the top-right dark panel. ",
  }),
  bottomPanelText: z.string().min(20).max(70).default("Insert info about the company and your mission statement.").meta({
    description: "Short text inside the bottom-right dark panel.",
  }),
  topFeatureImage: z.object({
    __image_url__: z.string().default("https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=1200&q=80"),
    __image_prompt__: z.string().default("Office team collaboration"),
  }).default({
    __image_url__:
      "https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=1200&q=80",
    __image_prompt__: "Office team collaboration",
  }).meta({
    description: "Single image reused in the top right-side visual grid.",
  }),
  bottomFeatureImage: z.object({
    __image_url__: z.string().default("https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=1200&q=80"),
    __image_prompt__: z.string().default("Office team collaboration"),
  }).default({
    __image_url__:
      "https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=1200&q=80",
    __image_prompt__: "Office team collaboration",
  }).meta({
    description: "Single image reused in the bottom right-side visual grid.",
  }),
});

export type SchemaType = z.infer<typeof Schema>;

const EducationAboutSlide = ({ data }: { data: Partial<SchemaType> }) => {


  return (<>
    <link href="https://fonts.googleapis.com/css2?family=Source+Serif+4:ital,opsz,wght@0,8..60,200..900;1,8..60,200..900&display=swap" rel="stylesheet" />

    <div
      className="relative h-[720px] w-[1280px] overflow-hidden"
      style={{
        backgroundColor: "var(--background-color,#efeff1)",
        fontFamily: "var(--body-font-family,'Source Serif 4')",
      }}
    >
      <div className="grid  items-end grid-cols-[1fr_1fr]">
        <div className="px-[53px] pb-[56px] ">
          <h2 className="font-serif text-[64px] leading-[98%] tracking-[-0.02em]" style={{ color: "var(--primary-color,#101C3D)" }}>
            {data.name}
          </h2>
          <p className="mt-[30px] max-w-[610px] text-[22px] font-semibold leading-[1.24]" style={{ color: "var(--background-text,#34394C)" }}>
            {data.intro}
          </p>
          <p className="mt-[18px] max-w-[620px] text-[22px] leading-[1.28]" style={{ color: "var(--background-text,#46474C)" }}>
            {data.body}
          </p>
        </div>

        <div className=" ">
          <div className="relative flex  overflow-hidden  h-[360px]">
            <img
              src={data.topFeatureImage?.__image_url__}
              alt={data.topFeatureImage?.__image_prompt__}
              className="absolute inset-0 h-full w-full object-cover z-1 "
            />
            <div className="w-1/2 z-10 flex justify-center items-center relative">
              <div
                className="absolute inset-0"
                style={{
                  backgroundColor: "var(--primary-color,#28256f)",
                  opacity: 0.6,
                }}
              />
              <p className="relative z-10 text-[24px] leading-[1.22] px-[42px]" style={{ color: "var(--primary-text,#f5f7ff)" }}>
                {data.topPanelText}
              </p>
            </div>
            <div className=" w-1/2 ">

            </div>
          </div>

          <div className="relative flex overflow-hidden  h-[360px]">
            <img
              src={data.bottomFeatureImage?.__image_url__}
              alt={data.bottomFeatureImage?.__image_prompt__}
              className="absolute inset-0 h-full w-full object-cover "
            />
            <div className=" w-1/2 ">

            </div>
            <div className="w-1/2 z-10 flex justify-center items-center relative">
              <div
                className="absolute inset-0"
                style={{
                  backgroundColor: "var(--primary-color,#28256f)",
                  opacity: 0.6,
                }}
              />
              <p className="relative z-10 text-[24px] leading-[1.22] px-[42px]" style={{ color: "var(--primary-text,#f5f7ff)" }}>
                {data.bottomPanelText}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </>
  );
};

export default EducationAboutSlide;
