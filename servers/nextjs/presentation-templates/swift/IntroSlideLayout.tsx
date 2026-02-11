import React from "react"
import * as z from "zod"

const layoutId = "IntroSlideLayout"
const layoutName = "Intro Slide Layout"
const layoutDescription = "Intro slide with header, title, subtitle, body, image. If used for last slide, then intro card should be disabled."

const ImageSchema = z
  .object({
    __image_url__: z.string().url().default("https://images.unsplash.com/photo-1522199710521-72d69614c702?w=1200&q=80&auto=format&fit=crop"),
    __image_prompt__: z.string().min(0).max(120).default("abstract gradient background"),
  })
  .default({
    __image_url__:
      "https://images.unsplash.com/photo-1522199710521-72d69614c702?w=1200&q=80&auto=format&fit=crop",
    __image_prompt__: "abstract gradient background",
  })

const Schema = z
  .object({

    title: z
      .string()
      .min(12)
      .max(68)
      .default("Pitch Deck")
      .meta({ description: "Main slide title" }),

    subtitlePrefix: z.string().min(3).max(40).default("Presentation"),
    subtitleAccent: z.string().min(3).max(40).default("Template"),

    paragraph: z
      .string()
      .min(40)
      .max(200)
      .default(
        "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua."
      ),

    website: z
      .string()
      .min(6)
      .max(60)
      .default("www.yourwebsite.com"),

    introCard: z
      .object({
        enabled: z.boolean().default(false),
        name: z.string().min(3).max(40).default("John Doe"),
        date: z.string().min(4).max(40).default("Jan 1, 2025"),
      })
      .default({ enabled: true, name: "John Doe", date: "Jan 1, 2025" }),

    media: z
      .object({
        type: z.literal("image").default("image"),
        image: ImageSchema,
      })
      .default({ type: "image", image: ImageSchema.parse({}) }),
  })
  .default({
    title: "Pitch Deck",
    subtitlePrefix: "Presentation",
    subtitleAccent: "Template",
    paragraph:
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
    website: "www.yourwebsite.com",
    introCard: { enabled: true, name: "John Doe", date: "Jan 1, 2025" },
    media: { type: "image", image: ImageSchema.parse({}) },
  })

type SlideData = z.infer<typeof Schema>

interface SlideLayoutProps {
  data?: Partial<SlideData>
}

const IntroSlideLayout: React.FC<SlideLayoutProps> = ({ data: slideData }) => {
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


        {/* Right panel image (replaces dark gradient box) */}
        <div className="absolute top-0 right-0 h-[520px] w-[36%] overflow-hidden">
          <img
            src={slideData?.media?.image?.__image_url__}
            alt={slideData?.media?.image?.__image_prompt__}
            className="absolute inset-0 w-full h-full object-cover"
          />
        </div>

        {/* Vertical diamond decorations */}
        <div className="absolute top-8 right-[38%] flex flex-col items-center gap-3">
          <div className="w-3 h-3 rotate-45" style={{ backgroundColor: "var(--text-heading-color, #111827)" }}></div>
          <div className="w-3 h-3 rotate-45" style={{ backgroundColor: "var(--text-heading-color, #111827)" }}></div>
          <div className="w-3 h-3 rotate-45" style={{ backgroundColor: "var(--text-heading-color, #111827)" }}></div>
        </div>

        <div className="grid grid-cols-[58%_42%] gap-10 px-12 pt-4 pb-10 items-start">
          <div className="pt-4">
            <h1
              className="text-[64px] leading-[1.05] tracking-tight  font-semibold"
              style={{ color: "var(--text-heading-color, #111827)" }}
            >
              {slideData?.title}
            </h1>
            <p className="mt-5 text-[16px] leading-[1.6] max-w-[620px] " style={{ color: "var(--text-body-color, #6B7280)" }}>{slideData?.paragraph}</p>

            {slideData?.introCard?.enabled && (
              <div
                className="mt-6 inline-flex items-center gap-4 rounded-sm border px-4 py-3 "
                style={{
                  borderColor: 'var(--primary-accent-color, #BFF4FF)',
                  backgroundColor: 'var(--primary-accent-color, #BFF4FF)'
                }}
              >
                <div
                  className="w-2 h-6"
                  style={{ backgroundColor: 'var(--text-heading-color, #111827)' }}
                ></div>
                <div className="flex items-baseline gap-3">
                  <span className="text-[16px] font-semibold" style={{ color: 'var(--text-heading-color, #111827)' }}>
                    {slideData?.introCard?.name}
                  </span>
                  <span className="text-[14px]" style={{ color: 'var(--text-body-color, #6B7280)' }}>
                    {slideData?.introCard?.date}
                  </span>
                </div>
              </div>
            )}
          </div>
          <div className="relative h-[420px]"></div>
        </div>

        {/* Footer line with website and end diamond */}
        <div className="absolute bottom-8 left-12 right-12 flex items-center">
          <span className="text-[14px] " style={{ color: "var(--text-body-color, #6B7280)" }}>{slideData?.website}</span>
          <div className="ml-6 h-[2px] flex-1" style={{ backgroundColor: "var(--text-body-color, #E5E7EB)" }}></div>
        </div>

        {/* Big bottom-right diamond */}
        <div className="absolute bottom-7 right-6 w-8 h-8 rotate-45" style={{ backgroundColor: "var(--text-heading-color, #111827)" }}></div>
      </div>
    </>
  )
}

export { Schema, layoutId, layoutName, layoutDescription }
export default IntroSlideLayout


