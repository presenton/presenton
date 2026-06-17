import * as z from "zod";

export const slideLayoutId = "closing-actions-contact-slide";
export const slideLayoutName = "Closing Actions and Contact Slide";
export const slideLayoutDescription =
  "A closing layout with a large message area, action cards, and contact details.";

const ActionSchema = z.object({
  label: z.string().max(28).meta({
    description: "Short next-step action label.",
  }),
  detail: z.string().max(60).meta({
    description: "Short explanation of what should happen for this action.",
  }),
});

const ContactSchema = z
  .object({
    name: z.string().max(42).meta({
      description: "Contact person, team, or company name.",
    }),
    email: z.string().max(60).meta({
      description: "Follow-up email address.",
    }),
    website: z.string().max(60).meta({
      description: "Website or landing page.",
    }),
  })
  .optional();

const DEFAULT_ACTIONS = [
  {
    label: "Book a Demo Book a Demo ",
    detail:
      "Walk through the core workflows with your product and operations stakeholders. nd operations stakeholders.",
  },
  {
    label: "Start Pilot",
    detail:
      "Select one team, one workflow, and one success metric for a focused trial.",
  },
  {
    label: "Review Fit",
    detail:
      "Compare integration needs, adoption effort, pricing, and expected impact.",
  },
];

const DEFAULT_CONTACT = {
  name: "Product Team",
  email: "hello@example.com",
  website: "www.example.com",
};

export const Schema = z.object({
  title: z.string().max(34).default("Next Steps").meta({
    description: "Main closing slide title.",
  }),
  message: z
    .string()

    .max(170)
    .default(
      "Walk through the core workflows with your product and operations stakeholders.Move from overview to action with a guided demo, a focused pilot, and a clear evaluation plan."
    )
    .meta({
      description: "Short closing message for the audience.",
    }),
  actions: z.array(ActionSchema).max(4).default(DEFAULT_ACTIONS).meta({
    description: "Action cards shown in the main content area.",
  }),
  contact: ContactSchema.default(DEFAULT_CONTACT).meta({
    description: "Contact details shown in the closing area.",
  }),
});

export type SchemaType = z.infer<typeof Schema>;

const NextStepsSlide = ({ data }: { data: Partial<SchemaType> }) => {
  const actions = data.actions?.length
    ? data.actions.slice(0, 4)
    : DEFAULT_ACTIONS;
  const contact = { ...DEFAULT_CONTACT, ...(data.contact || {}) };
  const title = data.title || "Next Steps";
  const titleFontSize = title.length > 26 ? 78 : 92;
  const message =
    data.message ||
    "Move from overview to action with a guided demo, a focused pilot, and a clear evaluation plan.";

  return (
    <>
      <link
        href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,200..800&display=swap"
        rel="stylesheet"
      />
      <div
        className="relative h-[720px] w-[1280px] overflow-hidden"
        style={{
          backgroundColor: "var(--background-color,#DAE1DE)",
          fontFamily: "var(--body-font-family,'Bricolage Grotesque')",
        }}
      >
        <div
          className="absolute inset-y-0 left-0 w-[430px]"
          style={{ backgroundColor: "var(--primary-color,#15342D)" }}
        />
        <div className="relative grid h-full grid-cols-[430px_1fr]">
          <div className="flex flex-col px-[56px] py-[62px]">
            <h2
              className="mt-[24px] font-semibold leading-[0.96]"
              style={{
                color: "var(--primary-text,#edf2f1)",
                fontSize: `${titleFontSize}px`,
                letterSpacing: 0,
              }}
            >
              {title}
            </h2>
            <p
              className="mt-[28px] overflow-hidden text-[24px] leading-[1.22]"
              style={{
                color: "var(--primary-text,#edf2f1)",
              }}
            >
              {message}
            </p>
          </div>

          <div className="flex min-w-0 flex-col px-[52px] py-[58px]">
            <div
              className="grid gap-[18px]"
              style={{
                gridTemplateColumns:
                  actions.length > 2 ? "repeat(2, minmax(0, 1fr))" : "1fr",
              }}
            >
              {actions.map((action, index) => (
                <div
                  key={`${action.label}-${index}`}
                  className="flex  min-w-0 flex-col rounded-[22px] border p-[24px]"
                  style={{
                    backgroundColor: "var(--card-color,#ffffff)",
                    borderColor: "var(--stroke,#c5cccb)",
                  }}
                >
                  <div className="flex items-center gap-[14px]">
                    <span
                      className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full text-[17px] font-semibold"
                      style={{
                        backgroundColor: "var(--primary-color,#15342D)",
                        color: "var(--primary-text,#edf2f1)",
                      }}
                    >
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <h3
                      className="overflow-hidden text-[28px] font-semibold leading-[1.04]"
                      style={{
                        color: "var(--primary-color,#15342D)",
                      }}
                    >
                      {action.label}
                    </h3>
                  </div>
                  <p
                    className="mt-[16px] overflow-hidden text-[18px] leading-[1.18]"
                    style={{
                      color: "var(--background-text,#15342DCC)",
                    }}
                  >
                    {action.detail}
                  </p>
                </div>
              ))}
            </div>

            <div
              className="mt-auto grid grid-cols-3 gap-[18px] rounded-[22px] border p-[24px]"
              style={{
                backgroundColor: "var(--card-color,#ffffff)",
                borderColor: "var(--stroke,#c5cccb)",
              }}
            >
              {[
                ["Contact", contact.name],
                ["Email", contact.email],
                ["Website", contact.website],
              ].map(([label, value]) => (
                <div key={label} className="min-w-0">
                  <p
                    className="text-[14px] font-semibold uppercase tracking-[0.1em]"
                    style={{ color: "var(--primary-color,#15342D)" }}
                  >
                    {label}
                  </p>
                  <p
                    className="mt-[8px] overflow-hidden text-[16px] leading-[1.14]"
                    style={{
                      color: "var(--background-text,#15342DCC)",
                    }}
                  >
                    {value}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default NextStepsSlide;
