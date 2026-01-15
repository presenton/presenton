import React from 'react'
import * as z from "zod";
import { LineChart, Line, BarChart, Bar, XAxis, CartesianGrid, YAxis } from 'recharts';
import ActionableLogo from '@/components/ActionableLogo';
import ActionableWrapper from '@/components/ActionableWrapper';
import ActionableTitle from '@/components/ActionableTitle';
import ActionableParagraph from '@/components/ActionableParagraph';
import ActionableCredits from '@/components/ActionableCredits';
import { ChartContainer, ChartLegend } from '@/components/ui/chart';
import { ActionableMainContent } from '@/components/ActionableMainContent';

export const layoutId = 'chart-slide'
export const layoutName = 'Chart Slide'
export const layoutDescription = 'A slide layout with a chart and optional notes below.'

const lineConfigSchema = z.object({
  dataKey: z.string().min(1).max(30).default("value").meta({
    description: "Key in data objects for this line",
  }),
  name: z.string().min(1).max(50).default("Series").meta({
    description: "Display name for this line in the legend",
  }),
  color: z.string().default("#2A9D90").meta({
    description: "Color for this line (hex code). Use #2A9D90 for first series, #E76E50 for second, #F4A261 for third, #264653 for fourth, #E9C46A for fifth",
  }),
  strokeWidth: z.number().min(1).max(5).default(2).meta({
    description: "Width of the line stroke",
  })
})

const chartSlideSchema = z.object({
  title: z.string().min(3).max(80).default("Growth Trajectory Analysis").meta({
    description: "Main title of the slide",
  }),
  subtitle: z.string().min(5).max(100).default("Year-over-year performance metrics showing consistent growth across all key indicators").meta({
    description: "Explanatory caption for the chart",
  }),
  chartType: z.enum(['line', 'bar']).default('line').meta({
    description: "Type of chart to display: 'line' for line chart or 'bar' for bar chart",
  }),
  data: z.array(z.record(z.string(), z.union([z.string(), z.number()]))).min(2).max(20).default([
    { month: 'Jan', revenue: 45000, users: 1200 },
    { month: 'Feb', revenue: 52000, users: 1450 },
    { month: 'Mar', revenue: 58000, users: 1680 },
    { month: 'Apr', revenue: 63000, users: 1920 },
    { month: 'May', revenue: 71000, users: 2150 },
    { month: 'Jun', revenue: 78000, users: 2400 }
  ]).meta({
    description: "Chart data points - each object should have a label field and numeric values for each line",
  }),
  xAxisKey: z.string().default('month').meta({
    description: "Key for x-axis values in data objects",
  }),
  lines: z.array(lineConfigSchema).min(1).max(5).default([
    { dataKey: 'revenue', name: 'Revenue', color: '#2A9D90', strokeWidth: 3 },
    { dataKey: 'users', name: 'Active Users', color: '#E76E50', strokeWidth: 2 }
  ]).meta({
    description: "Configuration for each line to display. Use colors in order: #2A9D90 (first), #E76E50 (second), #F4A261 (third), #264653 (fourth), #E9C46A (fifth)",
  }),
  belowText: z.string().max(300).optional().default("Data reflects Q1-Q2 performance with projections indicating continued upward trend through year-end").meta({
    description: "Optional notes or text below the chart",
  })
})

export const Schema = chartSlideSchema

export type ChartSlideData = z.infer<typeof chartSlideSchema>

const ChartSlideLayout: React.FC<{ data: ChartSlideData }> = ({ data }) => {
  const title = data.title;
  const subtitle = data.subtitle;
  const chartData = data.data;
  const xAxisKey = data.xAxisKey;
  const lines = data.lines;
  const belowText = data.belowText;
  const chartType = data.chartType;

  return (
    <ActionableWrapper className="flex flex-col p-[50px]">
      <div className='flex flex-col h-full justify-between'>
        <ActionableLogo />

        <ActionableMainContent className='pb-3 gap-5'>
          {/* Title */}
          <ActionableTitle>
            {title}
          </ActionableTitle>

          <ActionableParagraph>
            {subtitle}
          </ActionableParagraph>

          {/* Chart Container */}
          <div className="flex-1 w-full">
            <ChartContainer config={{}} className='w-full h-[300px]'>
              {chartType === 'line' ? (
                <LineChart
                  data={chartData}
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <YAxis 
                    orientation='right'
                    style={{ fontSize: '12px', fontFamily: "Geist, sans-serif", color: 'var(--muted-foreground)' }}
                    tickLine={false}
                  />
                  <XAxis 
                    dataKey={xAxisKey}
                    style={{ fontSize: '12px', fontFamily: "Geist, sans-serif", color: 'var(--muted-foreground)' }}
                    tickLine={false}
                  />
                  {lines.map((line) => (
                    <Line
                      key={line.dataKey}
                      type="monotone"
                      dataKey={line.dataKey}
                      name={line.name}
                      stroke={line.color}
                      strokeWidth={line.strokeWidth}
                      dot={false}
                      isAnimationActive={false}
                    />
                  ))}
                  <ChartLegend />
                </LineChart>
              ) : (
                <BarChart
                  data={chartData}
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <YAxis 
                    orientation='right'
                    style={{ fontSize: '12px', fontFamily: "Geist, sans-serif", color: 'var(--muted-foreground)' }}
                    tickLine={false}
                  />
                  <XAxis 
                    dataKey={xAxisKey}
                    style={{ fontSize: '12px', fontFamily: "Geist, sans-serif", color: 'var(--muted-foreground)' }}
                    tickLine={false}
                  />
                  {lines.map((line) => (
                    <Bar
                      key={line.dataKey}
                      dataKey={line.dataKey}
                      name={line.name}
                      fill={line.color}
                      isAnimationActive={false}
                    />
                  ))}
                  <ChartLegend />
                </BarChart>
              )}
            </ChartContainer>
          </div>

          {/* Notes */}
          {belowText && (
            <ActionableParagraph>
              {belowText}
            </ActionableParagraph>
          )}
        </ActionableMainContent>

        <ActionableCredits />
      </div>
    </ActionableWrapper>
  );
};

export default ChartSlideLayout;
