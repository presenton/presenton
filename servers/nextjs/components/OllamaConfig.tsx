"use client";
import { useState, useEffect } from "react";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { Button } from "./ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "./ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { cn } from "@/lib/utils";
import { Switch } from "./ui/switch";
import { toast } from "sonner";
import { getApiUrl } from "@/utils/api";

interface OllamaModel {
  label: string;
  value: string;
  size: string;
}

interface OllamaConfigProps {
  ollamaModel: string;
  ollamaUrl: string;
  useCustomUrl: boolean;
  onInputChange: (value: string | boolean, field: string) => void;
}

export default function OllamaConfig({
  ollamaModel,
  ollamaUrl,
  useCustomUrl,
  onInputChange,
}: OllamaConfigProps) {
  const [ollamaModels, setOllamaModels] = useState<OllamaModel[]>([]);
  const [ollamaModelsLoading, setOllamaModelsLoading] = useState(false);
  const [openModelSelect, setOpenModelSelect] = useState(false);

  const fetchOllamaModels = async () => {
    try {
      setOllamaModelsLoading(true);
      const response = await fetch(getApiUrl("/api/v1/ppt/ollama/models/supported"));

      if (response.ok) {
        const data = await response.json();
        console.log(data);
        setOllamaModels(data);
      } else {
        console.error('Failed to fetch Ollama models');
        setOllamaModels([]);
        toast.error('Failed to fetch Ollama models');
      }
    } catch (error) {
      console.error('Error fetching Ollama models:', error);
      toast.error('Error fetching Ollama models');
      setOllamaModels([]);
    } finally {
      setOllamaModelsLoading(false);
    }
  };

  useEffect(() => {
    fetchOllamaModels();
  }, []);

  return (
    <div className="space-y-6">
      {/* URL Configuration */}
      <div>
        <div className="flex items-center justify-between mb-4 bg-green-50 p-2 rounded-sm">
          <label className="text-sm font-medium text-gray-700">
            Use custom Ollama URL
          </label>
          <Switch
            checked={useCustomUrl}
            onCheckedChange={(checked) => onInputChange(checked, "use_custom_url")}
          />
        </div>
        {useCustomUrl && (
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Ollama URL
            </label>
            <div className="relative">
              <input
                type="text"
                required
                placeholder="Enter your Ollama URL"
                className="w-full px-4 py-2.5 outline-none border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
                value={ollamaUrl}
                onChange={(e) => onInputChange(e.target.value, "ollama_url")}
              />
            </div>
            <p className="mt-2 text-sm text-gray-500 flex items-center gap-2">
              <span className="block w-1 h-1 rounded-full bg-gray-400"></span>
              Change this if you are using a custom Ollama instance
            </p>
          </div>
        )}
      </div>

      {/* Model Selection */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-3">
          Choose a supported model
        </label>
        <div className="w-full">
          {ollamaModelsLoading ? (
            <div className="w-full h-12 px-4 py-4 border border-gray-300 rounded-lg bg-gray-50 flex items-center justify-center">
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-gray-500" />
                <span className="text-sm text-gray-600">Loading models...</span>
              </div>
            </div>
          ) : ollamaModels && ollamaModels.length > 0 ? (
            <Popover
              open={openModelSelect}
              onOpenChange={setOpenModelSelect}
            >
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={openModelSelect}
                  className="w-full h-12 px-4 py-4 outline-none border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors hover:border-gray-400 justify-between"
                >
                  <div className="flex gap-3 items-center">
                    <span className="text-sm font-medium text-gray-900">
                      {ollamaModel
                        ? ollamaModels?.find(
                          (m) => m.value === ollamaModel
                        )?.label || ollamaModel
                        : "Select a model"}
                    </span>
                    {ollamaModel && (
                      <span className="text-xs text-gray-500 bg-gray-100 rounded-full px-2 py-1">
                        {
                          ollamaModels?.find(
                            (m) => m.value === ollamaModel
                          )?.size
                        }
                      </span>
                    )}
                  </div>
                  <ChevronsUpDown className="w-4 h-4 text-gray-500" />
                </Button>
              </PopoverTrigger>
              <PopoverContent
                className="p-0"
                align="start"
                style={{ width: "var(--radix-popover-trigger-width)" }}
              >
                <Command>
                  <CommandInput placeholder="Search model..." />
                  <CommandList>
                    <CommandEmpty>No model found.</CommandEmpty>
                    <CommandGroup>
                      {ollamaModels?.map((model, index) => (
                        <CommandItem
                          key={index}
                          value={model.value}
                          onSelect={(value) => {
                            onInputChange(value, "ollama_model");
                            setOpenModelSelect(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              ollamaModel === model.value
                                ? "opacity-100"
                                : "opacity-0"
                            )}
                          />
                          <div className="flex gap-3 items-center">
                            <div className="flex flex-col space-y-1 flex-1">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-sm font-medium text-gray-900 capitalize">
                                  {model.label}
                                </span>
                                <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                                  {model.size}
                                </span>
                              </div>
                            </div>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          ) : (
            <div className="w-full border border-gray-300 rounded-lg p-4">
              <div className="flex items-center space-x-3">
                <div className="w-4 h-4 bg-gray-200 rounded-full animate-pulse"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
                  <div className="h-3 bg-gray-200 rounded w-3/4 animate-pulse"></div>
                </div>
              </div>
            </div>
          )}
        </div>
        {(!ollamaModels || ollamaModels.length === 0) && !ollamaModelsLoading && (
          <p className="mt-2 text-sm text-gray-500">
            No models available. Please check your Ollama connection.
          </p>
        )}
      </div>
    </div>
  );
} 