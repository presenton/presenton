"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Eye, EyeOff, Search, Check, ChevronUp } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
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

import { LLMConfig } from "@/types/llm_config";
import { WEB_SEARCH_PROVIDERS } from "@/utils/providerConstants";

const EXTERNAL_WEB_SEARCH_OPTIONS = [
  "exa",
  "tavily",
  // "brave",
  // "serper",
  "searxng",
] as const;
const WEB_SEARCH_PROVIDER_OPTIONS = [
  WEB_SEARCH_PROVIDERS.auto,
  ...EXTERNAL_WEB_SEARCH_OPTIONS.map((value) => WEB_SEARCH_PROVIDERS[value]),
];

const WebSearchProvider = ({
  llmConfig,
  setLlmConfig,
}: {
  llmConfig: LLMConfig;
  setLlmConfig: React.Dispatch<React.SetStateAction<LLMConfig>>;
}) => {
  const [showApiKey, setShowApiKey] = useState(false);
  const [openProviderSelect, setOpenProviderSelect] = useState(false);
  const isWebSearchEnabled = !!llmConfig.WEB_GROUNDING;

  const update = useCallback(
    (field: keyof LLMConfig, value: string | boolean) => {
      setLlmConfig((current) => ({ ...current, [field]: value }));
    },
    [setLlmConfig]
  );

  const selectedRaw = String(llmConfig.WEB_SEARCH_PROVIDER || "").toLowerCase();
  const selected = WEB_SEARCH_PROVIDER_OPTIONS.some(
    (option) => option.value === selectedRaw
  )
    ? selectedRaw
    : "auto";
  const provider = WEB_SEARCH_PROVIDERS[selected] || WEB_SEARCH_PROVIDERS.auto;

  useEffect(() => {
    if (selectedRaw !== selected) {
      update("WEB_SEARCH_PROVIDER", selected);
    }
  }, [selected, selectedRaw, update]);

  const getValue = (field?: string) =>
    field ? String(llmConfig[field as keyof LLMConfig] || "") : "";

  return (
    <div className="space-y-6 rounded-[12px] bg-[#F9F8F8] p-7">
      <div className="mb-4 rounded-[12px] bg-white p-10 pt-5">
        <div className="mb-6 flex justify-end">
          <Switch
            checked={isWebSearchEnabled}
            className="data-[state=checked]:bg-[#4791FF] data-[state=unchecked]:bg-gray-400"
            onCheckedChange={(checked) => update("WEB_GROUNDING", checked)}
          />
        </div>
        <div className="flex flex-col items-start justify-between gap-8 lg:flex-row lg:gap-10">
          <div className="max-w-[300px] shrink-0 pb-2 lg:pb-[20px]">
            <div className="flex h-[60px] w-[60px] items-center justify-center rounded-[4px] bg-[#F4F3FF]">
              <Search className="h-7 w-7 text-[#5146E5]" />
            </div>
            <h3 className="py-2.5 text-xl font-normal text-[#191919]">
              Web Search Settings
            </h3>
            <p className="text-sm text-gray-500">
              Configure external search only when web search is enabled.
            </p>
          </div>
          <div className="w-full max-w-[360px] space-y-4">
            {!isWebSearchEnabled ? (
              <div className="rounded-lg border border-[#EDEEEF] bg-[#FAFAFA] p-4 text-sm text-[#4C5554]">
                Web search is currently disabled. Enable it to choose provider
                settings.
              </div>
            ) : (
              <>
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Provider
                  </label>
                  <Popover
                    open={openProviderSelect}
                    onOpenChange={setOpenProviderSelect}
                  >
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={openProviderSelect}
                        className="w-[205px] h-12 px-4 py-4 outline-none border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors hover:border-gray-400 justify-between"
                      >
                        <div className="flex gap-3 items-center">
                          <span className="text-sm font-medium text-gray-900">
                            {WEB_SEARCH_PROVIDER_OPTIONS.find(
                              (option) => option.value === selected
                            )?.label || "Select web search provider"}
                          </span>
                        </div>
                        <ChevronUp className="w-4 h-4 text-gray-500" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent
                      className="p-0"
                      align="start"
                      style={{ width: "300px" }}
                    >
                      <Command>
                        <CommandInput placeholder="Search provider..." />
                        <CommandList>
                          <CommandEmpty>No provider found.</CommandEmpty>
                          <CommandGroup>
                            {WEB_SEARCH_PROVIDER_OPTIONS.map((option) => (
                              <CommandItem
                                key={option.value}
                                value={option.value}
                                onSelect={(value) => {
                                  update("WEB_SEARCH_PROVIDER", value);
                                  setOpenProviderSelect(false);
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    selected === option.value
                                      ? "opacity-100"
                                      : "opacity-0"
                                  )}
                                />
                                <div className="flex gap-3 items-center">
                                  <div className="flex flex-col space-y-1 flex-1">
                                    <div className="flex items-center justify-between gap-2">
                                      <span className="text-sm font-medium text-gray-900 capitalize">
                                        {option.label}
                                      </span>
                                    </div>
                                    <span className="text-xs text-gray-600 leading-relaxed">
                                      {option.description}
                                    </span>
                                  </div>
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  <p className="mt-2 text-xs leading-relaxed text-gray-500">
                    {provider.description}
                  </p>
                </div>

                {selected === "auto" && (
                  <div className="rounded-lg border border-[#D9D6FE] bg-[#F4F3FF] p-3 text-xs text-[#5146E5]">
                    Model-native web grounding is preferred when available.
                    Otherwise, external search fallback is used.
                  </div>
                )}

                {provider.urlField && (
                  <div>
                    <label className="mb-2 block text-sm font-medium text-[#4C5554]">
                      {provider.urlLabel}
                    </label>
                    <input
                      type="url"
                      className="h-12 w-full rounded-lg border border-gray-300 px-4 text-sm text-[#191919] outline-none transition-colors focus:border-blue-500"
                      placeholder="https://search.example.com"
                      value={getValue(provider.urlField)}
                      onChange={(event) =>
                        update(
                          provider.urlField as keyof LLMConfig,
                          event.target.value
                        )
                      }
                    />
                  </div>
                )}

                {provider.apiKeyField && (
                  <div>
                    <label className="mb-2 block text-sm font-medium text-[#4C5554]">
                      {provider.apiKeyLabel}
                    </label>
                    <div className="relative">
                      <input
                        type={showApiKey ? "text" : "password"}
                        className="h-12 w-full rounded-lg border border-gray-300 px-4 pr-12 text-sm text-[#191919] outline-none transition-colors focus:border-blue-500"
                        value={getValue(provider.apiKeyField)}
                        onChange={(event) =>
                          update(
                            provider.apiKeyField as keyof LLMConfig,
                            event.target.value
                          )
                        }
                      />
                      <button
                        type="button"
                        className="absolute right-3 top-1/2 -translate-y-1/2"
                        onClick={() => setShowApiKey((value) => !value)}
                      >
                        {showApiKey ? (
                          <Eye className="h-4 w-4 text-gray-500" />
                        ) : (
                          <EyeOff className="h-4 w-4 text-gray-500" />
                        )}
                      </button>
                    </div>
                  </div>
                )}

                {selected !== "auto" && (
                  <div>
                    <label className="mb-2 block text-sm font-medium text-[#4C5554]">
                      Maximum results
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={10}
                      className="h-12 w-full rounded-lg border border-gray-300 px-4 text-sm text-[#191919] outline-none transition-colors focus:border-blue-500"
                      value={llmConfig.WEB_SEARCH_MAX_RESULTS || "5"}
                      onChange={(event) =>
                        update("WEB_SEARCH_MAX_RESULTS", event.target.value)
                      }
                    />
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default WebSearchProvider;
