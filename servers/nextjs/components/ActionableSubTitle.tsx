import { cn } from '@/lib/utils'
import React from 'react'

interface ActionableSubTitleProps {
  children: React.ReactNode
  className?: string
  variant?: 'funnel' | 'geist'
}

/**
 * Subtitle component (h2) for Actionable template slides
 * Supports both Funnel Display and Geist font variants
 */
const ActionableSubTitle: React.FC<ActionableSubTitleProps> = ({ 
  children, 
  className = '',
  variant = 'funnel'
}) => {
  const fontFamily = variant === 'funnel' 
    ? 'var(--font-funnel-display, "Funnel Display")' 
    : 'var(--font-geist, "Geist")'

  return (
    <h2 
      className={cn(`text-2xl leading-[150%]`, className)}
      style={{ fontFamily }}
    >
      {children}
    </h2>
  )
}

export default ActionableSubTitle
