import type {
  ChartElement,
  ChartSeries,
  DataLabelPosition,
} from "@/components/slide-editor/types";
import { rawChartType } from "@/components/slide-editor/charts/chart-data";
import {
  readArray,
  readNumber,
  readString,
  type RawElement,
  type UnknownRecord,
} from "@/components/slide-editor/model/core";

const DATA_LABEL_POSITIONS = new Set(["base", "mid", "top", "outside"]);

export function rawChartToEditorChart(element: RawElement): ChartElement {
  const legacyData = readArray(element.data)
    .map((value) => legacyChartDatum(value))
    .filter(
      (value): value is { color?: string; label: string; value: number } =>
        value != null,
    );
  const categories = readArray(element.categories).map(String);
  const series = readArray(element.series)
    .map((value, index): ChartSeries | null => {
      const record =
        value && typeof value === "object" && !Array.isArray(value)
          ? (value as UnknownRecord)
          : null;
      if (!record) return null;
      const values = readArray(record.values ?? record.data).map(
        (item) => readNumber(item) ?? 0,
      );
      return {
        name: readString(record.name) ?? `Series ${index + 1}`,
        values,
      };
    })
    .filter((value): value is ChartSeries => value != null);
  const normalizedInputSeries =
    series.length > 0
      ? series
      : legacyData.length > 0
        ? [
            {
              name: readString(element.title) ?? "Series 1",
              values: legacyData.map((item) => item.value),
            },
          ]
        : [];
  const inputCategories =
    categories.length > 0
      ? categories
      : legacyData.map((item, index) => item.label || `Item ${index + 1}`);
  const chartType = rawChartType(element.chart_type ?? element.chartType);
  const supportedSeries =
    chartType === "pie" || chartType === "donut"
      ? normalizedInputSeries.slice(0, 1)
      : normalizedInputSeries;
  const normalizedSeries =
    supportedSeries.length > 0
      ? supportedSeries
      : [{ name: "Series 1", values: [0] }];
  const categoryLength = Math.max(
    inputCategories.length,
    ...normalizedSeries.map((item) => item.values.length),
  );
  const normalizedCategories =
    inputCategories.length > 0
      ? Array.from(
          { length: categoryLength },
          (_, index) => inputCategories[index] ?? `Item ${index + 1}`,
        )
      : Array.from({ length: categoryLength }, (_, index) => `Item ${index + 1}`);
  const legacyColors = legacyData
    .map((item) => item.color)
    .filter((value): value is string => Boolean(value));
  const colors = readArray(element.colors).map(String);
  const chartColors =
    colors.length > 0
      ? colors
      : legacyColors.length > 0
        ? legacyColors
        : [readString(element.color) ?? "7C51F8"];
  const firstSeries = normalizedSeries[0];
  const data = normalizedCategories.slice(0, 8).map((label, index) => ({
    label,
    value: firstSeries.values[index] ?? 0,
    color: normalizedSeries.length === 1
      ? chartColors[index % chartColors.length] ?? chartColors[0]
      : chartColors[0],
  }));

  return {
    ...withoutRemovedChartFields(element),
    type: "chart",
    chart_type: chartType,
    data: data.length > 0 ? data : [{ label: "Item 1", value: 0 }],
    categories: normalizedCategories,
    series: normalizedSeries,
    colors: chartColors,
    title_color: element.title_color ?? element.titleColor,
    axis_color: element.axis_color ?? element.axisColor,
    grid_color: element.grid_color ?? element.gridColor,
    x_axis: element.x_axis ?? element.xAxis,
    y_axis: element.y_axis ?? element.yAxis,
    x_axis_grid: element.x_axis_grid ?? element.xAxisGrid,
    y_axis_grid: element.y_axis_grid ?? element.yAxisGrid,
    x_axis_title: element.x_axis_title ?? element.xAxisTitle,
    y_axis_title: element.y_axis_title ?? element.yAxisTitle,
    data_labels: readDataLabelPosition(
      hasOwn(element, "data_labels") ? element.data_labels : element.dataLabels,
    ),
    legend: element.legend ?? element.showLegend,
    legend_color: element.legend_color ?? element.legendColor,
  };
}

