"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Eye,
  FileText,
  Heart,
  Plus,
  Search,
} from "lucide-react";

import SmartHtmlSlide from "@/app/(presentation-generator)/components/SmartHtmlSlide";
import {
  CommunityPresentationApi,
  getCommunityPresentationAuthor,
  getCommunityPresentationTitle,
  type CommunityPresentation,
  type CommunityPresentationListFilters,
} from "@/app/(presentation-generator)/services/api/community";
import CommunityPresentationFilters from "@/app/(presentation-generator)/upload/components/CommunityPresentationFilters";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { notify } from "@/components/ui/sonner";
import { sanitizeAnalyticsError } from "@/utils/analytics";
import { MixpanelEvent, trackEvent } from "@/utils/mixpanel";
import CommunityDesignPreviewDialog from "./CommunityDesignPreviewDialog";

const PAGE_SIZE = 20;

const getFilterAnalyticsProps = (
  filters: CommunityPresentationListFilters
) => {
  const activeFilters = Object.entries(filters).filter(([key, value]) => {
    if (key === "order" || key === "order_by") return false;
    if (Array.isArray(value)) return value.length > 0;
    return value !== undefined && value !== null && value !== "";
  });

  return {
    active_filter_count: activeFilters.length,
    active_filter_names: activeFilters.map(([key]) => key).sort().join(","),
    sort_by: filters.order_by ?? "",
    sort_order: filters.order ?? "",
  };
};

