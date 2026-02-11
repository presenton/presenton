import React from "react"
import * as z from "zod"

const layoutId = "Timeline"
const layoutName = "Timeline"
const layoutDescription = "Timeline of cards with title, subtitle banner"

const IconSchema = z
  .object({
    __icon_url__: z
      .string()
      .default(
        "https://presenton-public.s3.ap-southeast-1.amazonaws.com/static/icons/bold/clipboard-text-bold.svg"
      ),
    __icon_query__: z.string().min(0).max(80).default("timeline icon"),
  })
  .default({
    __icon_url__:
      "https://presenton-public.s3.ap-southeast-1.amazonaws.com/static/icons/bold/clipboard-text-bold.svg",
    __icon_query__: "timeline icon",
  })

const ItemSchema = z
  .object({
    year: z.string().min(3).max(6).default("2018"),
    heading: z.string().min(3).max(28).default("Founded in 2020"),
    body: z
      .string()
      .min(10)
      .max(160)
      .default("Lorem ipsum dolor"),
    icon: IconSchema,
  })
  .default({ year: "2018", heading: "Founded in 2020", body: "Lorem ipsum dolor", icon: IconSchema.parse({}) })

const Schema = z
  .object({
    title: z
      .string()
      .min(8)
      .max(60)
      .default("Our Journey at a Glance"),
    subtitle: z
      .string()
      .min(20)
      .max(200)
      .default(
        "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Aenean commodo ligula eget dolor. Aenean massa."
      ),
    items: z
      .array(ItemSchema)
      .min(1)
      .max(4)
      .default([
        ItemSchema.parse({ year: "2018", heading: "Founded in 2020", body: "Lorem ipsum dolor" }),
        ItemSchema.parse({ year: "2019", heading: "First Product in 2021", body: "Lorem ipsum dolor" }),
        ItemSchema.parse({ year: "2020", heading: "Key Milestone in 2022", body: "Lorem ipsum dolor" }),
        ItemSchema.parse({ year: "2021", heading: "Global Expansion in 2024", body: "Lorem ipsum dolor" }),
      ]),
    website: z.string().min(6).max(60).default("www.yourwebsite.com"),
  })
  .default({
    title: "Our Journey at a Glance",
    subtitle:
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Aenean commodo ligula eget dolor. Aenean massa.",
    items: [
      ItemSchema.parse({ year: "2018", heading: "Founded in 2020", body: "Lorem ipsum dolor" }),
      ItemSchema.parse({ year: "2019", heading: "First Product in 2021", body: "Lorem ipsum dolor" }),
      ItemSchema.parse({ year: "2020", heading: "Key Milestone in 2022", body: "Lorem ipsum dolor" }),
      ItemSchema.parse({ year: "2021", heading: "Global Expansion in 2024", body: "Lorem ipsum dolor" }),
    ],
    website: "www.yourwebsite.com",
  })

type SlideData = z.infer<typeof Schema>

interface SlideLayoutProps {
  data?: Partial<SlideData>
}

const Timeline: React.FC<SlideLayoutProps> = ({ data: slideData }) => {
  const items = slideData?.items || []
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
        {/* Keep white background to match Swift layouts */}



        {/* Right vertical diamonds */}
        <div className="absolute top-16 right-6 flex flex-col items-center gap-3">
          <div className="w-3 h-3 rotate-45" style={{ backgroundColor: "var(--text-heading-color, #111827)" }}></div>
          <div className="w-3 h-3 rotate-45" style={{ backgroundColor: "var(--text-heading-color, #111827)" }}></div>
          <div className="w-3 h-3 rotate-45" style={{ backgroundColor: "var(--text-heading-color, #111827)" }}></div>
        </div>

        {/* Title */}
        <div className="relative px-12 pt-3 flex flex-col items-center">
          <h1 className="text-[48px] leading-[1.1] font-semibold text-center" style={{ color: "var(--text-heading-color, #111827)" }}>{slideData?.title}</h1>
          {/* Subtitle banner */}
          <div className="mt-5 max-w-[720px] w-full rounded-md text-center px-6 py-3" style={{
            borderColor: "rgba(0,0,0,0.25)",
            color: "var(--text-body-color, #6B7280)",
            backgroundColor: "var(--primary-accent-color, #BFF4FF)",
          }}>
            <span className="text-[16px]">{slideData?.subtitle}</span>
          </div>
        </div>

        {/* Horizontal timeline */}
        <div className="relative px-12 pt-10">
          {/* center line */}
          <div className="absolute left-12 right-12 top-1/2 h-[4px]" style={{ backgroundColor: 'var(--primary-accent-color, #BFF4FF)' }}></div>

          <div className="relative flex justify-center gap-10">
            {items.slice(0, 4).map((it, idx) => (
              <div key={idx} className="relative flex flex-col items-center">
                {/* year badge - placed close to the card */}
                <div className="mb-2 px-5 py-2 rounded-md text-white text-[16px] font-semibold" style={{ backgroundColor: 'var(--text-heading-color, #111827)' }}>{it.year}</div>

                {/* connector dot */}
                <div className="w-5 h-5 rounded-full border-4" style={{ backgroundColor: 'var(--card-background-color, #FFFFFF)', borderColor: 'var(--primary-accent-color, #BFF4FF)' }}></div>

                {/* card container */}
                <div className="mt-4">
                  <div className="rounded-[16px] bg-white shadow-[0_16px_40px_rgba(0,0,0,0.08)] px-6 pt-6 pb-5 text-center w-[260px]">
                    <div className="mx-auto w-12 h-12 rounded-full flex items-center justify-center mb-4" style={{ backgroundColor: 'var(--primary-accent-color, #BFF4FF)' }}>
                      <img src={it.icon.__icon_url__} alt={it.icon.__icon_query__} className="w-6 h-6 object-contain" />
                    </div>
                    <div className="text-[18px] font-semibold" style={{ color: 'var(--text-heading-color, #111827)' }}>{it.heading}</div>
                    <p className="mt-3 text-[14px]" style={{ color: 'var(--text-body-color, #6B7280)' }}>{it.body}</p>
                  </div>
                </div>
              </div>
            ))}
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
export default Timeline


