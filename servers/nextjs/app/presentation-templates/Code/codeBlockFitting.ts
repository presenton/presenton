import { jsonrepair } from "jsonrepair";
import Prism from "prismjs";
import "prismjs/components/prism-json";
import "prismjs/components/prism-javascript";
import "prismjs/components/prism-typescript";
import "prismjs/components/prism-jsx";
import "prismjs/components/prism-tsx";
import "prismjs/components/prism-python";
import "prismjs/components/prism-bash";
import "prismjs/components/prism-yaml";
import "prismjs/components/prism-markdown";

const DEFAULT_CODE_CHAR_WIDTH_RATIO = 0.62;
const DEFAULT_CODE_LINE_HEIGHT_RATIO = 1.25;
const DEFAULT_FONT_STEP = 0.5;
const HARD_MIN_FONT_SIZE = 4;

export const DEFAULT_CODE_FONT_FAMILY = "var(--code-font-family,'Liberation Mono', monospace)";
export const PRISM_CODE_BLOCK_STYLES = `
.prism-code-block .token {
  display: inline !important;
  white-space: inherit !important;
}

.prism-code-block {
  --code-fg: var(--background-text, #dbe5ff);
  --code-accent: var(--primary-color, #7aa2ff);
  color: var(--code-fg);
}

.prism-code-block .token.comment,
.prism-code-block .token.prolog,
.prism-code-block .token.doctype,
.prism-code-block .token.cdata {
  color: var(--code-fg);
  opacity: 0.62;
}

.prism-code-block .token.punctuation {
  color: var(--code-fg);
  opacity: 0.82;
}

.prism-code-block .token.property,
.prism-code-block .token.tag,
.prism-code-block .token.constant,
.prism-code-block .token.symbol,
.prism-code-block .token.deleted {
  color: var(--graph-0, #7bc4ff);
  color: color-mix(in srgb, var(--graph-0, #7bc4ff) 72%, var(--code-fg) 28%);
}

.prism-code-block .token.boolean,
.prism-code-block .token.number {
  color: var(--graph-1, #f5c97b);
  color: color-mix(in srgb, var(--graph-1, #f5c97b) 68%, var(--code-fg) 32%);
}

.prism-code-block .token.selector,
.prism-code-block .token.attr-name,
.prism-code-block .token.string,
.prism-code-block .token.char,
.prism-code-block .token.builtin,
.prism-code-block .token.inserted {
  color: var(--graph-2, #9fe6b8);
  color: color-mix(in srgb, var(--graph-2, #9fe6b8) 72%, var(--code-fg) 28%);
}

.prism-code-block .token.operator,
.prism-code-block .token.entity,
.prism-code-block .token.url,
.prism-code-block .token.variable {
  color: var(--graph-3, #f5a97f);
  color: color-mix(in srgb, var(--graph-3, #f5a97f) 70%, var(--code-fg) 30%);
}

.prism-code-block .token.atrule,
.prism-code-block .token.attr-value,
.prism-code-block .token.function,
.prism-code-block .token.class-name {
  color: var(--graph-4, #b8a8ff);
  color: color-mix(in srgb, var(--graph-4, #b8a8ff) 74%, var(--code-fg) 26%);
}

.prism-code-block .token.keyword {
  color: var(--code-accent);
  color: color-mix(in srgb, var(--code-accent, #7aa2ff) 78%, var(--code-fg) 22%);
  font-weight: 600;
}

.prism-code-block .token.regex,
.prism-code-block .token.important {
  color: var(--code-accent);
  color: color-mix(in srgb, var(--code-accent, #7aa2ff) 64%, var(--graph-1, #f5c97b) 36%);
}
`;

interface FitCodeBlockOptions {
  language?: string;
  content?: string;
  maxWidth: number;
  maxHeight: number;
  maxFontSize?: number;
  minFontSize?: number;
  fontStep?: number;
  charWidthRatio?: number;
  lineHeightRatio?: number;
}

interface TypographyCandidate {
  lineHeight: number;
  maxCharsPerLine: number;
  renderedLineCount: number;
}

