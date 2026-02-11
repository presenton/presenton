import { RemoteSvgIcon } from '@/app/hooks/useRemoteSvgIcon';
import React from 'react'
// Charts removed
import * as z from "zod";



const ImageSchema = z.object({
  __image_url__: z.string().url().default("https://via.placeholder.com/900x500").meta({
    description: "URL to image",
  }),
  __image_prompt__: z.string().min(10).max(200).default("Wide landscape placeholder representing a slide image area").meta({
    description: "Prompt used to generate the image. Max 30 words",
  }),
})

const IconSchema = z.object({
  __icon_url__: z.string().default("https://via.placeholder.com/60").meta({
    description: "URL to icon",
  }),
  __icon_query__: z.string().min(3).max(30).default("camera landscape placeholder").meta({
    description: "Query used to search the icon. Max 3 words",
  }),
})

const layoutId = "header-title-card-slide"
const layoutName = "Icon Image Description"
const layoutDescription = "A slide with a top bar, centered title, placeholder icon area, and a colored card with circular icon, heading, and paragraph"

const Schema = z.object({
  meta: z.object({
    maxWords: z.number().default(56),
  }).default({ maxWords: 56 }),
  topBar: z.object({

    pageNumber: z.string().min(1).max(3).default("3").meta({
      description: "Page number text. Max 1 word",
    }),
  }).default({

    pageNumber: "3",
  }),
  title: z.string().min(24).max(56).default("Transforming Ideas into\nReality").meta({
    description: "Main title split across up to two lines. Max 10 words",
  }),
  backgroundImage: ImageSchema.default({
    __image_url__: "https://images.unsplash.com/photo-1650831432942-aa352df4e9b4?q=80&w=1170&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
    __image_prompt__: "Background image covering the entire section behind the card",
  }).meta({
    description: "Full-bleed background image behind card area",
  }),
  card: z.object({
    circleIcon: IconSchema.default({
      __icon_url__: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='30' height='30' viewBox='0 0 24 24' fill='%230A8016' aria-hidden='true'><path d='M10 6V7H7C5.895 7 5 7.895 5 9V18C5 19.105 5.895 20 7 20H17C18.105 20 19 19.105 19 18V9C19 7.895 18.105 7 17 7H14V6C14 4.895 13.105 4 12 4H12C10.895 4 10 4.895 10 6ZM12 6C12.552 6 13 6.448 13 7H11C11 6.448 11.448 6 12 6ZM7 9H17V11H7V9Z'/></svg>",
      __icon_query__: "badge document icon",
    }),
    heading: z.string().min(22).max(70).default("Idea Generation and Validation").meta({
      description: "Card heading text. Max 10 words",
    }),
    body: z.string().min(140).max(450).default("Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.").meta({
      description: "Card body paragraph. Max 80 words",
    }),
    image: ImageSchema.default({
      __image_url__: "https://via.placeholder.com/1200x600",
      __image_prompt__: "Optional supporting image inside card area",
    }).meta({
      description: "Optional supporting image for the card. Max 30 words",
    }),
  }).default({
    circleIcon: {
      __icon_url__: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='30' height='30' viewBox='0 0 24 24' fill='%230A8016' aria-hidden='true'><path d='M10 6V7H7C5.895 7 5 7.895 5 9V18C5 19.105 5.895 20 7 20H17C18.105 20 19 19.105 19 18V9C19 7.895 18.105 7 17 7H14V6C14 4.895 13.105 4 12 4H12C10.895 4 10 4.895 10 6ZM12 6C12.552 6 13 6.448 13 7H11C11 6.448 11.448 6 12 6ZM7 9H17V11H7V9Z'/></svg>",
      __icon_query__: "badge document icon",
    },
    heading: "Idea Generation and Validation",
    body: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.",
    image: {
      __image_url__: "https://via.placeholder.com/1200x600",
      __image_prompt__: "Optional supporting image inside card area",
    },
  }),
  // charts removed
  // diagram removed
}).default({
  meta: { maxWords: 56 },
  topBar: { pageNumber: "3" },
  title: "Transforming Ideas into\nReality",
  backgroundImage: {
    __image_url__: "https://images.unsplash.com/photo-1650831432942-aa352df4e9b4?q=80&w=1170&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
    __image_prompt__: "Background image covering the entire section behind the card",
  },
  card: {
    circleIcon: {
      __icon_url__: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='30' height='30' viewBox='0 0 24 24' fill='%230A8016' aria-hidden='true'><path d='M10 6V7H7C5.895 7 5 7.895 5 9V18C5 19.105 5.895 20 7 20H17C18.105 20 19 19.105 19 18V9C19 7.895 18.105 7 17 7H14V6C14 4.895 13.105 4 12 4H12C10.895 4 10 4.895 10 6ZM12 6C12.552 6 13 6.448 13 7H11C11 6.448 11.448 6 12 6ZM7 9H17V11H7V9Z'/></svg>",
      __icon_query__: "badge document icon",
    },
    heading: "Idea Generation and Validation",
    body: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.",
    image: { __image_url__: "https://via.placeholder.com/1200x600", __image_prompt__: "Optional supporting image inside card area" },
  },
  // charts removed
  // diagram removed
})

