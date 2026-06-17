import React from 'react';
import * as z from 'zod';
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
} from './NeoChartPrimitives';
const DEFAULT_CHART_COLORS = ['#8B5CF6', '#06B6D4', '#10B981', '#F59E0B', '#EF4444', '#EC4899'];
const defaultCharts = [
    { title: 'Revenue by Quarter', type: 'bar-vertical' as const, data: [{ name: 'Q1', value: 125000 }, { name: 'Q2', value: 158000 }, { name: 'Q3', value: 142000 }, { name: 'Q4', value: 189000 }], colorPalette: 'vibrant' as const },
    { title: 'Market Distribution', type: 'donut' as const, data: [{ name: 'North America', value: 35 }, { name: 'Europe', value: 28 }, { name: 'Asia Pacific', value: 25 }, { name: 'Others', value: 12 }], colorPalette: 'ocean' as const },
    { title: 'Growth Trend', type: 'line' as const, data: [{ name: 'Jan', value: 30 }, { name: 'Feb', value: 45 }, { name: 'Mar', value: 52 }, { name: 'Apr', value: 48 }, { name: 'May', value: 67 }, { name: 'Jun', value: 82 }], colorPalette: 'professional' as const },
    { title: 'Department Performance', type: 'bar-horizontal' as const, data: [{ name: 'Sales', value: 87 }, { name: 'Marketing', value: 72 }, { name: 'Engineering', value: 95 }, { name: 'Support', value: 68 }], colorPalette: 'sunset' as const },
    { title: 'Product Comparison', type: 'bar-clustered' as const, data: [{ name: 'Q1', values: { 'Product A': 45, 'Product B': 62 } }, { name: 'Q2', values: { 'Product A': 58, 'Product B': 71 } }, { name: 'Q3', values: { 'Product A': 72, 'Product B': 65 } }], series: ['Product A', 'Product B'], colorPalette: 'vibrant' as const },
    { title: 'Customer Feedback', type: 'bar-diverging' as const, data: [{ name: 'Quality', positive: 78, negative: 22 }, { name: 'Service', positive: 65, negative: 35 }, { name: 'Price', positive: 42, negative: 58 }], series: ['Satisfied', 'Unsatisfied'], colorPalette: 'professional' as const },
];

const getGridLayout = (count: number): { cols: number; rows: number; className: string } => {
    switch (count) {
        case 1: return { cols: 1, rows: 1, className: 'grid-cols-1' };
        case 2: return { cols: 2, rows: 1, className: 'grid-cols-2' };
        case 3: return { cols: 3, rows: 1, className: 'grid-cols-3' };
        case 4: return { cols: 2, rows: 2, className: 'grid-cols-2' };
        case 5: return { cols: 3, rows: 2, className: 'grid-cols-3' };
        case 6: return { cols: 3, rows: 2, className: 'grid-cols-3' };
        default: return { cols: 2, rows: 2, className: 'grid-cols-2' };
    }
};
const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        return (
            <div
                className="bg-white/95 backdrop-blur-sm border rounded-lg shadow-lg px-3 py-2"
                style={{
                    backgroundColor: 'var(--card-color, #ffffff)',
                    borderColor: 'var(--stroke, #e5e7eb)',
                }}
            >
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


const MiniChartRenderer: React.FC<{
    chart: any;
    showLegend: boolean;
    showGrid: boolean;
    chartKey?: string;
}> = ({ chart, showLegend, showGrid, chartKey = '0' }) => {
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

    const graphColors = (index: number) => {
        const fallback = DEFAULT_CHART_COLORS[index % DEFAULT_CHART_COLORS.length];
        return `var(--graph-${index % 10}, ${fallback})`;
    };

    const gradId = (suffix: string) => `neo-swift-${chartKey}-${suffix}`;

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
                        <XAxis type="number" {...axisProps} />
                        <YAxis type="category" dataKey="name" {...axisProps} width={50} />
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
                        <XAxis type="number" {...axisProps} tickFormatter={formatComma} />
                        <YAxis type="category" dataKey="name" {...axisProps} width={50} tickFormatter={formatComma} />
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
                            <linearGradient id={gradId('area')} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor={graphColors(0)} stopOpacity={0.4} />
                                <stop offset="95%" stopColor={graphColors(0)} stopOpacity={0.05} />
                            </linearGradient>
                        </defs>
                        <Area type="monotone" dataKey="value" stroke={graphColors(0)} strokeWidth={2} fill={`url(#${gradId('area')})`} />
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
                            {data.map((_, index) => (
                                <Cell key={`cell-${index}`} fill={graphColors(index)} stroke="white" strokeWidth={2} />
                            ))}
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
                            {data.map((_, index) => (
                                <Cell key={`cell-${index}`} fill={graphColors(index)} stroke="white" strokeWidth={2} />
                            ))}
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
            return <div className="flex items-center justify-center h-full text-sm" style={{ color: 'var(--background-text, #9CA3AF)' }}>Unsupported chart type</div>;
    }
};

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



