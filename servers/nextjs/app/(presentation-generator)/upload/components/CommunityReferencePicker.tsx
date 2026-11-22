"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Check, ChevronDown, Eye, Heart, Loader2, RefreshCw, Search } from "lucide-react";

import SmartHtmlSlide from "../../components/SmartHtmlSlide";
import {
  CommunityPresentationApi,
  getCommunityErrorState,
  type CommunityErrorState,
  type CommunityPresentation,
  type CommunityPresentationListFilters,
} from "../../services/api/community";
import CommunityDesignPreviewDialog from "../../(dashboard)/community/components/CommunityDesignPreviewDialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { notify } from "@/components/ui/sonner";

export default function CommunityReferencePicker({
  selectedId,
  onSelect,
  onUsePrompt,
}: {
  selectedId: number | null;
  onSelect: (presentation: CommunityPresentation | null) => void;
  onUsePrompt: (prompt: string) => void;
}) {
  const [items, setItems] = useState<CommunityPresentation[]>([]);
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const [filters] = useState<CommunityPresentationListFilters>({});
  const [preview, setPreview] = useState<CommunityPresentation | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<CommunityErrorState | null>(null);
  const previewId = preview?.id;

  useEffect(() => {
    if (previewId === undefined) {
      setPreviewLoading(false);
      return;
    }

    let cancelled = false;
    setPreviewLoading(true);
    CommunityPresentationApi.getById(previewId)
      .then((presentation) => {
        if (!cancelled) setPreview(presentation);
      })
      .catch((previewError: unknown) => {
        if (cancelled) return;
        notify.error(
          "Could not load the complete preview",
          previewError instanceof Error ? previewError.message : undefined,
        );
      })
      .finally(() => {
        if (!cancelled) setPreviewLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [previewId]);

  const load = useCallback((signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    CommunityPresentationApi.list(1, 8, signal, filters)
      .then((response) => setItems(response.results ?? []))
      .catch((requestError) => {
        if ((requestError as Error)?.name !== "AbortError") {
          setItems([]);
          setError(
            getCommunityErrorState(
              requestError,
              "Could not load community designs. Please try again."
            )
          );
        }
      })
      .finally(() => {
        if (!signal?.aborted) setLoading(false);
      });
  }, [filters]);

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load]);

  useEffect(() => {
    const focusSearch = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k" && !document.querySelector("[role=dialog]")) {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", focusSearch);
    return () => window.removeEventListener("keydown", focusSearch);
  }, []);

  const visibleItems = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return items.slice(0, 4);
    return items.filter((item) =>
      [item.title, item.created_by, item.prompt]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalizedQuery)),
    ).slice(0, 4);
  }, [items, query]);

  return (
    <section className="w-full font-manrope" data-testid="design-grid">
      <CommunityDesignPreviewDialog presentation={preview} open={Boolean(preview)} loading={previewLoading} onOpenChange={(open) => { if (!open) setPreview(null); }} onUseDesign={(presentation) => { onSelect(presentation); setPreview(null); }} />
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <h2 className="shrink-0 text-base font-medium text-[#191919]">
          Community
        </h2>
        <div className="flex flex-wrap items-center gap-5">
          <label className="flex h-[38px] w-full items-center gap-2.5 rounded-md border border-[#EDEEEF] bg-white px-2.5 sm:w-[298px]">
            <Search className="h-4 w-4 shrink-0 text-[#808080]" strokeWidth={1.75} />
            <span className="sr-only">Search designs</span>
            <input ref={searchRef} type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by title or keyword" className="min-w-0 flex-1 bg-transparent font-syne text-base font-normal text-[#191919] outline-none placeholder:text-[#808080]" />
            <kbd className="hidden shrink-0 font-manrope text-[10px] text-[#CCCCCC] sm:block" aria-label="Command or Control K">⌘K</kbd>
          </label>
          <Link href="/community" className="inline-flex items-center gap-1.5 whitespace-nowrap font-syne text-xs text-[#7A5AF8] hover:underline">Browse All <ArrowUpRight className="h-3.5 w-3.5" /></Link>
          {selectedId !== null && <button type="button" onClick={() => onSelect(null)} className="text-xs text-[#7A5AF8] hover:underline">Clear selection</button>}
        </div>
      </div>

      {loading ? (
        <div className="flex h-52 items-center justify-center text-[#7A5AF8]">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : error ? (
        <div
          role="alert"
          className="mx-auto mt-5 flex min-h-40 w-full flex-col items-center justify-center rounded-xl border border-red-200 bg-red-50/40 px-6 py-8 text-center"
        >
          <h3 className="text-sm font-semibold text-[#191919]">
            Could not load community designs
          </h3>
          <p className="mt-2 max-w-lg text-xs leading-5 text-[#666666]">
            {error.message}
          </p>
          {error.retryable && (
            <button
              type="button"
              onClick={() => load()}
              className="mt-4 inline-flex items-center gap-2 rounded-full border border-[#E0DDFC] bg-white px-4 py-2 text-xs font-medium text-[#6847F4] transition hover:bg-[#F8F7FF]"
            >
              <RefreshCw className="h-4 w-4" /> Try again
            </button>
          )}
        </div>
      ) : visibleItems.length === 0 ? (
        <div className="mx-0 mt-5 rounded-xl border border-dashed border-[#D9D9DE] bg-[#FAFAFC] px-6 py-10 text-center">
          <Search className="mx-auto h-5 w-5 text-[#808080]" />
          <h3 className="mt-3 text-sm font-semibold text-[#191919]">
            No matching designs
          </h3>
        </div>
      ) : (
        <div className="mt-5 grid grid-cols-1 gap-[18px] sm:grid-cols-2 lg:grid-cols-4">
          {visibleItems.map((item) => {
            const selected = selectedId === item.id;
            const preview = item.slides?.find((slide) => slide.trim());
            return (
              <article
                key={item.id}
                className={`motion-card min-w-0 overflow-hidden rounded-xl border bg-white ${
                  selected
                    ? "border-[#7A5AF8] ring-2 ring-[#7A5AF8]/15"
                    : "border-[#EDEEEF] hover:border-[#D8D3FA]"
                }`}
              >
                <button
                  type="button"
                  onClick={() => setPreview(item)}
                  className="group relative block aspect-[306/169] w-full overflow-hidden bg-[#F8FBFB]"
                  aria-label={`Preview ${item.title || "community design"}`}
                >
                  {preview ? (
                    <SmartHtmlSlide
                      showLoader
                      executeScripts={false}
                      html={preview}
                      fonts={item.fonts}
                    />
                  ) : (
                    <span className="flex h-full items-center justify-center text-xs text-[#999999]">
                      No preview
                    </span>
                  )}
                  <span className="absolute inset-0 bg-black/0 transition group-hover:bg-black/5" />
                </button>

                <div className="border-t border-[#EDEEEF] px-2.5 pb-2.5">
                  <div className="flex min-h-[54px] items-center gap-1.5 py-3.5">
                    <p className="min-w-0 flex-1 truncate text-sm font-semibold text-[#191919]">
                      {item.title?.trim() || "Untitled presentation"}
                    </p>
                    <button type="button" onClick={() => setPreview(item)} aria-label={`Preview ${item.title || "community design"}`} className="flex h-[26px] w-[42px] shrink-0 items-center justify-center rounded-full border border-[#EDEEEF] hover:bg-[#F6F6F9]"><Eye className="h-3.5 w-3.5" /></button>
                    <div className="flex h-[26px] shrink-0 items-center rounded-full border border-[#EDEEEF] bg-white">
                      <button type="button" aria-pressed={selected} onClick={() => onSelect(selected ? null : item)} className="flex items-center gap-1 rounded-l-full px-3 font-syne text-xs hover:bg-[#F6F6F9]">{selected && <Check className="h-3 w-3 text-[#7A5AF8]" />}{selected ? "Selected" : "Use"}</button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild><button type="button" aria-label={`Use options for ${item.title || "community design"}`} className="flex h-6 w-6 items-center justify-center rounded-r-full border-l border-[#EDEEEF] hover:bg-[#F6F6F9]"><ChevronDown className="h-3.5 w-3.5" /></button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end"><DropdownMenuItem onSelect={() => onSelect(item)}>Use design</DropdownMenuItem><DropdownMenuItem disabled={!item.prompt?.trim()} onSelect={() => onUsePrompt(item.prompt || "")}>Use prompt</DropdownMenuItem></DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                  <div className="flex min-h-[34px] items-center justify-between border-t border-[#EDEEEF] py-2.5 text-[10px] font-medium tracking-[0.4px] text-[#808080]">
                    <span className="min-w-0 flex-1 truncate">
                      by {item.created_by?.trim() || "Presenton"}
                    </span>
                    <div className="ml-2 flex shrink-0 items-center gap-2">
                      <span className="inline-flex items-center gap-1">
                        <Heart className="h-3.5 w-3.5" /> {formatCount(item.likes ?? 0)}
                      </span>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

function formatCount(value: number) {
  return Intl.NumberFormat("en", { notation: "compact" }).format(value);
}
