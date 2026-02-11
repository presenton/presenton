import React from "react"
import * as z from "zod"
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
} from "recharts"

const layoutId = "tableorChart"
const layoutName = "Table Or Chart"
const layoutDescription = "Swift: Generic data table with option to render a chart (bar, horizontalBar, line, pie)"

const ChartDatumSchema = z.object({
  label: z.string().min(1).max(12).default("A"),
  value: z.number().min(0).max(1000000).default(60),
})

const TableRowSchema = z.object({
  cells: z
    .array(z.string().min(0).max(200))
    .min(2)
    .max(10)
    .default(["Row 1", "Value", "Value"])
    .meta({ description: "Row cells; count should match columns length" }),
})

const Schema = z
  .object({
    title: z.string().min(6).max(60).default("Data Table or Chart"),
    description: z
      .string()
      .min(20)
      .max(220)
      .default(
        "Present structured information in a flexible table or visualize it with a chart."
      ),

    mode: z.enum(["table", "chart"]).default("table"),

    // Table configuration (generic)
    columns: z
      .array(z.string().min(1).max(40))
      .min(2)
      .max(10)
      .default(["Column 1", "Column 2", "Column 3"]),
    rows: z
      .array(TableRowSchema)
      .min(1)
      .max(30)
      .default([
        { cells: ["Row A", "✓", "-"] },
        { cells: ["Row B", "Text", "123"] },
        { cells: ["Row C", "More text", "456"] },
      ]),

    // Chart configuration (parity with @standard ChartLeftTextRightLayout)
    chart: z
      .object({
        type: z.enum(["bar", "horizontalBar", "line", "pie"]).default("line"),
        data: z.array(ChartDatumSchema).min(3).max(12).default([
          { label: "A", value: 60 },
          { label: "B", value: 42 },
          { label: "C", value: 75 },
          { label: "D", value: 30 },
        ]),
        primaryColor: z.string().default("var(--text-heading-color, #111827)"),
        gridColor: z.string().default("var(--primary-accent-color, #BFF4FF)"),
        pieColors: z
          .array(z.string())
          .min(1)
          .max(10)
          .default(["var(--text-heading-color, #111827)", "#3b82f6", "#f59e0b", "#10b981", "#ef4444"]),
        showLabels: z.boolean().default(true),
      })
      .default({
        type: "line",
        data: [
          { label: "A", value: 60 },
          { label: "B", value: 42 },
          { label: "C", value: 75 },
          { label: "D", value: 30 },
        ],
        primaryColor: "#1B8C2D",
        gridColor: "#E5E7EB",
        pieColors: ["#1B8C2D", "#3b82f6", "#f59e0b", "#10b981", "#ef4444"],
        showLabels: true,
      }),

    website: z.string().min(6).max(60).default("www.yourwebsite.com"),
  })
  .default({
    title: "Data Table or Chart",
    description:
      "Present structured information in a flexible table or visualize it with a chart.",
    mode: "table",
    columns: ["Column 1", "Column 2", "Column 3"],
    rows: [
      { cells: ["Row A", "✓", "-"] },
      { cells: ["Row B", "Text", "123"] },
      { cells: ["Row C", "More text", "456"] },
    ],
    chart: {
      type: "line",
      data: [
        { label: "A", value: 60 },
        { label: "B", value: 42 },
        { label: "C", value: 75 },
        { label: "D", value: 30 },
      ],
      primaryColor: "#1B8C2D",
      gridColor: "#E5E7EB",
      pieColors: ["#1B8C2D", "#3b82f6", "#f59e0b", "#10b981", "#ef4444"],
      showLabels: true,
    },
    website: "www.yourwebsite.com",
  })

type SlideData = z.infer<typeof Schema>

interface SlideLayoutProps {
  data?: Partial<SlideData>
}

