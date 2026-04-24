import { useFontLoader } from "../../hooks/useFontLoad";
import type { Theme } from "../../services/api/types";

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
  theme: Theme | null | undefined
): void {
  if (!element || !theme?.data) return;
  if (!theme.data.colors?.["graph_0"]) return;
  const colors = theme.data.colors;
  const cssVariables: Record<string, string> = {
    "--primary-color": colors["primary"],
    "--background-color": colors["background"],
    "--card-color": colors["card"],
    "--stroke": colors["stroke"],
    "--primary-text": colors["primary_text"],
    "--background-text": colors["background_text"],
    "--graph-0": colors["graph_0"],
    "--graph-1": colors["graph_1"],
    "--graph-2": colors["graph_2"],
    "--graph-3": colors["graph_3"],
    "--graph-4": colors["graph_4"],
    "--graph-5": colors["graph_5"],
    "--graph-6": colors["graph_6"],
    "--graph-7": colors["graph_7"],
    "--graph-8": colors["graph_8"],
    "--graph-9": colors["graph_9"],
  };
  Object.entries(cssVariables).forEach(([key, value]) => {
    element.style.setProperty(key, value);
  });
  useFontLoader({ [theme.data.fonts.textFont.name]: theme.data.fonts.textFont.url });
  element.style.setProperty("font-family", `"${theme.data.fonts.textFont.name}"`);
  element.style.setProperty("--heading-font-family", `"${theme.data.fonts.textFont.name}"`);
  element.style.setProperty("--body-font-family", `"${theme.data.fonts.textFont.name}"`);
}
