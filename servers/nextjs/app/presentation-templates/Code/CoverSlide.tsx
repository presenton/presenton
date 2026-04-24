import * as z from "zod";

export const slideLayoutId = "cover-slide";
export const slideLayoutName = "Cover Slide";
export const slideLayoutDescription =
  "Opening/cover/intro slide with  organization/institution/presenter, presentation title/heading , and supporting subtitle.";

export const Schema = z.object({
  companyName: z.string().min(2).max(18).optional().default("COMPANY NAME").meta({
    description: "Optional organization/institution/presenter name shown above the slide title.",
  }),
  title: z.string().min(8).max(28).default("Development Roadmap").meta({
    description: "Title/heading of the slide.",
  }),
  subtitle: z
    .string()
    .min(24)
    .max(40)
    .default(
      "We transform ideas into market-ready solutions through systematic development processes."
    )
    .meta({
      description: "Supporting subtitle shown under the heading.",
    }),
});

export type SchemaType = z.infer<typeof Schema>;

const CodeSlide01RoadmapCover = ({ data }: { data: Partial<SchemaType> }) => {

  return (<>
    <link href="https://fonts.googleapis.com/css2?family=Nunito+Sans:ital,opsz,wght@0,6..12,200..1000;1,6..12,200..1000&display=swap" rel="stylesheet" />
    <div
      className="relative h-[720px] w-[1280px] overflow-hidden p-[53px]"
      style={{
        backgroundColor: "var(--background-color,#101B37)",
        fontFamily: "var(--body-font-family,Nunito Sans)",
      }}
    >
      <div className="relative z-10 flex h-full flex-col items-center justify-center px-[200px] text-center">
        <p className="text-[22px]" style={{ color: "var(--background-text,#d7dcff)" }}>{data.companyName}</p>
        <h2 className="mt-[10px] text-[64px] font-medium" style={{ color: "var(--background-text,#ffffff)" }}>
          {data.title}
        </h2>
        <p className="mt-[35px] text-[26px] leading-[132%]" style={{ color: "var(--background-text,#d8ddff)" }}>{data.subtitle}</p>
      </div>
    </div>
  </>
  );
};

export default CodeSlide01RoadmapCover;
