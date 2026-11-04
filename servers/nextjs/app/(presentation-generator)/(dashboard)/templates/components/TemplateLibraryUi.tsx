"use client";
/* eslint-disable @next/next/no-img-element */

import { useEffect, useRef } from "react";
import { ArrowDownUp, Command, Ellipsis, Search } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  TemplateTabSwitcher,
  TemplateThumbnailPreview,
} from "../../../components/TemplateListUi";
import type { TemplateTab } from "../../../hooks/useTemplateSummaries";
import type { TemplateListItem } from "../../../services/api/template";

export type TemplateLibrarySort = "name-asc" | "name-desc" | "newest" | "oldest";

const sortOptions: { value: TemplateLibrarySort; label: string }[] = [
  { value: "name-asc", label: "A to Z" },
  { value: "name-desc", label: "Z to A" },
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
];

export function compareTemplateLibraryItems(
  left: { name?: string; created_at?: string },
  right: { name?: string; created_at?: string },
  sort: TemplateLibrarySort,
) {
  const byName = (left.name ?? "").localeCompare(right.name ?? "", "en", {
    numeric: true,
    sensitivity: "base",
  });
  if (sort === "name-asc") return byName;
  if (sort === "name-desc") return -byName;
  const leftDate = Date.parse(left.created_at ?? "") || 0;
  const rightDate = Date.parse(right.created_at ?? "") || 0;
  return (sort === "newest" ? rightDate - leftDate : leftDate - rightDate) || byName;
}

export function TemplateLibraryPattern() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute -left-[600px] top-0 h-[1440px] w-[1920px] overflow-hidden">
      <div
        className="h-[1440px] w-[1920px]"
        style={{
          maskImage: "radial-gradient(ellipse 751.588px 1440px at 50% 0%, #000 0%, transparent 95.3125%)",
          maskPosition: "240px 0",
          maskSize: "1440px 1440px",
          maskRepeat: "no-repeat",
        }}
      >
        <img src="/template-library/pattern.svg" alt="" className="block max-w-none" />
      </div>
    </div>
  );
}

export function TemplateLibraryControls({
  tab, onTabChange, query, onQueryChange, sort, onSortChange,
}: {
  tab: TemplateTab;
  onTabChange: (tab: TemplateTab) => void;
  query: string;
  onQueryChange: (query: string) => void;
  sort: TemplateLibrarySort;
  onSortChange: (sort: TemplateLibrarySort) => void;
}) {
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const focusSearch = (event: KeyboardEvent) => {
      if (
        (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k" &&
        !document.querySelector('[role="dialog"], [role="alertdialog"]')
      ) {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", focusSearch);
    return () => window.removeEventListener("keydown", focusSearch);
  }, []);

  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between md:gap-5">
      <TemplateTabSwitcher tab={tab} onTabChange={onTabChange} libraryPage />
      <div className="flex min-w-0 flex-wrap items-center justify-end gap-x-[17px] gap-y-3 sm:flex-nowrap">
        <label className="flex h-[38px] w-full min-w-0 flex-none items-center gap-2.5 rounded-md border border-[#EDEEEF] bg-[#F9FAFB] px-2.5 focus-within:ring-2 focus-within:ring-[#7A5AF8]/30 sm:w-[298px]">
          <Search aria-hidden="true" className="h-4 w-4 shrink-0 text-[#808080]" strokeWidth={1.5} />
          <Input
            ref={searchRef}
            type="search"
            aria-label="Search templates"
            aria-keyshortcuts="Meta+K Control+K"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            onKeyDown={(event) => { if (event.key === "Escape") onQueryChange(""); }}
            placeholder="Search by title or keyword"
            className="h-full min-w-0 rounded-none border-0 bg-transparent p-0 font-syne text-sm font-normal text-[#191919] shadow-none placeholder:text-[#808080] focus-visible:ring-0 sm:text-base"
          />
          <kbd aria-hidden="true" className="hidden shrink-0 items-center gap-px font-syne text-[14.316px] text-[#CCCCCC] sm:flex">
            <Command className="h-[11px] w-[11px]" strokeWidth={1.5} />K
          </kbd>
        </label>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" aria-label="Sort templates" className="flex h-[38px] shrink-0 items-center gap-1.5 rounded-md font-manrope text-[13px] font-medium tracking-[-0.39px] text-[#191919] outline-none focus-visible:ring-2 focus-visible:ring-[#7A5AF8]/30">
              {sortOptions.find((option) => option.value === sort)?.label}
              <ArrowDownUp aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={1.5} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="font-manrope">
            <DropdownMenuRadioGroup value={sort} onValueChange={(value) => onSortChange(value as TemplateLibrarySort)}>
              {sortOptions.map((option) => <DropdownMenuRadioItem key={option.value} value={option.value}>{option.label}</DropdownMenuRadioItem>)}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

export function TemplateLibraryCard({ template, onOpen }: {
  template: TemplateListItem;
  onOpen: () => void;
}) {
  const createdAt = template.created_at ? new Date(template.created_at) : null;
  const hasDate = createdAt !== null && !Number.isNaN(createdAt.getTime());

  return (
    <Card className="motion-card relative min-w-0 overflow-hidden rounded-xl border-0 bg-white font-manrope shadow-none after:pointer-events-none after:absolute after:inset-0 after:rounded-xl after:border after:border-[#EDEEEF] hover:after:border-[#D8D3FA]">
      <button type="button" onClick={onOpen} aria-label={`Open ${template.name} template`} className="group block w-full text-left outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#7A5AF8]">
        <div className="relative aspect-[304.5/169.183] w-full overflow-hidden bg-[#F8FBFB]">
          <TemplateLibraryPattern />
          <TemplateThumbnailPreview thumbnail={template.thumbnail} templateName={template.name} selectionPage flush />
          <span aria-hidden="true" className="pointer-events-none absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/[0.03]" />
        </div>
        <div className="flex h-[47px] min-w-0 items-center border-t border-[#EDEEEF] px-2.5 py-3.5">
          <h3 title={template.name} className="truncate text-sm font-semibold leading-[19px] tracking-[0.14px] text-[#191919]">{template.name}</h3>
        </div>
      </button>
      <div className="relative px-2.5 pb-2.5">
        <div aria-hidden="true" className="absolute inset-x-2.5 top-0 h-px bg-[#EDEEEF]" />
        <div className="flex h-[42px] items-center justify-between gap-2 py-2.5">
          <div className="flex min-w-0 items-center gap-1">
            <time dateTime={hasDate ? template.created_at : undefined} className="shrink-0 text-[10px] font-medium leading-[14px] tracking-[0.4px] text-[#808080]">
              {hasDate ? createdAt.toLocaleDateString("en-GB") : "—"}
            </time>
            <div className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[#F4F4F4] px-[5px] py-1 text-[10px] font-medium leading-[14px] text-[#333]">
              <div aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#0BA5EC]" />{template.layout_count ?? 0} Layout
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" aria-label={`Options for ${template.name}`} className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded outline-none hover:bg-[#F6F6F9] focus-visible:ring-2 focus-visible:ring-[#7A5AF8]/30">
                <Ellipsis aria-hidden="true" className="h-[18px] w-[18px] text-[#808080]" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="font-manrope">
              <DropdownMenuItem onSelect={onOpen}>Open template</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </Card>
  );
}
