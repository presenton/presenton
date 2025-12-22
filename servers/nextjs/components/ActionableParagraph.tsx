import { cn } from '@/lib/utils'
import React from 'react'

interface ActionableParagraphProps {
  children: React.ReactNode
  className?: string
}

/**
 * Paragraph component for Actionable template slides
 * Uses Geist font with consistent line height
 */
const ActionableParagraph: React.FC<ActionableParagraphProps> = ({ children, className = '' }) => {
  return (
    <p 
      className={cn(`leading-[150%]`, className)}
      style={{ fontFamily: "Geist, sans-serif" }}
    >
      {children}
    </p>
  )
}

export default ActionableParagraph
