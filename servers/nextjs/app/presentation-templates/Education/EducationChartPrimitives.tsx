"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export type EducationChartType =
  | "bar"
  | "bar-horizontal"
  | "bar-grouped-vertical"
  | "bar-grouped-horizontal"
  | "bar-stacked-vertical"
  | "bar-stacked-horizontal"
  | "bar-clustered"
  | "bar-diverging"
  | "line"
  | "area"
  | "area-stacked"
  | "pie"
  | "donut"
  | "scatter";

export type SimpleDatum = {
  name: string;
  value: number;
};

export type MultiSeriesDatum = {
  name: string;
  values: Record<string, number>;
};

export type DivergingDatum = {
  name: string;
  positive: number;
  negative: number;
};

export type ScatterDatum = {
  x: number;
  y: number;
  name?: string;
};

export type EducationChartDatum = SimpleDatum | MultiSeriesDatum | DivergingDatum | ScatterDatum;

type TooltipPayloadItem = {
  color?: string;
  dataKey?: string | number;
  name?: string;
  value?: string | number;
};




const DEFAULT_COLORS = [
  "var(--graph-0,#4A15A8)",
  "var(--graph-1,#5B45AD)",
  "var(--graph-2,#7E6CC0)",
  "var(--graph-3,#9F94CD)",
  "var(--graph-4,#6A31B8)",
  "var(--graph-5,#4D2A97)",
];

const AXIS = "var(--background-text,#7C7A83)";
const GRID = "var(--stroke,#CFCBD8)";
const PRIMARY_TEXT = "var(--background-text,#3E3C45)";

function formatComma(value: number | string) {
  if (typeof value === "number") {
    return value.toLocaleString("en-US");
  }

  const parsed = Number(value);
  if (Number.isFinite(parsed)) {
    return parsed.toLocaleString("en-US");
  }

  return value;
}

function isSimpleDatum(item: EducationChartDatum): item is SimpleDatum {
  return typeof (item as SimpleDatum).name === "string" && typeof (item as SimpleDatum).value === "number";
}



function isScatterDatum(item: EducationChartDatum): item is ScatterDatum {
  return typeof (item as ScatterDatum).x === "number" && typeof (item as ScatterDatum).y === "number";
}

function toSimpleData(data: EducationChartDatum[]) {
  return data
    .filter(isSimpleDatum)
    .map((item) => ({
      name: item.name,
      value: item.value,
    }));
}

function toScatterData(data: EducationChartDatum[]) {
  const scatterData = data.filter(isScatterDatum);

  if (scatterData.length > 0) {
    return scatterData.map((item, index) => ({
      x: item.x,
      y: item.y,
      name: item.name ?? String(index + 1),
    }));
  }

  return data
    .filter(isSimpleDatum)
    .map((item, index) => ({
      x: index + 1,
      y: item.value,
      name: item.name,
    }));
}

const renderPieInsideLabel = (props: any) => {
  const {
    cx = 0,
    cy = 0,
    midAngle = 0,
    innerRadius: ir = 0,
    outerRadius: or = 0,
    percent = 0,
    name,
  } = props;
  if (percent < 0.08) return null;
  const toNum = (v: unknown) => {
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string" && v.trim().endsWith("%")) return NaN;
    const n = Number(v);
    return Number.isFinite(n) ? n : NaN;
  };
  let inner = toNum(ir);
  let outer = toNum(or);
  if (!Number.isFinite(outer)) {
    outer = 140;
    inner = Number.isFinite(inner) ? inner : 0;
  }
  if (!Number.isFinite(inner)) inner = 0;
  const midR = inner + (outer - inner) * 0.5;
  const rad = (-midAngle * Math.PI) / 180;
  const x = cx + midR * Math.cos(rad);
  const y = cy + midR * Math.sin(rad);
  const nm = String(name ?? "");
  const short = nm.length <= 10;
  const pct = `${(percent * 100).toFixed(0)}%`;
  const fontSize = short ? 10 : 9;
  const labelText = short ? `${name} ${pct}` : pct;
  return (
    <text
      x={x}
      y={y}
      textAnchor="middle"
      dominantBaseline="central"
      fill="var(--primary-text,#ffffff)"
      fontSize={fontSize}
      fontWeight={600}
      style={{
        paintOrder: "stroke fill",
        stroke: "rgba(0,0,0,0.28)",
        strokeWidth: 2,
      }}
    >
      {labelText}
    </text>
  );
};





function getChartColor(index: number) {
  return DEFAULT_COLORS[index % DEFAULT_COLORS.length];
}


function ChartLegend({ showLegend }: { showLegend: boolean }) {
  if (!showLegend) {
    return null;
  }

  return <Legend wrapperStyle={{ fontSize: "12px", color: AXIS, paddingTop: "8px" }} iconType="circle" />;
}

