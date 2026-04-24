'use client'

import React, { createContext, useContext, useState, RefObject } from 'react'

interface SchemaHighlightContextType {
    // Currently highlighted schema path (from schema editor hover)
    highlightedSchemaPath: string | null
    setHighlightedSchemaPath: (path: string | null) => void

    // Currently highlighted element path (from element click)
    highlightedElementPath: string | null
    setHighlightedElementPath: (path: string | null) => void

    // Sample data for matching elements to schema paths
    sampleData: Record<string, any> | null
    setSampleData: (data: Record<string, any> | null) => void

    // Container ref for the slide preview
    slideContainerRef: RefObject<HTMLDivElement | null> | null
    setSlideContainerRef: (ref: RefObject<HTMLDivElement | null> | null) => void


}

const SchemaHighlightContext = createContext<SchemaHighlightContextType | null>(null)

export const SchemaHighlightProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [highlightedSchemaPath, setHighlightedSchemaPath] = useState<string | null>(null)
    const [highlightedElementPath, setHighlightedElementPath] = useState<string | null>(null)
    const [sampleData, setSampleData] = useState<Record<string, any> | null>(null)
    const [slideContainerRef, setSlideContainerRef] = useState<RefObject<HTMLDivElement | null> | null>(null)


    return (
        <SchemaHighlightContext.Provider value={{
            highlightedSchemaPath,
            setHighlightedSchemaPath,
            highlightedElementPath,
            setHighlightedElementPath,
            sampleData,
            setSampleData,
            slideContainerRef,
            setSlideContainerRef,

        }}>
            {children}
        </SchemaHighlightContext.Provider>
    )
}

export const useSchemaHighlight = () => {
    const context = useContext(SchemaHighlightContext)
    if (!context) {
        // Return a no-op version if not in provider
        return {
            highlightedSchemaPath: null,
            setHighlightedSchemaPath: () => { },
            highlightedElementPath: null,
            setHighlightedElementPath: () => { },
            sampleData: null,
            setSampleData: () => { },
            slideContainerRef: null,
            setSlideContainerRef: () => { },

        }
    }
    return context
}

// Helper to get value from nested path in data object
export function getValueAtPath(data: Record<string, any> | null | undefined, path: string): any {
    if (!data || !path) return undefined

    // Handle array item paths like "items[].title" - get from first item
    const parts = path.split('.')
    let current: any = data

    for (const part of parts) {
        if (current === undefined || current === null) return undefined

        // Check if this part has array notation
        if (part.endsWith('[]')) {
            const arrayKey = part.slice(0, -2)
            current = current[arrayKey]
            if (Array.isArray(current) && current.length > 0) {
                current = current[0] // Get first item for matching
            } else {
                return undefined
            }
        } else {
            current = current[part]
        }
    }

    return current
}

// Helper to find all values for a schema path (for arrays, returns all item values)
export function getAllValuesAtPath(data: Record<string, any> | null | undefined, path: string): any[] {
    if (!data || !path) return []

    const parts = path.split('.')
    let currentItems: any[] = [data]

    for (const part of parts) {
        const nextItems: any[] = []

        for (const item of currentItems) {
            if (item === undefined || item === null) continue

            if (part.endsWith('[]')) {
                const arrayKey = part.slice(0, -2)
                const arr = item[arrayKey]
                if (Array.isArray(arr)) {
                    nextItems.push(...arr)
                }
            } else {
                if (item[part] !== undefined) {
                    nextItems.push(item[part])
                }
            }
        }

        currentItems = nextItems
    }

    return currentItems.filter(v => v !== undefined && v !== null)
}

