import { LanguageType, PresentationConfig } from "../type";
import { useEffect, useRef, useState } from "react";
import {
  Check,
  ChevronRight,
  ChevronUp,
  Languages,
  Monitor,
} from "lucide-react";
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
import {
  clampSlideCountValue,
  MAX_NUMBER_OF_SLIDES,
} from "@/utils/presentationLimits";

// Types
interface ConfigurationSelectsProps {
  config: PresentationConfig;
  onConfigChange: (key: keyof PresentationConfig, value: any) => void;
  compact?: boolean;
}

type SlideOption =
  | "5"
  | "8"
  | "9"
  | "10"
  | "11"
  | "12"
  | "13"
  | "14"
  | "15"
  | "16"
  | "17"
  | "18"
  | "19"
  | "20";

// Constants
const SLIDE_OPTIONS: SlideOption[] = [
  "5",
  "8",
  "9",
  "10",
  "11",
  "12",
  "13",
  "14",
  "15",
  "16",
  "17",
  "18",
  "19",
  "20",
];

/**
 * Renders a select component for slide count
 */
const SlideCountSelect: React.FC<{
  value: string | null;
  onValueChange: (value: string) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  compact?: boolean;
}> = ({ value, onValueChange, open, onOpenChange, compact = false }) => {
  const [customInput, setCustomInput] = useState(
    value && !SLIDE_OPTIONS.includes(value as SlideOption) ? value : ""
  );
  const isSelectingPresetRef = useRef(false);

  useEffect(() => {
    if (value && !SLIDE_OPTIONS.includes(value as SlideOption)) {
      setCustomInput(value);
    } else {
      setCustomInput("");
    }
  }, [value]);

  useEffect(() => {
    if (!open) {
      isSelectingPresetRef.current = false;
    }
  }, [open]);

  const sanitizeToPositiveInteger = (raw: string): string => {
    return clampSlideCountValue(raw);
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
          aria-controls="slides-options"
          className={cn(
            "flex h-[34px] items-center justify-between gap-2 overflow-hidden rounded-full bg-white px-3.5 font-syne font-medium text-[#191919]",
            compact
              ? "border border-[#EDEEEF] shadow-none focus-visible:ring-2 focus-visible:ring-[#5146E5]/25"
              : "shadow-sm ring-1 ring-inset ring-slate-200 focus-visible:ring-[#5146E5]/30 min-[1800px]:h-10 min-[1800px]:px-4 min-[2200px]:h-11 min-[2200px]:px-5"
          )}
        >
          {compact ? (
            <Monitor
              aria-hidden="true"
              strokeWidth={1.75}
              className="h-3.5 w-3.5 shrink-0"
            />
          ) : (
            <svg
              className="h-3.5 w-3.5 min-[1800px]:h-4 min-[1800px]:w-4 min-[2200px]:h-5 min-[2200px]:w-5"
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
            >
              <path
                d="M4.0835 12.25H9.91683"
                stroke="black"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M11.6665 1.75H2.33317C1.68884 1.75 1.1665 2.27233 1.1665 2.91667V8.75C1.1665 9.39433 1.68884 9.91667 2.33317 9.91667H11.6665C12.3108 9.91667 12.8332 9.39433 12.8332 8.75V2.91667C12.8332 2.27233 12.3108 1.75 11.6665 1.75Z"
                stroke="black"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
          <span
            className={cn(
              "flex flex-1 items-center",
              compact ? "gap-1.5" : "gap-2.5"
            )}
          >
            <span
              className={cn(
                compact
                  ? "text-xs font-semibold tracking-[-0.12px]"
                  : "text-xs font-medium min-[1800px]:text-sm min-[2200px]:text-base"
              )}
            >
              {compact && value ? `Slides ${value}` : displayLabel}
            </span>
            {compact && (
              <ChevronRight
                aria-hidden="true"
                strokeWidth={1.75}
                className="h-3.5 w-3.5 shrink-0 rotate-90"
              />
            )}
          </span>
          {!compact && (
            <ChevronUp className="ml-2 h-4 w-4 shrink-0 min-[1800px]:h-5 min-[1800px]:w-5" />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        id="slides-options"
        className="w-[140px] p-0 font-syne min-[1800px]:w-[160px] min-[2200px]:w-[180px]"
        align="end"
      >
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
              onBlur={() => {
                if (!isSelectingPresetRef.current) {
                  applyCustomValue();
                }
              }}
              placeholder="--"
              className="h-8 w-16 px-2 text-sm min-[1800px]:h-9 min-[1800px]:w-20 min-[1800px]:text-base"
            />
            <span className="text-sm font-medium min-[1800px]:text-base">slides</span>
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
                  onPointerDownCapture={() => {
                    isSelectingPresetRef.current = true;
                  }}
                  onMouseDownCapture={() => {
                    isSelectingPresetRef.current = true;
                  }}
                  onSelect={() => {
                    onValueChange(option);
                    setCustomInput("");
                    isSelectingPresetRef.current = false;
                    onOpenChange(false);
                  }}
                  className="font-syne text-sm font-medium min-[1800px]:text-base"
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
  compact?: boolean;
}> = ({ value, onValueChange, open, onOpenChange, compact = false }) => (
  <Popover open={open} onOpenChange={onOpenChange}>
    <PopoverTrigger asChild>
      <button
        role="combobox"
        name="language"
        data-testid="language-select"
        aria-expanded={open}
        aria-controls="language-options"
        className={cn(
          "flex h-[34px] max-w-[160px] items-center gap-2 overflow-hidden rounded-full bg-white px-3.5 font-syne font-semibold text-[#191919]",
          compact
            ? "border border-[#EDEEEF] shadow-none focus-visible:ring-2 focus-visible:ring-[#5146E5]/25"
            : "shadow-sm ring-1 ring-inset ring-slate-200 min-[1800px]:h-10 min-[1800px]:max-w-[190px] min-[1800px]:px-4 min-[2200px]:h-11 min-[2200px]:max-w-[220px] min-[2200px]:px-5"
        )}
      >
        <Languages
          aria-hidden="true"
          strokeWidth={compact ? 1.75 : 2}
          className={cn(
            "shrink-0",
            compact
              ? "h-3.5 w-3.5"
              : "h-3.5 w-3.5 min-[1800px]:h-4 min-[1800px]:w-4 min-[2200px]:h-5 min-[2200px]:w-5"
          )}
        />
        <span
          className={cn(
            "flex min-w-0 flex-1 items-center",
            compact ? "gap-0.5" : "truncate"
          )}
        >
          <span
            className={cn(
              "truncate",
              compact
                ? "text-xs font-semibold tracking-[-0.12px]"
                : "text-xs font-medium min-[1800px]:text-sm min-[2200px]:text-base"
            )}
          >
            {value || "Select language"}
          </span>
          {compact && (
            <ChevronRight
              aria-hidden="true"
              strokeWidth={1.75}
              className="h-3.5 w-3.5 shrink-0 rotate-90"
            />
          )}
        </span>
        {!compact && (
          <ChevronUp className="ml-2 h-4 w-4 flex-shrink-0 min-[1800px]:h-5 min-[1800px]:w-5" />
        )}
      </button>
    </PopoverTrigger>
    <PopoverContent
      id="language-options"
      className="w-[300px] p-0 min-[1800px]:w-[340px] min-[2200px]:w-[380px]"
      align="end"
    >
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
  compact = false,
}: ConfigurationSelectsProps) {
  const [openSlides, setOpenSlides] = useState(false);
  const [openLanguage, setOpenLanguage] = useState(false);

  return (
    <div
      className={cn(
        "order-1 flex flex-wrap items-center",
        compact ? "gap-3" : "gap-4 min-[1800px]:gap-5"
      )}
    >
      <SlideCountSelect
        value={config.slides}
        onValueChange={(value) => onConfigChange("slides", value)}
        open={openSlides}
        onOpenChange={setOpenSlides}
        compact={compact}
      />
      <LanguageSelect
        value={config.language}
        onValueChange={(value) => onConfigChange("language", value)}
        open={openLanguage}
        onOpenChange={setOpenLanguage}
        compact={compact}
      />
      <AdvanceSettings
        config={config}
        onConfigChange={onConfigChange}
        compact={compact}
      />
    </div>
  );
}