const ChartItemSchema = z.object({
    title: z.string().max(40).describe("Chart title").default("Chart Title"),
    type: ChartTypeEnum.default('bar-vertical'),
    data: z.union([
        z.array(z.object({ name: z.string(), value: z.number() })),
        z.array(z.object({
            name: z.string(),
            values: z.any().describe("Object with series names as keys and numbers as values"),
        })),
        z.array(z.object({
            name: z.string(),
            positive: z.number(),
            negative: z.number(),
        })),
        z.array(z.object({
            x: z.number(),
            y: z.number(),
            name: z.string().optional(),
        })),
    ]).default([
        { name: 'Q1', value: 45 },
        { name: 'Q2', value: 72 },
        { name: 'Q3', value: 58 },
        { name: 'Q4', value: 89 },
    ]),
    series: z.array(z.string()).optional().describe("Series names for grouped/stacked charts"),
    colorPalette: z.enum(['vibrant', 'ocean', 'forest', 'sunset', 'professional']).default('vibrant'),
});

export const Schema = z.object({
    title: z.string().min(3).max(50).default('Data Analytics Dashboard').describe('Main title of the slide'),
    description: z.string().min(10).max(200).default('Comprehensive overview of key metrics and performance indicators across multiple data dimensions.').describe('Description text below the title'),
    metrics: z.array(z.object({
        value: z.string().max(12).describe('The metric value'),
        label: z.string().max(24).describe('The metric label'),
    })).max(4).default([
        { value: '$3.5M', label: 'Pipeline' },
        { value: '28%', label: 'Conversion' },
        { value: '1.9x', label: 'ROI' },
        { value: '42', label: 'Accounts' },
    ]).describe('Up to 4 KPI metrics'),
    charts: z.array(ChartItemSchema).min(1).max(6).default(defaultCharts).describe('Array of 1–6 charts'),
    showLegend: z.boolean().default(true).describe('Whether to show chart legends'),
    showGrid: z.boolean().default(true).describe('Whether to show chart grid lines'),
    footerWebsite: z.string().max(30).default('www.hello.com').describe('Footer website URL'),
});

export const layoutId = 'title-description-six-charts-four-metrics';
export const layoutName = 'Title Description Six Charts Four Metrics';
export const layoutDescription = 'Neo Swift layout with title, description, 4 KPI metric cards, and a responsive grid of up to 6 charts. Ideal for analytics overviews and performance dashboards.';

