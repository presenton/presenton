'use client'
import React, { useEffect, useRef, useState } from 'react'

interface TimerProps {
  duration: number // seconds
}

const Timer = ({ duration }: TimerProps) => {
  const [progress, setProgress] = useState<number>(0)
  const rafIdRef = useRef<number | null>(null)
  const startTimeRef = useRef<number | null>(null)

  useEffect(() => {
    // Guard against invalid durations
    const totalMs = Math.max(0, duration * 1000)

    const tick = (now: number) => {
      if (startTimeRef.current === null) startTimeRef.current = now
      const elapsed = now - startTimeRef.current
      const t = totalMs === 0 ? 1 : Math.min(elapsed / totalMs, 1)

      setProgress(prev => (t <= prev ? prev : t))

      if (t < 1) {
        rafIdRef.current = requestAnimationFrame(tick)
      } else {
        // Ensure we finish at 100%
        setProgress(1)
        if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current)
        rafIdRef.current = null
      }
    }

    // Initialize animation
    setProgress(0)
    startTimeRef.current = null
    rafIdRef.current = requestAnimationFrame(tick)

    return () => {
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current)
      rafIdRef.current = null
      startTimeRef.current = null
    }
  }, [duration])

  const progressValue = Math.min(1, Number(progress.toFixed(4)))
  const displayedProgress = Math.round(progressValue * 100)

  return (
    <div className="w-full">
      {/* Progress bar container */}
      <div
        className="relative w-full h-2 rounded-full bg-[#E5E7EB] overflow-hidden"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={displayedProgress}
      >
        {/* Progress fill */}
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-100 ease-out"
          style={{
            width: `${progressValue * 100}%`,
            background: 'linear-gradient(90deg, #7A5AF8, #9B8AFB, #7A5AF8)',
            backgroundSize: '200% 100%',
            animation: 'shimmer 2s linear infinite',
          }}
        >
          {/* Animated stripes overlay */}
          <div
            className="absolute inset-0 opacity-30"
            style={{
              backgroundImage: 'linear-gradient(45deg, rgba(255,255,255,0.4) 25%, transparent 25%, transparent 50%, rgba(255,255,255,0.4) 50%, rgba(255,255,255,0.4) 75%, transparent 75%, transparent)',
              backgroundSize: '12px 12px',
              animation: 'stripes 0.8s linear infinite',
            }}
          />
        </div>
      </div>

      {/* Percentage text */}
      <div className="flex justify-end mt-1.5">
        <span className="text-xs font-medium text-[#6B7280] tabular-nums">
          {displayedProgress}%
        </span>
      </div>

      <style jsx>{`
        @keyframes shimmer {
          0% { background-position: 200% 50%; }
          100% { background-position: 0% 50%; }
        }
        @keyframes stripes {
          to { background-position: 12px 0; }
        }
      `}</style>
    </div>
  )
}

export default Timer
