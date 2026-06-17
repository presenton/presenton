import * as z from "zod";
import { CodeBlockPanel } from "./CodeBlockPanel";
import { PRISM_CODE_BLOCK_STYLES } from "./codeBlockFitting";

const DEFAULT_CODE = {
  label: "Code",
  language: "typescript",
  fileName: "transform.ts",
  content: `export function normalizeSlide(input: SlideSchema) {
  return {
    id: crypto.randomUUID(),
    layout: input.layout,
    title: input.title.trim(),
    blocks: input.blocks.map((block) => ({
      ...block,
      text: clampText(block.text, block.maxLength),
    })),
  };
}`,
};

const DEFAULT_OUTPUT = {
  label: "Output",
  language: "json",
  content: `{
  "id": "slide_01",
  "layout": "code-output-slide",
  "title": "Schema Input to Rendered Output",
  "blocks": [
    {
      "type": "code",
      "text": "export function normalizeSlide..."
    }
  ]
}`,
};

export const layoutId = "code-output-slide";
export const layoutName = "Code and Result Panels Slide";
export const layoutDescription =
  "A title and summary layout with formatted content panels and a bottom note.";
export const slideLayoutId = layoutId;
export const slideLayoutName = layoutName;
export const slideLayoutDescription = layoutDescription;

export const Schema = z.object({
  title: z.string().min(6).max(44).default("Code to Output").meta({
    description: "Main slide heading.",
  }),
  summary: z
    .string()
    .min(20)
    .max(180)
    .default(
      "This slide shows how the implementation transforms input data into output."
    )
    .meta({
      description: "Short supporting text shown below the title.",
    }),
  code: z
    .object({
      label: z.string().min(3).max(20).default(DEFAULT_CODE.label).meta({
        description: "Panel label for the code block.",
      }),
      language: z.string().min(2).max(12).default(DEFAULT_CODE.language).meta({
        description: "Programming language used for the code block.",
      }),
      fileName: z.string().min(3).max(34).default(DEFAULT_CODE.fileName).meta({
        description: "File name shown for the code block.",
      }),
      content: z.string().min(30).max(620).default(DEFAULT_CODE.content).meta({
        description: "Code content shown in the left panel.",
      }),
    })
    .default(DEFAULT_CODE)
    .meta({
      description: "Left formatted content panel.",
    }),
  output: z
    .object({
      label: z.string().min(3).max(20).default(DEFAULT_OUTPUT.label).meta({
        description: "Panel label for the output block.",
      }),
      language: z.string().min(2).max(12).default(DEFAULT_OUTPUT.language).meta({
        description: "Output language or format used for syntax highlighting.",
      }),
      content: z.string().min(12).max(520).default(DEFAULT_OUTPUT.content).meta({
        description: "Result content shown in the right panel.",
      }),
    })
    .default(DEFAULT_OUTPUT)
    .meta({
      description: "Right formatted content panel.",
    }),
  insight: z
    .string()
    .min(12)
    .max(160)
    .default(
      "The output verifies that the transformation is deterministic and export-safe."
    )
    .meta({
      description: "Short note shown below the content panels.",
    }),
});

export type SchemaType = z.infer<typeof Schema>;

const CodeSlide16CodeOutput = ({ data }: { data: Partial<SchemaType> }) => {
  const code = { ...DEFAULT_CODE, ...(data.code || {}) };
  const output = { ...DEFAULT_OUTPUT, ...(data.output || {}) };

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
          {data.title || "Code to Output"}
        </h2>
        <p
          className="mt-[10px] max-w-[1050px] shrink-0 text-[20px] leading-[135%]"
          style={{ color: "var(--background-text,#CAD5E2)" }}
        >
          {data.summary ||
            "This slide shows how the implementation transforms input data into output."}
        </p>
        <div className="mt-[20px] grid min-h-0 flex-1 grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] gap-[22px]">
          <CodeBlockPanel
            title={code.label}
            fileName={code.fileName}
            language={code.language}
            content={code.content}
            maxWidth={616}
            maxHeight={298}
            maxFontSize={13}
            minFontSize={6}
          />
          <CodeBlockPanel
            title={output.label}
            language={output.language}
            content={output.content}
            maxWidth={440}
            maxHeight={298}
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
          {data.insight ||
            "The output verifies that the transformation is deterministic and export-safe."}
        </div>
      </div>
    </>
  );
};

export default CodeSlide16CodeOutput;
