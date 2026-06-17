import * as z from "zod";
import { CodeBlockPanel } from "./CodeBlockPanel";
import { PRISM_CODE_BLOCK_STYLES } from "./codeBlockFitting";

const DEFAULT_BEFORE = {
  label: "Before",
  language: "tsx",
  fileName: "OldChart.tsx",
  content: `export function RechartsChart({ data }) {
  return (
    <ResponsiveContainer>
      <LineChart data={data}>
        <XAxis dataKey="label" />
        <YAxis />
        <Line dataKey="value" />
      </LineChart>
    </ResponsiveContainer>
  );
}`,
};

const DEFAULT_AFTER = {
  label: "After",
  language: "tsx",
  fileName: "ChartRenderer.tsx",
  content: `export function ChartJSRenderer({ config }) {
  return (
    <div className="chart-frame">
      <Line data={config.data} options={config.options} />
    </div>
  );
}`,
};

export const layoutId = "code-diff-comparison-slide";
export const layoutName = "Side-by-Side Code Comparison Slide";
export const layoutDescription =
  "A title and summary layout with labeled code panels and a bottom note.";
export const slideLayoutId = layoutId;
export const slideLayoutName = layoutName;
export const slideLayoutDescription = layoutDescription;

export const Schema = z.object({
  title: z.string().min(6).max(44).default("Before / After Refactor").meta({
    description: "Main slide heading.",
  }),
  summary: z
    .string()
    .min(20)
    .max(180)
    .default(
      "This slide compares the old implementation with the improved version."
    )
    .meta({
      description: "Short supporting text shown below the title.",
    }),
  before: z
    .object({
      label: z.string().min(3).max(18).default(DEFAULT_BEFORE.label).meta({
        description: "Label for the left comparison panel.",
      }),
      language: z.string().min(2).max(12).default(DEFAULT_BEFORE.language).meta({
        description: "Programming language used for the left code block.",
      }),
      fileName: z.string().min(3).max(34).default(DEFAULT_BEFORE.fileName).meta({
        description: "File name shown for the left code block.",
      }),
      content: z.string().min(30).max(520).default(DEFAULT_BEFORE.content).meta({
        description: "Code content shown in the left panel.",
      }),
    })
    .default(DEFAULT_BEFORE)
    .meta({
      description: "Left code panel in the comparison layout.",
    }),
  after: z
    .object({
      label: z.string().min(3).max(18).default(DEFAULT_AFTER.label).meta({
        description: "Label for the right comparison panel.",
      }),
      language: z.string().min(2).max(12).default(DEFAULT_AFTER.language).meta({
        description: "Programming language used for the right code block.",
      }),
      fileName: z.string().min(3).max(34).default(DEFAULT_AFTER.fileName).meta({
        description: "File name shown for the right code block.",
      }),
      content: z.string().min(30).max(520).default(DEFAULT_AFTER.content).meta({
        description: "Code content shown in the right panel.",
      }),
    })
    .default(DEFAULT_AFTER)
    .meta({
      description: "Right code panel in the comparison layout.",
    }),
  impact: z
    .string()
    .min(12)
    .max(160)
    .default(
      "The new implementation improves reuse, testing, and template compatibility."
    )
    .meta({
      description: "Short note shown below the comparison panels.",
    }),
});

export type SchemaType = z.infer<typeof Schema>;

const CodeSlide13CodeDiffComparison = ({
  data,
}: {
  data: Partial<SchemaType>;
}) => {
  const before = { ...DEFAULT_BEFORE, ...(data.before || {}) };
  const after = { ...DEFAULT_AFTER, ...(data.after || {}) };

  return (
    <>
      <link
        href="https://fonts.googleapis.com/css2?family=Nunito+Sans:ital,opsz,wght@0,6..12,200..1000;1,6..12,200..1000&display=swap"
        rel="stylesheet"
      />
      <style>{PRISM_CODE_BLOCK_STYLES}</style>
      <div
        className="relative flex h-[720px] w-[1280px] flex-col overflow-hidden p-[53px]"
        style={{
          backgroundColor: "var(--background-color,#101B37)",
          fontFamily: "var(--body-font-family,Nunito Sans)",
        }}
      >
        <h2
          className="shrink-0 text-[50px] font-medium leading-[105%]"
          style={{ color: "var(--background-text,#ffffff)" }}
        >
          {data.title || "Before / After Refactor"}
        </h2>
        <p
          className="mt-[10px] max-w-[1060px] shrink-0 text-[20px] leading-[135%]"
          style={{ color: "var(--background-text,#CAD5E2)" }}
        >
          {data.summary ||
            "This slide compares the old implementation with the improved version."}
        </p>
        <div className="mt-[18px] grid min-h-0 flex-1 grid-cols-2 gap-[22px]">
          <CodeBlockPanel
            title={before.label}
            fileName={before.fileName}
            language={before.language}
            content={before.content}
            maxWidth={532}
            maxHeight={282}
            maxFontSize={13}
            minFontSize={6}
          />
          <CodeBlockPanel
            title={after.label}
            fileName={after.fileName}
            language={after.language}
            content={after.content}
            maxWidth={532}
            maxHeight={282}
            maxFontSize={13}
            minFontSize={6}
          />
        </div>
        <div
          className="mt-[18px] shrink-0 rounded-[14px] border px-[22px] py-[15px] text-[19px] leading-[130%]"
          style={{
            color: "var(--background-text,#d2d9ff)",
            backgroundColor: "var(--primary-color,#2B7FFF1F)",
            borderColor: "var(--primary-color,#2B7FFF66)",
          }}
        >
          {data.impact ||
            "The new implementation improves reuse, testing, and template compatibility."}
        </div>
      </div>
    </>
  );
};

export default CodeSlide13CodeDiffComparison;
