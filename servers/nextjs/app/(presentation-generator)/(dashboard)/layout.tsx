import React from 'react'
import DashboardSidebar from './Components/DashboardSidebar'
import { normalizePresentationGenerationMode } from '@/utils/presentationGenerationMode'

const layout = ({ children }: { children: React.ReactNode }) => {
    const presentationGenerationMode = normalizePresentationGenerationMode(
        process.env.PRESENTATION_GENERATION_MODE,
    )

    return (
        <div className='flex pr-4 bg-white'>
            <DashboardSidebar showTemplates={presentationGenerationMode !== "smart"} />
            <div className='w-full'>

                {children}
            </div>
        </div>
    )
}

export default layout
