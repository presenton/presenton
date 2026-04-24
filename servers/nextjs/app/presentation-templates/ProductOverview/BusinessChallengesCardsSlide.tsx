import * as z from "zod";



export const slideLayoutId = "title-description-with-cards-text-slide";
export const slideLayoutName = "Title Description with Cards to Text Slide";
export const slideLayoutDescription =
  "A slide with a title on top and a description below, and a content section containing cards of text.";

const CardSchema = z.object({
  heading: z.string().max(16).meta({
    description: "Card heading for one challenge column.",
  }),
  body: z.string().max(45).meta({
    description: "Card body copy for one challenge column.",
  }),
  dark: z.boolean().default(false).meta({
    description: "Controls whether the card uses a dark emphasis style.",
  }),
});

export const Schema = z.object({
  title: z.string().min(8).max(16).default("Business Challenges").meta({
    description: "Main slide title. Max 16 characters.",
  }),
  taglineLabel: z.string().max(16).default("TAGLINE").meta({
    description: "Short label above the left-side paragraph.",
  }),
  taglineBody: z.string().max(100).default(
    "Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea."
  ).meta({
    description: "Supporting paragraph on the left side.",
  }),
  heroImage: z.object({
    __image_url__: z.string().url().default("https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=1400&q=80"),
    __image_prompt__: z.string().min(10).max(100).default("Team meeting and stressed analyst"),
  }).default({
    __image_url__:
      "https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=1400&q=80",
    __image_prompt__: "Team meeting and stressed analyst",
  }).meta({
    description: "Primary image shown in the upper right area.",
  }),
  cards: z
    .array(CardSchema)

    .max(3)
    .default([
      {
        heading: "HEADING 1",
        body: "Lorem ipsum dolor sit amet, consectetur elit.",
        dark: false,
      },
      {
        heading: "HEADING 2",
        body: "Lorem ipsum dolor sit amet, consectetur elit.",
        dark: false,
      },
      {
        heading: "HEADING 3",
        body: "Lorem ipsum dolor sit amet, consectetur elit.",
        dark: true,
      },
    ])
    .meta({
      description: "Three vertical challenge cards rendered under the image.",
    }),
});

export type SchemaType = z.infer<typeof Schema>;

const BusinessChallengesCardsSlide = ({ data }: { data: Partial<SchemaType> }) => {
  const { title, taglineLabel, taglineBody, heroImage, cards } = data;

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
        <div className=" pl-[66px] pt-[50px] pb-[28px] pr-[40px]">
          <h2
            className="text-[80px] max-w-[406px] font-semibold leading-[108.4%] tracking-[-2.419px] text-[#15342D]"
            style={{ color: "var(--primary-color,#15342D)" }}
          >
            {title}
          </h2>

          <div className="mt-[72px] w-[360px]">
            <p
              className="text-[20px] font-semibold tracking-[2.074px] text-white"
              style={{ color: "var(--primary-color,#15342D)" }}
            >
              {taglineLabel}
            </p>
            <p
              className="mt-[16px] text-[24px] font-normal  text-[#15342DCC]"
              style={{ color: "var(--background-text,#15342DCC)" }}
            >
              {taglineBody}
            </p>
          </div>
        </div>

        {heroImage?.__image_url__ && (
          <img
            src={heroImage.__image_url__}
            alt={heroImage.__image_prompt__}
            className="absolute right-0 top-[72px] h-[350px] w-[770px] object-cover bg-white"
          />
        )}

        <div className="absolute bottom-[72px] right-[40px] flex items-start gap-[16px]">
          {cards?.map((card, index) => (
            <div
              key={index}
              className=" w-[248px] px-[34px] py-[34px]"
              style={{
                backgroundColor: card.dark
                  ? "var(--primary-color,#15342D)"
                  : "var(--card-color,#ebebee)",
              }}
            >
              <p
                className="text-[20px] font-semibold tracking-[2.074px] text-white"
                style={{
                  color: card.dark
                    ? "var(--primary-text,#edf2f1)"
                    : "var(--primary-color,#15342D)",
                }}
              >
                {card.heading}
              </p>
              <p
                className="mt-[18px] text-[28px] font-normal  text-white"
                style={{
                  color: card.dark
                    ? "var(--primary-text,#edf2f1)"
                    : "var(--primary-color,#15342D)",
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

export default BusinessChallengesCardsSlide;
