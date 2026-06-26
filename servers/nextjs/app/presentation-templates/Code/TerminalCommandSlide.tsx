import * as z from "zod";
import { CodeBlockPanel } from "./CodeBlockPanel";
import { PRISM_CODE_BLOCK_STYLES } from "./codeBlockFitting";

const DEFAULT_TERMINAL = {
  label: "Terminal",
  commands: `pnpm install
pnpm dev`,
};

const TERMINAL_CODE_MAX_WIDTH = 1130;
const TERMINAL_CODE_MAX_HEIGHT = 248;
const TERMINAL_CODE_LINE_HEIGHT_RATIO = 1.12;

export const layoutId = "terminal-command-slide";
export const layoutName = "Terminal Block Slide";
export const layoutDescription =
  "A title and description layout with a terminal-style block and a short note.";
export const slideLayoutId = layoutId;
export const slideLayoutName = layoutName;
export const slideLayoutDescription = layoutDescription;

export const Schema = z.object({
  title: z.string().min(6).max(42).default("Local Development Setup").meta({
    description: "Main slide heading.",
  }),
  description: z.string().min(20).max(220).default(
    "Run these commands to start the application locally with Docker."
  ).meta({
    description: "Short supporting text shown before the terminal block.",
  }),
  terminal: z.object({
    label: z.string().min(3).max(24).default(DEFAULT_TERMINAL.label).meta({
      description: "Terminal header label shown above the commands or logs.",
    }),
    commands: z.string().min(20).max(900).default(DEFAULT_TERMINAL.commands).meta({
      description: "Text content displayed inside the terminal-style block.",
    }),
  }).default(DEFAULT_TERMINAL).meta({
    description: "Terminal-style content block.",
  }),
  note: z.string().min(10).max(180).default(
    "The application should be available after the containers finish booting."
  ).meta({
    description: "Short note shown below the terminal block.",
  }),
});

export type SchemaType = z.infer<typeof Schema>;

const CodeSlide14TerminalCommand = ({ data }: { data: Partial<SchemaType> }) => {
  const terminal = { ...DEFAULT_TERMINAL, ...(data.terminal || {}) };

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
          {data.title || "Local Development Setup"}
        </h2>
        <p className="mt-[12px] max-w-[1120px] shrink-0 text-[21px] leading-[135%]" style={{ color: "var(--background-text,#CAD5E2)" }}>
          {data.description || "Run these commands to start the application locally with Docker."}
        </p>
        <div className="mt-[24px] min-h-0 flex-1">
          <CodeBlockPanel
            title={terminal.label}
            language="bash"
            content={terminal.commands}
            maxWidth={TERMINAL_CODE_MAX_WIDTH}
            maxHeight={TERMINAL_CODE_MAX_HEIGHT}
            maxFontSize={16}
            minFontSize={5}
            lineHeightRatio={TERMINAL_CODE_LINE_HEIGHT_RATIO}
            showLanguage={false}
            terminal
          />
        </div>
        <p
          className="mt-[18px] shrink-0 rounded-[14px] border px-[20px] py-[14px] text-[19px] leading-[130%]"
          style={{
            color: "var(--background-text,#d2d9ff)",
            backgroundColor: "var(--card-color,#0F172B80)",
            borderColor: "var(--stroke,#1D293D80)",
          }}
        >
          {data.note || "The application should be available after the containers finish booting."}
        </p>
      </div>
    </>
  );
};

export default CodeSlide14TerminalCommand;
