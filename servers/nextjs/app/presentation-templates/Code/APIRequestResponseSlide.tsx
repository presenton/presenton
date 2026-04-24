import * as z from "zod";
import { fitCodeBlock, PRISM_CODE_BLOCK_STYLES } from "./codeBlockFitting";


export const slideLayoutId = "api-request-response-slide";
export const slideLayoutName = "API Request Response Slide";
export const slideLayoutDescription =
  "An API-focused slide with endpoint metadata, request payload, and response payload.";

export const Schema = z.object({
  title: z.string().min(8).max(26).default("API Request / Response").meta({
    description: "Main heading shown at the top-left.",
  }),
  method: z.enum(["GET", "POST", "PATCH", "DELETE"]).default("POST").meta({
    description: "HTTP method badge text.",
  }),
  endpoint: z.string().min(8).max(48).default("/api/v1/users/authenticate").meta({
    description: "Endpoint path text.",
  }),
  headers: z
    .array(z.string().max(10))
    .min(2)
    .max(2)
    .default(["Content-Type: application/json", "Authorization: Bearer <token>"])
    .meta({
      description: "Two header lines shown in the endpoint card.",
    }),
  requestSnippet: z.object({
    language: z.string().min(2).max(10),
    fileName: z.string().min(3).max(24),
    content: z.string().min(20).max(500),
  }).default({
    language: "json",
    fileName: "request.json",
    content: `{
  "email": "user@example.com user@example.com user@example.com user@example.com user@example.com" ,
  "password": "securepassword123"
}`,
  }).meta({
    description: "Request payload example.",
  }),
  responseSnippet: z.object({
    language: z.string().min(2).max(10),
    fileName: z.string().min(3).max(24),
    content: z.string().min(20).max(620),
  }).default({
    language: "json",
    fileName: "response.json",
    content: `{
  "success": true,
  "user": {
    "id": "usr_1234567890",
    "email": "user@example.com",
    "name": "John Doe",
    "role": "admin"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": 3600
}`,
  }).meta({
    description: "Response payload example.",
  }),
});

export type SchemaType = z.infer<typeof Schema>;

function normalizeApiJsonSnippet(content?: string) {
  return (content || "")
    .replace(/\r\n?/g, "\n")
    .replace(/^\s*\/\s*$/gm, ",")
    .replace(/\n\s*:\s*\n\s*/g, ": ")
    .replace(/\n\s*\/\s*\n/g, ",\n")
    .replace(/,\s*([}\]])/g, "$1")
    .trimEnd();
}

const CodeSlide03ApiRequestResponse = ({
  data,
}: {
  data: Partial<SchemaType>;
}) => {
  const requestCode = fitCodeBlock({
    language: "json",
    content: normalizeApiJsonSnippet(data.requestSnippet?.content),
    maxWidth: 540,
    maxHeight: 230,
    maxFontSize: 14,
    minFontSize: 8,
  });

  const responseCode = fitCodeBlock({
    language: "json",
    content: normalizeApiJsonSnippet(data.responseSnippet?.content),
    maxWidth: 540,
    maxHeight: 430,
    maxFontSize: 14,
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

          <div className="mt-[22px] grid min-h-0 flex-1 grid-cols-2 gap-[22px]">
            <div className="flex min-h-0 flex-col gap-[12px]">
              <div
                className="rounded-[14px] border p-[14px]"
                style={{
                  borderColor: "var(--stroke,#1D293D80)",
                  backgroundColor: "var(--card-color,#0F172B80)",
                }}
              >
                <div className="flex items-center gap-5 pb-[14px] border-b" style={{ borderColor: "var(--stroke,#1D293D80)" }}>
                  <p
                    className="rounded-[12px] px-[23px] py-[10px] text-[14px] uppercase tracking-[0.06em]"
                    style={{
                      backgroundColor: "var(--primary-color,#2B7FFF33)",
                      color: "var(--primary-text,#51A2FF)",
                    }}
                  >
                    {data.method}
                  </p>
                  <p className="text-[23px]" style={{ color: "var(--background-text,#dde5ff)" }}>{data.endpoint}</p>
                </div>
                <p className="mt-[21px] text-[18px] uppercase tracking-[0.08em]" style={{ color: "var(--background-text,#90a1d8)" }}>Headers</p>
                <div className="mt-[15px] space-y-[4px] text-[24px]" style={{ color: "var(--background-text,#cbd4f8)" }}>
                  {data.headers?.map((item) => (
                    <p key={item} className="text-[18px]" style={{ color: "var(--background-text,#CAD5E2)" }}>{item}</p>
                  ))}
                </div>
              </div>

              <div
                className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[18px] border"
                style={{
                  backgroundColor: "var(--card-color,#0F172B80)",
                  borderColor: "var(--stroke,#1D293D80)",
                }}
              >
                <p
                  className="text-[18px] capitalize rounded-t-[18px] border p-[14px]"
                  style={{
                    color: "var(--background-text,#CAD5E2)",
                    backgroundColor: "var(--card-color,#1D293D80)",
                    borderColor: "var(--stroke,#1D293D80)",
                  }}
                >
                  {data.requestSnippet?.fileName}
                </p>
                <div className="min-h-0 w-full flex-1 overflow-hidden px-[14px] py-[20px]">
                  <pre
                    className="prism-code-block m-0 w-full overflow-hidden"
                    style={{
                      color: "var(--background-text,#ffffff)",
                      fontFamily: requestCode.fontFamily,
                      fontSize: `${requestCode.fontSize}px`,
                      lineHeight: `${requestCode.lineHeight}px`,
                      whiteSpace: "pre-wrap",
                      overflowWrap: "break-word",
                      wordBreak: "normal",
                      tabSize: 2,
                    }}
                    dangerouslySetInnerHTML={{ __html: requestCode.highlightedHtml }}
                  />
                </div>
              </div>
            </div>

            <div
              className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[18px] border"
              style={{
                backgroundColor: "var(--card-color,#0F172B80)",
                borderColor: "var(--stroke,#1D293D80)",
              }}
            >
              <p
                className="text-[18px] capitalize rounded-t-[18px] border p-[14px]"
                style={{
                  color: "var(--background-text,#CAD5E2)",
                  backgroundColor: "var(--card-color,#1D293D80)",
                  borderColor: "var(--stroke,#1D293D80)",
                }}
              >
                {data.responseSnippet?.fileName}
              </p>
              <div className="min-h-0 w-full flex-1 overflow-hidden px-[14px] py-[20px]">
                <pre
                  className="prism-code-block m-0 w-full overflow-hidden"
                  style={{
                    color: "var(--background-text,#ffffff)",
                    fontFamily: responseCode.fontFamily,
                    fontSize: `${responseCode.fontSize}px`,
                    lineHeight: `${responseCode.lineHeight}px`,
                    whiteSpace: "pre-wrap",
                    overflowWrap: "break-word",
                    wordBreak: "normal",
                    tabSize: 2,
                  }}
                  dangerouslySetInnerHTML={{ __html: responseCode.highlightedHtml }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default CodeSlide03ApiRequestResponse;
