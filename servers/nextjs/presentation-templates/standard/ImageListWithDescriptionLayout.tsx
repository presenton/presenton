import React from 'react'
import * as z from "zod";


const ImageSchema = z.object({
  __image_url__: z.string().url().default("https://images.pexels.com/photos/31527637/pexels-photo-31527637.jpeg").meta({
    description: "URL to image",
  }),
  __image_prompt__: z.string().min(10).max(160).default("Portrait of a professional team member with subtle background, soft light, business attire").meta({
    description: "Prompt used to generate the image. Max 30 words",
  }),
})

const IconSchema = z.object({
  __icon_url__: z.string().url().default("https://static.thenounproject.com/png/1137401-200.png").meta({
    description: "URL to icon",
  }),
  __icon_query__: z.string().min(3).max(30).default("photo image placeholder").meta({
    description: "Query used to search the icon. Max 5 words",
  }),
})

const layoutId = "header-smallbar-title-team-cards-slide"
const layoutName = "Image List With Description"
const layoutDescription = "A slide with a top utility bar, centered title, and a grid of cards with names, roles, and background images."

const Schema = z.object({
  utilityBar: z.object({

    pageNumber: z.string().min(1).max(2).default("8").meta({
      description: "Page number text. 1-2 digits",
    }),
    decorativeLine: IconSchema.default({
      __icon_url__: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='220' height='2'%3E%3Crect width='220' height='2' fill='%231FA34A'/%3E%3C/svg%3E",
      __icon_query__: "green line separator",
    }).meta({
      description: "Decorative line representation.",
    }),
  }).default({

    pageNumber: "8",
    decorativeLine: {
      __icon_url__: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='220' height='2'%3E%3Crect width='220' height='2' fill='%231FA34A'/%3E%3C/svg%3E",
      __icon_query__: "green line separator",
    },
  }),
  title: z.string().min(10).max(50).default("Our Professional Team").meta({
    description: "Centered main title. Max 5 words",
  }),
  cards: z.array(z.object({
    name: z.string().min(3).max(30).default("Sam Rawlings").meta({
      description: "Member name. Up to 3 words.",
    }),
    role: z.string().min(20).max(50).default("Marketing specialist with brand and growth experience").meta({
      description: "Short description under name. Up to 10 words",
    }),
    photo: ImageSchema,
  })).min(1).max(4).default([
    {
      name: "Sam Rawlings",
      role: "Marketing specialist with brand and growth experience",
      photo: {
        __image_url__: "https://images.pexels.com/photos/1181695/pexels-photo-1181695.jpeg",
        __image_prompt__: "Portrait of a professional team member with subtle background, soft light, business attire",
      },
    },
    {
      name: "Sam Rawlings",
      role: "Marketing specialist with brand and growth experience",
      photo: {
        __image_url__: "https://images.pexels.com/photos/450214/pexels-photo-450214.jpeg",
        __image_prompt__: "Portrait of a professional team member with subtle background, soft light, business attire",
      },
    },
    {
      name: "Sam Rawlings",
      role: "Marketing specialist with brand and growth experience",
      photo: {
        __image_url__: "https://images.pexels.com/photos/756484/pexels-photo-756484.jpeg",
        __image_prompt__: "Portrait of a professional team member with subtle background, soft light, business attire",
      },
    },

  ]).meta({
    description: "Grid of member cards with name, role, and image. Up to 4 items",
  }),
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


        <h1 className="mt-4 text-center text-[64px] leading-[1.05]  font-semibold" style={{ color: 'var(--text-heading-color, #111827)' }}>
          {slideData?.title || "Our Professional Team"}
        </h1>

        <div className="px-10 mt-8">
          <div className="mx-auto w-fit">
            <div className="grid grid-flow-col auto-cols-[280px] gap-8">
              {cards.map((card, idx) => (
                <div key={idx} className="w-[280px] flex flex-col rounded-md border border-transparent shadow-[0_12px_36px_rgba(0,0,0,0.08)] overflow-hidden" style={{ backgroundColor: 'var(--card-background-color, #FFFFFF)' }}>
                  <div className="px-8 pt-10 pb-6 text-center">
                    <div className="text-[24px] leading-tight " style={{ color: 'var(--text-heading-color, #111827)' }}>
                      {card.name}
                    </div>
                    <div className="mt-3 text-[14px] leading-[22px] " style={{ color: 'var(--text-body-color, #6B7280)' }}>
                      {card.role}
                    </div>
                  </div>
                  <div className="relative flex-1 min-h-[300px]" style={{ backgroundColor: 'var(--tertiary-accent-color, #E5E7EB)' }}>
                    <img src={card.photo.__image_url__} alt={card.photo.__image_prompt__} className="absolute inset-0 w-full h-full object-cover" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

export { Schema, layoutId, layoutName, layoutDescription }
export default dynamicSlideLayout