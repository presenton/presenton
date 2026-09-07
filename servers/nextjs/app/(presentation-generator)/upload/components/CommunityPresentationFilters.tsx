"use client";

import { useState } from "react";
import { SlidersHorizontal, X } from "lucide-react";

import {
  type CommunityPresentationListFilters,
  type CommunityPresentationOrderBy,
  type CommunityPresentationSortOrder,
} from "../../services/api/community";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

type CountComparison = "any" | "exact" | "gt" | "lt";

type FilterDraft = {
  createdAfter: string;
  createdBefore: string;
  viewsComparison: CountComparison;
  viewsValue: string;
  likesComparison: CountComparison;
  likesValue: string;
};

type SortOption = {
  value: string;
  label: string;
  orderBy?: CommunityPresentationOrderBy;
  order?: CommunityPresentationSortOrder;
};

const DEFAULT_SORT_VALUE = "default";

const SORT_OPTIONS: SortOption[] = [
  { value: DEFAULT_SORT_VALUE, label: "Default" },
  {
    value: "created_at:desc",
    label: "Newest",
    orderBy: "created_at",
    order: "desc",
  },
  {
    value: "created_at:asc",
    label: "Oldest",
    orderBy: "created_at",
    order: "asc",
  },
  {
    value: "views:desc",
    label: "Most viewed",
    orderBy: "views",
    order: "desc",
  },
  {
    value: "views:asc",
    label: "Least viewed",
    orderBy: "views",
    order: "asc",
  },
  {
    value: "likes:desc",
    label: "Most liked",
    orderBy: "likes",
    order: "desc",
  },
  {
    value: "likes:asc",
    label: "Least liked",
    orderBy: "likes",
    order: "asc",
  },
  {
    value: "priority:desc",
    label: "Featured first",
    orderBy: "priority",
    order: "desc",
  },
  {
    value: "priority:asc",
    label: "Featured last",
    orderBy: "priority",
    order: "asc",
  },
];

const EMPTY_DRAFT: FilterDraft = {
  createdAfter: "",
  createdBefore: "",
  viewsComparison: "any",
  viewsValue: "",
  likesComparison: "any",
  likesValue: "",
};

