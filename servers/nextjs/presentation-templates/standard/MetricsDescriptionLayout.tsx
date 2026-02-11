import React from 'react'
// charts removed
import * as z from "zod";

const ImageSchema = z.object({
  __image_url__: z.string().url().default("https://images.unsplash.com/photo-1503264116251-35a269479413?q=80&w=1200&auto=format&fit=crop").meta({
    description: "URL to image",
  }),
  __image_prompt__: z.string().min(10).max(200).default("Elegant abstract green themed background for a presentation slide, minimal shapes, soft lighting").meta({
    description: "Prompt used to generate the image. Max 40 words",
  }),
})

const IconSchema = z.object({
  __icon_url__: z.string().default("https://static.thenounproject.com/png/1783767-200.png").meta({
    description: "URL to icon",
  }),
  __icon_query__: z.string().min(3).max(40).default("leaf growth").meta({
    description: "Query used to search the icon. Max 6 words",
  }),
})

const layoutId = "header-tagline-cards-grid-slide"
const layoutName = "Metrics Description"
const layoutDescription = "A slide with a top utility row, a header, a tagline, and a grid of cards each with a number block and text"

const CardSchema = z.object({
  number: z.string().min(1).max(5).default("45").meta({
    description: "Main number text inside number block. 1 to 3 digits",
  }),
  numberSymbol: z.string().min(0).max(3).default("%").meta({
    description: "Optional symbol next to the number. Single character",
  }),
  subtitle: z.string().min(8).max(28).default("Subtitle Here").meta({
    description: "Card subtitle. Max 5 words",
  }),
  body: z.string().min(20).max(100).default("Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do.").meta({
    description: "Card body text. Max 100 characters",
  }),
  icon: IconSchema.default({
    __icon_url__: "https://static.thenounproject.com/png/1783767-200.png",
    __icon_query__: "progress indicator",
  }).meta({
    description: "Optional icon for the card header area",
  }),
})

const Schema = z.object({

  title: z.string().min(12).max(70).default("Scaling New Heights Together").meta({
    description: "Main title. Single line up to ~34 chars or two lines up to ~70 chars. Max 9 words",
  }),
  tagline: z.string().min(40).max(120).default("Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna").meta({
    description: "Subtitle/tagline under title. Max 20 words",
  }),
  decorativeLine: ImageSchema.default({
    __image_url__: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='220' height='2' viewBox='0 0 220 2'><rect width='220' height='2' rx='1' fill='%230B8E26'/></svg>",
    __image_prompt__: "Thin green horizontal line divider, 220x2, rounded ends",
  }).meta({
    description: "SVG decorative line asset",
  }),
  cards: z.array(CardSchema).min(1).max(6).default([
    {
      number: "87",
      numberSymbol: "%",
      subtitle: "Customer Satisfaction",
      body: "Our customers consistently rate their experience with our products and services as excellent.",
      icon: { __icon_url__: "https://static.thenounproject.com/png/1783767-200.png", __icon_query__: "happy customer icon" },
    },
    {
      number: "2.5",
      numberSymbol: "M",
      subtitle: "Active Users Monthly",
      body: "Growing user base actively engaging with our platform across multiple regions worldwide.",
      icon: { __icon_url__: "https://static.thenounproject.com/png/1783767-200.png", __icon_query__: "users group icon" },
    },
    {
      number: "99",
      numberSymbol: "%",
      subtitle: "System Uptime",
      body: "Maintaining exceptional reliability with industry-leading system availability and performance.",
      icon: { __icon_url__: "https://static.thenounproject.com/png/1783767-200.png", __icon_query__: "server uptime icon" },
    },
    {
      number: "142",
      numberSymbol: "+",
      subtitle: "Global Partners",
      body: "Strategic partnerships driving innovation and market expansion across key industry sectors.",
      icon: { __icon_url__: "https://static.thenounproject.com/png/1783767-200.png", __icon_query__: "handshake deal icon" },
    },
    {
      number: "32",
      numberSymbol: "x",
      subtitle: "Revenue Growth",
      body: "Year-over-year growth demonstrating strong market position and business model scalability.",
      icon: { __icon_url__: "https://static.thenounproject.com/png/1783767-200.png", __icon_query__: "growth chart icon" },
    },
    {
      number: "500",
      numberSymbol: "K",
      subtitle: "Carbon Offset",
      body: "Committed to sustainability through significant carbon reduction and environmental initiatives.",
      icon: { __icon_url__: "https://static.thenounproject.com/png/1783767-200.png", __icon_query__: "leaf sustainability icon" },
    },
  ]).meta({
    description: "Grid of cards with number block, subtitle, and body (<=100 chars)",
  }),
  // chart and diagram removed
})

type SlideData = z.infer<typeof Schema>

interface SlideLayoutProps {
  data?: Partial<SlideData>
}

const dynamicSlideLayout: React.FC<SlideLayoutProps> = ({ data: slideData }) => {
  const cards = slideData?.cards || []

  return (
    <>
      <link
        href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600;700&display=swap"
        rel="stylesheet"
      />
      <div className=" w-full rounded-sm max-w-[1280px] shadow-lg max-h-[720px] aspect-video relative z-20 mx-auto overflow-hidden" style={{ fontFamily: "var(--heading-font-family,Playfair Display)", backgroundColor: 'var(--card-background-color, #FFFFFF)' }}>
        <div className="h-full flex flex-col px-10 pt-6 pb-8">


          <h1 className="mt-4 text-[64px] leading-[1.06] tracking-tight  font-semibold" style={{ color: 'var(--text-heading-color, #111827)' }}>
            {slideData?.title || "Scaling New Heights Together"}
          </h1>

          <p className="mt-3 text-[16px] " style={{ color: 'var(--text-body-color, #6B7280)' }}>
            {slideData?.tagline || "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna"}
          </p>

          <div className="mt-8 grid grid-cols-2 gap-x-10 gap-y-6">
            {cards.map((card, idx) => (
              <div key={idx} className="rounded-md shadow-sm px-5 py-4" style={{ backgroundColor: 'var(--primary-accent-color, #1B8C2D)', color: 'var(--card-background-color, #FFFFFF)' }}>
                <div className="flex items-start gap-4">
                  <div className="flex items-baseline shrink-0">
                    <span className="text-white  text-[48px] leading-none" style={{ color: 'var(--text-heading-color, #FFFFFF)' }}>
                      {card.number}
                    </span>
                    <span className="ml-1 text-white  text-[24px] leading-none" style={{ color: 'var(--text-body-color, #FFFFFF)' }}>
                      {card.numberSymbol}
                    </span>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-white  text-[24px]" style={{ color: 'var(--text-heading-color, #FFFFFF)' }}>
                      {card.subtitle}
                    </h3>
                    <p className="mt-1 text-white/95  text-[16px] leading-[1.55]" style={{ color: 'var(--text-body-color, #FFFFFF)' }}  >
                      {card.body}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* chart and flowchart removed */}
        </div>
      </div>
    </>
  )
}

export { Schema, layoutId, layoutName, layoutDescription }
export default dynamicSlideLayout