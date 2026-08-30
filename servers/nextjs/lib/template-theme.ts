export const TEMPLATE_THEME_COLOR_KEYS = [
  "primary",
  "background",
  "card",
  "stroke",
  "primary_text",
  "background_text",
  "graph_0",
  "graph_1",
  "graph_2",
  "graph_3",
  "graph_4",
  "graph_5",
  "graph_6",
  "graph_7",
  "graph_8",
  "graph_9",
] as const;

export type TemplateThemeColorKey =
  (typeof TEMPLATE_THEME_COLOR_KEYS)[number];

export type TemplateThemeTextFont = {
  name: string;
  url: string;
};

export type TemplateTheme = Record<TemplateThemeColorKey, string> & {
  fonts?: { textFont?: TemplateThemeTextFont };
};

export const DEFAULT_TEMPLATE_THEME: TemplateTheme = {
  primary: "#4a6ebd",
  background: "#ffffff",
  card: "#e8e8e8",
  stroke: "#d1d1d1",
  primary_text: "#dedede",
  background_text: "#060301",
  graph_0: "#09256d",
  graph_1: "#1c3c86",
  graph_2: "#3153a0",
  graph_3: "#476bba",
  graph_4: "#5d83d4",
  graph_5: "#749cef",
  graph_6: "#8cb6ff",
  graph_7: "#a5d0ff",
  graph_8: "#bbe7ff",
  graph_9: "#c8f5ff",
};

const HEX_COLOR = /^#?[0-9a-f]{6}$/i;

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function nonEmptyString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function normalizedHex(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const color = value.trim();
  if (!HEX_COLOR.test(color)) return null;
  return color.startsWith("#") ? color.toLowerCase() : `#${color.toLowerCase()}`;
}

function normalizeTextFont(value: unknown): TemplateThemeTextFont | null {
  const font = asRecord(value);
  const name = nonEmptyString(font?.name);
  const url = nonEmptyString(font?.url);
  return name && url ? { name, url } : null;
}

/** Accepts API, presentation, and legacy flat theme payloads. */
export function normalizeTemplateTheme(value: unknown): TemplateTheme | null {
  const root = asRecord(value);
  if (!root) return null;
  const data = asRecord(root.data);
  const nestedTheme = asRecord(root.theme) ?? asRecord(data?.theme);
  const colors =
    asRecord(nestedTheme?.colors) ??
    asRecord(root.colors) ??
    asRecord(data?.colors) ??
    nestedTheme ??
    data ??
    root;

  if (
    !TEMPLATE_THEME_COLOR_KEYS.some(
      (key) => normalizedHex(colors[key]) != null,
    )
  ) {
    return null;
  }

  const normalized = TEMPLATE_THEME_COLOR_KEYS.reduce<TemplateTheme>(
    (theme, key) => {
      theme[key] = normalizedHex(colors[key]) ?? DEFAULT_TEMPLATE_THEME[key];
      return theme;
    },
    { ...DEFAULT_TEMPLATE_THEME },
  );
  const fonts =
    asRecord(nestedTheme?.fonts) ?? asRecord(root.fonts) ?? asRecord(data?.fonts);
  const textFont = normalizeTextFont(fonts?.textFont);
  return textFont ? { ...normalized, fonts: { textFont } } : normalized;
}

export function templateThemeGraphColors(theme: TemplateTheme): string[] {
  return Array.from(
    { length: 10 },
    (_, index) => theme[`graph_${index}` as TemplateThemeColorKey],
  );
}

export function resolvePresentationTheme(value: unknown): TemplateTheme {
  const presentation = asRecord(value);
  return normalizeTemplateTheme(presentation?.theme) ?? DEFAULT_TEMPLATE_THEME;
}

export function resolveTemplateIdFromPresentation(value: unknown): string {
  const presentation = asRecord(value);
  if (!presentation) return "";

  for (const key of ["template_id", "design_v2_id"]) {
    const id = nonEmptyString(presentation[key]);
    if (id) return id;
  }

  const slides = Array.isArray(presentation.slides) ? presentation.slides : [];
  const firstSlide = asRecord(slides[0]);
  const layoutGroup = nonEmptyString(firstSlide?.layout_group);
  if (
    layoutGroup &&
    !["no", "blank", "template-v2"].includes(layoutGroup)
  ) {
    return layoutGroup;
  }

  const layout = nonEmptyString(presentation.layout);
  if (layout && !["no", "blank", "template-v2"].includes(layout)) {
    return layout;
  }

  return "";
}

type ThemeColorStats = {
  fill: number;
  graph: number;
  stroke: number;
  text: number;
  total: number;
};

