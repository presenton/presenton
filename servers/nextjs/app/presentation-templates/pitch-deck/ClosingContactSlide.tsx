import * as z from "zod";

const ContactItemSchema = z.object({
  label: z.string().min(3).max(16).meta({
    description: "Contact item label.",
  }),
  value: z.string().min(4).max(50).meta({
    description: "Contact item value.",
  }),
});

export const slideLayoutId = "closing-contact-slide";
export const slideLayoutName = "Closing Contact Slide";
export const slideLayoutDescription =
  "A pitch-deck closing layout with a large closing statement and contact or follow-up details.";

export const Schema = z.object({
  title: z.string().min(4).max(32).default("Thank You").meta({
    description: "Main closing title.",
  }),
  statement: z.string().min(24).max(105).default(
    "We are building the operating layer that helps teams make faster, clearer decisions."
  ).meta({
    description: "Closing statement or final message.",
  }),
  contactName: z.string().min(3).max(42).default("Founder Name").meta({
    description: "Primary contact name.",
  }),
  contactRole: z.string().min(4).max(36).default("Founder and CEO").meta({
    description: "Primary contact role.",
  }),
  contactItems: z.array(ContactItemSchema).min(2).max(4).default([
    { label: "Email", value: "founder@example.com" },
    { label: "Website", value: "www.example.com" },
    { label: "Follow-up", value: "Investor data room available" },
  ]).meta({
    description: "Contact or follow-up items.",
  }),
});

export type SchemaType = z.infer<typeof Schema>;

const ClosingContactSlide = ({ data }: { data: Partial<SchemaType> }) => {
  const defaults = Schema.parse({});
  const slideData = {
    ...defaults,
    ...data,
    contactItems: data.contactItems ?? defaults.contactItems,
  } as SchemaType;

  return (
    <>
      <link href="https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&display=swap" rel="stylesheet" />
      <div
        className="relative h-[720px] w-[1280px] overflow-hidden px-[46px] py-[58px]"
        style={{
          backgroundColor: "var(--background-color,#27292d)",
          color: "var(--background-text,#d7d3be)",
          fontFamily: "var(--body-font-family,'DM Serif Display')",
          letterSpacing: 0,
        }}
      >
        <div className="flex h-full flex-col justify-between">
          <div>
            <h2 className="break-words text-[98px] leading-none" style={{ color: "var(--background-text,#dddac7)" }}>
              {slideData.title}
            </h2>
            <p className="mt-[52px] max-w-[930px] break-words text-[58px] leading-[1.07]" style={{ color: "var(--background-text,#d7d3be)" }}>
              {slideData.statement}
            </p>
          </div>

          <div className="grid grid-cols-[360px_1fr] gap-[52px] border-t pt-[26px]" style={{ borderColor: "var(--stroke,#8d8a7d)" }}>
            <div>
              <p className="break-words text-[30px] leading-none" style={{ color: "var(--background-text,#dddac7)" }}>{slideData.contactName}</p>
              <p className="mt-[8px] break-words text-[22px] leading-[1.12]" style={{ color: "var(--background-text,#cbc7b2)" }}>{slideData.contactRole}</p>
            </div>
            <div className="grid gap-x-[30px] gap-y-[14px]" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
              {slideData.contactItems.map((item, index) => (
                <div key={`${item.label}-${index}`}>
                  <p className="break-words text-[18px] uppercase leading-none" style={{ color: "var(--primary-color,#dddac7)" }}>{item.label}</p>
                  <p className="mt-[8px] break-words text-[21px] leading-[1.12]" style={{ color: "var(--background-text,#d7d3be)" }}>{item.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default ClosingContactSlide;
