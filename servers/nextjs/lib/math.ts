import katex from "katex";

export const MAX_MATH_LATEX_LENGTH = 4000;

type MathRenderOptions = {
  displayMode?: boolean;
};

export function normalizeMathLatex(value: unknown): string {
  if (typeof value !== "string") return "";
  const trimmed = value.trim().slice(0, MAX_MATH_LATEX_LENGTH);
  if (trimmed.startsWith("$$") && trimmed.endsWith("$$") && trimmed.length > 4) {
    return trimmed.slice(2, -2).trim();
  }
  if (trimmed.startsWith("\\[") && trimmed.endsWith("\\]") && trimmed.length > 4) {
    return trimmed.slice(2, -2).trim();
  }
  return trimmed;
}

export function renderMathHtml(
  latex: unknown,
  options: MathRenderOptions = {},
): string {
  const normalized = normalizeMathLatex(latex);
  if (!normalized) return "";
  return katex.renderToString(normalized, {
    displayMode: options.displayMode ?? true,
    output: "htmlAndMathml",
    strict: "warn",
    throwOnError: false,
    trust: false,
  });
}

export function mathSvgDataUri({
  align = "center",
  color = "#111827",
  displayMode = true,
  fontSize = 32,
  height,
  latex,
  verticalAlign = "middle",
  width,
}: {
  align?: "left" | "center" | "right";
  color?: string;
  displayMode?: boolean;
  fontSize?: number;
  height: number;
  latex: unknown;
  verticalAlign?: "top" | "middle" | "bottom";
  width: number;
}): string | null {
  const normalized = normalizeMathLatex(latex);
  if (!normalized) return null;

  const mathml = katex.renderToString(normalized, {
    displayMode,
    output: "mathml",
    strict: "warn",
    throwOnError: false,
    trust: false,
  });
  const justifyContent =
    align === "left" ? "flex-start" : align === "right" ? "flex-end" : "center";
  const alignItems =
    verticalAlign === "top"
      ? "flex-start"
      : verticalAlign === "bottom"
        ? "flex-end"
        : "center";
  const safeWidth = Math.max(1, Math.round(width));
  const safeHeight = Math.max(1, Math.round(height));
  const safeFontSize = Math.max(1, Math.min(512, fontSize));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${safeWidth}" height="${safeHeight}" viewBox="0 0 ${safeWidth} ${safeHeight}"><foreignObject width="100%" height="100%"><div xmlns="http://www.w3.org/1999/xhtml" style="box-sizing:border-box;display:flex;align-items:${alignItems};justify-content:${justifyContent};width:100%;height:100%;overflow:hidden;color:${escapeXmlAttribute(color)};font-size:${safeFontSize}px;line-height:1.2"><style>math{color:inherit;font-size:1em}.katex{color:inherit;font-size:1em}</style>${mathml}</div></foreignObject></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function escapeXmlAttribute(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    switch (character) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      default:
        return "&#39;";
    }
  });
}