export default function CommunityPresentationFilters({
  value,
  onChange,
  disabled = false,
}: {
  value: CommunityPresentationListFilters;
  onChange: (filters: CommunityPresentationListFilters) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<FilterDraft>(() => createDraft(value));
  const sortValue =
    value.order_by && value.order
      ? `${value.order_by}:${value.order}`
      : DEFAULT_SORT_VALUE;
  const activeFilterCount = getActiveFilterCount(value);

  const handleSortChange = (nextValue: string) => {
    const option = SORT_OPTIONS.find((item) => item.value === nextValue);
    if (!option) return;

    if (!option.orderBy || !option.order) {
      const next = { ...value };
      delete next.order_by;
      delete next.order;
      onChange(next);
      return;
    }

    onChange({ ...value, order_by: option.orderBy, order: option.order });
  };

  const applyFilters = () => {
    const next = getSortFilters(value);
    if (draft.createdAfter) {
      next.created_at_gt = toApiDateTime(draft.createdAfter, false);
    }
    if (draft.createdBefore) {
      next.created_at_lt = toApiDateTime(draft.createdBefore, true);
    }
    applyCountFilter(next, "views", draft.viewsComparison, draft.viewsValue);
    applyCountFilter(next, "likes", draft.likesComparison, draft.likesValue);
    onChange(next);
    setOpen(false);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        value={sortValue}
        onValueChange={handleSortChange}
        disabled={disabled}
      >
        <SelectTrigger
          className="h-10 w-[148px] rounded-full border-[#DBDBDB99] bg-white px-3 font-manrope text-xs shadow-none focus:ring-[#2563EB]/20"
          aria-label="Sort community presentations"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="font-manrope">
          {SORT_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Popover
        open={open}
        onOpenChange={(nextOpen) => {
          if (nextOpen) setDraft(createDraft(value));
          setOpen(nextOpen);
        }}
      >
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={disabled}
            className={cn(
              "inline-flex h-10 items-center gap-2 rounded-full border bg-white px-3 font-manrope text-xs font-medium text-[#191919] transition hover:border-[#D8D3FA] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB]/20 disabled:cursor-not-allowed disabled:opacity-50",
              activeFilterCount > 0
                ? "border-[#CFC8FD] bg-[#FAFAFF]"
                : "border-[#DBDBDB99]"
            )}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Filters
            {activeFilterCount > 0 && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[#2563EB] px-1 text-[10px] text-white">
                {activeFilterCount}
              </span>
            )}
          </button>
        </PopoverTrigger>

        <PopoverContent
          align="end"
          sideOffset={8}
          className="w-[min(360px,calc(100vw-2rem))] rounded-xl border-[#EDEEEF] p-4 font-manrope shadow-[0_12px_32px_rgba(25,25,25,0.12)]"
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-[#191919]">
                Community filters
              </h3>
              <p className="mt-0.5 text-[11px] text-[#808080]">
                Narrow presentations by date and engagement.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="flex h-7 w-7 items-center justify-center rounded-full text-[#666666] hover:bg-[#F6F6F9]"
              aria-label="Close filters"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-4 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <DateFilter
                label="Created after"
                value={draft.createdAfter}
                onChange={(createdAfter) =>
                  setDraft((current) => ({ ...current, createdAfter }))
                }
              />
              <DateFilter
                label="Created before"
                value={draft.createdBefore}
                onChange={(createdBefore) =>
                  setDraft((current) => ({ ...current, createdBefore }))
                }
              />
            </div>
            <CountFilter
              label="Views"
              comparison={draft.viewsComparison}
              value={draft.viewsValue}
              onComparisonChange={(viewsComparison) =>
                setDraft((current) => ({ ...current, viewsComparison }))
              }
              onValueChange={(viewsValue) =>
                setDraft((current) => ({ ...current, viewsValue }))
              }
            />
            <CountFilter
              label="Likes"
              comparison={draft.likesComparison}
              value={draft.likesValue}
              onComparisonChange={(likesComparison) =>
                setDraft((current) => ({ ...current, likesComparison }))
              }
              onValueChange={(likesValue) =>
                setDraft((current) => ({ ...current, likesValue }))
              }
            />
          </div>

          <div className="mt-5 flex items-center justify-between border-t border-[#EDEEEF] pt-4">
            <button
              type="button"
              onClick={() => {
                setDraft(EMPTY_DRAFT);
                onChange(getSortFilters(value));
                setOpen(false);
              }}
              disabled={activeFilterCount === 0}
              className="text-xs font-medium text-[#666666] hover:text-[#191919] disabled:cursor-not-allowed disabled:opacity-40"
            >
              Clear filters
            </button>
            <button
              type="button"
              onClick={applyFilters}
              className="h-9 rounded-full bg-[#2563EB] px-5 text-xs font-medium text-white transition hover:bg-[#1D4ED8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB]/30"
            >
              Apply
            </button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

function DateFilter({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-[#333333]">
        {label}
      </span>
      <input
        type="date"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-9 w-full rounded-lg border border-[#E0E0E3] bg-white px-2 text-[11px] text-[#191919] outline-none transition focus:border-[#BDB4FB] focus:ring-2 focus:ring-[#2563EB]/10"
      />
    </label>
  );
}

function CountFilter({
  label,
  comparison,
  value,
  onComparisonChange,
  onValueChange,
}: {
  label: string;
  comparison: CountComparison;
  value: string;
  onComparisonChange: (comparison: CountComparison) => void;
  onValueChange: (value: string) => void;
}) {
  return (
    <div>
      <span className="mb-1.5 block text-xs font-medium text-[#333333]">
        {label}
      </span>
      <div className="grid grid-cols-[minmax(0,1fr)_110px] gap-2">
        <Select
          value={comparison}
          onValueChange={(nextValue) =>
            onComparisonChange(nextValue as CountComparison)
          }
        >
          <SelectTrigger className="h-9 border-[#E0E0E3] text-xs shadow-none focus:ring-[#2563EB]/10">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="font-manrope">
            <SelectItem value="any">Any</SelectItem>
            <SelectItem value="exact">Exactly</SelectItem>
            <SelectItem value="gt">More than</SelectItem>
            <SelectItem value="lt">Fewer than</SelectItem>
          </SelectContent>
        </Select>
        <input
          type="number"
          min={0}
          step={1}
          inputMode="numeric"
          value={value}
          onChange={(event) => onValueChange(event.target.value)}
          disabled={comparison === "any"}
          placeholder="Count"
          className="h-9 w-full rounded-lg border border-[#E0E0E3] bg-white px-3 text-xs text-[#191919] outline-none transition placeholder:text-[#A0A0A0] focus:border-[#BDB4FB] focus:ring-2 focus:ring-[#2563EB]/10 disabled:bg-[#F7F7F9] disabled:text-[#A0A0A0]"
        />
      </div>
    </div>
  );
}

function createDraft(filters: CommunityPresentationListFilters): FilterDraft {
  const views = getCountFilter(filters, "views");
  const likes = getCountFilter(filters, "likes");
  return {
    createdAfter: filters.created_at_gt?.slice(0, 10) ?? "",
    createdBefore: filters.created_at_lt?.slice(0, 10) ?? "",
    viewsComparison: views.comparison,
    viewsValue: views.value,
    likesComparison: likes.comparison,
    likesValue: likes.value,
  };
}

function getSortFilters(
  filters: CommunityPresentationListFilters
): CommunityPresentationListFilters {
  if (!filters.order_by || !filters.order) return {};
  return { order_by: filters.order_by, order: filters.order };
}

function getCountFilter(
  filters: CommunityPresentationListFilters,
  field: "views" | "likes"
): { comparison: CountComparison; value: string } {
  if (filters[field] !== undefined) {
    return { comparison: "exact", value: String(filters[field]) };
  }
  if (filters[`${field}_gt`] !== undefined) {
    return { comparison: "gt", value: String(filters[`${field}_gt`]) };
  }
  if (filters[`${field}_lt`] !== undefined) {
    return { comparison: "lt", value: String(filters[`${field}_lt`]) };
  }
  return { comparison: "any", value: "" };
}

function applyCountFilter(
  filters: CommunityPresentationListFilters,
  field: "views" | "likes",
  comparison: CountComparison,
  rawValue: string
) {
  if (comparison === "any" || !rawValue.trim()) return;
  const parsedValue = Number(rawValue);
  if (!Number.isFinite(parsedValue) || parsedValue < 0) return;
  const value = Math.floor(parsedValue);
  if (comparison === "exact") filters[field] = value;
  else if (comparison === "gt") filters[`${field}_gt`] = value;
  else filters[`${field}_lt`] = value;
}

function getActiveFilterCount(filters: CommunityPresentationListFilters) {
  return [
    Boolean(filters.created_at_gt),
    Boolean(filters.created_at_lt),
    filters.views !== undefined ||
      filters.views_gt !== undefined ||
      filters.views_lt !== undefined,
    filters.likes !== undefined ||
      filters.likes_gt !== undefined ||
      filters.likes_lt !== undefined,
  ].filter(Boolean).length;
}

function toApiDateTime(value: string, endOfDay: boolean) {
  return `${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}Z`;
}
