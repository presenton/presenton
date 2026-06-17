import * as z from "zod";
import { ImageSchema } from "../defaultSchemes";

export const slideLayoutId = "closing-contact-slide";
export const slideLayoutName = "Closing Contact Slide";
export const slideLayoutDescription =
  "A closing layout with a large title, message, contact details, and an optional image area.";

const DEFAULT_PRESENTER = {
  name: "Dr. Maya Sharma",
  role: "Program Coordinator",
  email: "maya@example.edu",
  website: "www.example.edu",
};

const DEFAULT_CONTACT_ITEMS = [
  { label: "Email", value: "maya@example.edu" },
  { label: "Website", value: "www.example.edu" },
  { label: "Office", value: "Academic Block, Room 204" },
];

export const Schema = z.object({
  title: z.string().min(4).max(28).default("Questions?").meta({
    description: "Main closing title, e.g. Questions?, Thank You, Next Steps.",
  }),
  message: z
    .string()
    .min(20)
    .max(180)
    .default(
      "Thank you for participating. Please reach out for course materials, admissions details, or follow-up discussion."
    )
    .meta({
      description: "Short closing message.",
    }),
  presenter: z
    .object({
      name: z.string().min(3).max(40).default(DEFAULT_PRESENTER.name).meta({
        description: "Person, team, or organization name.",
      }),
      role: z.string().min(4).max(50).default(DEFAULT_PRESENTER.role).meta({
        description: "Role, title, department, or affiliation.",
      }),
      email: z.string().min(6).max(60).default(DEFAULT_PRESENTER.email).meta({
        description: "Contact email address.",
      }),
      website: z.string().min(6).max(60).default(DEFAULT_PRESENTER.website).meta({
        description: "Contact website or landing page.",
      }),
    })
    .default(DEFAULT_PRESENTER)
    .meta({
      description: "Primary contact details shown in the closing area.",
    }),
  contactItems: z
    .array(
      z.object({
        label: z.string().min(3).max(16).meta({
          description: "Contact label such as Email, Website, Office, Phone.",
        }),
        value: z.string().min(4).max(60).meta({
          description: "Contact value.",
        }),
      })
    )
    .min(2)
    .max(5)
    .default(DEFAULT_CONTACT_ITEMS)
    .meta({
      description: "Additional contact items shown as labeled follow-up details.",
    }),
  image: ImageSchema.optional().meta({
    description:
      "Optional QR code, supporting image, portrait, or logo.",
  }),
});

export type SchemaType = z.infer<typeof Schema>;

function QRPlaceholder() {
  return (
    <div
      className="grid h-[246px] w-[246px] grid-cols-5 grid-rows-5 gap-[10px] rounded-[18px] border p-[20px]"
      style={{
        backgroundColor: "var(--card-color,#FFFFFF80)",
        borderColor: "var(--stroke,#d8d8dd)",
      }}
    >
      {Array.from({ length: 25 }).map((_, index) => {
        const filled = [
          0, 1, 3, 4, 5, 9, 10, 12, 14, 15, 17, 18, 20, 21, 23, 24,
        ].includes(index);

        return (
          <span
            key={index}
            className="rounded-[4px]"
            style={{
              backgroundColor: filled
                ? "var(--primary-color,#272272)"
                : "transparent",
            }}
          />
        );
      })}
    </div>
  );
}

const EducationQAContactSlide = ({ data }: { data: Partial<SchemaType> }) => {
  const presenter = { ...DEFAULT_PRESENTER, ...(data.presenter || {}) };
  const contactItems = data.contactItems?.length
    ? data.contactItems.slice(0, 5)
    : DEFAULT_CONTACT_ITEMS;
  const title = data.title || "Questions?";
  const message =
    data.message ||
    "Thank you for participating. Please reach out for course materials, admissions details, or follow-up discussion.";

  return (
    <>
      <link
        href="https://fonts.googleapis.com/css2?family=Source+Serif+4:ital,opsz,wght@0,8..60,200..900;1,8..60,200..900&display=swap"
        rel="stylesheet"
      />
      <div
        className="relative grid h-[720px] w-[1280px] grid-cols-[1fr_380px] overflow-hidden"
        style={{
          backgroundColor: "var(--background-color,#efeff1)",
          fontFamily: "var(--body-font-family,'Source Serif 4')",
        }}
      >
        <div className="flex flex-col px-[70px] py-[72px]">
          <p
            className="text-[18px] font-semibold uppercase tracking-[0.1em]"
            style={{ color: "var(--primary-color,#272272)" }}
          >
            Thank you
          </p>
          <h2
            className="mt-[18px] font-serif text-[86px] font-medium leading-[92%] tracking-[-0.02em]"
            style={{ color: "var(--primary-color,#1a1752)" }}
          >
            {title}
          </h2>
          <p
            className="mt-[24px] max-w-[760px] text-[25px] leading-[1.28]"
            style={{ color: "var(--background-text,#3a3d4c)" }}
          >
            {message}
          </p>

          <div className="mt-auto grid grid-cols-[310px_1fr] gap-[32px]">
            <div>
              <p
                className="text-[28px] font-semibold leading-[1.08]"
                style={{ color: "var(--primary-color,#1a1752)" }}
              >
                {presenter.name}
              </p>
              <p
                className="mt-[8px] text-[20px] leading-[1.18]"
                style={{ color: "var(--background-text,#3a3d4c)" }}
              >
                {presenter.role}
              </p>
              <p
                className="mt-[18px] text-[18px] leading-[1.18]"
                style={{ color: "var(--background-text,#34394c)" }}
              >
                {presenter.email}
              </p>
              <p
                className="mt-[6px] text-[18px] leading-[1.18]"
                style={{ color: "var(--background-text,#34394c)" }}
              >
                {presenter.website}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-x-[22px] gap-y-[12px]">
              {contactItems.map((item, index) => (
                <div
                  key={`${item.label}-${index}`}
                  className="border-t pt-[10px]"
                  style={{ borderColor: "var(--stroke,#d8d8dd)" }}
                >
                  <p
                    className="text-[14px] font-semibold uppercase tracking-[0.08em]"
                    style={{ color: "var(--primary-color,#272272)" }}
                  >
                    {item.label}
                  </p>
                  <p
                    className="mt-[5px] leading-[1.12]"
                    style={{
                      color: "var(--background-text,#34394c)",
                      fontSize: "17px",
                      overflow: "hidden",
                    }}
                  >
                    {item.value}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {data.image && (
          <div
            className="flex items-center justify-center"
            style={{ backgroundColor: "var(--card-color,#f1efef)" }}
          >
            {data.image?.__image_url__ ? (
              <img
                src={data.image.__image_url__}
                alt={data.image.__image_prompt__}
                className="h-[300px] w-[300px] rounded-[18px] object-cover"
              />
            ) : (
              <div className="text-center">
                <QRPlaceholder />
                <p
                  className="mt-[18px] text-[18px] font-medium leading-[1.18]"
                  style={{ color: "var(--background-text,#3a3d4c)" }}
                >
                  Scan for materials
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
};

export default EducationQAContactSlide;
