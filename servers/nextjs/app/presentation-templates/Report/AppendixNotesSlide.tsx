import * as z from "zod";

const AppendixNoteSchema = z.object({
  label: z.string().min(3).max(28).meta({
    description: "Short appendix note label.",
  }),
  detail: z.string().min(18).max(120).meta({
    description: "Supporting appendix note detail.",
  }),
});

export const slideLayoutId = "appendix-notes-slide";
export const slideLayoutName = "Appendix Notes Slide";
export const slideLayoutDescription =
  "A report slide with appendix notes, supporting details, and compact footnotes or reference statements.";

export const Schema = z.object({
  title: z.string().min(6).max(34).default("Appendix Notes").meta({
    description: "Main slide title.",
  }),
  subtitle: z.string().min(20).max(140).default(
    "Additional context, definitions, references, or caveats that support the main report narrative."
  ).meta({
    description: "Short subtitle introducing the appendix notes.",
  }),
  notes: z.array(AppendixNoteSchema).min(3).max(6).default([
    {
      label: "Source Scope",
      detail: "Source material includes records and notes available during the stated report period.",
    },
    {
      label: "Definitions",
      detail: "Terms and labels are standardized to keep comparisons consistent across sections.",
    },
    {
      label: "Review Notes",
      detail: "Follow-up validation may be required where qualitative inputs differ from source records.",
    },
  ]).meta({
    description: "Appendix notes with labels and details.",
  }),
  footnotes: z.array(z.string().min(10).max(100).meta({
    description: "Single footnote or reference statement.",
  })).min(1).max(3).default([
    "Figures and examples should be reviewed against the latest approved source data.",
  ]).meta({
    description: "Compact footnotes or reference statements.",
  }),
});

export type SchemaType = z.infer<typeof Schema>;

const AppendixNotesSlide = ({ data }: { data: Partial<SchemaType> }) => {
  const notes = data.notes ?? [];
  const footnotes = data.footnotes ?? [];

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
            className="mt-[14px] max-w-[940px] break-words text-[23px] leading-[1.22] text-[#4A4D53]"
            style={{ color: "var(--background-text,#4A4D53)", opacity: 0.82 }}
          >
            {data.subtitle}
          </p>
        </div>

        <div
          className="mx-[64px] mt-[28px] grid gap-[18px]"
          style={{ gridTemplateColumns: notes.length > 4 ? "repeat(3, minmax(0, 1fr))" : "repeat(2, minmax(0, 1fr))" }}
        >
          {notes.map((note, index) => (
            <div
              key={`${note.label}-${index}`}
              className="rounded-[22px] border border-[#D6D9DE] bg-white p-[22px]"
              style={{
                backgroundColor: "var(--card-color,#ffffff)",
                borderColor: "var(--stroke,#D6D9DE)",
                color: "var(--card-text,var(--background-text,#232223))",
              }}
            >
              <p className="text-[14px] font-bold uppercase leading-none text-[#157CFF]" style={{ color: "var(--primary-color,#157CFF)" }}>Note {index + 1}</p>
              <p className="mt-[10px] break-words text-[25px] font-bold leading-[1.08] text-[#232223]" style={{ color: "inherit" }}>{note.label}</p>
              <p className="mt-[10px] break-words text-[18px] leading-[1.16] text-[#4A4D53]" style={{ color: "inherit", opacity: 0.78 }}>{note.detail}</p>
            </div>
          ))}
        </div>

        <div
          className="absolute bottom-[38px] left-[64px] right-[64px] rounded-[20px] bg-[#157CFF] px-[24px] py-[15px] text-white"
          style={{
            backgroundColor: "var(--primary-color,#157CFF)",
            color: "var(--primary-text,#ffffff)",
          }}
        >
          <div className="grid gap-[7px]">
            {footnotes.map((footnote, index) => (
              <p key={`footnote-${index}`} className="break-words text-[17px] leading-[1.16]">
                {index + 1}. {footnote}
              </p>
            ))}
          </div>
        </div>
      </div>
    </>
  );
};

export default AppendixNotesSlide;
