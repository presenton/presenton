import * as z from "zod";


export const slideLayoutId = "title-description-with-image-block-slide";
export const slideLayoutName = "Title Description with Image Block Slide";
export const slideLayoutDescription =
  "A slide with a title on top and a description below, and a content section containing an image and a grid of cards of text.";

const CardSchema = z.object({
  heading: z.string().max(14).meta({
    description: "Card heading.",
  }),
  body: z.string().max(25).meta({
    description: "Card short description.",
  }),
  isHighlighted: z.boolean().default(false).meta({
    description: "Whether this card uses the dark style.",
  }),
});

export const Schema = z.object({
  title: z.string().max(16).default("Our Services").meta({
    description: "Main heading shown at the top-left.",
  }),
  taglineLabel: z.string().max(16).default("TAGLINE").meta({
    description: "Small label above left paragraph.",
  }),
  taglineBody: z.string().max(30).default(
    "Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea."
  ).meta({
    description: "Supporting text shown beneath the tagline label.",
  }),
  featureImage: z.object({
    __image_url__: z.string().url().default("https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=1200&q=80"),
    __image_prompt__: z.string().min(10).max(100).default("Customer support team in office"),
  }).default({
    __image_url__:
      "https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=1200&q=80",
    __image_prompt__: "Customer support team in office",
  }).meta({
    description: "Main image shown at the lower left side.",
  }),
  services: z
    .array(CardSchema)

    .max(4)
    .default([
      { heading: "HEADING 1", body: "Lorem ipsum dolor sit amet, consectetur", isHighlighted: false },
      { heading: "HEADING 2", body: "Lorem ipsum dolor sit amet, consectetur", isHighlighted: true },
      { heading: "HEADING 3", body: "Lorem ipsum dolor sit amet, consectetur", isHighlighted: false },
      { heading: "HEADING 4", body: "Lorem ipsum dolor sit amet, consectetur", isHighlighted: false },
    ])
    .meta({
      description: "Cards rendered on the right side.",
    }),
});

export type SchemaType = z.infer<typeof Schema>;

const OurServicesSlide = ({ data }: { data: Partial<SchemaType> }) => {
  const { title, taglineLabel, taglineBody, featureImage, services } = data;

  return (
    <>
      <link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,200..800&display=swap" rel="stylesheet" />
      <div
        className="relative h-[720px] w-[1280px] flex items-end pb-[56px]  justify-between overflow-hidden "
        style={{
          backgroundColor: "var(--background-color,#DAE1DE)",
          fontFamily: "var(--body-font-family,'Bricolage Grotesque')",
        }}
      >
        <div className=" pt-[50px]">
          <div className="px-[68px]">

            <h2
              className="text-[80px] font-semibold leading-[108.4%] tracking-[-2.419px] text-[#15342D]"
              style={{ color: "var(--primary-color,#15342D)" }}
            >
              {title}
            </h2>

            <div className="mt-[26px] w-[560px]">
              <p
                className="text-[20px] font-semibold tracking-[2.074px] text-white"
                style={{ color: "var(--primary-color,#15342D)" }}
              >
                {taglineLabel}
              </p>
              <p
                className="mt-[14px] text-[24px] font-normal  text-[#15342DCC]"
                style={{ color: "var(--background-text,#15342DCC)" }}
              >
                {taglineBody}
              </p>
            </div>
          </div>
          <div
            className="mt-[35px] h-[326px] w-[650px] bg-[#15342D]"
            style={{ backgroundColor: "var(--primary-color,#15342D)" }}
          >

            {featureImage?.__image_url__ && (
              <img
                src={featureImage?.__image_url__}
                alt={featureImage?.__image_prompt__}
                className="h-[326px] w-[650px] object-cover"
              />
            )}
          </div>
        </div>



        <div className="grid grid-cols-2 gap-[22px] pr-[76px]">
          {services?.map((card, index) => (
            <div
              key={index}
              className=" p-[33px]"
              style={{
                backgroundColor: card.isHighlighted
                  ? "var(--primary-color,#15342D)"
                  : "var(--card-color,#ececee)",
              }}
            >
              <p
                className="text-[20px] font-semibold tracking-[4.354px] text-white"
                style={{
                  color: card.isHighlighted
                    ? "var(--primary-text,#edf2f1)"
                    : "var(--primary-color,#15342D)",
                }}
              >
                {card.heading}
              </p>
              <p
                className={`${card.isHighlighted ? "text-white" : "text-[#15342D]"} mt-[20px] text-[28px] font-normal`}
                style={{
                  color: card.isHighlighted
                    ? "var(--primary-text,#edf2f1)"
                    : "var(--background-text,#15342DCC)",
                }}
              >
                {card.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </>
  );
};

export default OurServicesSlide;
