import React from 'react'
import * as z from "zod";

export const layoutId = 'metrics-slide'
export const layoutName = 'Metrics'
export const layoutDescription = 'A slide layout for showcasing key business metrics with large numbers and descriptive text boxes. This should only be used with metrics and numbers.'

const metricsSlideSchema = z.object({
    title: z.string().min(3).max(100).default('Company Traction').meta({
        description: "Main title of the slide",
    }),
    metrics: z.array(z.object({
        label: z.string().min(2).max(50).meta({
            description: "Metric label/title"
        }),
        value: z.string().min(1).max(10).meta({
            description: "Metric value (e.g., 150+, 95%, $2M). No long values. Keep simple number."
        }),
        description: z.string().min(10).max(150).meta({
            description: "Detailed description of the metric. Explanation of the metric."
        }),
    })).min(2).max(3).default([
        {
            value: '150+',
            label: 'Clients Onboarded',
            description: 'Larana Inc. has successfully built a diverse client base, gaining trust across industries.'
        },
        {
            value: '200+',
            label: 'projects completed.',
            description: 'Delivering over 200 projects, Larana Inc. consistently meets evolving client needs.'
        },
        {
            value: '95%',
            label: 'client satisfaction.',
            description: 'With a strong focus on customer success, Larana Inc. has a 95% satisfaction rate.'
        }
    ]).meta({
        description: "List of key business metrics to display",
    })
})

export const Schema = metricsSlideSchema

export type MetricsSlideData = z.infer<typeof metricsSlideSchema>

interface MetricsSlideLayoutProps {
    data?: Partial<MetricsSlideData>
}

const MetricsSlideLayout: React.FC<MetricsSlideLayoutProps> = ({ data: slideData }) => {
    const metrics = slideData?.metrics || []

    // Function to determine layout classes based on number of metrics
    const getLayoutClasses = (count: number) => {
        if (count === 1) {
            return 'grid grid-cols-1'
        } else if (count === 2) {
            return 'grid grid-cols-1 md:grid-cols-2'
        } else if (count === 3) {
            return 'grid grid-cols-1 md:grid-cols-3'
        } else if (count === 4) {
            return 'grid grid-cols-2 md:grid-cols-4'
        } else if (count === 5) {
            return 'grid grid-cols-2 md:grid-cols-3'
        } else {
            return 'grid grid-cols-2 md:grid-cols-3'
        }
    }

    // Function to get individual item classes
    const getItemClasses = (count: number) => {
        // All items use same classes now
        return ''
    }

    return (
        <>
            {/* Import Google Fonts */}
            <link
                href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap"
                rel="stylesheet"
            />

            <div
                className="w-full rounded-sm max-w-[1280px] shadow-lg max-h-[720px] aspect-video bg-white relative z-20 mx-auto overflow-hidden flex flex-col"
                style={{
                    fontFamily: 'var(--heading-font-family,Inter)',
                    background: "var(--card-background-color,#ffffff)"
                }}
            >

                {/* Decorative Wave Patterns */}
                <div className="absolute top-0 left-0 w-64 h-full opacity-10 overflow-hidden">
                    <svg className="w-full h-full" viewBox="0 0 200 400" fill="none">
                        <path d="M0 100C50 150 100 50 150 100C175 125 200 100 200 100V0H0V100Z" fill="#8b5cf6" opacity="0.3" />
                        <path d="M0 200C75 250 125 150 200 200V150C150 175 100 150 50 175L0 200Z" fill="#8b5cf6" opacity="0.2" />
                        <path d="M0 300C100 350 150 250 200 300V250C125 275 75 250 25 275L0 300Z" fill="#8b5cf6" opacity="0.1" />
                    </svg>
                </div>

                <div className="absolute top-0 right-0 w-64 h-full opacity-10 overflow-hidden transform scale-x-[-1]">
                    <svg className="w-full h-full" viewBox="0 0 200 400" fill="none">
                        <path d="M0 100C50 150 100 50 150 100C175 125 200 100 200 100V0H0V100Z" fill="#8b5cf6" opacity="0.3" />
                        <path d="M0 200C75 250 125 150 200 200V150C150 175 100 150 50 175L0 200Z" fill="#8b5cf6" opacity="0.2" />
                        <path d="M0 300C100 350 150 250 200 300V250C125 275 75 250 25 275L0 300Z" fill="#8b5cf6" opacity="0.1" />
                    </svg>
                </div>



                {/* Main Content */}
                <div className="relative z-10 px-8 sm:px-12 lg:px-20 pt-10 pb-12 flex-1 flex flex-col justify-center">
                    <div className="space-y-12">
                        {/* Title */}
                        <div className="text-center">
                            <h1 style={{ color: "var(--text-heading-color,#111827)" }} className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900">
                                {slideData?.title || 'Company Traction'}
                            </h1>
                        </div>

                        {/* Metrics Section */}
                        <div className="flex justify-center">
                            {/* Metrics Layout - Each metric grouped vertically */}
                            <div className={`${getLayoutClasses(metrics.length)} gap-6 lg:gap-8 place-content-center place-items-center`}>
                                {metrics.map((metric, index) => (
                                    <div key={index} className={`text-center space-y-4 ${getItemClasses(metrics.length)}`}>
                                        {/* Label */}
                                        <div className="text-sm text-gray-600 font-medium" style={{ color: "var(--text-body-color,#ffffff)" }}>
                                            {metric.label}
                                        </div>

                                        {/* Large Metric Value */}
                                        <div style={{ color: "var(--text-heading-color,#9333ea)" }} className="text-4xl sm:text-5xl lg:text-6xl font-bold text-purple-600">
                                            {metric.value}
                                        </div>

                                        {/* Description Box */}
                                        <div
                                            className="bg-purple-50 rounded-lg p-4 lg:p-5 text-center mt-4"
                                            style={{ background: "var(--primary-accent-color,#9333ea)" }}

                                        >
                                            <p style={{ color: "var(--text-body-color,#ffffff)" }} className="text-xs sm:text-sm text-gray-700 leading-relaxed">
                                                {metric.description}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    )
}

export default MetricsSlideLayout 