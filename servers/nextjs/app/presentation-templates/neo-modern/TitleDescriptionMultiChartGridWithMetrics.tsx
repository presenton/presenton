/**
 * Neo-modern layout: title, description, up to 4 metrics, and 1–6 charts in a responsive grid.
 */
import React from 'react';
import * as z from "zod";
import {
    ResponsiveContainer,
    BarChart,
    Bar,
    LineChart,
    Line,
    AreaChart,
    Area,
    PieChart,
    Pie,
    ScatterChart,
    Scatter,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    Cell,
    ReferenceLine,
} from "./NeoChartPrimitives";

export const layoutId = 'title-description-multi-chart-grid-metrics';
export const layoutName = 'Title Description With Multi-Chart Grid + Metrics';
export const layoutDescription = 'A neo-modern dashboard with title, description, up to 4 KPI metrics, and 1–6 auto-arranged charts. Supports bar (vertical, horizontal, grouped, stacked, clustered, diverging), line, area, pie, donut, and scatter charts.';

const DEFAULT_CHART_COLORS = ['#8B5CF6', '#06B6D4', '#10B981', '#F59E0B', '#EF4444', '#EC4899'];

const ChartTypeEnum = z.enum([
    'bar-vertical',
    'bar-horizontal',
    'bar-grouped-vertical',
    'bar-grouped-horizontal',
    'bar-stacked-vertical',
    'bar-stacked-horizontal',
    'bar-clustered',
    'bar-diverging',
    'line',
    'area',
    'area-stacked',
    'pie',
    'donut',
    'scatter',
]);

const SimpleDataPointSchema = z.object({
    name: z.string(),
    value: z.number(),
});

const MultiSeriesDataPointSchema = z.object({
    name: z.string(),
    values: z.any(),
});

const DivergingDataPointSchema = z.object({
    name: z.string(),
    positive: z.number(),
    negative: z.number(),
});

const ScatterDataPointSchema = z.object({
    x: z.number(),
    y: z.number(),
    name: z.string().optional(),
});

const ChartItemSchema = z.object({
    title: z.string().max(40).default("Chart Title"),
    type: ChartTypeEnum.default('bar-vertical'),
    data: z.union([
        z.array(SimpleDataPointSchema),
        z.array(MultiSeriesDataPointSchema),
        z.array(DivergingDataPointSchema),
        z.array(ScatterDataPointSchema),
    ]).default([
        { name: 'Q1', value: 45 },
        { name: 'Q2', value: 72 },
        { name: 'Q3', value: 58 },
        { name: 'Q4', value: 89 },
    ]),
    series: z.array(z.string()).optional(),
    colorPalette: z.enum(['vibrant', 'ocean', 'forest', 'sunset', 'professional']).default('vibrant'),
});