export interface FittedCodeBlock {
  text: string;
  highlightedHtml: string;
  prismLanguage: string;
  fontSize: number;
  lineHeight: number;
  fontFamily: string;
}

function splitCollapsedPythonImports(line: string) {
  const importSegments = line
    .split(/(?=\sfrom\s+[A-Za-z0-9_.]+\s+import\s+)/g)
    .map((segment) => segment.trim())
    .filter(Boolean);

  return importSegments.length > 1 ? importSegments : [line];
}

function expandInlinePythonStatement(line: string) {
  const inlineReturnMatch = line.match(/^(\s*def\s+[^(]+\([^)]*\):)\s+return\s+(.+)$/);

  if (!inlineReturnMatch) {
    return [line];
  }

  return [inlineReturnMatch[1], `return ${inlineReturnMatch[2]}`];
}

function expandPathListAssignment(line: string) {
  const trimmedLine = line.trim();

  if (!trimmedLine.startsWith("urlpatterns = [") || !trimmedLine.endsWith("]")) {
    return [line];
  }

  const pathCalls = trimmedLine.match(/path\([^)]*\)/g);

  if (!pathCalls?.length) {
    return [line];
  }

  return [
    "urlpatterns = [",
    ...pathCalls.map((pathCall) => `    ${pathCall},`),
    "]",
  ];
}

function normalizePythonCode(content: string) {
  const normalizedLines: string[] = [];

  for (const line of content.split("\n")) {
    const importLines = splitCollapsedPythonImports(line);

    for (const importLine of importLines) {
      const expandedPathLines = expandPathListAssignment(importLine);

      for (const expandedPathLine of expandedPathLines) {
        normalizedLines.push(...expandInlinePythonStatement(expandedPathLine));
      }
    }
  }

  return normalizedLines.join("\n").replace(/\n{3,}/g, "\n\n");
}

