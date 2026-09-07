"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Eye, Heart, Loader2, RefreshCw, Search } from "lucide-react";

import SmartHtmlSlide from "../../components/SmartHtmlSlide";
import {
  CommunityPresentationApi,
  type CommunityPresentation,
  type CommunityPresentationListFilters,
} from "../../services/api/community";
import CommunityPresentationFilters from "./CommunityPresentationFilters";

export default function CommunityReferencePicker({
  selectedId,
  onSelect,
}: {
  selectedId: number | null;
  onSelect: (presentation: CommunityPresentation | null) => void;
}) {
  const [items, setItems] = useState<CommunityPresentation[]>([]);
  const [query, setQuery] = useState("");
  const [filters, setFilters] =
    useState<CommunityPresentationListFilters>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback((signal?: AbortSignal) => {
    setLoading(true);
    setError(false);
    CommunityPresentationApi.list(1, 8, signal, filters)
      .then((response) => setItems(response.results ?? []))
      .catch((requestError) => {
        if ((requestError as Error)?.name !== "AbortError") setError(true);
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

  const visibleItems = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return items;
    return items.filter((item) =>
      [item.title, item.created_by, item.prompt]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalizedQuery)),
    );
  }, [items, query]);

  return (
    <section className="w-full font-manrope" data-testid="design-grid">
      <div className="flex flex-col gap-3 px-0 sm:px-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="font-syne text-base font-semibold text-[#191919]">
            Community
          </h2>
          <p className="mt-1 text-xs text-[#808080]">
            Choose an optional design reference for Smart mode.
          </p>
        </div>

        <div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end lg:w-auto">
          <label className="flex h-10 w-full items-center gap-2.5 rounded-full border border-[#DBDBDB99] bg-white px-2.5 sm:w-[220px]">
            <Search className="h-4 w-4 shrink-0 text-[#808080]" strokeWidth={1.75} />
            <span className="sr-only">Search designs</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search ..."
              className="min-w-0 flex-1 bg-transparent font-syne text-base font-normal text-[#191919] outline-none placeholder:text-[#808080]"
            />
          </label>
          <CommunityPresentationFilters
            value={filters}
            onChange={setFilters}
            disabled={loading}
          />
          {selectedId !== null && (
            <button
              type="button"
              onClick={() => onSelect(null)}
              className="whitespace-nowrap text-xs font-medium text-[#2563EB] hover:text-[#1D4ED8]"
            >
              Clear selection
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex h-52 items-center justify-center text-[#2563EB]">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : error ? (
        <button
          type="button"
          onClick={() => load()}
          className="mx-auto mt-5 flex h-40 w-[calc(100%-3rem)] items-center justify-center gap-2 rounded-xl border border-dashed border-[#D9D9DE] text-xs text-[#2563EB]"
        >
          <RefreshCw className="h-4 w-4" /> Retry community designs
        </button>
      ) : visibleItems.length === 0 ? (
        <div className="mx-0 mt-5 rounded-xl border border-dashed border-[#D9D9DE] bg-[#FAFAFC] px-6 py-10 text-center sm:mx-6">
          <Search className="mx-auto h-5 w-5 text-[#808080]" />
          <h3 className="mt-3 text-sm font-semibold text-[#191919]">
            No matching designs
          </h3>
        </div>
      ) : (
        <div className="mt-5 grid grid-cols-1 gap-[18px] px-0 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
          {visibleItems.map((item) => {
            const selected = selectedId === item.id;
            const preview = item.slides?.find((slide) => slide.trim());
            return (
              <article
                key={item.id}
                className={`min-w-0 overflow-hidden rounded-xl border bg-white transition ${
                  selected
                    ? "border-[#2563EB] ring-2 ring-[#2563EB]/15"
                    : "border-[#EDEEEF] hover:border-[#D8D3FA]"
                }`}
              >
                <button
                  type="button"
                  onClick={() => onSelect(selected ? null : item)}
                  className="group relative block aspect-[306/169] w-full overflow-hidden bg-[#F8FBFB]"
                  aria-label={`Use ${item.title || "community design"}`}
                >
                  {preview ? (
                    <SmartHtmlSlide
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
                  <div className="flex min-h-[54px] items-center gap-2.5 py-3.5">
                    <p className="min-w-0 flex-1 truncate text-sm font-semibold text-[#191919]">
                      {item.title?.trim() || "Untitled presentation"}
                    </p>
                    <button
                      type="button"
                      onClick={() => onSelect(selected ? null : item)}
                      className="flex h-[26px] items-center gap-1.5 rounded-full border border-[#EDEEEF] bg-white px-3 font-syne text-xs font-medium text-[#191919] hover:bg-[#F6F6F9]"
                    >
                      {selected && <Check className="h-3.5 w-3.5 text-[#2563EB]" />}
                      {selected ? "Selected" : "Use"}
                    </button>
                  </div>
                  <div className="flex min-h-[34px] items-center justify-between border-t border-[#EDEEEF] py-2.5 text-[10px] font-medium tracking-[0.4px] text-[#808080]">
                    <span className="min-w-0 flex-1 truncate">
                      by {item.created_by?.trim() || "Yarex"}
                    </span>
                    <div className="ml-2 flex shrink-0 items-center gap-2">
                      <span className="inline-flex items-center gap-1">
                        <Eye className="h-3.5 w-3.5" /> {formatCount(item.views ?? 0)}
                      </span>
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
