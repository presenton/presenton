import React from 'react'
// charts trimmed to donut only (inline SVG)
import * as z from "zod";


const ImageSchema = z.object({
    __image_url__: z.string().url().default("https://images.unsplash.com/photo-1522199755839-a2bacb67c546?q=80&w=1200&auto=format&fit=crop").meta({
        description: "URL to image",
    }),
    __image_prompt__: z.string().min(10).max(150).default("Abstract light background for slide header area").meta({
        description: "Prompt used to generate the image. Max 30 words",
    }),
})

const IconSchema = z.object({
    __icon_url__: z.string().url().default("https://cdn.jsdelivr.net/gh/tabler/tabler-icons/icons/placeholder.svg").meta({
        description: "URL to icon",
    }),
    __icon_query__: z.string().min(3).max(30).default("progress ring placeholder").meta({
        description: "Query used to search the icon. Max 3 words",
    }),
})

const layoutId = "visual-metrics"
const layoutName = "Visual Metrics"
const layoutDescription = "A slide with a header bar, numeric marker, title, description, and grid of cards with headings, circular metrics, and texts"

const CardSchema = z.object({
    title: z.string().min(6).max(18).default("Research").meta({
        description: "Card heading. Max 3 words",
    }),
    value: z.number().min(0).max(9999).default(67).meta({
        description: "Numeric value to display",
    }),
    unit: z.string().min(0).max(2).default("K").meta({
        description: "Unit for the value, e.g., %, K, M",
    }),
    description: z.string().min(1).max(50).default("Lorem ipsum dolor sit amet, consectetur").meta({
        description: "Card supporting text. Max 50 characters",
    }),
}).default({
    title: "Research",
    value: 67,
    unit: "K",
    description: "Lorem ipsum dolor sit amet, consectetur",
})

const Schema = z.object({
    topBar: z.object({

        marker: z.string().min(1).max(3).default("2").meta({
            description: "Numeric marker on the top bar. Up to 3 digits",
        }),
    }).default({

        marker: "2",
    }),
    title: z.string().min(20).max(68).default("Our Vision And Strategy For Excellence").meta({
        description: "Main slide title. Max 10 words",
    }),
    description: z.string().min(70).max(200).default("Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation").meta({
        description: "Lead paragraph. Max 35 words",
    }),
    cards: z.array(CardSchema).min(1).max(4).default([
        {
            title: "Research",
            value: 6700,
            unit: "K",
            description: "Lorem ipsum dolor sit amet, consectetur",

        },
        {
            title: "Development",
            value: 80,
            unit: "K",
            description: "Lorem ipsum dolor sit amet, consectetur",

        },
        {
            title: "Research",
            value: 67,
            unit: "%",
            description: "Lorem ipsum dolor sit amet, consectetur",

        },
        { title: "Development", value: 80, unit: "K", description: "Lorem ipsum dolor sit amet, consectetur" },
    ]).meta({
        description: "Grid of cards with heading, circular metric, and text",
    }),
    chartPalette: z.array(z.string().min(4).max(20)).min(2).max(6).default(["var(--primary-accent-color, #1B8C2D)", "var(--tertiary-accent-color, #E5E7EB)", "#f59e0b", "#3b82f6"]).meta({
        description: "Palette for charts",
    }),
}).default({
    topBar: { marker: "2" },
    title: "Our Vision And Strategy For Excellence",
    description: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation",
    cards: [
        { title: "Research", value: 67, unit: "K", description: "Lorem ipsum dolor sit amet, consectetur" },
        { title: "Ops", value: 42, unit: "M", description: "Lorem ipsum dolor sit amet, consectetur" },
        { title: "Efficiency", value: 67, unit: "%", description: "Lorem ipsum dolor sit amet, consectetur" },
        { title: "Development", value: 80, unit: "K", description: "Lorem ipsum dolor sit amet, consectetur" },
    ],
    chartPalette: ["var(--primary-accent-color, #1B8C2D)", "var(--tertiary-accent-color, #E5E7EB)", "#f59e0b", "#3b82f6"],
})

type SlideData = z.infer<typeof Schema>

interface SlideLayoutProps {
    data?: Partial<SlideData>
}

// removed external chart components; using inline SVG ring only

const dynamicSlideLayout: React.FC<SlideLayoutProps> = ({ data: slideData }) => {
    const cards = slideData?.cards || []
    return (
        <>
            <link
                href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600;700&display=swap"
                rel="stylesheet"
            />
            <div className=" w-full rounded-sm max-w-[1280px] shadow-lg max-h-[720px] aspect-video relative z-20 mx-auto overflow-hidden" style={{ fontFamily: "var(--heading-font-family,Playfair Display)", backgroundColor: 'var(--card-background-color, #FFFFFF)' }}>


                <div className="px-12">
                    <h1 className="text-[64px] leading-[1.05] tracking-tight  font-semibold mt-2" style={{ color: 'var(--text-heading-color, #111827)' }}>
                        {slideData?.title}
                    </h1>
                    <p className="mt-5 text-[16px] leading-[1.6] max-w-[1020px] " style={{ color: 'var(--text-body-color, #6B7280)' }}>
                        {slideData?.description}
                    </p>
                </div>

                <div className="px-10 mt-10">
                    <div className="grid grid-cols-4 gap-8">
                        {cards.map((card, idx) => {
                            const radius = 80
                            const circumference = 2 * Math.PI * radius
                            const dasharray = circumference
                            return (
                                <div key={idx} className="rounded-xl border shadow-[0_24px_60px_rgba(0,0,0,0.08)]" style={{ backgroundColor: 'var(--card-background-color, #FFFFFF)', borderColor: 'rgba(0,0,0,0.06)' }}>
                                    <div className="px-8 pt-8 pb-7 flex flex-col items-center text-center">
                                        <h3 className="text-[24px] leading-tight font-semibold " style={{ color: 'var(--text-heading-color, #111827)' }}>{card.title}</h3>
                                        <div className="mt-6 relative w-[180px] h-[180px]">
                                            {/* donut ring retained */}
                                            <svg viewBox="0 0 200 200" className="w-full h-full">
                                                <circle cx="100" cy="100" r="80" fill="none" stroke="var(--tertiary-accent-color, #E5E7EB)" strokeWidth="16"></circle>
                                                <circle
                                                    cx="100"
                                                    cy="100"
                                                    r="80"
                                                    fill="none"
                                                    stroke={'var(--primary-accent-color, #1B8C2D)'}
                                                    strokeWidth="16"
                                                    strokeLinecap="round"
                                                    strokeDasharray={dasharray}
                                                    strokeDashoffset={0}
                                                    transform="rotate(-90 100 100)"
                                                ></circle>
                                                <circle cx="100" cy="100" r="62" fill="none" stroke="rgba(0,0,0,0.06)" strokeWidth="10"></circle>
                                            </svg>
                                            <div className="absolute inset-0 flex items-center justify-center">
                                                <span className="text-[32px] font-extrabold " style={{ color: 'var(--text-heading-color, #111827)' }}>{card.value}{card.unit}</span>
                                            </div>
                                        </div>
                                        <p className="mt-6 text-[16px] leading-[1.6] " style={{ color: 'var(--text-body-color, #6B7280)' }}>
                                            {card.description}
                                        </p>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>

                {/* mermaid removed */}
            </div>
        </>
    )
}

export { Schema, layoutId, layoutName, layoutDescription }
export default dynamicSlideLayout