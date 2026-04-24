import * as z from "zod";


export const slideLayoutId = "title-description-with-image-gallery-slide";
export const slideLayoutName = "Title Description with Image Gallery Slide";
export const slideLayoutDescription =
  "A text slide with a title on top and a description below, and a section containing a gallery of images.";

export const Schema = z.object({
  title: z.string().max(12).default("Image Gallery").meta({
    description: "Main Title of the slide",
  }),
  description: z.string().max(120).default(
    "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore."
  ).meta({
    description: "Supporting paragraph shown under the title.",
  }),
  topCenterImage: z.object({
    __image_url__:
      z.string().default("https://images.unsplash.com/photo-1521737711867-e3b97375f902?auto=format&fit=crop&w=800&q=80"),
    __image_prompt__: z.string().max(80).default("Design team discussing project board"),
  }).default({
    __image_url__: "https://images.unsplash.com/photo-1521737711867-e3b97375f902?auto=format&fit=crop&w=800&q=80",
    __image_prompt__: "Design team discussing project board",
  }).meta({
    description: "Top-middle gallery image.",
  }),
  topRightImage: z.object({
    __image_url__:
      z.string().default("https://images.unsplash.com/photo-1455390582262-044cdead277a?auto=format&fit=crop&w=800&q=80"),
    __image_prompt__: z.string().max(80).default("Creative desk with notebook and photos"),
  }).default({
    __image_url__:
      "https://images.unsplash.com/photo-1455390582262-044cdead277a?auto=format&fit=crop&w=800&q=80",
    __image_prompt__: "Creative desk with notebook and photos",
  }).meta({
    description: "Top-right gallery image.",
  }),
  bottomWideImage: z.object({
    __image_url__:
      z.string().default("https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?auto=format&fit=crop&w=1300&q=80"),
    __image_prompt__: z.string().max(80).default("City skyline seen from office window"),
  }).default({
    __image_url__:
      "https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?auto=format&fit=crop&w=1300&q=80",
    __image_prompt__: "City skyline seen from office window",
  }).meta({
    description: "Bottom-left wide gallery image.",
  }),
  bottomCenterImage: z.object({
    __image_url__:
      z.string().default("https://images.unsplash.com/photo-1517048676732-d65bc937f952?auto=format&fit=crop&w=900&q=80"),
    __image_prompt__: z.string().max(80).default("Art gallery wall with framed photos"),
  }).default({
    __image_url__:
      "https://images.unsplash.com/photo-1517048676732-d65bc937f952?auto=format&fit=crop&w=900&q=80",
    __image_prompt__: "Art gallery wall with framed photos",
  }).meta({
    description: "Bottom-center gallery image.",
  }),
  bottomRightImage: z.object({
    __image_url__:
      z.string().default("https://images.unsplash.com/photo-1521791136064-7986c2920216?auto=format&fit=crop&w=900&q=80"),
    __image_prompt__: z.string().max(80).default("Office workshop with presentation board"),
  }).default({
    __image_url__:
      "https://images.unsplash.com/photo-1521791136064-7986c2920216?auto=format&fit=crop&w=900&q=80",
    __image_prompt__: "Office workshop with presentation board",
  }).meta({
    description: "Bottom-right gallery image.",
  }),
});

export type SchemaType = z.infer<typeof Schema>;

const ImageGallerySlide = ({ data }: { data: Partial<SchemaType> }) => {
  const {
    title,
    description,
    topCenterImage,
    topRightImage,
    bottomWideImage,
    bottomCenterImage,
    bottomRightImage,
  } = data;

  return (
    <>
      <link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,200..800&display=swap" rel="stylesheet" />
      <div
        className="relative h-[720px] w-[1280px] overflow-hidden  p-[50px]"
        style={{
          backgroundColor: "var(--background-color,#DAE1DE)",
          fontFamily: "var(--body-font-family,'Bricolage Grotesque')",
        }}
      >
        <div className="flex items-center justify-between gap-1 ">

          <div className=" ">
            <h2
              className="text-[80px] font-semibold leading-[108.4%] tracking-[-2.419px] text-[#15342D]"
              style={{ color: "var(--primary-color,#15342D)" }}
            >
              {title}
            </h2>
            <p
              className="mt-[24px] w-[584px] text-[24px] font-normal  text-[#15342DCC]"
              style={{ color: "var(--background-text,#15342DCC)" }}
            >
              {description}
            </p>
          </div>
          <div className="flex items-center gap-[22px]">
            <img
              src={topCenterImage?.__image_url__ ?? ''}
              alt={topCenterImage?.__image_prompt__ ?? ''}
              className="h-[294px] w-[270px] object-cover"
            />
            <img
              src={topRightImage?.__image_url__}
              alt={topRightImage?.__image_prompt__ ?? ''}
              className="h-[294px] w-[270px] object-cover"
            />
          </div>
        </div>


        <div className="mt-[22px] w-full  flex gap-[22px]">
          <img
            src={bottomWideImage?.__image_url__}
            alt={bottomWideImage?.__image_prompt__}
            className="h-[290px] w-[605px] object-cover"
          />
          <img
            src={bottomCenterImage?.__image_url__}
            alt={bottomCenterImage?.__image_prompt__}
            className="h-[294px] w-[270px] object-cover"
          />
          <img
            src={bottomRightImage?.__image_url__}
            alt={bottomRightImage?.__image_prompt__}
            className="h-[294px] w-[270px] object-cover"
          />
        </div>
      </div>
    </>
  );
};

export default ImageGallerySlide;
