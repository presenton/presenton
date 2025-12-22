import { cn } from '@/lib/utils'
import React from 'react'

interface ActionableTitleProps {
  children: React.ReactNode
  className?: string
}

/**
 * Title component (h1) for Actionable template slides
 * Uses Funnel Display font and consistent sizing
 */
const ActionableTitle: React.FC<ActionableTitleProps> = ({ children, className = '' }) => {
  return (
    <h1 
      className={cn(`text-4xl leading-[130%]`, className)}
      style={{ fontFamily: "Funnel Display, sans-serif" }}
    >
      {children}
    </h1>
  )
}

export default ActionableTitle