export default function CommunityPage() {
  const router = useRouter();
  const pathname = usePathname();
  const [query, setQuery] = useState("");
  const [filters, setFilters] =
    useState<CommunityPresentationListFilters>({});
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [presentations, setPresentations] = useState<
    CommunityPresentation[]
  >([]);
  const [preview, setPreview] = useState<CommunityPresentation | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryVersion, setRetryVersion] = useState(0);

  useEffect(() => {
    trackEvent(MixpanelEvent.Community_Page_Viewed, { pathname });
  }, [pathname]);

  useEffect(() => {
    const controller = new AbortController();

    const loadPresentations = async () => {
      const loadStartedAt = Date.now();
      try {
        setLoading(true);
        setError(null);
        const response = await CommunityPresentationApi.list(
          page,
          PAGE_SIZE,
          controller.signal,
          filters
        );
        if (controller.signal.aborted) return;
        setPresentations(response.results ?? []);
        setTotalPages(response.total_pages ?? 0);
        trackEvent(MixpanelEvent.Community_Presentations_Loaded, {
          pathname,
          page,
          page_size: PAGE_SIZE,
          result_count: response.results?.length ?? 0,
          total_pages: response.total_pages ?? 0,
          duration_ms: Date.now() - loadStartedAt,
          ...getFilterAnalyticsProps(filters),
        });
      } catch (loadError) {
        if (controller.signal.aborted) return;
        setPresentations([]);
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Failed to load community presentations"
        );
        trackEvent(MixpanelEvent.Community_Presentations_Load_Failed, {
          pathname,
          page,
          duration_ms: Date.now() - loadStartedAt,
          error_message: sanitizeAnalyticsError(
            loadError,
            "Failed to load community presentations"
          ),
          ...getFilterAnalyticsProps(filters),
        });
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };

    void loadPresentations();
    return () => controller.abort();
  }, [filters, page, pathname, retryVersion]);

  const filteredPresentations = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    if (!normalizedQuery) return presentations;
    return presentations.filter((presentation) =>
      [
        presentation.title,
        presentation.description,
        presentation.prompt,
        presentation.created_by,
      ]
        .filter((value): value is string => Boolean(value))
        .some((value) => value.toLocaleLowerCase().includes(normalizedQuery))
    );
  }, [presentations, query]);

  const hasActiveFilters = Object.keys(filters).some(
    (key) => key !== "order" && key !== "order_by"
  );

  const openPreview = async (presentation: CommunityPresentation) => {
    const previewStartedAt = Date.now();
    trackEvent(MixpanelEvent.Community_Presentation_Previewed, {
      pathname,
      presentation_id: presentation.id,
      source: "presentation_card",
    });
    setPreview(presentation);
    setPreviewLoading(true);
    try {
      const detail = await CommunityPresentationApi.getById(presentation.id);
      setPreview(detail);
      setPresentations((current) =>
        current.map((item) => (item.id === detail.id ? detail : item))
      );
      trackEvent(MixpanelEvent.Community_Presentation_Preview_Loaded, {
        pathname,
        presentation_id: detail.id,
        slide_count: detail.slides?.length ?? 0,
        duration_ms: Date.now() - previewStartedAt,
      });
    } catch (previewError) {
      trackEvent(MixpanelEvent.Community_Presentation_Preview_Failed, {
        pathname,
        presentation_id: presentation.id,
        duration_ms: Date.now() - previewStartedAt,
        error_message: sanitizeAnalyticsError(
          previewError,
          "Failed to load community presentation preview"
        ),
      });
      notify.error(
        "Could not load the complete preview",
        previewError instanceof Error ? previewError.message : undefined
      );
    } finally {
      setPreviewLoading(false);
    }
  };

  const useDesign = (
    presentation: CommunityPresentation,
    source: "presentation_card" | "preview_dialog"
  ) => {
    const properties = {
      pathname,
      presentation_id: presentation.id,
      source,
      slide_count: presentation.slides?.length ?? 0,
      has_shared_prompt: Boolean(presentation.prompt?.trim()),
    };
    trackEvent(MixpanelEvent.Community_Design_Used, properties);
    trackEvent(MixpanelEvent.Smart_Mode_Selected, {
      ...properties,
      source: `community_design_${source}`,
      reference_id: presentation.id,
    });
    const params = new URLSearchParams({
      mode: "smart",
      communityId: String(presentation.id),
    });
    router.push(`/upload?${params.toString()}`);
  };

  const usePrompt = (presentation: CommunityPresentation) => {
    const prompt = presentation.prompt?.trim();
    if (!prompt) {
      notify.error(
        "Prompt unavailable",
        "This community presentation does not include a shared prompt."
      );
      return;
    }
    const properties = {
      pathname,
      presentation_id: presentation.id,
      source: "presentation_card",
      prompt_char_count: prompt.length,
      prompt_word_count: prompt.split(/\s+/).filter(Boolean).length,
    };
    trackEvent(MixpanelEvent.Community_Prompt_Used, properties);
    trackEvent(MixpanelEvent.Smart_Mode_Selected, {
      ...properties,
      source: "community_prompt_presentation_card",
      reference_id: presentation.id,
    });
    const params = new URLSearchParams({ mode: "smart", prompt });
    router.push(`/upload?${params.toString()}`);
  };

  return (
    <div className="min-h-screen font-manrope">
      <header className="sticky right-0 top-0 z-40 ml-7 mr-[9px] flex min-h-[105px] items-center justify-between border-b border-[#EDEEEF] bg-white px-1">
        <h1 className="font-syne text-[22px] font-medium tracking-[-0.66px] text-[#101323]">
          Community
        </h1>
        <Link
          href="/upload"
          className="inline-flex h-10 items-center gap-2 rounded-full bg-[linear-gradient(270deg,#D5CAFC_2.4%,#E3D2EB_27.88%,#F4DCD3_69.23%,#FDE4C2_100%)] px-4 font-syne text-sm font-medium text-[#191919] shadow-sm transition hover:shadow-md"
        >
          New presentation
          <ChevronRight className="h-4 w-4" />
        </Link>
      </header>

      <main className="px-7 py-8">
        <div className="flex min-h-10 flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-base font-medium text-[#191919]">
              Pick community designs or prompts
            </h2>
            <p className="mt-1 text-xs text-[#808080]">
              Preview shared decks, then use their design or prompt in Smart mode.
            </p>
          </div>
          <div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end lg:w-auto">
            <label className="flex h-10 w-full items-center gap-2.5 rounded-full border border-[#DBDBDB99] bg-white px-2.5 sm:w-[234px]">
              <Search className="h-4 w-4 shrink-0 text-[#808080]" strokeWidth={1.75} />
              <span className="sr-only">Search community presentations</span>
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
              onChange={(nextFilters) => {
                trackEvent(MixpanelEvent.Community_Filters_Changed, {
                  pathname,
                  ...getFilterAnalyticsProps(nextFilters),
                });
                setPage(1);
                setFilters(nextFilters);
              }}
              disabled={loading}
            />
          </div>
        </div>

        {loading ? (
          <CommunityGridSkeleton />
        ) : error ? (
          <div className="mt-5 rounded-xl border border-dashed border-[#D9D9DE] bg-[#FAFAFC] px-6 py-12 text-center">
            <h3 className="text-sm font-semibold text-[#191919]">
              Could not load community presentations
            </h3>
            <p className="mt-1 text-xs text-[#808080]">{error}</p>
            <button
              type="button"
              onClick={() => setRetryVersion((current) => current + 1)}
              className="mt-4 rounded-full border border-[#E0DDFC] bg-white px-4 py-2 text-xs font-medium text-[#6847F4] transition hover:bg-[#EFF6FF]"
            >
              Try again
            </button>
          </div>
        ) : filteredPresentations.length > 0 ? (
          <div className="mt-5 grid grid-cols-1 gap-[18px] sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 min-[2200px]:grid-cols-6">
            {filteredPresentations.map((presentation) => (
              <CommunityPresentationCard
                key={presentation.id}
                presentation={presentation}
                onPreview={() => void openPreview(presentation)}
                onUseDesign={() =>
                  useDesign(presentation, "presentation_card")
                }
                onUsePrompt={() => usePrompt(presentation)}
              />
            ))}
          </div>
        ) : (
          <div className="mt-5 rounded-xl border border-dashed border-[#D9D9DE] bg-[#FAFAFC] px-6 py-12 text-center">
            <Search className="mx-auto h-5 w-5 text-[#808080]" />
            <h3 className="mt-3 text-sm font-semibold text-[#191919]">
              {query.trim() || hasActiveFilters
                ? "No matching community presentations"
                : "No community presentations yet"}
            </h3>
            <p className="mt-1 text-xs text-[#808080]">
              {query.trim() || hasActiveFilters
                ? "Try another search or clear your filters."
                : "Shared presentations will appear here."}
            </p>
          </div>
        )}

        {!loading && !error && totalPages > 1 && !query.trim() && (
          <div className="mt-7 flex items-center justify-center gap-4 text-xs text-[#666666]">
            <button
              type="button"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={page <= 1}
              className="inline-flex h-9 items-center gap-1 rounded-full border border-[#EDEEEF] bg-white px-3 text-[#191919] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              Previous
            </button>
            <span>
              Page {page} of {totalPages}
            </span>
            <button
              type="button"
              onClick={() =>
                setPage((current) => Math.min(totalPages, current + 1))
              }
              disabled={page >= totalPages}
              className="inline-flex h-9 items-center gap-1 rounded-full border border-[#EDEEEF] bg-white px-3 text-[#191919] disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </main>

      <CommunityDesignPreviewDialog
        presentation={preview}
        open={Boolean(preview)}
        loading={previewLoading}
        onOpenChange={(open) => {
          if (!open) setPreview(null);
        }}
        onUseDesign={(presentation) =>
          useDesign(presentation, "preview_dialog")
        }
      />
    </div>
  );
}

function CommunityPresentationCard({
  presentation,
  onPreview,
  onUseDesign,
  onUsePrompt,
}: {
  presentation: CommunityPresentation;
  onPreview: () => void;
  onUseDesign: () => void;
  onUsePrompt: () => void;
}) {
  const title = getCommunityPresentationTitle(presentation);
  const thumbnail = presentation.slides?.find((slide) => slide.trim());
  const author = getCommunityPresentationAuthor(presentation);

  return (
    <article className="min-w-0 overflow-hidden rounded-xl border border-[#EDEEEF] bg-white shadow-[0_2px_12px_rgba(0,0,0,0.08)]">
      <button
        type="button"
        onClick={onPreview}
        className="group block aspect-[306/169] w-full overflow-hidden bg-[#F8FBFB] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#2563EB]/35"
        aria-label={`Preview ${title}`}
      >
        {thumbnail ? (
          <div className="transition duration-300 group-hover:scale-[1.015]">
            <SmartHtmlSlide
              html={thumbnail}
              fonts={presentation.fonts}
              title={`${title} preview`}
            />
          </div>
        ) : (
          <span className="flex h-full items-center justify-center text-xs text-[#999999]">
            No preview
          </span>
        )}
      </button>

      <div className="border-t border-[#EDEEEF] px-2.5 pb-2.5">
        <div className="flex min-h-[54px] items-center gap-2 py-3 sm:gap-2.5 sm:py-3.5">
          <p className="min-w-0 flex-1 truncate text-sm font-semibold tracking-[0.14px] text-[#191919]" title={title}>
            {title}
          </p>
          <button
            type="button"
            onClick={onPreview}
            className="flex h-[26px] w-[42px] items-center justify-center rounded-full border border-[#EDEEEF] bg-white text-[#191919] transition hover:bg-[#F6F6F9]"
            aria-label={`Preview ${title}`}
          >
            <Eye className="h-3.5 w-3.5" strokeWidth={1.6} />
          </button>
          <div className="flex h-[26px] overflow-hidden rounded-full border border-[#EDEEEF] bg-white">
            <button
              type="button"
              onClick={onUseDesign}
              className="px-3.5 pr-2 font-syne text-xs font-medium text-[#191919] transition hover:bg-[#F6F6F9]"
            >
              Use
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex w-6 items-center justify-center border-l border-[#EDEEEF] transition hover:bg-[#F6F6F9]"
                  aria-label={`Choose how to use ${title}`}
                >
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[190px] rounded-xl p-2 font-manrope">
                <DropdownMenuItem onSelect={onUseDesign} className="cursor-pointer rounded-md">
                  <Plus className="h-4 w-4" />
                  Use design
                </DropdownMenuItem>
                {presentation.prompt?.trim() && (
                  <DropdownMenuItem onSelect={onUsePrompt} className="cursor-pointer rounded-md">
                    <FileText className="h-4 w-4" />
                    Use prompt
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="flex min-h-[34px] items-center justify-between border-t border-[#EDEEEF] py-2.5 text-[10px] font-medium tracking-[0.4px] text-[#808080]">
          <span className="min-w-0 flex-1 truncate" title={author}>by {author}</span>
          <div className="ml-2 flex shrink-0 items-center gap-3">
            <span className="inline-flex items-center gap-1" aria-label={`${presentation.views ?? 0} views`}>
              <Eye className="h-3.5 w-3.5" strokeWidth={1.5} />
              {formatCount(presentation.views ?? 0)}
            </span>
            <span className="inline-flex items-center gap-1" aria-label={`${presentation.likes ?? 0} likes`}>
              <Heart className="h-3.5 w-3.5" strokeWidth={1.5} />
              {formatCount(presentation.likes ?? 0)}
            </span>
          </div>
        </div>
      </div>
    </article>
  );
}

function CommunityGridSkeleton() {
  return (
    <div className="mt-5 grid grid-cols-1 gap-[18px] sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 min-[2200px]:grid-cols-6">
      {Array.from({ length: 10 }).map((_, index) => (
        <div
          key={index}
          className="aspect-[306/267] animate-pulse rounded-xl border border-[#EDEEEF] bg-[#F6F6F9]"
        />
      ))}
    </div>
  );
}

function formatCount(value: number) {
  return Intl.NumberFormat("en", { notation: "compact" }).format(value);
}
