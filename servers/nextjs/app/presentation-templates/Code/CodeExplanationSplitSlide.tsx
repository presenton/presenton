import * as z from "zod";
import { fitCodeBlock, PRISM_CODE_BLOCK_STYLES } from "./codeBlockFitting";

export const slideLayoutId = "code-explanation-split-slide";
export const slideLayoutName = "Code Explanation Split Slide";
export const slideLayoutDescription =
  "A slide with a code panel on the left and description on the right.";

const DEFAULT_TITLE = "Code Breakdown";
const DEFAULT_DESCRIPTION_TITLE = "Description";
const DEFAULT_DESCRIPTION =
  "This function validates the input, creates the presentation record, and queues a background job to generate slides. Keeping validation, persistence, and job dispatch in one clear flow makes the implementation easier to explain and review.";

const DEFAULT_CODE_SNIPPET = {
  language: "typescript",
  fileName: "services/createPresentation.ts",
  content: `import { validatePresentationInput } from "@/lib/validation";
import { presentationJobs } from "@/lib/jobs";
import { prisma } from "@/lib/prisma";

export async function createPresentation(input: CreatePresentationInput) {
  const payload = validatePresentationInput(input);

  const presentation = await prisma.presentation.create({
    data: {
      title: payload.title,
      theme: payload.theme,
      ownerId: payload.ownerId,
    },
  });

  await presentationJobs.enqueue("generate-slides", {
    presentationId: presentation.id,
    outline: payload.outline,
  });

  return presentation;
}`,
};

function isWeakCodeContent(content?: string) {
  const normalizedContent = (content || "").trim();

  if (normalizedContent.length < 40) {
    return true;
  }

  if (/^(\{\}|\[\]|null|undefined|true|false)$/i.test(normalizedContent)) {
    return true;
  }

  return !/[;{}()[\]=]|=>|\b(import|export|function|const|let|class|return|await|async)\b/.test(
    normalizedContent
  );
}

const CodeSnippetSchema = z.object({
  language: z
    .string()
    .min(2)
    .max(12)
    .default(DEFAULT_CODE_SNIPPET.language)
    .meta({
      description:
        "Programming language of a real code snippet, such as typescript, tsx, javascript, python, json, bash, yaml, or sql.",
    }),
  fileName: z
    .string()
    .min(3)
    .max(36)
    .default(DEFAULT_CODE_SNIPPET.fileName)
    .meta({
      description:
        "Concrete file name with extension shown above the code snippet, for example services/createPresentation.ts.",
    }),
  content: z
    .string()
    .min(80)
    .max(900)
    .default(DEFAULT_CODE_SNIPPET.content)
    .superRefine((content, ctx) => {
      if (isWeakCodeContent(content)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "Provide a meaningful multi-line code snippet, not an empty object or placeholder.",
        });
      }
    })
    .meta({
      description:
        "Meaningful multi-line source code. Do not use {}, [], ellipses only, prose, or placeholder text.",
    }),
});

export const Schema = z.object({
  title: z.string().min(8).max(24).default(DEFAULT_TITLE).meta({
    description: "Slide heading shown at the top-left.",
  }),
  codeSnippet: CodeSnippetSchema.default(DEFAULT_CODE_SNIPPET).meta({
    description: "Code sample shown in the left panel.",
  }),
  descriptionTitle: z
    .string()
    .min(4)
    .max(20)
    .default(DEFAULT_DESCRIPTION_TITLE)
    .meta({
      description: "Heading shown above the paragraph.",
    }),
  description: z.string().min(40).max(360).default(DEFAULT_DESCRIPTION).meta({
    description: "Description paragraph shown in the right column.",
  }),
});

export type SchemaType = z.infer<typeof Schema>;

function getDisplayCodeSnippet(
  codeSnippet?: Partial<SchemaType["codeSnippet"]>
) {
  return {
    ...DEFAULT_CODE_SNIPPET,
    ...(codeSnippet || {}),
    content: isWeakCodeContent(codeSnippet?.content)
      ? DEFAULT_CODE_SNIPPET.content
      : codeSnippet?.content || DEFAULT_CODE_SNIPPET.content,
  };
}

const CodeSlide02CodeExplanationSplit = ({
  data,
}: {
  data: Partial<SchemaType>;
}) => {
  const codeSnippet = getDisplayCodeSnippet(data.codeSnippet);
  const fittedCode = fitCodeBlock({
    language: codeSnippet.language,
    content: codeSnippet.content,
    maxWidth: 506,
    maxHeight: 408,
    maxFontSize: 16,
    minFontSize: 6,
    lineHeightRatio: 1.18,
  });

  return (
    <>
      <link
        href="https://fonts.googleapis.com/css2?family=Nunito+Sans:ital,opsz,wght@0,6..12,200..1000;1,6..12,200..1000&display=swap"
        rel="stylesheet"
      />
      <style>{PRISM_CODE_BLOCK_STYLES}</style>
      <div
        className="relative h-[720px] w-[1280px] overflow-hidden p-[53px]"
        style={{
          backgroundColor: "var(--background-color,#101B37)",
          fontFamily: "var(--body-font-family,Nunito Sans)",
        }}
      >
        <div className="relative z-10 flex h-full flex-col">
          <h2
            className="text-[64px] font-medium leading-[105%]"
            style={{ color: "var(--background-text,#ffffff)" }}
          >
            {data.title || DEFAULT_TITLE}
          </h2>

          <div className="mt-[22px] grid min-h-0 flex-1 grid-cols-2 gap-[34px]">
            <div
              className="flex h-full min-h-0 flex-col overflow-hidden rounded-[18px] border"
              style={{
                backgroundColor: "var(--card-color,#0F172B80)",
                borderColor: "var(--stroke,#1D293D80)",
              }}
            >
              <p
                className="rounded-t-[18px] border px-[26px] py-3 text-[18px]"
                style={{
                  color: "var(--background-text,#CAD5E2)",
                  backgroundColor: "var(--card-color,#0F172BCC)",
                  borderColor: "var(--stroke,#1D293D80)",
                }}
              >
                {codeSnippet.fileName}
              </p>
              <div
                className="min-h-0 w-full flex-1 overflow-hidden px-[32px] py-[20px]"
                style={{
                  color: "var(--background-text,#ffffff)",
                }}
              >
                <pre
                  data-code-block="true"
                  className="prism-code-block m-0 w-full overflow-hidden"
                  style={{
                    fontFamily: fittedCode.fontFamily,
                    fontSize: `${fittedCode.fontSize}px`,
                    lineHeight: `${fittedCode.lineHeight}px`,
                    whiteSpace: "pre",
                    overflowWrap: "normal",
                    wordBreak: "normal",
                    tabSize: 2,
                  }}
                  dangerouslySetInnerHTML={{
                    __html: fittedCode.highlightedHtml,
                  }}
                />
              </div>
            </div>

            <div>
              <h3
                className="text-[24px] font-medium"
                style={{ color: "var(--background-text,#f1f4ff)" }}
              >
                {data.descriptionTitle || DEFAULT_DESCRIPTION_TITLE}
              </h3>
              <p
                className="mt-[18px] text-[22px] leading-[145%]"
                style={{ color: "var(--background-text,#d2d9ff)" }}
              >
                {data.description || DEFAULT_DESCRIPTION}
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default CodeSlide02CodeExplanationSplit;