function tryFormatJson(content: string) {
  const trimmedContent = content.replace(/^\uFEFF/, "").trim();

  if (!trimmedContent) {
    return "";
  }

  const normalizedSeparatorsContent = trimmedContent
    .replace(/^\s*\/\s*$/gm, ",")
    .replace(/\r\n?/g, "\n")
    .replace(/\n\s*:\s*/g, ": ")
    .replace(/\n\s*,\s*/g, ", ");

  const parseAndFormat = (raw: string) => {
    try {
      const parsed = JSON.parse(raw);

      if (typeof parsed === "string") {
        try {
          return JSON.stringify(JSON.parse(parsed), null, 2);
        } catch {
          return JSON.stringify(parsed, null, 2);
        }
      }

      return JSON.stringify(parsed, null, 2);
    } catch {
      return null;
    }
  };

  const extractedJsonMatch = normalizedSeparatorsContent.match(/[\[{][\s\S]*[\]}]/);
  const extractedJsonCandidate = extractedJsonMatch?.[0];

  const candidates = [
    normalizedSeparatorsContent,
    trimmedContent,
    extractedJsonCandidate,
  ].filter((candidate): candidate is string => Boolean(candidate));

  for (const candidate of candidates) {
    const direct = parseAndFormat(candidate);
    if (direct !== null) {
      return direct;
    }

    try {
      const repairedJson = jsonrepair(candidate);
      const repaired = parseAndFormat(repairedJson);
      if (repaired !== null) {
        return repaired;
      }
    } catch {
      // Try next parsing strategy.
    }
  }

  const jsonLikeTokenMatch = normalizedSeparatorsContent.match(
    /"(?:\\.|[^"\\])*"|true|false|null|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|[{}\[\]:,\/]/g
  );

  if (jsonLikeTokenMatch?.length) {
    const normalizedTokens = jsonLikeTokenMatch.map((token) => (token === "/" ? "," : token));
    let rebuilt = "";

    for (const token of normalizedTokens) {
      if (token === ":" || token === ",") {
        rebuilt = rebuilt.replace(/\s*$/, "");
        rebuilt += `${token} `;
        continue;
      }

      if (token === "}" || token === "]") {
        rebuilt = rebuilt.replace(/\s*$/, "");
        rebuilt += token;
        continue;
      }

      if (token === "{" || token === "[") {
        rebuilt = rebuilt.replace(/\s*$/, "");
        rebuilt += token;
        continue;
      }

      rebuilt += token;
    }

    const rebuiltDirect = parseAndFormat(rebuilt);
    if (rebuiltDirect !== null) {
      return rebuiltDirect;
    }

    try {
      const rebuiltRepaired = parseAndFormat(jsonrepair(rebuilt));
      if (rebuiltRepaired !== null) {
        return rebuiltRepaired;
      }
    } catch {
      // Continue to best-effort line merge fallback below.
    }
  }

  const normalizedLines = normalizedSeparatorsContent
    .replace(/\n\s*:\s*\n\s*/g, ": ")
    .replace(/\n\s*\/\s*\n/g, ",\n")
    .split("\n")
    .map((line) => line.replace(/\s+$/g, ""));

  const mergedLines: string[] = [];

  for (const rawLine of normalizedLines) {
    const trimmedLine = rawLine.trim();

    if (!trimmedLine) {
      continue;
    }

    if (trimmedLine === ":") {
      if (mergedLines.length > 0) {
        mergedLines[mergedLines.length - 1] = `${mergedLines[mergedLines.length - 1]}:`;
      }
      continue;
    }

    if (trimmedLine === "/") {
      if (mergedLines.length > 0 && !mergedLines[mergedLines.length - 1].trim().endsWith(",")) {
        mergedLines[mergedLines.length - 1] = `${mergedLines[mergedLines.length - 1]},`;
      }
      continue;
    }

    const previousLine = mergedLines[mergedLines.length - 1]?.trim() || "";
    if (previousLine.endsWith(":")) {
      mergedLines[mergedLines.length - 1] = `${mergedLines[mergedLines.length - 1]} ${trimmedLine}`;
      continue;
    }

    mergedLines.push(rawLine);
  }

  for (let index = 0; index < mergedLines.length - 1; index += 1) {
    const currentLine = mergedLines[index].trim();
    const nextLine = mergedLines[index + 1].trim();
    const currentEndsWithComma = currentLine.endsWith(",");
    const currentIsContainerStart = currentLine.endsWith("{") || currentLine.endsWith("[");
    const nextStartsNewKey = nextLine.startsWith("\"");
    const nextIsContainerEnd = nextLine.startsWith("}") || nextLine.startsWith("]");

    if (!currentEndsWithComma && !currentIsContainerStart && nextStartsNewKey && !nextIsContainerEnd) {
      mergedLines[index] = `${mergedLines[index]},`;
    }
  }

  return mergedLines
    .join("\n")
    .replace(/,\s*([}\]])/g, "$1");
}

function isValidJsonContent(content: string) {
  try {
    JSON.parse(content.trim());
    return true;
  } catch {
    return false;
  }
}

