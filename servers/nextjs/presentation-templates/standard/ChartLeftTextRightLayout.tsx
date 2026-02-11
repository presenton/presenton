import React from 'react'
import * as z from 'zod'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from 'recharts'

const layoutId = 'chart-left-text-right-layout'
const layoutName = 'Chart Left Text Right'
const layoutDescription = 'A slide with header label, a left-side inline bar chart, and right-side title with paragraph.'

const ChartDatumSchema = z.object({
  label: z.string().min(1).max(12).default('A').meta({ description: 'Category label' }),
  value: z.number().min(0).max(100).default(60).meta({ description: 'Value 0–100' }),
})

const Schema = z.object({

  title: z
    .string()
    .min(16)
    .max(64)
    .default('Insights At A Glance')
    .meta({ description: 'Main heading (max ~7 words)' }),
  paragraph: z
    .string()
    .min(50)
    .max(200)
    .default(
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.'
    )
    .meta({ description: 'Supporting description' }),
  chart: z
    .object({
      type: z.enum(['bar', 'horizontalBar', 'line', 'pie']).default('line'),
      data: z.array(ChartDatumSchema).min(3).max(8).default([
        { label: 'A', value: 60 },
        { label: 'B', value: 42 },
        { label: 'C', value: 75 },
        { label: 'D', value: 30 },
      ]),
      primaryColor: z.string().default('#1B8C2D'),
      gridColor: z.string().default('#E5E7EB'),
      pieColors: z.array(z.string()).min(1).max(10).default(['#1B8C2D', '#3b82f6', '#f59e0b', '#10b981', '#ef4444']),
      showLabels: z.boolean().default(true),
    })
    .default({
      type: 'line',
      data: [
        { label: 'A', value: 60 },
        { label: 'B', value: 42 },
        { label: 'C', value: 75 },
        { label: 'D', value: 30 },
      ],
      primaryColor: '#1B8C2D',
      gridColor: '#E5E7EB',
      pieColors: ['#1B8C2D', '#3b82f6', '#f59e0b', '#10b981', '#ef4444'],
      showLabels: true,
    }),
})

type SlideData = z.infer<typeof Schema>

interface SlideLayoutProps {
  data?: Partial<SlideData>
}

const dynamicSlideLayout: React.FC<SlideLayoutProps> = ({ data: slideData }) => {
  const data = slideData?.chart?.data || []
  const type = slideData?.chart?.type || 'bar'
  const primaryColor = slideData?.chart?.primaryColor || '#1B8C2D'
  const gridColor = slideData?.chart?.gridColor || '#E5E7EB'
  const pieColors = slideData?.chart?.pieColors || ['#1B8C2D']
  const showLabels = slideData?.chart?.showLabels !== false

  return (
    <>
      <link
        href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600;700&display=swap"
        rel="stylesheet"
      />
      <div
        className=" w-full rounded-sm max-w-[1280px] shadow-lg max-h-[720px] aspect-video relative z-20 mx-auto overflow-hidden"
        style={{ fontFamily: "var(--heading-font-family,Playfair Display)", backgroundColor: 'var(--card-background-color, #FFFFFF)' }}
      >


        <div className="grid grid-cols-2 h-[calc(100%-64px)]">
          {/* Left: Recharts visualization */}
          <div className="h-full px-10 pt-8">
            <div className="w-full h-full flex items-center">
              <div className="w-full" style={{ height: 320 }}>
                <ResponsiveContainer width="100%" height="100%">
                  {type === 'bar' ? (
                    <BarChart data={data} margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
                      <CartesianGrid stroke={gridColor} strokeDasharray="3 3" />
                      <XAxis dataKey="label" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="value" fill={primaryColor} radius={[6, 6, 0, 0]} label={showLabels ? { position: 'top', fill: '#111827', fontSize: 12 } : false} />
                    </BarChart>
                  ) : type === 'horizontalBar' ? (
                    <BarChart data={data} layout="vertical" margin={{ top: 10, right: 20, bottom: 10, left: 20 }}>
                      <CartesianGrid stroke={gridColor} strokeDasharray="3 3" />
                      <XAxis type="number" />
                      <YAxis type="category" dataKey="label" />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="value" fill={primaryColor} radius={[0, 6, 6, 0]} label={showLabels ? { position: 'right', fill: '#111827', fontSize: 12 } : false} />
                    </BarChart>
                  ) : type === 'line' ? (
                    <LineChart data={data} margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
                      <CartesianGrid stroke={gridColor} strokeDasharray="3 3" />
                      <XAxis dataKey="label" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="value" stroke={primaryColor} strokeWidth={3} dot={{ r: 3 }} label={showLabels ? { position: 'top', fill: '#111827', fontSize: 12 } : false} />
                    </LineChart>
                  ) : (
                    <PieChart>
                      <Tooltip />
                      <Legend />
                      <Pie data={data} dataKey="value" nameKey="label" cx="50%" cy="50%" outerRadius={100} label={showLabels}>
                        {data.map((_, i) => (
                          <Cell key={i} fill={pieColors[i % pieColors.length]} />
                        ))}
                      </Pie>
                    </PieChart>
                  )}
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Right: Text */}
          <div className="h-full px-12 flex flex-col justify-center">
            <h1 className="text-[64px] leading-[1.05] tracking-tight font-semibold" style={{ color: 'var(--text-heading-color, #111827)' }}>
              {slideData?.title || 'Insights At A Glance'}
            </h1>
            <p className="mt-6 text-[16px] leading-[28px]" style={{ color: 'var(--text-body-color, #6B7280)' }}>
              {slideData?.paragraph ||
                'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.'}
            </p>
          </div>
        </div>
      </div>
    </>
  )
}

export { Schema, layoutId, layoutName, layoutDescription }
export default dynamicSlideLayout


