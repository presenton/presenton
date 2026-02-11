import React from 'react'
import * as z from "zod";
import { ImageSchema } from '@/presentation-templates/defaultSchemes';

export const layoutId = 'numbered-bullets-slide'
export const layoutName = 'Numbered Bullets'
export const layoutDescription = 'A slide layout with large title, supporting image, and numbered bullet points with descriptions.'

const numberedBulletsSlideSchema = z.object({
    title: z.string().min(3).max(40).default('Market Validation').meta({
        description: "Main title of the slide",
    }),
    image: ImageSchema.default({
        __image_url__: 'https://images.unsplash.com/photo-1552664730-d307ca884978?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1000&q=80',
        __image_prompt__: 'Business people analyzing charts and data on wall'
    }).meta({
        description: "Supporting image for the slide",
    }),
    bulletPoints: z.array(z.object({
        title: z.string().min(2).max(80).meta({
            description: "Bullet point title",
        }),
        description: z.string().min(10).max(150).meta({
            description: "Bullet point description",
        }),
    })).min(1).max(3).default([
        {
            title: 'Customer Insights',
            description: 'Surveys reveal that 78% of businesses are planning to invest in digital solutions, with 85% preferring customized approaches.'
        },
        {
            title: 'Pilot Program Success',
            description: 'The survey revealed that 78% of businesses plan to invest in digital solutions, and 85% prefer a tailored approach.'
        },
        {
            title: 'Pilot Program Success',
            description: 'The survey revealed that 78% of businesses plan to invest in digital solutions, and 85% prefer a tailored approach.'
        },
        {
            title: 'Pilot Program Success',
            description: 'The survey revealed that 78% of businesses plan to invest in digital solutions, and 85% prefer a tailored approach.'
        }
    ]).meta({
        description: "List of numbered bullet points with descriptions",
    })
})

export const Schema = numberedBulletsSlideSchema

export type NumberedBulletsSlideData = z.infer<typeof numberedBulletsSlideSchema>

interface NumberedBulletsSlideLayoutProps {
    data?: Partial<NumberedBulletsSlideData>
}

const NumberedBulletsSlideLayout: React.FC<NumberedBulletsSlideLayoutProps> = ({ data: slideData }) => {
    const bulletPoints = slideData?.bulletPoints || []

    return (
        <>
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


                {/* Main Content Container */}
                <div className="px-8 sm:px-12 lg:px-20 pt-12 pb-8 h-full">
                    {/* Top Section - Title and Image */}
                    <div className="flex items-start justify-between mb-8">
                        {/* Title Section */}
                        <div className="flex-1 pr-8">
                            <h1 style={{ color: "var(--text-heading-color,#111827)" }} className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 leading-tight mb-4">
                                {slideData?.title || 'Market Validation'}
                            </h1>
                            {/* Purple accent line */}
                            <div style={{ background: "var(--text-heading-color,#9333ea)" }} className="w-24 h-1 bg-purple-600 mb-6"></div>
                        </div>

                        {/* Image Section */}
                        <div className="flex-shrink-0 w-80 h-48">
                            <img
                                src={slideData?.image?.__image_url__ || ''}
                                alt={slideData?.image?.__image_prompt__ || slideData?.title || ''}
                                className="w-full h-full object-cover rounded-lg shadow-md" style={{ background: "var(--tertiary-accent-color,#e5e7eb)" }}
                            />
                        </div>
                    </div>

                    {/* Numbered Bullet Points */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                        {bulletPoints.map((bullet, index) => (
                            <div key={index} className="flex items-start space-x-4">
                                {/* Number */}
                                <div className="flex-shrink-0">
                                    <div style={{ color: "var(--text-heading-color,#111827)" }} className="text-4xl sm:text-5xl font-bold text-gray-900">
                                        {String(index + 1).padStart(2, '0')}
                                    </div>
                                </div>

                                {/* Content */}
                                <div className="flex-1 pt-2">
                                    <h3 style={{ color: "var(--text-heading-color,#111827)" }} className="text-xl sm:text-2xl font-bold text-gray-900 mb-3">
                                        {bullet.title}
                                    </h3>
                                    <p style={{ color: "var(--text-body-color,#4b5563)" }} className="text-base text-gray-700 leading-relaxed">
                                        {bullet.description}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Decorative Wave Pattern at Bottom */}
                    <div className="absolute bottom-0 left-0 right-0 h-20 overflow-hidden">
                        <svg
                            className="w-full h-full opacity-20"
                            viewBox="0 0 1200 200"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                        >
                            <path
                                d="M0 100C300 150 600 50 900 100C1050 125 1125 100 1200 100V200H0V100Z"
                                fill="url(#wave-gradient)"
                            />
                            <defs>
                                <linearGradient id="wave-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                                    <stop offset="0%" stopColor="var(--primary-accent-color,#9333ea)" />
                                    <stop offset="50%" stopColor="var(--primary-accent-color,#9333ea)" />
                                    <stop offset="100%" stopColor="var(--primary-accent-color,#9333ea)" />
                                </linearGradient>
                            </defs>
                        </svg>
                    </div>
                </div>
            </div>
        </>
    )
}

export default NumberedBulletsSlideLayout 