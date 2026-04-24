import * as z from "zod";

const PRODUCT_BG = "var(--background-color,#d7dddd)";
const PRODUCT_DARK = "var(--primary-color,#05463d)";


export const slideLayoutId = "table-of-content-slide";
export const slideLayoutName = "Table of Content Slide";
export const slideLayoutDescription =
  "A two-column table of contents slide with section titles and numbers on a left panel and a title plus description paragraph on the right panel.";

const SectionSchema = z.object({
  title: z.string().min(4).max(25).meta({
    description: "Section label shown in the left navigation column.",
  }),
  number: z.string().min(2).max(3).meta({
    description: "Section number shown beside the section label.",
  }),
  description: z.string().min(4).max(60).optional().meta({
    description: "Section description shown in the right column.",
  }),
});

export const Schema = z.object({
  title: z.string().min(6).max(18).default("Table Of Content").meta({
    description: "Heading in the right-side content area.",
  }),
  description: z.string().min(50).max(160).default(
    "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore."
  ).meta({
    description: "Supporting descriptive paragraph under the heading.",
  }),
  sections: z
    .array(SectionSchema)
    .max(6)
    .default([
      { title: "SECTION TITLE SECTION TITLE", number: "01", description: "Lorem ipsum dolor sit. Lorem ipsum dolor sit. Lorem ipsum dolor sit." },
      { title: "SECTION TITLE SECTION TITLE", number: "02", description: "Lorem ipsum dolor sit. Lorem ipsum dolor sit. Lorem ipsum dolor sit." },
      { title: "SECTION TITLE SECTION TITLE", number: "03", description: "Lorem ipsum dolor sit. Lorem ipsum dolor sit. Lorem ipsum dolor sit." },
      { title: "SECTION TITLE SECTION TITLE", number: "04", description: "Lorem ipsum dolor sit. Lorem ipsum dolor sit. Lorem ipsum dolor sit." },
      { title: "SECTION TITLE SECTION TITLE", number: "05", description: "Lorem ipsum dolor sit. Lorem ipsum dolor sit. Lorem ipsum dolor sit." },
      { title: "SECTION TITLE SECTION TITLE", number: "06", description: "Lorem ipsum dolor sit. Lorem ipsum dolor sit. Lorem ipsum dolor sit." },

    ])
    .meta({
      description: "Six rows listed in the table of contents panel.",
    }),
});

export type SchemaType = z.infer<typeof Schema>;

const TableOfContentSlide = ({ data }: { data: Partial<SchemaType> }) => {
  const { title, description, sections } = data;

  return (
    <>
      <link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,200..800&display=swap" rel="stylesheet" />
      <div
        className="relative h-[720px] w-[1280px] overflow-hidden "
        style={{
          backgroundColor: PRODUCT_BG,
          fontFamily: "var(--body-font-family,'Bricolage Grotesque')",
        }}
      >
        <div className="grid h-full grid-cols-[1fr_1fr]">
          <div className="px-[56px] pt-[50px]" style={{ backgroundColor: PRODUCT_DARK }}>
            <div className={`${sections && sections?.length > 3 ? 'space-y-[28px]' : 'space-y-[40px]'}`}>
              {sections?.map((section, index) => (
                <div key={index} className="flex items-center gap-4 justify-between">
                  <div>

                    <p
                      className="text-[20px] font-semibold  tracking-[0.2em] text-[#ecf2f1]"
                      style={{ color: "var(--primary-text,#ecf2f1)" }}
                    >
                      {section.title}
                    </p>
                    {section.description && <p
                      className="mt-[6px] text-[18px] leading-[1.2] text-[#ecf2f1]"
                      style={{ color: "var(--primary-text,#ecf2f1)" }}
                    >
                      {section.description}
                    </p>}
                  </div>
                  <p
                    className="text-[22px] font-medium text-[#ecf2f1]"
                    style={{ color: "var(--primary-text,#ecf2f1)" }}
                  >
                    {section.number}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="px-[42px] pt-[118px]">
            <h2
              className="text-[80px] font-semibold leading-[108.4%] tracking-[-2.419px] text-[#15342D]"
              style={{ color: "var(--primary-color,#15342D)" }}
            >
              {title}
            </h2>
            <p
              className="mt-[28px] w-[560px] text-[24px] font-normal  text-[#15342DCC]"
              style={{ color: "var(--background-text,#15342DCC)" }}
            >
              {description}
            </p>
          </div>
        </div>
      </div>
    </>
  );
};

export default TableOfContentSlide;
