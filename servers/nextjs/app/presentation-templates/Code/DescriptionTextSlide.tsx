import * as z from "zod";

export const slideLayoutId = "description-text-slide";
export const slideLayoutName = "Description Text Slide";
export const slideLayoutDescription =
  "A text-only description slide tihe title/heading.";

export const Schema = z.object({
  title: z.string().min(8).max(30).default("Code + Explanation").meta({
    description: "Main slide title shown at the top-left.",
  }),
  descriptionTitle: z.string().min(4).max(20).default("Explanation").meta({
    description: "Subheading above the paragraph body.",
  }),
  description: z
    .string()

    .max(360)
    .default(
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat."
    )
    .meta({
      description: "Long-form explanation body.",
    }),
});

export type SchemaType = z.infer<typeof Schema>;

const CodeSlide08CodeExplanationText = ({ data }: { data: Partial<SchemaType> }) => {

  return (
    <>
      <link href="https://fonts.googleapis.com/css2?family=Nunito+Sans:ital,opsz,wght@0,6..12,200..1000;1,6..12,200..1000&display=swap" rel="stylesheet" />
      <div
        className="relative h-[720px] w-[1280px] overflow-hidden p-[53px]"
        style={{
          backgroundColor: "var(--background-color,#101B37)",
          fontFamily: "var(--body-font-family,Nunito Sans)",
        }}
      >


        <h2 className="text-[64px] font-medium" style={{ color: "var(--background-text,#f2f4ff)" }}>{data.title}</h2>
        <div className="relative z-10 h-full max-w-[560px]">
          <h3 className="mt-[34px] text-[24px] font-medium" style={{ color: "var(--background-text,#f1f4ff)" }}>{data.descriptionTitle}</h3>
          <p className="mt-[16px] text-[22px] leading-[145%]" style={{ color: "var(--background-text,#d2d9ff)" }}>{data.description}</p>
        </div>
      </div>
    </>
  );
};

export default CodeSlide08CodeExplanationText;