export const Schema = z.object({
    title: z.string().min(3).max(50).default('Data Analytics Dashboard'),
    description: z.string().min(10).max(200).default('Comprehensive overview of key metrics and performance indicators across multiple data dimensions.'),
    metrics: z.array(z.object({
        value: z.string().max(12).default('$3.5M'),
        label: z.string().max(24).default('Pipeline'),
    })).max(4).default([
        { value: '$3.5M', label: 'Pipeline' },
        { value: '28%', label: 'Conversion' },
        { value: '1.9x', label: 'ROI' },
        { value: '42', label: 'Accounts' },
    ]),
    charts: z.array(ChartItemSchema).min(1).max(6).default([
        { title: 'Revenue by Quarter', type: 'bar-vertical', data: [{ name: 'Q1', value: 125000 }, { name: 'Q2', value: 158000 }, { name: 'Q3', value: 142000 }, { name: 'Q4', value: 189000 }], colorPalette: 'vibrant' },
        { title: 'Market Distribution', type: 'donut', data: [{ name: 'North America', value: 35 }, { name: 'Europe', value: 28 }, { name: 'Asia Pacific', value: 25 }, { name: 'Others', value: 12 }], colorPalette: 'ocean' },
        { title: 'Growth Trend', type: 'line', data: [{ name: 'Jan', value: 30 }, { name: 'Feb', value: 45 }, { name: 'Mar', value: 52 }, { name: 'Apr', value: 48 }, { name: 'May', value: 67 }, { name: 'Jun', value: 82 }], colorPalette: 'professional' },
        { title: 'Department Performance', type: 'bar-horizontal', data: [{ name: 'Sales', value: 87 }, { name: 'Marketing', value: 72 }, { name: 'Engineering', value: 95 }, { name: 'Support', value: 68 }], colorPalette: 'sunset' },
        { title: 'Product Comparison', type: 'bar-clustered', data: [{ name: 'Q1', values: { 'Product A': 45, 'Product B': 62 } }, { name: 'Q2', values: { 'Product A': 58, 'Product B': 71 } }, { name: 'Q3', values: { 'Product A': 72, 'Product B': 65 } }], series: ['Product A', 'Product B'], colorPalette: 'vibrant' },
        { title: 'Customer Feedback', type: 'bar-diverging', data: [{ name: 'Quality', positive: 78, negative: 22 }, { name: 'Service', positive: 65, negative: 35 }, { name: 'Price', positive: 42, negative: 58 }], series: ['Satisfied', 'Unsatisfied'], colorPalette: 'professional' },
    ]),
    showLegend: z.boolean().default(true),
    showGrid: z.boolean().default(true),
});

export type MultiChartGridSlideData = z.infer<typeof Schema>;

interface MultiChartGridSlideLayoutProps {
    data?: Partial<MultiChartGridSlideData>;
}

const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-white/95 backdrop-blur-sm border rounded-lg shadow-lg px-3 py-2" style={{ backgroundColor: 'var(--card-color, #ffffff)', borderColor: 'var(--stroke, #e5e7eb)' }}>
                <p className="text-[10px] font-semibold mb-1" style={{ color: 'var(--background-text, #111827)' }}>{label}</p>
                {payload.map((entry: any, index: number) => (
                    <p key={index} className="text-[9px]" style={{ color: 'var(--background-text, #111827)' }}>
                        {entry.name}: <span className="font-medium">{entry.value?.toLocaleString()}</span>
                    </p>
                ))}
            </div>
        );
    }
    return null;
};

