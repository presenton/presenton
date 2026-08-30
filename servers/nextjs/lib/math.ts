import katex from "katex";

export const MAX_MATH_LATEX_LENGTH = 4000;
const MATH_RENDER_PIXEL_RATIO = 3;

const mathMeasurementCache = new Map<string, { width: number; height: number }>();

type MathRenderOptions = {
  displayMode?: boolean;
  output?: "htmlAndMathml" | "mathml";
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
    output: options.output ?? "htmlAndMathml",
    strict: "warn",
    throwOnError: false,
    trust: false,
  });
}

export function measureMathLatex(
  latex: unknown,
  fontSize: number,
  displayMode = false,
): { width: number; height: number } {
  const normalized = normalizeMathLatex(latex);
  const safeFontSize = Math.max(1, Math.min(512, fontSize));
  if (!normalized) return { width: 0, height: safeFontSize * 1.2 };

  const cacheKey = `${safeFontSize}:${displayMode ? 1 : 0}:${normalized}`;
  const cached = mathMeasurementCache.get(cacheKey);
  if (cached) return cached;

  let measurement = {
    width: Math.max(safeFontSize * 0.75, normalized.length * safeFontSize * 0.5),
    height: safeFontSize * (displayMode ? 1.6 : 1.25),
  };

  if (typeof document !== "undefined" && document.body) {
    const container = document.createElement("span");
    container.style.cssText = `position:fixed;left:-10000px;top:-10000px;display:inline-block;width:max-content;height:max-content;visibility:hidden;white-space:nowrap;font-size:${safeFontSize}px;line-height:1.2;`;
    container.innerHTML = katex.renderToString(normalized, {
      displayMode,
      output: "mathml",
      strict: "warn",
      throwOnError: false,
      trust: false,
    });
    document.body.appendChild(container);
    const katexNode = container.querySelector<HTMLElement>(".katex");
    if (katexNode) katexNode.style.cssText = "font:inherit;line-height:inherit;";
    const mathNode = container.querySelector<MathMLElement>("math");
    const bounds = (mathNode ?? katexNode ?? container).getBoundingClientRect();
    container.remove();
    if (bounds.width > 0 && bounds.height > 0) {
      measurement = { width: bounds.width, height: bounds.height };
    }
  }

  mathMeasurementCache.set(cacheKey, measurement);
  return measurement;
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
  // Browsers rasterize an SVG containing a foreignObject at its intrinsic
  // pixel size before Konva paints it. Give that intermediate bitmap extra
  // pixels while keeping the logical viewBox unchanged so equations remain
  // sharp on scaled and high-density canvases.
  const renderWidth = safeWidth * MATH_RENDER_PIXEL_RATIO;
  const renderHeight = safeHeight * MATH_RENDER_PIXEL_RATIO;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${renderWidth}" height="${renderHeight}" viewBox="0 0 ${safeWidth} ${safeHeight}"><foreignObject width="100%" height="100%"><div xmlns="http://www.w3.org/1999/xhtml" style="box-sizing:border-box;display:flex;align-items:${alignItems};justify-content:${justifyContent};width:100%;height:100%;overflow:hidden;color:${escapeXmlAttribute(color)};font-size:${safeFontSize}px;line-height:1.2"><style>math{color:inherit;font-size:1em}.katex{color:inherit;font-size:1em}</style>${mathml}</div></foreignObject></svg>`;
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
