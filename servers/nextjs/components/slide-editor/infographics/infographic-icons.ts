import type { InfographicIcon } from "@/components/slide-editor/types";

export const INFOGRAPHIC_EXAMPLE_ICON_URLS = {
  discover: "/static/icons/bold/binoculars-bold.svg",
  define: "/static/icons/bold/target-bold.svg",
  plan: "/static/icons/bold/wrench-bold.svg",
  execute: "/static/icons/bold/megaphone-bold.svg",
  measure: "/static/icons/bold/chart-line-up-bold.svg",
} as const;

const DEFAULT_ICON_URLS = Object.values(INFOGRAPHIC_EXAMPLE_ICON_URLS);

export function defaultInfographicIcon(index = 0): InfographicIcon {
  const safeIndex = Math.max(0, Math.floor(index));
  return {
    url: DEFAULT_ICON_URLS[safeIndex % DEFAULT_ICON_URLS.length],
    color: "FFFFFF",
  };
}
