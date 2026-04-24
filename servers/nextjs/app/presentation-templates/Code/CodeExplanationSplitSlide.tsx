import * as z from "zod";
import { fitCodeBlock, PRISM_CODE_BLOCK_STYLES } from "./codeBlockFitting";

export const slideLayoutId = "code-explanation-split-slide";
export const slideLayoutName = "Code Explanation Split Slide";
export const slideLayoutDescription =
  "A two-column slide with a code panel on the left and description on the right.";

export const Schema = z.object({
  title: z.string().min(8).max(24).default("Code + Explanation").meta({
    description: "Slide heading shown at the top-left.",
  }),
  codeSnippet: z.object({
    language: z.string().min(2).max(10).meta({
      description: "Programming language of the snippet",
    }),
    fileName: z.string().min(3).max(30).meta({
      description: "File name label shown above the code snippet.",
    }),
    content: z.string().min(20).max(520).meta({
      description: "The actual code content to be displayed.",
    }),
  }).default({
    language: "tsx",
    fileName: "components/UserAuth.tsx",
    content: `import { useState } from "react";
import { login } from "@/lib/auth";

export function UserAuth() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const user = await login(email, password);
    console.log("Logged in:", user);
  };

  return null;
}
  
`,
  }).meta({
    description: "Code sample shown in the left panel.",
  }),
  descriptionTitle: z.string().min(4).max(20).default("Description").meta({
    description: "Heading shown above the paragraph.",
  }),
  description: z
    .string()
    .min(40)
    .max(360)
    .default(
      "This component manages credentials as local state and submits them through an async handler. The login utility abstracts network details while the handler keeps the UI flow predictable. Keep validation and side effects isolated so changes remain safe when authentication requirements evolve. "
    )
    .meta({
      description: "Description paragraph shown in the right column.",
    }),
});

export type SchemaType = z.infer<typeof Schema>;

const CodeSlide02CodeExplanationSplit = ({
  data,
}: {
  data: Partial<SchemaType>;
}) => {
  const fittedCode = fitCodeBlock({
    language: data.codeSnippet?.language,
    content: data.codeSnippet?.content,
    maxWidth: 506,
    maxHeight: 430,
    maxFontSize: 16,
    minFontSize: 8,
  });

  return (
    <>
      <link href="https://fonts.googleapis.com/css2?family=Nunito+Sans:ital,opsz,wght@0,6..12,200..1000;1,6..12,200..1000&display=swap" rel="stylesheet" />
      <style>{PRISM_CODE_BLOCK_STYLES}</style>
      <div
        className="relative h-[720px] w-[1280px] overflow-hidden p-[53px]"
        style={{
          backgroundColor: "var(--background-color,#101B37)",
          fontFamily: "var(--body-font-family,Nunito Sans)",
        }}
      >

        <div className="relative z-10 flex h-full flex-col">
          <h2 className="text-[64px] font-medium" style={{ color: "var(--background-text,#ffffff)" }}>{data.title}</h2>

          <div className="mt-[22px] grid min-h-0  flex-1 grid-cols-2 gap-[34px]">
            <div
              className="flex h-full min-h-0 flex-col overflow-hidden rounded-[18px] border"
              style={{
                backgroundColor: "var(--card-color,#0F172B80)",
                borderColor: "var(--stroke,#1D293D80)",
              }}
            >
              <p
                className="text-[18px] capitalize rounded-t-[18px] border px-[26px] py-3"
                style={{
                  color: "var(--background-text,#CAD5E2)",
                  backgroundColor: "var(--card-color,#0F172BCC)",
                  borderColor: "var(--stroke,#1D293D80)",
                }}
              >
                {data.codeSnippet?.fileName}
              </p>
              <div
                className="min-h-0 w-full flex-1 overflow-hidden px-[32px] py-[20px]"
                style={{
                  color: "var(--background-text,#ffffff)",
                }}
              >
                <pre
                  className="prism-code-block m-0 w-full overflow-hidden"
                  style={{
                    fontFamily: fittedCode.fontFamily,
                    fontSize: `${fittedCode.fontSize}px`,
                    lineHeight: `${fittedCode.lineHeight}px`,
                    whiteSpace: "pre-wrap",
                    overflowWrap: "break-word",
                    wordBreak: "normal",
                    tabSize: 2,
                  }}
                  dangerouslySetInnerHTML={{ __html: fittedCode.highlightedHtml }}
                />
              </div>
            </div>

            <div className=" ">
              <h3 className="text-[24px] font-medium" style={{ color: "var(--background-text,#f1f4ff)" }}>{data.descriptionTitle}</h3>
              <p className="mt-[18px] text-[22px] leading-[145%]" style={{ color: "var(--background-text,#d2d9ff)" }}>
                {data.description}
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default CodeSlide02CodeExplanationSplit;
