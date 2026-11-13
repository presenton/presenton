"use client";

import { useId, useState } from "react";
import { Check, ChevronDown, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useCodexModels } from "@/components/CodexModelCatalog";
import { cn } from "@/lib/utils";

export default function CodexModelPicker({ value, onChange }: {
  value: string;
  onChange: (model: string) => void;
}) {
  const catalog = useCodexModels();
  const [open, setOpen] = useState(false);
  const listId = useId();
  const selected = catalog.models.find((model) => model.id === value);
  const ready = catalog.status === "ready";

  return (
    <div className="space-y-2" data-cy="codex-model-picker">
      <div className="flex items-center justify-between gap-3">
        <label className="text-sm font-medium text-gray-700">ChatGPT model</label>
        <button
          type="button"
          onClick={catalog.refresh}
          disabled={!catalog.connected || catalog.status === "loading"}
          className="inline-flex items-center gap-1.5 text-xs text-gray-600 disabled:opacity-50"
        >
          {catalog.status === "loading" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          Refresh models
        </button>
      </div>
      <Popover open={open && ready} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-label="ChatGPT model"
            aria-expanded={open && ready}
            aria-controls={listId}
            disabled={!ready || catalog.models.length === 0}
            className="h-12 w-full justify-between border-gray-300 px-3 text-left"
          >
            <span>{selected?.name || value || (catalog.status === "loading" ? "Loading models…" : "Select a model")}</span>
            <ChevronDown className="h-4 w-4 shrink-0 text-gray-400" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="p-0" align="start" style={{ width: "var(--radix-popover-trigger-width)" }}>
          <Command>
            <CommandInput placeholder="Search models…" />
            <CommandList id={listId}>
              <CommandEmpty>No model found.</CommandEmpty>
              <CommandGroup>
                {ready && catalog.models.map((model) => (
                  <CommandItem key={model.id} value={model.id} onSelect={() => {
                    // Command search normalization must never rewrite a provider's ID.
                    onChange(model.id);
                    setOpen(false);
                  }}>
                    <Check className={cn("mr-2 h-4 w-4", value === model.id ? "opacity-100" : "opacity-0")} />
                    {model.name}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {catalog.error && <p role="alert" className="text-sm text-red-700">{catalog.error} Your saved model has not been changed.</p>}
      {ready && catalog.models.length === 0 && <p role="alert" className="text-sm text-amber-800">No ChatGPT models are available for this account.</p>}
      {ready && value && !selected && <p role="alert" className="text-sm text-amber-800">The selected model is no longer available. Choose a model; your saved selection has not been changed.</p>}
    </div>
  );
}
