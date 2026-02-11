import React from 'react'
import * as z from "zod";

export const layoutId = 'table-of-contents-slide'
export const layoutName = 'Table of Contents'
export const layoutDescription = 'A professional table of contents layout with numbered sections, and page references. This should be right after introduction slide if ever used.'

const tableOfContentsSlideSchema = z.object({
    sections: z.array(z.object({
        number: z.number().min(1).meta({
            description: "Section number"
        }),
        title: z.string().min(1).max(80).meta({
            description: "Section title"
        }),
        pageNumber: z.string().min(1).max(10).meta({
            description: "Page number for this section"
        })
    })).default([
        { number: 1, title: "Problem", pageNumber: "03" },
        { number: 2, title: "Solution", pageNumber: "04" },
        { number: 3, title: "Product Overview", pageNumber: "05" },
        { number: 4, title: "Market Size", pageNumber: "06" },
        { number: 5, title: "Market Validation", pageNumber: "07" },
        { number: 6, title: "Company Traction", pageNumber: "08" },
        { number: 7, title: "Product Performance", pageNumber: "09" },
        { number: 8, title: "Business Model", pageNumber: "10" },
        { number: 9, title: "Competitive Advantage", pageNumber: "11" },
        { number: 10, title: "Team Member", pageNumber: "12" }
    ]).meta({
        description: "List of table of contents sections",
    })
})

export const Schema = tableOfContentsSlideSchema

export type TableOfContentsSlideData = z.infer<typeof tableOfContentsSlideSchema>

interface TableOfContentsSlideLayoutProps {
    data?: Partial<TableOfContentsSlideData>
}

const TableOfContentsSlideLayout: React.FC<TableOfContentsSlideLayoutProps> = ({ data: slideData }) => {
    const sections = slideData?.sections || []
    const midPoint = Math.ceil(sections.length / 2)
    const leftSections = sections.slice(0, midPoint)
    const rightSections = sections.slice(midPoint)

    return (
        <>
            <link
                href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap"
                rel="stylesheet"
            />

            <div
                className="w-full rounded-sm max-w-[1280px] shadow-lg px-8 sm:px-12 lg:px-20 py-8 sm:py-12 lg:py-16 max-h-[720px] aspect-video bg-white relative z-20 mx-auto"
                style={{
                    fontFamily: 'var(--heading-font-family,Inter)',
                    background: "var(--card-background-color,#ffffff)"
                }}
            >


                {/* Title Section */}
                <div className="text-center mb-8 sm:mb-12 mt-6">
                    <h1 style={{ color: "var(--text-heading-color,#111827)" }} className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 mb-4">
                        Table of Contents
                    </h1>
                    {/* Decorative Wave */}
                    <div className="flex justify-center">
                        <svg width="80" height="20" viewBox="0 0 80 20" className="text-purple-600" style={{ color: "var(--primary-accent-color,#9333ea)" }}>
                            <path
                                d="M0 10 Q20 0 40 10 T80 10"
                                stroke="currentColor"
                                strokeWidth="3"
                                fill="none"
                            />
                        </svg>
                    </div>
                </div>

                {/* Content Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8 lg:gap-12">
                    {/* Left Column */}
                    <div className="space-y-4 sm:space-y-6">
                        {leftSections.map((section) => (
                            <div key={section.number} className="flex items-center justify-between group">
                                <div className="flex items-center space-x-4">
                                    {/* Number Box */}
                                    <div style={{ background: "var(--primary-accent-color,#9333ea)", color: "var(--text-heading-color,#ffffff)" }} className="w-12 h-12 sm:w-14 sm:h-14 bg-purple-600 rounded-xl flex items-center justify-center text-white font-bold text-lg sm:text-xl group-hover:bg-purple-700 transition-colors">
                                        {section.number}
                                    </div>
                                    {/* Title */}
                                    <span style={{ color: "var(--text-heading-color,#111827)" }} className="text-lg sm:text-xl font-medium text-gray-800 group-hover:text-purple-600 transition-colors">
                                        {section.title}
                                    </span>
                                </div>
                                {/* Page Number */}
                                <div className="text-right">
                                    <span style={{ color: "var(--text-body-color,#4b5563)" }} className="text-lg sm:text-xl text-gray-600">
                                        {section.pageNumber}
                                    </span>
                                    {/* Dotted line effect */}
                                    <div style={{ color: "var(--text-body-color,#4b5563)" }} className="text-gray-300 text-sm mt-1">
                                        .....
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Right Column */}
                    <div className="space-y-4 sm:space-y-6">
                        {rightSections.map((section) => (
                            <div key={section.number} className="flex items-center justify-between group">
                                <div className="flex items-center space-x-4">
                                    {/* Number Box */}
                                    <div style={{ background: "var(--primary-accent-color,#9333ea)", color: "var(--text-heading-color,#ffffff)" }} className="w-12 h-12 sm:w-14 sm:h-14 bg-purple-600 rounded-xl flex items-center justify-center text-white font-bold text-lg sm:text-xl group-hover:bg-purple-700 transition-colors">
                                        {section.number}
                                    </div>
                                    {/* Title */}
                                    <span style={{ color: "var(--text-heading-color,#111827)" }} className="text-lg sm:text-xl font-medium text-gray-800 group-hover:text-purple-600 transition-colors">
                                        {section.title}
                                    </span>
                                </div>
                                {/* Page Number */}
                                <div className="text-right">
                                    <span style={{ color: "var(--text-body-color,#4b5563)" }} className="text-lg sm:text-xl text-gray-600">
                                        {section.pageNumber}
                                    </span>
                                    {/* Dotted line effect */}
                                    <div style={{ color: "var(--text-body-color,#4b5563)" }} className="text-gray-300 text-sm mt-1">
                                        .....
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </>
    )
}

export default TableOfContentsSlideLayout 