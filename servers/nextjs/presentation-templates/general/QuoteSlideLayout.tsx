import React from 'react'
import * as z from "zod";
import { ImageSchema } from '@/presentation-templates/defaultSchemes';

export const layoutId = 'quote-slide'
export const layoutName = 'Quote'
export const layoutDescription = 'A slide layout with a heading, inspirational quote, and background image with overlay for text visibility.'

const quoteSlideSchema = z.object({
    heading: z.string().min(3).max(60).default('Words of Wisdom').meta({
        description: "Main heading of the slide",
    }),
    quote: z.string().min(10).max(200).default('Success is not final, failure is not fatal: it is the courage to continue that counts. The future belongs to those who believe in the beauty of their dreams.').meta({
        description: "The main quote text content",
    }),
    author: z.string().min(2).max(50).default('Winston Churchill').meta({
        description: "Author of the quote",
    }),
    backgroundImage: ImageSchema.default({
        __image_url__: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2000&q=80',
        __image_prompt__: 'Inspirational mountain landscape with dramatic sky and clouds'
    }).meta({
        description: "Background image for the slide",
    })
})

export const Schema = quoteSlideSchema

export type QuoteSlideData = z.infer<typeof quoteSlideSchema>

interface QuoteSlideLayoutProps {
    data?: Partial<QuoteSlideData>
}

const QuoteSlideLayout: React.FC<QuoteSlideLayoutProps> = ({ data: slideData }) => {
    return (
        <>
            {/* Import Google Fonts */}
            <link
                href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap"
                rel="stylesheet"
            />

            <div
                className="w-full rounded-sm max-w-[1280px] shadow-lg max-h-[720px] aspect-video bg-white relative z-20 mx-auto overflow-hidden"
                style={{
                    fontFamily: 'var(--heading-font-family,Inter)',
                    background: "var(--card-background-color,#ffffff)"
                }}
            >

                {/* Background Image */}
                <div
                    className="absolute inset-0 w-full h-full bg-cover bg-center bg-no-repeat"
                    style={{
                        backgroundImage: `url('${slideData?.backgroundImage?.__image_url__ || ''}')`,
                    }}
                />

                {/* Background Overlay - low opacity primary accent */}
                <div
                    className="absolute inset-0"
                    style={{ backgroundColor: 'var(--primary-accent-color, #9333ea)', opacity: 0.3 }}
                ></div>

                {/* Decorative Elements */}
                <div className="absolute top-0 left-0 w-32 h-32 bg-purple-600/20 rounded-full blur-3xl"></div>
                <div className="absolute bottom-0 right-0 w-40 h-40 bg-purple-400/20 rounded-full blur-3xl"></div>
                <div className="absolute top-1/2 left-1/4 w-24 h-24 bg-white/10 rounded-full blur-2xl"></div>

                {/* Main Content */}
                <div className="relative z-10 px-8 sm:px-12 lg:px-20 pt-14 py-12 flex-1 flex flex-col justify-center h-full">
                    <div className="text-center space-y-8 max-w-4xl mx-auto">

                        {/* Heading */}
                        <div className="space-y-4">
                            <h1 style={{ color: "var(--text-heading-color,#111827)" }} className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white leading-tight">
                                {slideData?.heading || 'Words of Wisdom'}
                            </h1>
                            {/* Purple accent line */}
                            <div style={{ background: "var(--primary-accent-color,#9333ea)" }} className="w-20 h-1 bg-purple-400 mx-auto"></div>
                        </div>

                        {/* Quote Section */}
                        <div className="space-y-6">
                            {/* Quote Icon */}
                            <div className="flex justify-center">
                                <svg
                                    className="w-12 h-12 text-purple-300 opacity-80" style={{ color: "var(--primary-accent-color,#9333ea)" }}
                                    fill="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z" />
                                </svg>
                            </div>

                            {/* Quote Text */}
                            <blockquote style={{ color: "var(--text-body-color,#ffffff)" }} className="text-xl sm:text-2xl lg:text-3xl font-medium text-white leading-relaxed italic">
                                "{slideData?.quote || 'Success is not final, failure is not fatal: it is the courage to continue that counts. The future belongs to those who believe in the beauty of their dreams.'}"
                            </blockquote>

                            {/* Author */}
                            <div className="flex justify-center items-center space-x-4">
                                <div style={{ background: "var(--primary-accent-color,#9333ea)" }} className="w-16 h-px bg-purple-300"></div>
                                <cite className="text-base sm:text-lg text-purple-200 font-semibold not-italic">
                                    {slideData?.author || 'Winston Churchill'}
                                </cite>
                                <div style={{ background: "var(--primary-accent-color,#9333ea)" }} className="w-16 h-px bg-purple-300"></div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Bottom Decorative Border uses heading color */}
                <div className="absolute bottom-0 left-0 right-0 h-2" style={{ backgroundColor: 'var(--text-heading-color,#111827)' }}></div>
            </div>
        </>
    )
}

export default QuoteSlideLayout 