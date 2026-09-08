import React from 'react'
import TemplatePanel from './components/TemplatePanel'
import { redirect } from 'next/navigation'
import { normalizePresentationGenerationMode } from '@/utils/presentationGenerationMode'


const page = () => {
    if (
        normalizePresentationGenerationMode(
            process.env.PRESENTATION_GENERATION_MODE,
        ) === "smart"
    ) {
        redirect("/dashboard")
    }

    return (
        <TemplatePanel />
    )
}

export default page
