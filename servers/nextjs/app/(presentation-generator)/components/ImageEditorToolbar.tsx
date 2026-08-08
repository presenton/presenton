"use client";

import Image from "next/image";
import { ChevronDown, Focus, Maximize, Minimize } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type ObjectFitMode = "cover" | "contain" | "fill";

const FIT_OPTIONS: Array<{ value: ObjectFitMode; label: string }> = [
  { value: "cover", label: "Fill" },
  { value: "contain", label: "Contain" },
  { value: "fill", label: "Stretch" },
];

function PatternIcon() {
  const cells = [
    "#0E1014",
    "#848588",
    "#C3C4C9",
    "#4F5155",
    "#848588",
    "#C3C4C9",
    "#0E1014",
    "#4F5155",
    "#A2A5A9",
  ];
  return (
    <span className="grid h-4 w-4 grid-cols-3 gap-[1px]" aria-hidden>
      {cells.map((color, index) => (
        <span key={index} className="h-[4px] w-[4px]" style={{ backgroundColor: color }} />
      ))}
    </span>
  );
}

export function ImageEditorToolbar({
  objectFit,
  isFocusPointMode,
  onObjectFitChange,
  onToggleFocusPoint,
  onReplaceImage,
}: {
  objectFit: ObjectFitMode;
  isFocusPointMode: boolean;
  onObjectFitChange: (value: ObjectFitMode) => void;
  onToggleFocusPoint: () => void;
  onReplaceImage: () => void;
}) {
  const fitLabel = FIT_OPTIONS.find((item) => item.value === objectFit)?.label ?? "Fill";

  return (
    <div className="inline-flex items-center gap-3 rounded-[6px] bg-white px-[10px] py-[6px] shadow-[0_0_4px_rgba(0,0,0,0.15)]">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="inline-flex w-[83px] items-center justify-between rounded-[10px] bg-white py-[6px] text-[14px] font-medium leading-4 text-[#191919] font-syne"
          >
            <span>{fitLabel}</span>
            <ChevronDown size={14} strokeWidth={1.8} aria-hidden />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          sideOffset={8}
          className="z-[10001] w-[170px] rounded-[10px] border border-[#EDEEEF] bg-white py-1"
        >
          {FIT_OPTIONS.map((option) => (
            <DropdownMenuItem
              key={option.value}
              onSelect={() => onObjectFitChange(option.value)}
              className={cn(
                "cursor-pointer rounded-none px-3 py-2 text-[14px] text-[#191919] font-manrope focus:bg-[#F6F6F9]",
                objectFit === option.value && "bg-[#F4F1FF] text-[#7C3AED]",
              )}
            >
              {option.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <span aria-hidden className="h-[23px] w-px bg-[#EDEEEF]" />

      <button
        type="button"
        title="Replace image"
        aria-label="Replace image"
        onClick={onReplaceImage}
        className="rounded-[2px] p-1 text-[#191919] hover:bg-[#F8F8FA]"
      >
        <Image
          alt=""
          aria-hidden="true"
          height={16}
          src="/figma-assets/image-replace.svg"
          unoptimized
          width={16}
          className="size-4"
        />
      </button>

      <span aria-hidden className="h-[23px] w-px bg-[#EDEEEF]" />

      <div className="inline-flex items-center gap-3">
        <button
          type="button"
          title="Fill"
          aria-label="Fill"
          onClick={() => onObjectFitChange("cover")}
          className={cn(
            "rounded-[2px] p-1 text-[#191919] hover:bg-[#F8F8FA]",
            objectFit === "cover" && "bg-[#F4F1FF] text-[#7C3AED]",
          )}
        >
          <Maximize size={16} strokeWidth={1.8} />
        </button>
        <button
          type="button"
          title="Contain"
          aria-label="Contain"
          onClick={() => onObjectFitChange("contain")}
          className={cn(
            "rounded-[2px] p-1 text-[#191919] hover:bg-[#F8F8FA]",
            objectFit === "contain" && "bg-[#F4F1FF] text-[#7C3AED]",
          )}
        >
          <Minimize size={16} strokeWidth={1.8} />
        </button>
        <button
          type="button"
          title="Stretch"
          aria-label="Stretch"
          onClick={() => onObjectFitChange("fill")}
          className={cn(
            "rounded-[2px] p-1 text-[#191919] hover:bg-[#F8F8FA]",
            objectFit === "fill" && "bg-[#F4F1FF] text-[#7C3AED]",
          )}
        >
          <span className="inline-block h-[16px] w-[16px] rounded-[2px] border border-current" />
        </button>
      </div>

      <span aria-hidden className="h-[23px] w-px bg-[#EDEEEF]" />

      <button
        type="button"
        title="Focus point"
        aria-label="Focus point"
        onClick={onToggleFocusPoint}
        className={cn(
          "rounded-[2px] p-1 text-[#191919] hover:bg-[#F8F8FA]",
          isFocusPointMode && "bg-[#F4F1FF] text-[#7C3AED]",
        )}
      >
        {isFocusPointMode ? <Focus size={16} strokeWidth={1.8} /> : <PatternIcon />}
      </button>
    </div>
  );
}
