import React from 'react'
import * as z from "zod";
import { ImageSchema } from '@/presentation-templates/defaultSchemes';

export const layoutId = 'general-intro-slide'
export const layoutName = 'Intro Slide'
export const layoutDescription = 'A clean slide layout with title, description text, presenter info, and a supporting image.'

const introSlideSchema = z.object({
    title: z.string().min(3).max(40).default('Product Overview').meta({
        description: "Main title of the slide",
    }),
    description: z.string().min(10).max(150).default('Our product offers customizable dashboards for real-time reporting and data-driven decisions. It integrates with third-party tools to enhance operations and scales with business growth for improved efficiency.').meta({
        description: "Main description text content",
    }),
    presenterName: z.string().min(2).max(50).default('John Doe').meta({
        description: "Name of the presenter",
    }),
    presentationDate: z.string().min(2).max(50).default('December 2025').meta({
        description: "Date of the presentation must be the latest date like today's date",
    }),
    image: ImageSchema.default({
        __image_url__: 'https://images.unsplash.com/photo-1552664730-d307ca884978?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1000&q=80',
        __image_prompt__: 'Business team in meeting room discussing product features and solutions'
    }).meta({
        description: "Supporting image for the slide",
    })
})

export const Schema = introSlideSchema

export type IntroSlideData = z.infer<typeof introSlideSchema>

interface IntroSlideLayoutProps {
    data?: Partial<IntroSlideData>
}

const IntroSlideLayout: React.FC<IntroSlideLayoutProps> = ({ data: slideData }) => {
    // Generate initials from presenter name
    const getInitials = (name: string) => {
        return name.split(' ').map(word => word.charAt(0).toUpperCase()).join('');
    };

    const presenterInitials = getInitials(slideData?.presenterName || 'John Doe');
    return (
        <>
            <link
                href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap"
                rel="stylesheet"
            />

            <div
                className="w-full rounded-sm max-w-[1280px] shadow-lg max-h-[720px] aspect-video bg-white relative z-20 mx-auto overflow-hidden"
                style={{
                    background: "var(--card-background-color,#ffffff)"
                    , fontFamily: "var(--heading-font-family,Inter)"
                }}
            >



                {/* Main Content */}
                <div className="relative z-10 flex h-full px-8 sm:px-12 lg:px-20 pt-12 pb-8">
                    {/* Left Section - Image */}
                    <div className="flex-1 flex items-center justify-center pr-8">
                        <div className="w-full max-w-lg h-80 rounded-2xl overflow-hidden shadow-lg">
                            <img
                                src={slideData?.image?.__image_url__ || ''}
                                alt={slideData?.image?.__image_prompt__ || slideData?.title || ''}
                                className="w-full h-full object-cover"
                            />
                        </div>
                    </div>

                    {/* Right Section - Content */}
                    <div className="flex-1 flex flex-col justify-center pl-8 space-y-6">
                        {/* Title */}
                        <h1 style={{ color: "var(--text-heading-color,#111827)" }} className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 leading-tight">
                            {slideData?.title || 'Product Overview'}
                        </h1>

                        {/* Purple accent line */}
                        <div style={{ background: "var(--text-heading-color,#9333ea)" }} className="w-20 h-1 bg-purple-600"></div>

                        {/* Description */}
                        <p style={{ color: "var(--text-body-color,#4b5563)" }} className="text-base sm:text-lg text-gray-700 leading-relaxed">
                            {slideData?.description || 'Our product offers customizable dashboards for real-time reporting and data-driven decisions. It integrates with third-party tools to enhance operations and scales with business growth for improved efficiency.'}
                        </p>

                        {/* Presenter Section */}
                        <div style={{ background: "var(--card-background-color,rgb(255 255 255 / 0.5))" }} className="bg-white/50 backdrop-blur-sm rounded-lg p-4 lg:p-6 border border-gray-200 shadow-sm">
                            <div className="flex items-center gap-4">
                                {/* Custom Initials Icon */}
                                <div style={{ background: "var(--primary-accent-color,#9333ea)" }} className="w-10 h-10 lg:w-12 lg:h-12 bg-purple-600 rounded-full flex items-center justify-center">
                                    <span className="font-bold text-sm lg:text-base" style={{ color: "var(--text-heading-color,#FFFFFF)" }}>
                                        {presenterInitials}
                                    </span>
                                </div>

                                {/* Presenter Info */}
                                <div className="flex flex-col">
                                    <span style={{ color: "var(--text-heading-color,#111827)" }} className="text-lg lg:text-xl font-bold text-gray-900">
                                        {slideData?.presenterName || 'John Doe'}
                                    </span>
                                    <span style={{ color: "var(--text-body-color,#4b5563)" }} className="text-sm lg:text-base text-gray-600 font-medium">
                                        {slideData?.presentationDate || 'December 2024'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    )
}

export default IntroSlideLayout 