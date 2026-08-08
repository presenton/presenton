import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { clampSlideCountValue, MAX_NUMBER_OF_SLIDES } from '@/utils/presentationLimits';
import React, { useState } from 'react'

const SLIDE_OPTIONS: string[] = ["5", "8", "9", "10", "11", "12", "13", "14", "15", "16", "17", "18", "19", "20"];

const NumberOfSlide = ({ value, onValueChange }: { value: string, onValueChange: (value: string) => void }) => {
    const [customInput, setCustomInput] = useState(
        value && !SLIDE_OPTIONS.includes(value) ? value : ""
    );

    const sanitizeToPositiveInteger = (raw: string): string => {
        return clampSlideCountValue(raw);
    };

    const applyCustomValue = () => {
        const sanitized = sanitizeToPositiveInteger(customInput);
        if (sanitized && Number(sanitized) > 0) {
            onValueChange(sanitized);
        }
    };
    return (
        <Select value={value || ""} onValueChange={onValueChange} name="slides">
            <SelectTrigger
                className="w-[180px] font-instrument_sans font-medium bg-blue-100 border-blue-200 focus-visible:ring-blue-300"
                data-testid="slides-select"
            >
                <SelectValue placeholder="Select Slides" />
            </SelectTrigger>
            <SelectContent className="font-instrument_sans">
                {/* Sticky custom input at the top */}
                <div
                    className="sticky top-0 z-10 bg-white  p-2 border-b"
                    onMouseDown={(e) => e.stopPropagation()}
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="flex items-center gap-2">
                        <Input
                            inputMode="numeric"
                            pattern="[0-9]*"
                            max={MAX_NUMBER_OF_SLIDES}
                            value={customInput}
                            onMouseDown={(e) => e.stopPropagation()}
                            onPointerDown={(e) => e.stopPropagation()}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => {
                                const next = sanitizeToPositiveInteger(e.target.value);
                                setCustomInput(next);
                            }}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                    e.preventDefault();
                                    applyCustomValue();
                                }
                            }}
                            onBlur={applyCustomValue}
                            placeholder="--"
                            className="h-8 w-16 px-2 text-sm"
                        />
                        <span className="text-sm font-medium">slides</span>
                    </div>
                </div>

                {/* Hidden item to allow SelectValue to render custom selection */}
                {value && !SLIDE_OPTIONS.includes(value) && (
                    <SelectItem value={value} className="hidden">
                        {value} slides
                    </SelectItem>
                )}

                {SLIDE_OPTIONS.map((option) => (
                    <SelectItem
                        key={option}
                        value={option}
                        className="font-instrument_sans text-sm font-medium"
                        role="option"
                    >
                        {option} slides
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    )
}

export default NumberOfSlide