const dynamicSlideLayout: React.FC<{ data: Partial<z.infer<typeof Schema>> }> = ({ data }) => {
    const title = data?.title || 'Data Analytics Dashboard';
    const description = data?.description || 'Comprehensive overview of key metrics and performance indicators.';
    const metrics = (data?.metrics ?? []).slice(0, 4);
    const charts = data?.charts ?? defaultCharts;
    const showLegend = data?.showLegend ?? true;
    const showGrid = data?.showGrid ?? true;
    const footerWebsite = data?.footerWebsite ?? 'www.hello.com';
    const chartCount = charts.length;
    const gridLayout = getGridLayout(chartCount);
    const hasMetrics = metrics.length > 0;

    return (
        <>
            <link href="https://fonts.googleapis.com/css2?family=Albert+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
            <div
                className="relative w-full rounded-sm max-w-[1280px] shadow-lg max-h-[720px] aspect-video bg-[#FFFFFE] z-20 mx-auto overflow-hidden flex flex-col"
                style={{ backgroundColor: 'var(--background-color,#FFFFFF)', fontFamily: 'var(--body-font-family,Albert Sans)' }}
            >
                <div className="absolute left-[65px] top-[52px] w-[17.6px] h-[17.6px]">
                    <svg viewBox="0 0 17.6 17.6" className="w-full h-full">
                        <path d="M 8.8 0 L 17.6 8.8 L 8.8 17.6 L 0 8.8 Z" fill="#4D5463" style={{ fill: 'var(--background-text,#4D5463)' }} />
                    </svg>
                </div>

                <div className="relative flex-1 min-h-0 overflow-hidden px-[72px] pt-16 pb-20 flex flex-col z-10">
                    <div className="mb-3 shrink-0">
                        <h1 className="text-[42.7px] font-bold leading-tight tracking-[-1.6px] mb-2" style={{ color: 'var(--background-text,#000000)' }}>
                            {title}
                        </h1>
                        <p className="text-[16px] leading-relaxed max-w-[760px] mb-4" style={{ color: 'var(--background-text,#4D5463)' }}>
                            {description}
                        </p>
                        {hasMetrics && (
                            <div className="grid grid-cols-4 gap-3">
                                {metrics.map((metric, index) => (
                                    <div
                                        key={index}
                                        className="rounded-[10.5px] border px-4 py-3"
                                        style={{ backgroundColor: 'var(--primary-color,#BEF4FE)', borderColor: 'var(--stroke,#EBEBEB)' }}
                                    >
                                        <div className="text-[18px] font-bold leading-tight" style={{ color: 'var(--primary-text,#000000)' }}>{metric.value}</div>
                                        <div className="text-[11px] font-medium mt-1" style={{ color: 'var(--primary-text,#4D5463)' }}>{metric.label}</div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className={`flex-1 min-h-0 grid ${gridLayout.className} auto-rows-fr gap-4 overflow-hidden`}>
                        {charts.map((chart, index) => (
                            <div
                                key={index}
                                className="rounded-xl border flex min-h-0 flex-col overflow-hidden"
                                style={{ borderColor: 'var(--stroke,#E5E7EB)', backgroundColor: 'var(--card-color,#FFFFFF)' }}
                            >
                                <div className="px-4 pt-3 pb-1">
                                    <h3 className="text-sm font-semibold " style={{ color: 'var(--background-text,#374151)' }}>{chart.title}</h3>
                                </div>
                                <div className="flex-1 min-h-0 overflow-hidden px-2 pb-2">
                                    <MiniChartRenderer chart={chart} showLegend={showLegend && chartCount <= 4} showGrid={showGrid} chartKey={`six-metrics-${index}`} />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="absolute bottom-5 left-[72px] right-[72px] flex items-center gap-5">
                    <div className="text-[16px] min-w-fit" style={{ color: 'var(--background-text,#000000)' }}>{footerWebsite}</div>
                    <div className="flex-grow h-[2.7px] rounded" style={{ backgroundColor: 'var(--background-text,#55626E)' }} />
                    <div className="w-[58px] h-[58px] flex-shrink-0">
                        <svg viewBox="0 0 58 58" className="w-full h-full">
                            <path d="M29 0L58 29L29 58L0 29Z" fill="#4D5463" style={{ fill: 'var(--background-text,#4D5463)' }} />
                        </svg>
                    </div>
                </div>
            </div>
        </>
    );
};

export default dynamicSlideLayout;
