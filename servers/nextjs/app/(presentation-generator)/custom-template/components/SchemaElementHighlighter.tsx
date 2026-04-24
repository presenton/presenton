'use client'

import React, { useCallback, useEffect, useState, useMemo } from 'react'
import { useSchemaHighlight, getAllValuesAtPath } from './SchemaHighlightContext'

interface HighlightRect {
    left: number
    top: number
    width: number
    height: number
    path: string
}

interface SchemaElementHighlighterProps {
    containerRef: React.RefObject<HTMLDivElement | null>
    sampleData: Record<string, any> | null
    isActive: boolean
}

const SchemaElementHighlighter: React.FC<SchemaElementHighlighterProps> = ({
    containerRef,
    sampleData,
    isActive,
}) => {
    const {
        highlightedSchemaPath,
        setHighlightedElementPath,

    } = useSchemaHighlight()

    const [highlightRects, setHighlightRects] = useState<HighlightRect[]>([])
    const [hoverRect, setHoverRect] = useState<HighlightRect | null>(null)

    // Build a map of text content to schema paths
    const textToPathMap = useMemo(() => {
        if (!sampleData) return new Map<string, string>()

        const map = new Map<string, string>()

        const buildMap = (obj: any, parentPath: string = '') => {
            if (!obj || typeof obj !== 'object') return

            for (const [key, value] of Object.entries(obj)) {
                // Skip internal fields
                if (key.startsWith('__') || key.startsWith('_')) continue

                const path = parentPath ? `${parentPath}.${key}` : key

                if (typeof value === 'string' && value.trim().length > 0) {
                    // Store the text content mapped to its path
                    map.set(value.trim(), path)
                } else if (typeof value === 'number') {
                    map.set(String(value), path)
                } else if (Array.isArray(value)) {
                    // For arrays, map each item's content with array notation
                    value.forEach((item, index) => {
                        if (typeof item === 'object' && item !== null) {
                            buildMap(item, `${path}[]`)
                        } else if (typeof item === 'string' && item.trim().length > 0) {
                            map.set(item.trim(), `${path}[]`)
                        }
                    })
                } else if (typeof value === 'object' && value !== null) {
                    buildMap(value, path)
                }
            }
        }

        buildMap(sampleData)
        return map
    }, [sampleData])

    // Find elements that contain the highlighted schema path's value
    const findElementsForPath = useCallback((path: string): HTMLElement[] => {
        const container = containerRef.current
        if (!container || !sampleData) return []

        // Get all values for this path (handles arrays)
        const values = getAllValuesAtPath(sampleData, path)
        if (values.length === 0) return []

        const elements: HTMLElement[] = []

        // Walk through all text nodes and find matches
        const walker = document.createTreeWalker(
            container,
            NodeFilter.SHOW_TEXT,
            null
        )

        const valueSet = new Set(values.map(v => String(v).trim()))

        let node: Text | null
        while ((node = walker.nextNode() as Text | null)) {
            const text = node.textContent?.trim()
            if (text && valueSet.has(text)) {
                const parent = node.parentElement
                if (parent && !parent.closest('[data-inspector-overlay="1"]')) {
                    elements.push(parent)
                }
            }
        }

        return elements
    }, [containerRef, sampleData])

    // Find the schema path for an element based on its text content
    const findPathForElement = useCallback((element: HTMLElement): string | null => {
        const text = element.textContent?.trim()
        if (!text) return null

        // Look up the text in our map
        return textToPathMap.get(text) || null
    }, [textToPathMap])

    // Calculate highlight rectangles for the highlighted schema path
    useEffect(() => {
        if (!isActive || !highlightedSchemaPath) {
            setHighlightRects([])
            return
        }

        const container = containerRef.current
        if (!container) return

        const elements = findElementsForPath(highlightedSchemaPath)


        const rects: HighlightRect[] = elements.map(el => {
            const rect = el.getBoundingClientRect()
            return {
                left: rect.left,
                top: rect.top,
                width: rect.width,
                height: rect.height,
                path: highlightedSchemaPath,
            }
        }).filter(r => r.width > 0 && r.height > 0)

        setHighlightRects(rects)
    }, [highlightedSchemaPath, isActive, containerRef, findElementsForPath])

    // Handle hover on elements to show which schema field they map to
    useEffect(() => {
        if (!isActive) return

        const container = containerRef.current
        if (!container) return

        const handleMouseOver = (e: MouseEvent) => {
            const target = e.target as HTMLElement
            if (!target || target.closest('[data-inspector-overlay="1"]')) {
                return
            }

            const path = findPathForElement(target)
            if (path) {
                const rect = target.getBoundingClientRect()
                setHoverRect({
                    left: rect.left,
                    top: rect.top,
                    width: rect.width,
                    height: rect.height,
                    path,
                })
            } else {
                setHoverRect(null)
            }
        }

        const handleMouseLeave = () => {
            setHoverRect(null)
        }

        const handleClick = (e: MouseEvent) => {
            const target = e.target as HTMLElement
            if (!target || target.closest('[data-inspector-overlay="1"]')) {
                return
            }

            const path = findPathForElement(target)
            if (path) {
                e.preventDefault()
                e.stopPropagation()
                setHighlightedElementPath(path)

            }
        }

        container.addEventListener('mouseover', handleMouseOver, true)
        container.addEventListener('mouseleave', handleMouseLeave, true)
        container.addEventListener('click', handleClick, true)

        return () => {
            container.removeEventListener('mouseover', handleMouseOver, true)
            container.removeEventListener('mouseleave', handleMouseLeave, true)
            container.removeEventListener('click', handleClick, true)
        }
    }, [isActive, containerRef, findPathForElement, setHighlightedElementPath])

    // Recalculate on scroll/resize
    useEffect(() => {
        if (!isActive) return

        const handleUpdate = () => {
            if (highlightedSchemaPath) {
                const container = containerRef.current
                if (!container) return

                const elements = findElementsForPath(highlightedSchemaPath)
                const rects: HighlightRect[] = elements.map(el => {
                    const rect = el.getBoundingClientRect()
                    return {
                        left: rect.left,
                        top: rect.top,
                        width: rect.width,
                        height: rect.height,
                        path: highlightedSchemaPath,
                    }
                }).filter(r => r.width > 0 && r.height > 0)

                setHighlightRects(rects)
            }
        }

        window.addEventListener('scroll', handleUpdate, true)
        window.addEventListener('resize', handleUpdate)

        return () => {
            window.removeEventListener('scroll', handleUpdate, true)
            window.removeEventListener('resize', handleUpdate)
        }
    }, [isActive, highlightedSchemaPath, containerRef, findElementsForPath])

    if (!isActive) return null

    return (
        <>
            {/* Hover highlight - shows path label */}
            {hoverRect && !highlightedSchemaPath && (
                <>
                    <div
                        data-inspector-overlay="1"
                        style={{
                            position: 'fixed',
                            left: hoverRect.left - 2,
                            top: hoverRect.top - 2,
                            width: hoverRect.width + 4,
                            height: hoverRect.height + 4,
                            border: '2px dashed #10b981',
                            backgroundColor: 'rgba(16, 185, 129, 0.1)',
                            pointerEvents: 'none',
                            zIndex: 40,
                            borderRadius: '4px',
                        }}
                    />
                    {/* Path label */}
                    <div
                        data-inspector-overlay="1"
                        style={{
                            position: 'fixed',
                            left: hoverRect.left,
                            top: hoverRect.top - 24,
                            backgroundColor: '#10b981',
                            color: 'white',
                            fontSize: '10px',
                            fontWeight: 600,
                            padding: '2px 6px',
                            borderRadius: '4px',
                            pointerEvents: 'none',
                            zIndex: 41,
                            whiteSpace: 'nowrap',
                        }}
                    >
                        {hoverRect.path}
                    </div>
                </>
            )}

            {/* Schema path highlights */}
            {highlightRects.map((rect, idx) => (
                <div
                    key={`schema-highlight-${idx}`}
                    data-inspector-overlay="1"
                    className="animate-pulse"
                    style={{
                        position: 'fixed',
                        left: rect.left - 3,
                        top: rect.top - 3,
                        width: rect.width + 6,
                        height: rect.height + 6,
                        border: '3px solid #8b5cf6',
                        backgroundColor: 'rgba(139, 92, 246, 0.15)',
                        pointerEvents: 'none',
                        zIndex: 40,
                        borderRadius: '6px',
                        boxShadow: '0 0 0 2px rgba(139, 92, 246, 0.3), 0 4px 12px rgba(139, 92, 246, 0.2)',
                    }}
                />
            ))}

        </>
    )
}

export default SchemaElementHighlighter

