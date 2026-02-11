import { RemoteSvgIcon } from '@/app/hooks/useRemoteSvgIcon';
import React from 'react'
// charts removed
import * as z from "zod";


const ImageSchema = z.object({
  __image_url__: z.string().url().default("https://images.pexels.com/photos/31527637/pexels-photo-31527637.jpeg").meta({
    description: "URL to image",
  }),
  __image_prompt__: z.string().min(10).max(180).default("Decorative abstract office scene photo placed at lower right on the band").meta({
    description: "Prompt used to generate the image. Max 30 words",
  }),
})

const IconSchema = z.object({
  __icon_url__: z.string().default("https://presenton-public.s3.ap-southeast-1.amazonaws.com/static/icons/bold/fediverse-logo-bold.svg").meta({
    description: "URL to icon",
  }),
  __icon_query__: z.string().min(2).max(20).default("info icon").meta({
    description: "Query used to search the icon. Max 3 words",
  }),
})

const layoutId = "header-bullets-title-description-image-slide"
const layoutName = "Icon Bullet Description"
const layoutDescription = "A slide with a small header label and number, a left card of ...cards with round symbols and titles with descriptions, a large heading with supporting text, and a decorative image on a mid-page band"

const Schema = z.object({
  metaMaxWords: z.number().default(240).meta({
    description: "Maximum number of words any single text field can handle in this layout",
  }),


  headerNumber: z.string().min(1).max(3).default("6").meta({
    description: "Small header number text. Max 3 characters",
  }),
  rightTitle: z.string().min(24).max(72).default("Disrupting the\nIndustry").meta({
    description: "Large heading on the right. Max 8 words",
  }),
  rightDescription: z.string().min(120).max(240).default("Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna").meta({
    description: "Supporting paragraph under the large heading. Max 40 words",
  }),
  // decorative image removed
  cards: z.array(z.object({
    symbolText: z.string().min(1).max(1).default("i").meta({
      description: "Single-character symbol inside the round badge",
    }),
    symbolIcon: IconSchema.default({
      __icon_url__: "https://presenton-public.s3.ap-southeast-1.amazonaws.com/static/icons/bold/fediverse-logo-bold.png",
      __icon_query__: "info icon",
    }).meta({
      description: "Optional icon representation for the round symbol",
    }),
    title: z.string().min(16).max(38).default("Visionary Leadership").meta({
      description: "Title for the card item. Max 4 words",
    }),
    description: z.string().min(50).max(100).default("Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor").meta({
      description: "Description for the card item. Max 15 words.",
    }),
  })).min(1).max(4).default([
    {
      symbolText: "i",
      symbolIcon: { __icon_url__: "https://presenton-public.s3.ap-southeast-1.amazonaws.com/static/icons/bold/fediverse-logo-bold.svg", __icon_query__: "info icon" },
      title: "Visionary Leadership",
      description: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor",
    },
    {
      symbolText: "i",
      symbolIcon: { __icon_url__: "https://presenton-public.s3.ap-southeast-1.amazonaws.com/static/icons/bold/video-bold.png", __icon_query__: "info icon" },
      title: "Innovation at the Core",
      description: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor",
    },
    {
      symbolText: "i",
      symbolIcon: { __icon_url__: "https://presenton-public.s3.ap-southeast-1.amazonaws.com/static/icons/bold/receipt-x-bold.png", __icon_query__: "info icon" },
      title: "Customer-Centric Disruption",
      description: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor",
    },
    {
      symbolText: "i",
      symbolIcon: { __icon_url__: "https://presenton-public.s3.ap-southeast-1.amazonaws.com/static/icons/bold/users-four-bold.png", __icon_query__: "info icon" },
      title: "Customer-Centric Disruption",
      description: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor",
    }
  ]).meta({
    description: "Array of ...cards with a round symbol, title and description. Max 6 items",
  }),
  // chart and diagram removed
})

type SlideData = z.infer<typeof Schema>

interface SlideLayoutProps {
  data?: Partial<SlideData>
}

const dynamicSlideLayout: React.FC<SlideLayoutProps> = ({ data: slideData }) => {
  const cards = slideData?.cards || []
  // charts removed

  return (
    <>
      <link
        href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600;700&display=swap"
        rel="stylesheet"
      />
      <div className=" w-full rounded-sm max-w-[1280px] shadow-lg max-h-[720px] aspect-video relative z-20 mx-auto overflow-hidden" style={{ fontFamily: "var(--heading-font-family,Playfair Display)", backgroundColor: 'var(--card-background-color, #FFFFFF)' }}>



        <div className="relative z-10 grid grid-cols-[600px_1fr] gap-[64px] px-[80px] pt-[12px]">
          <div className="w-[600px]">
            <div className="rounded-[10px] shadow-[0_20px_60px_rgba(0,0,0,0.08)] px-[36px] py-[28px]" style={{ backgroundColor: 'var(--card-background-color, #FFFFFF)' }}>
              <ul className="flex flex-col gap-[28px]">
                {cards.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-[24px]">
                    <div className="w-[88px] h-[88px] rounded-full flex items-center justify-center overflow-hidden select-none" style={{ backgroundColor: 'var(--card-background-color, #FFFFFF)' }}>
                      {item.symbolIcon?.__icon_url__ ? (
                        <RemoteSvgIcon
                          url={item.symbolIcon.__icon_url__}
                          strokeColor={"currentColor"}
                          className="w-14 h-14"
                          color="var(--text-heading-color, #111827)"
                          title={item.symbolIcon.__icon_query__}
                        />
                      ) : (
                        <span className="text-[34px] font-semibold" style={{ color: 'var(--primary-accent-color, #1B8C2D)' }}>{item.symbolText}</span>
                      )}
                    </div>
                    <div className="flex-1">
                      <h3 className=" text-[24px] font-semibold leading-[1.15]" style={{ color: 'var(--text-heading-color, #111827)' }}>{item.title}</h3>
                      <p className=" text-[16px] leading-[1.55] mt-[8px]" style={{ color: 'var(--text-body-color, #6B7280)' }}>{item.description}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="pt-[28px]">
            <h1 className="font-['Playfair Display'] text-[64px] leading-[1.05] tracking-[-0.01em] max-w-[600px] font-semibold" style={{ color: 'var(--text-heading-color, #111827)' }} dangerouslySetInnerHTML={{ __html: (slideData?.rightTitle || "Disrupting the\nIndustry").replace(/\n/g, "<br/>") }}></h1>
            <div className="mt-[24px] inline-block rounded-md px-6 py-4" style={{ backgroundColor: 'var(--secondary-accent-color, #F3F4F6)' }}>
              <p className="font-['Playfair Display'] text-[16px] leading-[1.6] max-w-[620px]" style={{ color: 'var(--text-body-color, #6B7280)' }}>
                {slideData?.rightDescription || "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna"}
              </p>
            </div>

            {/* charts removed */}

            {/* flowchart removed */}
          </div>
        </div>

        {/* decorative image removed */}
      </div>
    </>
  )
}

export { Schema, layoutId, layoutName, layoutDescription }
export default dynamicSlideLayout