const MiniChartRenderer: React.FC<{
    chart: z.infer<typeof ChartItemSchema>;
    showLegend: boolean;
    showGrid: boolean;
}> = ({ chart, showLegend, showGrid }) => {
    const data = chart.data as any[];
    const series = chart.series || [];
    const formatComma = (value: number) => {
        return value.toLocaleString('en-US');
    };
    const axisProps = {
        tick: { fill: 'var(--background-text, #7f8491)', fontSize: 9, fontWeight: 500 },
        axisLine: { stroke: 'var(--background-text, #7f8491)' },
        tickLine: { stroke: 'var(--background-text, #7f8491)' },
    };

    const gridProps = {
        strokeDasharray: "3 3",
        stroke: "var(--background-text, #7f8491)",
        opacity: 0.5,
    };

    const transformMultiSeriesData = (data: any[], series: string[]) => {
        return data.map(item => {
            const result: Record<string, any> = { name: item.name };
            series.forEach(s => { result[s] = item.values?.[s] ?? 0; });
            return result;
        });
    };

    const transformDivergingData = (data: any[]) => {
        return data.map(item => ({
            name: item.name,
            positive: item.positive,
            negative: -Math.abs(item.negative),
        }));
    };

    const renderPieLabel = (props: any) => {
        const { cx, cy, fill, midAngle, outerRadius, percent } = props;
        if (percent < 0.08) return null;
        const labelRadius = outerRadius + 10;
        const x = cx + labelRadius * Math.cos((-midAngle * Math.PI) / 180);
        const y = cy + labelRadius * Math.sin((-midAngle * Math.PI) / 180);

        return (
            <text x={x} y={y} fill={fill} fontSize={13} fontWeight={500} textAnchor={x >= cx ? 'start' : 'end'} dominantBaseline="central">
                {`${(percent * 100).toFixed(0)}%`}
            </text>
        );
    };

    const graphColors = (index: number) => {
        const fallback = DEFAULT_CHART_COLORS[index % DEFAULT_CHART_COLORS.length];
        return `var(--graph-${index % 10}, ${fallback})`;
    };

    switch (chart.type) {
        case 'bar-vertical':
            return (
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 5 }}>
                        {showGrid && <CartesianGrid {...gridProps} />}
                        <XAxis dataKey="name" {...axisProps} tickFormatter={formatComma} />
                        <YAxis {...axisProps} tickFormatter={formatComma} />
                        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
                        <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                            {data.map((_, index) => <Cell key={`cell-${index}`} fill={graphColors(index)} />)}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            );

        case 'bar-horizontal':
            return (
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data} layout="vertical" margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
                        {showGrid && <CartesianGrid {...gridProps} />}
                        <XAxis type="number" {...axisProps} tickFormatter={formatComma} />
                        <YAxis type="category" dataKey="name" {...axisProps} width={50} tickFormatter={formatComma} />
                        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
                        <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                            {data.map((_, index) => <Cell key={`cell-${index}`} fill={graphColors(index)} />)}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            );

        case 'bar-grouped-vertical': {
            const transformedData = transformMultiSeriesData(data, series);
            return (
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={transformedData} margin={{ top: 10, right: 10, left: -10, bottom: 5 }}>
                        {showGrid && <CartesianGrid {...gridProps} />}
                        <XAxis dataKey="name" {...axisProps} tickFormatter={formatComma} />
                        <YAxis {...axisProps} tickFormatter={formatComma} />
                        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
                        {showLegend && <Legend wrapperStyle={{ fontSize: '9px' }} />}
                        {series.map((s: string, index: number) => (
                            <Bar key={s} dataKey={s} fill={graphColors(index)} radius={[3, 3, 0, 0]} />
                        ))}
                    </BarChart>
                </ResponsiveContainer>
            );
        }

        case 'bar-grouped-horizontal': {
            const transformedData = transformMultiSeriesData(data, series);
            return (
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={transformedData} layout="vertical" margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
                        {showGrid && <CartesianGrid {...gridProps} />}
                        <XAxis type="number" {...axisProps} tickFormatter={formatComma} />
                        <YAxis type="category" dataKey="name" {...axisProps} width={50} tickFormatter={formatComma} />
                        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
                        {showLegend && <Legend wrapperStyle={{ fontSize: '9px' }} />}
                        {series.map((s: string, index: number) => (
                            <Bar key={s} dataKey={s} fill={graphColors(index)} radius={[0, 3, 3, 0]} />
                        ))}
                    </BarChart>
                </ResponsiveContainer>
            );
        }

        case 'bar-stacked-vertical': {
            const transformedData = transformMultiSeriesData(data, series);
            return (
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={transformedData} margin={{ top: 10, right: 10, left: -10, bottom: 5 }}>
                        {showGrid && <CartesianGrid {...gridProps} />}
                        <XAxis dataKey="name" {...axisProps} />
                        <YAxis {...axisProps} />
                        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
                        {showLegend && <Legend wrapperStyle={{ fontSize: '9px' }} />}
                        {series.map((s: string, index: number) => (
                            <Bar key={s} dataKey={s} stackId="stack" fill={graphColors(index)} radius={index === series.length - 1 ? [3, 3, 0, 0] : [0, 0, 0, 0]} />
                        ))}
                    </BarChart>
                </ResponsiveContainer>
            );
        }

        case 'bar-stacked-horizontal': {
            const transformedData = transformMultiSeriesData(data, series);
            return (
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={transformedData} layout="vertical" margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
                        {showGrid && <CartesianGrid {...gridProps} />}
                        <XAxis type="number" {...axisProps} />
                        <YAxis type="category" dataKey="name" {...axisProps} width={50} />
                        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
                        {showLegend && <Legend wrapperStyle={{ fontSize: '9px' }} />}
                        {series.map((s: string, index: number) => (
                            <Bar key={s} dataKey={s} stackId="stack" fill={graphColors(index)} radius={index === series.length - 1 ? [0, 3, 3, 0] : [0, 0, 0, 0]} />
                        ))}
                    </BarChart>
                </ResponsiveContainer>
            );
        }

        case 'bar-clustered': {
            if (series.length === 0) {
                return (
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={data} barGap={2} barCategoryGap="20%" margin={{ top: 10, right: 10, left: -10, bottom: 5 }}>
                            {showGrid && <CartesianGrid {...gridProps} />}
                            <XAxis dataKey="name" {...axisProps} tickFormatter={formatComma} />
                            <YAxis {...axisProps} tickFormatter={formatComma} />
                            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
                            <Bar dataKey="value" radius={[4, 4, 0, 0]} barSize={32}>
                                {data.map((_, index) => <Cell key={`cell-${index}`} fill={graphColors(index)} />)}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                );
            }
            const transformedData = transformMultiSeriesData(data, series);
            return (
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={transformedData} barGap={1} barCategoryGap="15%" margin={{ top: 10, right: 10, left: -10, bottom: 5 }}>
                        {showGrid && <CartesianGrid {...gridProps} />}
                        <XAxis dataKey="name" {...axisProps} tickFormatter={formatComma} />
                        <YAxis {...axisProps} tickFormatter={formatComma} />
                        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
                        {showLegend && <Legend wrapperStyle={{ fontSize: '9px' }} />}
                        {series.map((s: string, index: number) => (
                            <Bar key={s} dataKey={s} fill={graphColors(index)} radius={[3, 3, 0, 0]} barSize={Math.max(12, 40 / series.length)} />
                        ))}
                    </BarChart>
                </ResponsiveContainer>
            );
        }

        case 'bar-diverging': {
            const hasDivergingFormat = data.length > 0 && ('positive' in data[0] || 'negative' in data[0]);
            const transformedData = hasDivergingFormat
                ? transformDivergingData(data)
                : data.map((item: any, idx: number) => ({
                    name: item.name,
                    positive: idx % 2 === 0 ? Math.abs(item.value) : 0,
                    negative: idx % 2 === 1 ? -Math.abs(item.value) : 0,
                }));
            const seriesLabels = chart.series || ['Positive', 'Negative'];
            return (
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={transformedData} layout="vertical" stackOffset="sign" margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
                        {showGrid && <CartesianGrid {...gridProps} />}
                        <XAxis type="number" {...axisProps} tickFormatter={formatComma} />
                        <YAxis type="category" dataKey="name" {...axisProps} width={50} tickFormatter={formatComma} />
                        <ReferenceLine x={0} stroke="#9CA3AF" strokeWidth={1} />
                        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
                        {showLegend && <Legend wrapperStyle={{ fontSize: '9px' }} />}
                        <Bar dataKey="positive" name={seriesLabels[0]} fill={graphColors(0)} stackId="stack" radius={[0, 3, 3, 0]} />
                        <Bar dataKey="negative" name={seriesLabels[1]} fill={graphColors(3)} stackId="stack" radius={[3, 0, 0, 3]} />
                    </BarChart>
                </ResponsiveContainer>
            );
        }

        case 'line':
            return (
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 5 }}>
                        {showGrid && <CartesianGrid {...gridProps} />}
                        <XAxis dataKey="name" {...axisProps} tickFormatter={formatComma} />
                        <YAxis {...axisProps} tickFormatter={formatComma} />
                        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
                        <Line type="monotone" dataKey="value" stroke={graphColors(0)} strokeWidth={2} dot={{ fill: graphColors(0), r: 3 }} activeDot={{ r: 5 }} />
                    </LineChart>
                </ResponsiveContainer>
            );

        case 'area':
            return (
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 5 }}>
                        {showGrid && <CartesianGrid {...gridProps} />}
                        <XAxis dataKey="name" {...axisProps} tickFormatter={formatComma} />
                        <YAxis {...axisProps} tickFormatter={formatComma} />
                        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
                        <defs>
                            <linearGradient id={`areaGrad-${chart.title}`} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor={graphColors(0)} stopOpacity={0.4} />
                                <stop offset="95%" stopColor={graphColors(0)} stopOpacity={0.05} />
                            </linearGradient>
                        </defs>
                        <Area type="monotone" dataKey="value" stroke={graphColors(0)} strokeWidth={2} fill={`url(#areaGrad-${chart.title})`} />
                    </AreaChart>
                </ResponsiveContainer>
            );

        case 'area-stacked': {
            const transformedData = transformMultiSeriesData(data, series);
            return (
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={transformedData} margin={{ top: 10, right: 10, left: -10, bottom: 5 }}>
                        {showGrid && <CartesianGrid {...gridProps} />}
                        <XAxis dataKey="name" {...axisProps} tickFormatter={formatComma} />
                        <YAxis {...axisProps} tickFormatter={formatComma} />
                        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
                        {showLegend && <Legend wrapperStyle={{ fontSize: '9px' }} />}
                        {series.map((s: string, index: number) => (
                            <Area key={s} type="monotone" dataKey={s} stackId="1" stroke={graphColors(index)} fill={graphColors(index)} fillOpacity={0.4} />
                        ))}
                    </AreaChart>
                </ResponsiveContainer>
            );
        }

        case 'pie':
            return (
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart margin={{ top: 14, right: 32, left: 32, bottom: 14 }}>
                        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
                        <Pie data={data} cx="50%" cy="50%" outerRadius="68%" dataKey="value" label={renderPieLabel} labelLine={false}>
                            {data.map((_, index) => <Cell key={`cell-${index}`} fill={graphColors(index)} stroke="white" strokeWidth={2} />)}
                        </Pie>
                    </PieChart>
                </ResponsiveContainer>
            );

        case 'donut':
            return (
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart margin={{ top: 14, right: 32, left: 32, bottom: 14 }}>
                        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
                        <Pie data={data} cx="50%" cy="50%" innerRadius="42%" outerRadius="68%" dataKey="value" label={renderPieLabel} labelLine={false} paddingAngle={2}>
                            {data.map((_, index) => <Cell key={`cell-${index}`} fill={graphColors(index)} stroke="white" strokeWidth={2} />)}
                        </Pie>
                    </PieChart>
                </ResponsiveContainer>
            );

        case 'scatter':
            return (
                <ResponsiveContainer width="100%" height="100%">
                    <ScatterChart margin={{ top: 10, right: 10, left: -10, bottom: 5 }}>
                        {showGrid && <CartesianGrid {...gridProps} />}
                        <XAxis type="number" dataKey="x" {...axisProps} tickFormatter={formatComma} />
                        <YAxis type="number" dataKey="y" {...axisProps} tickFormatter={formatComma} />
                        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
                        <Scatter data={data}>
                            {data.map((_, index) => <Cell key={`cell-${index}`} fill={graphColors(index)} />)}
                        </Scatter>
                    </ScatterChart>
                </ResponsiveContainer>
            );

        default:
            return <div className="flex items-center justify-center h-full text-gray-400 text-sm">Unsupported chart type</div>;
    }
};