function seemsJsonLike(content: string) {
  const trimmed = content.trim();
  if (!trimmed) {
    return false;
  }

  if (/^[\[{]/.test(trimmed)) {
    return true;
  }

  return /"[^"\n]+"\s*:/.test(trimmed) || /[\[{][\s\S]*[\]}]/.test(trimmed);
}

function unwrapMarkdownCodeFence(content: string) {
  const trimmedContent = content.trim();
  const fencedCodeMatch = trimmedContent.match(/^```([^\n`]*)\n([\s\S]*?)\n```$/);

  if (!fencedCodeMatch) {
    return {
      content: content,
      fenceLanguage: undefined as string | undefined,
    };
  }

  return {
    content: fencedCodeMatch[2],
    fenceLanguage: fencedCodeMatch[1]?.trim().toLowerCase() || undefined,
  };
}

function escapeHtml(content: string) {
  return content
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function resolvePrismLanguage(language?: string) {
  const normalizedLanguage = language?.toLowerCase().trim();

  if (!normalizedLanguage) {
    return "clike";
  }

  if (normalizedLanguage.includes("json")) {
    return "json";
  }

  if (normalizedLanguage.includes("python")) {
    return "python";
  }

  if (normalizedLanguage === "ts") {
    return "typescript";
  }

  if (normalizedLanguage === "js") {
    return "javascript";
  }

  if (normalizedLanguage === "py") {
    return "python";
  }

  if (normalizedLanguage === "sh" || normalizedLanguage === "shell") {
    return "bash";
  }

  if (normalizedLanguage === "yml") {
    return "yaml";
  }

  if (Prism.languages[normalizedLanguage]) {
    return normalizedLanguage;
  }

  return "clike";
}

function highlightCode(content: string, language?: string) {
  const prismLanguage = resolvePrismLanguage(language);
  const grammar = Prism.languages[prismLanguage];

  if (!grammar) {
    return {
      html: escapeHtml(content),
      prismLanguage,
    };
  }

  try {
    return {
      html: Prism.highlight(content, grammar, prismLanguage),
      prismLanguage,
    };
  } catch {
    return {
      html: escapeHtml(content),
      prismLanguage,
    };
  }
}

export function normalizeCodeContent(language?: string, content?: string) {
  let normalizedContent = (content || "")
    .replace(/\r\n?/g, "\n")
    .replace(/\\\[/g, "[")
    .replace(/\\\]/g, "]");
  const unwrappedContent = unwrapMarkdownCodeFence(normalizedContent);
  normalizedContent = unwrappedContent.content.trimEnd();

  const normalizedLanguage = language?.toLowerCase()?.trim() || unwrappedContent.fenceLanguage;
  const isJsonLanguage = normalizedLanguage?.includes("json");
  const looksLikeJsonPayload = seemsJsonLike(normalizedContent);

  if (normalizedLanguage === "python") {
    normalizedContent = normalizePythonCode(normalizedContent);
  } else if (isJsonLanguage || looksLikeJsonPayload) {
    const formattedJson = tryFormatJson(normalizedContent);
    normalizedContent = formattedJson;
  }

  return normalizedContent;
}

function countRenderedLines(content: string, maxCharsPerLine: number) {
  const rawLines = content.split("\n");
  let renderedLineCount = 0;

  for (const rawLine of rawLines) {
    const expandedLine = rawLine.replace(/\t/g, "  ");

    if (expandedLine.length === 0) {
      renderedLineCount += 1;
      continue;
    }

    renderedLineCount += Math.max(1, Math.ceil(expandedLine.length / maxCharsPerLine));
  }

  return Math.max(1, renderedLineCount);
}

function splitLineForLineBudget(line: string, maxCharsPerLine: number) {
  if (line.length === 0) {
    return [""];
  }

  const chunks: string[] = [];

  for (let start = 0; start < line.length; start += maxCharsPerLine) {
    chunks.push(line.slice(start, start + maxCharsPerLine));
  }

  return chunks;
}

function truncateContentToLineBudget(
  content: string,
  lineBudget: number,
  maxCharsPerLine: number
) {
  const linesForDisplay: string[] = [];
  const rawLines = content.split("\n");

  for (const rawLine of rawLines) {
    const expandedLine = rawLine.replace(/\t/g, "  ");
    const chunks = splitLineForLineBudget(expandedLine, maxCharsPerLine);

    for (const chunk of chunks) {
      if (linesForDisplay.length >= lineBudget) {
        const lastLineIndex = Math.max(0, lineBudget - 1);
        const ellipsis = "...";
        const existingLastLine = linesForDisplay[lastLineIndex] ?? "";
        linesForDisplay[lastLineIndex] = `${existingLastLine.slice(
          0,
          Math.max(0, maxCharsPerLine - ellipsis.length)
        )}${ellipsis}`;
        return linesForDisplay.join("\n");
      }

      linesForDisplay.push(chunk);
    }
  }

  return linesForDisplay.join("\n");
}

function createTypographyCandidate(
  normalizedContent: string,
  fontSize: number,
  maxWidth: number,
  charWidthRatio: number,
  lineHeightRatio: number
): TypographyCandidate {
  const lineHeight = Math.max(1, Math.round(fontSize * lineHeightRatio));
  const maxCharsPerLine = Math.max(1, Math.floor(maxWidth / (fontSize * charWidthRatio)));
  const renderedLineCount = countRenderedLines(normalizedContent, maxCharsPerLine);

  return {
    lineHeight,
    maxCharsPerLine,
    renderedLineCount,
  };
}

function findFittingTypography(
  normalizedContent: string,
  startFontSize: number,
  minFontSize: number,
  maxWidth: number,
  maxHeight: number,
  fontStep: number,
  charWidthRatio: number,
  lineHeightRatio: number
) {
  for (let fontSize = startFontSize; fontSize >= minFontSize; fontSize -= fontStep) {
    const candidate = createTypographyCandidate(
      normalizedContent,
      fontSize,
      maxWidth,
      charWidthRatio,
      lineHeightRatio
    );

    if (candidate.renderedLineCount * candidate.lineHeight <= maxHeight) {
      return {
        candidate,
        fontSize,
      };
    }
  }

  return null;
}

export function fitCodeBlock({
  language,
  content,
  maxWidth,
  maxHeight,
  maxFontSize = 16,
  minFontSize = 8,
  fontStep = DEFAULT_FONT_STEP,
  charWidthRatio = DEFAULT_CODE_CHAR_WIDTH_RATIO,
  lineHeightRatio = DEFAULT_CODE_LINE_HEIGHT_RATIO,
}: FitCodeBlockOptions): FittedCodeBlock {
  const normalizedContent = normalizeCodeContent(language, content);
  const highlightLanguage =
    isValidJsonContent(normalizedContent) || seemsJsonLike(normalizedContent)
      ? "json"
      : language;
  const preferredMinFont = Math.max(1, minFontSize);
  const hardMinFont = Math.max(1, Math.min(preferredMinFont, HARD_MIN_FONT_SIZE));
  const startFont = Math.max(maxFontSize, preferredMinFont);

  const preferredFit = findFittingTypography(
    normalizedContent,
    startFont,
    preferredMinFont,
    maxWidth,
    maxHeight,
    fontStep,
    charWidthRatio,
    lineHeightRatio
  );

  if (preferredFit) {
    const highlighted = highlightCode(normalizedContent, highlightLanguage);
    return {
      text: normalizedContent,
      highlightedHtml: highlighted.html,
      prismLanguage: highlighted.prismLanguage,
      fontSize: Math.round(preferredFit.fontSize * 10) / 10,
      lineHeight: preferredFit.candidate.lineHeight,
      fontFamily: DEFAULT_CODE_FONT_FAMILY,
    };
  }

  if (hardMinFont < preferredMinFont) {
    const emergencyFit = findFittingTypography(
      normalizedContent,
      preferredMinFont - fontStep,
      hardMinFont,
      maxWidth,
      maxHeight,
      fontStep,
      charWidthRatio,
      lineHeightRatio
    );

    if (emergencyFit) {
      const highlighted = highlightCode(normalizedContent, highlightLanguage);
      return {
        text: normalizedContent,
        highlightedHtml: highlighted.html,
        prismLanguage: highlighted.prismLanguage,
        fontSize: Math.round(emergencyFit.fontSize * 10) / 10,
        lineHeight: emergencyFit.candidate.lineHeight,
        fontFamily: DEFAULT_CODE_FONT_FAMILY,
      };
    }
  }

  const fallback = createTypographyCandidate(
    normalizedContent,
    hardMinFont,
    maxWidth,
    charWidthRatio,
    lineHeightRatio
  );
  const fallbackLineBudget = Math.max(1, Math.floor(maxHeight / fallback.lineHeight));
  const fallbackText = truncateContentToLineBudget(
    normalizedContent,
    fallbackLineBudget,
    fallback.maxCharsPerLine
  );
  const highlighted = highlightCode(fallbackText, highlightLanguage);
  return {
    text: fallbackText,
    highlightedHtml: highlighted.html,
    prismLanguage: highlighted.prismLanguage,
    fontSize: Math.round(hardMinFont * 10) / 10,
    lineHeight: fallback.lineHeight,
    fontFamily: DEFAULT_CODE_FONT_FAMILY,
  };
}
