import { cn } from '@/lib/utils'
import React from 'react'

interface ActionableImageProps {
  src: string
  alt: string
  className?: string
}

/**
 * Image component for Actionable template slides
 * Provides consistent image styling with object-cover
 */
const ActionableImage: React.FC<ActionableImageProps> = ({
  src,
  alt,
  className = '',
}) => {
  return (
    <img
      src={src}
      alt={alt}
      className={cn(`w-full h-full object-cover`, className)}
    />
  )
}

export default ActionableImage