export default function EducationChartPrimitives({
  chartType,
  chartData,
  series,
  showLegend,

  divergingLabels,
}: {
  chartType: EducationChartType;
  chartData: EducationChartDatum[];
  series: string[];
  showLegend: boolean;
  showTooltip: boolean;
  divergingLabels: [string, string];
}) {
  const axisProps = {
    tick: { fill: AXIS, fontSize: 12, fontFamily: "var(--body-font-family,'Times New Roman')" },
    axisLine: { stroke: GRID },
    tickLine: { stroke: GRID },
  } as const;

  const gridProps = {
    strokeDasharray: "0",
    stroke: GRID,
    opacity: 1,
  } as const;

  const commonMargin = { top: 10, right: 12, left: 6, bottom: 8 };

  const simpleData = toSimpleData(chartData);

  const chart = (() => {
    switch (chartType) {
      case "bar":
        return (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={simpleData} margin={commonMargin}>
              <XAxis dataKey="name" {...axisProps} axisLine={false} tickLine={false} />
              <ChartLegend showLegend={showLegend} />
              <Bar dataKey="value" radius={[18, 18, 18, 18]} barSize={30} isAnimationActive={false}>
                {simpleData.map((_, index) => (
                  <Cell key={`bar-cell-${index}`} fill={getChartColor(index)} />
                ))}
                <LabelList
                  dataKey="value"
                  position="top"
                  fill={AXIS}
                  fontSize={12}
                  offset={10}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>

        );

      case "bar-horizontal":
        return (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={simpleData} layout="vertical" margin={commonMargin}>
              <CartesianGrid {...gridProps} horizontal={false} />
              <XAxis type="number" {...axisProps} tickFormatter={formatComma} />
              <YAxis type="category" dataKey="name" {...axisProps} width={74} />

              <ChartLegend showLegend={showLegend} />
              <Bar dataKey="value" radius={[0, 10, 10, 0]} isAnimationActive={false}>
                {simpleData.map((_, index) => (
                  <Cell key={`barh-cell-${index}`} fill={getChartColor(index)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        );










      case "line":
        return (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={simpleData} margin={commonMargin}>
              <CartesianGrid {...gridProps} horizontal={false} />
              <XAxis dataKey="name" {...axisProps} axisLine={false} tickLine={false} />
              <YAxis {...axisProps} tickFormatter={formatComma} axisLine={false} tickLine={false} />

              <ChartLegend showLegend={showLegend} />
              <Line
                type="monotone"
                dataKey="value"
                stroke={getChartColor(0)}
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        );

      case "area":
        return (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={simpleData} margin={commonMargin}>
              <CartesianGrid {...gridProps} vertical={false} />
              <XAxis dataKey="name" {...axisProps} axisLine={false} tickLine={false} />
              <YAxis {...axisProps} tickFormatter={formatComma} axisLine={false} tickLine={false} />

              <ChartLegend showLegend={showLegend} />
              <defs>
                <linearGradient id="education-area-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={getChartColor(0)} stopOpacity={0.35} />
                  <stop offset="95%" stopColor={getChartColor(0)} stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="value"
                stroke={getChartColor(0)}
                strokeWidth={2}
                fill="url(#education-area-fill)"
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        );



      case "pie":
        return (
          <ResponsiveContainer width="100%" height="100%">

            <PieChart margin={commonMargin}>
              <Pie
                data={simpleData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"

                label={renderPieInsideLabel}
                labelLine={false}
              >
                {simpleData.map((_, index) => (
                  <Cell key={`pie-cell-${index}`} fill={getChartColor(index)} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        );

      case "donut":
        return (
          <ResponsiveContainer width="100%" height="100%">

            <PieChart margin={commonMargin}>
              <Pie
                data={simpleData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={90}
                label={renderPieInsideLabel}
                paddingAngle={2}
                labelLine={false}
              >
                {simpleData.map((_, index) => (
                  <Cell key={`donut-cell-${index}`} fill={getChartColor(index)} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        );

      case "scatter": {
        const scatterData = toScatterData(chartData);
        const labelMap = new Map<number, string>();
        const xTicks = Array.from(new Set(scatterData.map((item) => item.x))).sort((a, b) => a - b);
        const minTick = xTicks[0] ?? 0;
        const maxTick = xTicks[xTicks.length - 1] ?? 1;

        scatterData.forEach((item) => {
          labelMap.set(item.x, item.name);
        });

        return (
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={commonMargin}>
              <CartesianGrid {...gridProps} vertical={false} />
              <XAxis
                type="number"
                dataKey="x"
                {...axisProps}
                ticks={xTicks}
                domain={[minTick - 0.5, maxTick + 0.5]}
                tickFormatter={(value) => labelMap.get(Number(value)) ?? String(value)}
              />
              <YAxis type="number" dataKey="y" {...axisProps} tickFormatter={formatComma} />

              <ChartLegend showLegend={showLegend} />
              <Scatter data={scatterData} fill={getChartColor(0)} isAnimationActive={false}>
                {scatterData.map((_, index) => (
                  <Cell key={`scatter-cell-${index}`} fill={getChartColor(index)} />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        );
      }

      default:
        return (
          <div className="flex h-full items-center justify-center text-[14px]" style={{ color: PRIMARY_TEXT }}>
            Unsupported chart type
          </div>
        );
    }
  })();

  return <ResponsiveContainer width="100%" height="100%">{chart}</ResponsiveContainer>;
}
