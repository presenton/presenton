import React from "react"
import * as z from "zod"

const layoutId = "MetricsNumbers"
const layoutName = "Metrics Numbers"
const layoutDescription = "Swift: Our Impact in Numbers with three stacked metric cards"

const MetricSchema = z
  .object({
    value: z.string().min(1).max(8).default("10K+"),
    line1: z.string().min(2).max(22).default("Total"),
    line2: z.string().min(0).max(22).default("Users"),
    description: z
      .string()
      .min(10)
      .max(140)
      .default("active users across multiple industries"),
  })
  .default({
    value: "10K+",
    line1: "Total",
    line2: "Users",
    description: "active users across multiple industries",
  })

const Schema = z
  .object({
    title: z
      .string()
      .min(8)
      .max(60)
      .default("Our Impact in Numbers"),
    leftTitle: z
      .string()
      .min(6)
      .max(40)
      .default("Proven Results\nThrough Data"),
    leftBody: z
      .string()
      .min(30)
      .max(220)
      .default(
        "Lorem ipsum dolor sit amet, consectetur adipiscing elit."
      ),
    website: z.string().min(6).max(60).default("www.yourwebsite.com"),
    metrics: z
      .array(MetricSchema)
      .min(1)
      .max(4)
      .default([
        MetricSchema.parse({
          value: "10K+",
          line1: "Total",
          line2: "Users",
          description: "active users across multiple industries",
        }),
        MetricSchema.parse({
          value: "150%",
          line1: "Revenue",
          line2: "Growth",
          description: "year-over-year revenue growth",
        }),
        MetricSchema.parse({
          value: "95%",
          line1: "Customer",
          line2: "Satisfaction",
          description: "retention rate with an average rating of 4.8/5",
        }),
      ]),
  })
  .default({
    title: "Our Impact in Numbers",
    leftTitle: "Proven Results\nThrough Data",
    leftBody: "Lorem ipsum dolor sit amet, consectetur adipiscing elit.",
    website: "www.yourwebsite.com",
    metrics: [
      MetricSchema.parse({
        value: "10K+",
        line1: "Total",
        line2: "Users",
        description: "active users across multiple industries",
      }),
      MetricSchema.parse({
        value: "150%",
        line1: "Revenue",
        line2: "Growth",
        description: "year-over-year revenue growth",
      }),
      MetricSchema.parse({
        value: "95%",
        line1: "Customer",
        line2: "Satisfaction",
        description: "retention rate with an average rating of 4.8/5",
      }),
    ],
  })

type SlideData = z.infer<typeof Schema>

interface SlideLayoutProps {
  data?: Partial<SlideData>
}

const MetricsNumbers: React.FC<SlideLayoutProps> = ({ data: slideData }) => {
  const metrics = slideData?.metrics || []
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


        {/* Separator line like the reference */}
        <div className="absolute top-0 left-1/2 w-[1px] h-full" style={{ backgroundColor: "rgba(0,0,0,0.1)" }}></div>

        <div className="px-12 pt-3 grid grid-cols-[42%_58%] gap-8 items-start">
          {/* Left content */}
          <div>
            <h1 className="text-[48px] leading-[1.1] font-semibold max-w-[420px]" style={{ color: "var(--text-heading-color, #111827)" }}>{slideData?.title}</h1>
            <div className="mt-8 inline-flex items-center gap-3">
              <div className="w-5 h-5 rounded-full" style={{ backgroundColor: "var(--text-heading-color, #111827)" }}></div>
              <div>
                <div className="text-[20px] font-semibold whitespace-pre-line" style={{ color: "var(--text-heading-color, #111827)" }}>{slideData?.leftTitle}</div>
              </div>
            </div>
            <p className="mt-5 text-[16px] leading-[1.8] max-w-[360px]" style={{ color: "var(--text-body-color, #6B7280)" }}>{slideData?.leftBody}</p>
          </div>

          {/* Right stacked metric cards */}
          <div className="relative">
            {/* decorative circle on the right */}
            <div className="absolute top-6 -right-24 w-[220px] h-[220px] rounded-full border" style={{ borderColor: "rgba(0,0,0,0.2)" }}></div>

            <div className="flex flex-col gap-6">
              {metrics.slice(0, 3).map((m, i) => (
                <div key={i} className="rounded-[18px] px-6 py-5 grid grid-cols-[38%_62%] items-start shadow-[0_16px_40px_rgba(0,0,0,0.08)]" style={{ backgroundColor: 'var(--primary-accent-color, #BFF4FF)' }}>
                  <div className="text-[40px] font-semibold" style={{ color: 'var(--text-heading-color, #111827)' }}>{m.value}</div>
                  <div>
                    <div className="text-[16px] font-semibold" style={{ color: 'var(--text-heading-color, #111827)' }}>{m.line1}</div>
                    {m.line2 && <div className="-mt-1 text-[16px] font-semibold" style={{ color: 'var(--text-heading-color, #111827)' }}>{m.line2}</div>}
                    <p className="mt-3 text-[12px] leading-[1.6]" style={{ color: 'var(--text-body-color, #6B7280)' }}>{m.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
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
export default MetricsNumbers


