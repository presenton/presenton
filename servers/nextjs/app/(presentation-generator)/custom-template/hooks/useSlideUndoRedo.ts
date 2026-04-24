import { useState, useCallback, useEffect, useRef } from "react";
import { ProcessedSlide } from "../types";

interface SlideHistoryState {
    react: string;
    timestamp: number;
}

interface UseSlideUndoRedoOptions {
    maxHistorySize?: number;
}

// Overload 1: Array-based setSlides (for use with parent state)
export function useSlideUndoRedo(
    slide: ProcessedSlide,
    setSlides: React.Dispatch<React.SetStateAction<ProcessedSlide[]>>,
    slideIndex: number,
    options?: UseSlideUndoRedoOptions
): {
    undo: () => void;
    redo: () => void;
    canUndo: boolean;
    canRedo: boolean;
    clearHistory: () => void;
    historyInfo: { pastCount: number; futureCount: number; canUndo: boolean; canRedo: boolean };
};

// Overload 2: Single slide state setter (for local state management)
export function useSlideUndoRedo(
    slide: ProcessedSlide,
    setSlideState: React.Dispatch<React.SetStateAction<ProcessedSlide>>,
    slideIndex: null,
    options?: UseSlideUndoRedoOptions
): {
    undo: () => void;
    redo: () => void;
    canUndo: boolean;
    canRedo: boolean;
    clearHistory: () => void;
    historyInfo: { pastCount: number; futureCount: number; canUndo: boolean; canRedo: boolean };
};

// Implementation
export function useSlideUndoRedo(
    slide: ProcessedSlide,
    setSlides: React.Dispatch<React.SetStateAction<ProcessedSlide[]>> | React.Dispatch<React.SetStateAction<ProcessedSlide>>,
    slideIndex: number | null,
    options: UseSlideUndoRedoOptions = {}
) {
    const { maxHistorySize = 50 } = options;

    const [past, setPast] = useState<SlideHistoryState[]>([]);
    const [future, setFuture] = useState<SlideHistoryState[]>([]);
    const isUndoRedoAction = useRef(false);
    const lastReact = useRef<string | undefined>(slide.react);

    // Determine if we're in single-slide mode
    const isSingleSlideMode = slideIndex === null;

    // Track changes to the slide's react content
    useEffect(() => {
        // Skip if this is an undo/redo action or if slide is processing
        if (isUndoRedoAction.current || slide.processing || !slide.processed) {
            isUndoRedoAction.current = false;
            return;
        }

        // Skip if react content hasn't changed
        if (slide.react === lastReact.current) {
            return;
        }

        // Save current state to past before updating
        if (lastReact.current !== undefined) {
            setPast(prev => {
                const newPast = [
                    ...prev,
                    { react: lastReact.current!, timestamp: Date.now() }
                ];
                // Limit history size
                if (newPast.length > maxHistorySize) {
                    return newPast.slice(-maxHistorySize);
                }
                return newPast;
            });
            // Clear future when new changes are made
            setFuture([]);
        }

        lastReact.current = slide.react;
    }, [slide.react, slide.processing, slide.processed, maxHistorySize]);

    // Reset history when slide changes (different slide_number) - only in array mode
    useEffect(() => {
        if (!isSingleSlideMode) {
            setPast([]);
            setFuture([]);
            lastReact.current = slide.react;
        }
    }, [slide.slide_number, isSingleSlideMode]);

    const canUndo = past.length > 0;
    const canRedo = future.length > 0;

    const undo = useCallback(() => {
        if (!canUndo || !slide.react) return;

        const previousState = past[past.length - 1];

        // Mark as undo/redo action to prevent history recording
        isUndoRedoAction.current = true;

        // Save current state to future
        setFuture(prev => [
            { react: slide.react!, timestamp: Date.now() },
            ...prev
        ]);

        // Remove from past
        setPast(prev => prev.slice(0, -1));

        // Update the slide based on mode
        if (isSingleSlideMode) {
            // Single slide mode - update directly
            (setSlides as React.Dispatch<React.SetStateAction<ProcessedSlide>>)(
                prev => ({ ...prev, react: previousState.react })
            );
        } else {
            // Array mode - update at index
            (setSlides as React.Dispatch<React.SetStateAction<ProcessedSlide[]>>)(
                prevSlides => prevSlides.map((s, i) =>
                    i === slideIndex ? { ...s, react: previousState.react } : s
                )
            );
        }

        lastReact.current = previousState.react;
    }, [canUndo, slide.react, past, slideIndex, setSlides, isSingleSlideMode]);

    const redo = useCallback(() => {
        if (!canRedo) return;

        const nextState = future[0];

        // Mark as undo/redo action to prevent history recording
        isUndoRedoAction.current = true;

        // Save current state to past
        if (slide.react) {
            setPast(prev => [
                ...prev,
                { react: slide.react!, timestamp: Date.now() }
            ]);
        }

        // Remove from future
        setFuture(prev => prev.slice(1));

        // Update the slide based on mode
        if (isSingleSlideMode) {
            // Single slide mode - update directly
            (setSlides as React.Dispatch<React.SetStateAction<ProcessedSlide>>)(
                prev => ({ ...prev, react: nextState.react })
            );
        } else {
            // Array mode - update at index
            (setSlides as React.Dispatch<React.SetStateAction<ProcessedSlide[]>>)(
                prevSlides => prevSlides.map((s, i) =>
                    i === slideIndex ? { ...s, react: nextState.react } : s
                )
            );
        }

        lastReact.current = nextState.react;
    }, [canRedo, slide.react, future, slideIndex, setSlides, isSingleSlideMode]);

    // Clear history
    const clearHistory = useCallback(() => {
        setPast([]);
        setFuture([]);
    }, []);

    // Get history info
    const historyInfo = {
        pastCount: past.length,
        futureCount: future.length,
        canUndo,
        canRedo,
    };

    return {
        undo,
        redo,
        canUndo,
        canRedo,
        clearHistory,
        historyInfo,
    };
}

