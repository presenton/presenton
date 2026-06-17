import * as z from "zod";

const ActionItemSchema = z.object({
  action: z.string().min(6).max(42).meta({
    description: "Action item or next step.",
  }),
  owner: z.string().min(3).max(26).meta({
    description: "Owner, role, team, or accountable group.",
  }),
  timeline: z.string().min(3).max(20).meta({
    description: "Timing, duration, phase, or target date label.",
  }),
  status: z.string().min(3).max(18).meta({
    description: "Current status, priority, or readiness label.",
  }),
  measure: z.string().min(8).max(60).meta({
    description: "Success measure, output, or checkpoint for the action.",
  }),
});

export const slideLayoutId = "action-plan-table-slide";
export const slideLayoutName = "Action Plan Table Slide";
export const slideLayoutDescription =
  "A report slide with a title, subtitle, and compact action table covering action, owner, timing, status, and measure.";

export const Schema = z.object({
  title: z.string().min(6).max(34).default("Action Plan").meta({
    description: "Main slide title.",
  }),
  subtitle: z.string().min(20).max(140).default(
    "A structured next-step table that connects recommended actions to owners, timing, status, and measures."
  ).meta({
    description: "Short subtitle introducing the action plan.",
  }),
  actions: z.array(ActionItemSchema).min(3).max(6).default([
    {
      action: "Confirm priority scope",
      owner: "Report Lead",
      timeline: "Week 1",
      status: "Ready",
      measure: "Approved priority list",
    },
    {
      action: "Assign accountable owners",
      owner: "Operations",
      timeline: "Week 1-2",
      status: "Planned",
      measure: "Owner map completed",
    },
    {
      action: "Review progress signals",
      owner: "Working Group",
      timeline: "Monthly",
      status: "Ongoing",
      measure: "Status reviewed on cadence",
    },
  ]).meta({
    description: "Action rows shown in the table.",
  }),
});

export type SchemaType = z.infer<typeof Schema>;

const ActionPlanSlide = ({ data }: { data: Partial<SchemaType> }) => {
  const actions = data.actions ?? [];

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

        <div className="px-[64px] pt-[48px]">
          <h2 className="break-words text-[58px] font-bold leading-[1.02] tracking-normal">
            {data.title}
          </h2>
          <p
            className="mt-[14px] max-w-[960px] break-words text-[23px] leading-[1.22] text-[#4A4D53]"
            style={{ color: "var(--background-text,#4A4D53)", opacity: 0.82 }}
          >
            {data.subtitle}
          </p>
        </div>

        <div
          className="mx-[64px] mt-[30px] rounded-[28px] bg-white p-[20px]"
          style={{
            backgroundColor: "var(--card-color,#ffffff)",
            color: "var(--card-text,var(--background-text,#232223))",
          }}
        >
          <div
            className="grid grid-cols-[1.25fr_0.8fr_0.75fr_0.7fr_1.1fr] rounded-t-[16px] bg-[#157CFF] px-[20px] py-[13px] text-[15px] font-bold uppercase leading-none text-white"
            style={{
              backgroundColor: "var(--primary-color,#157CFF)",
              color: "var(--primary-text,#ffffff)",
            }}
          >
            <p>Action</p>
            <p>Owner</p>
            <p>Timing</p>
            <p>Status</p>
            <p>Measure</p>
          </div>
          <div className="grid">
            {actions.map((action, index) => (
              <div
                key={`${action.action}-${index}`}
                className="grid min-h-[68px] grid-cols-[1.25fr_0.8fr_0.75fr_0.7fr_1.1fr] items-start border-b border-[#E3E4E8] px-[20px] py-[15px] last:border-b-0"
                style={{ borderColor: "var(--stroke,#E3E4E8)" }}
              >
                <p className="break-words text-[21px] font-bold leading-[1.1] text-[#232223]" style={{ color: "inherit" }}>{action.action}</p>
                <p className="break-words text-[18px] leading-[1.14] text-[#4A4D53]" style={{ color: "inherit", opacity: 0.78 }}>{action.owner}</p>
                <p className="break-words text-[18px] leading-[1.14] text-[#4A4D53]" style={{ color: "inherit", opacity: 0.78 }}>{action.timeline}</p>
                <p className="break-words text-[17px] font-bold leading-[1.14] text-[#157CFF]" style={{ color: "var(--primary-color,#157CFF)" }}>{action.status}</p>
                <p className="break-words text-[17px] leading-[1.14] text-[#4A4D53]" style={{ color: "inherit", opacity: 0.78 }}>{action.measure}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
};

export default ActionPlanSlide;
