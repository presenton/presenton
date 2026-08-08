"use client";

import { Replace } from "lucide-react";
import type { ComponentActionsMenuActions } from "@/components/slide-editor/selection/ComponentActionsMenu";
import {
  ComponentActionsMenu,
  ComponentUngroupButton,
} from "@/components/slide-editor/selection/ComponentActionsMenu";
import type { ImageSlideElement } from "@/components/slide-editor/state/state";
import { elementBox } from "@/components/slide-editor/model/element-model";
import { DeferredColorInput } from "@/components/slide-editor/toolbar/DeferredColorInput";
import {
  FloatingToolbar,
  type FloatingToolbarBox,
} from "@/components/slide-editor/toolbar/FloatingToolbar";
import { withHash } from "@/components/slide-editor/utils/color";

export function IconToolbar({
  anchorBox,
  componentActions,
  element,
  index,
  onChange,
  onEditIcon,
  scale,
}: {
  anchorBox?: FloatingToolbarBox | null;
  componentActions?: ComponentActionsMenuActions | null;
  element: ImageSlideElement;
  index: number;
  onChange: (index: number, element: ImageSlideElement) => void;
  onEditIcon: () => void;
  scale: number;
}) {
  const box = elementBox(element);
  const iconColor = withHash(element.color, "#000000");
  const update = (changes: Partial<ImageSlideElement>) => {
    onChange(index, { ...element, ...changes });
  };

  return (
    <FloatingToolbar
      anchorBox={
        anchorBox ?? {
          x: box.x * scale,
          y: box.y * scale,
          width: box.w * scale,
          height: box.h * scale,
        }
      }
      fallbackWidth={220}
      inlineEditIgnore
      className="inline-flex items-center gap-2 rounded-[6px] bg-white px-[10px] py-[6px] font-syne text-[#191919] shadow-[0_0_4px_rgba(0,0,0,0.15)]"
    >
      <label
        title="Icon color"
        aria-label="Icon color"
        className="relative flex h-8 cursor-pointer items-center gap-2 rounded-[6px] px-2 text-[13px] font-medium hover:bg-[#F6F6F9]"
      >
        <span
          aria-hidden="true"
          className="size-4 rounded-full border border-black/10"
          style={{ backgroundColor: iconColor }}
        />
        <span>Color</span>
        <DeferredColorInput
          aria-label="Icon color"
          value={iconColor}
          onCommit={(color) => update({ color })}
          className="absolute inset-0 size-full cursor-pointer opacity-0"
        />
      </label>

      <Divider />

      <button
        type="button"
        title="Change icon"
        aria-label="Change icon"
        onClick={onEditIcon}
        className="flex h-8 items-center gap-2 rounded-[6px] px-2 text-[13px] font-medium hover:bg-[#F6F6F9]"
      >
        <Replace size={16} strokeWidth={1.7} aria-hidden="true" />
        <span>Change icon</span>
      </button>

      {componentActions ? (
        <>
          <Divider />
          <ComponentUngroupButton actions={componentActions} />
          {componentActions.canUngroup ? <Divider /> : null}
          <ComponentActionsMenu actions={componentActions} />
        </>
      ) : null}
    </FloatingToolbar>
  );
}

function Divider() {
  return <span aria-hidden="true" className="h-5 w-px bg-[#EDEEEF]" />;
}