const TableOrChart: React.FC<SlideLayoutProps> = ({ data: slideData }) => {
  const mode = slideData?.mode || "table"
  const columns = slideData?.columns || []
  const rows = slideData?.rows || []

  const cData = slideData?.chart?.data || []
  const type = slideData?.chart?.type || "bar"
  const primaryColor = slideData?.chart?.primaryColor || "var(--text-heading-color, #111827)"
  const gridColor = slideData?.chart?.gridColor || "var(--primary-accent-color, #BFF4FF)"
  const pieColors = slideData?.chart?.pieColors || ["var(--text-heading-color, #111827)"]
  const showLabels = slideData?.chart?.showLabels !== false

  return (
    <>
      <link
        href="https://fonts.googleapis.com/css2?family=Albert+Sans:wght@400;500;600;700&display=swap"
        rel="stylesheet"
      />

      <div
        className=" w-full rounded-sm max-w-[1280px] shadow-lg max-h-[720px] aspect-video relative z-20 mx-auto overflow-hidden"
        style={{
          fontFamily: "var(--heading-font-family,Albert Sans)",
          backgroundColor: "var(--card-background-color, #FFFFFF)",
        }}
      >


        {/* Title and description */}
        <div className="px-12 pt-3">
          <h1 className="text-[48px] leading-[1.1] font-semibold" style={{ color: "var(--text-heading-color, #111827)" }}>{slideData?.title}</h1>
          <p className="mt-3 text-[16px] max-w-[900px]" style={{ color: "var(--text-body-color, #6B7280)" }}>{slideData?.description}</p>
        </div>

        {/* Content area: Table or Chart */}
        <div className="px-12 pt-6">
          {mode === "table" ? (
            <div className="rounded-xl p-5" style={{ backgroundColor: 'var(--primary-accent-color, #BFF4FF)' }}>
              <div className="overflow-x-auto rounded-lg bg-white ring-1" style={{ borderColor: 'rgba(0,0,0,0.08)' }}>
                <table className="w-full border-separate border-spacing-0">
                  <thead>
                    <tr>
                      {columns.map((col, idx) => (
                        <th
                          key={idx}
                          className="text-left text-[14px] font-semibold px-4 py-3 border-b first:rounded-tl-md last:rounded-tr-md"
                          style={{
                            color: 'var(--text-heading-color, #111827)',
                            borderColor: 'var(--secondary-accent-color, rgba(0,0,0,0.12))',
                            backgroundColor: 'var(--primary-accent-color, #BFF4FF)'
                          }}
                        >
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, rIdx) => (
                      <tr key={rIdx} className="align-top">
                        {columns.map((_, cIdx) => (
                          <td
                            key={cIdx}
                            className={`text-[14px] px-4 py-3 border-t ${rIdx === rows.length - 1 ? 'first:rounded-bl-md last:rounded-br-md' : ''}`}
                            style={{
                              color: 'var(--text-body-color, #374151)',
                              borderColor: 'rgba(0,0,0,0.08)',
                              backgroundColor: rIdx % 2 === 0 ? 'var(--primary-accent-color, #BFF4FF)' : 'var(--tertiary-accent-color, #E5E7EB)'
                            }}
                          >
                            {row.cells[cIdx] || ''}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="w-full h-[360px] rounded-xl p-4" style={{ backgroundColor: 'var(--primary-accent-color, #BFF4FF)' }}>
              <ResponsiveContainer width="100%" height="100%">
                {type === 'bar' ? (
                  <BarChart data={cData} margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
                    <CartesianGrid stroke={gridColor} strokeDasharray="3 3" />
                    <XAxis dataKey="label" tick={{ fill: 'var(--text-body-color, #6B7280)', fontWeight: 600 }} />
                    <YAxis tick={{ fill: 'var(--text-body-color, #6B7280)', fontWeight: 600 }} />
                    <Tooltip labelStyle={{ color: 'var(--text-body-color, #6B7280)' }} itemStyle={{ color: 'var(--text-body-color, #6B7280)' }} />
                    <Legend wrapperStyle={{ color: 'var(--text-body-color, #6B7280)' }} />
                    <Bar dataKey="value" fill={primaryColor} radius={[6, 6, 0, 0]} label={showLabels ? { position: 'top', fill: '#111827', fontSize: 12 } : false} />
                  </BarChart>
                ) : type === 'horizontalBar' ? (
                  <BarChart data={cData} layout="vertical" margin={{ top: 10, right: 20, bottom: 10, left: 20 }}>
                    <CartesianGrid stroke={gridColor} strokeDasharray="3 3" />
                    <XAxis type="number" tick={{ fill: 'var(--text-body-color, #6B7280)', fontWeight: 600 }} />
                    <YAxis type="category" dataKey="label" tick={{ fill: 'var(--text-body-color, #6B7280)', fontWeight: 600 }} />
                    <Tooltip labelStyle={{ color: 'var(--text-body-color, #6B7280)' }} itemStyle={{ color: 'var(--text-body-color, #6B7280)' }} />
                    <Legend wrapperStyle={{ color: 'var(--text-body-color, #6B7280)' }} />
                    <Bar dataKey="value" fill={primaryColor} radius={[0, 6, 6, 0]} label={showLabels ? { position: 'right', fill: '#111827', fontSize: 12 } : false} />
                  </BarChart>
                ) : type === 'line' ? (
                  <LineChart data={cData} margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
                    <CartesianGrid stroke={gridColor} strokeDasharray="3 3" />
                    <XAxis dataKey="label" tick={{ fill: 'var(--text-body-color, #6B7280)', fontWeight: 600 }} />
                    <YAxis tick={{ fill: 'var(--text-body-color, #6B7280)', fontWeight: 600 }} />
                    <Tooltip labelStyle={{ color: 'var(--text-body-color, #6B7280)' }} itemStyle={{ color: 'var(--text-body-color, #6B7280)' }} />
                    <Legend wrapperStyle={{ color: 'var(--text-body-color, #6B7280)' }} />
                    <Line type="monotone" dataKey="value" stroke={primaryColor} strokeWidth={3} dot={{ r: 3 }} label={showLabels ? { position: 'top', fill: '#111827', fontSize: 12 } : false} />
                  </LineChart>
                ) : (
                  <PieChart>
                    <Tooltip labelStyle={{ color: 'var(--text-body-color, #6B7280)' }} itemStyle={{ color: 'var(--text-body-color, #6B7280)' }} />
                    <Legend wrapperStyle={{ color: 'var(--text-body-color, #6B7280)' }} />
                    <Pie data={cData} dataKey="value" nameKey="label" cx="50%" cy="50%" outerRadius={120} label={showLabels ? { fill: 'var(--text-body-color, #6B7280)' } : false}>
                      {cData.map((_, i) => (
                        <Cell key={i} fill={primaryColor} />
                      ))}
                    </Pie>
                  </PieChart>
                )}
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Footer (standardized like IntroSlideLayout) */}
        <div className="absolute bottom-8 left-12 right-12 flex items-center">
          <span className="text-[14px]" style={{ color: "var(--text-body-color, #6B7280)" }}>{slideData?.website}</span>
          <div className="ml-6 h-[2px] flex-1" style={{ backgroundColor: "var(--text-heading-color, #111827)" }}></div>
        </div>
        <div className="absolute bottom-7 right-6 w-8 h-8 rotate-45" style={{ backgroundColor: "var(--text-heading-color, #111827)" }}></div>
      </div>
    </>
  )
}

export { Schema, layoutId, layoutName, layoutDescription }
export default TableOrChart


