import * as z from "zod";

export const slideLayoutId = "bullet-list-slide";
export const slideLayoutName = "Two Column Bullet List Slide";
export const slideLayoutDescription =
  "A two-column numbered string list with items.";

export const Schema = z.object({
  title: z.string().min(6).max(30).default("Usecase").meta({
    description: "Slide title shown above the numbered list.",
  }),
  items: z
    .array(z.string().min(1).max(200))
    .min(1)
    .max(8)
    .default([
      "Use pre-built component library for UI consistency",
      "Integrate REST API with TypeScript for type safety",
      "Implement real-time updates using WebSocket",
      "Deploy to production with automated CI/CD pipeline",
      "Enable role-based permissions for protected actions",
      "Generate docs automatically from route contracts",
      "Track release health with telemetry dashboards",
      "Add rollback strategy for high-risk deployments",
    ])
    .meta({
      description: "Eight use-case items shown in two columns.",
    }),
});

export type SchemaType = z.infer<typeof Schema>;

const CodeSlide07UseCaseList = ({ data }: { data: Partial<SchemaType> }) => {

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

        <div className="mt-[53px] grid flex-1 grid-cols-2 gap-[21px]">
          {data?.items?.map((item, index) => (
            <div
              key={`use-case-${index}`}
              className="flex items-center gap-[21px] rounded-[18px] border p-[28px]"
              style={{
                boxShadow: "0 33.333px 66.667px -16px rgba(0, 0, 0, 0.25)",
                borderColor: "var(--stroke,#1D293D80)",
                backgroundColor: "var(--card-color,#0F172B80)",
              }}
            >
              <span
                className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-full border text-[18px]"
                style={{
                  borderColor: "var(--primary-color,#2B7FFF4D)",
                  backgroundColor: "var(--primary-color,#2B7FFF33)",
                  color: "var(--primary-text,#51A2FF)",
                }}
              >
                {index + 1}
              </span>
              <p className="text-[18px]" style={{ color: "var(--background-text,#d5dcff)" }}>{item}</p>
            </div>
          ))}
        </div>
      </div>
    </>
  );
};

export default CodeSlide07UseCaseList;
