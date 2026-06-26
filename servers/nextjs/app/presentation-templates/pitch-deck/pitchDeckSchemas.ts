import * as z from "zod";

export const DARK_BG = "var(--background-color,#27292d)";
export const ACCENT_TEXT = "var(--primary-color,#dddac7)";
export const BODY_TEXT = "var(--primary-text,#d7d3be)";
export const MUTED_TEXT = "var(--background-text,#cbc7b2)";
export const BORDER = "var(--border-color,#8d8a7d)";
export const SUBTLE_LINE = "var(--line-color,#4c4e53)";

export const ChartTypeSchema = z.enum(["bar", "pie", "scatter", "stackedBar", "line"]);

export const BarDatumSchema = z.object({
  label: z.string().max(10).meta({
    description: "X-axis label for bar/line/stacked charts.",
  }),
  value: z.number().max(300).meta({
    description: "Primary numeric value.",
  }),
  value2: z.number().max(300).optional().meta({
    description: "Secondary stacked value when using stacked bar charts.",
  }),
});

export const PieDatumSchema = z.object({
  label: z.string().max(16).meta({
    description: "Legend label for pie slices.",
  }),
  value: z.number().max(100).meta({
    description: "Slice percentage value.",
  }),
  color: z.string().max(20).meta({
    description: "Slice fill color.",
  }),
});

export const ScatterDatumSchema = z.object({
  label: z.string().max(10).meta({
    description: "X-axis label for scatter points.",
  }),
  value: z.number().max(100).meta({
    description: "Y-axis value for the point.",
  }),
});

export const ChartPayloadSchema = z.object({
  chartType: ChartTypeSchema.default("bar").meta({
    description: "Chart type rendered on the right side.",
  }),
  legendLabel: z.string().max(30).default("Series Label").meta({
    description: "Single-series legend label for non-pie charts.",
  }),
  yAxisLabel: z.string().max(16).default("Y axis name").meta({
    description: "Y-axis title used in scatter charts.",
  }),
  barData: z
    .array(BarDatumSchema)
    
    .max(8)
    .default([
      { label: "Mon", value: 120 },
      { label: "Tue", value: 200 },
      { label: "Wed", value: 150 },
      { label: "Thu", value: 80 },
      { label: "Fri", value: 70 },
      { label: "Sat", value: 110 },
      { label: "Sun", value: 130 },
    ])
    .meta({
      description: "Dataset for regular bar charts.",
    }),
  pieData: z
    .array(PieDatumSchema)
    
    .max(3)
    .default([
      { label: "Category A", value: 55, color: "#dddac7" },
      { label: "Category B", value: 25, color: "#b8b4a3" },
      { label: "Category C", value: 20, color: "#a2a091" },
    ])
    .meta({
      description: "Pie chart dataset.",
    }),
  scatterData: z
    .array(ScatterDatumSchema)
    
    .max(10)
    .default([
      { label: "label", value: 7 },
      { label: "label", value: 2 },
      { label: "label", value: 92 },
      { label: "label", value: 15 },
      { label: "label", value: 91 },
      { label: "label", value: 73 },
      { label: "label", value: 56 },
      { label: "label", value: 90 },
    ])
    .meta({
      description: "Scatter points for distribution charts.",
    }),
  lineData: z
    .array(BarDatumSchema)
    
    .max(8)
    .default([
      { label: "Mon", value: 30 },
      { label: "Tue", value: 48 },
      { label: "Wed", value: 64 },
      { label: "Thu", value: 42 },
      { label: "Fri", value: 58 },
      { label: "Sat", value: 70 },
      { label: "Sun", value: 90 },
    ])
    .meta({
      description: "Dataset for line charts.",
    }),
  stackedBarData: z
    .array(BarDatumSchema)
    
    .max(8)
    .default([
      { label: "Mon", value: 50, value2: 50 },
      { label: "Tue", value: 80, value2: 70 },
      { label: "Wed", value: 90, value2: 90 },
      { label: "Thu", value: 40, value2: 60 },
      { label: "Fri", value: 80, value2: 70 },
      { label: "Sat", value: 90, value2: 90 },
      { label: "Sun", value: 70, value2: 80 },
    ])
    .meta({
      description: "Dataset for stacked bar charts using value and value2.",
    }),
});
