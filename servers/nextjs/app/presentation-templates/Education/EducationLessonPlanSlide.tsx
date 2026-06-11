import * as z from "zod";

export const slideLayoutId = "agenda-timeline-slide";
export const slideLayoutName = "Agenda Timeline Slide";
export const slideLayoutDescription =
  "A split layout with a left metadata panel and a vertical sequence of timed agenda cards.";

const AgendaItemSchema = z.object({
  time: z.string().min(3).max(12).meta({
    description: "Time, duration, or sequence label for the agenda item.",
  }),
  activity: z.string().min(4).max(28).meta({
    description: "Short activity title.",
  }),
  method: z.string().min(6).max(32).meta({
    description: "Method, channel, or format label.",
  }),
  description: z.string().min(20).max(90).meta({
    description: "Short description of what happens in this agenda item.",
  }),
});

const DEFAULT_SESSION_INFO = {
  duration: "60 minutes",
  audience: "Grade 8 Students",
  format: "Interactive Lesson",
};

const DEFAULT_AGENDA = [
  {
    time: "00-05 min",
    activity: "Warm-up",
    method: "Think-pair-share",
      description: "Learners recall prior knowledge and discuss a guiding question.",
  },
  {
    time: "05-15 min",
    activity: "Mini Lesson",
    method: "Teacher explanation",
    description: "Instructor introduces the main concept using examples and visuals.",
  },
  {
    time: "15-40 min",
    activity: "Group Task",
    method: "Collaborative work",
    description: "Students apply the concept through a structured practice activity.",
  },
  {
    time: "40-55 min",
    activity: "Review",
    method: "Class discussion",
    description: "Groups share answers while the teacher gives corrective feedback.",
  },
];

export const Schema = z.object({
  title: z.string().min(6).max(32).default("Session Agenda").meta({
    description: "Main slide title.",
  }),
  subtitle: z.string().min(20).max(130).default(
    "A structured agenda showing sequence, timing, format, and key activity details."
  ).meta({
    description: "Short subtitle explaining the agenda context.",
  }),
  sessionInfo: z.object({
    duration: z.string().min(4).max(20).default(DEFAULT_SESSION_INFO.duration).meta({
      description: "Total duration shown in the metadata panel.",
    }),
    audience: z.string().min(4).max(30).default(DEFAULT_SESSION_INFO.audience).meta({
      description: "Audience, group, cohort, or participant label.",
    }),
    format: z.string().min(4).max(30).default(DEFAULT_SESSION_INFO.format).meta({
      description: "Session format shown in the metadata panel.",
    }),
  }).default(DEFAULT_SESSION_INFO).meta({
    description: "Metadata shown in the left information panel.",
  }),
  agenda: z.array(AgendaItemSchema).min(4).max(7).default(DEFAULT_AGENDA).meta({
    description: "Time-block items shown in the vertical agenda flow.",
  }),
});

export type SchemaType = z.infer<typeof Schema>;

function getAgenda(agenda?: Array<Partial<SchemaType["agenda"][number]>>) {
  const source = agenda?.length ? agenda : DEFAULT_AGENDA;

  return source.slice(0, 7).map((item, index) => ({
    ...DEFAULT_AGENDA[index % DEFAULT_AGENDA.length],
    ...item,
  }));
}

const EducationLessonPlanSlide = ({ data }: { data: Partial<SchemaType> }) => {
  const agenda = getAgenda(data.agenda);
  const sessionInfo = { ...DEFAULT_SESSION_INFO, ...(data.sessionInfo || {}) };
  const compact = agenda.length >= 6;
  const agendaCardHeight = compact ? 78 : 94;
  const agendaGap = 12;
  const agendaDotLeft = 28;
  const agendaDotTop = agendaCardHeight / 2;
  const agendaLineHeight = (agenda.length - 1) * (agendaCardHeight + agendaGap);
  const title = data.title || "Session Agenda";
  const subtitle = data.subtitle || "A structured agenda showing sequence, timing, format, and key activity details.";

  return (
    <>
      <link href="https://fonts.googleapis.com/css2?family=Source+Serif+4:ital,opsz,wght@0,8..60,200..900;1,8..60,200..900&display=swap" rel="stylesheet" />
      <div
        className="relative grid h-[720px] w-[1280px] grid-cols-[390px_1fr] overflow-hidden"
        style={{
          backgroundColor: "var(--background-color,#efeff1)",
          fontFamily: "var(--body-font-family,'Source Serif 4')",
        }}
      >
        <div className="flex flex-col px-[56px] py-[60px]" style={{ backgroundColor: "var(--card-color,#f1efef)" }}>
          <h2 className="font-serif text-[58px] font-medium leading-[96%] tracking-[-0.02em]" style={{ color: "var(--primary-color,#1a1752)" }}>
            {title}
          </h2>
          <p className="mt-[18px] text-[21px] leading-[1.26]" style={{ color: "var(--background-text,#3a3d4c)" }}>
            {subtitle}
          </p>

          <div className="mt-auto space-y-[16px]">
            {[
              ["Duration", sessionInfo.duration],
              ["Audience", sessionInfo.audience],
              ["Format", sessionInfo.format],
            ].map(([label, value]) => (
              <div key={label} className="border-t pt-[14px]" style={{ borderColor: "var(--stroke,#d8d8dd)" }}>
                <p className="text-[15px] font-semibold uppercase tracking-[0.08em]" style={{ color: "var(--primary-color,#272272)" }}>
                  {label}
                </p>
                <p className="mt-[6px] text-[22px] font-medium leading-[1.08]" style={{ color: "var(--background-text,#34394c)" }}>
                  {value}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="px-[58px] py-[54px]">
          <div className="relative h-full">
            <div
              className="absolute w-[3px] rounded-full"
              style={{
                backgroundColor: "var(--stroke,#d8d8dd)",
                height: `${agendaLineHeight}px`,
                left: `${agendaDotLeft}px`,
                top: `${agendaDotTop}px`,
              }}
            />
            <div className="space-y-[12px]">
              {agenda.map((item, index) => (
                <div
                  key={`${item.time}-${item.activity}-${index}`}
                  className="relative grid grid-cols-[150px_1fr] gap-[24px] rounded-[16px] border px-[18px] py-[13px]"
                  style={{
                    backgroundColor: "var(--card-color,#FFFFFF80)",
                    borderColor: "var(--stroke,#d8d8dd)",
                    height: `${agendaCardHeight}px`,
                  }}
                >
                  <div className="flex items-center gap-[14px]">
                    <div className="relative z-10 h-[20px] w-[20px] rounded-full" style={{ backgroundColor: "var(--primary-color,#272272)" }} />
                    <p className="text-[18px] font-semibold leading-[1.05]" style={{ color: "var(--primary-color,#1a1752)" }}>
                      {item.time}
                    </p>
                  </div>
                  <div className="min-w-0">
                    <div className="flex min-w-0 items-baseline gap-[12px]">
                      <h3 className=" text-[22px] font-semibold leading-none" style={{ color: "var(--background-text,#34394c)" }}>
                        {item.activity}
                      </h3>
                      <p className="shrink-0 text-[15px] font-medium leading-none" style={{ color: "var(--primary-color,#272272)" }}>
                        {item.method}
                      </p>
                    </div>
                    <p
                      className="mt-[8px] leading-[1.16]"
                      style={{
                        color: "var(--background-text,#3a3d4c)",
                        fontSize: compact ? "16px" : "17px",
                        overflow: "hidden",
                      }}
                    >
                      {item.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default EducationLessonPlanSlide;
