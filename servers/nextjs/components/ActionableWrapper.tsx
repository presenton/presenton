import { cn } from '@/lib/utils'
import React from 'react'

interface ActionableWrapperProps {
  children: React.ReactNode
  className?: string
}

/**
 * Wrapper component for Actionable template slides
 * Provides consistent background, styling, and font imports
 */
const ActionableWrapper: React.FC<ActionableWrapperProps> = ({ children, className = '' }) => {
  return (
    <>
      {/* Import Google Fonts */}
      <link href="https://fonts.googleapis.com/css2?family=Funnel+Display:wght@300;400;500;600;700;800&family=Geist:wght@100;200;300;400;500;600;700;800;900&display=swap" rel="stylesheet" />

      <section 
        className={cn(`w-full max-w-[1280px] max-h-[720px] aspect-video relative bg-white text-foreground`, className)} 
        style={{ background: "var(--card-background-color,#ffffff)" }}
      >
        {children}
      </section>
    </>
  )
}

export default ActionableWrapper
