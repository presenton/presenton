import { NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'
import { TemplateSetting } from '@/app/(presentation-generator)/template-preview/types'

export async function GET() {
    try {
        // Get the path to the presentation-templates directory
        const templatesDirectory = path.join(process.cwd(), 'app', 'presentation-templates')
        
        // Read all directories in the presentation-templates directory
        const items = await fs.readdir(templatesDirectory, { withFileTypes: true })
        
        // Filter for directories (layout templates) and exclude files
        const templateDirectories = items
            .filter(item => item.isDirectory())
            .map(dir => dir.name)
        
        const allLayouts: {templateName: string, templateID: string; files: string[]; settings: TemplateSetting | null }[] = []
        
        // Scan each template directory for layout files and settings
        for (const templateName of templateDirectories) {
            try {
                const templatePath = path.join(templatesDirectory, templateName)
                const templateFiles = await fs.readdir(templatePath)
                
                // Filter for .tsx files and exclude any non-layout files
                const layoutFiles = templateFiles.filter(file => 
                    file.endsWith('.tsx') && 
                    !file.startsWith('.') && 
                    !file.includes('.test.') &&
                    !file.includes('.spec.') &&
                    file !== 'settings.json'
                )
                
                // Read settings.json if it exists
                let settings: TemplateSetting | null = null
                const settingsPath = path.join(templatePath, 'settings.json')
                try {
                    const settingsContent = await fs.readFile(settingsPath, 'utf-8')
                    settings = JSON.parse(settingsContent) as TemplateSetting
                } catch (settingsError) {
                    
                    console.warn(`No settings.json found for template ${templateName} or invalid JSON`)
                    // Provide default settings if settings.json is missing or invalid
                    settings = {
                        description: `${templateName} presentation layouts`,
                        ordered: false,
                        default: false
                    }
                   
                }

                if (layoutFiles.length > 0) {
                    allLayouts.push({
                        templateName: templateName,
                        templateID: templateName,
                        files: layoutFiles,
                        settings: settings
                    })
                }
            } catch (error) {
                console.error(`Error reading template directory ${templateName}:`, error)
                // Continue with other templates even if one fails
            }
        }
      
        
        return NextResponse.json(allLayouts)
    } catch (error) {
        console.error('Error reading presentation-templates directory:', error)
        return NextResponse.json(
            { error: 'Failed to read presentation-templates directory' },
            { status: 500 }
        )
    }
} 