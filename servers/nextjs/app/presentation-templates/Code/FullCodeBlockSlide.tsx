import * as z from "zod";
import { CodeBlockPanel } from "./CodeBlockPanel";
import { PRISM_CODE_BLOCK_STYLES } from "./codeBlockFitting";

const DEFAULT_CODE_SNIPPET = {
  language: "typescript",
  fileName: "src/services/renderSlide.ts",
  content: `export function renderSlide(data) {
  return validateSchema(data);
}`,
};

export const layoutId = "full-code-block-slide";
export const layoutName = "Full Width Code Block Slide";
export const layoutDescription =
  "A title and description layout with a large formatted code block as the primary content area.";
export const slideLayoutId = layoutId;
export const slideLayoutName = layoutName;
export const slideLayoutDescription = layoutDescription;

export const Schema = z.object({
  title: z.string().min(6).max(40).default("Core Implementation").meta({
    description: "Main slide heading.",
  }),
  description: z.string().min(20).max(180).default(
    "This slide highlights the main implementation block with syntax-aware formatting."
  ).meta({
    description: "Short supporting text shown above the code block.",
  }),
  codeSnippet: z.object({
    language: z.string().min(2).max(12).default(DEFAULT_CODE_SNIPPET.language).meta({
      description: "Programming language used for syntax highlighting.",
    }),
    fileName: z.string().min(3).max(42).default(DEFAULT_CODE_SNIPPET.fileName).meta({
      description: "File name shown in the code block header.",
    }),
    content: z.string().min(40).max(1200).default(DEFAULT_CODE_SNIPPET.content).meta({
      description: "Code content displayed inside the primary block.",
    }),
  }).default(DEFAULT_CODE_SNIPPET).meta({
    description: "Formatted code block shown as the primary slide content.",
  }),
});

export type SchemaType = z.infer<typeof Schema>;

const CodeSlide12FullCodeBlock = ({ data }: { data: Partial<SchemaType> }) => {
  const codeSnippet = data.codeSnippet || DEFAULT_CODE_SNIPPET;

  return (
    <>
      <link href="https://fonts.googleapis.com/css2?family=Nunito+Sans:ital,opsz,wght@0,6..12,200..1000;1,6..12,200..1000&display=swap" rel="stylesheet" />
      <style>{PRISM_CODE_BLOCK_STYLES}</style>
      <div
        className="relative flex h-[720px] w-[1280px] flex-col overflow-hidden p-[53px]"
        style={{
          backgroundColor: "var(--background-color,#101B37)",
          fontFamily: "var(--body-font-family,Nunito Sans)",
        }}
      >
        <h2 className="shrink-0 text-[52px] font-medium leading-[105%]" style={{ color: "var(--background-text,#ffffff)" }}>
          {data.title || "Core Implementation"}
        </h2>
        <p className="mt-[12px] max-w-[980px] shrink-0 text-[21px] leading-[135%]" style={{ color: "var(--background-text,#CAD5E2)" }}>
          {data.description || "This slide highlights the main implementation block with syntax-aware formatting."}
        </p>
        <div className="mt-[22px] min-h-0 flex-1">
          <CodeBlockPanel
            title={codeSnippet.fileName}
            language={codeSnippet.language}
            content={codeSnippet.content}
            maxWidth={1130}
            maxHeight={404}
            maxFontSize={15}
            minFontSize={6}
          />
        </div>
      </div>
    </>
  );
};

export default CodeSlide12FullCodeBlock;
