import { fitCodeBlock } from "./codeBlockFitting";

interface CodeBlockPanelProps {
  title?: string;
  fileName?: string;
  language?: string;
  content?: string;
  maxWidth: number;
  maxHeight: number;
  maxFontSize?: number;
  minFontSize?: number;
  lineHeightRatio?: number;
  showLanguage?: boolean;
  terminal?: boolean;
}

export function CodeBlockPanel({
  title,
  fileName,
  language,
  content,
  maxWidth,
  maxHeight,
  maxFontSize = 15,
  minFontSize = 7,
  lineHeightRatio,
  showLanguage = true,
  terminal = false,
}: CodeBlockPanelProps) {
  const fittedCode = fitCodeBlock({
    language,
    content,
    maxWidth,
    maxHeight,
    maxFontSize,
    minFontSize,
    lineHeightRatio,
  });
  const normalizedLanguage = language?.trim();
  const displayTitle = title || fileName || "Code";

  return (
    <div
      className="flex h-full min-h-0 w-full flex-col overflow-hidden rounded-[18px] border"
      style={{
        backgroundColor: terminal
          ? "var(--card-color,#080D1FCC)"
          : "var(--card-color,#0F172B80)",
        borderColor: "var(--stroke,#1D293D80)",
      }}
    >
      <div
        className="flex h-[52px] shrink-0 items-center justify-between gap-[16px] border-b px-[22px]"
        style={{
          color: "var(--background-text,#CAD5E2)",
          backgroundColor: terminal
            ? "var(--card-color,#0B1027)"
            : "var(--card-color,#1D293D80)",
          borderColor: "var(--stroke,#1D293D80)",
        }}
      >
        <div className="flex min-w-0 items-center gap-[12px]">
          {terminal && (
            <div className="flex shrink-0 items-center gap-[6px]" aria-hidden="true">
              <span className="h-[9px] w-[9px] rounded-full bg-[#FF5F57]" />
              <span className="h-[9px] w-[9px] rounded-full bg-[#FFBD2E]" />
              <span className="h-[9px] w-[9px] rounded-full bg-[#28C840]" />
            </div>
          )}
          <p className="min-w-0  text-[18px] leading-none">
            {displayTitle}
          </p>
          {fileName && title && (
            <p className="min-w-0  text-[14px] leading-none opacity-70">
              {fileName}
            </p>
          )}
        </div>
        {showLanguage && normalizedLanguage && (
          <p
            className="shrink-0 rounded-[8px] px-[10px] py-[5px] text-[12px] uppercase leading-none"
            style={{
              backgroundColor: "var(--primary-color,#2B7FFF33)",
              color: "var(--primary-text,#51A2FF)",
            }}
          >
            {normalizedLanguage}
          </p>
        )}
      </div>
      <div className={`min-h-0 w-full flex-1 overflow-hidden px-[22px] ${terminal ? "py-[16px]" : "py-[20px]"}`}>
        <pre
          data-code-block="true"
          className="prism-code-block m-0 w-full overflow-hidden"
          style={{
            color: "var(--background-text,#ffffff)",
            fontFamily: fittedCode.fontFamily,
            fontSize: `${fittedCode.fontSize}px`,
            lineHeight: `${fittedCode.lineHeight}px`,
            whiteSpace: "pre",
            overflowWrap: "normal",
            wordBreak: "normal",
            tabSize: 2,
          }}
          dangerouslySetInnerHTML={{ __html: fittedCode.highlightedHtml }}
        />
      </div>
    </div>
  );
}