const getGridLayout = (count: number): { className: string } => {
    switch (count) {
        case 1: return { className: 'grid-cols-1' };
        case 2: return { className: 'grid-cols-2' };
        case 3: return { className: 'grid-cols-3' };
        case 4: return { className: 'grid-cols-2' };
        case 5:
        case 6: return { className: 'grid-cols-3' };
        default: return { className: 'grid-cols-2' };
    }
};

const TitleDescriptionMultiChartGridWithMetricsLayout: React.FC<MultiChartGridSlideLayoutProps> = ({ data: slideData }) => {
    const title = slideData?.title || 'Data Analytics Dashboard';
    const description = slideData?.description || 'Comprehensive overview of key metrics and performance indicators.';
    const charts = slideData?.charts || [];
    const metrics = (slideData?.metrics || []).slice(0, 4);
    const showLegend = slideData?.showLegend ?? true;
    const showGrid = slideData?.showGrid ?? true;
    const chartCount = charts.length;
    const gridLayout = getGridLayout(chartCount);
    const hasMetrics = metrics.length > 0;

    return (
        <>
            <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700&display=swap" rel="stylesheet" />
            <div
                className="relative w-full rounded-sm max-w-[1280px] shadow-lg max-h-[720px] aspect-video bg-white z-20 mx-auto overflow-hidden flex font-normal"
                style={{
                    backgroundColor: 'var(--background-color,#FFFFFF)',
                    fontFamily: 'var(--body-font-family,Montserrat)',
                }}
            >
                {((slideData as any)?.__companyName__ || (slideData as any)?._logo_url__) && (
                    <div className="absolute top-0 left-0 right-0 px-8 pt-4 z-10">
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-1">
                                {(slideData as any)?._logo_url__ && <img src={(slideData as any)?._logo_url__} alt="logo" className="w-[60px] object-contain" />}
                                <span style={{ backgroundColor: 'var(--stroke, #F0F0F0)' }} className="w-[2px] h-4" />
                                {(slideData as any)?.__companyName__ && (
                                    <span className="text-sm font-semibold" style={{ color: 'var(--background-text, #002BB2)' }}>
                                        {(slideData as any)?.__companyName__ || 'Company Name'}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                <div className="relative w-full h-full min-h-0 overflow-hidden p-[60px] pt-[50px] flex flex-col">
                    <div className="mb-5 shrink-0">
                        <h1
                            className="text-[42.7px] font-bold leading-[1.1] tracking-[-1.6px] mb-[12px]"
                            style={{ color: 'var(--background-text,#002BB2)' }}
                        >
                            {title}
                        </h1>
                        <p
                            className="text-[16px] font-normal leading-[1.6]"
                            style={{ color: 'var(--background-text,#002BB2)' }}
                        >
                            {description}
                        </p>
                        {hasMetrics && (
                            <div className="mt-4 grid grid-cols-4 gap-3">
                                {metrics.map((metric, index) => (
                                    <div
                                        key={index}
                                        className="rounded-[6px] border px-3 py-2"
                                        style={{ borderColor: 'var(--stroke,#F0F0F2)', backgroundColor: 'var(--card-color,#FFFFFF)' }}
                                    >
                                        <div className="text-[18px] font-semibold leading-tight" style={{ color: 'var(--background-text,#002BB2)' }}>
                                            {metric.value}
                                        </div>
                                        <div className="text-[10px] font-medium mt-1 opacity-80" style={{ color: 'var(--background-text,#002BB2)' }}>
                                            {metric.label}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className={`flex-1 min-h-0 grid ${gridLayout.className} auto-rows-fr gap-4 overflow-hidden`}>
                        {charts.map((chart, index) => (
                            <div
                                key={index}
                                className="rounded-[6px] border flex min-h-0 flex-col overflow-hidden"
                                style={{ borderColor: 'var(--stroke,#F0F0F2)', backgroundColor: 'var(--card-color,#FFFFFF)' }}
                            >
                                <div className="px-4 pt-3 pb-1">
                                    <h3
                                        className="text-sm font-semibold "
                                        style={{ color: 'var(--background-text,#374151)' }}
                                    >
                                        {chart.title}
                                    </h3>
                                </div>
                                <div className="flex-1 min-h-0 overflow-hidden px-2 pb-2">
                                    <MiniChartRenderer
                                        chart={chart}
                                        showLegend={showLegend && chartCount <= 4}
                                        showGrid={showGrid}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </>
    );
};

export default TitleDescriptionMultiChartGridWithMetricsLayout;
