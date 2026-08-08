"use client";

import { useMemo, useState } from "react";
import { ChevronDown, Copy, Search } from "lucide-react";
import type { TemplateV2Layout } from "@/components/slide-editor/importing/template-v2-import";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  readLayoutDescription,
  readLayoutId,
  readLayoutIdValue,
} from "./templatePreviewUtils";

const LAYOUT_ID_MAX_LENGTH = 80;
const LAYOUT_DESCRIPTION_MAX_LENGTH = 300;

type LayoutsPanelProps = {
  activeLayoutIndex: number;
  layouts: TemplateV2Layout[];
  onCopyLayoutId: (layoutIndex: number) => void;
  onLayoutIdChange: (layoutIndex: number, value: string) => void;
  onLayoutDescriptionChange: (layoutIndex: number, value: string) => void;
  onSelectLayout: (layoutIndex: number) => void;
};

type LayoutPanelItem = {
  description: string;
  displayName: string;
  id: string;
  idValue: string;
  index: number;
};

function limitText(value: string, maxLength: number) {
  return value.slice(0, maxLength);
}

export function LayoutsPanel({
  activeLayoutIndex,
  layouts,
  onCopyLayoutId,
  onLayoutIdChange,
  onLayoutDescriptionChange,
  onSelectLayout,
}: LayoutsPanelProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const layoutItems = useMemo<LayoutPanelItem[]>(
    () =>
      layouts.map((layout, index) => ({
        description: readLayoutDescription(layout),
        displayName: readLayoutId(layout, index),
        id: readLayoutId(layout, index),
        idValue: readLayoutIdValue(layout, index),
        index,
      })),
    [layouts],
  );

  const filteredLayouts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return layoutItems;

    return layoutItems.filter((item) => {
      const searchable = [
        item.displayName,
        item.idValue,
        item.description,
        item.id,
        String(item.index + 1),
      ]
        .join(" ")
        .toLowerCase();

      return searchable.includes(query);
    });
  }, [layoutItems, searchQuery]);

  return (
    <aside className="hidden w-[299px] shrink-0 bg-[#FEFEFF] lg:flex lg:flex-col">
      <div className="flex min-h-0 flex-1 flex-col px-3 pb-6 pt-8">
        <h2 className="text-[16px] font-medium leading-5 text-[#101828]">
          Deck Layouts
        </h2>

        <label className="relative mt-5 block">
          <Search className="pointer-events-none absolute left-[10px] top-1/2 h-[14px] w-[14px] -translate-y-1/2 text-[#4C4C4C]" />
          <Input
            aria-label="Search slides"
            className="h-[30px] rounded-[8px] border-[rgba(219,219,219,0.6)] bg-white pl-[30px] pr-3 text-[12px] font-normal text-[#191919] shadow-none placeholder:text-[#4C4C4C] focus-visible:ring-0"
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search Slides"
            value={searchQuery}
          />
        </label>

        <div className="mt-7 min-h-0 flex-1 overflow-y-auto pr-0.5">
          {filteredLayouts.length === 0 ? (
            <div className="rounded-[8px] border border-dashed border-[#DCDCE1] px-4 py-8 text-center text-[13px] text-[#808080]">
              No layouts found.
            </div>
          ) : (
            <div className="flex flex-col gap-0 rounded-[12px]">
              {filteredLayouts.map((item) => (
                <LayoutRow
                  key={item.index}
                  description={item.description}
                  displayName={item.displayName}
                  index={item.index}
                  isActive={item.index === activeLayoutIndex}
                  idValue={item.idValue}
                  onCopy={() => onCopyLayoutId(item.index)}
                  onDescriptionChange={(value) =>
                    onLayoutDescriptionChange(
                      item.index,
                      limitText(value, LAYOUT_DESCRIPTION_MAX_LENGTH),
                    )
                  }
                  onIdChange={(value) =>
                    onLayoutIdChange(
                      item.index,
                      limitText(value, LAYOUT_ID_MAX_LENGTH),
                    )
                  }
                  onSelect={() => onSelectLayout(item.index)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}

function LayoutRow({
  description,
  displayName,
  idValue,
  index,
  isActive,
  onCopy,
  onDescriptionChange,
  onIdChange,
  onSelect,
}: {
  description: string;
  displayName: string;
  idValue: string;
  index: number;
  isActive: boolean;
  onCopy: () => void;
  onDescriptionChange: (value: string) => void;
  onIdChange: (value: string) => void;
  onSelect: () => void;
}) {
  return (
    <div
      className={cn(
        "w-full rounded-[12px]",
        isActive
          ? "border border-[#EDEEEF] bg-white px-[10px] py-3"
          : "bg-white px-[10px] py-3",
      )}
    >
      <div className="flex min-h-[20px] items-center justify-between gap-[10px]">
        <button
          className="flex min-w-0 flex-1 items-center gap-[10px] text-left text-[14px] font-normal leading-normal text-[#191919]"
          onClick={onSelect}
          type="button"
        >
          <span className="shrink-0 font-manrope">{index + 1}.</span>
          <span className="min-w-0 flex-1 truncate">{displayName}</span>
        </button>

        <div className="flex shrink-0 items-center gap-[10px]">
          <button
            aria-label={`Copy layout ${index + 1} ID`}
            className="flex h-[18px] w-[18px] items-center justify-center rounded-[4px] text-[#191919] transition-colors hover:bg-[#F7F6F9] hover:text-[#7A5AF8]"
            onClick={(event) => {
              event.stopPropagation();
              onCopy();
            }}
            title="Copy ID"
            type="button"
          >
            <Copy className="h-[14px] w-[14px]" />
          </button>
          <button
            aria-label={`Select layout ${index + 1}`}
            className="flex h-[18px] w-[18px] items-center justify-center rounded-[4px] text-[#191919] transition-colors hover:bg-[#F7F6F9]"
            onClick={onSelect}
            type="button"
          >
            <ChevronDown
              className={cn(
                "h-[14px] w-[14px] transition-transform",
                isActive ? "rotate-0" : "-rotate-90",
              )}
            />
          </button>
        </div>
      </div>

      {isActive ? (
        <div className="mt-5 flex flex-col gap-[14px]">
          <label className="flex flex-col gap-2 text-[14px] font-normal text-[#333333]">
            Slide ID
            <div className="relative min-h-[52px] rounded-[8px] border border-[rgba(219,219,219,0.6)] bg-white px-[10px] pb-[20px] pt-[10px]">
              <input
                className="w-full bg-transparent pr-[48px] text-[14px] font-normal leading-normal text-[#191919] outline-none placeholder:text-[#191919]"
                maxLength={LAYOUT_ID_MAX_LENGTH}
                onChange={(event) => onIdChange(event.target.value)}
                placeholder="Add Slide ID"
                type="text"
                value={idValue}
              />
              <span className="pointer-events-none absolute bottom-[5px] right-[10px] text-[10px] leading-none text-[#666666]">
                {idValue.length}/{LAYOUT_ID_MAX_LENGTH}
              </span>
            </div>
          </label>

          <label className="flex flex-col gap-2 text-[14px] font-normal text-[#333333]">
            Slide Description
            <div className="relative">
              <Textarea
                className="min-h-[70px] resize-none rounded-[8px] border-[rgba(219,219,219,0.6)] bg-white px-[10px] pb-[22px] pt-[10px] text-[14px] font-normal leading-[18px] text-[#191919] shadow-none placeholder:text-[#191919] focus-visible:ring-0"
                maxLength={LAYOUT_DESCRIPTION_MAX_LENGTH}
                onChange={(event) => onDescriptionChange(event.target.value)}
                placeholder="Add Source Text"
                value={description}
              />
              <span className="pointer-events-none absolute bottom-[8px] right-[10px] text-[10px] leading-none text-[#666666]">
                {description.length}/{LAYOUT_DESCRIPTION_MAX_LENGTH}
              </span>
            </div>
          </label>
        </div>
      ) : null}
    </div>
  );
}
