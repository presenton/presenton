"use client";

import React, { useCallback, useState } from "react";
import { Check, ChevronUp, Eye, EyeOff, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";

import { LLMConfig } from "@/types/llm_config";
import { WEB_SEARCH_PROVIDERS } from "@/utils/providerConstants";
import { MixpanelEvent, trackEvent } from "@/utils/mixpanel";

const EXTERNAL_WEB_SEARCH_OPTIONS = [
  "exa",
  "tavily",
  "brave",
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
    : "";
  const provider = selected ? WEB_SEARCH_PROVIDERS[selected] : undefined;

  const getValue = (field?: string) =>
    field ? String(llmConfig[field as keyof LLMConfig] || "") : "";

  return (
    <div className="space-y-6 rounded-[12px] bg-[#F9F8F8] p-7">
      <div className="mb-4 rounded-[12px] bg-white p-10 pt-5">
        <div className="mb-6 flex justify-end">
          <Switch
            checked={isWebSearchEnabled}
            className="data-[state=checked]:bg-[#4791FF] data-[state=unchecked]:bg-gray-400"
            onCheckedChange={(checked) => {
              trackEvent(MixpanelEvent.Settings_Provider_Selected, {
                section: "web_search_provider",
                enabled: checked,
                provider: checked ? selected : "disabled",
              });
              update("WEB_GROUNDING", checked);
            }}
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
              Choose a provider to enable web search, or leave it disabled.
            </p>
          </div>
          {isWebSearchEnabled && <div className="w-full max-w-[720px] space-y-4">
                <div className="ml-auto w-[222px]">
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Provider
                  </label>
                  <div className="w-full">
                    <Popover open={openProviderSelect} onOpenChange={setOpenProviderSelect}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={openProviderSelect}
                          className="h-12 w-[222px] justify-between rounded-lg border border-gray-300 px-4 py-4 outline-none transition-colors hover:border-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                        >
                          <span className="truncate text-sm font-medium text-gray-900">
                            {selected
                              ? WEB_SEARCH_PROVIDERS[selected]?.label || selected
                              : "Select web search provider"}
                          </span>
                          <ChevronUp className="h-4 w-4 text-gray-500" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="p-0" align="start" style={{ width: "320px" }}>
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
                                    trackEvent(MixpanelEvent.Settings_Provider_Selected, {
                                      section: "web_search_provider",
                                      provider: value,
                                    });
                                    update("WEB_GROUNDING", true);
                                    update("WEB_SEARCH_PROVIDER", value);
                                    setOpenProviderSelect(false);
                                  }}
                                >
                                  <Check
                                    className={
                                      selected === option.value
                                        ? "mr-2 h-4 w-4 opacity-100"
                                        : "mr-2 h-4 w-4 opacity-0"
                                    }
                                  />
                                  <div className="flex flex-1 flex-col space-y-1">
                                    <span className="text-sm font-medium text-gray-900">
                                      {option.label}
                                    </span>
                                    <span className="text-xs leading-relaxed text-gray-600">
                                      {option.description}
                                    </span>
                                  </div>
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>

                {selected === "auto" && (
                  <div className="rounded-lg border border-[#D9D6FE] bg-[#F4F3FF] p-3 text-xs text-[#5146E5]">
                    Model-native web grounding is preferred when available.
                    Otherwise, external search fallback is used.
                  </div>
                )}

                {provider?.urlField && (
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

                {provider?.apiKeyField && (
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

                {selected && selected !== "auto" && (
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
          </div>}
        </div>
      </div>
    </div>
  );
};

export default WebSearchProvider;
