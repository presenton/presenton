import React from 'react'
import DashboardSidebar from './Components/DashboardSidebar'
import { normalizePresentationGenerationMode } from '@/utils/presentationGenerationMode'
import { isCommunityEnabled } from '@/utils/community'

const layout = ({ children }: { children: React.ReactNode }) => {
    const presentationGenerationMode = normalizePresentationGenerationMode(
        process.env.PRESENTATION_GENERATION_MODE,
    )

    return (
        <div className='flex pr-4 bg-white'>
            <DashboardSidebar
                showCommunity={isCommunityEnabled(process.env.PRESENTON_COMMUNITY_ENABLED)}
                showTemplates={presentationGenerationMode !== "smart"}
            />
            <div className='w-full min-w-0'>

                {children}
            </div>
        </div>
    )
}

export default layout
