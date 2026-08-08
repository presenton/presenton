import type {
  ChartDatum,
  ChartElement,
  ChartSeries,
  ChartType,
} from "@/components/slide-editor/types";

export type ResolvedChartDataset = {
  name: string;
  values: number[];
  color: string;
};

export type ChartColorTargetMode = "category" | "series";

export type ChartColorTarget = {
  color: string;
  index: number;
  label: string;
  mode: ChartColorTargetMode;
};

export const CHART_TEXT_MAX_LENGTH = 128;

export const DEFAULT_CHART_COLORS = [
  "7F22FE",
  "155DFC",
  "F59E0B",
  "12B76A",
  "EF4444",
  "06B6D4",
  "8B5CF6",
  "64748B",
];

export function limitChartText(value: string) {
  return value.slice(0, CHART_TEXT_MAX_LENGTH);
}

export function markdownToPlainChartText(value: string) {
  return value
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) =>
      line
        .replace(/^\s{0,3}#{1,6}\s+/, "")
        .replace(/^\s{0,3}>\s?/, "")
        .replace(/^\s*[-+*]\s+/, ""),
    )
    .join("\n")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/`([^`\n]+)`/g, "$1")
    .replace(/~~([^~\n]+)~~/g, "$1")
    .replace(/(^|[^\w])(\*\*|__)([^*\n_]+)\2(?=$|[^\w])/g, "$1$3")
    .replace(/(^|[^\w])([*_])([^*\n_]+)\2(?=$|[^\w])/g, "$1$3")
    .replace(/\\([\\`*_[\]{}()#+\-.!>])/g, "$1")
    .replace(/[ \t]+$/gm, "")
    .trim();
}

