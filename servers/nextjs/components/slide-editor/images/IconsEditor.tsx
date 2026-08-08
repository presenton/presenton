/* eslint-disable @next/next/no-img-element */
"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronRight, Info, Loader2, Search, X } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import type { RootState } from "@/store/store";
import { setPresentationData } from "@/store/slices/presentationGeneration";
import { useDispatch, useSelector } from "react-redux";
import { PresentationGenerationApi } from "@/app/(presentation-generator)/services/api/presentation-generation";
import { notify } from "@/components/ui/sonner";

const ICON_WEIGHTS = [
  "thin",
  "light",
  "regular",
  "bold",
  "fill",
  "duotone",
] as const;

type IconWeight = (typeof ICON_WEIGHTS)[number];

const DEFAULT_ICON_WEIGHT: IconWeight = "regular";
const ICON_WEIGHT_PATTERN = ICON_WEIGHTS.join("|");
const ICON_SEARCH_DEBOUNCE_MS = 500;

const ICON_WEIGHT_LABELS: Record<IconWeight, string> = {
  thin: "Thin",
  light: "Light",
  regular: "Regular",
  bold: "Bold",
  fill: "Fill",
  duotone: "Duotone",
};

const normalizeIconWeight = (weight?: string | null): IconWeight => {
  const normalized = (weight || "").trim().toLowerCase().replace(/_/g, "-");

  return ICON_WEIGHTS.includes(normalized as IconWeight)
    ? (normalized as IconWeight)
    : DEFAULT_ICON_WEIGHT;
};

const getIconWeightFromUrl = (url?: string | null) => {
  const match = (url || "").match(/\/static\/icons\/([^/]+)\//);
  return normalizeIconWeight(match?.[1]);
};

const replaceIconWeightInUrl = (
  url: string | null | undefined,
  weight: string
) => {
  if (!url) return "";

  const normalizedWeight = normalizeIconWeight(weight);
  const iconPathPattern = new RegExp(
    `(/static/icons/)([^/]+)/([^/?#]+?)(?:-(${ICON_WEIGHT_PATTERN}))?(\\.(?:svg|png))([?#].*)?$`,
    "i"
  );

  return url.replace(
    iconPathPattern,
    (_match, prefix, _folder, iconName, _suffix, extension, trailing = "") =>
      `${prefix}${normalizedWeight}/${iconName}${
        normalizedWeight === "regular" ? "" : `-${normalizedWeight}`
      }${extension}${trailing}`
  );
};

const clonePresentationData = <T,>(value: T): T => {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }

  return JSON.parse(JSON.stringify(value));
};

const applyIconWeightToValue = <T,>(value: T, weight: IconWeight): T => {
  if (typeof value === "string") {
    return (value.includes("/static/icons/")
      ? replaceIconWeightInUrl(value, weight)
      : value) as T;
  }

  if (Array.isArray(value)) {
    return value.map((item) => applyIconWeightToValue(item, weight)) as T;
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    Object.keys(record).forEach((key) => {
      record[key] = applyIconWeightToValue(record[key], weight);
    });
  }

  return value;
};

const useDebouncedValue = <T,>(value: T, delay: number) => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => window.clearTimeout(timeoutId);
  }, [delay, value]);

  return debouncedValue;
};

interface IconsEditorProps {
  icon_prompt?: string[] | null;
  currentIconUrl?: string;
  onClose?: () => void;
  onIconChange?: (newIconUrl: string, query?: string) => void;
}

