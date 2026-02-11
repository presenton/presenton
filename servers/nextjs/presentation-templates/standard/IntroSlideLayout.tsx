import React from 'react'
import * as z from "zod";

const ImageSchema = z.object({
    __image_url__: z.string().url().default("https://images.pexels.com/photos/31527637/pexels-photo-31527637.jpeg").meta({
        description: "URL to image",
    }),
    __image_prompt__: z.string().min(10).max(150).default("High-quality illustrative image for the left panel of a pitch deck cover").meta({
        description: "Prompt used to generate the image. Max 30 words",
    }),
})

const IconSchema = z.object({
    __icon_url__: z.string().default("https://static.thenounproject.com/png/5563447-200.png").meta({
        description: "URL to icon",
    }),
    __icon_query__: z.string().min(3).max(40).default("image placeholder icon").meta({
        description: "Query used to search the icon. Max 3 words",
    }),
})

const layoutId = "header-counter-two-column-image-text-slide"
const layoutName = "Intro Slide"
const layoutDescription = "A slide with a header row containing label, separator, and counter, followed by a two-column layout with a media area and stacked text blocks. If used as the endig slide then it shoudn't have the intro card."

const Schema = z.object({
    header: z.object({

        separatorIcon: IconSchema.default({
            __icon_url__: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='230' height='2' viewBox='0 0 230 2'%3E%3Crect width='230' height='2' fill='%2322863A'/%3E%3C/svg%3E",
            __icon_query__: "green line",
        }).meta({
            description: "Graphic separator element",
        }),
        counter: z.string().min(1).max(3).default("1").meta({
            description: "Small counter text. Max 1 word",
        }),
    }).default({

        separatorIcon: {
            __icon_url__: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='230' height='2' viewBox='0 0 230 2'%3E%3Crect width='230' height='2' fill='%2322863A'/%3E%3C/svg%3E",
            __icon_query__: "green line",
        },
        counter: "1",
    }),

    media: z.object({
        type: z.enum(["image"]).default("image").meta({
            description: "Choose media type for left panel",
        }),
        image: ImageSchema.default({
            __image_url__: "https://images.unsplash.com/photo-1557426272-fc759fdf7a8d?q=80&w=1170&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
            __image_prompt__: "Abstract gradient image suitable for a presentation left panel",
        }),
    }).default({
        type: "image",
        image: {
            __image_url__: "https://images.unsplash.com/photo-1557426272-fc759fdf7a8d?q=80&w=1170&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
            __image_prompt__: "Abstract gradient image suitable for a presentation left panel",
        },
    }),

    title: z.string().min(12).max(30).default("Introduction Our Pitchdeck").meta({
        description: "Main title, supports a line break. Max 6 words",
    }),
    titleBreakAfter: z.number().min(1).max(25).default(12).meta({
        description: "Character index to insert a line break in title",
    }),

    paragraph: z.string().min(50).max(200).default("Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris").meta({
        description: "Paragraph text block. Max 20 words",
    }),

    introCard: z.object({
        enabled: z.boolean().default(false).meta({ description: "Show intro card with name and date" }),
        initials: z.string().min(2).max(3).default("PDT").meta({ description: "Initials inside the circle" }),
        name: z.string().min(3).max(40).default("Pitch Deck Team").meta({ description: "Display name" }),
        date: z.string().min(6).max(40).default("December 22, 2025").meta({ description: "Display date string" }),
    }).default({
        enabled: true,
        initials: "PDT",
        name: "Pitch Deck Team",
        date: "December 22, 2025",
    }),
}).meta({
    maxWords: 460,
})

type SlideData = z.infer<typeof Schema>

interface LayoutProps {
    data?: Partial<SlideData>
}

const dynamicSlideLayout: React.FC<LayoutProps> = ({ data: slideData }) => {
    const title = slideData?.title || "Introduction Our Pitchdeck"
    const brIndex = typeof slideData?.titleBreakAfter === "number" ? slideData?.titleBreakAfter as number : 12
    const titleFirst = title.slice(0, brIndex)
    const titleSecond = title.slice(brIndex)
    return (
        <>
            <link
                href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600;700&display=swap"
                rel="stylesheet"
            />
            <div className=" w-full rounded-sm max-w-[1280px] shadow-lg max-h-[720px] aspect-video relative z-20 mx-auto overflow-hidden" style={{ fontFamily: "var(--heading-font-family,Playfair Display)", backgroundColor: 'var(--card-background-color, #FFFFFF)' }}>


                <div className="grid grid-cols-2 h-[calc(100%-64px)]">
                    <div className="relative h-full overflow-hidden" style={{ backgroundColor: 'var(--tertiary-accent-color, #E5E7EB)' }}>
                        {slideData?.media?.type === "image" ? (
                            <img
                                src={slideData?.media?.image?.__image_url__ || ""}
                                alt={slideData?.media?.image?.__image_prompt__ || "left media"}
                                className="absolute inset-0 w-full h-full object-cover"
                            />
                        ) : null}
                    </div>

                    <div className="h-full" style={{ backgroundColor: 'var(--card-background-color, #FFFFFF)' }}>
                        <div className="px-14 pt-16 max-w-[640px]">
                            <h1 className=" text-[64px] leading-[1.06] font-semibold" style={{ color: 'var(--text-heading-color, #111827)' }}>
                                {titleFirst}
                                <br />
                                {titleSecond}
                            </h1>

                            <p className="mt-8 text-[16px] leading-[28px] " style={{ color: 'var(--text-body-color, #6B7280)' }}>
                                {slideData?.paragraph || "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris"}
                            </p>

                            {slideData?.introCard?.enabled ? (
                                <div className="mt-10 inline-flex items-center gap-4 border px-5 py-3 shadow-[0_10px_24px_rgba(0,0,0,0.08)] min-w-[400px]" style={{ backgroundColor: 'var(--card-background-color, #FFFFFF)' }}>
                                    <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ backgroundColor: 'var(--primary-accent-color, #1B8C2D)' }}>
                                        <span className="text-white text-[22px] font-bold tracking-wide" style={{ color: 'var(--text-heading-color, #FFFFFF)' }}>{slideData?.introCard?.initials}</span>
                                    </div>
                                    <div className="leading-tight">
                                        <div className="text-[22px] font-semibold" style={{ fontFamily: 'Playfair Display', color: 'var(--text-heading-color, #111827)' }}>{slideData?.introCard?.name}</div>
                                        <div className="text-[15px]" style={{ fontFamily: 'Playfair Display', color: 'var(--text-body-color, #1B8C2D)' }}>{slideData?.introCard?.date}</div>
                                    </div>
                                </div>
                            ) : null}
                        </div>
                    </div>
                </div>
            </div>
        </>
    )
}

export { Schema, layoutId, layoutName, layoutDescription }
export default dynamicSlideLayout