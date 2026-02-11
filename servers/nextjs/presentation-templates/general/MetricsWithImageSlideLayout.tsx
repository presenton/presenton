import React from 'react'
import * as z from "zod";
import { ImageSchema } from '@/presentation-templates/defaultSchemes';

export const layoutId = 'metrics-with-image-slide'
export const layoutName = 'Metrics with Image'
export const layoutDescription = 'A slide layout with supporting image on the left and title, description, and metrics grid on the right. Can be used alternatively with MetricSlide.'

const metricsWithImageSlideSchema = z.object({
    title: z.string().min(3).max(40).default('Competitive Advantage').meta({
        description: "Main title of the slide",
    }),
    description: z.string().min(10).max(150).default('Ginyard International Co. stands out by offering custom digital solutions tailored to client needs, alongside long-term support to ensure lasting relationships and continuous adaptation.').meta({
        description: "Description text below the title",
    }),
    image: ImageSchema.default({
        __image_url__: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1000&q=80',
        __image_prompt__: 'Person holding tablet with analytics dashboard and charts'
    }).meta({
        description: "Supporting image for the slide",
    }),
    metrics: z.array(z.object({
        label: z.string().min(2).max(100).meta({
            description: "Metric label/title"
        }),
        value: z.string().min(1).max(20).meta({
            description: "Metric value (e.g., 200+, 95%, 50%)"
        }),
    })).min(1).max(3).default([
        {
            label: 'Satisfied Clients',
            value: '200+'
        },
        {
            label: 'Client Retention Rate',
            value: '95%'
        },

    ]).meta({
        description: "List of key business metrics to display",
    })
})

export const Schema = metricsWithImageSlideSchema

export type MetricsWithImageSlideData = z.infer<typeof metricsWithImageSlideSchema>

interface MetricsWithImageSlideLayoutProps {
    data?: Partial<MetricsWithImageSlideData>
}

const MetricsWithImageSlideLayout: React.FC<MetricsWithImageSlideLayoutProps> = ({ data: slideData }) => {
    const metrics = slideData?.metrics || []

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

                {/* Decorative Wave Patterns */}
                <div className="absolute bottom-0 left-0 w-48 h-48 opacity-10 overflow-hidden">
                    <svg className="w-full h-full" viewBox="0 0 200 200" fill="none">
                        <path d="M0 100C50 75 100 125 150 100C175 87.5 200 100 200 100V200H0V100Z" fill="#8b5cf6" opacity="0.4" />
                        <path d="M0 150C75 175 125 125 200 150V175C150 162.5 100 175 50 162.5L0 150Z" fill="#8b5cf6" opacity="0.3" />
                    </svg>
                </div>

                <div className="absolute top-0 right-0 w-64 h-64 opacity-10 overflow-hidden">
                    <svg className="w-full h-full" viewBox="0 0 200 200" fill="none">
                        <path d="M100 0C150 50 200 0 200 50C200 100 150 150 100 150C50 150 0 100 0 50C0 0 50 50 100 0Z" fill="#8b5cf6" opacity="0.2" />
                    </svg>
                </div>

                {/* Main Content */}
                <div className="relative z-10 flex h-full px-8 sm:px-12 lg:px-20 pt-12 pb-8">
                    {/* Left Section - Image */}
                    <div className="flex-1 flex items-center justify-center pr-8">
                        <div className="w-full max-w-lg h-96 rounded-2xl overflow-hidden shadow-lg">
                            <img
                                src={slideData?.image?.__image_url__ || ''}
                                alt={slideData?.image?.__image_prompt__ || slideData?.title || ''}
                                className="w-full h-full object-cover"
                            />
                        </div>
                    </div>

                    {/* Right Section - Content and Metrics */}
                    <div className="flex-1 flex flex-col justify-center pl-8 space-y-6">
                        {/* Title */}
                        <h1 style={{ color: "var(--text-heading-color,#111827)" }} className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 leading-tight">
                            {slideData?.title || 'Competitive Advantage'}
                        </h1>

                        {/* Description */}
                        <p style={{ color: "var(--text-body-color,#4b5563)" }} className="text-base sm:text-lg text-gray-700 leading-relaxed">
                            {slideData?.description || 'Ginyard International Co. stands out by offering custom digital solutions tailored to client needs, alongside long-term support to ensure lasting relationships and continuous adaptation.'}
                        </p>

                        {/* Metrics Grid */}
                        <div className="grid grid-cols-2 gap-6">
                            {metrics.map((metric, index) => (
                                <div key={index} className="text-center space-y-2">
                                    <div style={{ color: "var(--text-body-color,#4b5563)" }} className="text-sm text-gray-600 font-medium">
                                        {metric.label}
                                    </div>
                                    <div style={{ color: "var(--text-heading-color,#9333ea)" }} className="text-3xl sm:text-4xl lg:text-5xl font-bold text-purple-600">
                                        {metric.value}
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

export default MetricsWithImageSlideLayout 