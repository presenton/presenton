"use client";

import { useId, useMemo, useState } from "react";
import { Check, ChevronDown } from "lucide-react";

import {
  Command,
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

interface CreatableModelInputProps {
  value: string;
  options: string[];
  providerLabel: string;
  onChange: (value: string) => void;
}

export default function CreatableModelInput({
  value,
  options,
  providerLabel,
  onChange,
}: CreatableModelInputProps) {
  const popoverId = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const normalizedOptions = useMemo(
    () => Array.from(new Set(options.filter(Boolean))),
    [options]
  );
  const normalizedQuery = query.trim();
  const filteredOptions = useMemo(() => {
    const searchQuery = normalizedQuery.toLowerCase();
    if (!searchQuery) return normalizedOptions;
    return normalizedOptions.filter((model) =>
      model.toLowerCase().includes(searchQuery)
    );
  }, [normalizedOptions, normalizedQuery]);
  const customModel =
    normalizedQuery &&
    !normalizedOptions.some(
      (model) => model.toLowerCase() === normalizedQuery.toLowerCase()
    )
      ? normalizedQuery
      : "";

  const selectModel = (model: string) => {
    onChange(model);
    setQuery("");
    setOpen(false);
  };

  return (
    <div className="w-full">
      <label className="mb-2 block text-sm font-medium text-gray-700">
        {providerLabel} model ID
      </label>
      <Popover
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen);
          if (nextOpen) setQuery("");
        }}
      >
        <PopoverTrigger asChild>
          <button
            type="button"
            role="combobox"
            aria-controls={popoverId}
            aria-expanded={open}
            className="flex h-12 w-full items-center justify-between gap-3 rounded-lg border border-gray-300 bg-white px-4 text-left text-sm outline-none transition-colors hover:border-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
          >
            <span
              className={cn(
                "min-w-0 flex-1 truncate",
                value ? "font-medium text-gray-900" : "text-gray-400"
              )}
            >
              {value || "Select a discovered model or enter any model ID"}
            </span>
            <ChevronDown
              className={cn(
                "h-4 w-4 shrink-0 text-gray-500 transition-transform",
                open && "rotate-180"
              )}
              aria-hidden="true"
            />
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          sideOffset={6}
          style={{
            width: "min(460px, calc(100vw - 24px))",
            minWidth:
              "min(var(--radix-popover-trigger-width), calc(100vw - 24px))",
          }}
          className="overflow-hidden rounded-lg border border-gray-200 bg-white p-0 shadow-[0_10px_30px_rgba(16,24,40,0.12)]"
        >
          <Command shouldFilter={false}>
            <CommandInput
              value={query}
              onValueChange={setQuery}
              placeholder="Search or enter a model ID..."
            />
            <CommandList id={popoverId} className="max-h-60 hide-scrollbar">
              <CommandGroup>
                {customModel && (
                  <CommandItem
                    value={customModel}
                    onSelect={() => selectModel(customModel)}
                    className="cursor-pointer px-2 py-2.5"
                  >
                    <Check className="mr-2 h-4 w-4 opacity-0" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-gray-900">
                        Use “{customModel}”
                      </p>
                      <p className="mt-1 text-xs leading-relaxed text-gray-600">
                        Save as a custom model ID
                      </p>
                    </div>
                  </CommandItem>
                )}
                {filteredOptions.map((model) => (
                    <CommandItem
                      key={model}
                      value={model}
                      onSelect={() => selectModel(model)}
                      className={cn(
                        "cursor-pointer px-2 py-2.5",
                        value === model && "bg-accent"
                      )}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          value === model ? "opacity-100" : "opacity-0"
                        )}
                        aria-hidden="true"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="break-all text-sm font-medium leading-5 text-gray-900">
                          {model}
                        </p>
                      </div>
                    </CommandItem>
                  ))}
                {!customModel && filteredOptions.length === 0 && (
                  <div className="px-3 py-5 text-center text-sm text-gray-500">
                    No discovered models yet.
                  </div>
                )}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      <p className="mt-1.5 text-xs text-gray-500">
        Discovered models are suggestions. Custom aliases and provider-specific
        model IDs are accepted.
      </p>
    </div>
  );
}
