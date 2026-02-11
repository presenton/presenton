import React from "react"
import * as z from "zod"

const layoutId = "image-list-description-slide"
const layoutName = "Image List Description"
const layoutDescription = "List of Images with subtitle and description with one description for the entire page"

const ImageSchema = z
  .object({
    __image_url__: z
      .string()
      .url()
      .default(
        "https://images.unsplash.com/photo-1522199710521-72d69614c702?w=1200&q=80&auto=format&fit=crop"
      ),
    __image_prompt__: z
      .string()
      .min(0)
      .max(120)
      .default("abstract gradient background"),
  })
  .default({
    __image_url__:
      "https://images.unsplash.com/photo-1522199710521-72d69614c702?w=1200&q=80&auto=format&fit=crop",
    __image_prompt__: "abstract gradient background",
  })

const ItemSchema = z
  .object({
    title: z.string().min(2).max(40).default("Sample Title"),
    description: z
      .string()
      .min(10)
      .max(140)
      .default("Short description for the image or item."),
    image: ImageSchema,
  })
  .default({
    title: "Sample Title",
    description: "Short description for the image or item.",
    image: ImageSchema.parse({}),
  })

const Schema = z
  .object({
    titleLine1: z.string().min(3).max(24).default("Meet Our"),
    titleLine2: z.string().min(3).max(24).default("Team"),
    description: z
      .string()
      .min(20)
      .max(200)
      .default(
        "Lorem ipsum dolor sit amet, consectetur adipiscing elit."
      ),
    items: z
      .array(ItemSchema)
      .min(3)
      .max(6)
      .default([
        ItemSchema.parse({}),
        ItemSchema.parse({ title: "Another Item", description: "Concise supporting text.", image: ImageSchema.parse({}) }),
        ItemSchema.parse({ title: "Third Item", description: "Concise supporting text.", image: ImageSchema.parse({}) }),
      ]),
    website: z.string().min(6).max(60).default("www.yourwebsite.com"),
  })
  .default({

    titleLine1: "Meet Our",
    titleLine2: "Team",
    description:
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit.",
    items: [
      ItemSchema.parse({}),
      ItemSchema.parse({ title: "Another Item", description: "Concise supporting text.", image: ImageSchema.parse({}) }),
      ItemSchema.parse({ title: "Third Item", description: "Concise supporting text.", image: ImageSchema.parse({}) }),
    ],
    website: "www.yourwebsite.com",
  })

type SlideData = z.infer<typeof Schema>

interface SlideLayoutProps {
  data?: Partial<SlideData>
}

const TeamMembers: React.FC<SlideLayoutProps> = ({ data: slideData }) => {
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


        <div className="px-12 pt-6 grid grid-cols-[36%_64%] gap-8 items-start">
          {/* Left text stack */}
          <div>
            <div
              className="text-[56px] leading-[1.05] font-semibold"
              style={{ color: "var(--text-heading-color, #111827)" }}
            >
              {slideData?.titleLine1}
              <br />
              {slideData?.titleLine2}
            </div>
            <p
              className="mt-8 text-[16px] leading-[1.8] max-w-[300px]"
              style={{ color: "var(--text-body-color, #6B7280)" }}
            >
              {slideData?.description}
            </p>
          </div>

          {/* Right generic image cards */}
          <div className="grid grid-cols-3 gap-10">
            {items.slice(0, 3).map((it, i) => (
              <div key={i} className="flex flex-col items-stretch">
                {/* Photo block uses provided image */}
                <div className="h-[180px] rounded-t-md overflow-hidden">
                  <img src={it.image.__image_url__} alt={it.image.__image_prompt__} className="w-full h-full object-cover" />
                </div>
                {/* Cyan details panel */}
                <div className="relative -mt-[1px] rounded-b-[28px] px-6 pt-6 pb-7" style={{ backgroundColor: 'var(--primary-accent-color, #BFF4FF)' }}>
                  <div className="text-[20px] font-semibold" style={{ color: 'var(--text-heading-color, #111827)' }}>{it.title}</div>
                  <p className="mt-3 text-[14px] leading-[1.7]" style={{ color: 'var(--text-body-color, #6B7280)' }}>{it.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer line with website and end diamond */}
        <div className="absolute bottom-8 left-12 right-12 flex items-center">
          <span className="text-[14px]" style={{ color: "var(--text-body-color, #6B7280)" }}>{slideData?.website}</span>
          <div className="ml-6 h-[2px] flex-1" style={{ backgroundColor: "#E5E7EB" }}></div>
        </div>

        {/* Big bottom-right diamond */}
        <div className="absolute bottom-7 right-6 w-8 h-8 rotate-45" style={{ backgroundColor: "var(--text-heading-color, #111827)" }}></div>
      </div>
    </>
  )
}

export { Schema, layoutId, layoutName, layoutDescription }
export default TeamMembers


