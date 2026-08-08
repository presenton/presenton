"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  Copy,
  EllipsisVertical,
  MoveLeft,
  MoveRight,
  Plus,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";

const slideMenuItemClass =
  "flex h-9 cursor-pointer select-none items-center gap-2.5 px-4 text-[14px] font-normal leading-none text-[#191919] outline-none transition-colors focus:bg-[#F7F6F9] data-[disabled]:pointer-events-none data-[disabled]:cursor-not-allowed data-[disabled]:text-[#9B9B9B]";

type EditorActionBarProps = {
  canDeleteSlide: boolean;
  canMoveLeft: boolean;
  canMoveRight: boolean;
  isReconstructing: boolean;
  onAddBlank: () => void;
  onCopy: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onMoveLeft: () => void;
  onMoveRight: () => void;
  onReconstruct: () => void;
};

export function EditorActionBar({
  canDeleteSlide,
  canMoveLeft,
  canMoveRight,
  isReconstructing,
  onAddBlank,
  onCopy,
  onDelete,
  onDuplicate,
  onMoveLeft,
  onMoveRight,
  onReconstruct,
}: EditorActionBarProps) {
  return (
    <div className="mx-auto flex h-[45px] w-fit shrink-0 items-center gap-[12px] rounded-[10px] border border-[#EDEEEF] bg-white p-[6px]">
      <button
        className="flex h-[33px] w-[133px] shrink-0 items-center justify-center gap-[8px] whitespace-nowrap rounded-[48px] px-[10px] py-[8px] text-[14px] font-medium text-[#101323] transition-colors hover:bg-[#F7F6F9] disabled:pointer-events-none disabled:opacity-60"
        disabled={isReconstructing}
        onClick={onReconstruct}
        type="button"
      >
        <span className="whitespace-nowrap">Re-Construct</span>
        <RefreshCw
          className={cn(
            "h-[14px] w-[14px] shrink-0",
            isReconstructing && "animate-spin text-[#7A5AF8]",
          )}
        />
      </button>
      <div className="h-[20px] w-0 shrink-0 border-l border-[#EDEEEF]" />
      <button
        className="flex h-[33px] shrink-0 items-center justify-center gap-[7px] whitespace-nowrap rounded-[48px] px-[10px] py-[8px] text-[14px] font-medium text-[#101323] transition-colors hover:bg-[#F7F6F9]"
        onClick={onAddBlank}
        title="Add blank slide"
        type="button"
      >
        <span>Blank</span>
        <Plus className="h-4 w-4 shrink-0" />
      </button>
      <div className="h-[20px] w-0 shrink-0 border-l border-[#EDEEEF]" />
      <button
        className="flex h-[33px] w-[97px] shrink-0 items-center justify-center gap-[8px] whitespace-nowrap rounded-[48px] px-[10px] py-[8px] text-[14px] font-medium text-[#101323] transition-colors hover:bg-[#F7F6F9]"
        onClick={onCopy}
        type="button"
      >
        <span className="whitespace-nowrap">Copy ID</span>
        <Copy className="h-4 w-4 shrink-0" />
      </button>
      <div className="h-[20px] w-0 shrink-0 border-l border-[#EDEEEF]" />
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button
            className="flex h-[33px] w-9 shrink-0 items-center justify-center rounded-[6px] text-[#191919] transition-colors hover:bg-[#F7F6F9]"
            title="Slide actions"
            type="button"
          >
            <EllipsisVertical className="h-4 w-4" />
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            align="end"
            sideOffset={8}
            className="z-[80] w-[205px] overflow-hidden rounded-[10px] border border-[#EDEEEF] bg-white py-2 shadow-[0_10px_24px_rgba(16,24,40,0.14)]"
          >
            <DropdownMenu.Item
              className={slideMenuItemClass}
              onSelect={onDuplicate}
            >
              <Copy className="h-4 w-4" />
              Duplicate Slide
            </DropdownMenu.Item>
            <DropdownMenu.Item
              className={slideMenuItemClass}
              disabled={!canMoveRight}
              onSelect={onMoveRight}
            >
              <MoveRight className="h-4 w-4" />
              Move Right
            </DropdownMenu.Item>
            <DropdownMenu.Item
              className={slideMenuItemClass}
              disabled={!canMoveLeft}
              onSelect={onMoveLeft}
            >
              <MoveLeft className="h-4 w-4" />
              Move Left
            </DropdownMenu.Item>
            <DropdownMenu.Separator className="my-2 h-px bg-[#EDEEEF]" />
            <DropdownMenu.Item
              className={cn(slideMenuItemClass, "text-red-600")}
              disabled={!canDeleteSlide}
              onSelect={onDelete}
            >
              <Trash2 className="h-4 w-4" />
              Delete Slide
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    </div>
  );
}
