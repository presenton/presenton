import * as z from "zod";

const ContactSchema = z.object({
  name: z.string().min(3).max(42).meta({
    description: "Presenter, team, department, or owner name.",
  }),
  role: z.string().min(4).max(54).meta({
    description: "Role, team label, or ownership description.",
  }),
  email: z.string().min(6).max(64).meta({
    description: "Email address or contact inbox.",
  }),
  website: z.string().min(6).max(64).meta({
    description: "Website, document link, or follow-up resource URL.",
  }),
});

const ContactItemSchema = z.object({
  label: z.string().min(3).max(16).meta({
    description: "Short label for a contact item.",
  }),
  value: z.string().min(4).max(64).meta({
    description: "Contact value, reference, link, date, or follow-up detail.",
  }),
});

export const slideLayoutId = "closing-contact-slide";
export const slideLayoutName = "Closing Contact Slide";
export const slideLayoutDescription =
  "A closing report slide with a large title, message, presenter details, and structured contact or follow-up items.";

export const Schema = z.object({
  title: z.string().min(4).max(28).default("Questions?").meta({
    description: "Main closing title.",
  }),
  message: z.string().min(20).max(180).default(
    "Thank you for reviewing the report. Use the contact details and follow-up items for questions, updates, or next-step coordination."
  ).meta({
    description: "Short closing message.",
  }),
  contact: ContactSchema.default({
    name: "Report Team",
    role: "Analysis and Reporting Owner",
    email: "report@example.com",
    website: "www.example.com/report",
  }).meta({
    description: "Primary contact information shown in the closing panel.",
  }),
  contactItems: z.array(ContactItemSchema).min(2).max(5).default([
    { label: "Email", value: "report@example.com" },
    { label: "Resource", value: "www.example.com/report" },
    { label: "Follow-up", value: "Next review cycle" },
  ]).meta({
    description: "Structured contact or follow-up items.",
  }),
});

export type SchemaType = z.infer<typeof Schema>;

const ClosingContactSlide = ({ data }: { data: Partial<SchemaType> }) => {
  const contact = data.contact;
  const contactItems = data.contactItems ?? [];

  return (
    <>
      <link href="https://fonts.googleapis.com/css2?family=Source+Sans+3:ital,wght@0,200..900;1,200..900&display=swap" rel="stylesheet" />
      <div
        className="relative h-[720px] w-[1280px] overflow-hidden rounded-[24px] bg-[#F9F8F8]"
        style={{
          backgroundColor: "var(--background-color,#F9F8F8)",
          color: "var(--background-text,#232223)",
          fontFamily: "var(--body-font-family,'Source Sans 3')",
          letterSpacing: 0,
        }}
      >
        <div
          className="absolute left-0 top-0 w-[42px] rounded-b-[22px] bg-[#157CFF]"
          style={{ height: 185, backgroundColor: "var(--primary-color,#157CFF)" }}
        />

        <div className="grid h-full grid-cols-[1fr_430px] gap-[42px] px-[64px] py-[58px]">
          <div className="flex flex-col justify-center">
            <h2 className="break-words text-[86px] font-bold leading-[0.98] tracking-normal">
              {data.title}
            </h2>
            <p
              className="mt-[28px] max-w-[680px] break-words text-[29px] leading-[1.18] text-[#4A4D53]"
              style={{ color: "var(--background-text,#4A4D53)", opacity: 0.82 }}
            >
              {data.message}
            </p>
          </div>

          <div className="flex flex-col justify-center">
            <div
              className="rounded-[30px] bg-[#157CFF] p-[32px] text-white"
              style={{
                backgroundColor: "var(--primary-color,#157CFF)",
                color: "var(--primary-text,#ffffff)",
              }}
            >
              <p className="text-[15px] font-bold uppercase leading-none opacity-80">Contact</p>
              <p className="mt-[16px] break-words text-[34px] font-bold leading-[1.02]">{contact?.name}</p>
              <p className="mt-[8px] break-words text-[20px] leading-[1.15] opacity-90">{contact?.role}</p>
              <div className="mt-[24px] grid gap-[10px]">
                <p className="break-words text-[18px] leading-[1.12]">{contact?.email}</p>
                <p className="break-words text-[18px] leading-[1.12]">{contact?.website}</p>
              </div>
            </div>

            <div
              className="mt-[18px] rounded-[24px] border border-[#D6D9DE] bg-white p-[22px]"
              style={{
                backgroundColor: "var(--card-color,#ffffff)",
                borderColor: "var(--stroke,#D6D9DE)",
                color: "var(--card-text,var(--background-text,#232223))",
              }}
            >
              <p className="text-[15px] font-bold uppercase leading-none text-[#157CFF]" style={{ color: "var(--primary-color,#157CFF)" }}>Follow-up</p>
              <div className="mt-[15px] grid gap-[10px]">
                {contactItems.map((item, index) => (
                  <div key={`${item.label}-${index}`} className="grid grid-cols-[108px_1fr] gap-[12px]">
                    <p className="break-words text-[17px] font-bold leading-[1.12] text-[#232223]" style={{ color: "inherit" }}>{item.label}</p>
                    <p className="break-words text-[17px] leading-[1.12] text-[#4A4D53]" style={{ color: "inherit", opacity: 0.78 }}>{item.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default ClosingContactSlide;