function colorChannels(color: string) {
  const value = Number.parseInt(color.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function relativeLuminance(color: string) {
  const channels = colorChannels(color).map((channel) => {
    const value = channel / 255;
    return value <= 0.04045
      ? value / 12.92
      : Math.pow((value + 0.055) / 1.055, 2.4);
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

function contrastRatio(first: string, second: string) {
  const a = relativeLuminance(first);
  const b = relativeLuminance(second);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

function colorSaturation(color: string) {
  const channels = colorChannels(color).map((channel) => channel / 255);
  const max = Math.max(...channels);
  const min = Math.min(...channels);
  if (max === min) return 0;
  const lightness = (max + min) / 2;
  return (max - min) / (1 - Math.abs(2 * lightness - 1));
}

function mixColors(first: string, second: string, secondWeight: number) {
  const a = colorChannels(first);
  const b = colorChannels(second);
  const channels = a.map((channel, index) =>
    Math.round(channel * (1 - secondWeight) + b[index] * secondWeight),
  );
  return `#${channels.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}

function recordTemplateColor(
  color: string,
  pathText: string,
  colors: Map<string, ThemeColorStats>,
) {
  const stats = colors.get(color) ?? {
    fill: 0,
    graph: 0,
    stroke: 0,
    text: 0,
    total: 0,
  };
  stats.total += 1;
  if (
    pathText.includes("font") ||
    pathText.includes("text_color") ||
    pathText.includes("title_color") ||
    pathText.includes("legend_color")
  ) {
    stats.text += 1;
  } else if (
    pathText.includes("stroke") ||
    pathText.includes("axis_color") ||
    pathText.includes("grid_color")
  ) {
    stats.stroke += 1;
  } else if (
    pathText.includes("chart") ||
    pathText.includes("infographic") ||
    pathText.includes("colors")
  ) {
    stats.graph += 1;
  } else {
    stats.fill += 1;
  }
  colors.set(color, stats);
}

function collectTemplateStyle(
  value: unknown,
  path: string[],
  colors: Map<string, ThemeColorStats>,
  fonts: Map<string, number>,
) {
  if (Array.isArray(value)) {
    value.forEach((item) => {
      const color = normalizedHex(item);
      if (color) recordTemplateColor(color, path.join("."), colors);
      else collectTemplateStyle(item, path, colors, fonts);
    });
    return;
  }
  const record = asRecord(value);
  if (!record) return;

  Object.entries(record).forEach(([key, entry]) => {
    const nextPath = [...path, key.toLowerCase()];
    const pathText = nextPath.join(".");
    const color = normalizedHex(entry);
    if (color) {
      recordTemplateColor(color, pathText, colors);
    }

    if (
      (key === "family" || key === "font_family") &&
      typeof entry === "string" &&
      entry.trim()
    ) {
      const family = entry.trim();
      fonts.set(family, (fonts.get(family) ?? 0) + 1);
    }
    collectTemplateStyle(entry, nextPath, colors, fonts);
  });
}

function rankedColors(
  colors: Map<string, ThemeColorStats>,
  score: (stats: ThemeColorStats, color: string) => number,
) {
  return [...colors.entries()]
    .sort((first, second) => score(second[1], second[0]) - score(first[1], first[0]))
    .map(([color]) => color);
}

/** Derives stable semantic roles from a template's stored layout JSON. */
export function resolveTemplateTheme(value: unknown): TemplateTheme {
  const template = asRecord(value);
  const explicit = normalizeTemplateTheme(template?.theme);
  if (explicit) return explicit;

  const colors = new Map<string, ThemeColorStats>();
  const fonts = new Map<string, number>();
  collectTemplateStyle(template?.layouts, ["layouts"], colors, fonts);
  if (!colors.size) return DEFAULT_TEMPLATE_THEME;

  const byFill = rankedColors(colors, (stats) => stats.fill * 4 + stats.total);
  const background = byFill[0] ?? DEFAULT_TEMPLATE_THEME.background;
  const textCandidates = rankedColors(
    colors,
    (stats) => stats.text * 6 + stats.total,
  );
  const backgroundText =
    textCandidates.find((color) => contrastRatio(color, background) >= 4.5) ??
    (relativeLuminance(background) < 0.45 ? "#ffffff" : "#111111");
  const accentCandidates = rankedColors(
    colors,
    (stats, color) =>
      stats.graph * 8 + stats.fill * 2 + stats.stroke + colorSaturation(color) * 6,
  ).filter(
    (color) =>
      color !== background &&
      color !== backgroundText &&
      colorSaturation(color) > 0.08,
  );
  const primary = accentCandidates[0] ?? DEFAULT_TEMPLATE_THEME.primary;
  const card =
    byFill.find((color) => color !== background && color !== primary) ??
    mixColors(background, primary, 0.12);
  const stroke =
    rankedColors(colors, (stats) => stats.stroke * 6 + stats.total).find(
      (color) => color !== background && color !== backgroundText,
    ) ?? mixColors(background, backgroundText, 0.18);
  const graphSeeds = [...new Set([...accentCandidates, primary])];
  const graphColors = Array.from({ length: 10 }, (_, index) =>
    graphSeeds[index] ??
    mixColors(primary, index % 2 === 0 ? background : backgroundText, 0.08 * (index + 1)),
  );
  const primaryText =
    contrastRatio("#ffffff", primary) >= contrastRatio("#111111", primary)
      ? "#ffffff"
      : "#111111";
  const dominantFont = [...fonts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  const fontMap = asRecord(template?.fonts);
  const fontUrl = dominantFont ? nonEmptyString(fontMap?.[dominantFont]) : "";

  return {
    primary,
    background,
    card,
    stroke,
    primary_text: primaryText,
    background_text: backgroundText,
    graph_0: graphColors[0],
    graph_1: graphColors[1],
    graph_2: graphColors[2],
    graph_3: graphColors[3],
    graph_4: graphColors[4],
    graph_5: graphColors[5],
    graph_6: graphColors[6],
    graph_7: graphColors[7],
    graph_8: graphColors[8],
    graph_9: graphColors[9],
    ...(dominantFont && fontUrl
      ? { fonts: { textFont: { name: dominantFont, url: fontUrl } } }
      : {}),
  };
}
