import React from 'react'
// charts removed
import * as z from "zod";

const ImageSchema = z.object({
  __image_url__: z.string().url().default("https://images.pexels.com/photos/31527637/pexels-photo-31527637.jpeg").meta({
    description: "URL to image",
  }),
  __image_prompt__: z.string().min(10).max(90).default("Professional business meeting scene for roadmap presentation image").meta({
    description: "Prompt used to generate the image. Max 18 words",
  }),
})

const IconSchema = z.object({
  __icon_url__: z.string().default("").meta({
    description: "URL to icon",
  }),
  __icon_query__: z.string().min(3).max(30).default("").meta({
    description: "Query used to search the icon. Max 6 words",
  }),
})

const layoutId = "header-bullets-image-split-slide"
const layoutName = "Numbered Bullet Single Image"
const layoutDescription = "A slide with a top bar, left column with numbered bullets, middle image panel, and right stacked heading with paragraph"

const Schema = z.object({
  metaMaxWords: z.number().default(18).meta({
    description: "Maximum number of words allowed in any prompt/description metadata fields.",
  }),
  topBar: z.object({

    lineIcon: IconSchema.default({
      __icon_url__: "",
      __icon_query__: "thin green line",
    }).meta({
      description: "Decorative line representation with query only",
    }),
  }).default({

    lineIcon: {
      __icon_url__: "",
      __icon_query__: "thin green line",
    },
  }),
  leftBullets: z.array(
    z.object({
      numberText: z.string().min(2).max(2).default("01").meta({
        description: "Two-digit bullet number. Max 2 chars",
      }),
      title: z.string().min(10).max(36).default("Strategic Execution").meta({
        description: "Bullet title text. Designed for 24px. Max ~36 chars",
      }),
      body: z.string().min(60).max(100).default("Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor.").meta({
        description: "Bullet body text. Max ~100 chars",
      }),
    })
  ).min(1).max(4).default([
    {
      numberText: "01",
      title: "Strategic Execution",
      body: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor.",
    },
    {
      numberText: "02",
      title: "Building a Strong Team",
      body: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor.",
    },
    {
      numberText: "03",
      title: "Market Expansion Strategy",
      body: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor.",
    },
    {
      numberText: "04",
      title: "Innovation Pipeline",
      body: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor.",
    }
  ]).meta({
    description: "List of numbered bullets. Max 5 items",
  }),
  middleImage: ImageSchema.default({
    __image_url__: "https://images.unsplash.com/photo-1515623959088-7617915baa1e?q=80&w=687&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
    __image_prompt__: "Professional business meeting scene for roadmap presentation image",
  }).meta({
    description: "Image displayed in the middle column",
  }),
  rightHeader: z.object({
    heading: z.string().min(6).max(30).default("Our Journey").meta({
      description: "Right column heading. Max ~30 chars",
    }),
    paragraph: z.string().min(80).max(200).default("Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore.").meta({
      description: "Right paragraph text. Max 200 chars",
    }),
  }).default({
    heading: "Our Journey",
    paragraph: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore.",
  }),
})

type SlideData = z.infer<typeof Schema>

interface SlideLayoutProps {
  data?: Partial<SlideData>
}

const dynamicSlideLayout: React.FC<SlideLayoutProps> = ({ data: slideData }) => {
  const bullets = slideData?.leftBullets || []

  return (
    <>
      <link
        href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600;700&display=swap"
        rel="stylesheet"
      />
      <div className=" w-full rounded-sm max-w-[1280px] shadow-lg max-h-[720px] aspect-video relative z-20 mx-auto overflow-hidden" style={{ fontFamily: "var(--heading-font-family,Playfair Display)", backgroundColor: 'var(--card-background-color, #FFFFFF)' }}>


        <div className="grid grid-cols-[34%_33%_33%] h-[calc(100%-64px)] mt-1">
          <div className="pl-10 pr-5 pt-8">
            <ul className="flex flex-col gap-5">
              {bullets.map((b, i) => (
                <li key={i} className="flex items-center justify-between">
                  <div className="w-[85%]">
                    <h3 className="text-[24px] leading-tight  font-semibold" style={{ color: 'var(--text-heading-color, #111827)' }}>
                      {b.title}
                    </h3>
                    <p className="mt-2 text-[16px] leading-relaxed " style={{ color: 'var(--text-body-color, #6B7280)' }}>
                      {b.body}
                    </p>
                  </div>
                  <div className="w-12 h-12 rounded-full text-white flex items-center justify-center text-[16px]  shadow-[0_12px_30px_rgba(0,0,0,0.12)]" style={{ backgroundColor: 'var(--primary-accent-color, #1B8C2D)', color: 'var(--text-body-color, #FFFFFF)' }}>
                    {b.numberText}
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="relative" style={{ backgroundColor: 'var(--tertiary-accent-color, #E5E7EB)' }}>
            <img
              src={slideData?.middleImage?.__image_url__ || ""}
              alt={slideData?.middleImage?.__image_prompt__ || "image"}
              className="absolute inset-0 w-full h-full object-cover"
            />
            {/* overlay removed */}
          </div>

          <div className="pl-10 pr-12 pt-16">
            <div className="max-w-[560px] mx-auto">
              <h1 className="text-[64px] leading-[0.95]  font-semibold" style={{ color: 'var(--text-heading-color, #111827)' }}>
                <span className="block">{slideData?.rightHeader?.heading || "Our Journey"}</span>
              </h1>
              <p className="mt-6 text-[16px] leading-relaxed " style={{ color: 'var(--text-body-color, #6B7280)' }}>
                {slideData?.rightHeader?.paragraph || "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore."}
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

export { Schema, layoutId, layoutName, layoutDescription }
export default dynamicSlideLayout