export function ellipsizeChartText(value: string, maxLength = 28) {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, Math.max(0, maxLength - 3))}...`;
}

export const CHART_SYSTEM_COLORS = [
  "000000",
  "303030",
  "666666",
  "A3A3A3",
  "E5E7EB",
  "FFFFFF",
  "38BDF8",
  "FACC15",
  "EC4899",
  "FB7185",
  "A855F7",
  "22C55E",
  "06B6D4",
  "F59E0B",
  "EF4444",
  "4F46E5",
  "7F22FE",
  "64748B",
];

export function resolvedChartCategories(element: ChartElement): string[] {
  const series = chartSupportsMultipleSeries(element.chart_type)
    ? element.series ?? []
    : (element.series ?? []).slice(0, 1);
  const seriesLength = Math.max(
    0,
    ...series.map((item) => item.values.length),
  );
  if (element.categories && element.categories.length > 0) {
    const categoryLength = Math.min(
      24,
      Math.max(element.categories.length, seriesLength),
    );
    return Array.from(
      { length: categoryLength },
      (_, index) => element.categories?.[index] ?? `Item ${index + 1}`,
    );
  }

  if (seriesLength > 0) {
    return Array.from(
      { length: Math.min(24, seriesLength) },
      (_, index) => `Item ${index + 1}`,
    );
  }

  return [];
}

export function resolvedChartDatasets(
  element: ChartElement,
): ResolvedChartDataset[] {
  const categories = resolvedChartCategories(element);
  const series = (element.series ?? []).slice(
    0,
    chartSupportsMultipleSeries(element.chart_type) ? 12 : 1,
  );
  if (series.length > 0) {
    return series.map((item, index) => ({
      name: item.name,
      values: normalizeSeriesValues(item, categories.length),
      color: chartSeriesColor(element, index),
    }));
  }

  return [];
}

export function primaryChartData(element: ChartElement): ChartDatum[] {
  const categories = resolvedChartCategories(element);
  const first = resolvedChartDatasets(element)[0];
  if (!first) return [];
  return categories.slice(0, Math.max(1, first.values.length)).map((label, index) => ({
    label,
    value: first.values[index] ?? 0,
    color: chartColorTargetMode(element) === "category"
      ? chartSeriesColor(element, index)
      : chartSeriesColor(element, 0),
  }));
}

export function chartSeriesColor(element: ChartElement, index: number) {
  const colors = element.colors?.filter(Boolean) ?? [];
  if (colors.length > 0) return colors[index % colors.length];
  if (element.color) return element.color;
  return DEFAULT_CHART_COLORS[index % DEFAULT_CHART_COLORS.length];
}

export function extendChartColors(
  colors: Array<string | null | undefined> | null | undefined,
  minLength: number,
  fallback?: string | null,
) {
  const next = (colors ?? [])
    .filter((color): color is string => Boolean(color))
    .map((color) => normalizeChartColor(color));
  if (next.length === 0) {
    next.push(normalizeChartColor(fallback ?? DEFAULT_CHART_COLORS[0]));
  }

  const targetLength = Math.min(12, Math.max(1, minLength));
  while (next.length < targetLength) {
    next.push(DEFAULT_CHART_COLORS[next.length % DEFAULT_CHART_COLORS.length]);
  }

  return next;
}

export function normalizeChartColor(
  color: string | null | undefined,
  fallback = DEFAULT_CHART_COLORS[0],
) {
  const value = (color ?? fallback).trim().replace(/^#/, "");
  if (/^[0-9A-Fa-f]{6}$/.test(value)) return value.toUpperCase();
  if (/^[0-9A-Fa-f]{3}$/.test(value)) {
    return value
      .split("")
      .map((part) => `${part}${part}`)
      .join("")
      .toUpperCase();
  }
  return fallback;
}

export function chartColorTargetMode(
  element: ChartElement,
): ChartColorTargetMode {
  return chartSupportsMultipleSeries(element.chart_type) &&
    (element.series?.length ?? 0) > 1
    ? "series"
    : "category";
}

export function chartSupportsMultipleSeries(chartType: ChartType) {
  return chartType !== "pie" && chartType !== "donut";
}

export function resolvedChartColorTargets(
  element: ChartElement,
): ChartColorTarget[] {
  const mode = chartColorTargetMode(element);
  const paletteSize = Math.min(
    12,
    Math.max(1, element.colors?.filter(Boolean).length ?? 0),
  );
  if (mode === "series") {
    return Array.from({ length: paletteSize }, (_, index) => ({
      color: normalizeChartColor(chartSeriesColor(element, index)),
      index,
      label:
        paletteSize === 1
          ? "Chart color"
          : element.series?.[index]?.name ?? `Color ${index + 1}`,
      mode,
    }));
  }

  if (mode === "category") {
    const categories = resolvedChartCategories(element);
    return Array.from({ length: paletteSize }, (_, index) => ({
      color: normalizeChartColor(chartSeriesColor(element, index)),
      index,
      label:
        categories[index] ??
        element.data[index]?.label ??
        `Item ${index + 1}`,
      mode,
    }));
  }

  return [];
}

export function chartDataFromSeriesWithColors(
  categories: string[],
  series: ChartSeries[],
  colors: string[],
  categoryColors = false,
): ChartDatum[] {
  const first = series[0];
  if (!first) return [];
  const labels =
    categories.length > 0
      ? categories
      : first.values.map((_, index) => `Item ${index + 1}`);
  const fallbackColor = colors[0] ?? DEFAULT_CHART_COLORS[0];

  return labels.slice(0, 8).map((label, index) => ({
    label,
    value: first.values[index] ?? 0,
    color: categoryColors
      ? colors[index % colors.length] ?? fallbackColor
      : fallbackColor,
  }));
}

export function updateChartColorTarget(
  element: ChartElement,
  targetIndex: number,
  color: string,
): ChartElement {
  if (!Number.isInteger(targetIndex) || targetIndex < 0 || targetIndex >= 12) {
    return element;
  }

  const mode = chartColorTargetMode(element);
  const targets = resolvedChartColorTargets(element);
  const colorCount = Math.min(12, Math.max(targetIndex + 1, targets.length));
  const colors = Array.from({ length: colorCount }, (_, index) =>
    normalizeChartColor(
      element.colors?.[index] ??
        (index === 0 ? element.color : null) ??
        DEFAULT_CHART_COLORS[index % DEFAULT_CHART_COLORS.length],
    ),
  );
  colors[targetIndex] = normalizeChartColor(color);

  const primaryColor = colors[0] ?? normalizeChartColor(color);
  const data = chartDataFromSeriesWithColors(
    resolvedChartCategories(element),
    element.series ?? [],
    colors,
    mode === "category",
  );
  const nextData =
    data.length > 0
      ? data
      : element.data.map((datum, index) => ({
          ...datum,
          color:
            mode === "category"
              ? colors[index % colors.length] ?? primaryColor
              : primaryColor,
        }));

  return {
    ...element,
    color: primaryColor,
    data: nextData,
    colors,
  };
}

export function appendChartColorTarget(element: ChartElement): ChartElement {
  const currentLength = Math.max(
    1,
    element.colors?.filter(Boolean).length ?? 0,
  );
  if (currentLength >= 12) return element;

  const colors = extendChartColors(
    element.colors,
    currentLength + 1,
    element.color,
  );
  const primaryColor = colors[0] ?? DEFAULT_CHART_COLORS[0];
  const mode = chartColorTargetMode(element);
  const data = chartDataFromSeriesWithColors(
    resolvedChartCategories(element),
    element.series ?? [],
    colors,
    mode === "category",
  );

  return {
    ...element,
    color: primaryColor,
    colors,
    data: data.length > 0 ? data : element.data,
  };
}

export function chartDataToCsv(element: ChartElement) {
  const categories = resolvedChartCategories(element);
  const datasets = resolvedChartDatasets(element);
  const rows = [
    ["", ...datasets.map((dataset) => dataset.name)],
    ...categories.map((category, index) => [
      category,
      ...datasets.map((dataset) => String(dataset.values[index] ?? 0)),
    ]),
  ];

  return rows.map((row) => row.map(escapeCsvCell).join(",")).join("\n");
}

export function normalizeChartTypeName(value: unknown) {
  if (typeof value !== "string") return "";
  return value
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .toLowerCase()
    .replace(/[\s-]+/g, "_")
    .replace(/_+/g, "_");
}

export function rawChartType(value: unknown): ChartType {
  const normalized = normalizeChartTypeName(value);
  switch (normalized) {
    case "area":
      return "area";
    case "bubble":
      return "bubble";
    case "donut":
    case "doughnut":
      return "donut";
    case "horizontal_bar":
    case "bar_horizontal":
      return "horizontal_bar";
    case "line":
      return "line";
    case "pie":
      return "pie";
    case "polar":
    case "polar_area":
      return "polar_area";
    case "radar":
      return "radar";
    case "scatter":
      return "scatter";
    case "stacked":
    case "stackedbar":
    case "stacked_bar":
    case "bar_stacked":
      return "stacked_bar";
    case "horizontalstackbar":
    case "horizontalstackedbar":
    case "horizontal_stack_bar":
    case "horizontal_stacked_bar":
      return "horizontal_stacked_bar";
    default:
      return "bar";
  }
}

function normalizeSeriesValues(series: ChartSeries, length: number) {
  const values = series.values.slice(0, Math.max(1, length || series.values.length));
  if (length <= values.length) return values;
  return [...values, ...Array.from({ length: length - values.length }, () => 0)];
}

function escapeCsvCell(value: string) {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}
