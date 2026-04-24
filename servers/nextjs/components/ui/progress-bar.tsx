'use client'
import React, { useEffect, useState, useRef } from 'react';

interface ProgressBarProps {
    duration: number;
    onComplete?: () => void;
}

export const ProgressBar = ({ duration, onComplete }: ProgressBarProps) => {
    const [progress, setProgress] = useState(0);
    const progressInterval = useRef<NodeJS.Timeout | null>(null);
    const startTime = useRef<number>(Date.now());

    useEffect(() => {
        const updateProgress = () => {
            const currentTime = Date.now();
            const elapsedTime = currentTime - startTime.current;
            const calculatedProgress = (elapsedTime / (duration * 1000)) * 100;

            if (calculatedProgress >= 95) {
                setProgress(95);
                if (progressInterval.current) {
                    clearInterval(progressInterval.current);
                }
                onComplete?.();
                return;
            }

            // Slow down progress after 90%
            if (calculatedProgress > 90) {
                const remainingProgress = Math.min(99 - progress, 0.1);
                setProgress(prev => prev + remainingProgress);
            } else {
                setProgress(Math.min(calculatedProgress, 90));
            }
        };

        progressInterval.current = setInterval(updateProgress, 50);

        return () => {
            if (progressInterval.current) {
                clearInterval(progressInterval.current);
            }
        };
    }, [duration, onComplete]);

    return (
        <div className="w-full space-y-2">
            <div className="flex justify-end items-center  text-sm">
                {/* <span>Processing...</span> */}
                <span className='font-inter text-[#191919]/80 text-end font-medium text-xs'>{Math.round(progress)}%</span>
            </div>
            <div className="w-full bg-white/40 rounded-full h-2 overflow-hidden">
                <div
                    className="h-full bg-gradient-to-r from-[#9034EA] via-[#5146E5] to-[#9034EA] rounded-full animate-gradient transition-all duration-300 ease-out"
                    style={{
                        width: `${progress}%`,
                        backgroundSize: '200% 100%',
                    }}
                />
            </div>
            <style jsx>{`
                @keyframes gradient {
                    0% {
                        background-position: 0% 50%;
                    }
                    50% {
                        background-position: 100% 50%;
                    }
                    100% {
                        background-position: 0% 50%;
                    }
                }
                .animate-gradient {
                    animation: gradient 2s linear infinite;
                }
            `}</style>
        </div>
    );
}; 