function legacyChartDatum(value: unknown) {
  const directValue = readNumber(value);
  if (directValue != null) {
    return {
      label: "",
      value: directValue,
    };
  }

  const record =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as UnknownRecord)
      : null;
  if (!record) return null;

  const numericValue =
    readNumber(record.value) ??
    readNumber(record.data) ??
    readNumber(record.y);
  if (numericValue == null) return null;

  return {
    color: readString(record.color) ?? undefined,
    label: readString(record.label) ?? readString(record.name) ?? "",
    value: numericValue,
  };
}

export function editorChartToRawChart(source: RawElement, chart: UnknownRecord) {
  return {
    ...withoutRemovedChartFields(source),
    ...withoutRemovedChartFields(chart),
    type: "chart",
    position: source.position,
    size: source.size,
    rotation: source.rotation,
    layout: source.layout,
    chart_type: chart.chart_type ?? chart.chartType ?? source.chart_type,
    colors: chart.colors ?? source.colors,
    title_color:
      chart.title_color ??
      chart.titleColor ??
      source.title_color ??
      source.titleColor,
    axis_color: chart.axis_color ?? chart.axisColor ?? source.axis_color,
    grid_color: chart.grid_color ?? chart.gridColor ?? source.grid_color,
    x_axis: chart.x_axis ?? chart.xAxis ?? source.x_axis,
    y_axis: chart.y_axis ?? chart.yAxis ?? source.y_axis,
    x_axis_grid:
      chart.x_axis_grid ??
      chart.xAxisGrid ??
      source.x_axis_grid ??
      source.xAxisGrid,
    y_axis_grid:
      chart.y_axis_grid ??
      chart.yAxisGrid ??
      source.y_axis_grid ??
      source.yAxisGrid,
    x_axis_title: hasOwn(chart, "x_axis_title")
      ? chart.x_axis_title
      : chart.xAxisTitle ?? source.x_axis_title ?? source.xAxisTitle,
    y_axis_title: hasOwn(chart, "y_axis_title")
      ? chart.y_axis_title
      : chart.yAxisTitle ?? source.y_axis_title ?? source.yAxisTitle,
    data_labels: hasOwn(chart, "data_labels")
      ? readDataLabelPosition(chart.data_labels)
      : hasOwn(chart, "dataLabels")
        ? readDataLabelPosition(chart.dataLabels)
        : readDataLabelPosition(
            hasOwn(source, "data_labels") ? source.data_labels : source.dataLabels,
          ),
    legend:
      chart.legend ??
      chart.showLegend ??
      source.legend ??
      source.showLegend,
    legend_color:
      chart.legend_color ??
      chart.legendColor ??
      source.legend_color ??
      source.legendColor,
  };
}

function withoutRemovedChartFields(element: UnknownRecord) {
  const sanitized = { ...element };
  delete sanitized.data_labels_color;
  delete sanitized.dataLabelsColor;
  delete sanitized.labelColor;
  delete sanitized.grid;
  delete sanitized.axisColor;
  delete sanitized.chartType;
  delete sanitized.dataLabels;
  delete sanitized.gridColor;
  delete sanitized.showLegend;
  delete sanitized.xAxis;
  delete sanitized.xAxisGrid;
  delete sanitized.xAxisTitle;
  delete sanitized.yAxis;
  delete sanitized.yAxisGrid;
  delete sanitized.yAxisTitle;
  return sanitized;
}

function readDataLabelPosition(value: unknown): DataLabelPosition | null {
  if (value === true) return "top";
  if (value === false || value == null) return null;
  const text = readString(value);
  return text && DATA_LABEL_POSITIONS.has(text)
    ? (text as DataLabelPosition)
    : null;
}

function hasOwn(record: UnknownRecord, key: string) {
  return Object.prototype.hasOwnProperty.call(record, key);
}
