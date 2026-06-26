import * as z from "zod";

export const slideLayoutId = "table-of-contents-slide";
export const slideLayoutName = "Table Of Contents Slide";
export const slideLayoutDescription =
  "A split layout with a left title panel and a right list of numbered sections, with one subtle background image overlay.";

const TocItemSchema = z.object({
  number: z.string().min(2).max(3).meta({
    description: "Section number displayed before each section title.",
  }),
  label: z.string().min(3).max(30).meta({
    description: "Section title shown in the right column list.",
  }),
});

const DEFAULT_ITEMS = [
  {
    number: "01",
    label:
      "Lorem ipsum dolor sit amet, Lorem ipsum dolor sit amet,Lorem ipsum dolor sit amet",
  },
  { number: "02", label: "Lorem ipsum dolor sit amet," },
  { number: "03", label: "Lorem ipsum dolor sit amet," },
  { number: "04", label: "Lorem ipsum dolor sit amet," },
  { number: "05", label: "Lorem ipsum dolor sit amet," },
  { number: "06", label: "Lorem ipsum dolor sit amet," },
  { number: "07", label: "Lorem ipsum dolor sit amet," },
  { number: "08", label: "Lorem ipsum dolor sit amet," },
  { number: "09", label: "Lorem ipsum dolor sit amet," },
  { number: "10", label: "Lorem ipsum dolor sit amet," },
  // { number: "11", label: "Lorem ipsum dolor sit amet," },
  // { number: "12", label: "TIMELINE" },
  // { number: "13", label: "GROUP OF COMPANIES" },
  // { number: "14", label: "SERVICES" },
  // { number: "15", label: "IMAGE GALLERY" },
  // { number: "16", label: "STATISTICS" },
  // { number: "17", label: "REPORT" },
  // { number: "18", label: "CONCLUSION" },
  // { number: "19", label: "QUESTIONS" },
  // { number: "20", label: "CONTACT" },
];

export const Schema = z.object({
  title: z.string().min(6).max(32).default("Table of Contents").meta({
    description: "Main centered title of the table of contents slide.",
  }),
  items: z.array(TocItemSchema).min(1).max(20).default(DEFAULT_ITEMS).meta({
    description:
      "Table-of-content entries listed on the right. Supports up to 20 items.",
  }),
});

export type SchemaType = z.infer<typeof Schema>;

function getDisplayItems(items?: SchemaType["items"]) {
  return (items?.length ? items : DEFAULT_ITEMS).slice(0, 20);
}

const EducationTableOfContentsSlide = ({
  data,
}: {
  data: Partial<SchemaType>;
}) => {
  const items = getDisplayItems(data.items);
  const isTwoColumn = items.length > 10;
  const columns = isTwoColumn ? [items.slice(0, 10), items.slice(10)] : [items];

  return (
    <>
      <link
        href="https://fonts.googleapis.com/css2?family=Source+Serif+4:ital,opsz,wght@0,8..60,200..900;1,8..60,200..900&display=swap"
        rel="stylesheet"
      />
      <div
        className="relative h-[720px] w-[1280px] overflow-hidden"
        style={{
          backgroundColor: "var(--background-color,#efeff1)",
          fontFamily: "var(--body-font-family,'Source Serif 4')",
        }}
      >
        <div className="relative z-10 grid h-full grid-cols-[430px_1fr]">
          <div
            className="px-[56px] pt-[74px]"
            style={{ backgroundColor: "var(--card-color,#f1efef)" }}
          >
            <h2
              className="font-serif text-[64px] leading-[98%] tracking-[-0.02em]"
              style={{ color: "var(--primary-color,#1a1752)" }}
            >
              {data.title || "Table of Contents"}
            </h2>
          </div>

          <div
            className={
              isTwoColumn ? "px-[66px] pt-[78px]" : "px-[88px] pt-[84px]"
            }
            style={{ backgroundColor: "var(--card-color,#FFFFFF80)" }}
          >
            <div className={isTwoColumn ? "grid grid-cols-2 gap-x-[44px]" : ""}>
              {columns.map((columnItems, columnIndex) => (
                <div
                  key={`toc-column-${columnIndex}`}
                  className={isTwoColumn ? "space-y-[14px]" : "space-y-[28px]"}
                >
                  {columnItems.map((item, index) => (
                    <div
                      key={`${item.number}-${item.label}-${columnIndex}-${index}`}
                      className="flex min-w-0 items-start gap-4"
                    >
                      <span
                        className="shrink-0 mt-1 font-semibold leading-none"
                        style={{
                          color: "var(--background-text,#3f414a)",
                          fontSize: "20px",
                        }}
                      >
                        {item.number}
                      </span>
                      <span
                        className="min-w-0 font-medium leading-[1.12]"
                        style={{
                          color: "var(--background-text,#3f414a)",

                          fontSize: "24px",
                        }}
                      >
                        {item.label}
                      </span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default EducationTableOfContentsSlide;
