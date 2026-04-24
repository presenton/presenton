import * as z from "zod";


export const slideLayoutId = "title-image-bullet-cards-slide";
export const slideLayoutName = "Title Image Bullet Cards Slide";
export const slideLayoutDescription =
  "A slide with optional image on the left and cards with bullet on the right.";

const CardSchema = z.object({
  bulletNumber: z.string().min(2).max(4).meta({
    description: "Short description step number starting from 01...",
  }),
  description: z.string().min(10).max(80).meta({
    description: "Bullet point description shown inside the card.",
  }),
});

export const Schema = z.object({
  title: z.string().min(3).max(30).default("Solution").meta({
    description: "Slide heading shown in the top-left corner.",
  }),
  showImage: z.boolean().default(true).meta({
    description: "Whether the image should be shown.",
  }),
  featureImage: z.object({
    __image_url__: z.string().default("https://presenton-public.s3.ap-southeast-1.amazonaws.com/static/images/placeholder.jpg"),
    __image_prompt__: z.string().default("Thinking woman portrait on a neutral background"),
  }).default({
    __image_url__:
      "https://presenton-public.s3.ap-southeast-1.amazonaws.com/static/images/placeholder.jpg",
    __image_prompt__: "Thinking woman portrait on a neutral background",
  }).meta({
    description: "Optional image used on the left side of the slide.",
  }),
  cards: z
    .array(CardSchema)
    .min(1)
    .max(3)
    .default([
      {
        bulletNumber: "01",
        description: "Lorem ipsum dolor sit amet, consectetur adipiscing elit.",
      },
      {
        bulletNumber: "02",
        description: "Lorem ipsum dolor sit amet, consectetur adipiscing elit.",
      },
      {
        bulletNumber: "03",
        description: "Lorem ipsum dolor sit amet, consectetur adipiscing elit.",
      },
    ])
    .meta({
      description:
        "Three solution cards. When the image is enabled, only the first two cards are displayed.",
    }),
});

export type SchemaType = z.infer<typeof Schema>;

type SolutionSlideProps = {
  data: Partial<SchemaType>;
};

function SolutionCard({
  stepNumber,
  description,
}: {
  stepNumber: string;
  description: string;
}) {
  return (
    <div
      className="flex py-[60px] px-10 w-[312px] flex-col items-center justify-center rounded-[160px] bg-[#4d4ef3]  text-center text-white"
      style={{
        backgroundColor: "var(--graph-1,#4d4ef3)",
        color: "var(--primary-text,#ffffff)",
      }}
    >
      <p className="text-[42px] font-medium tracking-[8.709px]">{stepNumber}</p>
      <p className="mt-[27px] text-[27px] min-h-[200px] ">
        {description}
      </p>
    </div>
  );
}

const SolutionSlide = ({ data }: SolutionSlideProps) => {
  const { title, showImage, featureImage, cards } = data;
  const visibleCards = showImage ? cards?.slice(0, 2) : cards;


  return (
    <>  <link href="https://fonts.googleapis.com/css2?family=Source+Sans+3:ital,wght@0,200..900;1,200..900&display=swap" rel="stylesheet" />
      <div
        className="relative h-[720px] w-[1280px] overflow-hidden rounded-[24px] bg-[#F9F8F8]"
        style={{
          backgroundColor: "var(--background-color,#F9F8F8)",
          fontFamily: "var(--body-font-family,'Source Sans 3')",
        }}
      >
        <div className="absolute left-0 top-0 w-[42px] rounded-b-[22px] bg-[#157CFF]"
          style={{ height: 185, backgroundColor: "var(--primary-color,#157CFF)" }}
        />

        <div className="relative z-10 h-full  py-[58px]">
          {title && (
            <h2
              className="text-[80px] px-[64px] font-bold leading-[108.4%] tracking-[-2.419px] text-[#232223]"
              style={{ color: "var(--background-text,#232223)" }}
            >
              {title}
            </h2>
          )}

          <div className="mt-[70px]">
            {showImage ? (
              <div className="flex items-start gap-[40px]">
                {featureImage?.__image_url__ && (
                  <div
                    className="h-[396px] w-[534px] shrink-0 overflow-hidden rounded-r-[90px] bg-[#ece8dd]"
                    style={{ backgroundColor: "var(--card-color,#ece8dd)" }}
                  >
                    <img
                      src={featureImage?.__image_url__}
                      alt={featureImage?.__image_prompt__}
                      className="h-full w-full object-cover"
                    />
                  </div>
                )}

                <div className="flex gap-[40px]">
                  {visibleCards?.map((card, index) => (
                    <SolutionCard
                      key={`${card.bulletNumber}-${index}`}
                      stepNumber={card.bulletNumber}
                      description={card.description}
                    />
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex justify-center gap-[44px] pt-[6px]">
                {visibleCards?.map((card, index) => (
                  <SolutionCard
                    key={`${card.bulletNumber}-${index}`}
                    stepNumber={card.bulletNumber}
                    description={card.description}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default SolutionSlide;
