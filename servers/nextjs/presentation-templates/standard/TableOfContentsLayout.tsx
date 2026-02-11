import React from "react"
import * as z from "zod"

const layoutId = "table-of-contents-layout"
const layoutName = "Table Of Contents"
const layoutDescription = "Header with brand marker, title, optional description, and a two-column table of contents list"

const ToCItemSchema = z
  .object({
    title: z.string().min(4).max(50).default("Introduction").meta({
      description: "Section title. Max 50 characters",
    }),
  })
  .default({
    title: "Introduction",
  })

const Schema = z
  .object({
    topBar: z
      .object({

        marker: z.string().min(1).max(3).default("2").meta({
          description: "Numeric marker on the top bar. Up to 3 digits",
        }),
      })
      .default({ marker: "2" }),

    title: z
      .string()
      .min(12)
      .max(68)
      .default("Table Of Contents")
      .meta({ description: "Main slide title. Max 10 words" }),

    description: z
      .string()
      .min(0)
      .max(200)
      .default(
        "Use this as a quick guide to navigate the presentation sections."
      )
      .meta({ description: "Lead paragraph. Optional. Max 35 words" }),

    items: z
      .array(ToCItemSchema)
      .min(3)
      .max(10)
      .default([
        { title: "Introduction" },
        { title: "Problem Statement" },
        { title: "Solution" },
        { title: "Market" },
        { title: "Business Model" },
        { title: "Roadmap" },
        { title: "Team" },
        { title: "Go-To-Market" },
        { title: "Financials" },
        { title: "Ask" },
      ])
      .meta({ description: "List of contents (3-10)" }),
  })
  .default({
    topBar: { marker: "2" },
    title: "Table Of Contents",
    description:
      "Use this as a quick guide to navigate the presentation sections.",
    items: [
      { title: "Introduction" },
      { title: "Problem Statement" },
      { title: "Solution" },
      { title: "Market" },
      { title: "Business Model" },
      { title: "Roadmap" },
      { title: "Team" },
      { title: "Go-To-Market" },
      { title: "Financials" },
      { title: "Ask" },
    ],
  })

type SlideData = z.infer<typeof Schema>

interface SlideLayoutProps {
  data?: Partial<SlideData>
}

const dynamicSlideLayout: React.FC<SlideLayoutProps> = ({ data: slideData }) => {
  const items = slideData?.items || []

  return (
    <>
      <link
        href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600;700&display=swap"
        rel="stylesheet"
      />

      <div
        className=" w-full rounded-sm max-w-[1280px] shadow-lg max-h-[720px] aspect-video relative z-20 mx-auto overflow-hidden"
        style={{
          fontFamily: "var(--heading-font-family,Playfair Display)",
          backgroundColor: "var(--card-background-color, #FFFFFF)",
        }}
      >


        <div className="px-12">
          <h1
            className="text-[64px] leading-[1.05] tracking-tight  font-semibold mt-2"
            style={{ color: "var(--text-heading-color, #111827)" }}
          >
            {slideData?.title}
          </h1>
          {slideData?.description && (
            <p
              className="mt-5 text-[16px] leading-[1.6] max-w-[1020px] "
              style={{ color: "var(--text-body-color, #6B7280)" }}
            >
              {slideData?.description}
            </p>
          )}
        </div>

        <div className="px-10 mt-10">
          <div className="grid grid-cols-2 gap-4">
            {items.map((item, idx) => (
              <div
                key={idx}
                className="rounded-sm border shadow-[0_8px_24px_rgba(0,0,0,0.06)] px-4 py-3 flex items-center gap-4"
                style={{
                  backgroundColor: "var(--primary-accent-color, #FFFFFF)",
                  borderColor: "rgba(0,0,0,0.06)",
                }}
              >
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-[16px] font-semibold"
                  style={{
                    border: "2px solid var(--primary-accent-color, #1B8C2D)",
                    color: "var(--text-heading-color,, #111827)",
                  }}
                >
                  {idx + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div
                    className="text-[18px] leading-tight font-semibold  truncate"
                    style={{ color: "var(--text-heading-color, #111827)" }}
                  >
                    {item.title}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}

export { Schema, layoutId, layoutName, layoutDescription }
export default dynamicSlideLayout


