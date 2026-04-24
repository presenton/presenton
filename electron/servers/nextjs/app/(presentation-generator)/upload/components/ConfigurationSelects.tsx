import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { LanguageType, PresentationConfig } from "../type";
import { useEffect, useState } from "react";
import { Check, ChevronUp, Languages } from "lucide-react";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import AdvanceSettings from "./AdvanceSettings";

// Types
interface ConfigurationSelectsProps {
    config: PresentationConfig;
    onConfigChange: (key: keyof PresentationConfig, value: any) => void;
}

type SlideOption = "5" | "8" | "9" | "10" | "11" | "12" | "13" | "14" | "15" | "16" | "17" | "18" | "19" | "20";

// Constants
const SLIDE_OPTIONS: SlideOption[] = ["5", "8", "9", "10", "11", "12", "13", "14", "15", "16", "17", "18", "19", "20"];

/**
 * Renders a select component for slide count
 */
const SlideCountSelect: React.FC<{
    value: string | null;
    onValueChange: (value: string) => void;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}> = ({ value, onValueChange, open, onOpenChange }) => {
    const [customInput, setCustomInput] = useState(
        value && !SLIDE_OPTIONS.includes(value as SlideOption) ? value : ""
    );

    useEffect(() => {
        if (value && !SLIDE_OPTIONS.includes(value as SlideOption)) {
            setCustomInput(value);
        } else {
            setCustomInput("");
        }
    }, [value]);

    const sanitizeToPositiveInteger = (raw: string): string => {
        const digitsOnly = raw.replace(/\D+/g, "");
        if (!digitsOnly) return "";
        const noLeadingZeros = digitsOnly.replace(/^0+/, "");
        return noLeadingZeros;
    };

    const applyCustomValue = () => {
        const sanitized = sanitizeToPositiveInteger(customInput);
        if (sanitized && Number(sanitized) > 0) {
            onValueChange(sanitized);
            onOpenChange(false);
        }
    };

    const displayLabel = value ? `${value} slides` : "Auto slides";

    return (
        <Popover open={open} onOpenChange={onOpenChange}>
            <PopoverTrigger asChild>
                <button
                    role="combobox"
                    name="slides"
                    data-testid="slides-select"
                    aria-expanded={open}
                    className=" overflow-hidden font-syne font-medium  text-[#191919]  focus-visible:ring-[#5146E5]/30 flex justify-between items-center gap-2 h-[34px] rounded-full px-3.5 ring-1 ring-inset ring-slate-200 shadow-sm"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <path d="M4.0835 12.25H9.91683" stroke="black" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M11.6665 1.75H2.33317C1.68884 1.75 1.1665 2.27233 1.1665 2.91667V8.75C1.1665 9.39433 1.68884 9.91667 2.33317 9.91667H11.6665C12.3108 9.91667 12.8332 9.39433 12.8332 8.75V2.91667C12.8332 2.27233 12.3108 1.75 11.6665 1.75Z" stroke="black" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <span className="flex flex-1 items-center gap-2.5">
                        <span className="text-xs font-medium ">{displayLabel}</span>
                    </span>
                    <ChevronUp className="ml-2 h-4 w-4 shrink-0" />
                </button>
            </PopoverTrigger>
            <PopoverContent className="w-[140px] p-0 font-syne" align="end">
                <div
                    className="sticky top-0 z-10 bg-white p-2 border-b"
                    onMouseDown={(e) => e.stopPropagation()}
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="flex items-center gap-2">
                        <Input
                            inputMode="numeric"
                            pattern="[0-9]*"
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
                <Command>
                    <CommandList>
                        <CommandGroup>
                            {SLIDE_OPTIONS.map((option) => (
                                <CommandItem
                                    key={option}
                                    value={`${option} slides`}
                                    role="option"
                                    onSelect={() => {
                                        onValueChange(option);
                                        setCustomInput("");
                                        onOpenChange(false);
                                    }}
                                    className="font-syne text-sm font-medium"
                                >
                                    <Check
                                        className={cn(
                                            "mr-2 h-4 w-4",
                                            value === option ? "opacity-100" : "opacity-0"
                                        )}
                                    />
                                    {option} slides
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
};

/**
 * Renders a language selection component with search functionality
 */
const LanguageSelect: React.FC<{
    value: string | null;
    onValueChange: (value: string) => void;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}> = ({ value, onValueChange, open, onOpenChange }) => (
    <Popover open={open} onOpenChange={onOpenChange}>
        <PopoverTrigger asChild>
            <button
                role="combobox"
                name="language"
                data-testid="language-select"
                aria-expanded={open}
                className="w-[125px] flex items-center gap-2 overflow-hidden  font-syne font-semibold  text-[#191919] h-10 rounded-full px-3.5 ring-1 ring-inset ring-slate-200 shadow-sm"
            >
                <Languages className="w-3.5 h-3.5" />
                <span className="w-[40px] text-left">
                    <span className="text-xs font-medium truncate block">
                        {value || "Select language"}
                    </span>
                </span>
                <ChevronUp className="ml-2 h-4 w-4 shrink-0" />

            </button>
        </PopoverTrigger>
        <PopoverContent className="w-[300px] p-0" align="end">
            <Command>
                <CommandInput
                    placeholder="Search language..."
                    className="font-instrument_sans"
                />
                <CommandList>
                    <CommandEmpty>No language found.</CommandEmpty>
                    <CommandGroup>
                        {Object.values(LanguageType).map((language) => (
                            <CommandItem
                                key={language}
                                value={language}
                                role="option"
                                onSelect={(currentValue) => {
                                    onValueChange(currentValue);
                                    onOpenChange(false);
                                }}
                                className="font-instrument_sans"
                            >
                                <Check
                                    className={cn(
                                        "mr-2 h-4 w-4",
                                        value === language ? "opacity-100" : "opacity-0"
                                    )}
                                />
                                {language}
                            </CommandItem>
                        ))}
                    </CommandGroup>
                </CommandList>
            </Command>
        </PopoverContent>
    </Popover>
);

export function ConfigurationSelects({
    config,
    onConfigChange,
}: ConfigurationSelectsProps) {
    const [openSlides, setOpenSlides] = useState(false);
    const [openLanguage, setOpenLanguage] = useState(false);

    return (
        <div className="flex flex-wrap order-1 gap-4 items-center">
            <SlideCountSelect
                value={config.slides}
                onValueChange={(value) => onConfigChange("slides", value)}
                open={openSlides}
                onOpenChange={setOpenSlides}
            />
            <LanguageSelect
                value={config.language}
                onValueChange={(value) => onConfigChange("language", value)}
                open={openLanguage}
                onOpenChange={setOpenLanguage}
            />
            <AdvanceSettings config={config} onConfigChange={onConfigChange} />
        </div>
    );
}