const IconsEditor = ({
  icon_prompt,
  currentIconUrl,
  onClose,
  onIconChange,
}: IconsEditorProps) => {
  const dispatch = useDispatch();
  const presentationData = useSelector(
    (state: RootState) => state.presentationGeneration.presentationData
  );
  const requestIdRef = useRef(0);

  const [icons, setIcons] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>(
    icon_prompt?.[0] || ""
  );
  const [loading, setLoading] = useState(true);
  const [selectedWeight, setSelectedWeight] = useState<IconWeight>(
    normalizeIconWeight(getIconWeightFromUrl(currentIconUrl))
  );
  const [selectedIconUrl, setSelectedIconUrl] = useState(currentIconUrl || "");
  const [applyStylesToPresentation, setApplyStylesToPresentation] =
    useState(false);

  const activeQuery = useMemo(
    () => searchQuery.trim() || icon_prompt?.[0] || "",
    [icon_prompt, searchQuery]
  );
  const debouncedActiveQuery = useDebouncedValue(
    activeQuery,
    ICON_SEARCH_DEBOUNCE_MS
  );

  const previewIconSource = selectedIconUrl || currentIconUrl || icons[0] || "";

  const handleIconSearch = useCallback(
    async (weightOverride?: IconWeight, queryOverride?: string) => {
      const query = (queryOverride || "").trim();
      const weight = normalizeIconWeight(weightOverride || selectedWeight);
      const requestId = requestIdRef.current + 1;

      requestIdRef.current = requestId;

      if (!query) {
        setIcons([]);
        setLoading(false);
        return;
      }

      setLoading(true);

      try {
        const data = await PresentationGenerationApi.searchIcons({
          query,
          limit: 40,
          icon_weight: weight,
        });

        if (requestIdRef.current === requestId) {
          const nextIcons = Array.isArray(data) ? data : [];
          setIcons(nextIcons);
          setSelectedIconUrl(
            (previousIcon) =>
              previousIcon || currentIconUrl || nextIcons[0] || ""
          );
        }
      } catch (error: unknown) {
        if (requestIdRef.current === requestId) {
          console.error("Error fetching icons:", error);
          notify.error(
            "Could not load icons",
            error instanceof Error
              ? error.message
              : "Failed to fetch icons. Please try again."
          );
          setIcons([]);
        }
      } finally {
        if (requestIdRef.current === requestId) {
          setLoading(false);
        }
      }
    },
    [currentIconUrl, selectedWeight]
  );

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void handleIconSearch(selectedWeight, debouncedActiveQuery);
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [debouncedActiveQuery, handleIconSearch, selectedWeight]);

  const handleWeightSelect = (weight: IconWeight) => {
    setSelectedWeight(weight);
    setSelectedIconUrl((previousIcon) => {
      const sourceIcon = previousIcon || currentIconUrl || "";
      return sourceIcon ? replaceIconWeightInUrl(sourceIcon, weight) : "";
    });
  };

  const handleReplaceIcons = () => {
    const replacementIcon = replaceIconWeightInUrl(
      selectedIconUrl || currentIconUrl,
      selectedWeight
    );

    if (!replacementIcon) {
      notify.warning("Icon required", "Select an icon before replacing.");
      return;
    }

    if (applyStylesToPresentation && presentationData) {
      const nextPresentationData = clonePresentationData(presentationData);
      dispatch(
        setPresentationData(
          applyIconWeightToValue(nextPresentationData, selectedWeight)
        )
      );
    }

    onIconChange?.(replacementIcon, activeQuery);
    onClose?.();
  };

  return (
    <DialogPrimitive.Root
      open
      onOpenChange={(open) => {
        if (!open) {
          onClose?.();
        }
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[10050] bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          data-template-v2-floating-toolbar="true"
          data-inline-edit-ignore="true"
          className="fixed left-1/2 top-1/2 z-[10051] h-[calc(100dvh-24px)] w-[calc(100vw-24px)] -translate-x-1/2 -translate-y-1/2 font-syne text-[#191919] outline-none sm:h-[min(70vh,650px)] sm:min-h-[500px] sm:w-[min(calc(100vw-160px),977px)]"
          onPointerDown={(event) => event.stopPropagation()}
        >
          <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-[20px] bg-white shadow-[0_28px_80px_rgba(0,0,0,0.34)]">
            <header className="flex h-[85px] flex-none items-center border-b border-[#EDEEEF] bg-white px-6 shadow-[0_4px_7px_rgba(0,0,0,0.04)]">
              <div>
                <DialogPrimitive.Title className="text-[18px] font-normal leading-normal">
                  Change Icon
                </DialogPrimitive.Title>
                <DialogPrimitive.Description className="mt-0.5 text-[14px] font-normal tracking-[-0.42px] text-[#808080]">
                  Find a similar icon and customize its visual weight.
                </DialogPrimitive.Description>
              </div>
            </header>

            <div className="flex min-h-0 flex-1 flex-col sm:flex-row">
              <aside className="flex max-h-[270px] flex-none flex-col overflow-y-auto border-b border-[#EDEEEF] bg-[#F9FAFB] p-4 sm:max-h-none sm:w-[270px] sm:border-b-0 sm:border-r sm:p-5">
                <div className="flex items-center gap-4 sm:block">
                  <div>
                    <p className="mb-2 text-[12px] font-medium text-[#666]">
                      Selected icon
                    </p>
                    <div className="flex size-[78px] items-center justify-center rounded-[14px] border border-[#E1E1E5] bg-white shadow-[0_4px_12px_rgba(0,0,0,0.04)]">
                      {previewIconSource ? (
                        <img
                          src={replaceIconWeightInUrl(
                            previewIconSource,
                            selectedWeight
                          )}
                          alt=""
                          draggable={false}
                          className="size-10 object-contain"
                        />
                      ) : (
                        <Search className="size-6 text-[#B7B8BE]" />
                      )}
                    </div>
                  </div>

                  <div className="min-w-0 flex-1 sm:mt-5">
                    <div className="mb-2.5 flex items-center gap-1.5">
                      <p className="text-[12px] font-medium text-[#666]">
                        Icon weight
                      </p>
                      <span
                        role="img"
                        aria-label="Choose the visual weight used for icon search and replacement."
                        title="Choose the visual weight used for icon search and replacement."
                        className="inline-flex size-4 items-center justify-center text-[#A1A1AA]"
                      >
                        <Info className="size-3" />
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-2">
                      {ICON_WEIGHTS.map((weight) => {
                        const isSelected = selectedWeight === weight;
                        const previewIcon = previewIconSource
                          ? replaceIconWeightInUrl(previewIconSource, weight)
                          : "";

                        return (
                          <button
                            key={weight}
                            type="button"
                            aria-pressed={isSelected}
                            onClick={() => handleWeightSelect(weight)}
                            className={cn(
                              "relative flex h-[58px] min-w-0 flex-col items-center justify-center gap-1 rounded-[10px] border bg-white px-1 outline-none transition hover:bg-[#F4F4F4] focus-visible:ring-2 focus-visible:ring-[#D9D6FE]",
                              isSelected
                                ? "border-[#B9A8FA] bg-[#F4F3FF]"
                                : "border-[#E1E1E5]"
                            )}
                          >
                            {previewIcon ? (
                              <img
                                src={previewIcon}
                                alt=""
                                draggable={false}
                                className="size-5 object-contain"
                              />
                            ) : (
                              <span className="size-4 rounded-full border border-[#191919]" />
                            )}
                            <span
                              className={cn(
                                "max-w-full truncate text-[10px]",
                                isSelected
                                  ? "text-[#6941C6]"
                                  : "text-[#666]"
                              )}
                            >
                              {ICON_WEIGHT_LABELS[weight]}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between gap-3 border-t border-[#E1E1E5] pt-4">
                  <div>
                    <p className="text-[12px] font-medium text-[#191919]">
                      Apply to presentation
                    </p>
                    <p className="mt-0.5 text-[10px] leading-4 text-[#808080]">
                      Use this weight for every icon.
                    </p>
                  </div>
                  <Switch
                    aria-label="Apply icon weight to entire presentation"
                    checked={applyStylesToPresentation}
                    onCheckedChange={setApplyStylesToPresentation}
                    className="h-5 w-9 flex-none data-[state=checked]:bg-[#7C3AED] data-[state=unchecked]:bg-[#DDDEE3]"
                  />
                </div>
              </aside>

              <main className="flex min-h-0 min-w-0 flex-1 flex-col bg-white">
                <div className="flex-none px-4 pb-3 pt-4 sm:px-5">
                  <form
                    className="flex h-[41px] gap-2.5"
                    onSubmit={(event) => {
                      event.preventDefault();
                      handleIconSearch(selectedWeight, activeQuery);
                    }}
                  >
                    <label className="flex min-w-0 flex-1 items-center gap-2.5 rounded-[8px] border border-[rgba(219,219,219,0.6)] bg-white px-2.5">
                      <Search
                        className="size-3.5 flex-none"
                        strokeWidth={1.8}
                        aria-hidden="true"
                      />
                      <input
                        autoFocus
                        value={searchQuery}
                        onChange={(event) => setSearchQuery(event.target.value)}
                        placeholder="Search similar icons"
                        className="h-full min-w-0 flex-1 bg-transparent text-[14px] font-normal outline-none placeholder:text-[#999]"
                      />
                    </label>
                    <button
                      type="submit"
                      aria-label="Search icons"
                      disabled={!activeQuery || loading}
                      className="flex w-[104px] items-center justify-center gap-1.5 rounded-[38.4px] bg-[#EDEEEF] px-3 text-[12px] text-[#191919] transition hover:bg-[#E1E1E5] disabled:cursor-not-allowed disabled:text-[#999]"
                    >
                      {loading ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Search className="size-3.5" />
                      )}
                      Search
                    </button>
                  </form>
                </div>

                <div className="flex min-h-0 flex-1 flex-col px-4 sm:px-5">
                  <div className="mb-2 flex flex-none items-center justify-between">
                    <p className="text-[12px] font-medium text-[#666]">
                      Similar icons
                    </p>
                    {!loading && icons.length > 0 ? (
                      <p className="text-[11px] text-[#999]">
                        {icons.length} results
                      </p>
                    ) : null}
                  </div>

                  <div className="min-h-0 flex-1 overflow-y-auto pr-1 [scrollbar-width:thin]">
                    {loading ? (
                      <div className="grid gap-2.5 [grid-template-columns:repeat(auto-fill,minmax(64px,1fr))]">
                        {Array.from({ length: 24 }).map((_, index) => (
                          <Skeleton
                            key={index}
                            className="aspect-square w-full rounded-[10px]"
                          />
                        ))}
                      </div>
                    ) : icons.length > 0 ? (
                      <div className="grid gap-2.5 [grid-template-columns:repeat(auto-fill,minmax(64px,1fr))]">
                        {icons.map((iconSrc, index) => {
                          const isSelected = iconSrc === selectedIconUrl;

                          return (
                            <button
                              key={`${iconSrc}-${index}`}
                              type="button"
                              aria-label={`Select icon ${index + 1}`}
                              aria-pressed={isSelected}
                              onClick={() => setSelectedIconUrl(iconSrc)}
                              className={cn(
                                "group relative aspect-square min-w-0 overflow-hidden rounded-[10px] border bg-[#F9FAFB] p-4 outline-none transition hover:border-[#CACBD0] hover:bg-[#F4F4F4] focus-visible:ring-2 focus-visible:ring-[#191919]",
                                isSelected
                                  ? "border-[#8B75E8] bg-[#F4F3FF] ring-1 ring-[#8B75E8]"
                                  : "border-[#EDEEEF]"
                              )}
                            >
                              <img
                                src={iconSrc}
                                alt=""
                                draggable={false}
                                className="size-full object-contain transition-transform duration-200 group-hover:scale-105"
                              />
                              {isSelected ? (
                                <span className="absolute right-1.5 top-1.5 flex size-4 items-center justify-center rounded-full bg-[#6941C6] text-white">
                                  <Check
                                    className="size-2.5"
                                    strokeWidth={2.5}
                                    aria-hidden="true"
                                  />
                                </span>
                              ) : null}
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="flex h-full min-h-[220px] items-center justify-center rounded-[14px] border border-dashed border-[#E1E1E5] bg-[#F9FAFB] px-6 text-center">
                        <div>
                          <Search className="mx-auto mb-3 size-7 text-[#B7B8BE]" />
                          <p className="text-[13px] font-medium text-[#666]">
                            No icons found
                          </p>
                          <p className="mt-1 text-[12px] text-[#808080]">
                            Try a different search term.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <footer className="mt-3 flex h-[66px] flex-none items-center justify-between gap-3 border-t border-[#EDEEEF] px-4 sm:px-5">
                  <p className="hidden text-[11px] leading-4 text-[#808080] sm:block">
                    {applyStylesToPresentation
                      ? "The selected weight will be applied to every icon."
                      : "Only the selected icon will be replaced."}
                  </p>
                  <button
                    type="button"
                    onClick={handleReplaceIcons}
                    disabled={!selectedIconUrl && !currentIconUrl}
                    style={{
                      background:
                        "linear-gradient(270deg, #D5CAFC 2.4%, #E3D2EB 27.88%, #F4DCD3 69.23%, #FDE4C2 100%)",
                    }}
                    className="ml-auto flex h-10 items-center justify-center gap-1.5 rounded-full px-5 text-[13px] font-semibold text-[#101323] shadow-none transition hover:brightness-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Replace icon
                    <ChevronRight className="size-4" aria-hidden="true" />
                  </button>
                </footer>
              </main>
            </div>
          </div>

          <DialogPrimitive.Close
            aria-label="Close icon editor"
            className="absolute right-3 top-3 flex size-11 items-center justify-center rounded-full bg-white text-[#191919] shadow-sm transition hover:bg-[#F6F6F9] sm:-right-[68px] sm:top-0 sm:size-[52px]"
          >
            <X className="size-5" strokeWidth={1.5} aria-hidden="true" />
          </DialogPrimitive.Close>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
};

export default IconsEditor;