type SlideData = z.infer<typeof Schema>

interface SlideLayoutProps {
  data?: Partial<SlideData>
}

const dynamicSlideLayout: React.FC<SlideLayoutProps> = ({ data: slideData }) => {

  return (
    <>
      <link
        href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600;700&display=swap"
        rel="stylesheet"
      />
      <div className=" w-full rounded-sm max-w-[1280px] shadow-lg max-h-[720px] aspect-video relative z-20 mx-auto overflow-hidden flex flex-col" style={{ fontFamily: "var(--heading-font-family,Playfair Display)", backgroundColor: 'var(--card-background-color, #FFFFFF)' }}>


        <div className="px-10 pt-5 pb-6">
          <h1 className="text-[64px] leading-[1.05] text-center font-semibold" style={{ fontFamily: "Playfair Display", color: 'var(--text-heading-color, #111827)' }}>
            {(slideData?.title || "").split("\n").map((line, idx) => (
              <span key={idx}>
                {line}
                {idx === 0 ? <br /> : null}
              </span>
            ))}
          </h1>
        </div>

        <div className="relative flex-1 flex items-center justify-center">
          <img
            src={slideData?.backgroundImage?.__image_url__ || ""}
            alt={slideData?.backgroundImage?.__image_prompt__ || "background"}
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div className="absolute inset-0" style={{ backgroundColor: 'rgba(255,255,255,0.6)' }}></div>
          <div className="relative w-[900px] max-w-[92%] rounded-md shadow-[0_30px_90px_rgba(0,0,0,0.18)]" style={{ backgroundColor: 'var(--primary-accent-color, #1B8C2D)' }}>
            <div className="p-10 grid grid-cols-[72px,1fr] gap-6">
              <div className="flex">
                <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ backgroundColor: 'var(--card-background-color, #FFFFFF)' }}>
                  {slideData?.card?.circleIcon?.__icon_url__ ? (
                    <RemoteSvgIcon
                      url={slideData?.card?.circleIcon.__icon_url__}
                      strokeColor={"currentColor"}
                      className="w-14 h-14"
                      color="var(--text-heading-color, #111827)"
                      title={slideData?.card?.circleIcon.__icon_query__}
                    />
                  ) : null}
                </div>
              </div>

              <div className="min-w-0">
                <div className="text-white text-[28px] leading-[34px] font-semibold" style={{ fontFamily: "Playfair Display", color: 'var(--text-heading-color, #FFFFFF)' }}>
                  {slideData?.card?.heading}
                </div>
                <p className="mt-3 text-white/95 text-[16px] leading-[28px]" style={{ fontFamily: "Playfair Display", color: 'var(--text-body-color, #FFFFFF)' }}>
                  {slideData?.card?.body}
                </p>

                {/* Chart section removed */}

                {/* Diagram removed */}

              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

export { Schema, layoutId, layoutName, layoutDescription }
export default dynamicSlideLayout