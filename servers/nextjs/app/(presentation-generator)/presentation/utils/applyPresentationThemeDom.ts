import { useFontLoader } from "../../hooks/useFontLoad";
import { normalizeTemplateTheme } from "@/lib/template-theme";

const THEME_CSS_KEYS = [
  "--primary-color",
  "--background-color",
  "--card-color",
  "--stroke",
  "--primary-text",
  "--background-text",
  "--graph-0",
  "--graph-1",
  "--graph-2",
  "--graph-3",
  "--graph-4",
  "--graph-5",
  "--graph-6",
  "--graph-7",
  "--graph-8",
  "--graph-9",
] as const;

/** Remove theme inline variables from a container (e.g. before switching themes). */
export function clearPresentationThemeFromElement(element: HTMLElement | null): void {
  if (!element) return;
  for (const key of THEME_CSS_KEYS) {
    element.style.removeProperty(key);
  }
  element.style.removeProperty("font-family");
  element.style.removeProperty("--heading-font-family");
  element.style.removeProperty("--body-font-family");
}

/**
 * Apply presentation theme CSS variables + font loading to a DOM subtree
 * (editor: #presentation-slides-wrapper, present: #presentation-mode-wrapper).
 */
export function applyPresentationThemeToElement(
  element: HTMLElement | null,
  theme: unknown,
): void {
  if (!element) return;
  const normalizedTheme = normalizeTemplateTheme(theme);
  if (!normalizedTheme) return;
  const cssVariables: Record<string, string> = {
    "--primary-color": normalizedTheme.primary,
    "--background-color": normalizedTheme.background,
    "--card-color": normalizedTheme.card,
    "--stroke": normalizedTheme.stroke,
    "--primary-text": normalizedTheme.primary_text,
    "--background-text": normalizedTheme.background_text,
    "--graph-0": normalizedTheme.graph_0,
    "--graph-1": normalizedTheme.graph_1,
    "--graph-2": normalizedTheme.graph_2,
    "--graph-3": normalizedTheme.graph_3,
    "--graph-4": normalizedTheme.graph_4,
    "--graph-5": normalizedTheme.graph_5,
    "--graph-6": normalizedTheme.graph_6,
    "--graph-7": normalizedTheme.graph_7,
    "--graph-8": normalizedTheme.graph_8,
    "--graph-9": normalizedTheme.graph_9,
  };
  Object.entries(cssVariables).forEach(([key, value]) => {
    element.style.setProperty(key, value);
  });
  const textFont = normalizedTheme.fonts?.textFont;
  if (!textFont) return;
  useFontLoader({ [textFont.name]: textFont.url });
  element.style.setProperty("font-family", `"${textFont.name}"`);
  element.style.setProperty("--heading-font-family", `"${textFont.name}"`);
  element.style.setProperty("--body-font-family", `"${textFont.name}"`);
}
